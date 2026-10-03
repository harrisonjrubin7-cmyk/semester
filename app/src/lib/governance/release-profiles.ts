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
  'canonical-launch-decision',
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
] as const;
export type ReleaseApproverRole = (typeof RELEASE_APPROVER_ROLES)[number];
export type ReleaseProfileId = 'individual-scale' | 'institutional-manual-pilot' | 'institutional-pilot';

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
  readonly capabilityIds: readonly `CAP-${string}`[];
  readonly requiredTechnicalGates: readonly TechnicalReleaseGate[];
  readonly requiredActivationGates: readonly ActivationGate[];
  readonly requiredDependencies: readonly string[];
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
  Object.freeze(profile.allowedOperations);
  Object.freeze(profile.forbiddenOperations);
  return Object.freeze(profile);
}

export const RELEASE_PROFILES: Readonly<Record<ReleaseProfileId, ReleaseProfile>> = Object.freeze({
  'individual-scale': freezeProfile({
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
  }),
  'institutional-manual-pilot': freezeProfile({
    id: 'institutional-manual-pilot',
    audience: 'A named, bounded student cohort using student-confirmed manual course data without institutional connections',
    capabilityIds: MANUAL_PILOT_CAPABILITIES,
    requiredTechnicalGates: TECHNICAL_RELEASE_GATES,
    requiredActivationGates: ACTIVATION_GATES,
    requiredDependencies: unsatisfiedCapabilityDependencies(MANUAL_PILOT_CAPABILITIES),
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
  technicalStatus: 'ready' | 'not-ready';
  rolloutStatus: 'authorized' | 'held';
  missingTechnical: readonly TechnicalReleaseGate[];
  missingActivation: readonly ActivationGate[];
  missingDependencies: readonly string[];
  targetBound: boolean;
  launchVerdict: 'not-applicable' | 'go' | 'go-with-conditions' | null;
  launchConditions: readonly Condition[];
  claim: string;
}

function sameTarget(actual: ReleaseTarget | undefined, expected: ReleaseTarget): boolean {
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
};

function hasApprovalProvenance(item: ReleaseEvidence, decisionTime: number): boolean {
  if ((TECHNICAL_RELEASE_GATES as readonly string[]).includes(item.gate)) {
    if (typeof item.reference !== 'string' || typeof item.sourceSha !== 'string') return false;
    const match = TECHNICAL_REFERENCE.exec(item.reference);
    return Boolean(match && match[2] === item.gate && match[3] === item.sourceSha);
  }
  if (typeof item.reference !== 'string' || !SECURE_REFERENCE.test(item.reference)) return false;
  if (item.gate === 'canonical-launch-decision') {
    if (!item.launchState) return false;
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
      && (!target || sameTarget(item.target, target))
      && (!sourceSha || (SHA.test(item.sourceSha ?? '') && item.sourceSha === sourceSha)))
    .map((item) => ({ item, checked: evidenceTime(item.checkedAt), expires: evidenceTime(item.expiresAt, true) }));
  if (matching.some(({ checked }) => checked === null)) return [];
  const eligible = matching
    .filter(({ checked }) => checked !== null && checked <= decisionTime)
    .sort((a, b) => (b.checked ?? 0) - (a.checked ?? 0));
  if (eligible.length === 0) return [];
  const latestDate = eligible[0].checked;
  const latest = eligible.filter(({ checked }) => checked === latestDate);
  return latest.every(({ item, expires }) => item.status === 'current'
    && hasApprovalProvenance(item, decisionTime)
    && (expires ?? -1) >= decisionTime)
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
  const expectedEnvironment = profile.id === 'individual-scale' ? 'production' : 'pilot';
  const expectedDataMode = profile.id === 'institutional-manual-pilot' ? 'manual' : 'connected';
  const targetBound = Boolean(target
    && target.environment === expectedEnvironment
    && typeof target.deployedSha === 'string'
    && SHA.test(target.deployedSha)
    && isNonBlankString(target.configurationVersion)
    && (profile.id !== 'individual-scale'
      ? (isNonBlankString(target.tenantId)
        && isNonBlankString(target.cohortId)
        && target.dataMode === expectedDataMode
        && target.registrationWriteback === 'disabled')
      : target.tenantId === undefined
        && target.cohortId === undefined
        && target.dataMode === undefined
        && target.registrationWriteback === undefined));
  const technicalTargetBound = Boolean(target && typeof target.deployedSha === 'string' && SHA.test(target.deployedSha));
  const missingTechnical = profile.requiredTechnicalGates.filter((gate) => !technicalTargetBound
    || !counts(evidenceRecords, gate, asOf, undefined, target?.deployedSha));
  const missingActivation = profile.requiredActivationGates.filter((gate) => !targetBound
    || !counts(evidenceRecords, gate, asOf, target));
  const missingDependencies = profile.requiredDependencies.filter((dependency) => !targetBound
    || !counts(evidenceRecords, `dependency:${dependency}`, asOf, target));
  const technicalStatus = missingTechnical.length === 0 ? 'ready' : 'not-ready';
  const rolloutStatus = technicalStatus === 'ready'
    && targetBound
    && missingActivation.length === 0
    && missingDependencies.length === 0
    ? 'authorized'
    : 'held';
  const launchOutcomes: Verdict[] = profile.id !== 'individual-scale' && targetBound
    ? latestCurrentEvidence(evidenceRecords, 'canonical-launch-decision', asOf, target)
      .flatMap((item) => {
        try {
          return item.launchState ? [decide(item.launchState)] : [];
        } catch {
          return [];
        }
      })
    : [];
  const launchConditions = launchOutcomes.flatMap((outcome) => outcome.conditions);
  const launchVerdict = profile.id === 'individual-scale'
    ? 'not-applicable'
    : launchOutcomes.length === 0
      ? null
      : launchConditions.length > 0
        ? 'go-with-conditions'
        : 'go';
  return {
    profileId: profile.id,
    technicalStatus,
    rolloutStatus,
    missingTechnical,
    missingActivation,
    missingDependencies,
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
        ].join(', ')}.`
        : `Not technically ready; missing: ${missingTechnical.join(', ')}.`,
  };
}
