import { describe, expect, it } from 'vitest';
import { absenceEmail, eventDays, runsOver, type AthleticEvent, type Missed } from './athletics';
import type { Catalog } from '../data/catalog';
import type { CourseModule, Item } from './types';

const NOW = new Date(2026, 8, 3); // Thu 3 Sep 2026

const item = (id: string, c: string, month: number, day: number, title = id): Item =>
  ({
    id,
    c,
    title,
    kind: 'Paper',
    month,
    day,
    dueTime: '11:59p',
    weight: '10%',
    where: '',
    detail: '',
    quote: '',
    source: '',
  }) as Item;

const mod = (id: string, days: number[], email = 'prof@example.edu'): CourseModule =>
  ({
    course: { id, code: id.toUpperCase(), name: id, prof: 'Prof', email, term: 'Fall 2026' },
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

const trip: AthleticEvent = {
  id: 't',
  title: 'Away meet',
  team: 'Track',
  kind: 'Travel',
  // Fri 4 Sep 16:00 → Mon 7 Sep 08:00.
  start: '2026-09-04T16:00',
  end: '2026-09-07T08:00',
  where: 'Knoxville',
  notes: '',
  steps: [],
};

describe('what a trip runs over, course by course', () => {
  it('finds the classes that meet on those weekdays', () => {
    // Fri is 5, Mon is 1. The trip covers Fri, Sat, Sun, Mon.
    const out = runsOver(catalog([mod('econ', [5]), mod('psci', [2])]), eventDays(trip), NOW);
    expect(out.map((m) => m.course)).toEqual(['econ']);
    expect(out[0].classes).toEqual(['Fri Sep 4 · Lecture']);
  });

  it('finds a deadline inside the days as well as a class', () => {
    const out = runsOver(
      catalog([mod('econ', [5])], [item('ps4', 'econ', 8, 6, 'Problem Set 4')]),
      eventDays(trip),
      NOW,
    );
    expect(out[0].due).toEqual(['Sun Sep 6 · Problem Set 4']);
  });

  /*
   * The control. A course that neither meets nor falls due inside the trip is
   * not a course anybody should be written to about — and a version of this
   * that returned every enrolled course would look right on a screen and send
   * three professors a letter about a class they do not teach on that day.
   */
  it('leaves out a course with nothing in those days', () => {
    const out = runsOver(catalog([mod('econ', [5]), mod('psci', [2])]), eventDays(trip), NOW);
    expect(out.some((m) => m.course === 'psci')).toBe(false);
  });

  it('names a course once, with every session under it', () => {
    // Mon and Fri both inside the trip.
    const out = runsOver(catalog([mod('econ', [1, 5])]), eventDays(trip), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].classes).toEqual(['Fri Sep 4 · Lecture', 'Mon Sep 7 · Lecture']);
  });
});

describe('the absence email', () => {
  const missed: Missed = {
    course: 'econ',
    classes: ['Fri Sep 4 · Lecture'],
    due: ['Sun Sep 6 · Problem Set 4'],
  };

  it('names the course in the subject, so it is answerable from the inbox list', () => {
    expect(absenceEmail(trip, { code: 'ECON 1020' }, missed).subject).toBe(
      'ECON 1020 — absence for Away meet',
    );
  });

  it('lists what is missed, marked as class or as due', () => {
    const { body } = absenceEmail(trip, { code: 'ECON 1020' }, missed);
    expect(body).toContain('- Class: Fri Sep 4 · Lecture');
    expect(body).toContain('- Due: Sun Sep 6 · Problem Set 4');
  });

  /*
   * This lands in the inbox of somebody who can hold a grade. Two properties
   * matter more than anything else it says.
   */
  it('asks rather than announces, and claims no authorization', () => {
    const { body } = absenceEmail(trip, { code: 'ECON 1020' }, missed);
    expect(body).toMatch(/could we discuss/i);
    expect(body).toMatch(/this message is not one/i);
    expect(body).not.toMatch(/\b(is approved|has been approved|you are excused|I will be excused)\b/i);
  });

  /*
   * A `#` in an email body is a `#` in a professor's inbox. The document
   * version is markdown on purpose; this one must not be.
   */
  it('carries no markdown, because a mail client does not render it', () => {
    const { body } = absenceEmail(trip, { code: 'ECON 1020' }, missed);
    expect(body).not.toMatch(/^#/m);
    expect(body).not.toMatch(/\*\*/);
  });

  it('invents no reason for the absence beyond the trip the student entered', () => {
    const { body } = absenceEmail(trip, { code: 'ECON 1020' }, missed);
    expect(body).toContain('Away meet');
    expect(body).toContain('Track');
    expect(body).not.toMatch(/\b(ill|illness|sick|family emergency|unwell)\b/i);
  });

  it('says it will confirm, rather than listing nothing, when nothing was found', () => {
    const { body } = absenceEmail(trip, { code: 'ECON 1020' }, { course: 'econ', classes: [], due: [] });
    expect(body).toMatch(/I will confirm exactly which sessions/i);
  });
});
