// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { QuizQuestion } from '../state/store';

/**
 * Under an answered quiz question: the review offer and the report, both the
 * student's to make and both undoable. The store is stubbed so what reaches
 * the scheduler can be read off the dispatches.
 */

const mock = vi.hoisted(() => ({ dispatch: vi.fn(), reviews: {} as Record<string, unknown> }));
vi.mock('../state/store', () => ({
  useStore: () => ({ state: { reviews: mock.reviews }, dispatch: mock.dispatch, account: { id: 'acct' } }),
}));
const { QuizFeedback } = await import('./QuizFeedback');
const { cardIdentity } = await import('../lib/review');

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  mock.dispatch.mockReset();
  mock.reviews = {};
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const choice: QuizQuestion = {
  kind: 'choice',
  q: 'What is opportunity cost?',
  unit: 'Choices',
  full: 'The value of the next best alternative.',
  cardId: 'c7',
  opts: [
    { text: 'The value of the next best alternative.', ok: true },
    { text: 'The price paid.', ok: false },
  ],
};
const KEY = cardIdentity('econ', { id: 'c7', q: choice.q });

const render = (missed: boolean, question: QuizQuestion = choice) =>
  act(() => root.render(<QuizFeedback question={question} courseId="econ" missed={missed} />));
const button = (text: string | RegExp) =>
  [...host.querySelectorAll('button')].find((b) => (typeof text === 'string' ? b.textContent?.trim() === text : text.test(b.textContent ?? '')));

it('offers review only after a miss, and sends nothing to the schedule until asked', () => {
  render(false);
  expect(button('Review this card soon')).toBeUndefined();
  render(true);
  expect(mock.dispatch).not.toHaveBeenCalled();
  act(() => button('Review this card soon')!.click());
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'recordCard', key: KEY, got: false });
  expect(host.textContent).toContain('Added to your review');
});

it('undoes the review back to the row it replaced', () => {
  const row = { seen: 3, right: 3, wrong: 0, ease: 2.5, interval: 6, due: 1 };
  mock.reviews = { [KEY]: row };
  render(true);
  act(() => button('Review this card soon')!.click());
  act(() => button('Undo')!.click());
  expect(mock.dispatch).toHaveBeenLastCalledWith({ type: 'restoreReview', key: KEY, was: row });
  expect(button('Review this card soon')).toBeDefined();
});

it('keeps a report on this device, says what it does, and takes it back', () => {
  render(false);
  act(() => button('The marked answer is wrong')!.click());
  const stored = JSON.parse(localStorage.getItem('semester.quizfeedback.v1:acct') ?? '{}');
  expect(stored.reports).toEqual([expect.objectContaining({ key: KEY, courseId: 'econ', reason: 'answer', q: choice.q })]);
  expect(host.textContent).toContain('left out of your quizzes');
  expect(host.textContent).toContain('Kept on this device only');
  expect(mock.dispatch).not.toHaveBeenCalled();
  act(() => button('Undo')!.click());
  expect(JSON.parse(localStorage.getItem('semester.quizfeedback.v1:acct') ?? '{}').reports).toEqual([]);
  expect(host.textContent).toContain('Something wrong with this question?');
});

it('offers nothing on a matching question, which has no card to name', () => {
  render(true, { ...choice, kind: 'match', opts: [], cardId: undefined });
  expect(host.textContent).toBe('');
});
