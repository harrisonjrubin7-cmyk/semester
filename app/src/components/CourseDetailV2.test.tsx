// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { SHORTLIST_KEY } from '../lib/course-detail';
import * as courseRules from '../lib/courserules';
import type { CoursePublicationsState } from '../lib/courserules';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { RegistrationPortal } from './RegistrationPortal';

const publicationMock = {
  current: { status: 'disabled', publications: {} } as {
    status: CoursePublicationsState['status'];
    publications: CoursePublicationsState['publications'];
  },
  retry: vi.fn(),
  calls: [] as Parameters<typeof courseRules.useCoursePublicationsState>[],
};

/**
 * Phase F on screen, through the registration workspace: with the flag off,
 * the old side panel (the control); with it on, Course Detail V2 as a sheet on
 * a phone and a drawer on a desktop, the add-to-cart preview, the official
 * catalog hand-off, and saved courses compared side by side.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let width = 390;
let dispatch: ReturnType<typeof useStore>['dispatch'] = () => undefined;
// jsdom has no `matchMedia`; whatever was there before this file is put back
// after it, because the worker keeps the window between files.
const hadMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

const REG_KEY = 'semester.registration.v1';
const section = (over: Record<string, unknown>) => ({
  code: 'ECON 2010',
  section: '01',
  title: 'Intermediate Micro',
  term: 'Spring 2027',
  department: 'ECON',
  credits: 3,
  instructor: 'Prof. Ruiz',
  location: 'Calhoun 101',
  description: 'Consumer and producer theory, with regression and a written brief.',
  prerequisites: 'ECON 1010 and MATH 1100',
  seats: 12,
  meetings: [{ days: [1, 3], start: '09:00', end: '10:15' }],
  ...over,
});

beforeAll(async () => {
  await loadSeed();
});

beforeEach(() => {
  window.location.hash = '';
  window.matchMedia = ((q: string) => {
    // Only a min-width query is answered from `width`. Anything else is
    // false: `?? 0` here once said yes to `(display-mode: standalone)`, and
    // a later file in the same worker was told the page was installed.
    const min = /min-width:\s*(\d+)px/.exec(q);
    return { matches: min ? width >= Number(min[1]) : false, addEventListener: () => {}, removeEventListener: () => {} };
  }) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      term: '2027SP',
      courses: [],
      requirements: [{ id: 'core', programme: 'Economics major', name: 'Core theory', need: 'courses', count: 2, accepts: ['ECON 2010', 'ECON 2020'], note: '' }],
      taken: [{ id: 't1', code: 'ECON 1010', title: 'Principles', term: 'Fall 2026', hours: 3, grade: 'A', current: false }],
    }),
  );
  localStorage.setItem(
    REG_KEY,
    JSON.stringify({
      catalog: {
        institution: 'Example University',
        importedAt: new Date().toISOString(),
        courses: [
          section({ id: 'e1', url: 'https://catalog.example.edu/econ-2010', modality: 'In person' }),
          section({ id: 'e3', code: 'ECON 3010', title: 'Game Theory', prerequisites: 'ECON 2010', meetings: [{ days: [2], start: '13:00', end: '14:15' }] }),
          section({ id: 'p1', code: 'PSCI 1100', title: 'Politics', department: 'PSCI', prerequisites: '', meetings: [{ days: [1], start: '09:30', end: '10:45' }] }),
        ],
      },
      cart: [],
      plans: [],
    }),
  );
  publicationMock.current = { status: 'disabled', publications: {} };
  publicationMock.retry.mockReset();
  publicationMock.calls.length = 0;
  vi.spyOn(courseRules, 'useCoursePublicationsState').mockImplementation((...args) => {
    publicationMock.calls.push(args);
    return { ...publicationMock.current, error: '', retry: publicationMock.retry };
  });
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  width = 390;
  if (hadMatchMedia) Object.defineProperty(window, 'matchMedia', hadMatchMedia);
  else delete (window as { matchMedia?: unknown }).matchMedia;
  vi.restoreAllMocks();
});

const mount = async (courseDetail: boolean) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <StoreCapture />
        <RegistrationPortal courseDetail={courseDetail} />
      </StoreProvider>,
    );
  });
};
const StoreCapture = () => {
  const next = useStore().dispatch;
  useEffect(() => {
    dispatch = next;
  }, [next]);
  return null;
};
const text = (el: ParentNode = host) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp, within: ParentNode = host) => {
  const found = [...within.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...within.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};
const open = async (code: string) => {
  const result = [...host.querySelectorAll('.portal-course-description')].find((b) => b.textContent?.includes(code)) as HTMLButtonElement;
  await act(async () => result.click());
};
const cart = () => JSON.parse(localStorage.getItem(REG_KEY)!).cart as string[];

describe('with course_detail_v2 off', () => {
  it('keeps the side panel exactly as before', async () => {
    await mount(false);
    await open('ECON 2010');
    expect(host.querySelector('.registration-detail')?.textContent).toContain('Course information');
    expect(host.querySelector('.course-v2')).toBeNull();
    expect(host.querySelector('.course-compare')).toBeNull();
  });
});

describe('with course_detail_v2 on', () => {
  it('opens as a sheet on a phone, with every section and where each came from', async () => {
    await mount(true);
    expect(host.querySelector('.registration-detail')).toBeNull();
    await open('ECON 2010');
    const sheet = host.querySelector('[role="dialog"]')!;
    expect(sheet.classList.contains('explain-sheet')).toBe(true);
    expect(document.activeElement?.textContent).toBe('Intermediate Micro');
    const headings = [...sheet.querySelectorAll('h3')].map((h) => h.childNodes[0].textContent?.trim());
    expect(headings).toEqual([
      'Why it may fit',
      'Requirement fit',
      'Prerequisites and corequisites',
      'Schedule fit',
      'Plan impact',
      'Description',
      'Skills and career directions',
      'Related future courses',
    ]);
    const badge = (title: string) =>
      [...sheet.querySelectorAll('h3')].find((h) => h.textContent?.startsWith(title))?.querySelector('[data-source]')?.getAttribute('data-source');
    expect(badge('Prerequisites')).toBe('imported');
    expect(badge('Requirement fit')).toBe('estimated');
    expect(badge('Description')).toBe('imported');
    const fact = (dt: string) => [...sheet.querySelectorAll('.course-v2-facts > div')].find((d) => d.querySelector('dt')?.textContent === dt)?.querySelector('dd')?.textContent;
    expect(fact('Modality')).toBe('In person');
    expect(fact('Meets')).toBe('Mon/Wed 09:00–10:15');
    expect(text(sheet)).toContain('not live availability, and not a seat for you');
    expect(text(sheet)).toContain('Core theory — 2 courses still needed');
    expect(text(sheet)).toContain('You recorded ECON 1010 (Fall 2026).');
    expect(text(sheet)).toContain('MATH 1100 is not in the courses you have recorded.');
    expect(text(sheet)).toContain('ECON 3010 · Game Theory lists ECON 2010 as a prerequisite.');
    expect(text(sheet)).toContain('Semester shows no professor ratings');
    expect(text(sheet)).not.toMatch(/eligible|guaranteed/i);
  });

  it('adds to the cart only after a preview, with focus on Cancel', async () => {
    await mount(true);
    await open('ECON 2010');
    await act(async () => button(/^Add to cart…$/).click());
    const dialog = [...host.querySelectorAll('[role="dialog"]')].find((d) => d.classList.contains('dialog'))!;
    expect(text(dialog)).toContain('Your cart goes from 0 to 3 credits.');
    expect(text(dialog)).toContain('does not register you, and it does not hold a seat');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(cart()).toEqual([]);
    await act(async () => button(/^Cancel$/, dialog).click());
    expect(cart()).toEqual([]);
    await act(async () => button(/^Add to cart…$/).click());
    await act(async () => button(/^Add to cart$/).click());
    expect(cart()).toEqual(['e1']);
    expect(text()).toContain('Nothing was submitted to your school.');
    expect(button(/^Remove from cart…$/)).toBeTruthy();
  });

  it('shows a clash with the cart once the other course is in it', async () => {
    localStorage.setItem(REG_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(REG_KEY)!), cart: ['p1'] }));
    await mount(true);
    await open('ECON 2010');
    expect(text()).toContain('Mon 09:00–10:15 overlaps PSCI 1100 (in your cart).');
    expect(text()).toContain('Your cart goes from 3 to 6 credits.');
  });

  it('opens the official catalog only after saying Semester cannot see it', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);
    await mount(true);
    await open('ECON 2010');
    await act(async () => button(/^Official catalog…$/).click());
    expect(text()).toContain('You are leaving Semester');
    expect(opened).not.toHaveBeenCalled();
    await act(async () => button(/^Open catalog$/).click());
    expect(opened).toHaveBeenCalledWith('https://catalog.example.edu/econ-2010', '_blank', 'noopener,noreferrer');
  });

  it('shows published guidance and study packs with provenance and confirms an external reference', async () => {
    publicationMock.current = {
      status: 'ready',
      publications: {
        'ECON 2010': {
          guidance: { body: 'Work the practice set before office hours.', published: '2026-10-05' },
          packs: [
            {
              id: 'pack-1',
              title: 'Midterm review',
              note: 'Use these after lecture 4.',
              published: '2026-10-06',
              items: [
                {
                  title: 'Week 4 slides',
                  citation: 'Slides 12–24',
                  link: 'https://lms.example.edu/week-4',
                  authority: 'supplemental',
                },
              ],
            },
          ],
        },
      },
    };
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);

    await mount(true);
    await open('ECON 2010');

    expect(text()).toContain('Instructor publications');
    expect(host.querySelector('[data-source="connected"]')).not.toBeNull();
    expect(publicationMock.calls.at(-1)?.slice(0, 4)).toEqual([['ECON 2010'], '2027SP', '', 'vanderbilt']);
    expect(text()).toContain('Work the practice set before office hours.');
    expect(text()).toContain('From your instructor · published 2026-10-05');
    expect(text()).toContain('Midterm review');
    expect(text()).toContain('Use these after lecture 4.');
    expect(text()).toContain('Week 4 slides · Supplemental · Slides 12–24');
    expect(text()).toContain('From your instructor · published 2026-10-06');
    expect(text()).not.toContain('A faculty-approved study pack, when an instructor publishes one.');

    await act(async () => button(/^Open Week 4 slides…$/).click());
    expect(text()).toContain('You are leaving Semester');
    expect(text()).toContain('https://lms.example.edu/week-4');
    expect(opened).not.toHaveBeenCalled();
    await act(async () => button(/^Open reference$/).click());
    expect(opened).toHaveBeenCalledWith('https://lms.example.edu/week-4', '_blank', 'noopener,noreferrer');
  });

  it('closes a publication reference confirmation when the exact publication scope changes', async () => {
    publicationMock.current = {
      status: 'ready',
      publications: {
        'ECON 2010': {
          packs: [
            {
              id: 'pack-1',
              title: 'Midterm review',
              note: '',
              published: '2026-10-06',
              items: [{ title: 'Week 4 slides', citation: '', link: 'https://lms.example.edu/week-4', authority: 'supplemental' }],
            },
          ],
        },
      },
    };
    const opened = vi.spyOn(window, 'open').mockReturnValue(null);

    await mount(true);
    await open('ECON 2010');
    await act(async () => button(/^Open Week 4 slides…$/).click());
    expect(text()).toContain('https://lms.example.edu/week-4');
    expect(document.activeElement?.textContent).toBe('Cancel');

    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    });

    expect(document.activeElement?.textContent).toBe('Open reference');

    await act(async () => dispatch({ type: 'setTerm', term: '2026FA' }));

    expect(text()).not.toContain('https://lms.example.edu/week-4');
    expect([...host.querySelectorAll('button')].some((candidate) => candidate.textContent === 'Open reference')).toBe(false);
    expect(opened).not.toHaveBeenCalled();
  });

  it.each([
    ['loading', 'Loading published guidance and study packs…'],
    ['empty', 'No published guidance or study packs for this course.'],
  ] as const)('shows the %s publication state distinctly', async (status, expected) => {
    publicationMock.current = { status, publications: {} };
    await mount(true);
    await open('ECON 2010');
    expect(text()).toContain(expected);
  });

  it('does not ask for another term’s publications', async () => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, term: '2026FA' }));
    await mount(true);
    await open('ECON 2010');
    expect(publicationMock.calls.at(-1)?.slice(0, 2)).toEqual([['ECON 2010'], '']);
    expect(text()).not.toContain('Instructor publications');
  });

  it('shows a recoverable publication error', async () => {
    publicationMock.current = { status: 'error', publications: {} };
    await mount(true);
    await open('ECON 2010');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Published course content could not be loaded.');
    await act(async () => button(/^Try again$/).click());
    expect(publicationMock.retry).toHaveBeenCalledTimes(1);
  });

  it('is a drawer on a desktop, and another result replaces it', async () => {
    width = 1280;
    await mount(true);
    await open('ECON 2010');
    const drawer = host.querySelector('aside.course-drawer')!;
    expect(drawer).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await open('PSCI 1100');
    expect(host.querySelector('aside.course-drawer h2')?.textContent).toBe('Politics');
  });

  it('saves courses and compares them side by side, without ranking', async () => {
    width = 1280;
    await mount(true);
    for (const code of ['ECON 2010', 'PSCI 1100']) {
      await open(code);
      await act(async () => button(/^Save$/).click());
      await act(async () => button(/^Compare$/).click());
    }
    expect(JSON.parse(localStorage.getItem(SHORTLIST_KEY)!)).toEqual({ saved: ['e1', 'p1'], compare: ['e1', 'p1'], codes: { e1: 'ECON 2010', p1: 'PSCI 1100' } });
    const table = host.querySelector('.course-compare-table')!;
    expect([...table.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Course', 'ECON 2010 · 01', 'PSCI 1100 · 01']);
    const row = (label: string) => [...table.querySelectorAll('tbody tr')].find((tr) => tr.querySelector('th')?.textContent === label)!;
    expect([...row('Prerequisites').querySelectorAll('td')].map((td) => td.textContent)).toEqual(['1 of 2 named courses in your records', 'None listed']);
    expect([...row('May count toward').querySelectorAll('td')].map((td) => td.textContent)).toEqual(['Core theory', 'Nothing you recorded']);
    expect(text(table)).toContain('No course is ranked.');
    expect(host.querySelector('[aria-label="Comparison view"]')).not.toBeNull();
    await act(async () => button(/^Summary view$/).click());
    expect(host.textContent).toContain('Official next step');
  });
});
