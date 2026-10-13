import { GATE_ITEM_STATUSES, type RegistrySnapshot, type ValidationIssue } from '../types.ts';

/** The registration-readiness activation gate, exactly as the pilot brief requires it. Drift in either direction fails. */
export const REQUIRED_GATE_ITEMS = [
  'product.student_journey_tested', 'product.staff_queue_tested', 'product.source_labels_visible',
  'product.stale_and_unknown_states_tested', 'product.receipt_tested', 'product.support_handoff_tested',
  'authority_and_policy.institution_authority_confirmed', 'authority_and_policy.term_and_cohort_scope_confirmed',
  'authority_and_policy.policy_tests_passing', 'authority_and_policy.RLS_tests_passing',
  'authority_and_policy.approval_and_exception_path_confirmed',
  'operations.source_health_monitoring_live', 'operations.reconciliation_owner_named', 'operations.incident_runbook_exercised',
  'operations.safe_off_path_tested', 'operations.hypercare_roster_confirmed',
  'trust.student_copy_approved', 'trust.privacy_and_data_scope_reviewed', 'trust.accessibility_critical_path_reviewed',
  'trust.institution_support_contacts_published',
] as const;

export const GATE_APPROVERS = ['institution_operational_owner', 'Semester_product_owner', 'Semester_security_or_operations_owner'] as const;

function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  return [...actual].sort().join('|') === [...expected].sort().join('|');
}

export function validateActivationGates(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const gates = snapshot.activationGates ?? [];
  const capabilityKeys = new Set(snapshot.capabilities.map(({ key }) => key));

  for (const gate of gates) {
    const path = `activationGates.${gate.key}`;
    if (!capabilityKeys.has(gate.capability)) {
      issues.push({ code: 'gate_unknown_capability', path: `${path}.capability`, message: `Gate references unknown capability ${gate.capability}.` });
    }

    const ids = gate.required.map(({ id }) => id);
    const missing = REQUIRED_GATE_ITEMS.filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !(REQUIRED_GATE_ITEMS as readonly string[]).includes(id));
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (missing.length || extra.length || duplicated.length) {
      issues.push({
        code: 'activation_gate_item_drift', path: `${path}.required`,
        message: `Gate items must match the pilot brief. Missing: [${missing.join(', ')}]. Unknown: [${extra.join(', ')}]. Duplicated: [${duplicated.join(', ')}].`,
      });
    }

    for (const item of gate.required) {
      if (!(GATE_ITEM_STATUSES as readonly string[]).includes(item.status)) {
        issues.push({ code: 'invalid_gate_item_status', path: `${path}.required.${item.id}.status`, message: `Unknown gate item status ${String(item.status)}.` });
      }
      if (item.status === 'passed' && item.evidence.length === 0) {
        issues.push({ code: 'gate_item_passed_without_evidence', path: `${path}.required.${item.id}`, message: 'A passed gate item must cite repository evidence.' });
      }
    }

    // Status is derived, never hand-set: ready needs every item passed and a decision record.
    const allPassed = gate.required.length > 0 && gate.required.every(({ status }) => status === 'passed');
    const hasDecision = typeof gate.decision.record === 'string' && gate.decision.record.trim().length > 0;
    const expected = allPassed && hasDecision ? 'ready' : 'not_ready';
    if (gate.status !== expected) {
      issues.push({ code: 'gate_status_mismatch', path: `${path}.status`, message: `Gate must be ${expected} from its items and decision record; it is recorded as ${String(gate.status)}.` });
    }
    if (!sameMembers(gate.decision.approvers, GATE_APPROVERS)) {
      issues.push({ code: 'gate_approvers_drift', path: `${path}.decision.approvers`, message: 'Gate approvers must be the three roles named in the pilot brief.' });
    }
  }

  for (const capability of snapshot.capabilities) {
    if (!capability.maturity.tenant_activated) continue;
    const ready = gates.some((gate) => gate.capability === capability.key && gate.status === 'ready');
    if (!ready) {
      issues.push({ code: 'activation_without_gate', path: `capabilities.${capability.key}.maturity.tenant_activated`, message: 'Tenant activation requires a ready activation gate.' });
    }
  }
  return issues;
}
