import { describe, expect, it } from 'vitest';
import { SHARE, beginNow, hoursFor, opener, plan, planLine, startFor } from './start';
import type { Spent } from './pace';
import type { Window } from './windows';
import type { DatedItem } from './types';

// 18 September 2026 is a Friday.
const NOW = new Date(2026, 8, 18, 9, 0);

const item = (patch: Partial<DatedItem> & { id: string; daysAway: number }): DatedItem => {
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
    ...patch,
  } as DatedItem;
};

const timed = (courseId: string, kind: string, minutes: number): Spent[] =>
  [1, 2, 3].map((n) => ({ id: `${courseId}${kind}${n}`, courseId, kind, minutes, at: n }));

/** Four hours every weekday evening, six at weekends. */
const WINDOWS: Window[] = [
  { id: 'w1', days: [1, 2, 3, 4, 5], from: 18 * 60, to: 22 * 60, label: 'Evenings' },
  { id: 'w2', days: [0, 6], from: 11 * 60, to: 17 * 60, label: 'Weekends' },
] as Window[];

describe('the hours a day actually offers', () => {
  it('takes a share, because one paper is not the only thing that week', () => {
    // Four hours on a Monday, and half of it for any one piece of work.
    expect(hoursFor(WINDOWS, 1)).toBe(4 * SHARE);
    expect(hoursFor(WINDOWS, 6)).toBe(6 * SHARE);
  });

  it('falls back on a waking day where no windows are set', () => {
    expect(hoursFor([], 1)).toBeGreaterThan(0);
  });
});

describe('walking a runway backwards', () => {
  it('walks through the days that exist, not a fixed lead time', () => {
    // A Tuesday with two usable hours and a Saturday with three are not the
    // same day, and a fixed lead time treats them as though they were.
    const due = new Date(2026, 8, 30); // a Wednesday
    const found = startFor(due, 8 * 60, WINDOWS);
    expect(found).not.toBeNull();
    expect(found!.runway).toBeGreaterThan(0);
  });

  it('gives a short job a short runway', () => {
    const due = new Date(2026, 8, 30);
    const short = startFor(due, 60, WINDOWS)!;
    const long = startFor(due, 10 * 60, WINDOWS)!;
    expect(short.runway).toBeLessThan(long.runway);
  });

  it('refuses where there is nothing to estimate from', () => {
    expect(startFor(new Date(2026, 8, 30), 0, WINDOWS)).toBeNull();
  });

  it('refuses rather than returning the earliest day it walked to', () => {
    // More work than a term of windows holds is real, and worth saying.
    expect(startFor(new Date(2026, 8, 30), 100_000, WINDOWS)).toBeNull();
  });
});

describe('the plan', () => {
  const spent = [...timed('econ', 'problem set', 120), ...timed('bus', 'essay', 600)];

  it('orders by when things start, not by when they are due', () => {
    // A two-hour problem set due in six days starts on the day; a ten-hour
    // paper due in eight has to begin four days before that. Ordered by
    // deadline the list says the opposite.
    const p = plan({
      items: [
        item({ id: 'small', daysAway: 6 }),
        item({ id: 'big', daysAway: 8, c: 'bus', kind: 'Essay' }),
      ],
      done: {},
      spent,
      windows: WINDOWS,
      now: NOW,
    });
    expect(p.starts[0].id).toBe('big');
    expect(p.starts[0].startOn < p.starts[1].startOn).toBe(true);
  });

  it('never invents a start date for work it has not timed', () => {
    // A made-up start date is the one number somebody would arrange their
    // fortnight around.
    const p = plan({
      items: [item({ id: 'x', daysAway: 5, kind: 'Recital' })],
      done: {},
      spent,
      windows: WINDOWS,
      now: NOW,
    });
    expect(p.starts[0].startOn).toBe('');
    expect(p.starts[0].runway).toBeNull();
    expect(p.unweighed).toBe(1);
    expect(p.starts[0].says).toContain('no start date');
  });

  it('says when a start date has already gone', () => {
    const p = plan({
      items: [item({ id: 'big', daysAway: 1, c: 'bus', kind: 'Essay' })],
      done: {},
      spent,
      windows: WINDOWS,
      now: NOW,
    });
    expect(p.starts[0].late).toBe(true);
    expect(p.late).toBe(1);
    expect(p.starts[0].says).toContain('Should have begun');
  });

  it('leaves out what is ticked and what is past', () => {
    const p = plan({
      items: [item({ id: 'a', daysAway: 3 }), item({ id: 'b', daysAway: -2 })],
      done: { a: true },
      spent,
      windows: WINDOWS,
      now: NOW,
    });
    expect(p.starts).toEqual([]);
  });

  it('applies the measured bias, so a slow week pushes start dates earlier', () => {
    const plain = plan({
      items: [item({ id: 'a', daysAway: 20, c: 'bus', kind: 'Essay' })],
      done: {},
      spent,
      windows: WINDOWS,
      now: NOW,
    });
    const slow = plan({
      items: [item({ id: 'a', daysAway: 20, c: 'bus', kind: 'Essay' })],
      done: {},
      spent,
      windows: WINDOWS,
      now: NOW,
      bias: { ratio: 2, from: 9 },
    });
    expect(slow.starts[0].startOn < plain.starts[0].startOn).toBe(true);
  });

  it('finds what has to begin today or should already have', () => {
    const p = plan({
      items: [
        item({ id: 'now', daysAway: 1, c: 'bus', kind: 'Essay' }),
        item({ id: 'later', daysAway: 40, c: 'bus', kind: 'Essay' }),
      ],
      done: {},
      spent,
      windows: WINDOWS,
      now: NOW,
    });
    expect(beginNow(p).map((s) => s.id)).toEqual(['now']);
  });
});

describe('the headline', () => {
  const spent = timed('econ', 'problem set', 120);

  it('counts what it could not weigh in the same sentence', () => {
    // A short list is otherwise indistinguishable from a light fortnight.
    const p = plan({
      items: [item({ id: 'x', daysAway: 5, kind: 'Recital' })],
      done: {},
      spent,
      windows: WINDOWS,
      now: NOW,
    });
    expect(planLine(p, WINDOWS)).toContain('never been timed');
  });

  it('says when the hours it used were not the student’s own', () => {
    const p = plan({ items: [item({ id: 'a', daysAway: 5 })], done: {}, spent, windows: [], now: NOW });
    expect(planLine(p, [])).toContain('not set your working hours');
  });

  it('has something to say about an empty plan', () => {
    const p = plan({ items: [], done: {}, spent, windows: WINDOWS, now: NOW });
    expect(planLine(p, WINDOWS)).toContain('Nothing dated ahead');
  });
});

describe('the first action', () => {
  it('is a way into the document, by kind', () => {
    expect(opener('Problem set', 'PS4')).toContain('question 1');
    expect(opener('Essay', 'Federalism')).toContain('one sentence');
    expect(opener('Reading', 'Ch 4')).toContain('headings');
    expect(opener('Group work', 'ECOALF handover')).toContain('who is doing what');
    // A case study is a case, whatever the kind column calls it.
    expect(opener('Project', 'ECOALF case')).toContain('without notes');
  });

  it('has something for a kind it does not know', () => {
    expect(opener('Recital', 'Something')).toContain('Starting badly beats not starting');
  });

  it('never claims to know what the assignment says', () => {
    // The app has not read it, and an opener invented for it would be a
    // confident guess about somebody's coursework.
    for (const kind of ['Problem set', 'Essay', 'Exam', 'Reading', 'Recital']) {
      const said = opener(kind, 'Opera Philadelphia case').toLowerCase();
      expect(said).not.toContain('opera philadelphia');
    }
  });
});
