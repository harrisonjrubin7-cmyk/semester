import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Services } from '../../../packages/institution/src/index.ts';
import { PostgresAccessSagaStore } from './postgres-access-saga.ts';
import { DEFAULT_MAX_SAGAS, dueSagas, runAccessSagaTick, runScheduledAccessSagaTick } from './access-saga-tick.ts';
import { SERVICES } from './access-saga-registry.ts';

const T0 = 1_780_000_000_000;

function sagaRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id, tenant_id: 't1', subject_id: 'u1', intent_resource_id: 'r1', intent_action: 'registration.readiness.view',
    request_digest: 'a'.repeat(64), definition_version: '1', state: 'RECEIVED', revision: 0, generation: 0, attempts: 0,
    deadline_at: T0 + 3_600_000, next_attempt_at: 0, decision_id: null, grant_id: null, grant_expires_at: null,
    stale_grant_possible: false, pa_revoked: false, pep_removed: false, last_error: null, recovery_code: null,
    ...over,
  };
}

/**
 * A service client that answers the worker's four calls from a script: the due
 * list, then claim, save and release per saga. It records every rpc in order.
 */
function fakeClient(script: {
  due?: unknown;
  dueError?: unknown;
  rows?: Record<string, Record<string, unknown>>;
  /** Saga ids whose claim comes back empty: held by another worker. */
  held?: string[];
  /** Saga ids whose save raises the given SQLSTATE. */
  saveError?: Record<string, string>;
}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      if (name === 'access_saga_due') return script.dueError ? { data: null, error: script.dueError } : { data: 'due' in script ? script.due : [], error: null };
      const id = args.p_id as string;
      if (name === 'access_saga_claim') {
        if (script.held?.includes(id)) return { data: [], error: null };
        const row = script.rows?.[id];
        return row ? { data: [{ lease_token: `tok-${id}`, saga: row }], error: null } : { data: [], error: null };
      }
      if (name === 'access_saga_save') {
        const code = script.saveError?.[id];
        return code ? { data: null, error: { code, message: `scripted ${code}` } } : { data: null, error: null };
      }
      return { data: null, error: null };
    },
    from: () => ({ insert: async () => ({ data: null, error: null }) }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

const quiet: Services = {
  async validate() {},
  async evaluate() { return { id: 'dec-1', outcome: 'allow' }; },
  async prepare() { return { id: 'g-1', expiresAt: T0 + 3_600_000 }; },
  async install() {},
  async inspect() { return { status: 'installed' }; },
  async revokePa() { return 'confirmed'; },
  async removePep() { return 'confirmed'; },
  async verifyCleanup() { return { paRevoked: true, pepAbsent: true }; },
};

const names = (calls: { name: string; args: Record<string, unknown> }[]) => calls.map((c) => `${c.name}:${c.args.p_id ?? c.args.p_limit}`);

describe('dueSagas', () => {
  it('asks the function for the list and hands it back', async () => {
    const f = fakeClient({ due: ['a', 'b'] });
    await expect(dueSagas(f.client, 7)).resolves.toEqual(['a', 'b']);
    expect(f.calls).toEqual([{ name: 'access_saga_due', args: { p_limit: 7 } }]);
  });

  it('treats a refused call or an unreadable list as a storage failure, and passes its control', async () => {
    await expect(dueSagas(fakeClient({ dueError: { code: '42501', message: 'permission denied' } }).client, 5)).rejects.toThrow(/could not list/);
    for (const data of [null, 'a', ['a', 3], [''], { ids: ['a'] }]) {
      await expect(dueSagas(fakeClient({ due: data }).client, 5), JSON.stringify(data)).rejects.toThrow(/could not read/);
    }
    await expect(dueSagas(fakeClient({ due: [] }).client, 5)).resolves.toEqual([]);
  });
});

describe('runAccessSagaTick', () => {
  it('ticks each due saga once, in the order the database gave, and releases every lease', async () => {
    const f = fakeClient({ due: ['s2', 's1'], rows: { s1: sagaRow('s1'), s2: sagaRow('s2') } });
    const summary = await runAccessSagaTick({ client: f.client, services: quiet, now: () => T0, runner: { newId: () => 'evt' } });
    expect(summary).toEqual({ due: 2, ticked: 2, failed: [], deferred: false });
    expect(names(f.calls)).toEqual([
      `access_saga_due:${DEFAULT_MAX_SAGAS + 1}`,
      'access_saga_claim:s2', 'access_saga_save:s2', 'access_saga_release:s2',
      'access_saga_claim:s1', 'access_saga_save:s1', 'access_saga_release:s1',
    ]);
  });

  it('does nothing but ask when nothing is due', async () => {
    const f = fakeClient({ due: [] });
    await expect(runAccessSagaTick({ client: f.client, services: quiet, now: () => T0 })).resolves.toEqual({ due: 0, ticked: 0, failed: [], deferred: false });
    expect(f.calls).toHaveLength(1);
  });

  it('a saga another worker holds, or moves under this one, is a tick that ran and not a failure', async () => {
    const f = fakeClient({ due: ['held', 'moved', 'ok'], rows: { moved: sagaRow('moved'), ok: sagaRow('ok') }, held: ['held'], saveError: { moved: 'SC409' } });
    const summary = await runAccessSagaTick({ client: f.client, services: quiet, now: () => T0, runner: { newId: () => 'evt' } });
    expect(summary).toEqual({ due: 3, ticked: 3, failed: [], deferred: false });
    // The held saga was claimed and left alone; the moved one was released after its conflict.
    expect(names(f.calls).filter((c) => c.endsWith(':held'))).toEqual(['access_saga_claim:held']);
    expect(names(f.calls).filter((c) => c.endsWith(':moved'))).toEqual(['access_saga_claim:moved', 'access_saga_save:moved', 'access_saga_release:moved']);
  });

  it('a storage failure on one saga is recorded and the others still run', async () => {
    const f = fakeClient({ due: ['bad', 'ok'], rows: { bad: sagaRow('bad'), ok: sagaRow('ok') }, saveError: { bad: '08006' } });
    const summary = await runAccessSagaTick({ client: f.client, services: quiet, now: () => T0, runner: { newId: () => 'evt' } });
    expect(summary.ticked).toBe(1);
    expect(summary.failed).toEqual([{ id: 'bad', error: expect.stringMatching(/could not save a move/) }]);
    expect(names(f.calls).filter((c) => c.endsWith(':ok'))).toEqual(['access_saga_claim:ok', 'access_saga_save:ok', 'access_saga_release:ok']);
  });

  it('a list the function refuses stops the tick before any saga is touched', async () => {
    const f = fakeClient({ dueError: { code: '42501', message: 'permission denied' } });
    await expect(runAccessSagaTick({ client: f.client, services: quiet })).rejects.toThrow(/could not list/);
    expect(f.calls).toHaveLength(1);
  });

  it('runs at most the cap, asks for one more to know whether work is left, and says so', async () => {
    const f = fakeClient({ due: ['a', 'b', 'c'], rows: { a: sagaRow('a'), b: sagaRow('b'), c: sagaRow('c') } });
    const summary = await runAccessSagaTick({ client: f.client, services: quiet, now: () => T0, maxSagas: 2, runner: { newId: () => 'evt' } });
    expect(summary).toEqual({ due: 3, ticked: 2, failed: [], deferred: true });
    expect(f.calls[0]).toEqual({ name: 'access_saga_due', args: { p_limit: 3 } });
    expect(names(f.calls).some((c) => c.endsWith(':c'))).toBe(false);

    const exact = fakeClient({ due: ['a', 'b'], rows: { a: sagaRow('a'), b: sagaRow('b') } });
    await expect(runAccessSagaTick({ client: exact.client, services: quiet, now: () => T0, maxSagas: 2, runner: { newId: () => 'evt' } }))
      .resolves.toMatchObject({ due: 2, ticked: 2, deferred: false });
  });

  it('stops starting ticks once the budget is spent and reports the rest deferred', async () => {
    let t = T0;
    const f = fakeClient({ due: ['a', 'b', 'c'], rows: { a: sagaRow('a'), b: sagaRow('b'), c: sagaRow('c') } });
    const summary = await runAccessSagaTick({
      client: f.client, services: quiet, budgetMs: 1_000, runner: { newId: () => 'evt' },
      // Each read of the clock is a second later: the list, the check before a, the check before b (over).
      now: () => { t += 600; return t; },
    });
    expect(summary.ticked).toBe(1);
    expect(summary.deferred).toBe(true);
    expect(names(f.calls).some((c) => c.endsWith(':b'))).toBe(false);
  });

  it('refuses to run without a service client, before asking the database anything', async () => {
    await expect(runAccessSagaTick({ client: undefined as unknown as SupabaseClient, services: quiet })).rejects.toThrow();
  });

  it('uses the store it is handed, for a rehearsal that wants to watch it', async () => {
    const f = fakeClient({ due: ['a'], rows: { a: sagaRow('a') } });
    const seen: string[] = [];
    class Watching extends PostgresAccessSagaStore {
      override async claim(id: string, leaseMs: number) { seen.push(id); return super.claim(id, leaseMs); }
    }
    await runAccessSagaTick({ client: f.client, services: quiet, now: () => T0, store: new Watching({ client: f.client }), runner: { newId: () => 'evt' } });
    expect(seen).toEqual(['a']);
  });
});

describe('runScheduledAccessSagaTick, the entry the Edge Function calls', () => {
  it('with no participants registered, counts what is due and touches no saga', async () => {
    const f = fakeClient({ due: ['s1', 's2'], rows: { s1: sagaRow('s1'), s2: sagaRow('s2') } });
    await expect(runScheduledAccessSagaTick(f.client, null, { now: () => T0 })).resolves.toEqual({
      outcome: 'unregistered', due: 2, ticked: 0, failed: [], deferred: false,
    });
    // One read of the due list, at the cap plus one, and no claim: the lease stays free for whoever is real.
    expect(names(f.calls)).toEqual([`access_saga_due:${DEFAULT_MAX_SAGAS + 1}`]);
  });

  it('with participants, is the tick, and says so', async () => {
    const f = fakeClient({ due: ['s1'], rows: { s1: sagaRow('s1') } });
    await expect(runScheduledAccessSagaTick(f.client, quiet, { now: () => T0, runner: { newId: () => 'evt' } })).resolves.toEqual({
      outcome: 'ran', due: 1, ticked: 1, failed: [], deferred: false,
    });
    expect(names(f.calls)).toContain('access_saga_claim:s1');
  });

  it('a refused due list is a storage failure in either mode', async () => {
    const f = fakeClient({ dueError: { code: '42501', message: 'scripted' } });
    await expect(runScheduledAccessSagaTick(f.client, null)).rejects.toThrow(/could not list/);
    await expect(runScheduledAccessSagaTick(f.client, quiet)).rejects.toThrow(/could not list/);
  });

  it('refuses to run without a service client, before asking anything', async () => {
    await expect(runScheduledAccessSagaTick(undefined as unknown as SupabaseClient, null)).rejects.toThrow(/service client/);
  });

  it('the registry holds no participants yet, so the scheduled job moves nothing', () => {
    // When this fails, participants were registered: the delta document's C-6 row and the
    // runbook's "unregistered" reading both change with it.
    expect(SERVICES).toBeNull();
  });
});
