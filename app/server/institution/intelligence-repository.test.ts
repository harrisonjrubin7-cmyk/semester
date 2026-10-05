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

/**
 * The school's release cohort for Semester Intelligence. The repository used
 * to read `state` and `permitted_roles` and never `permitted_cohorts`, so a
 * pilot limited to a cohort was open to every student with the role.
 */
describe('the institution repository reads the release cohort', () => {
  type Answer = { data: unknown; error: unknown };
  function policyClient(feature: Answer, members: Answer) {
    const asked: { table: string; filters: unknown[] }[] = [];
    const chain = (table: string, answer: Answer) => {
      const call = { table, filters: [] as unknown[] };
      asked.push(call);
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'in']) q[m] = (...a: unknown[]) => { call.filters.push([m, ...a]); return q; };
      q.maybeSingle = async () => answer;
      q.then = (ok: (v: unknown) => unknown) => Promise.resolve(answer).then(ok);
      return q;
    };
    const client = {
      from: (table: string) => chain(table, table === 'tenant_feature_policy' ? feature
        : table === 'ai_policy' ? { data: { allowed_modes: ['explain'], allowed_providers: ['openai'], monthly_budget_cents: 100, retention_days: 30 }, error: null }
        : members),
      rpc: async () => ({ data: 0, error: null }),
    } as unknown as SupabaseClient;
    return { repo: createSupabaseIntelligenceRepository({ client, configuredModels: ['openai:gpt-5-mini'], maxRequestCents: 2 }), asked };
  }
  const feature = (cohorts: string[]) => ({ data: { state: 'production', permitted_roles: ['student'], permitted_cohorts: cohorts }, error: null });

  it('reads no membership and leaves the policy on when no cohort is named — the control', async () => {
    const { repo, asked } = policyClient(feature([]), { data: [], error: null });
    expect((await repo.loadPolicy(identity)).state).toBe('production');
    expect(asked.map((a) => a.table)).not.toContain('feature_cohort_members');
  });

  it('is off for a student outside the named cohort, and on for a live member', async () => {
    const outside = policyClient(feature(['ai-pilot']), { data: [], error: null });
    expect((await outside.repo.loadPolicy(identity)).state).toBe('off');
    expect(outside.asked.find((a) => a.table === 'feature_cohort_members')?.filters).toEqual([
      ['select', 'cohort'], ['eq', 'tenant_id', 'northstar'], ['eq', 'user_id', 'student-1'], ['is', 'removed_at', null], ['in', 'cohort', ['ai-pilot']],
    ]);
    const member = policyClient(feature(['ai-pilot']), { data: [{ cohort: 'ai-pilot' }], error: null });
    expect((await member.repo.loadPolicy(identity)).state).toBe('production');
  });

  it('throws rather than admitting when the membership cannot be read', async () => {
    const { repo } = policyClient(feature(['ai-pilot']), { data: null, error: { message: 'network' } });
    await expect(repo.loadPolicy(identity)).rejects.toThrow('release cohort');
  });
});
