import { describe, expect, it } from 'vitest';
import { isOfficeHours, nextSitting, readClock, whenLine, worthGoing } from './officehours';
import type { DatedItem, RecurringBlock } from './types';
import type { Sitting } from './sitting';

const block = (over: Partial<RecurringBlock> = {}): RecurringBlock => ({
  days: [4],
  at: 10 * 60 + 30,
  time: '10:30a',
  title: 'Trounstine office hours',
  meta: 'Commons 363A',
  ...over,
});

const item = (over: Partial<DatedItem>): DatedItem =>
  ({ id: 'i1', c: 'econ', title: 'Problem Set 1', kind: 'Problem set', daysAway: 0, ...over }) as DatedItem;

const paper = (over: Partial<Sitting>): Sitting =>
  ({ id: 's1', courseId: 'econ', title: 'Paper', at: 0, minutes: 30, got: 0, outOf: 100, pct: 50, code: '', missed: [], ...over }) as Sitting;

// Thursday 3 September 2026, 09:00.
const NOW = new Date(2026, 8, 3, 9, 0);

describe('spotting office hours in a schedule', () => {
  it('takes the flag the field exists for', () => {
    expect(isOfficeHours(block({ title: 'Drop by', optional: true }))).toBe(true);
  });

  it('takes the title, because a block typed by hand is named not flagged', () => {
    expect(isOfficeHours(block({ title: 'Office hours', optional: false }))).toBe(true);
    expect(isOfficeHours(block({ title: 'Drop-in hours' }))).toBe(true);
  });

  it('leaves a lecture alone', () => {
    expect(isOfficeHours(block({ title: 'PSCI 1104', optional: false }))).toBe(false);
  });
});

describe('reading a time a person wrote', () => {
  it('takes the forms this app already uses', () => {
    expect(readClock('2:45p')).toBe(14 * 60 + 45);
    expect(readClock('9:10a')).toBe(9 * 60 + 10);
    expect(readClock('10:30 AM')).toBe(10 * 60 + 30);
    expect(readClock('9a')).toBe(9 * 60);
  });

  it('gets noon and midnight the right way round', () => {
    expect(readClock('12:00p')).toBe(12 * 60);
    expect(readClock('12:30a')).toBe(30);
  });

  it('takes what a time input hands back', () => {
    expect(readClock('14:45')).toBe(14 * 60 + 45);
    expect(readClock('09:05')).toBe(9 * 60 + 5);
  });

  it('refuses rather than guesses', () => {
    expect(readClock('afternoon')).toBeNull();
    expect(readClock('')).toBeNull();
    expect(readClock('13:00p')).toBeNull();
    expect(readClock('9:75a')).toBeNull();
    expect(readClock('25:00')).toBeNull();
  });
});

describe('when the next one is', () => {
  it('finds the next day it falls on', () => {
    const next = nextSitting([block({ days: [4] })], NOW);
    // Thursday is today, and 10:30 has not happened yet at 09:00.
    expect(next?.on.getDate()).toBe(3);
    expect(whenLine(next, NOW)).toBe('Today, 10:30a');
  });

  it('rolls to next week once today’s has been and gone', () => {
    const afternoon = new Date(2026, 8, 3, 15, 0);
    const next = nextSitting([block({ days: [4] })], afternoon);
    expect(next?.on.getDate()).toBe(10);
    expect(whenLine(next, afternoon)).toBe('Thu, 10:30a');
  });

  it('names tomorrow as tomorrow', () => {
    const next = nextSitting([block({ days: [5] })], NOW);
    expect(whenLine(next, NOW)).toBe('Tomorrow, 10:30a');
  });

  it('takes the soonest of several', () => {
    const next = nextSitting([block({ days: [4] }), block({ days: [1], time: '2:00p', at: 840 })], NOW);
    expect(next?.block.time).toBe('10:30a');
  });

  it('says nothing when there are none', () => {
    expect(nextSitting([], NOW)).toBeNull();
    expect(whenLine(null, NOW)).toBe('');
  });
});

describe('when it is worth going', () => {
  const none = { items: [], done: {}, sittings: [], drilled: {}, now: NOW };

  it('says nothing about a course that is fine', () => {
    expect(worthGoing(none)).toEqual([]);
  });

  it('notices two deadlines gone by, and not one', () => {
    const one = worthGoing({ ...none, items: [item({ id: 'a', daysAway: -3 })] });
    expect(one).toEqual([]);

    const two = worthGoing({
      ...none,
      items: [item({ id: 'a', daysAway: -3 }), item({ id: 'b', daysAway: -9 })],
    });
    expect(two).toEqual([
      { courseId: 'econ', said: '2 deadlines went by unticked in the last three weeks.' },
    ]);
  });

  it('does not count one you ticked', () => {
    const out = worthGoing({
      ...none,
      items: [item({ id: 'a', daysAway: -3 }), item({ id: 'b', daysAway: -9 })],
      done: { b: true },
    });
    expect(out).toEqual([]);
  });

  it('forgets a deadline older than three weeks', () => {
    const out = worthGoing({
      ...none,
      items: [item({ id: 'a', daysAway: -3 }), item({ id: 'b', daysAway: -40 })],
    });
    expect(out).toEqual([]);
  });

  it('notices a practice paper that went badly, recently', () => {
    const recent = new Date(2026, 8, 1).getTime();
    const out = worthGoing({ ...none, sittings: [paper({ at: recent, pct: 48 })] });
    expect(out).toEqual([{ courseId: 'econ', said: 'You sat a practice paper at 48%.' }]);
  });

  it('leaves a decent paper alone', () => {
    const recent = new Date(2026, 8, 1).getTime();
    expect(worthGoing({ ...none, sittings: [paper({ at: recent, pct: 74 })] })).toEqual([]);
  });

  it('forgets a bad paper from a month ago', () => {
    const old = new Date(2026, 6, 20).getTime();
    expect(worthGoing({ ...none, sittings: [paper({ at: old, pct: 48 })] })).toEqual([]);
  });

  it('notices a drill deck going badly, once there is enough of it', () => {
    const thin = worthGoing({ ...none, drilled: { econ: { right: 1, wrong: 3 } } });
    expect(thin).toEqual([]);

    const real = worthGoing({ ...none, drilled: { econ: { right: 4, wrong: 11 } } });
    expect(real).toEqual([{ courseId: 'econ', said: 'You are missing 73% of the cards you drill.' }]);
  });

  it('leaves a deck you are getting right alone', () => {
    expect(worthGoing({ ...none, drilled: { econ: { right: 14, wrong: 4 } } })).toEqual([]);
  });

  it('gives one sentence per course, not a list of three', () => {
    const recent = new Date(2026, 8, 1).getTime();
    const out = worthGoing({
      ...none,
      items: [item({ id: 'a', daysAway: -3 }), item({ id: 'b', daysAway: -9 })],
      sittings: [paper({ at: recent, pct: 48 })],
      drilled: { econ: { right: 4, wrong: 11 } },
    });
    expect(out).toHaveLength(1);
  });

  it('speaks up for each course separately', () => {
    const out = worthGoing({
      ...none,
      items: [
        item({ id: 'a', c: 'econ', daysAway: -3 }),
        item({ id: 'b', c: 'econ', daysAway: -9 }),
        item({ id: 'c', c: 'psci', daysAway: -2 }),
        item({ id: 'd', c: 'psci', daysAway: -5 }),
      ],
    });
    expect(out.map((r) => r.courseId).sort()).toEqual(['econ', 'psci']);
  });
});
