import { randomUUID } from 'node:crypto';
import { courseAgentPolicy, type CourseAgentPolicy } from '../../../packages/institution/src/course-agent-policy.ts';
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
  IntelligenceCourseScope,
} from './intelligence.ts';

const STATES = new Set<IntelligenceFeatureState>(['off', 'preview', 'sandbox', 'production']);
const MODES = new Set<IntelligenceMode>(['explain', 'hint', 'practice', 'review', 'draft']);

export interface IntelligenceRepositoryOptions {
  client?: SupabaseClient;
  url?: string;
  serviceKey?: string;
  configuredModels: readonly string[];
  maxRequestCents: number;
  /** Dates without a timezone in Course Studio take effect at the start of the UTC day. */
  now?: () => Date;
}

export interface IntelligenceRepository {
  /** Whether `kill.ai_generation` is engaged for this school or for everyone. */
  killSwitchEngaged(identity: UniversityIdentity): Promise<boolean>;
  loadCoursePolicy(identity: UniversityIdentity, scope: IntelligenceCourseScope): Promise<CourseAgentPolicy>;
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
    // The same two rules as `supabase/functions/_shared/killswitch.ts`, and
    // written out again rather than imported: this file compiles under the
    // gateway's NodeNext build, where nothing under `supabase/functions/` may
    // be reached (CLAUDE.md, the #803 lesson). A switch that cannot be read is
    // thrown; the global row stops every school, a school's row stops its own.
    async killSwitchEngaged(identity) {
      try {
        const { data, error } = await client
          .from('feature_kill_switch')
          .select('tenant_id, engaged')
          .eq('switch_key', 'kill.ai_generation');
        if (error) return true;
        const rows = (data ?? []) as Array<{ tenant_id: string | null; engaged: boolean }>;
        return rows.some((k) => k.engaged && (k.tenant_id === null || k.tenant_id === identity.institutionId));
      } catch {
        return true;
      }
    },

    async loadPolicy(identity) {
      const [feature, policy, usage] = await Promise.all([
        client
          .from('tenant_feature_policy')
          .select('state, permitted_roles, permitted_cohorts')
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
      const featureRow = feature.data as { state?: string; permitted_roles?: unknown; permitted_cohorts?: unknown } | null;
      const policyRow = policy.data as {
        allowed_modes?: unknown;
        allowed_providers?: unknown;
        monthly_budget_cents?: unknown;
        retention_days?: unknown;
      } | null;
      const off: TenantIntelligencePolicy = {
        state: 'off', permittedRoles: [], allowedModes: [], allowedModels: [],
        maxRequestCents: 0, monthlyBudgetCents: 0, monthlySpentCents: 0, retentionDays: 0,
      };
      if (!featureRow || !policyRow || !STATES.has(featureRow.state as IntelligenceFeatureState)) return off;
      // The release cohort: a school that limited Semester Intelligence to a
      // pilot has limited it here too. This client is the service key, so the
      // membership is asked of this person by id — live rows only — and a
      // read that fails throws, like every other read here, rather than
      // admitting the whole school. Outside the cohort, the policy is off.
      const permittedCohorts = Array.isArray(featureRow.permitted_cohorts)
        ? featureRow.permitted_cohorts.filter((cohort): cohort is string => typeof cohort === 'string')
        : [];
      if (permittedCohorts.length > 0) {
        const member = await client
          .from('feature_cohort_members')
          .select('cohort')
          .eq('tenant_id', identity.institutionId)
          .eq('user_id', identity.userId)
          .is('removed_at', null)
          .in('cohort', permittedCohorts);
        if (member.error) throw new Error('The institution AI release cohort could not be loaded.');
        if (!Array.isArray(member.data) || member.data.length === 0) return off;
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

    async loadCoursePolicy(identity, scope) {
      const today = (options.now?.() ?? new Date()).toISOString().slice(0, 10);
      const { data, error } = await client.from('course_ai_rules')
        .select('blanket, uses, words, version, effective')
        .eq('tenant_id', identity.institutionId)
        .eq('course_code', scope.courseId)
        .eq('term', scope.term)
        // NULL is the existing publish-now choice. Filter before taking the
        // highest version so a scheduled update cannot erase today's rule.
        .or(`effective.is.null,effective.lte.${today}`)
        .order('version', { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error('The published course AI policy could not be loaded.');
      return courseAgentPolicy(data);
    },

    async loadApprovedSources(identity, sourceIds) {
      if (!sourceIds.length) return [];
      const uniqueIds = [...new Set(sourceIds)];
      const metadata = await client
        .from('approved_source')
        .select('id, authority, course_id, origin, policy_scope, policy_course_code, policy_term, title, citation_label, updated_at')
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
      const sourceMetadata = new Map((metadata.data ?? []).map((source) => [source.id, source]));
      return rows.map((row) => ({
        id: row.source_id as string,
        courseId: sourceMetadata.get(row.source_id)?.course_id,
        origin: sourceMetadata.get(row.source_id)?.origin,
        policyScope: sourceMetadata.get(row.source_id)?.policy_scope,
        policyCourseCode: sourceMetadata.get(row.source_id)?.policy_course_code,
        policyTerm: sourceMetadata.get(row.source_id)?.policy_term,
        title: sourceMetadata.get(row.source_id)?.title,
        locator: sourceMetadata.get(row.source_id)?.citation_label,
        verifiedAt: sourceMetadata.get(row.source_id)?.updated_at,
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
