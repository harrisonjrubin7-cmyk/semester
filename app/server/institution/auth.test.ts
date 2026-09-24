import { describe, expect, it } from 'vitest';
import { identityFromSupabaseClient, verifiedAuthUser } from './auth.ts';
import type { MembershipResolver } from './membership.ts';

describe('validated Supabase institutional identity', () => {
  it('extracts only the verified SSO provider and ignores stale role metadata', () => {
    expect(verifiedAuthUser({
      id: 'user-1',
      email: 'Student@Vanderbilt.edu',
      app_metadata: {
        provider: 'sso:vanderbilt',
        semester: { institutionId: 'wrong-school', roles: ['admin'] },
      },
    })).toEqual({
      id: 'user-1',
      providerIdentifier: 'sso:vanderbilt',
      userName: 'student@vanderbilt.edu',
    });
  });

  it('requires an SSO provider identifier for institutional resolution', () => {
    expect(verifiedAuthUser({ id: 'user-1', email: 'student@vanderbilt.edu', app_metadata: { provider: 'email' } })).toBeNull();
    expect(verifiedAuthUser({ id: 'user-1', email: 'student@vanderbilt.edu', app_metadata: {} })).toBeNull();
    expect(verifiedAuthUser({ id: 'user-1', app_metadata: { provider: 'sso:vanderbilt' } })).toBeNull();
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
    const resolver: MembershipResolver = async () => ({
      userId: 'user-1', institutionId: 'vanderbilt', roles: ['advisor'],
    });
    const authenticate = identityFromSupabaseClient(client, resolver);
    await expect(authenticate('verified-token')).resolves.toEqual({
      userId: 'user-1', institutionId: 'vanderbilt', roles: ['advisor'],
    });
    expect(received).toBe('verified-token');
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
