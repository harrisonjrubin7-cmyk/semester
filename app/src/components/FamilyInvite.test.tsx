// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The share-code flow on the Family screen: a plan that breaks the rules says
 * why; one that passes is confirmed in full before anything is made; the code
 * is shown to hand over, and can be called off. The database is stubbed; the
 * rules it enforces are proved by supabase/familyinvites.check.sql.
 */

const mock = vi.hoisted(() => {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const rows: Record<string, unknown>[] = [];
  const order = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  const from = vi.fn(() => ({ select: () => ({ order }), update: () => ({ eq }) }));
  return { rpc: vi.fn(), from, eq, rows, account: { id: 'student' } as { id: string } | null };
});
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }) }));
vi.mock('../state/store', () => ({ useStore: () => ({ account: mock.account }) }));
const { ClaimFamilyCode, FamilyInvite } = await import('./FamilyInvite');
const { newFamilyItem, newFamilyMember } = await import('../lib/family');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.eq.mockClear();
  mock.rows.length = 0;
  mock.account = { id: 'student' };
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
const plan = (expires: string) => {
  const m = { ...newFamilyMember(), name: 'Mom', expires };
  m.permissions.finances = 'selected';
  return { m, items: [{ ...newFamilyItem(m.id), category: 'finances' as const, title: 'Spring bill' }] };
};
const show = async (expires: string) => {
  const { m, items } = plan(expires);
  await act(async () => root.render(<FamilyInvite member={m} items={items} today="2026-09-27" />));
};

it('says why a plan cannot be shared yet, and offers no code', async () => {
  await show('');
  expect(host.textContent).toContain('Needs an end date');
  expect(button(/Create a share code/)).toBeUndefined();
});

it('makes nothing until the full confirmation is accepted, then shows the code to hand over', async () => {
  await show('2026-12-15');
  act(() => button(/Create a share code for Mom/)!.click());
  expect(host.textContent).toContain('Share 1 item with Mom until 2026-12-15?');
  expect(host.textContent).toContain('Anything shared can be copied by the person who sees it.');
  expect(mock.rpc).not.toHaveBeenCalled();

  mock.rpc.mockResolvedValue({ data: 'K7M2Q9ZP', error: null });
  await act(async () => button(/Create the code/)!.click());
  expect(mock.rpc).toHaveBeenCalledWith('make_family_invite', expect.objectContaining({ want_access: 'selected', want_days: 80 }));
  expect(host.querySelector('.family-code')?.textContent).toBe('K7M2Q9ZP');
  expect(host.textContent).toContain('Semester sends nothing');
});

it('lets the student call off a code nobody has used', async () => {
  mock.rows.push({ code: 'K7M2Q9ZP', categories: ['finances'], expires_at: '2099-01-01T00:00:00Z', grant_expires_at: '2099-02-01T00:00:00Z', claimed_at: null, revoked_at: null });
  await show('2026-12-15');
  await act(async () => button(/Call off K7M2Q9ZP/)!.click());
  expect(mock.eq).toHaveBeenCalledWith('code', 'K7M2Q9ZP');
});

it('keeps it a plan when nobody is signed in', async () => {
  mock.account = null;
  await show('2026-12-15');
  expect(host.textContent).toContain('needs you signed in');
  expect(button(/Create a share code/)).toBeUndefined();
});

it('lets a recipient accept a typed code, and says what the database answered', async () => {
  await act(async () => root.render(<ClaimFamilyCode />));
  const input = host.querySelector('input') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'k7m2-q9zp');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  mock.rpc.mockResolvedValue({ data: 'claimed', error: null });
  await act(async () => button(/^Accept$/)!.click());
  expect(mock.rpc).toHaveBeenCalledWith('claim_family_invite', { given: 'K7M2Q9ZP' });
  expect(host.textContent).toContain('Accepted.');
});
