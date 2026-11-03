import { describe, expect, it, vi } from 'vitest';
import type { RequestContext } from '../../../packages/platform/src/index.ts';
import type { RegistrationReadinessEvaluationRecord } from '../../../packages/institution/src/readiness-workflow.ts';
import type { RegistrationReadinessRepository } from './readiness-service.ts';
import type { RegistrationReadinessCommandBoundary } from './registration-readiness-commands.ts';
import {
  ActivationControlledRegistrationReadinessCommands,
  REGISTRATION_READINESS_CAPABILITY,
  REGISTRATION_READINESS_ROLLOUT_FLAG,
  ScopedRegistrationReadinessActivationGate,
  type RegistrationReadinessActivationFacts,
  type RegistrationReadinessActivationRequest,
} from './registration-readiness-activation.ts';

const NOW = '2026-10-10T12:00:00.000Z';
const context = (tenantId = 'northstar'): RequestContext => ({
  tenantId,
  environment: 'production',
  verifiedBy: 'membership',
  actor: { personId: 'student-1', type: 'user', authenticatedAt: NOW },
  membershipIds: [`${tenantId}:student-1`],
  roleGrants: [{ role: 'student', scopeKind: 'tenant', scopeId: tenantId }],
  capabilities: [],
  purpose: 'service_delivery',
  correlationId: 'corr-readiness-activation-1',
  requestId: 'request-readiness-activation-1',
  idempotencyKey: 'readiness-activation-1',
  receivedAt: NOW,
});

const scope = {
  campusIds: ['main-campus'],
  termIds: ['2027-spring'],
  cohortIds: ['pilot-a'],
  roles: ['student'] as const,
};

function facts(overrides: Partial<RegistrationReadinessActivationFacts> = {}): RegistrationReadinessActivationFacts {
  return {
    tenantId: 'northstar',
    subject: { tenantId: 'northstar', campusIds: ['main-campus'], cohortIds: ['pilot-a'] },
    platformCapability: { key: REGISTRATION_READINESS_CAPABILITY, available: true },
    entitlement: {
      tenantId: 'northstar', capability: REGISTRATION_READINESS_CAPABILITY, enabled: true,
      effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: '2026-11-01T00:00:00.000Z',
    },
    rollout: {
      tenantId: 'northstar', flag: REGISTRATION_READINESS_ROLLOUT_FLAG, enabled: true, scope,
      effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: '2026-11-01T00:00:00.000Z',
    },
    approval: {
      id: 'approval-1', auditEventId: 'audit-1', tenantId: 'northstar',
      capability: REGISTRATION_READINESS_CAPABILITY, status: 'approved',
      requestedBy: 'product-owner', approvedBy: 'institution-owner', scope,
      effectiveFrom: '2026-10-01T00:00:00.000Z', effectiveUntil: '2026-11-01T00:00:00.000Z',
    },
    integration: {
      tenantId: 'northstar', status: 'healthy', checkedAt: '2026-10-10T11:55:00.000Z',
      freshUntil: '2026-10-10T12:05:00.000Z',
    },
    killSwitch: { tenantId: 'northstar', engaged: false },
    queue: { tenantId: 'northstar', state: 'accepting' },
    ...overrides,
  };
}

const request = (tenantId = 'northstar'): RegistrationReadinessActivationRequest => ({
  context: context(tenantId), roles: ['student'], termId: '2027-spring', operation: 'start', evaluatedAt: NOW,
});

describe('scoped registration-readiness activation', () => {
  it('allows only when capability, entitlement, rollout, scope, approval, health, queue and kill switch agree', async () => {
    const gate = new ScopedRegistrationReadinessActivationGate({ load: async () => facts() });
    await expect(gate.decide(request())).resolves.toEqual({
      allowed: true, approvalId: 'approval-1', auditEventId: 'audit-1', effectiveUntil: '2026-11-01T00:00:00.000Z',
    });
  });

  it.each([
    ['capability_unavailable', { platformCapability: { key: REGISTRATION_READINESS_CAPABILITY as typeof REGISTRATION_READINESS_CAPABILITY, available: false } }],
    ['tenant_entitlement_missing', { entitlement: { ...facts().entitlement, enabled: false } }],
    ['rollout_flag_off', { rollout: { ...facts().rollout, enabled: false } }],
    ['approval_missing_or_stale', { approval: { ...facts().approval!, effectiveUntil: NOW } }],
    ['integration_unhealthy', { integration: { ...facts().integration, status: 'degraded' as const } }],
    ['queue_paused', { queue: { tenantId: 'northstar', state: 'paused' as const } }],
    ['kill_switch_engaged', { killSwitch: { tenantId: null, engaged: true } }],
  ])('denies %s independently', async (code, override) => {
    const gate = new ScopedRegistrationReadinessActivationGate({
      load: async () => facts(override as Partial<RegistrationReadinessActivationFacts>),
    });
    await expect(gate.decide(request())).resolves.toMatchObject({ allowed: false, code });
  });

  it.each([
    ['campus', { ...scope, campusIds: ['other-campus'] }],
    ['term', { ...scope, termIds: ['2027-fall'] }],
    ['cohort', { ...scope, cohortIds: ['pilot-b'] }],
    ['role', { ...scope, roles: ['faculty'] as const }],
  ])('denies an out-of-scope %s', async (_label, narrowed) => {
    const gate = new ScopedRegistrationReadinessActivationGate({
      load: async () => facts({ rollout: { ...facts().rollout, scope: narrowed } }),
    });
    await expect(gate.decide(request())).resolves.toMatchObject({ allowed: false, code: 'scope_not_approved' });
  });

  it('fails closed when a source returns another tenant and does not reveal which fact crossed tenants', async () => {
    const gate = new ScopedRegistrationReadinessActivationGate({
      load: async () => facts({ integration: { ...facts().integration, tenantId: 'other-school' } }),
    });
    await expect(gate.decide(request())).resolves.toEqual({
      allowed: false,
      code: 'activation_facts_invalid',
      fallback: 'Registration readiness is unavailable right now. Use your university registration portal or contact advising.',
    });
  });

  it('fails closed when the activation source is unavailable', async () => {
    const gate = new ScopedRegistrationReadinessActivationGate({ load: async () => { throw new Error('database unavailable'); } });
    await expect(gate.decide(request())).resolves.toMatchObject({ allowed: false, code: 'activation_facts_invalid' });
  });
});

describe('registration-readiness activation enforcement', () => {
  it('enforces disable and re-enable before persistence or evaluator work', async () => {
    let active = true;
    const activation = {
      decide: vi.fn(async () => active
        ? { allowed: true as const, approvalId: 'approval-1', auditEventId: 'audit-1', effectiveUntil: '2026-11-01T00:00:00.000Z' }
        : { allowed: false as const, code: 'kill_switch_engaged' as const, fallback: 'Use the official portal.' }),
    };
    const delegate: RegistrationReadinessCommandBoundary = {
      start: vi.fn(async () => ({
        evaluationId: 'evaluation-1', id: 'key-1', status: 'pending' as const, state: 'requested' as const, recordVersion: 1,
        recordedAt: NOW, correlationId: 'corr-readiness-activation-1',
      })),
      evaluate: vi.fn(async () => ({
        evaluationId: 'evaluation-1', id: 'key-2', status: 'completed' as const, state: 'ready' as const, recordVersion: 3,
        recordedAt: NOW, correlationId: 'corr-readiness-activation-1',
      })),
    };
    const record = { id: 'evaluation-1', tenantId: 'northstar', subjectId: 'student-1', termId: '2027-spring' } as RegistrationReadinessEvaluationRecord;
    const repository = { get: vi.fn(async () => record) } as unknown as RegistrationReadinessRepository;
    const commands = new ActivationControlledRegistrationReadinessCommands(delegate, repository, activation, () => new Date(NOW));

    await commands.start(context(), ['student'], { termId: '2027-spring' });
    active = false;
    await expect(commands.evaluate(context(), ['student'], 'evaluation-1')).rejects.toMatchObject({
      code: 'registration_readiness_paused', status: 503,
      userAction: { kind: 'contact_support' },
    });
    expect(delegate.evaluate).not.toHaveBeenCalled();
    active = true;
    await expect(commands.evaluate(context(), ['student'], 'evaluation-1')).resolves.toMatchObject({ state: 'ready' });
    expect(delegate.evaluate).toHaveBeenCalledTimes(1);
  });

  it('looks up evaluate records inside the trusted tenant and hides cross-subject records', async () => {
    const delegate: RegistrationReadinessCommandBoundary = { start: vi.fn(), evaluate: vi.fn() };
    const repository = {
      get: vi.fn(async () => ({ tenantId: 'northstar', subjectId: 'student-2', termId: '2027-spring' })),
    } as unknown as RegistrationReadinessRepository;
    const activation = { decide: vi.fn() };
    const commands = new ActivationControlledRegistrationReadinessCommands(delegate, repository, activation);

    await expect(commands.evaluate(context(), ['student'], 'evaluation-1')).rejects.toMatchObject({ code: 'not_found' });
    expect(repository.get).toHaveBeenCalledWith('northstar', 'evaluation-1');
    expect(activation.decide).not.toHaveBeenCalled();
    expect(delegate.evaluate).not.toHaveBeenCalled();
  });
});
