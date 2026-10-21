// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The supporter's page. Reading is logged for the student, so nothing is read
 * until the supporter asks; what comes back is shown as it came; and a share
 * that stops says "This share has ended." whichever way it stopped (D3). The
 * reader's own rules are proved by supabase/familyshare.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn(), account: { id: 'parent' } as { id: string } | null }));
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc }) }));
vi.mock('../state/store', () => ({
  useNow: () => new Date('2026-10-03T12:00:00Z'),
  useStore: () => ({ account: mock.account }),
}));
const { SharedWithYou } = await import('./SharedWithYou');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  mock.rpc.mockReset();
  mock.account = { id: 'parent' };
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
const row = (over: Record<string, unknown> = {}) => ({
  student_id: 's1',
  shown_as: 'Sam',
  category: 'finances',
  item_id: 'bill',
  kind: 'budget',
  title: 'Spring tuition bill',
  body: 'Due before classes start.',
  due: '2027-01-05',
  done: false,
  amount: 1200,
  ends_at: '2026-12-15T00:00:00+00:00',
  ...over,
});
const render = () => act(async () => root.render(<SharedWithYou today="2026-09-27" />));

it('reads nothing until the supporter asks, and says the student will see it', async () => {
  await render();
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(host.textContent).toContain('Each time you open it, they can see that you did.');
});

it('shows what was shared, as it was shared, and nothing about it that was not', async () => {
  mock.rpc.mockResolvedValue({ data: [row(), row({ item_id: 'exam', category: 'calendar', kind: 'information', title: 'Finals week', body: '', due: '2026-12-10', amount: 0 })], error: null });
  await render();
  await act(async () => button(/Open what is shared with me/)!.click());
  expect(mock.rpc).toHaveBeenCalledWith('read_family_share');
  expect(host.querySelector('h3')?.textContent).toBe('From Sam');
  expect(host.textContent).toContain('Shared with you until 2026-12-15.');
  expect(host.textContent).toContain('Spring tuition bill');
  expect(host.textContent).toContain('Bills & payments · due 2027-01-05 · $1,200');
  expect(host.textContent).toContain('Due before classes start.');
  expect(host.textContent).toContain('Selected calendar events · due 2026-12-10');
  // Read only: no control on the page acts on the student's items.
  expect([...host.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Open it again', 'Open calendar']);
});

it('opens a guardian calendar only for a student returned by the existing authorized reader', async () => {
  mock.rpc.mockImplementation((name: string) => name === 'read_family_share'
    ? Promise.resolve({ data: [row({ category: 'calendar', item_id: 'exam' })], error: null })
    : Promise.resolve({ data: [{
      student_id: 's1', item_id: 'exam', title: 'Finals week', starts_at: '2026-12-10T15:00:00Z',
      status: 'scheduled', source_observed_at: '2026-10-03T10:00:00Z', expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    }], error: null }));
  await render();
  await act(async () => button(/Open what is shared with me/)!.click());
  await act(async () => button(/Open calendar/)!.click());
  expect(mock.rpc).toHaveBeenLastCalledWith('read_guardian_calendar_projection', {
    wanted_student: 's1',
    wanted_purpose: 'guardian_portal',
  });
  expect(host.textContent).toContain('Finals week');
  expect(host.querySelector('input')).toBeNull();
});

it('says a share has ended, in the same words whichever way it ended', async () => {
  mock.rpc.mockResolvedValue({ data: [row()], error: null });
  await render();
  await act(async () => button(/Open what is shared with me/)!.click());
  expect(host.textContent).not.toContain('This share has ended.');

  // Revoked or lapsed: the reader returns nothing either way, and so the page
  // cannot tell them apart — which is the point (D3).
  mock.rpc.mockResolvedValue({ data: [], error: null });
  await act(async () => button(/Open it again/)!.click());
  expect(host.textContent).toContain('From Sam');
  expect(host.textContent).toContain('This share has ended.');
  expect(host.textContent).not.toContain('Spring tuition bill');
  expect(host.textContent).not.toMatch(/revoked|stopped|expired/i);
});

it('says so when nothing is shared, rather than showing an empty page', async () => {
  mock.rpc.mockResolvedValue({ data: [], error: null });
  await render();
  await act(async () => button(/Open what is shared with me/)!.click());
  expect(host.textContent).toContain('Nothing is shared with you right now.');
});

it('says when the read failed, instead of looking like nothing was shared', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'network down' } });
  await render();
  await act(async () => button(/Open what is shared with me/)!.click());
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('network down');
  expect(host.textContent).not.toContain('Nothing is shared with you right now.');
});

it('is not offered to somebody signed out', async () => {
  mock.account = null;
  await render();
  expect(host.textContent).toBe('');
});
