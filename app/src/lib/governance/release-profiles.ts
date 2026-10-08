/**
 * Release profiles for the individual audience and two bounded institutional
 * data modes Semester can responsibly evaluate next.
 *
 * These profiles deliberately separate a repository-verified technical
 * candidate from permission to roll it out. A green repository can make an
 * individual-scale or bounded-pilot candidate. It cannot sign a tenant,
 * appoint an incident owner, approve student data, deploy a SHA, or start a
 * cohort. Those are runtime/activation records and remain required inputs.
 */

import { CAPABILITIES } from '../rollout-capabilities';
import { decide, type Condition, type LaunchState, type Verdict } from '../launchreadiness';

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
  /** Manual and connected institutional evidence must never authorize each other. */
  dataMode?: 'manual' | 'connected';
  /** Registration submission policy for this exact configuration. Pilots require disabled. */
  registrationWriteback?: 'disabled' | 'sandbox' | 'production';
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
  /** Complete input retained so the canonical launch-readiness verdict can be re-derived. */
  launchState?: LaunchState;
  /** Non-institutional decision for one named unpaid validation cohort. */
  validationDecision?: {
    verdict: 'go' | 'go-with-conditions' | 'no-go';
    on: string;
    conditions: readonly Condition[];
  };
}

export const BASE_ACTIVATION_GATES = [
  'deployed-exact-sha',
  'production-smoke',
  'support-route-live',
  'rollback-current',
  'kill-switch-clear',
] as const;

export const VALIDATION_ACTIVATION_GATES = [
  ...BASE_ACTIVATION_GATES,
  'participant-terms-and-consent',
  'qualified-legal-public-policy-approval',
  'representative-user-acceptance',
  'target-account-lifecycle-acceptance',
  'validation-support-roster',
  'validation-outcome-agreed',
  'qualified-accessibility-conformance',
  'validation-launch-decision',
] as const;

export const PILOT_ACTIVATION_GATES = [
  ...BASE_ACTIVATION_GATES,
  'named-tenant-agreement',
  'named-data-owner',
  'tenant-accessibility-review',
  'tenant-security-privacy-review',
  'approved-data-scope',
  'pilot-cohort-consent',
  'pilot-support-roster',
  'pilot-outcome-agreed',
  'canonical-launch-decision',
] as const;

export const COMMERCIAL_ACTIVATION_GATES = [
  'design-partner-activation-and-measured-closeout',
  'counsel-approved-commercial-paper',
  'pricing-and-signing-authority',
  'tax-accounting-and-payment-controls',
  'insurance-decision-current',
  'customer-purchase-and-billing-authorization',
] as const;

export const PAID_ASSURANCE_GATES = [
  'target-dast-clean-rescan',
  'independent-security-assurance',
  'qualified-accessibility-conformance',
  'target-restore-rehearsal',
  'target-incident-alert-drill',
  'target-data-rights-rehearsal',
  'target-access-revocation-rehearsal',
  'target-offboarding-rehearsal',
  'production-provider-approval',
] as const;

export const ENTERPRISE_ACTIVATION_GATES = [
  'broad-enterprise-sale-decision',
  'repeatable-multi-customer-deployments',
  'capacity-and-error-budget-accepted',
  'reference-and-claims-permission',
] as const;

export const BROAD_INDIVIDUAL_ACTIVATION_GATES = [
  'broad-individual-rollout-approval',
] as const;

export const ACTIVATION_GATES = [
  ...new Set([
    ...VALIDATION_ACTIVATION_GATES,
    ...PILOT_ACTIVATION_GATES,
    ...COMMERCIAL_ACTIVATION_GATES,
    ...PAID_ASSURANCE_GATES,
    ...ENTERPRISE_ACTIVATION_GATES,
    ...BROAD_INDIVIDUAL_ACTIVATION_GATES,
  ]),
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
  'engineering-owner',
  'trust-owner',
  'finance-owner',
  'legal-owner',
  'participant-representative',
] as const;
export type ReleaseApproverRole = (typeof RELEASE_APPROVER_ROLES)[number];
export type ReleaseProfileId =
  | 'individual-scale'
  | 'invitation-only-individual-validation'
  | 'institutional-manual-pilot'
  | 'institutional-pilot'
  | 'paid-institutional-manual-pilot'
  | 'paid-institutional-pilot'
  | 'broad-enterprise-sale';
type ReleasePrerequisiteProfileId = 'invitation-only-individual-validation';

type ReleaseTargetKind = 'public-individual' | 'invitation-validation' | 'manual-pilot' | 'connected-pilot' | 'enterprise';

interface ReleaseApproval {
  role: ReleaseApproverRole;
  subjectRef: string;
}

function isReleaseEvidence(value: unknown): value is ReleaseEvidence {
  return Boolean(value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as Partial<ReleaseEvidence>).gate === 'string');
}

export interface ReleaseProfile {
  readonly id: ReleaseProfileId;
  readonly audience: string;
  readonly targetKind: ReleaseTargetKind;
  readonly capabilityIds: readonly `CAP-${string}`[];
  readonly requiredTechnicalGates: readonly TechnicalReleaseGate[];
  readonly requiredActivationGates: readonly ActivationGate[];
  readonly requiredDependencies: readonly string[];
  readonly requiredPrerequisiteProfiles: readonly ReleasePrerequisiteProfileId[];
  readonly defaultOff: boolean;
  readonly allowedOperations: readonly string[];
  readonly forbiddenOperations: readonly string[];
  readonly claimBoundary: string;
  readonly authorizedClaim: string;
  readonly fallback: string;
}

const CORE_INDIVIDUAL_CAPABILITIES = [
  'CAP-001', 'CAP-004', 'CAP-005', 'CAP-006', 'CAP-007', 'CAP-008', 'CAP-009',
  'CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016', 'CAP-017',
  'CAP-020', 'CAP-021', 'CAP-022', 'CAP-023', 'CAP-024', 'CAP-025', 'CAP-028',
  'CAP-031', 'CAP-040', 'CAP-049', 'CAP-053', 'CAP-054', 'CAP-055',
] as const;

const PILOT_CAPABILITIES = [
  'CAP-001', 'CAP-003', 'CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016',
  'CAP-017', 'CAP-019', 'CAP-020', 'CAP-021', 'CAP-022', 'CAP-023', 'CAP-024',
  'CAP-044', 'CAP-045', 'CAP-050',
] as const;

const MANUAL_PILOT_CAPABILITIES = [
  'CAP-001', 'CAP-003', 'CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016',
  'CAP-017', 'CAP-020', 'CAP-021', 'CAP-022', 'CAP-023', 'CAP-024',
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

function freezeProfile(profile: ReleaseProfile): ReleaseProfile {
  Object.freeze(profile.capabilityIds);
  Object.freeze(profile.requiredTechnicalGates);
  Object.freeze(profile.requiredActivationGates);
  Object.freeze(profile.requiredDependencies);
  Object.freeze(profile.requiredPrerequisiteProfiles);
  Object.freeze(profile.allowedOperations);
  Object.freeze(profile.forbiddenOperations);
  return Object.freeze(profile);
}

export const RELEASE_PROFILES: Readonly<Record<ReleaseProfileId, ReleaseProfile>> = Object.freeze({
  'individual-scale': freezeProfile({
    id: 'individual-scale',
    audience: 'Individuals using device-first or self-service accounts without institutional activation',
    targetKind: 'public-individual',
    capabilityIds: CORE_INDIVIDUAL_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: [
      ...BASE_ACTIVATION_GATES,
      ...BROAD_INDIVIDUAL_ACTIVATION_GATES,
    ],
    requiredDependencies: [],
    requiredPrerequisiteProfiles: ['invitation-only-individual-validation'],
    defaultOff: true,
    allowedOperations: ['personal planning', 'source-aware course organization', 'study and creation', 'export', 'account deletion'],
    forbiddenOperations: ['official registration', 'official grading', 'institutional record writes', 'financial aid', 'payments', 'payroll', 'general ledger'],
    claimBoundary: 'Broad individual rollout remains held until the invitation-validation controls and a separate broad-rollout approval are current; no institutional connection, certification, or system-of-record claim.',
    authorizedClaim: 'Authorized for broad individual use on the evaluated production target; no institutional connection, certification, or system-of-record claim.',
    fallback: 'Continue device-first use, preserve export, and disable unavailable cloud or provider-dependent surfaces.',
  }),
  'invitation-only-individual-validation': freezeProfile({
    id: 'invitation-only-individual-validation',
    audience: 'A named, invitation-only cohort using Semester without payment or institutional activation',
    targetKind: 'invitation-validation',
    capabilityIds: CORE_INDIVIDUAL_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: VALIDATION_ACTIVATION_GATES,
    requiredDependencies: unsatisfiedCapabilityDependencies(CORE_INDIVIDUAL_CAPABILITIES),
    requiredPrerequisiteProfiles: [],
    defaultOff: true,
    allowedOperations: ['invitation-only unpaid validation', 'personal planning', 'source-aware course organization', 'export', 'account deletion'],
    forbiddenOperations: ['paid promotion', 'official registration', 'institutional data access', 'institutional record writes', 'outcome claims', 'act as a staffed institutional service'],
    claimBoundary: 'Conditional candidate for one named, invitation-only unpaid cohort; authorization requires participant terms, support, outcome, production, and launch-decision evidence bound to that cohort.',
    authorizedClaim: 'Authorized only for the evaluated invitation-only unpaid cohort, deployment, configuration, disclosed conditions, and non-institutional validation scope.',
    fallback: 'Close invitations, preserve participant export and deletion, and return to internal validation.',
  }),
  'institutional-manual-pilot': freezeProfile({
    id: 'institutional-manual-pilot',
    audience: 'A named, bounded student cohort using student-confirmed manual course data without institutional connections',
    targetKind: 'manual-pilot',
    capabilityIds: MANUAL_PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: PILOT_ACTIVATION_GATES,
    requiredDependencies: unsatisfiedCapabilityDependencies(MANUAL_PILOT_CAPABILITIES),
    requiredPrerequisiteProfiles: [],
    defaultOff: true,
    allowedOperations: ['student-confirmed manual import', 'manual course and deadline correction', 'personal planning', 'export', 'account deletion'],
    forbiddenOperations: [
      'institutional reads', 'institutional writes', 'SSO or provisioning claims', 'official registration',
      'official grading', 'degree certification', 'financial aid', 'payments', 'act as system of record',
    ],
    claimBoundary: 'Technically prepared for a manual-data pilot only; this release-evidence profile does not enforce runtime entitlements on shared Account, Courses, or Import surfaces and does not prove any institutional connection.',
    authorizedClaim: 'Authorized only for the evaluated named tenant, cohort, deployment, configuration, and student-confirmed manual-data scope; no institutional connection or system-of-record claim.',
    fallback: 'Disable the pilot entitlement, retain device-first planning and export, and direct users to official systems.',
  }),
  'institutional-pilot': freezeProfile({
    id: 'institutional-pilot',
    audience: 'A named, bounded student cohort using Path and registration-readiness planning',
    targetKind: 'connected-pilot',
    capabilityIds: PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: PILOT_ACTIVATION_GATES,
    requiredDependencies: planningOnlyPilotDependencies(),
    requiredPrerequisiteProfiles: [],
    defaultOff: true,
    allowedOperations: ['Path planning', 'term planning', 'schedule comparison', 'conflict validation', 'advisor agenda', 'official-system handoff'],
    forbiddenOperations: ['enroll', 'waitlist', 'drop', 'withdraw', 'write to SIS', 'certify degree progress', 'act as system of record'],
    claimBoundary: 'Technically prepared for a controlled pilot; activation still requires the named tenant, cohort, data scope, reviews, support roster, agreed outcomes and exit criteria, deployment, and approval records.',
    authorizedClaim: 'Authorized only for the evaluated named tenant, cohort, deployment, configuration, and planning-only pilot scope.',
    fallback: 'Disable the pilot entitlement and all institutional reads; retain device-first planning and links to official systems.',
  }),
  'paid-institutional-manual-pilot': freezeProfile({
    id: 'paid-institutional-manual-pilot',
    audience: 'One named institution and cohort purchasing a bounded pilot using student-confirmed manual course data',
    targetKind: 'manual-pilot',
    capabilityIds: MANUAL_PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: [...PILOT_ACTIVATION_GATES, ...COMMERCIAL_ACTIVATION_GATES, ...PAID_ASSURANCE_GATES],
    requiredDependencies: unsatisfiedCapabilityDependencies(MANUAL_PILOT_CAPABILITIES),
    requiredPrerequisiteProfiles: [],
    defaultOff: true,
    allowedOperations: ['contracted manual-data pilot', 'student-confirmed manual import', 'manual course and deadline correction', 'personal planning', 'export', 'account deletion', 'authorized billing'],
    forbiddenOperations: [
      'unapproved charge', 'institutional reads', 'institutional writes', 'SSO or provisioning claims',
      'official registration', 'official grading', 'degree certification', 'act as system of record',
    ],
    claimBoundary: 'Commercially authorizable only for a manual-data pilot after the complete bounded-pilot package, independent security and accessibility assurance, and commercial authority are current for the named target; no institutional connection is implied.',
    authorizedClaim: 'Authorized only for the evaluated paid manual-data pilot with the named institution, cohort, deployment, configuration, executed scope, and billing authority; no institutional connection or system-of-record claim.',
    fallback: 'Stop billing and activation, disable the pilot entitlement, preserve required exports, and execute the contracted offboarding path.',
  }),
  'paid-institutional-pilot': freezeProfile({
    id: 'paid-institutional-pilot',
    audience: 'One named institution and cohort purchasing a bounded planning-only pilot',
    targetKind: 'connected-pilot',
    capabilityIds: PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: [...PILOT_ACTIVATION_GATES, ...COMMERCIAL_ACTIVATION_GATES, ...PAID_ASSURANCE_GATES],
    requiredDependencies: planningOnlyPilotDependencies(),
    requiredPrerequisiteProfiles: [],
    defaultOff: true,
    allowedOperations: ['contracted planning-only pilot', 'term planning', 'schedule comparison', 'conflict validation', 'advisor agenda', 'official-system handoff', 'authorized billing'],
    forbiddenOperations: ['unapproved charge', 'enroll', 'waitlist', 'drop', 'withdraw', 'write to SIS', 'certify degree progress', 'act as system of record'],
    claimBoundary: 'Commercially authorizable only after the complete bounded-pilot package, independent security and accessibility assurance, and counsel, signing, price, tax, accounting, payment, insurance, customer-purchase, and billing evidence are current for the named target.',
    authorizedClaim: 'Authorized only for the evaluated paid, planning-only pilot with the named institution, cohort, deployment, configuration, executed scope, and billing authority.',
    fallback: 'Stop billing and activation, disable the tenant entitlement and institutional reads, preserve required exports, and execute the contracted offboarding path.',
  }),
  'broad-enterprise-sale': freezeProfile({
    id: 'broad-enterprise-sale',
    audience: 'Enterprise institutions purchasing the evaluated, repeatable planning-only deployment scope',
    targetKind: 'enterprise',
    capabilityIds: PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: [
      ...PILOT_ACTIVATION_GATES,
      ...COMMERCIAL_ACTIVATION_GATES,
      ...PAID_ASSURANCE_GATES,
      ...ENTERPRISE_ACTIVATION_GATES,
    ],
    requiredDependencies: planningOnlyPilotDependencies(),
    requiredPrerequisiteProfiles: [],
    defaultOff: true,
    allowedOperations: ['contracted enterprise planning deployment', 'repeatable implementation', 'term planning', 'schedule comparison', 'conflict validation', 'advisor agenda', 'official-system handoff', 'authorized billing'],
    forbiddenOperations: ['unapproved charge', 'enroll', 'waitlist', 'drop', 'withdraw', 'write to SIS', 'certify degree progress', 'replace the SIS or LMS', 'act as system of record'],
    claimBoundary: 'Enterprise sale is authorizable only for the evaluated scope after paid-pilot controls, repeated deployments, capacity evidence, independent security and accessibility assurance, and claim-specific customer permission are current.',
    authorizedClaim: 'Authorized for enterprise contracting and rollout only within the evaluated planning scope and evidence-backed claims; no system-replacement or system-of-record authority.',
    fallback: 'Suspend new sales and rollout, stop affected billing and activation, disable target entitlements, preserve exports, and execute customer-specific rollback and offboarding.',
  }),
});

/** Repository evidence establishes only the technical half of a profile. */
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
  /** Exact deployment, tenant, cohort and configuration evaluated. */
  target: Readonly<ReleaseTarget> | null;
  technicalStatus: 'ready' | 'not-ready';
  rolloutStatus: 'authorized' | 'held';
  missingTechnical: readonly TechnicalReleaseGate[];
  missingActivation: readonly ActivationGate[];
  missingDependencies: readonly string[];
  missingPrerequisites: readonly ReleasePrerequisiteProfileId[];
  targetBound: boolean;
  launchVerdict: 'not-applicable' | 'go' | 'go-with-conditions' | null;
  launchConditions: readonly Condition[];
  claim: string;
}

export function sameReleaseTarget(actual: Readonly<ReleaseTarget> | null | undefined, expected: ReleaseTarget): boolean {
  return Boolean(actual
    && actual.environment === expected.environment
    && actual.deployedSha === expected.deployedSha
    && actual.configurationVersion === expected.configurationVersion
    && actual.tenantId === expected.tenantId
    && actual.cohortId === expected.cohortId
    && actual.dataMode === expected.dataMode
    && actual.registrationWriteback === expected.registrationWriteback);
}

const SHA = /^[0-9a-f]{40}$/;
const SECURE_REFERENCE = /^(trust-room|vault|ticket):\/\/[^\s]+$/;
const TECHNICAL_REFERENCE = /^github-actions:\/\/harrisonjrubin7-cmyk\/semester\/runs\/([1-9]\d*)\/gates\/([a-z-]+)\?sha=([0-9a-f]{40})$/;
const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const APPROVERS_BY_GATE: Readonly<Record<ActivationGate, readonly ReleaseApproverRole[]>> = {
  'deployed-exact-sha': ['operations-owner', 'security-owner'],
  'production-smoke': ['operations-owner'],
  'support-route-live': ['support-owner'],
  'rollback-current': ['operations-owner', 'security-owner'],
  'kill-switch-clear': ['operations-owner', 'security-owner'],
  'participant-terms-and-consent': ['privacy-owner', 'product-owner'],
  'qualified-legal-public-policy-approval': ['legal-owner', 'privacy-owner'],
  'representative-user-acceptance': ['participant-representative', 'product-owner'],
  'target-account-lifecycle-acceptance': ['participant-representative', 'privacy-owner', 'operations-owner'],
  'validation-support-roster': ['support-owner', 'operations-owner'],
  'validation-outcome-agreed': ['product-owner', 'trust-owner'],
  'validation-launch-decision': [
    'executive-owner', 'product-owner', 'security-owner', 'privacy-owner',
    'accessibility-owner', 'support-owner', 'operations-owner', 'trust-owner',
  ],
  'named-tenant-agreement': ['executive-owner', 'security-owner'],
  'named-data-owner': ['data-owner'],
  'tenant-accessibility-review': ['accessibility-owner'],
  'tenant-security-privacy-review': ['security-owner', 'privacy-owner'],
  'approved-data-scope': ['data-owner', 'privacy-owner'],
  'pilot-cohort-consent': ['privacy-owner'],
  'pilot-support-roster': ['support-owner', 'operations-owner'],
  'pilot-outcome-agreed': ['pilot-champion', 'product-owner'],
  'canonical-launch-decision': [
    'executive-owner', 'product-owner', 'engineering-owner', 'security-owner',
    'privacy-owner', 'accessibility-owner', 'support-owner', 'trust-owner',
    'data-owner', 'finance-owner', 'operations-owner', 'pilot-champion',
  ],
  'design-partner-activation-and-measured-closeout': [
    'pilot-champion', 'product-owner', 'trust-owner', 'finance-owner',
  ],
  'broad-individual-rollout-approval': [
    'executive-owner', 'legal-owner', 'product-owner', 'security-owner',
    'privacy-owner', 'accessibility-owner', 'support-owner', 'operations-owner',
  ],
  'counsel-approved-commercial-paper': ['executive-owner', 'legal-owner', 'privacy-owner'],
  'pricing-and-signing-authority': ['executive-owner', 'finance-owner'],
  'tax-accounting-and-payment-controls': ['finance-owner', 'operations-owner'],
  'insurance-decision-current': ['executive-owner', 'finance-owner'],
  'customer-purchase-and-billing-authorization': ['pilot-champion', 'executive-owner', 'finance-owner'],
  'target-dast-clean-rescan': ['security-owner', 'operations-owner'],
  'target-restore-rehearsal': ['operations-owner', 'security-owner'],
  'target-incident-alert-drill': ['operations-owner', 'security-owner', 'support-owner'],
  'target-data-rights-rehearsal': ['privacy-owner', 'operations-owner'],
  'target-access-revocation-rehearsal': ['security-owner', 'operations-owner'],
  'target-offboarding-rehearsal': ['pilot-champion', 'privacy-owner', 'operations-owner'],
  'production-provider-approval': ['legal-owner', 'privacy-owner', 'security-owner', 'data-owner'],
  'broad-enterprise-sale-decision': [
    'pilot-champion', 'executive-owner', 'legal-owner', 'finance-owner',
    'product-owner', 'security-owner', 'privacy-owner', 'accessibility-owner',
  ],
  'repeatable-multi-customer-deployments': ['operations-owner', 'product-owner'],
  'capacity-and-error-budget-accepted': ['engineering-owner', 'operations-owner'],
  'independent-security-assurance': ['security-owner', 'trust-owner'],
  'qualified-accessibility-conformance': ['accessibility-owner', 'trust-owner'],
  'reference-and-claims-permission': ['executive-owner', 'product-owner'],
};

function hasApprovalProvenance(item: ReleaseEvidence, decisionTime: number): boolean {
  if ((TECHNICAL_RELEASE_GATES as readonly string[]).includes(item.gate)) {
    if (typeof item.reference !== 'string' || typeof item.sourceSha !== 'string') return false;
    const match = TECHNICAL_REFERENCE.exec(item.reference);
    return Boolean(match && match[2] === item.gate && match[3] === item.sourceSha);
  }
  if (typeof item.reference !== 'string' || !SECURE_REFERENCE.test(item.reference)) return false;
  if (item.gate === 'validation-launch-decision') {
    const decision = item.validationDecision;
    if (item.launchState || !decision || !['go', 'go-with-conditions', 'no-go'].includes(decision.verdict)) return false;
    const launchDate = evidenceTime(decision.on);
    const checked = evidenceTime(item.checkedAt);
    if (launchDate === null || checked === null || launchDate > checked || launchDate > decisionTime) return false;
    if (decision.verdict === 'no-go') return false;
    if (!Array.isArray(decision.conditions)) return false;
    if ((decision.verdict === 'go' && decision.conditions.length > 0)
      || (decision.verdict === 'go-with-conditions' && decision.conditions.length === 0)) return false;
    if (!decision.conditions.every((condition) => Boolean(
      condition
      && isNonBlankString(condition.blocker)
      && ['P2', 'P3'].includes(condition.severity)
      && condition.by === 'founder'
      && isNonBlankString(condition.reason)
      && isNonBlankString(condition.disclosure)
      && (evidenceTime(condition.expires) ?? -1) > decisionTime,
    ))) return false;
  }
  if (item.gate === 'canonical-launch-decision') {
    if (item.validationDecision || !item.launchState) return false;
    try {
      const launchDate = evidenceTime(item.launchState.on);
      const checked = evidenceTime(item.checkedAt);
      if (launchDate === null || checked === null || launchDate > checked || launchDate > decisionTime) return false;
      const decision = decide(item.launchState);
      if (decision.verdict === 'no-go') return false;
      if (decision.conditions.some((condition) => {
        const expiry = evidenceTime(condition.expires);
        const evaluationDate = new Date(decisionTime).toISOString().slice(0, 10);
        return expiry === null || condition.expires <= evaluationDate;
      })) return false;
    } catch {
      return false;
    }
  }
  const required = item.gate.startsWith('dependency:')
    ? ['product-owner', 'security-owner'] as const
    : APPROVERS_BY_GATE[item.gate as ActivationGate];
  const rawApprovals: readonly unknown[] = Array.isArray(item.approvals) ? item.approvals : [];
  if (!rawApprovals.every((approval): approval is ReleaseApproval => Boolean(
    approval
    && typeof approval === 'object'
    && typeof (approval as Partial<ReleaseApproval>).role === 'string'
    && (RELEASE_APPROVER_ROLES as readonly string[]).includes((approval as Partial<ReleaseApproval>).role ?? '')
    && isNonBlankString((approval as Partial<ReleaseApproval>).subjectRef),
  ))) return false;
  const approvals = rawApprovals;
  const requiredSet = new Set<ReleaseApproverRole>(required);
  const requiredApprovals = approvals.filter((approval) => requiredSet.has(approval.role));
  const supplied = new Set(requiredApprovals.map((approval) => approval.role));
  const subjects = new Set(requiredApprovals.map((approval) => approval.subjectRef.trim()));
  return requiredApprovals.length === required.length
    && required.every((role) => supplied.has(role))
    && subjects.size === required.length;
}

/** Parse date-only or ISO evidence with an explicit UTC offset without relying on string ordering. */
function evidenceTime(value: unknown, endOfDate = false): number | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const stamp = Date.parse(`${value}T${endOfDate ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
  }
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', zone] = match;
  const [year, month, day, hour, minute, second] = [
    yearText, monthText, dayText, hourText, minuteText, secondText,
  ].map(Number);
  const millisecond = Number(fraction.slice(0, 3).padEnd(3, '0'));
  if (hour > 23 || minute > 59 || second > 59) return null;
  const localStamp = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const local = new Date(localStamp);
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day
    || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second) return null;
  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetRemainder = Number(zone.slice(4, 6));
    if (offsetHours > 23 || offsetRemainder > 59) return null;
    offsetMinutes = (offsetHours * 60 + offsetRemainder) * (zone[0] === '+' ? 1 : -1);
  }
  const stamp = localStamp - offsetMinutes * 60_000;
  return Number.isFinite(stamp) ? stamp : null;
}

function latestCurrentEvidence(
  evidence: readonly ReleaseEvidence[],
  gate: ReleaseEvidence['gate'],
  asOf: string,
  target?: ReleaseTarget,
  sourceSha?: string,
): readonly ReleaseEvidence[] {
  const decisionTime = evidenceTime(asOf, true);
  if (decisionTime === null) return [];
  const matching = evidence
    .filter((item) => item.gate === gate
      && (!target || sameReleaseTarget(item.target, target))
      && (!sourceSha || (SHA.test(item.sourceSha ?? '') && item.sourceSha === sourceSha)))
    .map((item) => ({ item, checked: evidenceTime(item.checkedAt), expires: evidenceTime(item.expiresAt) }));
  if (matching.some(({ checked }) => checked === null)) return [];
  const eligible = matching
    .filter(({ checked }) => checked !== null && checked <= decisionTime)
    .sort((a, b) => (b.checked ?? 0) - (a.checked ?? 0));
  if (eligible.length === 0) return [];
  const latestDate = eligible[0].checked;
  const latest = eligible.filter(({ checked }) => checked === latestDate);
  return latest.every(({ item, expires }) => item.status === 'current'
    && hasApprovalProvenance(item, decisionTime)
    && (expires ?? -1) > decisionTime)
    ? latest.map(({ item }) => item)
    : [];
}

function counts(
  evidence: readonly ReleaseEvidence[],
  gate: ReleaseEvidence['gate'],
  asOf: string,
  target?: ReleaseTarget,
  sourceSha?: string,
): boolean {
  return latestCurrentEvidence(evidence, gate, asOf, target, sourceSha).length > 0;
}

export function evaluateReleaseProfile(
  profileId: ReleaseProfileId,
  evidence: readonly ReleaseEvidence[],
  asOf = new Date().toISOString(),
  target?: ReleaseTarget,
): ReleaseProfileDecision {
  const profile = RELEASE_PROFILES[profileId];
  const evidenceRecords: readonly ReleaseEvidence[] = Array.isArray(evidence) && evidence.every(isReleaseEvidence)
    ? evidence
    : [];
  const targetBaseValid = Boolean(target
    && typeof target.deployedSha === 'string'
    && SHA.test(target.deployedSha)
    && isNonBlankString(target.configurationVersion));
  const targetBound = Boolean(targetBaseValid && target && (() => {
    switch (profile.targetKind) {
      case 'public-individual':
        return target.environment === 'production'
          && target.tenantId === undefined && target.cohortId === undefined
          && target.dataMode === undefined && target.registrationWriteback === undefined;
      case 'invitation-validation':
        return target.environment === 'production'
          && target.tenantId === undefined && isNonBlankString(target.cohortId)
          && target.dataMode === undefined && target.registrationWriteback === undefined;
      case 'manual-pilot':
        return target.environment === 'pilot'
          && isNonBlankString(target.tenantId) && isNonBlankString(target.cohortId)
          && target.dataMode === 'manual' && target.registrationWriteback === 'disabled';
      case 'connected-pilot':
        return target.environment === 'pilot'
          && isNonBlankString(target.tenantId) && isNonBlankString(target.cohortId)
          && target.dataMode === 'connected' && target.registrationWriteback === 'disabled';
      case 'enterprise':
        return target.environment === 'production'
          && isNonBlankString(target.tenantId) && isNonBlankString(target.cohortId)
          && target.dataMode === 'connected' && target.registrationWriteback === 'disabled';
    }
  })());
  const technicalTargetBound = Boolean(target && typeof target.deployedSha === 'string' && SHA.test(target.deployedSha));
  const missingTechnical = profile.requiredTechnicalGates.filter((gate) => !technicalTargetBound
    || !counts(evidenceRecords, gate, asOf, undefined, target?.deployedSha));
  const missingActivation = profile.requiredActivationGates.filter((gate) => !targetBound
    || !counts(evidenceRecords, gate, asOf, target));
  const missingDependencies = profile.requiredDependencies.filter((dependency) => !targetBound
    || !counts(evidenceRecords, `dependency:${dependency}`, asOf, target));
  const validationTargets = evidenceRecords
    .filter((item) => item.gate === 'validation-launch-decision')
    .map((item) => item.target)
    .filter((candidate): candidate is ReleaseTarget => Boolean(candidate));
  const missingPrerequisites = profile.requiredPrerequisiteProfiles.filter((prerequisiteId) =>
    !validationTargets.some((candidate) =>
      evaluateReleaseProfile(prerequisiteId, evidenceRecords, asOf, candidate).rolloutStatus === 'authorized'));
  const technicalStatus = missingTechnical.length === 0 ? 'ready' : 'not-ready';
  const rolloutStatus = technicalStatus === 'ready'
    && targetBound
    && missingActivation.length === 0
    && missingDependencies.length === 0
    && missingPrerequisites.length === 0
    ? 'authorized'
    : 'held';
  const decisionGate = profile.requiredActivationGates.includes('canonical-launch-decision')
    ? 'canonical-launch-decision'
    : profile.requiredActivationGates.includes('validation-launch-decision')
      ? 'validation-launch-decision'
      : null;
  const launchOutcomes: Verdict[] = decisionGate && targetBound
    ? latestCurrentEvidence(evidenceRecords, decisionGate, asOf, target)
      .flatMap((item) => {
        try {
          if (decisionGate === 'canonical-launch-decision') {
            return item.launchState ? [decide(item.launchState)] : [];
          }
          return item.validationDecision ? [{
            verdict: item.validationDecision.verdict,
            reasons: [],
            conditions: [...item.validationDecision.conditions],
          }] : [];
        } catch {
          return [];
        }
      })
    : [];
  const launchConditions = launchOutcomes.flatMap((outcome) => outcome.conditions);
  const launchVerdict = !decisionGate
    ? 'not-applicable'
    : launchOutcomes.length === 0
      ? null
      : launchConditions.length > 0
        ? 'go-with-conditions'
        : 'go';
  return {
    profileId: profile.id,
    target: targetBound && target ? Object.freeze({ ...target }) : null,
    technicalStatus,
    rolloutStatus,
    missingTechnical,
    missingActivation,
    missingDependencies,
    missingPrerequisites,
    targetBound,
    launchVerdict,
    launchConditions,
    claim: rolloutStatus === 'authorized'
      ? launchVerdict === 'go-with-conditions'
        ? `${profile.authorizedClaim} Authorized with conditions: ${launchConditions
          .map((condition) => `${condition.blocker} through ${condition.expires} — ${condition.disclosure}`)
          .join('; ')}.`
        : profile.authorizedClaim
      : technicalStatus === 'ready'
        ? `Technical release candidate; rollout is held pending: ${[
          ...(targetBound ? [] : ['a complete deployment target']),
          ...missingActivation,
          ...missingDependencies.map((item) => `dependency:${item}`),
          ...missingPrerequisites.map((item) => `prerequisite:${item}`),
        ].join(', ')}.`
        : `Not technically ready; missing: ${missingTechnical.join(', ')}.`,
  };
}
