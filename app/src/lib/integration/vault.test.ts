import { describe, expect, it } from 'vitest';
import { inspect } from 'node:util';
import {
  LeaseBroker, LeaseExpired, memoryBackend, parseReference, rotationStatus,
  type LeaseRequest, type VaultAuditEvent,
} from './vault';

const SECRET = 'tenant-secret-value-must-not-print';
const rotatedAt = new Date('2026-09-01T00:00:00Z');
const t0 = new Date('2026-10-01T12:00:00Z');

function setup(opts: { audit?: (e: VaultAuditEvent) => void | Promise<void>; schemes?: ('vault' | 'env' | 'secret-manager')[]; sandbox?: boolean } = {}) {
  let now = t0;
  const events: VaultAuditEvent[] = [];
  const backend = memoryBackend({
    'vault:tenants/school-a/lms': { value: SECRET, version: 'v3', rotatedAt },
    'vault:tenants/school-b/lms': { value: 'B-SECRET', version: 'v1', rotatedAt },
    'vault:platform/mailer': { value: 'platform-secret', version: 'v1', rotatedAt },
    'vault:sandbox/mock-lms': { value: 'sandbox-secret', version: 'v1', rotatedAt },
    'env:LMS_TOKEN': { value: 'env-secret', version: 'v1', rotatedAt },
  });
  const broker = new LeaseBroker({
    backend, now: () => now, allowSandbox: opts.sandbox, allowedSchemes: opts.schemes,
    audit: opts.audit ?? ((e) => { events.push(e); }),
  });
  const request = (over: Partial<LeaseRequest> = {}): LeaseRequest => ({
    reference: 'vault:tenants/school-a/lms', tenantId: 'school-a', connectionId: 'conn-1', purpose: 'sync', ...over,
  });
  return { broker, backend, events, request, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

describe('credential leases', () => {
  it('leases a secret inside the tenant’s own namespace, and records it', async () => {
    const { broker, events, request } = setup();
    const result = await broker.lease(request());
    expect(result.ok && result.lease.reveal()).toBe(SECRET);
    expect(events).toEqual([expect.objectContaining({ event: 'credential.leased', reference: 'vault:tenants/school-a/lms', connectionId: 'conn-1', purpose: 'sync' })]);
  });

  it('refuses another tenant’s secret before it asks the backend', async () => {
    const { broker, backend, events, request } = setup();
    const result = await broker.lease(request({ reference: 'vault:tenants/school-b/lms' }));
    expect(result).toEqual({ ok: false, reason: 'wrong_tenant' });
    expect(backend.reads).toEqual([]);
    expect(events[0]).toMatchObject({ event: 'credential.refused', reason: 'wrong_tenant' });
  });

  it('refuses a path that climbs out of the namespace', async () => {
    const { broker, backend, request } = setup();
    for (const path of ['tenants/school-a/../school-b/lms', 'tenants/school-a//lms']) {
      expect(await broker.lease(request({ reference: `vault:${path}` })), path).toEqual({ ok: false, reason: 'wrong_tenant' });
    }
    expect(backend.reads).toEqual([]);
  });

  it('allows platform credentials, and sandbox ones only when told to', async () => {
    const platform = setup();
    expect((await platform.broker.lease(platform.request({ reference: 'vault:platform/mailer' }))).ok).toBe(true);
    const closed = setup();
    expect(await closed.broker.lease(closed.request({ reference: 'vault:sandbox/mock-lms' }))).toEqual({ ok: false, reason: 'wrong_tenant' });
    const open = setup({ sandbox: true });
    expect((await open.broker.lease(open.request({ reference: 'vault:sandbox/mock-lms' }))).ok).toBe(true);
  });

  it('refuses env pointers unless the environment allows them', async () => {
    const strict = setup();
    expect(await strict.broker.lease(strict.request({ reference: 'env:LMS_TOKEN' }))).toEqual({ ok: false, reason: 'scheme_not_allowed' });
    const dev = setup({ schemes: ['vault', 'env'], sandbox: true });
    // Allowed scheme, but `LMS_TOKEN` is outside every namespace, so still refused.
    expect(await dev.broker.lease(dev.request({ reference: 'env:LMS_TOKEN' }))).toEqual({ ok: false, reason: 'wrong_tenant' });
  });

  it('refuses a malformed pointer, a secret that is not there, and a bad lifetime', async () => {
    const { broker, request } = setup();
    expect(await broker.lease(request({ reference: SECRET }))).toEqual({ ok: false, reason: 'malformed_reference' });
    expect(await broker.lease(request({ reference: 'vault:tenants/school-a/missing' }))).toEqual({ ok: false, reason: 'not_found' });
    for (const ttlMs of [0, -1, Number.NaN, Infinity, 60 * 60_000]) {
      expect(await broker.lease(request({ ttlMs })), String(ttlMs)).toEqual({ ok: false, reason: 'ttl_invalid' });
    }
  });

  it('writes the audit record before issuing the lease: no record, no lease', async () => {
    const { broker, request } = setup({ audit: () => { throw new Error('audit store down'); } });
    expect(await broker.lease(request())).toEqual({ ok: false, reason: 'audit_unavailable' });
    // A refusal that cannot be recorded reports the same, rather than hiding it.
    expect(await broker.lease(request({ reference: 'vault:tenants/school-b/lms' }))).toEqual({ ok: false, reason: 'audit_unavailable' });
  });

  it('expires: reveal after the lifetime throws', async () => {
    const { broker, request, advance } = setup();
    const result = await broker.lease(request({ ttlMs: 60_000 }));
    if (!result.ok) throw new Error('expected a lease');
    expect(result.lease.reveal()).toBe(SECRET);
    advance(59_999);
    expect(result.lease.reveal()).toBe(SECRET);
    advance(1);
    expect(() => result.lease.reveal()).toThrow(LeaseExpired);
  });

  it('forgets the value on release', async () => {
    const { broker, request } = setup();
    const result = await broker.lease(request());
    if (!result.ok) throw new Error('expected a lease');
    result.lease.release();
    expect(() => result.lease.reveal()).toThrow(LeaseExpired);
  });

  it('never prints the value: JSON, string, template, inspect, audit', async () => {
    const { broker, events, request } = setup();
    const result = await broker.lease(request());
    if (!result.ok) throw new Error('expected a lease');
    const { lease } = result;
    for (const printed of [JSON.stringify(lease), String(lease), `${lease}`, inspect(lease), inspect({ nested: { lease } }, { depth: 5 }), JSON.stringify(events)]) {
      expect(printed).not.toContain(SECRET);
    }
    expect(JSON.parse(JSON.stringify(lease))).toMatchObject({ reference: 'vault:tenants/school-a/lms', value: '[redacted]' });
  });
});

describe('references and rotation', () => {
  it('parses the pointer shapes the declaration allows, and nothing else', () => {
    expect(parseReference('vault:tenants/a/b')).toEqual({ scheme: 'vault', path: 'tenants/a/b' });
    expect(parseReference('secret-manager:x')).toEqual({ scheme: 'secret-manager', path: 'x' });
    for (const bad of ['', 'vault:', 'http://x', 'vault:with space', 'file:/etc/passwd', 'a-raw-secret']) expect(parseReference(bad), bad).toBeNull();
  });

  it('flags a secret as due in the last tenth of its life, and overdue after', () => {
    const at = (days: number) => new Date(rotatedAt.getTime() + days * 86_400_000);
    expect(rotationStatus(rotatedAt, 90, at(10))).toBe('ok');
    expect(rotationStatus(rotatedAt, 90, at(80.9))).toBe('ok');
    expect(rotationStatus(rotatedAt, 90, at(81))).toBe('due');
    expect(rotationStatus(rotatedAt, 90, at(89.9))).toBe('due');
    expect(rotationStatus(rotatedAt, 90, at(90))).toBe('overdue');
  });
});
