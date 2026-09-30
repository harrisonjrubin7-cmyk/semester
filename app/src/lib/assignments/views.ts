/**
 * What to show about an assignment, worked out from rows.
 *
 * Pure: no clock, no network. Every function that depends on the time is
 * handed it, so the same rows always give the same answer and a test can put
 * "now" on either side of a deadline. `private.assignments_window` in the
 * migration decides the same things for the database; `windowFor` is the same
 * rule in TypeScript so a screen can say "due Friday, your extension to Monday"
 * without a call, and `assignments.test.ts` holds the two to the same cases.
 *
 * What this never does is decide. The database refuses a late submission after
 * the closing time whatever this says, so a wrong answer here costs a clearer
 * sentence, not a submission it should not have taken.
 */

import { formatNumber } from '../locale';
import { LIMITS } from './model';
import type { Assignment, Draft, Extension, Receipt, Status, Version } from './model';

const ms = (iso: string): number => Date.parse(iso);

// ── The due time that applies to one student ─────────────────────────────

export interface Window {
  dueAt: string;
  closesAt: string | null;
  /** True when a row in `assignment_extensions` moved this student's due time. */
  extended: boolean;
}

/**
 * Their newest extension if they have one, otherwise the assignment's. An
 * extension that leaves the closing time empty keeps the assignment's, unless
 * that would fall before the extended due time, when the student's closing time
 * is their due time — an extension never leaves a student unable to submit by it.
 */
export function windowFor(a: Assignment, extensions: readonly Extension[], student: string): Window {
  const mine = extensions
    .filter((e) => e.assignmentId === a.id && e.studentId === student)
    // Newest first; the id breaks a tie the way the database does.
    .sort((x, y) => ms(y.at) - ms(x.at) || (y.id < x.id ? -1 : y.id > x.id ? 1 : 0));
  const e = mine[0];
  if (!e) return { dueAt: a.dueAt, closesAt: a.closesAt, extended: false };
  let closesAt: string | null;
  if (e.closesAt !== null) closesAt = e.closesAt;
  else if (a.closesAt === null) closesAt = null;
  else closesAt = ms(a.closesAt) >= ms(e.dueAt) ? a.closesAt : e.dueAt;
  return { dueAt: e.dueAt, closesAt, extended: true };
}

// ── Where a student stands ───────────────────────────────────────────────

export type Standing =
  | 'not-open'
  | 'open'
  | 'open-late'
  | 'submitted'
  | 'submitted-late'
  | 'missed'
  | 'closed-submitted';

/** The latest version of one student's work, or null. */
export function latest(versions: readonly Version[]): Version | null {
  let best: Version | null = null;
  for (const v of versions) if (!best || v.version > best.version) best = v;
  return best;
}

/**
 * Whether the assignment is still taking work from this student at `now`:
 * published, and either no closing time or not past it.
 */
export function accepting(a: Assignment, w: Window, now: Date): boolean {
  if (a.status !== 'published') return false;
  return w.closesAt === null || now.getTime() <= ms(w.closesAt);
}

export function standing(a: Assignment, w: Window, versions: readonly Version[], now: Date): Standing {
  if (a.status === 'draft') return 'not-open';
  const last = latest(versions);
  if (a.status === 'closed' || !accepting(a, w, now)) return last ? 'closed-submitted' : 'missed';
  if (last) return last.late ? 'submitted-late' : 'submitted';
  return now.getTime() > ms(w.dueAt) ? 'open-late' : 'open';
}

/** One sentence, in the order a student reads it: where things are, then what is next. */
export function standingText(s: Standing, w: Window, versions: readonly Version[]): string {
  const n = versions.length;
  switch (s) {
    case 'not-open':
      return 'Not open yet.';
    case 'open':
      return w.extended ? 'Not submitted. Your due time was extended.' : 'Not submitted.';
    case 'open-late':
      return 'Past its due time and not submitted. Work is still taken, marked late, until it closes.';
    case 'submitted':
      return n === 1 ? 'Submitted on time.' : `Submitted on time, ${n} versions.`;
    case 'submitted-late':
      return n === 1 ? 'Submitted late.' : `Submitted, the latest version late, ${n} versions.`;
    case 'closed-submitted':
      return 'Closed. Your submission was taken.';
    case 'missed':
      return 'Closed, and nothing was submitted.';
  }
}

// ── Whether a student may submit, and what to say when not ───────────────

export type CanSubmit = { ok: true } | { ok: false; reason: string };

/**
 * The server's own order: a draft is invisible, a closed assignment takes
 * nothing, then the closing time, then resubmission, the cap. A copy of the
 * latest version is checked by `sameAsLatest`, because it needs the text.
 */
export function canSubmit(a: Assignment, w: Window, versions: readonly Version[], now: Date): CanSubmit {
  if (a.status === 'draft') return { ok: false, reason: 'This assignment is not open yet.' };
  if (a.status === 'closed') return { ok: false, reason: 'This assignment is closed.' };
  if (w.closesAt !== null && now.getTime() > ms(w.closesAt)) {
    return { ok: false, reason: 'This assignment stopped accepting work at its closing time.' };
  }
  const last = latest(versions);
  if (last && !a.allowResubmission) {
    return { ok: false, reason: 'This assignment takes one submission, and you have made it.' };
  }
  if ((last?.version ?? 0) + 1 > a.maxVersions) {
    return { ok: false, reason: `This assignment takes at most ${a.maxVersions} submissions.` };
  }
  return { ok: true };
}

/** What is wrong with this text, or null. Mirrors the database; the database decides. */
export function bodyProblem(body: string, versions: readonly Version[]): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return 'Write something to submit.';
  if (body.length > LIMITS.body) return `A submission is at most ${formatNumber(LIMITS.body)} characters; this is ${formatNumber(body.length)}.`;
  const last = latest(versions);
  if (last && last.body === body) return 'That is what you already submitted. Change something, or keep your last version.';
  return null;
}

// ── What an instructor may set ───────────────────────────────────────────

/** The first thing wrong with a draft, or null. `now` only matters to publishing. */
export function draftProblem(d: Draft): string | null {
  if (d.title.trim().length === 0) return 'Give the assignment a title.';
  if (d.title.trim().length > LIMITS.title) return `A title is at most ${LIMITS.title} characters.`;
  if (d.instructions.length > LIMITS.instructions) return `The instructions are at most ${formatNumber(LIMITS.instructions)} characters.`;
  if (!d.dueAt || Number.isNaN(ms(d.dueAt))) return 'Set a due time.';
  if (d.closesAt !== null && (Number.isNaN(ms(d.closesAt)) || ms(d.closesAt) < ms(d.dueAt))) return 'It cannot close before it is due.';
  if (!Number.isInteger(d.maxVersions) || d.maxVersions < 1 || d.maxVersions > LIMITS.versionsMax) {
    return `A student may submit between 1 and ${LIMITS.versionsMax} versions.`;
  }
  return null;
}

/** Whether a draft can be published now: the due time has to be ahead of us. */
export function publishProblem(a: Assignment, now: Date): string | null {
  if (a.status !== 'draft') return `Only a draft can be published; this one is ${a.status}.`;
  if (ms(a.dueAt) <= now.getTime()) return 'The due time has passed. Revise it before publishing.';
  return null;
}

/** The first thing wrong with an extension, or null. */
export function extensionProblem(w: Window, dueAt: string, closesAt: string | null, reason: string): string | null {
  if (reason.trim().length === 0) return 'An extension needs a reason.';
  if (reason.trim().length > LIMITS.reason) return `A reason is at most ${LIMITS.reason} characters.`;
  if (!dueAt || Number.isNaN(ms(dueAt))) return 'Set the new due time.';
  if (ms(dueAt) <= ms(w.dueAt)) return 'An extension must be later than the time that already applies to this student.';
  if (closesAt !== null && (Number.isNaN(ms(closesAt)) || ms(closesAt) < ms(dueAt))) return 'It cannot close before it is due.';
  return null;
}

// ── The receipt ──────────────────────────────────────────────────────────

/** SHA-256 of the text as UTF-8, in lower-case hex: what the database hashes. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Whether a receipt describes this version, by hash. The student can run it
 * on their own device against their own text: the receipt proves what was
 * taken only if the text they hold still hashes to what it says.
 */
export async function receiptMatches(r: Receipt, v: Version): Promise<boolean> {
  if (r.versionId !== v.id || r.contentSha256 !== v.contentSha256) return false;
  return (await sha256Hex(v.body)) === r.contentSha256;
}

/** Plain text a student can copy, print or save: the receipt and what it covers. */
export function receiptText(r: Receipt, a: Pick<Assignment, 'course' | 'term' | 'title'>, version: number): string {
  return [
    'Semester submission receipt',
    `Receipt: ${r.code}`,
    `Course: ${a.course} · ${a.term}`,
    `Assignment: ${a.title}`,
    `Version: ${version}`,
    `Taken: ${r.submittedAt}`,
    `Due then: ${r.dueAtThen}${r.late ? ' (submitted late)' : ''}`,
    `SHA-256 of the text: ${r.contentSha256}`,
    '',
    'The database wrote this receipt when it took the submission. It proves what was submitted and when; it is not a grade.',
  ].join('\n');
}

// ── A short fingerprint, for naming an attempt ───────────────────────────

/**
 * A short non-cryptographic digest of some text (djb2), for naming one
 * attempt: the same text is the same attempt, so a retry keeps its key, and
 * different text is a new one. It proves nothing and is never sent; the
 * database hashes the real text with SHA-256 and the receipt carries that.
 */
export function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${text.length.toString(36)}`;
}

// ── Ordering, for lists ──────────────────────────────────────────────────

const RANK: Record<Status, number> = { published: 0, draft: 1, closed: 2 };

/** Open work first, soonest due first; drafts next; closed last. */
export function byUrgency(a: Assignment, b: Assignment): number {
  return RANK[a.status] - RANK[b.status] || ms(a.dueAt) - ms(b.dueAt) || a.title.localeCompare(b.title);
}
