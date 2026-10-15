import { GATE_ITEM_STATUSES, type ActivationGate, type RegistrySnapshot, type ValidationIssue } from '../types.ts';

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

// Compares as multisets: equal length and equal sorted members, so duplicates and joins cannot collide.
function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  const left = [...actual].sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((member, index) => member === right[index]);
}

// Repository-relative, non-empty, and never escaping the repository root.
export function isRepositoryPath(path: unknown): path is string {
  return typeof path === 'string' && path.trim() !== '' && !path.startsWith('/') && !/^[A-Za-z]:/.test(path)
    && !path.split(/[\\/]/).includes('..');
}

export function validateActivationGates(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const gates = snapshot.activationGates ?? [];
  const capabilityKeys = new Set(snapshot.capabilities.map(({ key }) => key));
  const gatedCapabilities = new Set<string>();
  // The registration-readiness control must exist in the registry before any tenant can be activated.
  if (snapshot.capabilities.some(({ key }) => key === 'registration.readiness') && !gates.some((gate) => gate?.capability === 'registration.readiness')) {
    issues.push({ code: 'activation_gate_missing', path: 'activationGates', message: 'registration.readiness has no activation gate.' });
  }

  for (const gate of gates) {
    if (typeof gate !== 'object' || gate === null) {
      issues.push({ code: 'malformed_activation_gate', path: 'activationGates', message: 'Each activation gate must be an object.' });
      continue;
    }
    const path = `activationGates.${gate.key}`;
    if (gate.capability !== 'registration.readiness') {
      issues.push({ code: 'gate_capability_unsupported', path: `${path}.capability`, message: `This checklist validates registration.readiness only; ${gate.capability} needs its own checklist.` });
    }
    if (typeof gate.owner !== 'string' || gate.owner.trim() === '') {
      issues.push({ code: 'gate_owner_missing', path: `${path}.owner`, message: 'An activation gate must name an accountable owner.' });
    }
    if (!capabilityKeys.has(gate.capability)) {
      issues.push({ code: 'gate_unknown_capability', path: `${path}.capability`, message: `Gate references unknown capability ${gate.capability}.` });
    }
    if (gatedCapabilities.has(gate.capability)) {
      issues.push({ code: 'duplicate_activation_gate', path, message: `More than one activation gate targets ${gate.capability}.` });
    }
    gatedCapabilities.add(gate.capability);

    // Registry JSON is cast, not validated on load: report malformed shapes instead of throwing.
    if (!Array.isArray(gate.required) || gate.required.some((item) => typeof item !== 'object' || item === null)) {
      issues.push({ code: 'malformed_activation_gate', path: `${path}.required`, message: 'Gate items must be a list of objects.' });
      continue;
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
      const evidence: unknown = item.evidence;
      if (!Array.isArray(evidence)) {
        issues.push({ code: 'malformed_gate_evidence', path: `${path}.required.${item.id}.evidence`, message: 'Gate item evidence must be a list of paths.' });
      } else {
        if (item.status === 'passed' && evidence.length === 0) {
          issues.push({ code: 'gate_item_passed_without_evidence', path: `${path}.required.${item.id}`, message: 'A passed gate item must cite repository evidence.' });
        }
        for (const reference of evidence) {
          if (!isRepositoryPath(reference)) {
            issues.push({ code: 'gate_evidence_path_invalid', path: `${path}.required.${item.id}.evidence`, message: `Evidence must be a repository-relative path, not ${JSON.stringify(reference)}.` });
          }
        }
      }
      if (item.status !== 'passed' && (typeof item.gap !== 'string' || item.gap.trim() === '')) {
        issues.push({ code: 'gate_item_missing_gap', path: `${path}.required.${item.id}.gap`, message: 'An unverified or failed gate item must state the gap.' });
      }
    }

    // Status is derived, never hand-set: ready needs every item passed and a decision record.
    const allPassed = gate.required.length > 0 && gate.required.every(({ status }) => status === 'passed');
    const decision: Partial<ActivationGate['decision']> | null | undefined = gate.decision;
    const record: unknown = decision?.record;
    const hasDecision = isRepositoryPath(record);
    if (typeof record === 'string' && record.trim() !== '' && !hasDecision) {
      issues.push({ code: 'gate_decision_path_invalid', path: `${path}.decision.record`, message: `Decision record must be a repository-relative path, not ${JSON.stringify(record)}.` });
    }
    const expected = allPassed && hasDecision ? 'ready' : 'not_ready';
    if (gate.status !== expected) {
      issues.push({ code: 'gate_status_mismatch', path: `${path}.status`, message: `Gate must be ${expected} from its items and decision record; it is recorded as ${String(gate.status)}.` });
    }
    // Approvers are checked as a multiset of strings, so a missing or fabricated role cannot hide behind a join.
    const approvers: unknown = decision?.approvers;
    if (!Array.isArray(approvers) || !approvers.every((name): name is string => typeof name === 'string') || !sameMembers(approvers, GATE_APPROVERS)) {
      issues.push({ code: 'gate_approvers_drift', path: `${path}.decision.approvers`, message: 'Gate approvers must be the three roles named in the pilot brief.' });
    }
  }

  for (const capability of snapshot.capabilities) {
    if (!capability.maturity.tenant_activated) continue;
    const ready = gates.some((gate) => gate?.capability === capability.key && gate?.status === 'ready');
    if (!ready) {
      issues.push({ code: 'activation_without_gate', path: `capabilities.${capability.key}.maturity.tenant_activated`, message: 'Tenant activation requires a ready activation gate.' });
    }
  }
  return issues;
}
