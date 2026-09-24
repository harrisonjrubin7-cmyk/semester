import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  IntelligenceFeatureState,
  IntelligenceMode,
  TenantIntelligencePolicy,
  UniversityIdentity,
} from '../../../packages/institution/src/index.ts';
import type {
  ApprovedIntelligenceSource,
  IntelligenceBudgetReservation,
} from './intelligence.ts';

const STATES = new Set<IntelligenceFeatureState>(['off', 'preview', 'sandbox', 'production']);
const MODES = new Set<IntelligenceMode>(['explain', 'hint', 'practice', 'review', 'draft']);

export interface IntelligenceRepositoryOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
  configuredModels: readonly string[];
  maxRequestCents: number;
}

export interface IntelligenceRepository {
  loadPolicy(identity: UniversityIdentity): Promise<TenantIntelligencePolicy>;
  loadApprovedSources(identity: UniversityIdentity, sourceIds: string[]): Promise<ApprovedIntelligenceSource[]>;
  reserveBudget(identity: UniversityIdentity, maximumCents: number): Promise<IntelligenceBudgetReservation | null>;
  settleBudget(
    identity: UniversityIdentity,
    reservation: IntelligenceBudgetReservation,
    usage: { costCents: number; inputTokens: number; outputTokens: number } | null,
  ): Promise<boolean>;
}

export function createSupabaseIntelligenceRepository(options: IntelligenceRepositoryOptions): IntelligenceRepository {
  if (!options.client && (!options.url || !options.serviceKey)) {
    throw new Error('A server-only Supabase service client is required for institutional intelligence.');
  }
  const client = options.client ?? createClient(options.url!, options.serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const maximumRequest = Number.isFinite(options.maxRequestCents)
    ? Math.max(0, options.maxRequestCents)
    : 0;

  return {
    async loadPolicy(identity) {
      const [feature, policy, usage] = await Promise.all([
        client
          .from('tenant_feature_policy')
          .select('state, permitted_roles')
          .eq('tenant_id', identity.institutionId)
          .eq('capability', 'semester_intelligence')
          .maybeSingle(),
        client
          .from('ai_policy')
          .select('allowed_modes, allowed_providers, monthly_budget_cents, retention_days')
          .eq('tenant_id', identity.institutionId)
          .maybeSingle(),
        client.rpc('ai_usage_spent', { want_tenant: identity.institutionId }),
      ]);
      if (feature.error || policy.error || usage.error) {
        throw new Error('The authoritative institution AI policy could not be loaded.');
      }
      const featureRow = feature.data as { state?: string; permitted_roles?: unknown } | null;
      const policyRow = policy.data as {
        allowed_modes?: unknown;
        allowed_providers?: unknown;
        monthly_budget_cents?: unknown;
        retention_days?: unknown;
      } | null;
      if (!featureRow || !policyRow || !STATES.has(featureRow.state as IntelligenceFeatureState)) {
        return {
          state: 'off', permittedRoles: [], allowedModes: [], allowedModels: [],
          maxRequestCents: 0, monthlyBudgetCents: 0, monthlySpentCents: 0, retentionDays: 0,
        };
      }
      const permittedRoles = Array.isArray(featureRow.permitted_roles)
        ? featureRow.permitted_roles.filter((role): role is string => typeof role === 'string')
        : [];
      const allowedModes = Array.isArray(policyRow.allowed_modes)
        ? policyRow.allowed_modes.filter((mode): mode is IntelligenceMode => MODES.has(mode as IntelligenceMode))
        : [];
      const providers = new Set(Array.isArray(policyRow.allowed_providers)
        ? policyRow.allowed_providers.filter((provider): provider is string => typeof provider === 'string')
        : []);
      const allowedModels = options.configuredModels.filter((model) => providers.has(model.split(':', 1)[0]));
      return {
        state: featureRow.state as IntelligenceFeatureState,
        permittedRoles,
        allowedModes,
        allowedModels,
        maxRequestCents: maximumRequest,
        monthlyBudgetCents: Number(policyRow.monthly_budget_cents) || 0,
        monthlySpentCents: Number(usage.data) || 0,
        retentionDays: Math.max(0, Math.floor(Number(policyRow.retention_days) || 0)),
      };
    },

    async loadApprovedSources(identity, sourceIds) {
      if (!sourceIds.length) return [];
      const uniqueIds = [...new Set(sourceIds)];
      const metadata = await client
        .from('approved_source')
        .select('id, authority')
        .eq('tenant_id', identity.institutionId)
        .in('id', uniqueIds)
        .neq('authority', 'prohibited');
      if (metadata.error) throw new Error('Approved source metadata lookup failed.');
      const ids = (metadata.data ?? []).map((row) => row.id as string);
      if (!ids.length) return [];
      const payloads = await client.rpc('load_approved_source_content', {
        want_tenant: identity.institutionId,
        want_sources: ids,
      });
      if (payloads.error) throw new Error('Approved source content lookup failed.');
      const rows = (payloads.data ?? []) as Array<{ source_id: unknown; body: unknown; evidence_ids: unknown }>;
      return rows.map((row) => ({
        id: row.source_id as string,
        body: row.body as string,
        evidenceIds: Array.isArray(row.evidence_ids)
          ? row.evidence_ids.filter((id: unknown): id is string => typeof id === 'string')
          : [],
      }));
    },

    async reserveBudget(identity, maximumCents) {
      const id = randomUUID();
      const reservedCents = Math.min(maximumRequest, Math.max(0, maximumCents));
      const { data, error } = await client.rpc('reserve_ai_budget', {
        want_tenant: identity.institutionId,
        want_reservation: id,
        want_cents: reservedCents,
      });
      if (error) throw new Error('Institution AI budget reservation failed.');
      return data === true ? { id, reservedCents } : null;
    },

    async settleBudget(identity, reservation, usage) {
      if (!usage) {
        const { data, error } = await client.rpc('release_ai_budget', {
          want_tenant: identity.institutionId,
          want_reservation: reservation.id,
        });
        if (error) throw new Error('Institution AI budget release failed.');
        return data === true;
      }
      const { data, error } = await client.rpc('settle_ai_budget', {
        want_tenant: identity.institutionId,
        want_reservation: reservation.id,
        want_actual_cents: usage.costCents,
        want_input_tokens: usage.inputTokens,
        want_output_tokens: usage.outputTokens,
      });
      if (error) throw new Error('Institution AI usage settlement failed.');
      return data === true;
    },
  };
}
