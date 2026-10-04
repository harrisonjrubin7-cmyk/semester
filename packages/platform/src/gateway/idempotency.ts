/**
 * Idempotency: a retried command runs once.
 *
 * Networks retry, clients double-tap, queues redeliver. A command that
 * registers a student, posts a grade or sends a payment cannot be allowed to
 * run twice because a response was lost. The contract:
 *
 * - The client sends an `Idempotency-Key` it generated *once per logical
 *   action* and reuses on every retry (`sdk/client.ts` does).
 * - The record is keyed `(tenant, actor, command, key)`. Another tenant, or
 *   another person, or another command can use the same string and gets a
 *   separate record — a key is never a capability to read someone's response.
 * - The request is hashed (canonical JSON). The same key with a *different*
 *   body is `idempotency_key_reused` (422, as the IETF idempotency-key draft and
 *   `docs/target-architecture/07-ENGINEERING-STANDARDS.md` §2 say), not a replay: the client has a bug and
 *   must be told, not handed a stale response to a different question.
 * - While the first attempt runs, a second gets `idempotency_in_progress`. A
 *   lease bounds that: a worker that died holding it does not wedge the key
 *   forever; after the lease the next attempt takes over.
 * - A completed result is replayed byte-for-byte, with `idempotent-replayed:
 *   true`, until the record's TTL.
 * - Deterministic refusals (validation, forbidden, not found) are stored and
 *   replayed — the answer will not change. Failures whose outcome may differ
 *   next time (5xx, unknown outcome, 429) release the key so a retry can run.
 */

import { hashOf } from '../kernel/canonical.ts';
import type { Clock } from '../kernel/clock.ts';
import type { RequestContext } from '../tenancy/context.ts';
import { PlatformError, isPlatformError } from './errors.ts';

export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyScope {
  tenantId: string;
  actorId: string;
  command: string;
  key: string;
}

export type BeginOutcome =
  | { kind: 'started' }
  | { kind: 'replay'; response: StoredResponse }
  | { kind: 'conflict' }
  | { kind: 'in_progress'; retryAfterSeconds: number };

export interface IdempotencyStore {
  begin(scope: IdempotencyScope, requestHash: string, now: Date, leaseMs: number, ttlMs: number): Promise<BeginOutcome>;
  complete(scope: IdempotencyScope, response: StoredResponse, now: Date): Promise<void>;
  release(scope: IdempotencyScope): Promise<void>;
}

export const IDEMPOTENCY_LEASE_MS = 60_000;
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** Financial and academic commands keep their keys longer (target-architecture standards §2). */
export const IDEMPOTENCY_TTL_EXTENDED_MS = 7 * 24 * 60 * 60 * 1000;

interface Row {
  requestHash: string;
  state: 'in_progress' | 'completed';
  response?: StoredResponse;
  leaseUntil: number;
  expiresAt: number;
}

const idOf = (s: IdempotencyScope): string => JSON.stringify([s.tenantId, s.actorId, s.command, s.key]);

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly rows = new Map<string, Row>();

  async begin(scope: IdempotencyScope, requestHash: string, now: Date, leaseMs: number, ttlMs: number): Promise<BeginOutcome> {
    const id = idOf(scope);
    const t = now.getTime();
    const row = this.rows.get(id);
    if (row && row.expiresAt > t) {
      if (row.requestHash !== requestHash) return { kind: 'conflict' };
      if (row.state === 'completed' && row.response) return { kind: 'replay', response: row.response };
      if (row.leaseUntil > t) return { kind: 'in_progress', retryAfterSeconds: Math.ceil((row.leaseUntil - t) / 1000) };
      // Lease lapsed: the first worker is presumed dead. Take over.
    }
    this.rows.set(id, { requestHash, state: 'in_progress', leaseUntil: t + leaseMs, expiresAt: t + ttlMs });
    return { kind: 'started' };
  }

  async complete(scope: IdempotencyScope, response: StoredResponse, now: Date): Promise<void> {
    const row = this.rows.get(idOf(scope));
    if (!row) return;
    this.rows.set(idOf(scope), { ...row, state: 'completed', response, leaseUntil: now.getTime() });
  }

  async release(scope: IdempotencyScope): Promise<void> {
    this.rows.delete(idOf(scope));
  }
}

/** Whether an error's answer is the same next time, and so safe to store and replay. */
export const isDeterministicRefusal = (e: PlatformError): boolean => e.status >= 400 && e.status < 500 && !e.retryable;

export interface IdempotentResult<T> {
  value: T;
  replayed: boolean;
}

/**
 * Run `fn` at most once per `(tenant, actor, command, key)`.
 * `T` must be JSON-serialisable: it is stored and handed back verbatim.
 */
export async function withIdempotency<T>(
  store: IdempotencyStore,
  deps: { clock: Clock },
  ctx: RequestContext,
  command: string,
  requestBody: unknown,
  fn: () => Promise<T>,
  opts: { ttlMs?: number } = {},
): Promise<IdempotentResult<T>> {
  if (!ctx.idempotencyKey) {
    throw new PlatformError('invalid_request', 'This action needs an Idempotency-Key header.');
  }
  const scope: IdempotencyScope = { tenantId: ctx.tenantId, actorId: ctx.actor.personId, command, key: ctx.idempotencyKey };
  const hash = await hashOf({ command, body: requestBody });
  const begun = await store.begin(scope, hash, deps.clock.now(), IDEMPOTENCY_LEASE_MS, opts.ttlMs ?? IDEMPOTENCY_TTL_MS);

  if (begun.kind === 'conflict') {
    throw new PlatformError('idempotency_key_reused', 'That Idempotency-Key was already used for a different request.');
  }
  if (begun.kind === 'in_progress') {
    throw new PlatformError('idempotency_in_progress', 'The first attempt of this request is still running.', {
      retryAfterSeconds: begun.retryAfterSeconds,
    });
  }
  if (begun.kind === 'replay') {
    const stored = begun.response;
    if (stored.status >= 400) {
      const b = stored.body as { code?: string; message?: string };
      throw new PlatformError((b.code as PlatformError['code']) ?? 'internal', b.message ?? 'The request was refused.');
    }
    return { value: stored.body as T, replayed: true };
  }

  try {
    const value = await fn();
    await store.complete(scope, { status: 200, body: value }, deps.clock.now());
    return { value, replayed: false };
  } catch (e) {
    if (isPlatformError(e) && isDeterministicRefusal(e)) {
      await store.complete(scope, { status: e.status, body: { code: e.code, message: e.message } }, deps.clock.now());
    } else {
      await store.release(scope);
    }
    throw e;
  }
}
