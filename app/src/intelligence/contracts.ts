export type FeatureState = 'off' | 'preview' | 'sandbox' | 'production';
export type IntegrityMode = 'explain' | 'hint' | 'practice' | 'review' | 'draft';
export type SourceOrigin = 'course' | 'institution' | 'student' | 'web' | 'inference';

export interface Scope {
  tenantId: string;
  role: string;
  personId: string;
  resourceId?: string;
}

export interface EvidenceReference {
  id: string;
  sourceId: string;
  origin: SourceOrigin;
  title: string;
  locator: string;
  excerpt: string;
  verifiedAt: string;
  authority: 'authoritative' | 'confirmed' | 'unverified' | 'inferred';
  scope: Scope;
  confidence?: number;
}

export interface ContextEnvelope {
  scope: Scope;
  screen: string;
  courseId?: string;
  assignmentId?: string;
  deadlineId?: string;
  sourceIds: string[];
  evidenceIds: string[];
  policyId: string;
  consentIds: string[];
  integrityMode: IntegrityMode;
  timezone: string;
  assembledAt: string;
}

export interface ProposedAction {
  id: string;
  label: string;
  effect: string;
  target: string;
  before: unknown;
  after: unknown;
  evidenceIds: string[];
  class: 'prepare' | 'internal-write' | 'consequential';
  reversible: boolean;
  status: 'proposed' | 'confirmed' | 'applied' | 'failed' | 'dismissed';
  receipt?: string;
}

export interface IntelligenceResponse {
  text: string;
  evidence: EvidenceReference[];
  informationUsed: string[];
  origins: SourceOrigin[];
  mode: IntegrityMode;
  policyReason?: string;
  uncertainty?: string;
  actions: ProposedAction[];
}

export interface IntegrityPolicy {
  allowed: readonly IntegrityMode[];
  reason?: string;
}

export interface IntegrityDecision {
  requested: IntegrityMode;
  effective: IntegrityMode | null;
  restricted: boolean;
  reason: string;
}

export function effectiveIntegrityMode(
  requested: IntegrityMode,
  policy: IntegrityPolicy,
): IntegrityDecision {
  if (policy.allowed.includes(requested)) {
    return { requested, effective: requested, restricted: false, reason: policy.reason ?? '' };
  }
  return {
    requested,
    effective: policy.allowed[0] ?? null,
    restricted: true,
    reason: policy.reason ?? 'This mode is not permitted by the current policy.',
  };
}

export function scopeKey(scope: Scope): string {
  return [scope.tenantId, scope.role, scope.personId, scope.resourceId]
    .filter((part): part is string => part !== undefined)
    .join(':');
}
