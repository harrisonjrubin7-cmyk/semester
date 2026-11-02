// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Resolving a hold, on the office's screen: the list names the student
 * account and never a reason, nothing is sent before the preview is
 * confirmed, the preview says it is not enrollment, the receipt is the
 * server's words, a refusal is shown as one, and a lost reply is retried with
 * the same key. The rules themselves are proved by
 * registration-hold-resolution.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn(), say: vi.fn() }));
vi.mock('../../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: vi.fn() }) }));
vi.mock('../../state/store', () => ({ useStore: () => ({ say: mock.say }) }));
const { HoldDesk } = await import('./HoldDesk');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  mock.rpc.mockReset();
  mock.say.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const HOLDS = [{ hold_id: 'h-1', student: 'a1b2c3d4-0000-4000-8000-000000000001', placed_at: '2026-10-01T15:00:00Z', reason: 'unpaid tuition' }];
const RECEIPT = {
  ok: true,
  outcome: 'hold_resolved',
  reason: 'ok',
  message: 'The hold is resolved. This is not enrollment: the student still has to enroll, and every other check runs again when they do.',
  replayed: false,
  promoted: 0,
  resolved_at: '2026-10-20T12:00:00Z',
  hold: { id: 'h-1', office: 'vu/bursar' },
};

const button = (name: RegExp) => [...document.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const resolveCalls = () => mock.rpc.mock.calls.filter((c) => c[0] === 'registration_hold_resolve');

function answer(resolve: () => Promise<unknown>) {
  mock.rpc.mockImplementation((name: string) => (name === 'registration_holds_for_office' ? Promise.resolve({ data: HOLDS, error: null }) : resolve()));
}

it('lists the office’s holds by student account, never by reason', async () => {
  answer(() => Promise.resolve({ data: RECEIPT, error: null }));
  act(() => root.render(<HoldDesk offices={['vu/bursar']} />));
  await flush();
  expect(mock.rpc).toHaveBeenCalledWith('registration_holds_for_office', { want_office: 'vu/bursar' });
  expect(host.textContent).toContain('Holds placed by bursar');
  expect(host.textContent).toContain('Student account a1b2c3d4…');
  expect(host.textContent).not.toContain('unpaid');
});

it('previews before resolving, says it is not enrollment, then shows the receipt', async () => {
  answer(() => Promise.resolve({ data: RECEIPT, error: null }));
  act(() => root.render(<HoldDesk offices={['vu/bursar']} />));
  await flush();
  act(() => button(/Resolve the hold on a1b2c3d4/)!.click());

  expect(resolveCalls()).toHaveLength(0);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('This is not enrollment.');
  expect(dialog.textContent).toContain('any other office’s hold');
  expect(dialog.textContent).toContain('This can be reversed on request');

  act(() => button(/^Resolve the hold$/)!.click());
  await flush();
  expect(resolveCalls()).toHaveLength(1);
  expect(resolveCalls()[0][1]).toMatchObject({ want_hold: 'h-1', want_expect: 'held' });
  expect(host.textContent).toContain('The hold is resolved. This is not enrollment');
  expect(mock.say).toHaveBeenCalledWith(expect.stringContaining('This is not enrollment'));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('cancelling the preview sends nothing', async () => {
  answer(() => Promise.resolve({ data: RECEIPT, error: null }));
  act(() => root.render(<HoldDesk offices={['vu/bursar']} />));
  await flush();
  act(() => button(/Resolve the hold on/)!.click());
  act(() => button(/^Cancel$/)!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(resolveCalls()).toHaveLength(0);
});

it('shows a hold someone else already released as a refusal, in words', async () => {
  answer(() => Promise.resolve({ data: { ok: false, outcome: 'refused', reason: 'stale_hold', message: 'x' }, error: null }));
  act(() => root.render(<HoldDesk offices={['vu/bursar']} />));
  await flush();
  act(() => button(/Resolve the hold on/)!.click());
  act(() => button(/^Resolve the hold$/)!.click());
  await flush();
  expect(host.textContent).toContain('Someone released this hold since you looked at it, so nothing was changed.');
  expect(mock.say).not.toHaveBeenCalled();
});

it('retries a lost reply with the same key, and the next resolve gets a new one', async () => {
  let n = 0;
  answer(() => (n++ === 0 ? Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }) : Promise.resolve({ data: RECEIPT, error: null })));
  act(() => root.render(<HoldDesk offices={['vu/bursar']} />));
  await flush();
  act(() => button(/Resolve the hold on/)!.click());
  act(() => button(/^Resolve the hold$/)!.click());
  await flush();
  expect(host.textContent).toContain('it is not known whether the change was made');
  act(() => button(/Try again/)!.click());
  await flush();
  expect(resolveCalls()).toHaveLength(2);
  expect(resolveCalls()[1][1].want_key).toBe(resolveCalls()[0][1].want_key);
  expect(host.textContent).toContain('The hold is resolved.');

  act(() => button(/Resolve the hold on/)!.click());
  act(() => button(/^Resolve the hold$/)!.click());
  await flush();
  expect(resolveCalls()).toHaveLength(3);
  expect(resolveCalls()[2][1].want_key).not.toBe(resolveCalls()[0][1].want_key);
});

it('says a failed list read, and does not show it as an office with no holds', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'semester: only that office can list its holds', code: '42501' } });
  act(() => root.render(<HoldDesk offices={['vu/aid']} />));
  await flush();
  expect(host.textContent).toContain('Only that office can list its holds. Nothing has changed.');
  expect(host.textContent).not.toContain('No open holds');
});
