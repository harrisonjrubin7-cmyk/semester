import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  startRegistrationReadinessEvaluation,
  transitionRegistrationReadinessEvaluation,
  type ReadinessWorkflowResult,
} from '../../../packages/institution/src/readiness-workflow.ts';
import { PostgresRegistrationReadinessRepository } from './readiness-repository.ts';

const started = startRegistrationReadinessEvaluation({
  id: 'evaluation-1',
  tenantId: 'school-a',
  subjectId: 'student-1',
  termId: 'fall-2026',
  requestedBy: 'student-1',
  correlationId: 'request-0123456789',
  idempotencyKey: 'readiness-request-1',
  at: '2026-10-09T15:00:00.000Z',
});

function fakeClient() {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  let saved: ReadinessWorkflowResult = started;
  let error: unknown = null;
  const client = {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      calls.push({ name, args });
      if (error) return { data: null, error };
      if (name === 'registration_readiness_save') {
        saved = { ...(args.want_result as ReadinessWorkflowResult), replayed: false };
        return { data: saved, error: null };
      }
      if (name === 'registration_readiness_get') {
        return {
          data: args.want_tenant === saved.record.tenantId && args.want_evaluation === saved.record.id
            ? saved.record
            : null,
          error: null,
        };
      }
      return { data: null, error: new Error(`unexpected ${name}`) };
    },
  } as unknown as SupabaseClient;
  return { client, calls, fail: (next: unknown) => { error = next; } };
}

describe('Postgres registration-readiness repository', () => {
  it('saves the aggregate, receipt, audit and outbox request through one tenant-bound RPC', async () => {
    const fake = fakeClient();
    const repository = new PostgresRegistrationReadinessRepository({ client: fake.client });

    await expect(repository.save(started)).resolves.toMatchObject({
      receipt: { id: 'readiness-request-1', recordVersion: 1 },
      replayed: false,
    });
    expect(fake.calls[0]).toEqual({
      name: 'registration_readiness_save',
      args: {
        want_tenant: 'school-a',
        want_expected_version: 0,
        want_fingerprint: '["requested"]',
        want_result: started,
      },
    });
  });

  it('uses the receipt version for compare-and-swap and preserves an exact replay', async () => {
    const fake = fakeClient();
    const repository = new PostgresRegistrationReadinessRepository({ client: fake.client });
    await repository.save(started);
    const evaluating = transitionRegistrationReadinessEvaluation(started.record, {
      expectedVersion: 1,
      targetState: 'evaluating',
      correlationId: 'request-0123456790',
      idempotencyKey: 'readiness-evaluate-1',
      at: '2026-10-09T15:01:00.000Z',
    });
    await repository.save(evaluating);

    expect(fake.calls.at(-1)).toMatchObject({
      name: 'registration_readiness_save',
      args: {
        want_tenant: 'school-a',
        want_expected_version: 1,
        want_fingerprint: '["evaluating",null]',
      },
    });
  });

  it('loads only through an explicit tenant and returns null across the tenant boundary', async () => {
    const fake = fakeClient();
    const repository = new PostgresRegistrationReadinessRepository({ client: fake.client });
    await repository.save(started);

    await expect(repository.get('school-a', 'evaluation-1')).resolves.toMatchObject({ tenantId: 'school-a' });
    await expect(repository.get('school-b', 'evaluation-1')).resolves.toBeNull();
    expect(fake.calls.at(-1)).toEqual({
      name: 'registration_readiness_get',
      args: { want_tenant: 'school-b', want_evaluation: 'evaluation-1' },
    });
  });

  it('fails closed without leaking database details and requires a server client', async () => {
    expect(() => new PostgresRegistrationReadinessRepository({})).toThrow(/server-only Supabase service client/i);
    const fake = fakeClient();
    const repository = new PostgresRegistrationReadinessRepository({ client: fake.client });
    fake.fail(new Error('relation private.registration_readiness_evaluations does not exist'));
    await expect(repository.get('school-a', 'evaluation-1')).rejects.toThrow('Registration readiness could not load an evaluation.');
  });
});
