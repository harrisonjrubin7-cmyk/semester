import { describe, expect, it } from 'vitest';
import { identityFromSupabaseClient, verifiedAuthUser } from './auth.ts';
import type { MembershipResolver } from './membership.ts';

const NOW = Date.parse('2026-10-10T12:00:00Z');
const token = (payload: Record<string, unknown>) => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

describe('validated Supabase institutional identity', () => {
  it('extracts only the verified SSO provider and ignores stale role metadata', () => {
    expect(verifiedAuthUser({
      id: 'user-1',
      email: 'Student@Vanderbilt.edu',
      app_metadata: {
        provider: 'sso:vanderbilt',
        semester: { institutionId: 'wrong-school', roles: ['admin'] },
      },
    }, '2026-10-10T13:00:00.000Z')).toEqual({
      id: 'user-1',
      providerIdentifier: 'sso:vanderbilt',
      userName: 'student@vanderbilt.edu',
      sessionExpiresAt: '2026-10-10T13:00:00.000Z',
    });
  });

  it('requires an SSO provider identifier for institutional resolution', () => {
    expect(verifiedAuthUser({ id: 'user-1', email: 'student@vanderbilt.edu', app_metadata: { provider: 'email' } }, '2026-10-10T13:00:00.000Z')).toBeNull();
    expect(verifiedAuthUser({ id: 'user-1', email: 'student@vanderbilt.edu', app_metadata: {} }, '2026-10-10T13:00:00.000Z')).toBeNull();
    expect(verifiedAuthUser({ id: 'user-1', app_metadata: { provider: 'sso:vanderbilt' } }, '2026-10-10T13:00:00.000Z')).toBeNull();
  });

  it('validates the access token before loading current database roles', async () => {
    let received = '';
    const client = {
      auth: {
        getUser: async (token: string) => {
          received = token;
          return {
            data: { user: { id: 'user-1', email: 'student@vanderbilt.edu', app_metadata: { provider: 'sso:vanderbilt', semester: { roles: ['admin'] } } } },
            error: null,
          };
        },
      },
    };
    let sessionExpiresAt = '';
    const resolver: MembershipResolver = async (user) => {
      sessionExpiresAt = user.sessionExpiresAt;
      return {
        userId: 'user-1', institutionId: 'vanderbilt', roles: ['advisor'],
        membershipId: 'membership-user-1', sessionExpiresAt: user.sessionExpiresAt,
      };
    };
    const authenticate = identityFromSupabaseClient(client, resolver, () => NOW);
    await expect(authenticate(token({ exp: NOW / 1000 + 3600 }))).resolves.toEqual({
      userId: 'user-1', institutionId: 'vanderbilt', roles: ['advisor'],
      membershipId: 'membership-user-1', sessionExpiresAt: '2026-10-10T13:00:00.000Z',
    });
    expect(received).toBe(token({ exp: NOW / 1000 + 3600 }));
    expect(sessionExpiresAt).toBe('2026-10-10T13:00:00.000Z');
  });

  it('fails closed after validation when the verified token has no live finite expiry', async () => {
    let calls = 0;
    const client = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'user-1', email: 'student@vanderbilt.edu', app_metadata: { provider: 'sso:vanderbilt' } } },
          error: null,
        }),
      },
    };
    const resolver: MembershipResolver = async () => {
      calls++;
      return null;
    };
    const authenticate = identityFromSupabaseClient(client, resolver, () => NOW);

    for (const value of ['opaque', token({}), token({ exp: 'later' }), token({ exp: NOW / 1000 })]) {
      await expect(authenticate(value)).resolves.toBeNull();
    }
    expect(calls).toBe(0);
  });

  it('does not call membership resolution when token validation fails', async () => {
    let calls = 0;
    const client = { auth: { getUser: async () => ({ data: { user: null }, error: new Error('invalid') }) } };
    const resolver: MembershipResolver = async () => {
      calls++;
      return null;
    };
    await expect(identityFromSupabaseClient(client, resolver)('bad-token')).resolves.toBeNull();
    expect(calls).toBe(0);
  });
});
