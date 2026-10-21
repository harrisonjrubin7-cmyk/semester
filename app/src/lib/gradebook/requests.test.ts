import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The course-request client's contract with `20261021120000_course_requests.sql`:
 * which RPC, which argument names, which columns become which fields; that a
 * school without the migration reads as "not set up" rather than an error;
 * that a stale version is told apart from any other refusal; and that what
 * this person may do comes from grants at exactly the course and term.
 */

interface Reply {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

const calls: { kind: 'rpc' | 'from'; name: string; args?: unknown; chain: string[] }[] = [];
const replies = new Map<string, Reply>();

function chain(kind: 'rpc' | 'from', name: string, args?: unknown) {
  const call = { kind, name, args, chain: [] as string[] };
  calls.push(call);
  const reply = () => replies.get(`${kind}:${name}`) ?? { data: kind === 'from' ? [] : null, error: null };
  const self: Record<string, unknown> = {
    then: (ok: (r: Reply) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, bad),
  };
  for (const m of ['select', 'order', 'eq', 'in']) {
    self[m] = (...a: unknown[]) => {
      call.chain.push(`${m}(${a.map((x) => JSON.stringify(x)).join(',')})`);
      return self;
    };
  }
  return self;
}

vi.mock('../cloud', () => ({
  cloudConfigured: true,
  cloud: async () => ({
    rpc: (name: string, args?: unknown) => chain('rpc', name, args),
    from: (name: string) => chain('from', name),
  }),
}));

import { ServiceError, settled } from '../attempt';
import {
  decideProblem,
  decideRequest,
  dueSaid,
  fileProblem,
  fileRequest,
  loadRequests,
  NOT_SET_UP_SAID,
  openQuestion,
  requestCaps,
  respondToRequest,
  StaleRequest,
  withdrawRequest,
  type CourseRequest,
} from './requests';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

const ROW = {
  id: 'r1',
  student_id: 'maya',
  course_code: 'HIST 2100',
  term: '2026FA',
  kind: 'extension',
  reason: 'Funeral',
  item_id: 'i1',
  requested_due: '2026-11-10',
  status: 'approved',
  decided_by: 'prof',
  decided_at: '2026-11-01T10:00:00Z',
  granted_due: '2026-11-09',
  decision_note: 'Until the 9th.',
  version: 4,
  filed_at: '2026-10-30T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
};

describe('reading a course’s requests', () => {
  it('reads the requests, their history and the items, scoped to the course and term', async () => {
    replies.set('from:course_requests', { data: [ROW] });
    replies.set('from:course_request_actions', { data: [{ id: 'a1', request_id: 'r1', actor: 'maya', action: 'filed', note: '', version: 1, at: 'x' }] });
    replies.set('from:gradebook_items', { data: [{ id: 'i1', title: 'Essay 2' }] });
    const got = await loadRequests('HIST 2100', '2026FA');
    expect(got.available).toBe(true);
    expect(got.requests[0]).toMatchObject({ id: 'r1', kind: 'extension', status: 'approved', requestedDue: '2026-11-10', grantedDue: '2026-11-09', version: 4, itemId: 'i1' });
    expect(got.actions).toHaveLength(1);
    expect(got.items).toEqual([{ id: 'i1', title: 'Essay 2' }]);
    const reqs = calls.find((c) => c.name === 'course_requests')!;
    expect(reqs.chain).toContain('eq("course_code","HIST 2100")');
    expect(reqs.chain).toContain('eq("term","2026FA")');
    expect(calls.find((c) => c.name === 'course_request_actions')!.chain).toContain('in("request_id",["r1"])');
  });

  it('does not ask for history when there are no requests', async () => {
    const got = await loadRequests('HIST 2100', '2026FA');
    expect(got).toMatchObject({ available: true, requests: [], actions: [] });
    expect(calls.some((c) => c.name === 'course_request_actions')).toBe(false);
  });

  it.each(['42P01', '42703', 'PGRST205', 'PGRST200'])('reads %s as not set up here, not as an error', async (code) => {
    replies.set('from:course_requests', { error: { message: 'missing', code } });
    await expect(loadRequests('HIST 2100', '2026FA')).resolves.toMatchObject({ available: false, requests: [] });
  });

  it('throws any other failure with the server’s words', async () => {
    replies.set('from:course_requests', { error: { message: 'semester: boom', code: 'XX000' } });
    await expect(loadRequests('HIST 2100', '2026FA')).rejects.toThrow('Boom.');
  });
});

describe('the writers', () => {
  it('files with the migration’s argument names, and drops a date on anything but an extension', async () => {
    replies.set('rpc:course_request_file', { data: { request: 'r9', status: 'open', version: 1, granted_due: null, at: 't' } });
    const r = await fileRequest({ course: 'HIST 2100', term: '2026FA', kind: 'excused_absence', itemId: null, requestedDue: '2026-11-10', reason: 'Ill' }, 'key-12345');
    expect(r).toEqual({ request: 'r9', status: 'open', version: 1, grantedDue: null, at: 't' });
    expect(calls[0].args).toEqual({
      want_course: 'HIST 2100',
      want_term: '2026FA',
      want_kind: 'excused_absence',
      want_item: null,
      want_requested_due: null,
      want_reason: 'Ill',
      want_key: 'key-12345',
    });
  });

  it('withdraws, answers and decides naming the version read', async () => {
    await withdrawRequest('r1', 2, 'k-withdraw');
    await respondToRequest('r1', 'Essay 2', 3, 'k-respond');
    await decideRequest({ requestId: 'r1', outcome: 'deny', grantedDue: '2026-11-09', note: 'No', expect: 4 }, 'k-decide');
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ['course_request_withdraw', { want_request: 'r1', want_expect: 2, want_key: 'k-withdraw' }],
      ['course_request_respond', { want_request: 'r1', want_note: 'Essay 2', want_expect: 3, want_key: 'k-respond' }],
      // A date goes only with an approval.
      ['course_request_decide', { want_request: 'r1', want_outcome: 'deny', want_granted_due: null, want_note: 'No', want_expect: 4, want_key: 'k-decide' }],
    ]);
  });

  it('tells a stale version apart, and it is settled', async () => {
    replies.set('rpc:course_request_decide', { error: { message: 'semester: this request changed since you read it (it is at version 3 now). Reload it and look again', code: '40001' } });
    const e = await decideRequest({ requestId: 'r1', outcome: 'approve', grantedDue: '2026-11-09', note: '', expect: 2 }, 'k').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(StaleRequest);
    expect(settled(e)).toBe(true);
    expect((e as Error).message).toBe('This request changed since you read it (it is at version 3 now). Reload it and look again.');
  });

  it('a refusal is the server’s sentence and not stale', async () => {
    replies.set('rpc:course_request_file', { error: { message: 'semester: that needs course_requests:create on this course in 2026FA', code: '42501' } });
    const e = await fileRequest({ course: 'HIST 2100', term: '2026FA', kind: 'incomplete', itemId: null, requestedDue: null, reason: 'x' }, 'k').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect(e).not.toBeInstanceOf(StaleRequest);
    expect((e as Error).message).toBe('That needs course_requests:create on this course in 2026FA.');
  });

  it('a missing function says the feature is not set up', async () => {
    replies.set('rpc:course_request_file', { error: { message: 'Could not find the function', code: 'PGRST202' } });
    await expect(fileRequest({ course: 'HIST 2100', term: '2026FA', kind: 'incomplete', itemId: null, requestedDue: null, reason: 'x' }, 'k')).rejects.toThrow(NOT_SET_UP_SAID);
  });

  it('a lost answer is unknown, so the retry keeps its key', async () => {
    replies.set('rpc:course_request_withdraw', { error: { message: 'Failed to fetch' } });
    const e = await withdrawRequest('r1', 1, 'k').catch((x: unknown) => x);
    expect(settled(e)).toBe(false);
  });
});

describe('who may do what', () => {
  const g = (capability: string, scopeId: string, scopeKind = 'course') => ({ capability, scopeKind, scopeId });

  it('reads grants at exactly this school, course and term', () => {
    const grants = [
      g('course_requests:create', 'vu/HIST 2100/2026FA'),
      g('course_requests:decide', 'vu/HIST 2100/2027SP'),
      g('course_requests:decide', 'other/HIST 2100/2026FA'),
      g('course_requests:decide', 'vu/HIST 2100'),
      g('course_requests:view', 'vu', 'school'),
    ];
    expect(requestCaps(grants, 'vu', 'HIST 2100', '2026FA')).toEqual({ create: true, decide: false, view: false });
    expect(requestCaps([g('course_requests:decide', 'vu/HIST 2100/2026FA')], 'vu', 'HIST 2100', '2026FA')).toEqual({ create: false, decide: true, view: true });
    expect(requestCaps([g('course_requests:view', 'vu/HIST 2100/2026FA')], 'vu', 'HIST 2100', '2026FA')).toEqual({ create: false, decide: false, view: true });
  });
});

describe('checks before a call', () => {
  it('an extension needs a date and every request a reason', () => {
    expect(fileProblem({ kind: 'extension', requestedDue: null, reason: 'x' })).toMatch(/date/);
    expect(fileProblem({ kind: 'extension', requestedDue: '2026-11-10', reason: '  ' })).toMatch(/why/);
    expect(fileProblem({ kind: 'incomplete', requestedDue: null, reason: 'x'.repeat(2001) })).toMatch(/at most/);
    expect(fileProblem({ kind: 'excused_absence', requestedDue: null, reason: 'Ill' })).toBeNull();
  });

  it('approving an extension needs a date; denying and asking need words', () => {
    expect(decideProblem('extension', { outcome: 'approve', grantedDue: null, note: '' })).toMatch(/date/);
    expect(decideProblem('incomplete', { outcome: 'approve', grantedDue: null, note: '' })).toBeNull();
    expect(decideProblem('incomplete', { outcome: 'deny', grantedDue: null, note: ' ' })).toMatch(/why/);
    expect(decideProblem('incomplete', { outcome: 'ask', grantedDue: null, note: '' })).toMatch(/question/);
  });

  it('a date is the calendar day asked for, wherever the reader is', () => {
    expect(dueSaid('2026-11-09')).toContain('9');
    expect(dueSaid(null)).toBe('—');
  });

  it('finds the instructor’s open question', () => {
    const r = { id: 'r1', status: 'info_requested' } as CourseRequest;
    const acts = [
      { id: 'a', requestId: 'r1', actor: 'p', action: 'info_requested' as const, note: 'Which essay?', version: 2, at: '' },
      { id: 'b', requestId: 'r2', actor: 'p', action: 'info_requested' as const, note: 'Other', version: 2, at: '' },
    ];
    expect(openQuestion(r, acts)).toBe('Which essay?');
    expect(openQuestion({ ...r, status: 'open' }, acts)).toBeNull();
  });
});
