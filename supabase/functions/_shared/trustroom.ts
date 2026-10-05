/**
 * The procurement room's file server, as a pure request handler.
 *
 * A reviewer at a university holds a link token minted by
 * `public.trust_room_grant` (20260928100000_trust_room.sql). They have no
 * Semester account, and nothing in `public` may be callable by a signed-out
 * visitor, so this is the only door: it takes the token, asks the database
 * through `trust_room_open` (executable by the service key alone) what the
 * token opens, and hands back either the list of what the grant covers or a
 * one-minute signed URL for one document in the private `trust-packet`
 * bucket.
 *
 * ## What it refuses to do
 *
 * - **Take the token in a URL.** Only `POST` with a JSON body. A token in a
 *   query string lands in proxy, CDN and platform logs; in a body it does not.
 * - **Say why a token failed.** Wrong, revoked, expired, not covering that
 *   document, or `kill.sharing` engaged all answer the same 404. The database
 *   already returns nothing in every one of those cases; this keeps the HTTP
 *   status from undoing that.
 * - **Hand out a storage path.** The list names each document and its
 *   version; only a signed URL, a minute long, ever leaves for the file.
 * - **Be cached or leak a referrer.** Every response is `no-store` and
 *   `no-referrer`, so neither an intermediary nor the bucket sees the page it
 *   came from.
 * - **Report its own errors in detail.** A failure inside is a 500 with no
 *   message: this endpoint is reachable by anyone with the URL.
 *
 * ## Deno-free on purpose
 *
 * Like `cors.ts`, it reads no `Deno.env` and imports no client: the entry
 * point passes in the two things it needs (the database call and the URL
 * signer). That is what lets `app/src/lib/trust/room-server.test.ts` drive
 * every branch under vitest.
 */
import { corsHeaders } from './cors.ts';

/** One row of `trust_room_open`. */
export interface RoomRow {
  artifact_key: string;
  title: string;
  version: string;
  storage_ref: string;
  source_commit: string | null;
  packet_commit: string;
  expires_at: string;
}

export interface RoomDeps {
  /** `trust_room_open(token, artifact)`, called with the service key. */
  open(token: string, artifact: string | null): Promise<RoomRow[]>;
  /** A signed URL for `path` in `bucket`, valid for `seconds`, or null if the object is missing. */
  sign(bucket: string, path: string, seconds: number): Promise<string | null>;
  /** The raw `ALLOWED_ORIGIN` secret, as `cors.ts` reads it. */
  allowedOrigin: string | undefined;
  /** The raw `CORS_ALLOW_DEV` flag: loopback origins are answered only when it is on. */
  allowDev?: string | undefined;
}

export const BUCKET = 'trust-packet';
export const SIGNED_URL_SECONDS = 60;
/** A token and an artifact key, in JSON, are well under this. */
export const MAX_BODY_BYTES = 2048;

const TOKEN = /^[0-9a-f]{64}$/;
const ARTIFACT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** The shape the migration's check constraint allows for `storage_ref`. */
const STORAGE_REF = /^trust-packet\/([a-z0-9-]+\/[A-Za-z0-9._+-]{1,120})$/;

const SAFETY = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
} as const;

export async function handleTrustRoom(req: Request, deps: RoomDeps): Promise<Response> {
  const cors = corsHeaders(deps.allowedOrigin, req.headers.get('Origin'), deps.allowDev);
  const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { ...cors, ...SAFETY, ...(body === null ? {} : { 'Content-Type': 'application/json' }), ...extra },
    });

  if (req.method === 'OPTIONS') return reply(204, null);
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' }, { Allow: 'POST, OPTIONS' });

  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return reply(413, { error: 'too_large' });
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reply(413, { error: 'too_large' });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'bad_request' });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return reply(400, { error: 'bad_request' });
  const { token, artifact = null, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return reply(400, { error: 'bad_request' });
  if (typeof token !== 'string' || !TOKEN.test(token)) return reply(404, { error: 'not_found' });
  if (artifact !== null && (typeof artifact !== 'string' || !ARTIFACT.test(artifact))) {
    return reply(400, { error: 'bad_request' });
  }

  try {
    const rows = await deps.open(token, artifact);
    if (rows.length === 0) return reply(404, { error: 'not_found' });

    if (artifact === null) {
      return reply(200, {
        packet_commit: rows[0].packet_commit,
        expires_at: rows[0].expires_at,
        items: rows.map((r) => ({
          artifact: r.artifact_key,
          title: r.title,
          version: r.version,
          source_commit: r.source_commit,
        })),
      });
    }

    const row = rows[0];
    const path = STORAGE_REF.exec(row.storage_ref)?.[1];
    if (!path) return reply(500, { error: 'server_error' });
    const url = await deps.sign(BUCKET, path, SIGNED_URL_SECONDS);
    if (!url) return reply(503, { error: 'unavailable' });
    return reply(200, {
      artifact: row.artifact_key,
      title: row.title,
      version: row.version,
      source_commit: row.source_commit,
      packet_commit: row.packet_commit,
      url,
      url_expires_in: SIGNED_URL_SECONDS,
    });
  } catch {
    return reply(500, { error: 'server_error' });
  }
}
