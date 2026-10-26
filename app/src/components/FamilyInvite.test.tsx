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
  const update = vi.fn();
  const eq = vi.fn((_column: string, code: string) => {
    const patch = update.mock.calls.at(-1)?.[0] as { revoked_at?: string } | undefined;
    return Promise.resolve({ data: [{ code, revoked_at: patch?.revoked_at }], error: null });
  });
  const rows: Record<string, unknown>[] = [];
  const reads: Record<string, unknown>[] = [];
  const grantUpdate = vi.fn();
  const grantIs = vi.fn(() => {
    const patch = grantUpdate.mock.calls.at(-1)?.[0] as { revoked_at?: string } | undefined;
    return Promise.resolve({ data: [{ id: 'grant-1', revoked_at: patch?.revoked_at }], error: null });
  });
  const overlaps = vi.fn(() => ({ is: grantIs }));
  const grantSelect = vi.fn(() => ({ overlaps }));
  const removed = vi.fn<() => Promise<{ data: { code: string; item_id: string }[] | null; error: { message: string } | null }>>(
    () => Promise.resolve({ data: [{ code: 'K7M2Q9ZP', item_id: 'bill' }], error: null }),
  );
  const removedSelect = vi.fn(() => ({ in: removed }));
  const from = vi.fn((table: string) =>
    table === 'family_access_events'
      ? { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: reads, error: null }) }) }) }
      : table === 'family_grants'
        ? { update: (patch: unknown) => {
            grantUpdate(patch);
            return { select: grantSelect };
          } }
        : table === 'family_shared_items'
          ? { delete: () => ({ select: removedSelect }) }
          : {
              select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
              update: (patch: unknown) => {
                update(patch);
                return { select: () => ({ eq }) };
              },
            },
  );
  return { rpc: vi.fn(), from, update, eq, rows, reads, grantUpdate, grantIs, grantSelect, overlaps, removedSelect, removed, account: { id: 'student' } as { id: string } | null };
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
  mock.update.mockClear();
  mock.eq.mockClear();
  mock.rows.length = 0;
  mock.reads.length = 0;
  mock.grantUpdate.mockClear();
  mock.grantIs.mockClear();
  mock.grantSelect.mockClear();
  mock.overlaps.mockClear();
  mock.removedSelect.mockClear();
  mock.removed.mockClear();
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
  const m = { ...newFamilyMember(), id: 'mom', name: 'Mom', expires };
  m.permissions.finances = 'selected';
  return {
    m,
    items: [
      { ...newFamilyItem(m.id), id: 'bill', category: 'finances' as const, title: 'Spring bill', amount: 1200, kind: 'budget' as const },
      // Planned for someone else: must never travel with Mom's code.
      { ...newFamilyItem('dad'), id: 'other', category: 'finances' as const, title: 'Not for Mom' },
    ],
  };
};
const type = (label: RegExp, text: string) => {
  const input = [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
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
  expect(host.querySelector('[aria-label="What they will see"]')?.textContent).toBe('Spring bill');
  expect(host.textContent).toContain('A later change reaches them only if you share again.');
  expect(host.textContent).toContain('Anything shared can be copied by the person who sees it.');
  // The name they will see is the student's to write, and nothing goes without it.
  expect(button(/Create the code/)?.disabled).toBe(true);
  expect(mock.rpc).not.toHaveBeenCalled();

  type(/Your name, as Mom will see it/, ' Sam ');
  mock.rpc.mockResolvedValue({ data: 'K7M2Q9ZP', error: null });
  await act(async () => button(/Create the code/)!.click());
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  expect(mock.rpc).toHaveBeenCalledWith('make_family_share', {
    want_categories: ['finances'],
    want_resources: ['bill'],
    want_days: 80,
    want_shown_as: 'Sam',
    want_items: [{ id: 'bill', category: 'finances', kind: 'budget', title: 'Spring bill', body: '', due: '', done: false, amount: 1200 }],
  });
  expect(host.querySelector('.family-code')?.textContent).toBe('K7M2Q9ZP');
  expect(host.textContent).toContain('Semester sends nothing');
});

it('previews an unused code revocation and requires a returned-row receipt', async () => {
  mock.rows.push({ code: 'K7M2Q9ZP', categories: ['finances'], expires_at: '2099-01-01T00:00:00Z', grant_expires_at: '2099-02-01T00:00:00Z', claimed_at: null, revoked_at: null });
  await show('2026-12-15');
  act(() => button(/Call off K7M2Q9ZP/)!.click());
  expect(mock.eq).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Anyone who has it will not be able to accept it');
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('other codes stay unchanged');
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('make a new code later');
  expect(document.activeElement?.textContent).toBe('Cancel');
  act(() => button(/^Cancel$/)!.click());
  expect(mock.eq).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')).toBeNull();

  act(() => button(/Call off K7M2Q9ZP/)!.click());

  mock.eq.mockResolvedValueOnce({ data: [], error: null });
  await act(async () => button(/^Call off code$/)!.click());
  expect(mock.eq).toHaveBeenCalledWith('code', 'K7M2Q9ZP');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('The code was not called off');
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();

  await act(async () => button(/^Call off code$/)!.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('K7M2Q9ZP can no longer be used');
});

it('previews claimed access revocation and waits for exact server receipts', async () => {
  mock.rows.push({ code: 'K7M2Q9ZP', categories: ['finances'], resource_ids: ['bill'], expires_at: '2099-01-01T00:00:00Z', grant_expires_at: '2099-02-01T00:00:00Z', claimed_at: '2026-09-28T09:00:00Z', revoked_at: null });
  mock.reads.push(
    // Built in local time, so the line reads the same in every zone the suite runs in.
    { reader_id: 'p', item_ids: ['bill'], read_at: new Date(2026, 8, 29, 18, 4).toISOString() },
    // A read of somebody else's items is not Mom's.
    { reader_id: 'q', item_ids: ['elsewhere'], read_at: '2026-09-29T19:00:00Z' },
  );
  await show('2026-12-15');
  expect(host.querySelector('[aria-label="Times Mom opened what you shared"]')?.textContent).toBe('2026-09-29 18:04 · 1 item');

  act(() => button(/Stop sharing with Mom/)!.click());
  const dialog = host.querySelector('[role="dialog"]');
  expect(dialog?.textContent).toContain('Mom · 1 family item');
  expect(dialog?.textContent).toContain('read history stay unchanged');
  expect(dialog?.textContent).toContain('Copies already saved outside Semester cannot be recalled');
  expect(dialog?.textContent).toContain('create and confirm a new share later');
  expect(document.activeElement?.textContent).toBe('Cancel');
  expect(mock.overlaps).not.toHaveBeenCalled();
  act(() => button(/^Cancel$/)!.click());
  expect(mock.overlaps).not.toHaveBeenCalled();

  act(() => button(/Stop sharing with Mom/)!.click());
  mock.removed.mockResolvedValueOnce({ data: null, error: { message: 'cleanup refused' } });
  await act(async () => button(/^Stop sharing$/)!.click());
  // Every item planned for Mom, shared now or before — not just today's plan.
  expect(mock.overlaps).toHaveBeenCalledWith('resource_ids', ['bill']);
  expect(mock.removed).toHaveBeenCalledWith('item_id', ['bill']);
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Access ended, but Semester could not remove the stored copies');
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();

  await act(async () => button(/^Stop sharing$/)!.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Mom can no longer see what you shared. 1 stored copy was removed.');
});

it('says a claimed share has not been opened, rather than showing nothing', async () => {
  mock.rows.push({ code: 'K7M2Q9ZP', categories: ['finances'], resource_ids: ['bill'], expires_at: '2099-01-01T00:00:00Z', grant_expires_at: '2099-02-01T00:00:00Z', claimed_at: '2026-09-28T09:00:00Z', revoked_at: null });
  await show('2026-12-15');
  expect(host.textContent).toContain('Not opened yet.');
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
