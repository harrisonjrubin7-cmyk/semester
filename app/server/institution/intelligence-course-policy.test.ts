import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseIntelligenceRepository } from './intelligence-repository.ts';
import { createIntelligenceService } from './intelligence.ts';
import type { IntelligenceGatewayRequest } from '../../../packages/institution/src/intelligence.ts';
import type { ProviderGenerationRequest } from './providers/types.ts';
import { contextFor } from './context.ts';

type Row = Record<string, unknown>;
const identity = { userId: 'student-1', institutionId: 'northstar', roles: ['student'] as const };
const aiContext = contextFor(new Request('http://local/v1/intelligence/respond'), { ...identity, roles: [...identity.roles] }, {
  requestId: 'request-1', correlationId: 'correlation-1',
}, 'production', 'ai_context');
const course = { kind: 'course' as const, courseId: 'ECON 101', term: '2026FA' };
const source = (patch: Row = {}): Row => ({
  id: 'syllabus', tenant_id: 'northstar', course_id: 'ECON 101', origin: 'course',
  authority: 'authoritative', policy_scope: 'course', policy_course_code: 'ECON 101', policy_term: '2026FA',
  updated_at: '2026-10-01T00:00:00.000Z',
  ...patch,
});
const rule = (patch: Row = {}): Row => ({
  tenant_id: 'northstar', course_code: 'ECON 101', term: '2026FA', version: 1,
  blanket: 'prohibited', uses: {}, effective: null, ...patch,
});
const request = (patch: Partial<IntelligenceGatewayRequest> = {}): IntelligenceGatewayRequest => ({
  version: 1, clientState: 'production', tenantId: 'northstar', personId: 'student-1',
  question: 'Explain elasticity.', category: 'study', mode: 'explain', agent: 'assistant',
  courseId: 'ECON 101', term: '2026FA', sourceIds: ['syllabus'], evidenceIds: [], proposedActions: [], ...patch,
});

/** A relational fixture, not a canned query answer: omitted filters change the returned policy. */
function setup(rules = [rule()], sources = [source()], now = '2026-10-01T12:00:00Z') {
  const client = {
    from(table: string) {
      let rows = [...(table === 'approved_source' ? sources : rules)];
      const query = {
        select: (_columns: string) => query,
        eq: (key: string, value: unknown) => { rows = rows.filter((r) => r[key] === value); return query; },
        neq: (key: string, value: unknown) => { rows = rows.filter((r) => r[key] !== value); return query; },
        in: (key: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[key])); return query; },
        or: (filter: string) => {
          const match = /^effective\.is\.null,effective\.lte\.(\d{4}-\d{2}-\d{2})$/.exec(filter);
          if (!match) throw new Error(`Unexpected fixture filter: ${filter}`);
          rows = rows.filter((r) => r.effective === null || String(r.effective) <= match[1]);
          return query;
        },
        order: (key: string, options: { ascending: boolean }) => {
          rows.sort((a, b) => (Number(a[key]) - Number(b[key])) * (options.ascending ? 1 : -1)); return query;
        },
        limit: (count: number) => { rows = rows.slice(0, count); return query; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (done: (answer: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(done),
      };
      return query;
    },
    rpc: async (_name: string, args: { want_sources: string[] }) => ({
      data: args.want_sources.map((id) => ({ source_id: id, body: 'Approved course material.', evidence_ids: [] })), error: null,
    }),
  } as unknown as SupabaseClient;
  const repo = createSupabaseIntelligenceRepository({
    client, configuredModels: ['openai:test'], maxRequestCents: 2, now: () => new Date(now),
  });
  const generate = vi.fn(async (input: ProviderGenerationRequest) => ({
    text: 'A supported explanation.', citedSourceIds: input.sources.map((s) => s.id), inputTokens: 1, outputTokens: 1, providerRequestId: 'fixture',
  }));
  const service = createIntelligenceService({
    status: 'configured-sandbox',
    loadPolicy: async () => ({ state: 'sandbox', permittedRoles: ['student'], allowedModes: ['explain', 'hint', 'practice', 'review', 'draft'],
      allowedModels: ['openai:test'], maxRequestCents: 2, retentionDays: 0 }),
    loadApprovedSources: repo.loadApprovedSources, loadCoursePolicy: repo.loadCoursePolicy,
    modelTask: async () => ({ candidates: [{ provider: 'openai', model: 'openai:test', estimatedCents: 1 }] }),
    generate, execute: async () => ({ verified: false }),
  });
  return { repo, generate, service, ask: (patch: Partial<IntelligenceGatewayRequest> = {}) => service.respond(aiContext, { ...identity, roles: [...identity.roles] }, request(patch)) };
}

describe('authoritative source scope applies before institutional generation', () => {
  for (const agent of ['assistant', 'advisor', 'tutor', 'course-guide'] as const) {
    it.each([
      ['omitted course', { courseId: undefined }], ['substituted course', { courseId: 'CHEM 101' }],
      ['omitted term', { term: undefined }], ['unpublished term', { term: '2027SP' }],
      ['different allowed term', { term: '2026SP' }], ['both omitted', { courseId: undefined, term: undefined }],
    ] as const)('%s cannot bypass a prohibition through ' + agent, async (_label, patch) => {
      const { ask, generate } = setup([rule(), rule({ term: '2026SP', blanket: 'allowed' })]);
      expect((await ask({ ...patch, agent })).status).toBe(403);
      expect(generate).not.toHaveBeenCalled();
    });
  }

  it('allows a legitimately scoped legacy source ID after explicit institution binding', async () => {
    const { ask, generate } = setup([rule({ blanket: 'allowed' })], [source({ course_id: 'econ' })]);
    expect((await ask({ agent: 'tutor' })).status).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
  });

  it('derives omitted assistant scope from source approval rather than the request', async () => {
    const { ask, generate } = setup([rule({ blanket: 'allowed' })]);
    expect((await ask({ courseId: undefined, term: undefined })).status).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
  });

  it.each(['assistant', 'advisor', 'tutor', 'course-guide'] as const)('normalizes the course-code hint for %s without relaxing the published rule', async (agent) => {
    expect((await setup([rule({ blanket: 'allowed' })]).ask({ agent, courseId: 'econ  101' })).status).toBe(200);
    const blocked = setup();
    expect((await blocked.ask({ agent, courseId: 'econ  101' })).status).toBe(403);
    expect(blocked.generate).not.toHaveBeenCalled();
  });

  it.each([
    { policy_scope: null, policy_course_code: null, policy_term: null },
    { policy_course_code: null }, { policy_term: null }, { policy_course_code: 'econ' }, { policy_term: '2026WI' },
    { origin: 'institution', policy_scope: 'institution', policy_course_code: 'ECON 101', policy_term: null },
    { origin: 'library', policy_scope: 'institution', policy_course_code: null, policy_term: '2026FA' },
    { policy_scope: 'institution', policy_course_code: null, policy_term: null },
  ])('refuses an unbound or invalid academic source: %j', async (patch) => {
    const { ask, generate } = setup([], [source(patch)]);
    expect((await ask({ courseId: undefined, term: undefined })).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it('enforces every course policy for mixed-source assistant guidance', async () => {
    const { ask, generate } = setup([rule({ blanket: 'allowed' }), rule({ course_code: 'CHEM 101' })],
      [source(), source({ id: 'chemistry', course_id: 'chem', policy_course_code: 'CHEM 101' })]);
    expect((await ask({ courseId: undefined, term: undefined, sourceIds: ['syllabus', 'chemistry'] })).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
    // A valid focus hint cannot prune the other course's prohibition either.
    expect((await ask({ sourceIds: ['syllabus', 'chemistry'] })).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it('allows mixed-course guidance when every bound policy permits the mode', async () => {
    const { ask } = setup([rule({ blanket: 'allowed' }), rule({ course_code: 'CHEM 101', blanket: 'allowed' })],
      [source(), source({ id: 'chemistry', course_id: 'chem', policy_course_code: 'CHEM 101' })]);
    expect((await ask({ sourceIds: ['syllabus', 'chemistry'] })).status).toBe(200);
  });

  it('allows explicitly approved non-course institutional guidance', async () => {
    const { ask, generate } = setup([], [source({ origin: 'institution', policy_scope: 'institution', policy_course_code: null, policy_term: null })]);
    // The actual UI includes its incidental selected course and term.
    expect((await ask({ mode: 'draft' })).status).toBe(200);
    expect(generate).toHaveBeenCalledOnce();
  });

  it.each(['tutor', 'course-guide'] as const)('does not fabricate a course scope for %s from institution-only guidance', async (agent) => {
    const { ask, generate } = setup([], [source({ origin: 'institution', policy_scope: 'institution', policy_course_code: null, policy_term: null })]);
    expect((await ask({ agent })).status).toBe(403);
    expect(generate).not.toHaveBeenCalled();
  });

  it('allows only the unknown-policy conceptual modes after scope is verified', async () => {
    const { ask } = setup([]);
    expect((await ask()).status).toBe(200);
    expect((await ask({ mode: 'draft' })).status).toBe(403);
  });
});

describe('published policy effective dates use the server UTC day', () => {
  it.each([
    ['prohibited', 'allowed', []], ['allowed', 'prohibited', ['explain', 'hint', 'practice', 'review', 'draft']],
  ] as const)('retains the prior %s rule until a future %s version takes effect', async (previous, future, allowed) => {
    const { repo } = setup([rule({ blanket: previous }), rule({ version: 2, blanket: future, effective: '2026-10-02' })]);
    expect((await repo.loadCoursePolicy({ ...identity, roles: [...identity.roles] }, course)).allowedModes).toEqual(allowed);
  });

  it('activates a version on its effective UTC day, independent of caller timezone', async () => {
    const { repo } = setup([rule(), rule({ version: 2, blanket: 'allowed', effective: '2026-10-02' })], [source()], '2026-10-01T20:00:00-04:00');
    expect((await repo.loadCoursePolicy({ ...identity, roles: [...identity.roles] }, course)).allowedModes).toContain('draft');
  });

  it('treats a null effective date as immediately effective', async () => {
    const { repo } = setup([rule({ effective: '2026-09-01' }), rule({ version: 2, blanket: 'allowed' })]);
    expect((await repo.loadCoursePolicy({ ...identity, roles: [...identity.roles] }, course)).allowedModes).toContain('draft');
  });

  it('does not apply a future version when there is no earlier effective rule', async () => {
    const { repo } = setup([rule({ effective: '2026-10-02', blanket: 'allowed' })]);
    expect((await repo.loadCoursePolicy({ ...identity, roles: [...identity.roles] }, course)).allowedModes).toEqual(['explain', 'hint', 'practice']);
  });

  it('keeps tenant, course and term predicates when selecting the effective version', async () => {
    const { repo } = setup([rule(), rule({ version: 9, tenant_id: 'other', blanket: 'allowed' }),
      rule({ version: 9, course_code: 'CHEM 101', blanket: 'allowed' }), rule({ version: 9, term: '2026SP', blanket: 'allowed' })]);
    expect((await repo.loadCoursePolicy({ ...identity, roles: [...identity.roles] }, course)).allowedModes).toEqual([]);
  });

  it('retains version precedence among date-eligible policies', async () => {
    const { repo } = setup([rule({ effective: '2026-10-01' }), rule({ version: 2, effective: '2026-09-01', blanket: 'allowed' })]);
    expect((await repo.loadCoursePolicy({ ...identity, roles: [...identity.roles] }, course)).allowedModes).toContain('draft');
  });
});
