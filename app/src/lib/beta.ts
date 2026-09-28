/**
 * The member's half of the invite-only private beta.
 *
 * Every call is an RPC. The beta tables have no grant at all
 * (`supabase/migrations/20260928220000_private_beta.sql`), so there is no
 * `.from()` here to get wrong. Each function answers for the signed-in caller
 * and nobody else. The staff half — programs, cohorts, invitations,
 * activation, triage — lives in the database functions and is not wrapped
 * here, because no screen in this change calls it; `docs/PRIVATE-BETA-PROGRAM.md`
 * gives the SQL a program manager runs.
 *
 * The mapping functions are exported and pure so a test can hold them to the
 * row shapes without a database.
 */
import { cloud } from './cloud';

export const FEEDBACK_KINDS = ['bug', 'confusing', 'accessibility', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_LABELS: Record<FeedbackKind, string> = {
  bug: 'Something is broken',
  confusing: 'Something is confusing',
  accessibility: 'An accessibility barrier',
  idea: 'An idea',
  other: 'Something else',
};

const COHORT_LABELS: Record<string, string> = {
  students: 'Students',
  transfer_students: 'Transfer students',
  faculty_tas: 'Faculty and TAs',
  advisors_staff: 'Advisors and staff',
  accessibility_testers: 'Accessibility testers',
  tenant_admins: 'University administrators',
};

export const cohortLabel = (kind: string) => COHORT_LABELS[kind] ?? kind;

export interface BetaInvitation {
  invitationId: string;
  programName: string;
  cohortKind: string;
  supportContact: string;
}

export interface BetaMembership {
  programId: string;
  programName: string;
  cohortKind: string;
  status: string;
  /** Active *and* writeback stopped for its scope. Otherwise it reads as paused. */
  live: boolean;
  supportContact: string;
  joinedAt: string;
  flags: { key: string; about: string }[];
}

export interface KnownIssue {
  id: string;
  title: string;
  detail: string;
  workaround: string;
  status: 'open' | 'fixed' | 'wont_fix';
  updatedAt: string;
}

type Row = Record<string, unknown>;

export function toInvitation(row: Row): BetaInvitation {
  return {
    invitationId: String(row.invitation_id),
    programName: String(row.program_name),
    cohortKind: String(row.cohort_kind),
    supportContact: String(row.support_contact),
  };
}

export function toMembership(row: Row): BetaMembership {
  const flags = Array.isArray(row.flags) ? (row.flags as Row[]) : [];
  return {
    programId: String(row.program_id),
    programName: String(row.program_name),
    cohortKind: String(row.cohort_kind),
    status: String(row.status),
    // Strictly true. A missing or malformed column must never read as live.
    live: row.live === true,
    supportContact: String(row.support_contact),
    joinedAt: String(row.joined_at),
    flags: flags.map((f) => ({ key: String(f.key), about: String(f.about ?? '') })),
  };
}

export function toIssue(row: Row): KnownIssue {
  const status = row.status === 'fixed' || row.status === 'wont_fix' ? row.status : 'open';
  return {
    id: String(row.id),
    title: String(row.title),
    detail: String(row.detail ?? ''),
    workaround: String(row.workaround ?? ''),
    status,
    updatedAt: String(row.updated_at),
  };
}

const fail = (error: { message?: string } | null, fallback: string) =>
  new Error(error?.message?.trim() || fallback);

export async function loadBeta(): Promise<{
  invitation: BetaInvitation | null;
  membership: BetaMembership | null;
  issues: KnownIssue[];
}> {
  const db = await cloud();
  const [mine, invited] = await Promise.all([db.rpc('my_beta'), db.rpc('beta_invitation_for_me')]);
  if (mine.error) throw fail(mine.error, 'Could not load your beta.');
  if (invited.error) throw fail(invited.error, 'Could not check for a beta invitation.');
  const membership = ((mine.data ?? []) as Row[]).map(toMembership)[0] ?? null;
  const invitation = ((invited.data ?? []) as Row[]).map(toInvitation)[0] ?? null;
  if (!membership) return { invitation, membership, issues: [] };
  const known = await db.rpc('beta_known_issues_for_me');
  if (known.error) throw fail(known.error, 'Could not load known issues.');
  return { invitation, membership, issues: ((known.data ?? []) as Row[]).map(toIssue) };
}

export async function joinBeta(invitationId: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('join_beta', { want_invitation: invitationId });
  if (error) throw fail(error, 'Could not join the beta.');
}

/**
 * What the member wrote and its kind, and nothing else. The database takes a
 * route shape too, for a later caller that knows which screen the member was
 * on; this panel lives on Help, where the answer would always be Help.
 */
export async function sendBetaFeedback(kind: FeedbackKind, body: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('beta_send_feedback', {
    want_kind: kind,
    want_body: body.trim(),
    want_route: '',
  });
  if (error) throw fail(error, 'Could not send your feedback.');
}

export async function leaveBeta(reason: string, keepsAccount: boolean): Promise<void> {
  const db = await cloud();
  const { error } = await db.rpc('leave_beta', { want_reason: reason.trim(), want_keeps_account: keepsAccount });
  if (error) throw fail(error, 'Could not leave the beta.');
}
