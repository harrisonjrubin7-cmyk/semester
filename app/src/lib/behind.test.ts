import { describe, expect, it } from 'vitest';
import {
  DEEP,
  DEEP_OVERDUE,
  behindLine,
  howBehind,
  moves,
  movesLine,
  triage,
} from './behind';
import type { Spent } from './pace';
import type { DatedItem } from './types';

const NOW = new Date(2026, 8, 18, 20, 0);

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

/** Enough reports that `estimate` will speak: two hours a problem set. */
const timed = (courseId: string, kind: string, minutes: number): Spent[] =>
  [1, 2, 3].map((n) => ({ id: `${courseId}${kind}${n}`, courseId, kind, minutes, at: n }));

const SPENT = timed('econ', 'problem set', 120);

describe('how behind, which is a number', () => {
  it('counts what has gone by and what is coming', () => {
    const b = howBehind(
      [item({ id: 'a', daysAway: -3 }), item({ id: 'b', daysAway: 2 })],
      {},
      SPENT,
      10,
    );
    expect(b.overdue).toBe(1);
    expect(b.ahead).toBe(1);
    expect(b.needed).toBe(4);
    expect(b.there).toBe(10);
  });

  it('leaves out what is ticked off', () => {
    const b = howBehind([item({ id: 'a', daysAway: -3 })], { a: true }, SPENT, 10);
    expect(b.overdue).toBe(0);
  });

  it('counts what it could not time rather than pretending it is nothing', () => {
    const b = howBehind([item({ id: 'a', daysAway: 2, kind: 'Recital' })], {}, SPENT, 10);
    expect(b.needed).toBe(0);
    expect(b.unweighed).toBe(1);
  });

  it('knows a bad week from a badly planned one', () => {
    const scheduling = howBehind([item({ id: 'a', daysAway: 2 })], {}, SPENT, 10);
    expect(scheduling.deep).toBe(false);

    const overdue = howBehind(
      Array.from({ length: DEEP_OVERDUE }, (_, n) => item({ id: `x${n}`, daysAway: -2 })),
      {},
      SPENT,
      40,
    );
    expect(overdue.deep).toBe(true);

    const hours = howBehind(
      Array.from({ length: 6 }, (_, n) => item({ id: `y${n}`, daysAway: 3 })),
      {},
      SPENT,
      1,
    );
    expect(hours.needed - hours.there).toBeGreaterThanOrEqual(DEEP);
    expect(hours.deep).toBe(true);
  });
});

describe('the recoverable window', () => {
  it('keeps a term-old miss out of the list, and says how many', () => {
    // Driving it against a term of unticked data threw up thirty-two rows, the
    // oldest forty-nine days past — an archive, not triage, and precisely the
    // wall of red this file exists to avoid.
    const items = [
      item({ id: 'recent', daysAway: -3 }),
      ...Array.from({ length: 9 }, (_, n) => item({ id: `old${n}`, daysAway: -40 })),
    ];
    const b = howBehind(items, {}, SPENT, 10);
    expect(b.overdue).toBe(1);
    expect(b.long).toBe(9);
    expect(behindLine(b)).toContain('9 older than that are not in the list below');
    expect(triage(items, {}, SPENT, 10).map((s) => s.id)).toEqual(['recent']);
  });

  it('does not let a term of old misses inflate the hours', () => {
    const old = Array.from({ length: 20 }, (_, n) => item({ id: `old${n}`, daysAway: -40 }));
    expect(howBehind(old, {}, SPENT, 10).needed).toBe(0);
  });

  it('calls a pile of only-old misses a tidying job', () => {
    const old = Array.from({ length: 5 }, (_, n) => item({ id: `old${n}`, daysAway: -40 }));
    expect(behindLine(howBehind(old, {}, SPENT, 10))).toContain('tidying job');
  });
});

describe('the opening sentence', () => {
  it('makes the week finite, which is its whole job', () => {
    // A bad week feels infinite and is usually eleven hours.
    const b = howBehind(
      [item({ id: 'a', daysAway: -3 }), item({ id: 'b', daysAway: 2 })],
      {},
      SPENT,
      3,
    );
    const said = behindLine(b);
    expect(said).toContain('1 deadline has gone by in the last fortnight');
    expect(said).toContain('1 in the next seven days');
    expect(said).toContain('4 hours');
    expect(said).toContain('1 short');
  });

  it('never reassures', () => {
    // "You've got this" from a piece of software is the thing that gets it
    // closed.
    const b = howBehind(
      Array.from({ length: 5 }, (_, n) => item({ id: `x${n}`, daysAway: -1 })),
      {},
      SPENT,
      1,
    );
    const said = behindLine(b).toLowerCase();
    for (const word of ['you can', 'don’t worry', 'fine', 'manageable', 'no problem', 'relax']) {
      expect(said).not.toContain(word);
    }
  });

  it('says when there is no hours figure to give', () => {
    const b = howBehind([item({ id: 'a', daysAway: 2, kind: 'Recital' })], {}, SPENT, 10);
    expect(behindLine(b)).toContain('no hours figure to give');
  });

  it('has nothing to say when nothing is outstanding', () => {
    expect(behindLine(howBehind([], {}, SPENT, 10))).toContain('no work to do');
  });
});

describe('the order a bad week wants', () => {
  const items = [
    item({ id: 'small', daysAway: 4, weight: '2%' }),
    item({ id: 'big', daysAway: 5, weight: '30%' }),
    item({ id: 'today', daysAway: 0 }),
    item({ id: 'gone', daysAway: -2 }),
  ];

  it('puts what is gone first, because that is what is being avoided', () => {
    const out = triage(items, {}, SPENT, 20);
    expect(out[0].id).toBe('gone');
    expect(out[0].where).toBe('gone');
    expect(out[1].id).toBe('today');
  });

  it('puts stakes before dates among what is still ahead', () => {
    const out = triage(items, {}, SPENT, 20).filter((s) => s.where !== 'gone' && s.where !== 'today');
    expect(out.map((s) => s.id)).toEqual(['big', 'small']);
  });

  it('marks what does not fit in the hours there are, and keeps it', () => {
    // A triage screen that quietly hid half the list would be the same wall of
    // red with better manners.
    const out = triage(items, {}, SPENT, 2);
    expect(out).toHaveLength(4);
    expect(out.some((s) => s.where === 'tight')).toBe(true);
    expect(out.find((s) => s.id === 'small')?.says).toContain('past the hours you have');
  });

  it('never instructs, and never says to drop anything', () => {
    // Whether to hand a paper in late, take the zero or ask for an extension
    // depends on a policy, a professor and a life the app cannot see.
    for (const s of triage(items, {}, SPENT, 1)) {
      const said = s.says.toLowerCase();
      for (const word of ['drop', 'skip', 'give up', 'abandon', 'forget', 'do not bother']) {
        expect(said).not.toContain(word);
      }
    }
  });

  it('says of a gone one that working tonight cannot fix it', () => {
    const [first] = triage([item({ id: 'gone', daysAway: -4 })], {}, SPENT, 10);
    expect(first.says).toContain('4 days past');
    expect(first.says).toContain('asking might');
  });

  it('leaves out what is ticked and what is more than a week away', () => {
    const out = triage(
      [item({ id: 'a', daysAway: 2 }), item({ id: 'b', daysAway: 2 }), item({ id: 'far', daysAway: 30 })],
      { a: true },
      SPENT,
      10,
    );
    expect(out.map((s) => s.id)).toEqual(['b']);
  });

  it('does not let untimed work eat the budget', () => {
    const out = triage(
      [item({ id: 'unknown', daysAway: 2, kind: 'Recital', weight: '40%' }), item({ id: 'known', daysAway: 3 })],
      {},
      SPENT,
      2,
    );
    expect(out.find((s) => s.id === 'known')?.where).toBe('fits');
  });
});

describe('the moves that are not working harder', () => {
  const bad = howBehind(
    Array.from({ length: 4 }, (_, n) => item({ id: `x${n}`, daysAway: -1 })),
    {},
    SPENT,
    2,
  );
  const fine = howBehind([item({ id: 'a', daysAway: 3 })], {}, SPENT, 20);

  it('offers the email first when something has gone by', () => {
    // A message on Tuesday is a different conversation from an apology on
    // Friday, and no planner has ever said so.
    expect(moves(bad)[0].id).toBe('write');
    expect(moves(bad)[0].why).toContain('Tuesday');
  });

  it('offers the withdrawal dates without suggesting withdrawal', () => {
    const dates = moves(bad).find((m) => m.id === 'dates');
    expect(dates?.why).toContain('Not a suggestion to withdraw');
  });

  it('does not raise any of that on an ordinary week', () => {
    expect(moves(fine).map((m) => m.id)).toEqual(['windows']);
  });

  it('always offers the one that checks its own arithmetic', () => {
    // Every figure on the screen rests on the hours the student stated.
    for (const b of [bad, fine]) {
      expect(moves(b).some((m) => m.id === 'windows')).toBe(true);
    }
  });

  it('does not encourage', () => {
    const said = `${movesLine(bad)} ${movesLine(fine)}`.toLowerCase();
    for (const word of ['you’ve got', 'chin up', 'stay positive', 'it will be']) {
      expect(said).not.toContain(word);
    }
  });
});
