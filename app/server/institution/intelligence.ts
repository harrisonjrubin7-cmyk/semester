import { randomUUID } from 'node:crypto';
import type { CourseAgentPolicy } from '../../../packages/institution/src/course-agent-policy.ts';
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
import { checkProviderRequest } from './ai-data-class.ts';
import { MemoryIntelligenceActionStore, type IntelligenceActionStore } from './intelligence-action-store.ts';
import {
  retrievalLabelsMatch,
  type RequestContext,
  type RetrievalLabels,
} from '../../../packages/platform/src/index.ts';

export interface ApprovedIntelligenceSource {
  id: string;
  /** Exact policy facts that authorized this source for provider context. */
  labels: RetrievalLabels;
  evidenceIds: string[];
  /** Used only to assemble the provider request; never returned or journaled. */
  body: string;
  courseId?: string;
  /** Institution-approved policy binding, never a course/term asserted by a client. */
  origin?: string;
  policyScope?: string | null;
  policyCourseCode?: string | null;
  policyTerm?: string | null;
  title?: string;
  locator?: string;
  verifiedAt?: string;
}

export interface IntelligenceCourseScope {
  courseId: string;
  term: string;
}

function sourceScope(source: ApprovedIntelligenceSource): IntelligenceCourseScope | 'institution' | null {
  if (!['course', 'institution', 'library', 'web'].includes(source.origin ?? '')) return null;
  if (source.policyScope === 'institution' && source.origin !== 'course' &&
      source.policyCourseCode == null && source.policyTerm == null) return 'institution';
  if (source.policyScope === 'course' && typeof source.policyCourseCode === 'string' &&
      /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/.test(source.policyCourseCode) &&
      typeof source.policyTerm === 'string' && /^[0-9]{4}(FA|SP|SU)$/.test(source.policyTerm)) {
    return { courseId: source.policyCourseCode, term: source.policyTerm };
  }
  return null;
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
  context: RequestContext;
  identity: UniversityIdentity;
  request: IntelligenceGatewayRequest;
  tenantPolicy: TenantIntelligencePolicy;
  loadCoursePolicy?: (identity: UniversityIdentity, scope: IntelligenceCourseScope) => Promise<CourseAgentPolicy>;
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
  audit?: (identity: UniversityIdentity, record: IntelligenceAuditRecord) => void | Promise<void>;
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
  audit?: (identity: UniversityIdentity, record: IntelligenceAuditRecord) => void | Promise<void>;
}

export interface IntelligenceResult {
  status: number;
  body: Record<string, unknown>;
}

const result = (status: number, body: Record<string, unknown>): IntelligenceResult => ({ status, body });
const PROVIDER_DEADLINE_MS = 20_000;
const MAX_OUTPUT_TOKENS = 1_200;

export async function respond(input: IntelligenceRespondInput): Promise<IntelligenceResult> {
  const { context, identity, request, tenantPolicy } = input;
  if (context.tenantId !== identity.institutionId || context.actor.personId !== identity.userId || context.purpose !== 'ai_context') {
    return result(403, { code: 'scope-refused', message: 'The verified AI retrieval context does not match this account.' });
  }
  if (request.tenantId !== identity.institutionId || request.personId !== identity.userId) {
    return result(403, { code: 'scope-refused', message: 'The authenticated university scope does not match this request.' });
  }
  // clientState is intentionally not read here. A browser cannot promote a
  // server policy by claiming its build is production.
  if (tenantPolicy.state === 'off') {
    await input.audit?.(identity, {
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

  const agent = request.agent ?? 'assistant';
  // Role-specific actions are preparation only; the role cannot widen institutional authority.
  if (agent !== 'assistant' && request.proposedActions.some((action) => action.class !== 'prepare')) {
    return result(403, { code: 'agent-action-refused', message: 'This role may prepare drafts only; it cannot change institutional records.' });
  }
  const requestedSources = new Set(request.sourceIds);
  const sources = input.approvedSources.filter((source) => requestedSources.has(source.id));
  if (requestedSources.size === 0 || sources.length !== requestedSources.size) {
    return result(403, {
      code: 'source-not-approved',
      message: 'Every source sent to Semester Intelligence must be approved for this tenant and account.',
    });
  }
  if (sources.some((source) => !retrievalLabelsMatch(context, source.labels, 'ai_context', {
    sourceId: source.id,
    requireCurrent: true,
  }))) {
    return result(403, {
      code: 'source-context-refused',
      message: 'A source is not current or was not authorized for this tenant and AI purpose.',
    });
  }
  // Same spelling normalization as Course Studio; never a mapping from an opaque ID.
  const selectedCourse = request.courseId?.trim().replace(/\s+/g, ' ').toUpperCase();
  const scopes = sources.map(sourceScope);
  if (scopes.some((scope) => scope === null)) {
    return result(403, { code: 'source-scope-unverified', message: 'Your institution must approve a policy scope for each source before it can be used. Course sources need a verified course code and term.' });
  }
  const courses = [...new Map(scopes.flatMap((scope) => scope && scope !== 'institution'
    ? [[`${scope.courseId}/${scope.term}`, scope] as const] : [])).values()];
  if ((agent === 'tutor' || agent === 'course-guide') &&
      (!selectedCourse || courses.length !== 1 || scopes.includes('institution') || courses[0].courseId !== selectedCourse)) {
    return result(403, { code: 'course-scope-required', message: 'Select approved sources from one course before using this role.' });
  }
  // Client fields are consistency hints only. They never select which sources'
  // policies apply. Assistant/Advisor may combine courses; every binding is checked.
  // Institution-only guidance ignores the UI's incidental selected course/term.
  if (courses.length && !courses.some((scope) =>
    (!selectedCourse || scope.courseId === selectedCourse) && (!request.term || scope.term === request.term))) {
    return result(403, { code: 'course-scope-mismatch', message: 'The requested course and term do not match the institution-approved source scope.' });
  }
  const coursePolicies: CourseAgentPolicy[] = [];
  if (courses.length) {
    if (!input.loadCoursePolicy) {
      return result(503, { code: 'course-policy-unavailable', message: 'The institution course policy service is unavailable.' });
    }
    try {
      for (const scope of courses) coursePolicies.push(await input.loadCoursePolicy(identity, scope));
    } catch {
      return result(503, { code: 'course-policy-unavailable', message: 'The institution course policy could not be verified.' });
    }
  }
  if (coursePolicies.some((policy) => !policy.allowedModes.includes(request.mode))) {
    return result(403, { code: 'course-mode-disabled', message: 'This support mode is not permitted by the published course policy. Use concept review or ask your instructor.' });
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
    agent,
    coursePolicyInstruction: [...new Set(coursePolicies.map((policy) => policy.instruction))].join('\n') || undefined,
    sources,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
  // The last point before budget is reserved and a provider is reached. Every
  // field the request carries must be declared at or under the AI data-class
  // ceiling; one that is not is refused by name, and audited the same way, with
  // no content in either. See `ai-data-class.ts`.
  const carried = checkProviderRequest(providerRequest);
  if (!carried.ok) {
    await input.audit?.(identity, {
      category: request.category, provider: route.provider, model: route.model,
      inputTokens: 0, outputTokens: 0, costCents: 0, policyDecision: `data-class-refused:${carried.highest}`,
    });
    return result(403, {
      code: 'data-class-refused',
      message: 'This request includes material above the data class Semester Intelligence accepts, so it was not sent.',
    });
  }
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
    await input.audit?.(identity, {
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
  // The record is a precondition of the answer, not a courtesy after it: an AI
  // response nobody can account for is the worse failure, so one whose audit
  // cannot be written is discarded. The usage was already settled and stays
  // settled, because the provider did the work.
  try {
    await input.audit?.(identity, {
      category: request.category,
      provider: route.provider,
      model: route.model,
      inputTokens: generated.inputTokens,
      outputTokens: generated.outputTokens,
      costCents,
      policyDecision: `${tenantPolicy.state}:${agent}:${request.mode}`,
    });
  } catch {
    return result(503, { code: 'audit-unavailable', message: 'The response was discarded because it could not be recorded.' });
  }
  return result(200, {
    version: 1,
    text: generated.text,
    agent,
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
    await input.audit?.(input.identity, {
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
  await input.audit?.(input.identity, {
    category: 'action', provider: '', model: '', inputTokens: 0, outputTokens: 0,
    costCents: 0, policyDecision: 'confirmed-and-read-back', actionId: input.action.id, confirmation: 'confirmed',
  });
  return result(200, receipt as unknown as Record<string, unknown>);
}

export interface IntelligenceServiceConfig {
  status: 'policy-disabled' | 'configured-sandbox' | 'configured-production';
  /**
   * Whether `kill.ai_generation` is engaged for this identity's school, or
   * for everyone. Asked before the policy is loaded and before anything is
   * generated; a switch that cannot be read answers true. Absent only for the
   * policy-disabled runtime, which generates nothing anyway.
   */
  killSwitch?: (identity: UniversityIdentity) => Promise<boolean>;
  loadCoursePolicy?: IntelligenceRespondInput['loadCoursePolicy'];
  loadPolicy: (identity: UniversityIdentity) => Promise<TenantIntelligencePolicy>;
  loadApprovedSources: (context: RequestContext, identity: UniversityIdentity, sourceIds: string[]) => Promise<ApprovedIntelligenceSource[]>;
  modelTask: (identity: UniversityIdentity, request: IntelligenceGatewayRequest) => Promise<ModelTask>;
  generate: IntelligenceRespondInput['generate'];
  reserveBudget?: IntelligenceRespondInput['reserveBudget'];
  settleBudget?: IntelligenceRespondInput['settleBudget'];
  execute: ConfirmActionInput['execute'];
  audit?: IntelligenceRespondInput['audit'];
  actionStore?: IntelligenceActionStore;
}

export interface IntelligenceService {
  status: IntelligenceServiceConfig['status'];
  policy: (identity: UniversityIdentity) => Promise<IntelligenceResult>;
  respond: (context: RequestContext, identity: UniversityIdentity, value: unknown) => Promise<IntelligenceResult>;
  confirm: (identity: UniversityIdentity, actionId: string, value: unknown) => Promise<IntelligenceResult>;
}

export function createIntelligenceService(config: IntelligenceServiceConfig): IntelligenceService {
  const actions = config.actionStore ?? new MemoryIntelligenceActionStore();
  // The refusal every generating path gives when the switch is engaged. Audited
  // like a provider refusal, with no provider, so the journal shows the switch
  // doing its job rather than a quiet gap where requests used to be.
  const killed = async (identity: UniversityIdentity, category: string): Promise<IntelligenceResult | null> => {
    if (!config.killSwitch || !(await config.killSwitch(identity))) return null;
    await config.audit?.(identity, {
      category, provider: 'none', model: 'none', inputTokens: 0, outputTokens: 0, costCents: 0, policyDecision: 'kill-switch',
    });
    return result(503, {
      code: 'ai-generation-killed',
      message: 'AI generation is switched off right now. Everything else in Semester still works, and nothing you typed has been lost.',
    });
  };
  return {
    status: config.status,
    policy: async (identity) => {
      const stopped = await killed(identity, 'policy');
      if (stopped) return stopped;
      const policy = await config.loadPolicy(identity);
      if (policy.state === 'off' || !identity.roles.some((role) => policy.permittedRoles.includes(role))) {
        return result(403, { code: 'policy-disabled', message: 'Semester Intelligence is unavailable for this account.' });
      }
      return result(200, { state: policy.state, allowedModes: policy.allowedModes });
    },
    respond: async (context, identity, value) => {
      let request: IntelligenceGatewayRequest;
      try {
        request = parseIntelligenceGatewayRequest(value);
      } catch (error) {
        return result(400, { code: 'invalid-request', message: error instanceof Error ? error.message : 'Invalid intelligence request.' });
      }
      const stopped = await killed(identity, request.category);
      if (stopped) return stopped;
      const response = await respond({
        context,
        identity,
        request,
        tenantPolicy: await config.loadPolicy(identity),
        loadCoursePolicy: config.loadCoursePolicy,
        approvedSources: await config.loadApprovedSources(context, identity, request.sourceIds),
        modelTask: await config.modelTask(identity, request),
        generate: config.generate,
        reserveBudget: config.reserveBudget,
        settleBudget: config.settleBudget,
        audit: config.audit,
      });
      if (response.status === 200) {
        const prepared = await Promise.all(request.proposedActions.map(async (action) => {
          const now = Date.now();
          const governed: GovernedAction = {
            ...action,
            id: randomUUID(),
            tenantId: identity.institutionId,
            personId: identity.userId,
            preparedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 5 * 60_000).toISOString(),
          };
          await actions.save(governed);
          return governed;
        }));
        response.body.actions = prepared.map(({ tenantId: _tenantId, personId: _personId, ...action }) => action);
      }
      return response;
    },
    confirm: async (identity, actionId, value) => {
      // Before the claim, which consumes the action. Containment means no write
      // runs, including one reviewed before the switch was engaged; and a
      // refusal here must leave the action unspent, so it can still be
      // confirmed if the switch is released inside the five minutes it lives.
      const stopped = await killed(identity, 'action');
      if (stopped) return stopped;
      const action = await actions.claim(actionId, identity, Date.now());
      if (!action) return result(404, { code: 'action-not-found', message: 'Proposed action not found for this account.' });
      const body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
      const confirmation = body.confirmed === true && typeof body.at === 'string'
        ? { confirmed: true as const, actorId: identity.userId, at: body.at }
        : null;
      // Claim before execution. A retry reconciles by receipt; it must never
      // execute the same reviewed effect twice.
      const response = await confirmAction({ identity, action, confirmation, execute: config.execute, audit: config.audit });
      return response;
    },
  };
}

export const newActionId = () => randomUUID();
