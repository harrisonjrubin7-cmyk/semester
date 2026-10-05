import { describe, expect, it } from 'vitest';
import {
  createMembershipResolver,
  publicSsoConfig,
  type AuthorizationAuditRecord,
  type MembershipDirectory,
  type MembershipRecord,
  type ProviderRecord,
} from './membership.ts';

describe('public institutional SSO configuration', () => {
  it('enables discovery only for exactly one authorized provider covering the domain', () => {
    expect(publicSsoConfig([
      { ...provider, domains: ['vanderbilt.edu'] },
    ], 'vanderbilt.edu', 'Vanderbilt')).toEqual({
      enabled: true,
      label: 'Vanderbilt',
      domain: 'vanderbilt.edu',
    });
  });

  it('does not advertise a missing, pending, disabled, mismatched, or ambiguous provider', () => {
    expect(publicSsoConfig([], 'vanderbilt.edu', 'Vanderbilt')).toBeNull();
    expect(publicSsoConfig([{ ...provider, status: 'pending', domains: ['vanderbilt.edu'] }], 'vanderbilt.edu', 'Vanderbilt')).toBeNull();
    expect(publicSsoConfig([{ ...provider, domains: ['other.edu'] }], 'vanderbilt.edu', 'Vanderbilt')).toBeNull();
    expect(publicSsoConfig([
      { ...provider, domains: ['vanderbilt.edu'] },
      { ...provider, id: 'other', domains: ['vanderbilt.edu'] },
    ], 'vanderbilt.edu', 'Vanderbilt')).toBeNull();
  });
});

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

const verified = (id = 'user-1') => ({
  id,
  providerIdentifier: 'sso:vanderbilt',
  userName: id === 'user-1' ? 'student@vanderbilt.edu' : 'missing@vanderbilt.edu',
});

describe('current institutional membership resolution', () => {
  it('binds one verified SSO provider to one active tenant membership', async () => {
    const resolve = createMembershipResolver(directory([provider], [membership]));
    await expect(resolve(verified())).resolves.toEqual({
      userId: 'user-1',
      institutionId: 'vanderbilt',
      roles: ['student', 'advisor'],
    });
  });

  it('passes the verified SSO user name so a pre-login SCIM membership can be claimed', async () => {
    let seenUserName = '';
    const resolve = createMembershipResolver({
      providersFor: async () => [provider],
      membershipsFor: async (_userId, _tenantId, _providerId, userName) => {
        seenUserName = userName;
        return [membership];
      },
    });
    await expect(resolve({
      id: 'user-1',
      providerIdentifier: 'sso:vanderbilt',
      userName: 'student@vanderbilt.edu',
    })).resolves.not.toBeNull();
    expect(seenUserName).toBe('student@vanderbilt.edu');
  });

  it('denies absent and ambiguous provider mappings', async () => {
    const missing = createMembershipResolver(directory([], [membership]));
    await expect(missing(verified())).resolves.toBeNull();

    const ambiguous = createMembershipResolver(directory([
      provider,
      { ...provider, id: 'provider-other', tenantId: 'another-school' },
    ], [membership]));
    await expect(ambiguous(verified())).resolves.toBeNull();
  });

  it('denies inactive, duplicate and roleless memberships', async () => {
    for (const rows of [
      [{ ...membership, status: 'deprovisioned' as const }],
      [membership, { ...membership, roles: ['faculty'] as const }],
      [{ ...membership, roles: ['invented-role'] }],
    ]) {
      const resolve = createMembershipResolver(directory([provider], rows));
      await expect(resolve(verified())).resolves.toBeNull();
    }
  });

  it('reloads membership so deprovisioning is effective on the next check', async () => {
    const rows: MembershipRecord[] = [{ ...membership }];
    const resolve = createMembershipResolver(directory([provider], rows));
    await expect(resolve(verified())).resolves.not.toBeNull();
    rows[0] = { ...rows[0], status: 'deprovisioned', roles: [] };
    await expect(resolve(verified())).resolves.toBeNull();
  });

  it('audits accepted and denied decisions without a token or user content', async () => {
    const events: AuthorizationAuditRecord[] = [];
    const resolve = createMembershipResolver(directory([provider], [membership]), async (event) => {
      events.push(event);
    });
    await resolve(verified());
    await resolve(verified('missing-user'));
    expect(events.map((event) => event.outcome)).toEqual(['accepted', 'denied']);
    expect(JSON.stringify(events)).not.toMatch(/Bearer|token|question|course/i);
  });
});
