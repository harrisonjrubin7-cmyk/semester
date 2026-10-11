import { describe, expect, it, vi } from 'vitest';
import type {
  RegistrationReadinessEvaluationRecord,
  ReadinessWorkflowResult,
} from '../../../packages/institution/src/readiness-workflow.ts';
import { RegistrationReadinessService } from './readiness-service.ts';

class MemoryReadinessRepository {
  records = new Map<string, RegistrationReadinessEvaluationRecord>();
  saves: ReadinessWorkflowResult[] = [];

  async save(result: ReadinessWorkflowResult): Promise<ReadinessWorkflowResult> {
    this.saves.push(result);
    this.records.set(`${result.record.tenantId}:${result.record.id}`, result.record);
    return result;
  }

  async get(tenantId: string, evaluationId: string): Promise<RegistrationReadinessEvaluationRecord | null> {
    return this.records.get(`${tenantId}:${evaluationId}`) ?? null;
  }
}

const correlationId = '018f0d36-7b9a-7cc3-bdc2-7c6b7da34e21';

describe('registration-readiness service', () => {
  it('starts an evaluation with the verified tenant, subject and requester', async () => {
    const repository = new MemoryReadinessRepository();
    const service = new RegistrationReadinessService(repository);

    const result = await service.start({
      evaluationId: 'evaluation-1',
      tenantId: 'school-a',
      subjectId: 'student-1',
      requestedBy: 'student-1',
      termId: '2027-spring',
      correlationId,
      idempotencyKey: 'request-1',
      at: '2026-10-09T18:00:00.000Z',
    });

    expect(result.record).toMatchObject({
      id: 'evaluation-1', tenantId: 'school-a', subjectId: 'student-1', requestedBy: 'student-1', state: 'requested', version: 1,
    });
    expect(repository.saves).toHaveLength(1);
  });

  it('loads by verified tenant before applying a compare-and-swap transition', async () => {
    const repository = new MemoryReadinessRepository();
    const service = new RegistrationReadinessService(repository);
    await service.start({
      evaluationId: 'evaluation-1', tenantId: 'school-a', subjectId: 'student-1', requestedBy: 'student-1', termId: '2027-spring',
      correlationId, idempotencyKey: 'request-1', at: '2026-10-09T18:00:00.000Z',
    });

    const result = await service.transition({
      evaluationId: 'evaluation-1', tenantId: 'school-a', expectedVersion: 1, targetState: 'evaluating',
      correlationId, idempotencyKey: 'evaluate-1', at: '2026-10-09T18:01:00.000Z',
    });

    expect(result.record).toMatchObject({ tenantId: 'school-a', state: 'evaluating', version: 2 });
    expect(repository.saves).toHaveLength(2);
  });

  it('does not disclose whether another tenant owns an evaluation', async () => {
    const repository = new MemoryReadinessRepository();
    const service = new RegistrationReadinessService(repository);
    await service.start({
      evaluationId: 'evaluation-1', tenantId: 'school-a', subjectId: 'student-1', requestedBy: 'student-1', termId: '2027-spring',
      correlationId, idempotencyKey: 'request-1', at: '2026-10-09T18:00:00.000Z',
    });

    await expect(service.transition({
      evaluationId: 'evaluation-1', tenantId: 'school-b', expectedVersion: 1, targetState: 'evaluating',
      correlationId, idempotencyKey: 'evaluate-1', at: '2026-10-09T18:01:00.000Z',
    })).rejects.toThrow('Registration readiness evaluation was not found.');
    expect(repository.saves).toHaveLength(1);
  });

  it('persists nothing when the workflow rejects a stale version', async () => {
    const repository = new MemoryReadinessRepository();
    const service = new RegistrationReadinessService(repository);
    await service.start({
      evaluationId: 'evaluation-1', tenantId: 'school-a', subjectId: 'student-1', requestedBy: 'student-1', termId: '2027-spring',
      correlationId, idempotencyKey: 'request-1', at: '2026-10-09T18:00:00.000Z',
    });

    await expect(service.transition({
      evaluationId: 'evaluation-1', tenantId: 'school-a', expectedVersion: 9, targetState: 'evaluating',
      correlationId, idempotencyKey: 'evaluate-1', at: '2026-10-09T18:01:00.000Z',
    })).rejects.toThrow('version 1, not 9');
    expect(repository.saves).toHaveLength(1);
  });

  it('returns the repository result so database-detected replays stay visible', async () => {
    const repository = new MemoryReadinessRepository();
    const save = vi.spyOn(repository, 'save').mockImplementation(async (result) => ({ ...result, replayed: true }));
    const service = new RegistrationReadinessService(repository);

    const result = await service.start({
      evaluationId: 'evaluation-1', tenantId: 'school-a', subjectId: 'student-1', requestedBy: 'student-1', termId: '2027-spring',
      correlationId, idempotencyKey: 'request-1', at: '2026-10-09T18:00:00.000Z',
    });

    expect(save).toHaveBeenCalledOnce();
    expect(result.replayed).toBe(true);
  });
});
