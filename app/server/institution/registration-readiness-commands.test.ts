import { describe, expect, it, vi } from 'vitest';
import { PlatformError, type RequestContext } from '../../../packages/platform/src/index.ts';
import {
  RegistrationReadinessCommands,
  type RegistrationReadinessEvaluator,
} from './registration-readiness-commands.ts';
import {
  RegistrationReadinessService,
  type RegistrationReadinessRepository,
} from './readiness-service.ts';
import type {
  RegistrationReadinessEvaluationRecord,
  ReadinessWorkflowResult,
} from '../../../packages/institution/src/readiness-workflow.ts';

const NOW = '2026-10-10T12:00:00.000Z';

function context(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    tenantId: 'northstar',
    environment: 'production',
    verifiedBy: 'membership',
    actor: { personId: 'student-1', type: 'user', authenticatedAt: NOW },
    membershipIds: ['northstar:student-1'],
    roleGrants: [{ role: 'student', scopeKind: 'tenant', scopeId: 'northstar' }],
    capabilities: [],
    purpose: 'service_delivery',
    correlationId: 'corr-readiness-command-0001',
    requestId: 'request-readiness-0001',
    idempotencyKey: 'readiness-command-0001',
    receivedAt: NOW,
    ...overrides,
  };
}

class MemoryReadinessRepository implements RegistrationReadinessRepository {
  readonly rows = new Map<string, RegistrationReadinessEvaluationRecord>();

  async get(tenantId: string, evaluationId: string) {
    const row = this.rows.get(evaluationId);
    return row?.tenantId === tenantId ? structuredClone(row) : null;
  }

  async save(result: ReadinessWorkflowResult) {
    const wanted = result.record.commandLedger.find((entry) => entry.receipt.id === result.receipt.id);
    const prior = [...this.rows.values()]
      .map((row) => ({ row, entry: row.commandLedger.find((entry) => entry.idempotencyKey === wanted?.idempotencyKey) }))
      .find(({ entry }) => entry !== undefined);
    if (wanted && prior?.entry) {
      if (prior.row.id !== result.record.id || prior.entry.fingerprint !== wanted.fingerprint) {
        throw new PlatformError('idempotency_key_reused', 'That Idempotency-Key was already used for a different request.');
      }
      return structuredClone({ record: prior.row, receipt: prior.entry.receipt, event: prior.entry.event, replayed: true });
    }
    const current = this.rows.get(result.record.id);
    if (current && !result.replayed && result.record.version !== current.version + 1) {
      throw new Error('compare-and-swap conflict');
    }
    this.rows.set(result.record.id, structuredClone(result.record));
    return structuredClone(result);
  }
}

function rig(evaluator?: RegistrationReadinessEvaluator, timeoutMs?: number) {
  const repository = new MemoryReadinessRepository();
  const service = new RegistrationReadinessService(repository);
  const commands = new RegistrationReadinessCommands({
    service,
    repository,
    evaluator,
    now: () => new Date(NOW),
    evaluationIdFor: (_context, _key, termId) => termId === '2027-spring' ? 'readiness-evaluation-1' : 'readiness-evaluation-2',
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  return { commands, repository };
}

describe('registration-readiness command boundary', () => {
  it('fails closed before persisting when no approved evaluator is configured', async () => {
    const { commands, repository } = rig();

    await expect(commands.start(context(), ['student'], { termId: '2027-spring' }))
      .rejects.toMatchObject({ code: 'unavailable', status: 503 });
    expect(repository.rows.size).toBe(0);
  });

  it('derives tenant, subject and requester from the trusted context and returns only a receipt', async () => {
    const evaluator: RegistrationReadinessEvaluator = { evaluate: vi.fn() };
    const { commands, repository } = rig(evaluator);

    const result = await commands.start(context(), ['student'], { termId: '2027-spring' });

    expect(result).toEqual({
      evaluationId: 'readiness-evaluation-1',
      id: 'readiness-command-0001',
      status: 'pending',
      state: 'requested',
      recordVersion: 1,
      recordedAt: NOW,
      correlationId: 'corr-readiness-command-0001',
    });
    expect(repository.rows.get('readiness-evaluation-1')).toMatchObject({
      tenantId: 'northstar',
      subjectId: 'student-1',
      requestedBy: 'student-1',
      termId: '2027-spring',
    });
    expect(result).not.toHaveProperty('record');
    expect(result).not.toHaveProperty('event');
  });

  it('replays the same start key against the same deterministic aggregate', async () => {
    const evaluator: RegistrationReadinessEvaluator = { evaluate: vi.fn() };
    const { commands, repository } = rig(evaluator);

    const first = await commands.start(context(), ['student'], { termId: '2027-spring' });
    const replay = await commands.start(context(), ['student'], { termId: '2027-spring' });

    expect(replay).toEqual(first);
    expect(repository.rows.size).toBe(1);
  });

  it('refuses the same start key when the command body changes', async () => {
    const evaluator: RegistrationReadinessEvaluator = { evaluate: vi.fn() };
    const { commands } = rig(evaluator);
    await commands.start(context(), ['student'], { termId: '2027-spring' });

    await expect(commands.start(context(), ['student'], { termId: '2027-fall' }))
      .rejects.toMatchObject({ code: 'idempotency_key_reused', status: 422 });
  });

  it('requires current student scope, a safe idempotency key and a bounded term', async () => {
    const evaluator: RegistrationReadinessEvaluator = { evaluate: vi.fn() };
    const { commands } = rig(evaluator);

    await expect(commands.start(context({ idempotencyKey: undefined }), ['student'], { termId: '2027-spring' }))
      .rejects.toMatchObject({ code: 'invalid_request' });
    await expect(commands.start(context(), ['faculty'], { termId: '2027-spring' }))
      .rejects.toMatchObject({ code: 'forbidden' });
    await expect(commands.start(context(), ['student'], { termId: '../other-school' }))
      .rejects.toMatchObject({ code: 'invalid_request' });
  });
});

describe('registration-readiness evaluator worker', () => {
  it('moves a fresh source observation through evaluating to a completed durable outcome', async () => {
    const evaluator: RegistrationReadinessEvaluator = {
      evaluate: vi.fn(async () => ({
        outcome: 'ready' as const,
        projectionVersion: 8,
        sourceObservedAt: '2026-10-10T11:55:00.000Z',
        freshUntil: '2026-10-10T12:05:00.000Z',
      })),
    };
    const { commands, repository } = rig(evaluator);
    await commands.start(context(), ['student'], { termId: '2027-spring' });

    const result = await commands.evaluate(
      context({ idempotencyKey: 'readiness-evaluate-0001' }),
      ['student'],
      'readiness-evaluation-1',
    );

    expect(result).toMatchObject({ status: 'completed', state: 'ready', recordVersion: 3 });
    expect(repository.rows.get('readiness-evaluation-1')).toMatchObject({
      state: 'ready',
      projectionVersion: 8,
      version: 3,
    });
    expect(evaluator.evaluate).toHaveBeenCalledWith({
      tenantId: 'northstar',
      subjectId: 'student-1',
      termId: '2027-spring',
      minimumProjectionVersion: 1,
      signal: expect.any(AbortSignal),
    });
  });

  it('records stale instead of claiming readiness from expired source evidence', async () => {
    const evaluator: RegistrationReadinessEvaluator = {
      evaluate: vi.fn(async () => ({
        outcome: 'ready' as const,
        projectionVersion: 4,
        sourceObservedAt: '2026-10-10T11:00:00.000Z',
        freshUntil: '2026-10-10T11:30:00.000Z',
      })),
    };
    const { commands, repository } = rig(evaluator);
    await commands.start(context(), ['student'], { termId: '2027-spring' });

    const result = await commands.evaluate(
      context({ idempotencyKey: 'readiness-evaluate-0002' }),
      ['student'],
      'readiness-evaluation-1',
    );

    expect(result).toMatchObject({ status: 'completed', state: 'stale' });
    expect(repository.rows.get('readiness-evaluation-1')?.state).toBe('stale');
  });

  it('makes another subject indistinguishable from a missing evaluation and never calls the source', async () => {
    const evaluator: RegistrationReadinessEvaluator = { evaluate: vi.fn() };
    const { commands } = rig(evaluator);
    await commands.start(context(), ['student'], { termId: '2027-spring' });

    await expect(commands.evaluate(
      context({
        actor: { personId: 'student-2', type: 'user', authenticatedAt: NOW },
        membershipIds: ['northstar:student-2'],
        idempotencyKey: 'readiness-evaluate-0003',
      }),
      ['student'],
      'readiness-evaluation-1',
    )).rejects.toMatchObject({ code: 'not_found' });
    expect(evaluator.evaluate).not.toHaveBeenCalled();
  });

  it('serializes simultaneous exact retries on the durable claim without invoking the source twice', async () => {
    let release!: (value: {
      outcome: 'ready';
      projectionVersion: number;
      sourceObservedAt: string;
      freshUntil: string;
    }) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const observation = new Promise<{
      outcome: 'ready';
      projectionVersion: number;
      sourceObservedAt: string;
      freshUntil: string;
    }>((resolve) => { release = resolve; });
    const evaluator: RegistrationReadinessEvaluator = {
      evaluate: vi.fn(async () => {
        markStarted();
        return await observation;
      }),
    };
    const { commands } = rig(evaluator);
    await commands.start(context(), ['student'], { termId: '2027-spring' });
    const workerContext = context({ idempotencyKey: 'readiness-evaluate-concurrent' });

    const first = commands.evaluate(workerContext, ['student'], 'readiness-evaluation-1');
    const retry = commands.evaluate(workerContext, ['student'], 'readiness-evaluation-1');
    await started;
    release({
      outcome: 'ready',
      projectionVersion: 10,
      sourceObservedAt: '2026-10-10T11:55:00.000Z',
      freshUntil: '2026-10-10T12:05:00.000Z',
    });
    const [firstResult, retryResult] = await Promise.all([first, retry]);

    expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
    expect(firstResult).toMatchObject({ evaluationId: 'readiness-evaluation-1', status: 'completed', state: 'ready' });
    expect(retryResult).toMatchObject({ evaluationId: 'readiness-evaluation-1', status: 'pending', state: 'evaluating' });
  });

  it('enforces the evaluator deadline and durably opens reconciliation when the adapter ignores abort', async () => {
    let signal: AbortSignal | undefined;
    const evaluator: RegistrationReadinessEvaluator = {
      evaluate: vi.fn(async (request) => {
        signal = request.signal;
        await new Promise((resolve) => setTimeout(resolve, 60));
        return {
          outcome: 'ready' as const,
          projectionVersion: 11,
          sourceObservedAt: '2026-10-10T11:55:00.000Z',
          freshUntil: '2026-10-10T12:05:00.000Z',
        };
      }),
    };
    const { commands, repository } = rig(evaluator, 5);
    await commands.start(context(), ['student'], { termId: '2027-spring' });

    const run = commands.evaluate(
      context({ idempotencyKey: 'readiness-evaluate-timeout' }),
      ['student'],
      'readiness-evaluation-1',
    );
    const bounded = await Promise.race([
      run,
      new Promise<'deadline-not-enforced'>((resolve) => setTimeout(() => resolve('deadline-not-enforced'), 30)),
    ]);

    expect(bounded).not.toBe('deadline-not-enforced');
    expect(bounded).toMatchObject({
      evaluationId: 'readiness-evaluation-1',
      status: 'pending',
      state: 'reconciling',
    });
    expect(signal?.aborted).toBe(true);
    const replay = await commands.evaluate(
      context({ idempotencyKey: 'readiness-evaluate-timeout' }),
      ['student'],
      'readiness-evaluation-1',
    );
    expect(replay).toEqual(bounded);
    expect(evaluator.evaluate).toHaveBeenCalledTimes(1);

    const persisted = repository.rows.get('readiness-evaluation-1');
    expect(persisted).toMatchObject({
      state: 'reconciling',
      version: 4,
      reconciliationTasks: [expect.objectContaining({ state: 'open' })],
    });
    expect(persisted?.commandLedger.find((entry) => entry.idempotencyKey === 'readiness-evaluate-timeout:timeout')?.event)
      .toMatchObject({
        eventType: 'registration.readiness_evaluated',
        payload: { reason: 'evaluator_timeout' },
      });
  });

  it('replays a completed worker command without calling the source twice', async () => {
    const evaluator: RegistrationReadinessEvaluator = {
      evaluate: vi.fn(async () => ({
        outcome: 'blocked' as const,
        projectionVersion: 9,
        sourceObservedAt: '2026-10-10T11:55:00.000Z',
        freshUntil: '2026-10-10T12:05:00.000Z',
      })),
    };
    const { commands } = rig(evaluator);
    await commands.start(context(), ['student'], { termId: '2027-spring' });
    const workerContext = context({ idempotencyKey: 'readiness-evaluate-0004' });

    const first = await commands.evaluate(workerContext, ['student'], 'readiness-evaluation-1');
    const replay = await commands.evaluate(workerContext, ['student'], 'readiness-evaluation-1');

    expect(replay).toEqual(first);
    expect(evaluator.evaluate).toHaveBeenCalledTimes(1);
  });
});
