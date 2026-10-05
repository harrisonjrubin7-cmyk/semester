// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { StaffInbox } from '../lib/help-routes';

/**
 * The Get help tab says how many requests are new for this account's offices,
 * and follows moves made in the inbox. The flag is read at import, so it is
 * switched on here, in its own file.
 */

const mock = vi.hoisted(() => ({
  account: null as null | { id: string; email: string; via: string },
  load: vi.fn(),
  open: vi.fn(),
  answer: vi.fn(),
}));

vi.mock('../lib/experience-flags', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/experience-flags')>();
  return { ...real, EXPERIENCE_FLAGS: { ...real.EXPERIENCE_FLAGS, humanHelp: 'preview' } };
});
vi.mock('../state/store', () => ({
  useStore: () => ({
    state: { term: '2026FA' },
    account: mock.account,
    school: { name: 'Test school' },
    catalog: { courses: [] },
    dispatch: vi.fn(),
  }),
}));
vi.mock('../lib/help-routes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/help-routes')>()),
  loadInboxes: mock.load,
  openRequest: mock.open,
  answerRequest: mock.answer,
}));
// The student half has its own tests; here it would only add network calls.
vi.mock('../components/GetHelp', () => ({ GetHelp: () => null }));

import { University } from './University';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mock.account = null;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const ADVISOR = { id: 'advisor', email: 'advisor@example.edu', via: 'email' };
const item = (id: string, status: StaffInbox['items'][number]['status']) => ({
  id,
  status,
  createdAt: '2099-01-01T00:00:00Z',
  updatedAt: '2099-01-01T00:00:00Z',
});
const inbox = (items: StaffInbox['items']): StaffInbox => ({
  destination: { id: 'adv', kind: 'advisor', name: 'Advising Office' },
  items,
});

/** The Get help tab's label, as the DOM holds it (the caps are CSS). */
const helpTab = () =>
  [...host.querySelectorAll('button')].find((b) => /^Get help/.test(b.textContent ?? ''))?.textContent;
const button = (text: RegExp) =>
  [...host.querySelectorAll('button')].find((b) => text.test(b.textContent ?? '')) as HTMLButtonElement | undefined;

async function mount() {
  await act(async () => root.render(<University />));
}

it('counts only requests nobody has marked seen, across every office', async () => {
  mock.account = ADVISOR;
  mock.load.mockResolvedValue([
    inbox([item('a', 'sent'), item('b', 'acknowledged'), item('c', 'scheduled')]),
    { destination: { id: 'reg', kind: 'registrar', name: 'Registrar' }, items: [item('d', 'sent')] },
  ]);
  await mount();
  expect(helpTab()).toBe('Get help (2\u00a0new)');
});

it('shows no count to an account that answers for no office', async () => {
  mock.account = { id: 'student', email: 's@example.edu', via: 'email' };
  mock.load.mockResolvedValue([]);
  await mount();
  expect(mock.load).toHaveBeenCalled();
  expect(helpTab()).toBe('Get help');
});

it('asks nothing signed out, and shows no count', async () => {
  await mount();
  expect(mock.load).not.toHaveBeenCalled();
  expect(helpTab()).toBe('Get help');
});

it('shows no count when the inboxes cannot load, rather than a wrong one', async () => {
  mock.account = ADVISOR;
  mock.load.mockRejectedValue(new Error('offline'));
  await mount();
  expect(helpTab()).toBe('Get help');
});

it('drops the count when a request is marked seen in the inbox', async () => {
  mock.account = ADVISOR;
  mock.load.mockResolvedValue([inbox([item('a', 'sent'), item('b', 'sent')])]);
  mock.open.mockResolvedValue({
    studentName: 'harrison_r', studentEmail: 'h.rubin@example.edu',
    question: 'Which statistics course fits?', context: {},
    status: 'sent', reply: '', createdAt: '2099-01-01T00:00:00Z',
  });
  mock.answer.mockResolvedValue(undefined);
  await mount();
  expect(helpTab()).toBe('Get help (2\u00a0new)');

  await act(async () => button(/^Get help/)!.click());
  await act(async () => button(/student will see this/i)!.click());
  // The database now holds one request as seen; the inbox reloads after the move.
  mock.load.mockResolvedValue([inbox([item('a', 'acknowledged'), item('b', 'sent')])]);
  await act(async () => button(/^mark as seen$/i)!.click());

  expect(mock.answer).toHaveBeenCalledWith('a', 'sent', 'acknowledged', '');
  expect(helpTab()).toBe('Get help (1\u00a0new)');
});

it('drops the count from the move itself when the reload after it fails', async () => {
  mock.account = ADVISOR;
  mock.load.mockResolvedValue([inbox([item('a', 'sent')])]);
  mock.open.mockResolvedValue({
    studentName: 'harrison_r', studentEmail: 'h.rubin@example.edu',
    question: 'Which statistics course fits?', context: {},
    status: 'sent', reply: '', createdAt: '2099-01-01T00:00:00Z',
  });
  mock.answer.mockResolvedValue(undefined);
  await mount();
  expect(helpTab()).toBe('Get help (1\u00a0new)');

  await act(async () => button(/^Get help/)!.click());
  await act(async () => button(/student will see this/i)!.click());
  // The move is saved, but the reload after it does not come back.
  mock.load.mockRejectedValue(new Error('offline'));
  await act(async () => button(/^mark as seen$/i)!.click());

  expect(mock.answer).toHaveBeenCalledWith('a', 'sent', 'acknowledged', '');
  expect(helpTab()).toBe('Get help');
});
