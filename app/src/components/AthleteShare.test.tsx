// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * An athlete's share with academic support, on screen (D-037 slice 5): only
 * what the app holds can be chosen, nothing is sent before the preview is
 * confirmed, the preview is the staff page, and an ended share says so in
 * one sentence. The server's rules are proved by supportshares.check.sql.
 */

const mock = vi.hoisted(() => {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const shares: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const from = vi.fn((table: string) =>
    table === 'support_share_events'
      ? { select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: events, error: null }) }) }) }
      : { select: () => ({ order: () => Promise.resolve({ data: shares, error: null }) }), update: () => ({ eq }) },
  );
  return { rpc: vi.fn(), from, eq, shares, events, account: { id: 'athlete' } as { id: string } | null };
});
vi.mock('../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: mock.from }) }));
vi.mock('../state/store', () => ({
  useStore: () => ({
    account: mock.account,
    catalog: {
      items: [],
      courses: [{ id: 'econ', code: 'ECON 1020', name: 'Principles of Economics' }],
      byId: { econ: { id: 'econ', code: 'ECON 1020', name: 'Principles of Economics' } },
      modules: [],
      blocks: {},
    },
  }),
  useNow: () => new Date(2026, 8, 27),
}));
const { AthleteShare, SupportSharesWithYou } = await import('./AthleteShare');
const { EMPTY_ATHLETICS } = await import('../lib/athletics');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.eq.mockClear();
  mock.shares.length = 0;
  mock.events.length = 0;
  mock.account = { id: 'athlete' };
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
const box = (name: RegExp) => [...host.querySelectorAll('label')].find((l) => name.test(l.textContent ?? ''))!.querySelector('input')!;
const type = (label: RegExp, text: string) => {
  const input = box(label);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const render = () => act(async () => root.render(<AthleteShare library={EMPTY_ATHLETICS} today="2026-09-27" />));

it('offers only what the app holds, and says what is never shared', async () => {
  await render();
  expect(box(/Travel and competition dates/).disabled).toBe(false);
  expect(box(/Your absence notices/).disabled).toBe(true);
  expect(box(/travel study packs/).disabled).toBe(true);
  expect(host.textContent).toContain('Not recorded in Semester yet');
  expect(host.textContent).toContain('Grades, GPA or any readiness or standing estimate');
  expect(host.textContent).toContain('The compliance office cannot receive it.');
});

it('sends nothing until the preview is confirmed, and sends exactly the preview', async () => {
  await render();
  expect(button(/Preview what they will see/)?.disabled).toBe(true);
  act(() => box(/Your courses this term/).click());
  type(/Their Semester address/, ' support@vanderbilt.edu ');
  type(/Your name, as they will see it/, 'Sam');
  type(/^Until/, '2026-12-15');
  act(() => button(/Preview what they will see/)!.click());

  // The preview is the staff page's own view.
  expect(host.querySelector('[aria-label="Courses this term"]')?.textContent).toContain('ECON 1020 Principles of Economics');
  expect(host.textContent).toContain('It stops by itself if they leave athletic academic support');
  expect(mock.rpc).not.toHaveBeenCalled();

  mock.rpc.mockResolvedValue({ data: 'id', error: null });
  await act(async () => button(/^Share it$/)!.click());
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  const [fn, args] = mock.rpc.mock.calls[0];
  expect(fn).toBe('share_with_support');
  expect(args.staff_email).toBe('support@vanderbilt.edu');
  expect(args.share_payload).toEqual({ sharedAs: 'Sam', courses: [{ code: 'ECON 1020', name: 'Principles of Economics' }] });
  expect(new Date(args.share_expires).toLocaleDateString('en-CA')).toBe('2026-12-15');
  expect(host.querySelector('[role="status"]')?.textContent).toContain('Shared.');
});

it('says what the server refused, word for word, and shares nothing', async () => {
  await render();
  act(() => box(/Your courses this term/).click());
  type(/Their Semester address/, 'coach@vanderbilt.edu');
  type(/Your name, as they will see it/, 'Sam');
  type(/^Until/, '2026-12-15');
  act(() => button(/Preview what they will see/)!.click());
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'no athletic academic support staff at your school uses that address in Semester' } });
  await act(async () => button(/^Share it$/)!.click());
  expect(host.textContent).toContain('Not shared: no athletic academic support staff at your school');
});

it('shows each share with when it was opened, and stops one', async () => {
  mock.shares.push({ id: 's1', created_at: '2026-09-20T10:00:00Z', expires_at: '2099-01-01T00:00:00Z', revoked_at: null });
  mock.events.push({ share_id: 's1', read_at: new Date(2026, 8, 26, 14, 30).toISOString() });
  await render();
  expect(host.textContent).toContain('opened 1 time, last 2026-09-26 14:30');
  await act(async () => button(/Stop this share/)!.click());
  expect(mock.eq).toHaveBeenCalledWith('id', 's1');
});

it('is a plan on this device when nobody is signed in', async () => {
  mock.account = null;
  await render();
  expect(host.textContent).toContain('needs you signed in');
  expect(host.querySelector('input')).toBeNull();
});

it('lists shares for staff without opening them, and logs only an opening', async () => {
  mock.rpc.mockImplementation((fn: string) =>
    Promise.resolve(
      fn === 'list_support_shares'
        ? { data: [{ id: 's1', shared_as: 'Sam', expires_at: '2026-12-15T23:59:00Z' }], error: null }
        : { data: [{ payload: { sharedAs: 'Sam', courses: [{ code: 'ECON 1020', name: 'Econ' }], grades: 'A' } }], error: null },
    ),
  );
  await act(async () => root.render(<SupportSharesWithYou />));
  expect(mock.rpc.mock.calls.map(([fn]) => fn)).toEqual(['list_support_shares']);
  expect(host.textContent).toContain('Each athlete sees every time you open theirs.');

  await act(async () => button(/Open Sam/)!.click());
  expect(mock.rpc).toHaveBeenCalledWith('read_support_share', { want_share: 's1' });
  expect(host.textContent).toContain('ECON 1020 Econ');
  // Anything the preview could not have shown is not shown.
  expect(host.textContent).not.toContain('grades');
});

it('says only that a share has ended, however it ended (D3)', async () => {
  mock.rpc.mockImplementation((fn: string) =>
    Promise.resolve(
      fn === 'list_support_shares'
        ? { data: [{ id: 's1', shared_as: 'Sam', expires_at: '2026-12-15T23:59:00Z' }], error: null }
        : { data: null, error: { message: 'not shared with you' } },
    ),
  );
  await act(async () => root.render(<SupportSharesWithYou />));
  await act(async () => button(/Open Sam/)!.click());
  expect(host.querySelector('[role="status"]')?.textContent).toBe('This share has ended.');
  expect(button(/Open Sam/)).toBeUndefined();
});

it('shows staff nothing at all when nothing is shared with them', async () => {
  mock.rpc.mockResolvedValue({ data: [], error: null });
  await act(async () => root.render(<SupportSharesWithYou />));
  expect(host.textContent).toBe('');
});
