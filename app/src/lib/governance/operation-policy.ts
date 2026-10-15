/**
 * Canonical activation floors for flag-backed operations. A personal capability
 * does not make an official write safe. Both receipt issuance and flag exposure
 * consume this registry; it imports neither evaluator and grants no authority.
 */
import type { ActivationClass } from './capability-governance';

export interface OperationPolicy {
  readonly operation: string;
  readonly activationClass: ActivationClass;
  readonly capabilityIds: readonly string[];
}

const rows: readonly (readonly [string, ActivationClass, readonly string[]])[] = [
  ['module.core_mode', 'high-risk', ['CAP-013', 'CAP-020', 'CAP-021', 'CAP-027', 'CAP-043', 'CAP-044', 'CAP-046', 'CAP-047', 'CAP-050', 'CAP-051']],
  ['module.integration_dashboard', 'standard', ['CAP-013']],
  ['module.institutional_operations', 'standard', ['CAP-014', 'CAP-016']],
  ['module.source_freshness_cards', 'standard', ['CAP-001', 'CAP-003', 'CAP-011', 'CAP-020', 'CAP-044']],
  ['module.campaign_manager', 'high-risk', ['CAP-059', 'CAP-060']],
  ['module.sponsorship', 'high-risk', ['CAP-043', 'CAP-051']],
  ['module.dining', 'high-risk', ['CAP-047']],
  ['release.integration_dashboard_v1', 'standard', ['CAP-013']],
  ['integration.lms_lti', 'high-risk', ['CAP-020', 'CAP-021']],
  ['integration.sis_read', 'high-risk', ['CAP-020', 'CAP-045', 'CAP-050']],
  ['integration.degree_audit_read', 'high-risk', ['CAP-044']],
  ['integration.advising_crm', 'high-risk', ['CAP-043', 'CAP-052']],
  ['integration.career', 'high-risk', ['CAP-051', 'CAP-054', 'CAP-055']],
  ['integration.campus_services', 'high-risk', ['CAP-043', 'CAP-049', 'CAP-051']],
  ['integration.erp_bursar_actions', 'high-risk', ['CAP-046']],
  ['scope.sis.enrollment_read', 'high-risk', ['CAP-020']],
  ['scope.lms.assignment_dates_read', 'high-risk', ['CAP-021']],
  ['scope.sis.registration_hold_summary_read', 'high-risk', ['CAP-050']],
  ['writeback.registration_submit', 'high-risk', ['CAP-050']],
  ['writeback.space_booking', 'high-risk', ['CAP-043']],
  ['writeback.lms_grade_passback', 'high-risk', ['CAP-020', 'CAP-021', 'CAP-030']],
  ['ops.external_ai_generation', 'high-risk', ['CAP-027']],
  ['ops.data_upload', 'high-risk', ['CAP-022', 'CAP-028', 'CAP-040']],
  ['ops.code_sandbox_enabled', 'high-risk', ['CAP-025', 'CAP-032']],
  ['safety.scoped_pseudonymity', 'high-risk', ['CAP-058', 'CAP-060']],
  ['safety.volunteer_moderation', 'high-risk', ['CAP-058', 'CAP-060']],
  ['safety.institution_escalation', 'high-risk', ['CAP-058', 'CAP-060']],
  ['experiment.today_action_ranking_v2', 'standard', ['CAP-001']],
];

export const OPERATION_POLICIES: readonly OperationPolicy[] = Object.freeze(rows.map(([operation, activationClass, capabilityIds]) =>
  Object.freeze({ operation, activationClass, capabilityIds: Object.freeze([...capabilityIds]) })));

export function operationPolicy(operation: string): OperationPolicy | undefined {
  return OPERATION_POLICIES.find((policy) => policy.operation === operation);
}

/** Unknown flag operations fail closed; other operations retain capability policy. */
export function isFlagOperation(operation: string): boolean {
  return /^(module|integration|scope|release|experiment|ops|safety|writeback)\./.test(operation);
}
