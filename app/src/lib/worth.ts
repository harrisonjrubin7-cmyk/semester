/**
 * Two questions the app already had the numbers for and never answered.
 *
 * *Where will this land?* — `lib/grades.ts` says what you have banked and what
 * you would need for a target. It has never said where the term is heading if
 * nothing changes, which is the question somebody actually has in week seven.
 *
 * *Where should tonight go?* — the app knows each item's weight, your standing
 * in that course, and how long that kind of work takes you. At eleven at night
 * it showed a list and left the arithmetic to the person least able to do it.
 *
 * ## A range, because a point estimate here is a lie
 *
 * Four quizzes out of eight at 84% does not mean 84%. It means the remaining
 * four are unknown, and how unknown depends on how much they are worth and how
 * steady you have been. So the projection is a band: the middle assumes you
 * carry on as you have, and the edges come from how much your own scores have
 * actually varied. Two pieces of evidence produce a wide band and the sentence
 * says so, rather than producing a narrow one that would be believed.
 *
 * The band is never presented as a probability. There is no "78% chance of an
 * A". That number would need a model of you, of the course and of the marking,
 * and the app has none of the three.
 *
 * ## Marginal points, which is uncomfortable and true
 *
 * An hour on a course you have 94 in and an hour on one you have 78 in are not
 * worth the same. Saying so is the honest content of "what should I do
 * tonight", and refusing to say it does not make it less true — it just leaves
 * the student to work it out at the worst possible hour. What the app will not
 * do is tell anybody to abandon anything: every item keeps its place in the
 * list, the ordering is by points an hour, and the reason is shown so it can be
 * disagreed with.
 */

import type { Standing } from './grades';
import { estimate, showSpan, type Spent } from './pace';

/** How much a run of scores has actually varied, in percentage points. */
export function spread(scores: number[]): number | null {
  if (scores.length < 2) return null;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) * (s - mean), 0) / (scores.length - 1);
  return Math.sqrt(variance);
}

/**
 * The widest a band goes when there is almost nothing to go on.
 *
 * One graded piece has no spread at all, and a band of zero would be the most
 * confident thing on the screen resting on the least. Fifteen points is wide
 * enough to be visibly useless, which is the correct impression.
 */
export const UNSURE = 15;

/** Narrower than this and the band is pretending to a precision it lacks. */
export const FLOOR = 2;

export interface Projection {
  /** Where the term lands if the rest goes like the graded part. */
  middle: number;
  /** The band, low and high, in final-grade percentage points. */
  low: number;
  high: number;
  /** How many scores the band rests on. */
  from: number;
  /** Weight still to play for. A big number here is why the band is wide. */
  remaining: number;
  /** True when the app is extrapolating from very little. */
  thin: boolean;
}

/**
 * Where the term lands if the rest goes like the graded part.
 *
 * The middle is what you have banked plus the remaining weight at your current
 * average — the plainest possible assumption, and the one worth stating
 * because most people's mental version of it is wrong in one direction or the
 * other. The band applies your own variation to the remaining weight only:
 * what is graded is graded, and a band that moved it would be fiction.
 */
export function projectGrade(s: Standing, scores: number[]): Projection | null {
  if (s.current === null || s.counted <= 0) return null;

  const middleRaw = s.earned + (s.remaining * s.current) / 100 - s.pointsOff;
  const sd = spread(scores);
  const width = Math.max(FLOOR, sd ?? UNSURE);
  // The band is on what is left to play for. What is graded is graded.
  const swing = (s.remaining * width) / 100;

  const clamp = (n: number) => Math.max(0, Math.min(100 + s.extraCredit, Math.round(n * 10) / 10));
  return {
    middle: clamp(middleRaw),
    low: clamp(middleRaw - swing),
    high: clamp(middleRaw + swing),
    from: scores.length,
    remaining: Math.round(s.remaining),
    thin: scores.length < 3,
  };
}

/**
 * The projection in a sentence, with its own caveat attached.
 *
 * The caveat is part of the sentence rather than a footnote, because a number
 * and a warning in different places is a number.
 */
export function projectionLine(p: Projection | null): string {
  if (!p) return 'Nothing graded yet, so there is nothing to project from.';

  // Nothing left to play for is not a projection, it is a result. Saying
  // "somewhere around 79.2 — call it 79.2 to 79.2" while also calling the band
  // wide is the contradiction a browser drive caught: the band is zero because
  // the term is decided, and the caveat about thin evidence was still firing.
  if (p.remaining <= 0) {
    return `Everything is in. That finishes at ${p.middle}.`;
  }

  const band = `${p.low} to ${p.high}`;
  const head = `On what is graded so far, this lands somewhere around ${p.middle} — call it ${band}.`;
  if (p.thin) {
    return `${head} That rests on ${p.from} ${p.from === 1 ? 'score' : 'scores'}, which is very little, and the band is wide because of it.`;
  }
  if (p.remaining >= 50) {
    return `${head} ${p.remaining}% of the grade is still to play for, so it can move a long way.`;
  }
  return `${head} From ${p.from} scores, with ${p.remaining}% left.`;
}

/**
 * How wrong *your own* guesses have been.
 *
 * This started out comparing what work took against what `lib/pace.ts` would
 * have predicted, and the tests showed that measures almost nothing: the
 * prediction is the median of the very reports it is scored against, so on
 * steady data it converges on being right and the ratio sits at 1 no matter
 * how badly the student themselves estimates. A calibration figure that is
 * always 1 is worse than none, because somebody would read it as "I estimate
 * well".
 *
 * The bias worth knowing is between the student's *guess before starting* and
 * what it actually took — "I thought two hours, it was three and a half" —
 * and that needs a guess, which is a thing to be asked for rather than
 * derived. So a report can carry one, and only the reports that do count here.
 *
 * The median, not the mean: one all-nighter should not move it, the same
 * reason `lib/pace.ts` takes a median in the first place.
 */
export interface Calibration {
  /** Actual over guessed. Above 1 means things take longer than you think. */
  ratio: number;
  /** How many guesses it rests on. */
  from: number;
}

/** Fewer than this and there is no bias, only noise. */
export const ENOUGH_REPORTS = 5;

/**
 * How many reports back it looks.
 *
 * A term's worth would be a term's average, and the thing worth knowing is
 * whether *this month* is going the way you think. Somebody who started the
 * semester wildly optimistic and has since got the measure of it should not
 * still be told they are wildly optimistic.
 */
export const LAST_REPORTS = 10;

/** A report that carries the guess made before the work started. */
export interface Guessed {
  guess: number;
  minutes: number;
  /** When it was reported, so the window is the *recent* ten. Optional. */
  at?: number;
}

export function calibrate(reports: Guessed[]): Calibration | null {
  const ratios = [...reports]
    .filter((r) => r.guess > 0 && r.minutes > 0)
    // Newest first, then the most recent ten. Reports with no timestamp sort
    // last rather than being dropped: an older store had no `at` and its
    // reports are still evidence.
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, LAST_REPORTS)
    .map((r) => r.minutes / r.guess);
  if (ratios.length < ENOUGH_REPORTS) return null;
  const sorted = [...ratios].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const ratio = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { ratio: Math.round(ratio * 100) / 100, from: ratios.length };
}

/**
 * The bias in one course, or overall when no course is named.
 *
 * Per course because they are not the same animal — somebody can have the
 * measure of their problem sets and be consistently wrong about their essays,
 * and one number averaged across both hides exactly that. Falls to null on a
 * course with too little of its own, rather than borrowing the overall figure
 * and calling it that course's.
 */
export function calibrateFor<T extends Guessed>(
  reports: T[],
  courseOf: (r: T) => string,
  courseId?: string,
): Calibration | null {
  return calibrate(courseId ? reports.filter((r) => courseOf(r) === courseId) : reports);
}

/**
 * What the correction is, said where a corrected number is shown.
 *
 * Short, because it sits under a list rather than being the point of a screen.
 * The long version is `calibrationLine`, which belongs on the screen about how
 * the term went.
 */
export function adjustedLine(c: Calibration | null): string {
  if (!c) return '';
  const off = Math.round(Math.abs(c.ratio - 1) * 100);
  if (off < 15) return '';
  return `Adjusted for how long things actually take you — about ${off}% ${
    c.ratio > 1 ? 'longer' : 'less'
  } than you guess, across your last ${c.from}.`;
}

/**
 * The gap, in the plain form: what you say, what it takes, the ratio.
 *
 * `guessedHours` is the median of the guesses rather than of the work, so the
 * two halves of the sentence are about the same set of jobs.
 */
export function guessLine(reports: Guessed[], c: Calibration | null): string {
  if (!c) return '';
  const recent = [...reports]
    .filter((r) => r.guess > 0 && r.minutes > 0)
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
    .slice(0, LAST_REPORTS);
  if (recent.length === 0) return '';
  const mid = (ns: number[]) => {
    const sorted = [...ns].sort((a, b) => a - b);
    const i = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
  };
  const said = mid(recent.map((r) => r.guess)) / 60;
  const took = mid(recent.map((r) => r.minutes)) / 60;
  return `You estimate ${showSpan(said)}. You take about ${showSpan(took)}. A ratio of ${c.ratio}.`;
}

/** An estimate with the measured bias applied. */
export function corrected(minutes: number, c: Calibration | null): number {
  if (!c || minutes <= 0) return minutes;
  return Math.round(minutes * c.ratio);
}

/**
 * What the calibration says, or nothing.
 *
 * Says nothing at all when the bias is small — a five per cent error is not a
 * finding, and announcing it every week would train people to ignore the
 * sentence for the week it says forty.
 */
export function calibrationLine(c: Calibration | null): string {
  if (!c) return '';
  const off = Math.round(Math.abs(c.ratio - 1) * 100);
  if (off < 15) return '';
  return c.ratio > 1
    ? `Work has been taking about ${off}% longer than you guessed, across ${c.from} guesses. Estimates below have that added.`
    : `Work has been taking about ${off}% less time than you guessed, across ${c.from} guesses. Estimates below have that taken off.`;
}

/** One thing you could spend tonight on. */
export interface Buy {
  id: string;
  title: string;
  courseId: string;
  /** Percentage points of the final grade this is worth. */
  worth: number;
  /** Minutes it is likely to take, calibrated. Null when it has never been timed. */
  minutes: number | null;
  /** Points of final grade per hour. Null without an estimate. */
  perHour: number | null;
  daysAway: number;
  /** Said plainly, so the ordering can be disagreed with. */
  why: string;
}

export interface BuyInput {
  id: string;
  title: string;
  courseId: string;
  kind: string;
  /** The weight as the syllabus wrote it — "15%", "10 pts". */
  weight: string;
  daysAway: number;
}

function pointsOf(weight: string): number {
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(weight);
  return m ? Number(m[1]) : 0;
}

/**
 * Tonight's work, ordered by what an hour actually buys.
 *
 * Anything the app cannot weigh — no stated percentage, or a kind of work it
 * has never timed — keeps its place in the list at the bottom, marked as
 * unweighable. It is not dropped: a reading worth nothing towards the grade is
 * still the reading the seminar is about, and an app that silently hid it
 * would be making an academic judgement it has no standing to make.
 */
export function bestBuys(
  items: BuyInput[],
  spent: Spent[],
  c: Calibration | null,
): Buy[] {
  const out: Buy[] = items.map((i) => {
    const worth = pointsOf(i.weight);
    const e = estimate(spent, i.courseId, i.kind);
    const minutes = e.minutes > 0 ? corrected(e.minutes, c) : null;
    const perHour = worth > 0 && minutes ? Math.round(((worth / minutes) * 60) * 100) / 100 : null;
    return {
      id: i.id,
      title: i.title,
      courseId: i.courseId,
      worth,
      minutes,
      perHour,
      daysAway: i.daysAway,
      why:
        perHour !== null
          ? `${worth}% of the grade, about ${minutes} min`
          : worth > 0
            ? `${worth}% of the grade, never timed`
            : 'No stated weight',
    };
  });

  return out.sort((a, b) => {
    // Due today beats arithmetic. A thing due tonight is not a trade.
    const aToday = a.daysAway === 0;
    const bToday = b.daysAway === 0;
    if (aToday !== bToday) return aToday ? -1 : 1;
    if (a.perHour === null && b.perHour === null) return a.daysAway - b.daysAway;
    if (a.perHour === null) return 1;
    if (b.perHour === null) return -1;
    return b.perHour - a.perHour;
  });
}

/**
 * As much of that list as fits in the hours you actually have.
 *
 * Greedy, in priority order: each item is taken if it fits and set aside if it
 * does not, and the ones set aside keep their places at the top of `over`.
 *
 * The first version stopped dead at the first thing that did not fit, on the
 * reasoning that a plan reordering itself around what is convenient is not the
 * plan somebody asked for. Driving it showed that reasoning was wrong here: a
 * ten-hour case write-up sat second, and three half-hour pieces that would
 * comfortably have fitted an evening were listed under "not in 3 hours",
 * which was simply untrue. Skipping is honest as long as what was skipped is
 * shown, in order, and named — which it is.
 */
export function fits(list: Buy[], hours: number): { taken: Buy[]; over: Buy[] } {
  let left = hours * 60;
  const taken: Buy[] = [];
  const over: Buy[] = [];
  for (const b of list) {
    // Something never timed costs nothing it can be held to, so it is taken
    // rather than blocking on a number the app does not have.
    const cost = b.minutes ?? 0;
    if (taken.length > 0 && cost > left) {
      over.push(b);
      continue;
    }
    taken.push(b);
    left -= cost;
  }
  return { taken, over };
}

/** Hours of work that did not fit, for the sentence to name. */
export function overHours(over: Buy[]): number {
  const minutes = over.reduce((n, b) => n + (b.minutes ?? 0), 0);
  return Math.round((minutes / 60) * 10) / 10;
}

/** What the evening's list says at the top. */
export function eveningLine(list: Buy[], hours: number): string {
  if (list.length === 0) return 'Nothing outstanding to weigh up.';
  const weighed = list.filter((b) => b.perHour !== null).length;
  const head = `${hours} ${hours === 1 ? 'hour' : 'hours'}, ${list.length} ${list.length === 1 ? 'thing' : 'things'} outstanding.`;
  if (weighed === 0) {
    return `${head} None of it has been timed yet, so this is in deadline order rather than by what an hour buys.`;
  }
  if (weighed < list.length) {
    return `${head} ${list.length - weighed} could not be weighed and ${list.length - weighed === 1 ? 'sits' : 'sit'} at the bottom rather than being dropped.`;
  }
  return `${head} Ordered by what an hour is worth against the grade.`;
}
