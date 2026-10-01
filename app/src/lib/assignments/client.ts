/**
 * Assignments and submissions, typed, over the account service.
 *
 * `supabase/migrations/20261001010000_assignments.sql` is the authority: who
 * authors, extends, submits and reads, the server's clock on each attempt,
 * the late rules, the attempt limit, receipts and idempotency are all decided
 * there, and only while the school runs `lms_assignments` in Core
 * (`lib/modulemode.ts`). This file asks. Every writer raises to refuse, so a
 * refusal arrives as a thrown `ServiceError` carrying the server's sentence.
 *
 * It is not `screens/Work.tsx`, a student's own list of what is due, and
 * nothing here reads or writes it.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import { formatDateTime } from '../locale';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export const BUCKET = 'assignment-submissions';

/** The size and types the database and the bucket accept. */
export const MAX_FILE_BYTES = 26214400;
export const MAX_FILES = 10;
export const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'text/plain': 'Text',
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
};

export interface Offering {
  course: string;
  term: string;
}

const CODE = /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/;
const TERM = /^[0-9]{4}(FA|SP|SU)$/;
export const offeringKey = (o: Offering): string => `${o.course}|${o.term}`;

/**
 * The courses this person authors assignments for and the ones they hand work
 * in to, each held over exactly `<school>/<CODE>/<TERM>`. A grant with no
 * term is not read: the database authorises nothing for it.
 */
export function assignmentOfferings(grants: readonly Grant[], school: string): { teaching: Offering[]; taking: Offering[] } {
  const teaching = new Map<string, Offering>();
  const taking = new Map<string, Offering>();
  const prefix = `${school}/`;
  for (const g of grants) {
    if (school === '' || g.scopeKind !== 'course' || !g.scopeId.startsWith(prefix)) continue;
    const parts = g.scopeId.slice(prefix.length).split('/');
    if (parts.length !== 2 || !CODE.test(parts[0]) || !TERM.test(parts[1])) continue;
    const o = { course: parts[0], term: parts[1] };
    if (g.capability === 'assignments:author') teaching.set(offeringKey(o), o);
    if (g.capability === 'assignments:submit') taking.set(offeringKey(o), o);
  }
  const by = (a: Offering, b: Offering) => (a.term === b.term ? a.course.localeCompare(b.course) : b.term.localeCompare(a.term));
  return { teaching: [...teaching.values()].sort(by), taking: [...taking.values()].sort(by) };
}

// ── Reading ─────────────────────────────────────────────────────────────

export type AssignmentStatus = 'draft' | 'published' | 'closed';

export interface Assignment {
  id: string;
  title: string;
  instructions: string;
  points: number | null;
  dueAt: string;
  latePolicy: 'refuse' | 'accept';
  lateUntil: string | null;
  attempts: number;
  status: AssignmentStatus;
}

export function readAssignment(r: Row): Assignment {
  return {
    id: text(r.id),
    title: text(r.title),
    instructions: text(r.instructions),
    points: r.points_possible == null ? null : Number(r.points_possible),
    dueAt: text(r.due_at),
    latePolicy: r.late_policy === 'accept' ? 'accept' : 'refuse',
    lateUntil: maybe(r.late_until),
    attempts: Number(r.attempts_allowed) || 1,
    status: r.status === 'published' || r.status === 'closed' ? r.status : 'draft',
  };
}

export async function loadAssignments(school: string, course: string, term: string): Promise<Assignment[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('assignments')
    .select('id,title,instructions,points_possible,due_at,late_policy,late_until,attempts_allowed,status')
    .eq('tenant_id', school)
    .eq('course_code', course)
    .eq('term', term)
    .order('due_at', { ascending: true });
  if (error) throw serviceError(error, 'The assignments could not be read.');
  return rows(data).map(readAssignment);
}

/** The school's timezone, so a due date is shown the way the school keeps it. 'UTC' when it cannot be read. */
export async function loadTimezone(school: string): Promise<string> {
  try {
    const db = await cloud();
    const { data } = await db.from('schools').select('timezone').eq('id', school).maybeSingle();
    return typeof data?.timezone === 'string' && data.timezone ? data.timezone : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** A moment, in the school's timezone. */
export function when(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return formatDateTime(d, { dateStyle: 'medium', timeStyle: 'short', timeZone });
  } catch {
    return d.toISOString();
  }
}

export interface Attempt {
  id: string;
  assignmentId: string;
  attempt: number;
  submittedAt: string;
  late: boolean;
  body: string;
  receiptHash: string;
  statement: string;
  files: number;
}

/** The caller's own attempts. Row-level security returns no one else's. */
export async function loadMyAttempts(assignmentIds: readonly string[]): Promise<Attempt[]> {
  if (assignmentIds.length === 0) return [];
  const db = await cloud();
  const { data, error } = await db
    .from('submissions')
    .select('id,assignment_id,attempt,submitted_at,late,body,submission_receipts(receipt_hash,statement),submission_files(id)')
    .in('assignment_id', [...assignmentIds])
    .order('attempt', { ascending: true });
  if (error) throw serviceError(error, 'Your submissions could not be read.');
  return rows(data).map((r) => {
    const receipt = (Array.isArray(r.submission_receipts) ? r.submission_receipts[0] : r.submission_receipts) as Row | undefined;
    return {
      id: text(r.id),
      assignmentId: text(r.assignment_id),
      attempt: Number(r.attempt) || 1,
      submittedAt: text(r.submitted_at),
      late: r.late === true,
      body: text(r.body),
      receiptHash: text(receipt?.receipt_hash),
      statement: receipt?.statement ? JSON.stringify(receipt.statement) : '',
      files: Array.isArray(r.submission_files) ? r.submission_files.length : 0,
    };
  });
}

/** The caller's own extensions, latest first. */
export async function loadMyExtensions(assignmentIds: readonly string[], me: string): Promise<Map<string, { dueAt: string; lateUntil: string | null; reason: string }>> {
  const out = new Map<string, { dueAt: string; lateUntil: string | null; reason: string }>();
  if (assignmentIds.length === 0) return out;
  const db = await cloud();
  const { data, error } = await db
    .from('assignment_overrides')
    .select('assignment_id,due_at,late_until,reason,created_at')
    .eq('student_id', me)
    .in('assignment_id', [...assignmentIds])
    .order('created_at', { ascending: false });
  if (error) throw serviceError(error, 'Your extensions could not be read.');
  for (const r of rows(data)) {
    const id = text(r.assignment_id);
    if (!out.has(id)) out.set(id, { dueAt: text(r.due_at), lateUntil: maybe(r.late_until), reason: text(r.reason) });
  }
  return out;
}

// ── The student's side of the rules, said before a call ─────────────────

/**
 * Whether work handed in now would be accepted, by the rule the database
 * applies. The database decides; this only says so before the press.
 */
export function openness(a: Assignment, ext: { dueAt: string; lateUntil: string | null } | undefined, used: number, now: Date): { ok: boolean; late: boolean; why: string } {
  if (a.status !== 'published') return { ok: false, late: false, why: a.status === 'closed' ? 'This assignment is closed.' : 'This assignment is not open yet.' };
  if (used >= a.attempts) return { ok: false, late: false, why: `You have used all ${a.attempts} attempt${a.attempts === 1 ? '' : 's'}.` };
  const due = new Date(ext?.dueAt ?? a.dueAt);
  let until = ext?.lateUntil ?? a.lateUntil;
  if (until && new Date(until) < due) until = due.toISOString();
  if (now <= due) return { ok: true, late: false, why: '' };
  if (a.latePolicy === 'refuse') return { ok: false, late: true, why: 'It was due, and this assignment takes no late work.' };
  if (until && now > new Date(until)) return { ok: false, late: true, why: 'It is past the last time late work was taken.' };
  return { ok: true, late: true, why: 'It was due: work handed in now is marked late.' };
}

// ── Writing ─────────────────────────────────────────────────────────────

export interface NewAssignment {
  title: string;
  instructions: string;
  points: number | null;
  dueAt: string;
  latePolicy: 'refuse' | 'accept';
  lateUntil: string | null;
  attempts: number;
}

export async function createAssignment(course: string, term: string, a: NewAssignment, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('assignment_create', {
    want_course: course, want_term: term, want_title: a.title, want_instructions: a.instructions,
    want_points: a.points, want_due: a.dueAt, want_late_policy: a.latePolicy, want_late_until: a.lateUntil,
    want_attempts: a.attempts, want_key: key,
  });
  if (error) throw serviceError(error, 'The assignment was not created.');
  return text(data);
}

export async function publishAssignment(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assignment_publish', { want_id: id, want_key: key });
  if (error) throw serviceError(error, 'The assignment was not published.');
}

export async function closeAssignment(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assignment_close', { want_id: id, want_key: key });
  if (error) throw serviceError(error, 'The assignment was not closed.');
}

export async function extendAssignment(id: string, student: string, dueAt: string, lateUntil: string | null, reason: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assignment_extend', {
    want_id: id, want_student: student, want_due: dueAt, want_until: lateUntil, want_reason: reason, want_key: key,
  });
  if (error) throw serviceError(error, 'The extension was not granted.');
}

export interface UploadedFile {
  path: string;
  name: string;
  size: number;
  content_type: string;
  sha256: string;
}

/** SHA-256 of a file's bytes, hex. */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Why a file cannot be handed in, or null. The database and the bucket say the same. */
export function fileProblem(f: { name: string; size: number; type: string }): string | null {
  if (f.size < 1) return `${f.name} is empty.`;
  if (f.size > MAX_FILE_BYTES) return `${f.name} is larger than ${MAX_FILE_BYTES / 1048576} MB.`;
  if (!(f.type in FILE_TYPES)) return `${f.name} is not a type this accepts (PDF, PNG, JPEG, text, CSV, Word, Excel or PowerPoint).`;
  return null;
}

/** Uploads to the caller's own folder of the assignment. The path is the rule; Storage refuses any other. */
export async function uploadFile(school: string, assignment: string, me: string, file: File): Promise<UploadedFile> {
  const problem = fileProblem(file);
  if (problem) throw new Error(problem);
  const bytes = await file.arrayBuffer();
  const sha = await sha256Hex(bytes);
  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'file';
  const path = `${school}/${assignment}/${me}/${sha.slice(0, 12)}-${safe}`;
  const db = await cloud();
  const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`${file.name} was not uploaded: ${error.message}`);
  return { path, name: file.name, size: file.size, content_type: file.type, sha256: sha };
}

export interface Receipt {
  submissionId: string;
  attempt: number;
  late: boolean;
  submittedAt: string;
  receiptHash: string;
}

export async function submitAssignment(id: string, body: string, files: readonly UploadedFile[], key: string): Promise<Receipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('assignment_submit', { want_id: id, want_body: body, want_files: [...files], want_key: key });
  if (error) throw serviceError(error, 'Your work was not handed in.');
  const r = (data ?? {}) as Row;
  return { submissionId: text(r.submission_id), attempt: Number(r.attempt) || 1, late: r.late === true, submittedAt: text(r.submitted_at), receiptHash: text(r.receipt_hash) };
}

/** The receipt as a text file a student can keep. */
export function receiptText(title: string, course: string, term: string, r: { attempt: number; submittedAt: string; late: boolean; receiptHash: string }): string {
  return [
    'Semester submission receipt',
    `Assignment: ${title} (${course}, ${term})`,
    `Attempt: ${r.attempt}`,
    `Received by the server at: ${r.submittedAt}`,
    `Marked late: ${r.late ? 'yes' : 'no'}`,
    `Receipt hash (SHA-256): ${r.receiptHash}`,
    '',
    'This receipt shows what was received and when. It is not a grade.',
  ].join('\n');
}
