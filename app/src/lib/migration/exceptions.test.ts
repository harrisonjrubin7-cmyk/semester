import { describe, expect, it } from 'vitest';
import { applyRun, close, dispositioned, markOutOfScope, overdue, raise, reopen, resolve, assignOwner, verify, waive } from './exceptions.ts';
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

describe('a defect the migration introduced', () => {
  const introduced = (severity: Severity = 'high'): ExceptionRow => raise([], [{ ...result(severity), failures: [{ ref: 'r1', code: 'value_differs', origin: 'migration' }] }], 'analyst', T)[0];
  const triaged = (row: ExceptionRow) => assignOwner(row, 'owner', 'lead', later(1));

  it('carries its origin from the failure into the row', () => {
    expect(introduced().origin).toBe('migration');
    expect(open().origin).toBeUndefined();
  });

  it('is fixed in the mapping: it cannot be waived or descoped, even at a severity a waiver could otherwise cover', () => {
    const row = triaged(introduced('medium'));
    expect(() => waive(row, 'bursar', 'we would like this to go away today', later(500), later(2))).toThrow(/introduced/);
    expect(() => markOutOfScope(row, 'bursar', 'not worth the effort this term', later(2))).toThrow(/introduced/);
  });

  it('may still be waived when the source already had it', () => {
    const row = triaged(raise([], [{ ...result('medium'), failures: [{ ref: 'r1', code: 'value_differs', origin: 'source' }] }], 'analyst', T)[0]);
    expect(waive(row, 'bursar', 'the registrar corrects this at source in November', later(500), later(2)).state).toBe('waived');
  });
});

describe('a fix is proven by the next run', () => {
  const failing = (ref = 'r1'): CheckResult => ({ id: 'finance.x', domain: 'finance', evidenceClass: 'semantic', severity: 'high', examined: 10, failures: [{ ref, code: 'value_differs' }] });
  const clean = (): CheckResult => ({ ...failing(), failures: [] });
  const resolved = (): ExceptionRow => resolve(assignOwner(open(), 'owner', 'lead', later(1)), 'corrected the code table', 'owner', later(2));

  it('verifies a resolved row when the check ran and no longer fails, naming the evidence', () => {
    const [row] = applyRun([resolved()], [clean()], 'ev-9', later(3));
    expect(row).toMatchObject({ state: 'verified', verifiedByEvidence: 'ev-9' });
    expect(row.history.at(-1)!.actor).toBe('validation');
  });

  it('sends it back to triage when the same failure is still there', () => {
    const [row] = applyRun([resolved()], [failing()], 'ev-9', later(3));
    expect(row.state).toBe('triaged');
  });

  it('does not verify a row on a run that never ran its check', () => {
    const other: CheckResult = { ...clean(), id: 'finance.other' };
    expect(applyRun([resolved()], [other], 'ev-9', later(3))[0].state).toBe('resolved');
  });

  it('reopens a verified or closed row when its failure comes back, and raises anything new', () => {
    const verified = verify(resolved(), 'ev-9', false, 'reviewer', later(3));
    const next = applyRun([verified], [failing(), failing('r2')], 'ev-10', later(4));
    expect(next.map((r) => [r.ref, r.state])).toEqual([['r1', 'open'], ['r2', 'open']]);
    expect(next[0].history.at(-1)!.note).toMatch(/found it again/);
    const closed = close(verified, 'reviewer', later(5));
    expect(applyRun([closed], [failing()], 'ev-11', later(6))[0].state).toBe('open');
  });

  it('refuses to reopen something that was never fixed', () => {
    expect(() => reopen(open(), 'x', later(1))).toThrow();
  });

  it('is idempotent: running the same results twice raises nothing twice', () => {
    const once = applyRun([], [failing()], 'ev-1', later(1));
    expect(applyRun(once, [failing()], 'ev-2', later(2))).toHaveLength(1);
  });
});
