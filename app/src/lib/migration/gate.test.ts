import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS, evaluateGate, failureKey, tighten } from './gate.ts';
import { EVIDENCE_CLASSES } from './types.ts';
import type { CheckResult, EvidenceClass, Severity } from './types.ts';

const r = (evidenceClass: EvidenceClass, over: Partial<CheckResult> = {}): CheckResult => ({
  id: `f.${evidenceClass}`, domain: 'finance', evidenceClass, severity: 'high', examined: 100, failures: [], ...over,
});
const full = () => EVIDENCE_CLASSES.map((c) => r(c));

describe('the data-quality gate', () => {
  it('passes only when every evidence class examined something', () => {
    expect(evaluateGate('finance', full()).passed).toBe(true);
    expect(evaluateGate('finance', full()).covered).toEqual([...EVIDENCE_CLASSES]);
  });

  it('refuses a domain proven by counts alone, and says so', () => {
    const g = evaluateGate('finance', [r('count', { examined: 1_000_000 })]);
    expect(g.passed).toBe(false);
    expect(g.reasons.map((x) => x.code)).toContain('row_count_only');
    expect(g.reasons.filter((x) => x.code === 'missing_evidence_class').map((x) => x.detail)).toEqual(
      EVIDENCE_CLASSES.filter((c) => c !== 'count'),
    );
  });

  it('refuses a check that looked at nothing, even with no failures', () => {
    const results = [...EVIDENCE_CLASSES.filter((c) => c !== 'history').map((c) => r(c)), r('history', { examined: 0 })];
    const g = evaluateGate('finance', results);
    expect(g.passed).toBe(false);
    expect(g.reasons).toContainEqual({ code: 'vacuous_check', detail: 'f.history' });
    expect(g.reasons).toContainEqual({ code: 'missing_evidence_class', detail: 'history' });
  });

  it('has nothing to say about a domain with no results, and does not pass it', () => {
    expect(evaluateGate('career', full()).reasons).toEqual([{ code: 'no_checks', detail: 'no results for this domain' }]);
  });

  it('never tolerates a critical failure, however small the rate', () => {
    const results = [...full().filter((x) => x.evidenceClass !== 'outcome'), r('outcome', { severity: 'critical', examined: 1_000_000, failures: [{ ref: 'a', code: 'outcome_differs' }] })];
    const g = evaluateGate('finance', results);
    expect(g.passed).toBe(false);
    expect(g.reasons).toContainEqual({ code: 'critical_failure', detail: '1 open' });
  });

  it('tolerates non-critical failures under the rate and refuses over it', () => {
    const failing = (n: number) => Array.from({ length: n }, (_, i) => ({ ref: `x${i}`, code: 'value_differs' }));
    const base = full().filter((x) => x.evidenceClass !== 'semantic');
    expect(evaluateGate('finance', [...base, r('semantic', { examined: 10_000, failures: failing(10) })]).passed).toBe(true); // 0.1%, at the line
    const over = evaluateGate('finance', [...base, r('semantic', { examined: 10_000, failures: failing(11) })]);
    expect(over.passed).toBe(false);
    expect(over.reasons[0].code).toBe('rate_exceeded');
  });

  it('does not count a failure the exception queue has dispositioned, and does count one it has not', () => {
    const f = { ref: 'x', code: 'value_differs' };
    const results = [...full().filter((x) => x.evidenceClass !== 'semantic'), r('semantic', { severity: 'critical', failures: [f] })];
    expect(evaluateGate('finance', results).passed).toBe(false);
    expect(evaluateGate('finance', results, DEFAULT_THRESHOLDS, new Set([failureKey('f.semantic', f)])).passed).toBe(true);
    expect(evaluateGate('finance', results, DEFAULT_THRESHOLDS, new Set([failureKey('f.semantic', { ref: 'other', code: 'value_differs' })])).passed).toBe(false);
  });

  it('lets a domain tighten thresholds but never loosen them', () => {
    expect(tighten(DEFAULT_THRESHOLDS, { high: 0 }).high).toBe(0);
    for (const s of ['critical', 'high', 'medium', 'low'] as Severity[]) {
      expect(() => tighten(DEFAULT_THRESHOLDS, { [s]: DEFAULT_THRESHOLDS[s] + 0.0001 })).toThrow(RangeError);
    }
    expect(() => tighten(DEFAULT_THRESHOLDS, { critical: 0.5 })).toThrow(/only tighten/);
    expect(() => tighten(DEFAULT_THRESHOLDS, { high: -1 })).toThrow(RangeError);
  });
});

describe('the gate refuses a check nobody has seen fail', () => {
  it('holds the domain on an unproven check, and says which', () => {
    const g = evaluateGate('finance', full(), DEFAULT_THRESHOLDS, new Set(), { unproven: ['finance.ledger.history'] });
    expect(g.passed).toBe(false);
    expect(g.reasons).toContainEqual({ code: 'unproven_check', detail: 'finance.ledger.history' });
    expect(evaluateGate('finance', full(), DEFAULT_THRESHOLDS, new Set(), { unproven: [] }).passed).toBe(true);
  });

  it('lets an attested-empty check off the vacuity refusal only, never off the need for the class', () => {
    const vacuous = [...EVIDENCE_CLASSES.filter((c) => c !== 'history').map((c) => r(c)), r('history', { examined: 0 })];
    expect(evaluateGate('finance', vacuous).reasons.map((x) => x.code)).toContain('vacuous_check');
    const attested = evaluateGate('finance', vacuous, DEFAULT_THRESHOLDS, new Set(), { attestedEmpty: new Set(['f.history']) });
    expect(attested.reasons.map((x) => x.code)).not.toContain('vacuous_check');
    // The class still has no check that examined anything.
    expect(attested.reasons).toContainEqual({ code: 'missing_evidence_class', detail: 'history' });
    expect(attested.passed).toBe(false);
  });
});
