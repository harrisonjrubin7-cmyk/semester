import { describe, expect, it } from 'vitest';
import { termProgress, weekAhead, weekLine, whereYouStand } from './you';
import type { DatedItem } from './types';

const NOW = new Date(2026, 8, 18, 20, 0);

const item = (patch: { id: string; daysAway: number }): DatedItem => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + patch.daysAway);
  return {
    c: 'econ',
    title: 'Something',
    kind: 'Problem set',
    dueTime: '11:59 PM',
    dueAt: 1439,
    weight: '10%',
    date,
    isPast: patch.daysAway < 0,
    isToday: patch.daysAway === 0,
    ...patch,
  } as DatedItem;
};

describe('term progress', () => {
  it('is null until the deadlines describe a span', () => {
    expect(termProgress([], NOW)).toBeNull();
    expect(termProgress([item({ id: 'a', daysAway: 3 })], NOW)).toBeNull();
  });

  it('is the clock between the first deadline and the last', () => {
    const through = termProgress([item({ id: 'a', daysAway: -10 }), item({ id: 'b', daysAway: 10 })], NOW);
    expect(through).toBeCloseTo(0.5, 2);
  });

  it('never leaves 0..1, whichever side of the term you are on', () => {
    const past = [item({ id: 'a', daysAway: -40 }), item({ id: 'b', daysAway: -10 })];
    expect(termProgress(past, NOW)).toBe(1);
    const future = [item({ id: 'a', daysAway: 10 }), item({ id: 'b', daysAway: 40 })];
    expect(termProgress(future, NOW)).toBe(0);
  });
});

describe('the coming week', () => {
  const items = [
    item({ id: 'gone', daysAway: -2 }),
    item({ id: 'today', daysAway: 0 }),
    item({ id: 'fri', daysAway: 3 }),
    item({ id: 'later', daysAway: 9 }),
  ];

  it('counts today and stops at seven days', () => {
    expect(weekAhead(items, {})).toEqual({ due: 2, done: 0 });
  });

  it('counts what is ticked inside the window only', () => {
    expect(weekAhead(items, { today: true, gone: true, later: true })).toEqual({ due: 2, done: 1 });
  });

  it('says so plainly, and says nothing rather than zero of zero', () => {
    expect(weekLine({ due: 0, done: 0 })).toMatch(/Nothing falls/);
    expect(weekLine({ due: 1, done: 1 })).toMatch(/one thing due this week is done/);
    expect(weekLine({ due: 4, done: 4 })).toBe('All 4 done.');
    expect(weekLine({ due: 4, done: 1 })).toBe('1 of 4 done.');
  });
});

describe('where you stand', () => {
  const items = [
    item({ id: 'missed', daysAway: -3 }),
    item({ id: 'handed-in-late', daysAway: -1 }),
    item({ id: 'soon', daysAway: 2 }),
    item({ id: 'early', daysAway: 4 }),
  ];
  const done = { 'handed-in-late': true, early: true };

  it('splits the term three ways and leaves nothing out', () => {
    const w = whereYouStand({ courses: [], items, done, now: NOW });
    expect(w.late).toBe(1);
    expect(w.done).toBe(2);
    expect(w.ahead).toBe(1);
    expect(w.late + w.done + w.ahead).toBe(w.total);
  });

  it('counts ticks against the courses in front of you, not every tick ever made', () => {
    // The tick left behind by a course somebody removed. It must not inflate
    // Done, which is what counting `state.done` itself used to do.
    const w = whereYouStand({ courses: [], items, done: { ...done, ghost: true }, now: NOW });
    expect(w.done).toBe(2);
  });

  it('sums the credits that were stated and drops the ones that were not', () => {
    const w = whereYouStand({
      courses: [{ credits: '3' }, { credits: '4' }, { credits: '' }, {}],
      items,
      done,
      now: NOW,
    });
    expect(w.courses).toBe(4);
    expect(w.credits).toBe(7);
  });
});
