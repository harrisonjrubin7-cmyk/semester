// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The panel with an account service and a catalog: Plus bought through a
 * consent the person ticks, at the catalog's price, and cancelled from the
 * same place. The server's side is `lib/billing/checkout.test.ts`.
 */

const mock = vi.hoisted(() => {
  const tables: Record<string, unknown[]> = { commercial_prices: [], subscriptions: [] };
  const eqs: [string, string, unknown][] = [];
  const from = (t: string) => {
    const q = { select: () => q, eq: (k: string, v: unknown) => (eqs.push([t, k, v]), q), then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: tables[t] ?? [], error: null }).then(ok) };
    return q;
  };
  return { tables, eqs, rpc: vi.fn(), from: vi.fn(from), start: vi.fn(), cancel: vi.fn(), account: { id: 'u1' } as { id: string } | null };
});
vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }),
  currentSession: () => Promise.resolve({ access_token: 'tok' }),
}));
vi.mock('../state/store', () => ({ useStore: () => ({ account: mock.account, dispatch: () => {} }) }));
vi.mock('../lib/membership', async (real) => ({ ...(await real<typeof import('../lib/membership')>()), startCheckout: mock.start, cancelMembership: mock.cancel }));
const { MembershipPanel } = await import('./MembershipPanel');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const MONTH = { id: '6d5749ba-47da-4545-86d6-bb89461adac6', plan_code: 'plus', amount_cents: 799, currency: 'usd', billing_interval: 'month' };
const YEAR = { id: '64c5f28d-84dd-452d-b87a-257d6dc9b080', plan_code: 'plus', amount_cents: 5900, currency: 'usd', billing_interval: 'year' };

beforeEach(() => {
  mock.tables.commercial_prices = [MONTH, YEAR];
  mock.tables.subscriptions = [];
  mock.eqs.length = 0;
  mock.account = { id: 'u1' };
  mock.rpc.mockReset();
  mock.start.mockReset();
  mock.cancel.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const render = async () => {
  await act(async () => root.render(<MembershipPanel />));
};

it('names the catalog’s price, not the planned one', async () => {
  await render();
  expect(host.textContent).toContain('Plus is $7.99 a month or $59 a year.');
  expect(host.textContent).not.toContain('not on sale yet');
});

it('asks for consent before anything is sent, then follows Stripe’s page', async () => {
  const go = vi.fn();
  vi.stubGlobal('location', { ...window.location, search: '', assign: go });
  try {
    mock.start.mockResolvedValue({ kind: 'redirect', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    await render();
    await act(async () => button(/^Upgrade$/)!.click());
    await act(async () => button(/Continue to secure checkout/)!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/Tick the box/);
    expect(mock.start).not.toHaveBeenCalled();

    const box = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.parentElement?.textContent).toContain('$7.99 a month');
    await act(async () => box.click());
    await act(async () => button(/Continue to secure checkout/)!.click());
    expect(mock.start).toHaveBeenCalledWith('tok', MONTH.id);
    expect(go).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_1');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('re-asks for consent when the price changes', async () => {
  await render();
  await act(async () => button(/^Upgrade$/)!.click());
  const box = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
  await act(async () => box.click());
  const yearly = [...host.querySelectorAll('input[type="radio"]')][1] as HTMLInputElement;
  await act(async () => yearly.click());
  expect((host.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
  expect(host.textContent).toContain('$59 a year for Semester Plus');
});

it('says the function’s refusal in its own words', async () => {
  mock.start.mockResolvedValue({ kind: 'refused', said: 'Checkout is not available yet.' });
  await render();
  await act(async () => button(/^Upgrade$/)!.click());
  await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  await act(async () => button(/Continue to secure checkout/)!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Checkout is not available yet.');
});

it('asks a signed-out visitor to sign in rather than showing a checkout', async () => {
  mock.account = null;
  await render();
  await act(async () => button(/^Upgrade$/)!.click());
  expect(host.textContent).toContain('Sign in above to upgrade');
  expect(button(/Continue to secure checkout/)).toBeUndefined();
});

it('shows Plus when paid, and cancels it from the same place', async () => {
  mock.tables.subscriptions = [{ id: 's1', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T12:00:00Z', cancel_at_period_end: false }];
  mock.cancel.mockResolvedValue({ kind: 'cancelled', endsAt: '2026-10-29T12:00:00Z' });
  await render();
  expect(host.textContent).toContain('You are on Semester Plus');
  expect(button(/^Upgrade$/)).toBeUndefined();
  await act(async () => button(/Cancel membership/)!.click());
  await act(async () => button(/^Cancel Plus$/)!.click());
  // Through billing-cancel, which tells Stripe; never the bare RPC, which does not.
  expect(mock.cancel).toHaveBeenCalledWith('tok', 's1');
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(host.textContent).toMatch(/Cancelled\. You keep Plus until .*you will not be charged again/);
  expect(button(/Cancel membership/)).toBeUndefined();
});

it('uses only real, named buttons, none disabled', async () => {
  await render();
  await act(async () => button(/^Upgrade$/)!.click());
  for (const b of host.querySelectorAll('button')) {
    expect(b.hasAttribute('disabled'), b.textContent ?? '').toBe(false);
    expect((b.textContent ?? '').trim().length).toBeGreaterThan(0);
  }
});

it('reads only the person’s own individual billing account, never one they can see as a billing contact', async () => {
  await render();
  const subs = mock.eqs.filter(([t]) => t === 'subscriptions').map(([, k, v]) => [k, v]);
  expect(subs).toContainEqual(['billing_accounts.user_id', 'u1']);
  expect(subs).toContainEqual(['billing_accounts.kind', 'individual']);
});

it('keeps looking after Stripe’s return until the webhook has written the plan', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('location', { ...window.location, search: '?checkout=success' });
  try {
    await render();
    expect(host.textContent).toContain('You are on Semester Free');
    mock.tables.subscriptions = [{ id: 's1', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T12:00:00Z', cancel_at_period_end: false }];
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(host.textContent).toContain('You are on Semester Plus');
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});

it('does not tell a former subscriber they were never charged', async () => {
  mock.tables.subscriptions = [{ id: 's0', plan_code: 'plus', status: 'ended', current_period_end: '2026-08-29T12:00:00Z' }];
  await render();
  expect(host.textContent).toContain('You are on Semester Free');
  expect(host.textContent).not.toContain('Semester has never charged you');
  expect(host.textContent).toContain('emails a receipt');
});

it('keeps Plus on screen, and says why, when the cancellation is refused', async () => {
  mock.tables.subscriptions = [{ id: 's1', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T12:00:00Z', cancel_at_period_end: false }];
  mock.cancel.mockResolvedValue({ kind: 'refused', said: 'The payment provider did not answer, so nothing changed. You are still subscribed; try again.' });
  await render();
  await act(async () => button(/Cancel membership/)!.click());
  await act(async () => button(/^Cancel Plus$/)!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/still subscribed/);
  expect(button(/^Cancel Plus$/)).toBeDefined();
});

it('opens with the upgrade showing when Today’s “See Plus” brought the person here', async () => {
  sessionStorage.setItem('semester.open-upgrade', '1');
  await render();
  expect(button(/^Upgrade$/)!.getAttribute('aria-expanded')).toBe('true');
  expect(button(/Continue to secure checkout/)).toBeDefined();
  expect(sessionStorage.getItem('semester.open-upgrade')).toBeNull();
});
