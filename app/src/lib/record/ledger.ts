/**
 * The academic-record ledger: a school's record of each student's enrollment,
 * grades, credits, requirements, transfer credit, standing and degree
 * conferral, kept the way a financial ledger is kept.
 *
 * The brief of 29 September (`docs/expansion/Replaceability-Migration-
 * Continuity-and-Confidence.pdf`, "registrar-grade architecture") asks for
 * append-only history, effective dates, a correction and an approval
 * workflow, versioning, a reason for every change, registrar override
 * controls, separation of duties, a record for export, and audit-ready
 * history — and says every academic change should answer eight questions.
 * `EIGHT` is those questions, and `explain` answers them for any entry.
 *
 * ## How the ledger is kept
 *
 * Nobody writes to the ledger. A change is *proposed* — with a reason, an
 * effective date and the workflow it came from — and when someone other than
 * its proposer approves it, the database writes one entry, capturing the
 * value it replaces. A correction is a new entry; a reversal is a `void`
 * entry; nothing is edited or deleted. Correcting a posted grade, standing or
 * conferral is a registrar override, and only an approver holding
 * `record:override` can approve one. The database decides that, not the
 * client: `20260929210000_academic_record_ledger.sql`.
 *
 * ## What it is not
 *
 * An official transcript. `asOf` folds the ledger into the record as it stood
 * on a date, and `toCsv` exports it; issuing a transcript or a credential is
 * a regulated act this repository does not perform. The screen and the export
 * both say so.
 *
 * `ledger.test.ts` holds every vocabulary here to the migration word for word.
 */

export const KINDS = ['enrollment', 'grade', 'credit', 'requirement', 'transfer_credit', 'standing', 'conferral'] as const;
export type RecordKind = (typeof KINDS)[number];

export const KIND_LABEL: Record<RecordKind, string> = {
  enrollment: 'Enrollment',
  grade: 'Grade',
  credit: 'Credit',
  requirement: 'Requirement',
  transfer_credit: 'Transfer credit',
  standing: 'Academic standing',
  conferral: 'Degree conferral',
};

/** What the key names, for each kind, as the form asks for it. */
export const KEY_HINT: Record<RecordKind, string> = {
  enrollment: 'Course and term, e.g. PSCI 2100 · Fall 2026',
  grade: 'Course and term, e.g. PSCI 2100 · Fall 2026',
  credit: 'Course and term, e.g. PSCI 2100 · Fall 2026',
  requirement: 'The requirement, e.g. Writing-intensive',
  transfer_credit: 'The incoming course, e.g. ECON 101 · Nashville State',
  standing: 'The term, e.g. Fall 2026',
  conferral: 'The degree, e.g. B.A. Economics',
};

/** The kinds whose correction or reversal is a registrar override. */
export const OVERRIDE_KINDS: readonly RecordKind[] = ['grade', 'standing', 'conferral'];

export const SOURCES = ['registrar', 'faculty', 'sis_import', 'migration', 'transfer_evaluation', 'appeal'] as const;
export type RecordSource = (typeof SOURCES)[number];

export const SOURCE_LABEL: Record<RecordSource, string> = {
  registrar: 'Registrar',
  faculty: 'Faculty grade submission',
  sis_import: 'Import from the student information system',
  migration: 'A migration (Migration Center)',
  transfer_evaluation: 'Transfer evaluation',
  appeal: 'Appeal or grade review',
};

export const ACTIONS = ['set', 'void'] as const;
export type RecordAction = (typeof ACTIONS)[number];

export const CHANGE_STATUSES = ['proposed', 'approved', 'rejected', 'withdrawn'] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

/** The school's identifier for a student, as the migration's check constraint allows it. */
export const STUDENT_REF = /^[A-Za-z0-9._-]{1,64}$/;
/** A reason long enough to be a reason. */
export const MIN_REASON = 10;

export interface RecordChange {
  id: string;
  tenant_id: string;
  student_ref: string;
  kind: RecordKind;
  subject_key: string;
  action: RecordAction;
  value: string;
  effective_on: string;
  reason: string;
  source: RecordSource;
  status: ChangeStatus;
  proposed_by: string | null;
  proposed_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
}

export interface LedgerEntry {
  id: string;
  tenant_id: string;
  student_ref: string;
  kind: RecordKind;
  subject_key: string;
  action: RecordAction;
  value: string;
  previous_value: string | null;
  previous_entry_id: string | null;
  effective_on: string;
  reason: string;
  source: RecordSource;
  change_id: string;
  proposed_by: string | null;
  approved_by: string | null;
  override: boolean;
  recorded_at: string;
}

const keyOf = (e: Pick<LedgerEntry, 'kind' | 'subject_key'>) => `${e.kind}\u0000${e.subject_key}`;

/** Effective date first, then when it was recorded, then id: the one order the database also uses. */
export function ledgerOrder(a: LedgerEntry, b: LedgerEntry): number {
  if (a.effective_on !== b.effective_on) return a.effective_on < b.effective_on ? -1 : 1;
  if (a.recorded_at !== b.recorded_at) return a.recorded_at < b.recorded_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The entry a new one at `effective_on` would replace: the latest in effect on that date. */
export function inEffect(entries: readonly LedgerEntry[], kind: RecordKind, subjectKey: string, on: string): LedgerEntry | null {
  const same = entries.filter((e) => e.kind === kind && e.subject_key === subjectKey && e.effective_on <= on).sort(ledgerOrder);
  return same.length ? same[same.length - 1] : null;
}

/** Whether approving this change would be a registrar override, by the database's rule. */
export function isOverride(entries: readonly LedgerEntry[], c: Pick<RecordChange, 'kind' | 'subject_key' | 'effective_on'>): boolean {
  if (!OVERRIDE_KINDS.includes(c.kind)) return false;
  return entries.some((e) => e.kind === c.kind && e.subject_key === c.subject_key && e.effective_on <= c.effective_on);
}

export interface RecordLine {
  kind: RecordKind;
  subject_key: string;
  value: string;
  effective_on: string;
  entry: LedgerEntry;
  /** How many entries this key has had up to the date, this one included. */
  versions: number;
}

/**
 * The record as it stood on a date: for each key, the latest entry in effect
 * then, unless that entry voided it. Later corrections to an earlier date
 * are included once they were in effect on `on` — the ledger answers "what
 * was effective then", which is what a registrar asks.
 */
export function asOf(entries: readonly LedgerEntry[], on: string): RecordLine[] {
  const byKey = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    if (e.effective_on > on) continue;
    const k = keyOf(e);
    byKey.set(k, [...(byKey.get(k) ?? []), e]);
  }
  const out: RecordLine[] = [];
  for (const list of byKey.values()) {
    list.sort(ledgerOrder);
    const last = list[list.length - 1];
    if (last.action === 'void') continue;
    out.push({ kind: last.kind, subject_key: last.subject_key, value: last.value, effective_on: last.effective_on, entry: last, versions: list.length });
  }
  return out.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || a.subject_key.localeCompare(b.subject_key));
}

/** Every entry for one key, oldest first: the key's whole history, which nothing ever shortens. */
export function history(entries: readonly LedgerEntry[], kind: RecordKind, subjectKey: string): LedgerEntry[] {
  return entries.filter((e) => e.kind === kind && e.subject_key === subjectKey).sort(ledgerOrder);
}

/** The brief's eight questions, in its order. */
export const EIGHT = [
  'Who changed it?',
  'What changed?',
  'Why did it change?',
  'Who approved it?',
  'When did it become effective?',
  'What was the previous value?',
  'Which workflow or source caused it?',
  'Can it be corrected without deleting history?',
] as const;

/** Each question answered for one entry. `name` turns an account id into what the reader may see. */
export function explain(e: LedgerEntry, name: (id: string | null) => string): readonly [string, string][] {
  const what = e.action === 'void'
    ? `${KIND_LABEL[e.kind]}, ${e.subject_key}: removed from the record`
    : `${KIND_LABEL[e.kind]}, ${e.subject_key}: ${e.value}`;
  return [
    [EIGHT[0], name(e.proposed_by)],
    [EIGHT[1], what],
    [EIGHT[2], e.reason],
    [EIGHT[3], `${name(e.approved_by)}${e.override ? ', as a registrar override' : ''}`],
    [EIGHT[4], e.effective_on],
    [EIGHT[5], e.previous_value === null ? 'None — this was the first entry' : e.previous_value === '' ? 'Nothing: it had been removed' : e.previous_value],
    [EIGHT[6], `${SOURCE_LABEL[e.source]} (change ${e.change_id.slice(0, 8)})`],
    [EIGHT[7], 'Yes. A correction is a new entry; this one stays in the history.'],
  ];
}

// ── Validation, mirroring the constraints ───────────────────────────────────

export interface Proposal {
  student_ref: string;
  kind: RecordKind;
  subject_key: string;
  action: RecordAction;
  value: string;
  effective_on: string;
  reason: string;
  source: RecordSource;
}

/** What is wrong with a proposal before the database is asked, in the words the form shows. */
export function proposalProblems(p: Proposal, entries: readonly LedgerEntry[]): string[] {
  const out: string[] = [];
  if (!STUDENT_REF.test(p.student_ref)) out.push('The student identifier is letters, digits, dots, dashes or underscores.');
  const key = p.subject_key.trim();
  if (key.length < 1 || key.length > 120) out.push('Say what the entry is about, in 120 characters or fewer.');
  if (p.action === 'set' && (p.value.trim().length < 1 || p.value.length > 200)) out.push('Give the value, in 200 characters or fewer.');
  if (p.action === 'void' && p.value !== '') out.push('A removal carries no value.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effective_on)) out.push('Give the date it takes effect.');
  if (p.reason.trim().length < MIN_REASON) out.push(`Give the reason, in at least ${MIN_REASON} characters.`);
  if (p.action === 'void' && !inEffect(entries, p.kind, key, p.effective_on)) out.push('There is nothing in effect on that date to remove.');
  return out;
}

// ── Export ──────────────────────────────────────────────────────────────────

const csvCell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/**
 * The record on a date as CSV, with its own heading line saying what it is
 * and what it is not. Every value is the school's; nothing here is computed.
 */
export function toCsv(studentRef: string, on: string, lines: readonly RecordLine[]): string {
  const rows = [
    ['Record of', studentRef, 'as of', on, 'Not an official transcript'],
    ['kind', 'about', 'value', 'effective', 'entry', 'versions'],
    ...lines.map((l) => [KIND_LABEL[l.kind], l.subject_key, l.value, l.effective_on, l.entry.id, String(l.versions)]),
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
