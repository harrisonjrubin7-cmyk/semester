import { describe, expect, it } from 'vitest';
import { compareDay, earliestExit, isExplained, type Explained, type Observation } from './observations';
import { parallelRunStatus } from './rehearsal';

const obs = (workflow: string, a: Record<string, number | string | boolean | null>, b = a, event?: string): Observation => ({ workflow, event, incumbent: a, semester: b });

describe('comparing a day of the parallel run', () => {
  it('counts what was compared and finds nothing when the outcomes agree', () => {
    const day = compareDay('2026-12-01', [obs('finance.billing', { total_cents: 1000, due: '2027-01-15' }, undefined, 'billing_run')], []);
    expect(day).toEqual({ date: '2026-12-01', events: ['billing_run'], compared: 2, unexplainedCritical: 0, unexplainedHigh: 0 });
  });

  it('treats a single cent as a difference: no tolerance unless one is given', () => {
    const o = [obs('finance.billing', { total_cents: 1000 }, { total_cents: 1001 })];
    expect(compareDay('d', o, []).unexplainedCritical).toBe(1);
    expect(compareDay('d', o, [], { tolerance: 1 }).unexplainedCritical).toBe(0);
  });

  it('makes an unexplained difference critical unless the field is declared less so', () => {
    const o = [obs('courses.schedule', { capacity: 30 }, { capacity: 31 })];
    expect(compareDay('d', o, []).unexplainedCritical).toBe(1);
    expect(compareDay('d', o, [], { criticalFields: new Set(['room']) })).toMatchObject({ unexplainedCritical: 0, unexplainedHigh: 1 });
  });

  it('lets a recorded explanation stand, and refuses one with no name or no real reason', () => {
    const o = [obs('finance.billing', { late_fee_cents: 500 }, { late_fee_cents: 0 })];
    const ok: Explained = { workflow: 'finance.billing', field: 'late_fee_cents', approvedBy: 'bursar', reason: 'Late fees were waived for the migration term.' };
    expect(compareDay('d', o, [ok]).unexplainedCritical).toBe(0);
    expect(compareDay('d', o, [{ ...ok, reason: 'fine' }]).unexplainedCritical).toBe(1);
    expect(compareDay('d', o, [{ ...ok, approvedBy: ' ' }]).unexplainedCritical).toBe(1);
    expect(isExplained({ ...ok, reason: 'x'.repeat(20) })).toBe(true);
    // An explanation is for one workflow's field, not a blanket.
    expect(compareDay('d', [obs('finance.payments', { late_fee_cents: 500 }, { late_fee_cents: 0 })], [ok]).unexplainedCritical).toBe(1);
  });

  it('feeds the pack\'s own judgement of a streak, including that it needs the day that matters', () => {
    const days = [1, 2, 3].map((n) => compareDay(`2026-12-0${n}`, [obs('finance.billing', { total_cents: 1000 }, undefined, n === 2 ? 'billing_run' : undefined)], []));
    expect(parallelRunStatus(days, { minDays: 3, requiredEvents: ['billing_run'] })).toMatchObject({ ready: true, streak: 3 });
    expect(parallelRunStatus(days, { minDays: 3, requiredEvents: ['grade_posting'] })).toMatchObject({ ready: false, missingEvents: ['grade_posting'] });
    const dirty = [...days, compareDay('2026-12-04', [obs('finance.billing', { total_cents: 1 }, { total_cents: 2 })], [])];
    expect(parallelRunStatus(dirty, { minDays: 3, requiredEvents: ['billing_run'] }).streak).toBe(0);
  });
});

describe('when the parallel run can honestly end', () => {
  const calendar = { billing_run: ['2027-01-15'], grade_posting: ['2026-12-18', '2027-05-12'] };

  it('is the later of the streak length and the last required event', () => {
    expect(earliestExit({ events: ['billing_run'], start: '2026-12-01', minDays: 14, calendar })).toEqual({ date: '2027-01-15', blockers: [] });
    expect(earliestExit({ events: ['grade_posting'], start: '2026-12-01', minDays: 14, calendar })).toEqual({ date: '2026-12-18', blockers: [] });
    expect(earliestExit({ events: [], start: '2026-12-01', minDays: 14, calendar })).toEqual({ date: '2026-12-14', blockers: [] });
  });

  it('says there is no date, and why, when the calendar has no such event, instead of skipping it', () => {
    const e = earliestExit({ events: ['billing_run', 'registration_window'], start: '2026-12-01', minDays: 14, calendar });
    expect(e.date).toBeNull();
    expect(e.blockers).toEqual(['the calendar has no registration_window on or after 2026-12-01']);
  });

  it('ignores events already past', () => {
    expect(earliestExit({ events: ['billing_run'], start: '2027-02-01', minDays: 14, calendar }).date).toBeNull();
  });
});
