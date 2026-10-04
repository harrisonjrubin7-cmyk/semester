/**
 * Where this meets the Migration Center.
 *
 * The Center (`lib/migration/center.ts`, `20260929200000_migration_center.sql`)
 * is the project: one row per migration, twelve stages, a database trigger
 * that refuses a stage move whose evidence is missing, and a screen. What it
 * records as evidence is *counts about a sample file and its hash*, claimed by
 * the migration lead; it says so itself — "the database cannot re-run them".
 * Its validation gate asks that every row mapped; its reconciliation gate asks
 * that every record matched.
 *
 * That is necessary and it is not sufficient. A grade moved to another student
 * maps cleanly and matches a count. What the Center cannot see is whether
 * relationships, history, permissions and outcomes survived. This directory is
 * where that is checked, on the real data, and what it produces is the thing the
 * Center's runs are *about*. This file is the seam, and it is deliberately small:
 *
 * - the stage and domain vocabularies, mapped *exhaustively* — typed against the
 *   Center's own, so a stage or domain added there fails this file's compile
 *   until someone says where it goes;
 * - `centerRun`, which turns a semantic verdict into the counts `recordRun`
 *   takes, and refuses to turn an inconclusive verdict into either answer.
 *
 * It does not duplicate the Center's project, its approvals, or its gates, and
 * nothing here writes to its tables.
 */
import type { MigrationDomain, RunCounts, RunKind, Stage as CenterStage } from '../migration/center.ts';
import type { CountRow } from './engine.ts';
import type { Evaluation } from './quality.ts';
import type { DomainId, InvariantResult } from './types.ts';
import type { Stage } from './lifecycle.ts';

/**
 * Which of this method's stages carries each of the Center's. Exhaustive over
 * the Center's stages by type. Several of ours have no Center stage — `extract`,
 * `rehearse`, `stabilize`'s rollback window — because the Center does not model
 * them; that is the gap this method fills, not a mismatch.
 */
export const CENTER_STAGE: Readonly<Record<CenterStage, readonly Stage[]>> = {
  inventory: ['inventory'],
  classification: ['extract', 'map'],
  mapping: ['map'],
  cleaning: ['cleanse'],
  preview: ['transform'],
  sample_import: ['transform'],
  validation: ['validate'],
  reconciliation: ['validate', 'rehearse'],
  parallel_run: ['parallel_run'],
  cutover: ['cutover'],
  archive: ['archive'],
  monitoring: ['stabilize'],
};

/**
 * Which of this method's domains each Center domain covers. `advising`,
 * `communications` and `other` have none: advising notes are excluded by policy
 * and communications are not a record this method validates.
 */
export const CENTER_DOMAIN: Readonly<Record<MigrationDomain, readonly DomainId[]>> = {
  lms: ['learning_content'],
  registration: ['enrollments'],
  degree_audit: ['academic_records'],
  advising: [],
  student_accounts: ['finance'],
  housing: ['campus_services'],
  career: ['career'],
  campus_events: ['campus_services'],
  communications: [],
  catalog: ['courses'],
  other: [],
};

/** Domains this method validates that the Center has no project type for. They are tracked by this method's ledger alone. */
export const NOT_IN_CENTER: readonly DomainId[] = ['identity', 'family', 'documents'];

export type CenterRun = { ok: true; counts: RunCounts } | { ok: false; why: string };

/**
 * The counts the Center's `recordRun` takes, from a semantic verdict.
 *
 * Only for `validation` and `reconciliation`; a parallel run is recorded from
 * outcome comparisons (`parallel.ts`), and preview and sample import claim
 * nothing about correctness.
 *
 * A `hold` is refused outright. The Center's pass rule is "no failures, no
 * missing, no extra, none differing", and a run with *no findings because a
 * check examined nothing* satisfies it. Turning an inconclusive verdict into
 * zeros would hand the Center exactly the false pass this method exists to
 * prevent, so the answer is "not yet", with the reasons.
 *
 * The Center is stricter than the thresholds in one respect: it fails a run
 * with any migration-introduced finding at all, where a standard domain tolerates
 * minor findings within a rate. A run this engine passes with minor findings is
 * therefore recorded as failing until those are resolved. That is the safe
 * direction and it is left alone.
 */
export function centerRun(kind: RunKind, evaluation: Evaluation, results: readonly InvariantResult[], parity: readonly CountRow[]): CenterRun {
  if (kind !== 'validation' && kind !== 'reconciliation') return { ok: false, why: `A ${kind} run is not derived from the semantic checks.` };
  if (evaluation.verdict === 'hold') return { ok: false, why: `Not conclusive, so not recordable as a pass or a fail: ${evaluation.reasons.join('; ')}` };
  const defects = results.reduce((n, r) => n + r.findings.filter((f) => f.origin === 'migration').length, 0);
  const missing = parity.reduce((n, c) => n + Math.max(0, c.expected - c.target), 0);
  const extra = parity.reduce((n, c) => n + Math.max(0, c.target - c.expected), 0);
  return {
    ok: true,
    counts: {
      rows_in: parity.reduce((n, c) => n + c.source, 0),
      rows_ok: Math.max(0, parity.reduce((n, c) => n + c.target, 0) - defects),
      rows_failed: kind === 'validation' ? defects : 0,
      rows_missing: kind === 'reconciliation' ? missing : 0,
      rows_extra: kind === 'reconciliation' ? extra : 0,
      rows_differing: kind === 'reconciliation' ? defects : 0,
    },
  };
}
