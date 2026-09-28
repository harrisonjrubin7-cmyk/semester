import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseIntelligenceRepository } from './intelligence-repository.ts';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';

/**
 * The repository's reading of `kill.ai_generation`, against a client that
 * answers what it is told to. The rules are the worker's (`worker.ts`
 * `killed()`): the global row stops every school, a school's row stops only
 * that school, and a read that fails is a switch that is thrown.
 */

const identity: UniversityIdentity = { userId: 'student-1', institutionId: 'northstar', roles: ['student'] };

function clientAnswering(answer: { data: unknown; error: unknown } | Error) {
  const asked: unknown[] = [];
  const client = {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: unknown) => {
          asked.push({ table, columns, column, value });
          return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, asked };
}

const repository = (answer: { data: unknown; error: unknown } | Error) => {
  const { client, asked } = clientAnswering(answer);
  return { repo: createSupabaseIntelligenceRepository({ client, configuredModels: ['openai:gpt-5-mini'], maxRequestCents: 2 }), asked };
};

describe('the institution repository reads the AI kill switch', () => {
  it('asks for the one switch', async () => {
    const { repo, asked } = repository({ data: [], error: null });
    expect(await repo.killSwitchEngaged(identity)).toBe(false);
    expect(asked).toEqual([{ table: 'feature_kill_switch', columns: 'tenant_id, engaged', column: 'switch_key', value: 'kill.ai_generation' }]);
  });

  it('is engaged by the global row, and by the school’s own row, and not by another school’s', async () => {
    expect(await repository({ data: [{ tenant_id: null, engaged: true }], error: null }).repo.killSwitchEngaged(identity)).toBe(true);
    expect(await repository({ data: [{ tenant_id: 'northstar', engaged: true }], error: null }).repo.killSwitchEngaged(identity)).toBe(true);
    expect(await repository({ data: [{ tenant_id: 'eastfield', engaged: true }], error: null }).repo.killSwitchEngaged(identity)).toBe(false);
    expect(await repository({ data: [{ tenant_id: null, engaged: false }], error: null }).repo.killSwitchEngaged(identity)).toBe(false);
  });

  it('treats a switch it cannot read as thrown', async () => {
    expect(await repository({ data: null, error: { message: 'permission denied' } }).repo.killSwitchEngaged(identity)).toBe(true);
    expect(await repository(new Error('network')).repo.killSwitchEngaged(identity)).toBe(true);
  });
});
