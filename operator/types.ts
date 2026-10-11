/**
 * Canonical types of the Semester Operator.
 *
 * Everything an agent, a control module or the operator interface exchanges
 * is one of these. Workers never see a wider type than the one named here.
 */

export const RISK_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** What a run may do. Every agent starts in observe; a task grants develop or operate, never the worker. */
export const OPERATING_MODES = ['observe', 'develop', 'operate'] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

/** Which credentials and targets a run faces. Production is never reached from a coding workspace. */
export const ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const TOOL_NAMES = [
  'read_file', 'list_files', 'search', 'write_file', 'run_check', 'git_diff',
  'registry_read', 'store_read', 'model', 'release_adapter', 'external_send',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** Tools that only read. Granting one never lets a worker change anything. */
export const READ_ONLY_TOOLS: readonly ToolName[] = ['read_file', 'list_files', 'search', 'git_diff', 'registry_read', 'store_read'];

export const TASK_STATUSES = [
  'proposed', 'ready', 'blocked', 'running', 'awaiting_approval', 'awaiting_verification',
  'verified', 'rejected', 'failed', 'cancelled', 'interrupted',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TERMINAL_STATUSES: readonly TaskStatus[] = ['verified', 'rejected', 'cancelled'];

export interface Goal {
  id: string;
  title: string;
  requestedBy: string;
  /** Where the goal's authority comes from: a document path, a decision, a request record. */
  source: string;
  status: 'open' | 'closed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export type AcceptanceCheck =
  | { kind: 'file_exists'; path: string }
  | { kind: 'file_contains'; path: string; text: string }
  | { kind: 'command_passed'; command: string }
  | { kind: 'policy_denied'; code: string }
  | { kind: 'manual'; note: string };

export interface AcceptanceCriterion { id: string; statement: string; check: AcceptanceCheck }

export interface ExecutionLimits {
  maxTurns: number;
  maxToolCalls: number;
  maxElapsedMs: number;
  maxRetries: number;
  maxConcurrent: number;
  /** Cost evidence is only tracked when a model port reports it; absent means unmetered, not free. */
  costCeilingUsd?: number;
}

export interface Task {
  id: string;
  goalId: string;
  type: string;
  title: string;
  agentId: string;
  status: TaskStatus;
  priority: number;
  dependsOn: string[];
  /** The task whose structured result proposed this one, when it came from a handoff. */
  parentId?: string;
  /** Handoff depth from the goal's root task. Bounded by the scheduler. */
  depth: number;
  dedupeKey: string;
  acceptance: AcceptanceCriterion[];
  /** Task-type-specific structured input. Prose is never a spec. */
  spec: Record<string, unknown>;
  /** Registry keys this task advances, for the coverage matrix. */
  registryKeys: string[];
  /** Granted by the coordinator from the agent contract. A worker cannot change it. */
  mode: OperatingMode;
  environment: Environment;
  limits: ExecutionLimits;
  /** Relative path (under the state directory) of the isolated workspace this task works in, once created. */
  workspace?: string;
  attempts: number;
  lastError?: string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type EvidenceItem =
  | { kind: 'command'; label: string; command: string; cwd: string; exitCode: number; stdoutSha256: string; stderrSha256: string; tail: string }
  | { kind: 'diff'; label: string; sha256: string; files: string[]; bytes: number }
  | { kind: 'file'; label: string; path: string; sha256: string; bytes: number }
  | { kind: 'check'; label: string; criterion: string; passed: boolean; detail: string }
  | { kind: 'decision'; label: string; tool: ToolName; target: string; allowed: boolean; code: string }
  | { kind: 'note'; label: string; detail: string };

export type WorkerOutcome = 'completed' | 'blocked' | 'failed' | 'needs_approval' | 'accepted' | 'rejected' | 'insufficient_evidence';

/** The structured return every agent contract requires. */
export interface WorkerReport {
  taskId: string;
  agentId: string;
  outcome: WorkerOutcome;
  status: string;
  evidenceInspected: string[];
  changes: string[];
  verification: Array<{ name: string; passed: boolean; detail: string }>;
  risks: string[];
  approvalsRequired: string[];
  artifacts: string[];
  nextStep: string;
  /** Proposed follow-on work. Queued only by the scheduler, only along an allowed route, only when handoffs are enabled. */
  handoffs: HandoffProposal[];
}

export interface HandoffProposal { agentId: string; type: string; title: string; acceptance: AcceptanceCriterion[]; spec: Record<string, unknown>; registryKeys?: string[] }

export interface ExecutionUsage { turns: number; toolCalls: number; elapsedMs: number; retries: number; costUsd?: number }

export interface ExecutionRecord {
  id: string;
  taskId: string;
  agentId: string;
  status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted' | 'blocked';
  startedAt: string;
  endedAt?: string;
  usage: ExecutionUsage;
  evidence: EvidenceItem[];
  report?: WorkerReport;
  /** External side effects that were started and whose outcome is not known. Never repeated automatically. */
  pendingExternalActions: string[];
}

export interface Approval {
  id: string;
  /** When set, only that task may consume the approval. */
  taskId?: string;
  tool: ToolName;
  target: string;
  /** Hash of the exact reviewed artifact (a diff, a build), when the action releases one. */
  artifactHash?: string;
  payloadHash: string;
  approver: string;
  grantedAt: string;
  expiresAt: string;
  usesAllowed: number;
  usesConsumed: number;
  consumedBy: string[];
  revoked: boolean;
}

export interface AuditEvent {
  seq: number;
  at: string;
  actor: string;
  kind: string;
  taskId?: string;
  detail: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface KillSwitchState { engaged: boolean; reason?: string; by?: string; at?: string }

export interface ScheduleEntry {
  key: string;
  agentId: string;
  type: string;
  title: string;
  goalId: string;
  /** ISO-8601 period, e.g. P1D. A schedule creates one bounded task per period and nothing else. */
  period: 'P1D' | 'P7D' | 'P30D';
  spec: Record<string, unknown>;
  acceptance: AcceptanceCriterion[];
  registryKeys: string[];
}

export interface ToolAction {
  tool: ToolName;
  /** A path for file tools, a command key for run_check, a target name for adapters. */
  target: string;
  payloadHash?: string;
  /** Hash of the exact reviewed artifact an action releases; an approval bound to one is consumed only by the same hash. */
  artifactHash?: string;
  risk: RiskLevel;
  /** Leaves the repository: deploys, sends, purchases, publishes. */
  external?: boolean;
}

export interface PolicyContext {
  taskId: string;
  agentId: string;
  mode: OperatingMode;
  environment: Environment;
  /** Absolute path of the isolated workspace. Empty when the agent has no write tools. */
  workspaceRoot: string;
  repositoryRoot: string;
  allowedWrites: string[];
  agentTools: readonly ToolName[];
}

export interface PolicyDecision { allowed: boolean; code: string; reason: string; requiresApproval: boolean }

export interface PolicySet {
  version: number;
  /** Paths no worker may write, even inside its workspace. Globs relative to the repository root. */
  protectedPaths: string[];
  /** Paths no worker may read. */
  protectedReads: string[];
  /** Command keys run_check may execute, with the exact argv. */
  commands: Record<string, { argv: string[]; cwd: string; timeoutMs: number }>;
  /** Risk at or above which an approval is required even in development. */
  approvalRequiredFrom: RiskLevel;
  /** Environments in which every write or external action requires approval. */
  approvalEnvironments: Environment[];
}

export interface AgentContract {
  id: string;
  key: string;
  name: string;
  group: 'coordination' | 'experience' | 'backend' | 'quality' | 'customer' | 'company' | 'module';
  purpose: string;
  prompt: string;
  taskTypes: string[];
  requiredInputs: string[];
  tools: ToolName[];
  allowedWrites: string[];
  prohibited: string[];
  acceptance: string[];
  verification: string[];
  limits: ExecutionLimits;
  escalation: string[];
  /** The 12-role suite (Semester agent suite, §1) this agent belongs to. */
  suite: string;
  /** deterministic: runs without a model. model: needs a model port. hybrid: deterministic path exists, model path adds judgement. */
  implementation: 'deterministic' | 'model' | 'hybrid';
}

export interface ModuleAgentContract extends AgentContract {
  group: 'module';
  moduleKey: string;
  owningWorkspace: string;
  roles: string[];
  screens: string[];
  workflows: string[];
  entities: string[];
  permissions: string[];
  integrations: string[];
  operationalDependencies: string[];
}
