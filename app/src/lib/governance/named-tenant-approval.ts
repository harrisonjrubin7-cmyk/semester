/**
 * Named-tenant L5 approval packets.
 *
 * Repository evidence can prepare and validate a packet, but only an authorized
 * tenant decision can create `tenant-approval` evidence. This module keeps the
 * Vanderbilt candidate explicit without turning a proposal, fixture, campus
 * domain, or founder affiliation into institutional approval.
 */
import { CAPABILITY_DEFINITIONS, type ActivationClass, type CapabilityDefinition } from './capability-governance';
import type { L9Evidence } from './l9-readiness';

export const VANDERBILT_TENANT = {
  id: 'vanderbilt-university',
  displayName: 'Vanderbilt University',
  candidateConfigurationVersion: 'vanderbilt-l5-candidate-1',
  status: 'approval-pending',
} as const;

export const TENANT_APPROVER_ROLES = [
  'tenant-product-owner',
  'tenant-data-steward',
  'tenant-accessibility-owner',
  'tenant-security-owner',
  'tenant-privacy-owner',
  'tenant-executive-owner',
  'tenant-operational-owner',
  'semester-security-owner',
] as const;
export type TenantApproverRole = (typeof TENANT_APPROVER_ROLES)[number];

export const APPROVERS_BY_CLASS: Readonly<Record<ActivationClass, readonly TenantApproverRole[]>> = {
  standard: ['tenant-product-owner'],
  controlled: [
    'tenant-product-owner', 'tenant-data-steward', 'tenant-accessibility-owner',
    'tenant-security-owner', 'semester-security-owner',
  ],
  'high-risk': [
    'tenant-product-owner', 'tenant-data-steward', 'tenant-accessibility-owner',
    'tenant-security-owner', 'tenant-privacy-owner', 'tenant-executive-owner',
    'tenant-operational-owner', 'semester-security-owner',
  ],
};

export interface NamedTenantApprovalPacket {
  tenantId: string;
  tenantName: string;
  capabilityId: string;
  capabilityName: string;
  activationClass: ActivationClass;
  configurationVersion: string;
  requiredApprovers: readonly TenantApproverRole[];
  requiredClaims: string;
  dataRules: CapabilityDefinition['data'];
  accessibility: string;
  fallback: string;
  supportOwner: CapabilityDefinition['supportOwner'];
  lifecycle: string;
  masterRows: readonly string[];
  externalGates: readonly string[];
  status: 'approval-pending';
}

export interface TenantApprovalDecision {
  tenantId: string;
  capabilityId: string;
  configurationVersion: string;
  role: TenantApproverRole;
  subjectRef: string;
  decision: 'approved' | 'rejected' | 'revoked';
  decidedAt: string;
  expiresAt: string;
  artifactRef: string;
}

export interface NamedTenantApprovalResult {
  approved: boolean;
  missingRoles: readonly TenantApproverRole[];
  refusals: readonly string[];
  evidence: L9Evidence | null;
}

const secureReference = (value: string): boolean => /^(trust-room|vault|ticket):\/\/[^\s]+$/.test(value);
const withinPeriod = (decision: TenantApprovalDecision, asOf: string): boolean =>
  decision.decidedAt.slice(0, 10) <= asOf && decision.expiresAt.slice(0, 10) >= asOf;
const currentOn = (decision: TenantApprovalDecision, asOf: string): boolean =>
  decision.decision === 'approved' && withinPeriod(decision, asOf);

export function namedTenantPacket(
  capability: CapabilityDefinition,
  tenant = VANDERBILT_TENANT,
): NamedTenantApprovalPacket {
  return {
    tenantId: tenant.id,
    tenantName: tenant.displayName,
    capabilityId: capability.id,
    capabilityName: capability.name,
    activationClass: capability.activationClass,
    configurationVersion: tenant.candidateConfigurationVersion,
    requiredApprovers: APPROVERS_BY_CLASS[capability.activationClass],
    requiredClaims: capability.requiredClaims,
    dataRules: capability.data,
    accessibility: capability.accessibility,
    fallback: capability.fallback,
    supportOwner: capability.supportOwner,
    lifecycle: capability.lifecycle,
    masterRows: capability.masterRows,
    externalGates: capability.dependencies
      .filter((dependency) => dependency.startsWith('external:'))
      .map((dependency) => dependency.slice('external:'.length)),
    status: 'approval-pending',
  };
}

export const VANDERBILT_L5_PACKETS: readonly NamedTenantApprovalPacket[] =
  CAPABILITY_DEFINITIONS.map((capability) => namedTenantPacket(capability));

/**
 * Decisions remain external input. Empty is honest: no Vanderbilt decision has
 * been supplied to this repository through an authorized evidence channel.
 */
export const VANDERBILT_L5_DECISIONS: readonly TenantApprovalDecision[] = [];

export function evaluateNamedTenantApproval(
  packet: NamedTenantApprovalPacket,
  decisions: readonly TenantApprovalDecision[],
  asOf = new Date().toISOString().slice(0, 10),
): NamedTenantApprovalResult {
  const refusals: string[] = [];
  const relevant = decisions.filter((decision) =>
    decision.tenantId === packet.tenantId && decision.capabilityId === packet.capabilityId,
  );
  const inPeriod = relevant.filter((decision) => withinPeriod(decision, asOf));
  const matchingVersion = inPeriod.filter((decision) => decision.configurationVersion === packet.configurationVersion);

  if (matchingVersion.some((decision) => !secureReference(decision.artifactRef))) {
    refusals.push('Every decision needs a secure evidence reference.');
  }
  if (matchingVersion.some((decision) => decision.decision === 'rejected' || decision.decision === 'revoked')) {
    refusals.push('A current rejection or revocation blocks approval.');
  }

  const valid = matchingVersion.filter((decision) =>
    decision.configurationVersion === packet.configurationVersion && secureReference(decision.artifactRef) && currentOn(decision, asOf),
  );
  const roles = new Set(valid.map((decision) => decision.role));
  const missingRoles = packet.requiredApprovers.filter((role) => !roles.has(role));
  if (missingRoles.length) refusals.push(`Missing required approver roles: ${missingRoles.join(', ')}.`);

  if (packet.activationClass === 'high-risk') {
    const subjects = new Set(valid.map((decision) => decision.subjectRef));
    if (valid.length > 0 && subjects.size < 2) refusals.push('High-risk approval requires at least two distinct approving subjects.');
  }

  const approved = refusals.length === 0 && missingRoles.length === 0;
  const latestExpiry = approved
    ? valid.map((decision) => decision.expiresAt).sort()[0]
    : undefined;
  return {
    approved,
    missingRoles,
    refusals,
    evidence: approved ? {
      capabilityId: packet.capabilityId,
      kind: 'tenant-approval',
      status: 'current',
      reference: `trust-room://named-tenant/${packet.tenantId}/${packet.capabilityId}/${packet.configurationVersion}`,
      reviewedAt: asOf,
      expiresAt: latestExpiry?.slice(0, 10),
      tenantId: packet.tenantId,
    } : null,
  };
}

export function namedTenantL5Evidence(
  packets: readonly NamedTenantApprovalPacket[],
  decisions: readonly TenantApprovalDecision[],
  asOf?: string,
): readonly L9Evidence[] {
  return packets.flatMap((packet) => evaluateNamedTenantApproval(packet, decisions, asOf).evidence ?? []);
}
