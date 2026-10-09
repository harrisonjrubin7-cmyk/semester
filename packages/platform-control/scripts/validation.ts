import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RegistrySnapshot, ValidationIssue } from '../types.ts';
import { validateCapabilities } from '../validators/capability-validator.ts';
import { validateBacklog } from '../validators/backlog-validator.ts';
import { validateRegistryRecords } from '../validators/control-validator.ts';
import { validateContracts } from '../validators/contract-validator.ts';
import { validateRlsCoverage } from '../validators/rls-validator.ts';
import { validateRoutes } from '../validators/route-validator.ts';
import { validateWorkflows } from '../validators/workflow-validator.ts';
import { repositoryRoot } from './registry-io.ts';

export async function validateEvidence(snapshot: RegistrySnapshot): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  const paths = new Set<string>();
  for (const capability of snapshot.capabilities) for (const values of Object.values(capability.evidence)) for (const path of values ?? []) paths.add(path);
  for (const group of [snapshot.systems, snapshot.roles, snapshot.screens, snapshot.workflows, snapshot.integrations, snapshot.controls, snapshot.documents, snapshot.tenants]) {
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
  return [
    ...validateCapabilities(snapshot), ...validateBacklog(snapshot), ...validateRegistryRecords(snapshot), ...validateWorkflows(snapshot),
    ...validateRoutes(snapshot), ...validateContracts(snapshot), ...validateRlsCoverage(snapshot), ...await validateEvidence(snapshot),
  ];
}
