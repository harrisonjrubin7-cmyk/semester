// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * Handing in work, on screen: nothing is sent before the preview is
 * confirmed, the preview says what stays the same, the receipt names the
 * version and fingerprint, a refusal is shown in the server's words, and a
 * school without submissions says so instead of offering a button that would
 * fail. The server's rules are proved by learning-submissions.check.sql.
 */

const mock = vi.hoisted(() => ({ rpc: vi.fn(), say: vi.fn() }));
vi.mock('../../lib/cloud', () => ({ cloudConfigured: true, cloud: () => Promise.resolve({ rpc: mock.rpc, from: vi.fn() }) }));
vi.mock('../../state/store', () => ({ useStore: () => ({ say: mock.say }) }));
const { HandIn } = await import('./HandIn');

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

const HASH = '3f9a' + '0'.repeat(56) + 'c210';
const items = [{ id: 'essay2', categoryKey: 'essays', title: 'Essay 2', pointsPossible: 100, lineItem: null }];
const earlier = { id: 's-1', itemId: 'essay2', studentId: 'maya', version: 1, body: 'First go.', contentHash: HASH, at: '2026-10-18T15:00:00Z' };

const button = (name: RegExp) => [...document.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));
const write = (text: string) => {
  const area = host.querySelector('textarea')!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(area, text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

it('previews before sending, then hands in as the next version and says the receipt', async () => {
  const onHandedIn = vi.fn();
  mock.rpc.mockResolvedValue({ data: { submission: 's-2', version: 2, content_hash: HASH, submitted_at: '2026-10-19T12:00:00Z' }, error: null });
  act(() => root.render(<HandIn items={items} me="maya" loaded={{ available: true, submissions: [earlier], graded: { 'g-9': 's-1' } }} onHandedIn={onHandedIn} />));

  expect(button(/Review and hand in Essay 2/)!.disabled).toBe(true);
  write('My revised essay on Reconstruction.');
  act(() => button(/Review and hand in Essay 2/)!.click());

  expect(mock.rpc).not.toHaveBeenCalled();
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('Essay 2 · version 2');
  expect(dialog.textContent).toContain('Version 1 and earlier stay exactly as they were');
  expect(dialog.textContent).toContain('This can’t be undone. You can hand in again');

  act(() => button(/Hand in version 2/)!.click());
  await flush();
  expect(mock.rpc).toHaveBeenCalledTimes(1);
  expect(mock.rpc.mock.calls[0][0]).toBe('learning_submit');
  expect(mock.rpc.mock.calls[0][1]).toMatchObject({ want_item: 'essay2', want_body: 'My revised essay on Reconstruction.' });
  expect(host.textContent).toContain('Essay 2 is handed in as version 2');
  expect(host.textContent).toContain('3f9a…c210');
  expect(onHandedIn).toHaveBeenCalledTimes(1);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('cancelling the preview sends nothing', () => {
  act(() => root.render(<HandIn items={items} me="maya" loaded={{ available: true, submissions: [], graded: {} }} onHandedIn={() => {}} />));
  write('Draft.');
  act(() => button(/Review and hand in/)!.click());
  act(() => button(/^Cancel$/)!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(mock.rpc).not.toHaveBeenCalled();
});

it('shows a refusal in the server’s words, and hands in nothing', async () => {
  mock.rpc.mockResolvedValue({ data: null, error: { message: 'semester: that needs submissions:create on this course in 2026FA', code: '42501' } });
  const onHandedIn = vi.fn();
  act(() => root.render(<HandIn items={items} me="maya" loaded={{ available: true, submissions: [], graded: {} }} onHandedIn={onHandedIn} />));
  write('Draft.');
  act(() => button(/Review and hand in/)!.click());
  act(() => button(/Hand in version 1/)!.click());
  await flush();
  expect(host.textContent).toContain('That needs submissions:create on this course in 2026FA.');
  expect(onHandedIn).not.toHaveBeenCalled();
});

it('lists what was handed in, and which version a released grade names', () => {
  act(() => root.render(<HandIn items={items} me="maya" loaded={{ available: true, submissions: [earlier], graded: { 'g-9': 's-1' } }} onHandedIn={() => {}} />));
  const table = host.querySelector('table')!;
  expect(table.textContent).toContain('Version 1');
  expect(table.textContent).toContain('A released grade names this version');
});

it('says when the school has no submissions yet, and offers no button', () => {
  act(() => root.render(<HandIn items={items} me="maya" loaded={{ available: false, submissions: [], graded: {} }} onHandedIn={() => {}} />));
  expect(host.textContent).toContain('not set up at your school yet');
  expect(button(/hand in/i)).toBeUndefined();
});

it('says when nothing is assigned', () => {
  act(() => root.render(<HandIn items={[]} me="maya" loaded={{ available: true, submissions: [], graded: {} }} onHandedIn={() => {}} />));
  expect(host.textContent).toContain('Nothing assigned yet');
});
