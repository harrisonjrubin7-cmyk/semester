// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { loadSeed } from '../data/seed';
import { StoreProvider } from '../state/store';
import { PathSnapshotCard } from './PathSnapshotCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = 'semester.path-profile.v1:device';
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

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = () =>
  act(() => {
    root.render(
      <StoreProvider>
        <PathSnapshotCard />
      </StoreProvider>,
    );
  });

const type = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) =>
  act(() => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(proto.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });

it('says it is not official, and shows no remaining credits nobody entered', () => {
  render();
  expect(host.textContent).toContain('not an official degree audit or degree clearance');
  expect(host.textContent).toContain('Add credits needed');
  expect(host.querySelector('[data-source="estimated"]')).not.toBeNull();
});

it('saves the student’s path and shows it back, with the target and goals', () => {
  render();
  const input = (label: RegExp) =>
    [...host.querySelectorAll('label')].find((l) => label.test(l.textContent ?? ''))!.querySelector('input, textarea') as HTMLInputElement;
  type(input(/Programme or major/), 'Economics BA');
  type(host.querySelector('select[aria-label="Graduation season"]') as HTMLSelectElement, 'Spring');
  type(host.querySelector('input[aria-label="Graduation year"]') as HTMLInputElement, '2029');
  type(input(/Credits your degree needs/), '120');
  type(input(/Goals/) as unknown as HTMLTextAreaElement, 'Study abroad\nInternship');
  act(() => (host.querySelector('button[type="submit"]') as HTMLButtonElement).click());

  const stored = JSON.parse(localStorage.getItem(KEY)!);
  expect(stored).toMatchObject({ programme: 'Economics BA', targetTerm: { season: 'Spring', year: 2029 }, creditTarget: 120, goals: ['Study abroad', 'Internship'] });
  expect(host.textContent).toContain('Economics BA');
  expect(host.textContent).toContain('Spring 2029');
  expect(host.textContent).toMatch(/\d+ of 120/);
  expect(host.textContent).toContain('Study abroad');
});

it('says what it could not save rather than storing a half-typed year', () => {
  render();
  type(host.querySelector('select[aria-label="Graduation season"]') as HTMLSelectElement, 'Fall');
  type(host.querySelector('input[aria-label="Graduation year"]') as HTMLInputElement, '20');
  act(() => (host.querySelector('button[type="submit"]') as HTMLButtonElement).click());
  expect(JSON.parse(localStorage.getItem(KEY)!).targetTerm).toBeNull();
  expect(host.querySelector('[role="status"]')?.textContent).toMatch(/target year/);
});
