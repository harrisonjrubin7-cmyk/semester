import { describe, expect, it, vi } from 'vitest';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import type { ActionJournalStore } from './journal.ts';
import { createGateway } from './gateway.ts';
import type { RegistrationReadinessCommandBoundary } from './registration-readiness-commands.ts';

const actor: UniversityIdentity = {
  institutionId: 'northstar',
  userId: 'student-1',
  roles: ['student'],
};

const journal: ActionJournalStore = {
  healthy: () => true,
  save: () => undefined,
  get: () => null,
  claim: () => false,
  finish: () => undefined,
  audit: () => undefined,
};

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://api.semesterintel.tech${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer verified-session',
      'content-type': 'application/json',
      'idempotency-key': 'readiness-command-0001',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function gateway(
  commands?: RegistrationReadinessCommandBoundary,
  refresh: (identity: UniversityIdentity, token: string) => Promise<UniversityIdentity | null> = vi.fn(async () => actor),
) {
  return {
    handle: createGateway({
      origin: 'https://semesterintel.tech',
      institutionName: 'Northstar',
      authenticate: async () => actor,
      refreshIdentity: refresh,
      adapters: [],
      journal,
      registrationReadiness: commands,
    }),
    refresh,
  };
}

describe('registration-readiness HTTP commands', () => {
  it('is a real authenticated route but fails closed when the runtime dependency is absent', async () => {
    const { handle } = gateway();

    const response = await handle(request('/v1/registration-readiness/evaluations', { termId: '2027-spring' }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'unavailable', retryable: true },
    });
  });

  it('refreshes current membership, derives scope server-side and returns the durable start receipt', async () => {
    const start = vi.fn(async () => ({
      evaluationId: 'readiness-evaluation-1',
      id: 'readiness-command-0001',
      status: 'pending' as const,
      state: 'requested' as const,
      recordVersion: 1,
      recordedAt: '2026-10-10T12:00:00.000Z',
      correlationId: 'corr-readiness-command-0001',
    }));
    const commands: RegistrationReadinessCommandBoundary = {
      start,
      evaluate: vi.fn(),
    };
    const { handle, refresh } = gateway(commands);

    const response = await handle(request(
      '/v1/registration-readiness/evaluations',
      { termId: '2027-spring' },
      { 'x-correlation-id': 'corr-readiness-command-0001' },
    ));

    expect(response.status).toBe(202);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'northstar',
        actor: expect.objectContaining({ personId: 'student-1' }),
        idempotencyKey: 'readiness-command-0001',
      }),
      ['student'],
      { termId: '2027-spring' },
    );
    expect(await response.json()).toMatchObject({
      evaluationId: 'readiness-evaluation-1',
      status: 'pending',
      state: 'requested',
    });
  });

  it('refuses a command if current membership no longer authorizes the account', async () => {
    const commands: RegistrationReadinessCommandBoundary = {
      start: vi.fn(),
      evaluate: vi.fn(),
    };
    const { handle } = gateway(commands, vi.fn(async () => null));

    const response = await handle(request('/v1/registration-readiness/evaluations', { termId: '2027-spring' }));

    expect(response.status).toBe(403);
    expect(commands.start).not.toHaveBeenCalled();
  });

  it('routes the evaluator caller through the same refreshed self-scoped boundary', async () => {
    const evaluate = vi.fn(async () => ({
      evaluationId: 'readiness-evaluation-1',
      id: 'readiness-evaluate-0001:outcome',
      status: 'completed' as const,
      state: 'ready' as const,
      recordVersion: 3,
      recordedAt: '2026-10-10T12:00:00.000Z',
      correlationId: 'corr-readiness-command-0001',
    }));
    const commands: RegistrationReadinessCommandBoundary = {
      start: vi.fn(),
      evaluate,
    };
    const { handle } = gateway(commands);

    const response = await handle(request(
      '/v1/registration-readiness/evaluations/readiness-evaluation-1/evaluate',
      {},
      {
        'idempotency-key': 'readiness-evaluate-0001',
        'x-correlation-id': 'corr-readiness-command-0001',
      },
    ));

    expect(response.status).toBe(200);
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'northstar', idempotencyKey: 'readiness-evaluate-0001' }),
      ['student'],
      'readiness-evaluation-1',
    );
    expect(await response.json()).toMatchObject({
      evaluationId: 'readiness-evaluation-1',
      status: 'completed',
      state: 'ready',
    });
  });

  it('allows the idempotency header in the exact-origin preflight', async () => {
    const { handle } = gateway();
    const response = await handle(new Request('https://api.semesterintel.tech/v1/registration-readiness/evaluations', {
      method: 'OPTIONS',
      headers: { origin: 'https://semesterintel.tech' },
    }));

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toContain('Idempotency-Key');
  });
});
