/**
 * The registration ledger's reads and writes, typed, over the account service.
 *
 * Every function is one RPC or one table, and the database is the authority:
 * who may act, whether the school has registration on, holds, seats, windows
 * and idempotency are all decided in
 * `supabase/migrations/20260929300000_registration_transaction.sql`. What this
 * adds is the shape a screen renders, and the reason codes in words a student
 * can act on.
 *
 * Two kinds of "no", kept apart:
 *
 * - **A refusal is an answer.** `registration_enroll` and its siblings return
 *   `{ok: false, reason, message}` for everything about the student — a hold,
 *   a full section, a closed window. Those come back as an `Answer`, not a
 *   thrown error, because the request was heard and nothing was written.
 * - **A raise is a failure.** Not signed in, not the registrar, a malformed
 *   key: these are thrown as a `ServiceError` with the server's sentence, and
 *   one with no SQLSTATE is the network, whose outcome is unknown.
 *
 * Nothing here is cached and nothing is written to browser storage.
 */

import { cloud } from '../cloud';
import { forSchool, type Grant } from '../capabilities';
import { serviceError } from '../attempt';
import { clock24, conflicts, type CatalogCourse, type Meeting } from '../registration';
import { OVERRIDE_KINDS, type EnrollmentState, type OverrideKind, type Reason } from './model';

export { OVERRIDE_KINDS };
export type { EnrollmentState, OverrideKind, Reason };

/** The capability that opens the registrar's half of the screen, held at school scope. */
export const REGISTRAR_CAPABILITY = 'registration:administer';

/** Whether these grants hold `registration:administer` over exactly this school. */
export function holdsRegistrar(grants: readonly Grant[], school: string): boolean {
  return forSchool(grants, school).includes(REGISTRAR_CAPABILITY);
}

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseFloat(text(v)) || 0);
const maybeNum = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);
const object = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});

// ── Reading ────────────────────────────────────────────────────────────────

export interface TermCalendar {
  term: string;
  opensAt: string;
  addDropEndsAt: string;
  withdrawEndsAt: string;
  maxCredits: number;
}

export function readTerm(r: Row): TermCalendar {
  return {
    term: text(r.term),
    opensAt: text(r.opens_at),
    addDropEndsAt: text(r.add_drop_ends_at),
    withdrawEndsAt: text(r.withdraw_ends_at),
    maxCredits: num(r.max_credits),
  };
}

/** The school's registration calendars, newest term first. Row-level security limits them to the caller's school. */
export async function loadTerms(): Promise<TermCalendar[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('registration_terms')
    .select('term,opens_at,add_drop_ends_at,withdraw_ends_at,max_credits')
    .order('term', { ascending: false });
  if (error) throw serviceError(error, 'Could not load the registration calendar.');
  return rows(data).map(readTerm);
}

export interface LiveSection {
  id: string;
  term: string;
  courseCode: string;
  section: string;
  title: string;
  credits: number;
  capacity: number;
  waitlistCapacity: number;
  seatsTaken: number;
  waiting: number;
  meetings: Meeting[];
  prerequisites: string[];
  requiresApproval: boolean;
  version: number;
}

function meetings(v: unknown): Meeting[] {
  return rows(v)
    .map((m) => ({
      days: Array.isArray(m.days) ? m.days.map(num).filter((d) => d >= 0 && d <= 6) : [],
      start: num(m.start),
      end: num(m.end),
    }))
    .filter((m) => m.days.length > 0 && m.end > m.start);
}

export function readSection(r: Row): LiveSection {
  return {
    id: text(r.id),
    term: text(r.term),
    courseCode: text(r.course_code),
    section: text(r.section),
    title: text(r.title),
    credits: num(r.credits),
    capacity: num(r.capacity),
    waitlistCapacity: num(r.waitlist_capacity),
    seatsTaken: num(r.seats_taken),
    waiting: num(r.waiting),
    meetings: meetings(r.meetings),
    prerequisites: Array.isArray(r.prerequisites) ? r.prerequisites.map(text) : [],
    requiresApproval: r.requires_approval === true,
    version: num(r.version),
  };
}

export const SECTION_COLUMNS =
  'id,term,course_code,section,title,credits,capacity,waitlist_capacity,seats_taken,waiting,meetings,prerequisites,requires_approval,version';

export async function loadSections(term: string): Promise<LiveSection[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('registration_sections')
    .select(SECTION_COLUMNS)
    .eq('term', term)
    .order('course_code')
    .order('section');
  if (error) throw serviceError(error, 'Could not load this term’s sections.');
  return rows(data).map(readSection);
}

export interface MyEnrollment {
  enrollmentId: string;
  sectionId: string;
  courseCode: string;
  section: string;
  state: EnrollmentState;
  grade: 'W' | null;
  /** One-based, while waitlisted. */
  waitPosition: number | null;
}

const STATES: readonly EnrollmentState[] = ['enrolled', 'waitlisted', 'pending_approval', 'dropped', 'left_waitlist', 'withdrawn', 'denied'];

export function readMine(r: Row): MyEnrollment {
  const state = STATES.includes(r.state as EnrollmentState) ? (r.state as EnrollmentState) : 'enrolled';
  return {
    enrollmentId: text(r.enrollment_id),
    sectionId: text(r.section_id),
    courseCode: text(r.course_code),
    section: text(r.section),
    state,
    grade: r.grade === 'W' ? 'W' : null,
    waitPosition: maybeNum(r.wait_position),
  };
}

/** `my_registration(term)`: the caller's own enrollments and places in queues. */
export async function loadMyRegistration(term: string): Promise<MyEnrollment[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('my_registration', { want_term: term });
  if (error) throw serviceError(error, 'Could not load your registration.');
  return rows(data).map(readMine);
}

/** Whether there is a hold, which office placed it, and its link. There is no reason field, by design. */
export interface HoldNotice {
  held: boolean;
  office: string;
  link: string;
}

/** `my_registration_hold()`: one row for a caller with a school. Anything past the three columns is not read. */
export async function loadMyHold(): Promise<HoldNotice> {
  const db = await cloud();
  const { data, error } = await db.rpc('my_registration_hold');
  if (error) throw serviceError(error, 'Could not check for a registration hold.');
  const r = rows(data)[0] ?? {};
  return { held: r.held === true, office: text(r.office), link: /^https:\/\//.test(text(r.link)) ? text(r.link) : '' };
}

// ── What a write answers ───────────────────────────────────────────────────

export type Outcome =
  | 'enrolled'
  | 'waitlisted'
  | 'pending_approval'
  | 'dropped'
  | 'left_waitlist'
  | 'withdrawn'
  | 'override_granted'
  | 'denied'
  | 'refused';

export interface Answer {
  ok: boolean;
  outcome: Outcome;
  reason: Reason | string;
  /** What to show: the reason in plain words, from `explain`. */
  message: string;
  /** The database's own sentence, kept for the record. */
  serverMessage: string;
  replayed: boolean;
  promoted: number;
  waitPosition: number | null;
  seatsTaken: number | null;
  capacity: number | null;
  hold: { office: string; link: string } | null;
}

/**
 * A reason code as a sentence somebody can act on.
 *
 * The database's own message is kept (`serverMessage`) and used whenever the
 * code is one this list does not know, so a new refusal is never shown as
 * nothing. `where` is the section, as "ECON 1020 01".
 */
export function explain(reason: string, where: string, serverMessage: string): string {
  const it = where || 'this section';
  switch (reason) {
    case 'ok':
      return serverMessage;
    case 'kill_switch':
      return 'Registration changes are paused at your school right now. Nothing was changed. Try again later, or use your school’s own registration system.';
    case 'flag_off':
      return 'Your school has not turned on registration in Semester. Nothing was changed.';
    case 'hold':
      return 'A hold on your account stops you adding courses. The office that placed it can clear it. You can still drop or withdraw.';
    case 'window_not_open':
      return `Registration for ${it} has not opened yet. Nothing was changed.`;
    case 'window_closed':
      return `The add/drop period has ended, so ${it} cannot be added now. The registrar can allow a late add.`;
    case 'already_enrolled':
      return `You are already enrolled in ${it}.`;
    case 'already_waitlisted':
      return `You are already on the waitlist for ${it}.`;
    case 'already_pending':
      return `Your request for ${it} is already waiting for the registrar’s approval.`;
    case 'prerequisite_missing':
      return `${it} needs a course you have not passed yet. Ask the registrar about a prerequisite override.`;
    case 'time_conflict':
      return `${it} meets at the same time as a course you are enrolled in. Drop one, or ask the registrar about an override.`;
    case 'credit_limit':
      return `Adding ${it} would take you over this term’s credit limit. Drop a course first, or ask the registrar.`;
    case 'full':
      return `${it} is full and so is its waitlist. Nothing was changed.`;
    case 'stale_seat_count':
      return `The seats in ${it} changed while you were looking. Nothing was changed. Check the section again and confirm.`;
    case 'not_enrolled':
      return `You are not enrolled or waiting in ${it}.`;
    case 'drop_deadline_passed':
      return `The add/drop deadline for ${it} has passed. You can withdraw instead, which records a W.`;
    case 'withdraw_not_yet':
      return `Add/drop is still open for ${it}. Drop it instead, and no W is recorded.`;
    case 'withdraw_deadline_passed':
      return `The withdrawal deadline for ${it} has passed. Ask the registrar.`;
    case 'unknown_section':
      return 'That section is not offered at your school this term.';
    case 'unknown_student':
      return 'No student with that account is at your school.';
    case 'not_pending':
      return 'That request is no longer waiting for a decision.';
    case 'bad_override':
      return 'An override needs at least one thing to waive and a reason. A hold cannot be waived here.';
    case 'idempotency_conflict':
      return 'That request was already used for something else. Nothing was changed. Try again.';
    default:
      return serverMessage || 'The request was refused. Nothing was changed.';
  }
}

export function readAnswer(data: unknown, where: string): Answer {
  const r = object(data);
  const reason = text(r.reason) || 'ok';
  const serverMessage = text(r.message);
  const hold = object(r.hold);
  return {
    ok: r.ok === true,
    outcome: (text(r.outcome) || 'refused') as Outcome,
    reason,
    message: explain(reason, where, serverMessage),
    serverMessage,
    replayed: r.replayed === true,
    promoted: num(r.promoted),
    waitPosition: maybeNum(r.wait_position),
    seatsTaken: maybeNum(r.seats_taken),
    capacity: maybeNum(r.capacity),
    hold: r.hold ? { office: text(hold.office), link: /^https:\/\//.test(text(hold.link)) ? text(hold.link) : '' } : null,
  };
}

// ── The student's three writers ────────────────────────────────────────────

/** Where the review said this request would land: a seat, the waitlist, or say nothing. */
export type Expect = 'seat' | 'waitlist' | null;

export async function enroll(sectionId: string, key: string, expect: Expect, where: string): Promise<Answer> {
  const db = await cloud();
  const { data, error } = await db.rpc('registration_enroll', { want_section: sectionId, want_key: key, want_expect: expect });
  if (error) throw serviceError(error, 'The enrollment was not sent.');
  return readAnswer(data, where);
}

export async function drop(sectionId: string, key: string, where: string): Promise<Answer> {
  const db = await cloud();
  const { data, error } = await db.rpc('registration_drop', { want_section: sectionId, want_key: key });
  if (error) throw serviceError(error, 'The drop was not sent.');
  return readAnswer(data, where);
}

export async function withdraw(sectionId: string, key: string, where: string): Promise<Answer> {
  const db = await cloud();
  const { data, error } = await db.rpc('registration_withdraw', { want_section: sectionId, want_key: key });
  if (error) throw serviceError(error, 'The withdrawal was not sent.');
  return readAnswer(data, where);
}

// ── The registrar ──────────────────────────────────────────────────────────

export interface PendingRequest {
  enrollmentId: string;
  student: string;
  sectionId: string;
  courseCode: string;
  section: string;
  title: string;
  term: string;
  requestedAt: string;
}

/**
 * Requests waiting for approval at the registrar's school. Read from the
 * table, which the registrar's policy opens; a student reading it sees only
 * their own rows, and none of them are pending anybody's decision but the
 * registrar's.
 */
export async function loadPending(term: string): Promise<PendingRequest[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('registration_enrollments')
    .select('id,student,section_id,created_at,registration_sections!inner(course_code,section,title,term)')
    .eq('state', 'pending_approval')
    .eq('registration_sections.term', term)
    .order('created_at');
  if (error) throw serviceError(error, 'Could not load the requests waiting for approval.');
  return rows(data).map((r) => {
    const s = object(Array.isArray(r.registration_sections) ? r.registration_sections[0] : r.registration_sections);
    return {
      enrollmentId: text(r.id),
      student: text(r.student),
      sectionId: text(r.section_id),
      courseCode: text(s.course_code),
      section: text(s.section),
      title: text(s.title),
      term: text(s.term),
      requestedAt: text(r.created_at),
    };
  });
}

export async function decide(enrollmentId: string, approve: boolean, reason: string, key: string, where: string): Promise<Answer> {
  const db = await cloud();
  const { data, error } = await db.rpc('registrar_decide', {
    want_enrollment: enrollmentId,
    want_approve: approve,
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The decision was not recorded.');
  return readAnswer(data, where);
}

export async function grantOverride(
  input: { student: string; sectionId: string; waives: readonly OverrideKind[]; reason: string },
  key: string,
  where: string,
): Promise<Answer> {
  const db = await cloud();
  const { data, error } = await db.rpc('registrar_grant_override', {
    want_student: input.student,
    want_section: input.sectionId,
    want_waives: [...input.waives],
    want_reason: input.reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The override was not recorded.');
  return readAnswer(data, where);
}

export interface TermInput {
  term: string;
  opensAt: string;
  addDropEndsAt: string;
  withdrawEndsAt: string;
  maxCredits: number;
}

export async function putTerm(t: TermInput): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('registrar_put_term', {
    want_term: t.term,
    want_opens: t.opensAt,
    want_add_drop_ends: t.addDropEndsAt,
    want_withdraw_ends: t.withdrawEndsAt,
    want_max_credits: t.maxCredits,
  });
  if (error) throw serviceError(error, 'The term was not saved.');
}

export interface SectionInput {
  term: string;
  courseCode: string;
  section: string;
  title: string;
  credits: number;
  capacity: number;
  waitlistCapacity: number;
  meetings: Meeting[];
  prerequisites: string[];
  requiresApproval: boolean;
}

/** Returns the section's id. Raising capacity promotes from the waitlist on the server. */
export async function putSection(s: SectionInput): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('registrar_put_section', {
    want_term: s.term,
    want_course: s.courseCode,
    want_section: s.section,
    want_title: s.title,
    want_credits: s.credits,
    want_capacity: s.capacity,
    want_waitlist: s.waitlistCapacity,
    want_meetings: s.meetings,
    want_prerequisites: s.prerequisites,
    want_requires_approval: s.requiresApproval,
  });
  if (error) throw serviceError(error, 'The section was not saved.');
  return text(data);
}

// ── Small readings the screen shares ──────────────────────────────────────

/** "ECON 1020 01". */
export const sectionName = (s: { courseCode: string; section: string }): string => `${s.courseCode} ${s.section}`;

/** Where an enroll would land now, from the counts the student is looking at. */
export function landing(s: Pick<LiveSection, 'seatsTaken' | 'capacity' | 'waiting' | 'waitlistCapacity' | 'requiresApproval'>): 'seat' | 'waitlist' | 'full' | 'approval' {
  if (s.requiresApproval) return 'approval';
  if (s.seatsTaken < s.capacity) return 'seat';
  if (s.waiting < s.waitlistCapacity) return 'waitlist';
  return 'full';
}

/** The term's phase at `now`: before opening, add/drop, withdrawal only, or closed. */
export function phase(t: TermCalendar | null, now: Date): 'unknown' | 'before' | 'add_drop' | 'withdraw' | 'closed' {
  if (!t) return 'unknown';
  const at = now.getTime();
  if (at < Date.parse(t.opensAt)) return 'before';
  if (at <= Date.parse(t.addDropEndsAt)) return 'add_drop';
  if (at <= Date.parse(t.withdrawEndsAt)) return 'withdraw';
  return 'closed';
}

// ── Beside the student's own plan ──────────────────────────────────────────

/**
 * A live section as the planner's `CatalogCourse`, so the planner's own
 * `conflicts` decides clashes here — one definition of "meets at the same
 * time", the one `private.registration_clash` restates in SQL.
 */
export function asCatalogCourse(s: LiveSection): CatalogCourse {
  return {
    id: s.id,
    code: s.courseCode,
    section: s.section,
    title: s.title,
    term: s.term,
    department: s.courseCode.split(' ')[0] ?? '',
    credits: s.credits,
    instructor: '',
    location: '',
    description: '',
    prerequisites: s.prerequisites.join(', '),
    seats: s.capacity,
    meetings: s.meetings,
  };
}

/** The enrolled sections this one meets at the same time as. */
export function clashes(s: LiveSection, enrolled: readonly LiveSection[]): LiveSection[] {
  const others = enrolled.filter((e) => e.id !== s.id && e.term === s.term);
  const found = conflicts([asCatalogCourse(s), ...others.map(asCatalogCourse)]).filter((c) => c.a.id === s.id || c.b.id === s.id);
  const ids = new Set(found.map((c) => (c.a.id === s.id ? c.b.id : c.a.id)));
  return others.filter((e) => ids.has(e.id));
}

const codeKey = (code: string): string => code.toUpperCase().replace(/\s+/g, ' ').trim();

/**
 * Whether the student's registration plan (the cart on the Registration
 * planner, `useRegistrationPlan`) names this section, or only its course.
 */
export function inPlan(s: LiveSection, cart: readonly CatalogCourse[]): 'section' | 'course' | null {
  const same = cart.filter((c) => codeKey(c.code) === codeKey(s.courseCode));
  if (same.length === 0) return null;
  return same.some((c) => c.section.trim().toUpperCase() === s.section.trim().toUpperCase()) ? 'section' : 'course';
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon Wed 09:00–09:50", one meeting pattern per clause; empty when the section has no set times. */
export function meetsSaid(list: readonly Meeting[]): string {
  return list.map((m) => `${m.days.map((d) => DAY[d] ?? '').join(' ')} ${clock24(m.start)}–${clock24(m.end)}`).join('; ');
}
