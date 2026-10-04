import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLLBACK_TRIGGERS, parallelRunStatus, rehearsalReadiness, rollbackDecision, rollbackMode,
} from './rehearsal.ts';
import type { ParallelDay, Rehearsal } from './rehearsal.ts';

const NOW = '2026-10-20T00:00:00.000Z';
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}T06:00:00.000Z`;
const reh = (n: number, over: Partial<Rehearsal> = {}): Rehearsal => ({
  id: `r${n}`, scale: 'full', gatePassed: true, rollbackExercised: false, durationMinutes: 200, finishedAt: day(n), ...over,
});
const WINDOW = { windowMinutes: 360 };

describe('rehearsal readiness', () => {
  it('needs two full-scale passes in a row, one that exercised rollback, inside the window', () => {
    expect(rehearsalReadiness([reh(10, { rollbackExercised: true }), reh(14)], WINDOW, NOW)).toEqual({ ready: true, problems: [] });
  });

  it('is not ready on one rehearsal, or on a sample', () => {
    expect(rehearsalReadiness([reh(14)], WINDOW, NOW).problems).toEqual(['too_few_rehearsals']);
    expect(rehearsalReadiness([reh(10, { rollbackExercised: true }), reh(14, { scale: 'sample' })], WINDOW, NOW).problems).toContain('not_full_scale');
  });

  it('is not ready if the latest run failed, even after an earlier pass', () => {
    const p = rehearsalReadiness([reh(10, { rollbackExercised: true }), reh(12), reh(14, { gatePassed: false })], WINDOW, NOW).problems;
    expect(p).toContain('not_consecutive_pass');
  });

  it('is not ready until rollback was performed, not just described', () => {
    expect(rehearsalReadiness([reh(10), reh(14)], WINDOW, NOW).problems).toEqual(['rollback_never_exercised']);
  });

  it('is not ready if the slowest recent run uses more than the share of the window', () => {
    expect(rehearsalReadiness([reh(10, { rollbackExercised: true }), reh(14, { durationMinutes: 300 })], WINDOW, NOW).problems).toEqual(['too_slow_for_window']);
    expect(rehearsalReadiness([reh(10, { rollbackExercised: true }), reh(14, { durationMinutes: 300 })], { ...WINDOW, maxWindowShare: 0.9 }, NOW).ready).toBe(true);
  });

  it('goes stale: a rehearsal of last month\'s data is practice for a different event', () => {
    expect(rehearsalReadiness([reh(1, { rollbackExercised: true }), reh(2)], WINDOW, NOW).problems).toEqual(['too_old']);
  });
});

describe('rollback', () => {
  it('is full until Semester accepts a write, then depends on a verified replay', () => {
    expect(rollbackMode({ semesterWritesAccepted: false, reverseReplayVerified: false })).toBe('full');
    expect(rollbackMode({ semesterWritesAccepted: true, reverseReplayVerified: true })).toBe('with_replay');
    expect(rollbackMode({ semesterWritesAccepted: true, reverseReplayVerified: false })).toBe('roll_forward_only');
  });

  const ok = { open_critical_exceptions: 0, permission_widened: 0, ledger_variance_minor_units: 0, login_failure_rate: 0.001, enrollment_mismatch_rate: 0 };

  it('continues while every trigger is observed and inside its limit', () => {
    expect(rollbackDecision(DEFAULT_ROLLBACK_TRIGGERS, ok, { semesterWritesAccepted: false, reverseReplayVerified: false })).toEqual({ action: 'continue' });
  });

  it('rolls back when a trigger breaches before the point of no return, and forward after it', () => {
    const bad = { ...ok, permission_widened: 1 };
    expect(rollbackDecision(DEFAULT_ROLLBACK_TRIGGERS, bad, { semesterWritesAccepted: false, reverseReplayVerified: false })).toEqual({ action: 'rollback', breached: ['permission_widened'], mode: 'full' });
    expect(rollbackDecision(DEFAULT_ROLLBACK_TRIGGERS, bad, { semesterWritesAccepted: true, reverseReplayVerified: true }).action).toBe('rollback');
    expect(rollbackDecision(DEFAULT_ROLLBACK_TRIGGERS, bad, { semesterWritesAccepted: true, reverseReplayVerified: false })).toMatchObject({ action: 'roll_forward', mode: 'roll_forward_only' });
  });

  it('does not read silence as health', () => {
    const { ledger_variance_minor_units: _drop, ...partial } = ok;
    expect(rollbackDecision(DEFAULT_ROLLBACK_TRIGGERS, partial, { semesterWritesAccepted: false, reverseReplayVerified: false })).toEqual({ action: 'investigate', missing: ['ledger_variance_minor_units'] });
  });
});

describe('parallel run', () => {
  const d = (n: number, over: Partial<ParallelDay> = {}): ParallelDay => ({ date: `2026-09-${String(n).padStart(2, '0')}`, events: [], compared: 1000, unexplainedCritical: 0, unexplainedHigh: 0, ...over });
  const opts = { minDays: 5, requiredEvents: ['grade_posting', 'billing_run'] };

  it('needs enough clean days AND the named events inside the streak', () => {
    const days = [d(1), d(2, { events: ['grade_posting'] }), d(3), d(4, { events: ['billing_run'] }), d(5)];
    expect(parallelRunStatus(days, opts)).toEqual({ ready: true, streak: 5, missingEvents: [] });
  });

  it('is not ready on quiet days alone', () => {
    const days = [1, 2, 3, 4, 5, 6].map((n) => d(n));
    expect(parallelRunStatus(days, opts)).toEqual({ ready: false, streak: 6, missingEvents: ['grade_posting', 'billing_run'] });
  });

  it('resets the streak on an unexplained critical difference, and an event before it no longer counts', () => {
    const days = [d(1, { events: ['grade_posting', 'billing_run'] }), d(2), d(3, { unexplainedCritical: 1 }), d(4), d(5), d(6), d(7), d(8)];
    const s = parallelRunStatus(days, opts);
    expect(s.streak).toBe(5);
    expect(s.ready).toBe(false);
    expect(s.missingEvents).toEqual(['grade_posting', 'billing_run']);
  });

  it('does not count a day that compared nothing, or whose unexplained-high rate is over the line', () => {
    expect(parallelRunStatus([d(1), d(2, { compared: 0 })], { ...opts, minDays: 1, requiredEvents: [] }).streak).toBe(0);
    expect(parallelRunStatus([d(1, { unexplainedHigh: 2 })], { ...opts, minDays: 1, requiredEvents: [] }).streak).toBe(0);
    expect(parallelRunStatus([d(1, { unexplainedHigh: 1 })], { ...opts, minDays: 1, requiredEvents: [] }).streak).toBe(1);
  });
});
