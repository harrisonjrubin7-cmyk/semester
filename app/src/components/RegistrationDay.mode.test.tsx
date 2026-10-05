// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CatalogCourse } from '../lib/registration';
import { REGISTRATION_DAY_KEY } from '../lib/registration-day';
import { RegistrationDay } from './RegistrationDay';

/**
 * The registration-day tab with Registration Day Mode on (Phase C), and off
 * as the control: off, not one of the mode's panels is there.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLDivElement;

const course = (id: string, patch: Partial<CatalogCourse> = {}): CatalogCourse => ({
  id, code: 'CS 101', section: '01', title: 'Programming', term: 'Spring 2027', department: 'CS', credits: 3,
  instructor: '', location: '', description: '', prerequisites: '', seats: 10,
  meetings: [{ days: [1, 3], start: 540, end: 590 }], ...patch,
});
const cs1 = course('cs1', { crn: '55012' });
const cs2 = course('cs2', { section: '02', meetings: [{ days: [2, 4], start: 540, end: 615 }] });

beforeEach(() => {
  localStorage.clear();
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

const mount = (mode: boolean) =>
  act(() =>
    root.render(
      <RegistrationDay
        catalog={[cs1, cs2]}
        cart={[cs1]}
        institution="Example University"
        importedAt="2027-03-30T12:00:00.000Z"
        onOpenCart={() => {}}
        mode={mode}
      />,
    ),
  );
const stored = () => JSON.parse(localStorage.getItem(REGISTRATION_DAY_KEY) ?? '{}');
const type = (el: HTMLInputElement, value: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const button = (name: RegExp) => [...host.querySelectorAll('button')].find((b) => name.test(b.textContent ?? ''))!;

describe('with Registration Day Mode off', () => {
  it('follows the registration_day_mode flag, which no build variable sets here', () => {
    act(() =>
      root.render(<RegistrationDay catalog={[cs1, cs2]} cart={[cs1]} institution="Example University" onOpenCart={() => {}} />),
    );
    expect(host.textContent).not.toContain('Your plan at a glance');
  });

  it('is the tab #762 shipped', () => {
    mount(false);
    for (const phrase of ['Your plan at a glance', 'Course references', 'Seat alerts', 'Show Registration Day Mode', 'Open official registration system', 'Save address']) {
      expect(host.textContent, phrase).not.toContain(phrase);
    }
  });
});

describe('with Registration Day Mode on', () => {
  it('checks credits against the target the student types, and only then', () => {
    mount(true);
    expect(host.textContent).toContain('3 credits selected');
    type(host.querySelector<HTMLInputElement>('input[aria-label="Credits I plan to register for"]')!, '12');
    expect(stored().creditTarget).toBe(12);
    expect(host.textContent).toContain('3 credits selected, 9 under your 12-credit target');
  });

  it('estimates the term\'s load from the student\'s own numbers, as an estimate and never a verdict', () => {
    mount(true);
    const load = host.querySelector('#regday-load')!.closest('section')!;
    expect(load.textContent).toContain('3 credits in the plan.');
    expect(load.textContent).toContain('Estimated 6 hours a week');
    expect(load.textContent).toContain('not a credit check');
    expect(load.textContent).toContain('Not checked yet: your school’s credit limits');
    expect(load.querySelector('[data-source="estimated"]')).not.toBeNull();
    expect(load.textContent).not.toMatch(/not allowed|must|denied/i);

    type(load.querySelector<HTMLInputElement>('input[aria-label="Fewest credits my school asks for full-time"]')!, '12');
    type(load.querySelector<HTMLInputElement>('input[aria-label="Hours a week I can study after work and travel"]')!, '5');
    expect(stored().minCredits).toBe(12);
    expect(stored().studyHours).toBe(5);
    const after = host.querySelector('#regday-load')!.closest('section')!;
    expect(after.textContent).toContain('9 credits under the 12-credit minimum you entered');
    expect(after.textContent).toContain('1 hour more than the 5 you said you have');
    expect(after.textContent).toContain('Nothing here stops you from registering');
  });

  it('keeps an https address for the official system and refuses anything else', () => {
    mount(true);
    const field = () => host.querySelector<HTMLInputElement>('input[aria-label="Your school’s registration system address"]')!;
    type(field(), 'javascript:alert(1)');
    act(() => field().form!.requestSubmit());
    expect(stored().portalUrl ?? null).toBeNull();
    expect(host.textContent).toContain('Use the https:// address');
    type(field(), 'https://register.example.edu');
    act(() => field().form!.requestSubmit());
    expect(stored().portalUrl).toBe('https://register.example.edu/');
    expect(button(/^Open official registration system$/)).toBeTruthy();
  });

  it('says where seat counts come from, and that there are no seat alerts without a live feed', () => {
    mount(true);
    expect(host.textContent).toContain('Seat counts as of your last catalog import');
    expect(host.textContent).toContain('Seat alerts are not available');
    expect(host.querySelector('input[type="checkbox"][aria-label*="seat" i]')).toBeNull();
  });

  it('works the checks it can see out for itself, and lists course references with the CRN', () => {
    mount(true);
    const checks = host.querySelector('ul[aria-label="Checks Semester can see"]')!;
    expect(checks.textContent).toContain('Backup courses saved for every section');
    expect(checks.querySelectorAll('input')).toHaveLength(0);
    expect(host.textContent).toContain('CS 101 01 · CRN 55012');
  });

  it('stores the reminder and Today switches', () => {
    mount(true);
    const box = (name: RegExp) =>
      [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((i) => name.test(i.closest('label')?.textContent ?? ''))!;
    expect(box(/Remind me/).checked).toBe(true);
    act(() => box(/Remind me/).click());
    expect(stored().remind).toBe(false);
    act(() => box(/Show Registration Day Mode on Today now/).click());
    expect(stored().manual).toBe(true);
  });

  describe('after the student leaves for the official system', () => {
    const saveAddress = () => {
      const field = host.querySelector<HTMLInputElement>('input[aria-label="Your school’s registration system address"]')!;
      type(field, 'https://register.example.edu');
      act(() => field.form!.requestSubmit());
    };
    const status = () => host.querySelector<HTMLSelectElement>('select[aria-label="Where your registration stands"]');
    const choose = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(status()!, value);
        status()!.dispatchEvent(new Event('change', { bubbles: true }));
      });

    it('asks nothing until there is an official system to have left for', () => {
      mount(true);
      expect(status()).toBeNull();
      expect(host.textContent).not.toContain('After you leave');
      saveAddress();
      expect(status()).not.toBeNull();
    });

    it('keeps the student’s own report on the device, and says it is theirs', () => {
      mount(true);
      saveAddress();
      choose('submitted');
      expect(stored().handoff.status).toBe('submitted');
      expect(stored().handoff.history.map((e: { status: string }) => e.status)).toEqual(['not_started', 'submitted']);
      expect(host.textContent).toContain('You marked this “Submitted” today.');
      expect(host.textContent).toContain('Semester cannot see the official system');
      expect(host.textContent).not.toMatch(/went through|you are registered/i);
    });

    it('stores a destination, a status and times, and nothing about the case', () => {
      mount(true);
      saveAddress();
      choose('need_more_information');
      expect(Object.keys(stored().handoff).sort()).toEqual(['destination', 'history', 'status', 'updatedAt']);
    });

    it('can be cleared, and then says nothing about how it went', () => {
      mount(true);
      saveAddress();
      choose('scheduled');
      act(() => button(/^Clear this note$/).click());
      expect(stored().handoff).toBeNull();
      expect(host.textContent).toContain('Only you can say how it went');
    });

    it('is still there when the tab is opened again', () => {
      mount(true);
      saveAddress();
      choose('received');
      act(() => root.unmount());
      root = createRoot(host);
      mount(true);
      expect(status()!.value).toBe('received');
    });
  });

  it('every control has an accessible name', () => {
    mount(true);
    for (const el of host.querySelectorAll('input, select, button')) {
      const named = el.getAttribute('aria-label') || el.closest('label')?.textContent?.trim() || el.textContent?.trim();
      expect(named, el.outerHTML).toBeTruthy();
    }
  });
});
