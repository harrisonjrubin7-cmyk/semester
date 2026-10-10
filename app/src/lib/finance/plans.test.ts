/**
 * The plans client: what it sends when a plan is asked for, the sentence a
 * second live plan comes back as, and that a change reaching no row is said
 * rather than taken for success.
 */
import { describe, expect, it } from 'vitest';
import { askForPlan, cancelPlan, decidePlan, withdrawPlan } from './plans';

function fakeDb(answer: { data: unknown; error: { message: string } | null }) {
  const sent: { table: string; op: string; body?: unknown; filters: string[] }[] = [];
  const rpc = async (name: string, body: Record<string, unknown>) => {
    sent.push({ table: name, op: 'rpc', body, filters: [] });
    return answer;
  };
  const from = (table: string) => {
    const call = { table, op: '', body: undefined as unknown, filters: [] as string[] };
    sent.push(call);
    const q = {
      insert: (b: unknown) => ((call.op = 'insert'), (call.body = b), q),
      update: (b: unknown) => ((call.op = 'update'), (call.body = b), q),
      select: () => q,
      single: () => q,
      eq: (c: string, v: unknown) => (call.filters.push(`${c}=${String(v)}`), q),
      then: (ok: (r: typeof answer) => unknown) => Promise.resolve(answer).then(ok),
    };
    return q;
  };
  return { db: { from, rpc } as never, sent };
}

describe('plans', () => {
  it('asks with the count and the first date only; the balance is the database’s', async () => {
    const accepted = { id: 'receipt-1', commandKey: 'finance-plan-0001', action: 'plan.request', status: 'accepted', resourceId: 'pl', state: 'proposed', version: 1, recordedAt: '2026-10-10T12:00:00Z' };
    const { db, sent } = fakeDb({ data: accepted, error: null });
    expect(await askForPlan(db, 'vu', 'S100', 4, '2026-10-01', 'finance-plan-0001')).toEqual(accepted);
    expect(sent[0]).toMatchObject({ table: 'finance_command', op: 'rpc', body: {
      want_tenant: 'vu', want_student: 'S100', want_action: 'plan.request', want_key: 'finance-plan-0001',
      want_expected_version: null, want_payload: { installments: 4, first_due: '2026-10-01' },
    } });
    expect((sent[0].body as { want_payload: object }).want_payload).not.toHaveProperty('balance_cents');
  });

  it('says a second live plan in words', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'There is already a plan on this account, asked for or agreed.' } });
    await expect(askForPlan(db, 'vu', 'S100', 4, '2026-10-01', 'finance-plan-0001')).rejects.toThrow('There is already a plan on this account, asked for or agreed.');
  });

  it('passes the guard’s own sentence through', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'There is nothing owed to spread over a plan.' } });
    await expect(askForPlan(db, 'vu', 'S100', 4, '2026-10-01', 'finance-plan-0001')).rejects.toThrow('There is nothing owed to spread over a plan.');
  });

  it('decides, withdraws and cancels by id, and says so when no row was reached', async () => {
    const ok = fakeDb({ data: [{ id: 'pl' }], error: null });
    await decidePlan(ok.db, 'pl', 'approved', '  Agreed by phone ');
    expect(ok.sent[0]).toMatchObject({ op: 'update', body: { status: 'approved', decision_note: 'Agreed by phone' }, filters: ['id=pl'] });
    await cancelPlan(ok.db, 'pl', 'Missed two');
    expect(ok.sent[1].body).toEqual({ status: 'cancelled', cancel_note: 'Missed two' });
    const none = fakeDb({ data: [], error: null });
    await expect(withdrawPlan(none.db, 'pl')).rejects.toThrow('Your account cannot withdraw this plan.');
    await expect(decidePlan(none.db, 'pl', 'rejected', '')).rejects.toThrow('Your account cannot decide this plan.');
  });
});
