import { describe, expect, it } from 'vitest';
import type { Catalog } from '../data/catalog';
import { EMPTY_ATHLETICS, type AthleticEvent, type AthleticsLibrary } from './athletics';
import { NOT_RECORDED, OFFERED, endsAt, readPayload, supportPayload, supportProblems, tripsIn } from './athleteshare';
import { ATHLETE_SHAREABLE } from './sharing';
import type { CourseModule, Item } from './types';

/**
 * What an athlete's share carries (D-037 slice 5). What the server accepts is
 * proved by supabase/supportshares.check.sql; this is what the screen builds.
 */

const NOW = new Date(2026, 8, 3); // Thu 3 Sep 2026
const TODAY = '2026-09-03';

// Months count from zero, as `Item.month` does: 8 is September.
const item = (id: string, c: string, month: number, day: number, confirmed?: boolean): Item =>
  ({ id, c, title: id, kind: 'Paper', month, day, dueTime: '11:59p', weight: '10%', where: '', detail: '', quote: '', source: '', ...(confirmed === undefined ? {} : { checked: { confirmed } }) }) as Item;

const mod = (id: string, days: number[]): CourseModule =>
  ({
    course: { id, code: id.toUpperCase(), name: `${id} course`, prof: 'Prof', email: 'p@example.edu', term: 'Fall 2026' },
    items: [],
    schedule: [{ days, time: '9:05a', at: 545, minutes: 50, title: 'Lecture', meta: '' }],
    guide: {},
    planMinutes: '',
    frameLabel: '',
  }) as unknown as CourseModule;

const catalog = (modules: CourseModule[], items: Item[] = []): Catalog =>
  ({
    items,
    modules,
    courses: modules.map((m) => m.course),
    byId: Object.fromEntries(modules.map((m) => [m.course.id, m.course])),
    short: {},
    shortCodes: [],
    empty: false,
    lessons: {},
    figures: {},
    extraFigures: {},
    blocks: {},
  }) as unknown as Catalog;

const event = (over: Partial<AthleticEvent>): AthleticEvent => ({
  id: 'e',
  title: 'Away meet',
  team: 'Track',
  kind: 'Travel',
  start: '2026-09-04T16:00', // Fri
  end: '2026-09-07T08:00', // Mon
  where: 'Knoxville',
  notes: '',
  steps: [],
  ...over,
});

const lib = (events: AthleticEvent[]): AthleticsLibrary => ({
  ...EMPTY_ATHLETICS,
  events,
  // What must never travel, whatever is chosen.
  cara: [{ id: 'h', date: '2026-09-02', hours: 4, kind: 'Practice', note: 'SECRET-HOURS' }],
  caraLimit: '20 a week SECRET-LIMIT',
});

// ECON meets Mondays and Fridays; HIST Wednesdays.
const cat = catalog([mod('econ', [1, 5]), mod('hist', [3])], [item('ps4', 'econ', 8, 5, true), item('essay', 'hist', 8, 6), item('later', 'hist', 8, 30)]);
const all = ATHLETE_SHAREABLE.map(([k]) => k);

describe('what is offered', () => {
  it('offers only what the app has a record of, and says why the rest is not', () => {
    expect(OFFERED).toEqual(['travel', 'missed', 'courses', 'deadlines']);
    expect(Object.keys(NOT_RECORDED).sort()).toEqual(['absence', 'pack']);
    for (const why of Object.values(NOT_RECORDED)) expect(why).toMatch(/^Not recorded in Semester yet/);
  });
});

describe('what a share carries', () => {
  it('carries only the chosen items, and never one the app has no record of', () => {
    const p = supportPayload(['courses', 'absence', 'pack'], ' Sam ', lib([]), cat, TODAY, '2026-10-01', NOW);
    expect(Object.keys(p).sort()).toEqual(['courses', 'sharedAs']);
    expect(p.sharedAs).toBe('Sam');
  });

  it('never carries the hours log, its limit, grades or anything computed, whatever is chosen', () => {
    const text = JSON.stringify(supportPayload(all, 'Sam', lib([event({})]), cat, TODAY, '2026-10-01', NOW));
    expect(text).not.toMatch(/SECRET|hours|grade|gpa|risk|eligib/i);
  });

  it('lists trips in the window with the courses each misses a class of', () => {
    const p = supportPayload(['travel'], 'Sam', lib([event({}), event({ id: 'p', kind: 'Practice', title: 'Practice' })]), cat, TODAY, '2026-10-01', NOW);
    expect(p.travel).toEqual([{ title: 'Away meet', kind: 'Travel', from: '2026-09-04', to: '2026-09-07', misses: ['ECON'] }]);
  });

  it('leaves out trips before today and after the share ends', () => {
    const past = event({ id: 'a', start: '2026-08-20T08:00', end: '2026-08-21T20:00' });
    const later = event({ id: 'b', start: '2026-11-20T08:00', end: '2026-11-21T20:00' });
    expect(tripsIn(lib([past, event({}), later]), TODAY, '2026-10-01').map((e) => e.start)).toEqual(['2026-09-04T16:00']);
  });

  it('lists the missed classes per course, from the syllabus', () => {
    const p = supportPayload(['missed'], 'Sam', lib([event({})]), cat, TODAY, '2026-10-01', NOW);
    expect(p.missed).toHaveLength(1);
    expect(p.missed![0].course).toBe('ECON');
    expect(p.missed![0].classes).toHaveLength(2); // Friday and Monday
  });

  it('labels each deadline during travel with where its date came from', () => {
    const p = supportPayload(['deadlines'], 'Sam', lib([event({})]), cat, TODAY, '2026-10-01', NOW);
    expect(p.deadlines).toEqual([
      { course: 'ECON', title: 'ps4', due: '2026-09-05', source: 'Imported' },
      { course: 'HIST', title: 'essay', due: '2026-09-06', source: 'Needs review' },
    ]);
  });

  it('says "nothing" by an empty list rather than dropping an item that was chosen', () => {
    const p = supportPayload(['travel', 'deadlines'], 'Sam', lib([]), cat, TODAY, '2026-10-01', NOW);
    expect(p.travel).toEqual([]);
    expect(p.deadlines).toEqual([]);
  });

  it('only ever uses keys the database accepts', () => {
    const p = supportPayload(all, 'Sam', lib([event({})]), cat, TODAY, '2026-10-01', NOW);
    const allowed = [...all, 'sharedAs'];
    for (const k of Object.keys(p)) expect(allowed).toContain(k);
  });
});

describe('before it can be shared', () => {
  it('needs something chosen, a name, an address and an end within the term', () => {
    expect(supportProblems([], '', 'nope', '', TODAY)).toEqual([
      'Choose at least one thing to share.',
      'Say how they will see your name.',
      'Enter the address they use for Semester.',
      'Needs an end date. Every share ends, at most one term from today.',
    ]);
    expect(supportProblems(['absence'], 'Sam', 's@x.edu', '2026-10-01', TODAY)).toEqual(['Choose at least one thing to share.']);
    expect(supportProblems(['courses'], 'Sam', 's@x.edu', '2027-04-01', TODAY)[0]).toMatch(/more than 200 days/);
    expect(supportProblems(['courses'], 'Sam', 's@x.edu', '2026-10-01', TODAY)).toEqual([]);
  });

  it('ends at the end of the chosen day, and never past the cap the server enforces', () => {
    expect(new Date(endsAt('2026-10-01', TODAY)).toLocaleDateString('en-CA')).toBe('2026-10-01');
    const capped = new Date(endsAt('2027-12-31', TODAY)).getTime() - new Date(`${TODAY}T23:59:00`).getTime();
    expect(Math.round(capped / 86_400_000)).toBe(200);
  });
});

describe('what the staff page reads', () => {
  it('rebuilds the payload field by field, dropping anything the preview could not have shown', () => {
    const p = readPayload({ sharedAs: 'Sam', grades: { ECON: 'B' }, courses: [{ code: 'ECON', name: 'Econ', extra: 1 }, 'junk'] });
    expect(p).toEqual({ sharedAs: 'Sam', courses: [{ code: 'ECON', name: 'Econ' }] });
    expect(readPayload(null)).toEqual({ sharedAs: '' });
  });
});
