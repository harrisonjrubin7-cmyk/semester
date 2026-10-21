import { describe, expect, it, vi } from 'vitest';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import type { ActionJournalStore } from './journal.ts';
import { createGateway } from './gateway.ts';
import type { RegistrationReadinessCommandBoundary } from './registration-readiness-commands.ts';
import { registrationReadinessSafeOff } from './runtime.ts';

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

function request(path: string, body: unknown) {
  return new Request(`https://api.semesterintel.tech${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer verified-session',
      'content-type': 'application/json',
      'idempotency-key': 'readiness-command-0001',
    },
    body: JSON.stringify(body),
  });
}

function commands() {
  const start = vi.fn();
  const evaluate = vi.fn();
  const boundary: RegistrationReadinessCommandBoundary = { start, evaluate };
  return { boundary, start, evaluate };
}

function gateway(boundary: RegistrationReadinessCommandBoundary, safeOff: () => boolean) {
  const refresh = vi.fn(async () => actor);
  const handle = createGateway({
    origin: 'https://semesterintel.tech',
    institutionName: 'Northstar',
    authenticate: async () => actor,
    refreshIdentity: refresh,
    adapters: [],
    journal,
    registrationReadiness: boundary,
    registrationReadinessSafeOff: safeOff,
  });
  return { handle, refresh };
}

describe('registration-readiness safe-off', () => {
  it('refuses new evaluations before membership refresh or evaluator work', async () => {
    const { boundary, start } = commands();
    const { handle, refresh } = gateway(boundary, () => true);

    const response = await handle(request('/v1/registration-readiness/evaluations', { termId: '2027-spring' }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'registration_readiness_paused' },
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('also pauses the evaluator follow-up route', async () => {
    const { boundary, evaluate } = commands();
    const { handle } = gateway(boundary, () => true);

    const response = await handle(request(
      '/v1/registration-readiness/evaluations/readiness-evaluation-1/evaluate',
      {},
    ));

    expect(response.status).toBe(503);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('reports the paused state on the health readback', async () => {
    const { boundary } = commands();
    const { handle } = gateway(boundary, () => true);

    const response = await handle(new Request('https://api.semesterintel.tech/health'));

    expect(await response.json()).toMatchObject({ registrationReadinessPaused: true });
  });

  it('is read on each request so an operator can resume without a restart', async () => {
    let paused = true;
    const { boundary, start } = commands();
    start.mockResolvedValue({
      evaluationId: 'readiness-evaluation-1',
      id: 'readiness-command-0001',
      status: 'pending',
      state: 'requested',
      recordVersion: 1,
      recordedAt: '2026-10-10T12:00:00.000Z',
      correlationId: 'corr-readiness-command-0001',
    });
    const { handle } = gateway(boundary, () => paused);

    expect((await handle(request('/v1/registration-readiness/evaluations', { termId: '2027-spring' }))).status).toBe(503);
    paused = false;
    expect((await handle(request('/v1/registration-readiness/evaluations', { termId: '2027-spring' }))).status).toBe(202);
    expect(start).toHaveBeenCalledTimes(1);
  });
});

describe('SEMESTER_REGISTRATION_READINESS_SAFE_OFF', () => {
  it('leaves evaluations open only when unset or exactly off', () => {
    expect(registrationReadinessSafeOff({})).toBe(false);
    expect(registrationReadinessSafeOff({ SEMESTER_REGISTRATION_READINESS_SAFE_OFF: '' })).toBe(false);
    expect(registrationReadinessSafeOff({ SEMESTER_REGISTRATION_READINESS_SAFE_OFF: 'off' })).toBe(false);
  });

  it('pauses on on, true, and any value that is not exactly off', () => {
    expect(registrationReadinessSafeOff({ SEMESTER_REGISTRATION_READINESS_SAFE_OFF: ' OFF ' })).toBe(true);
    expect(registrationReadinessSafeOff({ SEMESTER_REGISTRATION_READINESS_SAFE_OFF: 'OFF' })).toBe(true);
    expect(registrationReadinessSafeOff({ SEMESTER_REGISTRATION_READINESS_SAFE_OFF: 'on' })).toBe(true);
    expect(registrationReadinessSafeOff({ SEMESTER_REGISTRATION_READINESS_SAFE_OFF: 'true' })).toBe(true);
    expect(registrationReadinessSafeOff({ SEMESTER_REGISTRATION_READINESS_SAFE_OFF: 'pause' })).toBe(true);
  });
});
