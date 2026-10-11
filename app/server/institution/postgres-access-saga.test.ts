import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PersistenceConflict, type AccessEvent, type AccessSaga } from '../../../packages/institution/src/index.ts';
import { PostgresAccessSagaStore, nextForSave, sagaFromRow } from './postgres-access-saga.ts';

const T0 = 1_780_000_000_000;

const row = {
  id: 'saga-1', tenant_id: 't1', subject_id: 'u1', intent_resource_id: 'r1', intent_action: 'registration.readiness.view',
  request_digest: 'a'.repeat(64), definition_version: '1', state: 'VALIDATING', revision: 3, generation: 1, attempts: 2,
  deadline_at: T0 + 3_600_000, next_attempt_at: T0, decision_id: null, grant_id: null, grant_expires_at: null,
  stale_grant_possible: false, pa_revoked: false, pep_removed: false, last_error: 'pa_timeout', recovery_code: null,
  created_at: '2026-10-06T12:00:00.000Z', updated_at: '2026-10-06T12:00:00.000Z',
};

const saga: AccessSaga = {
  id: 'saga-1', tenantId: 't1', subjectId: 'u1', intent: { resourceId: 'r1', action: 'registration.readiness.view' },
  requestDigest: 'a'.repeat(64), definitionVersion: '1', state: 'VALIDATING', revision: 3, generation: 1, attempts: 2,
  deadlineAt: T0 + 3_600_000, nextAttemptAt: T0, staleGrantPossible: false, compensation: { paRevoked: false, pepRemoved: false },
  lastError: 'pa_timeout',
};

const event: AccessEvent = { eventId: 'evt-4', type: 'access.state.changed', sagaId: 'saga-1', tenantId: 't1', revision: 4, occurredAt: '2026-10-06T12:00:01.000Z', reasonCode: 'pa_timeout' };

type Call = { name: string; args: Record<string, unknown> };

/** A service client whose every `rpc` answers from a script, recording what it was asked. */
function fakeClient(answer: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown }) {
  const calls: Call[] = [];
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  let insertError: unknown = null;
  const client = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      return answer(name, args);
    },
    from: (table: string) => ({
      insert: async (r: Record<string, unknown>) => {
        inserts.push({ table, row: r });
        return { data: null, error: insertError };
      },
    }),
  } as unknown as SupabaseClient; // the store touches only rpc and from().insert
  return { client, calls, inserts, failInsert: (e: unknown) => { insertError = e; } };
}

const ok = { data: null, error: null };
const conflict = { data: null, error: { code: 'SC409', message: 'The saga moved: expected revision 3, found 4.' } };
const missing = { data: null, error: { code: 'SC404', message: 'No such access saga.' } };
const outage = { data: null, error: { message: 'connection reset' } };

describe('sagaFromRow', () => {
  it('reads a claimed row into the runner record, dropping the lease and the audit columns', () => {
    expect(sagaFromRow(row)).toEqual(saga);
  });

  it('keeps the optional grant and decision when the row has them', () => {
    const active = sagaFromRow({ ...row, state: 'ACTIVE', decision_id: 'd1', grant_id: 'g1', grant_expires_at: T0 + 60_000, last_error: null });
    expect(active).toMatchObject({ state: 'ACTIVE', decisionId: 'd1', grantId: 'g1', grantExpiresAt: T0 + 60_000 });
    expect('lastError' in active).toBe(false);
  });

  it('fails closed on a row the runner could misread, and passes its control', () => {
    const bad: Array<[string, Record<string, unknown>]> = [
      ['a state outside the fifteen', { ...row, state: 'DONE' }],
      ['an action nobody decides', { ...row, intent_action: 'registration.root' }],
      ['a revision that is not an integer', { ...row, revision: '3' }],
      ['a deadline past the safe range', { ...row, deadline_at: 2 ** 53 }],
      ['a missing cleanup flag', { ...row, pa_revoked: undefined }],
      ['an empty tenant', { ...row, tenant_id: '' }],
      ['a grant expiry of the wrong type', { ...row, grant_expires_at: 'soon' }],
    ];
    for (const [why, r] of bad) expect(() => sagaFromRow(r), why).toThrow();
    expect(() => sagaFromRow(row), 'the control row').not.toThrow();
    expect(() => sagaFromRow(null)).toThrow();
    expect(() => sagaFromRow([row])).toThrow();
  });
});

describe('nextForSave', () => {
  it('sends the save function exactly the fields it reads, with nulls where the record has none', () => {
    expect(nextForSave(saga)).toEqual({
      state: 'VALIDATING', generation: 1, attempts: 2, deadlineAt: T0 + 3_600_000, nextAttemptAt: T0,
      decisionId: null, grantId: null, grantExpiresAt: null, staleGrantPossible: false,
      compensation: { paRevoked: false, pepRemoved: false }, lastError: 'pa_timeout',
    });
    expect(Object.keys(nextForSave(saga))).not.toContain('revision');
  });
});

describe('PostgresAccessSagaStore', () => {
  it('refuses to exist without a service client', () => {
    expect(() => new PostgresAccessSagaStore({})).toThrow(/service client/);
    expect(() => new PostgresAccessSagaStore({ url: 'https://x.supabase.co' })).toThrow(/service client/);
  });

  describe('claim', () => {
    it('returns the lease and the saga the function handed back', async () => {
      const f = fakeClient(() => ({ data: [{ lease_token: 'tok-1', saga: row }], error: null }));
      const store = new PostgresAccessSagaStore({ client: f.client });
      await expect(store.claim('saga-1', 30_000)).resolves.toEqual({ token: 'tok-1', saga });
      expect(f.calls).toEqual([{ name: 'access_saga_claim', args: { p_id: 'saga-1', p_lease_ms: 30_000 } }]);
    });

    it('returns null when the function returns no row: finished, or held by another worker', async () => {
      const f = fakeClient(() => ({ data: [], error: null }));
      await expect(new PostgresAccessSagaStore({ client: f.client }).claim('saga-1', 30_000)).resolves.toBeNull();
    });

    it('treats a malformed row, a missing token or the wrong saga as a storage failure, not a lease', async () => {
      const cases: Array<[string, unknown]> = [
        ['no token', [{ lease_token: '', saga: row }]],
        ['a row the runner could misread', [{ lease_token: 'tok', saga: { ...row, state: 'DONE' } }]],
        ['another saga', [{ lease_token: 'tok', saga: { ...row, id: 'saga-2' } }]],
        ['not a list', { lease_token: 'tok', saga: row }],
      ];
      for (const [why, data] of cases) {
        const f = fakeClient(() => ({ data, error: null }));
        const attempt = new PostgresAccessSagaStore({ client: f.client }).claim('saga-1', 30_000);
        await expect(attempt, why).rejects.toThrow(/could not/);
        await expect(attempt, why).rejects.not.toBeInstanceOf(PersistenceConflict);
      }
    });
  });

  describe('save', () => {
    it('passes the lease, the expected revision, the next record and the event to one function', async () => {
      const f = fakeClient(() => ok);
      const store = new PostgresAccessSagaStore({ client: f.client });
      const next = { ...saga, state: 'EVALUATING' as const, revision: 4, attempts: 0, lastError: undefined };
      await store.save({ token: 'tok-1', saga }, 3, next, event);
      expect(f.calls).toEqual([{
        name: 'access_saga_save',
        args: {
          p_id: 'saga-1', p_lease_token: 'tok-1', p_expected_revision: 3,
          p_next: nextForSave(next),
          p_event: { eventId: 'evt-4', type: 'access.state.changed', occurredAt: '2026-10-06T12:00:01.000Z', reasonCode: 'pa_timeout' },
        },
      }]);
    });

    it('turns SC409 into PersistenceConflict so the runner stands down, and nothing else', async () => {
      const moved = new PostgresAccessSagaStore({ client: fakeClient(() => conflict).client });
      await expect(moved.save({ token: 'tok-1', saga }, 3, saga, event)).rejects.toBeInstanceOf(PersistenceConflict);

      for (const [why, answer] of [['a saga that does not exist', missing], ['an outage', outage]] as const) {
        const store = new PostgresAccessSagaStore({ client: fakeClient(() => answer).client });
        const attempt = store.save({ token: 'tok-1', saga }, 3, saga, event);
        await expect(attempt, why).rejects.toThrow(/could not save a move/);
        await expect(attempt, why).rejects.not.toBeInstanceOf(PersistenceConflict);
      }
    });
  });

  it('flags recovery under the lease, and a lost lease is a conflict', async () => {
    const f = fakeClient(() => ok);
    await new PostgresAccessSagaStore({ client: f.client }).flagRecovery({ token: 'tok-1', saga }, 'RECOVERY_THRESHOLD_EXCEEDED');
    expect(f.calls).toEqual([{ name: 'access_saga_flag_recovery', args: { p_id: 'saga-1', p_lease_token: 'tok-1', p_code: 'RECOVERY_THRESHOLD_EXCEEDED' } }]);

    const lost = new PostgresAccessSagaStore({ client: fakeClient(() => conflict).client });
    await expect(lost.flagRecovery({ token: 'tok-1', saga }, 'ENFORCEMENT_UNKNOWN')).rejects.toBeInstanceOf(PersistenceConflict);
  });

  it('releases by saga and token', async () => {
    const f = fakeClient(() => ok);
    await new PostgresAccessSagaStore({ client: f.client }).release({ token: 'tok-1', saga });
    expect(f.calls).toEqual([{ name: 'access_saga_release', args: { p_id: 'saga-1', p_lease_token: 'tok-1' } }]);
  });

  it('delivers a wake as a signal, and a missing saga is a storage error', async () => {
    const f = fakeClient(() => ok);
    await new PostgresAccessSagaStore({ client: f.client }).wake('saga-1', 'sig-9', 'revoke');
    expect(f.calls).toEqual([{ name: 'access_saga_wake', args: { p_id: 'saga-1', p_event_id: 'sig-9', p_kind: 'revoke' } }]);

    const gone = new PostgresAccessSagaStore({ client: fakeClient(() => missing).client });
    await expect(gone.wake('saga-x', 'sig-9', 'revoke')).rejects.toThrow(/could not deliver a signal/);
  });

  describe('create', () => {
    it('inserts the row the table checks, at revision 0', async () => {
      const f = fakeClient(() => ok);
      const fresh: AccessSaga = { ...saga, state: 'RECEIVED', revision: 0, generation: 0, attempts: 0, lastError: undefined };
      await new PostgresAccessSagaStore({ client: f.client }).create(fresh);
      expect(f.inserts).toEqual([{
        table: 'access_sagas',
        row: {
          id: 'saga-1', tenant_id: 't1', subject_id: 'u1', intent_resource_id: 'r1', intent_action: 'registration.readiness.view',
          request_digest: 'a'.repeat(64), definition_version: '1', state: 'RECEIVED', revision: 0, generation: 0, attempts: 0,
          deadline_at: T0 + 3_600_000, next_attempt_at: T0, stale_grant_possible: false, pa_revoked: false, pep_removed: false,
        },
      }]);
      expect(f.calls).toEqual([]);
    });

    it('refuses a record that is not at revision 0, and surfaces the table refusing a row', async () => {
      const f = fakeClient(() => ok);
      const store = new PostgresAccessSagaStore({ client: f.client });
      await expect(store.create(saga)).rejects.toThrow(/revision 0/);
      expect(f.inserts).toEqual([]);

      f.failInsert({ code: '23514', message: 'violates check constraint' });
      await expect(store.create({ ...saga, revision: 0 })).rejects.toThrow(/could not create a saga/);
    });
  });
});
