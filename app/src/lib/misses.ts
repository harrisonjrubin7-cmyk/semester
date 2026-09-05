/**
 * What turning up — or not — is costing, on the screen for a bad week.
 *
 * Two screens each knew half of this. The attendance screen holds the policy
 * and the arithmetic: how many absences are allowed, how many are left, and
 * what the ones past the allowance have already taken off the final grade. The
 * "I'm behind" screen holds everything else that is going wrong and never
 * mentioned attendance at all — so somebody triaging a bad week could work
 * through every late deadline and still walk into the class that costs them
 * more than all of them together.
 *
 * ## Ranked by what it costs, not by when it happened
 *
 * A percentage already lost in one course outranks a busy Thursday, and it
 * outranks it even though the Thursday is sooner. So these carry the number of
 * grade points at stake and sort on it, which is the one comparison that makes
 * sense between "you have lost 3% of CORE 2500" and "you have four hours of
 * work due on Friday".
 *
 * ## Nothing is invented, so a course with no policy is silent
 *
 * `AttendPolicy` is zero in every field by default, and zero means the
 * syllabus did not say. A course that has never stated an attendance rule
 * produces no signal here — not a gentle one, not a general one. Inventing a
 * penalty would be inventing a grade.
 *
 * The arithmetic is `lib/attend.ts`'s, not a second copy of it.
 *
 * ## A note on where these are shown
 *
 * The plan that asked for this described them as joining the behind screen's
 * existing signal list — `exams` / `stacked` / `heavy` / `committed`. Those
 * live in `lib/clash.ts` and are properties of a *day*: each carries a date
 * and a distance in days, and the Behind screen does not render them at all.
 * These are properties of a *course* and of a standing condition, with no day
 * to attach them to; giving one a date so it could be sorted into a list of
 * days would be inventing the day. So they are their own group on that screen,
 * ranked among themselves and placed first, which is what "rank by grade
 * impact, not recency" asks for.
 */

import type { Attended, AttendPolicy } from './attend';
import { budget, hasPolicy, standing, tally } from './attend';

export type MissKind = 'attendance-over' | 'attendance-close' | 'attendance-slipping';

export interface Miss {
  kind: MissKind;
  courseId: string;
  /** One sentence naming the course and the specific cost. */
  says: string;
  /** Grade points at stake. The ranking key, and never a guess. */
  cost: number;
}

/** Two absences inside a fortnight in one course is a pattern worth naming. */
export const SLIPPING_DAYS = 14;
export const SLIPPING_ABSENCES = 2;

/** Whichever hurts most, and among equals whichever is already certain. */
const RANK: Record<MissKind, number> = {
  'attendance-over': 0,
  'attendance-close': 1,
  'attendance-slipping': 2,
};

function pct(n: number): string {
  return `${Math.round(n * 10) / 10}%`;
}

function absencesSince(log: Attended[], courseId: string, from: string): number {
  return log.filter((a) => a.courseId === courseId && a.mark === 'absent' && a.date >= from).length;
}

/** `YYYY-MM-DD`, this many days before a date. */
function daysBefore(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Every attendance signal worth raising, worst first.
 *
 * `code` turns a course id into what the student calls it, because "you have
 * one absence left" without naming the course is a sentence nobody can act on.
 */
export function misses(
  courseIds: string[],
  policies: Record<string, AttendPolicy | undefined>,
  log: Attended[],
  code: (id: string) => string,
  now = new Date(),
): Miss[] {
  const out: Miss[] = [];
  const since = daysBefore(now, SLIPPING_DAYS);

  for (const courseId of courseIds) {
    const p = policies[courseId];
    // No policy, no signal. Zero in every field means the syllabus was silent,
    // and a warning built on that would be a warning about nothing.
    if (!p || !hasPolicy(p)) continue;

    const t = tally(log, courseId);
    const b = budget(p, t);
    const where = standing(p, t);
    const name = code(courseId);

    if (where === 'over') {
      out.push({
        kind: 'attendance-over',
        courseId,
        cost: b.cost,
        says:
          b.cost > 0
            ? `${name}: ${b.over} ${b.over === 1 ? 'absence' : 'absences'} past what the syllabus allows, and ${pct(b.cost)} of the final grade already gone. Every further one costs ${pct(p.penaltyPer)}.`
            : `${name}: ${b.over} ${b.over === 1 ? 'absence' : 'absences'} past what the syllabus allows. It states no penalty per absence, so what happens next is the professor's call — which is worth asking about before it is decided for you.`,
      });
    } else if (where === 'close') {
      out.push({
        kind: 'attendance-close',
        courseId,
        cost: p.penaltyPer,
        says:
          b.left === 0
            ? `${name}: no absences left. The next one costs ${pct(p.penaltyPer)} of the final grade.`
            : `${name}: one absence left. The one after it costs ${pct(p.penaltyPer)} of the final grade.`,
      });
    }

    // A pattern, said as a pattern. Raised alongside the two above rather than
    // instead of them, because "you have missed two in a fortnight" and "you
    // have one left" are different facts and somebody may only have one.
    const lately = absencesSince(log, courseId, since);
    if (lately >= SLIPPING_ABSENCES) {
      out.push({
        kind: 'attendance-slipping',
        courseId,
        cost: 0,
        says: `${name}: ${lately} absences in the last ${SLIPPING_DAYS} days. That is a run rather than a bad morning, and it is worth knowing why before the allowance decides it.`,
      });
    }
  }

  return out.sort((a, b) => b.cost - a.cost || RANK[a.kind] - RANK[b.kind]);
}

/** The heading sentence, or empty when there is nothing to say. */
export function missesLine(all: Miss[]): string {
  if (all.length === 0) return '';
  const lost = all
    .filter((m) => m.kind === 'attendance-over')
    .reduce((n, m) => n + m.cost, 0);
  if (lost > 0) {
    return `${pct(lost)} of a final grade has already gone to absences. That outranks everything below it, because it is spent rather than at risk.`;
  }
  return 'Attendance is close to costing something in a course below. It is cheaper to fix than anything else on this screen.';
}
