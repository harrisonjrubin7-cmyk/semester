import { describe, expect, it } from 'vitest';
import { DOMAIN_SPECS } from './domain-specs';
import { SEVERITY_OF, executableCoverage, runChecks, thresholdsFor } from './adapter';
import { syntheticPair } from './fixtures';
import { DEFAULT_THRESHOLDS, evaluateGate, failureKey, tighten } from './gate';
import { toRunCounts } from './bridge';
import { passes } from './center';
import { EVIDENCE_CLASSES, type CheckResult } from './types';
import type { Pair, Row } from './engine-types';

const spec = (id: string) => DOMAIN_SPECS.find((d) => d.id === id)!;
const academic = spec('academic_records');
const identity = spec('identity');

const edit = (pair: Pair, side: 'source' | 'target', entity: string, change: (rows: Row[]) => Row[]): Pair => ({ ...pair, [side]: { ...pair[side], [entity]: change([...pair[side][entity]]) } });
const set = (rows: Row[], i: number, patch: Record<string, unknown>) => rows.map((r, n) => (n === i ? { ...r, ...patch } : r));

async function gateFor(id: string, pair: Pair, extra: CheckResult[] = []) {
  const d = spec(id);
  const ev = await runChecks(d, pair, 'tenant-a');
  const results = [...ev.results, ...extra];
  return { ev, results, gate: evaluateGate(d.id, results, thresholdsFor(d.stakes), new Set(), { unproven: ev.unproven }) };
}

describe('the engine, read by the pack\'s own gate', () => {
  it('gives the gate a clean fixture it can pass, and for the rest names exactly the evidence the extracts cannot supply', async () => {
    const passing: string[] = [];
    for (const d of DOMAIN_SPECS) {
      const { ev, gate } = await gateFor(d.id, syntheticPair(d));
      // Every check examined something and was proven to notice its own kind of defect.
      expect(ev.unproven, d.id).toEqual([]);
      expect(gate.reasons.filter((r) => r.code === 'vacuous_check' || r.code === 'unproven_check'), d.id).toEqual([]);
      const external = EVIDENCE_CLASSES.filter((c) => !executableCoverage(d).includes(c));
      expect(gate.reasons, d.id).toEqual(external.map((c) => ({ code: 'missing_evidence_class', detail: c })));
      if (gate.passed) passing.push(d.id);
    }
    // Pinned: a domain that gains or loses a class is a decision, and shows up here.
    expect(passing).toEqual(['academic_records', 'learning_content', 'enrollments', 'finance', 'family', 'campus_services']);
  });

  it('passes the remaining domains once the outside evidence arrives, and not before', async () => {
    const signIn: CheckResult = { id: 'identity.outcome.sign_in_resolution', domain: 'identity', evidenceClass: 'outcome', severity: 'critical', examined: 40, failures: [] };
    expect((await gateFor('identity', syntheticPair(identity))).gate.passed).toBe(false);
    expect((await gateFor('identity', syntheticPair(identity), [signIn])).gate.passed).toBe(true);
    const failing = { ...signIn, failures: [{ ref: 'sha256:x', code: 'outcome_differs' }] };
    expect((await gateFor('identity', syntheticPair(identity), [failing])).gate.reasons.map((r) => r.code)).toContain('critical_failure');
  });

  it('maps the engine\'s three grades onto the pack\'s four, and keeps counts at low', async () => {
    expect(SEVERITY_OF).toEqual({ critical: 'critical', major: 'high', minor: 'medium' });
    const { results } = await gateFor('finance', syntheticPair(spec('finance')));
    expect(results.find((r) => r.evidenceClass === 'count')).toMatchObject({ severity: 'low' });
  });

  it('is stricter where one wrong record is a harm, and can never be looser than the floor', () => {
    expect(thresholdsFor('standard')).toEqual(DEFAULT_THRESHOLDS);
    expect(thresholdsFor('high')).toMatchObject({ critical: 0, high: 0, medium: 0.005 });
    expect(() => tighten(DEFAULT_THRESHOLDS, { high: 0.5 })).toThrow(/may only tighten/);
  });
});

describe('what a defect does on the way through', () => {
  it('fails a critical defect the migration introduced, attributes it, and leaves the count check green', async () => {
    const pair = edit(syntheticPair(academic), 'target', 'course_result', (r) => set(r, 0, { grade: 'F' }));
    const { results, gate } = await gateFor('academic_records', pair);
    expect(gate.passed).toBe(false);
    expect(gate.reasons.map((r) => r.code)).toContain('critical_failure');
    expect(results.find((r) => r.evidenceClass === 'count')!.failures).toEqual([]);
    const f = results.find((r) => r.id === 'academic_records.result.preserved')!.failures[0];
    expect(f).toMatchObject({ code: 'value_differs', origin: 'migration' });
  });

  it('reports a wrong parent as relationship evidence and a wrong value as semantic, from the same check', async () => {
    const wrongParent = edit(syntheticPair(academic), 'target', 'course_result', (r) => set(r, 0, { student_id: syntheticPair(academic).target.student_record[3].student_id }));
    const { results } = await gateFor('academic_records', wrongParent);
    const mine = results.filter((r) => r.id.startsWith('academic_records.result.preserved'));
    expect(mine.map((r) => r.evidenceClass).sort()).toEqual(['relationship', 'semantic']);
    expect(mine.find((r) => r.evidenceClass === 'relationship')!.failures.map((f) => f.code)).toContain('wrong_parent');
    expect(mine.find((r) => r.evidenceClass === 'semantic')!.failures).toEqual([]);
  });

  it('does not let a check claim a class it did not examine', async () => {
    const { results } = await gateFor('identity', syntheticPair(identity));
    // `binding` compares links only; it must not stand in for a semantic comparison.
    const binding = results.filter((r) => r.id.startsWith('identity.external_identity.binding'));
    expect(binding.map((r) => r.evidenceClass)).toEqual(['relationship']);
  });

  it('carries a source-origin defect through as the institution\'s, which holds the gate until it is dispositioned', async () => {
    const dirty = edit(edit(syntheticPair(academic), 'source', 'student_record', (r) => set(r, 0, { gpa: 0.1 })), 'target', 'student_record', (r) => set(r, 0, { gpa: 0.1 }));
    const { results, gate } = await gateFor('academic_records', dirty);
    const failing = results.flatMap((r) => r.failures.map((f) => ({ id: r.id, f })));
    expect(failing.map((x) => x.f.origin)).toEqual(['source']);
    expect(gate.passed).toBe(false);
    const dispo = new Set(failing.map((x) => failureKey(x.id, x.f)));
    const d = evaluateGate('academic_records', results, thresholdsFor('high'), dispo, { unproven: [] });
    expect(d.passed).toBe(true);
  });

  it('holds the gate on a check nobody has seen fail, and lets an attested-empty population through', async () => {
    const d = spec('enrollments');
    const pair = syntheticPair(d);
    const empty: Pair = { ...pair, source: { ...pair.source, waitlist_entry: [] }, target: { ...pair.target, waitlist_entry: [] } };
    const ev = await runChecks(d, empty, 't');
    const bare = evaluateGate(d.id, ev.results, thresholdsFor(d.stakes), new Set(), { unproven: ev.unproven });
    expect(bare.reasons.map((r) => r.code)).toContain('vacuous_check');
    expect(bare.reasons.map((r) => r.code)).toContain('unproven_check');
    const attested = ['enrollments.waitlist.crosswalk', 'enrollments.waitlist.order', 'enrollments.waitlist.preserved'];
    const ev2 = await runChecks(d, empty, 't', attested);
    const ok = evaluateGate(d.id, ev2.results, thresholdsFor(d.stakes), new Set(), { attestedEmpty: ev2.attestedResultIds, unproven: ev2.unproven });
    expect(ok.passed).toBe(true);
    // One check, two results (semantic and relationship): the attestation covers both.
    expect([...ev2.attestedResultIds].filter((id) => id.startsWith('enrollments.waitlist.preserved'))).toHaveLength(2);
    // Only the vacuity refusal is lifted: an unattested empty check still blocks.
    expect(evaluateGate(d.id, ev2.results, thresholdsFor(d.stakes), new Set(), { attestedEmpty: new Set(['enrollments.waitlist.order']), unproven: [] }).reasons.map((r) => r.code)).toContain('vacuous_check');
  });
});

describe('what leaves the process', () => {
  it('is salted references and codes: no key, no value, and a different reference for a different tenant', async () => {
    const pair = edit(syntheticPair(identity), 'target', 'person', (r) => set(r, 0, { legal_name: 'Alexandra Q. Student' }));
    const a = await runChecks(identity, pair, 'tenant-a');
    const b = await runChecks(identity, pair, 'tenant-b');
    const text = JSON.stringify(a.results);
    expect(text).not.toContain('Alexandra');
    expect(text).not.toContain('person-0');
    expect(text).not.toContain('example.test');
    const refs = (e: typeof a) => e.results.flatMap((r) => r.failures.map((f) => f.ref));
    expect(refs(a).every((x) => x.startsWith('sha256:'))).toBe(true);
    expect(refs(a)).not.toEqual(refs(b));
  });
});

describe('what the Migration Center is told', () => {
  it('records a conclusive clean run as counts the Center passes, and a defective one as counts it does not', async () => {
    const clean = await gateFor('academic_records', syntheticPair(academic));
    const good = toRunCounts('validation', clean.results, clean.gate);
    expect(passes('validation', good)).toBe(true);
    expect(passes('reconciliation', toRunCounts('reconciliation', clean.results, clean.gate))).toBe(true);
    const bad = await gateFor('academic_records', edit(syntheticPair(academic), 'target', 'course_result', (r) => set(r, 0, { grade: 'F' })));
    expect(passes('validation', toRunCounts('validation', bad.results, bad.gate))).toBe(false);
    expect(passes('reconciliation', toRunCounts('reconciliation', bad.results, bad.gate))).toBe(false);
  });

  /*
   * The control. Counts alone would satisfy the Center's pass rule. An unproven
   * check is recorded as a failed row, so a run whose checks were never shown to
   * work cannot become a recorded pass.
   */
  it('records a run whose checks were never proven as one the Center refuses', async () => {
    const d = spec('academic_records');
    const ev = await runChecks(d, syntheticPair(d), 't');
    const unproven = ['academic_records.student.gpa'];
    const gate = evaluateGate(d.id, ev.results, thresholdsFor(d.stakes), new Set(), { unproven });
    expect(gate.passed).toBe(false);
    expect(passes('validation', toRunCounts('validation', ev.results, gate))).toBe(false);
    expect(passes('reconciliation', toRunCounts('reconciliation', ev.results, gate))).toBe(false);
  });
});
