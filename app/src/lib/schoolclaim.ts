/**
 * Proving which university you are at, to the server rather than to yourself.
 *
 * `supabase/migrations/20260921170000_schools.sql` is the enforcement and
 * this module is the way in and the words. The rule it implements is one the
 * project wrote down and then had to give up for a while:
 * `20260901000300_classmates_schools.sql` removed the `@vanderbilt.edu` test
 * from `verified_student()` because a per-school check inside a policy refused
 * every student at every other university, and it said what that cost —
 * "a client check is not security, and this file has always said the policies
 * are the security."
 *
 * So the claim is not a field this module writes. Both API roles are off the
 * insert and update column lists for `profiles.school_id`, so the only way in
 * is `claim_school()`, which reads the address the server confirmed.
 *
 * That sentence used to say the column's UPDATE privilege was *revoked*, which
 * is what `20260921170000_schools.sql` tried and what Postgres declined to do:
 * a column-level revoke cannot subtract from a table-level grant, and for a
 * while the column was writable by the account it describes.
 * `20260921211500_pin_profile_school.sql` is the fix and
 * `supabase/tenancy.check.sql` is what would now notice. Nothing here
 * can admit anybody, which is the property worth having: if this file were
 * replaced wholesale by something that returned "yes" to everything, no row
 * would change.
 *
 * ## Why it refuses out loud
 *
 * The function raises rather than returning false, and these two helpers pass
 * the reason through rather than flattening it to a boolean. A claim that
 * quietly does nothing is one a screen reports as success, and a column whose
 * whole value is that it cannot be bluffed must not have a failure mode that
 * looks like a win.
 */
import { cloud, cloudConfigured } from './cloud';

/** A university the server knows, as the picker needs it. */
export interface KnownSchool {
  id: string;
  name: string;
  shortName: string;
  /** Lower case, no '@'. Empty means nobody can claim this one yet. */
  domains: string[];
}

/** What came back from an attempt to claim one. */
export type Claim =
  | { ok: true; schoolId: string }
  | { ok: false; because: string };

/**
 * The domain of an address, taken from the last '@'.
 *
 * Not `split('@')[1]`: a quoted local part may contain one, so
 * `"a@b"@vanderbilt.edu` splits to `b"` — which matches nothing and so fails
 * closed, but for the wrong reason, and a reason that would be very hard to
 * read off a screen saying "that address is not one Vanderbilt publishes".
 * The migration takes the same last-'@' reading, deliberately.
 */
export function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  return at < 0 ? '' : address.slice(at + 1).trim().toLowerCase();
}

/**
 * Whether an address *looks* claimable for a school, for the screen only.
 *
 * This is the sentence a form shows before anybody presses anything, so that
 * the refusal is not the first time somebody learns their alumni address will
 * not work. It is not a permission check and must never be read as one — the
 * server asks the same question again, of the address it confirmed rather than
 * the one that was typed.
 */
export function looksClaimable(address: string, school: KnownSchool): boolean {
  const domain = domainOf(address);
  return domain !== '' && school.domains.some((d) => d.trim().toLowerCase() === domain);
}

/** Every university the server knows. Empty when this build has no backend. */
export async function knownSchools(): Promise<KnownSchool[]> {
  if (!cloudConfigured) return [];
  const db = await cloud();
  const { data, error } = await db
    .from('schools')
    .select('id, name, short_name, email_domains')
    .order('name');
  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    shortName: String(r.short_name ?? ''),
    domains: Array.isArray(r.email_domains) ? r.email_domains.map(String) : [],
  }));
}

/**
 * Claim one, and say plainly what happened.
 *
 * The messages Postgres raises are written for a person and are passed through
 * as they are — "confirm your address before claiming a school", "that address
 * is not one vanderbilt publishes". Rewriting them here would mean two places
 * that have to agree about what the server decided, which is the shape of
 * every stale-message bug in this repository.
 */
export async function claimSchool(schoolId: string): Promise<Claim> {
  if (!cloudConfigured) {
    return { ok: false, because: 'This build has no account server, so there is nobody to tell.' };
  }
  const db = await cloud();
  const { data, error } = await db.rpc('claim_school', { want: schoolId });
  if (error) return { ok: false, because: error.message };
  return { ok: true, schoolId: String(data ?? schoolId) };
}

/**
 * The school the server currently believes you are at, or '' — and a failed
 * request throws rather than reading as "no school". Screens that must tell a
 * dropped request from an account with no claim (the Notices hub) use this.
 */
export async function claimedSchoolOrThrow(): Promise<string> {
  if (!cloudConfigured) return '';
  const db = await cloud();
  const { data, error } = await db.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw new Error(error.message);
  const id = data.user?.id;
  if (!id) return '';
  const { data: row, error: rowError } = await db
    .from('profiles')
    .select('school_id')
    .eq('user_id', id)
    .maybeSingle();
  if (rowError) throw new Error(rowError.message);
  return row?.school_id ? String(row.school_id) : '';
}

/** The school the server currently believes you are at, or ''. A failure reads as ''. */
export async function claimedSchool(): Promise<string> {
  try {
    return await claimedSchoolOrThrow();
  } catch {
    return '';
  }
}

/**
 * The same, with the third answer kept: `null` when the read failed, so a
 * screen can say it could not check instead of treating "could not read" as "at
 * no university". Anything that acts on an empty answer (the automatic claim)
 * must use this one, because moving a person who is already somewhere is worse
 * than not claiming.
 */
export async function claimedSchoolOrUnknown(): Promise<string | null> {
  try {
    return await claimedSchoolOrThrow();
  } catch {
    return null;
  }
}

// ── Membership: asking, leaving, deciding ──────────────────────────────────
//
// The server is the authority on all of it (`20260930100000_school_membership_
// enforcement.sql`); these are the way in and the words. Nothing here can put
// anybody in a school. A request grants nothing until a person at that school
// approves it, and a claim works only for an address the school publishes.

/** A request as the requester sees it. */
export interface MyRequest {
  id: string;
  schoolId: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string;
}

/** A waiting request as a school's administrator sees it: a handle, never an address. */
export interface WaitingRequest {
  id: string;
  handle: string;
  note: string;
  createdAt: string;
}

/** What switching a school's rooms to members-only would do. Counts, never people. */
export interface Readiness {
  enforced: boolean;
  members: number;
  enrolled: number;
  lockedOut: number;
  pending: number;
}

type Done = { ok: true } | { ok: false; because: string };

/**
 * Whether to claim a school for this account without asking.
 *
 * Only when the choice is unambiguous: nothing claimed yet, the person has not
 * left a university on purpose, and exactly ONE known school publishes the
 * address's domain. Two schools publishing one domain (a system with several
 * campuses) is a question for the person, not a guess. The server checks the
 * confirmed address again; this only decides whether to ask it.
 */
export function shouldAutoClaim(
  address: string,
  schools: KnownSchool[],
  claimed: string,
  declined: boolean,
): KnownSchool | null {
  if (claimed || declined || !address) return null;
  const fits = schools.filter((school) => looksClaimable(address, school));
  return fits.length === 1 ? fits[0] : null;
}

/** Remembers, on this device, that the person left — so it is not undone for them. */
export const declinedKey = (accountId: string) => `semester.school.declined:${accountId}`;

export function autoClaimDeclined(accountId: string): boolean {
  try {
    return localStorage.getItem(declinedKey(accountId)) === '1';
  } catch {
    return false;
  }
}

export function rememberDeclined(accountId: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(declinedKey(accountId), '1');
    else localStorage.removeItem(declinedKey(accountId));
  } catch {
    // Without storage the worst case is being asked again, which is safe.
  }
}

async function call(fn: string, args: Record<string, unknown>): Promise<Done> {
  if (!cloudConfigured) return { ok: false, because: 'This build has no account server.' };
  const { error } = await (await cloud()).rpc(fn, args);
  return error ? { ok: false, because: error.message } : { ok: true };
}

export const requestMembership = (schoolId: string, why: string) =>
  call('request_school_membership', { want: schoolId, why });
export const withdrawRequest = (id: string) => call('withdraw_school_request', { req: id });
export const leaveSchool = () => call('leave_school', {});
export const decideRequest = (id: string, approve: boolean) =>
  call('decide_school_request', { req: id, approve, why: '' });

/**
 * Whether this school's rooms are limited to its members. `null` when that
 * could not be read (a failed query or no such row): a setting that could not
 * be checked is not the same as one that is off, and the screen says which.
 */
export async function schoolEnforced(schoolId: string): Promise<boolean | null> {
  if (!cloudConfigured || !schoolId) return false;
  const { data, error } = await (await cloud()).from('schools').select('enforce_membership').eq('id', schoolId).maybeSingle();
  if (error || !data) return null;
  return data.enforce_membership === true;
}

/** The requests this account made. Own rows only: an administrator's list is `waitingFor`. */
export async function myRequests(userId: string): Promise<MyRequest[]> {
  if (!cloudConfigured) return [];
  const { data, error } = await (await cloud())
    .from('school_membership_requests')
    .select('id, school_id, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: String(r.id),
    schoolId: String(r.school_id),
    status: r.status as MyRequest['status'],
    createdAt: String(r.created_at),
  }));
}

/** Waiting requests at a school, for someone who may decide them; [] for anyone else. */
export async function waitingFor(schoolId: string): Promise<WaitingRequest[]> {
  if (!cloudConfigured || !schoolId) return [];
  const { data, error } = await (await cloud()).rpc('school_requests_for_admin', { want: schoolId });
  if (error || !Array.isArray(data)) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    handle: String(r.handle ?? ''),
    note: String(r.note ?? ''),
    createdAt: String(r.created_at ?? ''),
  }));
}

/** Counts for a school's administrator; null for anyone who may not see them. */
export async function readinessOf(schoolId: string): Promise<Readiness | null> {
  if (!cloudConfigured || !schoolId) return null;
  const { data, error } = await (await cloud()).rpc('school_enforcement_readiness', { want: schoolId });
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  return {
    enforced: d.enforced === true,
    members: Number(d.members ?? 0),
    enrolled: Number(d.enrolled ?? 0),
    lockedOut: Number(d.locked_out ?? 0),
    pending: Number(d.pending_requests ?? 0),
  };
}
