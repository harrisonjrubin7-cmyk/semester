// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Plus on Today: offered to a signed-in student on Free while the catalog
 * prices it, the same way to everyone, gone for thirty days on "Not now",
 * never to someone who has Plus, and "See Plus" hands over to Account with
 * the upgrade open. Nothing is bought here.
 */

const mock = vi.hoisted(() => {
  const tables: Record<string, unknown[]> = { commercial_prices: [], subscriptions: [] };
  const from = (t: string) => {
    const q = { select: () => q, eq: () => q, then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: tables[t] ?? [], error: null }).then(ok) };
    return q;
  };
  return { tables, from: vi.fn(from), dispatch: vi.fn(), account: { id: 'u1' } as { id: string } | null };
});
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ from: mock.from }) }));
vi.mock('../state/store', () => ({ useStore: () => ({ account: mock.account, dispatch: mock.dispatch }) }));
const { PlusPrompt, SNOOZE_MS } = await import('./PlusPrompt');
const { OPEN_UPGRADE_KEY, takeOpenUpgrade } = await import('../lib/membership');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const MONTH = { id: 'p-m', plan_code: 'plus', amount_cents: 799, currency: 'usd', billing_interval: 'month' };
const YEAR = { id: 'p-y', plan_code: 'plus', amount_cents: 5900, currency: 'usd', billing_interval: 'year' };
const T = Date.UTC(2026, 8, 29, 12);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mock.tables.commercial_prices = [MONTH, YEAR];
  mock.tables.subscriptions = [];
  mock.account = { id: 'u1' };
  mock.dispatch.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = async (at = T) => {
  await act(async () => root.render(<PlusPrompt now={() => at} />));
};
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('names the catalog’s price to a signed-in student on Free', async () => {
  await render();
  expect(host.textContent).toContain('Semester Plus · $7.99 a month or $59 a year');
  expect(host.textContent).toContain('Free stays free');
});

it('hands over to Account with the upgrade open, and buys nothing here', async () => {
  await render();
  await act(async () => button(/See Plus/)!.click());
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'go', screen: 'account' });
  expect(sessionStorage.getItem(OPEN_UPGRADE_KEY)).toBe('1');
  expect(takeOpenUpgrade()).toBe(true);
  expect(takeOpenUpgrade()).toBe(false);
});

it('goes for thirty days on “Not now”, and comes back after', async () => {
  await render();
  await act(async () => button(/Not now/)!.click());
  expect(host.textContent).toBe('');
  act(() => root.unmount());
  root = createRoot(host);
  await render(T + SNOOZE_MS - 1);
  expect(host.textContent).toBe('');
  act(() => root.unmount());
  root = createRoot(host);
  await render(T + SNOOZE_MS + 1);
  expect(host.textContent).toContain('Semester Plus');
});

it('appears once the account arrives, when the first paint came before it', async () => {
  mock.account = null;
  await render();
  expect(host.textContent).toBe('');
  mock.account = { id: 'u1' };
  await render();
  expect(host.textContent).toContain('Semester Plus · $7.99 a month');
});

it('is never shown to someone who has Plus', async () => {
  mock.tables.subscriptions = [{ id: 's1', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T12:00:00Z' }];
  await render();
  expect(host.textContent).toBe('');
});

it('is not shown signed out, or with no Plus price to name', async () => {
  mock.account = null;
  await render();
  expect(host.textContent).toBe('');
  expect(mock.from).not.toHaveBeenCalledWith('subscriptions');
  mock.account = { id: 'u1' };
  mock.tables.commercial_prices = [];
  act(() => root.unmount());
  root = createRoot(host);
  await render();
  expect(host.textContent).toBe('');
});

it('uses only real, named buttons, none disabled', async () => {
  await render();
  for (const b of host.querySelectorAll('button')) {
    expect(b.hasAttribute('disabled')).toBe(false);
    expect((b.textContent ?? '').trim().length).toBeGreaterThan(0);
  }
});
