/**
 * Integration primitives: how an external system connects to Semester without
 * ever becoming the only way a capability works.
 *
 * The thesis is *native first, connected when available*. A connector
 * (SIS, LMS, IdP, payments, calendar, campus card) **enriches, synchronises or
 * migrates**; if it is down, Semester's own record still works and says what
 * it knows and how fresh it is. Four primitives make that structural:
 *
 * - **Connection**: a tenant-bound record with a *credential reference* (never
 *   a secret), a mapping version, a sync cursor and a health state. External
 *   ids are unique within `(tenant, connection)`, not globally.
 * - **Inbox**: every inbound message is recorded before it is acted on, keyed
 *   `(tenant, connection, externalId)`. The same id with the same payload is a
 *   duplicate (a no-op); the same id with a *different* payload is a conflict
 *   to reconcile, never a silent overwrite.
 * - **Source metadata**: every imported or connected value carries where it
 *   came from, when it was observed, whether it has been verified, and how
 *   fresh it is — the audit's `SourceMetadata`. `resolveValue` applies the
 *   source-precedence rule: institution-verified beats imported beats student
 *   entered, *unless* the student's value is newer and the field is
 *   student-owned.
 * - **Health + backoff**: consecutive failures degrade then disable a
 *   connection (a circuit breaker); retries use exponential backoff with
 *   jitter and a ceiling. Neither state ever removes the native capability:
 *   `nativeAvailable` does not take a connection as an argument, on purpose.
 */

import { hashOf } from '../kernel/canonical.ts';

export const CONNECTION_STATES = ['healthy', 'degraded', 'disabled'] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const SOURCE_ORIGINS = ['native', 'imported', 'connected', 'institution_entered', 'ai_generated'] as const;
export type SourceOrigin = (typeof SOURCE_ORIGINS)[number];

export interface Connection {
  id: string;
  tenantId: string;
  provider: string;
  /** A reference into the secret store. Never the secret. */
  credentialRef: string;
  mappingVersion: string;
  cursor: string | null;
  state: ConnectionState;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

export const DEGRADE_AFTER = 3;
export const DISABLE_AFTER = 8;

export function openConnection(c: Pick<Connection, 'id' | 'tenantId' | 'provider' | 'credentialRef' | 'mappingVersion'>): Connection {
  // A credential reference that looks like a secret is a bug caught at the door.
  if (/^(sk|pk|ghp|xox[bap])[-_]|-----BEGIN|^[A-Za-z0-9+/]{40,}={0,2}$/.test(c.credentialRef)) {
    throw new Error('credentialRef must be a reference into the secret store, not a secret.');
  }
  return { ...c, cursor: null, state: 'healthy', consecutiveFailures: 0, lastSuccessAt: null, lastFailureAt: null };
}

export function recordSuccess(c: Connection, at: string, cursor: string | null): Connection {
  return { ...c, state: 'healthy', consecutiveFailures: 0, lastSuccessAt: at, cursor: cursor ?? c.cursor };
}

export function recordFailure(c: Connection, at: string): Connection {
  const n = c.consecutiveFailures + 1;
  const state: ConnectionState = n >= DISABLE_AFTER ? 'disabled' : n >= DEGRADE_AFTER ? 'degraded' : c.state;
  return { ...c, consecutiveFailures: n, state, lastFailureAt: at };
}

export { backoffMs } from '../kernel/backoff.ts';

/** Whether the native capability is available. It takes no connection: it is not a function of one. */
export const nativeAvailable = (): true => true;

/** Whether to attempt a sync at all. A disabled connection needs a human. */
export const mayAttempt = (c: Connection): boolean => c.state !== 'disabled';

export type InboxOutcome = { kind: 'new' } | { kind: 'duplicate' } | { kind: 'conflict'; storedHash: string };

export interface InboxMessage {
  tenantId: string;
  connectionId: string;
  externalId: string;
  payload: unknown;
}

export class MemoryInbox {
  private readonly seen = new Map<string, string>();

  async receive(m: InboxMessage): Promise<InboxOutcome> {
    const id = JSON.stringify([m.tenantId, m.connectionId, m.externalId]);
    const hash = await hashOf(m.payload);
    const stored = this.seen.get(id);
    if (stored === undefined) {
      this.seen.set(id, hash);
      return { kind: 'new' };
    }
    return stored === hash ? { kind: 'duplicate' } : { kind: 'conflict', storedHash: stored };
  }
}

export type Freshness = 'current' | 'stale' | 'unknown' | 'conflicted';

export interface SourceMetadata {
  origin: SourceOrigin;
  system?: string;
  externalId?: string;
  mappingVersion?: string;
  observedAt: string;
  verifiedAt?: string;
  freshnessState: Freshness;
}

export function freshnessOf(observedAt: string | undefined, nowMs: number, staleAfterMs: number): Freshness {
  if (!observedAt) return 'unknown';
  const t = Date.parse(observedAt);
  if (!Number.isFinite(t) || t > nowMs + 60_000) return 'unknown';
  return nowMs - t > staleAfterMs ? 'stale' : 'current';
}

export interface SourcedValue<T> {
  value: T;
  source: SourceMetadata;
}

const PRECEDENCE: Record<SourceOrigin, number> = { institution_entered: 0, connected: 1, imported: 2, native: 3, ai_generated: 4 };

/**
 * Pick between two claims about one field. Institution-entered beats connected
 * beats imported beats native beats AI-generated — except for a field the
 * student owns, where the newest *native* value wins, and except that a pair
 * that disagree and are equally strong is `conflicted`, never a coin toss.
 */
export function resolveValue<T>(
  a: SourcedValue<T>,
  b: SourcedValue<T>,
  opts: { studentOwned: boolean },
): { chosen: SourcedValue<T>; conflicted: boolean } {
  const same = JSON.stringify(a.value) === JSON.stringify(b.value);
  const pa = PRECEDENCE[a.source.origin];
  const pb = PRECEDENCE[b.source.origin];
  if (opts.studentOwned && a.source.origin !== b.source.origin) {
    const native = a.source.origin === 'native' ? a : b.source.origin === 'native' ? b : null;
    const other = native === a ? b : a;
    if (native && Date.parse(native.source.observedAt) >= Date.parse(other.source.observedAt)) return { chosen: native, conflicted: false };
  }
  if (pa !== pb) {
    const chosen = pa < pb ? a : b;
    return { chosen: same ? chosen : { ...chosen, source: { ...chosen.source, freshnessState: chosen.source.freshnessState } }, conflicted: false };
  }
  if (same) return { chosen: a, conflicted: false };
  return { chosen: { ...a, source: { ...a.source, freshnessState: 'conflicted' } }, conflicted: true };
}
