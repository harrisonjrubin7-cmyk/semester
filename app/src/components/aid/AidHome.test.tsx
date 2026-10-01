// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Financial aid as the person sees it: nothing in Connect, a student's current
 * approved offer with an answer per part, the office only for someone holding an
 * aid capability, and a person who proposed an offer told someone else approves
 * it. The rules are `supabase/financial-aid.check.sql`'s.
 */
const OFFER = {
  id: 'v2', offerId: 'o1', studentRef: 'S-ANA', aidYear: '2026-27', version: 2, note: 'Welcome', approved: true, latest: true, proposedByMe: false,
  components: [{ key: 'pell', kind: 'grant', name: 'Pell Grant', amount_cents: 300000 }, { key: 'loan1', kind: 'loan', name: 'Direct Subsidized Loan', amount_cents: 550000 }],
  answers: { loan1: 'decline' }, disbursed: { pell: 150000 },
};
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  offers: [] as unknown[],
  respond: vi.fn(async () => ({})),
  approve: vi.fn(async () => ({})),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/aid/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/aid/client')>()),
  loadOffers: () => Promise.resolve(mock.offers),
  loadStandings: () => Promise.resolve([{ id: 's1', studentRef: 'S-ANA', aidYear: '2026-27', determination: 'satisfactory', reason: 'Meets the policy in full.', decidedAt: '2026-10-01T10:00:00Z' }]),
  loadEvaluations: () => Promise.resolve([{ id: 'e1', studentRef: 'S-BEN', gpa: 0.667, attempted: 9, earned: 3, completionPct: 33.33, meetsGpa: false, meetsCompletion: false, evaluatedAt: '2026-10-01T10:00:00Z', mine: true }]),
  respondToComponent: mock.respond,
  approveOffer: mock.approve,
}));
const { AidHome } = await import('./AidHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'financial_aid', mode: 'core', frozen: false, killed: false }];
const OFFICE = [
  { capability: 'aid:propose', scopeKind: 'school', scopeId: 'vu' }, { capability: 'aid:approve', scopeKind: 'school', scopeId: 'vu' },
  { capability: 'aid:determine', scopeKind: 'school', scopeId: 'vu' }, { capability: 'aid:read', scopeKind: 'school', scopeId: 'vu' },
];

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = []; mock.offers = [];
  mock.respond.mockClear(); mock.approve.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<AidHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in with your school account');
});

it('says the school’s own system holds aid while the school is in Connect', async () => {
  mock.rows = [{ module: 'financial_aid', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own system holds your financial aid');
});

it('says nothing is there before an offer is approved', async () => {
  await render();
  expect(host.textContent).toContain('No offer yet');
});

it('shows a student each part with its answer and what was disbursed, and lets them answer an unanswered one', async () => {
  mock.offers = [OFFER];
  await render();
  expect(host.textContent).toContain('Pell Grant · Grant · $3,000.00 · waiting for your answer');
  expect(host.textContent).toContain('Direct Subsidized Loan · Loan · $5,500.00 · declined');
  expect(host.textContent).toContain('$1,500.00 disbursed so far');
  expect(host.textContent).toContain('Making satisfactory progress');
  await act(async () => button(/^Accept$/)!.click());
  expect(mock.respond).toHaveBeenCalledWith('v2', 'pell', 'accept', expect.any(String));
});

it('shows the office only to an aid capability, and tells the proposer someone else approves', async () => {
  mock.offers = [{ ...OFFER, approved: false, proposedByMe: true, answers: {}, disbursed: {} }, { ...OFFER, id: 'v9', offerId: 'o2', studentRef: 'S-BEN', approved: false, proposedByMe: false, answers: {}, disbursed: {} }];
  await render();
  expect(button(/^Aid office$/)).toBeUndefined();
  act(() => root.unmount()); root = createRoot(host);
  mock.grants = OFFICE;
  await render();
  await act(async () => button(/^Aid office$/)!.click());
  expect(host.textContent).toContain('You proposed this, so someone else approves it.');
  expect([...host.querySelectorAll('button')].filter((b) => /^Approve$/.test(b.textContent ?? ''))).toHaveLength(1);
  await act(async () => button(/^Approve$/)!.click());
  expect(mock.approve).toHaveBeenCalledWith('v9', expect.any(String));
});

it('tells the person who ran an evaluation that someone else decides the standing', async () => {
  mock.grants = OFFICE;
  await render();
  await act(async () => button(/^Aid office$/)!.click());
  expect(host.textContent).toContain('You ran this evaluation, so someone else decides the standing.');
  expect(host.textContent).toContain('does not meet the policy');
});
