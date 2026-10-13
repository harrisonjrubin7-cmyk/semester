// Operator health events. Every alert names an accountable owner, the affected scope,
// a known-safe action and a durable case. Contract: docs/assurance/assurance-model.yaml.

export const HEALTH_CATEGORIES = [
  'source_freshness',
  'authorization',
  'workflow',
  'integration',
  'accessibility',
  'security',
  'privacy',
  'support',
  'release',
  'evidence',
] as const;
export type HealthCategory = (typeof HEALTH_CATEGORIES)[number];

export const HEALTH_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type HealthSeverity = (typeof HEALTH_SEVERITIES)[number];

export const HEALTH_STATES = ['open', 'acknowledged', 'investigating', 'mitigated', 'closed'] as const;
export type HealthState = (typeof HEALTH_STATES)[number];

export interface HealthScope {
  tenantId?: string;
  cohortId?: string;
  sourceSystem?: string;
  workflowId?: string;
  releaseId?: string;
}

export interface HealthEvent {
  id: string;
  tenantId?: string;
  category: HealthCategory;
  severity: HealthSeverity;
  state: HealthState;
  summary: string;
  affectedCapability: string;
  affectedScope: HealthScope;
  safeImmediateAction?: string;
  accountableOwner: string;
  escalationOwner?: string;
  dueAt?: string;
  correlationId: string;
  evidenceReferences: string[];
  createdAt: string;
  updatedAt: string;
}

const TRANSITIONS: Record<HealthState, readonly HealthState[]> = {
  open: ['acknowledged', 'investigating'],
  acknowledged: ['investigating', 'mitigated'],
  investigating: ['mitigated'],
  mitigated: ['investigating', 'closed'],
  closed: [],
};

const SCOPE_KEYS: readonly (keyof HealthScope)[] = ['tenantId', 'cohortId', 'sourceSystem', 'workflowId', 'releaseId'];

const present = (value: string | undefined): boolean => typeof value === 'string' && value.trim().length > 0;

/** Every rule the event breaks. An empty list means the event may be stored. */
export function healthEventProblems(event: HealthEvent): string[] {
  const problems: string[] = [];
  if (!present(event.id)) problems.push('id is required');
  if (!present(event.summary)) problems.push('summary is required');
  if (!present(event.affectedCapability)) problems.push('affectedCapability is required');
  if (!present(event.accountableOwner)) problems.push('accountableOwner is required');
  if (!present(event.correlationId)) problems.push('correlationId is required');
  if (!(HEALTH_CATEGORIES as readonly string[]).includes(event.category)) problems.push(`unknown category: ${event.category}`);
  if (!(HEALTH_SEVERITIES as readonly string[]).includes(event.severity)) problems.push(`unknown severity: ${event.severity}`);
  if (!(HEALTH_STATES as readonly string[]).includes(event.state)) problems.push(`unknown state: ${event.state}`);
  if (!SCOPE_KEYS.some((key) => present(event.affectedScope?.[key]))) {
    problems.push('affectedScope must name at least one scope key');
  }
  if ((event.severity === 'critical' || event.severity === 'high') && !present(event.safeImmediateAction)) {
    problems.push('critical and high events need a safeImmediateAction');
  }
  if (event.state === 'closed' && event.evidenceReferences.length === 0) {
    problems.push('a closed event needs evidenceReferences');
  }
  const created = Date.parse(event.createdAt);
  const updated = Date.parse(event.updatedAt);
  if (Number.isNaN(created)) problems.push('createdAt must be an ISO timestamp');
  if (Number.isNaN(updated)) problems.push('updatedAt must be an ISO timestamp');
  else if (!Number.isNaN(created) && updated < created) problems.push('updatedAt is before createdAt');
  if (event.dueAt !== undefined && Number.isNaN(Date.parse(event.dueAt))) problems.push('dueAt must be an ISO timestamp');
  return problems;
}

export type HealthTransition = { ok: true; event: HealthEvent } | { ok: false; reason: string };

/** Moves an event along the allowed state path. Closing requires evidence; the result is re-validated. */
export function transitionHealthEvent(event: HealthEvent, to: HealthState, at: string): HealthTransition {
  if (!TRANSITIONS[event.state].includes(to)) {
    return { ok: false, reason: `cannot move from ${event.state} to ${to}` };
  }
  const next: HealthEvent = { ...event, state: to, updatedAt: at };
  const problems = healthEventProblems(next);
  if (problems.length > 0) return { ok: false, reason: problems.join('; ') };
  return { ok: true, event: next };
}
