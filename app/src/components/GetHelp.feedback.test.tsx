// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/** The "did you reach the right place?" question on Get help: only after a send made in this visit, only when the flag is on. */

const mock = vi.hoisted(() => ({ on: false, load: vi.fn(), send: vi.fn() }));

vi.mock('../lib/help-routes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/help-routes')>()),
  loadHelp: mock.load,
  sendHelp: mock.send,
  withdrawHelp: vi.fn(),
}));
vi.mock('../lib/momentfeedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/momentfeedback')>()),
  momentFeedbackOn: () => mock.on,
}));
vi.mock('../state/store', () => ({
  useAccountId: () => 'me',
  useNow: () => new Date(2026, 9, 1, 12, 0),
}));

import { GetHelp } from './GetHelp';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mock.on = false;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const TUTORING = { id: 'tut', kind: 'tutoring', name: 'Tutoring Center', officialUrl: 'https://tutoring.example.edu', hours: 'Mon–Fri 9–5', acceptsRequests: true };
const ME = { id: 'me', email: 'me@example.edu', via: 'email' } as const;

const radio = (text: string) => [...host.querySelectorAll('label')].find((l) => l.textContent?.includes(text))?.querySelector('input') as HTMLInputElement;
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;

async function sendOne() {
  mock.load.mockResolvedValue({ destinations: [TUTORING], requests: [], name: 'harrison_r' });
  mock.send.mockResolvedValue('req-1');
  await act(async () => root.render(<GetHelp account={ME} />));
  act(() => radio('Stuck on course material').click());
  act(() => radio('Tutoring Center').click());
  act(() => {
    const area = host.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(area, 'I am stuck on question 2');
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => button('Review and send')!.click());
}

it('asks whether you reached the right place after the send, not before, when the flag is on', async () => {
  mock.on = true;
  await sendOne();
  expect(host.textContent).not.toMatch(/Did you reach the right place/); // nothing has been sent yet
  await act(async () => button('Yes, send to Tutoring Center')!.click());
  expect(mock.send).toHaveBeenCalledTimes(1);
  expect(host.textContent).toMatch(/You were pointed to someone for help\. Did you reach the right place\?/);
  // Answering saves a choice, a category and a day, on this device, and does not touch the request.
  act(() => button('No, wrong place')!.click());
  const saved = JSON.parse(localStorage.getItem('semester.moment-feedback.v1:me')!);
  expect(saved.answers).toEqual([{ moment: 'support-routed', choice: 'wrong', category: 'wrong-place', on: '2026-10-01' }]);
  expect(mock.send).toHaveBeenCalledTimes(1);
});

it('never asks, and writes nothing, when the flag is off', async () => {
  await sendOne();
  await act(async () => button('Yes, send to Tutoring Center')!.click());
  expect(mock.send).toHaveBeenCalledTimes(1);
  expect(host.textContent).not.toMatch(/Did you reach the right place/);
  expect(localStorage.length).toBe(0);
});

it('does not ask when the send failed', async () => {
  mock.on = true;
  await sendOne();
  mock.send.mockRejectedValue(new Error('Could not send.'));
  await act(async () => button('Yes, send to Tutoring Center')!.click());
  expect(host.textContent).toMatch(/Could not send\./);
  expect(host.textContent).not.toMatch(/Did you reach the right place/);
});
