import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { RegistrySnapshot, ValidationIssue } from '../types.ts';
import { validateCapabilities } from '../validators/capability-validator.ts';
import { validateBacklog } from '../validators/backlog-validator.ts';
import { validateRegistryRecords } from '../validators/control-validator.ts';
import { validateContracts } from '../validators/contract-validator.ts';
import { validateRlsCoverage } from '../validators/rls-validator.ts';
import { validateRoutes } from '../validators/route-validator.ts';
import { validateWorkflows } from '../validators/workflow-validator.ts';
import { validateWorkspaceEvidence, validateWorkspaceRegistry, type WorkspaceEvidenceValidationContext } from '../validators/workspace-validator.ts';
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
  for (const path of [...paths].sort()) {
    try { await access(resolve(repositoryRoot, path)); }
    catch { issues.push({ code: 'missing_evidence_path', path, message: 'Evidence path does not exist in the repository.' }); }
  }
  return issues;
}

export async function validateSnapshot(snapshot: RegistrySnapshot): Promise<ValidationIssue[]> {
  const execute = promisify(execFile);
  const { stdout } = await execute('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot });
  const releaseEnvironment = process.env.SEMESTER_RELEASE_ENVIRONMENT;
  const evidenceContext: WorkspaceEvidenceValidationContext = {
    targetRevision: stdout.trim(), now: new Date().toISOString(),
    targetTenant: process.env.SEMESTER_RELEASE_TENANT,
    targetEnvironment: releaseEnvironment === 'staging' || releaseEnvironment === 'production' ? releaseEnvironment : undefined,
    targetSchema: process.env.SEMESTER_EVIDENCE_SCHEMA ?? 'workspace-evidence/v1',
    targetConfig: process.env.SEMESTER_EVIDENCE_CONFIG ?? 'source-tree',
    targetPolicy: process.env.SEMESTER_EVIDENCE_POLICY ?? 'platform-control',
    readArtifact: async (revision, path) => {
      if (!/^[0-9a-f]{40}$/i.test(revision) || path.startsWith('/') || path.split('/').includes('..')) return null;
      try { return (await execute('git', ['show', `${revision}:${path}`], { cwd: repositoryRoot, encoding: 'buffer', maxBuffer: 20 * 1024 * 1024 })).stdout; }
      catch { return null; }
    },
  };
  return [
    ...validateCapabilities(snapshot), ...validateBacklog(snapshot), ...validateRegistryRecords(snapshot), ...validateWorkflows(snapshot),
    ...validateWorkspaceRegistry(snapshot), ...await validateWorkspaceEvidence(snapshot, evidenceContext), ...validateRoutes(snapshot), ...validateContracts(snapshot), ...validateRlsCoverage(snapshot), ...await validateEvidence(snapshot),
  ];
}
