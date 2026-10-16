import { describe, expect, it } from 'vitest';
import { PlatformError, type ContextDirectory } from '../../../packages/platform/src/index.ts';
import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import type { VerifiedMembershipIdentity } from './membership.ts';
import {
  createContextDirectoryLoader,
  contextDirectoryForVerifiedIdentity,
  contextDirectoryForVerifiedMemberships,
  contextFor,
  contextForSelection,
  contextForVerifiedSelection,
  trustedIdentityFor,
} from './context.ts';

const IDS = { requestId: 'req-from-the-gateway', correlationId: 'corr-12345678' };
const who: UniversityIdentity = { userId: '8d4a2c1e-7b0f-4c3a-9a55-1f2e3d4c5b6a', institutionId: 'northstar', roles: ['student', 'family'] };
const req = (headers: Record<string, string> = {}) => new Request('https://x.test/v1/records/courses', { headers });
const directory = (over: Partial<ContextDirectory> = {}): ContextDirectory => ({
  personId: who.userId,
  sessionExpiresAt: '2099-01-01T02:00:00Z',
  memberships: [{
    id: 'membership-northstar-student',
    tenantId: who.institutionId,
    institutionId: who.institutionId,
    personId: who.userId,
    status: 'active',
    expiresAt: '2099-01-01T01:00:00Z',
    workspaces: ['student'],
    roleGrantIds: ['grant-student', 'grant-family'],
  }],
  ...over,
});
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof PlatformError ? e.code : 'other';
  }
  return 'none';
};

describe('the gateway identity as a request context', () => {
  it('carries the verified tenant, person and roles, and the ids the response will carry', () => {
    const ctx = contextFor(req(), who, IDS);
    expect(ctx).toMatchObject({ tenantId: 'northstar', verifiedBy: 'membership', environment: 'production', requestId: 'req-from-the-gateway', correlationId: 'corr-12345678' });
    expect(ctx.actor).toMatchObject({ personId: who.userId, type: 'user' });
    expect(ctx.roleGrants.map((g) => [g.role, g.scopeKind, g.scopeId])).toEqual([['student', 'tenant', 'northstar'], ['family', 'tenant', 'northstar']]);
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('claims no MFA level, because authenticate reports none', () => {
    expect(contextFor(req(), who, IDS).actor.mfaLevel).toBeUndefined();
  });

  it('refuses a client that names a different tenant than its session, and accepts one that agrees (control)', () => {
    expect(code(() => contextFor(req({ 'x-tenant-id': 'vanderbilt' }), who, IDS))).toBe('tenant_mismatch');
    expect(contextFor(req({ 'x-tenant-id': 'northstar' }), who, IDS).tenantId).toBe('northstar');
  });

  it('never takes the request id from the client', () => {
    expect(contextFor(req({ 'x-request-id': 'attacker' }), who, IDS).requestId).toBe('req-from-the-gateway');
  });

  it('validates and carries the SDK idempotency key without requiring one on reads', () => {
    expect(contextFor(req(), who, IDS).idempotencyKey).toBeUndefined();
    expect(contextFor(req({ 'idempotency-key': 'commit-key-00000001' }), who, IDS).idempotencyKey).toBe('commit-key-00000001');
    expect(code(() => contextFor(req({ 'idempotency-key': 'too-short' }), who, IDS))).toBe('invalid_request');
  });

  it('refuses, rather than passes through, an identity whose ids are outside the platform alphabet', () => {
    expect(code(() => contextFor(req(), { ...who, institutionId: 'has space' }, IDS))).toBe('tenant_unresolved');
    expect(code(() => contextFor(req(), { ...who, userId: 'a/b' }, IDS))).toBe('unauthenticated');
    expect(code(() => contextFor(req(), { ...who, institutionId: '' }, IDS))).toBe('tenant_unresolved');
  });

  it('the environment is the gateway\'s to say and defaults to production', () => {
    expect(contextFor(req(), who, IDS, 'staging').environment).toBe('staging');
    expect(trustedIdentityFor(who, { environment: 'demo', authenticatedAt: '2026-10-04T12:00:00Z' }).tenant.environment).toBe('demo');
  });

  it('carries a server-selected retrieval purpose instead of reading one from a client header', () => {
    expect(contextFor(req({ 'x-purpose': 'search' }), who, IDS, 'production', 'ai_context').purpose).toBe('ai_context');
    expect(contextFor(req({ 'x-purpose': 'ai_context' }), who, IDS).purpose).toBe('service_delivery');
  });

  it('every tenant and user id the repository\'s own fixtures use fits the alphabet', () => {
    for (const id of ['northstar', 'vanderbilt', 'school-a', 'school-b', 'vu', 'cedar', 'eastfield', 's', 'another-school', '8d4a2c1e-7b0f-4c3a-9a55-1f2e3d4c5b6a']) {
      expect(code(() => contextFor(req(), { ...who, institutionId: id }, IDS)), id).toBe('none');
    }
  });
});

describe('the gateway selected active context', () => {
  it('assembles every active server membership while keeping the authenticated membership first', () => {
    const identity: VerifiedMembershipIdentity = {
      ...who,
      roles: ['student'],
      membershipId: 'membership-northstar-student',
      sessionExpiresAt: '2099-01-01T02:00:00.000Z',
    };

    expect(contextDirectoryForVerifiedMemberships(identity, [
      {
        id: 'membership-vanderbilt-advisor',
        userId: who.userId,
        tenantId: 'vanderbilt',
        providerId: 'provider-vanderbilt',
        status: 'active',
        roles: ['advisor', 'family'],
      },
      {
        id: identity.membershipId,
        userId: who.userId,
        tenantId: who.institutionId,
        providerId: 'provider-northstar',
        status: 'active',
        roles: ['student'],
      },
      {
        id: 'membership-ended',
        userId: who.userId,
        tenantId: 'former-school',
        providerId: 'provider-former',
        status: 'deprovisioned',
        roles: ['student'],
      },
    ])).toEqual({
      personId: who.userId,
      sessionExpiresAt: identity.sessionExpiresAt,
      memberships: [
        {
          id: identity.membershipId,
          tenantId: who.institutionId,
          institutionId: who.institutionId,
          personId: who.userId,
          status: 'active',
          workspaces: ['student'],
          roleGrantIds: [identity.membershipId],
        },
        {
          id: 'membership-vanderbilt-advisor',
          tenantId: 'vanderbilt',
          institutionId: 'vanderbilt',
          personId: who.userId,
          status: 'active',
          workspaces: ['staff', 'external'],
          roleGrantIds: ['membership-vanderbilt-advisor'],
        },
      ],
    });
  });

  it('fails closed when the reloaded directory no longer proves the authenticated membership', () => {
    const identity: VerifiedMembershipIdentity = {
      ...who,
      roles: ['student'],
      membershipId: 'membership-northstar-student',
      sessionExpiresAt: '2099-01-01T02:00:00.000Z',
    };
    const row = {
      id: identity.membershipId,
      userId: who.userId,
      tenantId: who.institutionId,
      providerId: 'provider-northstar',
      status: 'active' as const,
      roles: ['student'] as const,
    };

    expect(code(() => contextDirectoryForVerifiedMemberships(identity, []))).toBe('forbidden');
    expect(code(() => contextDirectoryForVerifiedMemberships(identity, [{ ...row, status: 'suspended' }]))).toBe('forbidden');
    expect(code(() => contextDirectoryForVerifiedMemberships(identity, [{ ...row, roles: ['advisor'] }]))).toBe('forbidden');
  });

  it('loads memberships only by the remotely verified account id', async () => {
    const identity: VerifiedMembershipIdentity = {
      ...who,
      roles: ['student'],
      membershipId: 'membership-northstar-student',
      sessionExpiresAt: '2099-01-01T02:00:00.000Z',
    };
    let requestedUser = '';
    const load = createContextDirectoryLoader({
      membershipsForUser: async (userId) => {
        requestedUser = userId;
        return [{
          id: identity.membershipId,
          userId,
          tenantId: who.institutionId,
          providerId: 'provider-northstar',
          status: 'active',
          roles: ['student'],
        }];
      },
    });

    await expect(load(identity)).resolves.toEqual(contextDirectoryForVerifiedIdentity(identity));
    expect(requestedUser).toBe(who.userId);
  });

  it('assembles a server-owned directory from the verified membership and role vocabulary', () => {
    const identity: VerifiedMembershipIdentity = {
      ...who,
      roles: ['student', 'advisor', 'admin'],
      membershipId: 'membership-northstar-student',
      sessionExpiresAt: '2099-01-01T02:00:00.000Z',
    };

    expect(contextDirectoryForVerifiedIdentity(identity)).toEqual({
      personId: who.userId,
      sessionExpiresAt: '2099-01-01T02:00:00.000Z',
      memberships: [{
        id: 'membership-northstar-student',
        tenantId: 'northstar',
        institutionId: 'northstar',
        personId: who.userId,
        status: 'active',
        workspaces: ['student', 'staff', 'institution'],
        roleGrantIds: ['membership-northstar-student'],
      }],
    });
  });

  it('keeps external identities external and never manufactures privileged workspaces', () => {
    const identity: VerifiedMembershipIdentity = {
      ...who,
      roles: ['applicant', 'payer', 'family', 'alumni'],
      membershipId: 'membership-northstar-external',
      sessionExpiresAt: '2099-01-01T02:00:00.000Z',
    };

    expect(contextDirectoryForVerifiedIdentity(identity).memberships[0].workspaces).toEqual(['external']);
    expect(contextDirectoryForVerifiedIdentity(identity).memberships[0].workspaces).not.toEqual(
      expect.arrayContaining(['company', 'operations', 'developer']),
    );
  });

  it('authorizes a selection from only the assembled verified directory', () => {
    const identity: VerifiedMembershipIdentity = {
      ...who,
      roles: ['student'],
      membershipId: 'membership-northstar-student',
      sessionExpiresAt: '2099-01-01T02:00:00.000Z',
    };
    const selected = contextForVerifiedSelection(
      req(),
      identity,
      { membershipId: identity.membershipId, workspace: 'student' },
      IDS,
    );

    expect(selected.activeContext).toMatchObject({
      membershipId: identity.membershipId,
      workspace: 'student',
      roleGrantIds: [identity.membershipId],
    });
    expect(code(() => contextForVerifiedSelection(
      req(),
      identity,
      { membershipId: identity.membershipId, workspace: 'operations' },
      IDS,
    ))).toBe('forbidden');
  });

  it('activates only a server-directory membership and carries its workspace and expiry', () => {
    const ctx = contextForSelection(req(), who, {
      directory: directory(),
      selection: { membershipId: 'membership-northstar-student', workspace: 'student' },
    }, IDS);

    expect(ctx.membershipIds).toEqual(['membership-northstar-student']);
    expect(ctx.roleGrants.map((grant) => grant.expiresAt)).toEqual([
      '2099-01-01T01:00:00.000Z',
      '2099-01-01T01:00:00.000Z',
    ]);
    expect(ctx.activeContext).toMatchObject({
      tenantId: 'northstar',
      institutionId: 'northstar',
      personId: who.userId,
      membershipId: 'membership-northstar-student',
      workspace: 'student',
      roleGrantIds: ['grant-student', 'grant-family'],
      expiresAt: '2099-01-01T01:00:00.000Z',
    });
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it('refuses a selected directory that does not belong to the authenticated identity', () => {
    expect(code(() => contextForSelection(req(), who, {
      directory: directory({ personId: 'different-person' }),
      selection: { membershipId: 'membership-northstar-student', workspace: 'student' },
    }, IDS))).toBe('unauthenticated');

    const otherTenant = directory({
      memberships: [{ ...directory().memberships[0], tenantId: 'another-school', institutionId: 'another-school' }],
    });
    expect(code(() => contextForSelection(req(), who, {
      directory: otherTenant,
      selection: { membershipId: 'membership-northstar-student', workspace: 'student' },
    }, IDS))).toBe('tenant_mismatch');
  });

  it('keeps client tenant hints subordinate to the selected verified context', () => {
    expect(code(() => contextForSelection(req({ 'x-tenant-id': 'vanderbilt' }), who, {
      directory: directory(),
      selection: { membershipId: 'membership-northstar-student', workspace: 'student' },
    }, IDS))).toBe('tenant_mismatch');
  });

  it('carries the same validated idempotency key into a selected context', () => {
    const ctx = contextForSelection(req({ 'idempotency-key': 'selected-key-000001' }), who, {
      directory: directory(),
      selection: { membershipId: 'membership-northstar-student', workspace: 'student' },
    }, IDS);
    expect(ctx.idempotencyKey).toBe('selected-key-000001');
  });
});
