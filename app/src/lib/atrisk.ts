/**
 * Which of today's classes you cannot afford to miss.
 *
 * The app already knows this the moment you open the attendance screen. What
 * it did not do was say it *before* the class, which is the only time the fact
 * can change anything. Afterwards it is arithmetic explaining a penalty you
 * have already taken.
 *
 * ## It computes nothing about absences
 *
 * Every number here comes out of `lib/attend.ts` — `tally` for what has been
 * marked, `budget` for what is left and what it costs. This file only decides
 * *which* meetings are worth a warning and turns them into the shape the
 * reminder rules take. There is one implementation of the absence maths and it
 * is not this one.
 *
 * ## Silent by construction
 *
 * A course with no attendance policy can never produce a row, because
 * `hasPolicy` gates it. Neither can a course with absences to spare. Most
 * students, most weeks, get nothing from this at all — which is the point. A
 * warning that arrives every week is a warning nobody reads by October.
 */

import { budget, hasPolicy, readPolicy, tally, type Attended, type AttendPolicy } from './attend';
import type { AtRisk } from './notify';
import type { Block, CourseId } from './types';

/**
 * How few absences must be left before a class is worth warning about.
 *
 * One. Two left is a normal term and a reminder about it is noise; one left
 * means the next absence is the one that costs marks, and zero means it
 * already is.
 */
export const WARN_AT = 1;

/** "13:15" from minutes past midnight, in the app's own clock style. */
export function clockOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')}`;
}

/**
 * Today's meetings in a course whose allowance is nearly or already gone.
 *
 * `blocks` is the day's rail as `railFor` returns it. Only real class meetings
 * count: an optional block is office hours, and a cancelled one is not held,
 * so neither can cost an absence.
 */
export function atRiskToday(
  blocks: Block[],
  log: Attended[],
  policies: Record<string, unknown>,
  code: (id: CourseId) => string,
): AtRisk[] {
  const out: AtRisk[] = [];
  const seen = new Set<CourseId>();

  for (const b of blocks) {
    if (!b.c || b.optional || b.canceled) continue;
    // One row per course per day. Two meetings of the same class on one day is
    // rare and two identical warnings about it is worse than one.
    if (seen.has(b.c)) continue;

    const policy: AttendPolicy = readPolicy(policies[b.c]);
    if (!hasPolicy(policy)) continue;

    const left = budget(policy, tally(log, b.c));
    if (left.left > WARN_AT) continue;

    seen.add(b.c);
    out.push({
      code: code(b.c),
      at: b.at,
      clock: clockOf(b.at),
      left: left.left,
      costs: policy.penaltyPer,
    });
  }

  return out.sort((a, b) => a.at - b.at);
}
