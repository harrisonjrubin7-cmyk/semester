// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

/**
 * The slot the screens use: off, it returns before it touches the store, so a
 * screen that has never heard of this renders as it did; on, it keys the
 * device store to the account and to the student's own day.
 */

const mock = vi.hoisted(() => ({ on: false, account: null as string | null, storeCalls: 0 }));

vi.mock('../lib/momentfeedback', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/momentfeedback')>()),
  momentFeedbackOn: () => mock.on,
}));
vi.mock('../state/store', () => ({
  useAccountId: () => {
    mock.storeCalls += 1;
    return mock.account;
  },
  useNow: () => {
    mock.storeCalls += 1;
    return new Date(2026, 9, 1, 12, 0);
  },
}));

import { FeedbackPanelSlot } from './FeedbackPanel';
import { MomentPromptSlot } from './MomentPrompt';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  mock.on = false;
  mock.account = null;
  mock.storeCalls = 0;
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('draws nothing, reads nothing and touches no store while the flag is off', () => {
  act(() => root.render(<><MomentPromptSlot moment="ai-answer" /><FeedbackPanelSlot /></>));
  expect(host.innerHTML).toBe('');
  expect(mock.storeCalls).toBe(0);
  expect(localStorage.length).toBe(0);
});

it('asks under the signed-in account’s key, on the student’s own day, when the flag is on', () => {
  mock.on = true;
  mock.account = 'acct-9';
  act(() => root.render(<MomentPromptSlot moment="support-routed" />));
  act(() => button(/^Yes$/)!.click());
  expect(Object.keys(localStorage)).toEqual(['semester.moment-feedback.v1:acct-9']);
  expect(JSON.parse(localStorage.getItem('semester.moment-feedback.v1:acct-9')!).answers).toEqual([
    { moment: 'support-routed', choice: 'yes', category: 'worked', on: '2026-10-01' },
  ]);
});

it('keeps one account’s answers from another’s, and a signed-out visit apart from both', () => {
  mock.on = true;
  mock.account = 'acct-1';
  act(() => root.render(<MomentPromptSlot moment="ai-answer" />));
  act(() => button(/^Yes$/)!.click());
  act(() => root.render(<div />));
  mock.account = 'acct-2';
  act(() => root.render(<MomentPromptSlot moment="ai-answer" />));
  expect(host.querySelector('[role=group]')).not.toBeNull(); // acct-2 has never been asked
  act(() => root.render(<div />));
  mock.account = null;
  act(() => root.render(<FeedbackPanelSlot />));
  expect(host.textContent).toMatch(/No answers are saved on this device\./);
  expect(localStorage.getItem('semester.moment-feedback.v1:device')).toBeNull();
});
