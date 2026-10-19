import { access, realpath, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import type { RegistrySnapshot, ValidationIssue } from '../types.ts';
import { validateActivationGates } from '../validators/activation-gate-validator.ts';
import { validateOperationsReadiness } from '../validators/operations-readiness-validator.ts';
import { validateCapabilities } from '../validators/capability-validator.ts';
import { validateBacklog } from '../validators/backlog-validator.ts';
import { validateRegistryRecords } from '../validators/control-validator.ts';
import { validateContracts } from '../validators/contract-validator.ts';
import { validateRlsCoverage } from '../validators/rls-validator.ts';
import { inceptionEvidencePaths, validateInception } from '../validators/inception-validator.ts';
import { validateRoutes } from '../validators/route-validator.ts';
import { validateWorkflows } from '../validators/workflow-validator.ts';
import { validateWorkspaceRegistry } from '../validators/workspace-validator.ts';
import { repositoryRoot } from './registry-io.ts';

export async function validateEvidence(snapshot: RegistrySnapshot): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const paths = new Set<string>(inceptionEvidencePaths(snapshot.inception));
  for (const capability of snapshot.capabilities) for (const values of Object.values(capability.evidence)) for (const reference of values ?? []) {
    if (typeof reference === 'object' && reference !== null && typeof reference.path === 'string' && reference.path.trim()) paths.add(reference.path);
  }
  for (const group of [snapshot.systems, snapshot.roles, snapshot.screens, snapshot.workflows, snapshot.integrations, snapshot.controls, snapshot.documents, snapshot.tenants, snapshot.manifests ?? [], snapshot.workspaces ?? []]) {
    for (const record of group) for (const path of record.evidence) paths.add(path);
  }
  for (const item of snapshot.backlog) for (const path of item.evidence) paths.add(path);
  const controlledPaths = new Set<string>();
  for (const gate of snapshot.activationGates ?? []) {
    if (typeof gate !== 'object' || gate === null) continue;
    // Registry JSON is not validated on load: skip malformed shapes here; the activation-gate validator reports them.
    for (const item of Array.isArray(gate.required) ? gate.required : []) {
      if (!Array.isArray(item?.evidence)) continue;
      for (const path of item.evidence) if (typeof path === 'string') { paths.add(path); controlledPaths.add(path); }
    }
    const record: unknown = gate.decision?.record;
    if (typeof record === 'string' && record.trim()) { paths.add(record); controlledPaths.add(record); }
  }
  for (const readiness of snapshot.operationsReadiness ?? []) {
    if (typeof readiness !== 'object' || readiness === null || !Array.isArray(readiness.required)) continue;
    for (const item of readiness.required) {
      if (typeof item !== 'object' || item === null || !Array.isArray(item.evidence)) continue;
      for (const path of item.evidence) if (typeof path === 'string') { paths.add(path); controlledPaths.add(path); }
    }
  }
  for (const path of [...paths].sort()) {
    if (path.trim() === '') { issues.push({ code: 'evidence_blank_path', path, message: 'Evidence path is blank; it would resolve to the repository root.' }); continue; }
    const absolute = resolveInside(repositoryRoot, path);
    if (absolute === null) { issues.push({ code: 'evidence_outside_repository', path, message: 'Evidence path resolves outside the repository.' }); continue; }
    try { await access(absolute); }
    catch { issues.push({ code: 'missing_evidence_path', path, message: 'Evidence path does not exist in the repository.' }); continue; }
    if (!controlledPaths.has(path)) continue;
    // Gate evidence is retained repository content: git metadata is present in every clone but is not an artifact.
    if (path.split(/[\\/]/).includes('.git')) {
      issues.push({ code: 'gate_evidence_repository_metadata', path, message: 'Gate evidence must be repository content, not git metadata.' });
      continue;
    }
    // Resolve symlinks: a repository-relative name must not reach a file outside the repository.
    const target = await realpath(absolute);
    const root = await realpath(repositoryRoot);
    if (target !== root && !target.startsWith(root + sep)) {
      issues.push({ code: 'gate_evidence_outside_repository', path, message: 'Gate evidence resolves outside the repository.' });
    } else if (!(await stat(target)).isFile()) {
      issues.push({ code: 'gate_evidence_not_file', path, message: 'Gate evidence must name a file, not a directory.' });
    }
  }
  return issues;
}

/** A regular file inside the checkout. A directory, or a symlink whose target lies outside it, is not evidence even though it exists. */
export async function isRegularFileInRepository(path: string): Promise<boolean> {
  const target = await realpath(path).catch(() => null);
  if (target === null) return false;
  return target.startsWith((await realpath(repositoryRoot)) + sep) && (await stat(target)).isFile();
}

/** The absolute location of `path` under `directory`, or null when it is absolute or climbs out of `directory`. */
export function resolveInside(directory: string, path: string): string | null {
  const absolute = resolve(directory, path);
  const within = relative(directory, absolute);
  return within === '..' || within.startsWith(`..${sep}`) ? null : absolute;
}

export async function validateSnapshot(snapshot: RegistrySnapshot): Promise<ValidationIssue[]> {
  return [
    ...validateCapabilities(snapshot), ...validateBacklog(snapshot), ...validateRegistryRecords(snapshot), ...validateWorkflows(snapshot),
    ...validateWorkspaceRegistry(snapshot), ...validateRoutes(snapshot), ...validateContracts(snapshot), ...validateRlsCoverage(snapshot), ...validateInception(snapshot),
    ...validateActivationGates(snapshot), ...validateOperationsReadiness(snapshot), ...await validateEvidence(snapshot),
  ];
}
