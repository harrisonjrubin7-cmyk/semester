import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, HORIZON, adviceFor, clashes, whenLine, worstAhead } from './clash';
import type { Spent } from './pace';
import type { Commitment } from './activities';
import type { DatedItem } from './types';

const NOW = new Date(2026, 8, 4, 9, 0);

/** A deadline `daysAway` from `NOW`. */
const item = (patch: Partial<DatedItem> & { daysAway: number }): DatedItem => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + patch.daysAway);
  return {
    id: `i${Math.random()}`,
    c: 'econ',
    title: 'Problem Set',
    kind: 'Problem set',
    dueTime: '11:59 PM',
    dueAt: 1439,
    weight: '10%',
    date,
    ...patch,
  } as DatedItem;
};

/** Enough reports that `estimate` will speak. */
const timed = (courseId: string, kind: string, minutes: number): Spent[] =>
  [1, 2, 3].map((n) => ({ id: `s${courseId}${kind}${n}`, courseId, kind, minutes, at: n }));

const club = (days: number[], name = 'the away game'): Commitment =>
  ({
    id: 'c1',
    name,
    kind: 'sport',
    role: '',
    where: '',
    url: '',
    note: '',
    days,
    at: null,
    minutes: 0,
    hours: '',
    active: true,
    created: 0,
  }) as unknown as Commitment;

/** Course id to code, the way the store hands it round. */
const code = (id: string) => ({ econ: 'ECON 1020', psci: 'PSCI 1104' })[id] ?? id.toUpperCase();

describe('two exams on one day', () => {
  it('is called out, with both named', () => {
    const out = clashes(
      [
        item({ daysAway: 9, kind: 'Midterm' }),
        item({ daysAway: 9, kind: 'Exam', c: 'psci' }),
      ],
      [],
      [],
      code,
    );
    expect(out.filter((c) => c.kind === 'exams')).toHaveLength(1);
    expect(out[0].says).toContain('ECON 1020 and PSCI 1104');
  });

  it('is not raised for one exam, however big', () => {
    expect(clashes([item({ daysAway: 5, kind: 'Final exam' })], [], [], code)).toEqual([]);
  });

  it('finds a final and a midterm without either being labelled specially', () => {
    const out = clashes(
      [item({ daysAway: 3, kind: 'Final' }), item({ daysAway: 3, kind: 'Midterm 2' })],
      [],
      [],
      code,
    );
    expect(out.some((c) => c.kind === 'exams')).toBe(true);
  });
});

describe('a day whose work does not fit', () => {
  it('adds up what it can estimate, from your own reports', () => {
    const out = clashes(
      [item({ daysAway: 6 }), item({ daysAway: 6 }), item({ daysAway: 6 })],
      timed('econ', 'problem set', 120),
      [],
      code,
    );
    const heavy = out.find((c) => c.kind === 'heavy');
    expect(heavy?.hours).toBe(6);
    expect(heavy?.says).toBe('About 6 hours of work due, on your own timings.');
  });

  it('stays quiet on a day that fits', () => {
    const out = clashes([item({ daysAway: 6 })], timed('econ', 'problem set', 120), [], code);
    expect(out.find((c) => c.kind === 'heavy')).toBeUndefined();
  });

  it('never invents an estimate for work it has not seen', () => {
    // Defaulting an unknown assignment to an average produces a number that
    // is confidently wrong in whichever direction the average sits.
    const out = clashes(
      [item({ daysAway: 6 }), item({ daysAway: 6, kind: 'Essay' })],
      timed('econ', 'problem set', 300),
      [],
      code,
    );
    const heavy = out.find((c) => c.kind === 'heavy');
    expect(heavy?.hours).toBe(5);
    expect(heavy?.unknown).toBe(1);
    expect(heavy?.says).toContain('plus 1 the app has never timed');
  });

  it('takes a budget the student sets', () => {
    const work = [item({ daysAway: 6 }), item({ daysAway: 6 })];
    const spent = timed('econ', 'problem set', 90);
    expect(clashes(work, spent, [], code, 2).some((c) => c.kind === 'heavy')).toBe(true);
    expect(clashes(work, spent, [], code, DEFAULT_BUDGET).some((c) => c.kind === 'heavy')).toBe(false);
  });
});

describe('everything due at one time', () => {
  it('is raised at three, because 11:59 PM is a default not a decision', () => {
    const three = [1, 2, 3].map(() => item({ daysAway: 4, dueAt: 1439 }));
    const out = clashes(three, [], [], code);
    expect(out.find((c) => c.kind === 'stacked')?.says).toBe('3 things due at 11:59 PM.');
  });

  it('is not raised for two', () => {
    const two = [1, 2].map(() => item({ daysAway: 4, dueAt: 1439 }));
    expect(clashes(two, [], [], code).find((c) => c.kind === 'stacked')).toBeUndefined();
  });

  it('does not group things due at different hours', () => {
    const spread = [
      item({ daysAway: 4, dueAt: 540 }),
      item({ daysAway: 4, dueAt: 1000 }),
      item({ daysAway: 4, dueAt: 1439 }),
    ];
    expect(clashes(spread, [], [], code).find((c) => c.kind === 'stacked')).toBeUndefined();
  });
});

describe('work landing on a day you are already committed', () => {
  it('joins up two things the student entered', () => {
    // 4 Sept 2026 is a Friday; +7 is the next Friday.
    const out = clashes(
      [item({ daysAway: 7 }), item({ daysAway: 7, kind: 'Essay' })],
      [],
      [club([5])],
      code,
    );
    expect(out.find((c) => c.kind === 'committed')?.says).toContain('the away game');
  });

  it('says nothing about a busy day with one thing on it', () => {
    expect(clashes([item({ daysAway: 7 })], [], [club([5])], code)).toEqual([]);
  });

  it('says nothing when the commitment is on another weekday', () => {
    const out = clashes([item({ daysAway: 7 }), item({ daysAway: 7 })], [], [club([1])], code);
    expect(out.find((c) => c.kind === 'committed')).toBeUndefined();
  });
});

describe('the horizon', () => {
  it('looks far enough ahead that the answer is still "start earlier"', () => {
    expect(HORIZON).toBeGreaterThanOrEqual(14);
    const out = clashes(
      [item({ daysAway: HORIZON, kind: 'Exam' }), item({ daysAway: HORIZON, kind: 'Midterm' })],
      [],
      [],
      code,
    );
    expect(out).toHaveLength(1);
  });

  it('ignores what is past the horizon and what has gone', () => {
    const far = [item({ daysAway: HORIZON + 1, kind: 'Exam' }), item({ daysAway: HORIZON + 1, kind: 'Midterm' })];
    expect(clashes(far, [], [], code)).toEqual([]);
    const gone = [item({ daysAway: -2, kind: 'Exam' }), item({ daysAway: -2, kind: 'Midterm' })];
    expect(clashes(gone, [], [], code)).toEqual([]);
  });
});

describe('the order they come back in', () => {
  it('is nearest first', () => {
    const out = clashes(
      [
        item({ daysAway: 10, kind: 'Exam' }),
        item({ daysAway: 10, kind: 'Midterm' }),
        item({ daysAway: 3, kind: 'Final' }),
        item({ daysAway: 3, kind: 'Test' }),
      ],
      [],
      [],
      code,
    );
    expect(out[0].daysAway).toBe(3);
  });

  it('puts the harder kind first within a day', () => {
    // Two exams is a bigger problem than a busy afternoon, and reading the
    // smaller one first would bury it.
    const out = clashes(
      [
        item({ daysAway: 5, kind: 'Exam' }),
        item({ daysAway: 5, kind: 'Midterm' }),
        item({ daysAway: 5, kind: 'Exam' }),
      ],
      [],
      [],
      code,
    );
    expect(out[0].kind).toBe('exams');
  });

  it('offers one for Today rather than a list of four', () => {
    const out = clashes([item({ daysAway: 2, kind: 'Exam' }), item({ daysAway: 2, kind: 'Final' })], [], [], code);
    expect(worstAhead(out)).toBe(out[0]);
    expect(worstAhead([])).toBeNull();
  });
});

describe('what it says about when', () => {
  it('names the near days rather than counting them', () => {
    const c = { daysAway: 0 } as never;
    expect(whenLine({ ...(c as object), daysAway: 0 } as never)).toBe('Today');
    expect(whenLine({ daysAway: 1 } as never)).toBe('Tomorrow');
    expect(whenLine({ daysAway: 9 } as never)).toBe('In 9 days');
  });
});

describe('what to do about it', () => {
  it('gives each kind its own answer, and none of them is "work harder"', () => {
    const said = (['exams', 'heavy', 'stacked', 'committed'] as const).map((kind) =>
      adviceFor({ kind } as never),
    );
    for (const s of said) expect(s).toBeTruthy();
    expect(new Set(said).size).toBe(4);
    for (const s of said) expect(s.toLowerCase()).not.toContain('work harder');
  });
});
