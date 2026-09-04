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
  /** True when the weights do not add to 100 and the numbers are indicative. */
  incomplete: boolean;
}

/**
 * Read a weight out of a syllabus's own wording.
 *
 * Real tables say "20%", "25–30%", "+3% EC", "10 pts". A range is taken at its
 * midpoint and a "+" row is extra credit rather than part of the hundred. What
 * cannot be read comes back null and is shown as unweighted rather than
 * guessed at — a made-up weight would put a made-up grade on the screen.
 */
export function readWeight(pct: string): { weight: number | null; extra: boolean } {
  const extra = /\+|\bEC\b|extra credit/i.test(pct);

  // A range first, and only when the two numbers are joined by a dash: real
  // tables write "25–30%" with a single per-cent sign at the end. Matching
  // every number instead would read "best 2 of 3 exams, 60%" as a range from
  // two to three.
  const range = pct.match(/(\d+(?:\.\d+)?)\s*[–—-]\s*(\d+(?:\.\d+)?)\s*%/);
  if (range) return { weight: (Number(range[1]) + Number(range[2])) / 2, extra };

  const single = pct.match(/(\d+(?:\.\d+)?)\s*%/);
  return { weight: single ? Number(single[1]) : null, extra };
}

/** A score as a person types it: "88", "88%", "17/20", "0.88". */
export function readScore(text: string): number | null {
  const s = text.trim();
  if (!s) return null;

  const fraction = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
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

export function standing(course: Course, scores: Record<string, string>): Standing {
  const rows: Weighted[] = course.grading.map((g, i) => {
    const { weight, extra } = readWeight(g.pct);
    return { ...g, weight, extra, score: readScore(scores[key(course.id, i)] ?? '') };
  });

  const graded = rows.filter((r) => !r.extra && r.weight !== null);
  const total = graded.reduce((n, r) => n + (r.weight ?? 0), 0);

  const entered = graded.filter((r) => r.score !== null);
  const counted = entered.reduce((n, r) => n + (r.weight ?? 0), 0);
  const earned = entered.reduce((n, r) => n + ((r.weight ?? 0) * (r.score ?? 0)) / 100, 0);

  const extraCredit = rows
    .filter((r) => r.extra && r.weight !== null && r.score !== null)
    .reduce((n, r) => n + ((r.weight ?? 0) * (r.score ?? 0)) / 100, 0);

  return {
    rows,
    earned,
    counted,
    remaining: Math.max(0, total - counted),
    current: counted > 0 ? (earned / counted) * 100 : null,
    extraCredit,
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
  return ((target - s.earned - s.extraCredit) / s.remaining) * 100;
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

/** Every band, with its verdict. Highest first, as the letters read. */
export function reaches(s: Standing): Need[] {
  return TARGETS.map((t) => reachFor(s, t.at, t.label));
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

/** The usual American letter bands, for the "what do I need" table. */
export const TARGETS = [
  { label: 'A', at: 93 },
  { label: 'A−', at: 90 },
  { label: 'B+', at: 87 },
  { label: 'B', at: 83 },
  { label: 'B−', at: 80 },
];
