/**
 * Term grades, signed documents, the disclosure log and graduation clearance,
 * typed, over the account service.
 *
 * `supabase/migrations/20261001050000_records_transcripts.sql` is the authority:
 * an instructor posts final grades and a registrar accepts them into ledger
 * proposals that someone else decides; a document is a snapshot of the ledger,
 * hashed and signed on the server; every release to anyone but the student is
 * logged; clearance reads a saved degree audit, the ledger and the holds. All
 * only while the school runs `records` in Core (`lib/modulemode.ts`). This file
 * asks, and `transcriptView` lays out what the server signed.
 *
 * Opening a document by its code is the verification endpoint's job
 * (`record_document_verify`, service role only); nothing here calls it.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export type RecordsCapability = 'records:issue' | 'records:accept' | 'records:clear' | 'records:audit';

/** The records capabilities this person holds over exactly their school. */
export function recordsCapabilities(grants: readonly Grant[], school: string): Set<RecordsCapability> {
  const held = new Set<RecordsCapability>();
  if (school === '') return held;
  for (const g of grants) {
    if (g.scopeKind === 'school' && g.scopeId === school && g.capability.startsWith('records:')) held.add(g.capability as RecordsCapability);
  }
  return held;
}

export type RecipientKind = 'student' | 'school_official' | 'consent' | 'directory' | 'health_safety' | 'subpoena' | 'other_exception';

/** Each exception in words, as the log shows it. */
export const RECIPIENT_WORDS: Record<RecipientKind, string> = {
  student: 'The student',
  school_official: 'A school official with a legitimate educational interest',
  consent: 'A third party, on the student’s written consent',
  directory: 'Directory information',
  health_safety: 'A health or safety emergency',
  subpoena: 'A subpoena or court order',
  other_exception: 'Another exception',
};

export interface RecordDocument {
  id: string;
  studentRef: string;
  kind: 'transcript' | 'enrollment_verification';
  code: string;
  asOf: string;
  hash: string;
  recipient: string;
  recipientKind: RecipientKind;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  content: unknown;
}

/** A verification code in the groups of four it is printed in. */
export function codeWords(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}

export async function loadDocuments(school: string): Promise<RecordDocument[]> {
  const db = await cloud();
  const { data, error } = await db
    .from('record_documents')
    .select('id,student_ref,kind,code,as_of,content_hash,recipient,recipient_kind,issued_at,expires_at,content')
    .eq('tenant_id', school).order('issued_at', { ascending: false });
  if (error) throw serviceError(error, 'The documents could not be read.');
  const { data: gone, error: ge } = await db.from('record_document_revocations').select('document_id').eq('tenant_id', school);
  if (ge) throw serviceError(ge, 'The revocations could not be read.');
  const revoked = new Set(rows(gone).map((r) => text(r.document_id)));
  return rows(data).map((r) => ({
    id: text(r.id), studentRef: text(r.student_ref), kind: r.kind === 'enrollment_verification' ? 'enrollment_verification' as const : 'transcript' as const,
    code: text(r.code), asOf: text(r.as_of), hash: text(r.content_hash), recipient: text(r.recipient),
    recipientKind: (text(r.recipient_kind) in RECIPIENT_WORDS ? text(r.recipient_kind) : 'student') as RecipientKind,
    issuedAt: text(r.issued_at), expiresAt: text(r.expires_at), revoked: revoked.has(text(r.id)), content: r.content,
  }));
}

export interface Disclosure {
  id: string;
  studentRef: string;
  recipient: string;
  recipientKind: RecipientKind;
  basis: string;
  consentRef: string;
  what: string;
  releasedAt: string;
}

export async function loadDisclosures(school: string, student?: string): Promise<Disclosure[]> {
  const db = await cloud();
  let q = db.from('record_disclosures').select('id,student_ref,recipient,recipient_kind,basis,consent_ref,what,released_at').eq('tenant_id', school);
  if (student) q = q.eq('student_ref', student);
  const { data, error } = await q.order('released_at', { ascending: false });
  if (error) throw serviceError(error, 'The disclosure log could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), studentRef: text(r.student_ref), recipient: text(r.recipient),
    recipientKind: (text(r.recipient_kind) in RECIPIENT_WORDS ? text(r.recipient_kind) : 'other_exception') as RecipientKind,
    basis: text(r.basis), consentRef: text(r.consent_ref), what: text(r.what), releasedAt: text(r.released_at),
  }));
}

export interface Clearance {
  id: string;
  studentRef: string;
  status: 'cleared' | 'blocked';
  blocks: string[];
  runAt: string;
}

export async function loadClearances(school: string, student?: string): Promise<Clearance[]> {
  const db = await cloud();
  let q = db.from('graduation_clearances').select('id,student_ref,status,checks,run_at').eq('tenant_id', school);
  if (student) q = q.eq('student_ref', student);
  const { data, error } = await q.order('run_at', { ascending: false }).limit(50);
  if (error) throw serviceError(error, 'The clearances could not be read.');
  return rows(data).map((r) => {
    const checks = (r.checks ?? {}) as Row;
    return {
      id: text(r.id), studentRef: text(r.student_ref), status: r.status === 'cleared' ? 'cleared' as const : 'blocked' as const,
      blocks: Array.isArray(checks.blocks) ? (checks.blocks as unknown[]).map(text) : [], runAt: text(r.run_at),
    };
  });
}

// ── The signed content, laid out ─────────────────────────────────────────

const POINTS: Record<string, number> = {
  'A+': 4, A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, 'D+': 1.3, D: 1, 'D-': 0.7, F: 0,
};
const SEASON: Record<string, number> = { Spring: 1, Summer: 2, Fall: 3 };

export interface TranscriptCourse { course: string; grade: string; credits: number | null }
export interface TranscriptTerm { term: string; courses: TranscriptCourse[]; credits: number; gpa: number | null }
export interface TranscriptView {
  terms: TranscriptTerm[];
  transfer: { course: string; credits: number | null }[];
  standing: string[];
  conferred: string[];
  enrollment: string[];
  cumulative: { credits: number; gpa: number | null };
}

const termRank = (label: string): number => {
  const [season, year] = label.split(' ');
  return Number.parseInt(year ?? '0', 10) * 10 + (SEASON[season ?? ''] ?? 0);
};

/**
 * What a signed transcript says, by term, with the arithmetic done the way the
 * degree audit does it: credits from the course's credit entry, GPA over graded
 * courses weighted by credits. The signature covers the entries; this is a
 * reading of them, so a school with another convention reads the entries.
 */
export function transcriptView(content: unknown): TranscriptView {
  const entries = Array.isArray((content as Row | null)?.entries) ? ((content as Row).entries as Row[]) : [];
  const byKey = (kind: string) => new Map(entries.filter((e) => e.kind === kind).map((e) => [text(e.key), text(e.value)]));
  const credits = byKey('credit');
  const terms = new Map<string, TranscriptCourse[]>();
  for (const e of entries.filter((x) => x.kind === 'grade')) {
    const key = text(e.key);
    const [course, term = ''] = key.split(' · ');
    const n = Number(credits.get(key));
    const list = terms.get(term) ?? [];
    list.push({ course, grade: text(e.value), credits: credits.has(key) && Number.isFinite(n) ? n : null });
    terms.set(term, list);
  }
  let allPts = 0;
  let allGraded = 0;
  let allCredits = 0;
  const out: TranscriptTerm[] = [...terms.entries()].sort((a, b) => termRank(a[0]) - termRank(b[0])).map(([term, courses]) => {
    let pts = 0;
    let graded = 0;
    let earned = 0;
    for (const c of courses.sort((a, b) => a.course.localeCompare(b.course))) {
      const p = POINTS[c.grade.toUpperCase()];
      if (c.credits !== null && p !== undefined) { pts += p * c.credits; graded += c.credits; }
      if (c.credits !== null && (p === undefined ? ['P'].includes(c.grade.toUpperCase()) : p >= 0.7)) earned += c.credits;
    }
    allPts += pts; allGraded += graded; allCredits += earned;
    return { term, courses, credits: earned, gpa: graded > 0 ? Math.round((pts / graded) * 1000) / 1000 : null };
  });
  const transferCredits = byKey('transfer_credit');
  return {
    terms: out,
    transfer: [...transferCredits.entries()].map(([course, v]) => ({ course, credits: Number.isFinite(Number(v)) ? Number(v) : null })),
    standing: [...byKey('standing').entries()].map(([k, v]) => `${k}: ${v}`),
    conferred: [...byKey('conferral').entries()].map(([k, v]) => `${k}: ${v}`),
    enrollment: [...byKey('enrollment').entries()].map(([k, v]) => `${k}: ${v}`),
    cumulative: {
      credits: allCredits + [...transferCredits.values()].reduce((n, v) => n + (Number.isFinite(Number(v)) ? Number(v) : 0), 0),
      gpa: allGraded > 0 ? Math.round((allPts / allGraded) * 1000) / 1000 : null,
    },
  };
}

// ── The writers ──────────────────────────────────────────────────────────

export interface PostedGrade { student: string; grade: string; credits: number }

export async function postGrades(course: string, term: string, grades: readonly PostedGrade[], key: string): Promise<{ posted: number; skipped: number }> {
  const db = await cloud();
  const { data, error } = await db.rpc('term_grades_post', { want_course: course, want_term: term, want_grades: grades, want_key: key });
  if (error) throw serviceError(error, 'The grades were not posted.');
  const r = (data ?? {}) as Row;
  return { posted: Number(r.posted) || 0, skipped: Array.isArray(r.skipped) ? r.skipped.length : 0 };
}

export async function acceptGrades(course: string, term: string, key: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('term_grades_accept', { want_course: course, want_term: term, want_key: key });
  if (error) throw serviceError(error, 'The grades were not accepted.');
  return Number(((data ?? {}) as Row).proposed) || 0;
}

export interface IssueRequest {
  student: string;
  kind: 'transcript' | 'enrollment_verification';
  recipient: string;
  recipientKind: RecipientKind;
  basis: string;
  consent: string;
}

export async function issueDocument(r: IssueRequest, key: string): Promise<{ id: string; code: string }> {
  const db = await cloud();
  const { data, error } = await db.rpc('record_document_issue', {
    want_student: r.student, want_kind: r.kind, want_recipient: r.recipient, want_recipient_kind: r.recipientKind,
    want_basis: r.basis, want_consent: r.consent, want_key: key,
  });
  if (error) throw serviceError(error, 'The document was not issued.');
  const d = (data ?? {}) as Row;
  return { id: text(d.id), code: text(d.code) };
}

export async function revokeDocument(id: string, reason: string, key: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('record_document_revoke', { want_id: id, want_reason: reason, want_key: key });
  if (error) throw serviceError(error, 'The document was not revoked.');
}

export async function logDisclosure(
  d: { student: string; recipient: string; recipientKind: Exclude<RecipientKind, 'student'>; basis: string; consent: string; what: string }, key: string,
): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('record_disclosure_log', {
    want_student: d.student, want_recipient: d.recipient, want_recipient_kind: d.recipientKind, want_basis: d.basis,
    want_consent: d.consent, want_what: d.what, want_key: key,
  });
  if (error) throw serviceError(error, 'The release was not logged.');
}

export async function runClearance(student: string, key: string): Promise<{ status: 'cleared' | 'blocked'; blocks: string[] }> {
  const db = await cloud();
  const { data, error } = await db.rpc('graduation_clearance_run', { want_student: student, want_key: key });
  if (error) throw serviceError(error, 'The clearance could not be run.');
  const r = (data ?? {}) as Row;
  return { status: r.status === 'cleared' ? 'cleared' : 'blocked', blocks: Array.isArray(r.blocks) ? (r.blocks as unknown[]).map(text) : [] };
}
