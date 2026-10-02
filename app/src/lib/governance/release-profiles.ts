/**
 * Release profiles for the two audiences Semester can responsibly serve next.
 *
 * These profiles deliberately separate a repository-verified technical
 * candidate from permission to roll it out. A green repository can make an
 * individual-scale or bounded-pilot candidate. It cannot sign a tenant,
 * appoint an incident owner, approve student data, deploy a SHA, or start a
 * cohort. Those are runtime/activation records and remain required inputs.
 */

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

export interface ReleaseEvidence {
  gate: TechnicalReleaseGate | ActivationGate;
  status: ReleaseEvidenceStatus;
  reference: string;
  checkedAt: string;
  expiresAt?: string;
}

export const ACTIVATION_GATES = [
  'deployed-exact-sha',
  'production-smoke',
  'support-route-live',
  'rollback-current',
  'named-tenant-agreement',
  'named-data-owner',
  'tenant-accessibility-review',
  'tenant-security-privacy-review',
  'pilot-cohort-consent',
  'pilot-support-roster',
] as const;

export type ActivationGate = (typeof ACTIVATION_GATES)[number];
export type ReleaseProfileId = 'individual-scale' | 'institutional-pilot';

export interface ReleaseProfile {
  id: ReleaseProfileId;
  audience: string;
  capabilityIds: readonly `CAP-${string}`[];
  requiredTechnicalGates: readonly TechnicalReleaseGate[];
  requiredActivationGates: readonly ActivationGate[];
  defaultOff: boolean;
  allowedOperations: readonly string[];
  forbiddenOperations: readonly string[];
  claimBoundary: string;
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

export const RELEASE_PROFILES: Readonly<Record<ReleaseProfileId, ReleaseProfile>> = {
  'individual-scale': {
    id: 'individual-scale',
    audience: 'Individuals using device-first or self-service accounts without institutional activation',
    capabilityIds: CORE_INDIVIDUAL_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: ['deployed-exact-sha', 'production-smoke', 'support-route-live', 'rollback-current'],
    defaultOff: false,
    allowedOperations: ['personal planning', 'source-aware course organization', 'study and creation', 'export', 'account deletion'],
    forbiddenOperations: ['official registration', 'official grading', 'institutional record writes', 'financial aid', 'payments', 'payroll', 'general ledger'],
    claimBoundary: 'Ready for broad individual use only after exact-SHA deployment and production gates pass; no institutional connection, certification, or system-of-record claim.',
    fallback: 'Continue device-first use, preserve export, and disable unavailable cloud or provider-dependent surfaces.',
  },
  'institutional-pilot': {
    id: 'institutional-pilot',
    audience: 'A named, bounded student cohort using Path and registration-readiness planning',
    capabilityIds: PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: ACTIVATION_GATES,
    defaultOff: true,
    allowedOperations: ['Path planning', 'term planning', 'schedule comparison', 'conflict validation', 'advisor agenda', 'official-system handoff'],
    forbiddenOperations: ['enroll', 'waitlist', 'drop', 'withdraw', 'write to SIS', 'certify degree progress', 'act as system of record'],
    claimBoundary: 'Technically prepared for a controlled pilot; activation still requires the named tenant, cohort, data scope, reviews, support roster, deployment, and approval records.',
    fallback: 'Disable the pilot entitlement and all institutional reads; retain device-first planning and links to official systems.',
  },
};

/** Repository evidence establishes only the technical half of either profile. */
export const REPOSITORY_RELEASE_EVIDENCE: readonly ReleaseEvidence[] = [
  { gate: 'build-and-regression', status: 'current', reference: 'repo:.github/workflows/ci.yml', checkedAt: '2026-10-02' },
  { gate: 'real-account-lifecycle', status: 'current', reference: 'repo:app/scripts/account-sync.mjs', checkedAt: '2026-10-02' },
  { gate: 'tenant-isolation-negative-authorization', status: 'current', reference: 'repo:supabase/rls-coverage.check.sql', checkedAt: '2026-10-02' },
  { gate: 'critical-accessibility-journeys', status: 'current', reference: 'repo:app/scripts/accessibility-smoke.mjs', checkedAt: '2026-10-02' },
  { gate: 'source-freshness-and-fallback', status: 'current', reference: 'repo:app/src/lib/integration/quality.test.ts', checkedAt: '2026-10-02' },
  { gate: 'privacy-export-deletion', status: 'current', reference: 'repo:supabase/deletion.check.sql', checkedAt: '2026-10-02' },
  { gate: 'observability-and-support', status: 'current', reference: 'repo:docs/RUNBOOKS.md', checkedAt: '2026-10-02' },
  { gate: 'rollback-and-restore-rehearsal', status: 'current', reference: 'repo:supabase/restore.sh', checkedAt: '2026-10-02' },
  { gate: 'kill-switch-and-degraded-mode', status: 'current', reference: 'repo:app/scripts/killswitch-drill.mjs', checkedAt: '2026-10-02' },
  { gate: 'claim-and-scope-review', status: 'current', reference: 'repo:docs/PRODUCT-STATUS-MAP.md', checkedAt: '2026-10-02' },
];

export interface ReleaseProfileDecision {
  profileId: ReleaseProfileId;
  technicalStatus: 'ready' | 'not-ready';
  rolloutStatus: 'authorized' | 'held';
  missingTechnical: readonly TechnicalReleaseGate[];
  missingActivation: readonly ActivationGate[];
  claim: string;
}

function counts(evidence: readonly ReleaseEvidence[], gate: ReleaseEvidence['gate'], asOf: string): boolean {
  return evidence.some((item) => item.gate === gate && item.status === 'current' && (!item.expiresAt || item.expiresAt >= asOf));
}

export function evaluateReleaseProfile(
  profile: ReleaseProfile,
  evidence: readonly ReleaseEvidence[],
  asOf = new Date().toISOString().slice(0, 10),
): ReleaseProfileDecision {
  const missingTechnical = profile.requiredTechnicalGates.filter((gate) => !counts(evidence, gate, asOf));
  const missingActivation = profile.requiredActivationGates.filter((gate) => !counts(evidence, gate, asOf));
  const technicalStatus = missingTechnical.length === 0 ? 'ready' : 'not-ready';
  const rolloutStatus = technicalStatus === 'ready' && missingActivation.length === 0 ? 'authorized' : 'held';
  return {
    profileId: profile.id,
    technicalStatus,
    rolloutStatus,
    missingTechnical,
    missingActivation,
    claim: rolloutStatus === 'authorized'
      ? profile.claimBoundary
      : technicalStatus === 'ready'
        ? `Technical release candidate; rollout is held pending: ${missingActivation.join(', ')}.`
        : `Not technically ready; missing: ${missingTechnical.join(', ')}.`,
  };
}
