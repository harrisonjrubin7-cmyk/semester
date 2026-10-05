import {
  effectiveIntegrityMode,
  type ContextEnvelope,
  type EvidenceReference,
  type IntegrityDecision,
  type IntegrityMode,
  type Scope,
} from './contracts';

export type IntelligenceProviderRoute =
  | 'managed'
  | 'anthropic'
  | 'openai'
  | 'local'
  | 'unavailable';

export interface IntelligenceRequest {
  question: string;
  context: ContextEnvelope;
  evidence: EvidenceReference[];
  policyDecision: IntegrityDecision;
  providerRoute: IntelligenceProviderRoute;
}

export interface AssembleIntelligenceInput {
  question: string;
  scope: Scope;
  screen: string;
  courseId?: string;
  assignmentId?: string;
  deadlineId?: string;
  visibleSourceIds: readonly string[];
  evidence: readonly EvidenceReference[];
  requestedMode: IntegrityMode;
  allowedModes: readonly IntegrityMode[];
  policyId: string;
  policyReason?: string;
  consentIds: readonly string[];
  timezone: string;
  providerRoute: IntelligenceProviderRoute;
  assembledAt?: string;
}

/**
 * The last client-side boundary before an intelligence request reaches any
 * model adapter. Only evidence explicitly named by the active screen provider
 * can cross it, and policy is evaluated from the supplied current policy on
 * every call rather than cached with a conversation.
 */
export function assembleIntelligenceRequest(
  input: AssembleIntelligenceInput,
): IntelligenceRequest {
  const policyDecision = effectiveIntegrityMode(input.requestedMode, {
    allowed: input.allowedModes,
    reason: input.policyReason,
  });
  if (!policyDecision.effective) {
    throw new Error('No integrity mode is permitted by the current policy.');
  }

  const sourceIds = [...new Set(input.visibleSourceIds.filter(Boolean))];
  const visible = new Set(sourceIds);
  const evidence = input.evidence.filter(
    (item) =>
      visible.has(item.sourceId) &&
      item.scope.tenantId === input.scope.tenantId &&
      item.scope.personId === input.scope.personId,
  );

  return {
    question: input.question.trim(),
    context: {
      scope: { ...input.scope },
      screen: input.screen,
      ...(input.courseId ? { courseId: input.courseId } : {}),
      ...(input.assignmentId ? { assignmentId: input.assignmentId } : {}),
      ...(input.deadlineId ? { deadlineId: input.deadlineId } : {}),
      sourceIds,
      evidenceIds: evidence.map((item) => item.id),
      policyId: input.policyId,
      consentIds: [...new Set(input.consentIds.filter(Boolean))],
      integrityMode: policyDecision.effective,
      timezone: input.timezone,
      assembledAt: input.assembledAt ?? new Date().toISOString(),
    },
    evidence,
    policyDecision,
    providerRoute: input.providerRoute,
  };
}
