/**
 * The scheduler's tick: which connections are due, and one `runSync` for each.
 *
 * `supabase/scheduler.sql` calls this every fifteen minutes through
 * `api/integration/tick.ts`, and the daily retention sweep is a separate job
 * there that needs nothing from here. The tick decides only *whether* and
 * *when*; every rule about what a run may do — approval, pause, flags, kill
 * switches, scopes, consent, the school boundary — is `runSync`'s, and the tick
 * adds none and relaxes none.
 *
 * What it runs, in order:
 *
 *   1. **Replays an operator asked for.** A dead letter with
 *      `replay_requested_at` set and not resolved is run once with trigger
 *      `replay`. The payload of a failed pull was never stored (only its hash),
 *      so a replay is a fresh pull from the connection's cursor; a run that
 *      does not fail resolves the dead letter; one that fails withdraws the
 *      request, so the letter waits for the operator again. A replay the
 *      worker refuses (paused, flag off, a switch thrown) stays requested and
 *      runs once the refusal lifts.
 *   2. **Connections due a scheduled pull.** Approved, not paused or
 *      disconnected, pulled rather than pushed (`incremental_api` or
 *      `batch`), with a registered adapter, and not attempted within half their
 *      freshness target — or within one tick, when the last run failed.
 *
 * A connection holding an open dead letter is **not** retried on schedule:
 * five failures in a row (or one permanent one) is a question for a person,
 * and retrying on schedule would dead-letter it again every tick. An operator
 * replay (runbook §5) is what starts it again.
 *
 * Two ticks that overlap — a slow provider, a retried request — can run the
 * same connection twice. Nothing is ingested twice: the second batch carries
 * the same idempotency key and `runSync` records it as a duplicate.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdapterDeclaration } from '../../src/lib/integration/adapter.ts';
import type { ConnectionStatus } from '../../src/lib/integration/catalog.ts';
import type { ProviderBatch } from '../../src/lib/integration/pipeline.ts';
import { DEFAULT_RETRY } from '../../src/lib/integration/retry.ts';
import { runSync, type SyncReport } from './worker.ts';

/** The pg_cron job's cadence, in minutes. `scheduler.sql` must agree. */
export const TICK_MINUTES = 15;

/** What an adapter is handed to pull its next batch. */
export interface PullRequest {
  connectionPublicId: string;
  tenantId: string;
  /** The connection's `cursor_state`: where the last successful pull stopped. */
  cursor: Record<string, unknown>;
  trigger: 'scheduled' | 'replay';
}

/** A live adapter: its declaration, and how to fetch one batch. */
export interface RegisteredAdapter {
  declaration: AdapterDeclaration;
  pull(request: PullRequest): Promise<ProviderBatch>;
}

export interface TickOptions {
  adapters: readonly RegisteredAdapter[];
  now?: () => Date;
  /** Stop starting runs after this long. The function's own limit is longer. */
  budgetMs?: number;
  /** At most this many runs per tick, replays included. */
  maxRuns?: number;
  /** Tests only: let mock adapters run. Passed through to `runSync`. */
  allowMock?: boolean;
}

export interface TickSummary {
  /** `stopped` when the global kill switch is engaged or cannot be read. */
  outcome: 'ran' | 'stopped';
  due: number;
  ran: number;
  succeeded: number;
  failed: number;
  refused: number;
  replaysResolved: number;
  /** Why connections that were considered did not run, by reason. Counts only. */
  skipped: Record<string, number>;
  /** True when the budget or the run cap left due work for the next tick. */
  deferred: boolean;
}

interface ConnectionRow {
  id: string;
  public_id: string;
  tenant_id: string;
  provider_domain: string;
  provider_name: string;
  provider_product: string | null;
  status: ConnectionStatus;
  sync_mode: string;
  cursor_state: Record<string, unknown> | null;
  last_attempt_at: string | null;
}

const CONNECTION_COLUMNS =
  'id,public_id,tenant_id,provider_domain,provider_name,provider_product,status,sync_mode,cursor_state,last_attempt_at';
const RUNNABLE: readonly ConnectionStatus[] = ['configuring', 'healthy', 'degraded', 'error'];
const PULLED = ['incremental_api', 'batch'];

/** The adapter registered for a connection, matched on domain, provider and product. */
export function adapterFor(adapters: readonly RegisteredAdapter[], c: Pick<ConnectionRow,
  'provider_domain' | 'provider_name' | 'provider_product'>): RegisteredAdapter | null {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const hits = adapters.filter(({ declaration: d }) => d.domain === c.provider_domain && same(d.provider, c.provider_name)
    && (c.provider_product === null || same(d.product, c.provider_product)));
  // Two adapters claiming one connection is a registry fault; run neither.
  return hits.length === 1 ? hits[0] : null;
}

/** Minutes between scheduled pulls: half the freshness target, never under one tick. */
export function cadenceMinutes(adapter: AdapterDeclaration, status: ConnectionStatus): number {
  if (status === 'error') return TICK_MINUTES;
  return Math.max(TICK_MINUTES, Math.floor(adapter.freshnessTargetMinutes / 2));
}

export function isDue(lastAttemptAt: string | null, cadence: number, at: Date): boolean {
  if (!lastAttemptAt) return true;
  // One minute of slack, so a tick that fires a few seconds early is not a
  // whole cadence late.
  return at.getTime() - new Date(lastAttemptAt).getTime() >= (cadence - 1) * 60_000;
}

async function globallyKilled(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.from('feature_kill_switch').select('tenant_id')
    .eq('switch_key', 'kill.integration_sync').eq('engaged', true);
  if (error) return true; // A switch that cannot be read is treated as thrown.
  return (data ?? []).some((k: { tenant_id: string | null }) => k.tenant_id === null);
}

/** Failed runs since the last run that did not fail, newest first. */
async function consecutiveFailures(db: SupabaseClient, c: ConnectionRow, limit: number): Promise<number> {
  const { data } = await db.from('integration_sync_runs').select('status')
    .eq('connection_id', c.id).eq('tenant_id', c.tenant_id)
    .order('started_at', { ascending: false }).limit(limit);
  let n = 0;
  for (const r of (data ?? []) as { status: string }[]) {
    if (r.status !== 'failed') break;
    n++;
  }
  return n;
}

export async function tick(db: SupabaseClient, options: TickOptions): Promise<TickSummary> {
  const now = options.now ?? (() => new Date());
  const started = now().getTime();
  const budgetMs = options.budgetMs ?? 40_000;
  const maxRuns = options.maxRuns ?? 25;
  const summary: TickSummary = {
    outcome: 'ran', due: 0, ran: 0, succeeded: 0, failed: 0, refused: 0, replaysResolved: 0, skipped: {}, deferred: false,
  };
  const skip = (reason: string) => { summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1; };

  if (await globallyKilled(db)) return { ...summary, outcome: 'stopped' };

  const room = () => {
    if (summary.ran >= maxRuns || now().getTime() - started >= budgetMs) {
      summary.deferred = true;
      return false;
    }
    return true;
  };

  const run = async (c: ConnectionRow, adapter: RegisteredAdapter, trigger: 'scheduled' | 'replay', attempt: number) => {
    summary.ran++;
    let report: SyncReport;
    try {
      report = await runSync(db, {
        connectionPublicId: c.public_id, adapter: adapter.declaration, trigger, attempt, allowMock: options.allowMock,
        fetchBatch: () => adapter.pull({ connectionPublicId: c.public_id, tenantId: c.tenant_id, cursor: c.cursor_state ?? {}, trigger }),
      });
    } catch {
      // `runSync` throws only when it refuses to write something it should
      // never have produced. One connection's fault does not stop the others.
      summary.failed++;
      return null;
    }
    if (report.outcome === 'refused') summary.refused++;
    else if (report.outcome === 'provider_failed' || report.result.status === 'failed') summary.failed++;
    else summary.succeeded++;
    return report;
  };

  // ── 1. Replays ────────────────────────────────────────────────────────────
  const { data: letters } = await db.from('integration_dead_letter_events').select('id,tenant_id,connection_id')
    .is('resolved_at', null).not('replay_requested_at', 'is', null)
    .order('replay_requested_at', { ascending: true }).limit(maxRuns);
  const replays = (letters ?? []) as { id: string; tenant_id: string; connection_id: string }[];
  const replayed = new Set<string>();
  if (replays.length) {
    const { data: rows } = await db.from('integration_connections').select(CONNECTION_COLUMNS)
      .in('id', [...new Set(replays.map((l) => l.connection_id))]);
    const byId = new Map(((rows ?? []) as ConnectionRow[]).map((c) => [c.id, c]));
    for (const letter of replays) {
      const c = byId.get(letter.connection_id);
      // The letter's school must be its connection's; a mismatch is not ours to run.
      if (!c || c.tenant_id !== letter.tenant_id) { skip('replay connection missing'); continue; }
      const adapter = adapterFor(options.adapters, c);
      if (!adapter) { skip('no registered adapter'); continue; }
      // One pull serves every open replay on a connection.
      if (replayed.has(c.id)) continue;
      if (!room()) break;
      replayed.add(c.id);
      const report = await run(c, adapter, 'replay', 1);
      if (report?.outcome === 'ran' && report.result.status !== 'failed') {
        const { error } = await db.from('integration_dead_letter_events').update({ resolved_at: now().toISOString() })
          .eq('connection_id', c.id).eq('tenant_id', c.tenant_id).is('resolved_at', null)
          .not('replay_requested_at', 'is', null);
        if (!error) summary.replaysResolved += replays.filter((l) => l.connection_id === c.id).length;
      } else if (report && report.outcome !== 'refused') {
        // It failed again. Hand it back to the operator rather than pulling
        // every tick: the letter stays open, the request is withdrawn.
        await db.from('integration_dead_letter_events').update({ replay_requested_at: null })
          .eq('connection_id', c.id).eq('tenant_id', c.tenant_id).is('resolved_at', null);
      }
    }
  }

  // ── 2. Scheduled pulls ────────────────────────────────────────────────────
  const { data: rows } = await db.from('integration_connections').select(CONNECTION_COLUMNS)
    .not('approved_at', 'is', null).in('status', RUNNABLE as string[]).in('sync_mode', PULLED)
    .order('last_attempt_at', { ascending: true, nullsFirst: true });
  const candidates = ((rows ?? []) as ConnectionRow[]).filter((c) => !replayed.has(c.id));

  const due: { c: ConnectionRow; adapter: RegisteredAdapter }[] = [];
  for (const c of candidates) {
    const adapter = adapterFor(options.adapters, c);
    if (!adapter) { skip('no registered adapter'); continue; }
    if (!isDue(c.last_attempt_at, cadenceMinutes(adapter.declaration, c.status), now())) { skip('not due'); continue; }
    due.push({ c, adapter });
  }
  if (due.length) {
    const { data: open } = await db.from('integration_dead_letter_events').select('connection_id')
      .is('resolved_at', null).in('connection_id', due.map((d) => d.c.id));
    const held = new Set(((open ?? []) as { connection_id: string }[]).map((l) => l.connection_id));
    for (const { c, adapter } of due) {
      if (held.has(c.id)) { skip('dead letter awaiting an operator'); continue; }
      summary.due++;
      if (!room()) break;
      const attempt = c.status === 'error'
        // The worker dead-letters on `DEFAULT_RETRY`, so the count is on it too.
        ? 1 + await consecutiveFailures(db, c, DEFAULT_RETRY.maxAttempts)
        : 1;
      await run(c, adapter, 'scheduled', attempt);
    }
  }

  return summary;
}
