import { describe, expect, it } from 'vitest';
import { WARN_AT, atRiskToday, clockOf } from './atrisk';
import { dueReminders, ATTEND_LEAD } from './notify';
import type { Attended } from './attend';
import type { Block, DatedItem } from './types';
import type { NotifKey } from '../data/misc';

const ON: Record<NotifKey, boolean> = {
  class: false, today: false, two: false, free: false, sun: false, exam: false, term: false,
  attend: true,
};

const block = (c: string | null, at: number, over: Partial<Block> = {}): Block =>
  ({ time: clockOf(at), at, title: c ?? 'Something', meta: '', c, ...over }) as Block;

const absences = (courseId: string, n: number): Attended[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${courseId}:2026-09-0${i + 1}`,
    courseId,
    date: `2026-09-0${i + 1}`,
    mark: 'absent' as const,
    at: 0,
  }));

// Three allowed, two points off each.
const POLICY = { core: { allowed: 3, penaltyPer: 2, worth: 10, note: '' } };
const code = (id: string) => (id === 'core' ? 'CORE 2500' : id.toUpperCase());

describe('clockOf', () => {
  it('reads as a clock, not as minutes', () => {
    expect(clockOf(13 * 60 + 15)).toBe('1:15');
    expect(clockOf(9 * 60 + 5)).toBe('9:05');
    expect(clockOf(12 * 60)).toBe('12:00');
    expect(clockOf(0)).toBe('12:00');
  });
});

describe('which classes are at risk', () => {
  const classes = [block('core', 13 * 60 + 15)];

  it('says nothing while there are absences to spare', () => {
    // Three allowed. None used leaves three, one used leaves two — both are a
    // normal term. Two used leaves one, which is the case below.
    expect(atRiskToday(classes, [], POLICY, code)).toEqual([]);
    expect(atRiskToday(classes, absences('core', 1), POLICY, code)).toEqual([]);
  });

  it('speaks when one is left', () => {
    const got = atRiskToday(classes, absences('core', 3 - WARN_AT), POLICY, code);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ code: 'CORE 2500', clock: '1:15', left: 1, costs: 2 });
  });

  it('speaks when the allowance is gone', () => {
    const got = atRiskToday(classes, absences('core', 5), POLICY, code);
    expect(got[0]).toMatchObject({ left: 0, costs: 2 });
  });

  it('never speaks for a course with no attendance policy', () => {
    expect(atRiskToday(classes, absences('core', 9), {}, code)).toEqual([]);
    expect(atRiskToday(classes, absences('core', 9), { core: { allowed: 0, penaltyPer: 0, worth: 0, note: '' } }, code)).toEqual([]);
  });

  it('ignores office hours and cancelled meetings — neither costs an absence', () => {
    const optional = [block('core', 780, { optional: true })];
    const off = [block('core', 780, { canceled: true })];
    expect(atRiskToday(optional, absences('core', 2), POLICY, code)).toEqual([]);
    expect(atRiskToday(off, absences('core', 2), POLICY, code)).toEqual([]);
  });

  it('ignores blocks that belong to no course', () => {
    expect(atRiskToday([block(null, 780)], absences('core', 2), POLICY, code)).toEqual([]);
  });

  it('gives one row for a course that meets twice in a day', () => {
    const twice = [block('core', 9 * 60), block('core', 15 * 60)];
    const got = atRiskToday(twice, absences('core', 2), POLICY, code);
    expect(got).toHaveLength(1);
    expect(got[0].at).toBe(9 * 60); // the earlier one
  });
});

describe('the reminder it becomes', () => {
  const src = (atRisk: ReturnType<typeof atRiskToday>) => ({ items: [] as DatedItem[], classes: [], atRisk });
    // Two of three used, so one is left.
  const risky = atRiskToday([block('core', 13 * 60 + 15)], absences('core', 2), POLICY, code);
  const at = (h: number, m = 0) => new Date(2026, 8, 8, h, m);

  it('fires inside the lead time, in the app’s voice', () => {
    const got = dueReminders(at(12, 40), ON, src(risky));
    expect(got).toHaveLength(1);
    expect(got[0].title).toBe('CORE 2500 at 1:15');
    expect(got[0].body).toBe('One absence left before the penalty.');
    expect(got[0].body).not.toMatch(/!/);
  });

  it('does not fire too early', () => {
    expect(dueReminders(at(8), ON, src(risky))).toEqual([]);
    expect(dueReminders(at(12, 29), ON, src(risky))).toEqual([]); // 46 minutes out
  });

  it('does not fire once the class has started', () => {
    expect(dueReminders(at(13, 20), ON, src(risky))).toEqual([]);
  });

  it('names the cost once the allowance is gone', () => {
    const gone = atRiskToday([block('core', 13 * 60 + 15)], absences('core', 5), POLICY, code);
    const got = dueReminders(at(12, 40), ON, src(gone));
    expect(got[0].body).toBe('Past the allowance. Another costs 2% of the final grade.');
  });

  it('is silent when the rule is switched off', () => {
    expect(dueReminders(at(12, 40), { ...ON, attend: false }, src(risky))).toEqual([]);
  });

  it('uses one id for the whole week, so it cannot fire twice', () => {
    // Tuesday and Thursday of the same week.
    const tue = dueReminders(new Date(2026, 8, 8, 12, 40), ON, src(risky))[0];
    const thu = dueReminders(new Date(2026, 8, 10, 12, 40), ON, src(risky))[0];
    expect(tue.id).toBe(thu.id);
    // The next week is a different warning.
    const next = dueReminders(new Date(2026, 8, 15, 12, 40), ON, src(risky))[0];
    expect(next.id).not.toBe(tue.id);
  });

  it('lead time is the one the module states', () => {
    expect(ATTEND_LEAD).toBe(45);
  });
});
