import { describe, expect, it } from 'vitest';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import { MemoryRateLimiter } from '../institution/rate-limit.ts';
import { ALICE, BOB, T0, TASK_ID, createTask, harness, iso } from './fixtures.ts';
import { createProductivityApi } from './http.ts';
import { createProductionProductivityRuntime, principalFor, productivityEnabled } from './runtime.ts';

const member = (userId: string, institutionId = 'school-a'): UniversityIdentity => ({ userId, institutionId, roles: ['student'] });

describe('who the service believes is asking', () => {
  it('turns a verified member into a principal for their own school, and nothing wider', () => {
    const p = principalFor({ userId: ALICE, institutionId: 'school-a', roles: ['student', 'teaching_assistant'] }, iso(T0));
    expect(p.actor).toEqual({ id: ALICE, type: 'user', authenticatedAt: iso(T0) });
    expect(p.tenant).toEqual({ id: 'school-a', environment: 'production', verifiedBy: 'membership' });
    expect(p.roleGrants).toEqual([
      { role: 'student', scopeKind: 'tenant', scopeId: 'school-a' },
      { role: 'teaching_assistant', scopeKind: 'tenant', scopeId: 'school-a' },
    ]);
    expect(p.capabilities).toEqual(['productivity:use']);
    expect(p.consentGrantsFor).toBeUndefined();
  });

  it('is never a job: a bearer token cannot make a principal that imports or acts for somebody else', () => {
    const p = principalFor(member(ALICE), iso(T0));
    expect(p.actor.type).toBe('user');
    expect(p.tenant.verifiedBy).not.toBe('service_binding');
    expect(p.capabilities).not.toContain('calendar:import');
  });

  it('serves a member their own work through the real service, and a neighbour at the same school nothing of it', async () => {
    const h = harness();
    const api = createProductivityApi({
      service: h.service,
      authenticate: async (req) => {
        const who = /^Bearer (\w+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
        const identity = who === 'alice' ? member(ALICE) : who === 'bob' ? member(BOB) : who === 'elsewhere' ? member(ALICE, 'school-b') : null;
        return identity ? principalFor(identity, iso(T0)) : null;
      },
      limiters: { read: new MemoryRateLimiter({ windowMs: 60_000, max: 100 }), write: new MemoryRateLimiter({ windowMs: 60_000, max: 100 }) },
      now: () => T0,
    });
    const call = (path: string, as: string, init: RequestInit = {}) =>
      api(new Request(`http://api.test${path}`, { ...init, headers: { authorization: `Bearer ${as}`, 'content-type': 'application/json' } }));

    const wrote = await call('/v1/productivity/commands', 'alice', { method: 'POST', body: JSON.stringify({ commands: [createTask()] }) });
    expect(wrote.status).toBe(200);
    expect((await call(`/v1/tasks/${TASK_ID}`, 'alice')).status).toBe(200);
    // Same school, another person: it is not theirs to read without a share.
    expect((await call(`/v1/tasks/${TASK_ID}`, 'bob')).status).not.toBe(200);
    // Same person id at another school is another tenant's empty workspace.
    expect((await call(`/v1/tasks/${TASK_ID}`, 'elsewhere')).status).toBe(404);
    expect((await call('/v1/tasks', 'nobody')).status).toBe(401);
  });
});

describe('whether the service runs at all', () => {
  it('is off unless the deployment says on, and refuses to be built when it is off', () => {
    expect(productivityEnabled({})).toBe(false);
    expect(productivityEnabled({ SEMESTER_PRODUCTIVITY: 'true' })).toBe(false);
    expect(productivityEnabled({ SEMESTER_PRODUCTIVITY: 'on' })).toBe(true);
    expect(() => createProductionProductivityRuntime({})).toThrow(/SEMESTER_PRODUCTIVITY=on/);
  });

  it('refuses to start on, without the credentials it needs, rather than starting open', () => {
    expect(() => createProductionProductivityRuntime({ SEMESTER_PRODUCTIVITY: 'on' })).toThrow(/SEMESTER_AUTH_URL/);
    expect(() => createProductionProductivityRuntime({ SEMESTER_PRODUCTIVITY: 'on', SEMESTER_AUTH_URL: 'https://x.supabase.co', SEMESTER_AUTH_PUBLIC_KEY: 'p' })).toThrow(/SEMESTER_AUTH_SERVICE_KEY/);
  });
});
