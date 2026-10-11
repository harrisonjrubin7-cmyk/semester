import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

export function validateBacklog(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const knownRegistryKeys = new Set([
    ...snapshot.capabilities, ...snapshot.systems, ...snapshot.roles, ...snapshot.screens,
    ...snapshot.workflows, ...snapshot.integrations, ...snapshot.controls, ...snapshot.documents, ...snapshot.tenants,
  ].map(({ key }) => key));
  const ids = new Set(snapshot.backlog.map(({ id }) => id));
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
    }
    seen.add(item.id);
  }
  return issues;
}
