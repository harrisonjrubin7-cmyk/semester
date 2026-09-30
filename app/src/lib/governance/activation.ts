/** Pure, fail-closed tenant capability activation decisions. */
import type { ConfigVersion } from '../config/studio';
import type { CapabilityDefinition } from './capability-governance';

export const ACTIVATION_REQUIREMENT_KEYS = [
  'tenant_configuration', 'authorization', 'entitlement', 'consent',
  'current_evidence', 'accountable_approval', 'integration_health',
  'support_ready', 'monitoring_ready', 'rollback_ready',
  'parallel_run', 'uat', 'go_live_authorization', 'audit_available',
] as const;
export type ActivationRequirementKey = (typeof ACTIVATION_REQUIREMENT_KEYS)[number];
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
  decisionKey: string;
  requestId: string;
  tenantId: string;
  capabilityId: string;
  operation: string;
  policyVersion: string;
  configurationVersion: number;
  issuedAt: string;
  expiresAt: string;
}

export type ActivationDecision =
  | { outcome: 'allow'; reason: 'all_requirements_satisfied'; receipt: ActivationReceipt; missing: readonly []; references: readonly string[] }
  | { outcome: 'deny' | 'unmet_requirements'; reason: string; receipt: null; missing: readonly ActivationRequirementKey[]; references: readonly string[] };

const STANDARD: readonly ActivationRequirementKey[] = ['tenant_configuration', 'authorization', 'entitlement'];
const CONTROLLED: readonly ActivationRequirementKey[] = [
  ...STANDARD, 'consent', 'current_evidence', 'accountable_approval', 'integration_health',
  'support_ready', 'monitoring_ready', 'rollback_ready', 'audit_available',
];
const HIGH_RISK: readonly ActivationRequirementKey[] = ACTIVATION_REQUIREMENT_KEYS;

export function requiredFor(capability: CapabilityDefinition): readonly ActivationRequirementKey[] {
  if (capability.activationClass === 'high-risk') return HIGH_RISK;
  if (capability.activationClass === 'controlled') return CONTROLLED;
  return STANDARD;
}

/** Parse ISO text consistently: an omitted offset means UTC, never host local time. */
function instant(value: string): number {
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
  return Date.parse(normalized);
}

/** Stable non-cryptographic identifier; it is not a signature or credential. */
function stableKey(parts: readonly unknown[]): string {
  const input = JSON.stringify(['activation-v1', ...parts]);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `activation-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function invalidConfiguration(request: ActivationRequest, context: ActivationContext): boolean {
  const configuration = context.configuration;
  return !configuration ||
    configuration.tenant_id !== request.tenantId ||
    configuration.state !== 'published' ||
    configuration.version === null;
}

function referencesFor(states: readonly RequirementState[], tenantId: string): string[] {
  return [...new Set(states.filter((state) => state.tenantId === tenantId).flatMap((state) => state.references))].sort();
}

export function evaluateActivation(
  request: ActivationRequest,
  capability: CapabilityDefinition | undefined,
  context: ActivationContext,
): ActivationDecision {
  if (!capability || capability.id !== request.capabilityId || !request.tenantId) {
    return { outcome: 'deny', reason: 'unknown_or_unscoped_capability', receipt: null, missing: [], references: [] };
  }
  if (context.killSwitchEngaged) {
    return { outcome: 'deny', reason: 'kill_switch_engaged', receipt: null, missing: [], references: [] };
  }

  const needed = requiredFor(capability);
  const missing = new Set<ActivationRequirementKey>();
  if (invalidConfiguration(request, context)) missing.add('tenant_configuration');

  for (const key of needed) {
    if (key === 'tenant_configuration') continue;
    const states = context.requirements.filter((state) => state.key === key);
    if (!states.length || states.some((state) => state.tenantId !== request.tenantId || state.status !== 'satisfied')) missing.add(key);
  }

  const missingOrdered = needed.filter((key) => missing.has(key));
  const references = referencesFor(context.requirements, request.tenantId);
  if (missingOrdered.length) {
    return {
      outcome: context.existingWorkflow ? 'deny' : 'unmet_requirements',
      reason: context.existingWorkflow ? 'continuity_required' : 'requirements_incomplete',
      receipt: null,
      missing: missingOrdered,
      references,
    };
  }

  const configurationVersion = context.configuration!.version!;
  const issued = instant(context.now);
  if (!Number.isFinite(issued) || !context.policyVersion) {
    return { outcome: 'deny', reason: 'invalid_policy_or_time', receipt: null, missing: [], references: [] };
  }
  const decisionKey = stableKey([
    request.requestId, request.tenantId, request.capabilityId, request.operation,
    context.policyVersion, configurationVersion,
  ]);
  const receipt: ActivationReceipt = {
    decisionKey,
    requestId: request.requestId,
    tenantId: request.tenantId,
    capabilityId: request.capabilityId,
    operation: request.operation,
    policyVersion: context.policyVersion,
    configurationVersion,
    issuedAt: new Date(issued).toISOString(),
    expiresAt: new Date(issued + 15 * 60 * 1000).toISOString(),
  };
  return { outcome: 'allow', reason: 'all_requirements_satisfied', receipt, missing: [], references };
}
