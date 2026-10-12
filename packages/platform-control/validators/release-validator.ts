import type { RegistrySnapshot, ValidationIssue } from '../types.ts';
import { PILOT_RELEASE_SCOPES } from './workspace-validator.ts';

export interface WorkspaceReleaseDecision { scope: string; allowed: boolean; blockers: string[] }
export interface ReleaseDecision {
  allowed: boolean;
  issues: ValidationIssue[];
  blockedCapabilities: string[];
  blockedWorkspaces: string[];
  workspaceDecisions: WorkspaceReleaseDecision[];
  acceptanceCases: Array<{ id: string; status: string; blockers: string[] }>;
}

export function validateRelease(snapshot: RegistrySnapshot, evidenceValidated = false): ReleaseDecision {
  const blockedCapabilities = snapshot.capabilities.filter(({ maturity }) => !maturity.production_ready).map(({ key }) => key);
  const issues: ValidationIssue[] = blockedCapabilities.map((key) => ({
    code: 'capability_not_production_ready',
    path: `capabilities.${key}.maturity.production_ready`,
    message: `${key} lacks production-ready evidence.`,
  }));
  if (!evidenceValidated) issues.push({ code: 'evidence_validation_required', path: 'release.evidence', message: 'Release requires revision-bound artifact validation; booleans and reference strings are insufficient.' });
  const byScope = new Map<string, NonNullable<RegistrySnapshot['workspaces']>[number]>();
  for (const workspace of snapshot.workspaces ?? []) if (workspace && typeof workspace === 'object' && typeof workspace.key === 'string') byScope.set(workspace.key, workspace);
  const workspaceDecisions = PILOT_RELEASE_SCOPES.map((scope): WorkspaceReleaseDecision => {
    const record = byScope.get(scope);
    if (!record) {
      issues.push({ code: 'missing_release_scope', path: `workspaces.${scope}`, message: `${scope} is absent from the full-ecosystem release decision.` });
      return { scope, allowed: false, blockers: ['Scope is not registered.'] };
    }
    const blockers: string[] = [];
    if (!record.operational_ready) blockers.push('Operational readiness is false.');
    if (record.activation !== 'active') blockers.push(`Activation is ${record.activation}.`);
    const refs = record.refs && typeof record.refs === 'object' ? record.refs : null;
    if (!refs) blockers.push('Evidence references are malformed.');
    for (const group of ['routes', 'capabilities', 'workflows', 'code', 'tests', 'deployments', 'activations'] as const) {
      if (!refs || !Array.isArray(refs[group]) || refs[group].length === 0) blockers.push(`Missing ${group} evidence.`);
    }
    if (!Array.isArray(record.gaps)) blockers.push('Open gaps are malformed.');
    else for (const gap of record.gaps) blockers.push(`Open gap: ${gap}`);
    if (blockers.length > 0) issues.push({ code: 'workspace_not_operational', path: `workspaces.${scope}`, message: blockers.join(' ') });
    return { scope, allowed: blockers.length === 0, blockers };
  });
  const blockedWorkspaces = workspaceDecisions.filter(({ allowed }) => !allowed).map(({ scope }) => scope);
  const acceptanceCases: Array<{ id: string; status: string; blockers: string[] }> = [];
  for (const [index, entry] of (snapshot.manifests?.[0]?.acceptance_cases ?? []).entries()) {
    if (!entry || typeof entry !== 'object') {
      const id = `<invalid:${index}>`;
      const blockers = ['Acceptance case is malformed.'];
      issues.push({ code: 'malformed_acceptance_case', path: `manifests.semester.acceptance_cases.${index}`, message: blockers[0]! });
      acceptanceCases.push({ id, status: 'malformed', blockers });
      continue;
    }
    const gaps = Array.isArray(entry.gaps) ? entry.gaps : ['Acceptance gaps are malformed.'];
    const controls = Array.isArray(entry.controls) ? entry.controls : [];
    const controlBlockers = controls.flatMap((control) => {
      if (!control || typeof control !== 'object') return ['Acceptance control is malformed.'];
      return control.status === 'passed' ? [] : [`${control.name}: ${control.status}`];
    });
    const blockers = entry.status === 'passed' ? [] : [...gaps, ...controlBlockers];
    if (blockers.length > 0) issues.push({ code: 'acceptance_case_not_passed', path: `manifests.semester.acceptance_cases.${entry.id}`, message: blockers.join(' ') });
    acceptanceCases.push({ id: entry.id, status: entry.status, blockers });
  }
  if (acceptanceCases.length !== 8) issues.push({ code: 'acceptance_case_roster_drift', path: 'manifests.semester.acceptance_cases', message: 'Exactly eight cross-workspace acceptance cases are required.' });
  return { allowed: issues.length === 0, issues, blockedCapabilities, blockedWorkspaces, workspaceDecisions, acceptanceCases };
}
