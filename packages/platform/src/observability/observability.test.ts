import { describe, expect, it } from '../../../../app/node_modules/vitest/dist/index.js';
import { fixedClock } from '../kernel/clock.ts';
import { REDACTED, redact } from './redact.ts';
import {
  FORBIDDEN_METRIC_LABELS, MIN_SLO_BY_TIER, MemoryLogSink, PLATFORM_METRICS, PLATFORM_SERVICES, createLogger, defineMetric, descriptorProblems, type ServiceDescriptor,
} from './telemetry.ts';

describe('redaction', () => {
  it('redacts by key: secrets, personal fields, and free text (length only)', () => {
    const out = redact({
      password: 'hunter2', apiKey: 'sk_live', Authorization: 'Bearer x', sessionToken: 't',
      email: 'a@b.edu', phone: '555', dateOfBirth: '2005-01-01', firstName: 'Ada',
      essay: 'x', body: 'a long private paragraph', note: 'hi', prompt: 'tell me',
      gradeId: 'g1', count: 3, nested: { token: 'abc', ok: true },
    }) as Record<string, unknown>;
    expect(out.password).toBe(REDACTED);
    expect(out.apiKey).toBe(REDACTED);
    expect(out.Authorization).toBe(REDACTED);
    expect(out.sessionToken).toBe(REDACTED);
    expect(out.email).toBe(REDACTED);
    expect(out.dateOfBirth).toBe(REDACTED);
    expect(out.firstName).toBe(REDACTED);
    expect(out.body).toBe('[24 chars]');
    expect(out.note).toBe('[2 chars]');
    expect(out.prompt).toBe('[7 chars]');
    expect(out.gradeId).toBe('g1');
    expect(out.count).toBe(3);
    expect(out.nested).toEqual({ token: REDACTED, ok: true });
    expect(out.essay).toBe('[1 chars]');
  });

  it('bounds depth, string length and array length', () => {
    let deep: Record<string, unknown> = { leaf: 'x' };
    for (let i = 0; i < 20; i++) deep = { n: deep };
    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
    expect((redact('y'.repeat(1000)) as string).length).toBeLessThan(300);
    expect((redact(Array.from({ length: 500 }, (_, i) => i)) as number[]).length).toBe(50);
  });

  it('passes through null, undefined and primitives', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(7)).toBe(7);
  });
});

describe('logger', () => {
  it('stamps service, correlation, tenant and request ids and redacts fields on the way in', () => {
    const sink = new MemoryLogSink();
    const log = createLogger('gateway', { correlationId: 'corr-12345678', requestId: 'req-1', tenantId: 't1' }, { clock: fixedClock('2026-10-04T12:00:00Z'), sink });
    log.log('warn', 'something odd', { password: 'x', code: 'E1' });
    expect(sink.records[0]).toEqual({
      at: '2026-10-04T12:00:00.000Z', level: 'warn', service: 'gateway', msg: 'something odd', correlationId: 'corr-12345678', requestId: 'req-1', tenantId: 't1',
      fields: { password: REDACTED, code: 'E1' },
    });
  });

  it('bounds the message', () => {
    const sink = new MemoryLogSink();
    createLogger('s', { correlationId: 'corr-12345678' }, { clock: fixedClock(0), sink }).log('info', 'z'.repeat(2000));
    expect(sink.records[0].msg).toHaveLength(500);
  });
});

describe('metrics', () => {
  it('refuses tenant, person, session and request ids as labels — every one of them', () => {
    for (const label of FORBIDDEN_METRIC_LABELS) {
      expect(() => defineMetric({ name: 'semester_x_total', kind: 'counter', unit: '1', help: '', labels: [label] }), label).toThrow(/unbounded or identifying/);
    }
    expect(() => defineMetric({ name: 'semester_x_total', kind: 'counter', unit: '1', help: '', labels: ['Tenant_Id'] })).toThrow();
  });

  it('enforces naming and label count', () => {
    expect(() => defineMetric({ name: 'x_total', kind: 'counter', unit: '1', help: '', labels: [] })).toThrow(/semester_snake_case/);
    expect(() => defineMetric({ name: 'semester_ok', kind: 'gauge', unit: '1', help: '', labels: ['A-b'] })).toThrow(/snake_case/);
    expect(() => defineMetric({ name: 'semester_ok', kind: 'gauge', unit: '1', help: '', labels: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] })).toThrow(/6 labels/);
  });

  it('the shipped platform metrics are valid, unique, and include the isolation-violation alarm', () => {
    expect(new Set(PLATFORM_METRICS.map((m) => m.name)).size).toBe(PLATFORM_METRICS.length);
    expect(PLATFORM_METRICS.map((m) => m.name)).toContain('semester_tenant_isolation_violation_total');
  });
});

describe('service descriptors', () => {
  const ok: ServiceDescriptor = {
    id: 'demo', owner: 'platform', tier: 1, description: 'x', slos: [{ name: 'a', target: 0.995, windowDays: 30, indicator: 'ratio' }],
    runbook: 'docs/platform/OPERATIONS.md', dataClasses: ['internal'], dependsOn: [], degradesToNative: true,
  };

  it('accepts a complete descriptor and ships valid platform services', () => {
    expect(descriptorProblems(ok)).toEqual([]);
    for (const s of PLATFORM_SERVICES) expect(descriptorProblems(s), s.id).toEqual([]);
    expect(new Set(PLATFORM_SERVICES.map((s) => s.id)).size).toBe(PLATFORM_SERVICES.length);
  });

  it('every dependency of a platform service is itself a platform service', () => {
    const ids = new Set(PLATFORM_SERVICES.map((s) => s.id));
    for (const s of PLATFORM_SERVICES) for (const d of s.dependsOn) expect(ids.has(d), `${s.id} → ${d}`).toBe(true);
  });

  it('a higher tier cannot declare a weaker target than its floor', () => {
    expect(descriptorProblems({ ...ok, tier: 0 })).toContainEqual(expect.stringContaining(`floor ${MIN_SLO_BY_TIER[0]}`));
    expect(descriptorProblems({ ...ok, tier: 3 })).toEqual([]);
  });

  it('reports each missing piece of operational metadata', () => {
    const bad = descriptorProblems({ ...ok, id: 'Bad Id', owner: ' ', slos: [], runbook: 'wiki/page', dataClasses: [], dependsOn: ['Bad Id'] });
    expect(bad.length).toBeGreaterThanOrEqual(6);
    expect(descriptorProblems({ ...ok, slos: [{ name: 'a', target: 1, windowDays: 3, indicator: '' }] }).length).toBeGreaterThanOrEqual(3);
  });
});
