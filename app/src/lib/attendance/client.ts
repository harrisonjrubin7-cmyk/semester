/**
 * Attendance, typed, over the account service.
 *
 * `supabase/migrations/20261001020000_attendance.sql` is the authority: who
 * opens a session and marks, who may check in, the server's clock on each
 * check-in, the code and its lockout, and the append-only marks, all only while
 * the school runs `attendance` in Core (`lib/modulemode.ts`). This file asks.
 *
 * A wrong code is *answered*, not raised: `checkIn` returns `{ ok: false,
 * reason }` so the database keeps the failed try. Every other writer raises to
 * refuse, and arrives as a thrown `ServiceError` carrying the server's sentence.
 * There is no location, photograph or attention measure here and there will not
 * be (DO-NOT-BUILD).
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export interface Offering {
  course: string;
  term: string;
}
const CODE = /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/;
const TERM = /^[0-9]{4}(FA|SP|SU)$/;
export const offeringKey = (o: Offering): string => `${o.course}|${o.term}`;

/** Courses this person takes attendance for and ones they check in to, each over exactly `<school>/<CODE>/<TERM>`. */
export function attendanceOfferings(grants: readonly Grant[], school: string): { taking: Offering[]; attending: Offering[] } {
  const taking = new Map<string, Offering>();
  const attending = new Map<string, Offering>();
  const prefix = `${school}/`;
  for (const g of grants) {
    if (school === '' || g.scopeKind !== 'course' || !g.scopeId.startsWith(prefix)) continue;
    const parts = g.scopeId.slice(prefix.length).split('/');
    if (parts.length !== 2 || !CODE.test(parts[0]) || !TERM.test(parts[1])) continue;
    const o = { course: parts[0], term: parts[1] };
    if (g.capability === 'attendance:take') taking.set(offeringKey(o), o);
    if (g.capability === 'attendance:attend') attending.set(offeringKey(o), o);
  }
  const by = (a: Offering, b: Offering) => (a.term === b.term ? a.course.localeCompare(b.course) : b.term.localeCompare(a.term));
  return { taking: [...taking.values()].sort(by), attending: [...attending.values()].sort(by) };
}

export type MarkStatus = 'present' | 'late' | 'absent' | 'excused';
export const MARK_WORDS: Record<MarkStatus, string> = { present: 'Present', late: 'Late', absent: 'Absent', excused: 'Excused' };

export interface Session {
  id: string;
  title: string;
  heldOn: string;
  opensAt: string;
  closesAt: string;
  lateAfter: number;
  code: string;
  status: 'open' | 'closed';
}

export async function loadSessions(school: string, course: string, term: string): Promise<Session[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('attendance_sessions')
    .select('id,title,held_on,opens_at,closes_at,late_after_minutes,code,status')
    .eq('tenant_id', school).eq('course_code', course).eq('term', term)
    .order('held_on', { ascending: false }).order('opens_at', { ascending: false });
  if (error) throw serviceError(error, 'The sessions could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), title: text(r.title), heldOn: text(r.held_on), opensAt: text(r.opens_at), closesAt: text(r.closes_at),
    lateAfter: Number(r.late_after_minutes) || 0, code: text(r.code), status: r.status === 'closed' ? 'closed' : 'open',
  }));
}

export interface Mark {
  id: string;
  sessionId: string;
  studentId: string;
  heldOn: string;
  course: string;
  version: number;
  status: MarkStatus;
  method: string;
  note: string;
  markedAt: string;
}

const MARKS: readonly MarkStatus[] = ['present', 'late', 'absent', 'excused'];

/** Marks readable by the caller: every student's for a taker, only their own for a student. */
export async function loadMarks(school: string, course: string, term: string): Promise<Mark[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('attendance_marks')
    .select('id,session_id,student_id,held_on,course_code,version,status,method,note,marked_at')
    .eq('tenant_id', school).eq('course_code', course).eq('term', term)
    .order('held_on', { ascending: false }).order('version', { ascending: true });
  if (error) throw serviceError(error, 'The marks could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), sessionId: text(r.session_id), studentId: text(r.student_id), heldOn: text(r.held_on), course: text(r.course_code),
    version: Number(r.version) || 1, status: (MARKS as readonly string[]).includes(text(r.status)) ? (r.status as MarkStatus) : 'absent',
    method: text(r.method), note: text(r.note), markedAt: text(r.marked_at),
  }));
}

/** The latest version of each student's mark in each session. */
export function currentMarks(marks: readonly Mark[]): Mark[] {
  const latest = new Map<string, Mark>();
  for (const m of marks) {
    const key = `${m.sessionId}|${m.studentId}`;
    const was = latest.get(key);
    if (!was || m.version > was.version) latest.set(key, m);
  }
  return [...latest.values()];
}

/** The tally of a student's current marks: how many of each. */
export function tally(marks: readonly Mark[]): Record<MarkStatus, number> {
  const t: Record<MarkStatus, number> = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const m of currentMarks(marks)) t[m.status] += 1;
  return t;
}

export async function openSession(course: string, term: string, s: { title: string; heldOn: string; opensAt: string; closesAt: string; lateAfter: number }, key: string): Promise<{ id: string; code: string }> {
  const db = await cloud();
  const { data, error } = await db.rpc('attendance_open_session', {
    want_course: course, want_term: term, want_title: s.title, want_held_on: s.heldOn,
    want_opens: s.opensAt, want_closes: s.closesAt, want_late_after: s.lateAfter, want_key: key,
  });
  if (error) throw serviceError(error, 'The session was not opened.');
  const r = (data ?? {}) as Row;
  return { id: text(r.id), code: text(r.code) };
}

/** Returns how many students were marked absent by the close. */
export async function closeSession(id: string, key: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('attendance_close_session', { want_id: id, want_key: key });
  if (error) throw serviceError(error, 'The session was not closed.');
  return Number(data) || 0;
}

export async function markStudent(session: string, student: string, status: MarkStatus, note: string, key: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('attendance_mark', { want_session: session, want_student: student, want_status: status, want_note: note, want_key: key });
  if (error) throw serviceError(error, 'The mark was not saved.');
  return Number(data) || 1;
}

export type CheckInReason = 'no_such_code' | 'too_many_tries' | 'not_open' | 'already_marked';
export type CheckIn = { ok: true; status: MarkStatus; course: string; heldOn: string } | { ok: false; reason: CheckInReason };

export const REASON_WORDS: Record<CheckInReason, string> = {
  no_such_code: 'That code did not match an open session for your courses. Check it and try again.',
  too_many_tries: 'Too many tries. Wait ten minutes, or ask your instructor to mark you.',
  not_open: 'That session is not open right now.',
  already_marked: 'You are already marked for that session.',
};

export async function checkIn(code: string, key: string): Promise<CheckIn> {
  const db = await cloud();
  const { data, error } = await db.rpc('attendance_check_in', { want_code: code.trim(), want_key: key });
  if (error) throw serviceError(error, 'Your check-in was not sent.');
  const r = (data ?? {}) as Row;
  if (r.ok === true) return { ok: true, status: (MARKS as readonly string[]).includes(text(r.status)) ? (r.status as MarkStatus) : 'present', course: text(r.course), heldOn: text(r.held_on) };
  const reason = text(r.reason);
  return { ok: false, reason: reason in REASON_WORDS ? (reason as CheckInReason) : 'no_such_code' };
}
