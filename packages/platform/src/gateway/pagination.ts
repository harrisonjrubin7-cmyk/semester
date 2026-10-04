/**
 * Pagination: keyset cursors that cannot be forged, replayed across tenants,
 * or reused for a different query.
 *
 * Offset pagination is wrong for this system twice over: it skips and repeats
 * rows when data moves under it (a gradebook being posted to), and it makes
 * deep pages cost more. A cursor here is the *last key seen*, so the next page
 * is `WHERE (sort_key, id) > (…)`.
 *
 * The cursor is opaque to clients and signed (HMAC-SHA-256) over four things:
 * the **tenant**, a hash of the **query** it paginates, the **last key**, and
 * an **expiry**. So a cursor lifted from tenant A's response is refused for
 * tenant B, a cursor for `?status=open` is refused on `?status=closed`, and
 * one cannot be edited to jump to a different position. Signing keys rotate
 * with a `kid` (`CursorKeyRing`); an old key verifies until it is retired.
 */

import { fromBase64Url, hashOf, hmacSha256, timingSafeEqual, toBase64Url, utf8 } from '../kernel/canonical.ts';
import type { Clock } from '../kernel/clock.ts';
import { PlatformError } from './errors.ts';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const CURSOR_TTL_MS = 15 * 60 * 1000;

export interface PageRequest {
  limit?: unknown;
  cursor?: string | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorKeyRing {
  currentKid: string;
  keys: Readonly<Record<string, Uint8Array>>;
}

export interface CursorPosition {
  /** The sort value of the last row returned, as a string or number. */
  sort: string | number;
  /** The tiebreaker: the last row's id. */
  id: string;
}

export function clampLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_PAGE_SIZE;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new PlatformError('invalid_request', 'limit must be a whole number of at least 1.');
  return Math.min(n, MAX_PAGE_SIZE);
}

interface Payload {
  v: 1;
  t: string;
  q: string;
  p: CursorPosition;
  exp: number;
}

export class CursorCodec {
  private readonly ring: CursorKeyRing;
  private readonly clock: Clock;

  constructor(ring: CursorKeyRing, clock: Clock) {
    this.ring = ring;
    this.clock = clock;
    if (!ring.keys[ring.currentKid]) throw new Error('The cursor key ring has no current key.');
  }

  async encode(tenantId: string, query: unknown, position: CursorPosition): Promise<string> {
    const payload: Payload = { v: 1, t: tenantId, q: await hashOf(query), p: position, exp: this.clock.now().getTime() + CURSOR_TTL_MS };
    const body = toBase64Url(utf8(JSON.stringify(payload)));
    const sig = await hmacSha256(this.ring.keys[this.ring.currentKid], utf8(`${this.ring.currentKid}.${body}`));
    return `${this.ring.currentKid}.${body}.${toBase64Url(sig)}`;
  }

  async decode(token: string, tenantId: string, query: unknown): Promise<CursorPosition> {
    const bad = () => new PlatformError('invalid_cursor', 'That page link is no longer valid. Start again from the first page.');
    const parts = token.split('.');
    if (parts.length !== 3) throw bad();
    const [kid, body, sig] = parts;
    const key = Object.prototype.hasOwnProperty.call(this.ring.keys, kid) ? this.ring.keys[kid] : undefined;
    const sigBytes = fromBase64Url(sig);
    if (!key || !sigBytes) throw bad();
    const expected = await hmacSha256(key, utf8(`${kid}.${body}`));
    if (!timingSafeEqual(expected, sigBytes)) throw bad();

    const raw = fromBase64Url(body);
    let payload: Payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(raw ?? new Uint8Array())) as Payload;
    } catch {
      throw bad();
    }
    if (payload.v !== 1 || payload.exp <= this.clock.now().getTime()) throw bad();
    if (payload.t !== tenantId) throw bad();
    if (payload.q !== (await hashOf(query))) throw bad();
    return payload.p;
  }
}

/**
 * Reference keyset pager over an in-memory list. `sortOf` must be stable for a
 * row; rows are ordered by `(sort, id)` ascending. Repositories implement the
 * same contract with a keyset predicate and `limit + 1` to learn if more exist.
 */
export async function paginate<T extends { id: string }>(
  rows: readonly T[],
  sortOf: (row: T) => string | number,
  req: PageRequest,
  deps: { codec: CursorCodec; tenantId: string; query: unknown },
): Promise<Page<T>> {
  const limit = clampLimit(req.limit);
  const ordered = [...rows].sort((a, b) => {
    const x = sortOf(a);
    const y = sortOf(b);
    return x < y ? -1 : x > y ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  let start = 0;
  if (req.cursor) {
    const pos = await deps.codec.decode(req.cursor, deps.tenantId, deps.query);
    start = ordered.findIndex((r) => sortOf(r) > pos.sort || (sortOf(r) === pos.sort && r.id > pos.id));
    if (start === -1) start = ordered.length;
  }
  const items = ordered.slice(start, start + limit);
  const more = start + limit < ordered.length;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: more && last ? await deps.codec.encode(deps.tenantId, deps.query, { sort: sortOf(last), id: last.id }) : null,
  };
}
