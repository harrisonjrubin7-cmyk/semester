/**
 * Semester's incident and recovery contract.
 *
 * These are proposed operating targets, not measured SLAs. An institution must
 * approve its own objectives after a business-impact analysis, and a restore
 * exercise must measure them before the product claims they are met.
 */

export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type ServiceTier = 'tier0' | 'tier1' | 'tier2' | 'tier3' | 'tier4';

export interface RecoveryObjective {
  tier: ServiceTier;
  services: string[];
  proposedRtoMinutes: number | null;
  proposedRpoMinutes: number | null;
  fallback: string;
  approval: 'institution_approval_required';
  evidence: 'unmeasured';
}

export const RECOVERY_OBJECTIVES: readonly RecoveryObjective[] = [
  { tier: 'tier0', services: ['Identity', 'Tenant isolation', 'Authorization', 'Audit integrity'], proposedRtoMinutes: 60, proposedRpoMinutes: 15, fallback: 'Fail closed; show a status and support route.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'tier1', services: ['Action Center', 'Student workspace', 'Context Packets', 'Source Registry'], proposedRtoMinutes: 240, proposedRpoMinutes: 60, fallback: 'Read-only saved workspace with an explicit freshness label.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'tier2', services: ['Course Guide', 'Tutor', 'LTI launch', 'Planning tools'], proposedRtoMinutes: 480, proposedRpoMinutes: 240, fallback: 'Official LMS links, source navigation, and static templates.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'tier3', services: ['Optional recommendations', 'Opportunity matching', 'Optional analytics'], proposedRtoMinutes: 4_320, proposedRpoMinutes: 1_440, fallback: 'Hide the optional feature; keep the core loop available.', approval: 'institution_approval_required', evidence: 'unmeasured' },
  { tier: 'tier4', services: ['Experimental and pilot features'], proposedRtoMinutes: null, proposedRpoMinutes: null, fallback: 'Disable by feature flag.', approval: 'institution_approval_required', evidence: 'unmeasured' },
];

export const INCIDENT_LIFECYCLE = ['detect', 'contain', 'communicate', 'recover', 'verify', 'close'] as const;

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
  { signal: 'cross_tenant_access', severity: 'P0', automatedAction: 'disable_risky_feature', studentFallback: 'This feature is temporarily unavailable while we protect account data.', verification: 'Tenant boundaries pass before the path is restored.' },
  { signal: 'authorization_error_spike', severity: 'P1', automatedAction: 'block_write', studentFallback: 'Semester cannot confirm access right now. Use the official system or return later.', verification: 'Valid access succeeds and invalid access remains rejected.' },
  { signal: 'policy_engine_failure', severity: 'P1', automatedAction: 'switch_to_approved_fallback', studentFallback: 'AI help is limited; approved sources and human support remain available.', verification: 'Policy, consent, and restricted-assessment tests pass.' },
  { signal: 'ai_model_outage', severity: 'P2', automatedAction: 'switch_to_approved_fallback', studentFallback: 'AI help is temporarily limited. Your saved work and approved sources remain available.', verification: 'The approved route passes grounding, privacy, and tool-use tests.' },
  { signal: 'source_freshness_breach', severity: 'P2', automatedAction: 'mark_stale_or_pending', studentFallback: 'This information may be out of date. Open the official source or ask its owner.', verification: 'Freshness, ownership, link, and citation checks pass.' },
  { signal: 'data_integrity_mismatch', severity: 'P0', automatedAction: 'block_write', studentFallback: 'Semester is read-only while we verify saved information.', verification: 'Checksums, ordering, sharing state, and audit sequence reconcile.' },
  { signal: 'official_write_timeout', severity: 'P1', automatedAction: 'mark_stale_or_pending', studentFallback: 'Your action was not confirmed. Check the official system; Semester will not retry it automatically.', verification: 'Exactly one intended effect is confirmed in the system of record.' },
  { signal: 'accessibility_regression', severity: 'P1', automatedAction: 'disable_risky_feature', studentFallback: 'Use the prior accessible path or the alternate format while this is corrected.', verification: 'The affected critical path passes keyboard and assistive-technology checks.' },
];

export interface IncidentRecord {
  id: string;
  severity: IncidentSeverity;
  declaredAt: number;
  commander: string;
  affectedServices: string[];
  studentVisibleEffect: string;
  privateStudentDataIncluded: false;
  status: (typeof INCIDENT_LIFECYCLE)[number];
  nextUpdateAt: number;
  verification: string[];
}

export function validateIncident(record: IncidentRecord): string[] {
  const gaps: string[] = [];
  if (!record.id.trim()) gaps.push('incident id');
  if (!record.commander.trim()) gaps.push('named incident commander');
  if (record.affectedServices.length === 0) gaps.push('affected service');
  if (!record.studentVisibleEffect.trim()) gaps.push('student-visible effect');
  if (record.nextUpdateAt <= record.declaredAt) gaps.push('future next-update time');
  if ((record.status === 'verify' || record.status === 'close') && record.verification.length === 0) gaps.push('recovery verification');
  return gaps;
}
