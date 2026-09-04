/**
 * How sure you were, and whether you were right.
 *
 * The scheduler in `lib/review.ts` sees two things: correct and incorrect. To
 * it a lucky guess and a settled piece of knowledge are the same answer, and a
 * confident miss and a shrug are the same answer. They are not remotely the
 * same, and the difference is the most useful thing a study log can hold.
 *
 * ## The confident miss
 *
 * A wrong answer you were sure about is a *belief*, and you will carry it into
 * the room. It is the single highest-value row in the whole history and the
 * scheduler currently treats it exactly like a card you had never seen. These
 * come back soon and are surfaced by name.
 *
 * ## The lucky guess
 *
 * A right answer you were not sure about is not knowledge, and letting it
 * start a three-day interval is how a card disappears until the week of the
 * exam. It is scheduled as though it were closer to a miss, because it is.
 *
 * ## Calibration, which is one number and changes behaviour
 *
 * Students are systematically overconfident about anything they have reread,
 * and being shown the gap is what breaks the reread habit. The figure here is
 * not a grade and not a percentile: it is how often "sure" was actually right,
 * next to how often "not sure" was, which are two facts about the same person.
 *
 * There is no benchmark to compare against and no target. A calibration figure
 * with a target attached becomes a thing to optimise, and the way to optimise
 * it is to stop saying you are sure — which destroys the only signal it had.
 */

/** How sure, in the only three steps worth offering. */
export type Sure = 'guess' | 'think' | 'know';

export const SURES: { id: Sure; label: string; short: string }[] = [
  { id: 'guess', label: 'Guessed', short: 'Guess' },
  { id: 'think', label: 'Fairly sure', short: 'Fairly' },
  { id: 'know', label: 'Certain', short: 'Certain' },
];

/** One answer, with how sure it was. */
export interface Answer {
  /** The card, keyed the way `lib/review.ts` keys it. */
  key: string;
  courseId: string;
  got: boolean;
  sure: Sure;
  /** Epoch ms. */
  at: number;
}

/**
 * The four cases, named.
 *
 * `wrongSure` is the one worth building all of this for.
 */
export type Case = 'wrongSure' | 'wrongUnsure' | 'rightSure' | 'luckyGuess';

export function caseOf(a: { got: boolean; sure: Sure }): Case {
  if (!a.got) return a.sure === 'know' ? 'wrongSure' : 'wrongUnsure';
  return a.sure === 'guess' ? 'luckyGuess' : 'rightSure';
}

/**
 * How the scheduler should treat this answer.
 *
 * Returned as a plain instruction rather than applied here, so `lib/review.ts`
 * keeps its single job and this file keeps its own. `treatAs` is what to hand
 * `score()` as `got`; `soon` says the interval should be cut rather than grown.
 */
export interface Handling {
  treatAs: boolean;
  /** Cut the interval even though the answer was right. */
  soon: boolean;
  /** Why, in one clause, for a screen that wants to say. */
  because: string;
}

export function handle(a: { got: boolean; sure: Sure }): Handling {
  switch (caseOf(a)) {
    case 'wrongSure':
      return {
        treatAs: false,
        soon: true,
        because: 'Wrong and certain — that is a belief, not a gap. It comes back soon.',
      };
    case 'wrongUnsure':
      return { treatAs: false, soon: false, because: 'Wrong, and you knew it. Ordinary.' };
    case 'luckyGuess':
      return {
        treatAs: true,
        soon: true,
        // Letting a guess start a three-day interval is how a card disappears
        // until the week of the exam.
        because: 'Right, but a guess. Scheduled closer to a miss than to a win.',
      };
    case 'rightSure':
      return { treatAs: true, soon: false, because: '' };
  }
}

/** Fewer answers than this and a calibration figure is noise. */
export const ENOUGH = 12;

export interface Calibration {
  /** Times you said certain, and how many of those were right. */
  certain: { of: number; right: number };
  /** Times you guessed, and how many of those were right. */
  guessed: { of: number; right: number };
  /** Confident misses, which is the number that matters. */
  wrongSure: number;
  /** Whether there is enough to say anything at all. */
  enough: boolean;
}

export function calibration(answers: Answer[]): Calibration {
  const certainAll = answers.filter((a) => a.sure === 'know');
  const guessedAll = answers.filter((a) => a.sure === 'guess');
  return {
    certain: { of: certainAll.length, right: certainAll.filter((a) => a.got).length },
    guessed: { of: guessedAll.length, right: guessedAll.filter((a) => a.got).length },
    wrongSure: answers.filter((a) => caseOf(a) === 'wrongSure').length,
    enough: answers.length >= ENOUGH,
  };
}

function pct(right: number, of: number): number {
  return of === 0 ? 0 : Math.round((right / of) * 100);
}

/**
 * The calibration in a sentence.
 *
 * Two facts about the same person, side by side, and no verdict. The
 * temptation is a grade — "your calibration is 72%" — and a graded calibration
 * becomes a thing to optimise, which is done by never saying you are sure,
 * which destroys the only signal it had.
 */
export function calibrationLine(c: Calibration): string {
  if (!c.enough) {
    const seen = c.certain.of + c.guessed.of;
    return `Not enough answered yet to say anything about how well you know what you know. ${seen} of ${ENOUGH} so far.`;
  }
  if (c.certain.of === 0) {
    return 'You have not said you were certain about anything yet, so there is nothing to compare.';
  }
  const sure = pct(c.certain.right, c.certain.of);
  const guessed = pct(c.guessed.right, c.guessed.of);
  const head = `When you said you were certain you were right ${sure}% of the time`;
  const tail =
    c.guessed.of === 0
      ? '.'
      : `, and when you guessed, ${guessed}%.`;
  if (c.wrongSure === 0) return `${head}${tail}`;
  return `${head}${tail} ${c.wrongSure} ${c.wrongSure === 1 ? 'answer was' : 'answers were'} wrong *and* certain — those are the ones to look at.`;
}

/**
 * The cards you were wrong and certain about, most recent first.
 *
 * The whole point of the exercise. One card can be here more than once in the
 * raw log; this collapses to the card and keeps how many times.
 */
export function beliefs(answers: Answer[]): { key: string; courseId: string; times: number; at: number }[] {
  const byKey = new Map<string, { key: string; courseId: string; times: number; at: number }>();
  for (const a of answers) {
    if (caseOf(a) !== 'wrongSure') continue;
    const had = byKey.get(a.key);
    if (had) {
      had.times += 1;
      had.at = Math.max(had.at, a.at);
    } else {
      byKey.set(a.key, { key: a.key, courseId: a.courseId, times: 1, at: a.at });
    }
  }
  return [...byKey.values()].sort((a, b) => b.times - a.times || b.at - a.at);
}

/**
 * How many answers to keep.
 *
 * A cap, because this is a per-answer log rather than a per-card one and it
 * syncs. Six hundred is several terms of drilling and the oldest is the least
 * informative — calibration is a thing about how you are now.
 */
export const KEEP = 600;

export function remember(answers: Answer[], next: Answer): Answer[] {
  const out = [...answers, next];
  return out.length > KEEP ? out.slice(out.length - KEEP) : out;
}

/** A stored log made safe. */
export function readAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw)) return [];
  const sures = new Set<Sure>(['guess', 'think', 'know']);
  return raw
    .filter(
      (a): a is Answer =>
        Boolean(a) && typeof a === 'object' && typeof a.key === 'string' && sures.has(a.sure),
    )
    .map((a) => ({
      key: a.key,
      courseId: typeof a.courseId === 'string' ? a.courseId : '',
      got: a.got === true,
      sure: a.sure,
      at: typeof a.at === 'number' ? a.at : 0,
    }))
    .slice(-KEEP);
}
