export const MATURITY_STAGES = [
  'designed',
  'schema',
  'policies',
  'api',
  'user_interface',
  'e2e_tested',
  'staged',
  'production_ready',
  'tenant_activated',
  'monitored',
] as const;

export type MaturityStage = (typeof MATURITY_STAGES)[number];
export type Maturity = Record<MaturityStage, boolean>;
export const EVIDENCE_KINDS = [
  'design', 'schema', 'code', 'test', 'deployment', 'approval', 'activation', 'monitoring',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export interface EvidenceReference { path: string; kind: EvidenceKind }
export type MaturityEvidence = Partial<Record<MaturityStage, EvidenceReference[]>>;

export interface CapabilityRecord {
  key: string;
  name: string;
  domain: string;
  workspace: string;
  phase: string;
  owner: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  data_classification: 'public' | 'internal' | 'confidential' | 'restricted';
  roles: Record<string, 'full' | 'scoped' | 'audited' | 'none'>;
  systems: string[];
  routes: string[];
  commands: string[];
  events: string[];
  maturity: Maturity;
  evidence: MaturityEvidence;
}

export interface RegistryRecord {
  key: string;
  name: string;
  owner: string;
  status: 'designed' | 'implemented' | 'verified' | 'blocked';
  evidence: string[];
  [key: string]: unknown;
}

export interface WorkflowRecord extends RegistryRecord {
  version: number;
  initial: string;
  terminal: string[];
  /** Long-running evaluation loops have no terminal state, but every state must still have an exit. */
  continuous: boolean;
  /** Per-cycle states that issue completed receipts before a continuous workflow may begin another cycle. */
  cycle_outcomes: string[];
  states: string[];
  transitions: Record<string, string[]>;
  idempotency: string;
  retry_policy: string;
  escalation_role: string;
  runbook: string;
}

export interface BacklogItem {
  id: string;
  name: string;
  owner: string;
  state: 'planned' | 'in_progress' | 'blocked' | 'verified';
  registry_keys: string[];
  depends_on: string[];
  evidence: string[];
  blockers: string[];
}

export interface PlatformManifest extends RegistryRecord {
  canonical_domain: string;
  workspace_families: string[];
  pilot_release_scopes: string[];
}

export interface WorkspaceOperationalLoop {
  actor: string;
  record: string;
  action: string;
  consequence_preview: string;
  command: string;
  event: string;
  receipt: string;
  support: string;
  revoke_or_rollback: string;
}

export interface WorkspaceEvidenceRefs {
  routes: string[];
  capabilities: string[];
  workflows: string[];
  code: string[];
  tests: string[];
  deployments: string[];
  activations: string[];
}

export interface WorkspaceRecord extends RegistryRecord {
  family: string;
  audience: string;
  data_classification: string;
  support_queue: string;
  pilot_required: boolean;
  operational_ready: boolean;
  activation: 'disabled' | 'approved' | 'active';
  required_loop: WorkspaceOperationalLoop;
  refs: WorkspaceEvidenceRefs;
  gaps: string[];
}

export interface RegistrySnapshot {
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
  /** Optional while focused validator tests construct bounded snapshots. Full registry validation requires one manifest. */
  manifests?: PlatformManifest[];
  /** Optional while focused validator tests construct bounded snapshots. Full registry validation requires the pilot scope roster. */
  workspaces?: WorkspaceRecord[];
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}
