// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { StudyAbroad } from './StudyAbroad';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const KEY = 'semester.abroad.v1:acct';
let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<StudyAbroad storageKey={KEY} />));
});

/* No root outlives the test that made it. See `src/rootunmount.test.ts`. */
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''))!;
const field = (label: RegExp, n = 0) =>
  [...host.querySelectorAll('label')].filter((l) => label.test(l.querySelector('span')?.textContent ?? ''))[n].querySelector('input, select, textarea') as HTMLInputElement;
const set = (el: HTMLInputElement | HTMLSelectElement, value: string) =>
  act(() => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? '{}');

it('starts empty and says how to begin', () => {
  expect(host.textContent).toContain('No program yet');
  expect(host.textContent).toContain('your study abroad office and advisor decide');
});

it('keeps approvals apart: only what the student recorded as pre-approved is counted', () => {
  act(() => button(/Add a program/).click());
  set(field(/Credits you hope/), '12');
  act(() => button(/Add a course abroad/).click());
  act(() => button(/Add a course abroad/).click());
  set(field(/Where it stands/, 0), 'pre-approved');
  set(field(/Recorded from/, 0), 'Department email, 2 Oct');
  // The second stays at its default, estimated.
  expect(host.textContent).toContain('3 of 12 credits recorded as pre-approved · 3 estimated, not reviewed · 6 with no course matched yet');
  expect(host.textContent).toContain('Plan your graduation on the pre-approved credit only.');
  expect(stored().courses.map((c: { status: string }) => c.status)).toEqual(['pre-approved', 'estimated']);
});

it('says the approval statuses are the student\'s own record and not an official credit evaluation', () => {
  act(() => button(/Add a program/).click());
  act(() => button(/Add a course abroad/).click());
  const line = [...host.querySelectorAll('p')].find((p) => /not an official credit evaluation/.test(p.textContent ?? ''));
  expect(line, 'the credit section says what its statuses are').toBeTruthy();
  expect(line!.querySelector('[data-source="student_entered"]')).not.toBeNull();
  expect(line!.textContent).toContain('Student entered');
  expect(line!.textContent).toContain('registrar or department decides');
});

it('shows the course plan in full before it is copied, and sends nothing', () => {
  act(() => button(/Add a program/).click());
  act(() => button(/Add a course abroad/).click());
  const preview = host.querySelector('pre[aria-label="Course plan to copy"]')!;
  expect(preview.textContent).toContain('as I recorded them; the written decisions are what count');
  expect(host.textContent).toContain('Semester sends nothing');
});

it('compares programs side by side without converting or adding up costs', () => {
  act(() => button(/Add a program/).click());
  set(field(/Total cost/), '18500');
  set(field(/Currency/), 'eur');
  act(() => button(/Add a program/).click());
  expect(host.querySelector('table')?.textContent).toContain('18,500 EUR');
  expect(host.querySelector('table')?.textContent).toContain('Not entered');
  expect(host.textContent).toContain('not converted or added up');
});

it('removes a program with its courses and steps', () => {
  act(() => button(/Add a program/).click());
  act(() => button(/Add a course abroad/).click());
  act(() => (host.querySelector('.abroad-steps input') as HTMLInputElement).click());
  act(() => button(/Remove this program/).click());
  expect(stored()).toEqual({ programs: [], courses: [], steps: {} });
});
