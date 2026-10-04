import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../kernel/clock.ts';
import { PlatformError } from '../gateway/errors.ts';
import { buildRequestContext, assertSameTenant, scopeOf, type TrustedIdentity } from './context.ts';
import { OrgDirectory } from './organization.ts';

const clock = fixedClock('2026-10-04T12:00:00Z');
const deps = { clock, ids: sequentialIds() };

const identity = (over: Partial<TrustedIdentity> = {}): TrustedIdentity => ({
  actor: { personId: 'p1', type: 'user', authenticatedAt: '2026-10-04T11:00:00Z', sessionId: 's1' },
  tenant: { id: 'tenant-a', status: 'active', environment: 'production', verifiedBy: 'membership' },
  membershipIds: ['m1'],
  roleGrants: [],
  ...over,
});

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return e instanceof PlatformError ? e.code : 'not-a-platform-error';
  }
  return undefined;
};

describe('request context', () => {
  it('reads the tenant from the verified identity and nowhere else', () => {
    const ctx = buildRequestContext({ headers: {} }, identity(), deps);
    expect(ctx.tenantId).toBe('tenant-a');
    expect(ctx.verifiedBy).toBe('membership');
  });

  it('refuses a client that names a different tenant, rather than quietly overriding it', () => {
    expect(code(() => buildRequestContext({ headers: { 'X-Tenant-Id': 'tenant-b' } }, identity(), deps))).toBe('tenant_mismatch');
  });

  it('accepts a hint that agrees (control: the check is not just "any hint fails")', () => {
    expect(buildRequestContext({ headers: { 'x-tenant-id': 'tenant-a' } }, identity(), deps).tenantId).toBe('tenant-a');
  });

  it('fails closed on every missing piece', () => {
    expect(code(() => buildRequestContext({ headers: {} }, null, deps))).toBe('unauthenticated');
    const noVerification = identity();
    noVerification.tenant = { ...noVerification.tenant, verifiedBy: undefined };
    expect(code(() => buildRequestContext({ headers: {} }, noVerification, deps))).toBe('tenant_unresolved');
    const unknownVerification = identity();
    (unknownVerification.tenant as { verifiedBy: string }).verifiedBy = 'header';
    expect(code(() => buildRequestContext({ headers: {} }, unknownVerification, deps))).toBe('tenant_unresolved');
  });

  it.each(['provisioning', 'suspended', 'closing', 'closed'] as const)('refuses a %s tenant', (status: 'provisioning' | 'suspended' | 'closing' | 'closed') => {
    const i = identity();
    i.tenant = { ...i.tenant, status };
    expect(code(() => buildRequestContext({ headers: {} }, i, deps))).toBe('tenant_suspended');
  });

  it('replaces a malformed correlation id and keeps a well-formed one', () => {
    const bad = buildRequestContext({ headers: { 'x-correlation-id': 'x<script>' } }, identity(), deps);
    expect(bad.correlationId).not.toContain('<');
    const good = buildRequestContext({ headers: { 'X-Correlation-Id': 'client-corr-0001' } }, identity(), deps);
    expect(good.correlationId).toBe('client-corr-0001');
  });

  it('never echoes a client-sent request id', () => {
    const ctx = buildRequestContext({ headers: { 'x-request-id': 'attacker-chosen-id' } }, identity(), deps);
    expect(ctx.requestId).not.toBe('attacker-chosen-id');
  });

  it('refuses a malformed idempotency key instead of treating the request as non-idempotent', () => {
    expect(code(() => buildRequestContext({ headers: { 'idempotency-key': 'short' } }, identity(), deps))).toBe('invalid_request');
  });

  it('is frozen: a handler cannot widen its own context', () => {
    const ctx = buildRequestContext({ headers: {} }, identity({ roleGrants: [{ role: 'r', scopeKind: 'tenant', scopeId: 'tenant-a' }] }), deps);
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.actor)).toBe(true);
    expect(() => {
      (ctx as { tenantId: string }).tenantId = 'tenant-b';
    }).toThrow();
    expect(() => (ctx.roleGrants as unknown[]).push({})).toThrow();
  });

  it('assertSameTenant refuses a value carrying another tenant, or none', () => {
    const scope = scopeOf(buildRequestContext({ headers: {} }, identity(), deps));
    expect(() => assertSameTenant(scope, { tenantId: 'tenant-a' }, 'row')).not.toThrow();
    expect(code(() => assertSameTenant(scope, { tenantId: 'tenant-b' }, 'row'))).toBe('tenant_mismatch');
    expect(code(() => assertSameTenant(scope, {}, 'row'))).toBe('tenant_mismatch');
    expect(code(() => assertSameTenant(scope, undefined, 'row'))).toBe('tenant_mismatch');
  });
});

describe('organization directory', () => {
  const make = () => {
    const d = new OrgDirectory('tenant-a');
    d.add({ id: 'campus', tenantId: 'tenant-a', kind: 'campus', parentId: null, name: 'Main' });
    d.add({ id: 'dept', tenantId: 'tenant-a', kind: 'department', parentId: 'campus', name: 'Econ' });
    d.add({ id: 'sec', tenantId: 'tenant-a', kind: 'section', parentId: 'dept', name: 'ECON 101' });
    return d;
  };

  it('answers containment up the tree and not sideways', () => {
    const d = make();
    d.add({ id: 'other', tenantId: 'tenant-a', kind: 'department', parentId: 'campus', name: 'History' });
    expect(d.isWithin('sec', 'dept')).toBe(true);
    expect(d.isWithin('sec', 'campus')).toBe(true);
    expect(d.isWithin('sec', 'other')).toBe(false);
    expect(d.isWithin('dept', 'sec')).toBe(false);
  });

  it('refuses a node or a parent from another tenant', () => {
    const d = make();
    expect(d.add({ id: 'x', tenantId: 'tenant-b', kind: 'campus', parentId: null, name: 'Elsewhere' })).toMatchObject({ ok: false });
    expect(d.add({ id: 'y', tenantId: 'tenant-a', kind: 'program', parentId: 'not-here', name: 'Orphan' })).toMatchObject({ ok: false });
  });

  it('refuses duplicates and ids outside the closed alphabet', () => {
    const d = make();
    expect(d.add({ id: 'dept', tenantId: 'tenant-a', kind: 'department', parentId: 'campus', name: 'Dup' })).toMatchObject({ ok: false });
    expect(d.add({ id: 'a/b', tenantId: 'tenant-a', kind: 'group', parentId: null, name: 'Slash' })).toMatchObject({ ok: false });
  });
});
