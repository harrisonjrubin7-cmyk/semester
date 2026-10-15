/**
 * The parallel run, from raw outcomes to the days `rehearsal.ts` judges.
 *
 * `parallelRunStatus` decides whether a streak of days is clean and whether it
 * included the calendar events that matter, but takes each day already
 * summarised: how much was compared and how much differed without explanation.
 * Somebody has to do the comparing, and that is where a parallel run quietly
 * goes soft — a difference waved away in a spreadsheet, a tolerance widened
 * until the numbers agree. So this is the comparing, kept strict:
 *
 * - a difference is *explained* only by a recorded decision with a named
 *   approver and a reason that says something, not by silence;
 * - numbers are exact unless a tolerance is passed in, and the default is none:
 *   a cent is a cent;
 * - an unexplained difference defaults to critical, because the person
 *   looking at a day's summary should have to argue a difference *down*.
 *
 * And `earliestExit` answers the calendar question first: a registration
 * comparison needs a registration period. It says *no date* when the calendar
 * has none, rather than a date that quietly skips the event.
 */
import type { ParallelDay } from './rehearsal.ts';

export type Outcome = string | number | boolean | null;

export interface Observation {
  /** Which workflow this compares, e.g. `finance.billing`. */
  workflow: string;
  /** The calendar event this exercised, if any (`billing_run`, `grade_posting`). */
  event?: string;
  incumbent: Readonly<Record<string, Outcome>>;
  semester: Readonly<Record<string, Outcome>>;
}

/** A difference somebody decided is acceptable, with their name and reason. */
export interface Explained {
  workflow: string;
  field: string;
  reason: string;
  approvedBy: string;
}

export const isExplained = (x: Explained): boolean => x.approvedBy.trim() !== '' && x.reason.trim().length >= 20;

export interface CompareOptions {
  /** Numeric tolerance in the field's own unit. Zero unless the institution says otherwise. */
  tolerance?: number;
  /** Fields whose difference is critical. Absent means every field is, which is the conservative reading. */
  criticalFields?: ReadonlySet<string>;
}

export function compareDay(date: string, observations: readonly Observation[], explained: readonly Explained[], opts: CompareOptions = {}): ParallelDay {
  const tol = opts.tolerance ?? 0;
  let compared = 0;
  let unexplainedCritical = 0;
  let unexplainedHigh = 0;
  for (const o of observations) {
    for (const field of new Set([...Object.keys(o.incumbent), ...Object.keys(o.semester)])) {
      compared += 1;
      const a = o.incumbent[field];
      const b = o.semester[field];
      const equal = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= tol : a === b;
      if (equal) continue;
      if (explained.some((x) => x.workflow === o.workflow && x.field === field && isExplained(x))) continue;
      if (!opts.criticalFields || opts.criticalFields.has(field)) unexplainedCritical += 1;
      else unexplainedHigh += 1;
    }
  }
  return { date, events: [...new Set(observations.flatMap((o) => (o.event ? [o.event] : [])))], compared, unexplainedCritical, unexplainedHigh };
}

export interface ExitInput {
  /** The events the run must include (a workbook's `parallelEvents`). */
  events: readonly string[];
  /** First day of the streak, ISO date. */
  start: string;
  minDays: number;
  /** Event name to its scheduled dates, ISO. */
  calendar: Readonly<Record<string, readonly string[]>>;
}

export interface Exit {
  /** The soonest the streak can end; null when the calendar cannot support it. */
  date: string | null;
  blockers: string[];
}

const DAY = 86_400_000;

/**
 * The streak starts at `start`, runs `minDays`, and must contain the first
 * occurrence of every required event on or after `start`. So it ends no sooner
 * than the later of `minDays` and the last of those first occurrences.
 */
export function earliestExit(input: ExitInput): Exit {
  const start = Date.parse(input.start);
  const blockers: string[] = [];
  let latest = start + (input.minDays - 1) * DAY;
  for (const e of input.events) {
    const next = (input.calendar[e] ?? []).map((d) => Date.parse(d)).filter((t) => t >= start).sort((a, b) => a - b)[0];
    if (next === undefined) blockers.push(`the calendar has no ${e} on or after ${input.start}`);
    else latest = Math.max(latest, next);
  }
  return { date: blockers.length ? null : new Date(latest).toISOString().slice(0, 10), blockers };
}
