/**
 * The vocabulary of an institutional migration.
 *
 * A migration is not finished when the row counts agree. Counts say a record
 * arrived; they do not say it arrived as the same person's, in the same
 * order, with the same people allowed to read it, producing the same balance
 * or standing the registrar already signed. So a check here declares which
 * *kind of evidence* it provides, and a gate (`gate.ts`) refuses to pass a
 * domain on counts alone.
 *
 * The stages themselves are the Migration Center's (`center.ts` `STAGES`);
 * this module does not restate them. See `docs/migration/README.md`.
 */

/**
 * The ten kinds of data the workbooks cover. Not the Migration Center's
 * `MigrationDomain`, which names the *system being retired* (an LMS, a
 * registration system); one such system holds several of these, and one of
 * these may come from several systems. `bridge.ts` maps between them.
 */
export const DATA_DOMAINS = [
  'identity',
  'academic_records',
  'courses',
  'learning_content',
  'enrollments',
  'finance',
  'family',
  'campus_services',
  'career',
  'documents',
] as const;
export type DataDomain = (typeof DATA_DOMAINS)[number];

/**
 * What a check proves.
 *
 * - `count` — the volumes agree. Necessary, never sufficient.
 * - `key` — the same identities exist on both sides, none twice, none lost.
 * - `semantic` — the same field means the same thing (value, unit, code, time zone).
 * - `relationship` — every reference lands on something that exists and is the right thing.
 * - `history` — the past arrived: order, effective dates, who changed what.
 * - `permission` — the same people can do the same things; nobody gained access.
 * - `outcome` — a business result recomputed in Semester equals the one the institution already relies on.
 */
export const EVIDENCE_CLASSES = ['count', 'key', 'semantic', 'relationship', 'history', 'permission', 'outcome'] as const;
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

/** Every domain needs all of these before it can pass. `count` is deliberately not enough. */
export const REQUIRED_EVIDENCE: readonly EvidenceClass[] = EVIDENCE_CLASSES;

/**
 * - `critical` — wrong data a person will act on, or access that should not exist. Never waivable.
 * - `high` — wrong, and noticed by someone within a term. Waivable by the institution, with an expiry.
 * - `medium` — wrong and cosmetic or recoverable.
 * - `low` — noted.
 */
export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * One failing case. `ref` is an opaque reference (see `integration/redact.ts`),
 * never an id or a value, so a result can be shown on a staff dashboard and
 * stored as evidence without carrying student data.
 */
export interface Failure {
  ref: string;
  code: string;
  /**
   * Whose fault, when a check can tell. `migration`: the target is wrong and
   * the source was right, which only a fix in the mapping resolves and which
   * nobody may waive. `source`: the source already had it, so the institution
   * decides. Absent when a check cannot distinguish (a bare count).
   */
  origin?: 'migration' | 'source';
}

export interface CheckResult {
  /** Stable id of the check, e.g. `finance.balance_by_account`. */
  id: string;
  domain: DataDomain;
  evidenceClass: EvidenceClass;
  severity: Severity;
  /** How many things the check looked at. Zero means it proved nothing. */
  examined: number;
  failures: readonly Failure[];
}

export function failureRate(r: Pick<CheckResult, 'examined' | 'failures'>): number {
  return r.examined === 0 ? 0 : r.failures.length / r.examined;
}
