// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The panel keeps new Plus acquisition held while preserving subscription,
 * cancellation and billing-history access for existing customers.
 */

const mock = vi.hoisted(() => {
  const tables: Record<string, unknown[]> = { commercial_prices: [], subscriptions: [] };
  // A table named here answers with an error, as PostgREST does, not a rejection.
  const failing = new Set<string>();
  // A table named here rejects outright: the network gone mid-request.
  const throwing = new Set<string>();
  const eqs: [string, string, unknown][] = [];
  const from = (t: string) => {
    const q = { select: () => q, eq: (k: string, v: unknown) => (eqs.push([t, k, v]), q), then: (ok: (r: unknown) => unknown, no?: (e: unknown) => unknown) =>
        (throwing.has(t) ? Promise.reject(new Error('fetch failed')) : Promise.resolve(failing.has(t) ? { data: null, error: { message: 'network' } } : { data: tables[t] ?? [], error: null })).then(ok, no) };
    return q;
  };
  return { tables, failing, throwing, eqs, rpc: vi.fn(), from: vi.fn(from), start: vi.fn(), cancel: vi.fn(), portal: vi.fn(), account: { id: 'u1' } as { id: string } | null };
});
vi.mock('../lib/cloud', () => ({
  cloudConfigured: true,
  cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }),
  currentSession: () => Promise.resolve({ access_token: 'tok' }),
}));
vi.mock('../state/store', () => ({ useStore: () => ({ account: mock.account, dispatch: () => {} }) }));
vi.mock('../lib/membership', async (real) => ({ ...(await real<typeof import('../lib/membership')>()), startCheckout: mock.start, cancelMembership: mock.cancel, openBillingPortal: mock.portal }));
const { MembershipPanel } = await import('./MembershipPanel');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const MONTH = { id: '6d5749ba-47da-4545-86d6-bb89461adac6', plan_code: 'plus', amount_cents: 799, currency: 'usd', billing_interval: 'month' };
const YEAR = { id: '64c5f28d-84dd-452d-b87a-257d6dc9b080', plan_code: 'plus', amount_cents: 5900, currency: 'usd', billing_interval: 'year' };

beforeEach(() => {
  mock.tables.commercial_prices = [MONTH, YEAR];
  mock.tables.subscriptions = [];
  mock.failing.clear();
  mock.throwing.clear();
  mock.eqs.length = 0;
  mock.account = { id: 'u1' };
  mock.rpc.mockReset();
  mock.start.mockReset();
  mock.cancel.mockReset();
  mock.portal.mockReset();
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

it('ignores stale catalog prices and exposes no new checkout', async () => {
  await render();
  expect(host.textContent).toContain('Plus and Pro are not on sale');
  expect(host.textContent).toContain('$7.99 a month or $59 a year (planned)');
  expect(button(/Continue to secure checkout/)).toBeUndefined();
  expect(mock.start).not.toHaveBeenCalled();
  expect(mock.eqs.some(([table]) => table === 'commercial_prices')).toBe(false);
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

it('directs a missing-tax-location issue to the address portal without calling it a card failure', async () => {
  mock.tables.subscriptions = [{
    id: 's1', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T12:00:00Z',
    cancel_at_period_end: false, billing_issue: 'address_required',
  }];
  await render();
  expect(host.textContent).toContain('Stripe needs your current billing address to calculate tax');
  expect(host.textContent).toContain('your card has not failed');
  expect(host.textContent).not.toContain('Your last payment did not go through');
  expect(button(/Receipts, invoices and payment method/)).toBeDefined();
});

it('opens hosted receipts and invoices for a current or former subscriber', async () => {
  const go = vi.fn();
  vi.stubGlobal('location', { ...window.location, search: '', assign: go });
  try {
    mock.tables.subscriptions = [{ id: 's0', plan_code: 'plus', status: 'ended', current_period_end: '2026-08-29T12:00:00Z' }];
    mock.portal.mockResolvedValue({ kind: 'redirect', url: 'https://billing.stripe.com/p/session/live_1' });
    await render();
    await act(async () => button(/Receipts, invoices and payment method/)!.click());
    expect(mock.portal).toHaveBeenCalledWith('tok');
    expect(go).toHaveBeenCalledWith('https://billing.stripe.com/p/session/live_1');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('uses only real, named buttons, none disabled', async () => {
  await render();
  await act(async () => button(/^View planned Plus$/)!.click());
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

it('consumes a stale upgrade handoff without exposing checkout', async () => {
  sessionStorage.setItem('semester.open-upgrade', '1');
  const scrolled = vi.fn();
  Element.prototype.scrollIntoView = scrolled;
  await render();
  expect(scrolled).toHaveBeenCalled();
  expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('membership-title');
  expect(button(/^View planned Plus$/)!.getAttribute('aria-expanded')).toBe('true');
  expect(button(/Continue to secure checkout/)).toBeUndefined();
  expect(host.textContent).toContain('Nothing has been charged');
  expect(sessionStorage.getItem('semester.open-upgrade')).toBeNull();
});

it('offers Plus to nobody it could not check: a failed subscription read is not "Free"', async () => {
  // The catalog answers; the person's own subscription read fails. They may
  // be paying already, so the panel neither sells Plus nor says Free.
  mock.failing.add('subscriptions');
  await render();
  expect(host.textContent).toContain('could not check your membership');
  expect(host.textContent).not.toContain('You are on Semester Free');
  expect(host.textContent).not.toContain('Plus is $7.99 a month');
  expect(button(/^Upgrade$/)).toBeUndefined();
  expect(button(/Cancel membership/)).toBeUndefined();
  expect(host.textContent).not.toContain('No payments. Semester has never charged you');
});

it('shows no price to a signed-in person until their subscription has been read', async () => {
  // A subscriber must not see Free and an Upgrade button while the read is
  // still on its way.
  let release: () => void = () => {};
  const held = new Promise<void>((r) => (release = r));
  const from = mock.from.getMockImplementation()! as (t: string) => unknown;
  mock.from.mockImplementation((t: string) => {
    const q = from(t) as { then: (ok: (r: unknown) => unknown) => Promise<unknown> };
    if (t !== 'subscriptions') return q as never;
    // Every step of the chain returns the held query; the answer waits for release.
    const w: Record<string, unknown> = {};
    w.select = () => w;
    w.eq = () => w;
    w.then = (ok: (r: unknown) => unknown) => held.then(() => q.then(ok));
    return w as never;
  });
  mock.tables.subscriptions = [{ id: 's1', plan_code: 'plus', status: 'active', current_period_end: '2026-11-01T00:00:00Z', cancel_at_period_end: false, billing_accounts: { kind: 'individual', user_id: 'u1' } }];
  try {
    await render();
    expect(button(/^Upgrade$/)).toBeUndefined();
    expect(host.textContent).not.toContain('You are on Semester Free');
    expect(host.textContent).not.toContain('Plus is $7.99 a month');
    expect(host.textContent).toContain('Checking your plan');
    await act(async () => {
      release();
      await held;
    });
    expect(host.textContent).toContain('You are on Semester Plus');
  } finally {
    mock.from.mockImplementation(from as never);
  }
});

it('does not read the sale catalog while acquisition is held', async () => {
  mock.throwing.add('commercial_prices');
  await render();
  expect(host.textContent).not.toContain('Checking your plan');
  expect(host.textContent).toContain('Plus and Pro are not on sale');
  expect(button(/^View planned Plus$/)).toBeDefined();
  expect(mock.eqs.some(([table]) => table === 'commercial_prices')).toBe(false);
});
