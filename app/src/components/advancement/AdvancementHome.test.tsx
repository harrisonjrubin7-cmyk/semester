// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Alumni relations as the person sees it: nothing in Connect, a graduate's own
 * opt-in and preferences, and the donor desk only for a role that holds
 * `adv:*`. The rules are `supabase/advancement.check.sql`'s.
 */
const DESK = {
  donors: [{ id: 'd1', kind: 'friend', name: 'Pat Giver', email: '', contactOk: false }],
  funds: [{ id: 'f1', code: 'ANNUAL', name: 'Annual fund', designation: 'unrestricted' }],
  campaigns: [{ id: 'c1', name: 'Spring drive', kind: 'campaign', goalCents: 100000, startsOn: '2026-03-01', endsOn: '2026-06-01', raisedCents: 25000, gifts: 2 }],
  gifts: [{ id: 'g1', donorId: 'd1', amountCents: 5000, receivedOn: '2026-04-01', method: 'check', reference: 'CHK-1', receipt: 'R-2026-000001', refunded: false }],
  hasWording: true,
};
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  profile: null as unknown,
  desk: null as unknown,
  optIn: vi.fn(async () => ({})),
  refund: vi.fn(async () => ({})),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/advancement/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/advancement/client')>()),
  loadMyProfile: () => Promise.resolve(mock.profile),
  loadDesk: () => Promise.resolve(mock.desk),
  optIn: mock.optIn,
  refundGift: mock.refund,
}));
const { AdvancementHome } = await import('./AdvancementHome');
const { toCents, percentOf } = await import('../../lib/advancement/client');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'advancement', mode: 'core', frozen: false, killed: false }];
const grant = (capability: string) => ({ capability, scopeKind: 'school', scopeId: 'vu' });

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = []; mock.profile = null; mock.desk = DESK;
  mock.optIn.mockClear(); mock.refund.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<AdvancementHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says the school’s own system holds it in Connect, and shows nothing else', async () => {
  mock.rows = [];
  await render();
  expect(host.textContent).toContain('Your school’s own system holds alumni relations');
  expect(host.querySelector('button')).toBeNull();
});

it('lets a graduate join, and shows no donor desk to someone without a role', async () => {
  await render();
  expect(host.textContent).toContain('Join the alumni community');
  expect(host.querySelector('[aria-label="Donor desk"]')).toBeNull();
  const join = button(/Join the alumni community/);
  expect(join?.disabled).toBe(true);
});

it('shows a graduate their preferences once they are in', async () => {
  mock.profile = { displayName: 'Sam Grad', classYear: 2024, directory: false, solicitable: true, optedOut: false };
  await render();
  expect(host.textContent).toContain('class of 2024');
  expect(button(/Show me in the directory/)).toBeTruthy();
  expect(button(/Do not ask me for gifts/)).toBeTruthy();
  expect(button(/Opt out of everything/)).toBeTruthy();
});

it('shows the desk, campaign progress and receipts to staff, and a refund only to a refunder', async () => {
  mock.grants = [grant('adv:read')];
  await render();
  expect(host.querySelector('[aria-label="Donor desk"]')).not.toBeNull();
  expect(host.textContent).toContain('$250.00 of $1,000.00 (25%)');
  expect(host.textContent).toContain('receipt R-2026-000001');
  expect(button(/^Refund/)).toBeUndefined();
  expect(button(/Record the gift/)).toBeUndefined();
  expect(button(/Save the wording/)).toBeUndefined();
});

it('offers refund to a refunder and the wording only to a director', async () => {
  mock.grants = [grant('adv:read'), grant('adv:refund'), grant('adv:configure')];
  await render();
  expect(button(/^Refund/)).toBeTruthy();
  expect(button(/Save the wording/)).toBeTruthy();
  await act(async () => { button(/^Refund/)?.click(); });
  expect(host.textContent).toContain('Someone other than the person who recorded a gift refunds it');
});

it('holds the gift button until the school has set its receipt wording', async () => {
  mock.grants = [grant('adv:gift')];
  mock.desk = { ...DESK, hasWording: false };
  await render();
  expect(host.textContent).toContain('has not set its receipt wording');
  expect(button(/Record the gift/)?.disabled).toBe(true);
});

it('reads dollars into cents exactly and refuses what is not an amount', () => {
  expect(toCents('25')).toBe(2500);
  expect(toCents('$1,250.5')).toBe(125050);
  expect(toCents('0.07')).toBe(7);
  for (const bad of ['', '0', '-5', '1.234', 'ten', '1e3']) expect(toCents(bad), bad).toBeNull();
  expect(percentOf(25000, 100000)).toBe(25);
  expect(percentOf(500, 100)).toBe(100);
  expect(percentOf(5, 0)).toBe(0);
});
