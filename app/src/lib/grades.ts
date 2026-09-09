/**
 * Where you actually stand, and what the rest has to be.
 *
 * The app already holds every course's grading table, straight from the
 * syllabus. It was shown as a read-only list, which answers "how is this
 * marked" and not the question a student asks in week ten: *what do I need on
 * the final?* That one requires arithmetic nobody wants to do at midnight with
 * a syllabus PDF open in another tab.
 *
 * Deliberately category-level rather than per-assignment. A syllabus weights
 * categories ("Problem sets 20%"), not individual items, and guessing which of
 * eleven problem sets belongs to which category — from free text like
 * "25–30%" on the item — would produce confident wrong numbers. You know your
 * quiz average; the app knows the weights; that is enough.
 */

import type { Course, GradeRow } from './types';
import { afterDrops, readScores } from './drop';
import { NO_POLICY, pointsOff, rate, tally, type AttendPolicy, type Attended } from './attend';

export interface Weighted extends GradeRow {
  /** The weight as a number, or null when it could not be read. */
  weight: number | null;
  /** True for a row worth extra credit rather than part of the 100%. */
  extra: boolean;
  /** Your score in this category, 0–100, or null if not entered. */
  score: number | null;
}

export interface Standing {
  rows: Weighted[];
  /** Percentage points already banked, out of 100. */
  earned: number;
  /** Weight of the categories you have entered a score for. */
  counted: number;
  /** Weight still to play for. */
  remaining: number;
  /** Your average across what has been graded so far, or null. */
  current: number | null;
  /** Extra-credit points available on top. */
  extraCredit: number;
  /**
   * Points already lost to absences, subtracted from the finished grade.
   *
   * Separate from the weighting on purpose: a syllabus that docks 10% of the
   * final grade per class is subtracting, not adding a category, and folding
   * it into the weights would produce a different number.
   */
  pointsOff: number;
  /** True when the weights do not add to 100 and the numbers are indicative. */
  incomplete: boolean;
}

/**
 * The plain percentage in a piece of syllabus wording, or 0.
 *
 * The simplest of the three readings of a weight in this file, and the one
 * three other files had each written out for themselves: `behind.ts` and
 * `worth.ts` under the name `pointsOf`, and `edit.ts` inline inside
 * `weightTotal`. The same regular expression in four places, one of which
 * would eventually be corrected without the others.
 *
 * Zero rather than null for the unreadable case, because every caller sorts
 * or sums with it and a null in an arithmetic is a `NaN` somebody has to
 * defend against. Where the difference between "nought per cent" and "no
 * percentage stated" matters, `readWeight` above is the one to ask.
 */
export function percentOf(weight: string): number {
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(weight);
  return m ? Number(m[1]) : 0;
}

/**
 * Read a weight out of a syllabus's own wording.
 *
 * Real tables say "20%", "25–30%", "+3% EC", "10 pts". A range is taken at its
 * midpoint and a "+" row is extra credit rather than part of the hundred. What
 * cannot be read comes back null and is shown as unweighted rather than
 * guessed at — a made-up weight would put a made-up grade on the screen.
 */
export function readWeight(pct: string): {
  weight: number | null;
  extra: boolean;
  /** The figure when the syllabus stated points rather than a percentage. */
  points: number | null;
} {
  /*
   * A plus counts as a bonus only where it is attached to the figure.
   *
   * This tested for a bare `+` anywhere in the string. Right for "+3% EC" and
   * wrong for the ordinary way a syllabus joins two things — "Exams 1 + 2,
   * 40%", "Midterm + final, 45%". That column carries prose (this same
   * function reads a weight out of "Best 2 of 3 exams, 60%"), so those are
   * inputs to expect rather than malformed ones.
   *
   * Reading one as a bonus takes its weight out of the denominator, because
   * `standing` counts only the rows that are not extra. A course marked out
   * of 100 silently becomes a course marked out of 60, the "your weights add
   * to 60%" caveat fires, and every band on the Grades screen is a confident
   * wrong number — the worst shape a bug can take, since nothing looks broken.
   *
   * `(^|[^\d])\+\d` is the whole distinction: a plus stuck to its number,
   * and not one already sitting after a number. "+3%" is a bonus; "1 + 2" and
   * "1+2" are two things added together. Written without a lookbehind so it
   * runs on every phone this ships to.
   *
   * The words a syllabus uses when it means a bonus are read too, since those
   * say it outright and never need the punctuation.
   */
  const extra = /(^|[^\d])\+\d|\bEC\b|extra credit|\bbonus\b/i.test(pct);

  // A range first, and only when the two numbers are joined by a dash: real
  // tables write "25–30%" with a single per-cent sign at the end. Matching
  // every number instead would read "best 2 of 3 exams, 60%" as a range from
  // two to three.
  const range = pct.match(/(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*%/);
  if (range) return { weight: (Number(range[1]) + Number(range[2])) / 2, extra, points: null };

  const single = pct.match(/(\d+(?:\.\d+)?)\s*%/);
  if (single) return { weight: Number(single[1]), extra, points: null };

  // A syllabus that states points rather than percentages — "80 pts", "130
  // pts" — has been unreadable to this until now: every weight came back null
  // and the whole screen said "nothing graded yet" for a course whose grading
  // was fully specified. Points are a weighting; they are just expressed
  // against a total the row does not carry, so they are read here and
  // converted once `standing` knows the total. See `asWeights`.
  const points = pct.match(/(\d+(?:\.\d+)?)\s*(?:pts?|points?)\b/i);
  return { weight: null, extra, points: points ? Number(points[1]) : null };
}

/**
 * Points turned into percentages, when that is what the syllabus used.
 *
 * Only when *no* row states a percentage. A syllabus mixing "40%" and "20 pts"
 * is stating two different things about two different denominators, and
 * guessing at how they relate would produce a confident wrong number — so a
 * mixed one keeps the percentages and leaves the points rows unweighted,
 * which the screen already marks and explains.
 */
export function asWeights(
  read: { weight: number | null; extra: boolean; points: number | null }[],
): (number | null)[] {
  const anyPercent = read.some((r) => r.weight !== null);
  if (anyPercent) return read.map((r) => r.weight);

  const total = read.filter((r) => !r.extra).reduce((n, r) => n + (r.points ?? 0), 0);
  if (total <= 0) return read.map(() => null);
  return read.map((r) => (r.points === null ? null : (r.points / total) * 100));
}

/**
 * A score as a person types it: "88", "88%", "17/20", "17 out of 20", "0.88".
 *
 * Not letters. Those need to know the course's cutoffs, which this does not
 * have and should not — see `lib/score.ts`, which knows both.
 */
export function readScore(text: string): number | null {
  const s = text.trim();
  if (!s) return null;

  // "17 out of 20" and "17 of 20" are how people say a fraction out loud, and
  // how a rubric in a PDF writes one. Same meaning as the slash.
  const fraction = s.match(/^(\d+(?:\.\d+)?)\s*(?:\/|\s+out\s+of\s+|\s+of\s+)\s*(\d+(?:\.\d+)?)$/i);
  if (fraction) {
    const bottom = Number(fraction[2]);
    if (bottom === 0) return null;
    return clamp((Number(fraction[1]) / bottom) * 100);
  }

  const n = Number(s.replace(/%/g, ''));
  if (!Number.isFinite(n)) return null;
  // "0.88" is a proportion; "88" is a percentage. Only a bare value below 1
  // is read the first way, so a genuine 0.5% does need writing as "0.5%".
  return clamp(n > 0 && n <= 1 && !s.includes('%') ? n * 100 : n);
}

const clamp = (n: number) => Math.max(0, Math.min(1000, n));

/**
 * Everything the projection needs beyond the syllabus and a score per row.
 *
 * Optional throughout: a course with none of it behaves exactly as it did
 * before any of this existed, which is most courses.
 */
export interface Extras {
  /** Individual pieces per category, as typed. See `lib/drop.ts`. */
  pieces?: Record<string, string>;
  /** How many lowest pieces the syllabus strikes out, per category. */
  drops?: Record<string, number>;
  /** Points off the final grade for absences. See `lib/attend.ts`. */
  pointsOff?: number;
  /** Attendance as a graded category: its weight and your rate. */
  attendance?: { worth: number; rate: number | null };
}

/**
 * The extras one course's grade is worked out from, assembled once.
 *
 * Four places asked `standing` about the same course and three different
 * questions. `screens/Grades.tsx` and `ai/providers/core.ts` passed all four
 * extras; `screens/Courses.tsx` and `lib/context.ts` passed pieces and drops
 * and left attendance out. On a syllabus that makes attendance a graded
 * category — which BUS 1600 and PSCI 1104 both do, at 10% and 5% — that is
 * not a rounding difference:
 *
 *     Grades tab   current 74.0%  weights 100  incomplete false
 *     Courses tile current 76.7%  weights  90  incomplete true
 *
 * Two running grades for one course, on two screens one tap apart, and the
 * tile is the one a student sees first.
 *
 * `lib/context.ts` already names the same problem in a comment and works
 * around it — "the provider calls `standing` with the attendance extras the
 * Grades screen passes; this file calls it without them … and then the model
 * has two different running grades for one course and no way to choose". The
 * workaround is to let the screen win where it has spoken, which leaves the
 * case where it has not.
 *
 * So the assembly is one function and the disagreement has nowhere left to
 * live. Structurally typed rather than taking a `State`, so this file keeps
 * knowing nothing about the store.
 */
export function extrasFor(
  courseId: string,
  from: {
    pieces: Record<string, string>;
    drops: Record<string, number>;
    attendance: Attended[];
    attendPolicy: Record<string, AttendPolicy>;
  },
): Extras {
  const policy = from.attendPolicy[courseId] ?? NO_POLICY;
  const t = tally(from.attendance, courseId);
  return {
    pieces: from.pieces,
    drops: from.drops,
    pointsOff: pointsOff(policy, t),
    attendance: { worth: policy.worth, rate: rate(t) },
  };
}

export function standing(
  course: Course,
  scores: Record<string, string>,
  extras: Extras = {},
): Standing {
  // Read every row first, so points can be weighed against their own total.
  const read = course.grading.map((g) => readWeight(g.pct));
  const weights = asWeights(read);

  const rows: Weighted[] = course.grading.map((g, i) => {
    const { extra } = read[i];
    const weight = weights[i];
    const k = key(course.id, i);
    // A category with pieces entered is scored from them, after the syllabus's
    // drop rule — which is the number the course actually uses. The single box
    // is the fallback, and stays the whole story for most rows.
    const listed = readScores(extras.pieces?.[k] ?? '');
    const fromPieces = listed.length > 0 ? afterDrops(listed, extras.drops?.[k] ?? 0).mean : null;
    return {
      ...g,
      weight,
      extra,
      score: fromPieces ?? readScore(scores[k] ?? ''),
    };
  });

  // Attendance as a weighted category, when the syllabus makes it one. Added
  // as a row rather than adjusted afterwards, so it is counted, weighted and
  // shown exactly like every other line of the grade.
  if (extras.attendance && extras.attendance.worth > 0) {
    rows.push({
      what: 'Attendance',
      pct: `${extras.attendance.worth}%`,
      weight: extras.attendance.worth,
      extra: false,
      score: extras.attendance.rate,
    });
  }

  const graded = rows.filter((r) => !r.extra && r.weight !== null);
  const total = graded.reduce((n, r) => n + (r.weight ?? 0), 0);

  const entered = graded.filter((r) => r.score !== null);
  const counted = entered.reduce((n, r) => n + (r.weight ?? 0), 0);
  const earned = entered.reduce((n, r) => n + ((r.weight ?? 0) * (r.score ?? 0)) / 100, 0);

  const extraCredit = rows
    .filter((r) => r.extra && r.weight !== null && r.score !== null)
    .reduce((n, r) => n + ((r.weight ?? 0) * (r.score ?? 0)) / 100, 0);

  // Absence penalties come off the finished grade rather than into the
  // weighting, because that is what the syllabus does with them: "10% of the
  // final grade per class" is a subtraction, not a category.
  const off = Math.max(0, extras.pointsOff ?? 0);

  return {
    rows,
    earned,
    counted,
    remaining: Math.max(0, total - counted),
    current: counted > 0 ? Math.max(0, (earned / counted) * 100 - off) : null,
    extraCredit,
    pointsOff: off,
    incomplete: Math.abs(total - 100) > 0.5,
  };
}

/**
 * What everything left has to average for a given final grade.
 *
 * Returns null when nothing is left to play for, and can return a number above
 * 100 — which is the honest answer, and the one worth knowing early.
 */
export function needFor(s: Standing, target: number): number | null {
  if (s.remaining <= 0) return null;
  // The penalty is already lost, so the target has to be reached on top of it.
  // Leaving it out here would tell somebody three absences over the allowance
  // that they need 78% when they need 108%.
  return ((target + s.pointsOff - s.earned - s.extraCredit) / s.remaining) * 100;
}

/**
 * What a target grade would take, said in a sentence.
 *
 * `needFor` gives a number and the number alone is not the answer. 104% is
 * arithmetically correct and means "not happening"; -12% is correct and means
 * "already yours"; and both are meaningless if the syllabus weights the
 * student entered do not add up to a whole course. Each of those is a
 * different thing to do about the same figure, so each gets its own verdict.
 */
export type Reach = 'settled' | 'secured' | 'ordinary' | 'hard' | 'unreachable' | 'unknown';

export interface Need {
  target: number;
  label: string;
  /** What everything left has to average. Null when nothing is left. */
  need: number | null;
  reach: Reach;
  /** One line, in the second person. */
  says: string;
}

/**
 * Above this, a required average is not a plan.
 *
 * 97 rather than 100: needing to average 98 across every remaining piece of
 * work is technically possible and is not a thing to build a term around, and
 * an app that says "you need 98%" as though it were advice is not being
 * straight with anybody.
 */
const HARD = 90;
const OUT_OF_REACH = 97;

export function reachFor(s: Standing, target: number, label = ''): Need {
  const base: Omit<Need, 'reach' | 'says'> = { target, label, need: needFor(s, target) };

  if (s.counted === 0 && s.remaining > 0) {
    return {
      ...base,
      reach: 'unknown',
      says: `Nothing is graded yet, so the honest answer is ${target}% on everything.`,
    };
  }

  if (base.need === null) {
    return {
      ...base,
      reach: 'settled',
      says: 'Everything is graded — there is nothing left to change it.',
    };
  }

  const need = base.need;
  const rounded = Math.round(need * 10) / 10;

  if (need <= 0) {
    return {
      ...base,
      reach: 'secured',
      says: `Already yours, whatever happens to the remaining ${Math.round(s.remaining)}%.`,
    };
  }
  if (need > OUT_OF_REACH) {
    return {
      ...base,
      reach: 'unreachable',
      says: `Would need ${rounded}% on everything left, which is not a plan.`,
    };
  }
  return {
    ...base,
    reach: need >= HARD ? 'hard' : 'ordinary',
    says: `${rounded}% on everything left.`,
  };
}

/**
 * Every band, with its verdict. Highest first, as the letters read.
 *
 * The bands are passed in rather than owned here. What earns an A is a fact
 * about a course and a university, not about arithmetic — see `lib/cutoffs.ts`
 * for where a scale comes from and why the fallback is stated as a guess on
 * the screen rather than shown as a fact.
 */
export function reaches(s: Standing, targets: { label: string; at: number }[] = TARGETS): Need[] {
  return targets.map((t) => reachFor(s, t.at, t.label));
}

/**
 * The caveat that has to travel with all of it, or empty.
 *
 * The weights come off a syllabus a model read, and a syllabus that lists
 * eight categories adding to 95 is common. Every figure above is then a ratio
 * of the wrong denominator — still useful for comparing bands against each
 * other, and not a number to tell anybody.
 */
export function needCaveat(s: Standing): string {
  if (!s.incomplete) return '';
  const total = Math.round(s.counted + s.remaining);
  return `These assume the weights add to 100%, and yours add to ${total}%. Fix the weights above and every figure here becomes real.`;
}

/** The storage key for one course's category. */
export function key(courseId: string, index: number): string {
  return `${courseId}:${index}`;
}

/**
 * The usual American letter bands.
 *
 * Kept as the default argument to `reaches` so a caller that has no school
 * profile to hand still gets a table. Every screen reads them through
 * `lib/cutoffs.ts` instead, which knows whether they are the school's numbers
 * or an assumption and says so.
 */
export const TARGETS = [
  { label: 'A', at: 93 },
  { label: 'A−', at: 90 },
  { label: 'B+', at: 87 },
  { label: 'B', at: 83 },
  { label: 'B−', at: 80 },
];
