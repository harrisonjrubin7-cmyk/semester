/**
 * The reviewer's side of the procurement room: two calls to the `trust-room`
 * function (supabase/functions/_shared/trustroom.ts), and nothing trusted
 * about what comes back.
 *
 * Read by `screens/TrustRoom.tsx`, which is mounted in place of the app for a
 * reviewer with no account. So this is kept away from `lib/cloud.ts` and the
 * Supabase client: a stranger opening a link downloads the page, this file and
 * `fetch`, and nothing else.
 *
 * ## What it refuses to believe
 *
 * - **A URL from anywhere but this project's storage.** The function should
 *   only ever return a signed URL on the project's own origin. If a response
 *   says otherwise, it is treated as a failure rather than opened: this page
 *   is the one place a link from the server becomes a page the reviewer
 *   visits, and it will not visit somewhere it was not expecting.
 * - **A response of the wrong shape.** Every field is checked before a screen
 *   sees it.
 *
 * The token travels in a POST body with `no-store`, `omit` credentials and no
 * referrer, the same way the function takes it.
 */

const env = import.meta.env as unknown as Record<string, string | undefined>;

export interface RoomItem {
  artifact: string;
  title: string;
  version: string;
  sourceCommit: string | null;
}

export type Listed =
  | { kind: 'ok'; packetCommit: string; expiresAt: string; items: RoomItem[] }
  | { kind: 'not_found' }
  | { kind: 'offline' };

export type Opened =
  | { kind: 'ok'; url: string; title: string; version: string; seconds: number }
  | { kind: 'not_found' }
  | { kind: 'unavailable' }
  | { kind: 'offline' };

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** The function's address for this build, or '' when the build has no project. */
export function roomEndpoint(base = env.VITE_SUPABASE_URL ?? ''): string {
  return base ? `${base.replace(/\/$/, '')}/functions/v1/trust-room` : '';
}

const HEX40 = /^[0-9a-f]{40}$/;
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 400;

async function call(body: Record<string, string>, fetcher: Fetch, endpoint: string, key: string): Promise<Response | null> {
  if (!endpoint) return null;
  try {
    return await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { apikey: key } : {}) },
      body: JSON.stringify(body),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    return null;
  }
}

async function json(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await res.json();
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function listRoom(
  token: string,
  fetcher: Fetch = fetch,
  endpoint = roomEndpoint(),
  key = env.VITE_SUPABASE_KEY ?? '',
): Promise<Listed> {
  const res = await call({ token }, fetcher, endpoint, key);
  if (!res) return { kind: 'offline' };
  if (res.status === 404) return { kind: 'not_found' };
  if (!res.ok) return { kind: 'offline' };
  const b = await json(res);
  if (!b || !str(b.packet_commit) || !HEX40.test(b.packet_commit) || !str(b.expires_at) || !Array.isArray(b.items)) {
    return { kind: 'offline' };
  }
  const items: RoomItem[] = [];
  for (const i of b.items as unknown[]) {
    const r = i as Record<string, unknown>;
    if (!r || !str(r.artifact) || !str(r.title) || !str(r.version)) return { kind: 'offline' };
    items.push({
      artifact: r.artifact,
      title: r.title,
      version: r.version,
      sourceCommit: str(r.source_commit) && HEX40.test(r.source_commit) ? r.source_commit : null,
    });
  }
  return { kind: 'ok', packetCommit: b.packet_commit, expiresAt: b.expires_at, items };
}

export async function openDocument(
  token: string,
  artifact: string,
  fetcher: Fetch = fetch,
  endpoint = roomEndpoint(),
  key = env.VITE_SUPABASE_KEY ?? '',
): Promise<Opened> {
  const res = await call({ token, artifact }, fetcher, endpoint, key);
  if (!res) return { kind: 'offline' };
  if (res.status === 404) return { kind: 'not_found' };
  if (res.status === 503) return { kind: 'unavailable' };
  if (!res.ok) return { kind: 'offline' };
  const b = await json(res);
  if (!b || !str(b.url) || !str(b.title) || !str(b.version) || typeof b.url_expires_in !== 'number') {
    return { kind: 'offline' };
  }
  let url: URL;
  try {
    url = new URL(b.url);
  } catch {
    return { kind: 'offline' };
  }
  const expected = endpoint ? new URL(endpoint).origin : '';
  if (url.protocol !== 'https:' || url.origin !== expected) return { kind: 'offline' };
  return { kind: 'ok', url: url.toString(), title: b.title, version: b.version, seconds: b.url_expires_in };
}
