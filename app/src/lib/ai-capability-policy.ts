import type { SupabaseClient } from '@supabase/supabase-js';
import {
  INTELLIGENCE_CAPABILITIES,
  type IntelligenceCapability,
  type IntelligenceMode,
} from '@semester/institution';
import { cloud } from './cloud';

export const AI_POLICY_ROLES = ['student', 'faculty', 'teaching_assistant', 'advisor', 'university_staff'] as const;
export const AI_POLICY_MODES: readonly IntelligenceMode[] = ['explain', 'hint', 'practice', 'review', 'draft'];

export interface AiCapabilityPolicyRow {
  feature: IntelligenceCapability;
  enabled: boolean;
  permittedRoles: string[];
  allowedModes: IntelligenceMode[];
  reason: string;
}

const safeDefault = (feature: IntelligenceCapability): AiCapabilityPolicyRow => ({
  feature,
  enabled: false,
  permittedRoles: [],
  allowedModes: [],
  reason: '',
});

const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string') : [];

/** Missing rows are deliberately returned as disabled, never inherited on. */
export async function loadAiCapabilityPolicies(
  tenantId: string,
  db?: SupabaseClient,
): Promise<AiCapabilityPolicyRow[]> {
  const client = db ?? await cloud();
  const { data, error } = await client.from('ai_capability_policy')
    .select('feature_key, enabled, permitted_roles, allowed_modes, reason')
    .eq('tenant_id', tenantId);
  if (error || !Array.isArray(data)) throw new Error('The institution AI capability policy could not be read.');
  const found = new Map(data.map((raw) => [raw.feature_key, raw]));
  return INTELLIGENCE_CAPABILITIES.map((feature) => {
    const raw = found.get(feature) as Record<string, unknown> | undefined;
    if (!raw) return safeDefault(feature);
    return {
      feature,
      enabled: raw.enabled === true,
      permittedRoles: strings(raw.permitted_roles),
      allowedModes: strings(raw.allowed_modes).filter((mode): mode is IntelligenceMode =>
        AI_POLICY_MODES.includes(mode as IntelligenceMode)),
      reason: typeof raw.reason === 'string' ? raw.reason : '',
    };
  });
}

export async function saveAiCapabilityPolicy(
  tenantId: string,
  policy: AiCapabilityPolicyRow,
  db?: SupabaseClient,
): Promise<void> {
  if (policy.enabled && (!policy.permittedRoles.length || !policy.allowedModes.length)) {
    throw new Error('Choose at least one role and one support mode before enabling this capability.');
  }
  if (policy.enabled && policy.reason.trim().length < 3) {
    throw new Error('Give a short reason before enabling this capability.');
  }
  const client = db ?? await cloud();
  const { error } = await client.from('ai_capability_policy').upsert({
    tenant_id: tenantId,
    feature_key: policy.feature,
    enabled: policy.enabled,
    permitted_roles: [...new Set(policy.permittedRoles)],
    allowed_modes: [...new Set(policy.allowedModes)],
    reason: policy.reason.trim(),
  }, { onConflict: 'tenant_id,feature_key' });
  if (error) throw new Error(error.message || 'The institution AI capability policy could not be saved.');
}
