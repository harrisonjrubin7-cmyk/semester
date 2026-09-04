import { describe, expect, it } from 'vitest';
import {
  cardKey,
  tallyBy,
  dueCount,
  dueFirst,
  emptyReview,
  score,
  strength,
  tally,
  unitMastery,
  type Reviews,
} from './review';

const T0 = Date.UTC(2026, 8, 3, 12, 0, 0);
const DAY = 86_400_000;

/** Answer a card `n` times, all correct, one day apart. */
function pass(n: number, from = T0) {
  let r = score(undefined, true, from);
  for (let i = 1; i < n; i++) r = score(r, true, from + i * DAY);
  return r;
}

describe('cardKey', () => {
  it('is stable for the same question in the same course', () => {
    expect(cardKey('econ', 'What is elasticity?')).toBe(cardKey('econ', 'What is elasticity?'));
  });

  it('separates courses, so two classes asking the same thing keep own histories', () => {
    expect(cardKey('econ', 'Define the margin')).not.toBe(cardKey('psci', 'Define the margin'));
  });

  it('changes when the question changes — reworded cards restart, by design', () => {
    expect(cardKey('econ', 'What is elasticity?')).not.toBe(cardKey('econ', 'What is elasticity'));
  });

  it('does not collide across a realistic deck', () => {
    const keys = new Set(
      Array.from({ length: 2000 }, (_, i) => cardKey('econ', `Question number ${i} about things?`)),
    );
    expect(keys.size).toBe(2000);
  });
});

describe('score', () => {
  it('schedules a first correct answer one day out', () => {
    const r = score(undefined, true, T0);
    expect(r.right).toBe(1);
    expect(r.streak).toBe(1);
    expect(r.due).toBe(T0 + DAY);
  });

  it('sends a missed card back in ten minutes, not next week', () => {
    const r = score(pass(3), false, T0);
    expect(r.due).toBe(T0 + 10 * 60_000);
    expect(r.streak).toBe(0);
    expect(r.wrong).toBe(1);
  });

  it('keeps the lifetime right count when a card is missed', () => {
    const r = score(pass(3), false, T0);
    expect(r.right).toBe(3);
  });

  it('grows the interval as the streak grows', () => {
    const one = pass(1);
    const two = pass(2);
    const three = pass(3);
    expect(one.interval).toBe(1);
    expect(two.interval).toBe(6);
    expect(three.interval).toBeGreaterThan(two.interval);
  });

  it('never lets ease fall below the SM-2 floor', () => {
    let r = emptyReview(T0);
    for (let i = 0; i < 20; i++) r = score(r, false, T0);
    expect(r.ease).toBeGreaterThanOrEqual(1.3);
  });
});

describe('strength', () => {
  it('is zero for a card never seen', () => {
    expect(strength(emptyReview(T0), T0)).toBe(0);
  });

  it('rises with the streak and never exceeds one', () => {
    const a = strength(pass(1), T0);
    const b = strength(pass(2), T0 + DAY);
    const c = strength(pass(3), T0 + 2 * DAY);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('puts one correct answer at or above half — a right answer must not lower mastery', () => {
    // The bug this guards: a linear streak/3 scored a first correct answer at
    // 0.33, below the ~50% a guide claims for an unseen unit, so drilling a
    // unit correctly made the number on screen go down.
    expect(strength(pass(1), T0)).toBeGreaterThanOrEqual(0.5);
  });

  it('decays once a card is overdue, but never to nothing', () => {
    const r = pass(3);
    const fresh = strength(r, r.due - 1);
    const stale = strength(r, r.due + 400 * DAY);
    expect(stale).toBeLessThan(fresh);
    expect(stale).toBeGreaterThan(0);
  });
});

describe('unitMastery', () => {
  const keys = ['a', 'b', 'c', 'd'];

  it('returns the seeded estimate when nothing has been answered', () => {
    expect(unitMastery(keys, {}, 60, T0)).toBe(60);
  });

  it('returns the seed for a unit with no cards at all', () => {
    expect(unitMastery([], {}, 42, T0)).toBe(42);
  });

  it('moves by one card at a time as answers come in', () => {
    const reviews: Reviews = { a: pass(3) };
    // One known card out of four, the rest still estimated at 40%.
    expect(unitMastery(keys, reviews, 40, T0 + 2 * DAY)).toBe(Math.round(((1 + 0.4 * 3) / 4) * 100));
  });

  it('reaches 100 only when every card is known', () => {
    const reviews: Reviews = Object.fromEntries(keys.map((k) => [k, pass(3)]));
    expect(unitMastery(keys, reviews, 10, T0 + 2 * DAY)).toBe(100);
  });

  it('falls when cards are missed', () => {
    const good: Reviews = Object.fromEntries(keys.map((k) => [k, pass(3)]));
    const bad: Reviews = Object.fromEntries(keys.map((k) => [k, score(pass(3), false, T0)]));
    expect(unitMastery(keys, bad, 50, T0)).toBeLessThan(unitMastery(keys, good, 50, T0 + 2 * DAY));
  });
});

describe('dueFirst', () => {
  it('puts overdue cards before unseen ones, and known cards last', () => {
    const reviews: Reviews = {
      overdue: { ...pass(2), due: T0 - DAY },
      known: pass(3),
    };
    const order = dueFirst(
      [{ key: 'known' }, { key: 'unseen' }, { key: 'overdue' }],
      reviews,
      T0,
    ).map((c) => c.key);
    expect(order[0]).toBe('overdue');
    expect(order[2]).toBe('known');
  });

  it('does not mutate the array it is given', () => {
    const input = [{ key: 'b' }, { key: 'a' }];
    const copy = [...input];
    dueFirst(input, {}, T0);
    expect(input).toEqual(copy);
  });
});

describe('dueCount', () => {
  it('counts unseen cards as due — they have to be learned', () => {
    expect(dueCount(['a', 'b'], {}, T0)).toBe(2);
  });

  it('excludes a card scheduled into the future', () => {
    expect(dueCount(['a'], { a: pass(2) }, T0)).toBe(0);
  });
});

describe('tally', () => {
  it('reports accuracy across every answer, not every card', () => {
    const reviews: Reviews = { a: pass(3), b: score(undefined, false, T0) };
    const t = tally(reviews);
    expect(t.cards).toBe(2);
    expect(t.right).toBe(3);
    expect(t.wrong).toBe(1);
    expect(t.pct).toBe(75);
  });

  it('does not divide by zero on an empty history', () => {
    expect(tally({}).pct).toBe(0);
  });
});

describe('tallying by course', () => {
  const deck = (courseId: string, qs: string[]) => ({ courseId, questions: qs });

  it('recomputes the keys, because a hash gives its course back to nobody', () => {
    const reviews: Reviews = {
      [cardKey('econ', 'What is elasticity?')]: {
        right: 3, wrong: 1, streak: 1, ease: 2.5, interval: 1, seen: 5, due: 9,
      },
      [cardKey('psci', 'What is federalism?')]: {
        right: 1, wrong: 4, streak: 0, ease: 2.5, interval: 1, seen: 5, due: 9,
      },
    };
    expect(
      tallyBy(reviews, [
        deck('econ', ['What is elasticity?']),
        deck('psci', ['What is federalism?']),
      ]),
    ).toEqual({ econ: { right: 3, wrong: 1 }, psci: { right: 1, wrong: 4 } });
  });

  it('leaves out a course whose deck has never been opened', () => {
    expect(tallyBy({}, [deck('bus', ['Anything?'])])).toEqual({});
  });

  it('ignores a card that was seeded but never answered', () => {
    const reviews: Reviews = {
      [cardKey('econ', 'q')]: {
        right: 0, wrong: 0, streak: 0, ease: 2.5, interval: 0, seen: 0, due: 0,
      },
    };
    expect(tallyBy(reviews, [deck('econ', ['q'])])).toEqual({});
  });
});
