/**
 * The seam to the Migration Center (`center.ts`).
 *
 * The Center is where a migration's stage, gates and approvals live, and its
 * database refuses a stage move without evidence. What it records for a
 * validation or reconciliation is *counts* about a sample file, and its
 * `passed` column is generated from them. That is the row-count success this
 * work exists to refuse. It cannot be changed by this code and should not be
 * worked around: instead the semantic gate runs first, and what it found is
 * written *into the counts* so the generated `passed` agrees with it.
 *
 * - an open failing case counts as a missing, extra or differing row by kind
 *   (and, for a validation, as a failed row too, since that is all the Center
 *   reads there);
 * - a gate that fails for a structural reason — an evidence class nobody
 *   checked, a check that looked at nothing — contributes one failed row per
 *   reason, so a perfect-looking count cannot pass a domain that was never
 *   properly examined.
 *
 * So the one rule here is: record the run this returns, never raw counts.
 */
import type { MigrationDomain, RunCounts, RunKind } from './center';
import { failureKey, type GateResult } from './gate.ts';
import type { CheckResult, DataDomain } from './types.ts';

/** Which kinds of data each retired system holds. `other` is deliberately empty: it must be mapped by hand. */
export const SYSTEM_HOLDS: Readonly<Record<MigrationDomain, readonly DataDomain[]>> = {
  lms: ['learning_content', 'courses', 'enrollments', 'documents'],
  registration: ['enrollments', 'courses', 'academic_records', 'identity'],
  degree_audit: ['academic_records'],
  advising: ['academic_records', 'documents', 'family'],
  student_accounts: ['finance', 'family'],
  housing: ['campus_services', 'finance'],
  career: ['career', 'documents'],
  campus_events: ['campus_services'],
  communications: ['identity', 'family', 'campus_services'],
  catalog: ['courses'],
  other: [],
};

const MISSING = new Set(['missing_in_target', 'access_narrowed', 'history_truncated']);
const EXTRA = new Set(['no_source', 'duplicated_in_target', 'access_widened']);

/**
 * `RunCounts` for the Center from a semantic run.
 *
 * - `rows_in` is what was examined.
 * - The three comparison counts are the **open** failing cases, by kind.
 *   Dispositioned ones (verified, descoped, a waiver that has not lapsed)
 *   are not counted: the exception queue already answers for them.
 * - A structural reason the gate gave (an evidence class nobody checked, a
 *   check that looked at nothing) counts once, so a clean-looking count cannot
 *   pass a domain that was never properly examined. The Center gates a
 *   `validation` run on `rows_failed` and every other kind on
 *   missing/extra/differing, so it goes where *that kind* looks: to a
 *   reconciliation, a domain nobody examined is a difference.
 *
 * The Center's rule is zero open, stricter than the gate's thresholds. That is
 * intended: thresholds say whether a *rehearsal* is converging; the recorded
 * validation and reconciliation say the data is right, with each exception
 * that remains accounted for.
 */
export function toRunCounts(kind: RunKind, results: readonly CheckResult[], gate: GateResult, dispositioned: ReadonlySet<string> = new Set()): RunCounts {
  let examined = 0;
  let missing = 0;
  let extra = 0;
  let differing = 0;
  for (const r of results) {
    examined += r.examined;
    for (const f of r.failures) {
      if (dispositioned.has(failureKey(r.id, f))) continue;
      if (MISSING.has(f.code)) missing++;
      else if (EXTRA.has(f.code)) extra++;
      else differing++;
    }
  }
  const structural = gate.reasons.filter((r) => r.code === 'no_checks' || r.code === 'row_count_only' || r.code === 'missing_evidence_class' || r.code === 'vacuous_check' || r.code === 'unproven_check').length;
  // The Center gates a validation on `rows_failed` and nothing else, so an open failing case has to be a
  // failed row there, not only a missing/extra/differing one that rule never reads.
  const asFailed = kind === 'validation' ? structural + missing + extra + differing : 0;
  const asDiffering = kind === 'validation' ? 0 : structural;
  return {
    rows_in: examined,
    rows_ok: Math.max(0, examined - missing - extra - differing - structural),
    rows_failed: asFailed,
    rows_missing: missing,
    rows_extra: extra,
    rows_differing: differing + asDiffering,
  };
}
