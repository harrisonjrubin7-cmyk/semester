import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

export function validateWorkflows(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const workflow of snapshot.workflows) {
    const path = `workflows.${workflow.key}`;
    const states = new Set(workflow.states);
    if (!workflow.owner.trim()) issues.push({ code: 'missing_owner', path, message: 'Workflow requires an owner.' });
    if (!Number.isInteger(workflow.version) || workflow.version < 1) issues.push({ code: 'invalid_version', path: `${path}.version`, message: 'Workflow version must be a positive integer.' });
    if (!workflow.idempotency.trim() || !workflow.retry_policy.trim() || !workflow.escalation_role.trim() || !workflow.runbook.trim()) {
      issues.push({ code: 'incomplete_recovery_contract', path, message: 'Workflow requires idempotency, retry, escalation, and runbook fields.' });
    }
    for (const [from, targets] of Object.entries(workflow.transitions)) {
      if (!states.has(from)) issues.push({ code: 'unknown_transition_source', path: `${path}.transitions.${from}`, message: `Unknown source state ${from}.` });
      for (const target of targets) if (!states.has(target)) issues.push({ code: 'unknown_transition_target', path: `${path}.transitions.${from}`, message: `Unknown target state ${target}.` });
    }
  }
  return issues;
}
