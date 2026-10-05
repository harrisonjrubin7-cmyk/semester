// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import type { CatalogCourse } from '../lib/registration';
import { REGISTRATION_DAY_KEY } from '../lib/registration-day';
import { RegistrationDay } from './RegistrationDay';

/**
 * The registration-day tab, driven as a student would: pick a backup, tick
 * the checklist, and never see anything that claims to have registered them.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const course = (id: string, patch: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id,
  code: 'CS 101',
  section: '01',
  title: 'Programming',
  term: 'Spring 2027',
  department: 'CS',
  credits: 3,
  instructor: '',
  location: '',
  description: '',
  prerequisites: '',
  seats: 10,
  meetings: [{ days: [1, 3], start: 540, end: 590 }],
  ...patch,
});
const cs1 = course('cs1');
const cs2 = course('cs2', { section: '02', meetings: [{ days: [2, 4], start: 540, end: 615 }] });

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

const mount = (cart: CatalogCourse[]) =>
  act(() =>
    root.render(<RegistrationDay catalog={[cs1, cs2]} cart={cart} institution="Example University" onOpenCart={() => {}} />),
  );

it('asks for a cart first when there is nothing in it', () => {
  mount([]);
  expect(host.textContent).toContain('Plan your registration day');
});

it('adds a backup from the offered sections and saves it on the device', () => {
  mount([cs1]);
  expect(host.textContent).toContain('No backup yet.');
  const select = host.querySelector<HTMLSelectElement>('select[aria-label="Add a backup for CS 101 section 01"]')!;
  expect([...select.options].map((o) => o.value)).toEqual(['', 'cs2']);
  act(() => {
    select.value = 'cs2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.querySelector('ol[aria-label="Backups for CS 101 section 01"]')?.textContent).toContain('CS 101 · Section 02');
  expect(JSON.parse(localStorage.getItem(REGISTRATION_DAY_KEY)!).backups).toEqual({ cs1: ['cs2'] });
});

it('says plainly that it registers nobody, and names the seat source', () => {
  mount([cs1]);
  expect(host.textContent).toContain('Semester never registers for you.');
  expect(host.textContent).toContain('not live');
  expect(host.textContent).toContain('Student entered');
});

it('every control has an accessible name', () => {
  mount([cs1]);
  for (const el of host.querySelectorAll('input, select, button')) {
    const named =
      el.getAttribute('aria-label') ||
      el.closest('label')?.textContent?.trim() ||
      el.textContent?.trim();
    expect(named, el.outerHTML).toBeTruthy();
  }
});
