import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AID_CATEGORIES, CATEGORIES, DEFAULT_PLAN, DEFAULT_SCHOOL_PLAN, DEFAULT_SETTINGS, PLAN_FIRST_DUE_DAYS, PLAN_STATUSES, HIGH_VALUE_KINDS, KINDS, KIND_LABEL, PAN, PROVIDER_KINDS, REFERENCING_KINDS, REQUEST_STATUSES, SIGN,
  aging, balance, barredApprovers, holdStatus, money, needsHighApproval, parseCents, parseSettlement, paymentPlan, proposalProblems,
  firstDueRange, livePlan, planStanding, receipt, reconcileProvider, returnedAgainst, signed, statement, statementCsv,
  type AccountEntry, type PaymentPlanRecord, type Proposal,
} from './accounts';

/**
 * Holds the student-accounts rules to the migration that enforces them, word
 * for word, and the arithmetic — balances, aging, holds, statements, plans,
 * reconciliation — to cases worked by hand in whole cents.
 */

const root = join(import.meta.dirname, '../../../..');
const SQL = readFileSync(join(root, 'supabase/migrations/20260929220000_student_accounts.sql'), 'utf8');

function words(after: string): string[] {
  const at = SQL.indexOf(after);
  if (at < 0) throw new Error(`no ${after}`);
  const start = SQL.indexOf('(', at + after.length - 1);
  return [...SQL.slice(start, SQL.indexOf(')', start)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

let n = 0;
function entry(over: Partial<AccountEntry> & Pick<AccountEntry, 'kind' | 'amount_cents' | 'effective_on'>): AccountEntry {
  n += 1;
  return {
    id: `e${n}`, tenant_id: 'u', student_ref: 'S100', category: 'tuition', description: 'x', reference_entry_id: null, provider_ref: '',
    period: over.effective_on.slice(0, 7), request_id: `r${n}`, requested_by: 'off1', approved_by: 'off2', high_value: false,
    recorded_at: `${over.effective_on}T12:00:00Z`, ...over,
  };
}

describe('student accounts, held to the migration', () => {
  it('has every vocabulary the database checks, word for word', () => {
    expect(words("kind                text        not null check (kind in")).toEqual([...KINDS]);
    expect(words("category            text        not null check (category in")).toEqual([...CATEGORIES]);
    expect(words("status              text        not null default 'proposed' check (status in")).toEqual([...REQUEST_STATUSES]);
    expect(SQL).toContain(`(kind in (${PROVIDER_KINDS.map((k) => `'${k}'`).join(', ')})) = (length(trim(provider_ref)) > 0)`);
    expect(SQL).toContain(`(kind in (${REFERENCING_KINDS.map((k) => `'${k}'`).join(', ')})) = (reference_entry_id is not null)`);
    expect(words("kind = 'reversal' or (kind = 'aid_credit') = (category in")).toEqual([...AID_CATEGORIES]);
    expect(words('high := old.kind in')).toEqual([...HIGH_VALUE_KINDS]);
    for (const k of KINDS) expect(KIND_LABEL[k], k).toBeTruthy();
  });

  it('signs every kind the way the trigger does', () => {
    const block = SQL.slice(SQL.indexOf('amount := case old.kind'), SQL.indexOf("when 'reversal' then -ref.amount_cents"));
    for (const [kind, sign] of Object.entries(SIGN)) {
      expect(block, kind).toContain(`when '${kind}' then ${sign === 1 ? '' : '-'}old.amount_cents`);
    }
  });

  it('refuses a card number with the same pattern in both places, and only a card number', () => {
    expect(SQL).toContain("description !~ '[0-9]([ -]?[0-9]){12,18}'");
    expect(PAN.source).toBe('\\d(?:[ -]?\\d){12,18}');
    for (const card of ['4111111111111111', '4111 1111 1111 1111', '5555-5555-5555-4444', '378282246310005']) expect(PAN.test(card), card).toBe(true);
    for (const fine of ['pi_3Nq8xLk2', 'Fall 2026 tuition', 'S0012345', 'invoice 2026-09-01', '123 456 789']) expect(PAN.test(fine), fine).toBe(false);
  });

  it('defaults the thresholds the way the table does', () => {
    expect(SQL).toContain(`high_value_cents    bigint      not null default ${DEFAULT_SETTINGS.high_value_cents}`);
    expect(SQL).toContain(`hold_after_days     smallint    not null default ${DEFAULT_SETTINGS.hold_after_days}`);
    expect(SQL).toContain(`hold_minimum_cents  bigint      not null default ${DEFAULT_SETTINGS.hold_minimum_cents}`);
    expect(SQL).toContain(`coalesce(threshold, ${DEFAULT_SETTINGS.high_value_cents})`);
  });
});

describe('money', () => {
  it('prints and reads cents without a float', () => {
    expect(money(123456)).toBe('$1,234.56');
    expect(money(-5)).toBe('−$0.05');
    expect(parseCents('1,204')).toBe(120400);
    expect(parseCents('$12.5')).toBe(1250);
    expect(parseCents('0.1')).toBe(10);
    expect(parseCents('12.345')).toBeNull();
    expect(parseCents('0')).toBeNull();
    expect(parseCents('-5')).toBeNull();
  });

  it('signs a reversal as the opposite of what it reverses', () => {
    const aid = entry({ kind: 'aid_credit', amount_cents: -150000, effective_on: '2026-09-10' });
    expect(signed('reversal', 150000, aid)).toBe(150000);
    expect(signed('refund', 50000, null)).toBe(50000);
    expect(signed('payment', 50000, null)).toBe(-50000);
  });
});

describe('balance, aging and holds', () => {
  const charge = entry({ kind: 'charge', amount_cents: 500000, effective_on: '2026-08-01' });
  const fees = entry({ kind: 'charge', amount_cents: 20000, effective_on: '2026-10-15' });
  const pay = entry({ kind: 'payment', amount_cents: -200000, effective_on: '2026-09-05', provider_ref: 'pi_1' });
  const all = [charge, fees, pay];

  it('sums signed cents, as of a date', () => {
    expect(balance(all)).toBe(320000);
    expect(balance(all, '2026-09-30')).toBe(300000);
  });

  it('ages what is left of each debit after credits pay the oldest first', () => {
    // 1 August to 1 November is 92 days (31 + 30 + 31): over ninety.
    expect(aging(all, '2026-11-01')).toEqual({ current: 20000, d31_60: 0, d61_90: 0, over90: 300000, credit: 0 });
    expect(aging(all, '2026-10-29').d61_90, '89 days').toBe(300000);
    const overpaid = [charge, entry({ kind: 'payment', amount_cents: -600000, effective_on: '2026-08-02', provider_ref: 'pi_2' })];
    expect(aging(overpaid, '2026-11-01')).toEqual({ current: 0, d31_60: 0, d61_90: 0, over90: 0, credit: 100000 });
  });

  it('holds only once a debit is more than the window old, not on the day it reaches it', () => {
    const due = [entry({ kind: 'charge', amount_cents: 50000, effective_on: '2026-09-01' })];
    // 1 Oct is 30 days after 1 Sep: at the window, not past it.
    expect(holdStatus(due, '2026-10-01').held).toBe(false);
    expect(aging(due, '2026-10-01').current).toBe(50000);
    expect(holdStatus(due, '2026-10-02').held).toBe(true);
  });

  it('holds only when more than the minimum is overdue past the window, and a recent payment counts', () => {
    expect(holdStatus(all, '2026-08-20').held, 'inside the 30-day window').toBe(false);
    const held = holdStatus(all, '2026-11-01');
    expect(held).toEqual({ held: true, overdue_cents: 300000, line: 'Action required before you can register — Student Accounts' });
    expect(held.line, 'the sentence carries no amount').not.toMatch(/\$|\d{3}/);
    const paidYesterday = [...all, entry({ kind: 'payment', amount_cents: -295000, effective_on: '2026-10-31', provider_ref: 'pi_3' })];
    expect(holdStatus(paidYesterday, '2026-11-01'), 'overdue $50 is under the $100 minimum').toEqual({ held: false, overdue_cents: 5000, line: 'No financial hold' });
    expect(holdStatus(all, '2026-11-01', { ...DEFAULT_SETTINGS, hold_minimum_cents: 400000 }).held).toBe(false);
  });
});

describe('statements, receipts and plans', () => {
  const charge = entry({ kind: 'charge', amount_cents: 500000, effective_on: '2026-08-01', description: 'Fall tuition' });
  const pay = entry({ kind: 'payment', amount_cents: -200000, effective_on: '2026-09-05', provider_ref: 'pi_3Nq8', description: 'Online payment' });
  const refund = entry({ kind: 'refund', amount_cents: 50000, effective_on: '2026-09-20', provider_ref: 're_1', reference_entry_id: pay.id, description: 'Partial refund, "overpaid"' });

  it('brings the balance forward, lists the period, and carries it on — the same statement every time', () => {
    const st = statement([refund, charge, pay], 'S100', '2026-09');
    expect(st).toMatchObject({ number: 'ST-S100-2026-09', opening_cents: 500000, closing_cents: 350000 });
    expect(st.lines.map((l) => l.id)).toEqual([pay.id, refund.id]);
    expect(statementCsv(st)).toBe(statementCsv(statement([pay, charge, refund], 'S100', '2026-09')));
    const csv = statementCsv(st).trim().split('\n');
    expect(csv[1]).toBe('Balance brought forward,,,,,5000.00');
    expect(csv[4]).toBe(`2026-09-20,Refund,tuition,"Partial refund, ""overpaid""",re_1,500.00`);
    expect(csv[5]).toBe('Balance carried forward,,,,,3500.00');
  });

  it('writes a receipt by the provider’s reference, and only for a payment', () => {
    expect(receipt(pay)).toEqual([
      'Receipt for a payment of $2,000.00', 'Student S100, received 2026-09-05', 'Payment provider reference pi_3Nq8',
      `Recorded on your school's student account as entry ${pay.id}`,
    ]);
    expect(() => receipt(charge)).toThrow();
  });

  it('builds a plan that sums to the balance to the cent, or says why not', () => {
    const plan = paymentPlan(350001, 4, '2026-10-31');
    if (!('schedule' in plan)) throw new Error(plan.refused);
    expect(plan.schedule.map((p) => p.due_on)).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31']);
    expect(plan.schedule[0].cents).toBe(35001);
    expect(plan.schedule.reduce((s, p) => s + p.cents, 0)).toBe(350001);
    expect(paymentPlan(0, 4, '2026-10-31')).toEqual({ refused: 'There is nothing owed to spread over a plan.' });
    expect(paymentPlan(350000, 7, '2026-10-31')).toEqual({ refused: 'A plan has between 2 and 6 payments.' });
    expect(paymentPlan(20000, 6, '2026-10-31')).toMatchObject({ refused: expect.stringMatching(/under \$50\.00/) });
  });
});

describe('reconciliation with the provider', () => {
  const pay = entry({ kind: 'payment', amount_cents: -200000, effective_on: '2026-09-05', provider_ref: 'pi_1' });
  const refund = entry({ kind: 'refund', amount_cents: 50000, effective_on: '2026-09-20', provider_ref: 're_1' });
  const charge = entry({ kind: 'charge', amount_cents: 500000, effective_on: '2026-09-01' });
  const october = entry({ kind: 'payment', amount_cents: -1000, effective_on: '2026-10-01', provider_ref: 'pi_9' });

  it('compares what moved through the provider with the ledger’s provider entries in the month', () => {
    const r = reconcileProvider([{ provider_ref: 'pi_1', amount_cents: 200000 }, { provider_ref: 're_1', amount_cents: -50000 }], [pay, refund, charge, october], '2026-09');
    expect(r).toEqual({ provider_total_cents: 150000, ledger_total_cents: 150000, matched: 2, missing: [], extra: [], differing: [] });
  });

  it('names what is missing, extra and different', () => {
    const r = reconcileProvider([{ provider_ref: 'pi_1', amount_cents: 199000 }, { provider_ref: 'pi_7', amount_cents: 500 }], [pay, refund], '2026-09');
    expect(r.missing).toEqual(['pi_7']);
    expect(r.extra).toEqual(['re_1']);
    expect(r.differing).toEqual([{ provider_ref: 'pi_1', provider_cents: 199000, ledger_cents: 200000 }]);
  });

  it('reads a settlement file in dollars or cents, and refuses one it cannot', () => {
    expect(parseSettlement(['Reference', 'Amount'], [['pi_1', '2,000.00'], ['re_1', '-500']])).toEqual([
      { provider_ref: 'pi_1', amount_cents: 200000 }, { provider_ref: 're_1', amount_cents: -50000 },
    ]);
    expect(parseSettlement(['provider_ref', 'amount_cents'], [['pi_1', '200000']])).toEqual([{ provider_ref: 'pi_1', amount_cents: 200000 }]);
    expect(parseSettlement(['id', 'amount'], [['pi_1', 'two']])).toEqual({ refused: 'Row 1 has an amount that is not a number.' });
    expect(parseSettlement(['who', 'what'], [])).toMatchObject({ refused: expect.stringMatching(/provider_ref/) });
  });
});

describe('proposals', () => {
  const charge = entry({ kind: 'charge', amount_cents: 500000, effective_on: '2026-09-01', requested_by: 'off1', approved_by: 'off2' });
  const pay = entry({ kind: 'payment', amount_cents: -200000, effective_on: '2026-09-05', provider_ref: 'pi_1', requested_by: 'off1', approved_by: 'off2' });
  const refunded = entry({ kind: 'refund', amount_cents: 50000, effective_on: '2026-09-20', provider_ref: 're_1', reference_entry_id: pay.id });
  const ledger = [charge, pay, refunded];
  const base: Proposal = { student_ref: 'S100', kind: 'charge', category: 'fees', amount_cents: 2500, description: 'Lab fee', reference_entry_id: null, provider_ref: '', effective_on: '2026-10-01' };

  it('says what is wrong before the database is asked, in the database’s terms', () => {
    expect(proposalProblems(base, ledger, [])).toEqual([]);
    expect(proposalProblems({ ...base, description: 'card 4111 1111 1111 1111' }, ledger, [])).toContain('That looks like a card number. Card numbers are never recorded here.');
    expect(proposalProblems({ ...base, kind: 'payment' }, ledger, [])).toContain('Give the payment provider’s reference.');
    expect(proposalProblems({ ...base, provider_ref: 'pi_1' }, ledger, [])).toContain('Only payments, refunds and chargebacks carry a provider reference.');
    expect(proposalProblems({ ...base, kind: 'aid_credit' }, ledger, [])).toContain('An aid credit is a scholarship, waiver, discount or sponsorship.');
    expect(proposalProblems({ ...base, effective_on: '2026-09-30' }, ledger, ['2026-09'])).toContain('2026-09 is closed; record it in an open month.');
  });

  it('holds refunds, chargebacks and reversals to what they answer', () => {
    expect(returnedAgainst(ledger, pay.id)).toBe(50000);
    const refund: Proposal = { ...base, kind: 'refund', category: 'tuition', amount_cents: 150001, reference_entry_id: pay.id, provider_ref: 're_2' };
    expect(proposalProblems(refund, ledger, [])).toEqual(['At most $1,500.00 of that payment is left to return.']);
    expect(proposalProblems({ ...refund, amount_cents: 150000 }, ledger, [])).toEqual([]);
    expect(proposalProblems({ ...refund, reference_entry_id: charge.id }, ledger, [])).toEqual(['A refund or chargeback answers a payment.']);
    const reversal: Proposal = { ...base, kind: 'reversal', category: 'tuition', amount_cents: 100, reference_entry_id: charge.id };
    expect(proposalProblems(reversal, ledger, [])).toEqual(['A reversal is for the whole entry, $5,000.00.']);
    expect(proposalProblems({ ...reversal, amount_cents: 500000 }, ledger, [])).toEqual([]);
    const reversed = [...ledger, entry({ kind: 'reversal', amount_cents: -500000, effective_on: '2026-09-12', reference_entry_id: charge.id })];
    expect(proposalProblems({ ...reversal, amount_cents: 500000 }, reversed, [])).toEqual(['That entry has already been reversed.']);
  });

  it('knows who may not approve, and when the high-value approver is needed', () => {
    expect(barredApprovers({ kind: 'refund', reference_entry_id: pay.id }, ledger)).toEqual(['off1', 'off2']);
    expect(barredApprovers({ kind: 'charge', reference_entry_id: null }, ledger)).toEqual([]);
    expect(needsHighApproval({ kind: 'aid_credit', amount_cents: 100000 })).toBe(true);
    expect(needsHighApproval({ kind: 'aid_credit', amount_cents: 99999 })).toBe(false);
    expect(needsHighApproval({ kind: 'charge', amount_cents: 99999999 }), 'a charge is never high value').toBe(false);
  });
});

const PLANS_SQL = readFileSync(join(root, 'supabase/migrations/20260929230000_student_payment_plans.sql'), 'utf8');

describe('payment plans, held to their migration', () => {
  it('has the statuses and the default rules the database has', () => {
    const at = PLANS_SQL.indexOf("status in ('proposed'");
    expect([...PLANS_SQL.slice(at, PLANS_SQL.indexOf(')', at)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...PLAN_STATUSES]);
    expect(PLANS_SQL).toMatch(new RegExp(`plans_offered\\s+boolean\\s+not null default ${DEFAULT_SCHOOL_PLAN.offered}`));
    expect(PLANS_SQL).toMatch(new RegExp(`plan_min_down_percent\\s+smallint not null default ${DEFAULT_PLAN.min_down_percent} `));
    expect(PLANS_SQL).toMatch(new RegExp(`plan_max_installments\\s+smallint not null default ${DEFAULT_PLAN.max_installments} `));
    expect(PLANS_SQL).toMatch(new RegExp(`plan_min_installment_cents bigint\\s+not null default ${DEFAULT_PLAN.min_installment_cents} `));
    expect(PLANS_SQL).toContain(`new.first_due > current_date + ${PLAN_FIRST_DUE_DAYS}`);
  });

  it('writes the schedule student-payment-plans.check.sql pins, to the cent', () => {
    // The check suite's plan: $5,000.45 over four payments at 10% first.
    const plan = paymentPlan(500045, 4, '2026-10-01');
    if (!('schedule' in plan)) throw new Error(plan.refused);
    expect(plan.schedule.map((p) => p.cents)).toEqual([50005, 150013, 150013, 150014]);
    // And the school's own minimum refuses six payments of it, as the database did.
    expect(paymentPlan(500045, 6, '2026-10-01', { ...DEFAULT_PLAN, min_installment_cents: 100000 })).toHaveProperty('refused');
    expect(paymentPlan(500045, 4, '2026-10-01', { ...DEFAULT_PLAN, min_installment_cents: 100000 })).toHaveProperty('schedule');
  });

  it('never shows a payment of nothing, whatever the rules say', () => {
    // Everything paid first leaves nothing for the months after.
    expect(paymentPlan(10000, 2, '2026-10-01', { ...DEFAULT_PLAN, min_down_percent: 100, min_installment_cents: 0 })).toHaveProperty('refused');
    // And a balance too small to spread gives no zero-cent months either.
    expect(paymentPlan(3, 6, '2026-10-01', { ...DEFAULT_PLAN, min_installment_cents: 0 })).toHaveProperty('refused');
    expect(PLANS_SQL).toContain('plan_min_down_percent >= 1');
    expect(PLANS_SQL).toContain('plan_min_installment_cents >= 1');
  });

  it('offers a first payment from today to thirty days on', () => {
    expect(firstDueRange('2026-10-01')).toEqual({ min: '2026-10-01', max: '2026-10-31' });
    expect(firstDueRange('2026-12-15')).toEqual({ min: '2026-12-15', max: '2027-01-14' });
  });

  const plan = (over: Partial<PaymentPlanRecord> = {}): PaymentPlanRecord => ({
    id: 'p1', tenant_id: 'u', student_ref: 'S100', installments: 3, first_due: '2026-10-01', balance_cents: 300000, status: 'approved',
    requested_by: 'me', requested_at: '2026-09-28T10:00:00Z', decided_at: '2026-09-29T10:00:00Z', decision_note: '', cancelled_at: null, cancel_note: '',
    schedule: [{ due_on: '2026-10-01', cents: 100000 }, { due_on: '2026-11-01', cents: 100000 }, { due_on: '2026-12-01', cents: 100000 }],
    ...over,
  });
  const old = entry({ kind: 'charge', amount_cents: 300000, effective_on: '2026-08-01' });
  const paid = (cents: number, on: string) => entry({ kind: 'payment', amount_cents: -cents, effective_on: on, provider_ref: `pi_${on}` });

  it('is on track while what was paid since it was asked for covers what is due', () => {
    const st = planStanding(plan(), [old, paid(100000, '2026-10-01')], '2026-10-15');
    expect(st).toMatchObject({ paid_cents: 100000, due_cents: 100000, behind_cents: 0, state: 'on_track', next: { seq: 2, due_on: '2026-11-01', cents: 100000 } });
    expect(st.rows.map((r) => r.state)).toEqual(['paid', 'upcoming', 'upcoming']);
  });

  it('is behind once a payment date passes unpaid, and says which', () => {
    const st = planStanding(plan(), [old, paid(100000, '2026-10-01')], '2026-11-02');
    expect(st).toMatchObject({ behind_cents: 100000, state: 'behind' });
    expect(st.rows.map((r) => r.state)).toEqual(['paid', 'late', 'upcoming']);
    expect(planStanding(plan(), [old], '2026-10-01').rows[0].state).toBe('due');
  });

  it('counts nothing paid before the plan, nor a new charge, and a refund takes a payment back', () => {
    const early = paid(50000, '2026-09-01');
    expect(planStanding(plan(), [old, early], '2026-10-02').state).toBe('behind');
    const refund = entry({ kind: 'refund', amount_cents: 40000, effective_on: '2026-10-05', provider_ref: 're_1' });
    const late = entry({ kind: 'charge', amount_cents: 99999, effective_on: '2026-10-03' });
    expect(planStanding(plan(), [old, paid(100000, '2026-10-01'), late, refund], '2026-10-06')).toMatchObject({ paid_cents: 60000, state: 'behind' });
    expect(planStanding(plan(), [old, paid(300000, '2026-10-01')], '2026-10-02').state).toBe('complete');
  });

  it('lifts the hold while it is kept, and not when it is behind', () => {
    const entries = [old, paid(100000, '2026-10-01')];
    const kept = planStanding(plan(), entries, '2026-10-15');
    expect(holdStatus(entries, '2026-10-15').held).toBe(true);
    expect(holdStatus(entries, '2026-10-15', DEFAULT_SETTINGS, kept)).toMatchObject({ held: false, line: 'No financial hold — a payment plan is being kept' });
    const behind = planStanding(plan(), entries, '2026-11-20');
    expect(holdStatus(entries, '2026-11-20', DEFAULT_SETTINGS, behind).held).toBe(true);
  });

  it('knows the live plan: one asked for or agreed, never one decided against', () => {
    expect(livePlan([plan({ id: 'a', status: 'rejected' }), plan({ id: 'b', status: 'proposed' })])?.id).toBe('b');
    expect(livePlan([plan({ status: 'cancelled' }), plan({ status: 'withdrawn' })])).toBeNull();
  });
});
