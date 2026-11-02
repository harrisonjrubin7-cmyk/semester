/**
 * A student's requests to a course's instructor — an extension, an excused
 * absence, an incomplete — and the instructor's decisions.
 *
 * `supabase/migrations/20261021120000_course_requests.sql` is the authority:
 * who may ask (`course_requests:create`), who decides (`:decide`, faculty)
 * and who only reads (`:view`, teaching assistants), the one request waiting
 * per kind and item, the closed states, and the version every change after
 * filing must name. Row-level security decides what `loadRequests` returns —
 * a student their own, the course's instructors the course's — so the same
 * reader serves both sides.
 *
 * Like `submissions.ts`, kept apart from `client.ts`: until the migration is
 * applied at a school there is no table and no function, and the gradebook
 * must not start failing because of it. A missing table, column or function
 * reads as `available: false` — "not set up here yet" — not as an error.
 *
 * This is not `lib/mail.ts`'s extension email, which drafts a message on the
 * student's own device and records nothing.
 */

import { cloud } from '../cloud';
import { serviceError, ServiceError } from '../attempt';
import { formatDate, formatNumber } from '../locale';
import { localDay } from '../datefield';
import type { Grant } from '../capabilities';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export const KINDS = ['extension', 'excused_absence', 'incomplete'] as const;
export type RequestKind = (typeof KINDS)[number];
export type RequestStatus = 'open' | 'info_requested' | 'approved' | 'denied' | 'withdrawn';
export type Outcome = 'approve' | 'deny' | 'ask';

/** The words for each kind, said the same on both sides. */
export const KIND_SAID: Record<RequestKind, string> = {
  extension: 'Extension',
  excused_absence: 'Excused absence',
  incomplete: 'Incomplete',
};

/** Each status in words, so colour is never the only signal. */
export const STATUS_SAID: Record<RequestStatus, string> = {
  open: 'Waiting for the instructor',
  info_requested: 'The instructor asked a question',
  approved: 'Approved',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

export interface CourseRequest {
  id: string;
  studentId: string;
  course: string;
  term: string;
  kind: RequestKind;
  reason: string;
  itemId: string | null;
  /** `YYYY-MM-DD`; only on an extension. */
  requestedDue: string | null;
  status: RequestStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  /** `YYYY-MM-DD`; only on an approved extension, and may differ from the date asked. */
  grantedDue: string | null;
  decisionNote: string;
  version: number;
  filedAt: string;
  updatedAt: string;
}

export interface RequestAction {
  id: string;
  requestId: string;
  actor: string | null;
  action: 'filed' | 'withdrawn' | 'info_requested' | 'responded' | 'approved' | 'denied';
  note: string;
  version: number;
  at: string;
}

export interface LoadedRequests {
  /** False when this school's database has no course requests yet (the migration is not applied there). */
  available: boolean;
  requests: CourseRequest[];
  actions: RequestAction[];
  /** The course's graded items this caller can read, for naming one on a request. */
  items: { id: string; title: string }[];
}

/** What every writer answers. */
export interface RequestReceipt {
  request: string;
  status: RequestStatus;
  version: number;
  grantedDue: string | null;
  at: string;
}

/** The longest reason or note the server accepts, after trimming. */
export const MAX_NOTE = 2000;

/**
 * Postgres and PostgREST's ways of saying a table, column or function is not
 * there: undefined table, undefined function, undefined column, and the
 * schema-cache misses for a relationship, a function and a table.
 */
const NOT_SET_UP = new Set(['42P01', '42883', '42703', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']);

export function notSetUp(error: { code?: unknown } | null | undefined): boolean {
  return typeof error?.code === 'string' && NOT_SET_UP.has(error.code);
}

export const NOT_SET_UP_SAID = 'Asking your instructor through Semester is not set up at your school yet.';

/**
 * The request moved since this caller read it — a colleague decided it, or
 * the student withdrew or answered. The server wrote nothing (SQLSTATE
 * 40001). Answered, so the attempt is settled; the way on is to reload.
 */
export class StaleRequest extends ServiceError {
  constructor(message: string) {
    super(message, true);
    this.name = 'StaleRequest';
  }
}

/** Every writer's failure, sorted: not set up, stale, or the server's own sentence. */
function refusal(error: { code?: string; message?: string } | null, fallback: string): ServiceError {
  if (notSetUp(error)) return new ServiceError(NOT_SET_UP_SAID, true);
  const e = serviceError(error, fallback);
  return error?.code === '40001' ? new StaleRequest(e.message) : e;
}

const isKind = (v: unknown): v is RequestKind => (KINDS as readonly unknown[]).includes(v);
const STATUSES: readonly RequestStatus[] = ['open', 'info_requested', 'approved', 'denied', 'withdrawn'];
const isStatus = (v: unknown): v is RequestStatus => (STATUSES as readonly unknown[]).includes(v);

export function readRequest(r: Row): CourseRequest {
  return {
    id: text(r.id),
    studentId: text(r.student_id),
    course: text(r.course_code),
    term: text(r.term),
    kind: isKind(r.kind) ? r.kind : 'extension',
    reason: text(r.reason),
    itemId: maybe(r.item_id),
    requestedDue: maybe(r.requested_due),
    status: isStatus(r.status) ? r.status : 'open',
    decidedBy: maybe(r.decided_by),
    decidedAt: maybe(r.decided_at),
    grantedDue: maybe(r.granted_due),
    decisionNote: text(r.decision_note),
    version: Number(r.version) || 0,
    filedAt: text(r.filed_at),
    updatedAt: text(r.updated_at),
  };
}

export function readAction(r: Row): RequestAction {
  return {
    id: text(r.id),
    requestId: text(r.request_id),
    actor: maybe(r.actor),
    action: text(r.action) as RequestAction['action'],
    note: text(r.note),
    version: Number(r.version) || 0,
    at: text(r.at),
  };
}

function readReceipt(data: unknown): RequestReceipt {
  const r = data && typeof data === 'object' ? (data as Row) : {};
  return {
    request: text(r.request),
    status: isStatus(r.status) ? r.status : 'open',
    version: Number(r.version) || 0,
    grantedDue: maybe(r.granted_due),
    at: text(r.at),
  };
}

/** Every request this caller may read on one course and term, newest first, with their history and the course's items. */
export async function loadRequests(course: string, term: string): Promise<LoadedRequests> {
  const db = await cloud();
  const [reqs, items] = await Promise.all([
    db
      .from('course_requests')
      .select('id,student_id,course_code,term,kind,reason,item_id,requested_due,status,decided_by,decided_at,granted_due,decision_note,version,filed_at,updated_at')
      .eq('course_code', course)
      .eq('term', term)
      .order('filed_at', { ascending: false }),
    db.from('gradebook_items').select('id,title').eq('course_code', course).eq('term', term).order('created_at'),
  ]);
  if (notSetUp(reqs.error)) return { available: false, requests: [], actions: [], items: [] };
  if (reqs.error) throw serviceError(reqs.error, 'Could not load the requests.');
  if (items.error && !notSetUp(items.error)) throw serviceError(items.error, 'Could not load the course’s assignments.');
  const requests = rows(reqs.data).map(readRequest);
  let actions: RequestAction[] = [];
  if (requests.length > 0) {
    const acts = await db
      .from('course_request_actions')
      .select('id,request_id,actor,action,note,version,at')
      .in('request_id', requests.map((r) => r.id))
      .order('version');
    if (notSetUp(acts.error)) return { available: false, requests: [], actions: [], items: [] };
    if (acts.error) throw serviceError(acts.error, 'Could not load the requests’ history.');
    actions = rows(acts.data).map(readAction);
  }
  return {
    available: true,
    requests,
    actions,
    items: rows(items.data).map((i) => ({ id: text(i.id), title: text(i.title) })),
  };
}

export interface NewRequest {
  course: string;
  term: string;
  kind: RequestKind;
  itemId: string | null;
  requestedDue: string | null;
  reason: string;
}

export async function fileRequest(input: NewRequest, key: string): Promise<RequestReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('course_request_file', {
    want_course: input.course,
    want_term: input.term,
    want_kind: input.kind,
    want_item: input.itemId,
    want_requested_due: input.kind === 'extension' ? input.requestedDue : null,
    want_reason: input.reason,
    want_key: key,
  });
  if (error) throw refusal(error, 'Your request was not sent.');
  return readReceipt(data);
}

export async function withdrawRequest(requestId: string, expect: number, key: string): Promise<RequestReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('course_request_withdraw', { want_request: requestId, want_expect: expect, want_key: key });
  if (error) throw refusal(error, 'Your request was not withdrawn.');
  return readReceipt(data);
}

export async function respondToRequest(requestId: string, note: string, expect: number, key: string): Promise<RequestReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('course_request_respond', { want_request: requestId, want_note: note, want_expect: expect, want_key: key });
  if (error) throw refusal(error, 'Your answer was not sent.');
  return readReceipt(data);
}

export interface Decision {
  requestId: string;
  outcome: Outcome;
  grantedDue: string | null;
  note: string;
  expect: number;
}

export async function decideRequest(d: Decision, key: string): Promise<RequestReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('course_request_decide', {
    want_request: d.requestId,
    want_outcome: d.outcome,
    want_granted_due: d.outcome === 'approve' ? d.grantedDue : null,
    want_note: d.note,
    want_expect: d.expect,
    want_key: key,
  });
  if (error) throw refusal(error, 'The decision was not saved.');
  return readReceipt(data);
}

// ── Who may do what, from the caller's own grants ──────────────────────────

export interface RequestCaps {
  create: boolean;
  decide: boolean;
  view: boolean;
}

/** What this person may do with requests on one course and term, from grants at exactly `<school>/<CODE>/<TERM>`. */
export function requestCaps(grants: readonly Grant[], school: string, course: string, term: string): RequestCaps {
  const scope = `${school}/${course}/${term}`;
  const held = new Set(grants.filter((g) => g.scopeKind === 'course' && g.scopeId === scope).map((g) => g.capability));
  return {
    create: held.has('course_requests:create'),
    decide: held.has('course_requests:decide'),
    view: held.has('course_requests:view') || held.has('course_requests:decide'),
  };
}

// ── What the screen checks before a call. The server checks the same. ──────

export const inProgress = (s: RequestStatus): boolean => s === 'open' || s === 'info_requested';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Why a request cannot be sent yet, or null when it can. */
export function fileProblem(input: Pick<NewRequest, 'kind' | 'requestedDue' | 'reason'>): string | null {
  const t = input.reason.trim();
  if (input.kind === 'extension' && !(input.requestedDue && DATE.test(input.requestedDue))) return 'Choose the date you are asking for.';
  if (t === '') return 'Say why you are asking.';
  if (t.length > MAX_NOTE) return `A reason is at most ${formatNumber(MAX_NOTE)} characters; this is ${formatNumber(t.length)}.`;
  return null;
}

/** Why a decision cannot be saved yet, or null when it can. */
export function decideProblem(kind: RequestKind, d: Pick<Decision, 'outcome' | 'grantedDue' | 'note'>): string | null {
  const t = d.note.trim();
  if (d.outcome === 'approve' && kind === 'extension' && !(d.grantedDue && DATE.test(d.grantedDue))) return 'Choose the new date you are granting.';
  if ((d.outcome === 'deny' || d.outcome === 'ask') && t === '') {
    return d.outcome === 'ask' ? 'Write the question the student should answer.' : 'Say why; the student reads it.';
  }
  if (t.length > MAX_NOTE) return `A note is at most ${formatNumber(MAX_NOTE)} characters; this is ${formatNumber(t.length)}.`;
  return null;
}

/** "Wed, Nov 9" for a `YYYY-MM-DD` date, read as that calendar day wherever the reader is. */
export function dueSaid(day: string | null): string {
  if (!day || !DATE.test(day)) return '—';
  return formatDate(localDay(day), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** One request's history, oldest first. */
export const historyOf = (all: readonly RequestAction[], requestId: string): RequestAction[] =>
  all.filter((a) => a.requestId === requestId).sort((a, b) => a.version - b.version);

/** The instructor's open question on a request, when it is waiting for the student's answer. */
export function openQuestion(r: CourseRequest, all: readonly RequestAction[]): string | null {
  if (r.status !== 'info_requested') return null;
  const asked = historyOf(all, r.id).filter((a) => a.action === 'info_requested');
  return asked.length ? asked[asked.length - 1].note : null;
}
