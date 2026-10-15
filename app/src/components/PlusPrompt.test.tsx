// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The promotional Plus card stays absent while individual paid acquisition is
 * held, even if a stale catalog row remains available.
 */

const mock = vi.hoisted(() => {
  const tables: Record<string, unknown[]> = { commercial_prices: [], subscriptions: [] };
  const failing = new Set<string>();
  const from = (t: string) => {
    const answer = () => (failing.has(t) ? { data: null, error: { message: 'down' } } : { data: tables[t] ?? [], error: null });
    const q = { select: () => q, eq: () => q, then: (ok: (r: unknown) => unknown) => Promise.resolve(answer()).then(ok) };
    return q;
  };
  return { tables, failing, from: vi.fn(from), dispatch: vi.fn(), account: { id: 'u1' } as { id: string } | null };
});
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ from: mock.from }) }));
vi.mock('../state/store', () => ({ useStore: () => ({ account: mock.account, dispatch: mock.dispatch }) }));
const { PlusPrompt } = await import('./PlusPrompt');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const MONTH = { id: 'p-m', plan_code: 'plus', amount_cents: 799, currency: 'usd', billing_interval: 'month' };
const YEAR = { id: 'p-y', plan_code: 'plus', amount_cents: 5900, currency: 'usd', billing_interval: 'year' };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mock.tables.commercial_prices = [MONTH, YEAR];
  mock.tables.subscriptions = [];
  mock.failing.clear();
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

const render = async () => {
  await act(async () => root.render(<PlusPrompt />));
};

it('does not promote Plus while individual paid acquisition is held', async () => {
  await render();
  expect(host.textContent).toBe('');
  expect(mock.from).not.toHaveBeenCalled();
  expect(mock.dispatch).not.toHaveBeenCalled();
});

it('is never shown to someone who has Plus', async () => {
  mock.tables.subscriptions = [{ id: 's1', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T12:00:00Z' }];
  await render();
  expect(host.textContent).toBe('');
});

it('stays away when it cannot tell whether they already pay', async () => {
  mock.failing.add('subscriptions');
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

it('renders no acquisition controls', async () => {
  await render();
  expect(host.querySelectorAll('button')).toHaveLength(0);
});
