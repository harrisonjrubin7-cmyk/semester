// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHARE_CONSENT_TEXT } from '../lib/dining/sharing';

/**
 * The dining screen, driven against a replaced account service.
 *
 * Under test: that it stops at one sentence when `module.dining` is off; that
 * the counter appears only for `dining:operate` and never says how an order
 * was paid beyond "a swipe"; that every balance carries its source and age,
 * and none is called the card office's while the connection is not live; and
 * that an order which failed in flight is retried with the same idempotency
 * key, so the database answers with the first order instead of charging twice.
 */

const mock = vi.hoisted(() => ({
  open: vi.fn(),
  balances: vi.fn(),
  plans: vi.fn(),
  places: vi.fn(),
  orders: vi.fn(),
  place: vi.fn(),
  cancel: vi.fn(),
  donate: vi.fn(),
  queue: vi.fn(),
  pool: vi.fn(),
  advance: vi.fn(),
  setOrdering: vi.fn(),
  say: vi.fn(),
  dispatch: vi.fn(),
}));

// 12:00 on a Tuesday in Chicago.
const NOW = new Date('2026-09-29T17:00:00Z');

vi.mock('../state/store', () => ({
  useStore: () => ({ say: mock.say, dispatch: mock.dispatch, state: {} }),
  useNow: () => NOW,
}));
vi.mock('../lib/dining/client', async (orig) => ({
  ...(await orig<object>()),
  openDining: mock.open,
  loadBalances: mock.balances,
  loadMyPlans: mock.plans,
  loadPlaces: mock.places,
  loadMyOrders: mock.orders,
  placeOrder: mock.place,
  cancelOrder: mock.cancel,
  donateSwipes: mock.donate,
  loadQueue: mock.queue,
  loadPoolSummary: mock.pool,
  advanceOrder: mock.advance,
  setOrdering: mock.setOrdering,
}));

import { Dining } from './Dining';
import { DiningRefusal } from '../lib/dining/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const ready = (patch: Record<string, unknown> = {}) => ({
  kind: 'ready',
  context: { userId: 'stu-1', school: 'vu', moduleState: 'production', on: true, reason: 'on', capabilities: [], ...patch },
});

const READ = NOW.getTime() - 5 * 60_000;
const BALANCES = { planTerm: '2026FA', swipesLeft: 9, diningCents: 12_550, campusCents: 2_000, partnerStatus: 'live', partnerLastSuccess: READ };
const PLANS = [{ term: '2026FA', swipeKind: 'weekly', perWeek: 14, perTerm: null, source: 'institution_verified', sourceAt: READ }];
const PLACES = {
  locations: [
    {
      id: 'loc-1', tenantId: 'vu', name: 'Rand Dining', timeZone: 'America/Chicago', capacity: 20, orderingEnabled: true,
      hours: [2].map((weekday) => ({ weekday, opensAt: 7 * 60, closesAt: 20 * 60 })), source: 'institution_verified', sourceAt: READ,
    },
  ],
  menu: [
    { id: 'm-1', locationId: 'loc-1', servedOn: '2026-09-29', meal: 'lunch', name: 'Grain bowl', priceCents: 950, swipeEligible: true, available: true, source: 'institution_verified', sourceAt: READ },
    { id: 'm-2', locationId: 'loc-1', servedOn: '2026-09-29', meal: 'lunch', name: 'Cold brew', priceCents: 450, swipeEligible: false, available: true, source: 'institution_verified', sourceAt: READ },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mock.open.mockResolvedValue(ready());
  mock.balances.mockResolvedValue(BALANCES);
  mock.plans.mockResolvedValue(PLANS);
  mock.places.mockResolvedValue(PLACES);
  mock.orders.mockResolvedValue([]);
  mock.place.mockResolvedValue('order-1');
  mock.donate.mockResolvedValue(1);
  mock.queue.mockResolvedValue([
    { id: 'q-1', locationId: 'loc-1', status: 'placed', paidWith: 'swipe', items: ['m-1'], placedAt: NOW.getTime() - 60_000 },
  ]);
  mock.pool.mockResolvedValue({ donated: 7, drawn: 3, available: 4 });
  mock.advance.mockResolvedValue('accepted');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function flush() {
  for (let i = 0; i < 4; i++) await act(async () => {});
}
async function render() {
  await act(async () => root.render(<Dining />));
  await flush();
}
const buttons = () => [...host.querySelectorAll('button')];
function must(text: string): HTMLButtonElement {
  const b = buttons().find((x) => x.textContent?.trim() === text);
  if (!b) throw new Error(`No button “${text}”; have: ${buttons().map((x) => JSON.stringify(x.textContent?.trim())).join(', ')}`);
  return b;
}
async function press(text: string) {
  await act(async () => must(text).click());
  await flush();
}
async function toggle(label: string) {
  const sw = [...host.querySelectorAll('[role="switch"]')].find((s) => s.textContent?.startsWith(label)) as HTMLButtonElement | undefined;
  if (!sw) throw new Error(`No switch “${label}”`);
  await act(async () => sw.click());
  await flush();
}

describe('the gate', () => {
  it('says in one sentence that the school has not turned dining on, and reads nothing else', async () => {
    mock.open.mockResolvedValue(ready({ moduleState: 'off', on: false, reason: 'off' }));
    await render();
    expect(host.textContent).toContain('Your school has not turned on dining in Semester.');
    expect(host.textContent).toContain('Open Meal plan');
    expect(mock.balances).not.toHaveBeenCalled();
    expect(mock.places).not.toHaveBeenCalled();
  });

  it('shows the permission state when nobody is signed in', async () => {
    mock.open.mockResolvedValue({ kind: 'signed_out' });
    await render();
    const said = host.querySelector('[role="status"]')?.textContent ?? '';
    expect(said).toContain('private to you');
    expect(said).toContain('Sign in under You → Account');
    expect(mock.balances).not.toHaveBeenCalled();
  });

  it('offers the counter only to dining:operate, and a student never reads the queue', async () => {
    await render();
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    expect(mock.queue).not.toHaveBeenCalled();
  });
});

describe('balances, from a fixture', () => {
  it('labels every balance with its source and age over a live connection', async () => {
    await render();
    const text = host.textContent ?? '';
    expect(text).toContain('Swipes left this plan week');
    expect(text).toContain('9 swipes');
    expect(text).toContain('$125.50');
    expect(text).toContain('$20.00');
    const badges = [...host.querySelectorAll('[data-source]')].map((b) => b.getAttribute('data-source'));
    // Three balances, the plan, the location's hours, the menu.
    expect(badges.filter((b) => b === 'institution_verified').length).toBe(6);
    expect(text).toContain('Updated 5 minutes ago');
    expect(text).not.toContain('card office is not connected');
  });

  it('calls nothing the card office’s figure while the connection is not live', async () => {
    mock.balances.mockResolvedValue({ ...BALANCES, partnerStatus: 'pending', partnerLastSuccess: null });
    await render();
    const text = host.textContent ?? '';
    expect(text).toContain('card office is not connected (pending)');
    const balanceBadges = [...host.querySelectorAll('[data-source]')].slice(0, 3).map((b) => b.getAttribute('data-source'));
    expect(balanceBadges).toEqual(['estimated', 'estimated', 'estimated']);
    expect(must('Place the order').disabled).toBe(true);
    expect(must('Give swipes').disabled).toBe(true);
  });

  it('lists the location with its hours and today’s menu', async () => {
    await render();
    expect(host.textContent).toContain('Rand Dining — open until 20:00');
    expect(host.textContent).toMatch(/Tue 07:00–20:00/);
    expect(host.textContent).toContain('Grain bowl · $9.50 · a swipe covers it');
  });
});

describe('placing an order', () => {
  it('confirms first, and a retry after a failure in flight sends the same key', async () => {
    mock.place.mockRejectedValueOnce(new DiningRefusal('network', 'The dining service did not answer. It may not have gone through; trying again is safe, because the retry is recognised as the same request.'));
    await render();
    await toggle('Grain bowl');
    await press('Place the order');
    expect(mock.place).not.toHaveBeenCalled();
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Grain bowl');
    await press('Confirm the order');
    expect(mock.place).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('trying again is safe');

    await press('Place the order');
    await press('Confirm the order');
    expect(mock.place).toHaveBeenCalledTimes(2);
    const [first, second] = mock.place.mock.calls;
    expect(first.slice(0, 3)).toEqual(['loc-1', ['m-1'], 'swipe']);
    expect(second[3]).toBe(first[3]);
    expect(first[3]).toMatch(/^[A-Za-z0-9_.:-]{8,64}$/);
    expect(mock.say).toHaveBeenCalledWith('Order placed at Rand Dining.');
  });

  it('shows the database’s refusal in plain words and charges nothing', async () => {
    mock.place.mockRejectedValueOnce(new DiningRefusal('at_capacity', 'This location has as many orders in progress as it can take. Try again in a few minutes.'));
    await render();
    await toggle('Grain bowl');
    await press('Place the order');
    await press('Confirm the order');
    expect(host.textContent).toContain('as many orders in progress as it can take');
  });

  it('will not offer a swipe for an item a swipe does not cover', async () => {
    await render();
    await toggle('Cold brew');
    await press('Place the order');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('A swipe does not cover everything chosen.');
  });
});

describe('giving swipes', () => {
  it('needs the consent sentence agreed to, then gives through dining_donate_swipes', async () => {
    await render();
    expect(host.textContent).toContain(SHARE_CONSENT_TEXT);
    await press('Give swipes');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain('needs you to agree');
    await toggle('I agree to the sentence above');
    await press('Give swipes');
    await press('Give the swipes');
    expect(mock.donate).toHaveBeenCalledWith(1, expect.stringMatching(/^[A-Za-z0-9_.:-]{8,64}$/));
  });
});

describe('the counter', () => {
  it('shows the queue as "a swipe", advances an order, and reads the pool as three totals', async () => {
    mock.open.mockResolvedValue(ready({ capabilities: ['dining:operate'] }));
    await render();
    expect(host.textContent).toContain('Paid with a swipe');
    expect(host.textContent).not.toMatch(/shared swipe/i);
    expect(host.textContent).toMatch(/Swipes available\s*4/);
    await press('Accept order');
    expect(mock.advance).toHaveBeenCalledWith('q-1', 'accepted');
    await toggle('Rand Dining takes mobile orders');
    expect(mock.setOrdering).toHaveBeenCalledWith('loc-1', false);
  });
});

describe('when a read fails', () => {
  it('says what failed and offers to try again', async () => {
    mock.open.mockRejectedValueOnce(new DiningRefusal('network', 'The dining service did not answer.'));
    await render();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Nothing was ordered or charged.');
    await press('Try again');
    expect(host.textContent).toContain('Swipes left this plan week');
  });
});
