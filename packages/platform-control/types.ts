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

export type BacklogExecutionStatus = 'ready' | 'active' | 'sequencing_debt' | 'waiting' | 'blocked' | 'verified';

export interface BacklogExecutionItem extends BacklogItem {
  execution_status: BacklogExecutionStatus;
  open_dependencies: string[];
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
  /** Optional for the same reason. Full registry validation requires every inception group. */
  inception?: InceptionSnapshot;
  /** Optional while focused validator tests construct bounded snapshots. Full registry validation requires one gate per gated capability. */
  activationGates?: ActivationGate[];
  /** Current, operated support and recovery proof. Repository controls alone may leave this explicitly not ready. */
  operationsReadiness?: OperationsReadinessRecord[];
}

export const GATE_ITEM_STATUSES = ['passed', 'not_verified', 'failed'] as const;
export type GateItemStatus = (typeof GATE_ITEM_STATUSES)[number];

export interface ActivationGateItem {
  id: string;
  area: string;
  status: GateItemStatus;
  evidence: string[];
  gap: string;
}

export interface ActivationGate {
  key: string;
  capability: string;
  name: string;
  owner: string;
  /** Derived, never hand-set: `ready` only when every required item passed and a decision record exists. */
  status: 'not_ready' | 'ready';
  decision: { record: string | null; approvers: string[] };
  required: ActivationGateItem[];
}

export interface OperationsEvidenceItem {
  id: string;
  status: GateItemStatus;
  evidence: string[];
  /** When the target operation was observed; required for passed evidence. */
  observed_at: string | null;
  /** Named operated target, never `local`, `ci`, or repository-only proof. */
  environment: string | null;
  /** Exact deployed or exercised Git revision; required for passed evidence. */
  revision: string | null;
  /** Required for passed operated evidence; an expired proof fails closed. */
  expires_at: string | null;
  gap: string;
}

export interface OperationsReadinessRecord {
  key: string;
  capability: string;
  owner: string;
  status: 'not_ready' | 'ready';
  roster: {
    primary_owner: string | null;
    backup_owner: string | null;
    support_hours: string | null;
    escalation_contacts_published: boolean;
  };
  required: OperationsEvidenceItem[];
  gaps: string[];
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}

/* ── Inception layer ─────────────────────────────────────────────────────
 *
 * The execution specification ("come on continue", 11 October 2026) asks for
 * one source of truth per deployable unit: tenant → workspace → capability →
 * screen → command → event → record → policy → integration → audit → owner →
 * runbook → tests → evidence. The groups below are that chain as registry
 * records. Every one is a claim about scope and ownership, not about
 * operation: a record here is "designed" until the capability it names has
 * maturity evidence, exactly as the workspace registry treats a pilot scope.
 */

export const VIEW_STATES = ['ready', 'loading', 'empty', 'error', 'forbidden', 'offline', 'stale'] as const;
export type ViewState = (typeof VIEW_STATES)[number];

export const CONNECTION_STATES = ['confirmed', 'pending', 'updating', 'stale', 'blocked', 'degraded', 'reconcile', 'resolved'] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const CONNECTION_TYPES = ['authority', 'reference', 'derived', 'delegated'] as const;
export type ConnectionType = (typeof CONNECTION_TYPES)[number];

export const RECORD_LIFECYCLE_STATES = [
  'created', 'validated', 'pending_review', 'approved', 'active', 'suspended', 'expired', 'revoked', 'archived', 'retained_or_deleted',
] as const;
export type RecordLifecycleState = (typeof RECORD_LIFECYCLE_STATES)[number];

/** Health a registry file may declare. `healthy`, `stale` and `degraded` are observed at runtime and never written here. */
export const INTEGRATION_HEALTH = ['configured', 'pending_authorization', 'healthy', 'stale', 'degraded', 'blocked', 'disabled'] as const;
export type IntegrationHealth = (typeof INTEGRATION_HEALTH)[number];
export const DECLARABLE_INTEGRATION_HEALTH: readonly IntegrationHealth[] = ['configured', 'pending_authorization', 'blocked', 'disabled'];

/** The scope segment a permission key may end in: `resource.action.scope`. */
export const PERMISSION_SCOPES = [
  'own', 'tenant', 'company', 'production', 'assigned_section', 'assigned_caseload', 'assigned_community', 'assigned_queue', 'granted_scope', 'own_application',
] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export const OPERATIONS_CADENCES = ['every_deployment', 'daily', 'weekly', 'biweekly', 'monthly', 'per_term', 'end_of_term'] as const;
export type OperationsCadence = (typeof OPERATIONS_CADENCES)[number];

export interface OperatingSystemRecord extends RegistryRecord {
  /** The product family name the specification uses, e.g. "Student OS". */
  os_family: string;
  /** Logical routes, each beginning with `/`. A route may be shared only when `shared_routes` names the other system. */
  routes: string[];
  shared_routes: Record<string, string[]>;
  /** The pilot release scopes (workspace registry) this system is delivered through. */
  pilot_scopes: string[];
  /** The master-catalog domains (`docs/master/SEMESTER_DOMAIN_CATALOG.md`, D01–D40) this system covers. */
  master_domains: string[];
  /** The minimum events the specification requires this system to emit. */
  minimum_events: string[];
  /** Screens in the repository that serve this system today; evidence, not a completeness claim. */
  screens_in_repo: string[];
  gaps: string[];
}

export interface AuthorityConnectionRecord extends RegistryRecord {
  record: string;
  connection_type: ConnectionType;
  primary_authority: string;
  semester_action: string;
  reconciliation_required: boolean;
  lifecycle_owner: string;
  /** Only for `delegated`: the four properties every delegation must carry. */
  delegation?: { scope: boolean; purpose: boolean; expiry: boolean; revocation: boolean };
}

export interface RequiredEventRecord extends RegistryRecord {
  os: string;
  event: string;
  /** The `EVENT_TYPES` key in `packages/institution/src/events.ts` that carries this event, or null when none does yet. */
  catalog_event: string | null;
}

export interface PermissionRecord extends RegistryRecord {
  permission: string;
  os: string;
  roles: string[];
}

export interface JourneyRecord extends RegistryRecord {
  number: number;
  crosses: string[];
  tests: string[];
  gaps: string[];
}

export interface ScreenContractRecord extends RegistryRecord {
  workspace: string;
  route: string;
  title: string;
  roles: string[];
  capabilities: string[];
  records: string[];
  commands: string[];
  events: string[];
  audit_events: string[];
  states: string[];
  authority: { primary: string; semester_role: string; reconciliation_required: boolean };
  ai: { enabled: boolean; rule: string };
  operational_owner: string;
  runbook: string;
}

export interface AdapterRecord extends RegistryRecord {
  adapter: string;
  /** The `integrations` registry key this adapter is the deployment of, when one exists. */
  integration: string | null;
  domains: string[];
  required_behavior: string[];
  health: IntegrationHealth;
  credential_reference: string;
  sandbox_verified: boolean;
}

export interface CadenceRecord extends RegistryRecord {
  cadence: OperationsCadence;
  activity: string;
  accountable_owner: string;
}

export interface ServiceLevelRecord extends RegistryRecord {
  work_type: string;
  first_response: string;
  target_resolution: string;
  escalation: string;
}

export interface EvidenceArtifactRecord extends RegistryRecord {
  /** Path inside the release evidence pack, e.g. `test-results/rls.xml`. */
  artifact: string;
  /** The repository command or job that can produce it, or null when nothing can yet. */
  producer: string | null;
}

export interface LifecycleRecord extends RegistryRecord {
  states: string[];
  transitions: Record<string, string[]>;
  examples: Array<{ record: string; authority: string; lifecycle_owner: string }>;
}

export interface WorkstreamRecord extends RegistryRecord {
  letter: string;
  deliverables: string[];
  registry_groups: string[];
  gaps: string[];
}

export interface InceptionSnapshot {
  operating_systems: OperatingSystemRecord[];
  authority: AuthorityConnectionRecord[];
  events: RequiredEventRecord[];
  permissions: PermissionRecord[];
  journeys: JourneyRecord[];
  screen_contracts: ScreenContractRecord[];
  adapters: AdapterRecord[];
  cadence: CadenceRecord[];
  service_levels: ServiceLevelRecord[];
  evidence_pack: EvidenceArtifactRecord[];
  lifecycle: LifecycleRecord[];
  workstreams: WorkstreamRecord[];
  /** `EVENT_TYPES` keys read from `packages/institution/src/events.ts`, so a required event cannot claim a catalog entry that is not there. */
  event_catalog: string[];
}
