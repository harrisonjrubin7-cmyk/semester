import { CORRELATION_ID_PATTERN } from './policy.ts';
import { transition, type WorkflowDefinition } from './workflow.ts';

export const REGISTRATION_READINESS_EVALUATION_STATES = [
  'requested',
  'evaluating',
  'ready',
  'blocked',
  'needs_review',
  'unknown',
  'stale',
  'reconciling',
] as const;
export type RegistrationReadinessEvaluationState = (typeof REGISTRATION_READINESS_EVALUATION_STATES)[number];

/** States that complete one evaluation command before this refreshable aggregate may begin another generation. */
export const REGISTRATION_READINESS_COMPLETED_OUTCOMES = [
  'ready',
  'blocked',
  'needs_review',
  'unknown',
  'stale',
] as const satisfies readonly RegistrationReadinessEvaluationState[];

/**
 * An evaluation may be refreshed, but ambiguity cannot jump straight back to
 * evaluation. It first becomes an explicit reconciliation task, then starts a
 * new generation. That prevents a retry from silently overwriting the fact
 * that the preceding result was unknown or stale.
 */
export const REGISTRATION_READINESS_EVALUATION: WorkflowDefinition<RegistrationReadinessEvaluationState> = {
  type: 'registration_readiness_evaluation',
  initial: 'requested',
  terminal: [],
  transitions: {
    requested: ['evaluating'],
    evaluating: ['ready', 'blocked', 'needs_review', 'unknown', 'stale'],
    ready: ['evaluating'],
    blocked: ['evaluating'],
    needs_review: ['reconciling'],
    unknown: ['reconciling'],
    stale: ['reconciling'],
    reconciling: ['evaluating'],
  },
  exceptional: [
    ['evaluating', 'needs_review'],
    ['evaluating', 'unknown'],
    ['evaluating', 'stale'],
    ['needs_review', 'reconciling'],
    ['unknown', 'reconciling'],
    ['stale', 'reconciling'],
  ],
};

export interface ReadinessEvaluationReceipt {
  id: string;
  status: 'pending' | 'completed';
  state: RegistrationReadinessEvaluationState;
  recordVersion: number;
  recordedAt: string;
  correlationId: string;
}

interface ReadinessCommandLedgerEntry {
  idempotencyKey: string;
  fingerprint: string;
  receipt: ReadinessEvaluationReceipt;
  event: ReadinessWorkflowEventDescriptor;
}

export interface ReadinessReconciliationTask {
  id: string;
  generation: number;
  state: 'open' | 'resolved';
  openedAt: string;
  resolvedAt?: string;
}

export interface RegistrationReadinessEvaluationRecord {
  id: string;
  tenantId: string;
  subjectId: string;
  termId: string;
  requestedBy: string;
  state: RegistrationReadinessEvaluationState;
  version: number;
  generation: number;
  projectionVersion?: number;
  createdAt: string;
  updatedAt: string;
  reconciliationTasks: ReadinessReconciliationTask[];
  commandLedger: ReadinessCommandLedgerEntry[];
}

export type ReadinessWorkflowEventType =
  | 'registration.readiness_requested'
  | 'registration.readiness_evaluated'
  | 'registration.readiness_reconciliation_requested';

export interface ReadinessWorkflowEventDescriptor {
  eventType: ReadinessWorkflowEventType;
  aggregateId: string;
  idempotencyKey: string;
  correlationId: string;
  payload: { evaluationId: string; termId: string; version: number };
}

export interface ReadinessWorkflowResult {
  record: RegistrationReadinessEvaluationRecord;
  receipt: ReadinessEvaluationReceipt;
  event: ReadinessWorkflowEventDescriptor;
  replayed: boolean;
}

export interface StartRegistrationReadinessEvaluation {
  id: string;
  tenantId: string;
  subjectId: string;
  termId: string;
  requestedBy: string;
  correlationId: string;
  idempotencyKey: string;
  at: string;
}

export interface TransitionRegistrationReadinessEvaluation {
  expectedVersion: number;
  targetState: RegistrationReadinessEvaluationState;
  projectionVersion?: number;
  correlationId: string;
  idempotencyKey: string;
  at: string;
}

const hasText = (value: string): boolean => value.trim().length > 0;
const isTime = (value: string): boolean => Number.isFinite(Date.parse(value));

function assertEnvelope(input: { correlationId: string; idempotencyKey: string; at: string }): void {
  if (!CORRELATION_ID_PATTERN.test(input.correlationId)) throw new Error('Readiness evaluation correlation id is malformed.');
  if (!hasText(input.idempotencyKey) || input.idempotencyKey.length > 300) throw new Error('Readiness evaluation idempotency key is malformed.');
  if (!isTime(input.at)) throw new Error('Readiness evaluation time is malformed.');
}

const receiptStatus = (state: RegistrationReadinessEvaluationState): ReadinessEvaluationReceipt['status'] =>
  REGISTRATION_READINESS_COMPLETED_OUTCOMES.some((outcome) => outcome === state) ? 'completed' : 'pending';

function eventTypeFor(state: RegistrationReadinessEvaluationState): ReadinessWorkflowEventType {
  if (state === 'requested') return 'registration.readiness_requested';
  if (state === 'reconciling') return 'registration.readiness_reconciliation_requested';
  return 'registration.readiness_evaluated';
}

function eventFor(
  record: RegistrationReadinessEvaluationRecord,
  idempotencyKey: string,
  correlationId: string,
): ReadinessWorkflowEventDescriptor {
  return {
    eventType: eventTypeFor(record.state),
    aggregateId: record.id,
    idempotencyKey,
    correlationId,
    payload: { evaluationId: record.id, termId: record.termId, version: record.version },
  };
}

function makeReceipt(
  record: RegistrationReadinessEvaluationRecord,
  idempotencyKey: string,
  correlationId: string,
  at: string,
): ReadinessEvaluationReceipt {
  return {
    id: idempotencyKey,
    status: receiptStatus(record.state),
    state: record.state,
    recordVersion: record.version,
    recordedAt: at,
    correlationId,
  };
}

export function startRegistrationReadinessEvaluation(input: StartRegistrationReadinessEvaluation): ReadinessWorkflowResult {
  assertEnvelope(input);
  for (const [name, value] of [
    ['id', input.id],
    ['tenantId', input.tenantId],
    ['subjectId', input.subjectId],
    ['termId', input.termId],
    ['requestedBy', input.requestedBy],
  ] as const) {
    if (!hasText(value)) throw new Error(`Readiness evaluation ${name} is required.`);
  }

  const base: RegistrationReadinessEvaluationRecord = {
    id: input.id,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    termId: input.termId,
    requestedBy: input.requestedBy,
    state: 'requested',
    version: 1,
    generation: 1,
    createdAt: input.at,
    updatedAt: input.at,
    reconciliationTasks: [],
    commandLedger: [],
  };
  const receipt = makeReceipt(base, input.idempotencyKey, input.correlationId, input.at);
  const event = eventFor(base, input.idempotencyKey, input.correlationId);
  const record: RegistrationReadinessEvaluationRecord = {
    ...base,
    commandLedger: [{
      idempotencyKey: input.idempotencyKey,
      fingerprint: JSON.stringify(['requested', input.subjectId, input.termId]),
      receipt,
      event,
    }],
  };
  return { record, receipt, event, replayed: false };
}

export function transitionRegistrationReadinessEvaluation(
  current: RegistrationReadinessEvaluationRecord,
  command: TransitionRegistrationReadinessEvaluation,
): ReadinessWorkflowResult {
  assertEnvelope(command);
  const fingerprint = JSON.stringify([command.targetState, command.projectionVersion ?? null]);
  const earlier = current.commandLedger.find((entry) => entry.idempotencyKey === command.idempotencyKey);
  if (earlier) {
    if (earlier.fingerprint !== fingerprint) throw new Error('Readiness evaluation idempotency key was reused for another command.');
    return {
      record: current,
      receipt: earlier.receipt,
      event: earlier.event,
      replayed: true,
    };
  }
  if (command.expectedVersion !== current.version) {
    throw new Error(`Readiness evaluation is at version ${current.version}, not ${command.expectedVersion}.`);
  }
  if (command.projectionVersion !== undefined && (!Number.isInteger(command.projectionVersion) || command.projectionVersion < 1)) {
    throw new Error('Readiness projection version must be a positive integer.');
  }

  if (REGISTRATION_READINESS_COMPLETED_OUTCOMES.some((outcome) => outcome === command.targetState)) {
    if (command.projectionVersion === undefined) {
      throw new Error('An evaluated readiness outcome requires a projection version.');
    }
    if (current.projectionVersion !== undefined && command.projectionVersion <= current.projectionVersion) {
      throw new Error(`Readiness projection version must be newer than ${current.projectionVersion}.`);
    }
  }

  const verdict = transition(REGISTRATION_READINESS_EVALUATION, current.state, command.targetState);
  if (!verdict.ok) throw new Error(verdict.reason);
  const version = current.version + 1;
  const beginsGeneration = current.state === 'reconciling' && command.targetState === 'evaluating';
  const generation = current.generation + (beginsGeneration ? 1 : 0);
  let tasks = current.reconciliationTasks.map((task) => ({ ...task }));
  if (command.targetState === 'reconciling') {
    tasks.push({
      id: `${current.id}:reconcile:${current.generation}`,
      generation: current.generation,
      state: 'open',
      openedAt: command.at,
    });
  } else if (beginsGeneration) {
    tasks = tasks.map((task) => task.state === 'open'
      ? { ...task, state: 'resolved' as const, resolvedAt: command.at }
      : task);
  }

  const base: RegistrationReadinessEvaluationRecord = {
    ...current,
    state: verdict.state,
    version,
    generation,
    updatedAt: command.at,
    reconciliationTasks: tasks,
    commandLedger: [...current.commandLedger],
    ...(command.projectionVersion === undefined ? {} : { projectionVersion: command.projectionVersion }),
  };
  const receipt = makeReceipt(base, command.idempotencyKey, command.correlationId, command.at);
  const event = eventFor(base, command.idempotencyKey, command.correlationId);
  const record: RegistrationReadinessEvaluationRecord = {
    ...base,
    commandLedger: [...base.commandLedger, { idempotencyKey: command.idempotencyKey, fingerprint, receipt, event }],
  };
  return { record, receipt, event, replayed: false };
}
