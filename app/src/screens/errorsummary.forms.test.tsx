// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StoreProvider } from '../state/store';
import { loadSeed } from '../data/seed';
import { Housing } from './Housing';
import { Meals } from './Meals';

/**
 * Meals and Housing draw `ErrorSummary` when a submit is wrong in two places,
 * and only then: one wrong field already has focus and a live message.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLDivElement;

beforeAll(async () => {
  await loadSeed();
});
beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  act(() => {
    root = createRoot(host);
  });
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const draw = (node: ReactNode) => act(() => root.render(<StoreProvider>{node}</StoreProvider>));
const box = (label: string) => host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const press = (text: string) => act(() => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click());
const links = () => [...host.querySelectorAll<HTMLAnchorElement>('.error-summary a')].map((a) => a.textContent?.split(':')[0]);

function type(el: HTMLInputElement, value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('Housing lists the building and the hours when both are wrong, and one alone gets no list', () => {
  draw(<Housing />);
  type(box('Hours after your last exam'), 'soon');
  press('Save it');
  expect(links()).toEqual(['Residence hall', 'Hours after your last exam']);

  type(box('Residence hall'), 'Hall 4');
  expect(host.querySelector('.error-summary')).toBeNull();
});

it('Meals lists each reading it cannot use', () => {
  draw(<Meals />);
  type(box('Meal swipes left'), 'plenty');
  type(box('Commodore Cash'), 'lots');
  press('Log it');
  expect(links()).toEqual(['Meal swipes left', 'Commodore Cash']);
});
