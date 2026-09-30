// @vitest-environment jsdom
/**
 * Student accounts, driven through an injected client. The client is the only
 * fake; the screen, its copy, its gating and the arithmetic — balance, aging,
 * hold, statement, plan, reconciliation — are the shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const downloads: { name: string; body: string }[] = [];
vi.mock('../../lib/deliver', () => ({
  download: (p: { name: string; body: string }) => downloads.push({ name: p.name, body: p.body }),
}));

import { DEFAULT_SCHOOL_PLAN, DEFAULT_SETTINGS, type AccountEntry, type AccountRequest, type PaymentPlanRecord } from '../../lib/finance/accounts';
import type { FinanceApi, Reconciliation } from '../../lib/finance/api';
import { StudentAccounts } from './StudentAccounts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OFF1 = 'user-off1';
const OFF2 = 'user-off2';
const ADM = 'user-admin';
const TODAY = '2026-11-01';

const e = (o: Partial<AccountEntry> & Pick<AccountEntry, 'id' | 'kind' | 'amount_cents' | 'effective_on'>): AccountEntry => ({
  tenant_id: 'vu', student_ref: 'S100', category: 'tuition', description: 'Fall tuition', reference_entry_id: null, provider_ref: '',
  period: o.effective_on.slice(0, 7), request_id: `r-${o.id}`, requested_by: OFF1, approved_by: OFF2, high_value: false, recorded_at: `${o.effective_on}T12:00:00Z`, ...o,
});
const CHARGE = e({ id: 'e1', kind: 'charge', amount_cents: 500000, effective_on: '2026-08-01' });
const PAY = e({ id: 'e2', kind: 'payment', amount_cents: -200000, effective_on: '2026-09-05', provider_ref: 'pi_3Nq8', description: 'Online payment' });

const NOV_PAY = e({ id: 'e3', kind: 'payment', amount_cents: -200000, effective_on: '2026-11-01', provider_ref: 'pi_3Nq8', description: 'Online payment' });

const req = (o: Partial<AccountRequest> & Pick<AccountRequest, 'id' | 'kind' | 'amount_cents' | 'requested_by'>): AccountRequest => ({
  tenant_id: 'vu', student_ref: 'S100', category: 'tuition', description: 'Fall adjustment', reference_entry_id: null, provider_ref: '',
  effective_on: '2026-10-20', status: 'proposed', requested_at: '2026-10-20T10:00:00Z', decided_by: null, decided_at: null, ...o,
});

const PLAN: PaymentPlanRecord = {
  id: 'pl1', tenant_id: 'vu', student_ref: 'S100', installments: 3, first_due: '2026-10-15', balance_cents: 300000, status: 'approved',
  requested_by: 'user-student', requested_at: '2026-10-10T09:00:00Z', decided_at: '2026-10-11T09:00:00Z', decision_note: '', cancelled_at: null, cancel_note: '',
  schedule: [{ due_on: '2026-10-15', cents: 30000 }, { due_on: '2026-11-15', cents: 135000 }, { due_on: '2026-12-15', cents: 135000 }],
};
const PLAN_PAY = e({ id: 'e9', kind: 'payment', amount_cents: -30000, effective_on: '2026-10-15', provider_ref: 'pi_plan1', description: 'Plan payment' });

function fake(over: Partial<FinanceApi> = {}, pending: AccountRequest[] = [], recs: Reconciliation[] = []) {
  const api = {
    lookup: vi.fn(async () => ({ entries: [CHARGE, PAY], requests: [] as AccountRequest[] })),
    pending: vi.fn(async () => pending),
    settings: vi.fn(async () => DEFAULT_SETTINGS),
    closed: vi.fn(async () => ['2026-08']),
    periodEntries: vi.fn(async () => [NOV_PAY]),
    reconciliations: vi.fn(async () => recs),
    request: vi.fn(async () => 'r-new'),
    decide: vi.fn(async () => undefined),
    withdraw: vi.fn(async () => undefined),
    reconcile: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    plans: vi.fn(async () => [] as PaymentPlanRecord[]),
    plansWaiting: vi.fn(async () => [] as PaymentPlanRecord[]),
    planRules: vi.fn(async () => DEFAULT_SCHOOL_PLAN),
    decidePlan: vi.fn(async () => undefined),
    cancelPlan: vi.fn(async () => undefined),
    ...over,
  };
  return api as unknown as FinanceApi & Record<keyof FinanceApi, ReturnType<typeof vi.fn>>;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  downloads.length = 0;
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

type Who = { viewerId: string; request: boolean; approve: boolean; approveHigh: boolean; close: boolean; read: boolean };
const officer: Who = { viewerId: OFF1, request: true, approve: true, approveHigh: false, close: false, read: true };
const admin: Who = { viewerId: ADM, request: false, approve: true, approveHigh: true, close: true, read: true };
const aidOfficer: Who = { viewerId: 'user-aid', request: true, approve: false, approveHigh: false, close: false, read: false };

async function mount(api: FinanceApi, who: Who) {
  await act(async () => {
    root.render(<StudentAccounts tenantId="vu" api={api} today={TODAY} {...who} />);
  });
}
const button = (re: RegExp) => [...host.querySelectorAll('button')].find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
async function click(el: HTMLElement | undefined) {
  expect(el, 'control not found').toBeTruthy();
  await act(async () => el!.click());
}
function type(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}
const field = (re: RegExp, within: ParentNode = host) =>
  [...within.querySelectorAll('label')].find((l) => re.test(l.textContent ?? ''))!.querySelector('input, select') as HTMLInputElement;
async function openAccount() {
  await act(async () => type(field(/Student identifier/), 'S100'));
  await click(button(/Open the account/));
}
const settle = () => act(async () => {
  await new Promise((r) => setTimeout(r, 0));
});

describe('an account', () => {
  it('shows the balance, its age, the hold, every entry, and that there is no plan', async () => {
    await mount(fake(), officer);
    await openAccount();
    const acct = host.querySelector('section[aria-label="Account of S100"]')!.textContent!;
    expect(acct).toContain('Balance owed: $3,000.00');
    expect(acct).toContain('Action required before you can register — Student Accounts. $3,000.00 is more than 30 days overdue.');
    expect(host.querySelector('table[aria-label="Balance by age"]')!.textContent).toContain('$3,000.00');
    expect(host.querySelector('table[aria-label="Entries"]')!.textContent).toContain('pi_3Nq8');
    expect(host.querySelector('section[aria-label="Payment plan"]')!.textContent).toMatch(/No plan\. A student asks for one from Bill/);
  });

  it('shows an agreed plan being kept, lifts the hold for it, and cancels it only with a reason', async () => {
    const api = fake({ lookup: vi.fn(async () => ({ entries: [CHARGE, PAY, PLAN_PAY], requests: [] as AccountRequest[] })), plans: vi.fn(async () => [PLAN]) });
    await mount(api, officer);
    await openAccount();
    expect(api.plans).toHaveBeenCalledWith('vu', 'S100');
    const acct = host.querySelector('section[aria-label="Account of S100"]')!.textContent!;
    expect(acct).toContain('No financial hold — a payment plan is being kept');
    const plan = host.querySelector('section[aria-label="Payment plan"]')!;
    expect(plan.textContent).toContain('Agreed for $3,000.00, and being kept');
    expect(plan.querySelector('ol[aria-label="Plan schedule"]')!.textContent).toContain('2026-10-15: $300.00 — paid');
    const cancel = [...plan.querySelectorAll('button')].find((b) => /Cancel the plan/.test(b.textContent ?? ''))!;
    expect(cancel.disabled).toBe(true);
    await act(async () => type(field(/Why the plan is cancelled/, plan), 'Two payments missed'));
    expect(cancel.disabled).toBe(false);
    await click(cancel);
    expect(api.cancelPlan).toHaveBeenCalledWith('pl1', 'Two payments missed');
  });

  it('offers no cancel to an account that cannot approve', async () => {
    const api = fake({ lookup: vi.fn(async () => ({ entries: [CHARGE, PAY, PLAN_PAY], requests: [] as AccountRequest[] })), plans: vi.fn(async () => [PLAN]) });
    await mount(api, { ...officer, approve: false });
    await openAccount();
    expect(button(/Cancel the plan/)).toBeUndefined();
  });

  it('downloads a receipt by the provider’s reference, and the month’s statement', async () => {
    await mount(fake(), officer);
    await openAccount();
    await click(button(/^Receipt$/));
    expect(downloads[0]).toMatchObject({ name: 'receipt-pi_3Nq8.txt' });
    expect(downloads[0].body).toContain('Payment provider reference pi_3Nq8');
    await act(async () => type(field(/Statement for/), '2026-09'));
    await click(button(/Download the statement/));
    expect(downloads[1].name).toBe('ST-S100-2026-09.csv');
    expect(downloads[1].body).toContain('Balance brought forward,,,,,5000.00');
  });

  it('shows no account to someone who only makes requests', async () => {
    await mount(fake(), aidOfficer);
    await openAccount();
    expect(host.textContent).toContain('it does not read the account itself');
    expect(host.textContent).not.toContain('Balance owed');
    expect(host.textContent).not.toContain('Waiting for a decision');
  });
});

describe('requesting', () => {
  it('refuses a card number and an over-refund before asking, warns of high value, and requests in cents', async () => {
    const api = fake();
    await mount(api, officer);
    await openAccount();
    const form = host.querySelector('form[aria-label="Make a request"]')!;
    type(field(/^Kind/, form) as unknown as HTMLSelectElement, 'refund');
    await settle();
    type(field(/The payment this answers/, form) as unknown as HTMLSelectElement, 'e2');
    type(field(/^Amount/, form), '2,000.01');
    type(field(/^Description/, form), 'card 4111 1111 1111 1111');
    type(field(/Payment provider reference/, form), 're_1');
    await settle();
    expect(form.textContent).toContain('That looks like a card number.');
    expect(form.textContent).toContain('At most $2,000.00 of that payment is left to return.');
    expect(form.textContent).toContain('this needs a high-value approver');
    expect((form.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);

    type(field(/^Amount/, form), '1,500');
    type(field(/^Description/, form), 'Partial refund');
    await settle();
    await click(form.querySelector('button[type="submit"]') as HTMLButtonElement);
    expect(api.request).toHaveBeenCalledWith('vu', expect.objectContaining({
      student_ref: 'S100', kind: 'refund', amount_cents: 150000, reference_entry_id: 'e2', provider_ref: 're_1', description: 'Partial refund',
    }));
  });
});

describe('deciding', () => {
  const pending = [
    req({ id: 'q1', kind: 'charge', amount_cents: 2500, requested_by: OFF1 }),
    req({ id: 'q2', kind: 'refund', amount_cents: 5000, requested_by: 'user-aid', reference_entry_id: 'e2', provider_ref: 're_9' }),
    req({ id: 'q3', kind: 'aid_credit', category: 'scholarship', amount_cents: 150000, requested_by: 'user-aid' }),
    req({ id: 'q4', kind: 'charge', amount_cents: 1000, requested_by: 'user-aid' }),
  ];

  it('says why the viewer cannot decide, before anyone presses', async () => {
    const api = fake({}, pending);
    await mount(api, { ...officer, viewerId: OFF2 });
    await settle();
    const q = host.querySelector('section[aria-label="Requests waiting for a decision"]')!;
    const items = [...q.querySelectorAll('li')];
    expect(items[1].textContent).toContain('You put the payment or entry this answers on the ledger');
    expect(items[2].textContent).toContain('This needs a high-value approver, which your account is not.');
    expect(items[0].querySelector('button')?.textContent).toMatch(/Approve/i);
    await act(async () => items[3].querySelector('button')!.click());
    expect(api.decide).toHaveBeenCalledWith('q4', 'approved', '');
  });

  it('offers nothing on the viewer’s own request', async () => {
    await mount(fake({}, pending), officer);
    await settle();
    const first = host.querySelector('section[aria-label="Requests waiting for a decision"] li')!;
    expect(first.textContent).toContain('You made this request, so someone else decides it.');
  });
});

describe('the monthly close', () => {
  const rec = (by: string, passed: boolean): Reconciliation => ({
    id: 'rc1', period: '2026-11', provider_total_cents: 200000, ledger_total_cents: 200000, ledger_count: 1, matched: 1, missing: 0, extra: 0, differing: 0,
    passed, recorded_by: by, recorded_at: '2026-11-01T09:00:00Z',
  });

  it('reads the settlement in the browser and records only its totals and fingerprint', async () => {
    const api = fake();
    await mount(api, admin);
    const input = host.querySelector('section[aria-label="Monthly close"] input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [new File(['reference,amount\npi_3Nq8,2000.00\n'], 'settlement.csv', { type: 'text/csv' })], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    expect(host.textContent).toContain('Provider $2,000.00, ledger $2,000.00: 1 matched');
    await click(button(/Record this reconciliation/));
    await act(async () => {
      await vi.waitFor(() => expect(api.reconcile).toHaveBeenCalledTimes(1));
    });
    const [, period, counts, sha] = api.reconcile.mock.calls[0];
    expect(period).toBe('2026-11');
    expect(counts).toEqual({ provider_total_cents: 200000, matched: 1, missing: 0, extra: 0, differing: 0 });
    expect(sha).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(api.reconcile.mock.calls)).not.toContain('pi_3Nq8');
  });

  it('lets someone other than the reconciler close the month, and says so to the reconciler', async () => {
    const mine = fake({}, [], [rec(ADM, true)]);
    await mount(mine, admin);
    await settle();
    expect(host.textContent).toContain('You recorded this reconciliation, so someone else closes the month.');
    expect(button(/^Close 2026-11/)).toBeUndefined();

    await act(async () => root.unmount());
    root = createRoot(host);
    const theirs = fake({}, [], [rec('user-other-admin', true)]);
    await mount(theirs, admin);
    await settle();
    await click(button(/^Close 2026-11/));
    expect(theirs.close).toHaveBeenCalledWith('vu', '2026-11', '');
  });

  it('says a closed month takes nothing new', async () => {
    await mount(fake(), admin);
    await act(async () => type(field(/^Month/), '2026-08'));
    await settle();
    expect(host.textContent).toContain('2026-08 is closed. Corrections go in an open month.');
  });
});

describe('payment plans waiting', () => {
  const asked = { ...PLAN, status: 'proposed' as const, decided_at: null };

  it('agrees to a plan with a note, or declines it', async () => {
    const api = fake({ plansWaiting: vi.fn(async () => [asked]) });
    await mount(api, officer);
    await settle();
    const queue = host.querySelector('section[aria-label="Payment plans waiting for a decision"]')!;
    expect(queue.textContent).toContain('S100 · $3,000.00 over 3 payments from 2026-10-15');
    expect(queue.textContent).toContain('2026-10-15 $300.00 · 2026-11-15 $1,350.00 · 2026-12-15 $1,350.00');
    await act(async () => type(field(/A note for the student/, queue), 'Agreed by phone'));
    await click([...queue.querySelectorAll('button')].find((b) => /Agree to the plan/.test(b.textContent ?? '')));
    expect(api.decidePlan).toHaveBeenCalledWith('pl1', 'approved', 'Agreed by phone');
    await click([...queue.querySelectorAll('button')].find((b) => /Decline/.test(b.textContent ?? '')));
    expect(api.decidePlan).toHaveBeenLastCalledWith('pl1', 'rejected', 'Agreed by phone');
  });

  it('offers nothing on a plan the viewer asked for', async () => {
    await mount(fake({ plansWaiting: vi.fn(async () => [{ ...asked, requested_by: OFF1 }]) }), officer);
    await settle();
    const queue = host.querySelector('section[aria-label="Payment plans waiting for a decision"]')!;
    expect(queue.textContent).toContain('You asked for this plan, so someone else decides it.');
    expect([...queue.querySelectorAll('button')].length).toBe(0);
  });

  it('shows the database’s refusal as it came', async () => {
    const api = fake({
      plansWaiting: vi.fn(async () => [asked]),
      decidePlan: vi.fn(async () => { throw new Error('The balance has changed since this plan was asked for; it is asked for again.'); }),
    });
    await mount(api, officer);
    await settle();
    await click(button(/Agree to the plan/));
    await settle();
    expect(host.textContent).toContain('The balance has changed since this plan was asked for; it is asked for again.');
  });
});
