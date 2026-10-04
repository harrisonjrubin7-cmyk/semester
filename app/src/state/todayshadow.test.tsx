// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildCatalog } from '../data/catalog';
import { loadSeed } from '../data/seed';
import { buildToday } from '../domains/today';
import { entriesFromLegacy } from '../domains/calendar';
import { fixedClock } from '../domains/kernel';
import { taskFromLegacy } from '../domains/tasks';
import { compareToday } from '../domains/today';
import { datedItems } from '../lib/select';
import type { Course, CourseModule, Item, PersonalTask } from '../lib/types';
import { STORAGE_KEY } from './shape';
import { StoreProvider } from './store';
import { TodayShadow, describeShadow, legacyTodayFacts } from './todayshadow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The shadow, fed the same moment two ways.
 *
 * `compareToday` is tested on bare ids in `domains/today/shadow.test.ts`. What
 * is held here is the part that can only be wrong in the wiring: that the
 * legacy side is read from the selectors Today really draws with, and that on a
 * semester with the awkward cases in it — two deadlines on one day, one with no
 * time, one exactly at the horizon and one a day past it — the two agree.
 */
const course = (id: string, code: string): Course => ({
  id, code, name: 'A course', prof: 'Dr. Someone', email: 'someone@x.edu', meets: '', room: '', credits: '3', source: '', grading: [], term: '2026FA',
});
const item = (over: Partial<Item> & { id: string; c: string; month: number; day: number }): Item => ({
  title: 'A thing', kind: 'Essay', dueTime: '11:59 PM', weight: '', where: '', detail: '', quote: '', source: '', ...over,
});
const mod = (c: Course, items: Item[]): CourseModule => ({
  course: c, items, schedule: [],
  guide: { code: c.code, name: '', blurb: '', source: '', mastery: 0, audio: false, units: [], terms: [] },
  planMinutes: '45 min', frameLabel: 'Exam frames',
});
const NOW = new Date(2026, 8, 9, 10, 0);
const CAT = buildCatalog([
  mod(course('econ', 'ECON 1020'), [
    item({ id: 'past', c: 'econ', month: 8, day: 4 }),
    item({ id: 'h14', c: 'econ', month: 8, day: 23 }),
    item({ id: 'h15', c: 'econ', month: 8, day: 24 }),
  ]),
  mod(course('psci', 'PSCI 1104'), [
    item({ id: 'r1', c: 'psci', month: 8, day: 9, dueTime: '9:00 AM' }),
    item({ id: 'r2', c: 'psci', month: 8, day: 9, dueTime: 'In class', title: 'Zeta' }),
    item({ id: 'r3', c: 'psci', month: 8, day: 9, dueTime: 'In class', title: 'Alpha' }),
    item({ id: 'soon', c: 'psci', month: 8, day: 10 }),
  ]),
]);
const task = (over: Partial<PersonalTask> & { id: string }): PersonalTask => ({
  title: over.id, date: null, time: '', note: '', done: false, created: 0, courseId: null, ...over,
});
const TASKS = [
  task({ id: 'today', date: '2026-09-09' }),
  task({ id: 'done-today', date: '2026-09-09', done: true }),
  task({ id: 'tomorrow', date: '2026-09-10' }),
  task({ id: 'someday' }),
];

function domainSays() {
  const r = buildToday({
    clock: fixedClock('2026-09-09', 600),
    can: () => ({ allow: true, obligations: [] }),
    entries: entriesFromLegacy({ deadlines: datedItems(CAT, NOW), tasks: TASKS, appointments: [] }),
    tasks: TASKS.map(taskFromLegacy),
  });
  if (!r.ok) throw new Error('refused');
  return r;
}

describe('legacy facts and the domain, on awkward days', () => {
  it('read the selectors Today draws with', () => {
    expect(legacyTodayFacts(CAT, TASKS, NOW)).toEqual({
      deadlinesToday: ['r1', 'r2', 'r3'],
      tasksToday: ['today'],
      deadlinesComingUp: ['soon', 'h14'],
    });
  });

  it('agree: same ids, same order, horizon edge included, ties kept as listed', () => {
    expect(compareToday(legacyTodayFacts(CAT, TASKS, NOW), domainSays().value)).toEqual([]);
  });

  it('say nothing when they agree, and name the difference when they do not', () => {
    const facts = legacyTodayFacts(CAT, TASKS, NOW);
    expect(describeShadow('2026-09-09', facts, domainSays())).toBeNull();
    const report = describeShadow('2026-09-09', { ...facts, tasksToday: ['today', 'ghost'] }, domainSays());
    expect(report?.summary).toBe('tasksToday — screen only: ghost');
  });

  it('report a refusal, because the screen would still be drawing', () => {
    const refused = { ok: false as const, error: { code: 'forbidden' as const, message: 'x', retryable: false } };
    const report = describeShadow('2026-09-09', legacyTodayFacts(CAT, TASKS, NOW), refused);
    expect(report?.summary).toContain('refused Today (forbidden)');
  });
});

describe('the mounted shadow', () => {
  let host: HTMLDivElement;
  let root: Root;
  const warn = vi.fn();

  beforeAll(async () => {
    await loadSeed();
  });

  beforeEach(async () => {
    warn.mockClear();
    host = document.createElement('div');
    document.body.append(host);
    await act(async () => {
      root = createRoot(host);
    });
  });

  // No root outlives the test that made it. See `src/rootunmount.test.ts`.
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
  });

  async function mount(saved: object) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 6, ...saved }));
    await act(async () => {
      root.render(
        <StoreProvider>
          <TodayShadow log={warn} />
        </StoreProvider>,
      );
    });
    // The comparison resolves a tick after the store settles.
    await act(async () => void (await new Promise((r) => setTimeout(r, 30))));
  }

  it('draws nothing', async () => {
    await mount({});
    expect(host.innerHTML).toBe('');
  });

  it('is quiet for a student whose two Todays agree', async () => {
    await mount({ role: 'student' });
    expect(warn).not.toHaveBeenCalled();
  });

  it('says once that the domain refuses Today to a role the screen still draws for', async () => {
    await mount({ role: 'faculty' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('[domainToday] shadow disagreement: the domain refused Today (forbidden)');
  });
});
