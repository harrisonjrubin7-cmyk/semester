import { describe, expect, it } from 'vitest';
import { close, dispositioned, markOutOfScope, overdue, raise, resolve, assignOwner, verify, waive } from './exceptions.ts';
import type { ExceptionRow } from './exceptions.ts';
import { failureKey } from './gate.ts';
import type { CheckResult, Severity } from './types.ts';

const T = '2026-10-04T08:00:00.000Z';
const later = (h: number) => new Date(Date.parse(T) + h * 3_600_000).toISOString();
const result = (severity: Severity, ref = 'r1'): CheckResult => ({ id: 'finance.x', domain: 'finance', evidenceClass: 'semantic', severity, examined: 10, failures: [{ ref, code: 'value_differs' }] });
const open = (severity: Severity = 'high'): ExceptionRow => raise([], [result(severity)], 'analyst', T)[0];

describe('the exception queue', () => {
  it('raises one row per failure and never duplicates it on a re-run', () => {
    const first = raise([], [result('high'), result('high', 'r2')], 'analyst', T);
    expect(first).toHaveLength(2);
    expect(raise(first, [result('high'), result('high', 'r3')], 'analyst', later(1)).map((x) => x.ref)).toEqual(['r3']);
  });

  it('walks open → triaged → resolved → verified → closed, recording each step', () => {
    let row = open();
    row = assignOwner(row, 'owner', 'lead', later(1));
    row = resolve(row, 'corrected the code table entry for W', 'owner', later(2));
    row = verify(row, 'ev-17', false, 'reviewer', later(3));
    row = close(row, 'reviewer', later(4));
    expect(row.state).toBe('closed');
    expect(row.history.map((h) => h.to)).toEqual(['open', 'triaged', 'resolved', 'verified', 'closed']);
    expect(row.verifiedByEvidence).toBe('ev-17');
  });

  it('will not close anything that was not re-run, and reopens a fix that did not hold', () => {
    let row = assignOwner(open(), 'owner', 'lead', later(1));
    expect(() => close(row, 'x', later(2))).toThrow();
    row = resolve(row, 'fixed', 'owner', later(2));
    expect(() => verify(row, 'ev', false, 'owner', later(3))).toThrow(/owner/);
    expect(verify(row, 'ev', true, 'reviewer', later(3)).state).toBe('triaged');
  });

  it('cannot skip a step', () => {
    const row = open();
    expect(() => resolve(row, 'x', 'o', later(1))).toThrow();
    expect(() => verify(row, 'e', false, 'r', later(1))).toThrow();
    expect(() => waive(row, 'dean', 'x', later(48), later(1))).toThrow();
  });

  it('never waives a critical exception, for anyone', () => {
    const row = assignOwner(open('critical'), 'owner', 'lead', later(1));
    expect(() => waive(row, 'dean', 'we accept it', later(100), later(2))).toThrow(/critical/);
  });

  it('requires a waiver from someone who neither raised nor owns it, with a reason and a future expiry', () => {
    const row = assignOwner(open('medium'), 'owner', 'lead', later(1));
    expect(() => waive(row, 'analyst', 'r', later(100), later(2))).toThrow(/neither/);
    expect(() => waive(row, 'owner', 'r', later(100), later(2))).toThrow(/neither/);
    expect(() => waive(row, 'dean', ' ', later(100), later(2))).toThrow(/reason/);
    expect(() => waive(row, 'dean', 'r', later(1), later(2))).toThrow(/future/);
    expect(waive(row, 'dean', 'cosmetic, fixed by term start', later(100), later(2)).state).toBe('waived');
  });

  it('an expired waiver is open again to the gate', () => {
    const row = waive(assignOwner(open('medium'), 'owner', 'lead', later(1)), 'dean', 'r', later(100), later(2));
    expect(dispositioned([row], later(50)).has(row.key)).toBe(true);
    expect(dispositioned([row], later(101)).has(row.key)).toBe(false);
  });

  it('treats verified, closed and descoped as dispositioned and the rest as open', () => {
    const base = assignOwner(open(), 'owner', 'lead', later(1));
    const verified = verify(resolve(base, 'fixed', 'owner', later(2)), 'ev', false, 'reviewer', later(3));
    const descoped = markOutOfScope(base, 'dean', 'records older than the cutoff', later(2));
    expect(dispositioned([verified], later(5)).has(verified.key)).toBe(true);
    expect(dispositioned([descoped], later(5)).has(descoped.key)).toBe(true);
    expect(dispositioned([base, open()], later(5)).size).toBe(0);
    expect(failureKey('finance.x', { ref: 'r1', code: 'value_differs' })).toBe(base.key);
  });

  it('lists what is overdue, worst severity first', () => {
    const crit = raise([], [result('critical', 'c')], 'a', T)[0];
    const low = raise([], [result('low', 'l')], 'a', T)[0];
    expect(overdue([low, crit], later(3)).map((x) => x.ref)).toEqual([]);
    expect(overdue([low, crit], later(5)).map((x) => x.ref)).toEqual(['c']);
    expect(overdue([low, crit], later(24 * 8)).map((x) => x.ref)).toEqual(['c', 'l']);
    const triaged = assignOwner(crit, 'o', 'lead', later(1));
    expect(overdue([triaged], later(20)).length).toBe(0);
    expect(overdue([triaged], later(26)).length).toBe(1);
  });
});
