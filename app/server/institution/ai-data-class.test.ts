import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { respond, type IntelligenceAuditRecord, type IntelligenceRespondInput } from './intelligence.ts';
import { PROVIDER_FIELD_CLASS, SOURCE_FIELD_CLASS, checkProviderRequest } from './ai-data-class.ts';
import type { IntelligenceGatewayRequest, TenantIntelligencePolicy } from '../../../packages/institution/src/intelligence.ts';
import { courseAgentPolicy } from '../../../packages/institution/src/course-agent-policy.ts';
import { AI_DATA_CEILING, AI_DATA_CLASSES } from '../../../packages/institution/src/ai-data-class.ts';

/**
 * C7 on the institution gateway: before a request reaches the provider, every
 * field it carries has a declared data class, and one above the ceiling (or
 * with none) is refused and audited by name, never by content.
 */

const scope = { origin: 'course', policyScope: 'course', policyCourseCode: 'ECON 101', policyTerm: '2026FA' };
const SECRET = 'Jordan Rivera, student id 20418837, midterm 61.5';

const request = (patch: Partial<IntelligenceGatewayRequest> = {}): IntelligenceGatewayRequest => ({
  version: 1, clientState: 'preview', tenantId: 'northstar', personId: 'student-1',
  question: 'What should I review?', mode: 'explain', category: 'study',
  sourceIds: ['syllabus'], evidenceIds: ['evidence-1'], proposedActions: [], ...patch,
});

const policy = (): TenantIntelligencePolicy => ({
  state: 'sandbox', permittedRoles: ['student'], allowedModes: ['explain', 'hint', 'practice', 'review'],
  allowedModels: ['openai:gpt-5-mini'], maxRequestCents: 2, retentionDays: 30,
});

function fixture(patch: Partial<IntelligenceRespondInput> = {}) {
  const audits: IntelligenceAuditRecord[] = [];
  const generate = vi.fn().mockResolvedValue({
    text: 'Review elasticity.', citedSourceIds: ['syllabus'], inputTokens: 80, outputTokens: 20, providerRequestId: 'r1',
  });
  const reserveBudget = vi.fn().mockResolvedValue({ id: 'res-1', reservedCents: 1 });
  const settleBudget = vi.fn().mockResolvedValue(true);
  const input: IntelligenceRespondInput = {
    identity: { userId: 'student-1', institutionId: 'northstar', roles: ['student'] },
    request: request(),
    tenantPolicy: policy(),
    loadCoursePolicy: async () => courseAgentPolicy(null),
    approvedSources: [{ ...scope, id: 'syllabus', evidenceIds: ['evidence-1'], body: 'Elasticity is on the exam.' }],
    modelTask: { candidates: [{ model: 'openai:gpt-5-mini', provider: 'openai', estimatedCents: 1.2 }] },
    generate, reserveBudget, settleBudget,
    audit: (_identity, record) => { audits.push(record); },
    ...patch,
  };
  return { input, audits, generate, reserveBudget };
}

describe('control: an allowed-class request still goes through', () => {
  it('reaches the provider with every field declared at or under the ceiling', async () => {
    const { input, generate, audits } = fixture();
    const out = await respond(input);
    expect(out.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(audits.map((a) => a.policyDecision)).toEqual(['sandbox:assistant:explain']);
  });
});

describe('what is refused before the provider is reached', () => {
  const taggedSource = { ...scope, id: 'syllabus', evidenceIds: ['evidence-1'], body: SECRET, dataClass: 'T3' };

  it('refuses a source that carries a field nobody classified, calls no provider and reserves no budget', async () => {
    const { input, generate, reserveBudget } = fixture({ approvedSources: [taggedSource] });
    const out = await respond(input);
    expect(out.status).toBe(403);
    expect(out.body.code).toBe('data-class-refused');
    expect(generate).not.toHaveBeenCalled();
    expect(reserveBudget).not.toHaveBeenCalled();
  });

  it('audits the refusal with no provider call, a decision that names the class, and none of the content', async () => {
    const { input, audits } = fixture({ approvedSources: [taggedSource], request: request({ question: SECRET }) });
    const out = await respond(input);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ policyDecision: 'data-class-refused:T3', inputTokens: 0, outputTokens: 0, costCents: 0 });
    expect(JSON.stringify(audits)).not.toContain('Rivera');
    expect(JSON.stringify(out)).not.toContain('Rivera');
    expect(JSON.stringify(out)).not.toContain('20418837');
  });

  it('refuses when the request the provider would see has a field with no declared class', () => {
    const verdict = checkProviderRequest({
      provider: 'openai', model: 'm', question: 'q', mode: 'explain', sources: [], maxOutputTokens: 10,
      guardianNotes: SECRET,
    } as never);
    expect(verdict).toEqual({ ok: false, fields: ['guardianNotes'], highest: 'T3' });
  });

  it('names a source field as sources[].field, never its value', () => {
    const verdict = checkProviderRequest({
      provider: 'openai', model: 'm', question: 'q', mode: 'explain', maxOutputTokens: 10,
      sources: [{ ...scope, id: 's', evidenceIds: [], body: 'b', dataClass: 'T3' }],
    } as never);
    expect(verdict).toEqual({ ok: false, fields: ['sources[].dataClass'], highest: 'T3' });
  });
});

describe('every field the provider request can carry is declared', () => {
  it('declares nothing above the ceiling', () => {
    for (const [field, cls] of [...Object.entries(PROVIDER_FIELD_CLASS), ...Object.entries(SOURCE_FIELD_CLASS)]) {
      expect(AI_DATA_CLASSES.indexOf(cls) <= AI_DATA_CLASSES.indexOf(AI_DATA_CEILING), field).toBe(true);
    }
  });

  it('covers every field of the request respond() really builds, and of a source', async () => {
    const { input, generate } = fixture();
    await respond(input);
    const sent = generate.mock.calls[0][0] as Record<string, unknown>;
    for (const k of Object.keys(sent)) expect(PROVIDER_FIELD_CLASS, k).toHaveProperty(k);
    for (const k of Object.keys((sent.sources as object[])[0])) expect(SOURCE_FIELD_CLASS, k).toHaveProperty(k);
  });

  it('is checked in respond() before the budget is reserved and the provider is called', () => {
    const src = readFileSync(new URL('./intelligence.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const check = src.indexOf('checkProviderRequest(');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(src.indexOf('input.reserveBudget('));
    expect(check).toBeLessThan(src.indexOf('input.generate('));
  });
});
