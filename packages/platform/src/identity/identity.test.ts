import { describe, expect, it } from 'vitest';
import { OrgDirectory } from '../tenancy/organization.ts';
import { isLive, liveAffiliations, sourceMayAssert, strongerSource, type Affiliation } from './affiliation.ts';
import { findLiveRelationship, relationshipIsLive, type Relationship } from './relationship.ts';
import { consentIsLive, findCoveringConsent, toPolicyGrant, withdraw, type ConsentRecord } from './consent.ts';
import { CapabilityRegistry, resolveCapabilities } from './capability.ts';
import { APPROVAL, consume, decide, expireIfDue, isApprovedFor, openApproval, type ApprovalRequest } from './approval.ts';
import { GENESIS_HASH, MemoryAuditLog, verifyAuditChain } from './audit.ts';
import { fixedClock, sequentialIds } from '../kernel/clock.ts';
import { buildRequestContext } from '../tenancy/context.ts';
import { transition } from '../seam/institution.ts';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const iso = (offsetDays: number) => new Date(NOW + offsetDays * 86_400_000).toISOString();

describe('affiliations', () => {
  const base: Affiliation = { id: 'a1', tenantId: 't', personId: 'p', kind: 'student', status: 'active', nodeId: null, source: 'institution_record', validFrom: iso(-30) };

  it('is live only while active (or on leave) and inside its dates', () => {
    expect(isLive(base, NOW)).toBe(true);
    expect(isLive({ ...base, status: 'on_leave' }, NOW)).toBe(true);
    expect(isLive({ ...base, status: 'ended' }, NOW)).toBe(false);
    expect(isLive({ ...base, status: 'pending' }, NOW)).toBe(false);
    expect(isLive({ ...base, validFrom: iso(1) }, NOW)).toBe(false);
    expect(isLive({ ...base, validTo: iso(-1) }, NOW)).toBe(false);
    expect(isLive({ ...base, validTo: iso(5) }, NOW)).toBe(true);
    expect(isLive({ ...base, validFrom: 'garbage' }, NOW)).toBe(false);
  });

  it('never returns another tenant\'s affiliation', () => {
    const rows = [base, { ...base, id: 'a2', tenantId: 'other' }];
    expect(liveAffiliations(rows, 't', 'p', NOW).map((a) => a.id)).toEqual(['a1']);
  });

  it('a self-declaration cannot make anyone faculty', () => {
    expect(sourceMayAssert('self_declared', 'faculty')).toBe(false);
    expect(sourceMayAssert('self_declared', 'applicant')).toBe(true);
    expect(sourceMayAssert('institution_record', 'faculty')).toBe(true);
    expect(strongerSource('self_declared', 'scim')).toBe('scim');
  });
});

describe('relationships', () => {
  const guardian: Relationship = { id: 'r', tenantId: 't', fromPersonId: 'g', toPersonId: 's', kind: 'guardian_of', verification: 'document_verified', validFrom: iso(-10) };

  it('relies on a guardian tie only when it is document-verified', () => {
    expect(relationshipIsLive(guardian, NOW)).toBe(true);
    expect(relationshipIsLive({ ...guardian, verification: 'student_confirmed' }, NOW)).toBe(false);
    expect(relationshipIsLive({ ...guardian, verification: 'unverified' }, NOW)).toBe(false);
  });

  it('refuses ended, future, self and cross-tenant ties', () => {
    expect(relationshipIsLive({ ...guardian, endedAt: iso(-1) }, NOW)).toBe(false);
    expect(relationshipIsLive({ ...guardian, validFrom: iso(1) }, NOW)).toBe(false);
    expect(relationshipIsLive({ ...guardian, fromPersonId: 's' }, NOW)).toBe(false);
    expect(findLiveRelationship([guardian], 'other-tenant', 'g', 's', 'guardian_of', NOW)).toBeUndefined();
    expect(findLiveRelationship([guardian], 't', 'g', 's', 'guardian_of', NOW)?.id).toBe('r');
    expect(findLiveRelationship([guardian], 't', 'g', 's', 'advisor_of', NOW)).toBeUndefined();
  });
});

describe('consent', () => {
  const c: ConsentRecord = {
    id: 'c', tenantId: 't', subjectPersonId: 's', grantedByPersonId: 's', granteePersonId: 'g', purpose: 'agenda_sharing',
    scopes: ['agenda.read'], resourceIds: ['agenda-1'], evidence: 'in_app_confirmation', policyVersion: 'v1', grantedAt: iso(-1), expiresAt: iso(30),
  };
  const q = { tenantId: 't', subjectPersonId: 's', granteePersonId: 'g', purpose: 'agenda_sharing' as const, scope: 'agenda.read', resourceId: 'agenda-1' };

  it('covers exactly the request it names', () => {
    expect(findCoveringConsent([c], q, NOW)).toBeDefined();
    expect(findCoveringConsent([c], { ...q, resourceId: 'agenda-2' }, NOW)).toBeUndefined();
    expect(findCoveringConsent([c], { ...q, scope: 'agenda.write' }, NOW)).toBeUndefined();
    expect(findCoveringConsent([c], { ...q, purpose: 'ai_context' }, NOW)).toBeUndefined();
    expect(findCoveringConsent([c], { ...q, tenantId: 'other' }, NOW)).toBeUndefined();
    expect(findCoveringConsent([c], { ...q, granteePersonId: 'someone-else' }, NOW)).toBeUndefined();
  });

  it('a category with no named resources grants nothing', () => {
    expect(consentIsLive({ ...c, resourceIds: [] }, NOW)).toBe(false);
    expect(consentIsLive({ ...c, scopes: [] }, NOW)).toBe(false);
  });

  it('lapses at expiry and on withdrawal, with no grace', () => {
    expect(consentIsLive(c, Date.parse(c.expiresAt) - 1)).toBe(true);
    expect(consentIsLive(c, Date.parse(c.expiresAt))).toBe(false);
    expect(consentIsLive(withdraw(c, iso(0)), NOW)).toBe(false);
    expect(consentIsLive({ ...c, granteePersonId: 's' }, NOW)).toBe(false);
  });

  it('withdrawal is idempotent and keeps the first timestamp', () => {
    const once = withdraw(c, iso(0));
    expect(withdraw(once, iso(5)).withdrawnAt).toBe(iso(0));
  });

  it('maps to the policy decision point\'s grant for the two kinds it knows, and refuses the rest', () => {
    expect(toPolicyGrant(c)).toMatchObject({ kind: 'share', grantedTo: 'g', revokedAt: null });
    expect(toPolicyGrant({ ...c, purpose: 'support_access' })).toMatchObject({ kind: 'support_access' });
    expect(toPolicyGrant({ ...c, purpose: 'marketing' })).toBeNull();
    expect(toPolicyGrant(withdraw(c, iso(0)))?.revokedAt).toBe(iso(0));
  });
});

describe('capabilities', () => {
  const registry = new CapabilityRegistry();
  registry.register('grades.release');
  registry.register('grades.read');
  registry.defineRole({ role: 'instructor', capabilities: ['grades.release', 'grades.read'] });
  registry.defineRole({ role: 'student', capabilities: ['grades.read'] });
  const dir = new OrgDirectory('t');
  dir.add({ id: 'dept', tenantId: 't', kind: 'department', parentId: null, name: 'Econ' });
  dir.add({ id: 'sec1', tenantId: 't', kind: 'section', parentId: 'dept', name: '101' });
  dir.add({ id: 'dept2', tenantId: 't', kind: 'department', parentId: null, name: 'History' });
  dir.add({ id: 'sec2', tenantId: 't', kind: 'section', parentId: 'dept2', name: '201' });

  it('a grant at a node covers beneath it and nothing beside it', () => {
    const grants = [{ role: 'instructor', scopeKind: 'node', scopeId: 'dept' }];
    expect(resolveCapabilities(registry, dir, grants, 'sec1', NOW).has('grades.release')).toBe(true);
    expect(resolveCapabilities(registry, dir, grants, 'sec2', NOW).has('grades.release')).toBe(false);
    expect(resolveCapabilities(registry, dir, grants, null, NOW).size).toBe(0);
  });

  it('a tenant-wide grant covers every node, but only for its own tenant', () => {
    expect(resolveCapabilities(registry, dir, [{ role: 'student', scopeKind: 'tenant', scopeId: 't' }], 'sec2', NOW).has('grades.read')).toBe(true);
    expect(resolveCapabilities(registry, dir, [{ role: 'student', scopeKind: 'tenant', scopeId: 'other' }], 'sec2', NOW).size).toBe(0);
  });

  it('expired grants and unknown roles contribute nothing', () => {
    expect(resolveCapabilities(registry, dir, [{ role: 'instructor', scopeKind: 'tenant', scopeId: 't', expiresAt: iso(-1) }], null, NOW).size).toBe(0);
    expect(resolveCapabilities(registry, dir, [{ role: 'wizard', scopeKind: 'tenant', scopeId: 't' }], null, NOW).size).toBe(0);
  });

  it('refuses an unregistered capability in a role and a malformed capability name', () => {
    expect(() => registry.defineRole({ role: 'x', capabilities: ['grades.delete'] })).toThrow(/unregistered/);
    expect(() => registry.register('Grades-Release')).toThrow(/domain\.verb/);
  });
});

describe('approvals', () => {
  const opened = (): ApprovalRequest => {
    const v = openApproval({ id: 'ap', tenantId: 't', action: 'grade.amend', subject: { type: 'grade', id: 'g1' }, changeHash: 'h1', requestedBy: 'req', requestedAt: iso(0), expiresAt: iso(2), requiredApprovals: 2 });
    if (!v.ok) throw new Error(v.reason);
    return v.request;
  };
  const approve = (r: ApprovalRequest, who: string, nowMs = NOW) => decide(r, { approverId: who, decision: 'approve' }, { nowMs, canDecide: true });

  it('the requester cannot approve their own request', () => {
    expect(approve(opened(), 'req')).toMatchObject({ ok: false, reason: expect.stringContaining('requester') });
  });

  it('needs the required number of distinct approvers', () => {
    const one = approve(opened(), 'a');
    expect(one.ok && one.request.state).toBe('pending');
    if (!one.ok) throw new Error();
    expect(approve(one.request, 'a')).toMatchObject({ ok: false, reason: expect.stringContaining('already') });
    const two = approve(one.request, 'b');
    expect(two.ok && two.request.state).toBe('approved');
  });

  it('refuses an approver without the capability', () => {
    expect(decide(opened(), { approverId: 'a', decision: 'approve' }, { nowMs: NOW, canDecide: false })).toMatchObject({ ok: false });
  });

  it('a rejection is final, needs a reason, and ends the request', () => {
    expect(decide(opened(), { approverId: 'a', decision: 'reject' }, { nowMs: NOW, canDecide: true })).toMatchObject({ ok: false });
    const rej = decide(opened(), { approverId: 'a', decision: 'reject', reason: 'Wrong section' }, { nowMs: NOW, canDecide: true });
    expect(rej.ok && rej.request.state).toBe('rejected');
    if (!rej.ok) throw new Error();
    expect(approve(rej.request, 'b')).toMatchObject({ ok: false });
  });

  it('a lapsed request cannot be approved late', () => {
    const late = Date.parse(iso(3));
    expect(expireIfDue(opened(), late).state).toBe('expired');
    expect(approve(opened(), 'a', late)).toMatchObject({ ok: false, reason: 'request is expired' });
  });

  it('approval authorises exactly one change, once', () => {
    let r = opened();
    for (const who of ['a', 'b']) {
      const v = approve(r, who);
      if (!v.ok) throw new Error(v.reason);
      r = v.request;
    }
    expect(isApprovedFor(r, 't', 'grade.amend', 'h1', NOW)).toBe(true);
    expect(isApprovedFor(r, 't', 'grade.amend', 'a-different-change', NOW)).toBe(false);
    expect(isApprovedFor(r, 'other', 'grade.amend', 'h1', NOW)).toBe(false);
    expect(isApprovedFor(r, 't', 'grade.delete', 'h1', NOW)).toBe(false);
    const used = consume(r, NOW);
    if (!used.ok) throw new Error(used.reason);
    expect(isApprovedFor(used.request, 't', 'grade.amend', 'h1', NOW)).toBe(false);
    expect(consume(used.request, NOW).ok).toBe(false);
  });

  it('rejects nonsense requests', () => {
    const base = { id: 'x', tenantId: 't', action: 'a', subject: { type: 'x', id: 'y' }, changeHash: 'h', requestedBy: 'r', requestedAt: iso(0) };
    expect(openApproval({ ...base, expiresAt: iso(1), requiredApprovals: 0 }).ok).toBe(false);
    expect(openApproval({ ...base, expiresAt: iso(-1), requiredApprovals: 1 }).ok).toBe(false);
  });

  it('is a legal machine: nothing leaves a terminal state', () => {
    for (const from of APPROVAL.terminal) for (const to of Object.keys(APPROVAL.transitions)) {
      expect(transition(APPROVAL, from, to as never).ok).toBe(false);
    }
  });
});

describe('audit chain', () => {
  const clock = fixedClock('2026-10-04T12:00:00Z');
  const ids = sequentialIds();
  const ctx = (tenant: string) =>
    buildRequestContext({ headers: {} }, {
      actor: { personId: 'p1', type: 'user', authenticatedAt: clock.now().toISOString() },
      tenant: { id: tenant, status: 'active', environment: 'production', verifiedBy: 'membership' },
      membershipIds: ['m'],
      roleGrants: [],
    }, { clock, ids });

  const filled = async () => {
    const log = new MemoryAuditLog({ clock, ids });
    for (let i = 0; i < 4; i++) await log.append(ctx('t'), { action: 'grade.post', resource: { type: 'grade', id: `g${i}` }, decision: 'allowed' });
    return log;
  };

  it('verifies an untouched chain and starts from the genesis hash', async () => {
    const rows = await (await filled()).read('t');
    expect(rows[0].prevHash).toBe(GENESIS_HASH);
    expect(await verifyAuditChain(rows)).toEqual({ ok: true, length: 4 });
  });

  it('detects an edited row, a deleted row, a reordered pair and a foreign row', async () => {
    const rows = await (await filled()).read('t');
    const edited = rows.map((r, i) => (i === 1 ? { ...r, decision: 'denied' as const } : r));
    expect(await verifyAuditChain(edited)).toMatchObject({ ok: false, brokenAt: 1 });
    expect(await verifyAuditChain([rows[0], rows[2], rows[3]])).toMatchObject({ ok: false, brokenAt: 1 });
    expect(await verifyAuditChain([rows[0], rows[2], rows[1], rows[3]])).toMatchObject({ ok: false });
    const other = new MemoryAuditLog({ clock, ids });
    await other.append(ctx('u'), { action: 'x.y', resource: { type: 'x' }, decision: 'allowed' });
    const [foreign] = await other.read('u');
    expect(await verifyAuditChain([rows[0], { ...foreign, seq: 2, prevHash: rows[0].hash }])).toMatchObject({ ok: false });
  });

  it('keeps one chain per tenant', async () => {
    const log = new MemoryAuditLog({ clock, ids });
    await log.append(ctx('t'), { action: 'a.b', resource: { type: 'x' }, decision: 'allowed' });
    await log.append(ctx('u'), { action: 'a.b', resource: { type: 'x' }, decision: 'allowed' });
    expect((await log.read('u'))[0].seq).toBe(1);
    expect((await log.read('u'))[0].prevHash).toBe(GENESIS_HASH);
  });

  it('redacts detail on the way in', async () => {
    const log = new MemoryAuditLog({ clock, ids });
    const row = await log.append(ctx('t'), { action: 'a.b', resource: { type: 'x' }, decision: 'allowed', detail: { essay: 'long private text', password: 'hunter2', gradeId: 'g1' } });
    expect(JSON.stringify(row.detail)).not.toContain('hunter2');
    expect(JSON.stringify(row.detail)).not.toContain('long private text');
    expect(row.detail).toMatchObject({ gradeId: 'g1' });
  });

  it('every row carries the correlation and request ids of its context', async () => {
    const c = ctx('t');
    const log = new MemoryAuditLog({ clock, ids });
    const row = await log.append(c, { action: 'a.b', resource: { type: 'x' }, decision: 'allowed' });
    expect(row.correlationId).toBe(c.correlationId);
    expect(row.requestId).toBe(c.requestId);
  });
});
