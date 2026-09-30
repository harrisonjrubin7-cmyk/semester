/**
 * Pure activation policy evaluation. Callers resolve scoped, current requirement
 * states (including evidence expiry) before evaluation. This function performs
 * no domain action or I/O; server/database authorization remains authoritative.
 */
import type { ConfigVersion } from '../config/studio';
import { ACTIVATION_CLASSES, MATURITY_LEVELS, capabilityDefinition, type ActivationClass, type CapabilityDefinition, type MaturityLevel } from './capability-governance';
import { instant } from './activation-instant';
import { isFlagOperation, operationPolicy } from './operation-policy';

export type ActivationRequirementKey =
  | 'tenant_configuration' | 'authorization' | 'entitlement' | 'consent'
  | 'current_evidence' | 'accountable_approval' | 'integration_health'
  | 'support_ready' | 'monitoring_ready' | 'rollback_ready'
  | 'parallel_run' | 'uat' | 'go_live_authorization' | 'audit_available';

export type RequirementStatus = 'satisfied' | 'missing' | 'expired' | 'revoked' | 'failed';

export interface RequirementState {
  key: ActivationRequirementKey;
  status: RequirementStatus;
  tenantId: string;
  references: readonly string[];
}

export interface ActivationRequest {
  requestId: string;
  tenantId: string;
  actorId: string;
  purpose: string;
  capabilityId: string;
  operation: string;
}

export interface ActivationContext {
  now: string;
  policyVersion: string;
  configuration: ConfigVersion | null;
  requirements: readonly RequirementState[];
  killSwitchEngaged: boolean;
  existingWorkflow: boolean;
}

export interface ActivationReceipt {
  /** Versioned deterministic correlation material, not a signature or credential. */
  decisionKey: string;
  requestId: string;
  tenantId: string;
  capabilityId: string;
  operation: string;
  policyVersion: string;
  /** Null only when both capability and operation permit a declared standard safe default. */
  configurationVersion: number | null;
  issuedAt: string;
  expiresAt: string;
}

export type ActivationDecision =
  | { outcome: 'allow'; reason: 'all_requirements_satisfied'; receipt: ActivationReceipt; missing: readonly [] }
  | { outcome: 'deny' | 'unmet_requirements'; reason: string; receipt: null; missing: readonly ActivationRequirementKey[] };

const REQUIREMENTS: Record<ActivationClass, readonly ActivationRequirementKey[]> = {
  standard: ['authorization', 'entitlement'],
  // Consent is conservatively required for every controlled operation until a
  // canonical profile explicitly models narrower applicability.
  controlled: [
    'tenant_configuration', 'authorization', 'entitlement', 'consent',
    'current_evidence', 'support_ready', 'monitoring_ready', 'rollback_ready', 'audit_available',
  ],
  'high-risk': [
    'tenant_configuration', 'authorization', 'entitlement', 'consent',
    'current_evidence', 'accountable_approval', 'integration_health',
    'support_ready', 'monitoring_ready', 'rollback_ready', 'parallel_run',
    'uat', 'go_live_authorization', 'audit_available',
  ],
};

const MINIMUM_MATURITY: Record<ActivationClass, MaturityLevel> = {
  standard: 'L2', controlled: 'L3', 'high-risk': 'L4',
};
const RECEIPT_LIFETIME = 15 * 60 * 1_000;
const nonempty = (value: string): boolean => typeof value === 'string' && value.trim().length > 0;
const deny = (reason: string, missing: readonly ActivationRequirementKey[] = []): ActivationDecision => ({ outcome: 'deny', reason, receipt: null, missing });

export function evaluateActivation(
  request: ActivationRequest,
  capability: CapabilityDefinition | undefined,
  context: ActivationContext,
): ActivationDecision {
  if (context.killSwitchEngaged) return deny('kill_switch_engaged');
  if (!nonempty(request.tenantId)) return deny('missing_tenant');
  if (![request.requestId, request.actorId, request.purpose, request.capabilityId, request.operation].every(nonempty)) return deny('invalid_request');
  const canonical = capabilityDefinition(request.capabilityId);
  if (!capability || capability.id !== request.capabilityId || !canonical) return deny('unknown_capability');
  // Caller metadata is not a policy override. Validate every field consumed by
  // this evaluator, then use the registry's values for security decisions.
  if (capability.activationClass !== canonical.activationClass || capability.maturity !== canonical.maturity
    || capability.safeDefaultEligible !== canonical.safeDefaultEligible) return deny('invalid_capability');
  const now = instant(context.now);
  if (now === null || !nonempty(context.policyVersion)) return deny('invalid_context');

  const operation = operationPolicy(request.operation);
  if (!operation && isFlagOperation(request.operation)) return deny('unknown_operation');
  if (operation && !operation.capabilityIds.includes(canonical.id)) return deny('operation_capability_mismatch');
  // Operations can raise the capability's policy floor, never lower it. An
  // ordinary personal operation outside flag namespaces retains capability policy.
  const activationClass = operation && ACTIVATION_CLASSES.indexOf(operation.activationClass) > ACTIVATION_CLASSES.indexOf(canonical.activationClass)
    ? operation.activationClass : canonical.activationClass;
  const maturity = MATURITY_LEVELS.indexOf(canonical.maturity);
  if (maturity < MATURITY_LEVELS.indexOf(MINIMUM_MATURITY[activationClass])) {
    return deny(context.existingWorkflow ? 'continuity_required' : 'product_maturity_insufficient');
  }

  const config = context.configuration;
  const validConfiguration = config !== null && config.state === 'published' && config.tenant_id === request.tenantId
    && typeof config.version === 'number' && Number.isSafeInteger(config.version) && config.version > 0;
  const requiresConfiguration = activationClass !== 'standard' || canonical.safeDefaultEligible !== true || config !== null;
  const required = activationClass === 'standard' && requiresConfiguration
    ? ['tenant_configuration' as const, ...REQUIREMENTS.standard]
    : REQUIREMENTS[activationClass];
  const missing = required.filter((key) => {
    const states = context.requirements.filter((state) => state.key === key);
    // A denial, wrong tenant or unknown status always wins over a duplicate
    // positive assertion, including assertions about tenant configuration.
    const allSatisfied = states.every((state) => state.tenantId === request.tenantId && state.status === 'satisfied');
    if (key === 'tenant_configuration') return !validConfiguration || !allSatisfied;
    return states.length === 0 || !allSatisfied;
  });

  if (missing.length > 0) {
    if (context.existingWorkflow) return deny('continuity_required', missing);
    if (missing.includes('tenant_configuration')) return deny('tenant_configuration_required', missing);
    if (missing.includes('audit_available')) return deny('audit_unavailable', missing);
    return { outcome: 'unmet_requirements', reason: 'requirements_not_satisfied', receipt: null, missing };
  }

  const configurationVersion = validConfiguration ? config!.version : null;
  // Ordered JSON preserves boundaries and escaping without async hashing.
  // This is correlation/idempotency material; never accept it as authorization.
  const decisionKey = JSON.stringify([
    'activation:v1', request.requestId, request.tenantId, request.capabilityId,
    request.operation, context.policyVersion, configurationVersion,
  ]);
  return {
    outcome: 'allow', reason: 'all_requirements_satisfied', missing: [],
    receipt: {
      decisionKey, requestId: request.requestId, tenantId: request.tenantId,
      capabilityId: request.capabilityId, operation: request.operation,
      policyVersion: context.policyVersion, configurationVersion,
      issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + RECEIPT_LIFETIME).toISOString(),
    },
  };
}
