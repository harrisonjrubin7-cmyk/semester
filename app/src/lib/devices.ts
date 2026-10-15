import { cloud } from './cloud';
import { dateFormatter } from './locale';

/**
 * Where an account is signed in, one row per browser or phone, and how to end
 * one of them without ending the rest.
 *
 * Supabase Auth has no client call that lists sessions, so the list comes from
 * `my_sessions()` and the idempotent sign-out command from
 * `revoke_my_session()` (20261015120000_session_revocation_receipt.sql). Both
 * read the caller from the token and take no user id. The address a session
 * came from is deliberately not part of the answer: it is somebody's
 * whereabouts, and a browser and a system are enough to tell a laptop from a
 * phone.
 *
 * Ending a session stops that device renewing its sign-in. The short-lived
 * token it already holds works until it expires, which Supabase sets to at most
 * an hour, so the screen says "within the hour" and not "now".
 */

export interface SessionRow {
  id: string;
  startedAt: string;
  lastActiveAt: string;
  /** The browser's own user-agent string. Turned into words by `deviceLabel`. */
  userAgent: string | null;
  isCurrent: boolean;
}

export type SessionRevocationOutcome = 'revoked' | 'already_ended' | 'refused';

export interface SessionRevocationReceipt {
  outcome: SessionRevocationOutcome;
  occurredAt: string;
}

/** "Chrome on Mac", from the browser's own description of itself. */
export function deviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent ?? '';
  if (!ua.trim()) return 'A device';
  // Order matters: Edge and Opera also say Chrome, and Chrome also says Safari.
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\/|FxiOS\//.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  // iPhone and iPad say "like Mac OS X", Android says "Linux": most specific first.
  const system = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Linux|X11/.test(ua) ? 'Linux'
    : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? 'A device';
}

/** Newest activity first, with the device in use at the top where a student looks first. */
export function orderSessions(rows: SessionRow[]): SessionRow[] {
  return [...rows].sort((a, b) =>
    a.isCurrent !== b.isCurrent ? (a.isCurrent ? -1 : 1) : b.lastActiveAt.localeCompare(a.lastActiveAt) || a.id.localeCompare(b.id));
}

export type RawSession = { id: string; created_at: string; last_active: string; user_agent: string | null; is_current: boolean };

/** What `my_sessions()` returned, as rows the screen uses, in the order it shows them. */
export function sessionRows(raw: RawSession[] | null): SessionRow[] {
  return orderSessions(
    (raw ?? []).map((r) => ({
      id: r.id,
      startedAt: r.created_at,
      lastActiveAt: r.last_active,
      userAgent: r.user_agent,
      isCurrent: r.is_current === true,
    })),
  );
}

/** The only command result the account screen is allowed to interpret. */
export function sessionRevocationReceipt(raw: unknown): SessionRevocationReceipt | null {
  if (!Array.isArray(raw) || raw.length !== 1) return null;
  const value = raw[0];
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const outcome = row.outcome;
  const occurredAt = row.occurred_at;
  if (outcome !== 'revoked' && outcome !== 'already_ended' && outcome !== 'refused') return null;
  if (typeof occurredAt !== 'string' || !occurredAt || Number.isNaN(Date.parse(occurredAt))) return null;
  return { outcome, occurredAt };
}

/** A session timestamp never gets to take down the remaining account list. */
export function formatSessionTime(value: string | null | undefined): string {
  if (!value) return 'Time unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Time unavailable';
  try {
    return dateFormatter({ dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  } catch {
    return 'Time unavailable';
  }
}

export async function listSessions(): Promise<SessionRow[]> {
  const { data, error } = await (await cloud()).rpc('my_sessions');
  if (error) throw new Error('SESSION_LIST_UNAVAILABLE');
  return sessionRows(data as RawSession[] | null);
}

/** End one remote session using a caller-retained key that is safe to retry. */
export async function endSession(id: string, requestKey: string): Promise<SessionRevocationReceipt> {
  const { data, error } = await (await cloud()).rpc('revoke_my_session', {
    want: id,
    request_key: requestKey,
  });
  if (error) throw new Error('SESSION_REVOCATION_UNAVAILABLE');
  const receipt = sessionRevocationReceipt(data);
  if (!receipt) throw new Error('SESSION_REVOCATION_UNAVAILABLE');
  return receipt;
}
