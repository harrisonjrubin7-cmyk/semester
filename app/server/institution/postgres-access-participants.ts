import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Fault, type AccessSaga, type Grant, type Inspection, type Services } from '../../../packages/institution/src/index.ts';

/**
 * The six participant calls of the saga's `Services` that the administrator
 * and the enforcement point answer. `validate` and `evaluate` are the policy
 * decision point's and are not here.
 */
export type AccessParticipants = Pick<Services, 'prepare' | 'install' | 'inspect' | 'revokePa' | 'removePep' | 'verifyCleanup'>;

export interface PostgresAccessParticipantsOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
  /** How long a prepared grant lasts, in milliseconds. The administrator caps it at a day. */
  grantTtlMs?: number;
}

const DEFAULT_GRANT_TTL_MS = 60 * 60_000;

/**
 * The SQLSTATEs the participants' functions raise on purpose, and the fault
 * each is. None is retryable: a barrier only rises, an expiry only passes, a
 * superseded or unknown grant does not become known by asking again. The
 * runner reads `STALE_DECISION` in PREPARING as a denial, and any other
 * non-retryable fault as a reason to deny or revoke, which is what each of
 * these deserves.
 */
const REFUSALS: Record<string, string> = {
  SC404: 'GRANT_UNKNOWN',
  SC409: 'GRANT_SUPERSEDED',
  SC410: 'GRANT_EXPIRED',
  SC422: 'STALE_DECISION',
  SC423: 'GRANT_REVOKED',
};

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return undefined;
}

function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return String(error);
}

/**
 * A failure of one participant call, classified. A refusal the function made
 * on purpose is a non-retryable fault with its name. Anything else (an outage,
 * a timeout, a row of the wrong shape) is retryable, and for a write its
 * outcome is unknown: the function may have run before the answer was lost,
 * so the runner must inspect before assuming either way.
 */
function fault(error: unknown, side: 'PA' | 'PEP', write: boolean): Fault {
  const code = codeOf(error);
  const refusal = code === undefined ? undefined : REFUSALS[code];
  if (refusal !== undefined) return new Fault(refusal, false, false, messageOf(error));
  return new Fault(`${side}_UNAVAILABLE`, true, write, messageOf(error));
}

function str(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${what} is not a non-empty string.`);
  return value;
}

function int(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`${what} is not a safe integer.`);
  return value;
}

function bool(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${what} is not a boolean.`);
  return value;
}

/**
 * The saga's policy administrator and enforcement point over the
 * `access_pa_*`, `access_pep_*` and `access_cleanup_verify` functions of the
 * production Postgres project (migration `20261012050000_access_participants`).
 *
 * The functions hold the contract — idempotency by operation key, the
 * revocation barrier, the expiry, one enforcement per grant — inside the
 * database, in the same transaction as the row they decide on. This class
 * holds the service client, hands each call its key and the saga's ids, and
 * classifies what comes back: a SQLSTATE the function raises on purpose is a
 * non-retryable `Fault` of that name; anything else is the participant being
 * unavailable, retryable, and for a write of unknown outcome. The runner's
 * `AbortSignal` is passed to the request, so a timed-out call stops waiting;
 * the function, once started, finishes on its own and keeps its barrier.
 */
export class PostgresAccessParticipants implements AccessParticipants {
  private client: SupabaseClient;
  private grantTtlMs: number;

  constructor(options: PostgresAccessParticipantsOptions) {
    if (!options.client && (!options.url || !options.serviceKey)) {
      throw new Error('A server-only Supabase service client is required for the access participants.');
    }
    this.client = options.client ?? createClient(options.url!, options.serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const ttl = options.grantTtlMs ?? DEFAULT_GRANT_TTL_MS;
    if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > 86_400_000) throw new Error('A grant lasts between 1 ms and a day.');
    this.grantTtlMs = ttl;
  }

  private async rpc(fn: string, args: Record<string, unknown>, signal: AbortSignal): Promise<unknown> {
    const query = this.client.rpc(fn, args) as unknown as { abortSignal?: (s: AbortSignal) => PromiseLike<{ data: unknown; error: unknown }> } &
      PromiseLike<{ data: unknown; error: unknown }>;
    const { data, error } = await (typeof query.abortSignal === 'function' ? query.abortSignal(signal) : query);
    if (error) throw error;
    return data;
  }

  async prepare(saga: AccessSaga, key: string, signal: AbortSignal): Promise<Grant> {
    let data: unknown;
    try {
      data = await this.rpc('access_pa_prepare', { p_key: key, p_saga_id: saga.id, p_ttl_ms: this.grantTtlMs }, signal);
    } catch (error) {
      throw fault(error, 'PA', true);
    }
    const row = (data ?? {}) as Record<string, unknown>;
    try {
      return { id: str(row.id, 'access_pa_prepare.id'), expiresAt: int(row.expiresAt, 'access_pa_prepare.expiresAt') };
    } catch (error) {
      // A grant was prepared and its answer cannot be read: the same key will return it again.
      throw new Fault('PA_UNAVAILABLE', true, true, messageOf(error));
    }
  }

  async install(saga: AccessSaga, key: string, signal: AbortSignal): Promise<void> {
    if (saga.grantId === undefined) throw new Fault('GRANT_UNKNOWN', false, false, 'The saga names no grant to install.');
    try {
      await this.rpc('access_pep_install', { p_key: key, p_saga_id: saga.id, p_grant_id: saga.grantId }, signal);
    } catch (error) {
      throw fault(error, 'PEP', true);
    }
  }

  async inspect(saga: AccessSaga, signal: AbortSignal): Promise<Inspection> {
    let data: unknown;
    try {
      data = await this.rpc('access_pep_inspect', { p_saga_id: saga.id, p_grant_id: saga.grantId ?? null }, signal);
    } catch (error) {
      throw fault(error, 'PEP', false);
    }
    if (data === 'installed' || data === 'absent' || data === 'conflict') return { status: data };
    // The point answered with something this adapter does not know: not evidence of absence.
    throw new Fault('PEP_UNAVAILABLE', true, false, `access_pep_inspect answered ${JSON.stringify(data)}.`);
  }

  async revokePa(saga: AccessSaga, key: string, signal: AbortSignal): Promise<'confirmed' | 'unknown'> {
    let data: unknown;
    try {
      data = await this.rpc('access_pa_revoke', { p_key: key, p_saga_id: saga.id, p_generation: saga.generation }, signal);
    } catch (error) {
      throw fault(error, 'PA', true);
    }
    return data === 'confirmed' ? 'confirmed' : 'unknown';
  }

  async removePep(saga: AccessSaga, key: string, signal: AbortSignal): Promise<'confirmed' | 'unknown'> {
    let data: unknown;
    try {
      data = await this.rpc('access_pep_remove', { p_key: key, p_saga_id: saga.id }, signal);
    } catch (error) {
      throw fault(error, 'PEP', true);
    }
    return data === 'confirmed' ? 'confirmed' : 'unknown';
  }

  async verifyCleanup(saga: AccessSaga, signal: AbortSignal): Promise<{ paRevoked: boolean; pepAbsent: boolean }> {
    let data: unknown;
    try {
      data = await this.rpc('access_cleanup_verify', { p_saga_id: saga.id, p_generation: saga.generation }, signal);
    } catch (error) {
      throw fault(error, 'PA', false);
    }
    const row = (data ?? {}) as Record<string, unknown>;
    try {
      return { paRevoked: bool(row.paRevoked, 'access_cleanup_verify.paRevoked'), pepAbsent: bool(row.pepAbsent, 'access_cleanup_verify.pepAbsent') };
    } catch (error) {
      // An answer that cannot be read confirms nothing.
      throw new Fault('PA_UNAVAILABLE', true, false, messageOf(error));
    }
  }
}
