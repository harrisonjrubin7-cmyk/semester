// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { LearnerPathways } from './LearnerPathways';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = 'semester.learner-pathways.v1:panel-test';
let root: Root;
let host: HTMLDivElement;
let started: string[];

beforeEach(() => {
  localStorage.removeItem(KEY);
  started = [];
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
  localStorage.removeItem(KEY);
});

const render = () =>
  act(() => root.render(<LearnerPathways storageKey={KEY} onStart={(kind) => started.push(kind)} />));
const box = (label: RegExp) =>
  [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input')!;
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.getAttribute('aria-label') ?? ''));

it('starts with nothing ticked and nothing offered', () => {
  render();
  expect([...host.querySelectorAll('input[type=checkbox]')].some((i) => (i as HTMLInputElement).checked)).toBe(false);
  expect(host.querySelectorAll('button')).toHaveLength(0);
});

it('offers a pathway’s checklists once ticked, starts one, and remembers the tick', () => {
  render();
  act(() => box(/I work, or I’m coming back/).click());
  const start = button(/Returning or working student/);
  expect(start).toBeDefined();
  act(() => start!.click());
  expect(started).toEqual(['Returning or working student']);
  expect(host.textContent).toMatch(/Course search can filter to evening \(starting at 5 pm or later\) sections\./);
  expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(['working']);
});

it('unticking takes the offer away and forgets the choice', () => {
  localStorage.setItem(KEY, JSON.stringify(['military']));
  render();
  expect(button(/Military-connected student/)).toBeDefined();
  expect(host.textContent).toMatch(/never calculates/);
  act(() => box(/veteran, service member/).click());
  expect(button(/Military-connected student/)).toBeUndefined();
  expect(localStorage.getItem(KEY)).toBeNull();
});

it('says who sees it before anybody ticks anything', () => {
  render();
  expect(host.textContent).toMatch(/stays on this device: no office, instructor or supporter can see it/);
});
