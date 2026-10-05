// Generated from app/server/integration/tick.ts by app/scripts/edge-integration.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-integration.ts`.

/**
 * The scheduler's tick: which connections are due, and one `runSync` for each.
 *
 * `supabase/scheduler.sql` calls this every fifteen minutes through the
 * `integration-tick` Edge Function (`supabase/functions/integration-tick/`,
 * which runs a generated copy — see `app/scripts/edge-integration.ts`), and
 * the daily retention sweep is a separate job
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
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { AdapterDeclaration } from './adapter.ts';
import type { ConnectionStatus } from './catalog.ts';
import type { ProviderBatch } from './pipeline.ts';
import { intervalMinutes } from './freshness.ts';
import { DEFAULT_RETRY } from './retry.ts';
import { runSync, type FailureClassifier, type SyncReport } from './worker.ts';

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

/** What one provider call is given. Valid for that call; adapter code must not keep it. */
export interface CallAuth {
  /** OAuth 2 / OIDC bearer token, or null. */
  accessToken: string | null;
  /** The leased secret for `api_key`, `sftp`, `mtls` and the like, or null. */
  secret: string | null;
}

/** How an adapter that authenticates with OAuth gets a new access token. */
export interface OAuthBinding {
  refresh(refreshToken: string, clientSecret: string): Promise<{ accessToken: string; refreshToken?: string; expiresInSeconds: number }>;
}

/**
 * The client an adapter makes its provider calls through. Each call is
 * admitted by the connection's rate limit, Retry-After wait and circuit
 * breaker, and is handed its credential. An adapter that calls the provider any
 * other way has stepped round all three; `contract-harness.ts` fails it.
 */
export interface ProviderClient {
  call<T>(fn: (auth: CallAuth) => Promise<T>): Promise<T>;
}

/** A live adapter: its declaration, and how to fetch one batch. */
export interface RegisteredAdapter {
  declaration: AdapterDeclaration;
  pull(request: PullRequest, client: ProviderClient): Promise<ProviderBatch>;
  /** How this adapter gets a new OAuth access token. Required when it authenticates with OAuth. */
  oauth?: OAuthBinding;
}

/**
 * What the tick needs from the provider-call machinery, handed in by whoever
 * composes it. It is a port and not an import because the gateway may not take
 * on more client source than `importboundaries.ts` records; the
 * implementation is `providerRuntime()` in `provider-client.ts`, composed by
 * the Edge Function (and by the tests). There is no default, on purpose: a
 * tick with no runtime would hand adapters no guard and no credential rules.
 */
export interface ProviderRuntime {
  /** The client for one pull of one connection. */
  clientFor(context: {
    adapter: RegisteredAdapter;
    tenantId: string;
    connectionPublicId: string;
    now: () => Date;
  }): ProviderClient;
  /** What a failed pull means. */
  classify: FailureClassifier;
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
  /**
   * The provider-call machinery: guard, credentials and failure
   * classification. The production Edge Function composes one with no
   * credential services, so an adapter that declares a `credentialsReference`
   * is refused on its first call (dead-lettered as `authentication`) rather
   * than calling its provider anonymously. See `provider-client.ts`.
   */
  runtime: ProviderRuntime;
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
  freshness_target: string | null;
}

const CONNECTION_COLUMNS =
  'id,public_id,tenant_id,provider_domain,provider_name,provider_product,status,sync_mode,cursor_state,last_attempt_at,freshness_target';
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

export { intervalMinutes } from './freshness.ts';

/**
 * Minutes between scheduled pulls: half the freshness target, never under one
 * tick. The connection's own target, when it has one, is the one the dashboard
 * and `integration_health()` measure it against, so it wins over the adapter's.
 */
export function cadenceMinutes(adapter: AdapterDeclaration, status: ConnectionStatus, targetMinutes: number | null = null): number {
  if (status === 'error') return TICK_MINUTES;
  return Math.max(TICK_MINUTES, Math.floor((targetMinutes ?? adapter.freshnessTargetMinutes) / 2));
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
        classify: options.runtime.classify,
        // The client is built per pull, so what the guard remembers lasts one
        // pull. What carries a failure from tick to tick is the stored run
        // history and the dead-letter hold below, not memory in this process.
        fetchBatch: () => adapter.pull(
          { connectionPublicId: c.public_id, tenantId: c.tenant_id, cursor: c.cursor_state ?? {}, trigger },
          options.runtime.clientFor({ adapter, tenantId: c.tenant_id, connectionPublicId: c.public_id, now }),
        ),
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
  // Capped by connection, not by row: one connection with many requests, or
  // one that is refused every tick, must not push another's out of the window.
  const PAGE = 200;
  const letters: { id: string; tenant_id: string; connection_id: string }[] = [];
  const order: string[] = [];
  for (let page = 0; page < 10 && order.length < maxRuns; page++) {
    const { data, error } = await db.from('integration_dead_letter_events').select('id,tenant_id,connection_id')
      .is('resolved_at', null).not('replay_requested_at', 'is', null)
      .order('replay_requested_at', { ascending: true }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) break;
    const rows = (data ?? []) as typeof letters;
    for (const l of rows) {
      if (!order.includes(l.connection_id)) {
        if (order.length >= maxRuns) break;
        order.push(l.connection_id);
      }
      letters.push(l);
    }
    if (rows.length < PAGE) break;
  }
  const replayed = new Set<string>();
  if (order.length) {
    const { data: rows } = await db.from('integration_connections').select(CONNECTION_COLUMNS).in('id', order);
    const byId = new Map(((rows ?? []) as ConnectionRow[]).map((c) => [c.id, c]));
    for (const id of order) {
      const c = byId.get(id);
      const mine = letters.filter((l) => l.connection_id === id);
      // A letter's school must be its connection's; a mismatch is not ours to run.
      if (!c || mine.some((l) => l.tenant_id !== c.tenant_id)) { skip('replay connection missing'); continue; }
      const adapter = adapterFor(options.adapters, c);
      if (!adapter) { skip('no registered adapter'); continue; }
      if (!room()) break;
      replayed.add(c.id);
      // One pull serves every open replay on a connection.
      const report = await run(c, adapter, 'replay', 1);
      if (report?.outcome === 'ran' && report.result.status !== 'failed') {
        const { error } = await db.from('integration_dead_letter_events').update({ resolved_at: now().toISOString() })
          .eq('connection_id', c.id).eq('tenant_id', c.tenant_id).is('resolved_at', null)
          .not('replay_requested_at', 'is', null);
        if (!error) summary.replaysResolved += mine.length;
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
    const cadence = cadenceMinutes(adapter.declaration, c.status, intervalMinutes(c.freshness_target));
    if (!isDue(c.last_attempt_at, cadence, now())) { skip('not due'); continue; }
    due.push({ c, adapter });
  }
  if (due.length) {
    const { data: open, error: holdError } = await db.from('integration_dead_letter_events').select('connection_id')
      .is('resolved_at', null).in('connection_id', due.map((d) => d.c.id));
    if (holdError) {
      // Not knowing whether a connection is held is not knowing it is free:
      // pull nothing on schedule, and let the next tick try again.
      for (let i = 0; i < due.length; i++) skip('hold unreadable');
      summary.deferred = true;
      return summary;
    }
    const held = new Set(((open ?? []) as { connection_id: string }[]).map((l) => l.connection_id));
    for (const { c, adapter } of due) {
      if (held.has(c.id)) { skip('dead letter awaiting an operator'); continue; }
      summary.due++;
      if (!room()) break;
      // Counted for every status: the worker leaves a failing `configuring`
      // connection in `configuring`, and it must reach the fifth attempt too.
      // The worker dead-letters on `DEFAULT_RETRY`, so the count is on it too.
      const attempt = 1 + await consecutiveFailures(db, c, DEFAULT_RETRY.maxAttempts);
      await run(c, adapter, 'scheduled', attempt);
    }
  }

  return summary;
}
