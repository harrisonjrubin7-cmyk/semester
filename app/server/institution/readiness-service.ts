import {
  startRegistrationReadinessEvaluation,
  transitionRegistrationReadinessEvaluation,
  type RegistrationReadinessEvaluationRecord,
  type RegistrationReadinessEvaluationState,
  type ReadinessWorkflowResult,
} from '../../../packages/institution/src/readiness-workflow.ts';

export interface RegistrationReadinessRepository {
  save(result: ReadinessWorkflowResult): Promise<ReadinessWorkflowResult>;
  get(tenantId: string, evaluationId: string): Promise<RegistrationReadinessEvaluationRecord | null>;
}

export interface StartRegistrationReadinessCommand {
  evaluationId: string;
  tenantId: string;
  subjectId: string;
  termId: string;
  requestedBy: string;
  correlationId: string;
  idempotencyKey: string;
  at: string;
}

export interface TransitionRegistrationReadinessCommand {
  evaluationId: string;
  tenantId: string;
  expectedVersion: number;
  targetState: RegistrationReadinessEvaluationState;
  projectionVersion?: number;
  correlationId: string;
  idempotencyKey: string;
  at: string;
}

/**
 * Orchestrates the pure readiness workflow against durable storage.
 *
 * Authorization stays outside this class: callers must derive tenant, subject
 * and requester from verified server context. Keeping those values explicit
 * makes that trust boundary reviewable and lets workers use the same service.
 * The repository repeats tenant scope in every lookup and owns the atomic
 * compare-and-swap, receipt, audit and outbox transaction.
 */
export class RegistrationReadinessService {
  constructor(private readonly repository: RegistrationReadinessRepository) {}

  async start(command: StartRegistrationReadinessCommand): Promise<ReadinessWorkflowResult> {
    const result = startRegistrationReadinessEvaluation({
      id: command.evaluationId,
      tenantId: command.tenantId,
      subjectId: command.subjectId,
      termId: command.termId,
      requestedBy: command.requestedBy,
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      at: command.at,
    });
    return await this.repository.save(result);
  }

  async transition(command: TransitionRegistrationReadinessCommand): Promise<ReadinessWorkflowResult> {
    const current = await this.repository.get(command.tenantId, command.evaluationId);
    if (!current) throw new Error('Registration readiness evaluation was not found.');

    const result = transitionRegistrationReadinessEvaluation(current, {
      expectedVersion: command.expectedVersion,
      targetState: command.targetState,
      ...(command.projectionVersion === undefined ? {} : { projectionVersion: command.projectionVersion }),
      correlationId: command.correlationId,
      idempotencyKey: command.idempotencyKey,
      at: command.at,
    });
    return await this.repository.save(result);
  }
}
