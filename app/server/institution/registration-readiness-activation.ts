import type { UniversityRole } from '../../../packages/institution/src/index.ts';
import { PlatformError, type RequestContext } from '../../../packages/platform/src/index.ts';
import type { RegistrationReadinessRepository } from './readiness-service.ts';
import type {
  RegistrationReadinessCommandBoundary,
  RegistrationReadinessCommandReceipt,
} from './registration-readiness-commands.ts';

export const REGISTRATION_READINESS_CAPABILITY = 'registration.readiness';
export const REGISTRATION_READINESS_ROLLOUT_FLAG = 'registration.readiness.evaluation';

export type RegistrationReadinessActivationOperation = 'start' | 'evaluate';
export type RegistrationReadinessActivationDenial =
  | 'capability_unavailable'
  | 'tenant_entitlement_missing'
  | 'rollout_flag_off'
  | 'scope_not_approved'
  | 'approval_missing_or_stale'
  | 'integration_unhealthy'
  | 'kill_switch_engaged'
  | 'queue_paused'
  | 'activation_facts_invalid';

export interface RegistrationReadinessActivationRequest {
  context: RequestContext;
  roles: readonly UniversityRole[];
  termId: string;
  operation: RegistrationReadinessActivationOperation;
  evaluatedAt: string;
}

interface EffectiveWindow {
  effectiveFrom: string;
  effectiveUntil: string;
}

export interface RegistrationReadinessActivationScope {
  campusIds: readonly string[];
  termIds: readonly string[];
  cohortIds: readonly string[];
  roles: readonly UniversityRole[];
}

/**
 * Current facts projected from the existing control plane. Implementations
 * must derive the tenant and subject scope from the trusted request context;
 * no field in the HTTP body is an activation authority.
 */
export interface RegistrationReadinessActivationFacts {
  tenantId: string;
  subject: {
    tenantId: string;
    campusIds: readonly string[];
    cohortIds: readonly string[];
  };
  platformCapability: { key: typeof REGISTRATION_READINESS_CAPABILITY; available: boolean };
  entitlement: EffectiveWindow & {
    tenantId: string;
    capability: typeof REGISTRATION_READINESS_CAPABILITY;
    enabled: boolean;
  };
  rollout: EffectiveWindow & {
    tenantId: string;
    flag: typeof REGISTRATION_READINESS_ROLLOUT_FLAG;
    enabled: boolean;
    scope: RegistrationReadinessActivationScope;
  };
  approval: (EffectiveWindow & {
    id: string;
    auditEventId: string;
    tenantId: string;
    capability: typeof REGISTRATION_READINESS_CAPABILITY;
    status: 'approved' | 'revoked';
    requestedBy: string;
    approvedBy: string;
    scope: RegistrationReadinessActivationScope;
  }) | null;
  integration: {
    tenantId: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    checkedAt: string;
    freshUntil: string;
  };
  killSwitch: { tenantId: string | null; engaged: boolean };
  queue: { tenantId: string; state: 'accepting' | 'paused' | 'draining' };
}

export interface RegistrationReadinessActivationSource {
  load(request: RegistrationReadinessActivationRequest): Promise<RegistrationReadinessActivationFacts>;
}

export type RegistrationReadinessActivationDecision =
  | { allowed: true; approvalId: string; auditEventId: string; effectiveUntil: string }
  | { allowed: false; code: RegistrationReadinessActivationDenial; fallback: string };

export interface RegistrationReadinessActivationGate {
  decide(request: RegistrationReadinessActivationRequest): Promise<RegistrationReadinessActivationDecision>;
}

const FALLBACK = 'Registration readiness is unavailable right now. Use your university registration portal or contact advising.';
const deny = (code: RegistrationReadinessActivationDenial): RegistrationReadinessActivationDecision => ({
  allowed: false,
  code,
  fallback: FALLBACK,
});

function instant(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function windowIsCurrent(window: EffectiveWindow, now: number): boolean {
  const from = instant(window.effectiveFrom);
  const until = instant(window.effectiveUntil);
  return from !== null && until !== null && from <= now && until > now && until > from;
}

function intersects(left: readonly string[], right: readonly string[]): boolean {
  return left.some((value) => right.includes(value));
}

function scopeCovers(
  scope: RegistrationReadinessActivationScope,
  request: RegistrationReadinessActivationRequest,
  facts: RegistrationReadinessActivationFacts,
): boolean {
  return scope.campusIds.length > 0
    && scope.termIds.includes(request.termId)
    && scope.cohortIds.length > 0
    && scope.roles.length > 0
    && intersects(scope.campusIds, facts.subject.campusIds)
    && intersects(scope.cohortIds, facts.subject.cohortIds)
    && intersects(scope.roles, request.roles);
}

/** Pure policy over authoritative facts; every missing or malformed fact denies. */
export class ScopedRegistrationReadinessActivationGate implements RegistrationReadinessActivationGate {
  constructor(private readonly source: RegistrationReadinessActivationSource) {}

  async decide(request: RegistrationReadinessActivationRequest): Promise<RegistrationReadinessActivationDecision> {
    try {
      return await this.decideFromCurrentFacts(request);
    } catch {
      return deny('activation_facts_invalid');
    }
  }

  private async decideFromCurrentFacts(
    request: RegistrationReadinessActivationRequest,
  ): Promise<RegistrationReadinessActivationDecision> {
    const now = instant(request.evaluatedAt);
    if (now === null) return deny('activation_facts_invalid');
    const facts = await this.source.load(request);
    const tenant = request.context.tenantId;

    if (facts.killSwitch.engaged && (facts.killSwitch.tenantId === null || facts.killSwitch.tenantId === tenant)) {
      return deny('kill_switch_engaged');
    }
    if (
      facts.tenantId !== tenant
      || facts.subject.tenantId !== tenant
      || facts.entitlement.tenantId !== tenant
      || facts.rollout.tenantId !== tenant
      || facts.integration.tenantId !== tenant
      || facts.queue.tenantId !== tenant
      || (facts.killSwitch.tenantId !== null && facts.killSwitch.tenantId !== tenant)
    ) return deny('activation_facts_invalid');
    if (facts.platformCapability.key !== REGISTRATION_READINESS_CAPABILITY || !facts.platformCapability.available) {
      return deny('capability_unavailable');
    }
    if (
      facts.entitlement.capability !== REGISTRATION_READINESS_CAPABILITY
      || !facts.entitlement.enabled
      || !windowIsCurrent(facts.entitlement, now)
    ) return deny('tenant_entitlement_missing');
    if (
      facts.rollout.flag !== REGISTRATION_READINESS_ROLLOUT_FLAG
      || !facts.rollout.enabled
      || !windowIsCurrent(facts.rollout, now)
    ) return deny('rollout_flag_off');
    if (!scopeCovers(facts.rollout.scope, request, facts)) return deny('scope_not_approved');

    const approval = facts.approval;
    if (
      !approval
      || approval.tenantId !== tenant
      || approval.capability !== REGISTRATION_READINESS_CAPABILITY
      || approval.status !== 'approved'
      || !approval.id.trim()
      || !approval.auditEventId.trim()
      || !approval.requestedBy.trim()
      || !approval.approvedBy.trim()
      || approval.requestedBy === approval.approvedBy
      || !windowIsCurrent(approval, now)
      || !scopeCovers(approval.scope, request, facts)
    ) return deny('approval_missing_or_stale');

    const checkedAt = instant(facts.integration.checkedAt);
    const freshUntil = instant(facts.integration.freshUntil);
    if (
      facts.integration.status !== 'healthy'
      || checkedAt === null
      || freshUntil === null
      || checkedAt > now
      || freshUntil <= now
    ) return deny('integration_unhealthy');
    if (facts.queue.state !== 'accepting') return deny('queue_paused');

    return {
      allowed: true,
      approvalId: approval.id,
      auditEventId: approval.auditEventId,
      effectiveUntil: approval.effectiveUntil,
    };
  }
}

function termFromStartInput(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  return Object.keys(value).length === 1
    && typeof value.termId === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.termId)
    ? value.termId
    : null;
}

/**
 * Enforcement wrapper for the durable command boundary. It re-evaluates the
 * gate on start and evaluate so a kill switch, expired approval, health
 * failure or queue pause takes effect without a restart. Re-enabling requires
 * the same complete fact set to pass again.
 */
export class ActivationControlledRegistrationReadinessCommands implements RegistrationReadinessCommandBoundary {
  constructor(
    private readonly delegate: RegistrationReadinessCommandBoundary,
    private readonly repository: RegistrationReadinessRepository,
    private readonly activation: RegistrationReadinessActivationGate,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async requireActive(
    context: RequestContext,
    roles: readonly UniversityRole[],
    termId: string,
    operation: RegistrationReadinessActivationOperation,
  ): Promise<void> {
    const decision = await this.activation.decide({
      context,
      roles,
      termId,
      operation,
      evaluatedAt: this.now().toISOString(),
    });
    if (!decision.allowed) {
      throw PlatformError.specific(503, 'registration_readiness_paused', decision.fallback, {
        userAction: { label: 'Contact advising', kind: 'contact_support' },
      });
    }
  }

  async start(
    context: RequestContext,
    roles: readonly UniversityRole[],
    input: unknown,
  ): Promise<RegistrationReadinessCommandReceipt> {
    const termId = termFromStartInput(input);
    if (termId !== null) await this.requireActive(context, roles, termId, 'start');
    return await this.delegate.start(context, roles, input);
  }

  async evaluate(
    context: RequestContext,
    roles: readonly UniversityRole[],
    evaluationId: string,
  ): Promise<RegistrationReadinessCommandReceipt> {
    const record = await this.repository.get(context.tenantId, evaluationId);
    if (!record || record.subjectId !== context.actor.personId) {
      throw new PlatformError('not_found', 'Registration readiness evaluation was not found.');
    }
    await this.requireActive(context, roles, record.termId, 'evaluate');
    return await this.delegate.evaluate(context, roles, evaluationId);
  }
}
