// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Admissions as the person sees it: nothing in Connect, an applicant's form
 * with the submit button waiting for the required answers, a decision shown only
 * once the database returns it (it is private until released), and the office
 * only for someone holding an admissions capability. The rules are
 * `supabase/admissions.check.sql`'s.
 */
const CYCLE = {
  id: 'c1', name: 'Fall 2027 first year', term: '2027FA', opensAt: '2026-10-01T00:00:00Z', closesAt: '2026-12-01T00:00:00Z', opened: true, closed: false,
  questions: [{ key: 'essay', label: 'Why this school', kind: 'text', required: true }],
  checklist: [{ key: 'transcript', label: 'Secondary transcript', required: true }],
};
const mock = vi.hoisted(() => ({
  store: { school: { id: 'vu' }, account: { id: 'u1' } as { id: string } | null, say: vi.fn(), dispatch: vi.fn() },
  rows: [] as unknown[] | null,
  grants: [] as unknown[],
  mine: [] as unknown[],
  start: vi.fn(async () => 'a1'),
  respond: vi.fn(async () => ({})),
}));
vi.mock('../../state/store', () => ({ useStore: () => mock.store }));
vi.mock('../../lib/modulemode', async (orig) => ({ ...(await orig<typeof import('../../lib/modulemode')>()), moduleModes: () => Promise.resolve(mock.rows) }));
vi.mock('../../lib/capabilities', () => ({ loadMyCapabilities: () => Promise.resolve(mock.grants) }));
vi.mock('../../lib/admissions/client', async (orig) => ({
  ...(await orig<typeof import('../../lib/admissions/client')>()),
  loadMyApplications: () => Promise.resolve(mock.mine),
  loadCycles: () => Promise.resolve([CYCLE]),
  loadOfficeApplications: () => Promise.resolve([]),
  loadYield: () => Promise.resolve({ started: 4, submitted: 3, withdrawn: 1, admitted: 1, accepted: 1, deposited: 1 }),
  startApplication: mock.start,
  respondToOffer: mock.respond,
}));
const { AdmissionsHome } = await import('./AdmissionsHome');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;
const CORE = [{ module: 'admissions', mode: 'core', frozen: false, killed: false }];
const OFFICER = [{ capability: 'admissions:configure', scopeKind: 'school', scopeId: 'vu' }, { capability: 'admissions:read', scopeKind: 'school', scopeId: 'vu' }];
const DRAFT = { id: 'a1', cycle: CYCLE, status: 'draft', answers: {}, docs: {}, decision: null, response: null, deposit: false };

beforeEach(() => {
  mock.store.account = { id: 'u1' };
  mock.rows = CORE; mock.grants = []; mock.mine = [];
  mock.start.mockClear(); mock.respond.mockClear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => { act(() => root.unmount()); host.remove(); });

const render = async () => { await act(async () => root.render(<AdmissionsHome />)); };
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('asks a signed-out visitor to sign in', async () => {
  mock.store.account = null;
  await render();
  expect(host.textContent).toContain('Sign in to apply');
});

it('says the school’s own system holds admissions while the school is in Connect', async () => {
  mock.rows = [{ module: 'admissions', mode: 'connect', frozen: false, killed: false }];
  await render();
  expect(host.textContent).toContain('own system holds admissions');
});

it('lets an applicant start with a code and shows an empty state before one exists', async () => {
  await render();
  expect(host.textContent).toContain('No application yet');
  expect((button(/^Start$/) as HTMLButtonElement).disabled).toBe(true);
  const input = host.querySelector('input.input') as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'c1');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => button(/^Start$/)!.click());
  expect(mock.start).toHaveBeenCalledWith('c1', expect.any(String));
});

it('keeps Submit off until the required answers are in, and names what is missing', async () => {
  mock.mine = [DRAFT];
  await render();
  expect(host.textContent).toContain('Why this school');
  expect(host.textContent).toContain('Still to answer: Why this school.');
  expect((button(/^Submit$/) as HTMLButtonElement).disabled).toBe(true);
  expect(button(/^I sent this$/)).toBeDefined();
});

it('shows no decision until the database returns one, then lets an admitted applicant answer', async () => {
  mock.mine = [{ ...DRAFT, status: 'submitted', answers: { essay: 'x' } }];
  await render();
  expect(host.textContent).not.toContain('offered admission');
  expect(host.textContent).toContain('The school is still waiting for: Secondary transcript.');
  act(() => root.unmount()); root = createRoot(host);
  mock.mine = [{ ...DRAFT, status: 'submitted', answers: { essay: 'x' }, docs: { transcript: 'received' }, decision: { decision: 'admit', conditions: 'Final transcript' } }];
  await render();
  expect(host.textContent).toContain('You are offered admission.');
  expect(host.textContent).toContain('Conditions: Final transcript');
  await act(async () => button(/^Accept$/)!.click());
  expect(mock.respond).toHaveBeenCalledWith('a1', 'accept', expect.any(String));
  expect(button(/^Withdraw$/)).toBeUndefined();
});

it('shows the office only to an admissions capability, with the yield counts only for read', async () => {
  await render();
  expect(button(/^Admissions office$/)).toBeUndefined();
  act(() => root.unmount()); root = createRoot(host);
  mock.grants = OFFICER;
  await render();
  await act(async () => button(/^Admissions office$/)!.click());
  expect(host.textContent).toContain('4 started · 3 submitted');
  expect(host.textContent).toContain('Application code for applicants: c1');
  expect(host.textContent).not.toContain('Release decisions');
  expect(button(/^Save as a draft$/)).toBeDefined();
});
