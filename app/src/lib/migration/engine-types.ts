/**
 * The vocabulary of an institutional migration, in one place.
 *
 * `lib/integration/` keeps a school's *ongoing* feeds honest: a connector, a
 * mapping, a freshness target, a dashboard. This directory is the other
 * thing — the one-time, bounded program that moves an institution's history
 * into Semester — and it deliberately reuses that directory's rules rather than
 * restating them: the T0–T6 floor (`classification.ts`), the never-ingest list
 * (`catalog.ts`), redacted references (`redact.ts`). A second copy of any of
 * those would be a second place for a school's data to be allowed to go.
 *
 * Everything here is pure. Files, a database and a clock are handed in, so the
 * CLI, the tests and a future worker share one implementation.
 */
import type { DataClass } from '../integration/classification.ts';
import type { DataDomain, EvidenceClass } from './types.ts';

/** A row as extracted or loaded. Field names are the canonical ones on both sides. */
export type Row = Readonly<Record<string, unknown>>;

/** Entity name to its rows. */
export type Dataset = Readonly<Record<string, readonly Row[]>>;

/** Entity to source key to target key. The transform step writes it; validation never does. */
export type Crosswalk = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * Source and target, linked.
 *
 * `excluded` is what the institution decided not to move, with the reason on
 * record. A row missing from the target is a defect unless it is listed here;
 * the reason is what makes "we left it out" a decision and not a loss.
 */
export interface Pair {
  source: Dataset;
  target: Dataset;
  crosswalk: Crosswalk;
  excluded?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * Target keys the institution approved collapsing several source rows into —
   * a duplicate person it has already decided are one. Anything not listed is
   * a defect: two people becoming one is the failure that cannot be undone.
   */
  approvedMerges?: Readonly<Record<string, readonly string[]>>;
}

/**
 * How bad one finding of a check is, in the engine's own three grades. The
 * gate speaks `Severity` (`types.ts`: critical, high, medium, low); `adapter.ts`
 * maps one onto the other so the two vocabularies are never mixed in a record.
 */
export type Gravity = 'critical' | 'major' | 'minor';
export const GRAVITIES: readonly Gravity[] = ['critical', 'major', 'minor'];

/**
 * Whose fault a finding is.
 *
 * `migration`: the target is wrong and the source was right — ours to fix.
 * `source`: the source already had the defect and the migration carried it —
 * the institution's to fix or waive. Mixing the two is how a clean migration
 * gets blamed for a dirty registrar, and how a dirty migration hides behind it.
 */
export type Origin = 'migration' | 'source';


export interface FieldSpec {
  name: string;
  class: DataClass;
  required?: boolean;
  note?: string;
}

export interface EntitySpec {
  name: string;
  /** Fields whose values together identify a row. */
  key: readonly string[];
  /** What it is, for the workbook. */
  label: string;
  fields: readonly FieldSpec[];
}

/** What stays behind, and why. Never a silent omission. */
export interface ExcludedSpec {
  name: string;
  class: DataClass;
  handling: string;
}

type Base = { id: string; gravity: Gravity };

/** `how` a value is compared: exact is the default and is almost always right. */
export type Compare = 'exact' | 'date' | 'number';

export interface Filter {
  field: string;
  in: readonly string[];
}

export type InvariantSpec =
  | (Base & { kind: 'crosswalk'; entity: string })
  | (Base & { kind: 'unique'; entity: string; fields: readonly string[] })
  | (Base & { kind: 'reference'; entity: string; field: string; to: string })
  | (Base & {
      kind: 'preserved';
      entity: string;
      fields: readonly string[];
      compare?: Compare;
      /**
       * Foreign keys that must still point at the *same* parent, through the
       * crosswalk. A swapped grade carries a perfectly valid key to the wrong
       * student, which `reference` cannot see and this can.
       */
      links?: readonly { field: string; to: string }[];
    })
  | (Base & {
      kind: 'derived';
      entity: string;
      child: string;
      childSubject: string;
      value: string;
      weight?: string;
      agg: 'sum' | 'weighted_mean';
      filter?: Filter;
      stated?: string;
      tolerance: number;
      integer?: boolean;
    })
  | (Base & { kind: 'history'; entity: string; subjectEntity: string; subject: string; seq: string; value: string; current?: string })
  | (Base & {
      kind: 'permission';
      entity: string;
      principal: string;
      principalEntity: string;
      resource: string;
      resourceEntity?: string;
      requires?: { entity: string; principal: string; resource: string; active?: string };
    })
  | (Base & { kind: 'order'; entity: string; group: string; groupEntity?: string; position: string })
  | (Base & {
      kind: 'bounded';
      entity: string;
      group: string;
      groupEntity: string;
      capacity: string;
      filter?: Filter;
      equalToSource?: boolean;
    })
  | (Base & { kind: 'temporal'; entity: string; start: string; end: string });

export type InvariantKind = InvariantSpec['kind'];

export const INVARIANT_KINDS: readonly InvariantKind[] = [
  'crosswalk', 'unique', 'reference', 'preserved', 'derived', 'history', 'permission', 'order', 'bounded', 'temporal',
];

export interface DomainSpec {
  id: DataDomain;
  label: string;
  /** Grades, billing, registration, access, legal notices: no tolerance for a wrong record. */
  stakes: 'high' | 'standard';
  /** The institution office that owns the answer to "is this right". */
  owner: string;
  /** The source system categories, for the inventory. */
  sources: readonly string[];
  entities: readonly EntitySpec[];
  /**
   * Entities another domain owns that this one points at. Their rows and
   * crosswalk are supplied so links can be checked; they are never counted or
   * crosswalk-checked here, because their own domain does that.
   */
  references: readonly EntitySpec[];
  excluded: readonly ExcludedSpec[];
  invariants: readonly InvariantSpec[];
  cleansing: readonly string[];
  transforms: readonly string[];
  /** Plain statements an institution signs. Each is backed by an invariant, a parallel-run workflow, or both. */
  acceptance: readonly string[];
}

/** One defect, before redaction. `key` is the source key and never leaves the process. */
export interface RawFinding {
  invariant: string;
  key: string;
  origin: Origin;
  gravity: Gravity;
  /**
   * A stable machine code, in the vocabulary `checks.ts` and `bridge.ts`
   * already use (`missing_in_target`, `access_widened`, `value_differs` …), so
   * the Migration Center bridge counts it as missing, extra or differing
   * without a second table of strings.
   */
  code: string;
  /** What this finding is evidence about; a `preserved` check's link findings are `relationship`, its field findings `semantic`. */
  evidenceClass: EvidenceClass;
  /** Field and entity names only — never a value. */
  what: string;
}

export interface InvariantResult {
  invariant: string;
  kind: InvariantKind;
  gravity: Gravity;
  /** The population the check looked at. Zero means the check proved nothing. */
  examined: number;
  findings: RawFinding[];
}
