import { describe, expect, it } from 'vitest';
import {
  doors,
  nextUp,
  shortly,
  standLine,
  termProgress,
  weekAhead,
  weekLine,
  weekShape,
  whereYouStand,
} from './you';
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

describe('the credits in the headline', () => {
  it('reads the credit count out of the line, not the first number in it', () => {
    // "4 courses · 2026 credits" was the header this produced.
    const where = whereYouStand({
      courses: [{ credits: '2026 Spring · 3 credits' }, { credits: '9:30 TR, 4 credits' }],
      items: [],
      done: {},
      now: NOW,
    });
    expect(where.credits).toBe(7);
  });

  it('counts a line that states no credits as none', () => {
    const where = whereYouStand({
      courses: [{ credits: 'TR 9:30-10:45' }, { credits: '3' }],
      items: [],
      done: {},
      now: NOW,
    });
    expect(where.credits).toBe(3);
  });
});

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

describe('the sentence at the top', () => {
  const where = (patch: Partial<Parameters<typeof standLine>[0]>) =>
    standLine({
      courses: 4,
      credits: 11,
      ahead: 10,
      done: 2,
      late: 0,
      total: 20,
      through: 0.3,
      week: { due: 0, done: 0 },
      ...patch,
    });

  it('leads on what is late, and moves the verb with the number', () => {
    expect(where({ late: 1, week: { due: 0, done: 0 } })).toMatch(/1 thing is past its date/);
    expect(where({ late: 3, week: { due: 0, done: 0 } })).toMatch(/3 things are past their date/);
  });

  it('says the week alongside it when the week has anything in it', () => {
    expect(where({ late: 2, week: { due: 4, done: 1 } })).toBe(
      '2 things are past their date, and 4 more fall inside seven days.',
    );
  });

  it('counts what is left rather than what is done, when nothing is late', () => {
    expect(where({ week: { due: 5, done: 2 } })).toBe(
      '3 of the 5 due inside seven days are still to do.',
    );
    expect(where({ week: { due: 2, done: 1 } })).toMatch(/1 of the 2 .* is still to do/);
  });

  it('does not call an empty catalogue finished', () => {
    expect(where({ total: 0, ahead: 0, done: 0, week: { due: 0, done: 0 } })).toMatch(
      /No dated deadlines/,
    );
  });

  it('says so plainly when the week is clear, and does not congratulate', () => {
    expect(where({ week: { due: 3, done: 3 } })).toBe("All 3 of this week's deadlines are done.");
    expect(where({ week: { due: 0, done: 0 }, ahead: 12 })).toMatch(/12 still ahead of you/);
    expect(where({ week: { due: 0, done: 0 }, ahead: 0 })).toMatch(/Every deadline/);
  });
});

describe('the shape of the coming week', () => {
  const items = [
    item({ id: 'gone', daysAway: -1 }),
    item({ id: 'a', daysAway: 0 }),
    item({ id: 'b', daysAway: 0 }),
    item({ id: 'c', daysAway: 3 }),
    item({ id: 'far', daysAway: 9 }),
  ];

  it('starts on today and runs seven days', () => {
    const days = weekShape(items, {}, NOW);
    expect(days).toHaveLength(7);
    expect(days[0].today).toBe(true);
    expect(days[0].date.getDate()).toBe(NOW.getDate());
    expect(days.slice(1).every((d) => !d.today)).toBe(true);
  });

  it('counts each day on its own, and leaves out what is behind or beyond it', () => {
    const days = weekShape(items, {}, NOW);
    expect(days.map((d) => d.due)).toEqual([2, 0, 0, 1, 0, 0, 0]);
  });

  it('counts the ticked ones inside each day', () => {
    const days = weekShape(items, { a: true, gone: true }, NOW);
    expect(days[0]).toMatchObject({ due: 2, done: 1 });
    expect(days[3]).toMatchObject({ due: 1, done: 0 });
  });
});

describe('the doors it offers', () => {
  const standing = (patch: Partial<ReturnType<typeof whereYouStand>>) => ({
    courses: 4,
    credits: 11,
    ahead: 10,
    done: 2,
    late: 0,
    total: 20,
    through: 0.3,
    week: { due: 3, done: 0 },
    ...patch,
  });

  it('puts what is late first, then the cards, then the next thing', () => {
    const next = item({ id: 'soon', daysAway: 2 });
    const got = doors({ where: standing({ late: 2 }), cards: 12, next });
    expect(got.map((d) => d.id)).toEqual(['late', 'cards', 'next']);
    expect(got[0]).toMatchObject({ label: '2 late', screen: 'behind' });
    expect(got[1].label).toBe('Drill 12 cards');
    expect(got[2]).toMatchObject({ screen: 'item', item: 'soon' });
  });

  it('never offers a count of nothing', () => {
    const got = doors({ where: standing({ late: 0 }), cards: 0, next: null });
    expect(got.map((d) => d.id)).toEqual(['week']);
  });

  it('offers nothing at all once the term is finished', () => {
    expect(doors({ where: standing({ ahead: 0, week: { due: 0, done: 0 } }), cards: 0, next: null })).toEqual([]);
  });

  it('stops at three', () => {
    const got = doors({ where: standing({ late: 9 }), cards: 4, next: item({ id: 'x', daysAway: 1 }) });
    expect(got).toHaveLength(3);
  });
});

describe('the next thing', () => {
  it('is the soonest that is neither ticked nor already gone', () => {
    const items = [
      item({ id: 'late', daysAway: -3 }),
      item({ id: 'ticked', daysAway: 1 }),
      item({ id: 'real', daysAway: 2 }),
    ];
    expect(nextUp(items, { ticked: true })?.id).toBe('real');
    expect(nextUp([item({ id: 'late', daysAway: -3 })], {})).toBeNull();
  });
});

describe('a title short enough for a button', () => {
  it('takes the first clause where the title has one', () => {
    expect(shortly('Reflection #2 — Are elite athletes super-humans?')).toBe('Reflection #2');
    expect(shortly('Problem Set 4: elasticity and revenue')).toBe('Problem Set 4');
  });

  it('cuts on a space rather than mid-word', () => {
    expect(shortly('Quiz on comparative advantage and the gains from trade')).toBe(
      'Quiz on comparative advantage…',
    );
  });

  it('leaves a title that already fits exactly as it is', () => {
    expect(shortly('Quiz #1')).toBe('Quiz #1');
    expect(shortly('Midterm — in class')).toBe('Midterm');
  });

  it('does not mistake a hyphenated word for a clause break', () => {
    expect(shortly('Super-humans')).toBe('Super-humans');
  });
});
