import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ACCESS_REQUEST_ACTIONS,
  ACCESS_SAGA_STATES,
  PersistenceConflict,
  type AccessEvent,
  type AccessSaga,
  type AccessSagaState,
  type Lease,
  type Store,
} from '../../../packages/institution/src/index.ts';

export interface PostgresAccessSagaStoreOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
}

type RpcResult<T> = { data: T; error: unknown };

/** The SQLSTATEs the store's functions raise on purpose. Anything else is a storage failure. */
const CONFLICT = 'SC409';

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return undefined;
}

function failed(error: unknown, operation: string): never {
  throw new Error(`The access saga store could not ${operation}.`, { cause: error });
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (typeof v !== 'string' || v.length === 0) throw new Error(`access_sagas.${key} is not a non-empty string.`);
  return v;
}

function optStr(row: Record<string, unknown>, key: string): string | undefined {
  const v = row[key];
  if (v === null || v === undefined) return undefined;
  if (typeof v !== 'string') throw new Error(`access_sagas.${key} is not a string.`);
  return v;
}

function int(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new Error(`access_sagas.${key} is not a safe integer.`);
  return v;
}

function optInt(row: Record<string, unknown>, key: string): number | undefined {
  const v = row[key];
  if (v === null || v === undefined) return undefined;
  return int(row, key);
}

function bool(row: Record<string, unknown>, key: string): boolean {
  const v = row[key];
  if (typeof v !== 'boolean') throw new Error(`access_sagas.${key} is not a boolean.`);
  return v;
}

/**
 * A row of `access_sagas`, as `access_saga_claim` returns it, read into the
 * runner's record. Fails closed: a column missing or of the wrong shape is a
 * storage failure, never a saga the runner acts on.
 */
export function sagaFromRow(value: unknown): AccessSaga {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('access_sagas row is not an object.');
  const row = value as Record<string, unknown>;
  const state = str(row, 'state');
  if (!(ACCESS_SAGA_STATES as readonly string[]).includes(state)) throw new Error(`access_sagas.state ${state} is not a saga state.`);
  const action = str(row, 'intent_action');
  if (!(ACCESS_REQUEST_ACTIONS as readonly string[]).includes(action)) throw new Error(`access_sagas.intent_action ${action} is not an access action.`);
  const saga: AccessSaga = {
    id: str(row, 'id'),
    tenantId: str(row, 'tenant_id'),
    subjectId: str(row, 'subject_id'),
    intent: { resourceId: str(row, 'intent_resource_id'), action },
    requestDigest: str(row, 'request_digest'),
    definitionVersion: str(row, 'definition_version'),
    state: state as AccessSagaState,
    revision: int(row, 'revision'),
    generation: int(row, 'generation'),
    attempts: int(row, 'attempts'),
    deadlineAt: int(row, 'deadline_at'),
    nextAttemptAt: int(row, 'next_attempt_at'),
    staleGrantPossible: bool(row, 'stale_grant_possible'),
    compensation: { paRevoked: bool(row, 'pa_revoked'), pepRemoved: bool(row, 'pep_removed') },
  };
  const decisionId = optStr(row, 'decision_id');
  if (decisionId !== undefined) saga.decisionId = decisionId;
  const grantId = optStr(row, 'grant_id');
  if (grantId !== undefined) saga.grantId = grantId;
  const grantExpiresAt = optInt(row, 'grant_expires_at');
  if (grantExpiresAt !== undefined) saga.grantExpiresAt = grantExpiresAt;
  const lastError = optStr(row, 'last_error');
  if (lastError !== undefined) saga.lastError = lastError;
  return saga;
}

/** The columns `access_saga_save` reads from `p_next`, and nothing it does not. */
export function nextForSave(next: AccessSaga): Record<string, unknown> {
  return {
    state: next.state,
    generation: next.generation,
    attempts: next.attempts,
    deadlineAt: next.deadlineAt,
    nextAttemptAt: next.nextAttemptAt,
    decisionId: next.decisionId ?? null,
    grantId: next.grantId ?? null,
    grantExpiresAt: next.grantExpiresAt ?? null,
    staleGrantPossible: next.staleGrantPossible,
    compensation: { paRevoked: next.compensation.paRevoked, pepRemoved: next.compensation.pepRemoved },
    lastError: next.lastError ?? null,
  };
}

/**
 * The runner's `Store` over the `access_saga_*` functions of the production
 * Postgres project (migration `20261006180000_access_saga_store`).
 *
 * Every write is one of five `security definer` functions executable by the
 * service role alone; this class holds the service client and nothing else
 * does. The functions decide the lease, the revision and the transition, so
 * the adapter translates and never re-checks: SQLSTATE `SC409` is the saga
 * moving under the worker and becomes `PersistenceConflict`, which the runner
 * answers by standing down; every other error, `SC404` included, is a storage
 * failure the runner must not read as a participant's.
 */
export class PostgresAccessSagaStore implements Store {
  private client: SupabaseClient;

  constructor(options: PostgresAccessSagaStoreOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for the access saga store.');
    }
    this.client = options.client ?? createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  private async rpc<T>(name: string, args: Record<string, unknown>, operation: string): Promise<T> {
    const result = await this.client.rpc(name, args) as RpcResult<T>;
    if (result.error) {
      if (codeOf(result.error) === CONFLICT) throw new PersistenceConflict(`The access saga moved: could not ${operation}.`, { cause: result.error });
      failed(result.error, operation);
    }
    return result.data;
  }

  /**
   * Records a new saga at revision 0. Not part of `Store`: the runner only
   * ever meets a saga that exists. The table's own checks hold the identity,
   * the digest shape and the action list; a refusal there is a storage error.
   */
  async create(saga: AccessSaga): Promise<void> {
    if (saga.revision !== 0) throw new Error('A new access saga starts at revision 0.');
    const result = await this.client.from('access_sagas').insert({
      id: saga.id,
      tenant_id: saga.tenantId,
      subject_id: saga.subjectId,
      intent_resource_id: saga.intent.resourceId,
      intent_action: saga.intent.action,
      request_digest: saga.requestDigest,
      definition_version: saga.definitionVersion,
      state: saga.state,
      revision: 0,
      generation: saga.generation,
      attempts: saga.attempts,
      deadline_at: saga.deadlineAt,
      next_attempt_at: saga.nextAttemptAt,
      stale_grant_possible: saga.staleGrantPossible,
      pa_revoked: saga.compensation.paRevoked,
      pep_removed: saga.compensation.pepRemoved,
    }) as { error: unknown };
    if (result.error) failed(result.error, 'create a saga');
  }

  async claim(id: string, leaseMs: number): Promise<Lease | null> {
    const rows = await this.rpc<unknown>('access_saga_claim', { p_id: id, p_lease_ms: leaseMs }, 'claim a lease');
    if (!Array.isArray(rows)) failed(rows, 'claim a lease');
    if (rows.length === 0) return null;
    const row = rows[0] as Record<string, unknown>;
    if (typeof row.lease_token !== 'string' || row.lease_token.length === 0) failed(row, 'claim a lease');
    let saga: AccessSaga;
    try {
      saga = sagaFromRow(row.saga);
    } catch (error) {
      failed(error, 'read the claimed saga');
    }
    if (saga.id !== id) failed(row, 'claim the saga it asked for');
    return { token: row.lease_token, saga };
  }

  async save(lease: Lease, expectedRevision: number, next: AccessSaga, event: AccessEvent): Promise<void> {
    await this.rpc<null>('access_saga_save', {
      p_id: lease.saga.id,
      p_lease_token: lease.token,
      p_expected_revision: expectedRevision,
      p_next: nextForSave(next),
      p_event: { eventId: event.eventId, type: event.type, occurredAt: event.occurredAt, reasonCode: event.reasonCode ?? null },
    }, 'save a move');
  }

  async flagRecovery(lease: Lease, code: string): Promise<void> {
    await this.rpc<null>('access_saga_flag_recovery', { p_id: lease.saga.id, p_lease_token: lease.token, p_code: code }, 'flag recovery');
  }

  async release(lease: Lease): Promise<void> {
    await this.rpc<null>('access_saga_release', { p_id: lease.saga.id, p_lease_token: lease.token }, 'release a lease');
  }

  async wake(id: string, eventId: string, kind: 'requirements_changed' | 'revoke' | 'recover'): Promise<void> {
    await this.rpc<null>('access_saga_wake', { p_id: id, p_event_id: eventId, p_kind: kind }, 'deliver a signal');
  }
}
