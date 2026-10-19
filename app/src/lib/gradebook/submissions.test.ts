import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The submissions client's contract with
 * `20261019120000_learning_submissions.sql`: the RPC and its argument names,
 * the columns read, that a school without the migration reads as "not set up"
 * rather than as an error, and that a refusal is thrown with the server's
 * sentence while a lost answer is thrown as unknown.
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
  for (const m of ['select', 'order', 'eq', 'limit']) {
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

import { handIns, handInProblem, loadSubmissions, MAX_SUBMISSION, notSetUp, shortHash, submitWork } from './submissions';
import { ServiceError, settled } from '../attempt';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

const HASH = 'a'.repeat(60) + 'c210';

describe('handing in', () => {
  it('calls learning_submit with the item, the text and the key, and reads the receipt', async () => {
    replies.set('rpc:learning_submit', { data: { submission: 's-1', version: 2, content_hash: HASH, submitted_at: '2026-10-19T12:00:00Z' } });
    const r = await submitWork('item-1', 'My essay.', 'key-12345');
    expect(calls).toEqual([{ kind: 'rpc', name: 'learning_submit', args: { want_item: 'item-1', want_body: 'My essay.', want_key: 'key-12345' }, chain: [] }]);
    expect(r).toEqual({ submission: 's-1', version: 2, contentHash: HASH, at: '2026-10-19T12:00:00Z' });
  });

  it('throws a refusal as settled, in the server’s words without its prefix', async () => {
    replies.set('rpc:learning_submit', { error: { message: 'semester: that needs submissions:create on this course in 2026FA', code: '42501' } });
    const e = await submitWork('item-1', 'x', 'key-12345').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect(settled(e)).toBe(true);
    expect((e as Error).message).toBe('That needs submissions:create on this course in 2026FA.');
  });

  it('throws a lost answer as unknown, so the retry keeps its key', async () => {
    replies.set('rpc:learning_submit', { error: { message: 'Failed to fetch' } });
    const e = await submitWork('item-1', 'x', 'key-12345').catch((x: unknown) => x);
    expect(settled(e)).toBe(false);
    expect((e as Error).message).toMatch(/not known whether the change was made/);
  });
});

describe('reading what was handed in', () => {
  it('reads one course and term, and which grade version names which hand-in', async () => {
    replies.set('from:learning_submissions', {
      data: [{ id: 's-1', item_id: 'i', student_id: 'st', version: 1, body: 'Draft one', content_hash: HASH, submitted_at: '2026-10-19T12:00:00Z' }],
    });
    replies.set('from:grade_entries', { data: [{ id: 'g-1', submission_id: 's-1' }, { id: 'g-2', submission_id: null }] });
    const r = await loadSubmissions('HIST 2100', '2026FA');
    expect(r.available).toBe(true);
    expect(r.submissions).toEqual([{ id: 's-1', itemId: 'i', studentId: 'st', version: 1, body: 'Draft one', contentHash: HASH, at: '2026-10-19T12:00:00Z' }]);
    expect(r.graded).toEqual({ 'g-1': 's-1' });
    const sub = calls.find((c) => c.name === 'learning_submissions');
    expect(sub?.chain).toEqual([
      'select("id,item_id,student_id,version,body,content_hash,submitted_at")',
      'eq("course_code","HIST 2100")',
      'eq("term","2026FA")',
      'order("submitted_at")',
    ]);
  });

  it.each(['42P01', '42703', 'PGRST204', 'PGRST205'])('reads a school without the migration (%s) as not set up, not as a failure', async (code) => {
    replies.set('from:learning_submissions', { error: { message: 'relation does not exist', code } });
    await expect(loadSubmissions('HIST 2100', '2026FA')).resolves.toEqual({ available: false, submissions: [], graded: {} });
  });

  it('a missing submission_id column alone is also not set up', async () => {
    replies.set('from:grade_entries', { error: { message: 'column grade_entries.submission_id does not exist', code: '42703' } });
    await expect(loadSubmissions('HIST 2100', '2026FA')).resolves.toMatchObject({ available: false });
  });

  it('any other error is thrown, not swallowed as not set up', async () => {
    replies.set('from:learning_submissions', { error: { message: 'permission denied', code: '42501' } });
    await expect(loadSubmissions('HIST 2100', '2026FA')).rejects.toBeInstanceOf(ServiceError);
    expect(notSetUp({ code: '42501' })).toBe(false);
    expect(notSetUp(null)).toBe(false);
  });
});

describe('the pure parts', () => {
  const s = (id: string, item: string, student: string, version: number) => ({ id, itemId: item, studentId: student, version, body: '', contentHash: HASH, at: '' });

  it('lists one student’s hand-ins on one item, latest first, and nobody else’s', () => {
    const list = [s('a', 'i', 'me', 1), s('b', 'i', 'you', 1), s('c', 'i', 'me', 2), s('d', 'j', 'me', 1)];
    expect(handIns(list, 'i', 'me').map((x) => x.id)).toEqual(['c', 'a']);
  });

  it('refuses an empty or over-long hand-in before the call, as the server would', () => {
    expect(handInProblem('   ')).toMatch(/Write or paste/);
    expect(handInProblem('x'.repeat(MAX_SUBMISSION + 1))).toMatch(/at most/);
    expect(handInProblem(' fine ')).toBeNull();
  });

  it('shortens a hash the same way everywhere', () => {
    expect(shortHash(HASH)).toBe('aaaa…c210');
    expect(shortHash('abc')).toBe('abc');
  });
});
