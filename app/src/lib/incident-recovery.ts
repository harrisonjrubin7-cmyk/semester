/**
 * Semester's incident and recovery contract.
 *
 * Objectives stay unset until an institution approves them after a business-
 * impact analysis and a timed restore exercise measures the recovery path.
 */

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';
export type ServiceTier = 'tier0' | 'tier1' | 'tier2' | 'tier3' | 'restricted';

export interface RecoveryObjective {
  tier: ServiceTier;
  services: string[];
  rtoMinutes: null;
  rpoMinutes: null;
  fallback: string;
  approval: 'institution_approval_required';
  evidence: 'unmeasured';
}

export const RECOVERY_OBJECTIVES: readonly RecoveryObjective[] = [
  { tier: 'tier0', services: ['Public marketing', 'Public resource pages'], rtoMinutes: null, rpoMinutes: null, fallback: 'Publish status and route students to official resources.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'tier1', services: ['Student planning', 'Today', 'Actions', 'Resource discovery'], rtoMinutes: null, rpoMinutes: null, fallback: 'Use the saved workspace and official sources with explicit freshness labels.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'tier2', services: ['SSO', 'Course access', 'Assignments', 'Submissions', 'Integrations'], rtoMinutes: null, rpoMinutes: null, fallback: 'Fail closed on access and writes; use the official LMS and source links.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'tier3', services: ['Grading', 'Assessments', 'Payments', 'High-impact records'], rtoMinutes: null, rpoMinutes: null, fallback: 'Block the workflow and reconcile against the system of record.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'restricted', services: ['Basic-needs intake', 'Accommodations', 'Health and safety data'], rtoMinutes: null, rpoMinutes: null, fallback: 'Disable the route and use the institution-owned restricted process.', approval: 'institution_approval_required', evidence: 'unmeasured' },
];

export const INCIDENT_LIFECYCLE = ['detect', 'contain', 'communicate', 'recover', 'verify', 'close'] as const;

export interface IncidentCloseOutEvidence {
  measuredTimeline: string;
  impact: string;
  recoveryPoint: string;
  stabilizedAt: number;
  communications: string[];
  correctiveActions: Array<{ action: string; owner: string; severity: IncidentSeverity; dueAt: number; requiredEvidence: string; verificationEvidence: string }>;
  postIncidentReview?: { completedAt: number; evidence: string };
}

export const AUTOMATION_MAY = [
  'disable_risky_feature',
  'quarantine_source',
  'block_write',
  'fail_over_tested_replica',
  'switch_to_approved_fallback',
  'mark_stale_or_pending',
  'open_incident_and_page_owner',
] as const;

export const AUTOMATION_MUST_NOT = [
  'weaken_authentication',
  'override_consent_or_policy',
  'retry_ambiguous_official_write',
  'share_private_student_details',
  'use_unapproved_ai',
  'restore_deleted_or_revoked_data_blindly',
  'declare_resolved_without_verification',
] as const;

export type FailoverSignal =
  | 'cross_tenant_access'
  | 'authorization_error_spike'
  | 'policy_engine_failure'
  | 'ai_model_outage'
  | 'source_freshness_breach'
  | 'data_integrity_mismatch'
  | 'official_write_timeout'
  | 'accessibility_regression';

export interface FailoverRule {
  signal: FailoverSignal;
  severity: IncidentSeverity;
  automatedAction: (typeof AUTOMATION_MAY)[number];
  studentFallback: string;
  verification: string;
}

export const FAILOVER_RULES: readonly FailoverRule[] = [
  { signal: 'cross_tenant_access', severity: 'SEV1', automatedAction: 'disable_risky_feature', studentFallback: 'This feature is temporarily unavailable while we protect account data.', verification: 'Tenant boundaries pass before the path is restored.' },
  { signal: 'authorization_error_spike', severity: 'SEV2', automatedAction: 'block_write', studentFallback: 'Semester cannot confirm access right now. Use the official system or return later.', verification: 'Valid access succeeds and invalid access remains rejected.' },
  { signal: 'policy_engine_failure', severity: 'SEV2', automatedAction: 'switch_to_approved_fallback', studentFallback: 'AI help is limited; approved sources and human support remain available.', verification: 'Policy, consent, and restricted-assessment tests pass.' },
  { signal: 'ai_model_outage', severity: 'SEV3', automatedAction: 'switch_to_approved_fallback', studentFallback: 'AI help is temporarily limited. Your saved work and approved sources remain available.', verification: 'The approved route passes grounding, privacy, and tool-use tests.' },
  { signal: 'source_freshness_breach', severity: 'SEV3', automatedAction: 'mark_stale_or_pending', studentFallback: 'This information may be out of date. Open the official source or ask its owner.', verification: 'Freshness, ownership, link, and citation checks pass.' },
  { signal: 'data_integrity_mismatch', severity: 'SEV2', automatedAction: 'block_write', studentFallback: 'Semester is read-only while we verify saved information.', verification: 'Checksums, ordering, sharing state, and audit sequence reconcile.' },
  { signal: 'official_write_timeout', severity: 'SEV2', automatedAction: 'mark_stale_or_pending', studentFallback: 'Your action was not confirmed. Check the official system; Semester will not retry it automatically.', verification: 'Exactly one intended effect is confirmed in the system of record.' },
  { signal: 'accessibility_regression', severity: 'SEV3', automatedAction: 'disable_risky_feature', studentFallback: 'Use the prior accessible path or the alternate format while this is corrected.', verification: 'The affected critical path passes keyboard and assistive-technology checks.' },
];

export interface IncidentRecord {
  id: string;
  severity: IncidentSeverity;
  declaredAt: number;
  detection: { signal: string; firstObservedAt: number; correlationIds: string[] };
  commander: string;
  affectedServices: string[];
  tenantScope:
    | { scope: 'platform_wide' }
    | { scope: 'tenant_specific' | 'suspected_cross_tenant'; tenantIds: string[] };
  studentVisibleEffect: string;
  privateStudentDataIncluded: false;
  status: (typeof INCIDENT_LIFECYCLE)[number];
  nextUpdateAt: number;
  verification: string[];
  closeOut?: IncidentCloseOutEvidence;
}

const INCIDENT_SEVERITIES: readonly IncidentSeverity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
const TENANT_SCOPES = ['platform_wide', 'tenant_specific', 'suspected_cross_tenant'] as const;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(new Date(value).getTime());
}

function addBusinessDays(timestamp: number, count: number): number {
  const date = new Date(timestamp);
  let remaining = count;
  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return date.getTime();
}

export function validateIncident(record: IncidentRecord, now = Date.now()): string[] {
  const gaps: string[] = [];
  if (!hasText(record.id)) gaps.push('incident id');
  const knownSeverity = INCIDENT_SEVERITIES.includes(record.severity as IncidentSeverity);
  if (!knownSeverity) gaps.push('known incident severity');
  if (!isValidTimestamp(record.declaredAt)) gaps.push('finite declaration time');
  else if (record.declaredAt > now) gaps.push('declaration time not in future');
  const detection = record.detection;
  if (!detection
    || !hasText(detection.signal)
    || !isValidTimestamp(detection.firstObservedAt)
    || detection.firstObservedAt > now
    || detection.firstObservedAt > record.declaredAt
    || !Array.isArray(detection.correlationIds)
    || !detection.correlationIds.some(hasText)) gaps.push('detection evidence');
  if (!hasText(record.commander)) gaps.push('named incident commander');
  if (!Array.isArray(record.affectedServices) || !record.affectedServices.some(hasText)) gaps.push('affected service');
  const scope = record.tenantScope?.scope;
  const knownScope = TENANT_SCOPES.includes(scope as (typeof TENANT_SCOPES)[number]);
  const tenantIds = scope === 'platform_wide' ? [] : (record.tenantScope as { tenantIds?: unknown })?.tenantIds;
  if (!knownScope || (scope !== 'platform_wide' && (!Array.isArray(tenantIds) || !tenantIds.some(hasText)))) gaps.push('tenant scope');
  if (scope === 'suspected_cross_tenant' && record.severity !== 'SEV1') gaps.push('SEV1 for suspected cross-tenant scope');
  if (!hasText(record.studentVisibleEffect)) gaps.push('student-visible effect');
  if (record.privateStudentDataIncluded !== false) gaps.push('private student data excluded');
  const knownStatus = INCIDENT_LIFECYCLE.includes(record.status as (typeof INCIDENT_LIFECYCLE)[number]);
  if (!knownStatus) gaps.push('known incident status');
  if (knownStatus && record.status !== 'close' && (!isValidTimestamp(record.nextUpdateAt) || record.nextUpdateAt <= now || record.nextUpdateAt <= record.declaredAt)) gaps.push('future next-update time');
  if (knownStatus && (record.status === 'verify' || record.status === 'close') && (!Array.isArray(record.verification) || !record.verification.some(hasText))) gaps.push('recovery verification');
  if (record.status === 'close') {
    const closeOut = record.closeOut as IncidentCloseOutEvidence | undefined;
    const actions = closeOut?.correctiveActions;
    const review = closeOut?.postIncidentReview;
    const majorReviewComplete = record.severity !== 'SEV1' && record.severity !== 'SEV2'
      || Boolean(closeOut
        && review
        && isValidTimestamp(closeOut.stabilizedAt)
        && isValidTimestamp(review.completedAt)
        && review.completedAt >= closeOut.stabilizedAt
        && review.completedAt <= now
        && review.completedAt <= addBusinessDays(closeOut.stabilizedAt, 5)
        && hasText(review.evidence));
    const complete = Boolean(closeOut
      && hasText(closeOut.measuredTimeline)
      && hasText(closeOut.impact)
      && hasText(closeOut.recoveryPoint)
      && isValidTimestamp(closeOut.stabilizedAt)
      && closeOut.stabilizedAt >= record.declaredAt
      && closeOut.stabilizedAt <= now
      && Array.isArray(closeOut.communications)
      && closeOut.communications.some(hasText)
      && Array.isArray(actions)
      && actions.length > 0
      && actions.every((action) => Boolean(action
        && hasText(action.action)
        && hasText(action.owner)
        && INCIDENT_SEVERITIES.includes(action.severity as IncidentSeverity)
        && isValidTimestamp(action.dueAt)
        && action.dueAt >= record.declaredAt
        && hasText(action.requiredEvidence)
        && hasText(action.verificationEvidence)))
      && majorReviewComplete);
    if (!complete) gaps.push('complete close-out evidence');
  }
  return gaps;
}
