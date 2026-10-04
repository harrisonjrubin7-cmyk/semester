import { describe, expect, it } from 'vitest';
import { buildCatalog } from '../../data/catalog';
import { isoToDate } from '../../lib/date';
import { datedItems, itemsDueToday } from '../../lib/select';
import type { Course, CourseModule, Item } from '../../lib/types';
import { entriesFromLegacy, entriesOn, type Entry } from '../calendar';
import { fixedClock } from '../kernel';
import type { Can } from '../policy';
import type { Task } from '../tasks';
import { DEFAULT_TODAY_CONFIG, buildToday } from './index';

const student: Can = () => ({ allow: true, obligations: [] });
const entry = (over: Partial<Entry> & { id: string }): Entry => ({
  kind: 'appointment', title: over.id, day: '2026-09-09', startMin: null, endMin: null, courseId: null, source: 'entered', ...over,
});
const task = (over: Partial<Task> & { id: string }): Task => ({
  title: over.id, state: 'open', dueOn: null, courseId: null, time: '', repeats: false, ...over,
});
const build = (over: Partial<Parameters<typeof buildToday>[0]> = {}) =>
  buildToday({ clock: fixedClock('2026-09-09', 600), can: student, entries: [], tasks: [], ...over });

describe('Today', () => {
  it('is empty only when there is truly nothing, and says so', () => {
    const r = build();
    expect(r.ok && r.value.empty).toBe(true);
    const busy = build({ tasks: [task({ id: 'a', dueOn: '2026-09-09' })] });
    expect(busy.ok && busy.value.empty).toBe(false);
  });

  it('is refused for a role that does not get one, with the policy’s sentence', () => {
    const r = build({ can: () => ({ allow: false, reason: 'role_not_served', message: 'Your home is elsewhere.' }) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('forbidden');
      expect(r.error.message).toBe('Your home is elsewhere.');
    }
  });

  it('separates what is due today from what is overdue, and shows overdue oldest first', () => {
    const r = build({
      tasks: [
        task({ id: 'today', dueOn: '2026-09-09' }),
        task({ id: 'late-b', dueOn: '2026-09-07', title: 'B' }),
        task({ id: 'late-a', dueOn: '2026-09-01' }),
        task({ id: 'done', dueOn: '2026-09-01', state: 'done' }),
        task({ id: 'someday' }),
        task({ id: 'tomorrow', dueOn: '2026-09-10' }),
      ],
    });
    expect(r.ok && r.value.dueToday.map((t) => t.id)).toEqual(['today']);
    expect(r.ok && r.value.overdue.map((t) => t.id)).toEqual(['late-a', 'late-b']);
  });

  it('looks ahead exactly the configured number of days, excluding today', () => {
    const entries = [
      entry({ id: 'd0', kind: 'deadline', day: '2026-09-09' }),
      entry({ id: 'd1', kind: 'deadline', day: '2026-09-10' }),
      entry({ id: 'd14', kind: 'deadline', day: '2026-09-23' }),
      entry({ id: 'd15', kind: 'deadline', day: '2026-09-24' }),
      entry({ id: 'appt', day: '2026-09-11' }),
    ];
    const r = build({ entries });
    expect(r.ok && r.value.comingUp.map((x) => x.id)).toEqual(['d1', 'd14']);
    const short = build({ entries, config: { horizonDays: 1 } });
    expect(short.ok && short.value.comingUp.map((x) => x.id)).toEqual(['d1']);
    expect(DEFAULT_TODAY_CONFIG.horizonDays).toBe(14);
  });

  it('refuses a look-ahead that is not a whole number of days', () => {
    for (const horizonDays of [-1, 1.5, Number.NaN]) {
      const r = build({ config: { horizonDays } });
      expect(!r.ok && r.error.code).toBe('validation');
    }
  });

  it('names what is next and reports a collision between the day’s blocks', () => {
    const r = build({
      entries: [
        entry({ id: 'lecture', kind: 'class', startMin: 540, endMin: 660 }),
        entry({ id: 'seminar', kind: 'class', startMin: 630, endMin: 720 }),
        entry({ id: 'lab', kind: 'class', startMin: 780, endMin: 840 }),
      ],
    });
    expect(r.ok && r.value.upNext?.id).toBe('seminar');
    expect(r.ok && r.value.clashes).toHaveLength(1);
  });

  it('gives the same answer at the same wall-clock minute whatever the machine’s zone', () => {
    // The clock is injected, so nothing here consults `TZ`. `npm run test:zones`
    // runs this file in Chicago and Kiritimati; this is the assertion it is for.
    const entries = [entry({ id: 'x', startMin: 700 })];
    const a = buildToday({ clock: fixedClock('2026-09-09', 650), can: student, entries, tasks: [] });
    const b = buildToday({ clock: fixedClock('2026-09-09', 650), can: student, entries, tasks: [] });
    expect(a).toEqual(b);
    expect(a.ok && a.value.upNext?.id).toBe('x');
  });
});

/**
 * Characterization: the new domain and the legacy selectors answer the same
 * question the same way. This is what lets the Today screen move onto the
 * domain behind a flag — the day it does, a disagreement is a failing test
 * here rather than a student's missed deadline.
 */
describe('parity with the legacy selectors', () => {
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
  const cat = buildCatalog([
    mod(course('econ', 'ECON 1020'), [
      item({ id: 'e-ps1', c: 'econ', month: 8, day: 4 }),
      item({ id: 'e-m1', c: 'econ', month: 8, day: 30, dueTime: 'In class' }),
    ]),
    mod(course('psci', 'PSCI 1104'), [
      item({ id: 'p-r1', c: 'psci', month: 8, day: 9, dueTime: '9:00 AM' }),
      item({ id: 'p-r2', c: 'psci', month: 8, day: 9, dueTime: 'In class' }),
    ]),
  ]);

  it('finds the same deadlines on today, in the same order', () => {
    const legacy = itemsDueToday(cat, NOW).map((i) => i.id);
    const entries = entriesFromLegacy({ deadlines: datedItems(cat, NOW), tasks: [], appointments: [] });
    const mine = entriesOn(entries, '2026-09-09').filter((x) => x.kind === 'deadline').map((x) => x.id.replace('deadline:', ''));
    expect(legacy).toEqual(['p-r1', 'p-r2']); // the control: there is something to agree about
    expect(mine).toEqual(legacy);
  });

  it('puts the timed deadline before the "In class" one, as the checklist does', () => {
    const entries = entriesFromLegacy({ deadlines: datedItems(cat, NOW), tasks: [], appointments: [] });
    const r = buildToday({ clock: fixedClock('2026-09-09', 600), can: student, entries, tasks: [] });
    expect(r.ok && r.value.schedule.map((x) => x.id)).toEqual(['deadline:p-r1', 'deadline:p-r2']);
    expect(isoToDate('2026-09-09').getDate()).toBe(9);
  });
});
