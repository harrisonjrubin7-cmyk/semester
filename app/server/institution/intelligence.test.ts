import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmAction, createIntelligenceService, respond, type IntelligenceRespondInput } from './intelligence.ts';
import type { IntelligenceGatewayRequest, TenantIntelligencePolicy } from '../../../packages/institution/src/intelligence.ts';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import { createGateway } from './gateway.ts';
import { ActionJournal } from './journal.ts';
import { courseAgentPolicy } from '../../../packages/institution/src/course-agent-policy.ts';
import { contextFor } from './context.ts';

const identity: UniversityIdentity = { userId: 'student-1', institutionId: 'northstar', roles: ['student'] };
const aiContext = contextFor(new Request('http://local/v1/intelligence/respond'), identity, {
  requestId: 'request-1', correlationId: 'correlation-1',
}, 'production', 'ai_context');
const sourceScope = {
  origin: 'course', policyScope: 'course', policyCourseCode: 'ECON 101', policyTerm: '2026FA',
  labels: {
    tenantId: 'northstar', purpose: 'ai_context' as const,
    source: { id: 'syllabus', kind: 'course' },
    freshness: { state: 'current' as const, observedAt: '2026-10-01T00:00:00.000Z' },
  },
};
const loadCoursePolicy = async () => courseAgentPolicy(null);

const request = (patch: Partial<IntelligenceGatewayRequest> = {}): IntelligenceGatewayRequest => ({
  version: 1,
  clientState: 'preview',
  tenantId: 'northstar',
  personId: 'student-1',
  question: 'What should I review?',
  mode: 'explain',
  category: 'study',
  sourceIds: ['syllabus'],
  evidenceIds: ['evidence-1'],
  proposedActions: [],
  ...patch,
});

const policy = (patch: Partial<TenantIntelligencePolicy> = {}): TenantIntelligencePolicy => ({
  state: 'sandbox',
  permittedRoles: ['student'],
  allowedModes: ['explain', 'hint', 'practice', 'review'],
  allowedModels: ['openai:gpt-5-mini'],
  maxRequestCents: 2,
  retentionDays: 30,
  ...patch,
});

const fixture = (patch: Partial<IntelligenceRespondInput> = {}): IntelligenceRespondInput => ({
  context: aiContext,
  identity,
  request: request(),
  tenantPolicy: policy(),
  loadCoursePolicy,
  approvedSources: [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'Elasticity is on the exam.' }],
  modelTask: { candidates: [{ model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1.2 }] },
  generate: vi.fn().mockResolvedValue({
    text: 'Review elasticity.', citedSourceIds: ['syllabus'], inputTokens: 80, outputTokens: 20, providerRequestId: 'response-1',
  }),
  ...patch,
});

describe('governed institution intelligence', () => {
  it('refuses a client production flag when the verified tenant policy is off', async () => {
    const response = await respond(fixture({ request: request({ clientState: 'production' }), tenantPolicy: policy({ state: 'off' }) }));
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('policy-disabled');
  });

  it('refuses identities whose verified roles are not permitted by tenant policy', async () => {
    const response = await respond(fixture({
      identity: { userId: 'student-1', institutionId: 'northstar', roles: ['family'] },
    }));
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('role-disabled');
  });

  it('returns model prose separately from approved evidence identifiers', async () => {
    const response = await respond(fixture());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ text: 'Review elasticity.', evidenceIds: ['evidence-1'] });
    expect(JSON.stringify(response.body)).not.toContain('Elasticity is on the exam');
  });

  it('refuses missing source approval before a provider sees the question', async () => {
    const generate = vi.fn();
    const response = await respond(fixture({ approvedSources: [], generate }));
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('source-not-approved');
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    ['another tenant', { ...sourceScope.labels, tenantId: 'eastfield' }],
    ['another purpose', { ...sourceScope.labels, purpose: 'search' as const }],
    ['another source', { ...sourceScope.labels, source: { id: 'catalog', kind: 'course' } }],
    ['stale content', { ...sourceScope.labels, freshness: { state: 'stale' as const, observedAt: '2025-01-01T00:00:00.000Z' } }],
  ])('refuses %s source labels before a provider sees content', async (_case, labels) => {
    const generate = vi.fn();
    const response = await respond(fixture({
      approvedSources: [{ ...sourceScope, labels, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'Private material' }],
      generate,
    }));
    expect(response).toMatchObject({ status: 403, body: { code: 'source-context-refused' } });
    expect(generate).not.toHaveBeenCalled();
  });

  it('refuses a request context that is not explicitly for AI retrieval', async () => {
    const generate = vi.fn();
    const searchContext = contextFor(new Request('http://local/v1/intelligence/respond'), identity, {
      requestId: 'request-2', correlationId: 'correlation-2',
    }, 'production', 'search');
    const response = await respond(fixture({ context: searchContext, generate }));
    expect(response).toMatchObject({ status: 403, body: { code: 'scope-refused' } });
    expect(generate).not.toHaveBeenCalled();
  });

  it('passes an explicit model, deadline signal and output bound to the provider', async () => {
    const generate = vi.fn().mockResolvedValue({
      text: 'Review elasticity.', citedSourceIds: ['syllabus'], inputTokens: 80, outputTokens: 20, providerRequestId: 'response-1',
    });
    expect((await respond(fixture({ generate }))).status).toBe(200);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'openai', model: 'gpt-5-mini', maxOutputTokens: 1_200,
    }), expect.any(AbortSignal));
  });

  it('maps provider failure without logging questions or protected source bodies', async () => {
    const audit = vi.fn();
    const response = await respond(fixture({
      generate: vi.fn().mockRejectedValue(new Error('PROTECTED SOURCE BODY in upstream failure')),
      audit,
    }));
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'provider-unavailable' });
    expect(JSON.stringify({ response, audit: audit.mock.calls })).not.toContain('PROTECTED SOURCE BODY');
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      policyDecision: 'provider-refused', inputTokens: 0, outputTokens: 0,
    }));
  });

  it('reserves tenant budget before provider work and settles authoritative usage', async () => {
    const order: string[] = [];
    const reserveBudget = vi.fn(async () => {
      order.push('reserve');
      return { id: 'reservation-1', reservedCents: 1.2 };
    });
    const generate = vi.fn(async () => {
      order.push('generate');
      return { text: 'Review elasticity.', citedSourceIds: ['syllabus'], inputTokens: 80, outputTokens: 20, providerRequestId: 'response-1' };
    });
    const settleBudget = vi.fn(async (_identity, _reservation, usage) => {
      order.push('settle');
      return usage !== null;
    });
    expect((await respond(fixture({ reserveBudget, generate, settleBudget }))).status).toBe(200);
    expect(order).toEqual(['reserve', 'generate', 'settle']);
    expect(settleBudget).toHaveBeenCalledWith(expect.anything(), { id: 'reservation-1', reservedCents: 1.2 }, {
      costCents: 1.2, inputTokens: 80, outputTokens: 20,
    });
  });

  it('does not call a provider after an atomic budget refusal', async () => {
    const generate = vi.fn();
    const response = await respond(fixture({ reserveBudget: async () => null, generate }));
    expect(response.status).toBe(429);
    expect(response.body.code).toBe('budget-exhausted');
    expect(generate).not.toHaveBeenCalled();
  });

  it('cannot apply a consequential action without a fresh explicit confirmation', async () => {
    const response = await confirmAction({
      identity: { userId: 'student-1', institutionId: 'northstar', roles: ['student'] },
      action: { id: 'submit-1', label: 'Submit draft', effect: 'Submit', target: 'draft:1', class: 'consequential', reversible: false, evidenceIds: [], tenantId: 'northstar', personId: 'student-1', preparedAt: '2026-09-23T11:58:00.000Z', expiresAt: '2026-09-23T12:03:00.000Z' },
      confirmation: null,
      now: Date.parse('2026-09-23T12:00:00.000Z'),
      execute: vi.fn(),
    });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('confirmation-required');
  });

  it('creates a receipt only after authoritative readback', async () => {
    const base = {
      identity: { userId: 'student-1', institutionId: 'northstar', roles: ['student'] } as UniversityIdentity,
      action: { id: 'save-1', label: 'Save plan', effect: 'Save', target: 'plan:1', class: 'internal-write' as const, reversible: true, evidenceIds: [], tenantId: 'northstar', personId: 'student-1', preparedAt: '2026-09-23T11:58:00.000Z', expiresAt: '2026-09-23T12:03:00.000Z' },
      confirmation: { confirmed: true as const, actorId: 'student-1', at: '2026-09-23T11:59:30.000Z' },
      now: Date.parse('2026-09-23T12:00:00.000Z'),
    };
    const missing = await confirmAction({ ...base, execute: async () => ({ verified: false as const }) });
    expect(missing.status).toBe(502);
    const verified = await confirmAction({ ...base, execute: async () => ({
      verified: true as const, receiptId: 'receipt-1', message: 'Saved and read back.', recordedAt: '2026-09-23T12:00:01.000Z',
    }) });
    expect(verified.status).toBe(200);
    expect(verified.body).toMatchObject({ id: 'receipt-1', authoritative: true });
  });

  it('prepares a server-issued, expiring, single-use action with its complete reviewed effect', async () => {
    const execute = vi.fn().mockResolvedValue({
      verified: true as const,
      receiptId: 'receipt-2',
      message: 'Saved and read back.',
      recordedAt: '2026-09-23T12:00:01.000Z',
    });
    const service = createIntelligenceService({
      status: 'configured-sandbox',
      loadPolicy: async () => policy(),
      loadCoursePolicy,
      loadApprovedSources: async () => [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'body' }],
      modelTask: async () => ({ candidates: [{ model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1 }] }),
      generate: async () => ({ text: 'Ready.', citedSourceIds: ['syllabus'], inputTokens: 1, outputTokens: 1, providerRequestId: 'response-2' }),
      execute,
    });
    const prepared = await service.respond(aiContext, identity, request({ proposedActions: [{
      id: 'client-id', label: 'Save plan', effect: 'Create one plan', target: 'plan:7',
      class: 'internal-write', reversible: true, evidenceIds: ['evidence-1'],
    }] }));
    const action = (prepared.body.actions as Array<{ id: string }>)[0];
    expect(action.id).not.toBe('client-id');
    const confirmation = { confirmed: true, at: new Date().toISOString() };
    expect((await service.confirm(identity, action.id, confirmation)).status).toBe(200);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      id: action.id, effect: 'Create one plan', target: 'plan:7', reversible: true,
    }));
    expect((await service.confirm(identity, action.id, confirmation)).status).toBe(404);
  });

  it('refuses to confirm an action reviewed before kill.ai_generation was engaged, and leaves it unspent', async () => {
    const execute = vi.fn().mockResolvedValue({
      verified: true as const, receiptId: 'receipt-k', message: 'Saved and read back.', recordedAt: '2026-09-23T12:00:01.000Z',
    });
    const audit = vi.fn();
    let engaged = false;
    const service = createIntelligenceService({
      status: 'configured-sandbox',
      killSwitch: async () => engaged,
      loadPolicy: async () => policy(),
      loadCoursePolicy,
      loadApprovedSources: async () => [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'body' }],
      modelTask: async () => ({ candidates: [{ model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1 }] }),
      generate: async () => ({ text: 'Ready.', citedSourceIds: ['syllabus'], inputTokens: 1, outputTokens: 1, providerRequestId: 'r' }),
      execute,
      audit,
    });
    const prepared = await service.respond(aiContext, identity, request({ proposedActions: [{
      id: 'a', label: 'Save plan', effect: 'Create one plan', target: 'plan:7',
      class: 'internal-write', reversible: true, evidenceIds: ['evidence-1'],
    }] }));
    const action = (prepared.body.actions as Array<{ id: string }>)[0];
    const confirmation = { confirmed: true, at: new Date().toISOString() };

    engaged = true;
    const stopped = await service.confirm(identity, action.id, confirmation);
    expect(stopped.status).toBe(503);
    expect(stopped.body).toMatchObject({ code: 'ai-generation-killed' });
    expect(execute).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(identity, expect.objectContaining({ category: 'action', policyDecision: 'kill-switch' }));

    // The refusal did not spend the action: released, the same confirmation runs it once.
    engaged = false;
    expect((await service.confirm(identity, action.id, confirmation)).status).toBe(200);
    expect(execute).toHaveBeenCalledTimes(1);
    expect((await service.confirm(identity, action.id, confirmation)).status).toBe(404);
  });

  it('discards an answer whose audit record cannot be written, and shows it when it can', async () => {
    let writable = false;
    const audit = vi.fn(async () => { if (!writable) throw new Error('journal down'); });
    const response = await respond(fixture({ audit }));
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ code: 'audit-unavailable' });
    expect(response.body.text).toBeUndefined();
    writable = true;
    const ok = await respond(fixture({ audit }));
    expect(ok.status).toBe(200);
    expect(ok.body.text).toBe('Review elasticity.');
  });

  it('refuses to generate, and to say what the policy allows, while kill.ai_generation is engaged', async () => {
    const generate = vi.fn();
    const audit = vi.fn();
    let engaged = true;
    const service = createIntelligenceService({
      status: 'configured-sandbox',
      killSwitch: async () => engaged,
      loadPolicy: async () => policy(),
      loadCoursePolicy,
      loadApprovedSources: async () => [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'body' }],
      modelTask: async () => ({ candidates: [{ model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1 }] }),
      generate,
      execute: async () => ({ verified: false }),
      audit,
    });
    const stopped = await service.respond(aiContext, identity, request());
    expect(stopped.status).toBe(503);
    expect(stopped.body).toMatchObject({ code: 'ai-generation-killed' });
    expect(generate).not.toHaveBeenCalled();
    expect((await service.policy(identity)).status).toBe(503);
    // The refusal is in the journal, as the switch working rather than a gap.
    expect(audit).toHaveBeenCalledWith(identity, expect.objectContaining({ policyDecision: 'kill-switch', provider: 'none', costCents: 0 }));

    // Released, the same service generates again: the check is per request.
    engaged = false;
    generate.mockResolvedValue({ text: 'Review elasticity.', citedSourceIds: ['syllabus'], inputTokens: 1, outputTokens: 1, providerRequestId: 'r' });
    expect((await service.respond(aiContext, identity, request())).status).toBe(200);
    expect((await service.policy(identity)).status).toBe(200);
  });

  it('exposes the versioned route and journals metadata without protected source bodies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'semester-intelligence-'));
    const file = join(dir, 'journal.sqlite');
    const journal = new ActionJournal(file, Buffer.alloc(32, 9));
    const service = createIntelligenceService({
      status: 'policy-disabled',
      loadPolicy: async () => policy({ state: 'off' }),
      loadCoursePolicy,
      loadApprovedSources: async () => [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'PROTECTED SOURCE BODY' }],
      modelTask: async () => ({ candidates: [] }),
      generate: vi.fn(),
      execute: async () => ({ verified: false }),
      audit: (who, record) => journal.auditIntelligence(who, record),
    });
    const gateway = createGateway({
      origin: 'http://localhost:5173', institutionName: 'Northstar',
      authenticate: async () => identity, adapters: [], journal, intelligence: service,
    });
    try {
      const response = await gateway(new Request('http://local/v1/intelligence/respond', {
        method: 'POST',
        headers: { origin: 'http://localhost:5173', authorization: 'Bearer test', 'content-type': 'application/json' },
        body: JSON.stringify(request({ clientState: 'production' })),
      }));
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'policy-disabled' });
      journal.close();
      const bytes = readFileSync(file).toString('utf8');
      expect(bytes).toContain('policy-disabled');
      expect(bytes).not.toContain('PROTECTED SOURCE BODY');
    } finally {
      try { journal.close(); } catch { /* already closed */ }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});


describe('role-specific institution boundaries', () => {
  it('does not let a tutor read a source from another course', async () => {
    const generate = fixture().generate;
    const response = await respond(fixture({
      request: request({ agent: 'tutor', courseId: 'ECON 101' }),
      approvedSources: [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'Private material', courseId: 'chem', policyCourseCode: 'CHEM 101' }], generate,
    }));
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('course-scope-required');
    expect(generate).not.toHaveBeenCalled();
  });

  it('requires a selected course for course-guide requests', async () => {
    const generate = fixture().generate;
    expect((await respond(fixture({ request: request({ agent: 'course-guide' }), generate }))).body.code).toBe('course-scope-required');
    expect(generate).not.toHaveBeenCalled();
  });

  it('passes the validated role and approved course scope to the provider', async () => {
    const generate = fixture().generate;
    const response = await respond(fixture({
      request: request({ agent: 'tutor', courseId: 'ECON 101' }),
      approvedSources: [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'Elasticity', courseId: 'econ' }], generate,
    }));
    expect(response.status).toBe(200);
    expect(response.body.agent).toBe('tutor');
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ agent: 'tutor' }), expect.any(AbortSignal));
  });

  it('refuses a consequential advisor action before invoking a provider', async () => {
    const generate = fixture().generate;
    const response = await respond(fixture({ request: request({ agent: 'advisor', proposedActions: [{
      id: 'drop', label: 'Drop course', effect: 'Drop', target: 'registration', class: 'consequential', reversible: false, evidenceIds: [],
    }] }), generate }));
    expect(response.body.code).toBe('agent-action-refused');
    expect(generate).not.toHaveBeenCalled();
  });
});


describe('course policy cannot be bypassed by switching agents', () => {
  it.each([undefined, async () => { throw new Error('policy store unavailable'); }])('refuses a missing or failed course-policy resolver before budget or generation', async (resolver) => {
    const generate = vi.fn();
    const reserveBudget = vi.fn();
    const response = await respond(fixture({ loadCoursePolicy: resolver, generate, reserveBudget }));
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('course-policy-unavailable');
    expect(generate).not.toHaveBeenCalled();
    expect(reserveBudget).not.toHaveBeenCalled();
  });

  it('refuses unbound sources through the exported boundary even with an allowed policy', async () => {
    const generate = vi.fn();
    const reserveBudget = vi.fn();
    const response = await respond(fixture({
      approvedSources: [{ ...sourceScope, id: 'syllabus', evidenceIds: [], body: 'Unbound source', policyScope: undefined }], generate, reserveBudget,
    }));
    expect(response.body.code).toBe('source-scope-unverified');
    expect(generate).not.toHaveBeenCalled();
    expect(reserveBudget).not.toHaveBeenCalled();
  });

  it.each(['assistant', 'advisor', 'tutor', 'course-guide'] as const)('checks %s against published course permissions before generation', async (agent) => {
    const generate = fixture().generate;
    const response = await respond(fixture({
      request: request({ agent, courseId: 'ECON 101' }),
      approvedSources: [{ ...sourceScope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'Elasticity', courseId: 'ECON 101' }],
      loadCoursePolicy: async () => ({ allowedModes: [], instruction: 'Course AI support is prohibited.' }), generate,
    }));
    expect(response.body.code).toBe('course-mode-disabled');
    expect(generate).not.toHaveBeenCalled();
  });
});
