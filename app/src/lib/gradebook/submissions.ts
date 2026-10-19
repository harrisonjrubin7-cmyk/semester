/**
 * Handing in work on a gradebook item, and which hand-in a grade was given on.
 *
 * `supabase/migrations/20261019120000_learning_submissions.sql` is the
 * authority. A hand-in is never changed: handing in again is the next
 * version, and the earlier one keeps its text and its SHA-256. Row-level
 * security decides what `loadSubmissions` returns — a student their own, the
 * course's grade authors the course's — so the same reader serves both sides.
 *
 * Kept apart from `client.ts` on purpose. Until that migration is applied to a
 * school's database there is no `learning_submissions` table and no
 * `grade_entries.submission_id` column, and `loadBook` must not start failing
 * because of it. So nothing here is read inside `loadBook`, and a missing
 * table or column reads as `available: false` — "hand-in is not set up here
 * yet" — rather than as an error that hides the grades.
 */

import { cloud } from '../cloud';
import { serviceError } from '../attempt';
import { formatNumber } from '../locale';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

/** One hand-in. Never edited; a later hand-in is a new one with the next version. */
export interface Submission {
  id: string;
  itemId: string;
  studentId: string;
  version: number;
  body: string;
  /** SHA-256 of the text as handed in, 64 hex digits. */
  contentHash: string;
  at: string;
}

/** What `learning_submit` answers: the receipt a student keeps. */
export interface SubmitReceipt {
  submission: string;
  version: number;
  contentHash: string;
  at: string;
}

export interface LoadedSubmissions {
  /** False when this school's database has no submissions yet (the migration is not applied there). */
  available: boolean;
  submissions: Submission[];
  /** Grade version id → the submission it was given on, for every visible version that names one. */
  graded: Record<string, string>;
}

/** The longest hand-in the server accepts, after trimming. */
export const MAX_SUBMISSION = 200_000;

/**
 * Postgres and PostgREST's ways of saying a table or column is not there:
 * undefined table, undefined column, and the schema-cache misses.
 */
const NOT_SET_UP = new Set(['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205']);

export function notSetUp(error: { code?: unknown } | null | undefined): boolean {
  return typeof error?.code === 'string' && NOT_SET_UP.has(error.code);
}

export function readSubmission(r: Row): Submission {
  return {
    id: text(r.id),
    itemId: text(r.item_id),
    studentId: text(r.student_id),
    version: Number(r.version) || 0,
    body: text(r.body),
    contentHash: text(r.content_hash),
    at: text(r.submitted_at),
  };
}

/** Every hand-in this caller may read on one course and term, oldest first, and which grade version names which. */
export async function loadSubmissions(course: string, term: string): Promise<LoadedSubmissions> {
  const db = await cloud();
  const [subs, links] = await Promise.all([
    db.from('learning_submissions').select('id,item_id,student_id,version,body,content_hash,submitted_at').eq('course_code', course).eq('term', term).order('submitted_at'),
    db.from('grade_entries').select('id,submission_id').eq('course_code', course).eq('term', term),
  ]);
  if (notSetUp(subs.error) || notSetUp(links.error)) return { available: false, submissions: [], graded: {} };
  const failed = subs.error ?? links.error;
  if (failed) throw serviceError(failed, 'Could not load the work handed in.');
  const graded: Record<string, string> = {};
  for (const l of rows(links.data)) {
    if (l.submission_id != null && l.submission_id !== '') graded[text(l.id)] = text(l.submission_id);
  }
  return { available: true, submissions: rows(subs.data).map(readSubmission), graded };
}

/** Hand in `body` on `itemId`. Raises with the server's sentence when refused. */
export async function submitWork(itemId: string, body: string, key: string): Promise<SubmitReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('learning_submit', { want_item: itemId, want_body: body, want_key: key });
  if (error) throw serviceError(error, 'Your work was not handed in.');
  const r = data && typeof data === 'object' ? (data as Row) : {};
  return { submission: text(r.submission), version: Number(r.version) || 0, contentHash: text(r.content_hash), at: text(r.submitted_at) };
}

/** One student's hand-ins on one item, latest first. */
export function handIns(list: readonly Submission[], itemId: string, studentId: string): Submission[] {
  return list.filter((s) => s.itemId === itemId && s.studentId === studentId).sort((a, b) => b.version - a.version);
}

/** Why a hand-in cannot be sent yet, or null when it can. The server checks the same. */
export function handInProblem(body: string): string | null {
  const t = body.trim();
  if (t === '') return 'Write or paste your work first.';
  if (t.length > MAX_SUBMISSION) return `A hand-in is at most ${formatNumber(MAX_SUBMISSION)} characters; this is ${formatNumber(t.length)}.`;
  return null;
}

/** "3f9a…c210": enough of a hash to compare by eye, said the same everywhere. */
export const shortHash = (h: string): string => (h.length > 12 ? `${h.slice(0, 4)}…${h.slice(-4)}` : h);
