// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { CampusDirectory } from './CampusDirectory';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const seed = (kind: string, items: object[]) =>
  localStorage.setItem(`semester.directory.${kind}`, JSON.stringify({ institution: 'Test School', updated: '2026-09-01T00:00:00.000Z', items }));

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const names = () => [...host.querySelectorAll('article h3')].map((h) => h.textContent);
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''));

it('lists upcoming events by date, with the date on each, and keeps past ones aside until asked', () => {
  seed('events', [
    { id: 'b', name: 'Career fair', starts: '2099-03-02' },
    { id: 'a', name: 'Welcome talk', starts: '2099-01-15T18:30', url: 'https://example.edu/talk' },
    { id: 'old', name: 'Last year’s fair', starts: '2000-03-02' },
  ]);
  act(() => root.render(<CampusDirectory kind="events" />));
  expect(names()).toEqual(['Welcome talk', 'Career fair']);
  expect(host.querySelector('.directory-when')?.textContent).toBe('Thu, Jan 15, 18:30');
  act(() => button(/Show past events \(1\)/)!.click());
  expect(names()).toEqual(['Welcome talk', 'Career fair', 'Last year’s fair']);
  expect(host.textContent).toContain('· Ended');
});

it('says so when nothing is upcoming, rather than showing an empty grid', () => {
  seed('events', [{ id: 'old', name: 'Old talk', starts: '2000-01-01' }]);
  act(() => root.render(<CampusDirectory kind="events" />));
  expect(host.textContent).toContain('Nothing upcoming in this directory.');
});

it('speaks as a departments directory, with a template to hand to the school', () => {
  act(() => root.render(<CampusDirectory kind="departments" />));
  expect(host.textContent).toContain('Explore departments & offices');
  expect(host.textContent).toContain('Who to ask, where they are and when they are open');
  expect(host.textContent).not.toMatch(/Find your community|clubs/);
  expect(button(/Download school template/)).toBeDefined();
});
