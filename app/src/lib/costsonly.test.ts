/**
 * One rule, swept rather than reasoned about: a broken entry costs only itself.
 *
 * Three defects on this reader were the same mistake — a malformed override
 * deleting the week it named, an unreadable RECURRENCE-ID dropping its own
 * entry, an unreadable master silencing a readable change — and none was
 * caught by mutating a line, because none of them is one line. Each is two
 * guards interacting: something declines to draw an entry, and something else
 * has already stood down expecting it to.
 *
 * So this does not mutate. It takes every shape of entry the reader has to
 * survive, pairs each with every other, and asserts what must hold of all of
 * them. A fourth instance turned up the moment it first ran.
 */
import { describe, expect, it } from 'vitest';
import { parseIcs } from './ics';
import type { Course } from './types';

const COURSES: Course[] = [];
const wrap = (b: string) => ['BEGIN:VCALENDAR', 'VERSION:2.0', b, 'END:VCALENDAR'].join('\r\n');
const ev = (l: string[]) => ['BEGIN:VEVENT', ...l, 'END:VEVENT'].join('\r\n');

/** A healthy entry with nothing to do with any of the others. */
const BYSTANDER = ['UID:bystander@v', 'SUMMARY:PSCI 1104 seminar', 'DTSTART:20260915T100000'];

/** Entries that describe a class in their own right. `draws` is whether one alone puts anything on the calendar. */
const MASTERS: Record<string, { lines: string[]; draws: boolean; cancelled?: boolean }> = {
  plain: { lines: ['UID:x@v', 'SUMMARY:Class', 'DTSTART:20260907T140000', 'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4'], draws: true },
  noStart: { lines: ['UID:x@v', 'SUMMARY:Class', 'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4'], draws: false },
  badStart: { lines: ['UID:x@v', 'SUMMARY:Class', 'DTSTART:banana', 'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4'], draws: false },
  badRule: { lines: ['UID:x@v', 'SUMMARY:Class', 'DTSTART:20260907T140000', 'RRULE:FREQ=BANANA;COUNT=x'], draws: true },
  badExdate: { lines: ['UID:x@v', 'SUMMARY:Class', 'DTSTART:20260907T140000', 'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4', 'EXDATE:banana'], draws: true },
  // Well-formed and legitimately empty: every week of it is cancelled. Not a
  // broken entry, so the rule below does not reach it — see `cancelled`.
  everyWeekOff: { lines: ['UID:x@v', 'SUMMARY:Class', 'DTSTART:20260907T140000', 'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2', 'EXDATE:20260907T140000,20260914T140000'], draws: false, cancelled: true },
  alarmed: { lines: ['UID:x@v', 'SUMMARY:Class', 'DTSTART:20260907T140000', 'BEGIN:VALARM', 'DESCRIPTION:reminder', 'END:VALARM'], draws: true },
  torn: { lines: ['UID:x@v', 'SUMMARY:Class', 'DTSTART:20260907T140000', 'BEGIN:VALARM', 'ACTION:DISPLAY'], draws: true },
  none: { lines: [], draws: false },
};

/** Entries that change a week of one. `draws` is whether one alone puts anything on the calendar. */
const CHANGES: Record<string, { lines: string[]; draws: boolean; day?: string }> = {
  one: { lines: ['UID:x@v', 'RECURRENCE-ID:20260914T140000', 'DTSTART:20260917T140000', 'SUMMARY:Moved'], draws: true, day: '2026-09-17' },
  oneNoStart: { lines: ['UID:x@v', 'RECURRENCE-ID:20260914T140000', 'SUMMARY:Moved'], draws: false },
  oneBadStart: { lines: ['UID:x@v', 'RECURRENCE-ID:20260914T140000', 'DTSTART:banana', 'SUMMARY:Moved'], draws: false },
  oneBadId: { lines: ['UID:x@v', 'RECURRENCE-ID:banana', 'DTSTART:20260917T140000', 'SUMMARY:Moved'], draws: true, day: '2026-09-17' },
  good: { lines: ['UID:x@v', 'RECURRENCE-ID;RANGE=THISANDFUTURE:20260914T140000', 'DTSTART:20260917T140000', 'SUMMARY:For good'], draws: true, day: '2026-09-17' },
  goodNoStart: { lines: ['UID:x@v', 'RECURRENCE-ID;RANGE=THISANDFUTURE:20260914T140000', 'SUMMARY:For good'], draws: false },
  goodBadStart: { lines: ['UID:x@v', 'RECURRENCE-ID;RANGE=THISANDFUTURE:20260914T140000', 'DTSTART:banana', 'SUMMARY:For good'], draws: false },
  goodBadId: { lines: ['UID:x@v', 'RECURRENCE-ID;RANGE=THISANDFUTURE:banana', 'DTSTART:20260917T140000', 'SUMMARY:For good'], draws: true, day: '2026-09-17' },
  none: { lines: [], draws: false },
};

const pairs = Object.entries(MASTERS).flatMap(([m, mv]) => Object.entries(CHANGES).map(([c, cv]) => ({ m, c, mv, cv })));

const read = (lines: string[][]) =>
  parseIcs(COURSES, wrap([...lines.filter((l) => l.length).map(ev), ev(BYSTANDER)].join('\r\n')), 'f').events;

/*
 * Both ways round, every time. A calendar is free to write a change before the
 * entry it changes, and this reader has to expand the rules before it can know
 * which changes anything took up — so the order entries arrive in is a thing
 * that can be got wrong, and a sweep that only ever writes the class first
 * would never say so.
 */
const both = (m: string[], c: string[]) => [read([m, c]), read([c, m])];
const mine = (list: ReturnType<typeof read>) => list.filter((e) => e.title !== 'PSCI 1104 seminar');

describe('a broken entry costs only itself', () => {
  it('never silences the healthy entry beside it', () => {
    const lost = pairs
      .filter(({ mv, cv }) => both(mv.lines, cv.lines).some((r) => !r.some((e) => e.title === 'PSCI 1104 seminar')))
      .map(({ m, c }) => `${m} + ${c}`);
    expect(lost, `the bystander vanished for: ${lost.join(', ')}`).toEqual([]);
  });

  it('draws something whenever either entry names a real day', () => {
    /*
     * The shape found three times over: one entry declines to draw, and the
     * other has already stood down expecting it to.
     *
     * A class whose every week the calendar has cancelled is left out, and the
     * distinction is the point of the rule rather than an exception to it.
     * Nothing there is broken — the file says plainly that the class does not
     * meet — and a change naming one of those weeks has nothing to move. Making
     * it draw anyway would put a cancelled lecture back on the calendar, which
     * is the bug this whole file was written to stop.
     */
    const empty = pairs
      .filter(({ mv, cv }) => (mv.draws || cv.draws) && !mv.cancelled)
      .filter(({ mv, cv }) => both(mv.lines, cv.lines).some((r) => mine(r).length === 0))
      .map(({ m, c }) => `${m} + ${c}`);
    expect(empty, `nothing drawn for: ${empty.join(', ')}`).toEqual([]);
  });

  it('puts the day a readable change names on the calendar', () => {
    /*
     * Stronger than "the pair drew something", and it has to be: a master
     * drawing four of its own occurrences hides a change that vanished
     * silently beside it. That is how the fourth defect got past the first
     * version of this file.
     *
     * A master that cancels the week is left out for the reason above.
     */
    const missing = pairs
      .filter(({ mv, cv }) => cv.day && !mv.cancelled)
      .filter(({ mv, cv }) => both(mv.lines, cv.lines).some((r) => !r.some((e) => e.date === cv.day)))
      .map(({ m, c }) => `${m} + ${c}`);
    expect(missing, `the change never reached the calendar for: ${missing.join(', ')}`).toEqual([]);
  });

  it('never gives two rows the same id', () => {
    const clashes = pairs
      .filter(({ mv, cv }) =>
        both(mv.lines, cv.lines).some((r) => new Set(r.map((e) => e.id)).size !== r.length),
      )
      .map(({ m, c }) => `${m} + ${c}`);
    expect(clashes, `ids collided for: ${clashes.join(', ')}`).toEqual([]);
  });

  it('never draws the same day twice for one class', () => {
    // Two rows on one day is how a class that moved used to look.
    const doubled = pairs
      .filter(({ mv, cv }) =>
        both(mv.lines, cv.lines).some((r) => {
          const days = mine(r).map((e) => e.date);
          return new Set(days).size !== days.length;
        }),
      )
      .map(({ m, c }) => `${m} + ${c}`);
    expect(doubled, `a day drawn twice for: ${doubled.join(', ')}`).toEqual([]);
  });

  it('never lets an undrawable change take a week off the class', () => {
    /*
     * A change that puts nothing on the calendar must not remove anything
     * either. This is the first of the four, and the one the rest of this file
     * would miss: the class still draws three of its four weeks, so every
     * other rule here is satisfied while a lecture has quietly gone.
     */
    const thinned = pairs
      .filter(({ cv }) => !cv.draws && cv.lines.length)
      .filter(({ mv, cv }) => both(mv.lines, cv.lines).some((r) => mine(r).length < mine(read([mv.lines, []])).length))
      .map(({ m, c }) => `${m} + ${c}`);
    expect(thinned, `a week went missing for: ${thinned.join(', ')}`).toEqual([]);
  });

  it('never throws, and never dates anything unreadably', () => {
    for (const { mv, cv } of pairs) {
      expect(() => both(mv.lines, cv.lines)).not.toThrow();
      for (const e of both(mv.lines, cv.lines).flat()) {
        expect(e.date, JSON.stringify(e)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(e.id).toBeTruthy();
      }
    }
  });
});
