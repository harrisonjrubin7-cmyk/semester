/**
 * Semester's canonical capability activation control plane.
 *
 * A feature flag is a rollout input, never authority. This module projects the
 * existing flag registry into stable capability definitions and evaluates the
 * additional tenant, evidence, approval, integration and operating controls
 * required before a capability may act.
 */
import { FLAGS, type FlagDefinition } from '../flags';

export const ACTIVATION_PRIMITIVES = [
  'identity-tenancy',
  'permission-consent-authority',
  'canonical-data-provenance',
  'policy-rules',
  'action-workflow',
  'integration-gateway',
  'trust-evidence',
  'experience-accessibility',
] as const;

export type ActivationPrimitive = (typeof ACTIVATION_PRIMITIVES)[number];
export type ActivationClass = 'standard' | 'controlled' | 'high-risk';
export type DataClassification = 'public' | 'internal' | 'education-record' | 'restricted';

export const MATURITY = {
  vision: 0,
  designed: 1,
  built: 2,
  verified: 3,
  institutionReady: 4,
  tenantApproved: 5,
  parallelRun: 6,
  boundedSystemOfRecord: 7,
  tenantGA: 8,
  repeatable: 9,
} as const;

export type MaturityLevel = (typeof MATURITY)[keyof typeof MATURITY];

export const HIGH_RISK_CONTRACT = [
  'executed-agreement',
  'data-authority-map',
  'retention-correction-export-offboarding',
  'role-purpose-consent-policy',
  'separation-of-duty',
  'accessible-workflow-and-fallback',
  'sandbox-security-idempotency-reconciliation',
  'migration-parallel-run-rollback',
  'monitoring-slo-support-incident-kill-switch',
  'training-uat-staged-rollout-go-live-authorization',
  'truthful-product-status-and-claim-review',
] as const;

export type HighRiskRequirement = (typeof HIGH_RISK_CONTRACT)[number];

export interface CapabilityDefinition {
  /** Stable across wording changes. */
  id: `flag:${string}`;
  flagKey: string;
  name: string;
  domain: string;
  owner: string;
  description: string;
  primitives: readonly ActivationPrimitive[];
  activationClass: ActivationClass;
  productMaturity: MaturityLevel;
  dataClassifications: readonly DataClassification[];
  requiredEvidence: readonly string[];
  requiredIntegrations: readonly string[];
  highRiskContract: readonly HighRiskRequirement[];
  configurationSchemaVersion: string;
  claimAtMaturity: Readonly<Partial<Record<MaturityLevel, string>>>;
  lifecycle: 'active' | 'deprecated' | 'retired';
  fallback: string;
  rollback: string;
  offboarding: string;
}

const highRiskEvidence = [
  'security-review',
  'privacy-review',
  'accessibility-review',
  'failure-and-recovery-test',
  'tenant-uat',
  'go-live-authorization',
] as const;

function activationClass(flag: FlagDefinition): ActivationClass {
  if (flag.highRisk || flag.type === 'writeback') return 'high-risk';
  if (flag.needsConnection || flag.type === 'connector' || flag.type === 'scope') return 'controlled';
  return 'standard';
}

function primitivesFor(flag: FlagDefinition): readonly ActivationPrimitive[] {
  const out = new Set<ActivationPrimitive>([
    'identity-tenancy',
    'permission-consent-authority',
    'policy-rules',
    'trust-evidence',
    'experience-accessibility',
  ]);
  if (flag.type === 'writeback' || flag.type === 'experiment') out.add('action-workflow');
  if (flag.needsConnection || flag.type === 'connector' || flag.type === 'scope' || flag.type === 'writeback') {
    out.add('integration-gateway');
    out.add('canonical-data-provenance');
  }
  return [...out];
}

function definition(flag: FlagDefinition): CapabilityDefinition {
  const risk = activationClass(flag);
  return {
    id: `flag:${flag.key}`,
    flagKey: flag.key,
    name: flag.key,
    domain: flag.key.split('.')[0] ?? 'unknown',
    owner: flag.owner,
    description: flag.description,
    primitives: primitivesFor(flag),
    activationClass: risk,
    // Presence in the executable flag registry proves only that the rollout
    // and rollback contract is built. Verification is a separate claim.
    productMaturity: MATURITY.built,
    dataClassifications: risk === 'high-risk' ? ['education-record', 'restricted'] : ['internal'],
    requiredEvidence: risk === 'high-risk' ? highRiskEvidence : risk === 'controlled' ? ['security-review', 'tenant-uat'] : [],
    requiredIntegrations: flag.needsConnection ? ['approved-live-connection'] : [],
    highRiskContract: risk === 'high-risk' ? HIGH_RISK_CONTRACT : [],
    configurationSchemaVersion: '1',
    claimAtMaturity: {
      [MATURITY.designed]: 'Designed',
      [MATURITY.built]: 'Built behind governance controls; not institution-ready',
      [MATURITY.verified]: 'Verified in repository and test environments',
      [MATURITY.institutionReady]: 'Institution-ready; not approved for a tenant',
      [MATURITY.tenantApproved]: 'Approved for the named tenant and bounded scope',
      [MATURITY.parallelRun]: 'Operating in a tenant-approved parallel run',
      [MATURITY.boundedSystemOfRecord]: 'Authoritative only for the approved bounded workflow',
      [MATURITY.tenantGA]: 'Generally available only for the named tenant population',
      [MATURITY.repeatable]: 'Repeatable from tested templates and current evidence',
    },
    lifecycle: 'active',
    fallback: flag.rollback,
    rollback: flag.rollback,
    offboarding: 'Disable the capability, preserve/export tenant records under the data map, revoke external access, and retain the audit trail.',
  };
}

/** One canonical capability for every executable flag. */
export const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = FLAGS.map(definition);

export type EvidenceStatus = 'current' | 'expired' | 'revoked' | 'superseded';

export interface EvidenceRecord {
  id: string;
  kind: string;
  tenantId: string;
  capabilityId: CapabilityDefinition['id'];
  status: EvidenceStatus;
  validFrom: string;
  validUntil: string;
  artifactRef: string;
}

export interface ApprovalRecord {
  id: string;
  tenantId: string;
  capabilityId: CapabilityDefinition['id'];
  role: string;
  status: 'approved' | 'revoked' | 'expired';
  validUntil: string;
  configurationVersion: string;
}

export interface IntegrationRecord {
  id: string;
  tenantId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'revoked';
  checkedAt: string;
}

export interface ActivationRequest {
  capabilityId: string;
  tenantId: string;
  actorId: string;
  purpose: string;
  operation: string;
  idempotencyKey: string;
  evaluatedAt: string;
}

export interface ActivationContext {
  featureEnabled: boolean;
  entitled: boolean;
  identityVerified: boolean;
  tenantMembershipVerified: boolean;
  actorAuthorized: boolean;
  purposeAllowed: boolean;
  consentSatisfied: boolean;
  killSwitchActive: boolean;
  auditSinkAvailable: boolean;
  configurationVersion: string | null;
  configurationSchemaVersion: string | null;
  policyVersion: string;
  tenantMaturity: MaturityLevel;
  supportReady: boolean;
  monitoringReady: boolean;
  rollbackReady: boolean;
  offboardingReady: boolean;
  separationOfDutySatisfied: boolean;
  highRiskRequirements: readonly HighRiskRequirement[];
  evidence: readonly EvidenceRecord[];
  approvals: readonly ApprovalRecord[];
  integrations: readonly IntegrationRecord[];
}

export type DecisionCode =
  | 'allowed'
  | 'unknown-capability'
  | 'capability-not-active'
  | 'kill-switch-active'
  | 'audit-unavailable'
  | 'identity-or-tenant-unverified'
  | 'authority-purpose-or-consent-missing'
  | 'rollout-input-missing'
  | 'configuration-invalid'
  | 'product-maturity-insufficient'
  | 'tenant-maturity-insufficient'
  | 'evidence-missing-or-stale'
  | 'approval-missing-or-stale'
  | 'integration-unhealthy'
  | 'operating-control-missing'
  | 'high-risk-contract-incomplete';

export interface ActivationDecision {
  outcome: 'allow' | 'deny' | 'unmet-requirements';
  code: DecisionCode;
  /** Safe for a general audit log; contains no evidence titles or findings. */
  explanation: string;
  unmet: readonly string[];
  decisionId: string;
  capabilityId: string;
  tenantId: string;
  configurationVersion: string | null;
  policyVersion: string;
  evaluatedAt: string;
  receipt: ActivationReceipt | null;
}

export interface ActivationReceipt {
  decisionId: string;
  tenantId: string;
  capabilityId: CapabilityDefinition['id'];
  operation: string;
  policyVersion: string;
  configurationVersion: string;
  issuedAt: string;
  expiresAt: string;
}

const SAFE_EXPLANATIONS: Record<DecisionCode, string> = {
  allowed: 'The bounded operation is permitted by the referenced configuration and policy versions.',
  'unknown-capability': 'The capability is not registered.',
  'capability-not-active': 'The capability is deprecated or retired.',
  'kill-switch-active': 'A safety control currently blocks this capability.',
  'audit-unavailable': 'The required audit record cannot be written.',
  'identity-or-tenant-unverified': 'Identity or tenant membership could not be verified.',
  'authority-purpose-or-consent-missing': 'Required authority, purpose, or consent is not satisfied.',
  'rollout-input-missing': 'The capability is not enabled and entitled for this tenant.',
  'configuration-invalid': 'The tenant configuration is missing or incompatible.',
  'product-maturity-insufficient': 'The product capability has not reached the required verified maturity.',
  'tenant-maturity-insufficient': 'The tenant activation has not reached the required maturity.',
  'evidence-missing-or-stale': 'Required current evidence is missing.',
  'approval-missing-or-stale': 'A required current tenant approval is missing.',
  'integration-unhealthy': 'A required tenant integration is unavailable or unhealthy.',
  'operating-control-missing': 'Required support, monitoring, rollback, or offboarding controls are incomplete.',
  'high-risk-contract-incomplete': 'The capability-specific high-risk activation contract is incomplete.',
};

function decision(
  request: ActivationRequest,
  context: ActivationContext,
  outcome: ActivationDecision['outcome'],
  code: DecisionCode,
  unmet: readonly string[] = [],
): ActivationDecision {
  const decisionId = [request.idempotencyKey, request.capabilityId, request.tenantId, context.configurationVersion ?? 'none', context.policyVersion].join(':');
  const receipt = outcome === 'allow' && context.configurationVersion
    ? {
        decisionId,
        tenantId: request.tenantId,
        capabilityId: request.capabilityId as CapabilityDefinition['id'],
        operation: request.operation,
        policyVersion: context.policyVersion,
        configurationVersion: context.configurationVersion,
        issuedAt: request.evaluatedAt,
        expiresAt: new Date(Date.parse(request.evaluatedAt) + 15 * 60 * 1000).toISOString(),
      }
    : null;
  return {
    outcome,
    code,
    explanation: SAFE_EXPLANATIONS[code],
    unmet,
    decisionId,
    capabilityId: request.capabilityId,
    tenantId: request.tenantId,
    configurationVersion: context.configurationVersion,
    policyVersion: context.policyVersion,
    evaluatedAt: request.evaluatedAt,
    receipt,
  };
}

const activeOn = (record: { status: string; validFrom?: string; validUntil: string }, at: string) =>
  record.status === 'current' || record.status === 'approved'
    ? (!record.validFrom || record.validFrom <= at) && record.validUntil >= at
    : false;

export function evaluateActivation(
  request: ActivationRequest,
  context: ActivationContext,
  registry: readonly CapabilityDefinition[] = CAPABILITY_REGISTRY,
): ActivationDecision {
  const capability = registry.find((item) => item.id === request.capabilityId);
  if (!capability) return decision(request, context, 'deny', 'unknown-capability');
  if (capability.lifecycle !== 'active') return decision(request, context, 'deny', 'capability-not-active');
  if (context.killSwitchActive) return decision(request, context, 'deny', 'kill-switch-active');
  if (!context.auditSinkAvailable) return decision(request, context, 'deny', 'audit-unavailable');
  if (!context.identityVerified || !context.tenantMembershipVerified) {
    return decision(request, context, 'deny', 'identity-or-tenant-unverified');
  }
  if (!context.actorAuthorized || !context.purposeAllowed || !context.consentSatisfied) {
    return decision(request, context, 'deny', 'authority-purpose-or-consent-missing');
  }
  if (!context.featureEnabled || !context.entitled) return decision(request, context, 'deny', 'rollout-input-missing');
  if (
    !context.configurationVersion ||
    context.configurationSchemaVersion !== capability.configurationSchemaVersion
  ) return decision(request, context, 'unmet-requirements', 'configuration-invalid', ['compatible-tenant-configuration']);

  const minimumProduct = capability.activationClass === 'standard' ? MATURITY.built : capability.activationClass === 'controlled' ? MATURITY.verified : MATURITY.institutionReady;
  if (capability.productMaturity < minimumProduct) {
    return decision(request, context, 'unmet-requirements', 'product-maturity-insufficient', [`product-maturity-L${minimumProduct}`]);
  }

  if (capability.activationClass !== 'standard' && context.tenantMaturity < MATURITY.tenantApproved) {
    return decision(request, context, 'unmet-requirements', 'tenant-maturity-insufficient', ['tenant-approval-L5']);
  }

  const evidenceKinds = new Set(
    context.evidence
      .filter((item) => item.tenantId === request.tenantId && item.capabilityId === capability.id && activeOn(item, request.evaluatedAt))
      .map((item) => item.kind),
  );
  const missingEvidence = capability.requiredEvidence.filter((kind) => !evidenceKinds.has(kind));
  if (missingEvidence.length) return decision(request, context, 'unmet-requirements', 'evidence-missing-or-stale', missingEvidence);

  if (capability.activationClass !== 'standard') {
    const approved = context.approvals.some(
      (item) => item.tenantId === request.tenantId &&
        item.capabilityId === capability.id &&
        item.configurationVersion === context.configurationVersion &&
        activeOn(item, request.evaluatedAt),
    );
    if (!approved) return decision(request, context, 'unmet-requirements', 'approval-missing-or-stale', ['current-tenant-approval']);
  }

  const healthyIntegrations = new Set(
    context.integrations.filter((item) => item.tenantId === request.tenantId && item.status === 'healthy').map((item) => item.id),
  );
  const missingIntegrations = capability.requiredIntegrations.filter((id) => !healthyIntegrations.has(id));
  if (missingIntegrations.length) return decision(request, context, 'deny', 'integration-unhealthy', missingIntegrations);

  if (capability.activationClass !== 'standard' && (!context.supportReady || !context.monitoringReady || !context.rollbackReady || !context.offboardingReady)) {
    return decision(request, context, 'unmet-requirements', 'operating-control-missing', [
      ...(!context.supportReady ? ['support'] : []),
      ...(!context.monitoringReady ? ['monitoring'] : []),
      ...(!context.rollbackReady ? ['rollback'] : []),
      ...(!context.offboardingReady ? ['offboarding'] : []),
    ]);
  }

  if (capability.activationClass === 'high-risk') {
    const supplied = new Set(context.highRiskRequirements);
    const missing = capability.highRiskContract.filter((item) => !supplied.has(item));
    if (!context.separationOfDutySatisfied) missing.push('separation-of-duty');
    if (missing.length) return decision(request, context, 'unmet-requirements', 'high-risk-contract-incomplete', [...new Set(missing)]);
  }

  return decision(request, context, 'allow', 'allowed');
}

export function permittedClaim(capability: CapabilityDefinition, product: MaturityLevel, tenant?: MaturityLevel): string {
  const ceiling = tenant === undefined ? product : Math.min(product, tenant) as MaturityLevel;
  for (let level = ceiling; level >= MATURITY.vision; level -= 1) {
    const claim = capability.claimAtMaturity[level as MaturityLevel];
    if (claim) return claim;
  }
  return 'Vision only';
}

export function validateRegistry(registry: readonly CapabilityDefinition[] = CAPABILITY_REGISTRY): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const flags = new Set<string>();
  for (const capability of registry) {
    if (ids.has(capability.id)) errors.push(`duplicate capability id: ${capability.id}`);
    if (flags.has(capability.flagKey)) errors.push(`duplicate flag mapping: ${capability.flagKey}`);
    ids.add(capability.id);
    flags.add(capability.flagKey);
    if (!capability.primitives.length || capability.primitives.some((item) => !ACTIVATION_PRIMITIVES.includes(item))) {
      errors.push(`unknown or missing primitive: ${capability.id}`);
    }
    if (capability.activationClass === 'high-risk' && capability.highRiskContract.length !== HIGH_RISK_CONTRACT.length) {
      errors.push(`incomplete high-risk contract: ${capability.id}`);
    }
  }
  for (const flag of FLAGS) if (!flags.has(flag.key)) errors.push(`unmapped flag: ${flag.key}`);
  for (const flagKey of flags) if (!FLAGS.some((flag) => flag.key === flagKey)) errors.push(`unknown flag mapping: ${flagKey}`);
  return errors;
}
