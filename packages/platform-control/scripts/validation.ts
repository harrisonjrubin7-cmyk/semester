import { access, realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { RegistrySnapshot, ValidationIssue } from '../types.ts';
import { validateActivationGates } from '../validators/activation-gate-validator.ts';
import { validateCapabilities } from '../validators/capability-validator.ts';
import { validateBacklog } from '../validators/backlog-validator.ts';
import { validateRegistryRecords } from '../validators/control-validator.ts';
import { validateContracts } from '../validators/contract-validator.ts';
import { validateRlsCoverage } from '../validators/rls-validator.ts';
import { validateRoutes } from '../validators/route-validator.ts';
import { validateWorkflows } from '../validators/workflow-validator.ts';
import { validateWorkspaceRegistry } from '../validators/workspace-validator.ts';
import { repositoryRoot } from './registry-io.ts';

export async function validateEvidence(snapshot: RegistrySnapshot): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const paths = new Set<string>();
  for (const capability of snapshot.capabilities) for (const values of Object.values(capability.evidence)) for (const reference of values ?? []) {
    if (typeof reference === 'object' && reference !== null && typeof reference.path === 'string' && reference.path.trim()) paths.add(reference.path);
  }
  for (const group of [snapshot.systems, snapshot.roles, snapshot.screens, snapshot.workflows, snapshot.integrations, snapshot.controls, snapshot.documents, snapshot.tenants, snapshot.manifests ?? [], snapshot.workspaces ?? []]) {
    for (const record of group) for (const path of record.evidence) paths.add(path);
  }
  for (const item of snapshot.backlog) for (const path of item.evidence) paths.add(path);
  const gatePaths = new Set<string>();
  for (const gate of snapshot.activationGates ?? []) {
    if (typeof gate !== 'object' || gate === null) continue;
    // Registry JSON is not validated on load: skip malformed shapes here; the activation-gate validator reports them.
    for (const item of Array.isArray(gate.required) ? gate.required : []) {
      if (!Array.isArray(item?.evidence)) continue;
      for (const path of item.evidence) if (typeof path === 'string') { paths.add(path); gatePaths.add(path); }
    }
    const record: unknown = gate.decision?.record;
    if (typeof record === 'string' && record.trim()) { paths.add(record); gatePaths.add(record); }
  }
  for (const path of [...paths].sort()) {
    try { await access(resolve(repositoryRoot, path)); }
    catch { issues.push({ code: 'missing_evidence_path', path, message: 'Evidence path does not exist in the repository.' }); continue; }
    if (!gatePaths.has(path)) continue;
    // Resolve symlinks: a repository-relative name must not reach a file outside the repository.
    const target = await realpath(resolve(repositoryRoot, path));
    const root = await realpath(repositoryRoot);
    if (target !== root && !target.startsWith(root + sep)) {
      issues.push({ code: 'gate_evidence_outside_repository', path, message: 'Gate evidence resolves outside the repository.' });
    } else if (!(await stat(target)).isFile()) {
      issues.push({ code: 'gate_evidence_not_file', path, message: 'Gate evidence must name a file, not a directory.' });
    }
  }
  return issues;
}

export async function validateSnapshot(snapshot: RegistrySnapshot): Promise<ValidationIssue[]> {
  return [
    ...validateCapabilities(snapshot), ...validateBacklog(snapshot), ...validateRegistryRecords(snapshot), ...validateWorkflows(snapshot),
    ...validateWorkspaceRegistry(snapshot), ...validateRoutes(snapshot), ...validateContracts(snapshot), ...validateRlsCoverage(snapshot),
    ...validateActivationGates(snapshot), ...await validateEvidence(snapshot),
  ];
}
