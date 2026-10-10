import { createHash } from 'node:crypto';
import type { UniversityRole } from '../../../packages/institution/src/index.ts';
import {
  PlatformError,
  isIdempotencyKey,
  type RequestContext,
} from '../../../packages/platform/src/index.ts';
import type {
  ReadinessEvaluationReceipt,
  RegistrationReadinessEvaluationState,
  RegistrationReadinessEvaluationRecord,
} from '../../../packages/institution/src/readiness-workflow.ts';
import {
  RegistrationReadinessService,
  type RegistrationReadinessRepository,
} from './readiness-service.ts';

const BOUNDED_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EVALUATOR_OUTCOMES = ['ready', 'blocked', 'needs_review', 'unknown'] as const;
type EvaluatorOutcome = (typeof EVALUATOR_OUTCOMES)[number];

export interface RegistrationReadinessEvaluationRequest {
  tenantId: string;
  subjectId: string;
  termId: string;
  minimumProjectionVersion: number;
  signal: AbortSignal;
}

export interface RegistrationReadinessEvaluation {
  outcome: EvaluatorOutcome;
  projectionVersion: number;
  sourceObservedAt: string;
  freshUntil: string;
}

/**
 * A tenant-bound, approved source adapter. It returns only the decision and
 * freshness evidence needed by the workflow; source payloads never enter the
 * command ledger or outbox.
 */
export interface RegistrationReadinessEvaluator {
  evaluate(request: RegistrationReadinessEvaluationRequest): Promise<RegistrationReadinessEvaluation>;
}

export interface RegistrationReadinessCommandReceipt extends ReadinessEvaluationReceipt {
  /** Aggregate identifier used by the follow-up evaluate route; receipt.id remains the command idempotency key. */
  evaluationId: string;
}

export interface RegistrationReadinessCommandBoundary {
  start(
    context: RequestContext,
    roles: readonly UniversityRole[],
    input: unknown,
  ): Promise<RegistrationReadinessCommandReceipt>;
  evaluate(
    context: RequestContext,
    roles: readonly UniversityRole[],
    evaluationId: string,
  ): Promise<RegistrationReadinessCommandReceipt>;
}

export interface RegistrationReadinessCommandDependencies {
  service: RegistrationReadinessService;
  repository: RegistrationReadinessRepository;
  evaluator?: RegistrationReadinessEvaluator;
  now?: () => Date;
  evaluationIdFor?: (context: RequestContext, idempotencyKey: string, termId: string) => string;
  timeoutMs?: number;
}

function requireStudent(context: RequestContext, roles: readonly UniversityRole[]): void {
  const membership = context.membershipIds.some((id) => id === `${context.tenantId}:${context.actor.personId}`);
  if (context.actor.type !== 'user' || !membership || !roles.includes('student')) {
    throw new PlatformError('forbidden', 'Your current university access does not permit this action.');
  }
}

/** Compatibility bridge until PR #1414 carries this header into every gateway context. */
export function readinessCommandContext(context: RequestContext, request: Request): RequestContext {
  if (context.idempotencyKey) return context;
  const key = request.headers.get('idempotency-key');
  if (!key || !isIdempotencyKey(key)) {
    throw new PlatformError('invalid_request', 'This action needs a valid Idempotency-Key header.');
  }
  return Object.freeze({ ...context, idempotencyKey: key });
}

function requireCommandKey(context: RequestContext): string {
  if (!context.idempotencyKey || !isIdempotencyKey(context.idempotencyKey)) {
    throw new PlatformError('invalid_request', 'This action needs a valid Idempotency-Key header.');
  }
  return context.idempotencyKey;
}

function requireBoundedId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !BOUNDED_ID.test(value)) {
    throw new PlatformError('invalid_request', `${label} is not valid.`);
  }
  return value;
}

function parseStart(input: unknown): { termId: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new PlatformError('invalid_request', 'Send a registration term.');
  }
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== 'termId')) {
    throw new PlatformError('invalid_request', 'Only the registration term may be submitted.');
  }
  return { termId: requireBoundedId(value.termId, 'Registration term') };
}

function evaluatorOutcome(value: unknown): value is EvaluatorOutcome {
  return typeof value === 'string' && EVALUATOR_OUTCOMES.some((outcome) => outcome === value);
}

function completedReplay(
  record: Awaited<ReturnType<RegistrationReadinessRepository['get']>>,
  key: string,
): ReadinessEvaluationReceipt | null {
  if (!record) return null;
  for (const suffix of ['outcome', 'reconcile'] as const) {
    const entry = record.commandLedger.find((item) => item.idempotencyKey === `${key}:${suffix}`);
    if (entry) return entry.receipt;
  }
  return null;
}

function commandReceipt(
  evaluationId: string,
  receipt: ReadinessEvaluationReceipt,
): RegistrationReadinessCommandReceipt {
  return { evaluationId, ...receipt };
}

class EvaluatorDeadlineError extends Error {
  constructor() {
    super('Registration readiness evaluator exceeded its deadline.');
    this.name = 'EvaluatorDeadlineError';
  }
}

/**
 * HTTP-safe command boundary and bounded evaluator caller.
 *
 * It is deliberately unavailable without an injected evaluator. That makes
 * source activation an explicit runtime composition step: enabling the route
 * cannot silently fall back to fixtures, an unrelated worker, or stale data.
 */
export class RegistrationReadinessCommands implements RegistrationReadinessCommandBoundary {
  private readonly dependencies: RegistrationReadinessCommandDependencies;
  private readonly now: () => Date;
  private readonly evaluationIdFor: (context: RequestContext, idempotencyKey: string, termId: string) => string;
  private readonly timeoutMs: number;

  constructor(dependencies: RegistrationReadinessCommandDependencies) {
    this.dependencies = dependencies;
    this.now = dependencies.now ?? (() => new Date());
    this.evaluationIdFor = dependencies.evaluationIdFor ?? ((context, key, termId) => {
      const digest = createHash('sha256')
        .update(context.tenantId)
        .update('\0')
        .update(context.actor.personId)
        .update('\0')
        .update(key)
        .update('\0')
        .update(termId)
        .digest('hex');
      return `readiness:${digest.slice(0, 40)}`;
    });
    this.timeoutMs = dependencies.timeoutMs ?? 20_000;
  }

  private evaluator(): RegistrationReadinessEvaluator {
    if (!this.dependencies.evaluator) {
      throw new PlatformError('unavailable', 'Registration readiness is not configured for this university.');
    }
    return this.dependencies.evaluator;
  }

  async start(
    context: RequestContext,
    roles: readonly UniversityRole[],
    input: unknown,
  ): Promise<RegistrationReadinessCommandReceipt> {
    this.evaluator();
    requireStudent(context, roles);
    const idempotencyKey = requireCommandKey(context);
    const { termId } = parseStart(input);
    const at = this.now().toISOString();
    const evaluationId = requireBoundedId(this.evaluationIdFor(context, idempotencyKey, termId), 'Evaluation id');
    const result = await this.dependencies.service.start({
      evaluationId,
      tenantId: context.tenantId,
      subjectId: context.actor.personId,
      termId,
      requestedBy: context.actor.personId,
      correlationId: context.correlationId,
      idempotencyKey,
      at,
    });
    return commandReceipt(evaluationId, result.receipt);
  }

  private async reconcileTimedOut(
    context: RequestContext,
    evaluationId: string,
    idempotencyKey: string,
    record: RegistrationReadinessEvaluationRecord,
  ): Promise<RegistrationReadinessCommandReceipt> {
    let current = record;
    const timeoutKey = `${idempotencyKey}:timeout`;
    if (current.state === 'evaluating') {
      const timedOut = await this.dependencies.service.transition({
        evaluationId,
        tenantId: context.tenantId,
        expectedVersion: current.version,
        targetState: 'unknown',
        reason: 'evaluator_timeout',
        correlationId: context.correlationId,
        idempotencyKey: timeoutKey,
        at: this.now().toISOString(),
      });
      current = timedOut.record;
    }
    const timeoutRecorded = current.commandLedger.some((item) => item.idempotencyKey === timeoutKey);
    if (current.state !== 'unknown' || !timeoutRecorded) {
      throw new PlatformError('conflict', 'This evaluation must be reconciled before it can run again.');
    }
    const reconciling = await this.dependencies.service.transition({
      evaluationId,
      tenantId: context.tenantId,
      expectedVersion: current.version,
      targetState: 'reconciling',
      correlationId: context.correlationId,
      idempotencyKey: `${idempotencyKey}:reconcile`,
      at: this.now().toISOString(),
    });
    return commandReceipt(evaluationId, reconciling.receipt);
  }

  async evaluate(
    context: RequestContext,
    roles: readonly UniversityRole[],
    evaluationId: string,
  ): Promise<RegistrationReadinessCommandReceipt> {
    const evaluator = this.evaluator();
    requireStudent(context, roles);
    const idempotencyKey = requireCommandKey(context);
    const id = requireBoundedId(evaluationId, 'Evaluation id');
    let record = await this.dependencies.repository.get(context.tenantId, id);
    if (!record || record.subjectId !== context.actor.personId) {
      throw new PlatformError('not_found', 'Registration readiness evaluation was not found.');
    }

    const replay = completedReplay(record, idempotencyKey);
    if (replay) return commandReceipt(id, replay);

    const evaluatingKey = `${idempotencyKey}:evaluating`;
    const evaluatingEntry = record.commandLedger.find((item) => item.idempotencyKey === evaluatingKey);
    if (evaluatingEntry) {
      if (record.state === 'evaluating') {
        const claimedAt = Date.parse(evaluatingEntry.receipt.recordedAt);
        const claimAge = this.now().getTime() - claimedAt;
        if (Number.isFinite(claimedAt) && claimAge < this.timeoutMs) {
          return commandReceipt(id, evaluatingEntry.receipt);
        }
      }
      return await this.reconcileTimedOut(context, id, idempotencyKey, record);
    }

    if (!['requested', 'ready', 'blocked'].includes(record.state)) {
      throw new PlatformError('conflict', 'This evaluation must be reconciled before it can run again.');
    }
    const moved = await this.dependencies.service.transition({
      evaluationId: id,
      tenantId: context.tenantId,
      expectedVersion: record.version,
      targetState: 'evaluating',
      correlationId: context.correlationId,
      idempotencyKey: evaluatingKey,
      at: this.now().toISOString(),
    });
    record = moved.record;

    const controller = new AbortController();
    let deadlineReached = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        deadlineReached = true;
        reject(new EvaluatorDeadlineError());
        controller.abort();
      }, this.timeoutMs);
    });

    let observation: RegistrationReadinessEvaluation;
    try {
      observation = await Promise.race([
        evaluator.evaluate({
          tenantId: context.tenantId,
          subjectId: context.actor.personId,
          termId: record.termId,
          minimumProjectionVersion: (record.projectionVersion ?? 0) + 1,
          signal: controller.signal,
        }),
        deadline,
      ]);
    } catch (error) {
      if (!deadlineReached && !(error instanceof EvaluatorDeadlineError)) throw error;
      return await this.reconcileTimedOut(context, id, idempotencyKey, record);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }

    if (
      !evaluatorOutcome(observation.outcome)
      || !Number.isSafeInteger(observation.projectionVersion)
      || observation.projectionVersion < 1
      || !Number.isFinite(Date.parse(observation.sourceObservedAt))
      || !Number.isFinite(Date.parse(observation.freshUntil))
    ) {
      throw new Error('Registration readiness evaluator returned an invalid observation.');
    }

    const now = this.now();
    const fresh = Date.parse(observation.sourceObservedAt) <= now.getTime()
      && Date.parse(observation.freshUntil) > now.getTime();
    const targetState: RegistrationReadinessEvaluationState = fresh ? observation.outcome : 'stale';
    const completed = await this.dependencies.service.transition({
      evaluationId: id,
      tenantId: context.tenantId,
      expectedVersion: record.version,
      targetState,
      projectionVersion: observation.projectionVersion,
      correlationId: context.correlationId,
      idempotencyKey: `${idempotencyKey}:outcome`,
      at: now.toISOString(),
    });
    return commandReceipt(id, completed.receipt);
  }
}
