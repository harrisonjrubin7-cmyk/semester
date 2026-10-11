import type { BacklogExecutionItem, BacklogItem, RegistrySnapshot, ValidationIssue } from '../types.ts';

export function buildExecutionPlan(backlog: BacklogItem[]): BacklogExecutionItem[] {
  const byId = new Map(backlog.map((item) => [item.id, item]));

  return backlog.map((item) => {
    const openDependencies = item.depends_on.filter((dependency) => byId.get(dependency)?.state !== 'verified');
    let executionStatus: BacklogExecutionItem['execution_status'];
    if (item.state === 'verified') executionStatus = 'verified';
    else if (item.state === 'blocked') executionStatus = 'blocked';
    else if (item.state === 'in_progress') executionStatus = openDependencies.length ? 'sequencing_debt' : 'active';
    else executionStatus = openDependencies.length ? 'waiting' : 'ready';

    return { ...item, execution_status: executionStatus, open_dependencies: openDependencies };
  });
}

export function validateBacklog(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const knownRegistryKeys = new Set([
    ...snapshot.capabilities, ...snapshot.systems, ...snapshot.roles, ...snapshot.screens,
    ...snapshot.workflows, ...snapshot.integrations, ...snapshot.controls, ...snapshot.documents, ...snapshot.tenants,
  ].map(({ key }) => key));
  const ids = new Set(snapshot.backlog.map(({ id }) => id));
  const byId = new Map(snapshot.backlog.map((item) => [item.id, item]));
  const seen = new Set<string>();

  for (const item of snapshot.backlog) {
    const path = `backlog.${item.id}`;
    if (!/^P0-\d{3}$/.test(item.id)) issues.push({ code: 'invalid_backlog_id', path, message: 'Backlog id must use P0-NNN notation.' });
    if (seen.has(item.id)) issues.push({ code: 'duplicate_backlog_id', path, message: 'Backlog id is duplicated.' });
    if (!item.owner.trim()) issues.push({ code: 'missing_owner', path, message: 'Backlog item requires an owner.' });
    if (item.state === 'verified' && item.evidence.length === 0) issues.push({ code: 'missing_verification_evidence', path, message: 'Verified backlog items require evidence.' });
    if ((item.state === 'blocked' || item.state === 'planned') && item.blockers.length === 0) issues.push({ code: 'missing_blocker', path, message: 'Non-executable backlog items require an explicit blocker.' });
    for (const key of item.registry_keys) if (!knownRegistryKeys.has(key)) issues.push({ code: 'unknown_registry_key', path: `${path}.registry_keys`, message: `Unknown registry key ${key}.` });
    for (const dependency of item.depends_on) {
      if (!ids.has(dependency)) issues.push({ code: 'unknown_dependency', path: `${path}.depends_on`, message: `Unknown dependency ${dependency}.` });
      if (!seen.has(dependency)) issues.push({ code: 'forward_dependency', path: `${path}.depends_on`, message: `Dependency ${dependency} must appear earlier in the execution board.` });
      if (item.state === 'verified' && byId.get(dependency)?.state !== 'verified') issues.push({ code: 'verified_with_open_dependency', path: `${path}.depends_on`, message: `Verified backlog item still depends on unverified ${dependency}.` });
    }
    seen.add(item.id);
  }
  return issues;
}
