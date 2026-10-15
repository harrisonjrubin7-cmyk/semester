import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BacklogItem, CapabilityRecord, PlatformManifest, RegistryRecord, WorkflowRecord, WorkspaceRecord } from '../../../packages/platform-control/types.ts';
import type { Task } from '../../types.ts';

/**
 * The canonical ecosystem coverage registry.
 *
 * The scope of Semester is not restated here. It is read from
 * packages/platform-control/registry, the repository's implementation
 * control plane, whose validators already refuse an unevidenced claim. This
 * module joins that registry with the operator's own task state into one
 * coverage matrix, so a row's status comes from registry evidence and
 * operator execution records, never from an assertion.
 */
export interface EcosystemRegistry {
  manifest: PlatformManifest;
  workspaces: WorkspaceRecord[];
  capabilities: CapabilityRecord[];
  systems: RegistryRecord[];
  roles: RegistryRecord[];
  screens: RegistryRecord[];
  workflows: WorkflowRecord[];
  integrations: RegistryRecord[];
  controls: RegistryRecord[];
  documents: RegistryRecord[];
  tenants: RegistryRecord[];
  backlog: BacklogItem[];
}

export const COVERAGE_STATUSES = ['proposed', 'specified', 'in_progress', 'blocked', 'implemented', 'verified', 'deployed'] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export interface CoverageRow {
  identifier: string;
  kind: 'workspace' | 'capability' | 'system' | 'role' | 'screen' | 'workflow' | 'integration' | 'control' | 'document' | 'tenant' | 'backlog';
  system: string;
  workspace: string;
  module: string;
  userRole: string;
  screenOrWorkflow: string;
  requiredBehavior: string;
  dataDependencies: string[];
  permissions: string;
  integrationDependencies: string[];
  acceptanceCriteria: string;
  implementationStatus: CoverageStatus;
  verificationEvidence: string[];
  deploymentStatus: 'not_deployed' | 'staged' | 'production';
  blockers: string[];
  /** Operator tasks that reference this row by registry key. */
  tasks: Array<{ id: string; status: string }>;
}

function loadGroup<T>(root: string, group: string): T[] {
  const directory = resolve(root, 'registry', group);
  const out: T[] = [];
  for (const name of readdirSync(directory).filter((file) => file.endsWith('.json')).sort()) {
    const value: unknown = JSON.parse(readFileSync(resolve(directory, name), 'utf8'));
    if (Array.isArray(value)) out.push(...(value as T[])); else out.push(value as T);
  }
  return out;
}

export function loadEcosystemRegistry(repositoryRoot: string): EcosystemRegistry {
  const root = resolve(repositoryRoot, 'packages/platform-control');
  const manifests = loadGroup<PlatformManifest>(root, 'manifests');
  if (manifests.length !== 1) throw new Error(`Expected one platform manifest, found ${manifests.length}.`);
  return {
    manifest: manifests[0]!,
    workspaces: loadGroup(root, 'workspaces'), capabilities: loadGroup(root, 'capabilities'), systems: loadGroup(root, 'systems'), roles: loadGroup(root, 'roles'),
    screens: loadGroup(root, 'screens'), workflows: loadGroup(root, 'workflows'), integrations: loadGroup(root, 'integrations'), controls: loadGroup(root, 'controls'),
    documents: loadGroup(root, 'documents'), tenants: loadGroup(root, 'tenants'), backlog: loadGroup(root, 'backlog'),
  };
}

function recordStatus(status: RegistryRecord['status']): CoverageStatus {
  return status === 'designed' ? 'specified' : status;
}

function capabilityStatus(capability: CapabilityRecord): { status: CoverageStatus; deployment: CoverageRow['deploymentStatus'] } {
  const m = capability.maturity;
  const deployment = m.tenant_activated || m.monitored ? 'production' : m.staged ? 'staged' : 'not_deployed';
  if (m.e2e_tested) return { status: 'verified', deployment };
  if (m.user_interface || m.api) return { status: 'implemented', deployment };
  if (m.schema || m.policies) return { status: 'in_progress', deployment };
  if (m.designed) return { status: 'specified', deployment };
  return { status: 'proposed', deployment };
}

export function buildCoverageMatrix(registry: EcosystemRegistry, tasks: Task[]): CoverageRow[] {
  const tasksFor = (key: string) => tasks.filter((task) => task.registryKeys.includes(key)).map((task) => ({ id: task.id, status: task.status }));
  const rows: CoverageRow[] = [];
  const base = (identifier: string, kind: CoverageRow['kind'], fields: Partial<CoverageRow>): CoverageRow => ({
    identifier, kind, system: 'semester', workspace: '', module: '', userRole: '', screenOrWorkflow: '', requiredBehavior: '', dataDependencies: [], permissions: '',
    integrationDependencies: [], acceptanceCriteria: '', implementationStatus: 'proposed', verificationEvidence: [], deploymentStatus: 'not_deployed', blockers: [], tasks: tasksFor(identifier), ...fields,
  });

  for (const workspace of registry.workspaces) {
    rows.push(base(`workspace.${workspace.key}`, 'workspace', {
      workspace: workspace.key, module: workspace.family, userRole: workspace.audience, screenOrWorkflow: workspace.refs.workflows.join(', '),
      requiredBehavior: `${workspace.required_loop.actor} ${workspace.required_loop.action} ${workspace.required_loop.record}: ${workspace.required_loop.consequence_preview}`,
      dataDependencies: [workspace.data_classification], permissions: `pilot_required=${workspace.pilot_required}; activation=${workspace.activation}`,
      acceptanceCriteria: `Receipt: ${workspace.required_loop.receipt}; rollback: ${workspace.required_loop.revoke_or_rollback}`,
      implementationStatus: workspace.operational_ready ? 'verified' : recordStatus(workspace.status), verificationEvidence: [...workspace.refs.tests, ...workspace.evidence],
      deploymentStatus: workspace.refs.deployments.length ? 'staged' : 'not_deployed', blockers: workspace.gaps,
    }));
  }
  for (const capability of registry.capabilities) {
    const { status, deployment } = capabilityStatus(capability);
    rows.push(base(`capability.${capability.key}`, 'capability', {
      workspace: capability.workspace, module: capability.domain, userRole: Object.entries(capability.roles).filter(([, grant]) => grant !== 'none').map(([role]) => role).join(', '),
      screenOrWorkflow: capability.routes.join(', '), requiredBehavior: capability.name, dataDependencies: capability.systems, permissions: Object.entries(capability.roles).map(([role, grant]) => `${role}=${grant}`).join('; '),
      integrationDependencies: capability.systems.filter((system) => system.startsWith('integrations.')), acceptanceCriteria: `events: ${capability.events.join(', ')}`,
      implementationStatus: status, verificationEvidence: Object.values(capability.evidence).flat().map((reference) => reference.path), deploymentStatus: deployment,
      blockers: capability.risk === 'critical' || capability.risk === 'high' ? [`risk=${capability.risk}; data=${capability.data_classification}`] : [],
    }));
  }
  const simple = (group: RegistryRecord[], kind: CoverageRow['kind']) => {
    for (const record of group) rows.push(base(`${kind}.${record.key}`.replace(/^control\.control\./, 'control.'), kind, { requiredBehavior: record.name, implementationStatus: recordStatus(record.status), verificationEvidence: record.evidence, blockers: record.status === 'blocked' ? ['registry status: blocked'] : [] }));
  };
  simple(registry.systems, 'system'); simple(registry.roles, 'role'); simple(registry.screens, 'screen'); simple(registry.integrations, 'integration');
  simple(registry.controls, 'control'); simple(registry.documents, 'document'); simple(registry.tenants, 'tenant');
  for (const workflow of registry.workflows) {
    rows.push(base(`workflow.${workflow.key}`, 'workflow', { screenOrWorkflow: workflow.key, requiredBehavior: `${workflow.name}: ${workflow.initial} → ${workflow.terminal.join('|') || 'continuous'}`, permissions: `escalation=${workflow.escalation_role}`, acceptanceCriteria: `idempotency=${workflow.idempotency}; retry=${workflow.retry_policy}`, implementationStatus: recordStatus(workflow.status), verificationEvidence: workflow.evidence }));
  }
  for (const item of registry.backlog) {
    const status: CoverageStatus = item.state === 'verified' ? 'verified' : item.state === 'blocked' ? 'blocked' : item.state === 'in_progress' ? 'in_progress' : 'specified';
    rows.push(base(item.id, 'backlog', { requiredBehavior: item.name, dataDependencies: item.depends_on, permissions: `owner=${item.owner}`, acceptanceCriteria: item.registry_keys.join(', '), implementationStatus: status, verificationEvidence: item.evidence, blockers: item.blockers }));
  }
  return rows;
}

export function coverageSummary(rows: CoverageRow[]): Record<CoverageStatus, number> {
  const out = Object.fromEntries(COVERAGE_STATUSES.map((status) => [status, 0])) as Record<CoverageStatus, number>;
  for (const row of rows) out[row.implementationStatus] += 1;
  return out;
}
