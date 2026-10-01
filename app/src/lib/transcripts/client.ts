/**
 * Transcripts' reads and writes, typed, over the account service.
 *
 * Every function is one RPC or one table, and
 * `supabase/migrations/20260930260000_transcripts.sql` is the authority: who may
 * issue, who may read, which mode the school is in, what a transcript reads and
 * keeps, what a check may answer and the idempotency are all decided there.
 * Row-level security decides what a read returns: a student reads the
 * transcripts and the release log of the record the school linked to their
 * account and nothing else; a registrar or a dean reads every one at the school.
 *
 * Every writer here *raises* to refuse. A refusal arrives as a thrown
 * `ServiceError` carrying the server's sentence (`answered: true`), and a
 * network failure as one with `answered: false`, whose outcome is unknown and
 * whose retry must keep its key (`lib/attempt.ts`).
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import { VERIFY_STATUSES, type Disclosure, type Transcript, type TranscriptCapability, type Verification, type VerifyStatus } from './model';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseFloat(text(v)) || 0);
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

// ── Who is looking, from their grants ────────────────────────────────────

/** The transcript capabilities this person holds on their own school. A grant on anything else is not one. */
export function transcriptCapabilities(grants: readonly Grant[], school: string): TranscriptCapability[] {
  const held = new Set<string>();
  for (const g of grants) if (school !== '' && g.scopeKind === 'school' && g.scopeId === school) held.add(g.capability);
  return (['transcript:issue', 'transcript:read'] as const).filter((c) => held.has(c));
}

// ── Reading ──────────────────────────────────────────────────────────────

export function readTranscript(r: Row, replaced: ReadonlyMap<string, { by: number; reason: string }>): Transcript {
  const id = text(r.id);
  const gone = replaced.get(id);
  return {
    id,
    serial: num(r.serial),
    studentRef: text(r.student_ref),
    asOf: text(r.as_of),
    issuedBy: maybe(r.issued_by),
    issuedAt: text(r.issued_at),
    bodyText: text(r.body_text),
    bodySha256: text(r.body_sha256),
    replacedBy: gone ? gone.by : null,
    replacedBecause: gone ? gone.reason : null,
  };
}

export function readDisclosure(r: Row): Disclosure {
  return {
    id: text(r.id),
    serial: num(r.transcript_serial),
    studentRef: text(r.student_ref),
    releasedBy: maybe(r.released_by),
    releasedAt: text(r.released_at),
    recipientName: text(r.recipient_name),
    recipientKind: text(r.recipient_kind),
    purpose: text(r.purpose),
  };
}

/** What a check answered, or null when it is not one of the three words this build knows. */
export function readVerification(data: unknown): Verification | null {
  const first = rows(data)[0];
  if (!first || !VERIFY_STATUSES.includes(first.status as VerifyStatus)) return null;
  return { status: first.status as VerifyStatus, schoolName: maybe(first.school_name), issuedOn: maybe(first.issued_on) };
}

const TRANSCRIPT_COLUMNS = 'id,serial,student_ref,as_of,issued_by,issued_at,body_text,body_sha256';
const DISCLOSURE_COLUMNS = 'id,transcript_serial,student_ref,released_by,released_at,recipient_name,recipient_kind,purpose';

/**
 * The transcripts this person may read, newest serial first, with which of them
 * were replaced. `studentRef` narrows to one student; a student's own are all
 * they can read, so it is not needed for them. Row-level security says which.
 */
export async function loadTranscripts(studentRef: string | null): Promise<Transcript[]> {
  const db = await cloud();
  let q = db.from('transcripts').select(TRANSCRIPT_COLUMNS).order('serial', { ascending: false }).limit(200);
  if (studentRef) q = q.eq('student_ref', studentRef);
  const { data, error } = await q;
  if (error) throw serviceError(error, 'Could not load the transcripts.');
  const list = rows(data);
  // A supersession is readable exactly when the transcript it replaced is, so what comes back is what this caller may see.
  const { data: sup, error: supError } = await db.from('transcript_supersessions').select('transcript_id,by_transcript,reason');
  if (supError) throw serviceError(supError, 'Could not load which transcripts were replaced.');
  const serialOf = new Map(list.map((r) => [text(r.id), num(r.serial)] as const));
  const replaced = new Map<string, { by: number; reason: string }>();
  for (const s of rows(sup)) {
    const by = serialOf.get(text(s.by_transcript));
    if (by !== undefined) replaced.set(text(s.transcript_id), { by, reason: text(s.reason) });
  }
  return list.map((r) => readTranscript(r, replaced));
}

/** The releases logged for this person's reach, newest first; narrowed to one student when asked. */
export async function loadDisclosures(studentRef: string | null): Promise<Disclosure[]> {
  const db = await cloud();
  let q = db.from('transcript_disclosures').select(DISCLOSURE_COLUMNS).order('released_at', { ascending: false }).limit(200);
  if (studentRef) q = q.eq('student_ref', studentRef);
  const { data, error } = await q;
  if (error) throw serviceError(error, 'Could not load the log of releases.');
  return rows(data).map(readDisclosure);
}

/**
 * The student reference the school linked to this account, or null when it has
 * not. The link is made by the school's record approvers
 * (`academic_record_subjects`); a student cannot make or change it.
 */
export async function myStudentRef(me: string): Promise<string | null> {
  const db = await cloud();
  const { data, error } = await db.from('academic_record_subjects').select('student_ref').eq('user_id', me).limit(1);
  if (error) throw serviceError(error, 'Could not read which academic record is yours.');
  const first = rows(data)[0];
  return first ? maybe(first.student_ref) : null;
}

// ── Writing ──────────────────────────────────────────────────────────────

/**
 * Issue a transcript for one student reference as of a date. The answer is the
 * kept transcript's id; a replay of the same key answers the same id. Nothing is
 * written to the academic record. `replaces` is the serial of an earlier
 * transcript of the same student that this one corrects, with `reason`; both or
 * neither.
 */
export async function issueTranscript(studentRef: string, asOf: string, replaces: number | null, reason: string | null, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('transcript_issue', {
    want_student_ref: studentRef,
    want_as_of: asOf,
    want_supersedes: replaces,
    want_reason: reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The transcript was not issued.');
  return text(data);
}

/**
 * Record that a transcript was released. Semester sends nothing: this is the
 * registrar's record that a release happened.
 */
export async function discloseTranscript(serial: number, recipientName: string, recipientKind: string, purpose: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('transcript_disclose', {
    want_serial: serial,
    want_recipient_name: recipientName,
    want_recipient_kind: recipientKind,
    want_purpose: purpose,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The release was not logged.');
  return text(data);
}

/** Check a serial and a hash. Answers valid, superseded or unknown, with the school and the day it was issued, and never the text or the student. */
export async function verifyTranscript(serial: number, hash: string): Promise<Verification> {
  const db = await cloud();
  const { data, error } = await db.rpc('transcript_verify', { want_serial: serial, want_hash: hash });
  if (error) throw serviceError(error, 'The transcript was not checked.');
  const said = readVerification(data);
  if (!said) throw serviceError({ code: 'XX000', message: 'The answer was not one this version of Semester knows how to read.' }, 'The transcript was not checked.');
  return said;
}
