import { describe, expect, it } from 'vitest';
import { DOMAINS as CENTER_DOMAINS, passes } from './center';
import type { RunKind } from './center';
import { SYSTEM_HOLDS, toRunCounts } from './bridge.ts';
import { evaluateGate, failureKey } from './gate.ts';
import { DATA_DOMAINS, EVIDENCE_CLASSES } from './types.ts';
import type { CheckResult, EvidenceClass } from './types.ts';

const r = (c: EvidenceClass, over: Partial<CheckResult> = {}): CheckResult => ({ id: `fin.${c}`, domain: 'finance', evidenceClass: c, severity: 'high', examined: 100, failures: [], ...over });
const all = () => EVIDENCE_CLASSES.map((c) => r(c));
const run = (results: CheckResult[], dispo = new Set<string>(), kind: RunKind = 'validation') => toRunCounts(kind, results, evaluateGate('finance', results, undefined, dispo), dispo);

describe('the bridge to the Migration Center', () => {
  it('records a clean, fully-evidenced run as one the Center passes, for every kind of run it gates', () => {
    const c = run(all());
    expect(c.rows_in).toBe(700);
    for (const kind of ['validation', 'reconciliation', 'parallel_run'] as const) expect(passes(kind, c)).toBe(true);
  });

  it('cannot let a count-only run pass the Center, in any kind of run, however perfect the counts', () => {
    const countOnly = [r('count', { examined: 5_000_000 })];
    expect(passes('validation', run(countOnly, new Set(), 'validation'))).toBe(false);
    expect(passes('reconciliation', run(countOnly, new Set(), 'reconciliation'))).toBe(false);
    expect(passes('parallel_run', run(countOnly, new Set(), 'parallel_run'))).toBe(false);
    expect(passes('monitoring', run(countOnly, new Set(), 'monitoring'))).toBe(false);
  });

  it('records a check that looked at nothing as a failed row', () => {
    const results = [...all().filter((x) => x.evidenceClass !== 'history'), r('history', { examined: 0 })];
    expect(run(results).rows_failed).toBeGreaterThan(0);
    expect(run(results, new Set(), 'reconciliation').rows_differing).toBeGreaterThan(0);
  });

  it('sorts open failures by kind and leaves dispositioned ones out', () => {
    const results = [...all().filter((x) => x.evidenceClass !== 'key' && x.evidenceClass !== 'permission'),
      r('key', { failures: [{ ref: 'a', code: 'missing_in_target' }, { ref: 'b', code: 'no_source' }, { ref: 'c', code: 'value_differs' }] }),
      r('permission', { severity: 'critical', failures: [{ ref: 'g', code: 'access_widened' }] })];
    const c = run(results);
    expect({ m: c.rows_missing, e: c.rows_extra, d: c.rows_differing }).toEqual({ m: 1, e: 2, d: 1 });
    expect(passes('reconciliation', c)).toBe(false);

    const dispo = new Set([failureKey('fin.key', { ref: 'c', code: 'value_differs' })]);
    expect(run(results, dispo).rows_differing).toBe(0);
  });

  /*
   * The Center gates a validation run on `rows_failed` alone. A failing case
   * counted only as missing, extra or differing is invisible to that rule, so a
   * validation with an open critical failure was recorded as one the Center
   * passes. Found while wiring the engine's results through this bridge.
   */
  it('cannot let a validation with an open failure pass the Center, whatever the failure is', () => {
    const results = [...all().filter((x) => x.evidenceClass !== 'semantic'), r('semantic', { severity: 'critical', failures: [{ ref: 'a', code: 'value_differs' }] })];
    const c = run(results, new Set(), 'validation');
    expect(c.rows_failed).toBeGreaterThan(0);
    expect(passes('validation', c)).toBe(false);
    for (const code of ['missing_in_target', 'no_source', 'access_widened', 'history_truncated']) {
      const one = [...all().filter((x) => x.evidenceClass !== 'key'), r('key', { failures: [{ ref: 'a', code }] })];
      expect(passes('validation', run(one, new Set(), 'validation')), code).toBe(false);
    }
  });

  it('still lets a validation pass once every failing case is dispositioned', () => {
    const results = [...all().filter((x) => x.evidenceClass !== 'semantic'), r('semantic', { failures: [{ ref: 'a', code: 'value_differs' }] })];
    const dispo = new Set([failureKey('fin.semantic', { ref: 'a', code: 'value_differs' })]);
    expect(passes('validation', run(results, dispo, 'validation'))).toBe(true);
  });

  it('states which kinds of data each retired system holds, and every kind is held by some system', () => {
    expect(Object.keys(SYSTEM_HOLDS).sort()).toEqual([...CENTER_DOMAINS].sort());
    const held = new Set(Object.values(SYSTEM_HOLDS).flat());
    expect([...held].sort()).toEqual([...DATA_DOMAINS].sort());
    expect(SYSTEM_HOLDS.other).toEqual([]);
  });
});
