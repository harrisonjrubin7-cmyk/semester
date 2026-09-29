// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { TRANSFER_CREDIT_KEY, type Rule } from '../lib/transfer-credit';
import { TransferCredit } from './TransferCredit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const published: Rule[] = [
  { fromInstitution: 'exp-u/nashville-state-cc', fromCourse: 'CSC 1010', toCourse: 'CS 101', credits: 3, source: 'institution_verified' },
];

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const field = (label: string) =>
  [...host.querySelectorAll('input')].find((i) => i.closest('label')?.textContent?.trim().startsWith(label))!;

const type = (el: HTMLInputElement, value: string) =>
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

const button = (name: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!;

it('without an account, says how to see published equivalencies and still works', () => {
  act(() => root.render(<TransferCredit school={null} loadPublished={null} />));
  expect(host.textContent).toContain('Sign in with your school account');
  expect(host.textContent).toContain('Only your school decides what transfers.');
});

it('adds a prior course, matches it to a published equivalency and saves it on the device', async () => {
  await act(async () => {
    root.render(<TransferCredit school="Expansion University" loadPublished={async () => published} />);
  });
  expect(host.textContent).toContain('1 published equivalency from Expansion University.');
  type(field('Previous school'), 'Nashville State CC');
  type(field('Course code'), 'csc-1010');
  type(field('Title'), 'Intro to Programming');
  act(() => button('Add course').click());
  expect(host.textContent).toContain('Published equivalency');
  expect(host.textContent).toContain('Might count as CS 101');
  // No guess field for a course the school has already published.
  expect(field('What you think it counts as')).toBeUndefined();
  expect(JSON.parse(localStorage.getItem(TRANSFER_CREDIT_KEY)!).courses).toHaveLength(1);
  expect(host.querySelector('pre')?.textContent).toContain('not a decision about credit');
});

it('reads as estimated when only the student has guessed, and says it sends nothing', async () => {
  await act(async () => {
    root.render(<TransferCredit school={null} loadPublished={async () => { throw new Error('offline'); }} />);
  });
  expect(host.textContent).toContain('could not be read right now');
  type(field('Previous school'), 'Belmont');
  type(field('Course code'), 'ART 1030');
  act(() => button('Add course').click());
  expect(host.textContent).toContain('Not evaluated');
  type(field('What you think it counts as'), 'ART 100');
  expect(host.textContent).toContain('Estimated equivalent');
  expect(host.textContent).toContain('Semester does not send this for you.');
});

it('every control has an accessible name', () => {
  act(() => root.render(<TransferCredit school={null} loadPublished={null} />));
  for (const el of host.querySelectorAll('input, select, button')) {
    const named = el.getAttribute('aria-label') || el.closest('label')?.textContent?.trim() || el.textContent?.trim();
    expect(named, el.outerHTML).toBeTruthy();
  }
});

it('is a Degree tab only with its flag on', async () => {
  const { loadSeed } = await import('../data/seed');
  const { StoreProvider } = await import('../state/store');
  const { STORAGE_KEY } = await import('../state/shape');
  const { Degree } = await import('../screens/Degree');
  await loadSeed();
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, seenOnboarding: true, sample: false, courses: [] }));
  const tab = () => [...host.querySelectorAll('button, [role="tab"], [role="radio"]')].find((b) => b.textContent === 'Transfer credit');
  await act(async () => root.render(<StoreProvider><Degree transferCredit={false} /></StoreProvider>));
  expect(tab()).toBeUndefined();
  await act(async () => root.render(<StoreProvider><Degree transferCredit /></StoreProvider>));
  const on = tab() as HTMLElement;
  expect(on).toBeTruthy();
  await act(async () => on.click());
  expect(host.textContent).toContain('Prepare your credit evaluation');
});
