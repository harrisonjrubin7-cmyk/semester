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
export type MaturityEvidence = Partial<Record<MaturityStage, string[]>>;

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
  states: string[];
  transitions: Record<string, string[]>;
  idempotency: string;
  retry_policy: string;
  escalation_role: string;
  runbook: string;
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
}

export interface ValidationIssue {
  code: string;
  path: string;
  message: string;
}
