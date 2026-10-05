/**
 * The Migration Center: how an institution moves a domain out of a system it
 * is retiring and into Semester, one gate at a time.
 *
 * The brief of 29 September (`docs/expansion/Replaceability-Migration-
 * Continuity-and-Confidence.pdf`) lists the path — source inventory, data
 * classification, field mapping, cleaning rules, transformation preview,
 * sample import, validation, reconciliation, parallel run, cutover, archive,
 * post-cutover monitoring — and what each migration must record. This file is
 * that path as code: the twelve stages, what each needs before a migration may
 * leave it, and the arithmetic the evidence is made of.
 *
 * ## What it never holds
 *
 * A student record. The sample a migration lead previews, validates and
 * reconciles is read in the browser, from a file they chose, and goes no
 * further: what is recorded is counts and the file's SHA-256, so the evidence
 * says *that* 4,812 rows mapped cleanly and *which* file it was, and nothing
 * about anyone in it. The counts are the lead's attributed, append-only claim
 * about a file they hold; the database cannot re-run them, and says so.
 *
 * ## Held in two places
 *
 * The gates are enforced by the database (`private.migration_gate_failures`
 * in `20260929200000_migration_center.sql`), which refuses a stage move whose
 * evidence is missing, and mirrored here so the screen can say what is owed
 * before anyone presses a button. `center.test.ts` holds every vocabulary and
 * every gate code here to the migration, word for word;
 * `migration-center.check.sql` walks each gate against the real trigger.
 */

import { parseTable, type Table } from '../stats';

// ── Vocabularies (each is a check constraint in the migration) ──────────────

export const STAGES = [
  'inventory', 'classification', 'mapping', 'cleaning', 'preview', 'sample_import',
  'validation', 'reconciliation', 'parallel_run', 'cutover', 'archive', 'monitoring',
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  inventory: 'Source inventory',
  classification: 'Data classification',
  mapping: 'Field mapping',
  cleaning: 'Cleaning rules',
  preview: 'Transformation preview',
  sample_import: 'Sample import',
  validation: 'Validation',
  reconciliation: 'Reconciliation',
  parallel_run: 'Parallel run',
  cutover: 'Cutover',
  archive: 'Legacy archive and export',
  monitoring: 'Post-cutover monitoring',
};

/** One sentence per stage: what happens in it. */
export const STAGE_DOES: Record<Stage, string> = {
  inventory: 'Name the system being retired, its version, and the person who owns its data.',
  classification: 'Say how sensitive the data is, how long it must be kept, and where history stops.',
  mapping: 'Map each source field to its Semester field, and mark the fields that identify a record.',
  cleaning: 'Choose what happens to duplicates. Each field’s transform is its cleaning rule.',
  preview: 'Run the mapping over a sample file and look at what it produces.',
  sample_import: 'Run the mapping over a full sample export and record the counts.',
  validation: 'Run the full export again; every row must map with no failures.',
  reconciliation: 'Compare the mapped export with what Semester holds; every record must match.',
  parallel_run: 'Keep the old system official and compare it with Semester, period after period.',
  cutover: 'Set the date, write the rollback plan, and collect every required approval.',
  archive: 'Record where the legacy data was archived and exported to.',
  monitoring: 'Watch the domain after cutover and record each check.',
};

export const DOMAINS = [
  'lms', 'registration', 'degree_audit', 'advising', 'student_accounts', 'housing',
  'career', 'campus_events', 'communications', 'catalog', 'other',
] as const;
export type MigrationDomain = (typeof DOMAINS)[number];

export const DOMAIN_LABEL: Record<MigrationDomain, string> = {
  lms: 'Learning management',
  registration: 'Registration',
  degree_audit: 'Degree audit',
  advising: 'Advising',
  student_accounts: 'Student accounts',
  housing: 'Housing',
  career: 'Career services',
  campus_events: 'Campus events',
  communications: 'Student communications',
  catalog: 'Course catalog',
  other: 'Other',
};

export const CLASSIFICATIONS = ['public', 'internal', 'confidential', 'restricted'] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const APPROVAL_AREAS = ['data_owner', 'registrar', 'it', 'academic_leadership', 'faculty', 'finance'] as const;
export type ApprovalArea = (typeof APPROVAL_AREAS)[number];

export const APPROVAL_LABEL: Record<ApprovalArea, string> = {
  data_owner: 'Data owner',
  registrar: 'Registrar',
  it: 'IT',
  academic_leadership: 'Academic leadership',
  faculty: 'Faculty',
  finance: 'Finance',
};

export const RUN_KINDS = ['preview', 'sample_import', 'validation', 'reconciliation', 'parallel_run', 'monitoring'] as const;
export type RunKind = (typeof RUN_KINDS)[number];

export const TRANSFORMS = ['none', 'trim', 'collapse_spaces', 'lowercase', 'uppercase', 'email', 'date_iso', 'integer', 'decimal'] as const;
export type Transform = (typeof TRANSFORMS)[number];

export const TRANSFORM_LABEL: Record<Transform, string> = {
  none: 'As is',
  trim: 'Trim spaces',
  collapse_spaces: 'Collapse spaces',
  lowercase: 'Lowercase',
  uppercase: 'Uppercase',
  email: 'Email address',
  date_iso: 'Date (YYYY-MM-DD)',
  integer: 'Whole number',
  decimal: 'Number',
};

export const DUPLICATE_RULES = ['reject', 'keep_first', 'keep_last'] as const;
export type DuplicateRule = (typeof DUPLICATE_RULES)[number];

export const DUPLICATE_LABEL: Record<DuplicateRule, string> = {
  reject: 'Refuse duplicates — each is a failure',
  keep_first: 'Keep the first, drop the rest',
  keep_last: 'Keep the last, drop the rest',
};

// ── The record ──────────────────────────────────────────────────────────────

/** A migration, as `public.migration_projects` holds it. */
export interface MigrationProject {
  id: string;
  tenant_id: string;
  name: string;
  domain: MigrationDomain;
  source_platform: string;
  source_version: string;
  data_owner: string;
  classifications: Classification[];
  retention: string;
  historical_cutoff: string | null;
  duplicate_rule: DuplicateRule | null;
  cutover_date: string | null;
  rollback_plan: string;
  archive_location: string;
  required_approvals: ApprovalArea[];
  parallel_runs_required: number;
  stage: Stage;
  stage_entered_at: string;
  created_by: string | null;
  created_at: string;
}

export interface FieldMap {
  id?: string;
  source_field: string;
  target_field: string;
  transform: Transform;
  required: boolean;
  is_key: boolean;
}

/** Counts about a file, never its rows. */
export interface RunCounts {
  rows_in: number;
  rows_ok: number;
  rows_failed: number;
  rows_missing: number;
  rows_extra: number;
  rows_differing: number;
}

export interface MigrationRun extends RunCounts {
  id?: string;
  kind: RunKind;
  stage: Stage;
  period_label: string;
  sample_sha256: string;
  passed: boolean;
  recorded_by: string | null;
  recorded_at: string;
}

export interface MigrationApproval {
  id?: string;
  area: ApprovalArea;
  decision: 'approved' | 'rejected';
  approver_id: string | null;
  note: string;
  recorded_at: string;
}

// ── Gates ───────────────────────────────────────────────────────────────────

/** What the database raises, code by code, and what the screen says for each. */
export const GATE_TEXT: Record<string, string> = {
  source_platform: 'Name the system being retired.',
  source_version: 'Record its version.',
  data_owner: 'Name the person who owns the data.',
  classifications: 'Choose at least one data classification.',
  retention: 'Record the retention obligation.',
  historical_cutoff: 'Set the historical-data cutoff date.',
  field_map: 'Map at least one field.',
  key_field: 'Mark at least one field that identifies a record.',
  duplicate_rule: 'Choose what happens to duplicates.',
  preview_run: 'Preview a sample file.',
  sample_import_run: 'Record a sample import.',
  validation_passed: 'Record a validation in which every row mapped.',
  reconciliation_passed: 'Record a reconciliation in which every record matched.',
  parallel_runs: 'Record enough passing parallel-run periods, the latest of them passing.',
  cutover_date: 'Set the cutover date.',
  rollback_plan: 'Write the rollback plan.',
  approvals: 'Collect every required approval.',
  rejected: 'An approval area’s latest decision is a rejection.',
  archive_location: 'Record where the legacy data was archived.',
  terminal: 'Monitoring is the last stage.',
};

/** The kind of run each stage asks for, where it asks for one. */
export const STAGE_RUN: Partial<Record<Stage, RunKind>> = {
  preview: 'preview',
  sample_import: 'sample_import',
  validation: 'validation',
  reconciliation: 'reconciliation',
  parallel_run: 'parallel_run',
  monitoring: 'monitoring',
};

/**
 * What stops this migration leaving its stage, as the database's codes, in
 * the order it checks them. Empty means it may move on.
 *
 * Evidence counts only if it was recorded in the current stage since the
 * migration last entered it: move back to fix the mapping, and the passing
 * reconciliation from before no longer counts.
 */
export function gateFailures(
  p: MigrationProject,
  maps: readonly FieldMap[],
  runs: readonly MigrationRun[],
  approvals: readonly MigrationApproval[],
): string[] {
  const out: string[] = [];
  const blank = (s: string | null | undefined) => !s || s.trim() === '';
  const since = (at: string) => at >= p.stage_entered_at;
  const here = runs
    .filter((r) => r.stage === p.stage && since(r.recorded_at))
    .sort((a, b) => (a.recorded_at < b.recorded_at ? -1 : a.recorded_at > b.recorded_at ? 1 : 0));
  const latest = (kind: RunKind) => [...here].reverse().find((r) => r.kind === kind);

  switch (p.stage) {
    case 'inventory':
      if (blank(p.source_platform)) out.push('source_platform');
      if (blank(p.source_version)) out.push('source_version');
      if (blank(p.data_owner)) out.push('data_owner');
      break;
    case 'classification':
      if (p.classifications.length === 0) out.push('classifications');
      if (blank(p.retention)) out.push('retention');
      if (!p.historical_cutoff) out.push('historical_cutoff');
      break;
    case 'mapping':
      if (maps.length === 0) out.push('field_map');
      if (!maps.some((m) => m.is_key)) out.push('key_field');
      break;
    case 'cleaning':
      if (!p.duplicate_rule) out.push('duplicate_rule');
      break;
    case 'preview':
      if (!latest('preview')) out.push('preview_run');
      break;
    case 'sample_import':
      if (!latest('sample_import')) out.push('sample_import_run');
      break;
    case 'validation':
      if (!latest('validation')?.passed) out.push('validation_passed');
      break;
    case 'reconciliation':
      if (!latest('reconciliation')?.passed) out.push('reconciliation_passed');
      break;
    case 'parallel_run': {
      const periods = new Set(here.filter((r) => r.kind === 'parallel_run' && r.passed).map((r) => r.period_label.trim().toLowerCase()));
      if (periods.size < p.parallel_runs_required || !latest('parallel_run')?.passed) out.push('parallel_runs');
      break;
    }
    case 'cutover': {
      if (!p.cutover_date) out.push('cutover_date');
      if (blank(p.rollback_plan)) out.push('rollback_plan');
      const current = approvals.filter((a) => since(a.recorded_at));
      const last = (area: ApprovalArea) =>
        current.filter((a) => a.area === area).sort((a, b) => (a.recorded_at < b.recorded_at ? 1 : -1))[0];
      const decided = p.required_approvals.map(last);
      if (decided.some((a) => !a || a.decision !== 'approved')) out.push('approvals');
      if (p.required_approvals.some((area) => last(area)?.decision === 'rejected')) out.push('rejected');
      break;
    }
    case 'archive':
      if (blank(p.archive_location)) out.push('archive_location');
      break;
    case 'monitoring':
      out.push('terminal');
      break;
  }
  return out;
}

export function nextStage(s: Stage): Stage | null {
  const i = STAGES.indexOf(s);
  return i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

/** Whether a migration may go back to an earlier stage: until cutover has happened. */
export function canGoBack(s: Stage): boolean {
  const i = STAGES.indexOf(s);
  return i > 0 && i <= STAGES.indexOf('cutover');
}

/** Field maps change only before the preview; after it, evidence depends on them. */
export function mapsEditable(s: Stage): boolean {
  return STAGES.indexOf(s) <= STAGES.indexOf('cleaning');
}

/** A run counts as passing by the same rule the database's generated column uses. */
export function passes(kind: RunKind, c: RunCounts): boolean {
  if (c.rows_in <= 0) return false;
  if (kind === 'validation') return c.rows_failed === 0;
  if (kind === 'reconciliation' || kind === 'parallel_run' || kind === 'monitoring') return c.rows_missing + c.rows_extra + c.rows_differing === 0;
  return true;
}

// ── Transforms, preview and validation ──────────────────────────────────────

export interface Cell {
  value: string;
  error?: string;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/**
 * How a file writes `a/b/yyyy`. Nothing in the project row says, so it is a
 * choice made while previewing and never stored: the counts recorded are the
 * same shape either way.
 */
export type SlashOrder = 'month_first' | 'day_first';

export const SLASH_ORDER_LABEL: Record<SlashOrder, string> = {
  month_first: 'Month first (3/7/2026 is 7 March)',
  day_first: 'Day first (3/7/2026 is 3 July)',
};

/** What a slash date turned out to be: a date, not a date, or two dates the file does not say between. */
type Slash = { iso: string } | { error: 'not a date' | 'ambiguous' };

function validIso(y: number, m: number, d: number): string | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * `a/b/yyyy` is two different days to two different schools: `3/7/2026` is
 * 7 March in one and 3 July in the other. Reading it one way by default makes a
 * valid, wrong date that every later check accepts. So the order is the
 * caller's to give. Without it a slash date is read only when it cannot mean
 * the other thing — one part above 12, or both parts equal — and otherwise is
 * refused as ambiguous.
 */
function slashDate(a: number, b: number, y: number, order: SlashOrder | undefined): Slash {
  const monthFirst = validIso(y, a, b);
  const dayFirst = validIso(y, b, a);
  if (order === 'month_first') return monthFirst ? { iso: monthFirst } : { error: 'not a date' };
  if (order === 'day_first') return dayFirst ? { iso: dayFirst } : { error: 'not a date' };
  if (monthFirst && dayFirst) return a === b ? { iso: monthFirst } : { error: 'ambiguous' };
  const only = monthFirst ?? dayFirst;
  return only ? { iso: only } : { error: 'not a date' };
}

function isoDate(raw: string, order?: SlashOrder): Slash {
  const s = raw.trim();
  let hit: RegExpMatchArray | null;
  if ((hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/))) {
    const iso = validIso(+hit[1], +hit[2], +hit[3]);
    return iso ? { iso } : { error: 'not a date' };
  }
  if ((hit = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return slashDate(+hit[1], +hit[2], +hit[3], order);
  if ((hit = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/)) && MONTHS[hit[2].toLowerCase()]) {
    const iso = validIso(+hit[3], MONTHS[hit[2].toLowerCase()], +hit[1]);
    return iso ? { iso } : { error: 'not a date' };
  }
  return { error: 'not a date' };
}

/** One value through one cleaning rule. An empty value is never an error here; `required` decides that. */
export function transform(raw: string, t: Transform, order?: SlashOrder): Cell {
  const v = raw ?? '';
  if (t === 'none') return { value: v };
  const trimmed = v.trim();
  if (trimmed === '') return { value: '' };
  switch (t) {
    case 'trim':
      return { value: trimmed };
    case 'collapse_spaces':
      return { value: trimmed.replace(/\s+/g, ' ') };
    case 'lowercase':
      return { value: trimmed.toLowerCase() };
    case 'uppercase':
      return { value: trimmed.toUpperCase() };
    case 'email': {
      const e = trimmed.toLowerCase();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? { value: e } : { value: trimmed, error: 'not an email address' };
    }
    case 'date_iso': {
      const d = isoDate(trimmed, order);
      if ('iso' in d) return { value: d.iso };
      return { value: trimmed, error: d.error === 'ambiguous' ? 'could be day-first or month-first; say which, or use YYYY-MM-DD' : 'not a date' };
    }
    case 'integer': {
      const n = trimmed.replace(/,/g, '');
      return /^-?\d+$/.test(n) ? { value: String(parseInt(n, 10)) } : { value: trimmed, error: 'not a whole number' };
    }
    case 'decimal': {
      const n = trimmed.replace(/,/g, '');
      return /^-?(\d+\.?\d*|\.\d+)$/.test(n) ? { value: String(Number(n)) } : { value: trimmed, error: 'not a number' };
    }
  }
}

export interface Issue {
  /** 1-based data row, as a spreadsheet numbers it after the header. */
  row: number;
  field: string;
  problem: string;
}

export interface Preview {
  headers: string[];
  rows: Record<string, string>[];
  issues: Issue[];
  counts: RunCounts;
  duplicates: number;
  /** Source columns the mapping names that the file does not have. */
  missingColumns: string[];
}

const keyOf = (row: Record<string, string>, keys: readonly string[]) => JSON.stringify(keys.map((k) => row[k] ?? ''));

/**
 * The mapping and cleaning rules over a table, row by row.
 *
 * A row fails when a required field comes out empty, a transform refuses its
 * value, or — under `reject` — it repeats a key already seen. Under
 * `keep_first` and `keep_last` a repeat is dropped instead, counted as a
 * duplicate and not as a failure. A column the mapping names and the file
 * lacks fails every row, because that is what importing it would do.
 *
 * `order` says how the file writes `a/b/yyyy`; without it an ambiguous slash
 * date fails the row (see `slashDate`).
 */
export function preview(table: Table, maps: readonly FieldMap[], rule: DuplicateRule | null, order?: SlashOrder): Preview {
  const index = new Map(table.headers.map((h, i) => [h.trim().toLowerCase(), i]));
  const missingColumns = [...new Set(maps.map((m) => m.source_field).filter((f) => !index.has(f.trim().toLowerCase())))];
  const keys = maps.filter((m) => m.is_key).map((m) => m.target_field);
  const issues: Issue[] = [];
  const mapped: { row: Record<string, string>; ok: boolean; n: number }[] = [];

  table.rows.forEach((cells, i) => {
    const n = i + 1;
    const row: Record<string, string> = {};
    let ok = true;
    for (const m of maps) {
      const at = index.get(m.source_field.trim().toLowerCase());
      if (at === undefined) {
        issues.push({ row: n, field: m.target_field, problem: `column “${m.source_field}” is not in the file` });
        ok = false;
        continue;
      }
      const cell = transform(cells[at] ?? '', m.transform, order);
      row[m.target_field] = cell.value;
      if (cell.error) {
        issues.push({ row: n, field: m.target_field, problem: cell.error });
        ok = false;
      } else if (m.required && cell.value.trim() === '') {
        issues.push({ row: n, field: m.target_field, problem: 'required and empty' });
        ok = false;
      }
    }
    mapped.push({ row, ok, n });
  });

  let duplicates = 0;
  let kept = mapped;
  if (keys.length > 0) {
    const order = rule === 'keep_last' ? [...mapped].reverse() : mapped;
    const seen = new Set<string>();
    const survivors = new Set<(typeof mapped)[number]>();
    for (const m of order) {
      if (!m.ok) {
        survivors.add(m);
        continue;
      }
      const k = keyOf(m.row, keys);
      if (!seen.has(k)) {
        seen.add(k);
        survivors.add(m);
        continue;
      }
      duplicates += 1;
      if (rule === 'reject' || rule === null) {
        m.ok = false;
        issues.push({ row: m.n, field: keys.join(' + '), problem: 'repeats a record already in the file' });
        survivors.add(m);
      }
    }
    kept = mapped.filter((m) => survivors.has(m));
  }
  issues.sort((a, b) => a.row - b.row);

  const failed = kept.filter((m) => !m.ok).length;
  return {
    headers: [...new Set(maps.map((m) => m.target_field))],
    rows: kept.filter((m) => m.ok).map((m) => m.row),
    issues,
    counts: { rows_in: table.rows.length, rows_ok: kept.length - failed, rows_failed: failed, rows_missing: 0, rows_extra: 0, rows_differing: 0 },
    duplicates,
    missingColumns,
  };
}

// ── Reconciliation and parallel run ─────────────────────────────────────────

export interface Difference {
  key: string;
  field: string;
  legacy: string;
  semester: string;
}

export interface Reconciliation {
  counts: RunCounts;
  matched: number;
  missing: string[];
  extra: string[];
  differences: Difference[];
}

/**
 * What the retiring system holds, mapped, against what Semester holds.
 *
 * Records are matched on the key fields. A key in the legacy export and not in
 * Semester's is missing; the other way round is extra; a matched record with
 * any compared field unequal is differing, and each unequal field is listed.
 * The same comparison is a reconciliation once, and a parallel run when it is
 * repeated period after period while the old system stays official.
 */
export function reconcile(legacy: readonly Record<string, string>[], semester: Table, maps: readonly FieldMap[]): Reconciliation {
  const keys = maps.filter((m) => m.is_key).map((m) => m.target_field);
  const fields = [...new Set(maps.map((m) => m.target_field))].filter((f) => !keys.includes(f));
  const col = new Map(semester.headers.map((h, i) => [h.trim().toLowerCase(), i]));
  const theirs = new Map<string, Record<string, string>>();
  for (const cells of semester.rows) {
    const row: Record<string, string> = {};
    for (const f of [...keys, ...fields]) {
      const at = col.get(f.toLowerCase());
      row[f] = at === undefined ? '' : (cells[at] ?? '').trim();
    }
    theirs.set(keyOf(row, keys), row);
  }
  const label = (k: string) => (JSON.parse(k) as string[]).join(' · ');
  const missing: string[] = [];
  const differences: Difference[] = [];
  const differing = new Set<string>();
  const ours = new Set<string>();
  for (const row of legacy) {
    const k = keyOf(row, keys);
    ours.add(k);
    const other = theirs.get(k);
    if (!other) {
      missing.push(label(k));
      continue;
    }
    for (const f of fields) {
      const a = (row[f] ?? '').trim();
      const b = other[f] ?? '';
      if (a !== b) {
        differing.add(k);
        differences.push({ key: label(k), field: f, legacy: a, semester: b });
      }
    }
  }
  const extra = [...theirs.keys()].filter((k) => !ours.has(k)).map(label);
  const matched = legacy.length - missing.length;
  return {
    counts: {
      rows_in: legacy.length,
      rows_ok: matched - differing.size,
      rows_failed: 0,
      rows_missing: missing.length,
      rows_extra: extra.length,
      rows_differing: differing.size,
    },
    matched,
    missing,
    extra,
    differences,
  };
}

// ── Evidence ────────────────────────────────────────────────────────────────

/** The file's fingerprint: which file the counts are about, and nothing in it. */
export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export { parseTable };
