import { describe, expect, it } from 'vitest';
import { buildCatalog, EMPTY_CATALOG } from '../data/catalog';
import {
  appointmentsOn,
  campusCalendar,
  campusHours,
  datedEvents,
  datedItems,
  feed,
  feedEventsOn,
  feedFilters,
  filterFeed,
  hoursFor,
  itemsDueToday,
  itemsOn,
  lengthOf,
  loadByCourse,
  nextClass,
  nextExam,
  railFor,
  spanOf,
  tasksOn,
  upcomingItems,
} from './select';
import type {
  Appointment,
  Course,
  CourseModule,
  FeedEvent,
  Item,
  PersonalTask,
  RecurringBlock,
  Unit,
} from './types';

/**
 * Every screen in the app derives its day from this file, so the fixtures are
 * a small but real semester rather than one course with one deadline: the
 * ordering rules only misbehave when there is something to order against.
 *
 * `NOW` is a Wednesday — 2026-09-09, 10:00 — chosen so there is a class both
 * behind and ahead of the clock on the same day.
 */
const NOW = new Date(2026, 8, 9, 10, 0);

const course = (over: Partial<Course> & { id: string; code: string }): Course => ({
  name: 'A course',
  prof: 'Dr. Someone',
  email: 'someone@x.edu',
  meets: '',
  room: '',
  credits: '3',
  source: '',
  grading: [],
  term: '2026FA',
  ...over,
});

const item = (over: Partial<Item> & { id: string; c: string; month: number; day: number }): Item => ({
  title: 'A thing',
  kind: 'Essay',
  dueTime: '11:59 PM',
  weight: '20%',
  where: '',
  detail: '',
  quote: '',
  source: '',
  ...over,
});

const mod = (
  c: Course,
  items: Item[] = [],
  schedule: RecurringBlock[] = [],
  units: Unit[] = [],
): CourseModule => ({
  course: c,
  items,
  schedule,
  guide: { code: c.code, name: '', blurb: '', source: '', mastery: 0, audio: false, units, terms: [] },
  planMinutes: '45 min',
  frameLabel: 'Exam frames',
});

/** ECON meets MWF at 9:05; PSCI meets MW at 13:15 with office hours at 15:00. */
const ECON = mod(
  course({ id: 'econ', code: 'ECON 1020', meets: 'MWF · 9:05–9:55a' }),
  [
    item({ id: 'e-ps1', c: 'econ', month: 8, day: 4, title: 'Problem Set 1', kind: 'Problem set' }),
    item({ id: 'e-m1', c: 'econ', month: 8, day: 30, title: 'Midterm 1', kind: 'Exam', dueTime: 'In class' }),
    item({ id: 'e-m2', c: 'econ', month: 10, day: 4, title: 'Midterm 2', kind: 'Exam', dueTime: 'In class' }),
  ],
  [{ days: [1, 3, 5], at: 545, time: '9:05a', title: 'ECON lecture', meta: 'Buttrick 101' }],
  [
    { name: 'Supply', mastery: 80, cards: [] },
    { name: 'Demand', mastery: 30, cards: [] },
  ],
);

const PSCI = mod(
  course({ id: 'psci', code: 'PSCI 1104', meets: 'MW · 1:15–2:30p' }),
  [
    item({ id: 'p-r1', c: 'psci', month: 8, day: 9, title: 'Response 1', kind: 'Response', dueTime: '9:00 AM' }),
    item({ id: 'p-r2', c: 'psci', month: 8, day: 9, title: 'Response 2', kind: 'Response', dueTime: 'In class' }),
    item({ id: 'p-q1', c: 'psci', month: 8, day: 22, title: 'Quiz 3', kind: 'Quiz' }),
  ],
  [
    { days: [1, 3], at: 795, time: '1:15p', title: 'PSCI seminar', meta: 'Calhoun 110' },
    { days: [3], at: 900, time: '3:00p', title: 'Office hours', meta: 'Commons 4', optional: true },
  ],
  [{ name: 'States', mastery: 55, cards: [] }],
);

const CAT = buildCatalog([ECON, PSCI]);

describe('datedItems', () => {
  it('puts every deadline in date order', () => {
    const dates = datedItems(CAT, NOW).map((i) => i.id);
    expect(dates).toEqual(['e-ps1', 'p-r1', 'p-r2', 'p-q1', 'e-m1', 'e-m2']);
  });

  it('orders two things on one day by the hour they are due', () => {
    // The half that is easy to lose: a checklist used to put "In class" above
    // "9:00 AM" because the order was whatever the syllabus happened to list.
    // An untimed wording sorts to the end of its own day rather than the start.
    const sameDay = datedItems(CAT, NOW).filter((i) => i.day === 9 && i.month === 8);
    expect(sameDay.map((i) => i.title)).toEqual(['Response 1', 'Response 2']);
  });

  it('dates each item against the clock it was given', () => {
    const found = datedItems(CAT, NOW).find((i) => i.id === 'p-r1');
    expect(found?.isToday).toBe(true);
    expect(found?.isPast).toBe(false);
    expect(datedItems(CAT, NOW).find((i) => i.id === 'e-ps1')?.isPast).toBe(true);
  });

  it('has nothing to say about an account with no courses', () => {
    expect(datedItems(EMPTY_CATALOG, NOW)).toEqual([]);
  });
});

describe('upcomingItems and itemsDueToday', () => {
  it('drops what has already gone', () => {
    expect(upcomingItems(CAT, NOW).map((i) => i.id)).not.toContain('e-ps1');
  });

  it('keeps today, which has not gone', () => {
    // A paper due at 11:59 tonight is not in the past at 10am, and an app
    // about what is coming that hid it would be hiding the urgent one.
    expect(upcomingItems(CAT, NOW).map((i) => i.id)).toContain('p-r1');
  });

  it('gives today on its own', () => {
    expect(itemsDueToday(CAT, NOW).map((i) => i.id)).toEqual(['p-r1', 'p-r2']);
  });
});

describe('nextClass', () => {
  it('finds the next class still to come today', () => {
    // 10:00 on a Wednesday: ECON at 9:05 has been, PSCI at 13:15 has not.
    const next = nextClass(CAT, NOW);
    expect(next?.block.title).toBe('PSCI seminar');
    expect(next?.inMinutes).toBe(795 - 600);
    expect(next?.isTomorrow).toBe(false);
  });

  it('walks forward to the next teaching day rather than going empty', () => {
    // Saturday. Nothing meets at the weekend, so the card has to reach Monday
    // or it is blank for two days of every week.
    const sat = new Date(2026, 8, 12, 10, 0);
    const next = nextClass(CAT, sat);
    expect(next?.block.title).toBe('ECON lecture');
    expect(next?.untilLabel).toBe('in 2 days');
    expect(next?.isTomorrow).toBe(false);
  });

  it('says tomorrow when it is tomorrow', () => {
    // Thursday: nothing meets, and Friday's ECON is the next one.
    const thu = new Date(2026, 8, 10, 10, 0);
    expect(nextClass(CAT, thu)?.isTomorrow).toBe(true);
    expect(nextClass(CAT, thu)?.untilLabel).toBe('tomorrow');
  });

  it('counts the minutes across a day boundary', () => {
    const thu = new Date(2026, 8, 10, 10, 0);
    // Tomorrow at 9:05 is 1440 - 600 + 545 minutes away.
    expect(nextClass(CAT, thu)?.inMinutes).toBe(1440 + 545 - 600);
  });

  it('does not offer office hours as the next class', () => {
    // Optional blocks are dimmer everywhere else too: it is a thing you may
    // go to, not a room you have to be in, and a countdown to one is wrong.
    const afterSeminar = new Date(2026, 8, 9, 14, 0);
    expect(nextClass(CAT, afterSeminar)?.block.title).not.toBe('Office hours');
  });

  it('names what is next due for the course when nothing special is on', () => {
    expect(nextClass(CAT, NOW)?.note).toBe('Next up: Response 1 · Today');
  });

  it('returns nothing when nothing meets at all', () => {
    const noClasses = buildCatalog([mod(course({ id: 'x', code: 'X 100' }))]);
    expect(nextClass(noClasses, NOW)).toBeNull();
    expect(nextClass(EMPTY_CATALOG, NOW)).toBeNull();
  });
});

describe('feed', () => {
  it('lists today’s classes and then what is coming', () => {
    const rows = feed(CAT, NOW, {});
    expect(rows.filter((r) => r.isClass).map((r) => r.title)).toEqual([
      'ECON lecture',
      'PSCI seminar',
      'Office hours',
    ]);
    expect(rows.filter((r) => !r.isClass).map((r) => r.itemId)).toEqual([
      'p-r1',
      'p-r2',
      'p-q1',
      'e-m1',
      'e-m2',
    ]);
  });

  it('marks a deadline that has been ticked off', () => {
    const rows = feed(CAT, NOW, { 'p-r1': true });
    expect(rows.find((r) => r.itemId === 'p-r1')?.done).toBe(true);
    expect(rows.find((r) => r.itemId === 'p-r2')?.done).toBe(false);
  });

  it('labels a block with no course as campus rather than crashing', () => {
    // `blocksFor` nulls the course on an optional block, and the feed reads
    // `cat.byId[b.c].code` for the rest.
    expect(feed(CAT, NOW, {}).find((r) => r.title === 'Office hours')?.code).toBe('Campus');
  });

  it('gives every row its own key', () => {
    const keys = feed(CAT, NOW, {}).map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('shows the hour for today and the date for anything later', () => {
    const rows = feed(CAT, NOW, {});
    expect(rows.find((r) => r.itemId === 'p-r1')?.top).toBe('Due');
    expect(rows.find((r) => r.itemId === 'p-q1')?.bottom).toBe('Sep 22');
  });
});

/**
 * The case that produced a white Today screen.
 *
 * Every item in a catalogue normally comes from a module in that catalogue, so
 * its course is right there — but a module arrives from sync, from a restored
 * backup, or from a course file somebody shared, and nothing on the way in
 * checks that each item's `c` names its own course. Three functions here read
 * `cat.byId[i.c].code` and threw on one that did not.
 */
describe('an item whose course is not in the catalogue', () => {
  const orphaned = buildCatalog([
    mod(course({ id: 'econ', code: 'ECON 1020' }), [
      item({ id: 'stray', c: 'a-course-that-is-gone', month: 9, day: 20, title: 'Orphan', kind: 'Exam' }),
    ]),
  ]);

  it('still builds the day, rather than blanking the screen', () => {
    const rows = feed(orphaned, NOW, {});
    expect(rows.map((r) => r.title)).toContain('Orphan');
  });

  it('shows the bare id rather than throwing, so it can be noticed and reported', () => {
    expect(feed(orphaned, NOW, {}).find((r) => r.itemId === 'stray')?.code).toBe('A-COURSE-THAT-IS-GONE');
  });

  it('still counts towards the next exam', () => {
    expect(nextExam(orphaned, NOW)?.item.id).toBe('stray');
  });

  it('does not break the load bars', () => {
    expect(() => loadByCourse(orphaned, NOW, {})).not.toThrow();
  });
});

describe('feedFilters and filterFeed', () => {
  it('offers the fixed three, then one chip per course', () => {
    expect(feedFilters(CAT)).toEqual(['All', 'Due', 'Classes', 'ECON', 'PSCI']);
  });

  it('lets everything through on All', () => {
    const rows = feed(CAT, NOW, {});
    expect(filterFeed(CAT, rows, 'All')).toHaveLength(rows.length);
  });

  it('splits classes from deadlines', () => {
    const rows = feed(CAT, NOW, {});
    expect(filterFeed(CAT, rows, 'Classes').every((r) => r.isClass)).toBe(true);
    expect(filterFeed(CAT, rows, 'Due').every((r) => !r.isClass)).toBe(true);
  });

  it('filters to one course, dropping what belongs to no course', () => {
    const only = filterFeed(CAT, feed(CAT, NOW, {}), 'ECON');
    expect(only.every((r) => r.c === 'econ')).toBe(true);
    expect(only.map((r) => r.title)).toContain('ECON lecture');
    expect(only.map((r) => r.title)).not.toContain('Office hours');
  });

  it('returns nothing for a chip no course answers to', () => {
    expect(filterFeed(CAT, feed(CAT, NOW, {}), 'CHEM')).toEqual([]);
  });
});

describe('nextExam', () => {
  it('finds the soonest exam across every course', () => {
    expect(nextExam(CAT, NOW)?.item.id).toBe('e-m1');
    expect(nextExam(CAT, NOW)?.code).toBe('ECON 1020');
    expect(nextExam(CAT, NOW)?.days).toBe(21);
  });

  it('says nothing when there is no exam ahead', () => {
    const after = new Date(2026, 11, 1);
    expect(nextExam(CAT, after)).toBeNull();
    expect(nextExam(EMPTY_CATALOG, NOW)).toBeNull();
  });

  it('does not count a quiz as an exam', () => {
    const quizOnly = buildCatalog([
      mod(course({ id: 'q', code: 'Q 100' }), [item({ id: 'q1', c: 'q', month: 8, day: 20, kind: 'Quiz' })]),
    ]);
    expect(nextExam(quizOnly, NOW)).toBeNull();
  });
});

describe('loadByCourse', () => {
  it('counts what each course is still carrying', () => {
    const load = loadByCourse(CAT, NOW, {});
    expect(load.map((c) => [c.id, c.n])).toEqual([
      ['econ', 2],
      ['psci', 3],
    ]);
  });

  it('does not count what has been ticked off', () => {
    const load = loadByCourse(CAT, NOW, { 'p-r1': true, 'p-r2': true });
    expect(load.find((c) => c.id === 'psci')?.n).toBe(1);
  });

  it('scales the bars against the busiest course', () => {
    const load = loadByCourse(CAT, NOW, {});
    expect(load.find((c) => c.id === 'psci')?.pct).toBe(100);
    expect(load.find((c) => c.id === 'econ')?.pct).toBe(67);
  });

  it('does not divide by zero when nothing is left', () => {
    // The `Math.max(1, …)` guard. A term with everything done should read 0%,
    // not NaN%.
    const after = new Date(2026, 11, 1);
    expect(loadByCourse(CAT, after, {}).every((c) => c.pct === 0)).toBe(true);
  });
});

describe('itemsOn and dotsForMonth', () => {
  it('finds the deadlines on one day', () => {
    expect(itemsOn(CAT, NOW, 2026, 8, 9).map((i) => i.id)).toEqual(['p-r1', 'p-r2']);
    expect(itemsOn(CAT, NOW, 2026, 8, 10)).toEqual([]);
  });

  it('does not confuse the same day of another month or year', () => {
    expect(itemsOn(CAT, NOW, 2026, 9, 9)).toEqual([]);
    expect(itemsOn(CAT, NOW, 2025, 8, 9)).toEqual([]);
  });
});

describe('tasksOn, appointmentsOn and feedEventsOn', () => {
  const task = (id: string, date: string | null): PersonalTask => ({
    id,
    title: id,
    date,
    time: '',
    note: '',
    done: false,
    created: 0,
    courseId: null,
  });

  const appt = (id: string, date: string, at: number): Appointment => ({
    id,
    title: id,
    date,
    at,
    time: '',
    where: '',
    note: '',
    created: 0,
  });

  const feedEvent = (id: string, date: string, at: number | null): FeedEvent => ({
    id,
    sourceId: 's',
    title: id,
    date,
    at,
    time: '',
    where: '',
    note: '',
    courseId: null,
  });

  it('picks the tasks filed on that day', () => {
    const list = [task('a', '2026-09-09'), task('b', '2026-09-10'), task('c', null)];
    expect(tasksOn(list, NOW).map((t) => t.id)).toEqual(['a']);
  });

  it('leaves an undated task off every day rather than on all of them', () => {
    expect(tasksOn([task('c', null)], NOW)).toEqual([]);
  });

  it('puts appointments in time order', () => {
    const list = [appt('late', '2026-09-09', 900), appt('early', '2026-09-09', 540)];
    expect(appointmentsOn(list, NOW).map((a) => a.id)).toEqual(['early', 'late']);
  });

  it('sorts an all-day feed entry above the timed ones', () => {
    // `at` is null for all day, and a day starts with the things that have no
    // hour rather than burying them under the afternoon.
    const list = [feedEvent('timed', '2026-09-09', 600), feedEvent('allday', '2026-09-09', null)];
    expect(feedEventsOn(list, NOW).map((e) => e.id)).toEqual(['allday', 'timed']);
  });

  it('reads the day in local time, not UTC', () => {
    // Late on a September evening in a western timezone, `dateToIso` must
    // still say the 9th — otherwise the day's own list empties at bedtime.
    const lateEvening = new Date(2026, 8, 9, 23, 40);
    expect(tasksOn([task('a', '2026-09-09')], lateEvening).map((t) => t.id)).toEqual(['a']);
  });
});

describe('railFor', () => {
  const appt: Appointment = {
    id: 'a1',
    title: 'Dentist',
    date: '2026-09-09',
    at: 660,
    time: '11:00a',
    where: 'Broadway',
    note: '',
    created: 0,
  };

  it('merges classes and your own appointments in time order', () => {
    const rail = railFor(CAT, NOW, [appt]);
    expect(rail.map((b) => b.title)).toEqual([
      'ECON lecture',
      'Dentist',
      'PSCI seminar',
      'Office hours',
    ]);
  });

  it('marks what is yours, so the app never implies the syllabus asked for it', () => {
    const rail = railFor(CAT, NOW, [appt]);
    expect(rail.find((b) => b.title === 'Dentist')?.mine).toBe(true);
    expect(rail.find((b) => b.title === 'ECON lecture')?.mine).toBeUndefined();
  });

  it('falls back to a label rather than an empty line when there is no place', () => {
    const rail = railFor(CAT, NOW, [{ ...appt, where: '' }]);
    expect(rail.find((b) => b.title === 'Dentist')?.meta).toBe('Added by you');
  });

  it('draws a deadline that names an hour where it actually falls', () => {
    const due = datedItems(CAT, NOW).filter((i) => i.id === 'p-r1');
    const rail = railFor(CAT, NOW, [], [], due);
    const drawn = rail.find((b) => b.title === 'Response 1');
    expect(drawn?.at).toBe(9 * 60);
    expect(drawn?.meta).toBe('PSCI 1104 · Response');
    expect(drawn?.optional).toBe(true);
  });

  it('will not draw a deadline whose wording names no hour', () => {
    // "In class" is a thing you have all day to do something about. Putting it
    // on the grid means picking an hour the syllabus never stated.
    const due = datedItems(CAT, NOW).filter((i) => i.id === 'p-r2');
    expect(railFor(CAT, NOW, [], [], due).map((b) => b.title)).not.toContain('Response 2');
  });

  it('ignores a deadline handed to it that belongs to another day', () => {
    const due = datedItems(CAT, NOW).filter((i) => i.id === 'e-ps1');
    expect(railFor(CAT, NOW, [], [], due).map((b) => b.title)).not.toContain('Problem Set 1');
  });

  it('draws a day with nothing on it as nothing', () => {
    const sunday = new Date(2026, 8, 13, 10, 0);
    expect(railFor(CAT, sunday, [])).toEqual([]);
  });
});

describe('railFor and your own tasks', () => {
  const mine = (over: Partial<PersonalTask> = {}): PersonalTask => ({
    id: 't1',
    title: 'Draft the memo',
    date: '2026-09-09',
    time: '2:00 PM',
    note: '',
    done: false,
    created: 0,
    courseId: null,
    ...over,
  });

  it('puts a task on the hour it names', () => {
    const drawn = railFor(CAT, NOW, [], [], [], [mine()]).find((b) => b.title === 'Draft the memo');
    expect(drawn?.at).toBe(14 * 60);
    expect(drawn?.mine).toBe(true);
    expect(drawn?.from).toEqual({ kind: 'task', id: 't1' });
  });

  it('names the course it is filed against, and says what it is either way', () => {
    const filed = railFor(CAT, NOW, [], [], [], [mine({ courseId: 'econ' })]);
    expect(filed.find((b) => b.title === 'Draft the memo')?.meta).toBe('ECON 1020 · Task');
    expect(
      railFor(CAT, NOW, [], [], [], [mine()]).find((b) => b.title === 'Draft the memo')?.meta,
    ).toBe('Task');
  });

  it('will not invent an hour for a task whose time is not a clock', () => {
    // "Before work" is a real answer to when, and midnight is not what it
    // means. Those are listed beside the grid rather than drawn on it.
    const drawn = railFor(CAT, NOW, [], [], [], [mine({ time: 'before work' })]);
    expect(drawn.map((b) => b.title)).not.toContain('Draft the memo');
  });

  it('takes a finished task off the day rather than drawing it out', () => {
    // An hour you have given back is a gap, and showing where the gaps are is
    // the whole use of a grid.
    const drawn = railFor(CAT, NOW, [], [], [], [mine({ done: true })]);
    expect(drawn.map((b) => b.title)).not.toContain('Draft the memo');
  });

  it('ignores a task dated on another day', () => {
    const drawn = railFor(CAT, NOW, [], [], [], [mine({ date: '2026-09-10' })]);
    expect(drawn.map((b) => b.title)).not.toContain('Draft the memo');
  });

  it('sorts it into the day beside the classes rather than onto the end', () => {
    const titles = railFor(CAT, NOW, [], [], [], [mine({ time: '10:00 AM' })]).map((b) => b.title);
    expect(titles).toEqual(['ECON lecture', 'Draft the memo', 'PSCI seminar', 'Office hours']);
  });

  it('hands the hour grid a task it can colour, move and read out', () => {
    const drawn = hoursFor(CAT, NOW, [], [], [], [mine({ courseId: 'psci' })]).find(
      (h) => h.title === 'Draft the memo',
    );
    // Its course, so the grid draws it in that course's colour rather than in
    // the grey that means "uncategorised"; `task` rather than an event kind,
    // so it is not read out as "Other"; and a record behind it, which is what
    // makes it draggable.
    expect(drawn?.c).toBe('psci');
    expect(drawn?.kind).toBe('task');
    expect(drawn?.minutes).toBe(50);
    expect(drawn?.from).toEqual({ kind: 'task', id: 't1' });
  });
});

describe('hoursFor', () => {
  it('gives a class the length its syllabus states', () => {
    const hours = hoursFor(CAT, NOW, []);
    expect(hours.find((h) => h.title === 'ECON lecture')?.minutes).toBe(50);
    expect(hours.find((h) => h.title === 'PSCI seminar')?.minutes).toBe(75);
  });

  it('gives something you added fifty minutes rather than a duration nobody stated', () => {
    const appt: Appointment = {
      id: 'a1',
      title: 'Dentist',
      date: '2026-09-09',
      at: 660,
      time: '11:00a',
      where: '',
      note: '',
      created: 0,
    };
    const drawn = hoursFor(CAT, NOW, [appt]).find((h) => h.title === 'Dentist');
    expect(drawn?.minutes).toBe(50);
    expect(drawn?.kind).toBe('other');
  });

  it('leaves a class with no kind, so the grid can colour only what is yours', () => {
    expect(hoursFor(CAT, NOW, []).find((h) => h.title === 'ECON lecture')?.kind).toBeNull();
  });

  it('gives every block its own id', () => {
    const ids = hoursFor(CAT, NOW, []).map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('spanOf', () => {
  it('reads a range that marks the meridiem only at the end', () => {
    // "9:05–9:55a" is both morning; the start inherits the end's half.
    expect(spanOf('MWF · 9:05–9:55a')).toBe(50);
    expect(spanOf('T/R · 1:15–2:30p')).toBe(75);
  });

  it('reads a range that marks it only at the start', () => {
    expect(spanOf('10:00a–12:15')).toBe(135);
  });

  it('handles a range that crosses noon', () => {
    expect(spanOf('11:30–1:00p')).toBe(90);
  });

  it('accepts a hyphen, an en dash or an em dash', () => {
    expect(spanOf('9:05-9:55a')).toBe(50);
    expect(spanOf('9:05–9:55a')).toBe(50);
    expect(spanOf('9:05—9:55a')).toBe(50);
  });

  it('copes with whole hours written without minutes', () => {
    expect(spanOf('9–10a')).toBe(60);
  });

  it('reads a meridiem spelled out, with or without its stops', () => {
    /*
     * The failure this was widened for. `a` and `p` alone is how this app's
     * own placeholder writes it and almost nothing else: a syllabus writes
     * "AM", or "p.m.", and the old pattern matched none of them — the letter
     * would match and then the "M" sat where the dash had to be. Every miss
     * here is a seventy-five minute class that `lengthOf` calls fifty.
     */
    expect(spanOf('MWF 9:30 AM - 10:45 AM')).toBe(75);
    expect(spanOf('MWF 9:30 am – 10:45 am')).toBe(75);
    expect(spanOf('TR 1:15 p.m. – 2:30 p.m.')).toBe(75);
    expect(spanOf('MW 2:00pm-3:15pm')).toBe(75);
    expect(spanOf('MWF 9 a.m. to 10 a.m.')).toBe(60);
  });

  it('accepts "to" where a syllabus writes it out', () => {
    expect(spanOf('TR 1:15 PM to 2:30 PM')).toBe(75);
    expect(spanOf('TR 2:00pm to 3:15pm')).toBe(75);
    // A word of its own, and not two letters between two numbers: without the
    // spaces required, "9to10" reads as an hour-long class.
    expect(spanOf('9to10')).toBeNull();
  });

  it('accepts the minus sign a spreadsheet paste leaves behind', () => {
    // U+2212, which is not any of the three dashes the pattern already took.
    expect(spanOf('TR 8:00−9:15a')).toBe(75);
  });

  it('says nothing when the line states no range', () => {
    expect(spanOf('MW')).toBeNull();
    expect(spanOf('')).toBeNull();
    expect(spanOf('By appointment')).toBeNull();
  });

  it('refuses a span too long to be one class', () => {
    // A whole-day range is a drop-in window or a date range, not a lecture,
    // and drawing a nine-hour block would swallow the day it sits on.
    expect(spanOf('9a–5p')).toBeNull();
  });
});

describe('lengthOf', () => {
  it('reads the length off the course the block belongs to', () => {
    expect(lengthOf(CAT, { time: '', at: 545, title: '', meta: '', c: 'econ' })).toBe(50);
    expect(lengthOf(CAT, { time: '', at: 795, title: '', meta: '', c: 'psci' })).toBe(75);
  });

  it('reads a length off a line that spells its meridiem out', () => {
    // Through the caller, because the fallback is what made a miss invisible:
    // fifty is a plausible number, so a class read as fifty looks answered.
    const spelled = buildCatalog([
      mod(course({ id: 's', code: 'S 100', meets: 'TR 1:15 p.m. – 2:30 p.m.' })),
    ]);
    expect(lengthOf(spelled, { time: '', at: 795, title: '', meta: '', c: 's' })).toBe(75);
  });

  it('falls back to fifty minutes when the line does not say', () => {
    const vague = buildCatalog([mod(course({ id: 'v', code: 'V 100', meets: 'MW' }))]);
    expect(lengthOf(vague, { time: '', at: 545, title: '', meta: '', c: 'v' })).toBe(50);
  });

  it('falls back for a block belonging to no course, and for a course that has gone', () => {
    expect(lengthOf(CAT, { time: '', at: 900, title: '', meta: '', c: null })).toBe(50);
    expect(lengthOf(CAT, { time: '', at: 900, title: '', meta: '', c: 'deleted' })).toBe(50);
  });
});

describe('campusHours', () => {
  // September 9th: the involvement fair at four, which states a time. The
  // feed fixtures below are dated onto the same day.
  const DAY = new Date(2026, 8, 9);
  const events = datedEvents(new Date(2026, 8, 9), 'vanderbilt');

  const feedEvent = (over: Partial<FeedEvent> & { id: string }): FeedEvent => ({
    sourceId: 'f',
    title: 'Something',
    date: '2026-09-09',
    at: 15 * 60,
    time: '3:00 PM',
    where: '',
    note: '',
    courseId: null,
    ...over,
  });

  it('reads the hour a listing states', () => {
    const fair = datedEvents(new Date(2026, 8, 9), 'vanderbilt').find(
      (e) => e.title === 'Anchor Down Involvement Fair',
    )!;
    const [block] = campusHours([fair], [], fair.date);
    expect(block.at).toBe(16 * 60);
    expect(block.title).toBe('Anchor Down Involvement Fair');
    // An hour: a listing says when it starts and not when it ends, and the
    // grid must not invent a length for a fair or a game.
    expect(block.minutes).toBe(60);
    expect(block.meta).toBe('Clubs · Student Life Center');
    expect(block.eventId).toBe(fair.id);
  });

  it('draws nothing for a listing whose time is not settled', () => {
    // Half the football schedule says TBD until the television window is set.
    // Midnight would be a lie; the lists under the grids still carry it.
    const tbd = events.filter((e) => e.time === 'TBD');
    expect(tbd.length).toBeGreaterThan(0);
    for (const e of tbd) expect(campusHours([e], [], e.date)).toEqual([]);
  });

  it('takes only what is on the day it was asked about', () => {
    const drawn = campusHours(events, [], DAY);
    expect(drawn.length).toBeGreaterThan(0);
    const ids = drawn.map((b) => b.eventId);
    for (const e of events) {
      if (ids.includes(e.id)) expect(e.date.getDate()).toBe(9);
    }
  });

  it('draws a feed entry that states a time and lists an all-day one', () => {
    const timed = feedEvent({ id: 'f1', title: 'Office hours', where: 'Calhoun 202' });
    const allDay = feedEvent({ id: 'f2', title: 'Reading day', at: null, time: 'All day' });
    const drawn = campusHours([], [timed, allDay], DAY);
    expect(drawn.map((b) => b.title)).toEqual(['Office hours']);
    expect(drawn[0].at).toBe(15 * 60);
    expect(drawn[0].meta).toBe('Calhoun 202');
    // A feed entry has no listing behind it, so there is nothing to open.
    expect(drawn[0].eventId).toBeNull();
  });

  it('marks every block campus, so a grid colours it as nobody’s choice', () => {
    const drawn = campusHours(events, [feedEvent({ id: 'f1' })], DAY);
    expect(drawn.every((b) => b.kind === 'campus' && b.c === null)).toBe(true);
  });

  it('gives every block its own id, and puts the day in order', () => {
    const drawn = campusHours(events, [feedEvent({ id: 'f1' })], DAY);
    expect(new Set(drawn.map((b) => b.id)).size).toBe(drawn.length);
    const times = drawn.map((b) => b.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('campusCalendar and datedEvents', () => {
  const NOW = new Date(2026, 8, 9);

  it('gives a Vanderbilt student the campus calendar, sample or no sample', () => {
    // The regression this is here for: importing your own four syllabi turns
    // the sample semester off, and the campus calendar used to hang off that
    // flag — so the Campus chip answered Athletics, Clubs, University and
    // Saved with nothing at all, on a screen that had been full the day
    // before. It hangs off where you study now, which is what it is about.
    expect(campusCalendar('vanderbilt', false).length).toBeGreaterThan(0);
    expect(campusCalendar('vanderbilt', true)).toEqual(campusCalendar('vanderbilt', false));
    expect(datedEvents(NOW, 'vanderbilt').length).toBeGreaterThan(0);
  });

  it('carries the sample semester in for somebody who has set no school', () => {
    // The sample is a Vanderbilt semester, so it brings Vanderbilt's calendar.
    expect(campusCalendar('', true)).toEqual(campusCalendar('vanderbilt', false));
  });

  it('offers nobody else somebody else’s football', () => {
    expect(campusCalendar('', false)).toEqual([]);
    expect(campusCalendar('somewhere-else', false)).toEqual([]);
    expect(datedEvents(NOW, 'somewhere-else')).toEqual([]);
  });

  it('dates every event and puts them in order', () => {
    const events = datedEvents(NOW, 'vanderbilt');
    const times = events.map((e) => e.date.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(events.every((e) => e.kind && e.title)).toBe(true);
  });

  it('has an event of every kind the chips offer', () => {
    // Athletics, Clubs and University are chips somebody can choose. A chip
    // that can only ever answer "nothing" is a broken control, so the
    // listings have to cover the row.
    const kinds = new Set(campusCalendar('vanderbilt', false).map((e) => e.kind));
    expect(kinds).toEqual(new Set(['Athletics', 'Clubs', 'University']));
  });
});
