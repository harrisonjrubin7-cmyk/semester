/**
 * The admissions record's reads and writes, typed, over the account service.
 *
 * Every function is one RPC or one table, and
 * `supabase/migrations/20260930270000_admissions_aid.sql` is the authority:
 * who may record and who may decide, which mode the school is in, which steps a
 * status may take, what a correction is, what is refused at the field, and the
 * idempotency are all decided there. Row-level security decides what a read
 * returns: only a holder of `admissions:read` at the school reads an applicant
 * file, and nobody else does, a linked student included.
 *
 * Every writer here *raises* to refuse. A refusal arrives as a thrown
 * `ServiceError` carrying the server's sentence (`answered: true`), and a
 * network failure as one with `answered: false`, whose outcome is unknown and
 * whose retry must keep its key (`lib/attempt.ts`).
 *
 * Nothing here ranks, scores or recommends an applicant, and nothing creates a
 * student: `linkApplicant` records the registrar's link and nothing else.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import type { Applicant, AdmissionsCapability, ApplicantLink, HistoryEntry } from './model';
import { isAdmissionStatus, type AdmissionStatus } from './rules';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const status = (v: unknown): AdmissionStatus => (isAdmissionStatus(v) ? v : 'submitted');

/** The admissions capabilities this person holds on their own school. A grant on anything else is not one. */
export function admissionsCapabilities(grants: readonly Grant[], school: string): AdmissionsCapability[] {
  const held = new Set<string>();
  for (const g of grants) if (school !== '' && g.scopeKind === 'school' && g.scopeId === school) held.add(g.capability);
  return (['admissions:read', 'admissions:record', 'admissions:decide'] as const).filter((c) => held.has(c));
}

export function readApplicant(r: Row): Applicant {
  return {
    id: text(r.id),
    cycle: text(r.cycle),
    applicantRef: text(r.applicant_ref),
    program: text(r.program),
    status: status(r.status),
    statusAt: text(r.status_at),
  };
}

export function readHistory(r: Row): HistoryEntry {
  return {
    id: text(r.id),
    applicantId: text(r.applicant_id),
    seq: Number(r.seq) || 0,
    kind: r.kind === 'correction' ? 'correction' : 'status',
    fromStatus: isAdmissionStatus(r.from_status) ? r.from_status : null,
    toStatus: status(r.to_status),
    correctsSeq: r.corrects_seq == null ? null : Number(r.corrects_seq),
    reason: text(r.reason),
    recordedBy: maybe(r.recorded_by),
    recordedAt: text(r.recorded_at),
  };
}

const APPLICANT_COLUMNS = 'id,cycle,applicant_ref,program,status,status_at';
const HISTORY_COLUMNS = 'id,applicant_id,seq,kind,from_status,to_status,corrects_seq,reason,recorded_by,recorded_at';

/**
 * The applicants this person may read, in the order of the school's own
 * reference. That order says nothing about an applicant: it is the reference
 * alphabetically, chosen so no order can be read as a ranking.
 */
export async function loadApplicants(cycle?: string): Promise<Applicant[]> {
  const db = await cloud();
  let q = db.from('admissions_applicants').select(APPLICANT_COLUMNS);
  if (cycle) q = q.eq('cycle', cycle);
  const { data, error } = await q.order('cycle').order('applicant_ref').limit(500);
  if (error) throw serviceError(error, 'Could not load the applicants.');
  return rows(data).map(readApplicant);
}

export async function loadHistory(applicantId: string): Promise<HistoryEntry[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('admissions_status_history')
    .select(HISTORY_COLUMNS)
    .eq('applicant_id', applicantId)
    .order('seq', { ascending: true });
  if (error) throw serviceError(error, 'Could not load the status history.');
  return rows(data).map(readHistory);
}

export async function loadLinks(): Promise<ApplicantLink[]> {
  const db = await cloud();
  const { data, error } = await db.from('admissions_applicant_links').select('applicant_id,student_ref,linked_at').limit(500);
  if (error) throw serviceError(error, 'Could not load the links to student references.');
  return rows(data).map((r) => ({ applicantId: text(r.applicant_id), studentRef: text(r.student_ref), linkedAt: text(r.linked_at) }));
}

// ── Writing ──────────────────────────────────────────────────────────────

/** Adds an applicant, as submitted. Returns the new applicant's id. */
export async function addApplicant(cycle: string, applicantRef: string, program: string, reason: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('admissions_applicant_add', {
    want_cycle: cycle,
    want_ref: applicantRef,
    want_program: program,
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The applicant was not added.');
  return text(data);
}

/** Records the next status of an application. A decision needs `admissions:decide`; the database says so. */
export async function recordStatus(applicantId: string, to: AdmissionStatus, reason: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('admissions_status_record', {
    want_applicant: applicantId,
    want_to: to,
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The status was not recorded.');
  return text(data);
}

/** The one way back: an entry that names the entry it corrects. Needs `admissions:decide`. */
export async function correctStatus(applicantId: string, to: AdmissionStatus, corrects: number, reason: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('admissions_status_correct', {
    want_applicant: applicantId,
    want_to: to,
    want_corrects: corrects,
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The correction was not recorded.');
  return text(data);
}

/** The registrar's link from an admitted applicant to a student reference. Creates no student and no account. */
export async function linkApplicant(applicantId: string, studentRef: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('admissions_applicant_link', {
    want_applicant: applicantId,
    want_student_ref: studentRef,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The applicant was not linked.');
  return text(data);
}
