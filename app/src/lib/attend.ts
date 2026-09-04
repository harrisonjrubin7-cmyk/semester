/**
 * Turning up, and what it costs not to.
 *
 * The word "absence" appeared in exactly one place in this app: an email
 * template for explaining one. Nothing logged attendance, nothing knew a
 * course's policy, and the Grades screen therefore computed a projection that
 * could not see the single harshest rule in the term.
 *
 * That rule is real and it is specific. A course that docks ten points of the
 * final grade per class after two unexcused absences can take a student from an
 * A to a C without a single mark changing on a single piece of work. No
 * assignment on any of these syllabi is worth what the third absence costs, and
 * until now the app would have shown that student an A right up to the day
 * grades were posted.
 *
 * ## Two shapes, because syllabi have two
 *
 * A policy is either a **penalty** — n free absences, then so many points off
 * per class — or a **category**, where attendance is a weighted line in the
 * grade scored by how often you turned up. Some courses have both. Neither is
 * derivable from the other, and a model reading a syllabus finds them worded
 * a dozen ways, so both are stored as numbers a student can check and correct.
 *
 * ## Excused is not a third kind of absent
 *
 * It is not absent at all. Every policy here counts unexcused absences only,
 * because that is what every syllabus that has one says. Recording "excused"
 * is therefore not bookkeeping — it is the difference between a budget with
 * one left in it and a budget already spent.
 *
 * ## The app never decides you were absent
 *
 * There is no inference from a phone that did not move, no default after the
 * class ends, nothing filled in on your behalf. An unmarked class is unmarked,
 * and the counts say how many are. A number that quietly assumed the worst
 * would be wrong on exactly the days somebody most needs it to be right.
 */

import type { CourseId } from './types';

export type Mark = 'present' | 'absent' | 'excused';

/** One class meeting, as the student recorded it. */
export interface Attended {
  /**
   * `courseId:date`. One class meeting, one record.
   *
   * Derived rather than random, because that is what makes the sync merge
   * correct without a special case: two devices marking the same class
   * produce the same id, `union` keeps the newer `at`, and a duplicate can
   * never become a second absence.
   */
  id: string;
  courseId: CourseId;
  /** The day, as `YYYY-MM-DD`, so one meeting has one record. */
  date: string;
  mark: Mark;
  /** Epoch ms it was recorded, for the merge to pick the newer of two. */
  at: number;
}

/**
 * What a syllabus says about turning up.
 *
 * Every field is zero by default, which means "nothing stated" — and nothing
 * stated is the honest reading of a syllabus that does not mention it. The
 * screens stay silent rather than inventing a policy.
 */
export interface AttendPolicy {
  /** Unexcused absences allowed before anything happens. */
  allowed: number;
  /** Points of the final grade lost per unexcused absence past the allowance. */
  penaltyPer: number;
  /** Or: attendance is a graded category worth this much of the final grade. */
  worth: number;
  /** The rule in the syllabus's own words, so it can be checked later. */
  note: string;
}

export const NO_POLICY: AttendPolicy = { allowed: 0, penaltyPer: 0, worth: 0, note: '' };

/** Whether a course has said anything about attendance at all. */
export function hasPolicy(p: AttendPolicy | undefined): boolean {
  return Boolean(p && (p.allowed > 0 || p.penaltyPer > 0 || p.worth > 0 || p.note.trim()));
}

/** A stored policy, made safe. Nonsense becomes "nothing stated", not a guess. */
export function readPolicy(raw: unknown): AttendPolicy {
  const p = raw as Partial<AttendPolicy> | undefined;
  const num = (v: unknown, cap: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(n, cap) : 0;
  };
  return {
    allowed: Math.round(num(p?.allowed, 60)),
    penaltyPer: num(p?.penaltyPer, 100),
    worth: num(p?.worth, 100),
    note: typeof p?.note === 'string' ? p.note.slice(0, 400) : '',
  };
}

export interface Tally {
  present: number;
  absent: number;
  excused: number;
  /** Meetings with a mark against them. Not the number of meetings held. */
  marked: number;
}

export function tally(log: Attended[], courseId: CourseId): Tally {
  const mine = log.filter((a) => a.courseId === courseId);
  const count = (m: Mark) => mine.filter((a) => a.mark === m).length;
  const t = { present: count('present'), absent: count('absent'), excused: count('excused') };
  return { ...t, marked: t.present + t.absent + t.excused };
}

export interface Budget {
  /** Unexcused absences used. */
  spent: number;
  /** How many are left before the penalty starts. Never negative. */
  left: number;
  /** How many have gone past the allowance. */
  over: number;
  /** Points of the final grade already lost to them. */
  cost: number;
}

export function budget(p: AttendPolicy, t: Tally): Budget {
  const spent = t.absent;
  const over = Math.max(0, spent - p.allowed);
  return {
    spent,
    left: Math.max(0, p.allowed - spent),
    over,
    cost: over * p.penaltyPer,
  };
}

/**
 * The share of marked meetings attended, 0 to 100, or null.
 *
 * Excused meetings are left out of both halves rather than counted as
 * attended: a course that excuses an absence is not saying you were there, and
 * scoring it as attendance would inflate the figure the graded category is
 * computed from.
 *
 * Null until something is marked. A rate of 0% and a rate not yet known look
 * identical as a number and are opposite as facts.
 */
export function rate(t: Tally): number | null {
  const counted = t.present + t.absent;
  return counted === 0 ? null : (t.present / counted) * 100;
}

/**
 * How close this is to costing something.
 *
 * `clear` while there is room, `close` on the last one, `over` once the
 * penalty has started. The last one matters most: an app that says "1 absence
 * left" in the same voice as "3 left" is not warning anybody.
 */
export type Standing = 'none' | 'clear' | 'close' | 'over';

export function standing(p: AttendPolicy, t: Tally): Standing {
  if (!hasPolicy(p)) return 'none';
  const b = budget(p, t);
  if (b.over > 0) return 'over';
  return b.left <= 1 ? 'close' : 'clear';
}

/** What the course screen says about it. Empty when nothing is stated. */
export function attendLine(p: AttendPolicy, t: Tally): string {
  if (!hasPolicy(p)) return '';
  const b = budget(p, t);
  const bits: string[] = [];

  if (p.allowed > 0 || p.penaltyPer > 0) {
    if (b.over > 0) {
      bits.push(
        p.penaltyPer > 0
          ? `${b.over} ${b.over === 1 ? 'absence' : 'absences'} past the allowance, costing ${round(b.cost)}% of the final grade.`
          : `${b.over} ${b.over === 1 ? 'absence' : 'absences'} past the allowance.`,
      );
    } else if (b.left === 0) {
      bits.push('No absences left before the penalty starts.');
    } else {
      bits.push(`${b.left} ${b.left === 1 ? 'absence' : 'absences'} left before the penalty starts.`);
    }
  }

  if (p.worth > 0) {
    const r = rate(t);
    bits.push(
      r === null
        ? `Attendance is worth ${round(p.worth)}% of the grade; nothing is marked yet.`
        : `${Math.round(r)}% attendance, on a category worth ${round(p.worth)}%.`,
    );
  }

  if (t.excused > 0) {
    bits.push(`${t.excused} excused, which ${t.excused === 1 ? 'does' : 'do'} not count against you.`);
  }

  return bits.join(' ');
}

function round(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/**
 * The penalty as a grade row, for the projection to include.
 *
 * Returned as points off rather than folded into a weight, because that is
 * what the syllabus says: the penalty is subtracted from the final grade, not
 * averaged into it. `worth` is separate and *is* a weighted category.
 */
export function pointsOff(p: AttendPolicy, t: Tally): number {
  return hasPolicy(p) ? budget(p, t).cost : 0;
}

/** One mark, recorded. Replaces any earlier mark for the same day. */
export function mark(
  log: Attended[],
  courseId: CourseId,
  date: string,
  next: Mark | null,
  at = Date.now(),
): Attended[] {
  const without = log.filter((a) => !(a.courseId === courseId && a.date === date));
  // A null clears it. Tapping the mark a class already has is how somebody
  // undoes a mis-tap, and leaving no way back would make the log a place
  // mistakes accumulate.
  return next === null ? without : [...without, { id: `${courseId}:${date}`, courseId, date, mark: next, at }];
}

export function markOn(log: Attended[], courseId: CourseId, date: string): Mark | null {
  return log.find((a) => a.courseId === courseId && a.date === date)?.mark ?? null;
}

/** A stored log, made safe. */
export function readLog(saved: unknown): Attended[] {
  if (!Array.isArray(saved)) return [];
  const out: Attended[] = [];
  const seen = new Set<string>();
  for (const value of saved) {
    const a = value as Partial<Attended> | null;
    if (!a || typeof a.courseId !== 'string' || !a.courseId) continue;
    if (typeof a.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.date)) continue;
    if (a.mark !== 'present' && a.mark !== 'absent' && a.mark !== 'excused') continue;
    // One record per course per day. Two devices marking the same class is a
    // real collision and the second copy is not a second absence.
    const id = `${a.courseId}:${a.date}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      courseId: a.courseId,
      date: a.date,
      mark: a.mark,
      at: typeof a.at === 'number' && Number.isFinite(a.at) ? a.at : 0,
    });
  }
  return out;
}
