/**
 * Portfolio evidence, and sharing it with an employer.
 *
 * `supabase/migrations/20261023120000_career_evidence.sql` is the authority. A
 * student picks exact saved versions of their own documents (`./objects.ts`)
 * as evidence, then grants one employer account, acting for one employer,
 * access to named items until a date at most 180 days out. The student can
 * see who has access and revoke it; revoking ends it at once. An employer
 * reads only through `sharedWithMe` and `readEvidence`, and every read is
 * audited on the server. Grades are not part of this in any form.
 *
 * Every student write names the portfolio `revision` it read, as a save names
 * the object's revision: if anything changed since, the server answers
 * `stale` and writes nothing. Each write carries an idempotency key, which a
 * retry after an `unknown` failure must reuse.
 *
 * No screen calls this yet: there is no way in the app to save a document to
 * Semester (D-1661), so there would be nothing to choose as evidence.
 */

import { cloud } from '../cloud';
import { serviceError } from '../attempt';
import { ObjectsError, type ContentType } from './objects';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => Number(v) || 0;
const obj = (data: unknown): Row => (data && typeof data === 'object' && !Array.isArray(data) ? (data as Row) : {});
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(text) : []);

/** The longest an employer share can last, in days. The server refuses longer. */
export const MAX_SHARE_DAYS = 180;
/** How many items one share can name. */
export const MAX_SHARE_ITEMS = 20;

/** One item in your portfolio: a version you chose, with your label. */
export interface Evidence {
  id: string;
  object: string;
  version: string;
  label: string;
  title: string;
  versionNumber: number;
  savedAt: string;
  addedAt: string;
}

/** Somebody who has access now: not revoked, not expired. */
export interface EmployerAccess {
  grant: string;
  employerEmail: string;
  employerScope: string;
  sharedAs: string;
  purpose: string;
  grantedAt: string;
  expiresAt: string;
  /** False when that account no longer acts for the employer: it reads nothing already. */
  employerActive: boolean;
  evidence: string[];
}

export interface Portfolio {
  /** Name this on every add, withdraw, share and revoke. */
  revision: number;
  evidence: Evidence[];
  access: EmployerAccess[];
}

/** What an employer is shown about one share. */
export interface SharedWithMe {
  grant: string;
  sharedAs: string;
  purpose: string;
  employerScope: string;
  grantedAt: string;
  expiresAt: string;
  evidence: { id: string; label: string; title: string; versionNumber: number; savedAt: string }[];
}

/** One item's content, as an employer reads it. */
export interface EvidenceContent {
  grant: string;
  evidence: string;
  label: string;
  title: string;
  body: string;
  contentType: ContentType;
  contentSchema: string;
  versionNumber: number;
  byteLength: number;
  sha256: string;
  savedAt: string;
}

export interface ShareRequest {
  employerEmail: string;
  /** The employer the account acts for, as Semester names it. */
  employerScope: string;
  evidence: string[];
  /** How the employer should know you. */
  sharedAs: string;
  purpose: string;
  expiresAt: string;
}

const NOT_SET_UP = new Set(['42883', '42P01', '42703', 'PGRST202', 'PGRST200', 'PGRST204', 'PGRST205']);

/** A failure from the server, in the same five kinds as `objects.ts`. */
export function evidenceError(error: { message?: string; code?: string } | null | undefined, fallback: string): ObjectsError {
  const code = typeof error?.code === 'string' ? error.code : '';
  if (NOT_SET_UP.has(code)) return new ObjectsError('Sharing evidence with employers is not set up at your school yet.', true, 'not-set-up');
  if (code === '40001') return new ObjectsError('Your portfolio changed since you opened it. Reload it, then try again.', true, 'stale');
  if (code === '23505') return new ObjectsError('That was already sent with different details. Try again.', true, 'conflict');
  const e = serviceError(error, fallback);
  return new ObjectsError(e.message, e.answered, e.answered ? 'refused' : 'unknown');
}

/** Why this share cannot be sent, or null when it can. The server checks the same. */
export function shareProblem(req: ShareRequest, now: Date = new Date()): string | null {
  if (req.employerEmail.trim() === '') return 'Enter the employer’s address.';
  if (req.employerScope.trim() === '') return 'Name the employer.';
  const items = new Set(req.evidence);
  if (items.size === 0) return 'Choose at least one piece of evidence.';
  if (items.size > MAX_SHARE_ITEMS) return `Choose at most ${MAX_SHARE_ITEMS} pieces of evidence.`;
  const as = req.sharedAs.trim();
  if (as === '' || as.length > 80) return 'Say in up to 80 characters how the employer should know you.';
  const why = req.purpose.trim();
  if (why === '' || why.length > 200) return 'Say in up to 200 characters what it is shared for.';
  const ends = Date.parse(req.expiresAt);
  if (!Number.isFinite(ends) || ends <= now.getTime()) return 'Choose when the share ends.';
  if (ends > now.getTime() + MAX_SHARE_DAYS * 86_400_000) return `A share with an employer ends within ${MAX_SHARE_DAYS} days.`;
  return null;
}

/** Your portfolio: its revision, the evidence in it, and who has access now. */
export async function loadPortfolio(): Promise<Portfolio> {
  const db = await cloud();
  const { data, error } = await db.rpc('career_evidence_mine');
  if (error) throw evidenceError(error, 'Could not load your portfolio.');
  const r = obj(data);
  return {
    revision: num(r.revision),
    evidence: rows(r.evidence).map((e) => ({
      id: text(e.evidence),
      object: text(e.object),
      version: text(e.version),
      label: text(e.label),
      title: text(e.title),
      versionNumber: num(e.version_number),
      savedAt: text(e.saved_at),
      addedAt: text(e.added_at),
    })),
    access: rows(r.grants).map((g) => ({
      grant: text(g.grant),
      employerEmail: text(g.employer_email),
      employerScope: text(g.employer_scope),
      sharedAs: text(g.shared_as),
      purpose: text(g.purpose),
      grantedAt: text(g.granted_at),
      expiresAt: text(g.expires_at),
      employerActive: g.employer_active === true,
      evidence: ids(g.evidence),
    })),
  };
}

/** Add one saved version to your portfolio. */
export async function addEvidence(versionId: string, label: string, expectedRevision: number, key: string): Promise<{ evidence: string; revision: number }> {
  const db = await cloud();
  const { data, error } = await db.rpc('career_evidence_add', {
    want_version: versionId,
    want_label: label,
    want_expected_revision: expectedRevision,
    want_key: key,
  });
  if (error) throw evidenceError(error, 'It was not added to your portfolio.');
  const r = obj(data);
  return { evidence: text(r.evidence), revision: num(r.revision) };
}

/** Take an item out of your portfolio. Every share naming it stops showing it. */
export async function withdrawEvidence(evidenceId: string, expectedRevision: number, key: string): Promise<{ evidence: string; withdrawnAt: string; revision: number }> {
  const db = await cloud();
  const { data, error } = await db.rpc('career_evidence_withdraw', {
    want_evidence: evidenceId,
    want_expected_revision: expectedRevision,
    want_key: key,
  });
  if (error) throw evidenceError(error, 'It was not taken out of your portfolio.');
  const r = obj(data);
  return { evidence: text(r.evidence), withdrawnAt: text(r.withdrawn_at), revision: num(r.revision) };
}

/** Share named evidence with one employer until `expiresAt`. */
export async function shareWithEmployer(req: ShareRequest, expectedRevision: number, key: string): Promise<{ grant: string; expiresAt: string; revision: number }> {
  const db = await cloud();
  const { data, error } = await db.rpc('career_evidence_grant', {
    want_employer_email: req.employerEmail,
    want_employer_scope: req.employerScope,
    want_evidence: [...new Set(req.evidence)],
    want_shared_as: req.sharedAs,
    want_purpose: req.purpose,
    want_expires_at: req.expiresAt,
    want_expected_revision: expectedRevision,
    want_key: key,
  });
  if (error) throw evidenceError(error, 'It was not shared.');
  const r = obj(data);
  return { grant: text(r.grant), expiresAt: text(r.expires_at), revision: num(r.revision) };
}

/** End an employer's access now. Revoking one already revoked answers when it was. */
export async function revokeEmployer(grantId: string, expectedRevision: number, key: string): Promise<{ grant: string; revokedAt: string; revision: number }> {
  const db = await cloud();
  const { data, error } = await db.rpc('career_evidence_revoke', {
    want_grant: grantId,
    want_expected_revision: expectedRevision,
    want_key: key,
  });
  if (error) throw evidenceError(error, 'Access was not ended.');
  const r = obj(data);
  return { grant: text(r.grant), revokedAt: text(r.revoked_at), revision: num(r.revision) };
}

/** For an employer: the live shares made to you. */
export async function sharedWithMe(): Promise<SharedWithMe[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('career_evidence_shared_with_me');
  if (error) throw evidenceError(error, 'Could not load what was shared with you.');
  return rows(data).map((g) => ({
    grant: text(g.grant),
    sharedAs: text(g.shared_as),
    purpose: text(g.purpose),
    employerScope: text(g.employer_scope),
    grantedAt: text(g.granted_at),
    expiresAt: text(g.expires_at),
    evidence: rows(g.evidence).map((e) => ({
      id: text(e.evidence),
      label: text(e.label),
      title: text(e.title),
      versionNumber: num(e.version_number),
      savedAt: text(e.saved_at),
    })),
  }));
}

/** For an employer: one item's content. Ended, withdrawn and unknown all read as not found. */
export async function readEvidence(grantId: string, evidenceId: string): Promise<EvidenceContent> {
  const db = await cloud();
  const { data, error } = await db.rpc('career_evidence_read', { want_grant: grantId, want_evidence: evidenceId });
  if (error) throw evidenceError(error, 'Could not open it.');
  const r = obj(data);
  return {
    grant: text(r.grant),
    evidence: text(r.evidence),
    label: text(r.label),
    title: text(r.title),
    body: text(r.body),
    contentType: text(r.mime_type) as ContentType,
    contentSchema: text(r.content_schema),
    versionNumber: num(r.version_number),
    byteLength: num(r.byte_length),
    sha256: text(r.content_sha256),
    savedAt: text(r.saved_at),
  };
}
