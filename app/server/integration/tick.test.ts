/**
 * The scheduler's tick against the in-memory tables. `runSync` is the real
 * worker; what these prove is the tick's choosing — who is due, who is held,
 * what a replay resolves — and that it never widens what the worker allows.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MOCK_SIS, SIS_FIXTURES } from '../../src/lib/integration/mock-sis.ts';
import { mockBatch } from '../../src/lib/integration/mock-adapter.ts';
import type { AdapterDeclaration } from '../../src/lib/integration/adapter.ts';
import { fakeDb, type Row, type Tables } from './fakedb.ts';
import { TICK_MINUTES, adapterFor, cadenceMinutes, isDue, tick, type PullRequest, type RegisteredAdapter } from './tick.ts';

const NOW = new Date('2026-09-27T12:00:00Z');
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

function connection(id: string, over: Row = {}): Row {
  return {
    id, public_id: `conn_${id.padEnd(22, '0')}`, tenant_id: 'vu', provider_domain: 'sis', provider_name: 'Mock SIS',
    provider_product: 'Fixture 1.0', status: 'healthy', sync_mode: 'batch', approved_at: '2026-09-20T00:00:00Z',
    data_classification_ceiling: 'T3', cursor_state: { watermark: '2026-09-26T00:00:00Z' }, last_attempt_at: ago(24 * 60),
    ...over,
  };
}

function world(connections: Row[], over: Tables = {}): Tables {
  return {
    tenant_feature_policy: [{ tenant_id: 'vu', capability: 'integration.sis_read', state: 'production' }],
    integration_connections: connections,
    integration_scopes: connections.flatMap((c) => MOCK_SIS.scopes.map((k) => ({ connection_id: c.id, scope_key: k, approved: true, expires_at: null }))),
    feature_kill_switch: [],
    canonical_entity_references: [],
    integration_sync_runs: [],
    integration_dead_letter_events: [],
    ...over,
  };
}

/** A registered mock that records what it was asked for, and can be made to fail. */
function sis(pulls: PullRequest[], fail = false): RegisteredAdapter {
  return {
    declaration: MOCK_SIS,
    async pull(request) {
      pulls.push(request);
      if (fail) throw new Error('503 from provider');
      return mockBatch([SIS_FIXTURES.term], `evt-${request.connectionPublicId}-${pulls.length}`);
    },
  };
}

const run = (t: Tables, adapters: RegisteredAdapter[], extra = {}) =>
  tick(fakeDb(t), { adapters, now: () => NOW, allowMock: true, ...extra });

describe('when a connection is due', () => {
  it('half its freshness target, never more often than a tick, and every tick while it is failing', () => {
    expect(cadenceMinutes(MOCK_SIS, 'healthy')).toBe(12 * 60);
    expect(cadenceMinutes({ ...MOCK_SIS, freshnessTargetMinutes: 5 } as AdapterDeclaration, 'healthy')).toBe(15);
    expect(cadenceMinutes(MOCK_SIS, 'error')).toBe(15);
    expect(isDue(null, 15, NOW)).toBe(true);
    expect(isDue(ago(14.5), 15, NOW)).toBe(true); // a tick that fires a little early is not a cadence late
    expect(isDue(ago(10), 15, NOW)).toBe(false);
  });

  it('matches an adapter on domain, provider and product, and refuses to guess between two', () => {
    const a = sis([]);
    const row = { provider_domain: 'sis', provider_name: 'mock sis ', provider_product: 'Fixture 1.0' };
    expect(adapterFor([a], row)).toBe(a);
    expect(adapterFor([a], { ...row, provider_product: 'Other' })).toBeNull();
    expect(adapterFor([a], { ...row, provider_domain: 'lms' })).toBeNull();
    expect(adapterFor([a, { ...a }], row)).toBeNull();
  });
});

describe('the tick', () => {
  it('pulls a due connection from its cursor and records the run the way the worker does', async () => {
    const pulls: PullRequest[] = [];
    const t = world([connection('a')]);
    const s = await run(t, [sis(pulls)]);
    expect(s).toMatchObject({ outcome: 'ran', due: 1, ran: 1, succeeded: 1, failed: 0, deferred: false });
    expect(pulls).toEqual([{ connectionPublicId: t.integration_connections[0].public_id, tenantId: 'vu',
      cursor: { watermark: '2026-09-26T00:00:00Z' }, trigger: 'scheduled' }]);
    expect(t.integration_sync_runs[0]).toMatchObject({ trigger_type: 'scheduled', status: 'succeeded' });
    expect(t.canonical_entity_references).toHaveLength(1);
  });

  it('leaves alone what is not due, not pulled, not approved, paused, or has no adapter', async () => {
    const pulls: PullRequest[] = [];
    const t = world([
      connection('recent', { last_attempt_at: ago(60) }),
      connection('webhook', { sync_mode: 'webhook' }),
      connection('manual', { sync_mode: 'manual' }),
      connection('unapproved', { approved_at: null, status: 'configuring' }),
      connection('paused', { status: 'paused' }),
      connection('gone', { status: 'disconnected' }),
      connection('lms', { provider_domain: 'lms', provider_name: 'Canvas' }),
    ]);
    const s = await run(t, [sis(pulls)]);
    expect(pulls).toEqual([]);
    expect(s).toMatchObject({ due: 0, ran: 0, skipped: { 'not due': 1, 'no registered adapter': 1 } });
    expect(t.integration_sync_runs).toEqual([]);
  });

  it('with the empty production registry, runs nothing at all', async () => {
    const t = world([connection('a'), connection('b')]);
    const s = await run(t, []);
    expect(s).toMatchObject({ ran: 0, skipped: { 'no registered adapter': 2 } });
    expect(t.integration_sync_runs).toEqual([]);
  });

  it('stops for the global kill switch, and for one it cannot read', async () => {
    const pulls: PullRequest[] = [];
    const killed = world([connection('a')], { feature_kill_switch: [{ switch_key: 'kill.integration_sync', tenant_id: null, engaged: true }] });
    expect(await run(killed, [sis(pulls)])).toMatchObject({ outcome: 'stopped', ran: 0 });
    expect(pulls).toEqual([]);

    const t = world([connection('a')]);
    const db = fakeDb(t);
    const unreadable = { from: (name: string) => {
      if (name !== 'feature_kill_switch') return db.from(name);
      const q: Record<string, unknown> = { select: () => q, eq: () => q, in: () => q,
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'timeout' } }).then(ok) };
      return q;
    } } as unknown as typeof db;
    expect(await tick(unreadable, { adapters: [sis(pulls)], now: () => NOW, allowMock: true })).toMatchObject({ outcome: 'stopped' });
    expect(pulls).toEqual([]);
  });

  it('leaves the refusals to the worker, and they write nothing', async () => {
    // A school switch, the connection's switch and the connector flag are the
    // worker's to enforce; the tick passes them through rather than
    // re-deciding them, and a refusal opens no run.
    const pulls: PullRequest[] = [];
    const t = world([connection('a')], {
      feature_kill_switch: [{ switch_key: 'kill.integration_sync', tenant_id: 'vu', engaged: true }],
    });
    const s = await run(t, [sis(pulls)]);
    expect(s).toMatchObject({ ran: 1, refused: 1, succeeded: 0 });
    expect(pulls).toEqual([]);
    expect(t.integration_sync_runs).toEqual([]);
  });

  it('counts a failing connection’s attempts, so the fifth failure dead-letters', async () => {
    const t = world([connection('a', { status: 'error', last_attempt_at: ago(16) })], {
      integration_sync_runs: [1, 2, 3, 4].map((n) => ({ id: `r${n}`, connection_id: 'a', tenant_id: 'vu', status: 'failed',
        started_at: ago(16 * n) })).concat([{ id: 'r0', connection_id: 'a', tenant_id: 'vu', status: 'succeeded', started_at: ago(200) }]),
    });
    const s = await run(t, [sis([], true)]);
    expect(s).toMatchObject({ ran: 1, failed: 1 });
    expect(t.integration_dead_letter_events).toHaveLength(1);
    expect(t.integration_dead_letter_events[0]).toMatchObject({ attempts: 5 });
  });

  it('then holds it for an operator instead of dead-lettering it every tick', async () => {
    const pulls: PullRequest[] = [];
    const t = world([connection('a', { status: 'error', last_attempt_at: ago(20) })], {
      integration_dead_letter_events: [{ id: 'd1', tenant_id: 'vu', connection_id: 'a', resolved_at: null, replay_requested_at: null }],
    });
    const s = await run(t, [sis(pulls)]);
    expect(s).toMatchObject({ ran: 0, skipped: { 'dead letter awaiting an operator': 1 } });
    expect(pulls).toEqual([]);
  });

  it('runs a requested replay once per connection and resolves its letters when it works', async () => {
    const pulls: PullRequest[] = [];
    const t = world([connection('a', { status: 'error', last_attempt_at: ago(1) })], {
      integration_dead_letter_events: [
        { id: 'd1', tenant_id: 'vu', connection_id: 'a', resolved_at: null, replay_requested_at: ago(5) },
        { id: 'd2', tenant_id: 'vu', connection_id: 'a', resolved_at: null, replay_requested_at: ago(4) },
      ],
    });
    const s = await run(t, [sis(pulls)]);
    expect(pulls.map((p) => p.trigger)).toEqual(['replay']);
    expect(s).toMatchObject({ ran: 1, succeeded: 1, replaysResolved: 2 });
    expect(t.integration_dead_letter_events.every((l) => l.resolved_at === NOW.toISOString())).toBe(true);
    expect(t.integration_sync_runs[0]).toMatchObject({ trigger_type: 'replay' });
  });

  it('hands a replay that fails again back to the operator', async () => {
    const t = world([connection('a', { status: 'error' })], {
      integration_dead_letter_events: [{ id: 'd1', tenant_id: 'vu', connection_id: 'a', resolved_at: null, replay_requested_at: ago(5) }],
    });
    const s = await run(t, [sis([], true)]);
    expect(s).toMatchObject({ ran: 1, failed: 1, replaysResolved: 0 });
    expect(t.integration_dead_letter_events[0]).toMatchObject({ resolved_at: null, replay_requested_at: null });
    // And the next tick holds it rather than pulling again.
    expect(await run(t, [sis([], true)])).toMatchObject({ ran: 0 });
  });

  it('never replays a letter whose school is not its connection’s', async () => {
    const pulls: PullRequest[] = [];
    const t = world([connection('a', { last_attempt_at: ago(1) })], {
      integration_dead_letter_events: [{ id: 'd1', tenant_id: 'other', connection_id: 'a', resolved_at: null, replay_requested_at: ago(5) }],
    });
    const s = await run(t, [sis(pulls)]);
    expect(pulls).toEqual([]);
    expect(s.skipped).toMatchObject({ 'replay connection missing': 1 });
  });

  it('keeps to its run cap and its time budget, oldest attempt first, and says what it left', async () => {
    const pulls: PullRequest[] = [];
    const t = world([
      connection('newer', { last_attempt_at: ago(13 * 60) }),
      connection('never', { last_attempt_at: null }),
      connection('older', { last_attempt_at: ago(30 * 60) }),
    ]);
    const s = await run(t, [sis(pulls)], { maxRuns: 2 });
    expect(pulls.map((p) => p.connectionPublicId.slice(5, 10))).toEqual(['never', 'older']);
    expect(s).toMatchObject({ due: 3, ran: 2, deferred: true });

    // A pull that takes longer than the budget: the second is left for the next tick.
    let clock = NOW.getTime();
    const slowSis: RegisteredAdapter = { declaration: MOCK_SIS, pull: async (r) => {
      clock += 2_000;
      return mockBatch([SIS_FIXTURES.term], `evt-${r.connectionPublicId}`);
    } };
    const slow = world([connection('a'), connection('b')]);
    const out = await tick(fakeDb(slow), { adapters: [slowSis], allowMock: true, budgetMs: 1_000, now: () => new Date(clock) });
    expect(out).toMatchObject({ ran: 1, deferred: true });
  });

  it('keeps going past a connection whose run throws', async () => {
    const t = world([connection('a', { last_attempt_at: null }), connection('b')]);
    const db = fakeDb(t);
    let thrown = false;
    const flaky = { from: (name: string) => {
      if (name === 'integration_webhook_events' && !thrown) { thrown = true; throw new Error('socket hang up'); }
      return db.from(name);
    } } as unknown as typeof db;
    const s = await tick(flaky, { adapters: [sis([])], now: () => NOW, allowMock: true });
    expect(thrown).toBe(true);
    expect(s).toMatchObject({ ran: 2, failed: 1, succeeded: 1 });
  });
});

describe('the job that calls it', () => {
  const scheduler = readFileSync(join(process.cwd(), '..', 'supabase', 'scheduler.sql'), 'utf8');

  it('fires every TICK_MINUTES and is parked until it is configured', () => {
    const job = /cron\.schedule\(\s*'integration-sync',\s*'([^']+)'/.exec(scheduler);
    expect(job, 'scheduler.sql no longer schedules integration-sync').not.toBeNull();
    const minutes = job![1].split(' ')[0].split(',').map(Number);
    expect(minutes).toHaveLength(60 / TICK_MINUTES);
    expect(minutes.slice(1).map((m, i) => m - minutes[i])).toEqual(Array(minutes.length - 1).fill(TICK_MINUTES));
    expect(scheduler).toMatch(/jobname = 'integration-sync'\),\s*active := false/);
  });

  it('reads its token and its address from Vault, and bakes in neither', () => {
    const body = scheduler.slice(scheduler.indexOf("'integration-sync'"));
    expect(body).toContain("where name = 'integration_tick_url'");
    expect(body).toContain("where name = 'integration_cron_secret'");
    expect(body.slice(0, body.indexOf('$job$;'))).not.toMatch(/https?:\/\//);
  });
});
