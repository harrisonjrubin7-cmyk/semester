/**
 * Assignments and submissions' reads and writes, typed, over the account service.
 *
 * Every function is one RPC or one table, and
 * `supabase/migrations/20261001094000_assignments.sql` is the authority: who
 * may author, who may submit, which mode the school is in, the append-only
 * history, the receipt and idempotency are all decided there. Row-level
 * security decides what a read returns — a course's staff read drafts and
 * every student's work, a student reads the published assignments and only
 * their own submissions — so the same `loadAssignments` serves both halves of
 * the screen and cannot show a student a draft or a classmate's answer.
 *
 * Every writer here *raises* to refuse, like the gradebook's. A refusal
 * arrives as a thrown `ServiceError` carrying the server's sentence
 * (`answered: true`), and a network failure as one with `answered: false`,
 * whose outcome is unknown and whose retry must keep its key
 * (`lib/attempt.ts`). That matters most for a submission: a student whose
 * connection dropped after the server committed and who presses Submit again
 * with the same key gets the same receipt, not a second version.
 *
 * This is not `lib/assignment.ts`, and nothing here reads or writes it.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import { byOffering, gradedCourses, offeringKey, TERM, type Offering } from '../gradebook/client';
import type { Assignment, AssignmentCapability, AssignmentEvent, Draft, Extension, Receipt, Status, Submitted, Version } from './model';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseFloat(text(v)) || 0);
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export { offeringKey, type Offering };

// ── Who is looking, from their grants ────────────────────────────────────

export interface CourseGrant extends Offering {
  capabilities: AssignmentCapability[];
}

const CODE = /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/;
const AUTHORING: readonly string[] = ['assignments:author', 'assignments:review'];

/**
 * The course-terms this person teaches or assists here: a live
 * `assignments:author` or `assignments:review` on `<school>/<CODE>/<TERM>`.
 * A grant with no term, or anything else after the code, is not read as a
 * course — the database authorises nothing on it either.
 */
export function taughtCourses(grants: readonly Grant[], school: string): CourseGrant[] {
  const prefix = `${school}/`;
  const by = new Map<string, CourseGrant>();
  for (const g of grants) {
    if (school === '' || g.scopeKind !== 'course' || !g.scopeId.startsWith(prefix)) continue;
    if (!AUTHORING.includes(g.capability)) continue;
    const parts = g.scopeId.slice(prefix.length).split('/');
    if (parts.length !== 2) continue;
    const [course, term] = parts;
    if (!CODE.test(course) || !TERM.test(term)) continue;
    const key = offeringKey({ course, term });
    const held = by.get(key) ?? { course, term, capabilities: [] };
    if (!held.capabilities.includes(g.capability as AssignmentCapability)) held.capabilities.push(g.capability as AssignmentCapability);
    by.set(key, held);
  }
  return [...by.values()].map((c) => ({ ...c, capabilities: [...c.capabilities].sort() })).sort(byOffering);
}

/** The course-terms this person is on the roster of: the gradebook's own list, because there is one roster. */
export const enrolledCourses = gradedCourses;

// ── Reading one course ───────────────────────────────────────────────────

export interface Loaded {
  course: string;
  term: string;
  assignments: Assignment[];
  extensions: Extension[];
  versions: Version[];
  receipts: Receipt[];
  events: AssignmentEvent[];
}

export function readAssignment(r: Row): Assignment {
  const status = r.status === 'published' || r.status === 'closed' ? (r.status as Status) : 'draft';
  return {
    id: text(r.id),
    course: text(r.course_code),
    term: text(r.term),
    title: text(r.title),
    instructions: text(r.instructions),
    dueAt: text(r.due_at),
    closesAt: maybe(r.closes_at),
    allowResubmission: r.allow_resubmission !== false,
    maxVersions: num(r.max_versions) || 1,
    status,
    createdAt: text(r.created_at),
    publishedAt: maybe(r.published_at),
    closedAt: maybe(r.closed_at),
  };
}

export function readExtension(r: Row): Extension {
  return {
    id: text(r.id),
    assignmentId: text(r.assignment_id),
    studentId: text(r.student_id),
    dueAt: text(r.due_at),
    closesAt: maybe(r.closes_at),
    reason: text(r.reason),
    at: text(r.at),
  };
}

export function readVersion(r: Row): Version {
  return {
    id: text(r.id),
    submissionId: text(r.submission_id),
    assignmentId: text(r.assignment_id),
    studentId: text(r.student_id),
    version: num(r.version),
    body: text(r.body),
    contentSha256: text(r.content_sha256),
    dueAtThen: text(r.due_at_then),
    late: r.late === true,
    submittedAt: text(r.submitted_at),
  };
}

export function readReceipt(r: Row): Receipt {
  return {
    id: text(r.id),
    versionId: text(r.version_id),
    assignmentId: text(r.assignment_id),
    studentId: text(r.student_id),
    code: text(r.receipt_code),
    contentSha256: text(r.content_sha256),
    submittedAt: text(r.submitted_at),
    dueAtThen: text(r.due_at_then),
    late: r.late === true,
  };
}

const EVENT_ACTIONS: readonly AssignmentEvent['action'][] = ['created', 'revised', 'published', 'closed', 'extended'];

export function readEvent(r: Row): AssignmentEvent {
  const action = EVENT_ACTIONS.includes(r.action as AssignmentEvent['action']) ? (r.action as AssignmentEvent['action']) : 'created';
  return { id: text(r.id), assignmentId: text(r.assignment_id), action, actor: maybe(r.actor), at: text(r.at) };
}

/**
 * Everything row-level security lets this caller read about one course and
 * term: the assignments they may see, the extensions, every visible version
 * and receipt, and — for staff — the events. A student's read of `assignments`
 * already excludes drafts, so nothing here filters them out a second time.
 */
export async function loadAssignments(course: string, term: string): Promise<Loaded> {
  const db = await cloud();
  const [assignments, extensions, versions, receipts, events] = await Promise.all([
    db
      .from('assignments')
      .select('id,course_code,term,title,instructions,due_at,closes_at,allow_resubmission,max_versions,status,created_at,published_at,closed_at')
      .eq('course_code', course)
      .eq('term', term)
      .order('due_at'),
    db.from('assignment_extensions').select('id,assignment_id,student_id,due_at,closes_at,reason,at').order('at'),
    db.from('submission_versions').select('id,submission_id,assignment_id,student_id,version,body,content_sha256,due_at_then,late,submitted_at').order('submitted_at'),
    db.from('submission_receipts').select('id,version_id,assignment_id,student_id,receipt_code,content_sha256,submitted_at,due_at_then,late').order('submitted_at'),
    db.from('assignment_events').select('id,assignment_id,action,actor,at').order('at'),
  ]);
  const failed = assignments.error ?? extensions.error ?? versions.error ?? receipts.error ?? events.error;
  if (failed) throw serviceError(failed, 'Could not load these assignments.');
  const list = rows(assignments.data).map(readAssignment);
  // The extension, version, receipt and event reads are not keyed by course in
  // the query, because row-level security already limits them to what this
  // person may read; keeping only this course's rows is what makes one course
  // never show another's.
  const ids = new Set(list.map((a) => a.id));
  return {
    course,
    term,
    assignments: list,
    extensions: rows(extensions.data).map(readExtension).filter((e) => ids.has(e.assignmentId)),
    versions: rows(versions.data).map(readVersion).filter((v) => ids.has(v.assignmentId)),
    receipts: rows(receipts.data).map(readReceipt).filter((r) => ids.has(r.assignmentId)),
    events: rows(events.data).map(readEvent).filter((e) => ids.has(e.assignmentId)),
  };
}

// ── The instructor's writers ─────────────────────────────────────────────

const iso = (v: string | null): string | null => (v ? new Date(v).toISOString() : null);

/** Returns the new assignment's id. It starts as a draft. */
export async function createAssignment(course: string, term: string, d: Draft, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('assignments_create', {
    want_course: course,
    want_term: term,
    want_title: d.title,
    want_instructions: d.instructions,
    want_due: iso(d.dueAt),
    want_closes: iso(d.closesAt),
    want_resubmit: d.allowResubmission,
    want_max_versions: d.maxVersions,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The assignment was not created.');
  return text(data);
}

export async function reviseAssignment(id: string, d: Draft, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assignments_revise', {
    want_assignment: id,
    want_title: d.title,
    want_instructions: d.instructions,
    want_due: iso(d.dueAt),
    want_closes: iso(d.closesAt),
    want_resubmit: d.allowResubmission,
    want_max_versions: d.maxVersions,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The assignment was not changed.');
}

export async function publishAssignment(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assignments_publish', { want_assignment: id, want_key: key });
  if (error) throw serviceError(error, 'The assignment was not published.');
}

export async function closeAssignment(id: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assignments_close', { want_assignment: id, want_key: key });
  if (error) throw serviceError(error, 'The assignment was not closed.');
}

export async function extendAssignment(
  id: string,
  studentId: string,
  dueAt: string,
  closesAt: string | null,
  reason: string,
  key: string,
): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('assignments_extend', {
    want_assignment: id,
    want_student: studentId,
    want_due: iso(dueAt),
    want_closes: iso(closesAt),
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The extension was not granted.');
}

// ── The student's writer ─────────────────────────────────────────────────

/** Submit a version. The answer is the receipt; a replay of the same key answers the same. */
export async function submitWork(assignmentId: string, body: string, key: string): Promise<Submitted> {
  const db = await cloud();
  const { data, error } = await db.rpc('submissions_submit', { want_assignment: assignmentId, want_body: body, want_key: key });
  if (error) throw serviceError(error, 'Your submission was not taken.');
  const r = data && typeof data === 'object' ? (data as Row) : {};
  return { version: num(r.version), receipt: text(r.receipt), submittedAt: text(r.submitted_at), late: r.late === true };
}
