// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ dispatch: vi.fn(), term: '2026FA', now: new Date(2026, 8, 21) }));
vi.mock('../state/store', () => ({
  useStore: () => ({ state: { term: mock.term }, dispatch: mock.dispatch }),
  useNow: () => mock.now,
}));
import { TermChoice } from './TermChoice';

/**
 * The question that used to be answered by a constant.
 *
 * `TermSwitch` offers the terms you already have courses in and hides itself
 * until there are two of them, which on a first run is none — and a first run
 * is when the answer matters most, because every course imported afterwards
 * is stamped with it. This is the other control, and it is asked once.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const chips = () =>
  [...host.querySelectorAll('button')].map((b) => ({
    label: b.textContent?.trim(),
    on: b.getAttribute('aria-pressed') === 'true',
  }));

beforeEach(() => {
  mock.dispatch.mockReset();
  mock.term = '2026FA';
  mock.now = new Date(2026, 8, 21);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const mount = () => act(() => root.render(<TermChoice />));

it('offers the calendar\'s guess already chosen, with its neighbours beside it', () => {
  mount();
  expect(chips().map((c) => c.label)).toEqual([
    'Summer 2026', 'Fall 2026', 'Winter 2026', 'Spring 2027', 'Summer 2027',
  ]);
  expect(chips().filter((c) => c.on).map((c) => c.label)).toEqual(['Fall 2026']);
});

it('sets the term when one is chosen', () => {
  mount();
  const spring = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Spring 2027');
  act(() => spring!.click());
  expect(mock.dispatch).toHaveBeenCalledWith({ type: 'setTerm', term: '2027SP' });
});

it('keeps a saved term on the row when the window has moved past it', () => {
  // Somebody who answered this in August and reopened the run in March. The
  // window no longer holds their term, and dropping it would draw a row with
  // nothing selected — which reads as no answer having been given, on the one
  // screen whose job is to have an answer.
  mock.term = '2025FA';
  mock.now = new Date(2026, 8, 21);
  mount();
  expect(chips()[0].label).toBe('Fall 2025');
  expect(chips().filter((c) => c.on).map((c) => c.label)).toEqual(['Fall 2025']);
});

it('control: the window follows the clock rather than a fixed list', () => {
  // A row hard-coded around Fall 2026 would pass every assertion above.
  mock.now = new Date(2028, 0, 9);
  mock.term = '2028SP';
  mount();
  expect(chips().map((c) => c.label)).toEqual([
    'Winter 2027', 'Spring 2028', 'Summer 2028', 'Fall 2028', 'Winter 2028',
  ]);
});
