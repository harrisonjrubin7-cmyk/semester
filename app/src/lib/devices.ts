import { cloud } from './cloud';

/**
 * Where an account is signed in, one row per browser or phone, and how to end
 * one of them without ending the rest.
 *
 * Supabase Auth has no client call that lists sessions, so the list comes from
 * `my_sessions()` and the sign-out from `end_my_session()`
 * (20261006160000_my_sessions.sql). Both read the caller from the token and
 * take no user id. The address a session came from is deliberately not part of
 * the answer: it is somebody's whereabouts, and a browser and a system are
 * enough to tell a laptop from a phone.
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

export async function listSessions(): Promise<SessionRow[]> {
  const { data, error } = await (await cloud()).rpc('my_sessions');
  if (error) throw new Error(error.message);
  return sessionRows(data as RawSession[] | null);
}

/** True when the session was ended; false when there was no such session of yours. */
export async function endSession(id: string): Promise<boolean> {
  const { data, error } = await (await cloud()).rpc('end_my_session', { want: id });
  if (error) throw new Error(error.message);
  return data === true;
}
