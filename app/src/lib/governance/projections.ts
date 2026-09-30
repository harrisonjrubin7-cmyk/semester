/** Evidence-bounded projections from capability state to public claim words. */
import type { Claim, ClaimStatus } from '../ops/claims';
import { CLAIM_STATUSES } from '../ops/claims';
import type { ActivationClass, CapabilityDefinition, MaturityLevel } from './capability-governance';

export type ProjectionEvidence = 'current' | 'expiring' | 'expired' | 'revoked' | 'missing';

export interface ProjectionContext {
  productMaturity: MaturityLevel;
  tenantMaturity: MaturityLevel | null;
  activationClass: ActivationClass;
  evidence: ProjectionEvidence;
  namedPilot: boolean;
  generallyAvailable: boolean;
}

export interface CapabilityReadiness {
  capabilityId: string;
  allowed: readonly ClaimStatus[];
  reason: string;
}

/** Conservative repository-only view: no tenant, pilot, deployment, or live activation is inferred. */
export function repositoryProjectionContext(capability: CapabilityDefinition): ProjectionContext {
  const verified = capability.currentState === 'verified';
  return {
    productMaturity: capability.maturity,
    tenantMaturity: null,
    activationClass: capability.activationClass,
    evidence: verified ? 'current' : 'missing',
    namedPilot: false,
    generallyAvailable: verified && capability.activationClass === 'standard',
  };
}

const LEVEL: Readonly<Record<MaturityLevel, number>> = {
  L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, L5: 5, L6: 6, L7: 7, L8: 8, L9: 9,
};

const STATUS_ORDER: readonly ClaimStatus[] = [
  'planned', 'in-preparation', 'built-tested', 'institution-configured', 'limited-beta', 'available',
];

const evidenceIsCurrent = (evidence: ProjectionEvidence): boolean => evidence === 'current' || evidence === 'expiring';

export function permittedClaimStatuses(context: ProjectionContext): ReadonlySet<ClaimStatus> {
  const permitted = new Set<ClaimStatus>(['planned']);
  const product = LEVEL[context.productMaturity];
  if (product >= 2) permitted.add('in-preparation');
  if (product >= 3) permitted.add('built-tested');

  const evidenceCurrent = evidenceIsCurrent(context.evidence);
  if (context.activationClass === 'standard') {
    if (product >= 3 && context.generallyAvailable && evidenceCurrent && context.tenantMaturity === null) permitted.add('available');
    return permitted;
  }

  const tenant = context.tenantMaturity === null ? -1 : LEVEL[context.tenantMaturity];
  const effective = Math.min(product, tenant);
  if (evidenceCurrent && effective >= 5) permitted.add('institution-configured');
  if (evidenceCurrent && effective >= 6 && context.namedPilot) permitted.add('limited-beta');
  if (evidenceCurrent && effective >= 8 && context.generallyAvailable) permitted.add('available');
  return permitted;
}

export function capabilityReadiness(capability: CapabilityDefinition, context: ProjectionContext): CapabilityReadiness {
  const allowed = STATUS_ORDER.filter((status) => permittedClaimStatuses(context).has(status));
  return {
    capabilityId: capability.id,
    allowed,
    reason: `${capability.id} is ${context.productMaturity}/${context.tenantMaturity ?? 'no-tenant'} with ${context.evidence} evidence (${context.activationClass}).`,
  };
}

export function projectClaim(
  claim: Claim,
  capabilities: readonly CapabilityDefinition[],
  contextById: Readonly<Record<string, ProjectionContext>>,
): { permitted: boolean; allowed: readonly ClaimStatus[]; reason: string } {
  const definitions = new Map<string, CapabilityDefinition>(capabilities.map((capability) => [capability.id, capability]));
  if (!claim.capabilityIds.length) return { permitted: false, allowed: [], reason: `${claim.id} has no capability binding.` };

  let intersection = new Set<ClaimStatus>(CLAIM_STATUSES);
  for (const capabilityId of claim.capabilityIds) {
    const capability = definitions.get(capabilityId);
    const context = contextById[capabilityId];
    if (!capability || !context) return { permitted: false, allowed: [], reason: `${claim.id} has no projection for ${capabilityId}.` };
    const allowed = permittedClaimStatuses({ ...context, activationClass: capability.activationClass });
    intersection = new Set([...intersection].filter((status) => allowed.has(status)));
  }
  const allowed = STATUS_ORDER.filter((status) => intersection.has(status));
  return {
    permitted: intersection.has(claim.status),
    allowed,
    reason: intersection.has(claim.status)
      ? `${claim.status} is within the most restrictive linked capability projection.`
      : `${claim.status} exceeds the most restrictive linked capability projection (${allowed.join(', ') || 'none'}).`,
  };
}
