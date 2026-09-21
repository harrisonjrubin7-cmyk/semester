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
 * So the claim is not a field this module writes. `profiles.school_id` has its
 * UPDATE privilege revoked from both API roles; the only way in is
 * `claim_school()`, which reads the address the server confirmed. Nothing here
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

/** The school the server currently believes you are at, or ''. */
export async function claimedSchool(): Promise<string> {
  if (!cloudConfigured) return '';
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const id = data.user?.id;
  if (!id) return '';
  const { data: row } = await db
    .from('profiles')
    .select('school_id')
    .eq('user_id', id)
    .maybeSingle();
  return row?.school_id ? String(row.school_id) : '';
}
