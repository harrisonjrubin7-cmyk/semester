// @vitest-environment jsdom
/**
 * The student's section on Bill, driven through an injected client. The
 * client and the download are the only fakes; the copy, the states and the
 * arithmetic are the shipping code.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const downloads: { name: string; body: string }[] = [];
vi.mock('../lib/deliver', () => ({
  download: (p: { name: string; body: string }) => downloads.push({ name: p.name, body: p.body }),
}));

import { loadSeed } from '../data/seed';
import { DEFAULT_SCHOOL_PLAN, DEFAULT_SETTINGS, type AccountEntry, type PaymentPlanRecord } from '../lib/finance/accounts';
import type { MyAccount, MyAccountApi } from '../lib/finance/mine';
import { FinanceCommandError, type FinanceCommandReceipt } from '../lib/finance/commands';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider } from '../state/store';
import { MyStudentAccount } from './MyStudentAccount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TODAY = '2026-10-01';
const e = (o: Partial<AccountEntry> & Pick<AccountEntry, 'id' | 'kind' | 'amount_cents' | 'effective_on'>): AccountEntry => ({
  tenant_id: 'vu', student_ref: 'S100', category: 'tuition', description: 'Fall tuition', reference_entry_id: null, provider_ref: '',
  period: o.effective_on.slice(0, 7), request_id: `r-${o.id}`, requested_by: null, approved_by: null, high_value: false,
  recorded_at: `${o.effective_on}T12:00:00Z`, ...o,
});
const ACCOUNT: MyAccount = {
  tenant_id: 'vu', school: 'Vanderbilt University', student_ref: 'S100', settings: DEFAULT_SETTINGS, plans: [], planRules: DEFAULT_SCHOOL_PLAN,
  entries: [
    e({ id: 'c1', kind: 'charge', amount_cents: 500000, effective_on: '2026-08-01' }),
    e({ id: 'p1', kind: 'payment', amount_cents: -200000, effective_on: '2026-09-05', provider_ref: 'pi_3Nq8', description: 'Online payment' }),
    e({ id: 'c2', kind: 'charge', amount_cents: 450000, effective_on: '2027-01-10', description: 'Spring tuition' }),
  ],
};
type Fake = MyAccountApi & { accounts: ReturnType<typeof vi.fn>; askForPlan: ReturnType<typeof vi.fn>; planReceipt: ReturnType<typeof vi.fn>; withdrawPlan: ReturnType<typeof vi.fn> };
const api = (accounts: MyAccount[] | Error, over: Partial<MyAccountApi> = {}): Fake => ({
  accounts: vi.fn(async () => {
    if (accounts instanceof Error) throw accounts;
    return accounts;
  }),
  askForPlan: vi.fn(async () => ({
    id: 'plan-receipt', commandKey: 'finance:plan.request:test', action: 'plan.request', status: 'accepted',
    resourceId: 'plan-new', state: 'proposed', version: 1, recordedAt: '2026-10-01T12:00:00Z',
  } satisfies FinanceCommandReceipt)),
  planReceipt: vi.fn(async () => undefined),
  withdrawPlan: vi.fn(async () => undefined),
  ...over,
}) as Fake;
const PLAN: PaymentPlanRecord = {
  id: 'pl', tenant_id: 'vu', student_ref: 'S100', installments: 3, first_due: '2026-10-01', balance_cents: 300000, status: 'approved',
  requested_by: 'me', requested_at: '2026-09-20T10:00:00Z', decided_at: '2026-09-21T10:00:00Z', decision_note: '', cancelled_at: null, cancel_note: '',
  schedule: [{ due_on: '2026-09-25', cents: 30000 }, { due_on: '2026-10-25', cents: 135000 }, { due_on: '2026-11-25', cents: 135000 }],
};

let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, term: '2026FA', courses: [] }));
  downloads.length = 0;
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
});

const render = async (node: React.ReactNode) => {
  await act(async () => root.render(<StoreProvider>{node}</StoreProvider>));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const text = () => host.textContent ?? '';
const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === name || b.getAttribute('aria-label') === name);

describe('MyStudentAccount', () => {
  it('is nothing at all when off, and asks nothing', async () => {
    const a = api([ACCOUNT]);
    await render(<MyStudentAccount enabled={false} payUrl="" accountId="me" api={a} today={TODAY} />);
    expect(text()).toBe('');
    expect(a.accounts).not.toHaveBeenCalled();
  });

  it('asks a signed-out student to sign in, and reads nothing', async () => {
    const a = api([ACCOUNT]);
    await render(<MyStudentAccount enabled payUrl="" accountId={null} api={a} today={TODAY} />);
    expect(text()).toMatch(/Sign in to see the account your school keeps for you/);
    expect(a.accounts).not.toHaveBeenCalled();
  });

  it('says who links the account when the school has not', async () => {
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([])} today={TODAY} />);
    expect(text()).toMatch(/Your school has not linked your account/);
    expect(text()).toMatch(/Your registrar links your student record/);
  });

  it('shows the database’s refusal as it came', async () => {
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api(new Error('Your account cannot do that at this school.'))} today={TODAY} />);
    expect(host.querySelector('[role="alert"]')?.textContent ?? text()).toMatch(/Your account cannot do that at this school\./);
  });

  it('shows what is owed today, the hold, the entries, and what comes later apart', async () => {
    const a = api([ACCOUNT]);
    await render(<MyStudentAccount enabled payUrl="https://pay.example.edu" accountId="me" api={a} today={TODAY} />);
    expect(a.accounts).toHaveBeenCalledWith('me');
    expect(text()).toMatch(/You owe your school this today\./);
    expect(host.querySelector('[aria-label="Balance today"]')?.textContent).toBe('$3,000.00');
    // $5,000 charged 1 Aug, $2,000 paid: $3,000 is 61 days old on 1 Oct.
    expect(text()).toMatch(/Action required before you can register — Student Accounts/);
    expect(host.querySelector('[aria-label="What you owe, by age"]')?.textContent).toMatch(/\$3,000\.00/);
    expect(text()).toMatch(/\$4,500\.00 more is on the account for later dates, and is not owed yet\./);
    const posted = host.querySelector('[aria-label="Posted to your account"]')!;
    expect(posted.textContent).toMatch(/Charge: Fall tuition/);
    expect(posted.textContent).not.toMatch(/Spring tuition/);
    expect(host.querySelector('[aria-label="On your account for later dates"]')?.textContent).toMatch(/Spring tuition/);
    const pay = host.querySelector('a[href="https://pay.example.edu"]');
    expect(pay?.getAttribute('target')).toBe('_blank');
    expect(pay?.getAttribute('rel')).toMatch(/noopener/);
    expect(text()).toMatch(/Vanderbilt University/);
    expect(text()).toMatch(/nobody can change it from this screen/);
    // Nothing here pays: the only field to type into is the plan's first date.
    expect([...host.querySelectorAll('input, textarea')].map((i) => i.getAttribute('type'))).toEqual(['date']);
  });

  it('gives a receipt for a payment and the statement for a month', async () => {
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([ACCOUNT])} today={TODAY} />);
    await act(async () => button('Receipt for the payment of 2026-09-05')!.click());
    expect(downloads[0].name).toBe('receipt-pi_3Nq8.txt');
    expect(downloads[0].body).toMatch(/Payment provider reference pi_3Nq8/);
    const select = [...host.querySelectorAll('select')].find((x) => x.closest('label')?.textContent?.startsWith('Statement for'))!;
    expect([...select.options].map((o) => o.value)).toEqual(['2027-01', '2026-09', '2026-08']);
    expect(select.value).toBe('2026-09');
    await act(async () => {
      select.value = '2026-09';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => button('Download statement')!.click());
    expect(downloads[1].name).toBe('ST-S100-2026-09.csv');
    expect(downloads[1].body).toMatch(/Balance brought forward,,,,,5000\.00/);
    expect(downloads[1].body).toMatch(/Balance carried forward,,,,,3000\.00/);
  });

  it('offers no payment link when nothing is owed', async () => {
    const settled = { ...ACCOUNT, entries: [ACCOUNT.entries[0], e({ id: 'p2', kind: 'payment', amount_cents: -500000, effective_on: '2026-08-02', provider_ref: 'pi_x' })] };
    await render(<MyStudentAccount enabled payUrl="https://pay.example.edu" accountId="me" api={api([settled])} today={TODAY} />);
    expect(text()).toMatch(/Your account is settled\./);
    expect(text()).toMatch(/No financial hold/);
    expect(host.querySelector('a[href="https://pay.example.edu"]')).toBeNull();
  });

  it('names each school when more than one has linked the account', async () => {
    const other = { ...ACCOUNT, tenant_id: 'belmont', school: 'Belmont University', student_ref: 'B7', entries: [] };
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([ACCOUNT, other])} today={TODAY} />);
    expect(host.querySelector('[aria-label="From Vanderbilt University"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="From Belmont University"]')?.textContent).toMatch(/Nothing has been posted to your account yet\./);
  });

  it('shows the plan it would ask for, by the school’s rules, and asks for exactly that', async () => {
    const a = api([{ ...ACCOUNT, planRules: { ...DEFAULT_SCHOOL_PLAN, max_installments: 4 } }]);
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={a} today={TODAY} />);
    const region = host.querySelector('[aria-label="Payment plan"]')!;
    expect(region.textContent).toMatch(/Spread what you owe today, \$3,000\.00, over monthly payments/);
    const count = region.querySelector('select')!;
    expect([...count.options].map((o) => o.value)).toEqual(['2', '3', '4']);
    const date = region.querySelector('input[type="date"]') as HTMLInputElement;
    expect([date.min, date.max, date.value]).toEqual(['2026-10-01', '2026-10-31', '2026-10-01']);
    // Four payments of $3,000: $300 now, then $900 a month.
    const preview = host.querySelector('[aria-label="The plan you would ask for"]')!;
    expect([...preview.querySelectorAll('tbody tr')].map((r) => r.textContent)).toEqual([
      '2026-10-01$300.00', '2026-11-01$900.00', '2026-12-01$900.00', '2027-01-01$900.00',
    ]);
    await act(async () => {
      count.value = '3';
      count.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => button('Ask Student Accounts for this plan')!.click());
    expect(a.askForPlan).toHaveBeenCalledWith('vu', 'S100', 3, '2026-10-01', expect.stringMatching(/^finance:plan\.request:/));
    // And the account is read again, so the plan asked for is what shows.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(a.accounts).toHaveBeenCalledTimes(2);
  });

  it('says the database’s refusal when the plan cannot be asked for', async () => {
    const a = api([ACCOUNT], { askForPlan: vi.fn(async () => { throw new Error('The first payment is due between today and 30 days from now.'); }) });
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={a} today={TODAY} />);
    await act(async () => button('Ask Student Accounts for this plan')!.click());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(text()).toMatch(/The first payment is due between today and 30 days from now\./);
  });

  it('keeps an unknown plan command across refresh and only offers receipt recovery', async () => {
    const askForPlan = vi.fn(async () => { throw new FinanceCommandError('unknown', 'No answer came back.'); });
    const recovered = {
      id: 'plan-recovered', commandKey: 'finance:plan.request:test', action: 'plan.request', status: 'accepted',
      resourceId: 'plan-new', state: 'proposed', version: 1, recordedAt: '2026-10-01T12:00:00Z',
    } satisfies FinanceCommandReceipt;
    const firstApi = api([ACCOUNT], { askForPlan });
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={firstApi} today={TODAY} />);
    await act(async () => button('Ask Student Accounts for this plan')!.click());
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect((button('Ask Student Accounts for this plan') as HTMLButtonElement).disabled).toBe(true);

    await act(async () => root.unmount());
    root = createRoot(host);
    const committedPlan = { ...PLAN, status: 'proposed' as const, decided_at: null };
    const secondApi = api([{ ...ACCOUNT, plans: [committedPlan] }], { planReceipt: vi.fn(async () => recovered) });
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={secondApi} today={TODAY} />);
    expect(text()).toMatch(/a previous plan request has no confirmed response/);
    expect(button('Ask Student Accounts for this plan')).toBeUndefined();
    await act(async () => button('Check for accepted receipt')!.click());
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(secondApi.planReceipt).toHaveBeenCalledWith('vu', 'S100', expect.stringMatching(/^finance:plan\.request:/));
    expect(text()).toMatch(/Accepted — recovered receipt plan-recovered/);
    expect(askForPlan).toHaveBeenCalledTimes(1);
  });

  it('offers nothing to ask for where the school has no plans, or nothing is owed', async () => {
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([{ ...ACCOUNT, planRules: { ...DEFAULT_SCHOOL_PLAN, offered: false } }])} today={TODAY} />);
    expect(text()).toMatch(/Your school does not offer payment plans here/);
    expect(button('Ask Student Accounts for this plan')).toBeUndefined();
  });

  it('shows a plan asked for, and lets only its asker withdraw it', async () => {
    const asked = { ...PLAN, status: 'proposed' as const, decided_at: null };
    const a = api([{ ...ACCOUNT, plans: [asked] }]);
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={a} today={TODAY} />);
    expect(text()).toMatch(/You asked for this plan\. Student Accounts decides it/);
    expect(host.querySelector('[aria-label="The plan you asked for"]')).not.toBeNull();
    expect(button('Ask Student Accounts for this plan')).toBeUndefined();
    await act(async () => button('Withdraw this request')!.click());
    expect(a.withdrawPlan).toHaveBeenCalledWith('pl');
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([{ ...ACCOUNT, plans: [{ ...asked, requested_by: 'officer' }] }])} today={TODAY} />);
    expect(button('Withdraw this request')).toBeUndefined();
  });

  it('shows an agreed plan paid, late or coming, and the hold it lifts', async () => {
    // Asked 20 Sep; $1,000 paid since covers the first $300, and not the second $1,350.
    const entries = [...ACCOUNT.entries, e({ id: 'p2', kind: 'payment', amount_cents: -100000, effective_on: '2026-09-25', provider_ref: 'pi_x', description: 'Online payment' })];
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([{ ...ACCOUNT, entries, plans: [PLAN] }])} today={TODAY} />);
    expect(text()).toMatch(/Your plan is on track\. Next: \$1,350\.00 on 2026-10-25\./);
    expect(text()).toMatch(/No financial hold — a payment plan is being kept/);
    const rows = [...host.querySelectorAll('[aria-label="Your plan"] tbody tr')].map((r) => r.textContent);
    expect(rows).toEqual(['2026-09-25$300.00Paid', '2026-10-25$1,350.00Coming', '2026-11-25$1,350.00Coming']);
    await act(async () => root.unmount());
    root = createRoot(host);
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([{ ...ACCOUNT, entries, plans: [PLAN] }])} today="2026-10-30" />);
    expect(text()).toMatch(/Your plan is \$650\.00 behind\./);
    expect(text()).toMatch(/Action required before you can register/);
    expect([...host.querySelectorAll('[aria-label="Your plan"] tbody tr')].map((r) => r.textContent)[1]).toBe('2026-10-25$1,350.00Late');
  });

  it('says why the last plan ended before offering another', async () => {
    const ended = { ...PLAN, status: 'cancelled' as const, cancelled_at: '2026-09-30T10:00:00Z', cancel_note: 'Two payments missed' };
    await render(<MyStudentAccount enabled payUrl="" accountId="me" api={api([{ ...ACCOUNT, plans: [ended] }])} today={TODAY} />);
    expect(text()).toMatch(/Your last plan was cancelled: Two payments missed/);
    expect(button('Ask Student Accounts for this plan')).not.toBeUndefined();
  });
});
