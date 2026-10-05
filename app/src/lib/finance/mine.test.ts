/**
 * The student's view of their own account: the figures come from the same
 * functions as the bursar's, and the reads ask only for this account's link
 * and never for who approved an entry.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHOOL_PLAN, DEFAULT_SETTINGS, type AccountEntry, type PaymentPlanRecord } from './accounts';
import { myAccountApi, myStatement, myView, whatItIs, type MyAccount } from './mine';

const e = (o: Partial<AccountEntry> & Pick<AccountEntry, 'id' | 'kind' | 'amount_cents' | 'effective_on'>): AccountEntry => ({
  tenant_id: 'vu', student_ref: 'S100', category: 'tuition', description: 'Fall tuition', reference_entry_id: null, provider_ref: '',
  period: o.effective_on.slice(0, 7), request_id: `r-${o.id}`, requested_by: null, approved_by: null, high_value: false,
  recorded_at: `${o.effective_on}T12:00:00Z`, ...o,
});
const acct = (entries: AccountEntry[], settings = DEFAULT_SETTINGS, plans: PaymentPlanRecord[] = []): MyAccount =>
  ({ tenant_id: 'vu', school: 'Vanderbilt', student_ref: 'S100', entries, settings, plans, planRules: DEFAULT_SCHOOL_PLAN });

describe('myView', () => {
  it('says so when nothing is posted', () => {
    const v = myView(acct([]), '2026-10-01');
    expect(v.headline).toBe('Nothing has been posted to your account yet.');
    expect(v.hold.held).toBe(false);
    expect(v.periods).toEqual([]);
  });

  it('owes what is effective by today, and counts later charges apart', () => {
    const v = myView(acct([
      e({ id: 'c1', kind: 'charge', amount_cents: 500000, effective_on: '2026-09-20' }),
      e({ id: 'p1', kind: 'payment', amount_cents: -100000, effective_on: '2026-09-25' }),
      e({ id: 'c2', kind: 'charge', amount_cents: 450000, effective_on: '2027-01-10' }),
    ]), '2026-10-01');
    expect(v.owed).toBe(400000);
    expect(v.upcoming).toBe(450000);
    expect(v.headline).toBe('You owe your school this today.');
    expect(v.periods).toEqual(['2027-01', '2026-09']);
    // The statement shown first is the latest month that has begun, not next term's.
    expect(v.period).toBe('2026-09');
    expect(v.next).toBeNull();
  });

  it('holds by the school’s own rule, not the default', () => {
    const entries = [e({ id: 'c1', kind: 'charge', amount_cents: 20000, effective_on: '2026-08-01' })];
    expect(myView(acct(entries), '2026-10-01').hold.held).toBe(true);
    const lenient = myView(acct(entries, { ...DEFAULT_SETTINGS, hold_minimum_cents: 50000 }), '2026-10-01');
    expect(lenient.hold.held).toBe(false);
    expect(lenient.next).toMatch(/more than 30 days old/);
    const held = myView(acct(entries), '2026-10-01');
    expect(held.hold.line).toBe('Action required before you can register — Student Accounts');
    expect(held.next).toMatch(/^A financial hold applies/);
  });

  it('says a credit is Student Accounts’ to refund', () => {
    const v = myView(acct([
      e({ id: 'c1', kind: 'charge', amount_cents: 1000, effective_on: '2026-09-01' }),
      e({ id: 'a1', kind: 'aid_credit', category: 'scholarship', amount_cents: -5000, effective_on: '2026-09-02' }),
    ]), '2026-10-01');
    expect(v.owed).toBe(-4000);
    expect(v.headline).toBe('Your account is in credit.');
    expect(v.next).toMatch(/Student Accounts/);
  });

  it('names aid by what a student calls it', () => {
    expect(whatItIs(e({ id: 'a1', kind: 'aid_credit', category: 'scholarship', amount_cents: -5000, effective_on: '2026-09-02', description: 'Merit award' }))).toBe('Scholarship: Merit award');
    expect(whatItIs(e({ id: 'c1', kind: 'charge', amount_cents: 1000, effective_on: '2026-09-01' }))).toBe('Charge: Fall tuition');
  });

  it('opens on the earliest statement when every month is still to come', () => {
    expect(myView(acct([e({ id: 'c1', kind: 'charge', amount_cents: 1000, effective_on: '2027-01-05' }), e({ id: 'c2', kind: 'charge', amount_cents: 1000, effective_on: '2027-02-05' })]), '2026-10-01').period).toBe('2027-01');
  });

  it('lifts the hold for a plan being kept, and says so when it falls behind', () => {
    const entries = [
      e({ id: 'c1', kind: 'charge', amount_cents: 300000, effective_on: '2026-08-01' }),
      e({ id: 'p1', kind: 'payment', amount_cents: -100000, effective_on: '2026-10-01', provider_ref: 'pi_1' }),
    ];
    const plan: PaymentPlanRecord = {
      id: 'pl', tenant_id: 'vu', student_ref: 'S100', installments: 2, first_due: '2026-10-01', balance_cents: 300000, status: 'approved',
      requested_by: 'me', requested_at: '2026-09-30T09:00:00Z', decided_at: '2026-09-30T10:00:00Z', decision_note: '', cancelled_at: null, cancel_note: '',
      schedule: [{ due_on: '2026-10-01', cents: 100000 }, { due_on: '2026-11-01', cents: 200000 }],
    };
    expect(myView(acct(entries), '2026-10-15').hold.held).toBe(true);
    const kept = myView(acct(entries, DEFAULT_SETTINGS, [plan]), '2026-10-15');
    expect(kept.hold.held).toBe(false);
    expect(kept.standing?.state).toBe('on_track');
    expect(kept.next).toBeNull();
    const behind = myView(acct(entries, DEFAULT_SETTINGS, [plan]), '2026-11-05');
    expect(behind.hold.held).toBe(true);
    expect(behind.next).toMatch(/^Your payment plan is behind/);
    // A plan only asked for changes nothing yet.
    const asked = myView(acct(entries, DEFAULT_SETTINGS, [{ ...plan, status: 'proposed', decided_at: null }]), '2026-10-15');
    expect(asked.hold.held).toBe(true);
    expect(asked.plan?.status).toBe('proposed');
    expect(asked.standing).toBeNull();
  });

  it('gives the statement the bursar gives', () => {
    const st = myStatement(acct([
      e({ id: 'c1', kind: 'charge', amount_cents: 500000, effective_on: '2026-08-01' }),
      e({ id: 'p1', kind: 'payment', amount_cents: -200000, effective_on: '2026-09-05' }),
    ]), '2026-09');
    expect(st).toMatchObject({ number: 'ST-S100-2026-09', opening_cents: 500000, closing_cents: 300000 });
  });
});

/** A client that records every query and answers each table from `rows`. */
function fakeDb(rows: Record<string, unknown[]>) {
  const calls: { table: string; select: string; filters: string[] }[] = [];
  const from = (table: string) => {
    const call = { table, select: '', filters: [] as string[] };
    calls.push(call);
    const q = {
      select: (cols: string) => ((call.select = cols), q),
      eq: (c: string, v: unknown) => (call.filters.push(`${c}=${String(v)}`), q),
      in: (c: string, v: unknown[]) => (call.filters.push(`${c} in ${v.join('|')}`), q),
      order: () => q,
      then: (ok: (r: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(ok),
    };
    return q;
  };
  return { db: { from } as never, calls };
}

describe('myAccountApi', () => {
  it('reads the account’s plans with their schedules, and never who decided them', async () => {
    const { db, calls } = fakeDb({
      academic_record_subjects: [{ tenant_id: 'vu', student_ref: 'S100' }],
      student_payment_plans: [{ id: 'pl', tenant_id: 'vu', student_ref: 'S100', balance_cents: '300000', status: 'proposed' }],
      student_payment_plan_installments: [{ plan_id: 'pl', seq: 1, due_on: '2026-10-01', cents: '100000' }, { plan_id: 'pl', seq: 2, due_on: '2026-11-01', cents: '200000' }],
    });
    const [a] = await myAccountApi(db).accounts('me');
    expect(a.plans[0]).toMatchObject({ id: 'pl', balance_cents: 300000, schedule: [{ due_on: '2026-10-01', cents: 100000 }, { due_on: '2026-11-01', cents: 200000 }] });
    const plans = calls.find((c) => c.table === 'student_payment_plans')!;
    expect(plans.filters).toEqual(['tenant_id=vu', 'student_ref=S100']);
    expect(plans.select).not.toMatch(/decided_by|cancelled_by/);
  });

  it('reads nothing past the link when there is none', async () => {
    const { db, calls } = fakeDb({});
    expect(await myAccountApi(db).accounts('me')).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(['academic_record_subjects']);
    expect(calls[0].filters).toEqual(['user_id=me']);
  });

  it('reads the linked record, the school’s name and its rule, and never who approved', async () => {
    const { db, calls } = fakeDb({
      academic_record_subjects: [{ tenant_id: 'vu', student_ref: 'S100' }],
      schools: [{ id: 'vu', name: 'Vanderbilt University' }],
      student_account_settings: [{ tenant_id: 'vu', high_value_cents: 1, hold_after_days: 45, hold_minimum_cents: 2,
        plans_offered: false, plan_min_down_percent: 25, plan_max_installments: 4, plan_min_installment_cents: 700 }],
      student_account_entries: [{ id: 'c1', tenant_id: 'vu', student_ref: 'S100', amount_cents: 100 }],
    });
    const [a] = await myAccountApi(db).accounts('me');
    expect(a.school).toBe('Vanderbilt University');
    expect(a.settings).toEqual({ high_value_cents: 1, hold_after_days: 45, hold_minimum_cents: 2 });
    expect(a.planRules).toEqual({ offered: false, min_down_percent: 25, max_installments: 4, min_installment_cents: 700 });
    const entries = calls.find((c) => c.table === 'student_account_entries')!;
    expect(entries.filters).toEqual(['tenant_id=vu', 'student_ref=S100']);
    expect(entries.select).not.toMatch(/requested_by|approved_by/);
    expect(a.entries[0]).toMatchObject({ requested_by: null, approved_by: null });
  });

  it('falls back to the default rule when the school has set none', async () => {
    const { db } = fakeDb({ academic_record_subjects: [{ tenant_id: 'vu', student_ref: 'S100' }] });
    const [a] = await myAccountApi(db).accounts('me');
    expect(a.settings).toEqual(DEFAULT_SETTINGS);
    expect(a.planRules).toEqual(DEFAULT_SCHOOL_PLAN);
    expect(a.school).toBe('vu');
  });
});
