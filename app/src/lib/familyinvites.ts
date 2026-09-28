import { cloud, cloudConfigured } from './cloud';
import type { FamilyItem, FamilyMember } from './family';
import { SHARE_MAX_DAYS, checkSupporterPlan, daysBetween } from './sharing';

/**
 * Share codes for supporter plans: the client side of
 * `supabase/migrations/20260928306000_family_invites.sql` (D-037, slice 2).
 *
 * A student turns a finished plan into eight characters and hands them over
 * themselves; whoever enters them becomes the recipient of an accepted grant.
 * Nothing here sends anything to anybody. The database does the deciding — it
 * refuses a code that grants nothing, a level other than `selected`, a grant
 * past 200 days — and this side only asks, and says what the answer means.
 */

/** Read down a phone: no 0, O, 1, I, L or U, matching the column's check. */
const ALPHABET = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

/** What was typed, as the code it is meant to be, or '' if it cannot be one. */
export function normaliseCode(typed: string): string {
  const code = typed.toUpperCase().replace(/[\s-]/g, '');
  return ALPHABET.test(code) ? code : '';
}

export interface InviteRequest {
  categories: string[];
  resources: string[];
  days: number;
}

/**
 * What `make_family_invite` will be asked for, from a plan that passes the
 * sharing rules, or the reasons it does not. The items are the plan's own
 * chosen items; the categories are the ones those items are in, and no other.
 */
export function inviteRequest(member: FamilyMember, items: FamilyItem[], today: string): InviteRequest | { problems: string[] } {
  const check = checkSupporterPlan(member, items, today);
  if (check.problems.length) return { problems: check.problems };
  return {
    categories: [...new Set(check.items.map((i) => i.category))],
    resources: check.items.map((i) => i.id),
    // Through the end date, inclusive, so a plan ending today still gets its
    // day — and never past the cap, which the database refuses (D4).
    days: Math.min(SHARE_MAX_DAYS, Math.max(1, daysBetween(today, member.expires) + 1)),
  };
}

export async function makeInvite(req: InviteRequest): Promise<string> {
  const { data, error } = await (await cloud()).rpc('make_family_invite', {
    want_categories: req.categories,
    want_access: 'selected',
    want_resources: req.resources,
    want_days: req.days,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : '';
}

export type ClaimWord = 'claimed' | 'unknown' | 'taken' | 'yourself';

export async function claimInvite(code: string): Promise<ClaimWord> {
  const { data, error } = await (await cloud()).rpc('claim_family_invite', { given: code });
  if (error) throw new Error(error.message);
  return (typeof data === 'string' ? data : 'unknown') as ClaimWord;
}

/**
 * The sentence for the database's word. `unknown` covers a code that never
 * existed, one that lapsed and one that was called off, on purpose (see the
 * migration): a different answer for "that code was real" is an oracle for
 * guessing, handed to somebody who by definition holds no valid code.
 */
export function sayClaim(word: ClaimWord): string {
  switch (word) {
    case 'claimed':
      return 'Accepted. What the student chose to share is now shared with you, until the date they set.';
    case 'taken':
      return 'That code has already been used. Each code works once; ask the student for a new one.';
    case 'yourself':
      return 'That is your own code. Hand it to the person it is for.';
    default:
      return 'That code does not work. Codes last seven days and work once; ask the student for a new one.';
  }
}

export interface InviteRow {
  code: string;
  categories: string[];
  /** The items the code names, so a screen can tell which person's plan it came from. */
  resourceIds: string[];
  expiresAt: string;
  grantExpiresAt: string;
  claimedAt: string | null;
  revokedAt: string | null;
}

/** The student's own codes, newest first. RLS returns only theirs. */
export async function listInvites(): Promise<InviteRow[]> {
  if (!cloudConfigured) return [];
  const { data, error } = await (await cloud())
    .from('family_invites')
    .select('code, categories, resource_ids, expires_at, grant_expires_at, claimed_at, revoked_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    code: String(r.code),
    categories: Array.isArray(r.categories) ? (r.categories as string[]) : [],
    resourceIds: Array.isArray(r.resource_ids) ? (r.resource_ids as string[]) : [],
    expiresAt: String(r.expires_at),
    grantExpiresAt: String(r.grant_expires_at),
    claimedAt: (r.claimed_at as string | null) ?? null,
    revokedAt: (r.revoked_at as string | null) ?? null,
  }));
}

/** Call off a code that has not been claimed. The one write a student makes to this table. */
export async function revokeInvite(code: string): Promise<void> {
  const { error } = await (await cloud()).from('family_invites').update({ revoked_at: new Date().toISOString() }).eq('code', code);
  if (error) throw new Error(error.message);
}

/** Where a code stands, in the student's words. */
export function inviteState(row: InviteRow, now = new Date()): string {
  if (row.revokedAt) return 'Called off';
  if (row.claimedAt) return `Accepted ${row.claimedAt.slice(0, 10)}`;
  if (row.expiresAt <= now.toISOString()) return 'Lapsed unclaimed';
  return `Waiting · works until ${row.expiresAt.slice(0, 10)}`;
}
