export const INTELLIGENCE_GATEWAY_VERSION = 1 as const;

export type IntelligenceFeatureState = 'off' | 'preview' | 'sandbox' | 'production';
export type IntelligenceMode = 'explain' | 'hint' | 'practice' | 'review' | 'draft';

export interface IntelligenceGatewayAction {
  id: string;
  label: string;
  effect: string;
  target: string;
  class: 'prepare' | 'internal-write' | 'consequential';
  reversible: boolean;
  evidenceIds: string[];
}

export interface IntelligenceGatewayRequest {
  version: 1;
  /** Informational only. The gateway always loads policy server-side. */
  clientState: IntelligenceFeatureState;
  tenantId: string;
  personId: string;
  question: string;
  mode: IntelligenceMode;
  category: string;
  sourceIds: string[];
  evidenceIds: string[];
  proposedActions: IntelligenceGatewayAction[];
}

export interface IntelligenceGatewayResponse {
  version: 1;
  text: string;
  evidenceIds: string[];
  mode: IntelligenceMode;
  route: { provider: string; model: string };
  usage: { inputTokens: number; outputTokens: number; estimatedCents: number };
  actions: IntelligenceGatewayAction[];
}

export interface ActionReceipt {
  id: string;
  actionId: string;
  status: 'completed' | 'pending';
  message: string;
  recordedAt: string;
  authoritative: true;
}

export interface TenantIntelligencePolicy {
  state: IntelligenceFeatureState;
  permittedRoles: string[];
  allowedModes: IntelligenceMode[];
  allowedModels: string[];
  maxRequestCents: number;
  monthlyBudgetCents?: number;
  monthlySpentCents?: number;
  retentionDays: number;
}

export interface ModelCandidate {
  model: string;
  provider: string;
  estimatedCents: number;
}

export interface ModelTask {
  candidates: ModelCandidate[];
}

export interface ModelRoute extends ModelCandidate {}

const modes = new Set<IntelligenceMode>(['explain', 'hint', 'practice', 'review', 'draft']);
const states = new Set<IntelligenceFeatureState>(['off', 'preview', 'sandbox', 'production']);

const strings = (value: unknown, name: string, maximum: number): string[] => {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => typeof item !== 'string' || !item || item.length > 300)) {
    throw new Error(`Invalid ${name}.`);
  }
  return [...new Set(value as string[])];
};

export function parseIntelligenceGatewayRequest(value: unknown): IntelligenceGatewayRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid intelligence request.');
  const input = value as Record<string, unknown>;
  if (input.version !== INTELLIGENCE_GATEWAY_VERSION) throw new Error('Unsupported intelligence contract version.');
  if (!states.has(input.clientState as IntelligenceFeatureState)) throw new Error('Invalid client feature state.');
  if (!modes.has(input.mode as IntelligenceMode)) throw new Error('Invalid academic-integrity mode.');
  for (const key of ['tenantId', 'personId', 'question', 'category'] as const) {
    const item = input[key];
    const limit = key === 'question' ? 10_000 : 200;
    if (typeof item !== 'string' || !item.trim() || item.length > limit) throw new Error(`Invalid ${key}.`);
  }
  const sourceIds = strings(input.sourceIds, 'source identifiers', 100);
  const evidenceIds = strings(input.evidenceIds, 'evidence identifiers', 200);
  if (!Array.isArray(input.proposedActions) || input.proposedActions.length > 20) {
    throw new Error('Invalid proposed actions.');
  }
  const actions = input.proposedActions.map((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid proposed action.');
    const action = raw as Record<string, unknown>;
    const klass = action.class;
    if (!['prepare', 'internal-write', 'consequential'].includes(String(klass))) throw new Error('Invalid action class.');
    for (const key of ['id', 'label', 'effect', 'target'] as const) {
      if (typeof action[key] !== 'string' || !(action[key] as string).trim() || (action[key] as string).length > 500) {
        throw new Error('Invalid proposed action.');
      }
    }
    if (typeof action.reversible !== 'boolean') throw new Error('Invalid proposed action.');
    return {
      id: action.id as string,
      label: action.label as string,
      effect: action.effect as string,
      target: action.target as string,
      class: klass as IntelligenceGatewayAction['class'],
      reversible: action.reversible,
      evidenceIds: strings(action.evidenceIds, 'action evidence identifiers', 100),
    };
  });
  return {
    version: 1,
    clientState: input.clientState as IntelligenceFeatureState,
    tenantId: input.tenantId as string,
    personId: input.personId as string,
    question: (input.question as string).trim(),
    mode: input.mode as IntelligenceMode,
    category: input.category as string,
    sourceIds,
    evidenceIds,
    proposedActions: actions,
  };
}

export function chooseModel(
  policy: { allowedModels: string[]; maxCents: number },
  task: ModelTask,
): ModelRoute {
  const ceiling = Number.isFinite(policy.maxCents) ? Math.max(0, policy.maxCents) : 0;
  const allowed = new Set(policy.allowedModels);
  const choices = task.candidates
    .filter((candidate) =>
      allowed.has(candidate.model) &&
      Number.isFinite(candidate.estimatedCents) &&
      candidate.estimatedCents >= 0 &&
      candidate.estimatedCents <= ceiling,
    )
    .sort((a, b) => a.estimatedCents - b.estimatedCents || a.model.localeCompare(b.model));
  if (!choices[0]) throw new Error('No allowed model fits the tenant cost ceiling.');
  return { ...choices[0] };
}
