import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { confirmAction, createIntelligenceService, respond, type IntelligenceRespondInput } from './intelligence.ts';
import type { IntelligenceGatewayRequest, TenantIntelligencePolicy } from '../../../packages/institution/src/intelligence.ts';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import { createGateway } from './gateway.ts';
import { ActionJournal } from './journal.ts';

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
  identity: { userId: 'student-1', institutionId: 'northstar', roles: ['student'] },
  request: request(),
  tenantPolicy: policy(),
  approvedSources: [{ id: 'syllabus', evidenceIds: ['evidence-1'], body: 'Elasticity is on the exam.' }],
  modelTask: { candidates: [{ model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1.2 }] },
  generate: vi.fn().mockResolvedValue({ text: 'Review elasticity.', inputTokens: 80, outputTokens: 20 }),
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
      loadApprovedSources: async () => [{ id: 'syllabus', evidenceIds: ['evidence-1'], body: 'body' }],
      modelTask: async () => ({ candidates: [{ model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1 }] }),
      generate: async () => ({ text: 'Ready.', inputTokens: 1, outputTokens: 1 }),
      execute,
    });
    const identity: UniversityIdentity = { userId: 'student-1', institutionId: 'northstar', roles: ['student'] };
    const prepared = await service.respond(identity, request({ proposedActions: [{
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

  it('exposes the versioned route and journals metadata without protected source bodies', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'semester-intelligence-'));
    const file = join(dir, 'journal.sqlite');
    const journal = new ActionJournal(file, Buffer.alloc(32, 9));
    const identity: UniversityIdentity = { userId: 'student-1', institutionId: 'northstar', roles: ['student'] };
    const service = createIntelligenceService({
      status: 'policy-disabled',
      loadPolicy: async () => policy({ state: 'off' }),
      loadApprovedSources: async () => [{ id: 'syllabus', evidenceIds: ['evidence-1'], body: 'PROTECTED SOURCE BODY' }],
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
