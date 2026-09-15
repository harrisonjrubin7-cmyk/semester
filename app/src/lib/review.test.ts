import { describe, expect, it } from 'vitest';
import {
  A_SITTING,
  KEEPS_CATCHING,
  aSitting,
  cardKey,
  catching,
  keepsCatching,
  tallyBy,
  comeRound,
  dueCount,
  neverMet,
  dueFirst,
  emptyReview,
  score,
  strength,
  tally,
  tallyKeys,
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

describe('comeRound and neverMet', () => {
  it('does not call a card you have never seen a card that came round', () => {
    // The whole point: nothing went out, so nothing came back.
    expect(comeRound(['a', 'b'], {}, T0)).toBe(0);
    expect(neverMet(['a', 'b'], {})).toBe(2);
  });

  it('counts one answered before and due again', () => {
    expect(comeRound(['a'], { a: { ...pass(2), due: T0 - 1 } }, T0)).toBe(1);
  });

  it('leaves out one answered and scheduled ahead', () => {
    expect(comeRound(['a'], { a: pass(2) }, T0)).toBe(0);
    expect(neverMet(['a'], { a: pass(2) })).toBe(0);
  });

  it('adds up to what the lumped count says', () => {
    const reviews = { a: pass(2), b: { ...pass(1), due: T0 - 1 } };
    const keys = ['a', 'b', 'c'];
    expect(comeRound(keys, reviews, T0) + neverMet(keys, reviews)).toBe(
      dueCount(keys, reviews, T0),
    );
  });
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

describe('tallying a named set of cards', () => {
  it('counts only the keys it was handed', () => {
    // The third row is the answer left behind by a course since removed. A
    // screen reporting this term's studying must not see it, which is the
    // whole reason this exists beside `tally`.
    const reviews: Reviews = { a: pass(3), b: score(undefined, false, T0), ghost: pass(9) };
    const t = tallyKeys(['a', 'b'], reviews);
    expect(t.cards).toBe(2);
    expect(t.right).toBe(3);
    expect(t.pct).toBe(75);
  });

  it('is silent about a key with no history at all', () => {
    expect(tallyKeys(['never-drilled'], {})).toEqual({ cards: 0, right: 0, wrong: 0, pct: 0 });
  });

  it('agrees with `tally` when the keys are every key', () => {
    const reviews: Reviews = { a: pass(3), b: score(undefined, false, T0) };
    expect(tallyKeys(Object.keys(reviews), reviews)).toEqual(tally(reviews));
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

describe('a right answer the student says they guessed at', () => {
  const NOW = 1_788_000_000_000;
  const DAY = 86_400_000;

  it('earns the streak but not the runway', () => {
    // Letting a guess start a six-day interval is how a card disappears until
    // the week of the exam. `lib/sure.ts` decides this; `score` only obeys.
    let card = score(undefined, true, NOW);
    card = score(card, true, NOW + DAY);
    expect(card.interval).toBe(6);

    let guessed = score(undefined, true, NOW);
    guessed = score(guessed, true, NOW + DAY, true);
    expect(guessed.streak).toBe(2);
    expect(guessed.interval).toBe(1);
  });

  it('does not grow the ease either', () => {
    const settled = score(score(undefined, true, NOW), true, NOW + DAY);
    const guessed = score(score(undefined, true, NOW), true, NOW + DAY, true);
    expect(guessed.ease).toBeLessThan(settled.ease);
  });

  it('changes nothing about a wrong answer', () => {
    expect(score(undefined, false, NOW, true)).toEqual(score(undefined, false, NOW));
  });
});


/** Miss a card `n` times running. */
function fail(n: number, from = T0) {
  let r = score(undefined, false, from);
  for (let i = 1; i < n; i++) r = score(r, false, from + i * DAY);
  return r;
}

describe('aSitting', () => {
  const deck = Array.from({ length: 60 }, (_, i) => ({ key: `k${i}` }));

  it('hands over one sitting and counts what it left', () => {
    const run = aSitting(deck);
    expect(run.cards).toHaveLength(A_SITTING);
    expect(run.left).toBe(60 - A_SITTING);
  });

  it('keeps the order it was given', () => {
    // The cap must never change which cards come first — that is `dueFirst`'s
    // job, and a limit that reordered would read as "it keeps showing me the
    // easy ones".
    expect(aSitting(deck).cards.map((c) => c.key)).toEqual(deck.slice(0, A_SITTING).map((c) => c.key));
  });

  it('leaves nothing behind on a short deck', () => {
    const run = aSitting([{ key: 'a' }, { key: 'b' }]);
    expect(run.cards).toHaveLength(2);
    expect(run.left).toBe(0);
  });

  it('never reports a negative remainder', () => {
    expect(aSitting([], 25).left).toBe(0);
  });
});

describe('keepsCatching', () => {
  it('says nothing about a card nobody has answered', () => {
    expect(keepsCatching(undefined)).toBe(false);
    expect(keepsCatching(emptyReview(T0))).toBe(false);
  });

  it('holds off until the misses have piled up', () => {
    expect(keepsCatching(fail(KEEPS_CATCHING - 1))).toBe(false);
    expect(keepsCatching(fail(KEEPS_CATCHING))).toBe(true);
  });

  it('lets go once the card is being got right', () => {
    /*
     * The condition that matters more than the count. A card missed six times
     * two months ago and since got right twice running is a card that was
     * learned, and calling it a problem reads the history backwards.
     */
    let r = fail(KEEPS_CATCHING);
    expect(keepsCatching(r)).toBe(true);
    r = score(r, true, T0 + 10 * DAY);
    expect(keepsCatching(r)).toBe(true);
    r = score(r, true, T0 + 11 * DAY);
    expect(keepsCatching(r)).toBe(false);
  });

  it('picks the worst out of a deck, worst first', () => {
    const reviews: Reviews = {
      fine: pass(3),
      bad: fail(KEEPS_CATCHING),
      worse: fail(KEEPS_CATCHING + 4),
    };
    const deck = [{ key: 'fine' }, { key: 'bad' }, { key: 'worse' }];
    expect(catching(deck, reviews).map((c) => c.key)).toEqual(['worse', 'bad']);
  });
});
