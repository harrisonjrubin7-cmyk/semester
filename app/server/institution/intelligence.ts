import { randomUUID } from 'node:crypto';
import {
  chooseModel,
  parseIntelligenceGatewayRequest,
  type ActionReceipt,
  type IntelligenceGatewayAction,
  type IntelligenceGatewayRequest,
  type ModelTask,
  type TenantIntelligencePolicy,
  type UniversityIdentity,
} from '../../../packages/institution/src/index.ts';
import type {
  InstitutionModelProvider,
  ProviderGenerationRequest,
} from './providers/types.ts';

export interface ApprovedIntelligenceSource {
  id: string;
  evidenceIds: string[];
  /** Used only to assemble the provider request; never returned or journaled. */
  body: string;
}

export interface IntelligenceAuditRecord {
  category: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  policyDecision: string;
  actionId?: string;
  confirmation?: 'confirmed' | 'refused';
}

export interface IntelligenceBudgetReservation {
  id: string;
  reservedCents: number;
}

export interface IntelligenceRespondInput {
  identity: UniversityIdentity;
  request: IntelligenceGatewayRequest;
  tenantPolicy: TenantIntelligencePolicy;
  approvedSources: ApprovedIntelligenceSource[];
  modelTask: ModelTask;
  generate: InstitutionModelProvider['generate'];
  reserveBudget?: (
    identity: UniversityIdentity,
    maximumCents: number,
  ) => Promise<IntelligenceBudgetReservation | null>;
  settleBudget?: (
    identity: UniversityIdentity,
    reservation: IntelligenceBudgetReservation,
    usage: { costCents: number; inputTokens: number; outputTokens: number } | null,
  ) => Promise<boolean>;
  audit?: (identity: UniversityIdentity, record: IntelligenceAuditRecord) => void;
}

export interface GovernedAction extends IntelligenceGatewayAction {
  id: string;
  tenantId: string;
  personId: string;
  preparedAt: string;
  expiresAt: string;
}

export interface ExplicitConfirmation {
  confirmed: true;
  actorId: string;
  at: string;
}

export interface ConfirmActionInput {
  identity: UniversityIdentity;
  action: GovernedAction;
  confirmation: ExplicitConfirmation | null;
  now?: number;
  execute: (action: GovernedAction) => Promise<
    | { verified: false }
    | { verified: true; receiptId: string; message: string; recordedAt: string; status?: 'completed' | 'pending' }
  >;
  audit?: (identity: UniversityIdentity, record: IntelligenceAuditRecord) => void;
}

export interface IntelligenceResult {
  status: number;
  body: Record<string, unknown>;
}

const result = (status: number, body: Record<string, unknown>): IntelligenceResult => ({ status, body });
const PROVIDER_DEADLINE_MS = 20_000;
const MAX_OUTPUT_TOKENS = 1_200;

export async function respond(input: IntelligenceRespondInput): Promise<IntelligenceResult> {
  const { identity, request, tenantPolicy } = input;
  if (request.tenantId !== identity.institutionId || request.personId !== identity.userId) {
    return result(403, { code: 'scope-refused', message: 'The authenticated university scope does not match this request.' });
  }
  // clientState is intentionally not read here. A browser cannot promote a
  // server policy by claiming its build is production.
  if (tenantPolicy.state === 'off') {
    input.audit?.(identity, {
      category: request.category, provider: '', model: '', inputTokens: 0, outputTokens: 0,
      costCents: 0, policyDecision: 'policy-disabled',
    });
    return result(403, { code: 'policy-disabled', message: 'Semester Intelligence is disabled by verified tenant policy.' });
  }
  if (!identity.roles.some((role) => tenantPolicy.permittedRoles.includes(role))) {
    return result(403, { code: 'role-disabled', message: 'Semester Intelligence is not permitted for this verified role.' });
  }
  if (!tenantPolicy.allowedModes.includes(request.mode)) {
    return result(403, { code: 'mode-disabled', message: 'This academic-integrity mode is not permitted.' });
  }

  const requestedSources = new Set(request.sourceIds);
  const sources = input.approvedSources.filter((source) => requestedSources.has(source.id));
  if (requestedSources.size === 0 || sources.length !== requestedSources.size) {
    return result(403, {
      code: 'source-not-approved',
      message: 'Every source sent to Semester Intelligence must be approved for this tenant and account.',
    });
  }
  const allowedEvidence = new Set(sources.flatMap((source) => source.evidenceIds));
  const monthlyRemaining = Math.max(
    0,
    (tenantPolicy.monthlyBudgetCents ?? Number.POSITIVE_INFINITY) -
      (tenantPolicy.monthlySpentCents ?? 0),
  );

  let route;
  try {
    route = chooseModel(
      {
        allowedModels: tenantPolicy.allowedModels,
        maxCents: Math.min(tenantPolicy.maxRequestCents, monthlyRemaining),
      },
      input.modelTask,
    );
  } catch {
    return result(503, { code: 'model-unavailable', message: 'No tenant-approved model fits the current cost policy.' });
  }

  const providerRequest: ProviderGenerationRequest = {
    provider: route.provider,
    model: route.model.replace(`${route.provider}:`, ''),
    question: request.question,
    mode: request.mode,
    sources,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
  let reservation: IntelligenceBudgetReservation | null = null;
  if (input.reserveBudget) {
    try {
      reservation = await input.reserveBudget(identity, route.estimatedCents);
    } catch {
      return result(503, { code: 'budget-unavailable', message: 'The institution budget service is unavailable.' });
    }
    if (!reservation) {
      return result(429, { code: 'budget-exhausted', message: 'The institution AI budget is currently exhausted.' });
    }
  }
  let generated;
  try {
    generated = await input.generate(providerRequest, AbortSignal.timeout(PROVIDER_DEADLINE_MS));
  } catch {
    if (reservation && input.settleBudget) {
      try { await input.settleBudget(identity, reservation, null); } catch { /* reservation expiry is a server concern */ }
    }
    input.audit?.(identity, {
      category: request.category,
      provider: route.provider,
      model: route.model,
      inputTokens: 0,
      outputTokens: 0,
      costCents: 0,
      policyDecision: 'provider-refused',
    });
    return result(503, {
      code: 'provider-unavailable',
      message: 'The tenant-approved model provider could not complete this request.',
    });
  }
  if (
    !generated.text.trim() ||
    !Array.isArray(generated.citedSourceIds) ||
    generated.citedSourceIds.length === 0 ||
    generated.citedSourceIds.some((id) => !requestedSources.has(id)) ||
    !Number.isFinite(generated.inputTokens) ||
    !Number.isFinite(generated.outputTokens) ||
    generated.inputTokens < 0 ||
    generated.outputTokens < 0 ||
    generated.outputTokens > MAX_OUTPUT_TOKENS
  ) {
    if (reservation && input.settleBudget) {
      try { await input.settleBudget(identity, reservation, null); } catch { /* reservation expiry is a server concern */ }
    }
    return result(503, {
      code: 'invalid-provider-response',
      message: 'The tenant-approved provider returned an invalid or unmetered response.',
    });
  }
  const citedSources = new Set(generated.citedSourceIds);
  const citedEvidence = new Set(
    sources.filter((source) => citedSources.has(source.id)).flatMap((source) => source.evidenceIds),
  );
  const evidenceIds = request.evidenceIds.filter((id) => allowedEvidence.has(id) && citedEvidence.has(id));
  const costCents = generated.costCents ?? route.estimatedCents;
  if (costCents > tenantPolicy.maxRequestCents || costCents > monthlyRemaining) {
    if (reservation && input.settleBudget) {
      try { await input.settleBudget(identity, reservation, null); } catch { /* reservation expiry is a server concern */ }
    }
    return result(503, { code: 'cost-ceiling-exceeded', message: 'The response exceeded the tenant cost policy and was discarded.' });
  }
  if (reservation && input.settleBudget) {
    let settled = false;
    try {
      settled = await input.settleBudget(identity, reservation, {
        costCents,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
      });
    } catch {
      settled = false;
    }
    if (!settled) {
      return result(503, {
        code: 'usage-not-recorded',
        message: 'The response was discarded because authoritative usage could not be recorded.',
      });
    }
  }

  const actions = request.proposedActions.map((action) => ({
    ...action,
    evidenceIds: action.evidenceIds.filter((id) => allowedEvidence.has(id)),
  }));
  input.audit?.(identity, {
    category: request.category,
    provider: route.provider,
    model: route.model,
    inputTokens: generated.inputTokens,
    outputTokens: generated.outputTokens,
    costCents,
    policyDecision: `${tenantPolicy.state}:${request.mode}`,
  });
  return result(200, {
    version: 1,
    text: generated.text,
    sourceIds: [...citedSources],
    evidenceIds,
    mode: request.mode,
    route: { provider: route.provider, model: route.model },
    usage: { inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, estimatedCents: costCents },
    actions,
  });
}

export async function confirmAction(input: ConfirmActionInput): Promise<IntelligenceResult> {
  const now = input.now ?? Date.now();
  const scoped =
    input.action.tenantId === input.identity.institutionId &&
    input.action.personId === input.identity.userId;
  if (!scoped) return result(403, { code: 'scope-refused', message: 'This action belongs to another university scope.' });

  const at = input.confirmation ? Date.parse(input.confirmation.at) : Number.NaN;
  const fresh =
    input.confirmation?.confirmed === true &&
    input.confirmation.actorId === input.identity.userId &&
    Number.isFinite(at) &&
    at <= now &&
    now - at <= 5 * 60_000;
  const preparedAt = Date.parse(input.action.preparedAt);
  const expiresAt = Date.parse(input.action.expiresAt);
  if (!fresh || !Number.isFinite(preparedAt) || !Number.isFinite(expiresAt) || now < preparedAt || now > expiresAt) {
    input.audit?.(input.identity, {
      category: 'action', provider: '', model: '', inputTokens: 0, outputTokens: 0,
      costCents: 0, policyDecision: 'confirmation-required', actionId: input.action.id, confirmation: 'refused',
    });
    return result(409, { code: 'confirmation-required', message: 'A fresh explicit confirmation is required.' });
  }

  const readback = await input.execute(input.action);
  if (!readback.verified) {
    return result(502, { code: 'authoritative-readback-required', message: 'The action was not turned into a receipt because authoritative readback was unavailable.' });
  }
  const receipt: ActionReceipt = {
    id: readback.receiptId,
    actionId: input.action.id,
    status: readback.status ?? 'completed',
    message: readback.message,
    recordedAt: readback.recordedAt,
    authoritative: true,
  };
  input.audit?.(input.identity, {
    category: 'action', provider: '', model: '', inputTokens: 0, outputTokens: 0,
    costCents: 0, policyDecision: 'confirmed-and-read-back', actionId: input.action.id, confirmation: 'confirmed',
  });
  return result(200, receipt as unknown as Record<string, unknown>);
}

export interface IntelligenceServiceConfig {
  status: 'policy-disabled' | 'configured-sandbox' | 'configured-production';
  loadPolicy: (identity: UniversityIdentity) => Promise<TenantIntelligencePolicy>;
  loadApprovedSources: (identity: UniversityIdentity, sourceIds: string[]) => Promise<ApprovedIntelligenceSource[]>;
  modelTask: (identity: UniversityIdentity, request: IntelligenceGatewayRequest) => Promise<ModelTask>;
  generate: IntelligenceRespondInput['generate'];
  reserveBudget?: IntelligenceRespondInput['reserveBudget'];
  settleBudget?: IntelligenceRespondInput['settleBudget'];
  execute: ConfirmActionInput['execute'];
  audit?: IntelligenceRespondInput['audit'];
}

export interface IntelligenceService {
  status: IntelligenceServiceConfig['status'];
  policy: (identity: UniversityIdentity) => Promise<IntelligenceResult>;
  respond: (identity: UniversityIdentity, value: unknown) => Promise<IntelligenceResult>;
  confirm: (identity: UniversityIdentity, actionId: string, value: unknown) => Promise<IntelligenceResult>;
}

export function createIntelligenceService(config: IntelligenceServiceConfig): IntelligenceService {
  const actions = new Map<string, GovernedAction>();
  return {
    status: config.status,
    policy: async (identity) => {
      const policy = await config.loadPolicy(identity);
      if (policy.state === 'off' || !identity.roles.some((role) => policy.permittedRoles.includes(role))) {
        return result(403, { code: 'policy-disabled', message: 'Semester Intelligence is unavailable for this account.' });
      }
      return result(200, { state: policy.state, allowedModes: policy.allowedModes });
    },
    respond: async (identity, value) => {
      let request: IntelligenceGatewayRequest;
      try {
        request = parseIntelligenceGatewayRequest(value);
      } catch (error) {
        return result(400, { code: 'invalid-request', message: error instanceof Error ? error.message : 'Invalid intelligence request.' });
      }
      const response = await respond({
        identity,
        request,
        tenantPolicy: await config.loadPolicy(identity),
        approvedSources: await config.loadApprovedSources(identity, request.sourceIds),
        modelTask: await config.modelTask(identity, request),
        generate: config.generate,
        reserveBudget: config.reserveBudget,
        settleBudget: config.settleBudget,
        audit: config.audit,
      });
      if (response.status === 200) {
        const prepared = request.proposedActions.map((action) => {
          const now = Date.now();
          const governed: GovernedAction = {
            ...action,
            id: randomUUID(),
            tenantId: identity.institutionId,
            personId: identity.userId,
            preparedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 5 * 60_000).toISOString(),
          };
          actions.set(`${identity.institutionId}:${identity.userId}:${governed.id}`, governed);
          return governed;
        });
        response.body.actions = prepared.map(({ tenantId: _tenantId, personId: _personId, ...action }) => action);
      }
      return response;
    },
    confirm: async (identity, actionId, value) => {
      const action = actions.get(`${identity.institutionId}:${identity.userId}:${actionId}`);
      if (!action) return result(404, { code: 'action-not-found', message: 'Proposed action not found for this account.' });
      const body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
      const confirmation = body.confirmed === true && typeof body.at === 'string'
        ? { confirmed: true as const, actorId: identity.userId, at: body.at }
        : null;
      // Claim before execution. A retry reconciles by receipt; it must never
      // execute the same reviewed effect twice.
      actions.delete(`${identity.institutionId}:${identity.userId}:${actionId}`);
      const response = await confirmAction({ identity, action, confirmation, execute: config.execute, audit: config.audit });
      return response;
    },
  };
}

export const newActionId = () => randomUUID();
