/**
 * The shared client SDK: how a Semester surface (web, mobile, console, a
 * partner) talks to the gateway so the standards hold without each one
 * re-implementing them.
 *
 * What it does for the caller, so they cannot forget:
 *
 * - Sends `X-Correlation-Id` (one per logical call, stable across retries). The
 *   API major is in the `baseUrl` path (`…/v1`), per the versioning rule.
 * - Sends an `Idempotency-Key` on every mutating call, generated **once per
 *   logical call and reused on every retry** — the property that makes a retry
 *   safe. Never regenerated inside the retry loop.
 * - **Never sends a tenant.** The tenant is the session's; the SDK has no
 *   parameter to carry one, and `architecture.test.ts` greps for `x-tenant-id`.
 * - Retries only when the gateway says `retryable: true` (429/503), honouring
 *   `Retry-After`, with capped exponential backoff and jitter. A 502 (unknown
 *   outcome) is surfaced, not retried — the caller must reconcile.
 * - Parses the error envelope into `SemesterApiError`, keeping the
 *   correlation id for the support conversation.
 * - Iterates cursor pages without exposing the cursor's contents.
 *
 * It is transport-agnostic: `fetch`, `sleep`, clock and id source are injected.
 */

import type { IdSource, Rng } from '../kernel/clock.ts';
import { parseErrorEnvelope } from '../gateway/errors.ts';
import { HEADERS } from '../gateway/headers.ts';
import { backoffMs } from '../kernel/backoff.ts';

export class SemesterApiError extends Error {
  /** A catalogue code, a domain's specific one, or one the SDK itself raises. */
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly correlationId: string;

  constructor(code: SemesterApiError['code'], message: string, status: number, retryable: boolean, correlationId: string) {
    super(message);
    this.name = 'SemesterApiError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.correlationId = correlationId;
  }
}

export interface HttpResponse {
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<HttpResponse>;

export interface ClientOptions {
  baseUrl: string;
  fetch: FetchLike;
  ids: IdSource;
  rng: Rng;
  sleep: (ms: number) => Promise<void>;
  /** Returns the current bearer credential. The SDK never stores it. */
  token: () => Promise<string>;
  maxAttempts?: number;
}

export interface CallOptions {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Supply to make a call replayable across *sessions* (e.g. a queued offline command). */
  idempotencyKey?: string;
  correlationId?: string;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createClient(opts: ClientOptions) {
  const maxAttempts = opts.maxAttempts ?? 4;

  async function call<T>(method: string, path: string, c: CallOptions = {}): Promise<T> {
    const correlationId = c.correlationId ?? opts.ids.next('corr');
    // Generated once, outside the loop. This is the whole point.
    const key = MUTATING.has(method) ? (c.idempotencyKey ?? opts.ids.next('idem')) : undefined;
    const qs = c.query
      ? `?${Object.entries(c.query)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')}`
      : '';

    for (let attempt = 1; ; attempt++) {
      const headers: Record<string, string> = {
        accept: 'application/json',
        authorization: `Bearer ${await opts.token()}`,
        [HEADERS.correlationId]: correlationId,
        ...(key ? { [HEADERS.idempotencyKey]: key } : {}),
        ...(c.body !== undefined ? { 'content-type': 'application/json' } : {}),
      };
      let res: HttpResponse;
      try {
        res = await opts.fetch(`${opts.baseUrl}${path}${qs}`, { method, headers, ...(c.body !== undefined ? { body: JSON.stringify(c.body) } : {}) });
      } catch {
        // The request may or may not have arrived. For a mutating call with a key, retrying is safe; without, it is not.
        if ((key || !MUTATING.has(method)) && attempt < maxAttempts) {
          await opts.sleep(backoffMs(attempt, opts.rng));
          continue;
        }
        throw new SemesterApiError('network', 'We could not reach Semester. Check your connection.', 0, false, correlationId);
      }

      const body = await res.json().catch(() => null);
      if (res.status >= 200 && res.status < 300) return body as T;

      const env = parseErrorEnvelope(body);
      if (!env) throw new SemesterApiError('malformed_response', 'Semester sent a response we could not read.', res.status, false, correlationId);
      // The flag and the status must agree: only 429 and 503 are ever blind-retryable.
      const retryable = env.error.retryable === true && (res.status === 429 || res.status === 503);
      if (retryable && attempt < maxAttempts) {
        const ra = Number(res.headers.get(HEADERS.retryAfter));
        await opts.sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60_000) : backoffMs(attempt, opts.rng));
        continue;
      }
      throw new SemesterApiError(env.error.code, env.error.message, res.status, env.error.retryable, env.error.correlation_id);
    }
  }

  async function* pages<T>(path: string, query: Record<string, string | number | undefined> = {}): AsyncGenerator<T> {
    let cursor: string | undefined;
    do {
      const page = await call<{ items: T[]; nextCursor: string | null }>('GET', path, { query: { ...query, cursor } });
      for (const item of page.items) yield item;
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
  }

  return {
    get: <T>(path: string, c?: CallOptions) => call<T>('GET', path, c),
    post: <T>(path: string, body: unknown, c?: CallOptions) => call<T>('POST', path, { ...c, body }),
    put: <T>(path: string, body: unknown, c?: CallOptions) => call<T>('PUT', path, { ...c, body }),
    patch: <T>(path: string, body: unknown, c?: CallOptions) => call<T>('PATCH', path, { ...c, body }),
    delete: <T>(path: string, c?: CallOptions) => call<T>('DELETE', path, c),
    pages,
  };
}
