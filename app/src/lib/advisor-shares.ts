import { readSharePayload, type SharePayload } from './advisor-meeting';
import { requireOnline } from './offline-mode';
import { cloud } from './cloud';

/**
 * Authorized advisor shares (Phase G, D-016), against
 * `supabase/migrations/20260928301000_advisor_shares.sql`.
 *
 * - **Sharing** goes through `share_with_advisor`, which only finds the
 *   address among advisors at the student's own school. A miss always reads
 *   the same, so an address cannot be probed.
 * - **Every share expires**, at most 120 days out; the student picks when.
 * - **Revoking** sets `revoked_at`; the database refuses to clear it.
 * - **The advisor** never reads the table: `read_advisor_share` checks the
 *   share is live and logs the read, and the student sees the log.
 *
 * There is no link-based or anonymous access (D-016).
 */

export const EXPIRY_CHOICES = [
  { days: 7, label: 'One week' },
  { days: 30, label: 'One month' },
  { days: 90, label: 'Three months' },
  { days: 120, label: 'Four months (the most allowed)' },
] as const;
export const MAX_EXPIRY_DAYS = 120;
export const MAX_PAYLOAD_BYTES = 32_768;

export interface ShareRow {
  id: string;
  title: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface ShareEvent {
  share_id: string;
  read_at: string;
}

export type ShareState = 'active' | 'expired' | 'revoked';

export function shareState(row: Pick<ShareRow, 'expires_at' | 'revoked_at'>, now: number): ShareState {
  if (row.revoked_at) return 'revoked';
  return Date.parse(row.expires_at) <= now ? 'expired' : 'active';
}

export function expiryFrom(days: number, now: number): string {
  if (!Number.isInteger(days) || days < 1 || days > MAX_EXPIRY_DAYS) throw new Error(`Choose between 1 and ${MAX_EXPIRY_DAYS} days.`);
  return new Date(now + days * 86_400_000).toISOString();
}

/** Refuses what the database would refuse, with a sentence a student can act on. */
export function checkPayload(p: SharePayload): void {
  if (new TextEncoder().encode(JSON.stringify(p)).length > MAX_PAYLOAD_BYTES) {
    throw new Error('This meeting is too long to share. Remove some items or attached courses.');
  }
  if (!p.agenda.length && !p.questions.length) throw new Error('Add an agenda item or a question before sharing.');
}

export const plausibleEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

/** The one message every failed lookup gets, whatever the server said about it. */
export const NO_ADVISOR = 'No advisor at your school uses that address in Semester. Check it with your advisor.';

export async function shareWithAdvisor(email: string, title: string, payload: SharePayload, days: number, now = Date.now()): Promise<string> {
  requireOnline('share');
  if (!plausibleEmail(email)) throw new Error('Enter your advisor’s school email address.');
  checkPayload(payload);
  const { data, error } = await (await cloud()).rpc('share_with_advisor', {
    advisor_email: email.trim(),
    share_title: title.trim().slice(0, 120) || 'Advisor meeting',
    share_payload: payload,
    share_expires: expiryFrom(days, now),
  });
  if (error) {
    if (/no advisor/i.test(error.message)) throw new Error(NO_ADVISOR);
    if (/school on your profile/i.test(error.message)) throw new Error('Set your school on your profile to share with an advisor.');
    throw new Error(error.message);
  }
  return data as string;
}

/**
 * The student's own shares, newest first, each with when it was opened. The
 * read log comes embedded in the same select: its rows belong to the shares
 * and go when a share is deleted (the foreign key cascades).
 */
export async function myShares(): Promise<{ shares: ShareRow[]; events: ShareEvent[] }> {
  const { data, error } = await (await cloud())
    .from('advisor_shares')
    .select('id, title, created_at, expires_at, revoked_at, advisor_share_events(read_at)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as (ShareRow & { advisor_share_events?: { read_at: string }[] })[];
  return {
    shares: rows.map(({ advisor_share_events: _events, ...row }) => row),
    events: rows
      .flatMap((r) => (r.advisor_share_events ?? []).map((e) => ({ share_id: r.id, read_at: e.read_at })))
      .sort((a, b) => b.read_at.localeCompare(a.read_at)),
  };
}

export async function revokeShare(id: string, now = Date.now()): Promise<void> {
  const { error } = await (await cloud()).from('advisor_shares').update({ revoked_at: new Date(now).toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteShare(id: string): Promise<void> {
  const { error } = await (await cloud()).from('advisor_shares').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export interface SharedWithMe {
  id: string;
  title: string;
  shared_as: string;
  created_at: string;
  expires_at: string;
}

/** For an advisor: live shares addressed to them. Titles only; nothing is logged. */
export async function sharedWithMe(): Promise<SharedWithMe[]> {
  const { data, error } = await (await cloud()).rpc('list_advisor_shares');
  if (error) throw new Error(error.message);
  return (data ?? []) as SharedWithMe[];
}

/** For an advisor: one share's contents. The student sees that it was opened. */
export async function openShare(id: string): Promise<{ title: string; payload: SharePayload; expires_at: string }> {
  const { data, error } = await (await cloud()).rpc('read_advisor_share', { want_share: id });
  if (error) throw new Error(/not shared/i.test(error.message) ? 'This share has expired or was revoked.' : error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { title: string; payload: unknown; expires_at: string } | undefined;
  if (!row) throw new Error('This share has expired or was revoked.');
  return { title: row.title, expires_at: row.expires_at, payload: readSharePayload(row.payload) };
}
