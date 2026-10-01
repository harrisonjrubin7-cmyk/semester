/** Pure claim/readiness projections. None of these functions activates a tenant. */
import type { Claim, ClaimStatus } from '../ops/claims';
import { evidenceState, type EvidenceRecord } from '../ops/evidence';
import type { ActivationDecision } from './activation';
import { instant } from './activation-instant';
import { MATURITY_LEVELS, type ActivationClass, type CapabilityDefinition, type MaturityLevel } from './capability-governance';

export interface ProjectionContext {
  productMaturity: MaturityLevel;
  tenantMaturity: MaturityLevel | null;
  activationClass: ActivationClass;
  evidence: 'current' | 'expiring' | 'expired' | 'revoked' | 'missing';
  namedPilot: boolean;
  generallyAvailable: boolean;
  /** Standard capabilities may still require a tenant configuration. */
  requiresTenantActivation?: boolean;
  /** A supplied denial is restrictive; an allow never raises maturity or evidence. */
  activationDecision?: ActivationDecision;
}

// Used only after the class-specific sets have been formed, to prevent promotion.
const STATUS_ORDER: readonly ClaimStatus[] = ['planned', 'in-preparation', 'built-tested', 'institution-configured', 'limited-beta', 'available'];
const level = (m: MaturityLevel | null): number => m === null ? -1 : MATURITY_LEVELS.indexOf(m);

export function permittedClaimStatuses(context: ProjectionContext): ReadonlySet<ClaimStatus> {
  const allowed = new Set<ClaimStatus>(['planned']);
  const product = level(context.productMaturity);
  if (product >= 2) allowed.add('in-preparation');
  if (product >= 3) allowed.add('built-tested');
  // Expiring evidence is still valid until its UTC expiry boundary.
  if (!['current', 'expiring'].includes(context.evidence)
    || (context.activationDecision && context.activationDecision.outcome !== 'allow')) return allowed;
  const tenant = Math.min(product, level(context.tenantMaturity));
  if (tenant >= 5) allowed.add('institution-configured');
  if (tenant >= 6 && context.namedPilot) allowed.add('limited-beta');
  const personal = context.activationClass === 'standard' && context.requiresTenantActivation !== true;
  if (context.generallyAvailable && ((personal && product >= 3) || tenant >= 8)) allowed.add('available');
  return allowed;
}

/** Canonical metadata can only be narrowed by a caller's product context. */
export function capabilityReadiness(capability: CapabilityDefinition, context: ProjectionContext) {
  const productMaturity = level(context.productMaturity) < level(capability.maturity) ? context.productMaturity : capability.maturity;
  const bounded: ProjectionContext = {
    ...context, productMaturity, activationClass: capability.activationClass,
    requiresTenantActivation: capability.activationClass !== 'standard' || !capability.safeDefaultEligible || context.requiresTenantActivation === true,
  };
  const allowed = [...permittedClaimStatuses(bounded)];
  return {
    capabilityId: capability.id, productMaturity, tenantMaturity: context.tenantMaturity,
    activationClass: capability.activationClass, evidence: context.evidence, allowed,
    activationOutcome: context.activationDecision?.outcome ?? null,
    reason: `${capability.id}: ${productMaturity}, tenant ${context.tenantMaturity ?? 'unverified'}, ${capability.activationClass}, evidence ${context.evidence}${context.activationDecision ? `, activation ${context.activationDecision.reason}` : '; no activation decision supplied'}`,
  };
}

export function projectClaim(
  claim: Claim,
  capabilities: readonly CapabilityDefinition[],
  contextById: Readonly<Record<string, ProjectionContext>>,
): { permitted: boolean; allowed: readonly ClaimStatus[]; reason: string } {
  const reject = (reason: string) => ({ permitted: false, allowed: [], reason });
  if (!claim.capabilityIds.length) return reject('No canonical capability binding');
  if (new Set(claim.capabilityIds).size !== claim.capabilityIds.length) return reject('Duplicate capability binding');
  let allowed = [...STATUS_ORDER];
  const reasons: string[] = [];
  for (const id of claim.capabilityIds) {
    const matches = capabilities.filter((c) => c.id === id);
    if (matches.length !== 1) return reject(`Unknown or duplicate capability ${id}`);
    const context = Object.hasOwn(contextById, id) ? contextById[id] : undefined;
    if (!context) return reject(`Missing projection context for ${id}`);
    const readiness = capabilityReadiness(matches[0], context);
    allowed = allowed.filter((status) => readiness.allowed.includes(status));
    reasons.push(readiness.reason);
  }
  const permitted = allowed.includes(claim.status);
  // Operational statuses remain distinct: membership, not a rank ceiling, decides permission.
  allowed = allowed.filter((status) => STATUS_ORDER.indexOf(status) <= STATUS_ORDER.indexOf(claim.status));
  return { permitted, allowed, reason: `${permitted ? 'Stored status permitted' : `Stored ${claim.status} exceeds projection`}; ${reasons.join('; ')}` };
}

/** Strict date-only adapter around the existing UTC evidence calendar. */
export function projectionEvidence(records: readonly EvidenceRecord[], today: string, revokedIds: readonly string[] = []): ProjectionContext['evidence'] {
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? instant(value) : null;
  const now = date(today);
  if (now === null || records.length === 0) return 'missing';
  if (records.some((record) => revokedIds.includes(record.id))) return 'revoked';
  const states = records.map((record): ProjectionContext['evidence'] => {
    const produced = date(record.produced);
    if (produced === null || produced > now || !Number.isSafeInteger(record.validFor) || record.validFor <= 0
      || !Number.isFinite(new Date(produced + record.validFor * 86_400_000).getTime())) return 'missing';
    return evidenceState(record, today).state;
  });
  return (['expired', 'missing', 'expiring', 'current'] as const).find((state) => states.includes(state))!;
}

/** Only directly bound records count; repository checks never assert GA or tenant approval. */
export function repositoryProjectionContext(capability: CapabilityDefinition, records: readonly EvidenceRecord[], today: string, claims: readonly Claim[] = []): ProjectionContext {
  const claimIds = claims.filter((claim) => claim.capabilityIds.includes(capability.id)).map((claim) => claim.id);
  const backing = records.filter((record) => record.rows.some((row) => capability.masterRows.includes(row)) || record.claims.some((id) => claimIds.includes(id)));
  return {
    productMaturity: capability.maturity, tenantMaturity: null, activationClass: capability.activationClass,
    evidence: projectionEvidence(backing, today), namedPilot: false, generallyAvailable: false,
    requiresTenantActivation: capability.activationClass !== 'standard' || !capability.safeDefaultEligible,
  };
}
