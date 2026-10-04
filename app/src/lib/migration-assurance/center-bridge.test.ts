import { describe, expect, it } from 'vitest';
import { DOMAINS as CENTER_DOMAINS, STAGES as CENTER_STAGES, passes } from '../migration/center';
import { CENTER_DOMAIN, CENTER_STAGE, NOT_IN_CENTER, centerRun } from './center-bridge';
import { DOMAINS } from './domains';
import { countParity, proveProbes, runDomain } from './engine';
import { syntheticPair } from './fixtures';
import { STAGES } from './lifecycle';
import { evaluateDomain } from './quality';
import type { Pair, Row } from './types';

const academic = DOMAINS.find((d) => d.id === 'academic_records')!;

function run(pair: Pair, probes = true) {
  const results = runDomain(academic, pair);
  const parity = countParity(academic, pair);
  const evaluation = evaluateDomain({ domain: academic, results, parity, probes: probes ? proveProbes(academic, syntheticPair(academic)) : undefined });
  return { results, parity, evaluation };
}
const edit = (pair: Pair, entity: string, change: (rows: Row[]) => Row[]): Pair => ({ ...pair, target: { ...pair.target, [entity]: change([...pair.target[entity]]) } });

describe('the vocabularies line up with the Center\'s, completely', () => {
  it('maps every Center stage to stages of this method, and every one of ours is reachable from somewhere or is a gap the Center has', () => {
    expect(Object.keys(CENTER_STAGE).sort()).toEqual([...CENTER_STAGES].sort());
    for (const stages of Object.values(CENTER_STAGE)) for (const s of stages) expect(STAGES).toContain(s);
    // Every stage of ours is carried by some Center stage. What the Center lacks is content *within* them:
    // rollback rehearsal, a rollback window, delta capture, semantic checks, separation of duties.
    const covered = new Set(Object.values(CENTER_STAGE).flat());
    expect(STAGES.filter((s) => !covered.has(s))).toEqual([]);
  });

  it('maps every Center domain, and names the domains it has no project type for', () => {
    expect(Object.keys(CENTER_DOMAIN).sort()).toEqual([...CENTER_DOMAINS].sort());
    const covered = new Set(Object.values(CENTER_DOMAIN).flat());
    expect(DOMAINS.map((d) => d.id).filter((id) => !covered.has(id)).sort()).toEqual([...NOT_IN_CENTER].sort());
    for (const ids of Object.values(CENTER_DOMAIN)) for (const id of ids) expect(DOMAINS.some((d) => d.id === id)).toBe(true);
  });
});

describe('what the Center is told', () => {
  it('records a clean, conclusive run as the counts the Center\'s own pass rule accepts', () => {
    const { results, parity, evaluation } = run(syntheticPair(academic));
    expect(evaluation.verdict).toBe('pass');
    for (const kind of ['validation', 'reconciliation'] as const) {
      const r = centerRun(kind, evaluation, results, parity);
      if (!r.ok) throw new Error(r.why);
      expect(passes(kind, r.counts)).toBe(true);
      expect(r.counts.rows_in).toBeGreaterThan(0);
    }
  });

  it('records a run with defects as one the Center\'s pass rule rejects, and shows where', () => {
    const swapped = edit(syntheticPair(academic), 'course_result', (rows) => rows.map((r, i) => (i === 0 ? { ...r, grade: 'F' } : r)));
    const { results, parity, evaluation } = run(swapped);
    const v = centerRun('validation', evaluation, results, parity);
    const rec = centerRun('reconciliation', evaluation, results, parity);
    if (!v.ok || !rec.ok) throw new Error('should be recordable');
    expect(passes('validation', v.counts)).toBe(false);
    expect(passes('reconciliation', rec.counts)).toBe(false);
    expect(rec.counts.rows_differing).toBeGreaterThan(0);
    const dropped = edit(syntheticPair(academic), 'course_result', (rows) => rows.slice(1));
    const d = run(dropped);
    const dr = centerRun('reconciliation', d.evaluation, d.results, d.parity);
    if (!dr.ok) throw new Error('should be recordable');
    expect(dr.counts.rows_missing).toBe(1);
  });

  /*
   * The control. With no probe proof the verdict is `hold`, and the findings are
   * all zero — which the Center's pass rule would read as a pass. Refusing here
   * is the whole point of the seam.
   */
  it('refuses to record an inconclusive run, although its counts would satisfy the Center', () => {
    const { results, parity, evaluation } = run(syntheticPair(academic), false);
    expect(evaluation.verdict).toBe('hold');
    expect(passes('validation', { rows_in: 10, rows_ok: 10, rows_failed: 0, rows_missing: 0, rows_extra: 0, rows_differing: 0 })).toBe(true);
    const r = centerRun('validation', evaluation, results, parity);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? '' : r.why).toContain('Not conclusive');
  });

  it('does not derive a parallel run, a preview or a sample import from the semantic checks', () => {
    const { results, parity, evaluation } = run(syntheticPair(academic));
    for (const kind of ['parallel_run', 'preview', 'sample_import', 'monitoring'] as const) expect(centerRun(kind, evaluation, results, parity)).toMatchObject({ ok: false });
  });
});
