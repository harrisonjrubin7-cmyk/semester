import { beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AccessSagaRunner,
  PersistenceConflict,
  type AccessSaga,
  type AccessSagaState,
  type Decision,
  type Services,
} from '../../../packages/institution/src/index.ts';
import { psql, psqlJson, type PsqlTarget } from '../productivity/psql-rpc.ts';
import { PostgresAccessSagaStore } from './postgres-access-saga.ts';
import { runAccessSagaTick, runScheduledAccessSagaTick } from './access-saga-tick.ts';
import { SERVICES } from './access-saga-registry.ts';

/**
 * The saga runner, through the adapter, against a real migrated Postgres.
 *
 * Skipped unless `SEMESTER_PG_HOST` is set, which `supabase/adapter.sh` does by
 * handing this file the database `check.sh` builds, every migration applied:
 *
 *     SEMESTER_CHECK_PG_ANY=1 supabase/adapter.sh
 *
 * These are the crash rehearsals D-1361 left open. Each one is a thing the unit
 * tests cannot hold, because there the store is a fake that never loses a lease:
 * a worker that dies holding the lease and the one that takes over after it
 * expires; the dead worker's late save, fenced off; several workers claiming at
 * once; a signal landing while a worker holds the lease; and the same operation
 * key reaching the participant from both workers, so a grant prepared before the
 * crash is the grant the successor finds.
 */

const run = promisify(execFile);
const host = process.env.SEMESTER_PG_HOST;
const target: PsqlTarget = { host: host ?? '', port: process.env.SEMESTER_PG_PORT ?? '' };
const HOUR = 3_600_000;

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`;
  return `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
};

const flags = ['-X', '-q', '-At', '-h', target.host, '-p', target.port, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose'];

/** Runs one statement as `service_role`, as a PostgREST call would, and reads a raised SQLSTATE the way supabase-js hands it over. */
async function asService(sql: string): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> {
  try {
    const { stdout } = await run('psql', [...flags, '-c', `set role service_role; ${sql}`]);
    const last = stdout.trim().split('\n').at(-1) ?? '';
    return { data: last === '' ? null : JSON.parse(last), error: null };
  } catch (e) {
    const text = String((e as { stderr?: string }).stderr ?? e);
    const m = /ERROR:\s+([0-9A-Z]{5}):\s*(.*)/.exec(text);
    return { data: null, error: { code: m?.[1] ?? 'XX000', message: m?.[2] ?? text.slice(0, 200) } };
  }
}

/**
 * The slice of a Supabase service client the adapter and the tick use, over
 * `psql`: one connection per call, as `service_role`. `access_saga_claim` and
 * `access_saga_due` return sets, so they come back as the array PostgREST would
 * send; the void functions come back as null.
 */
function serviceClient(): SupabaseClient {
  return {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      const named = Object.entries(args).map(([k, v]) => `${k} => ${literal(v)}`).join(', ');
      if (fn === 'access_saga_claim' || fn === 'access_saga_due') return asService(`select coalesce(jsonb_agg(t), '[]')::text from public.${fn}(${named}) t;`);
      return asService(`select public.${fn}(${named});`);
    },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        const cols = Object.keys(row).join(', ');
        const vals = Object.values(row).map(literal).join(', ');
        return asService(`insert into public.${table} (${cols}) values (${vals});`);
      },
    }),
  } as unknown as SupabaseClient; // the adapter touches only rpc and from().insert
}

interface Row { state: AccessSagaState; revision: number; generation: number; attempts: number; lease_token: string | null; recovery_code: string | null; pa_revoked: boolean; pep_removed: boolean; grant_id: string | null }

const row = async (id: string): Promise<Row> =>
  (await psqlJson<Row[]>(target, `select state, revision, generation, attempts, lease_token, recovery_code, pa_revoked, pep_removed, grant_id from public.access_sagas where id = '${id}'`))[0]!;

const events = (id: string) => psqlJson<{ revision: number; reason_code: string | null }[]>(target, `select revision, reason_code from public.access_saga_events where saga_id = '${id}' order by revision`);

let n = 0;
function newSaga(id: string, over: Partial<AccessSaga> = {}): AccessSaga {
  return {
    id, tenantId: 't1', subjectId: 'u1', intent: { resourceId: 'r1', action: 'registration.readiness.view' },
    requestDigest: 'a'.repeat(64), definitionVersion: '1', state: 'RECEIVED', revision: 0, generation: 0, attempts: 0,
    deadlineAt: Date.now() + HOUR, nextAttemptAt: 0, staleGrantPossible: false, compensation: { paRevoked: false, pepRemoved: false },
    ...over,
  };
}

interface Worker { runner: AccessSagaRunner; store: PostgresAccessSagaStore; calls: string[]; keys: Map<string, string[]> }

/** One worker process: its own adapter and client, a scripted set of participants, the runner over them. */
function worker(script: { evaluate?: () => Decision; verifyCleanup?: () => { paRevoked: boolean; pepAbsent: boolean }; onPrepare?: () => Promise<void> } = {}, options: { leaseMs?: number; store?: PostgresAccessSagaStore } = {}): Worker {
  const store = options.store ?? new PostgresAccessSagaStore({ client: serviceClient() });
  const calls: string[] = [];
  const keys = new Map<string, string[]>();
  const note = (name: string, key?: string) => {
    calls.push(name);
    if (key !== undefined) keys.set(name, [...(keys.get(name) ?? []), key]);
  };
  const services: Services = {
    async validate(_s, key) { note('validate', key); },
    async evaluate(_s, key) { note('evaluate', key); return script.evaluate ? script.evaluate() : { id: 'dec-1', outcome: 'allow' }; },
    async prepare(_s, key) { note('prepare', key); await script.onPrepare?.(); return { id: `grant-for-${key}`, expiresAt: Date.now() + HOUR }; },
    async install(_s, key) { note('install', key); },
    async inspect() { note('inspect'); return { status: 'installed' }; },
    async revokePa(_s, key) { note('revoke_pa', key); return 'confirmed'; },
    async removePep(_s, key) { note('remove_pep', key); return 'confirmed'; },
    async verifyCleanup() { note('verify_cleanup'); return script.verifyCleanup ? script.verifyCleanup() : { paRevoked: true, pepAbsent: true }; },
  };
  const runner = new AccessSagaRunner(store, services, { random: () => 0, newId: () => `evt-${++n}`, ...(options.leaseMs ? { leaseMs: options.leaseMs } : {}) });
  return { runner, store, calls, keys };
}

/** Tick until the saga stops moving, at most `max` times; the path of states seen in the database. */
async function drive(w: Worker, id: string, max = 20): Promise<AccessSagaState[]> {
  const path: AccessSagaState[] = [(await row(id)).state];
  for (let i = 0; i < max; i += 1) {
    const before = (await row(id)).revision;
    await w.runner.tick(id);
    const after = await row(id);
    if (after.revision === before) break;
    path.push(after.state);
  }
  return path;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A store whose process dies on its next save: the save never reaches the database and the lease is never released. */
class DyingStore extends PostgresAccessSagaStore {
  dieOnSave = false;
  died = false;
  override async save(...args: Parameters<PostgresAccessSagaStore['save']>): Promise<void> {
    if (this.dieOnSave) { this.died = true; throw new Error('SIGKILL'); }
    return super.save(...args);
  }
  override async release(...args: Parameters<PostgresAccessSagaStore['release']>): Promise<void> {
    if (this.died) return;
    return super.release(...args);
  }
}

describe.skipIf(!host)('the access saga runner through PostgresAccessSagaStore, against a migrated database', () => {
  beforeEach(async () => {
    await psql(target, 'truncate public.access_saga_signals, public.access_saga_events, public.access_sagas;');
  });

  it('provisions to ACTIVE one move per tick, one event per revision, and leaves no lease behind', async () => {
    const w = worker();
    await w.store.create(newSaga('s-happy'));
    const path = await drive(w, 's-happy');
    expect(path).toEqual(['RECEIVED', 'VALIDATING', 'EVALUATING', 'PREPARING', 'INSTALLING', 'VERIFYING', 'ACTIVE']);
    const r = await row('s-happy');
    expect(r).toMatchObject({ state: 'ACTIVE', revision: 6, generation: 0, lease_token: null, grant_id: expect.stringMatching(/^grant-for-/) });
    expect((await events('s-happy')).map((e) => e.revision)).toEqual([1, 2, 3, 4, 5, 6]);
    // Another tick on an ACTIVE saga changes nothing.
    await w.runner.tick('s-happy');
    expect((await row('s-happy')).revision).toBe(6);
  });

  it('a worker that dies after prepare: the lease blocks a successor until it expires, the successor reuses the operation key, and the dead worker\'s late save is fenced off', async () => {
    const dying = new DyingStore({ client: serviceClient() });
    const a = worker({}, { leaseMs: 400, store: dying });
    await a.store.create(newSaga('s-crash'));
    await drive(a, 's-crash', 3); // RECEIVED → VALIDATING → EVALUATING → PREPARING
    expect((await row('s-crash')).state).toBe('PREPARING');

    // Capture the lease a successor would need, then die inside the PREPARING save with the lease held.
    const leaseBefore = await a.store.claim('s-crash', 400);
    expect(leaseBefore).not.toBeNull();
    await a.store.release(leaseBefore!);
    dying.dieOnSave = true;
    await expect(a.runner.tick('s-crash')).rejects.toThrow('SIGKILL');
    expect(a.calls).toContain('prepare');
    const during = await row('s-crash');
    expect(during).toMatchObject({ state: 'PREPARING', revision: 3 }); // the save never landed
    expect(during.lease_token).not.toBeNull(); // and the lease was never released

    const b = worker({}, { leaseMs: 400 });
    expect(await b.store.claim('s-crash', 400), 'held by the dead worker').toBeNull();
    await sleep(450);
    const path = await drive(b, 's-crash');
    expect(path.at(-1)).toBe('ACTIVE');
    // The successor asked the participant to prepare under the same key the dead worker used, so an idempotent
    // participant hands back the same grant rather than minting a second one.
    expect(b.keys.get('prepare')).toEqual(a.keys.get('prepare'));
    expect((await row('s-crash')).grant_id).toBe(`grant-for-${a.keys.get('prepare')![0]}`);

    // The dead worker comes back and tries to finish its move with the lease it once held: fenced.
    dying.dieOnSave = false;
    const stale = { token: during.lease_token!, saga: { ...newSaga('s-crash'), state: 'PREPARING' as const, revision: 3 } };
    await expect(a.store.save(stale, 3, { ...stale.saga, state: 'INSTALLING', revision: 4, grantId: 'late-grant' }, { eventId: 'late', type: 'access.state.changed', sagaId: 's-crash', tenantId: 't1', revision: 4, occurredAt: new Date().toISOString() }))
      .rejects.toBeInstanceOf(PersistenceConflict);
    expect((await row('s-crash')).state).toBe('ACTIVE');
  });

  it('five workers claim at once: exactly one holds the lease, and the rest see nothing to do', async () => {
    const workers = Array.from({ length: 5 }, () => worker());
    await workers[0]!.store.create(newSaga('s-race'));
    const leases = await Promise.all(workers.map((w) => w.store.claim('s-race', 5_000)));
    expect(leases.filter((l) => l !== null)).toHaveLength(1);
    const held = leases.find((l) => l !== null)!;
    await Promise.all(workers.map((w) => w.runner.tick('s-race')));
    expect((await row('s-race')).revision, 'nobody moved it while the lease was held').toBe(0);
    await workers[0]!.store.release(held);
    expect((await drive(workers[1]!, 's-race')).at(-1)).toBe('ACTIVE');
  });

  it('a signal while a worker holds the lease moves the saga, once per event id, and the worker stands down', async () => {
    const w = worker();
    await w.store.create(newSaga('s-wake', { state: 'WAITING_STEP_UP' }));
    const lease = await w.store.claim('s-wake', 5_000);
    expect(lease).not.toBeNull();

    await w.store.wake('s-wake', 'sig-1', 'requirements_changed');
    await w.store.wake('s-wake', 'sig-1', 'requirements_changed');
    expect(await row('s-wake')).toMatchObject({ state: 'VALIDATING', revision: 1, generation: 1 });
    expect(await events('s-wake')).toEqual([{ revision: 1, reason_code: 'signal_requirements_changed' }]);

    await expect(w.store.save(lease!, 0, { ...lease!.saga, state: 'VALIDATING', revision: 1 }, { eventId: 'evt-stale', type: 'access.state.changed', sagaId: 's-wake', tenantId: 't1', revision: 1, occurredAt: new Date().toISOString() }))
      .rejects.toBeInstanceOf(PersistenceConflict);
    await w.store.release(lease!);

    const path = await drive(w, 's-wake');
    expect(path.at(-1)).toBe('ACTIVE');
    expect((await row('s-wake')).generation).toBe(1);
    for (const k of w.keys.get('prepare') ?? []) expect(k).toContain(',1,'); // keyed by the new generation
  });

  it('revokes an ACTIVE grant on a signal, one side per tick, and REVOKED needs both sides confirmed', async () => {
    const w = worker();
    await w.store.create(newSaga('s-revoke'));
    await drive(w, 's-revoke');
    await w.store.wake('s-revoke', 'sig-revoke', 'revoke');
    expect((await row('s-revoke')).state).toBe('REVOKING');
    const path = await drive(w, 's-revoke');
    expect(path.at(-1)).toBe('REVOKED');
    expect(await row('s-revoke')).toMatchObject({ state: 'REVOKED', pa_revoked: true, pep_removed: true, lease_token: null });
    expect(await w.store.claim('s-revoke', 1_000), 'a finished saga is never claimed').toBeNull();
    await w.store.wake('s-revoke', 'sig-again', 'revoke');
    expect((await row('s-revoke')).state).toBe('REVOKED');
  });

  it('records the runner\'s recovery codes through the lease, as #1363 made the column accept', async () => {
    const w = worker();
    await w.store.create(newSaga('s-flag', { state: 'REVOKING', compensation: { paRevoked: false, pepRemoved: false } }));
    const lease = await w.store.claim('s-flag', 5_000);
    await w.store.flagRecovery(lease!, 'RECOVERY_THRESHOLD_EXCEEDED');
    expect((await row('s-flag')).recovery_code).toBe('RECOVERY_THRESHOLD_EXCEEDED');
    await w.store.release(lease!);
    await expect(w.store.flagRecovery(lease!, 'ENFORCEMENT_UNKNOWN'), 'after release the lease is gone').rejects.toBeInstanceOf(PersistenceConflict);
  });

  it('a storage refusal on create is a storage error with the table\'s reason, and no row', async () => {
    const w = worker();
    await expect(w.store.create(newSaga('s-bad', { requestDigest: 'not-a-digest' }))).rejects.toThrow(/could not create a saga/);
    expect(await psqlJson<unknown[]>(target, `select id from public.access_sagas where id = 's-bad'`)).toEqual([]);
  });
});

/**
 * The worker's tick over the same database: the due list is the database's,
 * the moves are the runner's, and two ticks at once move each saga once. In
 * this file, not one of its own, because both would truncate the same tables
 * and Vitest runs files in parallel.
 */
describe.skipIf(!host)('the access saga worker tick, against a migrated database', () => {
  beforeEach(async () => {
    await psql(target, 'truncate public.access_saga_signals, public.access_saga_events, public.access_sagas;');
  });

  const all = () => psqlJson<{ id: string; state: AccessSagaState; revision: number; lease_token: string | null }[]>(target,
    'select id, state, revision, lease_token from public.access_sagas order by id');

  /** A saga already under way, written as a row: `create` only takes revision 0. */
  const seed = (id: string, state: AccessSagaState, revision: number, over: { nextAttemptAt?: number; deadlineAt?: number; grantExpiresAt?: number } = {}) =>
    psql(target, `insert into public.access_sagas (id, tenant_id, subject_id, intent_resource_id, intent_action, request_digest, definition_version,
      state, revision, deadline_at, next_attempt_at, grant_id, grant_expires_at)
      values ('${id}', 't1', 'u1', 'r1', 'registration.readiness.view', repeat('a', 64), '1', '${state}', ${revision},
      ${over.deadlineAt ?? Date.now() + HOUR}, ${over.nextAttemptAt ?? 0}, ${over.grantExpiresAt ? "'g'" : 'null'}, ${over.grantExpiresAt ?? 'null'});`);

  /** One tick as the scheduler would run it: a fresh client and the scripted participants, calls recorded. */
  const tick = (w: Worker = worker()) => runAccessSagaTick({ client: serviceClient(), services: {
    validate: async (_s, k) => { w.calls.push('validate'); w.keys.set('validate', [...(w.keys.get('validate') ?? []), k]); },
    evaluate: async () => { w.calls.push('evaluate'); return { id: 'dec-1', outcome: 'allow' }; },
    prepare: async (_s, k) => { w.calls.push('prepare'); return { id: `grant-for-${k}`, expiresAt: Date.now() + HOUR }; },
    install: async () => { w.calls.push('install'); },
    inspect: async () => { w.calls.push('inspect'); return { status: 'installed' }; },
    revokePa: async () => 'confirmed',
    removePep: async () => 'confirmed',
    verifyCleanup: async () => ({ paRevoked: true, pepAbsent: true }),
  }, runner: { random: () => 0, newId: () => `evt-${++n}` } });

  it('the scheduled entry with the registry as it is: counts the due sagas and moves none, and with participants it is the tick', async () => {
    const w = worker();
    await seed('t-sched-due', 'VALIDATING', 1);
    await seed('t-sched-done', 'DENIED', 3);
    // What the Edge Function runs today: the registry holds null.
    expect(await runScheduledAccessSagaTick(serviceClient(), SERVICES)).toEqual({ outcome: 'unregistered', due: 1, ticked: 0, failed: [], deferred: false });
    expect(await all()).toEqual([
      { id: 't-sched-done', state: 'DENIED', revision: 3, lease_token: null },
      { id: 't-sched-due', state: 'VALIDATING', revision: 1, lease_token: null },
    ]);
    expect(await events('t-sched-due')).toEqual([]);
    // With participants handed in, the same call is the tick.
    const ran = await runScheduledAccessSagaTick(serviceClient(), {
      validate: async () => { w.calls.push('validate'); }, evaluate: async () => ({ id: 'dec-1', outcome: 'allow' }),
      prepare: async () => ({ id: 'g', expiresAt: Date.now() + HOUR }), install: async () => {}, inspect: async () => ({ status: 'installed' }),
      revokePa: async () => 'confirmed', removePep: async () => 'confirmed', verifyCleanup: async () => ({ paRevoked: true, pepAbsent: true }),
    }, { runner: { random: () => 0, newId: () => `evt-${++n}` } });
    expect(ran).toEqual({ outcome: 'ran', due: 1, ticked: 1, failed: [], deferred: false });
    expect((await all()).find((r) => r.id === 't-sched-due')).toEqual({ id: 't-sched-due', state: 'EVALUATING', revision: 2, lease_token: null });
    expect(w.calls).toEqual(['validate']);
  });

  it('moves only the sagas the database says are due, one step each, and leaves no lease', async () => {
    const w = worker();
    await w.store.create(newSaga('t-due-1'));
    await seed('t-due-2', 'VALIDATING', 1);
    await w.store.create(newSaga('t-later', { nextAttemptAt: Date.now() + HOUR }));
    await seed('t-done', 'DENIED', 3);
    await seed('t-waiting', 'WAITING_APPROVAL', 2);
    await seed('t-active', 'ACTIVE', 6, { grantExpiresAt: Date.now() + HOUR });
    await seed('t-active-expired', 'ACTIVE', 6, { grantExpiresAt: Date.now() - 1 });
    expect(await tick(w)).toEqual({ due: 3, ticked: 3, failed: [], deferred: false });
    expect(await all()).toEqual([
      { id: 't-active', state: 'ACTIVE', revision: 6, lease_token: null },
      { id: 't-active-expired', state: 'REVOKING', revision: 7, lease_token: null },
      { id: 't-done', state: 'DENIED', revision: 3, lease_token: null },
      { id: 't-due-1', state: 'VALIDATING', revision: 1, lease_token: null },
      { id: 't-due-2', state: 'EVALUATING', revision: 2, lease_token: null },
      { id: 't-later', state: 'RECEIVED', revision: 0, lease_token: null },
      { id: 't-waiting', state: 'WAITING_APPROVAL', revision: 2, lease_token: null },
    ]);
    expect(w.calls).toEqual(['validate']);
    expect(w.keys.get('validate')).toEqual([JSON.stringify(['t-due-2', '1', 0, 'validate'])]);
  });

  it('ticked repeatedly, drives a saga to ACTIVE and then has nothing to do', async () => {
    const w = worker();
    await w.store.create(newSaga('t-s'));
    const path: AccessSagaState[] = [];
    for (let i = 0; i < 7; i += 1) {
      await tick(w);
      path.push((await all())[0]!.state);
    }
    expect(path).toEqual(['VALIDATING', 'EVALUATING', 'PREPARING', 'INSTALLING', 'VERIFYING', 'ACTIVE', 'ACTIVE']);
    expect(await tick(w)).toEqual({ due: 0, ticked: 0, failed: [], deferred: false });
    expect((await events('t-s')).map((e) => e.revision)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('a wake makes a saga due at the next tick, under its new generation', async () => {
    const w = worker();
    await seed('t-w', 'WAITING_APPROVAL', 2);
    expect(await tick(w)).toMatchObject({ due: 0 });
    await w.store.wake('t-w', 'sig-tick', 'requirements_changed');
    expect((await all())[0]).toMatchObject({ state: 'VALIDATING', revision: 3 });
    expect(await tick(w)).toMatchObject({ due: 1, ticked: 1 });
    expect((await all())[0]).toMatchObject({ state: 'EVALUATING', revision: 4, lease_token: null });
    expect(w.keys.get('validate')).toEqual([JSON.stringify(['t-w', '1', 1, 'validate'])]);
  });

  it('two ticks at once never move a saga twice for one revision, and leave no lease', async () => {
    const w = worker();
    for (let i = 0; i < 6; i += 1) await w.store.create(newSaga(`t-c-${i}`));
    const [a, b] = await Promise.all([tick(worker()), tick(worker())]);
    expect(a.failed).toEqual([]);
    expect(b.failed).toEqual([]);
    expect(a.ticked + b.ticked).toBe(a.due + b.due);
    // Every saga moved at least once and never twice for one tick: each revision has
    // exactly one event, no lease is left, and the two ticks together did at most two
    // moves per saga (a saga one tick moved is due again when the other lists it).
    const after = await all();
    expect(after).toHaveLength(6);
    expect(after.every((r) => r.revision >= 1 && r.revision <= 2 && r.lease_token === null)).toBe(true);
    const count = await psqlJson<{ n: number }[]>(target, 'select count(*)::int as n from public.access_saga_events');
    expect(count[0]!.n).toBe(after.reduce((sum, r) => sum + r.revision, 0));
  });
});
