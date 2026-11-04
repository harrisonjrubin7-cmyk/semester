import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadAiCapabilityPolicies, saveAiCapabilityPolicy } from './ai-capability-policy';

function reader(rows: unknown[], error: unknown = null) {
  const eq = async () => ({ data: rows, error });
  return { from: () => ({ select: () => ({ eq }) }) } as unknown as SupabaseClient;
}

describe('institution AI capability policy client', () => {
  it('defaults every missing capability off', async () => {
    const rows = await loadAiCapabilityPolicies('school-1', reader([]));
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => !row.enabled && !row.permittedRoles.length && !row.allowedModes.length)).toBe(true);
  });

  it('reads one feature without enabling the others', async () => {
    const rows = await loadAiCapabilityPolicies('school-1', reader([{
      feature_key: 'tutoring', enabled: true, permitted_roles: ['student'], allowed_modes: ['hint'], reason: 'Pilot',
    }]));
    expect(rows.find((row) => row.feature === 'tutoring')).toMatchObject({ enabled: true, permittedRoles: ['student'], allowedModes: ['hint'] });
    expect(rows.find((row) => row.feature === 'writing')?.enabled).toBe(false);
  });

  it('will not save an enabled feature with no role or mode', async () => {
    await expect(saveAiCapabilityPolicy('school-1', {
      feature: 'assistant', enabled: true, permittedRoles: [], allowedModes: [], reason: '',
    }, reader([]))).rejects.toThrow('at least one role');
  });

  it('requires a rationale for an enabled feature', async () => {
    await expect(saveAiCapabilityPolicy('school-1', {
      feature: 'assistant', enabled: true, permittedRoles: ['student'], allowedModes: ['explain'], reason: '',
    }, reader([]))).rejects.toThrow('short reason');
  });
});
