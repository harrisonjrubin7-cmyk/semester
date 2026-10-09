import { describe, expect, it } from 'vitest';
import {
  REGISTRATION_READINESS_EVALUATION,
  startRegistrationReadinessEvaluation,
  transitionRegistrationReadinessEvaluation,
} from './readiness-workflow.ts';
import { transition } from './workflow.ts';

// Holds docs/reference/registration-readiness-workflow.md.
const NOW = '2026-10-08T20:00:00.000Z';
const testKey = (operation: string): string => `synthetic-${operation}-fixture`;

const start = () => startRegistrationReadinessEvaluation({
  id: 'evaluation-1',
  tenantId: 'school-a',
  subjectId: 'student-1',
  termId: '2027-spring',
  requestedBy: 'student-1',
  correlationId: 'corr-0123456789',
  idempotencyKey: testKey('request'),
  at: NOW,
});

describe('registration readiness evaluation workflow', () => {
  it('requires evaluation before an outcome and reconciliation before retrying ambiguity', () => {
    expect(transition(REGISTRATION_READINESS_EVALUATION, 'requested', 'ready').ok).toBe(false);
    expect(transition(REGISTRATION_READINESS_EVALUATION, 'requested', 'evaluating').ok).toBe(true);
    expect(transition(REGISTRATION_READINESS_EVALUATION, 'unknown', 'evaluating').ok).toBe(false);
    expect(transition(REGISTRATION_READINESS_EVALUATION, 'unknown', 'reconciling').ok).toBe(true);
    expect(transition(REGISTRATION_READINESS_EVALUATION, 'reconciling', 'evaluating').ok).toBe(true);
  });

  it('starts with a durable pending receipt and a minimal event descriptor', () => {
    const result = start();
    expect(result.record).toMatchObject({ state: 'requested', version: 1, generation: 1 });
    expect(result.receipt).toMatchObject({
      id: testKey('request'),
      status: 'pending',
      state: 'requested',
      recordVersion: 1,
    });
    expect(result.event).toEqual({
      eventType: 'registration.readiness_requested',
      aggregateId: 'evaluation-1',
      idempotencyKey: testKey('request'),
      correlationId: 'corr-0123456789',
      payload: { evaluationId: 'evaluation-1', termId: '2027-spring', version: 1 },
    });
  });

  it('returns the original receipt for an exact retry and rejects key reuse for another command', () => {
    const first = transitionRegistrationReadinessEvaluation(start().record, {
      expectedVersion: 1,
      targetState: 'evaluating',
      idempotencyKey: testKey('evaluate'),
      correlationId: 'corr-0123456789',
      at: '2026-10-08T20:01:00.000Z',
    });
    const replay = transitionRegistrationReadinessEvaluation(first.record, {
      expectedVersion: 1,
      targetState: 'evaluating',
      idempotencyKey: testKey('evaluate'),
      correlationId: 'corr-0123456789',
      at: '2026-10-08T20:02:00.000Z',
    });
    expect(replay.replayed).toBe(true);
    expect(replay.record).toBe(first.record);
    expect(replay.receipt).toEqual(first.receipt);
    expect(replay.event).toEqual(first.event);

    expect(() => transitionRegistrationReadinessEvaluation(first.record, {
      expectedVersion: 2,
      targetState: 'unknown',
      idempotencyKey: testKey('evaluate'),
      correlationId: 'corr-0123456789',
      at: '2026-10-08T20:02:00.000Z',
    })).toThrow(/idempotency key.*another command/i);
  });

  it('uses optimistic versions and emits a completed evaluated receipt', () => {
    const evaluating = transitionRegistrationReadinessEvaluation(start().record, {
      expectedVersion: 1,
      targetState: 'evaluating',
      idempotencyKey: testKey('evaluate'),
      correlationId: 'corr-0123456789',
      at: '2026-10-08T20:01:00.000Z',
    });
    expect(() => transitionRegistrationReadinessEvaluation(evaluating.record, {
      expectedVersion: 1,
      targetState: 'ready',
      projectionVersion: 7,
      idempotencyKey: testKey('result'),
      correlationId: 'corr-0123456789',
      at: '2026-10-08T20:02:00.000Z',
    })).toThrow(/version 2/i);

    const ready = transitionRegistrationReadinessEvaluation(evaluating.record, {
      expectedVersion: 2,
      targetState: 'ready',
      projectionVersion: 7,
      idempotencyKey: testKey('result'),
      correlationId: 'corr-0123456789',
      at: '2026-10-08T20:02:00.000Z',
    });
    expect(ready.record).toMatchObject({ state: 'ready', version: 3, projectionVersion: 7 });
    expect(ready.receipt).toMatchObject({ status: 'completed', state: 'ready', recordVersion: 3 });
    expect(ready.event.eventType).toBe('registration.readiness_evaluated');
  });

  it('requires a newer projection for every evaluated outcome', () => {
    const evaluating = transitionRegistrationReadinessEvaluation(start().record, {
      expectedVersion: 1, targetState: 'evaluating', idempotencyKey: testKey('evaluate'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:01:00.000Z',
    });
    expect(() => transitionRegistrationReadinessEvaluation(evaluating.record, {
      expectedVersion: 2, targetState: 'blocked', idempotencyKey: testKey('result'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:02:00.000Z',
    })).toThrow(/projection version/i);

    const blocked = transitionRegistrationReadinessEvaluation(evaluating.record, {
      expectedVersion: 2, targetState: 'blocked', projectionVersion: 7, idempotencyKey: testKey('result'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:02:00.000Z',
    });
    const refreshing = transitionRegistrationReadinessEvaluation(blocked.record, {
      expectedVersion: 3, targetState: 'evaluating', idempotencyKey: testKey('refresh'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:03:00.000Z',
    });
    expect(() => transitionRegistrationReadinessEvaluation(refreshing.record, {
      expectedVersion: 4, targetState: 'ready', projectionVersion: 7, idempotencyKey: testKey('older'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:04:00.000Z',
    })).toThrow(/newer than 7/i);
  });

  it('opens one reconciliation task and resolves it only by starting a new generation', () => {
    const evaluating = transitionRegistrationReadinessEvaluation(start().record, {
      expectedVersion: 1, targetState: 'evaluating', idempotencyKey: testKey('evaluate'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:01:00.000Z',
    });
    const unknown = transitionRegistrationReadinessEvaluation(evaluating.record, {
      expectedVersion: 2, targetState: 'unknown', projectionVersion: 7,
      idempotencyKey: testKey('unknown'), correlationId: 'corr-0123456789', at: '2026-10-08T20:02:00.000Z',
    });
    const reconciling = transitionRegistrationReadinessEvaluation(unknown.record, {
      expectedVersion: 3, targetState: 'reconciling', idempotencyKey: testKey('reconcile'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:03:00.000Z',
    });
    expect(reconciling.record.reconciliationTasks).toEqual([expect.objectContaining({ state: 'open', generation: 1 })]);
    expect(reconciling.event.eventType).toBe('registration.readiness_reconciliation_requested');

    const restarted = transitionRegistrationReadinessEvaluation(reconciling.record, {
      expectedVersion: 4, targetState: 'evaluating', idempotencyKey: testKey('retry'),
      correlationId: 'corr-0123456789', at: '2026-10-08T20:04:00.000Z',
    });
    expect(restarted.record.generation).toBe(2);
    expect(restarted.record.reconciliationTasks[0]).toMatchObject({ state: 'resolved', resolvedAt: '2026-10-08T20:04:00.000Z' });
  });
});
