import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The registration client's contract with
 * `20260929300000_registration_transaction.sql`: which RPC, which argument
 * names, which columns become which fields — and the two kinds of "no" kept
 * apart. A refusal (`ok: false`) is an answer, returned with the reason in
 * words; a raise is thrown with the server's sentence; a failure with no
 * SQLSTATE is the network.
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
  const reply = () => replies.get(`${kind}:${name}`) ?? { data: null, error: null };
  const self: Record<string, unknown> = {
    then: (ok: (r: Reply) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(reply()).then(ok, bad),
  };
  for (const m of ['select', 'order', 'eq']) {
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

import {
  clashes,
  decide,
  drop,
  enroll,
  explain,
  grantOverride,
  holdsRegistrar,
  inPlan,
  landing,
  loadMyHold,
  loadMyRegistration,
  loadPending,
  loadSections,
  loadTerms,
  meetsSaid,
  phase,
  putSection,
  putTerm,
  readAnswer,
  withdraw,
  type LiveSection,
} from './client';
import { ServiceError } from '../attempt';

beforeEach(() => {
  calls.length = 0;
  replies.clear();
});

const section = (patch: Partial<LiveSection> = {}): LiveSection => ({
  id: 's-1',
  term: '2026FA',
  courseCode: 'ECON 1020',
  section: '01',
  title: 'Principles of Economics',
  credits: 3,
  capacity: 30,
  waitlistCapacity: 5,
  seatsTaken: 29,
  waiting: 0,
  meetings: [{ days: [1, 3], start: 540, end: 590 }],
  prerequisites: [],
  requiresApproval: false,
  version: 4,
  ...patch,
});

describe('reading', () => {
  it('reads the calendar and the sections from their tables, by term', async () => {
    replies.set('from:registration_terms', { data: [{ term: '2026FA', opens_at: 'a', add_drop_ends_at: 'b', withdraw_ends_at: 'c', max_credits: '18.0' }] });
    replies.set('from:registration_sections', {
      data: [{ id: 's-1', term: '2026FA', course_code: 'ECON 1020', section: '01', title: 'T', credits: '3.0', capacity: 30, waitlist_capacity: 5, seats_taken: 29, waiting: 0, meetings: [{ days: [1, 3], start: 540, end: 590 }], prerequisites: ['ECON 1010'], requires_approval: true, version: 4 }],
    });
    expect(await loadTerms()).toEqual([{ term: '2026FA', opensAt: 'a', addDropEndsAt: 'b', withdrawEndsAt: 'c', maxCredits: 18 }]);
    const [s] = await loadSections('2026FA');
    expect(s).toMatchObject({ courseCode: 'ECON 1020', credits: 3, capacity: 30, waitlistCapacity: 5, prerequisites: ['ECON 1010'], requiresApproval: true });
    expect(calls.find((c) => c.name === 'registration_sections')?.chain).toContain('eq("term","2026FA")');
  });

  it('reads my_registration with the term, and the place in line', async () => {
    replies.set('rpc:my_registration', { data: [{ enrollment_id: 'e-1', section_id: 's-1', course_code: 'ECON 1020', section: '01', state: 'waitlisted', grade: null, wait_position: 2 }] });
    expect(await loadMyRegistration('2026FA')).toEqual([
      { enrollmentId: 'e-1', sectionId: 's-1', courseCode: 'ECON 1020', section: '01', state: 'waitlisted', grade: null, waitPosition: 2 },
    ]);
    expect(calls[0]).toMatchObject({ kind: 'rpc', name: 'my_registration', args: { want_term: '2026FA' } });
  });

  it('reads a hold as whether, which office and its link — and never a reason, even if one is sent', async () => {
    replies.set('rpc:my_registration_hold', { data: [{ held: true, office: 'Bursar', link: 'https://bursar.example.edu', reason: 'unpaid tuition' }] });
    const hold = await loadMyHold();
    expect(hold).toEqual({ held: true, office: 'Bursar', link: 'https://bursar.example.edu' });
    expect(JSON.stringify(hold)).not.toContain('unpaid');
  });

  it('drops a hold link that is not https', async () => {
    replies.set('rpc:my_registration_hold', { data: [{ held: true, office: 'Bursar', link: 'javascript:alert(1)' }] });
    expect((await loadMyHold()).link).toBe('');
  });

  it('reads pending requests for the registrar, joined to their section, for one term', async () => {
    replies.set('from:registration_enrollments', {
      data: [{ id: 'e-9', student: 'stu-1', section_id: 's-1', created_at: '2026-09-01T00:00:00Z', registration_sections: { course_code: 'ECON 1020', section: '01', title: 'T', term: '2026FA' } }],
    });
    expect(await loadPending('2026FA')).toEqual([
      { enrollmentId: 'e-9', student: 'stu-1', sectionId: 's-1', courseCode: 'ECON 1020', section: '01', title: 'T', term: '2026FA', requestedAt: '2026-09-01T00:00:00Z' },
    ]);
    expect(calls[0].chain).toEqual(expect.arrayContaining(['eq("state","pending_approval")', 'eq("registration_sections.term","2026FA")']));
  });
});

describe('the student’s writers', () => {
  it('send the section, the key and what the review expected', async () => {
    replies.set('rpc:registration_enroll', { data: { ok: true, outcome: 'enrolled', reason: 'ok', message: 'Enrolled in ECON 1020 01.', replayed: false, promoted: 0, seats_taken: 30, capacity: 30 } });
    const a = await enroll('s-1', 'enroll:s-1.k1', 'seat', 'ECON 1020 01');
    expect(calls[0]).toMatchObject({ name: 'registration_enroll', args: { want_section: 's-1', want_key: 'enroll:s-1.k1', want_expect: 'seat' } });
    expect(a).toMatchObject({ ok: true, outcome: 'enrolled', message: 'Enrolled in ECON 1020 01.', seatsTaken: 30 });
    await drop('s-1', 'k2-abcdef', 'ECON 1020 01');
    await withdraw('s-1', 'k3-abcdef', 'ECON 1020 01');
    expect(calls.slice(1).map((c) => [c.name, c.args])).toEqual([
      ['registration_drop', { want_section: 's-1', want_key: 'k2-abcdef' }],
      ['registration_withdraw', { want_section: 's-1', want_key: 'k3-abcdef' }],
    ]);
  });

  it('return a refusal as an answer, in plain words, with the hold’s office', async () => {
    replies.set('rpc:registration_enroll', {
      data: { ok: false, outcome: 'refused', reason: 'hold', message: 'A hold on your account blocks registration.', replayed: false, promoted: 0, hold: { office: 'Bursar', link: 'https://b.example.edu' } },
    });
    const a = await enroll('s-1', 'k-abcdefgh', null, 'ECON 1020 01');
    expect(a.ok).toBe(false);
    expect(a.message).toMatch(/hold on your account stops you adding courses/);
    expect(a.hold).toEqual({ office: 'Bursar', link: 'https://b.example.edu' });
  });

  it('throw a raise as an answered ServiceError, and a lost reply as an unanswered one', async () => {
    replies.set('rpc:registration_drop', { data: null, error: { code: '42501', message: 'semester: claim your school first' } });
    await expect(drop('s-1', 'k-abcdefgh', 'x')).rejects.toMatchObject({ answered: true, message: 'Claim your school first.' });
    replies.set('rpc:registration_drop', { data: null, error: { code: '', message: 'TypeError: Failed to fetch' } });
    const e = await drop('s-1', 'k-abcdefgh', 'x').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).answered).toBe(false);
  });
});

describe('the registrar’s writers', () => {
  it('name their arguments as the migration does', async () => {
    replies.set('rpc:registrar_decide', { data: { ok: true, outcome: 'enrolled', reason: 'ok', message: 'Approved.' } });
    await decide('e-9', true, 'Instructor agreed', 'dec-abcdefgh', 'ECON 1020 01');
    await grantOverride({ student: 'stu-1', sectionId: 's-1', waives: ['capacity', 'prerequisite'], reason: 'Senior' }, 'ovr-abcdefgh', 'ECON 1020 01');
    await putTerm({ term: '2026FA', opensAt: 'o', addDropEndsAt: 'a', withdrawEndsAt: 'w', maxCredits: 18 });
    replies.set('rpc:registrar_put_section', { data: 's-new' });
    expect(await putSection({ term: '2026FA', courseCode: 'econ 1020', section: '02', title: 'T', credits: 3, capacity: 20, waitlistCapacity: 2, meetings: [], prerequisites: [], requiresApproval: false })).toBe('s-new');
    expect(calls.map((c) => [c.name, Object.keys(c.args as object).sort()])).toEqual([
      ['registrar_decide', ['want_approve', 'want_enrollment', 'want_key', 'want_reason']],
      ['registrar_grant_override', ['want_key', 'want_reason', 'want_section', 'want_student', 'want_waives']],
      ['registrar_put_term', ['want_add_drop_ends', 'want_max_credits', 'want_opens', 'want_term', 'want_withdraw_ends']],
      ['registrar_put_section', ['want_capacity', 'want_course', 'want_credits', 'want_meetings', 'want_prerequisites', 'want_requires_approval', 'want_section', 'want_term', 'want_title', 'want_waitlist']],
    ]);
  });

  it('hold the registrar capability at exactly this school', () => {
    const g = (scopeKind: string, scopeId: string) => [{ capability: 'registration:administer', scopeKind, scopeId }];
    expect(holdsRegistrar(g('school', 'vu'), 'vu')).toBe(true);
    expect(holdsRegistrar(g('school', 'other'), 'vu')).toBe(false);
    expect(holdsRegistrar(g('platform', ''), 'vu')).toBe(false);
    expect(holdsRegistrar([], 'vu')).toBe(false);
  });
});

describe('the words', () => {
  it('has a sentence for every reason the database can refuse with', () => {
    const reasons = ['kill_switch', 'flag_off', 'hold', 'window_not_open', 'window_closed', 'already_enrolled', 'already_waitlisted', 'already_pending', 'prerequisite_missing', 'time_conflict', 'credit_limit', 'full', 'stale_seat_count', 'not_enrolled', 'drop_deadline_passed', 'withdraw_not_yet', 'withdraw_deadline_passed', 'unknown_section', 'unknown_student', 'not_pending', 'bad_override', 'idempotency_conflict'];
    for (const r of reasons) {
      const said = explain(r, 'ECON 1020 01', 'SERVER');
      expect(said, r).not.toBe('SERVER');
      expect(said, r).not.toMatch(/_/);
      expect(said.endsWith('.'), r).toBe(true);
    }
  });

  it('falls back to the server’s sentence for a reason it does not know', () => {
    expect(readAnswer({ ok: false, reason: 'something_new', message: 'A new refusal.' }, 'x').message).toBe('A new refusal.');
  });
});

describe('beside the plan', () => {
  it('says where an enroll would land', () => {
    expect(landing(section())).toBe('seat');
    expect(landing(section({ seatsTaken: 30 }))).toBe('waitlist');
    expect(landing(section({ seatsTaken: 30, waiting: 5 }))).toBe('full');
    expect(landing(section({ requiresApproval: true }))).toBe('approval');
  });

  it('reads the term’s phase from its calendar', () => {
    const t = { term: '2026FA', opensAt: '2026-04-01T00:00:00Z', addDropEndsAt: '2026-09-10T00:00:00Z', withdrawEndsAt: '2026-11-01T00:00:00Z', maxCredits: 18 };
    expect(phase(null, new Date())).toBe('unknown');
    expect(phase(t, new Date('2026-03-01'))).toBe('before');
    expect(phase(t, new Date('2026-09-01'))).toBe('add_drop');
    expect(phase(t, new Date('2026-10-01'))).toBe('withdraw');
    expect(phase(t, new Date('2026-12-01'))).toBe('closed');
  });

  it('finds a clash with the planner’s own conflicts, and a planned section by code', () => {
    const other = section({ id: 's-2', courseCode: 'HIST 1100', meetings: [{ days: [3], start: 560, end: 640 }] });
    const apart = section({ id: 's-3', courseCode: 'MATH 1300', meetings: [{ days: [2], start: 540, end: 590 }] });
    expect(clashes(section(), [other, apart]).map((s) => s.id)).toEqual(['s-2']);
    const cart = [{ id: 'c', code: 'econ  1020', section: '01', title: '', term: '', department: '', credits: 3, instructor: '', location: '', description: '', prerequisites: '', seats: null, meetings: [] }];
    expect(inPlan(section(), cart)).toBe('section');
    expect(inPlan(section({ section: '02' }), cart)).toBe('course');
    expect(inPlan(other, cart)).toBeNull();
    expect(meetsSaid(section().meetings)).toBe('Mon Wed 09:00–09:50');
  });
});
