import { describe, expect, it } from 'vitest';
import { owed as billOwed, type Aid, type Charge } from '../bill';
import {
  createPlan,
  disburseAid,
  holdStatus,
  issueRefund,
  placeHold,
  postEntry,
  releaseHold,
  respondToAward,
  reverseEntry,
  startPayment,
  syncAward,
  type AwardSync,
  type Ctx,
  type Person,
  type Result,
} from './actions';
import { gate } from './gate';
import { balance, emptyAccount, planView, termSummary, type StudentAccount } from './ledger';
import { applyProviderEvent, paymentKey, type ProviderEvent } from './payments';

const NOW = new Date(2026, 8, 29, 12, 0, 0);
const TERM = '2026FA';
const STUDENT = 'student-1';
const HASH = 'a'.repeat(64);

const bursar: Person = { id: 'bursar-1', capabilities: ['bursar:post'] };
const aidOfficer: Person = { id: 'aid-1', capabilities: ['aid:manage'] };
const registrar: Person = { id: 'reg-1', capabilities: ['hold:read'] };
const student: Person = { id: STUDENT, capabilities: [] };
const otherStudent: Person = { id: 'student-2', capabilities: [] };

function ctx(actor: Ctx['actor'], over: Partial<Ctx> = {}): Ctx {
  let n = 0;
  return {
    now: NOW,
    gate: { moduleState: 'production', financeOwner: 'owner-1', admitted: true, councilFinanceHolder: 'Finance lead' },
    settings: { thresholdCents: 50_000, graceDays: 10 },
    actor,
    newId: () => `id-${++n}-${Math.random().toString(36).slice(2, 8)}`,
    ...over,
  };
}

/** Unwrap a result that must have succeeded, with the refusal in the message when it did not. */
function ok<T>(r: Result<T>): { account: StudentAccount; value: T; code: string; reason: string } {
  if (!r.ok) throw new Error(`refused: ${r.code} — ${r.reason}`);
  return r;
}

function charged(cents = 900_000): StudentAccount {
  return ok(postEntry(emptyAccount('u', STUDENT), { term: TERM, kind: 'charge', cents, what: 'Tuition', key: 'tuition' }, ctx(bursar))).account;
}

const award = (over: Partial<AwardSync> = {}): AwardSync => ({
  externalRef: 'pell-1', term: TERM, kind: 'grant', what: 'Pell Grant', offeredCents: 300_000,
  verification: 'not_selected', sap: 'meeting', sourceVersion: 1, ...over,
});

const event = (over: Partial<ProviderEvent> = {}): ProviderEvent => ({
  provider: 'fakepay', eventId: 'evt-1', kind: 'payment_succeeded', intentId: 'missing', providerPaymentId: 'pay-1',
  cents: 100_000, currency: 'usd', occurredAt: NOW.getTime(), payloadSha256: HASH, ...over,
});

describe('the gate: off until the flag, a finance owner and the council seat', () => {
  it('is off by default, and says which of the three is missing', () => {
    expect(gate({ moduleState: 'off', financeOwner: 'x', admitted: true, councilFinanceHolder: 'y' })).toMatchObject({ on: false, code: 'module_off' });
    expect(gate({ moduleState: 'production', financeOwner: null, admitted: true, councilFinanceHolder: 'y' })).toMatchObject({ on: false, code: 'no_finance_owner' });
    expect(gate({ moduleState: 'production', financeOwner: 'x', admitted: true, councilFinanceHolder: null })).toMatchObject({ on: false, code: 'finance_seat_vacant' });
    expect(gate({ moduleState: 'preview', financeOwner: 'x', admitted: true, councilFinanceHolder: 'y' }).on).toBe(true);
    // A school's role or cohort limit that leaves the caller out: after off, before the owner.
    expect(gate({ moduleState: 'production', financeOwner: null, admitted: false, councilFinanceHolder: 'y' })).toMatchObject({ on: false, code: 'not_admitted' });
    expect(gate({ moduleState: 'off', financeOwner: 'x', admitted: false, councilFinanceHolder: 'y' })).toMatchObject({ on: false, code: 'module_off' });
  });

  it('reads the real council, where the finance seat is vacant today, so nothing is on anywhere', () => {
    expect(gate({ moduleState: 'production', financeOwner: 'owner-1', admitted: true })).toMatchObject({ on: false, code: 'finance_seat_vacant' });
  });

  it('refuses every write while off, with the reason', () => {
    const off = ctx(bursar, { gate: { moduleState: 'off', financeOwner: 'owner-1', admitted: true, councilFinanceHolder: 'y' } });
    const r = postEntry(emptyAccount('u', STUDENT), { term: TERM, kind: 'charge', cents: 100, what: 'Fee', key: 'k' }, off);
    expect(r).toMatchObject({ ok: false, code: 'module_off' });
    expect(syncAward(emptyAccount('u', STUDENT), award(), { ...off, actor: 'aid_adapter' })).toMatchObject({ ok: false, code: 'module_off' });
    expect(startPayment(charged(), { term: TERM, cents: 100, key: 'p' }, { ...off, actor: student })).toMatchObject({ ok: false, code: 'module_off' });
  });
});

describe('the ledger: append-only, integer cents, balance derived', () => {
  it('derives the balance from the entries and never stores it', () => {
    let a = charged(900_000);
    a = ok(postEntry(a, { term: TERM, kind: 'credit', cents: 50_000, what: 'Tuition waiver', key: 'w' }, ctx(bursar))).account;
    a = ok(postEntry(a, { term: TERM, kind: 'payment', cents: 100_000, what: 'Cheque', key: 'c' }, ctx(bursar))).account;
    expect(balance(a.entries, TERM)).toBe(750_000);
    expect(Object.keys(a)).not.toContain('balance');
  });

  it('refuses fractional, zero and negative cents', () => {
    for (const cents of [0, -5, 10.5, Number.MAX_SAFE_INTEGER + 2]) {
      expect(postEntry(emptyAccount('u', STUDENT), { term: TERM, kind: 'charge', cents, what: 'x', key: `k${cents}` }, ctx(bursar)))
        .toMatchObject({ ok: false, code: 'invalid' });
    }
  });

  it('answers a replayed key with the first entry, and refuses a key reused for something else', () => {
    const a = charged(900_000);
    const again = postEntry(a, { term: TERM, kind: 'charge', cents: 900_000, what: 'Tuition', key: 'tuition' }, ctx(bursar));
    expect(again).toMatchObject({ ok: true, code: 'duplicate' });
    expect(ok(again).account.entries).toHaveLength(1);
    expect(postEntry(a, { term: TERM, kind: 'charge', cents: 1, what: 'Tuition', key: 'tuition' }, ctx(bursar)))
      .toMatchObject({ ok: false, code: 'key_reused' });
  });

  it('corrects by reversal, never by edit, and not past the original', () => {
    const a = charged(900_000);
    const tuition = a.entries[0];
    const half = ok(reverseEntry(a, { entryId: tuition.id, cents: 400_000, what: 'Dropped a course', key: 'r1' }, ctx(bursar)));
    expect(half.account.entries).toHaveLength(2);
    expect(half.account.entries[0]).toEqual(tuition);
    expect(balance(half.account.entries, TERM)).toBe(500_000);
    expect(reverseEntry(half.account, { entryId: tuition.id, cents: 500_001, what: 'x', key: 'r2' }, ctx(bursar)))
      .toMatchObject({ ok: false, code: 'invalid' });
    expect(reverseEntry(half.account, { entryId: half.value.id, what: 'x', key: 'r3' }, ctx(bursar)))
      .toMatchObject({ ok: false, code: 'invalid' });
  });

  it('lets only the bursar post, and nobody post aid or refunds by the side door', () => {
    expect(postEntry(emptyAccount('u', STUDENT), { term: TERM, kind: 'charge', cents: 1, what: 'x', key: 'k' }, ctx(student)))
      .toMatchObject({ ok: false, code: 'forbidden' });
    expect(postEntry(emptyAccount('u', STUDENT), { term: TERM, kind: 'charge', cents: 1, what: 'x', key: 'k' }, ctx(aidOfficer)))
      .toMatchObject({ ok: false, code: 'forbidden' });
    const sneak = { term: TERM, kind: 'aid_disbursement', cents: 1, what: 'x', key: 'k' } as unknown as Parameters<typeof postEntry>[1];
    expect(postEntry(emptyAccount('u', STUDENT), sneak, ctx(bursar))).toMatchObject({ ok: false, code: 'invalid' });
  });
});

describe('financial aid: offered by the institution, accepted by the student, tracked by Semester', () => {
  function offered(over: Partial<AwardSync> = {}) {
    return ok(syncAward(charged(), award(over), ctx('aid_adapter')));
  }

  it('takes awards only from the adapter — no person types an amount', () => {
    expect(syncAward(charged(), award(), ctx(aidOfficer))).toMatchObject({ ok: false, code: 'forbidden' });
    expect(syncAward(charged(), award(), ctx(bursar))).toMatchObject({ ok: false, code: 'forbidden' });
    expect(offered().value).toMatchObject({ status: 'offered', offeredCents: 300_000 });
  });

  it('ignores a sync older than the one held, so a late batch cannot roll an award back', () => {
    const v2 = ok(syncAward(offered().account, award({ offeredCents: 350_000, sourceVersion: 2 }), ctx('aid_adapter')));
    const late = syncAward(v2.account, award({ offeredCents: 300_000, sourceVersion: 1 }), ctx('aid_adapter'));
    expect(late).toMatchObject({ ok: false, code: 'stale' });
    expect(v2.account.awards[0].offeredCents).toBe(350_000);
  });

  it('lets the student, and only the student, accept or decline — once', () => {
    const { account, value } = offered();
    expect(respondToAward(account, { awardId: value.id, accept: true }, ctx(otherStudent))).toMatchObject({ ok: false, code: 'forbidden' });
    expect(respondToAward(account, { awardId: value.id, accept: true }, ctx(bursar))).toMatchObject({ ok: false, code: 'forbidden' });
    const accepted = ok(respondToAward(account, { awardId: value.id, accept: true }, ctx(student)));
    expect(accepted.value.status).toBe('accepted');
    expect(respondToAward(accepted.account, { awardId: value.id, accept: true }, ctx(student))).toMatchObject({ ok: true, code: 'duplicate' });
    expect(respondToAward(accepted.account, { awardId: value.id, accept: false }, ctx(student))).toMatchObject({ ok: false, code: 'already_decided' });
  });

  it('shows accepted aid that is not yet disbursed as anticipated, never in the balance', () => {
    const { account, value } = offered();
    const accepted = ok(respondToAward(account, { awardId: value.id, accept: true }, ctx(student))).account;
    const s = termSummary(accepted, TERM);
    expect(s.balanceCents).toBe(900_000);
    expect(s.anticipatedCents).toBe(300_000);
    expect(s.afterAnticipatedCents).toBe(600_000);
    const paid = ok(disburseAid(accepted, { awardId: value.id, cents: 300_000, key: 'd1' }, ctx(aidOfficer))).account;
    expect(termSummary(paid, TERM)).toMatchObject({ balanceCents: 600_000, anticipatedCents: 0 });
  });

  it('never counts work-study against the balance, and agrees with bill.ts about it', () => {
    const ws = ok(syncAward(charged(900_000), award({ externalRef: 'fws-1', kind: 'work', what: 'Federal Work-Study', offeredCents: 250_000 }), ctx('aid_adapter')));
    const accepted = ok(respondToAward(ws.account, { awardId: ws.value.id, accept: true }, ctx(student))).account;
    expect(disburseAid(accepted, { awardId: ws.value.id, cents: 250_000, key: 'd' }, ctx('aid_adapter')))
      .toMatchObject({ ok: false, code: 'not_disbursable' });
    const s = termSummary(accepted, TERM);
    expect(s).toMatchObject({ balanceCents: 900_000, anticipatedCents: 0, earnedCents: 250_000 });
    // The same facts read as a statement by lib/bill.ts owe the same amount.
    const charges: Charge[] = [{ id: 'c', term: TERM, what: 'Tuition', kind: 'tuition', cents: 900_000, at: 0 }];
    const aid: Aid[] = [{ id: 'a', term: TERM, what: 'FWS', kind: 'work', cents: 250_000, pending: false, at: 0 }];
    expect(billOwed(charges, aid).owedCents).toBe(s.balanceCents);
  });

  it('holds disbursement to what the institution reported: accepted, verified, progressing, within the offer', () => {
    const { account, value } = offered({ verification: 'pending' });
    expect(disburseAid(account, { awardId: value.id, cents: 1, key: 'd' }, ctx(aidOfficer))).toMatchObject({ ok: false, code: 'not_disbursable' });
    const accepted = ok(respondToAward(account, { awardId: value.id, accept: true }, ctx(student))).account;
    const pending = disburseAid(accepted, { awardId: value.id, cents: 1, key: 'd' }, ctx(aidOfficer));
    expect(pending).toMatchObject({ ok: false, code: 'not_disbursable' });
    expect(termSummary(accepted, TERM).awards[0].waitingOn).toMatch(/verification/);
    const verified = ok(syncAward(accepted, award({ verification: 'complete', sap: 'not_meeting', sourceVersion: 2 }), ctx('aid_adapter'))).account;
    expect(disburseAid(verified, { awardId: value.id, cents: 1, key: 'd' }, ctx(aidOfficer))).toMatchObject({ ok: false, code: 'not_disbursable' });
    const good = ok(syncAward(verified, award({ verification: 'complete', sap: 'warning', sourceVersion: 3 }), ctx('aid_adapter'))).account;
    expect(disburseAid(good, { awardId: value.id, cents: 300_001, key: 'd' }, ctx(aidOfficer))).toMatchObject({ ok: false, code: 'exceeds_award' });
    expect(disburseAid(good, { awardId: value.id, cents: 300_000, key: 'd' }, ctx(bursar))).toMatchObject({ ok: false, code: 'forbidden' });
    const paid = ok(disburseAid(good, { awardId: value.id, cents: 300_000, key: 'd' }, ctx(aidOfficer)));
    expect(disburseAid(paid.account, { awardId: value.id, cents: 300_000, key: 'd' }, ctx(aidOfficer))).toMatchObject({ ok: true, code: 'duplicate' });
    expect(disburseAid(paid.account, { awardId: value.id, cents: 1, key: 'd2' }, ctx(aidOfficer))).toMatchObject({ ok: false, code: 'exceeds_award' });
  });

  it('reports a loan as aid and as borrowed', () => {
    const loan = ok(syncAward(charged(), award({ externalRef: 'dl-1', kind: 'loan', what: 'Direct Loan', offeredCents: 200_000 }), ctx('aid_adapter')));
    const a = ok(respondToAward(loan.account, { awardId: loan.value.id, accept: true }, ctx(student))).account;
    const d = ok(disburseAid(a, { awardId: loan.value.id, cents: 200_000, key: 'l' }, ctx('aid_adapter'))).account;
    expect(termSummary(d, TERM)).toMatchObject({ balanceCents: 700_000, borrowedCents: 200_000 });
  });
});

describe('refunds of credit balances', () => {
  function credit(): StudentAccount {
    let a = charged(100_000);
    a = ok(postEntry(a, { term: TERM, kind: 'payment', cents: 160_000, what: 'Overpaid', key: 'p' }, ctx(bursar))).account;
    return a; // a credit balance of 60,000
  }

  it('refunds up to the credit balance and closes it', () => {
    const r = ok(issueRefund(credit(), { term: TERM, cents: 60_000, key: 'rf' }, ctx(bursar)));
    expect(balance(r.account.entries, TERM)).toBe(0);
  });

  it('refuses a refund exceeding the credit, including one that leans on anticipated aid', () => {
    expect(issueRefund(credit(), { term: TERM, cents: 60_001, key: 'rf' }, ctx(bursar))).toMatchObject({ ok: false, code: 'exceeds_credit' });
    const a = ok(syncAward(credit(), award(), ctx('aid_adapter')));
    const accepted = ok(respondToAward(a.account, { awardId: a.value.id, accept: true }, ctx(student))).account;
    expect(termSummary(accepted, TERM).afterAnticipatedCents).toBe(-360_000);
    expect(issueRefund(accepted, { term: TERM, cents: 360_000, key: 'rf' }, ctx(bursar))).toMatchObject({ ok: false, code: 'exceeds_credit' });
    expect(issueRefund(charged(), { term: TERM, cents: 1, key: 'rf' }, ctx(bursar))).toMatchObject({ ok: false, code: 'exceeds_credit' });
  });

  it('is idempotent: the same refund key twice refunds once', () => {
    const once = ok(issueRefund(credit(), { term: TERM, cents: 60_000, key: 'rf' }, ctx(bursar)));
    const twice = issueRefund(once.account, { term: TERM, cents: 60_000, key: 'rf' }, ctx(bursar));
    expect(twice).toMatchObject({ ok: true, code: 'duplicate' });
    expect(balance(ok(twice).account.entries, TERM)).toBe(0);
  });
});

describe('holds', () => {
  it('holds only a balance over the threshold, and one hold at a time', () => {
    expect(placeHold(charged(50_000), { reason: 'Unpaid' }, ctx(bursar))).toMatchObject({ ok: false, code: 'below_threshold' });
    const held = ok(placeHold(charged(50_001), { reason: 'Unpaid fall balance' }, ctx(bursar)));
    expect(placeHold(held.account, { reason: 'Again' }, ctx(bursar))).toMatchObject({ ok: true, code: 'duplicate' });
    expect(placeHold(charged(900_000), { reason: 'x' }, ctx(registrar))).toMatchObject({ ok: false, code: 'forbidden' });
  });

  it('tells other offices whether, never why or how much', () => {
    const held = ok(placeHold(charged(900_000), { reason: 'Unpaid fall balance' }, ctx(bursar))).account;
    const seen = ok(holdStatus(held, { actor: registrar })).value;
    expect(seen).toEqual({ held: true, office: 'student_accounts', since: NOW.getTime() });
    expect(JSON.stringify(seen)).not.toMatch(/Unpaid|900000/);
    expect(holdStatus(held, { actor: otherStudent })).toMatchObject({ ok: false, code: 'forbidden' });
    expect(ok(holdStatus(held, { actor: student })).value.held).toBe(true);
  });

  it('releases once, with a reason', () => {
    const held = ok(placeHold(charged(900_000), { reason: 'Unpaid' }, ctx(bursar)));
    const released = ok(releaseHold(held.account, { holdId: held.value.id, reason: 'Paid' }, ctx(bursar)));
    expect(ok(holdStatus(released.account, { actor: registrar })).value.held).toBe(false);
    expect(releaseHold(released.account, { holdId: held.value.id, reason: 'Paid' }, ctx(bursar))).toMatchObject({ ok: false, code: 'already_released' });
  });
});

describe('payment plans', () => {
  it('divides the term balance into instalments that add up to the cent', () => {
    const p = ok(createPlan(charged(1_843_217), { term: TERM, parts: 5, first: '2026-10-01', everyMonths: 1, key: 'plan' }, ctx(bursar)));
    const v = planView(p.value, p.account.entries, NOW, 10);
    expect(v.instalments.map((i) => i.cents)).toEqual([368_644, 368_644, 368_643, 368_643, 368_643]);
    expect(v.instalments.reduce((n, i) => n + i.cents, 0)).toBe(1_843_217);
    expect(v.state).toBe('on_track');
  });

  it('is overdue inside the grace period, late past it, and settled when paid', () => {
    const p = ok(createPlan(charged(300_000), { term: TERM, parts: 3, first: '2026-10-01', everyMonths: 1, key: 'plan' }, ctx(bursar)));
    expect(planView(p.value, p.account.entries, new Date(2026, 9, 5), 10).state).toBe('overdue');
    expect(planView(p.value, p.account.entries, new Date(2026, 9, 20), 10).state).toBe('late');
    const later = ctx(bursar, { now: new Date(2026, 9, 2) });
    const paid = ok(postEntry(p.account, { term: TERM, kind: 'payment', cents: 100_000, what: 'First', key: 'i1' }, later)).account;
    expect(planView(p.value, paid.entries, new Date(2026, 9, 20), 10).state).toBe('on_track');
    const all = ok(postEntry(paid, { term: TERM, kind: 'payment', cents: 200_000, what: 'Rest', key: 'i2' }, later)).account;
    expect(planView(p.value, all.entries, new Date(2027, 0, 1), 10).state).toBe('settled');
  });

  it('refuses a plan with nothing owed, a second plan, and a bad date', () => {
    expect(createPlan(emptyAccount('u', STUDENT), { term: TERM, parts: 3, first: '2026-10-01', everyMonths: 1, key: 'k' }, ctx(bursar)))
      .toMatchObject({ ok: false, code: 'nothing_owed' });
    const p = ok(createPlan(charged(), { term: TERM, parts: 3, first: '2026-10-01', everyMonths: 1, key: 'k' }, ctx(bursar)));
    expect(createPlan(p.account, { term: TERM, parts: 4, first: '2026-10-01', everyMonths: 1, key: 'k2' }, ctx(bursar))).toMatchObject({ ok: false, code: 'plan_exists' });
    expect(createPlan(charged(), { term: TERM, parts: 3, first: '2026-02-30', everyMonths: 1, key: 'k' }, ctx(bursar))).toMatchObject({ ok: false, code: 'invalid' });
  });
});

describe('payments through the provider adapter', () => {
  function started(cents = 100_000) {
    return ok(startPayment(charged(), { term: TERM, cents, key: 'pay' }, ctx(student)));
  }
  const apply = (a: StudentAccount, e: ProviderEvent) => {
    const r = applyProviderEvent(a, e, ctx('provider'));
    if (!r.ok) throw new Error(r.reason);
    return r;
  };

  it('lets a student start paying their own account, up to what the term owes', () => {
    expect(startPayment(charged(), { term: TERM, cents: 100, key: 'p' }, ctx(otherStudent))).toMatchObject({ ok: false, code: 'forbidden' });
    expect(startPayment(charged(900_000), { term: TERM, cents: 900_001, key: 'p' }, ctx(student))).toMatchObject({ ok: false, code: 'exceeds_balance' });
    expect(started().value.status).toBe('open');
  });

  it('posts a verified success once, and a duplicate webhook changes nothing', () => {
    const s = started();
    const e = event({ intentId: s.value.id });
    const first = apply(s.account, e);
    expect(first.value.outcome).toBe('posted');
    expect(balance(first.account.entries, TERM)).toBe(800_000);
    const again = apply(first.account, e);
    expect(again.value.outcome).toBe('duplicate');
    expect(again.account).toBe(first.account);
    const forged = apply(first.account, { ...e, payloadSha256: 'b'.repeat(64) });
    expect(forged.value.outcome).toBe('replay_conflict');
    expect(balance(forged.account.entries, TERM)).toBe(800_000);
  });

  it('posts one entry when two different events report the same payment', () => {
    const s = started();
    const a = apply(s.account, event({ intentId: s.value.id, eventId: 'evt-intent' }));
    const b = apply(a.account, event({ intentId: s.value.id, eventId: 'evt-charge' }));
    expect(b.value.outcome).toBe('already_posted');
    expect(b.account.entries.filter((x) => x.key === paymentKey('fakepay', 'pay-1'))).toHaveLength(1);
  });

  it('does not let a failure arriving after the success un-pay anything (out of order)', () => {
    const s = started();
    const paid = apply(s.account, event({ intentId: s.value.id, eventId: 'evt-ok' }));
    const late = apply(paid.account, event({ intentId: s.value.id, eventId: 'evt-fail', kind: 'payment_failed' }));
    expect(late.value.outcome).toBe('ignored_after_success');
    expect(balance(late.account.entries, TERM)).toBe(800_000);
    expect(late.account.intents[0].status).toBe('paid');
  });

  it('holds a refund that arrives before its payment, and applies it when the payment lands', () => {
    const s = started();
    const early = apply(s.account, event({ intentId: s.value.id, eventId: 'evt-refund', kind: 'payment_refunded', cents: 40_000 }));
    expect(early.value.outcome).toBe('waiting_for_payment');
    expect(balance(early.account.entries, TERM)).toBe(900_000);
    const landed = apply(early.account, event({ intentId: s.value.id, eventId: 'evt-ok' }));
    expect(landed.value.outcome).toBe('posted_and_reversed');
    expect(balance(landed.account.entries, TERM)).toBe(840_000);
  });

  it('reconciles amounts: a success for a different amount or currency posts nothing', () => {
    const s = started();
    expect(apply(s.account, event({ intentId: s.value.id, cents: 99_999 })).value.outcome).toBe('amount_mismatch');
    expect(apply(s.account, event({ intentId: s.value.id, currency: 'eur' })).value.outcome).toBe('currency_mismatch');
    const unknown = apply(s.account, event());
    expect(unknown.value.outcome).toBe('unknown_intent');
    expect(balance(unknown.account.entries, TERM)).toBe(900_000);
  });

  it('refuses a provider refund larger than the payment', () => {
    const s = started();
    const paid = apply(s.account, event({ intentId: s.value.id }));
    const r = apply(paid.account, event({ intentId: s.value.id, eventId: 'evt-r', kind: 'payment_refunded', cents: 100_001 }));
    expect(r.value.outcome).toBe('amount_mismatch');
    expect(balance(r.account.entries, TERM)).toBe(800_000);
  });

  it('records a payment even after the module is switched off, because the money already moved', () => {
    const s = started();
    const off = ctx('provider', { gate: { moduleState: 'off', financeOwner: null, admitted: true, councilFinanceHolder: null } });
    const r = applyProviderEvent(s.account, event({ intentId: s.value.id }), off);
    expect(r).toMatchObject({ ok: true, value: { outcome: 'posted' } });
  });

  it('takes events from the provider path only', () => {
    const s = started();
    expect(applyProviderEvent(s.account, event({ intentId: s.value.id }), ctx(bursar))).toMatchObject({ ok: false, code: 'forbidden' });
  });
});

describe('every decision says why', () => {
  it('carries a sentence on each success and each refusal', () => {
    const results = [
      postEntry(emptyAccount('u', STUDENT), { term: TERM, kind: 'charge', cents: 1, what: 'x', key: 'k' }, ctx(bursar)),
      postEntry(emptyAccount('u', STUDENT), { term: 'fall', kind: 'charge', cents: 1, what: 'x', key: 'k' }, ctx(bursar)),
      issueRefund(charged(), { term: TERM, cents: 1, key: 'r' }, ctx(bursar)),
      placeHold(charged(1), { reason: 'x' }, ctx(bursar)),
    ];
    for (const r of results) expect(r.reason.length).toBeGreaterThan(5);
  });
});
