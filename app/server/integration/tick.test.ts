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
import { LeaseBroker, memoryBackend, type VaultAuditEvent } from '../../src/lib/integration/vault.ts';
import { OAuthError, type TokenRecord, type TokenStore } from '../../src/lib/integration/oauth.ts';
import { GuardRefusal, ProviderHttpError, providerRuntime, type CredentialServices } from '../../src/lib/integration/provider-client.ts';
import { CANVAS_READ_ADAPTER } from '../../../packages/platform/src/index.ts';
import type { CallAuth } from './tick.ts';
import { fakeDb, type Row, type Tables } from './fakedb.ts';
import { TICK_MINUTES, adapterFor, cadenceMinutes, connectionIssue, intervalMinutes, isDue, tick, type PullRequest, type RegisteredAdapter } from './tick.ts';

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

/** The tick as the Edge Function composes it, with whatever credential services a test supplies. */
const run = (t: Tables, adapters: RegisteredAdapter[], extra: { credentials?: CredentialServices } & Record<string, unknown> = {}) => {
  const { credentials, ...rest } = extra;
  return tick(fakeDb(t), { adapters, now: () => NOW, allowMock: true, runtime: providerRuntime({ credentials }), ...rest });
};

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

  it('requires complete connection-scoped configuration before a live adapter is eligible', () => {
    const configured = {
      tenant_id: 'northstar',
      provider_base_url: 'https://northstar.instructure.com',
      authentication_type: 'api_key',
      credentials_reference: 'vault:tenants/northstar/canvas',
    };
    expect(connectionIssue(CANVAS_READ_ADAPTER, configured)).toBeNull();
    expect(connectionIssue(CANVAS_READ_ADAPTER, { ...configured, authentication_type: 'oauth2' })).toMatch(/authentication/);
    expect(connectionIssue(CANVAS_READ_ADAPTER, { ...configured, credentials_reference: null })).toMatch(/credential/);
    expect(connectionIssue(CANVAS_READ_ADAPTER, { ...configured, credentials_reference: 'vault:platform/canvas' })).toMatch(/tenant namespace/);
    expect(connectionIssue(CANVAS_READ_ADAPTER, { ...configured, provider_base_url: 'https://evil.test' })).toMatch(/origin/);
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

  it('does not open a run or call a live provider when connection configuration is invalid', async () => {
    const t = world([connection('canvas', {
      tenant_id: 'vu', provider_domain: 'lms', provider_name: 'Canvas', provider_product: 'Canvas LMS',
      authentication_type: 'api_key', credentials_reference: 'vault:tenants/vu/canvas', provider_base_url: 'https://evil.test',
    })], {
      tenant_feature_policy: [{ tenant_id: 'vu', capability: 'integration.lms_lti', state: 'production' }],
      integration_scopes: [{ connection_id: 'canvas', scope_key: 'scope.lms.course_context_read', approved: true, expires_at: null }],
    });
    const s = await run(t, [CANVAS_READ_ADAPTER]);
    expect(s).toMatchObject({ ran: 0, skipped: { 'connection configuration invalid': 1 } });
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
    expect(await tick(unreadable, { runtime: providerRuntime(), adapters: [sis(pulls)], now: () => NOW, allowMock: true })).toMatchObject({ outcome: 'stopped' });
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
    const out = await tick(fakeDb(slow), { runtime: providerRuntime(), adapters: [slowSis], allowMock: true, budgetMs: 1_000, now: () => new Date(clock) });
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
    const s = await tick(flaky, { runtime: providerRuntime(), adapters: [sis([])], now: () => NOW, allowMock: true });
    expect(thrown).toBe(true);
    expect(s).toMatchObject({ ran: 2, failed: 1, succeeded: 1 });
  });
});

/** A stand-in whose reads of one table fail once a filter on `column` is applied. */
function unreadable(t: Tables, table: string, column: string) {
  const db = fakeDb(t);
  return { from: (name: string) => {
    const q = db.from(name) as unknown as Record<string, (...a: unknown[]) => unknown>;
    if (name !== table) return q;
    let poisoned = false;
    const wrap: Record<string, unknown> = {};
    for (const [k, f] of Object.entries(q)) {
      wrap[k] = k === 'then'
        ? (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => (poisoned
            ? Promise.resolve({ data: null, error: { message: 'timeout' } }).then(ok, bad)
            : f(ok, bad))
        : (...a: unknown[]) => { if (a[0] === column && k === 'in') poisoned = true; f(...a); return wrap; };
    }
    return wrap;
  } } as unknown as typeof db;
}

describe('found by the Codex review of #811', () => {
  it('counts the failures of a connection still configuring, so it too dead-letters on the fifth', async () => {
    // The worker leaves a failing `configuring` connection in `configuring`,
    // so counting only for `error` restarted it at attempt 1 every tick.
    const t = world([connection('a', { status: 'configuring', last_attempt_at: ago(13 * 60) })], {
      integration_sync_runs: [1, 2, 3, 4].map((n) => ({ id: `r${n}`, connection_id: 'a', tenant_id: 'vu', status: 'failed',
        started_at: ago(13 * 60 * n) })),
    });
    await run(t, [sis([], true)]);
    expect(t.integration_dead_letter_events).toHaveLength(1);
    expect(t.integration_dead_letter_events[0]).toMatchObject({ attempts: 5 });
  });

  it('pulls nothing on schedule when it cannot read whether a connection is held', async () => {
    const pulls: PullRequest[] = [];
    const t = world([connection('a')], {
      integration_dead_letter_events: [{ id: 'd1', tenant_id: 'vu', connection_id: 'a', resolved_at: null, replay_requested_at: null }],
    });
    const s = await tick(unreadable(t, 'integration_dead_letter_events', 'connection_id'),
      { runtime: providerRuntime(), adapters: [sis(pulls)], now: () => NOW, allowMock: true });
    expect(pulls).toEqual([]);
    expect(s).toMatchObject({ ran: 0, deferred: true, skipped: { 'hold unreadable': 1 } });
  });

  it('caps replays by connection, so one connection’s many requests cannot starve another’s', async () => {
    const pulls: PullRequest[] = [];
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, tenant_id: 'vu', connection_id: 'x', resolved_at: null,
      replay_requested_at: ago(60 - i) }));
    const t = world([connection('x', { provider_name: 'Unregistered SIS' }), connection('y', { last_attempt_at: ago(1) })], {
      integration_dead_letter_events: [...many, { id: 'y1', tenant_id: 'vu', connection_id: 'y', resolved_at: null, replay_requested_at: ago(1) }],
    });
    const s = await run(t, [sis(pulls)], { maxRuns: 25 });
    expect(pulls.map((p) => p.trigger)).toEqual(['replay']);
    expect(s).toMatchObject({ replaysResolved: 1 });
  });

  it('keeps to the connection’s own freshness target, and the adapter’s only when it has none', async () => {
    expect(intervalMinutes('01:00:00')).toBe(60);
    expect(intervalMinutes('2 days')).toBe(2880);
    expect(intervalMinutes('1 day 06:30:00')).toBe(1830);
    expect(intervalMinutes('1 mon')).toBe(30 * 1440);
    expect(intervalMinutes('300000 years')).toBe(525600);
    expect(intervalMinutes('1 year')).toBe(525600);
    expect(intervalMinutes('00:00:30.500')).toBe(1);
    expect(intervalMinutes('01:02:03.5')).toBeCloseTo(62 + 3.5 / 60);
    expect(intervalMinutes('-01:30:00')).toBeNull();
    expect(intervalMinutes('00:00:00')).toBeNull();
    expect(intervalMinutes('-1 day +30:00:00')).toBe(360);
    expect(intervalMinutes(null)).toBeNull();
    expect(intervalMinutes('P1D')).toBeNull();

    const pulls: PullRequest[] = [];
    const t = world([
      // An hour's target: due after thirty minutes, where the adapter's day would wait twelve hours.
      connection('hourly', { freshness_target: '01:00:00', last_attempt_at: ago(40) }),
      // Two days: not due at thirteen hours, where the adapter's day would be.
      connection('slow', { freshness_target: '2 days', last_attempt_at: ago(13 * 60) }),
      connection('default', { freshness_target: null, last_attempt_at: ago(13 * 60) }),
    ]);
    await run(t, [sis(pulls)]);
    expect(pulls.map((p) => p.connectionPublicId.slice(5, 12)).sort()).toEqual(['default', 'hourly0']);
  });
});

describe('the job that calls it', () => {
  const scheduler = readFileSync(join(process.cwd(), '..', 'supabase', 'scheduler.sql'), 'utf8');

  it('fires every TICK_MINUTES and stays active when the file is re-run', () => {
    const job = /cron\.schedule\(\s*'integration-sync',\s*'([^']+)'/.exec(scheduler);
    expect(job, 'scheduler.sql no longer schedules integration-sync').not.toBeNull();
    const minutes = job![1].split(' ')[0].split(',').map(Number);
    expect(minutes).toHaveLength(60 / TICK_MINUTES);
    expect(minutes.slice(1).map((m, i) => m - minutes[i])).toEqual(Array(minutes.length - 1).fill(TICK_MINUTES));
    expect(scheduler).toMatch(/jobname = 'integration-sync'\),\s*active := true/);
    expect(scheduler).not.toMatch(/jobname = 'integration-sync'\),\s*active := false/);
  });

  it('calls this project’s integration-tick function, with the token from Vault and nowhere else', () => {
    const job = scheduler.slice(scheduler.indexOf("'integration-sync'"));
    const body = job.slice(0, job.indexOf('$job$;'));
    // The same project `push` calls, so the two cannot drift to different hosts.
    const host = /https:\/\/([a-z0-9]+)\.supabase\.co\/functions\/v1\/push/.exec(scheduler)?.[1];
    expect(host, 'scheduler.sql no longer names the project in the push job').toBeTruthy();
    expect(body).toContain(`url := 'https://${host}.supabase.co/functions/v1/integration-tick'`);
    expect(body).toContain("where name = 'integration_cron_secret'");
    expect(body).not.toMatch(/Bearer [A-Za-z0-9_-]{20,}/);
    // The function is a real directory, declared for deploy.
    const root = join(process.cwd(), '..', 'supabase');
    expect(readFileSync(join(root, 'functions', 'integration-tick', 'index.ts'), 'utf8')).toContain('serveTick');
    expect(readFileSync(join(root, 'config.toml'), 'utf8')).toMatch(/\[functions\.integration-tick\]\s*verify_jwt = false/);
  });
});

describe('provider calls through the tick', () => {
  const SECRET = 'sandbox-client-secret-must-not-print';
  const rotatedAt = new Date('2026-09-01T00:00:00Z');

  function services(over: { token?: TokenRecord | null; audit?: (e: VaultAuditEvent) => void } = {}) {
    const events: VaultAuditEvent[] = [];
    const flagged: string[] = [];
    let record: TokenRecord | null = over.token === undefined
      ? { accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: new Date(NOW.getTime() + 3_600_000), needsReauth: false }
      : over.token;
    const tokens: TokenStore = {
      async load() { return record ? { ...record } : null; },
      async save(_id, next, expected) {
        if ((record?.refreshToken ?? null) !== expected) return false;
        record = next;
        return true;
      },
      async markNeedsReauth(_id, reason) { flagged.push(reason); if (record) record = { ...record, needsReauth: true }; },
    };
    const broker = new LeaseBroker({
      backend: memoryBackend({ 'vault:sandbox/mock-sis': { value: SECRET, version: 'v1', rotatedAt } }),
      now: () => NOW, allowSandbox: true, audit: over.audit ?? ((e) => { events.push(e); }),
    });
    const credentials: CredentialServices = { broker, tokens };
    return { credentials, events, flagged };
  }

  /** A registered mock whose pull makes the given provider calls, in order, through the client. */
  function calling(calls: ((auth: CallAuth) => Promise<unknown>)[], seen: unknown[] = [], declaration: AdapterDeclaration = MOCK_SIS): RegisteredAdapter {
    return {
      declaration,
      oauth: { refresh: async () => ({ accessToken: 'access-2', expiresInSeconds: 3600 }) },
      async pull(request, client) {
        for (const fn of calls) seen.push(await client.call(fn));
        return mockBatch([SIS_FIXTURES.term], `evt-${request.connectionPublicId}-${seen.length}`);
      },
    };
  }

  const errorsOf = (t: Tables) => t.integration_sync_errors as Row[];

  it('gives a pull its credential from the vault and the token store, and leases it once', async () => {
    const svc = services();
    const seen: unknown[] = [];
    const t = world([connection('a')]);
    const s = await run(t, [calling([async (auth) => auth.accessToken, async (auth) => auth.accessToken], seen)], { credentials: svc.credentials });
    expect(s).toMatchObject({ ran: 1, succeeded: 1, failed: 0 });
    expect(seen).toEqual(['access-1', 'access-1']);
    expect(svc.events).toEqual([expect.objectContaining({ event: 'credential.leased', tenantId: 'vu', reference: 'vault:sandbox/mock-sis' })]);
    expect(JSON.stringify(t)).not.toContain(SECRET);
  });

  it('fails closed with no credential services: dead-letters at once as authentication, never calls the provider, and is then held', async () => {
    let reached = false;
    const adapter = calling([async () => { reached = true; }]);
    const t = world([connection('a')]);
    const s = await run(t, [adapter]);
    expect(s).toMatchObject({ ran: 1, failed: 1 });
    expect(reached).toBe(false);
    expect(errorsOf(t)[0]).toMatchObject({ error_category: 'authentication', error_code: 'credential_not_configured', retryable: false });
    expect(t.integration_dead_letter_events).toHaveLength(1);
    expect(t.integration_dead_letter_events[0]).toMatchObject({ attempts: 1 });
    // Next tick: held for an operator, not pulled and dead-lettered again.
    t.integration_connections[0].last_attempt_at = ago(24 * 60);
    const again = await run(t, [adapter]);
    expect(again.skipped['dead letter awaiting an operator']).toBe(1);
    expect(reached).toBe(false);
  });

  it('dead-letters a refused credential at once, without a provider call, and with the reason in the error code', async () => {
    const foreign: AdapterDeclaration = { ...MOCK_SIS, credentialsReference: 'vault:tenants/another-school/sis' };
    const t = world([connection('a')]);
    let reached = false;
    await run(t, [calling([async () => { reached = true; }], [], foreign)], { credentials: services().credentials });
    expect(reached).toBe(false);
    expect(errorsOf(t)[0]).toMatchObject({ error_category: 'authentication', error_code: 'credential_wrong_tenant' });
    expect(t.integration_dead_letter_events).toHaveLength(1);
  });

  it('retries, and does not dead-letter, when the lease could not be audited', async () => {
    const t = world([connection('a')]);
    await run(t, [calling([async () => undefined])], { credentials: services({ audit: () => { throw new Error('audit down'); } }).credentials });
    expect(errorsOf(t)[0]).toMatchObject({ error_category: 'provider_unavailable', error_code: 'audit_unavailable', retryable: true });
    expect(t.integration_dead_letter_events).toHaveLength(0);
  });

  it('dead-letters a dead OAuth grant at once and marks the token, so nothing retries it', async () => {
    const svc = services({ token: { accessToken: 'old', refreshToken: 'refresh-1', expiresAt: new Date(NOW.getTime() + 1_000), needsReauth: false } });
    const adapter: RegisteredAdapter = { ...calling([async () => undefined]), oauth: { refresh: async () => { throw new OAuthError('invalid_grant'); } } };
    const t = world([connection('a')]);
    await run(t, [adapter], { credentials: svc.credentials });
    expect(errorsOf(t)[0]).toMatchObject({ error_category: 'authentication', error_code: 'reauthorization_required', retryable: false });
    expect(t.integration_dead_letter_events).toHaveLength(1);
    expect(svc.flagged).toEqual(['invalid_grant']);
  });

  it('dead-letters a 401 from the provider at once, but treats a 429 as a wait', async () => {
    const unauthorized = world([connection('a')]);
    await run(unauthorized, [calling([async () => { throw new ProviderHttpError(401); }])], { credentials: services().credentials });
    expect(errorsOf(unauthorized)[0]).toMatchObject({ error_category: 'authentication', error_code: 'http_401', retryable: false });
    expect(unauthorized.integration_dead_letter_events).toHaveLength(1);

    const throttled = world([connection('a')]);
    await run(throttled, [calling([async () => { throw new ProviderHttpError(429, 90_000); }])], { credentials: services().credentials });
    expect(errorsOf(throttled)[0]).toMatchObject({ error_category: 'rate_limit', error_code: 'http_429', retryable: true });
    expect(throttled.integration_dead_letter_events).toHaveLength(0);
    expect(throttled.integration_sync_runs[0]).toMatchObject({ status: 'failed' });
  });

  it('holds a pull that makes more calls than the connection\u2019s allowance, as a wait', async () => {
    const limited: AdapterDeclaration = { ...MOCK_SIS, rateLimitPerMinute: 2 };
    const seen: unknown[] = [];
    const t = world([connection('a')]);
    const calls = [async () => 1, async () => 2, async () => 3];
    await run(t, [calling(calls, seen, limited)], { credentials: services().credentials });
    expect(seen).toEqual([1, 2]);
    expect(errorsOf(t)[0]).toMatchObject({ error_category: 'rate_limit', error_code: 'rate_limited', retryable: true });
    expect(t.integration_dead_letter_events).toHaveLength(0);
  });

  it('stops a pull whose provider keeps failing, after the breaker threshold, instead of walking every page', async () => {
    let attempts = 0;
    const adapter: RegisteredAdapter = {
      declaration: MOCK_SIS,
      oauth: { refresh: async () => ({ accessToken: 'access-2', expiresInSeconds: 3600 }) },
      async pull(request, client) {
        // An adapter that walks fifty pages and shrugs off each failed one.
        for (let page = 0; page < 50; page++) {
          try {
            await client.call(async () => { attempts++; throw new ProviderHttpError(503); });
          } catch (e) {
            if (e instanceof GuardRefusal) throw e;
          }
        }
        return mockBatch([], `evt-${request.connectionPublicId}`);
      },
    };
    const t = world([connection('a')]);
    await run(t, [adapter], { credentials: services().credentials });
    expect(attempts).toBe(5);
    expect(errorsOf(t)[0]).toMatchObject({ error_category: 'provider_unavailable', error_code: 'circuit_open', retryable: true });
  });

  it('leaves an adapter that makes no credentialed call, and an anonymous one, working as before', async () => {
    const open: AdapterDeclaration = { ...MOCK_SIS, credentialsReference: null, authentication: 'none' };
    const t = world([connection('a')]);
    const s = await run(t, [calling([async (auth) => auth], [], open)]);
    expect(s).toMatchObject({ ran: 1, succeeded: 1 });
  });
});
