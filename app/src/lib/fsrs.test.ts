import { describe, expect, it } from 'vitest';
import {
  DECAY,
  FACTOR,
  type Grade,
  TARGET_RETENTION,
  W,
  firstMemory,
  intervalDays,
  nextMemory,
  retrievability,
} from './fsrs';

/**
 * The scheduler, held to the two things it is *defined* by rather than to a
 * table of outputs somebody pasted from a run.
 *
 * A test that asserts `nextMemory(...).stability === 7.43` proves the code
 * still does what it did the day it was written, which is worth something and
 * is not worth much: it goes red for a refit of the weights, which is a
 * correct change, and it stays green for a formula that has been subtly
 * transcribed wrong, as long as nobody re-ran it. So the assertions here are
 * mostly *properties* — relations that must hold whatever the twenty-one
 * numbers are — and the few literal values are ones worked out by hand below
 * rather than read off the implementation.
 */

/** Stability is *defined* as the days until recall falls to 90%. */
const NINETY = 0.9;

describe('the forgetting curve, which is what stability means', () => {
  /*
   * The single most important assertion in this file.
   *
   * `FACTOR` exists only to make the curve pass through 0.9 at exactly one
   * stability — that is the definition of the word. Derive it wrong and every
   * interval in the app is off by a constant while every other test here still
   * passes, because they are all relative. Worked by hand:
   *
   *   DECAY  = -W[20] = -0.1542
   *   FACTOR = 0.9^(1/DECAY) - 1 = 0.9^-6.48508 - 1 ≈ 0.98036
   *   R(S,S) = (1 + 0.98036)^-0.1542 = 1.98036^-0.1542 ≈ 0.9
   */
  it('passes through 90% at one stability, for every stability', () => {
    for (const s of [0.5, 1, 2.3065, 10, 47, 365]) {
      expect(retrievability(s, s)).toBeCloseTo(NINETY, 10);
    }
  });

  it('is 1 the moment the card is answered', () => {
    expect(retrievability(5, 0)).toBe(1);
  });

  it('falls, and never rises, as the days pass', () => {
    let last = Infinity;
    for (const t of [0, 1, 2, 5, 10, 30, 100, 1000]) {
      const r = retrievability(10, t);
      expect(r).toBeLessThanOrEqual(last);
      last = r;
    }
    expect(last).toBeGreaterThan(0);
  });

  /*
   * The property that distinguishes FSRS's curve from SM-2's implicit one, and
   * the reason mature cards can be scheduled far out. An exponential would
   * have a card unseen for a year at essentially nought.
   */
  it('has a long tail rather than an exponential one', () => {
    expect(retrievability(10, 365)).toBeGreaterThan(0.3);
  });

  it('a stronger card is likelier to be recalled at the same age', () => {
    expect(retrievability(30, 10)).toBeGreaterThan(retrievability(3, 10));
  });
});

describe('the interval, which is the curve read backwards', () => {
  /*
   * At the target retention the interval *is* the stability — the two cancel,
   * because 0.9^(1/DECAY) - 1 is exactly FACTOR. Worth asserting because it is
   * the cheapest possible check that `intervalDays` inverts `retrievability`
   * rather than approximating it.
   */
  it('equals the stability when aiming at 90%', () => {
    for (const s of [2, 7, 23, 140]) {
      expect(intervalDays(s, NINETY)).toBe(Math.round(s));
    }
    expect(TARGET_RETENTION).toBe(NINETY);
  });

  it('and a card scheduled that far out is at the retention asked for', () => {
    for (const retention of [0.8, 0.9, 0.95]) {
      const s = 20;
      expect(retrievability(s, intervalDays(s, retention))).toBeCloseTo(retention, 1);
    }
  });

  it('asking for more retention brings the card back sooner', () => {
    expect(intervalDays(50, 0.95)).toBeLessThan(intervalDays(50, 0.9));
    expect(intervalDays(50, 0.9)).toBeLessThan(intervalDays(50, 0.8));
  });

  it('never schedules a card for the day it was answered', () => {
    expect(intervalDays(0.01)).toBe(1);
    expect(intervalDays(0)).toBe(1);
  });
});

describe('the first answer', () => {
  /*
   * Hand-computed from the weights, not copied from a run:
   *
   *   S0(g)  = W[g-1]
   *   D0(g)  = W[4] - e^(W[5]*(g-1)) + 1, clamped to [1,10]
   *   D0(3)  = 6.4133 - e^1.6668 + 1 = 6.4133 - 5.2953 + 1 ≈ 2.118
   *   D0(4)  = 6.4133 - e^2.5002 + 1 = 6.4133 - 12.185 + 1 ≈ -4.77 → 1
   */
  it('takes its stability straight from the weights', () => {
    expect(firstMemory(1).stability).toBeCloseTo(W[0], 10);
    expect(firstMemory(2).stability).toBeCloseTo(W[1], 10);
    expect(firstMemory(3).stability).toBeCloseTo(W[2], 10);
    expect(firstMemory(4).stability).toBeCloseTo(W[3], 10);
  });

  it('and a better first answer is a stronger card', () => {
    const s = ([1, 2, 3, 4] as Grade[]).map((g) => firstMemory(g).stability);
    expect(s).toEqual([...s].sort((a, b) => a - b));
  });

  it('starts a missed card difficult and an easy one at the floor', () => {
    expect(firstMemory(1).difficulty).toBeCloseTo(6.4133, 4);
    expect(firstMemory(3).difficulty).toBeCloseTo(2.118, 3);
    // Clamped: the unclamped value is about -4.8.
    expect(firstMemory(4).difficulty).toBe(1);
  });

  it('never leaves difficulty outside 1–10', () => {
    for (const g of [1, 2, 3, 4] as Grade[]) {
      expect(firstMemory(g).difficulty).toBeGreaterThanOrEqual(1);
      expect(firstMemory(g).difficulty).toBeLessThanOrEqual(10);
    }
  });
});

describe('what a review does to the memory', () => {
  const settled = { stability: 10, difficulty: 5 };

  it('a success lengthens the card and a lapse shortens it', () => {
    expect(nextMemory(settled, 3, 10).stability).toBeGreaterThan(settled.stability);
    expect(nextMemory(settled, 1, 10).stability).toBeLessThan(settled.stability);
  });

  /*
   * The guard in `forgetStability`, pointed at the fault it exists for: the
   * `(s+1)^W[13]` term grows with the old stability, so without the cap a
   * long-interval card that is finally missed can come out *stronger*.
   */
  it('and a lapse never leaves a card stronger, however long the interval was', () => {
    for (const s of [1, 10, 100, 1000, 10_000]) {
      const was = { stability: s, difficulty: 5 };
      expect(nextMemory(was, 1, s).stability).toBeLessThan(s);
    }
  });

  /*
   * Where the cap actually bites, which is not where you would guess.
   *
   * The first version of the test above swept stabilities from 1 to 10,000 and
   * passed with the cap deleted — at those sizes the modelled value is orders
   * of magnitude below the old stability and the `min` never chooses it. The
   * cap only matters for a *weak* card left a very long time and then missed:
   * at stability 0.3, unseen for 1,500 days, the model returns 0.313 against a
   * cap of 0.286. Uncapped that is a lapse leaving the card *stronger* than it
   * was, which is the whole reason the line exists.
   *
   * The band was measured rather than reasoned, and the first two attempts at
   * it were both wrong in instructive ways. A sweep from 1 to 10,000 — the
   * test above — passes with the cap deleted, because at those sizes the
   * modelled value is orders of magnitude below the old stability and `min`
   * never picks it. And the gap has to be about five thousand times the
   * stability, not one thousand: `forgetStability` reads the difficulty
   * *after* the lapse has hardened it, so the `d^-W[12]` term is smaller than
   * it looks from the starting difficulty.
   *
   * Below about 0.2 the 0.1 stability floor lands on the same number the cap
   * does and hides it; above about 0.4 the model falls under the old stability
   * by itself. Three values, and all three are inside a band a hundredth wide
   * at each end.
   */
  it('and especially not a weak card that went a long time unseen', () => {
    for (const s of [0.2, 0.3, 0.4]) {
      const was = { stability: s, difficulty: 1 };
      expect(nextMemory(was, 1, s * 5000).stability).toBeLessThan(s);
    }
  });

  it('a better grade buys more stability', () => {
    const gain = ([2, 3, 4] as Grade[]).map((g) => nextMemory(settled, g, 10).stability);
    expect(gain).toEqual([...gain].sort((a, b) => a - b));
  });

  /*
   * The spacing effect, and the one thing SM-2 structurally cannot express:
   * answering a card you were about to forget is worth more than answering one
   * you saw yesterday. It is the `exp((1-r) * W[10]) - 1` term.
   */
  it('a success is worth more the closer the card was to being forgotten', () => {
    const soon = nextMemory(settled, 3, 1).stability;
    const late = nextMemory(settled, 3, 40).stability;
    expect(late).toBeGreaterThan(soon);
  });

  it('and an easy card gains more than a hard one at the same age', () => {
    const easy = nextMemory({ stability: 10, difficulty: 1 }, 3, 10).stability;
    const hard = nextMemory({ stability: 10, difficulty: 9 }, 3, 10).stability;
    expect(easy).toBeGreaterThan(hard);
  });
});

describe('difficulty, and being able to come back from hard', () => {
  it('a miss makes a card harder and an easy answer makes it easier', () => {
    const was = { stability: 10, difficulty: 5 };
    expect(nextMemory(was, 1, 10).difficulty).toBeGreaterThan(5);
    expect(nextMemory(was, 4, 10).difficulty).toBeLessThan(5);
  });

  it('stays inside 1–10 whatever it is fed', () => {
    for (const d of [1, 5, 10]) {
      for (const g of [1, 2, 3, 4] as Grade[]) {
        const next = nextMemory({ stability: 10, difficulty: d }, g, 10).difficulty;
        expect(next).toBeGreaterThanOrEqual(1);
        expect(next).toBeLessThanOrEqual(10);
      }
    }
  });

  /*
   * The whole reason for the mean reversion. A card pinned at 10 that is then
   * answered correctly twenty times running has to become easy again — without
   * this a bad week marks a card for the rest of the term.
   */
  it('a card pinned at the hardest recovers when it starts going right', () => {
    let m = { stability: 10, difficulty: 10 };
    for (let i = 0; i < 20; i++) m = nextMemory(m, 4, 10);
    expect(m.difficulty).toBeLessThan(5);
  });

  /*
   * And the damping, from the other end: a lapse on an already-hard card moves
   * it less than a lapse on an easy one, so difficulty approaches 10 rather
   * than slamming into it.
   */
  it('and a lapse costs less the harder the card already was', () => {
    const fromEasy = nextMemory({ stability: 10, difficulty: 2 }, 1, 10).difficulty - 2;
    const fromHard = nextMemory({ stability: 10, difficulty: 9 }, 1, 10).difficulty - 9;
    expect(fromEasy).toBeGreaterThan(fromHard);
  });

  /*
   * The damping, pinned to a hand-computed value rather than to an ordering,
   * because the ordering above passes without it — the 1–10 clamp mimics
   * damping at the top of the range and hides its removal.
   *
   *   delta  = -W[6] * (1 - 3)            = 6.0388
   *   damped = 5 + 6.0388 * (10 - 5) / 9  = 8.3549
   *   mean   = W[7] * 1 + (1 - W[7]) * 8.3549 ≈ 8.347
   *
   * Undamped it would be 5 + 6.0388 = 11.04, clamped to 10, reverting to 9.99.
   */
  it('and moves a middling card by the damped amount, not the raw one', () => {
    expect(nextMemory({ stability: 10, difficulty: 5 }, 1, 10).difficulty).toBeCloseTo(8.347, 2);
  });
});

describe('the weights are the published set, and are read as one', () => {
  /*
   * The control. Every property above is relative and would hold against a
   * table of twenty-one zeroes, or nineteen, or a truncated paste. This is the
   * only assertion that would notice.
   */
  it('is twenty-one numbers, all finite', () => {
    expect(W).toHaveLength(21);
    for (const w of W) expect(Number.isFinite(w)).toBe(true);
  });

  it('and the curve constants are derived from the last of them', () => {
    expect(DECAY).toBe(-W[20]);
    expect(FACTOR).toBeCloseTo(0.98036, 4);
    // Derived, not typed: a FACTOR written by hand beside a refitted W[20] is
    // a curve where `stability` no longer means ninety percent.
    expect(0.9 ** (1 / DECAY) - 1).toBe(FACTOR);
  });
});
