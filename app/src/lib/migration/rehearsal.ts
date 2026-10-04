/**
 * Rehearsal readiness, cutover, rollback, and the parallel run.
 *
 * Three questions, kept apart because they fail differently:
 *
 * - *Can we do it in the window?* (`rehearsalReadiness`) A rehearsal that ran
 *   on a tenth of the data, or that nobody timed against the real window, or
 *   that never exercised rollback, is practice for a different event.
 * - *Can we undo it, and until when?* (`rollbackMode`, `rollbackDecision`) The
 *   honest answer changes at a point of no return: once students have written
 *   data into Semester that cannot be replayed into the legacy system,
 *   "rollback" means losing it, so the plan is to roll forward.
 * - *Does it behave like the old system, on the days that matter?*
 *   (`parallelRunStatus`) Weeks of quiet days prove less than one grade
 *   posting or one billing run, so the exit asks for named calendar events.
 */

export interface Rehearsal {
  id: string;
  /** `full` = production-scale volume and production-shaped data, not a sample. */
  scale: 'sample' | 'full';
  gatePassed: boolean;
  /** Was a rollback actually performed and verified, not only described? */
  rollbackExercised: boolean;
  durationMinutes: number;
  finishedAt: string;
}

export interface ReadinessOptions {
  /** The window the institution has agreed to be unavailable. */
  windowMinutes: number;
  /** Rehearsals in a row that must pass. */
  consecutive?: number;
  /** The slowest rehearsal may use at most this share of the window. */
  maxWindowShare?: number;
  /** Rehearsals older than this are practice for a different data set. */
  maxAgeDays?: number;
}

export type ReadinessProblem =
  | 'too_few_rehearsals'
  | 'not_consecutive_pass'
  | 'not_full_scale'
  | 'rollback_never_exercised'
  | 'too_slow_for_window'
  | 'too_old';

export function rehearsalReadiness(rehearsals: readonly Rehearsal[], opts: ReadinessOptions, now: string): { ready: boolean; problems: ReadinessProblem[] } {
  const n = opts.consecutive ?? 2;
  const share = opts.maxWindowShare ?? 0.7;
  const maxAge = opts.maxAgeDays ?? 14;
  const ordered = [...rehearsals].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  const problems: ReadinessProblem[] = [];
  if (ordered.length < n) return { ready: false, problems: ['too_few_rehearsals'] };

  const last = ordered.slice(-n);
  if (!last.every((r) => r.gatePassed)) problems.push('not_consecutive_pass');
  if (!last.every((r) => r.scale === 'full')) problems.push('not_full_scale');
  if (!ordered.some((r) => r.scale === 'full' && r.rollbackExercised)) problems.push('rollback_never_exercised');
  if (Math.max(...last.map((r) => r.durationMinutes)) > opts.windowMinutes * share) problems.push('too_slow_for_window');
  if (new Date(now).getTime() - new Date(last[0].finishedAt).getTime() > maxAge * 86_400_000) problems.push('too_old');
  return { ready: problems.length === 0, problems };
}

export interface CutoverState {
  /** Semester has accepted a write the legacy system does not have. */
  semesterWritesAccepted: boolean;
  /** Replaying Semester's writes back into the legacy system was built and exercised in a rehearsal. */
  reverseReplayVerified: boolean;
}

/**
 * - `full` — nothing new exists only in Semester; repoint and reopen the legacy system.
 * - `with_replay` — new data exists only in Semester, and a verified replay carries it back.
 * - `roll_forward_only` — rollback would lose students' new data; fix forward.
 */
export type RollbackMode = 'full' | 'with_replay' | 'roll_forward_only';

export function rollbackMode(s: CutoverState): RollbackMode {
  if (!s.semesterWritesAccepted) return 'full';
  return s.reverseReplayVerified ? 'with_replay' : 'roll_forward_only';
}

export interface Trigger {
  metric: string;
  /** Breached when the observation is greater than this. */
  max: number;
}

/** Defaults that the institution can tighten in its plan and not loosen below. */
export const DEFAULT_ROLLBACK_TRIGGERS: readonly Trigger[] = [
  { metric: 'open_critical_exceptions', max: 0 },
  { metric: 'permission_widened', max: 0 },
  { metric: 'ledger_variance_minor_units', max: 0 },
  { metric: 'login_failure_rate', max: 0.02 },
  { metric: 'enrollment_mismatch_rate', max: 0.001 },
];

export type RollbackDecision =
  | { action: 'continue' }
  | { action: 'rollback' | 'roll_forward'; breached: string[]; mode: RollbackMode }
  | { action: 'investigate'; missing: string[] };

/**
 * A trigger with no observation is not a pass: the dashboard being down at
 * hour two is exactly when the decision is least safe to make from silence.
 */
export function rollbackDecision(triggers: readonly Trigger[], observed: Readonly<Record<string, number>>, state: CutoverState): RollbackDecision {
  const missing = triggers.filter((t) => observed[t.metric] === undefined).map((t) => t.metric);
  const breached = triggers.filter((t) => observed[t.metric] !== undefined && observed[t.metric] > t.max).map((t) => t.metric);
  if (breached.length > 0) {
    const mode = rollbackMode(state);
    return { action: mode === 'roll_forward_only' ? 'roll_forward' : 'rollback', breached, mode };
  }
  if (missing.length > 0) return { action: 'investigate', missing };
  return { action: 'continue' };
}

export interface ParallelDay {
  date: string;
  /** Business events that occurred on this day, e.g. `grade_posting`, `billing_run`. */
  events: readonly string[];
  compared: number;
  /** Differences nobody has explained. */
  unexplainedCritical: number;
  unexplainedHigh: number;
}

export interface ParallelOptions {
  minDays: number;
  /** Events that must each have occurred on a passing day inside the streak. */
  requiredEvents: readonly string[];
  /** Highest unexplained-high share of compared, per day. */
  maxHighRate?: number;
}

export function parallelRunStatus(days: readonly ParallelDay[], opts: ParallelOptions): { ready: boolean; streak: number; missingEvents: string[] } {
  const maxHigh = opts.maxHighRate ?? 0.001;
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  // The streak is the trailing run of days that compared something and found nothing unexplained that matters.
  const clean = (d: ParallelDay) => d.compared > 0 && d.unexplainedCritical === 0 && d.unexplainedHigh / d.compared <= maxHigh;
  const streakDays: ParallelDay[] = [];
  for (let i = ordered.length - 1; i >= 0 && clean(ordered[i]); i--) streakDays.unshift(ordered[i]);
  const seen = new Set(streakDays.flatMap((d) => d.events));
  const missingEvents = opts.requiredEvents.filter((e) => !seen.has(e));
  return { ready: streakDays.length >= opts.minDays && missingEvents.length === 0, streak: streakDays.length, missingEvents };
}
