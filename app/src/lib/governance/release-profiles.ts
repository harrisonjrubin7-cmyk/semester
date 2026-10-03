/**
 * Release profiles for the two audiences Semester can responsibly serve next.
 *
 * These profiles deliberately separate a repository-verified technical
 * candidate from permission to roll it out. A green repository can make an
 * individual-scale or bounded-pilot candidate. It cannot sign a tenant,
 * appoint an incident owner, approve student data, deploy a SHA, or start a
 * cohort. Those are runtime/activation records and remain required inputs.
 */

import { CAPABILITIES } from '../rollout-capabilities';

export const TECHNICAL_RELEASE_GATES = [
  'build-and-regression',
  'real-account-lifecycle',
  'tenant-isolation-negative-authorization',
  'critical-accessibility-journeys',
  'source-freshness-and-fallback',
  'privacy-export-deletion',
  'observability-and-support',
  'rollback-and-restore-rehearsal',
  'kill-switch-and-degraded-mode',
  'claim-and-scope-review',
] as const;

export type TechnicalReleaseGate = (typeof TECHNICAL_RELEASE_GATES)[number];
export type ReleaseEvidenceStatus = 'current' | 'expired' | 'failed' | 'revoked';

export interface ReleaseTarget {
  environment: 'production' | 'pilot';
  deployedSha: string;
  configurationVersion: string;
  tenantId?: string;
  cohortId?: string;
}

export interface ReleaseEvidence {
  gate: TechnicalReleaseGate | ActivationGate | `dependency:${string}`;
  status: ReleaseEvidenceStatus;
  reference: string;
  checkedAt: string;
  expiresAt: string;
  /** Exact source commit exercised by a technical gate. */
  sourceSha?: string;
  target?: ReleaseTarget;
  /** Named approval functions and distinct subjects represented by the secure decision artifact. */
  approvals?: readonly { role: ReleaseApproverRole; subjectRef: string }[];
}

export const ACTIVATION_GATES = [
  'deployed-exact-sha',
  'production-smoke',
  'support-route-live',
  'rollback-current',
  'kill-switch-clear',
  'named-tenant-agreement',
  'named-data-owner',
  'tenant-accessibility-review',
  'tenant-security-privacy-review',
  'approved-data-scope',
  'pilot-cohort-consent',
  'pilot-support-roster',
  'pilot-outcome-agreed',
] as const;

export type ActivationGate = (typeof ACTIVATION_GATES)[number];
export const RELEASE_APPROVER_ROLES = [
  'product-owner',
  'data-owner',
  'accessibility-owner',
  'security-owner',
  'privacy-owner',
  'support-owner',
  'operations-owner',
  'executive-owner',
  'pilot-champion',
] as const;
export type ReleaseApproverRole = (typeof RELEASE_APPROVER_ROLES)[number];
export type ReleaseProfileId = 'individual-scale' | 'institutional-pilot';

export interface ReleaseProfile {
  id: ReleaseProfileId;
  audience: string;
  capabilityIds: readonly `CAP-${string}`[];
  requiredTechnicalGates: readonly TechnicalReleaseGate[];
  requiredActivationGates: readonly ActivationGate[];
  requiredDependencies: readonly string[];
  defaultOff: boolean;
  allowedOperations: readonly string[];
  forbiddenOperations: readonly string[];
  claimBoundary: string;
  authorizedClaim: string;
  fallback: string;
}

const CORE_INDIVIDUAL_CAPABILITIES = [
  'CAP-001', 'CAP-004', 'CAP-005', 'CAP-006', 'CAP-007', 'CAP-008', 'CAP-009',
  'CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016', 'CAP-017', 'CAP-019',
  'CAP-020', 'CAP-021', 'CAP-022', 'CAP-023', 'CAP-024', 'CAP-025', 'CAP-028',
  'CAP-031', 'CAP-040', 'CAP-044', 'CAP-049', 'CAP-053', 'CAP-054', 'CAP-055',
] as const;

const PILOT_CAPABILITIES = [
  'CAP-001', 'CAP-003', 'CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016',
  'CAP-017', 'CAP-019', 'CAP-020', 'CAP-021', 'CAP-022', 'CAP-023', 'CAP-024',
  'CAP-044', 'CAP-045', 'CAP-050',
] as const;

const SIS_WRITE_AUTHORITY = 'external:approved SIS registration adapter and write authorization';
const SIS_READ_AUTHORITY = 'external:approved read-only SIS registration-readiness adapter';

function unsatisfiedCapabilityDependencies(capabilityIds: readonly `CAP-${string}`[]): string[] {
  const selected = new Set<string>(capabilityIds);
  const byId = new Map<string, (typeof CAPABILITIES)[number]>(
    CAPABILITIES.map((capability) => [capability.id, capability]),
  );
  const required = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const dependency of byId.get(id)?.dependencies ?? []) {
      if (dependency.startsWith('external:')) {
        required.add(dependency);
        continue;
      }
      if (!selected.has(dependency)) required.add(dependency);
      visit(dependency);
    }
  };
  for (const id of capabilityIds) visit(id);
  return [...required].sort();
}

function planningOnlyPilotDependencies(): string[] {
  return unsatisfiedCapabilityDependencies(PILOT_CAPABILITIES)
    .filter((dependency) => dependency !== SIS_WRITE_AUTHORITY)
    .concat(SIS_READ_AUTHORITY)
    .sort();
}

export const RELEASE_PROFILES: Readonly<Record<ReleaseProfileId, ReleaseProfile>> = {
  'individual-scale': {
    id: 'individual-scale',
    audience: 'Individuals using device-first or self-service accounts without institutional activation',
    capabilityIds: CORE_INDIVIDUAL_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: ['deployed-exact-sha', 'production-smoke', 'support-route-live', 'rollback-current', 'kill-switch-clear'],
    requiredDependencies: unsatisfiedCapabilityDependencies(CORE_INDIVIDUAL_CAPABILITIES),
    defaultOff: false,
    allowedOperations: ['personal planning', 'source-aware course organization', 'study and creation', 'export', 'account deletion'],
    forbiddenOperations: ['official registration', 'official grading', 'institutional record writes', 'financial aid', 'payments', 'payroll', 'general ledger'],
    claimBoundary: 'Ready for broad individual use only after exact-SHA deployment and production gates pass; no institutional connection, certification, or system-of-record claim.',
    authorizedClaim: 'Authorized for broad individual use on the evaluated production target; no institutional connection, certification, or system-of-record claim.',
    fallback: 'Continue device-first use, preserve export, and disable unavailable cloud or provider-dependent surfaces.',
  },
  'institutional-pilot': {
    id: 'institutional-pilot',
    audience: 'A named, bounded student cohort using Path and registration-readiness planning',
    capabilityIds: PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: ACTIVATION_GATES,
    requiredDependencies: planningOnlyPilotDependencies(),
    defaultOff: true,
    allowedOperations: ['Path planning', 'term planning', 'schedule comparison', 'conflict validation', 'advisor agenda', 'official-system handoff'],
    forbiddenOperations: ['enroll', 'waitlist', 'drop', 'withdraw', 'write to SIS', 'certify degree progress', 'act as system of record'],
    claimBoundary: 'Technically prepared for a controlled pilot; activation still requires the named tenant, cohort, data scope, reviews, support roster, agreed outcomes and exit criteria, deployment, and approval records.',
    authorizedClaim: 'Authorized only for the evaluated named tenant, cohort, deployment, configuration, and planning-only pilot scope.',
    fallback: 'Disable the pilot entitlement and all institutional reads; retain device-first planning and links to official systems.',
  },
};

/** Repository evidence establishes only the technical half of either profile. */
export const REPOSITORY_RELEASE_EVIDENCE: readonly ReleaseEvidence[] = [
  { gate: 'build-and-regression', status: 'current', reference: 'repo:.github/workflows/ci.yml', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'real-account-lifecycle', status: 'current', reference: 'repo:app/scripts/account-sync.mjs', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'tenant-isolation-negative-authorization', status: 'current', reference: 'repo:supabase/rls-coverage.check.sql', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'critical-accessibility-journeys', status: 'current', reference: 'repo:app/scripts/accessibility-smoke.mjs', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'source-freshness-and-fallback', status: 'current', reference: 'repo:app/src/lib/integration/quality.test.ts', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'privacy-export-deletion', status: 'current', reference: 'repo:supabase/deletion.check.sql', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'observability-and-support', status: 'current', reference: 'repo:docs/RUNBOOKS.md', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'rollback-and-restore-rehearsal', status: 'current', reference: 'repo:supabase/restore.sh', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'kill-switch-and-degraded-mode', status: 'current', reference: 'repo:app/scripts/killswitch-drill.mjs', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
  { gate: 'claim-and-scope-review', status: 'current', reference: 'repo:docs/PRODUCT-STATUS-MAP.md', checkedAt: '2026-10-02', expiresAt: '2026-11-01' },
];

export interface ReleaseProfileDecision {
  profileId: ReleaseProfileId;
  technicalStatus: 'ready' | 'not-ready';
  rolloutStatus: 'authorized' | 'held';
  missingTechnical: readonly TechnicalReleaseGate[];
  missingActivation: readonly ActivationGate[];
  missingDependencies: readonly string[];
  targetBound: boolean;
  claim: string;
}

function sameTarget(actual: ReleaseTarget | undefined, expected: ReleaseTarget): boolean {
  return Boolean(actual
    && actual.environment === expected.environment
    && actual.deployedSha === expected.deployedSha
    && actual.configurationVersion === expected.configurationVersion
    && actual.tenantId === expected.tenantId
    && actual.cohortId === expected.cohortId);
}

const SHA = /^[0-9a-f]{40}$/i;
const SECURE_REFERENCE = /^(trust-room|vault|ticket):\/\/[^\s]+$/;
const APPROVERS_BY_GATE: Readonly<Record<ActivationGate, readonly ReleaseApproverRole[]>> = {
  'deployed-exact-sha': ['operations-owner', 'security-owner'],
  'production-smoke': ['operations-owner'],
  'support-route-live': ['support-owner'],
  'rollback-current': ['operations-owner', 'security-owner'],
  'kill-switch-clear': ['operations-owner', 'security-owner'],
  'named-tenant-agreement': ['executive-owner', 'security-owner'],
  'named-data-owner': ['data-owner'],
  'tenant-accessibility-review': ['accessibility-owner'],
  'tenant-security-privacy-review': ['security-owner', 'privacy-owner'],
  'approved-data-scope': ['data-owner', 'privacy-owner'],
  'pilot-cohort-consent': ['privacy-owner'],
  'pilot-support-roster': ['support-owner', 'operations-owner'],
  'pilot-outcome-agreed': ['pilot-champion', 'product-owner'],
};

function hasApprovalProvenance(item: ReleaseEvidence): boolean {
  if ((TECHNICAL_RELEASE_GATES as readonly string[]).includes(item.gate)) return item.reference.trim().length > 0;
  if (!SECURE_REFERENCE.test(item.reference)) return false;
  const required = item.gate.startsWith('dependency:')
    ? ['product-owner', 'security-owner'] as const
    : APPROVERS_BY_GATE[item.gate as ActivationGate];
  const approvals = item.approvals ?? [];
  if (approvals.some((approval) => approval.subjectRef.trim().length === 0)) return false;
  const requiredSet = new Set<ReleaseApproverRole>(required);
  const supplied = new Set(approvals.map((approval) => approval.role));
  const subjects = new Set(approvals
    .filter((approval) => requiredSet.has(approval.role))
    .map((approval) => approval.subjectRef.trim()));
  return required.every((role) => supplied.has(role)) && subjects.size >= required.length;
}

/** Parse date-only or UTC ISO evidence without relying on string ordering. */
function evidenceTime(value: string, endOfDate = false): number | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const stamp = Date.parse(`${value}T${endOfDate ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
  }
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/);
  if (!match) return null;
  const stamp = Date.parse(value);
  const normalized = `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`;
  return Number.isFinite(stamp) && new Date(stamp).toISOString() === normalized ? stamp : null;
}

function counts(
  evidence: readonly ReleaseEvidence[],
  gate: ReleaseEvidence['gate'],
  asOf: string,
  target?: ReleaseTarget,
  sourceSha?: string,
): boolean {
  const decisionTime = evidenceTime(asOf, true);
  if (decisionTime === null) return false;
  const matching = evidence
    .filter((item) => item.gate === gate
      && (!target || sameTarget(item.target, target))
      && (!sourceSha || (SHA.test(item.sourceSha ?? '') && item.sourceSha === sourceSha)))
    .map((item) => ({ item, checked: evidenceTime(item.checkedAt), expires: evidenceTime(item.expiresAt, true) }));
  if (matching.some(({ checked }) => checked === null)) return false;
  const eligible = matching
    .filter(({ checked }) => checked !== null && checked <= decisionTime)
    .sort((a, b) => (b.checked ?? 0) - (a.checked ?? 0));
  if (eligible.length === 0) return false;
  const latestDate = eligible[0].checked;
  const latest = eligible.filter(({ checked }) => checked === latestDate);
  return latest.every(({ item, expires }) => item.status === 'current'
    && hasApprovalProvenance(item)
    && (expires ?? -1) >= decisionTime);
}

export function evaluateReleaseProfile(
  profile: ReleaseProfile,
  evidence: readonly ReleaseEvidence[],
  asOf = new Date().toISOString(),
  target?: ReleaseTarget,
): ReleaseProfileDecision {
  const expectedEnvironment = profile.id === 'individual-scale' ? 'production' : 'pilot';
  const targetBound = Boolean(target
    && target.environment === expectedEnvironment
    && SHA.test(target.deployedSha)
    && target.deployedSha.trim()
    && target.configurationVersion.trim()
    && (profile.id === 'institutional-pilot'
      ? (target.tenantId?.trim() && target.cohortId?.trim())
      : target.tenantId === undefined && target.cohortId === undefined));
  const technicalTargetBound = Boolean(target && SHA.test(target.deployedSha));
  const missingTechnical = profile.requiredTechnicalGates.filter((gate) => !technicalTargetBound
    || !counts(evidence, gate, asOf, undefined, target?.deployedSha));
  const missingActivation = profile.requiredActivationGates.filter((gate) => !targetBound || !counts(evidence, gate, asOf, target));
  const missingDependencies = profile.requiredDependencies.filter((dependency) => !targetBound
    || !counts(evidence, `dependency:${dependency}`, asOf, target));
  const technicalStatus = missingTechnical.length === 0 ? 'ready' : 'not-ready';
  const rolloutStatus = technicalStatus === 'ready'
    && targetBound
    && missingActivation.length === 0
    && missingDependencies.length === 0
    ? 'authorized'
    : 'held';
  return {
    profileId: profile.id,
    technicalStatus,
    rolloutStatus,
    missingTechnical,
    missingActivation,
    missingDependencies,
    targetBound,
    claim: rolloutStatus === 'authorized'
      ? profile.authorizedClaim
      : technicalStatus === 'ready'
        ? `Technical release candidate; rollout is held pending: ${[
          ...(targetBound ? [] : ['a complete deployment target']),
          ...missingActivation,
          ...missingDependencies.map((item) => `dependency:${item}`),
        ].join(', ')}.`
        : `Not technically ready; missing: ${missingTechnical.join(', ')}.`,
  };
}
