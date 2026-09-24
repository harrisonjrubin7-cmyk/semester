import { describe, expect, it } from 'vitest';
import {
  createMembershipResolver,
  type AuthorizationAuditRecord,
  type MembershipDirectory,
  type MembershipRecord,
  type ProviderRecord,
} from './membership.ts';

function directory(providers: ProviderRecord[], memberships: MembershipRecord[]): MembershipDirectory {
  return {
    providersFor: async (identifier) => providers.filter((provider) => provider.providerIdentifier === identifier),
    membershipsFor: async (userId, tenantId, providerId) => memberships.filter((membership) =>
      membership.userId === userId && membership.tenantId === tenantId && membership.providerId === providerId,
    ),
  };
}

const provider: ProviderRecord = {
  id: 'provider-vu',
  tenantId: 'vanderbilt',
  providerIdentifier: 'sso:vanderbilt',
  status: 'authorized',
};

const membership: MembershipRecord = {
  userId: 'user-1',
  tenantId: 'vanderbilt',
  providerId: 'provider-vu',
  status: 'active',
  roles: ['student', 'advisor'],
};

describe('current institutional membership resolution', () => {
  it('binds one verified SSO provider to one active tenant membership', async () => {
    const resolve = createMembershipResolver(directory([provider], [membership]));
    await expect(resolve({ id: 'user-1', providerIdentifier: 'sso:vanderbilt' })).resolves.toEqual({
      userId: 'user-1',
      institutionId: 'vanderbilt',
      roles: ['student', 'advisor'],
    });
  });

  it('denies absent and ambiguous provider mappings', async () => {
    const missing = createMembershipResolver(directory([], [membership]));
    await expect(missing({ id: 'user-1', providerIdentifier: 'sso:vanderbilt' })).resolves.toBeNull();

    const ambiguous = createMembershipResolver(directory([
      provider,
      { ...provider, id: 'provider-other', tenantId: 'another-school' },
    ], [membership]));
    await expect(ambiguous({ id: 'user-1', providerIdentifier: 'sso:vanderbilt' })).resolves.toBeNull();
  });

  it('denies inactive, duplicate and roleless memberships', async () => {
    for (const rows of [
      [{ ...membership, status: 'deprovisioned' as const }],
      [membership, { ...membership, roles: ['faculty'] as const }],
      [{ ...membership, roles: ['invented-role'] }],
    ]) {
      const resolve = createMembershipResolver(directory([provider], rows));
      await expect(resolve({ id: 'user-1', providerIdentifier: 'sso:vanderbilt' })).resolves.toBeNull();
    }
  });

  it('reloads membership so deprovisioning is effective on the next check', async () => {
    const rows: MembershipRecord[] = [{ ...membership }];
    const resolve = createMembershipResolver(directory([provider], rows));
    await expect(resolve({ id: 'user-1', providerIdentifier: 'sso:vanderbilt' })).resolves.not.toBeNull();
    rows[0] = { ...rows[0], status: 'deprovisioned', roles: [] };
    await expect(resolve({ id: 'user-1', providerIdentifier: 'sso:vanderbilt' })).resolves.toBeNull();
  });

  it('audits accepted and denied decisions without a token or user content', async () => {
    const events: AuthorizationAuditRecord[] = [];
    const resolve = createMembershipResolver(directory([provider], [membership]), async (event) => {
      events.push(event);
    });
    await resolve({ id: 'user-1', providerIdentifier: 'sso:vanderbilt' });
    await resolve({ id: 'missing-user', providerIdentifier: 'sso:vanderbilt' });
    expect(events.map((event) => event.outcome)).toEqual(['accepted', 'denied']);
    expect(JSON.stringify(events)).not.toMatch(/Bearer|token|question|course/i);
  });
});
