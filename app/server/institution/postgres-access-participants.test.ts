import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Fault, type AccessSaga } from '../../../packages/institution/src/index.ts';
import { PostgresAccessParticipants } from './postgres-access-participants.ts';

const T0 = 1_780_000_000_000;

const saga: AccessSaga = {
  id: 'saga-1', tenantId: 't1', subjectId: 'u1', intent: { resourceId: 'r1', action: 'registration.readiness.view' },
  requestDigest: 'a'.repeat(64), definitionVersion: '1', state: 'PREPARING', revision: 3, generation: 2, attempts: 0,
  deadlineAt: T0 + 3_600_000, nextAttemptAt: T0, decisionId: 'dec-1', staleGrantPossible: false, compensation: { paRevoked: false, pepRemoved: false },
};

type Call = { name: string; args: Record<string, unknown>; signal?: AbortSignal };

/** A service client whose every `rpc` answers from a script, recording what it was asked and which signal it was given. */
function fakeClient(answer: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown }, withAbort = true) {
  const calls: Call[] = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      const call: Call = { name, args };
      calls.push(call);
      const result = Promise.resolve(answer(name, args));
      if (!withAbort) return result;
      return Object.assign(result, { abortSignal: (signal: AbortSignal) => { call.signal = signal; return result; } });
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const participants = (answer: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown }, withAbort?: boolean) => {
  const f = fakeClient(answer, withAbort);
  return { ...f, p: new PostgresAccessParticipants({ client: f.client, grantTtlMs: 1_800_000 }) };
};

const signal = new AbortController().signal;
const refused = (code: string) => ({ data: null, error: { code, message: `refused ${code}` } });
const outage = { data: null, error: { message: 'connection reset' } };

async function faultOf(promise: Promise<unknown>): Promise<Fault> {
  try {
    await promise;
  } catch (e) {
    if (e instanceof Fault) return e;
    throw new Error(`not a Fault: ${String(e)}`);
  }
  throw new Error('did not throw');
}

describe('PostgresAccessParticipants', () => {
  it('needs a service client or the means to make one', () => {
    expect(() => new PostgresAccessParticipants({})).toThrow(/service client/);
    expect(() => new PostgresAccessParticipants({ client: fakeClient(() => ({ data: null, error: null })).client, grantTtlMs: 0 })).toThrow(/between 1 ms and a day/);
  });

  it('prepare hands the administrator the key, the saga and the ttl, and reads the grant back', async () => {
    const { p, calls } = participants(() => ({ data: { id: 'grant:saga-1:2', expiresAt: T0 + 1_800_000 }, error: null }));
    await expect(p.prepare(saga, 'k-prepare', signal)).resolves.toEqual({ id: 'grant:saga-1:2', expiresAt: T0 + 1_800_000 });
    expect(calls).toEqual([{ name: 'access_pa_prepare', args: { p_key: 'k-prepare', p_saga_id: 'saga-1', p_ttl_ms: 1_800_000 }, signal }]);
  });

  it('install names the grant the saga holds, and refuses to install without one', async () => {
    const { p, calls } = participants(() => ({ data: null, error: null }));
    await p.install({ ...saga, state: 'INSTALLING', grantId: 'grant:saga-1:2' }, 'k-install', signal);
    expect(calls[0]).toMatchObject({ name: 'access_pep_install', args: { p_key: 'k-install', p_saga_id: 'saga-1', p_grant_id: 'grant:saga-1:2' } });
    const f = await faultOf(p.install(saga, 'k-install', signal));
    expect(f).toMatchObject({ code: 'GRANT_UNKNOWN', retryable: false, outcomeUnknown: false });
    expect(calls).toHaveLength(1);
  });

  it('inspect passes the grant id, or null when the saga has none, and accepts only the three answers', async () => {
    const { p, calls } = participants(() => ({ data: 'installed', error: null }));
    await expect(p.inspect({ ...saga, grantId: 'g' }, signal)).resolves.toEqual({ status: 'installed' });
    await expect(p.inspect(saga, signal)).resolves.toEqual({ status: 'installed' });
    expect(calls.map((c) => c.args)).toEqual([{ p_saga_id: 'saga-1', p_grant_id: 'g' }, { p_saga_id: 'saga-1', p_grant_id: null }]);
    const odd = participants(() => ({ data: 'unknown', error: null }));
    const f = await faultOf(odd.p.inspect(saga, signal));
    expect(f).toMatchObject({ code: 'PEP_UNAVAILABLE', retryable: true, outcomeUnknown: false });
  });

  it('revokePa revokes by saga and generation, removePep by saga, and both read anything but confirmed as unknown', async () => {
    const { p, calls } = participants(() => ({ data: 'confirmed', error: null }));
    await expect(p.revokePa({ ...saga, state: 'REVOKING' }, 'k-revoke', signal)).resolves.toBe('confirmed');
    await expect(p.removePep({ ...saga, state: 'REVOKING' }, 'k-remove', signal)).resolves.toBe('confirmed');
    expect(calls.map((c) => [c.name, c.args])).toEqual([
      ['access_pa_revoke', { p_key: 'k-revoke', p_saga_id: 'saga-1', p_generation: 2 }],
      ['access_pep_remove', { p_key: 'k-remove', p_saga_id: 'saga-1' }],
    ]);
    const odd = participants(() => ({ data: null, error: null }));
    await expect(odd.p.revokePa(saga, 'k', signal)).resolves.toBe('unknown');
    await expect(odd.p.removePep(saga, 'k', signal)).resolves.toBe('unknown');
  });

  it('verifyCleanup reads both sides, and an answer it cannot read confirms neither', async () => {
    const { p } = participants(() => ({ data: { paRevoked: true, pepAbsent: false }, error: null }));
    await expect(p.verifyCleanup(saga, signal)).resolves.toEqual({ paRevoked: true, pepAbsent: false });
    const odd = participants(() => ({ data: { paRevoked: 'yes' }, error: null }));
    const f = await faultOf(odd.p.verifyCleanup(saga, signal));
    expect(f).toMatchObject({ code: 'PA_UNAVAILABLE', retryable: true, outcomeUnknown: false });
  });

  it('a refusal the function made on purpose is a non-retryable fault of that name', async () => {
    for (const [code, name] of [['SC404', 'GRANT_UNKNOWN'], ['SC409', 'GRANT_SUPERSEDED'], ['SC410', 'GRANT_EXPIRED'], ['SC422', 'STALE_DECISION'], ['SC423', 'GRANT_REVOKED']]) {
      const { p } = participants(() => refused(code!));
      const f = await faultOf(p.install({ ...saga, grantId: 'g' }, 'k', signal));
      expect(f, code).toMatchObject({ code: name, retryable: false, outcomeUnknown: false });
    }
    const { p } = participants(() => refused('SC422'));
    const f = await faultOf(p.prepare(saga, 'k', signal));
    expect(f.code, 'STALE_DECISION is what the runner reads as a stale decision in PREPARING').toBe('STALE_DECISION');
  });

  it('anything else is the participant unavailable: retryable, and for a write of unknown outcome', async () => {
    const { p } = participants(() => outage);
    for (const [name, write, run] of [
      ['PA', true, () => p.prepare(saga, 'k', signal)],
      ['PEP', true, () => p.install({ ...saga, grantId: 'g' }, 'k', signal)],
      ['PEP', false, () => p.inspect(saga, signal)],
      ['PA', true, () => p.revokePa(saga, 'k', signal)],
      ['PEP', true, () => p.removePep(saga, 'k', signal)],
      ['PA', false, () => p.verifyCleanup(saga, signal)],
    ] as const) {
      const f = await faultOf(run());
      expect(f, `${name} ${write}`).toMatchObject({ code: `${name}_UNAVAILABLE`, retryable: true, outcomeUnknown: write });
      expect(f.message).toBe('connection reset');
    }
  });

  it('a prepared grant whose answer cannot be read is unavailable, not a grant, and the key will find it again', async () => {
    const { p } = participants(() => ({ data: { id: 'g' }, error: null }));
    const f = await faultOf(p.prepare(saga, 'k', signal));
    expect(f).toMatchObject({ code: 'PA_UNAVAILABLE', retryable: true, outcomeUnknown: true });
  });

  it('works over a client whose rpc has no abortSignal (the rehearsal harness)', async () => {
    const { p } = participants(() => ({ data: 'absent', error: null }), false);
    await expect(p.inspect(saga, signal)).resolves.toEqual({ status: 'absent' });
  });
});
