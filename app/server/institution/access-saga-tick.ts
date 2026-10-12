/**
 * The access saga worker's tick: which sagas are due, and one runner tick for
 * each. The scheduler calls it; it decides only *which* and *how many*, and
 * every rule about what a move may do is the runner's and the store's. It adds
 * none and relaxes none.
 *
 * Due is the database's answer (`access_saga_due`, migration
 * `20261012030000`): unfinished, `next_attempt_at` reached, lease free or
 * expired, oldest first. A wake sets `next_attempt_at` to now, so a signalled
 * saga is due at the next tick without this file knowing what a signal is.
 *
 * Two ticks that overlap read the same list. That is safe: the runner claims
 * before it moves, the claim is exclusive until the lease expires, and a save
 * is a compare-and-swap, so the second tick finds each saga held (`claim`
 * returns null and the runner returns) or moved (`PersistenceConflict`, which
 * the runner swallows as a stand-down). Neither reaches here; both count as a
 * tick that ran.
 *
 * A participant's failure inside one tick is the runner's to record on that
 * saga (`attempts`, `nextAttemptAt`, `lastError`, escalation). What reaches
 * here is thrown only when the runner itself could not run, which is a
 * storage failure: it is counted as `failed` with its message and the tick
 * moves on, because one saga that cannot be ticked must not stop the others.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AccessSagaRunner, type RunnerOptions, type Services } from '../../../packages/institution/src/index.ts';
import { PostgresAccessSagaStore } from './postgres-access-saga.ts';

export interface AccessSagaTickOptions {
  /** A server-only service client; the store refuses anything else. */
  client: SupabaseClient;
  /** The participants. There is no default: a tick with no participants has nothing to run. */
  services: Services;
  runner?: RunnerOptions;
  /** At most this many sagas per tick. Default 50; the function caps it at 500. */
  maxSagas?: number;
  /** Stop starting ticks after this long. Default 20 s; the function's own limit is longer. */
  budgetMs?: number;
  now?: () => number;
  /** Tests only: a runner over a store of their own. */
  store?: PostgresAccessSagaStore;
}

export interface AccessSagaTickSummary {
  /** Sagas the database listed as due. */
  due: number;
  /** Runner ticks that ran to the end: a move, a stand-down, or nothing to do. */
  ticked: number;
  /** Ticks the runner could not complete, with the saga id and the error's message. */
  failed: { id: string; error: string }[];
  /** True when the cap or the budget left due sagas for the next tick. */
  deferred: boolean;
}

export const DEFAULT_MAX_SAGAS = 50;
export const DEFAULT_BUDGET_MS = 20_000;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Lists the due sagas as the function returns them; anything but a list of ids is a storage failure. */
export async function dueSagas(client: SupabaseClient, limit: number): Promise<string[]> {
  const result = await client.rpc('access_saga_due', { p_limit: limit }) as { data: unknown; error: unknown };
  if (result.error) throw new Error('The access saga worker could not list the due sagas.', { cause: result.error });
  if (!Array.isArray(result.data) || !result.data.every((id) => typeof id === 'string' && id.length > 0)) {
    throw new Error('The access saga worker could not read the due list.', { cause: result.data });
  }
  return result.data;
}

export async function runAccessSagaTick(options: AccessSagaTickOptions): Promise<AccessSagaTickSummary> {
  const now = options.now ?? Date.now;
  const maxSagas = options.maxSagas ?? DEFAULT_MAX_SAGAS;
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const store = options.store ?? new PostgresAccessSagaStore({ client: options.client });
  const runner = new AccessSagaRunner(store, options.services, { now, ...options.runner });

  const started = now();
  // One more than the cap, so a full page says whether work is left behind.
  const listed = await dueSagas(options.client, maxSagas + 1);
  const ids = listed.slice(0, maxSagas);
  const summary: AccessSagaTickSummary = { due: listed.length, ticked: 0, failed: [], deferred: listed.length > maxSagas };

  for (const [i, id] of ids.entries()) {
    if (now() - started >= budgetMs) {
      summary.deferred = summary.deferred || i < ids.length;
      break;
    }
    try {
      await runner.tick(id);
      summary.ticked += 1;
    } catch (error) {
      summary.failed.push({ id, error: message(error) });
    }
  }
  return summary;
}
