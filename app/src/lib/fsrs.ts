/**
 * How long until you would have forgotten it, rather than how many times you
 * have got it right.
 *
 * `lib/review.ts` schedules every card by a plain SM-2 variant: a streak, an
 * ease factor, and an interval that is the last interval times the ease. It is
 * the algorithm Anki shipped with in 1987 and it has one structural problem —
 * **it has no model of forgetting.** The interval grows because the last one
 * did, not because anything is known about when this card decays. Two cards
 * with identical streaks are treated identically even when one is a date and
 * the other is a definition you have missed four times.
 *
 * FSRS replaces the streak with three quantities that mean something:
 *
 *   **Stability** — how many days until recall of this card falls to 90%.
 *   **Difficulty** — 1 to 10, how much work each success buys on this card.
 *   **Retrievability** — the probability you would recall it *right now*,
 *   which falls along a power curve as time passes.
 *
 * Scheduling then stops being "multiply by the ease" and becomes a question
 * with an answer: given this card's stability, how many days until
 * retrievability reaches the retention I am aiming for? That is what
 * `intervalDays` computes, and it is why a well-known card can go out forty
 * days while a shaky one comes back tomorrow, without anybody tuning a
 * multiplier.
 *
 * ## Where the numbers come from, and what that does and does not buy
 *
 * The weights below are the published FSRS-6 defaults, read from
 * `open-spaced-repetition/fsrs4anki`'s scheduler rather than remembered. They
 * are priors fitted against a very large corpus of real Anki reviews, which
 * makes them a far better starting point than anything this repository could
 * invent — and they are **not** fitted to *these* students, because there is
 * no review log here to fit them to yet.
 *
 * That is worth stating plainly rather than implying a precision this does not
 * have. What FSRS buys immediately is the *shape*: a forgetting curve, a
 * difficulty that responds to lapses, and an interval derived from a retention
 * target instead of a multiplication. What it does not buy until somebody has
 * months of answers is parameters tuned to this population. `optimise` is the
 * word for that job and it is not in this file; when it arrives it replaces
 * `W` and nothing else.
 *
 * ## What is deliberately left out
 *
 * **Fuzz.** The reference scheduler jitters each interval by a few percent so
 * that a deck reviewed in one sitting does not come back in one sitting. It is
 * a real problem and this is the wrong place to solve it: a scheduler that
 * returns a different answer for the same input cannot be tested against hand
 * arithmetic, and `lib/revise.ts` already spreads a night's work across
 * courses by a rule a student can read. If clumping shows up in the pilot, it
 * gets solved there, visibly.
 *
 * **The four-button grade.** FSRS wants Again/Hard/Good/Easy. This app never
 * asks that question — it asks whether you got it right and how sure you were,
 * which `lib/sure.ts` already records. `review.ts` maps the pair onto a grade;
 * this file only takes the grade.
 */

/** Again, Hard, Good, Easy — the four grades FSRS is defined over. */
export type Grade = 1 | 2 | 3 | 4;

/** What FSRS remembers about a card between reviews. */
export interface Memory {
  /** Days until recall of this card falls to 90%. */
  stability: number;
  /** 1–10. How little each success buys. */
  difficulty: number;
}

/**
 * The published FSRS-6 defaults, in index order, exactly as the reference
 * scheduler carries them.
 *
 * Twenty-one numbers with no names is not a thing to copy by hand and hope, so
 * `fsrs.test.ts` holds the length and the three that the formulas below read
 * directly enough to be checked by eye. Changing one of these is changing the
 * algorithm and should be a commit that says which and why.
 */
export const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666,
  0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658,
  0.1542,
] as const;

/**
 * The exponent of the forgetting curve, and the constant that makes it pass
 * through 90% at one stability.
 *
 * Both are derived from `W[20]` rather than written down, which is the whole
 * reason the curve stays consistent if the weights are ever refitted: a
 * `DECAY` typed in by hand beside a refitted `W[20]` is a curve that no longer
 * means what `stability` says it means.
 */
export const DECAY = -W[20];
export const FACTOR = 0.9 ** (1 / DECAY) - 1;

/** The retention this app aims for when it picks an interval. */
export const TARGET_RETENTION = 0.9;

const clampDifficulty = (d: number): number => Math.min(10, Math.max(1, d));

/**
 * The chance you would recall this card now, 0–1.
 *
 * A power curve, not an exponential. The difference is not academic: an
 * exponential says a card you last saw a year ago is gone, and the data says
 * people retain far more of it than that. The long tail is most of why FSRS
 * schedules mature cards further out than SM-2 dares to.
 */
export function retrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return (1 + (FACTOR * Math.max(0, elapsedDays)) / stability) ** DECAY;
}

/**
 * How many days until retrievability falls to `retention`.
 *
 * The inverse of the curve above, which is the whole scheduling decision in
 * one line. Never less than a day: a card answered today and scheduled for
 * today is a card in a loop.
 */
export function intervalDays(stability: number, retention = TARGET_RETENTION): number {
  const days = (stability / FACTOR) * (retention ** (1 / DECAY) - 1);
  return Math.max(1, Math.round(days));
}

/** The memory a card has after its very first answer. */
export function firstMemory(grade: Grade): Memory {
  return {
    stability: Math.max(W[grade - 1], 0.1),
    difficulty: clampDifficulty(W[4] - Math.exp(W[5] * (grade - 1)) + 1),
  };
}

/**
 * Difficulty after a review.
 *
 * Two corrections stacked, and they do different jobs. The **linear damping**
 * makes a lapse cost less when the card is already hard — without it a card
 * that has been missed twice races to 10 and stays there, and a card pinned at
 * 10 can never recover. The **mean reversion** toward an easy card's starting
 * difficulty is what lets it recover: a string of successes pulls it back
 * rather than merely holding it still.
 */
function nextDifficulty(difficulty: number, grade: Grade): number {
  const delta = -W[6] * (grade - 3);
  const damped = difficulty + (delta * (10 - difficulty)) / 9;
  return clampDifficulty(W[7] * firstMemory(4).difficulty + (1 - W[7]) * damped);
}

/**
 * Stability after a successful review.
 *
 * The term worth reading is `exp((1 - r) * W[10]) - 1`: the *less* likely you
 * were to recall it, the more a success is worth. Answering a card you were
 * about to forget teaches you far more than answering one you saw yesterday,
 * and this is the only line in either algorithm that knows that. SM-2 gives
 * the same ease bump either way, which is why cramming inflates it.
 */
function recallStability(memory: Memory, grade: Grade, r: number): number {
  const hardPenalty = grade === 2 ? W[15] : 1;
  const easyBonus = grade === 4 ? W[16] : 1;
  return (
    memory.stability *
    (1 +
      Math.exp(W[8]) *
        (11 - memory.difficulty) *
        memory.stability ** -W[9] *
        (Math.exp((1 - r) * W[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

/**
 * Stability after a lapse.
 *
 * Capped at `s / exp(W[17] * W[18])`, which is the line that stops a lapse
 * *raising* stability. Without it a card with a long interval that is finally
 * missed can come out of the formula stronger than it went in, because the
 * `(s+1)^W[13]` term grows with the old stability. It is a guard rather than a
 * model, and the reference scheduler carries it for the same reason.
 */
function forgetStability(memory: Memory, r: number): number {
  const modelled =
    W[11] *
    memory.difficulty ** -W[12] *
    ((memory.stability + 1) ** W[13] - 1) *
    Math.exp((1 - r) * W[14]);
  return Math.min(modelled, memory.stability / Math.exp(W[17] * W[18]));
}

/**
 * The memory a card has after being answered again.
 *
 * `elapsedDays` is how long it actually sat, not how long it was scheduled
 * for. That distinction is the point: a card reviewed three weeks late that
 * you still got right is far stronger evidence than the same card reviewed on
 * time, and the retrievability term above converts the delay into exactly
 * that.
 */
export function nextMemory(prev: Memory, grade: Grade, elapsedDays: number): Memory {
  const r = retrievability(prev.stability, elapsedDays);
  const difficulty = nextDifficulty(prev.difficulty, grade);
  const stability =
    grade === 1
      ? forgetStability({ ...prev, difficulty }, r)
      : recallStability({ ...prev, difficulty }, grade, r);
  return { stability: Math.max(0.1, stability), difficulty };
}
