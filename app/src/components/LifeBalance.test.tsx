// @vitest-environment jsdom
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSeed } from '../data/seed';
import { ACTIONS_PREFIX } from '../lib/actions';
import { LIFE_BALANCE_KEY } from '../lib/life-balance';
import type { CourseModule, Item } from '../lib/types';
import { STORAGE_KEY } from '../state/shape';
import { StoreProvider, useStore } from '../state/store';
import { LifeBalance } from './LifeBalance';
import { TodayDecisionSurface } from './TodayDecisionSurface';

/**
 * Phase E on screen: the balance view in Plan, the forecast inside it, and
 * the crunch card on Today — each against the store, with courses of the
 * student's own. The sample semester has no crunch in it at any date, which
 * is why these are not the sample.
 *
 * "Now" is Monday 28 Sep 2026, 8am. Four major deadlines fall between 13 and
 * 18 October.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

const item = (id: string, month: number, day: number, kind: string, confirmed = true): Item =>
  ({
    id,
    c: 'econ',
    title: id,
    kind,
    month,
    day,
    year: 2026,
    dueTime: '11:59p',
    weight: '',
    where: '',
    detail: '',
    quote: '',
    source: '',
    ...(confirmed ? { checked: { confirmed: true } } : {}),
  }) as Item;

const ECON: CourseModule = {
  course: { id: 'econ', code: 'ECON 1010', name: 'Econ', prof: '', email: '', meets: 'MWF 9:00–10:30a', room: '', credits: '', source: '', grading: [] },
  items: [
    item('Midterm', 9, 13, 'Exam'),
    item('Essay', 9, 14, 'Paper', false),
    item('Project', 9, 16, 'Project'),
    item('Final paper', 9, 18, 'Paper'),
    item('Reading', 9, 1, 'Reading'),
  ],
  schedule: [{ days: [1, 3, 5], time: '9:00a', at: 9 * 60, title: 'Lecture', meta: '' }],
  guide: { code: 'ECON 1010', name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
  planMinutes: '45 min',
  frameLabel: 'Frames',
} as unknown as CourseModule;

let seen: { appointments: { title: string; kind?: string; date: string; at: number | null; minutes?: number }[]; screen: string; calView: string; calDay: string | null } | null = null;
function Probe() {
  const { state } = useStore();
  useEffect(() => {
    seen = { appointments: state.appointments, screen: state.screen, calView: state.calView, calDay: state.calDay };
  });
  return null;
}

beforeAll(async () => {
  await loadSeed();
  await import('./CrunchWeekCard');
  await import('./TodayActionCenter');
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 28, 8, 0));
  window.location.hash = '';
  window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
  localStorage.clear();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 6,
      seenOnboarding: true,
      sample: false,
      courses: [ECON],
      commitments: [
        { id: 'job', name: 'Library desk', kind: 'job', role: '', where: '', url: '', note: '', days: [1, 3], at: 10 * 60 + 30, minutes: 240, hours: 0, active: true, created: 0 },
        { id: 'lab', name: 'Lab reading', kind: 'research', role: '', where: '', url: '', note: '', days: [], at: null, minutes: 0, hours: 7, active: true, created: 0 },
      ],
    }),
  );
  host = document.createElement('div');
  host.className = 'device';
  document.body.append(host);
  root = createRoot(host);
  seen = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  localStorage.clear();
  vi.useRealTimers();
});

const text = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const button = (name: RegExp) => {
  const found = [...host.querySelectorAll('button')].find((b) => name.test((b.textContent ?? '').trim()));
  if (!found) throw new Error(`No button ${name}: ${[...host.querySelectorAll('button')].map((b) => b.textContent).join(' | ')}`);
  return found;
};

const mountBalance = async (start: string, crunch: boolean) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <LifeBalance start={start} crunch={crunch} />
        <Probe />
      </StoreProvider>,
    );
  });
};

const mountToday = async (crunchWeek: boolean) => {
  await act(async () => {
    root.render(
      <StoreProvider>
        <TodayDecisionSurface actionCenter={false} registrationDay={false} crunchWeek={crunchWeek} />
        <Probe />
      </StoreProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

describe('the balance view in Plan', () => {
  it('shows the week’s hours by category, each day, and says what it is not', async () => {
    await mountBalance('2026-09-27', false);
    const categories = [...host.querySelectorAll('.balance-categories li')].map((li) => li.textContent);
    // Seven 16-hour days, less 4.5 h of class, 8 h of shifts and 7 h of reading.
    expect(categories).toEqual(['Class4.5 h', 'Work15 h', 'Open time92.5 h']);
    expect(host.querySelectorAll('.balance-days li')).toHaveLength(7);
    expect(host.querySelectorAll('.balance-days li')[1].textContent).toBe('Mon6.5 h committed · 9.5 h open');
    expect(text()).toContain('7 h of that has no set time');
    expect(text()).toContain('not a measure of you');
    expect(text()).toContain('It does not rate a week');
    expect(host.querySelector('.balance-crunch')).toBeNull();
    // The bars are drawing, not reading: the numbers are text.
    expect(host.querySelector('.balance-bar')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('labels each deadline with where it came from', async () => {
    await mountBalance('2026-10-11', false);
    const rows = [...host.querySelectorAll('.balance-list li')].filter((li) => li.textContent?.includes('ECON 1010'));
    const essay = rows.find((r) => r.textContent?.includes('Essay'))!;
    const midterm = rows.find((r) => r.textContent?.includes('Midterm'))!;
    expect(essay.querySelector('[data-source]')?.getAttribute('data-source')).toBe('needs_review');
    expect(midterm.querySelector('[data-source]')?.getAttribute('data-source')).toBe('imported');
  });

  it('adds a suggested study block only after a preview, with focus on Cancel', async () => {
    await mountBalance('2026-10-04', true);
    expect(text()).toContain('The week of Oct 11 has four major deadlines in six days. Want to start two earlier?');
    const before = seen!.appointments.length;
    await act(async () => button(/^Add to calendar…$/).click());
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('as a Study event on your Semester calendar');
    expect(dialog.textContent).toContain('It does not change the due date');
    expect(document.activeElement?.textContent).toBe('Cancel');
    expect(seen!.appointments).toHaveLength(before);
    await act(async () => button(/^Cancel$/).click());
    expect(seen!.appointments).toHaveLength(before);

    await act(async () => button(/^Add to calendar…$/).click());
    await act(async () => button(/^Add to calendar$/).click());
    expect(seen!.appointments).toHaveLength(before + 1);
    const added = seen!.appointments[seen!.appointments.length - 1];
    expect(added).toMatchObject({ kind: 'study', minutes: 90 });
    expect(added.date >= '2026-10-06' && added.date < '2026-10-13').toBe(true);
    expect(text()).toContain('Move or delete it like any event.');
  });

  it('keeps a commute on this device and counts it', async () => {
    await mountBalance('2026-09-27', false);
    const boxes = [...host.querySelectorAll<HTMLInputElement>('.balance-commute input[type="checkbox"]')];
    await act(async () => boxes[1].click());
    await act(async () => boxes[3].click());
    const minutes = host.querySelector<HTMLInputElement>('.balance-commute-minutes input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(minutes, '30');
      minutes.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => button(/^Save commute$/).click());
    expect(JSON.parse(localStorage.getItem(LIFE_BALANCE_KEY)!)).toEqual({ commute: { days: [1, 3], minutesEachWay: 30 } });
    expect([...host.querySelectorAll('.balance-categories li')].map((li) => li.textContent)).toContain('Commute2 h');
  });
});

describe('the crunch card on Today', () => {
  it('is not there with the flag off', async () => {
    await mountToday(false);
    expect(host.querySelector('.crunch-card')).toBeNull();
  });

  it('says what is coming and opens that week in Plan', async () => {
    await mountToday(true);
    expect(host.querySelector('.crunch-card-line')?.textContent).toBe(
      'The week of Oct 11 has four major deadlines in six days. Want to start two earlier?',
    );
    expect(host.querySelector('.crunch-card [data-source]')?.getAttribute('data-source')).toBe('needs_review');
    await act(async () => button(/^Plan earlier starts$/).click());
    expect(seen).toMatchObject({ screen: 'calendar', calView: 'week' });
    expect(seen!.calDay! >= '2026-10-06' && seen!.calDay! < '2026-10-13').toBe(true);
  });

  it('explains itself, and snoozes for a week in the Action Center’s own store', async () => {
    await mountToday(true);
    await act(async () => button(/^Why this\?$/).click());
    expect(text()).toContain('Why now?');
    expect(text()).toContain('What Semester can’t tell you');
    await act(async () => button(/^Close$/).click());
    await act(async () => button(/^Snooze a week$/).click());
    expect(host.querySelector('.crunch-card')).toBeNull();
    expect(text()).toContain('Snoozed for a week.');
    const stored = JSON.parse(localStorage.getItem(`${ACTIONS_PREFIX}:device`)!);
    const [id] = Object.keys(stored.choices);
    expect(id).toMatch(/^crunch:/);
    expect(stored.choices[id]).toMatchObject({ status: 'snoozed', snoozedUntil: new Date(2026, 9, 5, 8, 0).getTime() });
  });
});
