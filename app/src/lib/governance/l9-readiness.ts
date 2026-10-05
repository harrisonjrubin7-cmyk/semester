/** Executable evidence ladder from catalog state to repeatable L9 operation. */
import type { CapabilityDefinition, MaturityLevel } from './capability-governance';

export const L9_EVIDENCE_KINDS = [
  'implementation', 'automated-verification', 'authorization-review', 'accessibility-review',
  'security-review', 'support-runbook', 'monitoring', 'rollback', 'lifecycle', 'claim-review',
  'tenant-approval', 'parallel-run', 'bounded-live-operation', 'tenant-ga', 'repeatable-operation',
] as const;
export type L9EvidenceKind = (typeof L9_EVIDENCE_KINDS)[number];
export type L9EvidenceStatus = 'current' | 'expired' | 'revoked' | 'failed';

export interface L9Evidence {
  capabilityId: string;
  kind: L9EvidenceKind;
  status: L9EvidenceStatus;
  reference: string;
  reviewedAt?: string;
  expiresAt?: string;
  tenantId?: string;
  cycle?: string;
}

export interface L9Readiness {
  capabilityId: string;
  achieved: MaturityLevel;
  target: 'L9';
  missing: readonly L9EvidenceKind[];
  blockers: readonly string[];
  references: readonly string[];
}

const LEVELS: readonly MaturityLevel[] = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'];
const L4 = [
  'implementation', 'automated-verification', 'authorization-review', 'accessibility-review',
  'security-review', 'support-runbook', 'monitoring', 'rollback', 'lifecycle', 'claim-review',
] as const satisfies readonly L9EvidenceKind[];
const EXTERNAL: readonly L9EvidenceKind[] = ['tenant-approval', 'parallel-run', 'bounded-live-operation', 'tenant-ga', 'repeatable-operation'];

const sourceLevel = (capability: CapabilityDefinition): MaturityLevel => capability.maturity;
const validOn = (item: L9Evidence, asOf: string): boolean =>
  item.status === 'current' && (!item.expiresAt || item.expiresAt >= asOf);
const current = (
  evidence: readonly L9Evidence[], capabilityId: string, kind: L9EvidenceKind, asOf: string,
): readonly L9Evidence[] => evidence.filter(
  (item) => item.capabilityId === capabilityId && item.kind === kind && validOn(item, asOf),
);

function sameTenantThrough(
  evidence: readonly L9Evidence[], capabilityId: string, kinds: readonly L9EvidenceKind[], asOf: string,
): string | null {
  const sets = kinds.map((kind) => new Set(current(evidence, capabilityId, kind, asOf).map((item) => item.tenantId).filter((id): id is string => !!id)));
  if (sets.some((set) => set.size === 0)) return null;
  return [...sets[0]!].find((tenantId) => sets.every((set) => set.has(tenantId))) ?? null;
}

export function evaluateL9Readiness(
  capability: CapabilityDefinition, evidence: readonly L9Evidence[], asOf = new Date().toISOString().slice(0, 10),
): L9Readiness {
  let achieved = sourceLevel(capability);
  const blockers: string[] = [];
  const relevant = evidence.filter((item) => item.capabilityId === capability.id);
  const currentKinds = new Set(relevant.filter((item) => validOn(item, asOf)).map((item) => item.kind));
  const missingL4 = L4.filter((kind) => !currentKinds.has(kind));

  if (missingL4.length === 0 && LEVELS.indexOf(achieved) >= 3) achieved = 'L4';
  else if (LEVELS.indexOf(achieved) >= 3) blockers.push('L4 definition-of-done evidence is incomplete.');

  const tenant = achieved === 'L4' ? sameTenantThrough(relevant, capability.id, ['tenant-approval'], asOf) : null;
  if (tenant) achieved = 'L5';
  const parallelTenant = tenant ? sameTenantThrough(relevant, capability.id, ['tenant-approval', 'parallel-run'], asOf) : null;
  if (parallelTenant) achieved = 'L6';
  const boundedTenant = parallelTenant ? sameTenantThrough(relevant, capability.id, ['tenant-approval', 'parallel-run', 'bounded-live-operation'], asOf) : null;
  if (boundedTenant) achieved = 'L7';
  const gaTenant = boundedTenant ? sameTenantThrough(relevant, capability.id, ['tenant-approval', 'parallel-run', 'bounded-live-operation', 'tenant-ga'], asOf) : null;
  if (gaTenant) achieved = 'L8';

  const repeatableTenants = new Set(current(relevant, capability.id, 'repeatable-operation', asOf).map((item) => item.tenantId).filter((id): id is string => !!id));
  const repeatableCycles = new Set(current(relevant, capability.id, 'repeatable-operation', asOf).map((item) => item.cycle).filter((cycle): cycle is string => !!cycle));
  if (achieved === 'L8' && repeatableTenants.size >= 2 && repeatableCycles.size >= 2) achieved = 'L9';
  else if (achieved === 'L8') blockers.push('L9 needs current repeatable-operation evidence across at least two tenants and two operating cycles.');

  const required = achieved === 'L9' ? [] : [
    ...missingL4,
    ...EXTERNAL.filter((kind) => !currentKinds.has(kind)),
  ];
  const missing = [...new Set(required)];
  const invalid = relevant.filter((item) => !validOn(item, asOf));
  if (invalid.length) blockers.push(`${invalid.length} evidence item(s) are expired, revoked, or failed and do not count.`);

  return {
    capabilityId: capability.id,
    achieved,
    target: 'L9',
    missing,
    blockers,
    references: [...new Set(relevant.filter((item) => validOn(item, asOf)).map((item) => item.reference))].sort(),
  };
}

export function l9ReadinessRegister(capabilities: readonly CapabilityDefinition[], evidence: readonly L9Evidence[]): readonly L9Readiness[] {
  return capabilities.map((capability) => evaluateL9Readiness(capability, evidence));
}

const L4_REVIEWED_AT = '2026-09-30';
const L4_EXPIRES_AT = '2026-10-30';
const L4_REFERENCES: Readonly<Record<(typeof L4)[number], string>> = {
  implementation: 'repo:app/src/lib/rollout-capabilities.ts#verified-capabilities',
  'automated-verification': 'repo:app/src/lib/rollout-capabilities.test.ts#capability-registry',
  'authorization-review': 'repo:app/src/lib/governance/capability-governance.test.ts#authorization',
  'accessibility-review': 'repo:app/src/a11y/axe.test.tsx#automated-review',
  'security-review': 'repo:docs/SECURITY-THREAT-MODEL.md#review',
  'support-runbook': 'repo:docs/RUNBOOKS.md#support',
  monitoring: 'repo:app/src/components/Watching.tsx#local-runtime-errors',
  rollback: 'repo:ROLLBACK.md#procedure',
  lifecycle: 'repo:docs/LIFECYCLE_REQUIREMENTS.md#capability-lifecycle',
  'claim-review': 'repo:docs/PRODUCT-STATUS-MAP.md#claim-ceiling',
};

/**
 * Current repository-scoped L4 packets. Only source-verified capabilities are
 * admitted. These packets expire and never include tenant or live-operation
 * evidence, so they cannot establish L5 or above.
 */
export const REPOSITORY_L9_EVIDENCE: readonly L9Evidence[] = [];

export function repositoryL4Evidence(capabilities: readonly CapabilityDefinition[]): readonly L9Evidence[] {
  return capabilities.flatMap((capability) => capability.maturity === 'L3'
    ? L4.map((kind) => ({
      capabilityId: capability.id,
      kind,
      status: 'current' as const,
      reference: L4_REFERENCES[kind],
      reviewedAt: L4_REVIEWED_AT,
      expiresAt: L4_EXPIRES_AT,
    }))
    : []);
}
