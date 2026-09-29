import { afterEach, describe, expect, it, vi } from 'vitest';
import { flagDefinition } from '../flags';
import type { CatalogCourse } from '../registration';
import {
  EMPTY_LEDGER,
  STOPPED_BY,
  cartRequests,
  gateReason,
  promote,
  review,
  sectionFrom,
  seatsTaken,
  submit,
  waitPosition,
  type Context,
  type Hold,
  type Ledger,
  type Request,
  type StudentFacts,
} from './index';

// ── Fixtures ─────────────────────────────────────────────────────────────

const TERM = '2026FA';
const OPENS = '2026-10-01T13:00:00.000Z';
const ADD_DROP_ENDS = '2026-10-15T23:59:00.000Z';
const WITHDRAW_ENDS = '2026-11-15T23:59:00.000Z';
const DURING = new Date('2026-10-05T15:00:00.000Z');
const AFTER_ADD_DROP = new Date('2026-10-20T15:00:00.000Z');
const AFTER_WITHDRAW = new Date('2026-11-20T15:00:00.000Z');
const BEFORE = new Date('2026-09-30T15:00:00.000Z');

const course = (id: string, code: string, credits: number, meetings: CatalogCourse['meetings'], seats: number | null = 2): CatalogCourse => ({
  id,
  code,
  section: '01',
  title: code,
  term: TERM,
  department: code.split(' ')[0],
  credits,
  instructor: 'Instructor',
  location: 'Room',
  description: '',
  prerequisites: '',
  seats,
  meetings,
});

const MWF9 = [{ days: [1, 3, 5], start: 540, end: 590 }];
const MWF930 = [{ days: [1, 3, 5], start: 570, end: 620 }];
const TR10 = [{ days: [2, 4], start: 600, end: 675 }];
const TR13 = [{ days: [2, 4], start: 780, end: 855 }];

const math = sectionFrom(course('math', 'MATH 101', 4, MWF9), { waitlistCapacity: 2 });
const calc = sectionFrom(course('calc', 'MATH 201', 4, TR10), { prerequisiteCodes: ['MATH 101'] });
const hist = sectionFrom(course('hist', 'HIST 100', 3, MWF930));
const art = sectionFrom(course('art', 'ARTS 300', 3, TR13), { requiresApproval: true });
const lab = sectionFrom(course('lab', 'CHEM 110', 6, [{ days: [5], start: 780, end: 960 }]), { capacity: 40 });

const LEDGER: Ledger = {
  ...EMPTY_LEDGER,
  terms: { [TERM]: { term: TERM, opensAt: OPENS, addDropEndsAt: ADD_DROP_ENDS, withdrawEndsAt: WITHDRAW_ENDS, maxCredits: 12 } },
  sections: { math, calc, hist, art, lab },
};

const student = (id: string, over: Partial<StudentFacts> = {}): StudentFacts => ({ id, holds: [], completed: [], ...over });
const HOLD: Hold = { id: 'h1', office: 'Bursar', link: 'https://bursar.example.edu', active: true };

const ctx = (over: Partial<Context> = {}): Context => ({
  now: DURING,
  gate: { tenantId: 'u1', flag: 'production', killSwitches: [] },
  students: { ana: student('ana'), ben: student('ben'), cy: student('cy'), di: student('di'), eve: student('eve') },
  registrars: ['reg'],
  ...over,
});

let n = 0;
const key = () => `k-test-${String(++n).padStart(4, '0')}`;
const enroll = (who: string, section: string, extra: Partial<Extract<Request, { kind: 'enroll' }>> = {}): Request => ({ kind: 'enroll', key: key(), student: who, section, ...extra });
const drop = (who: string, section: string): Request => ({ kind: 'drop', key: key(), student: who, section });
const withdraw = (who: string, section: string): Request => ({ kind: 'withdraw', key: key(), student: who, section });

/** Submit a run of requests, each required to succeed. */
function run(ledger: Ledger, c: Context, ...reqs: Request[]): Ledger {
  for (const r of reqs) {
    const { decision, ledger: next } = submit(ledger, r, c);
    expect(decision.ok, `${r.kind} ${r.section}: ${decision.reason} — ${decision.message}`).toBe(true);
    ledger = next;
  }
  return ledger;
}

/** A refusal: the reason, and the ledger handed back untouched (the same object). */
function refused(ledger: Ledger, r: Request, c: Context, reason: string) {
  const { decision, ledger: after } = submit(ledger, r, c);
  expect(decision.ok).toBe(false);
  expect(decision.outcome).toBe('refused');
  expect(decision.reason).toBe(reason);
  expect(decision.message.length).toBeGreaterThan(0);
  expect(after).toBe(ledger);
  return decision;
}

afterEach(() => vi.restoreAllMocks());

// ── The gate ─────────────────────────────────────────────────────────────

describe('the gate: writeback.registration_submit and its kill switches', () => {
  it('stops on the switches the flag registry names, not a second list', () => {
    expect(STOPPED_BY).toEqual(flagDefinition('writeback.registration_submit')?.killSwitches);
    expect(STOPPED_BY).toContain('kill.writeback');
  });

  it('enrolls when the flag is in production and nothing is engaged (the control)', () => {
    expect(gateReason(ctx())).toBeNull();
    expect(submit(LEDGER, enroll('ana', 'math'), ctx()).decision.outcome).toBe('enrolled');
  });

  it('refuses every kind of request while the flag is off, and in preview or sandbox', () => {
    for (const flag of ['off', 'preview', 'sandbox'] as const) {
      const c = ctx({ gate: { tenantId: 'u1', flag, killSwitches: [] } });
      refused(LEDGER, enroll('ana', 'math'), c, 'flag_off');
    }
    const enrolled = run(LEDGER, ctx(), enroll('ana', 'math'));
    const off = ctx({ gate: { tenantId: 'u1', flag: 'off', killSwitches: [] } });
    refused(enrolled, drop('ana', 'math'), off, 'flag_off');
    refused(enrolled, { kind: 'override', key: key(), registrar: 'reg', student: 'ben', section: 'math', waives: ['capacity'], reason: 'x' }, off, 'flag_off');
  });

  it('refuses when kill.writeback is engaged globally or for this school, and the switch outranks the flag', () => {
    const global = { key: 'kill.writeback', tenantId: null, engaged: true };
    const mine = { key: 'kill.writeback', tenantId: 'u1', engaged: true };
    refused(LEDGER, enroll('ana', 'math'), ctx({ gate: { tenantId: 'u1', flag: 'production', killSwitches: [global] } }), 'kill_switch');
    refused(LEDGER, enroll('ana', 'math'), ctx({ gate: { tenantId: 'u1', flag: 'production', killSwitches: [mine] } }), 'kill_switch');
    refused(LEDGER, enroll('ana', 'math'), ctx({ gate: { tenantId: 'u1', flag: 'off', killSwitches: [global] } }), 'kill_switch');
    const sync = { key: 'kill.integration_sync', tenantId: null, engaged: true };
    refused(LEDGER, enroll('ana', 'math'), ctx({ gate: { tenantId: 'u1', flag: 'production', killSwitches: [sync] } }), 'kill_switch');
  });

  it('ignores another school’s switch, a disengaged one, and one that does not stop writes', () => {
    const c = ctx({
      gate: {
        tenantId: 'u1',
        flag: 'production',
        killSwitches: [
          { key: 'kill.writeback', tenantId: 'u2', engaged: true },
          { key: 'kill.writeback', tenantId: null, engaged: false },
          { key: 'kill.ai_generation', tenantId: null, engaged: true },
        ],
      },
    });
    expect(submit(LEDGER, enroll('ana', 'math'), c).decision.ok).toBe(true);
  });

  it('stops promotion too: a drop that would free a seat moves nobody while the switch is engaged', () => {
    const full = run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'), enroll('cy', 'math'));
    const killed = ctx({ gate: { tenantId: 'u1', flag: 'production', killSwitches: [{ key: 'kill.writeback', tenantId: null, engaged: true }] } });
    expect(promote(full, 'math', killed, 'ana').promoted).toEqual([]);
  });
});

// ── Enroll, full section, waitlist ──────────────────────────────────────

describe('enroll and the waitlist', () => {
  it('takes a seat, counts it, and audits it', () => {
    const { decision, ledger } = submit(LEDGER, enroll('ana', 'math'), ctx());
    expect(decision).toMatchObject({ ok: true, outcome: 'enrolled', reason: 'ok', seatsTaken: 1, capacity: 2, replayed: false });
    expect(decision.enrollment).toMatchObject({ student: 'ana', section: 'math', state: 'enrolled', grade: null, version: 1 });
    expect(seatsTaken(ledger, 'math')).toBe(1);
    expect(ledger.audit.map((a) => [a.actor, a.action])).toEqual([['ana', 'enrolled']]);
  });

  it('waitlists in the order requests arrived once the section is full', () => {
    let l = run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'));
    const cy = submit(l, enroll('cy', 'math'), ctx());
    expect(cy.decision).toMatchObject({ outcome: 'waitlisted', waitPosition: 1, seatsTaken: 2 });
    l = cy.ledger;
    const di = submit(l, enroll('di', 'math'), ctx());
    expect(di.decision).toMatchObject({ outcome: 'waitlisted', waitPosition: 2 });
    expect(waitPosition(di.ledger, 'math', 'cy')).toBe(1);
    expect(waitPosition(di.ledger, 'math', 'di')).toBe(2);
  });

  it('refuses a full section whose waitlist is also full', () => {
    const l = run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'), enroll('cy', 'math'), enroll('di', 'math'));
    refused(l, enroll('eve', 'math'), ctx(), 'full');
  });

  it('refuses a full section with no waitlist at all', () => {
    const tiny = { ...LEDGER, sections: { ...LEDGER.sections, hist: { ...hist, capacity: 1, waitlistCapacity: 0 } } };
    const l = run(tiny, ctx(), enroll('ana', 'hist'));
    refused(l, enroll('ben', 'hist'), ctx(), 'full');
  });

  it('refuses an unknown section, a section with no term calendar, and a student the registrar has no record of', () => {
    refused(LEDGER, enroll('ana', 'nope'), ctx(), 'unknown_section');
    const orphan = { ...LEDGER, sections: { ...LEDGER.sections, math: { ...math, term: '2027SP' } } };
    refused(orphan, enroll('ana', 'math'), ctx(), 'unknown_term');
    refused(LEDGER, enroll('zed', 'math'), ctx(), 'unknown_student');
  });
});

// ── Stale seat count: the two-step confirmation ─────────────────────────

describe('a stale seat count', () => {
  it('refuses a confirmed seat that went to somebody else between review and submit, and writes nothing', () => {
    const l = run(LEDGER, ctx(), enroll('ana', 'math'));
    const mine = enroll('cy', 'math', { expect: 'seat' });
    expect(review(l, mine, ctx())).toMatchObject({ ok: true, outcome: 'enrolled' });
    const taken = run(l, ctx(), enroll('ben', 'math'));
    const d = refused(taken, mine, ctx(), 'stale_seat_count');
    expect(d.message).toMatch(/full now; 0 are waiting/);
    expect(taken.enrollments.filter((e) => e.student === 'cy')).toEqual([]);
  });

  it('accepts the waitlist once the student confirms that instead', () => {
    const l = run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'));
    expect(submit(l, enroll('cy', 'math', { expect: 'waitlist' }), ctx()).decision.outcome).toBe('waitlisted');
  });

  it('refuses a confirmed waitlist place when a seat opened, rather than deciding for the student', () => {
    refused(LEDGER, enroll('cy', 'math', { expect: 'waitlist' }), ctx(), 'stale_seat_count');
  });

  it('review keeps nothing: the same request submitted afterwards is not a replay', () => {
    const r = enroll('ana', 'math');
    review(LEDGER, r, ctx());
    expect(submit(LEDGER, r, ctx()).decision.replayed).toBe(false);
  });
});

// ── Duplicate requests and idempotency ──────────────────────────────────

describe('duplicate requests', () => {
  it('replays a committed request under its key, and changes nothing', () => {
    const r = enroll('ana', 'math');
    const first = submit(LEDGER, r, ctx());
    const again = submit(first.ledger, r, ctx());
    expect(again.ledger).toBe(first.ledger);
    expect(again.decision).toEqual({ ...first.decision, replayed: true });
    expect(first.ledger.enrollments).toHaveLength(1);
  });

  it('replays even while the kill switch is engaged, because a replay writes nothing', () => {
    const r = enroll('ana', 'math');
    const first = submit(LEDGER, r, ctx());
    const killed = ctx({ gate: { tenantId: 'u1', flag: 'production', killSwitches: [{ key: 'kill.writeback', tenantId: null, engaged: true }] } });
    expect(submit(first.ledger, r, killed).decision).toMatchObject({ ok: true, replayed: true });
  });

  it('refuses the same key carrying a different request', () => {
    const r = enroll('ana', 'math');
    const l = submit(LEDGER, r, ctx()).ledger;
    refused(l, { ...r, section: 'hist' }, ctx(), 'idempotency_conflict');
  });

  it('keys by actor: two students may use the same key without colliding', () => {
    const l = run(LEDGER, ctx(), { kind: 'enroll', key: 'shared-key-1', student: 'ana', section: 'math' });
    expect(submit(l, { kind: 'enroll', key: 'shared-key-1', student: 'ben', section: 'math' }, ctx()).decision).toMatchObject({ ok: true, replayed: false });
  });

  it('refuses a second enrollment in the same section under a new key', () => {
    const l = run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'), enroll('cy', 'math'));
    refused(l, enroll('ana', 'math'), ctx(), 'already_enrolled');
    refused(l, enroll('cy', 'math'), ctx(), 'already_waitlisted');
  });

  it('does not keep a refusal, so the same key succeeds once the cause is gone', () => {
    const r = enroll('ana', 'math');
    const held = ctx({ students: { ana: student('ana', { holds: [HOLD] }) } });
    refused(LEDGER, r, held, 'hold');
    expect(submit(LEDGER, r, ctx()).decision.outcome).toBe('enrolled');
  });

  it('refuses a request with no usable key', () => {
    for (const bad of ['', 'short', 'has spaces in it', 'x'.repeat(129)]) refused(LEDGER, { ...enroll('ana', 'math'), key: bad }, ctx(), 'bad_request');
  });
});

// ── Holds ────────────────────────────────────────────────────────────────

describe('a hold', () => {
  it('that appears after planning blocks the submit the review allowed', () => {
    const r = enroll('ana', 'math', { expect: 'seat' });
    expect(review(LEDGER, r, ctx()).ok).toBe(true);
    const later = ctx({ students: { ...ctx().students, ana: student('ana', { holds: [HOLD] }) } });
    const d = refused(LEDGER, r, later, 'hold');
    expect(d.hold).toEqual({ office: 'Bursar', link: 'https://bursar.example.edu' });
  });

  it('never carries its reason into a decision, a message or the audit, even when a caller passes one', () => {
    const secret = 'Unpaid balance of $4,210 — collections referral';
    const leaky = { ...HOLD, reason: secret } as Hold;
    const c = ctx({ students: { ...ctx().students, ana: student('ana', { holds: [leaky] }) } });
    const out = submit(LEDGER, enroll('ana', 'math'), c);
    expect(JSON.stringify(out)).not.toContain('4,210');
    expect(JSON.stringify(out)).not.toContain('collections');
    // The control: the same probe does see a string that is there.
    expect(JSON.stringify(out)).toContain('Bursar');
  });

  it('an inactive hold blocks nothing', () => {
    const c = ctx({ students: { ana: student('ana', { holds: [{ ...HOLD, active: false }] }) } });
    expect(submit(LEDGER, enroll('ana', 'math'), c).decision.ok).toBe(true);
  });

  it('does not stop a student leaving a waitlist or dropping', () => {
    const l = run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'), enroll('cy', 'math'));
    const held = ctx({ students: { ...ctx().students, ana: student('ana', { holds: [HOLD] }), cy: student('cy', { holds: [HOLD] }) } });
    expect(submit(l, drop('cy', 'math'), held).decision.outcome).toBe('left_waitlist');
    expect(submit(l, drop('ana', 'math'), held).decision.outcome).toBe('dropped');
  });
});

// ── Windows ──────────────────────────────────────────────────────────────

describe('the registration window', () => {
  it('refuses before the term opens, and before the student’s own time ticket', () => {
    refused(LEDGER, enroll('ana', 'math'), ctx({ now: BEFORE }), 'window_not_open');
    const ticket = ctx({ students: { ana: student('ana', { ticketAt: '2026-10-06T13:00:00.000Z' }) } });
    refused(LEDGER, enroll('ana', 'math'), ticket, 'window_not_open');
    expect(submit(LEDGER, enroll('ana', 'math'), { ...ticket, now: new Date('2026-10-06T13:00:00.000Z') }).decision.ok).toBe(true);
  });

  it('refuses after add/drop closes, unless the registrar granted a late add', () => {
    refused(LEDGER, enroll('ana', 'math'), ctx({ now: AFTER_ADD_DROP }), 'window_closed');
    const l = run(LEDGER, ctx({ now: AFTER_ADD_DROP }), { kind: 'override', key: key(), registrar: 'reg', student: 'ana', section: 'math', waives: ['late_add'], reason: 'Dean approved' });
    expect(submit(l, enroll('ana', 'math'), ctx({ now: AFTER_ADD_DROP })).decision.outcome).toBe('enrolled');
  });
});

// ── Prerequisites, clashes, credit load ─────────────────────────────────

describe('prerequisites, time conflicts and credit load', () => {
  it('refuses a missing prerequisite, and accepts it passed or waived', () => {
    const d = refused(LEDGER, enroll('ana', 'calc'), ctx(), 'prerequisite_missing');
    expect(d.message).toContain('MATH 101');
    const passed = ctx({ students: { ana: student('ana', { completed: ['math 101'] }) } });
    expect(submit(LEDGER, enroll('ana', 'calc'), passed).decision.ok).toBe(true);
    const l = run(LEDGER, ctx(), { kind: 'override', key: key(), registrar: 'reg', student: 'ana', section: 'calc', waives: ['prerequisite'], reason: 'Transfer credit' });
    expect(submit(l, enroll('ana', 'calc'), ctx()).decision.ok).toBe(true);
  });

  it('refuses a section that overlaps one the student is enrolled in, by the planner’s own clash test', () => {
    const l = run(LEDGER, ctx(), enroll('ana', 'math'));
    refused(l, enroll('ana', 'hist'), ctx(), 'time_conflict');
    // A waitlist place is not a seat, and does not clash.
    const w = run(LEDGER, ctx(), enroll('ben', 'math'), enroll('cy', 'math'), enroll('ana', 'math'));
    expect(submit(w, enroll('ana', 'hist'), ctx()).decision.ok).toBe(true);
    const o = run(l, ctx(), { kind: 'override', key: key(), registrar: 'reg', student: 'ana', section: 'hist', waives: ['time_conflict'], reason: 'Lab ends early' });
    expect(submit(o, enroll('ana', 'hist'), ctx()).decision.ok).toBe(true);
  });

  it('refuses a section that would go over the term’s credit ceiling', () => {
    // MATH 101 and CHEM 110 are 10 of 12 credits; MATH 201 would make 14.
    const l = run(LEDGER, { ...ctx(), students: { ana: student('ana', { completed: ['MATH 101'] }) } }, enroll('ana', 'math'), enroll('ana', 'lab'));
    const c = { ...ctx(), students: { ana: student('ana', { completed: ['MATH 101'] }) } };
    const d = refused(l, enroll('ana', 'calc'), c, 'credit_limit');
    expect(d.message).toContain('12');
    const o = run(l, c, { kind: 'override', key: key(), registrar: 'reg', student: 'ana', section: 'calc', waives: ['credit_limit'], reason: 'Honors load' });
    expect(submit(o, enroll('ana', 'calc'), c).decision.ok).toBe(true);
  });
});

// ── Drop, promotion, withdrawal ─────────────────────────────────────────

describe('drop, promotion and withdrawal', () => {
  const full = () => run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'), enroll('cy', 'math'), enroll('di', 'math'));

  it('a drop inside add/drop frees the seat and promotes the head of the waitlist', () => {
    const { decision, ledger } = submit(full(), drop('ana', 'math'), ctx());
    expect(decision.outcome).toBe('dropped');
    expect(decision.promoted).toBe(1);
    const cy = ledger.enrollments.find((e) => e.student === 'cy');
    expect(cy?.state).toBe('enrolled');
    expect(waitPosition(ledger, 'math', 'di')).toBe(1);
    expect(seatsTaken(ledger, 'math')).toBe(2);
    expect(ledger.audit.at(-1)).toMatchObject({ action: 'promoted', student: 'cy', actor: 'ana' });
    // A drop is kept as history, not deleted.
    expect(ledger.enrollments.find((e) => e.student === 'ana')?.state).toBe('dropped');
  });

  it('passes over a head of the queue whose hold appeared while waiting, who keeps their place', () => {
    const c = ctx({ students: { ...ctx().students, cy: student('cy', { holds: [HOLD] }) } });
    const { decision, ledger } = submit(full(), drop('ana', 'math'), c);
    expect(decision.promoted).toBe(1);
    // Who was passed over, and why, is the registrar's to read — not the
    // dropping student's.
    expect(JSON.stringify(decision)).not.toMatch(/"cy"|hold/);
    expect(ledger.audit.filter((a) => a.action === 'promotion_skipped').map((a) => [a.student, a.reason])).toEqual([['cy', 'hold']]);
    expect(ledger.enrollments.find((e) => e.student === 'di')?.state).toBe('enrolled');
    expect(waitPosition(ledger, 'math', 'cy')).toBe(1);
    expect(JSON.stringify(ledger.audit)).not.toContain('Bursar');
  });

  it('passes over a head of the queue whose schedule now clashes', () => {
    const l = run(full(), ctx(), enroll('cy', 'hist'));
    const p = promote(submit(l, drop('ana', 'math'), { ...ctx(), gate: { tenantId: 'u1', flag: 'off', killSwitches: [] } }).ledger, 'math', ctx(), 'reg');
    expect(p.skipped).toEqual([]); // the control: the drop was refused, so no seat is free
    const { ledger } = submit(l, drop('ana', 'math'), ctx());
    expect(ledger.audit.filter((a) => a.action === 'promotion_skipped').map((a) => [a.student, a.reason])).toEqual([['cy', 'time_conflict']]);
    expect(ledger.enrollments.find((e) => e.student === 'di')?.state).toBe('enrolled');
  });

  it('fails closed on a waiting student the context has no record of', () => {
    const c = ctx({ students: { ana: student('ana') } });
    const { decision, ledger } = submit(full(), drop('ana', 'math'), c);
    expect(decision.promoted).toBe(0);
    expect(ledger.audit.filter((a) => a.action === 'promotion_skipped').map((a) => a.reason)).toEqual(['unknown_student', 'unknown_student']);
  });

  it('refuses a drop after add/drop closes and says to withdraw', () => {
    const d = refused(full(), drop('ana', 'math'), ctx({ now: AFTER_ADD_DROP }), 'drop_deadline_passed');
    expect(d.message).toMatch(/withdraw/);
  });

  it('withdraws after add/drop as a W, keeps the row, and re-sells nothing', () => {
    const { decision, ledger } = submit(full(), withdraw('ana', 'math'), ctx({ now: AFTER_ADD_DROP }));
    expect(decision).toMatchObject({ ok: true, outcome: 'withdrawn' });
    const row = ledger.enrollments.find((e) => e.student === 'ana');
    expect(row).toMatchObject({ state: 'withdrawn', grade: 'W', version: 2 });
    expect(ledger.enrollments).toHaveLength(4);
    expect(decision.promoted).toBe(0);
    expect(ledger.enrollments.find((e) => e.student === 'cy')?.state).toBe('waitlisted');
  });

  it('refuses a withdrawal while add/drop is open, and after the withdrawal deadline', () => {
    refused(full(), withdraw('ana', 'math'), ctx(), 'withdraw_not_yet');
    refused(full(), withdraw('ana', 'math'), ctx({ now: AFTER_WITHDRAW }), 'withdraw_deadline_passed');
    refused(full(), withdraw('cy', 'math'), ctx({ now: AFTER_ADD_DROP }), 'not_enrolled');
  });

  it('refuses to drop what the student does not hold', () => {
    refused(LEDGER, drop('ana', 'math'), ctx(), 'not_enrolled');
  });
});

// ── Registrar: approvals and overrides ──────────────────────────────────

describe('registrar approvals and overrides', () => {
  const decide = (approve: boolean, who = 'reg', reason = 'Instructor consent'): Request => ({ kind: 'decide', key: key(), registrar: who, student: 'ana', section: 'art', approve, reason });

  it('holds a restricted section’s request for approval, takes no seat, then enrolls on approval', () => {
    const p = submit(LEDGER, enroll('ana', 'art'), ctx());
    expect(p.decision.outcome).toBe('pending_approval');
    expect(seatsTaken(p.ledger, 'art')).toBe(0);
    refused(p.ledger, enroll('ana', 'art'), ctx(), 'already_pending');
    const a = submit(p.ledger, decide(true), ctx());
    expect(a.decision.outcome).toBe('enrolled');
    expect(seatsTaken(a.ledger, 'art')).toBe(1);
  });

  it('records a denial as history', () => {
    const p = run(LEDGER, ctx(), enroll('ana', 'art'));
    const d = submit(p, decide(false), ctx());
    expect(d.decision.outcome).toBe('denied');
    expect(d.ledger.enrollments[0].state).toBe('denied');
  });

  it('refuses a decision from somebody who is not the registrar, one with no reason, and one with nothing pending', () => {
    const p = run(LEDGER, ctx(), enroll('ana', 'art'));
    refused(p, decide(true, 'ben'), ctx(), 'not_registrar');
    refused(p, decide(true, 'reg', '  '), ctx(), 'bad_override');
    refused(LEDGER, decide(true), ctx(), 'not_pending');
  });

  it('re-checks an approval against now: a hold that arrived while it waited still stops it', () => {
    const p = run(LEDGER, ctx(), enroll('ana', 'art'));
    const later = ctx({ students: { ana: student('ana', { holds: [HOLD] }) } });
    refused(p, decide(true), later, 'hold');
  });

  it('refuses an override with no reason, an unknown kind, or a hold, and one from a non-registrar', () => {
    const o = (waives: string[], reason = 'ok', registrar = 'reg'): Request => ({ kind: 'override', key: key(), registrar, student: 'ana', section: 'math', waives: waives as never, reason });
    refused(LEDGER, o(['capacity'], ' '), ctx(), 'bad_override');
    refused(LEDGER, o(['hold']), ctx(), 'bad_override');
    refused(LEDGER, o([]), ctx(), 'bad_override');
    refused(LEDGER, o(['capacity'], 'ok', 'ana'), ctx(), 'not_registrar');
  });

  it('a capacity override seats a waiting student out of turn, and is audited under the registrar', () => {
    const l = run(LEDGER, ctx(), enroll('ben', 'math'), enroll('cy', 'math'), enroll('di', 'math'), enroll('ana', 'math'));
    const { decision, ledger } = submit(l, { kind: 'override', key: key(), registrar: 'reg', student: 'ana', section: 'math', waives: ['capacity'], reason: 'Graduating senior' }, ctx());
    expect(decision.promoted).toBe(1);
    expect(seatsTaken(ledger, 'math')).toBe(3);
    expect(ledger.audit.slice(-2).map((a) => [a.actor, a.action])).toEqual([
      ['reg', 'override_granted'],
      ['reg', 'promoted'],
    ]);
  });
});

// ── Purity ───────────────────────────────────────────────────────────────

describe('purity', () => {
  it('reads no clock: a whole add, wait, drop, promote and withdraw is stamped only with the times it was given', () => {
    // Date.now throwing catches one kind of clock read; a system clock set to
    // another year catches `new Date()`, which does not go through Date.now.
    vi.useFakeTimers({ now: new Date('2001-01-01T00:00:00.000Z'), toFake: ['Date'] });
    try {
      vi.spyOn(Date, 'now').mockImplementation(() => {
        throw new Error('the decision read the clock');
      });
      const l = run(LEDGER, ctx(), enroll('ana', 'math'), enroll('ben', 'math'), enroll('cy', 'math'), drop('ana', 'math'));
      const w = run(l, ctx({ now: AFTER_ADD_DROP }), withdraw('ben', 'math'));
      const stamps = new Set([...w.audit.map((a) => a.at), ...w.enrollments.flatMap((e) => [e.createdAt, e.updatedAt])]);
      expect([...stamps].sort()).toEqual([DURING.toISOString(), AFTER_ADD_DROP.toISOString()]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never mutates the ledger it is given', () => {
    const frozen = structuredClone(LEDGER);
    submit(LEDGER, enroll('ana', 'math'), ctx());
    expect(LEDGER).toEqual(frozen);
  });
});

// ── From the planner ─────────────────────────────────────────────────────

describe('from the planner’s cart', () => {
  it('turns a cart into enroll requests whose resubmission replays rather than enrolls twice', () => {
    const cart = [course('math', 'MATH 101', 4, MWF9), course('lab', 'CHEM 110', 6, [])];
    const reqs = cartRequests('ana', cart, 'nonce-1', 'seat');
    expect(reqs.map((r) => r.section)).toEqual(['math', 'lab']);
    expect(cartRequests('ana', cart, 'nonce-1', 'seat')).toEqual(reqs);
    const l = run(LEDGER, ctx(), ...reqs);
    for (const r of cartRequests('ana', cart, 'nonce-1', 'seat')) expect(submit(l, r, ctx()).decision.replayed).toBe(true);
    expect(() => cartRequests('ana', cart, 'no')).toThrow(/nonce/);
  });

  it('will not guess a capacity the catalog does not carry', () => {
    expect(() => sectionFrom(course('x', 'EXAM 101', 3, [], null))).toThrow(/capacity/);
    expect(sectionFrom(course('x', 'EXAM 101', 3, [], null), { capacity: 5 }).capacity).toBe(5);
  });
});
