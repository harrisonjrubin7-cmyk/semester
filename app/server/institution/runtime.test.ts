import { describe, expect, it, vi } from 'vitest';
import { createProductionInstitutionRuntime, environmentJournalKey, exactAppOrigin } from './runtime.ts';

describe('production institution runtime', () => {
  it('requires one exact secure browser origin', () => {
    expect(exactAppOrigin({ SEMESTER_APP_ORIGIN: 'https://semester.example' })).toBe('https://semester.example');
    expect(() => exactAppOrigin({ SEMESTER_APP_ORIGIN: 'https://semester.example/' })).toThrow(/exact HTTPS/);
    expect(() => exactAppOrigin({ SEMESTER_APP_ORIGIN: 'http://semester.example' })).toThrow(/exact HTTPS/);
    expect(exactAppOrigin({ SEMESTER_APP_ORIGIN: 'http://localhost:5173' })).toBe('http://localhost:5173');
  });

  it('requires a stable 256-bit server encryption key', () => {
    expect(environmentJournalKey({ SEMESTER_JOURNAL_KEY: 'ab'.repeat(32) })).toHaveLength(32);
    expect(() => environmentJournalKey({ SEMESTER_JOURNAL_KEY: 'short' })).toThrow(/32 random bytes/);
  });

  it('refuses to construct production with partial Supabase credentials', () => {
    expect(() => createProductionInstitutionRuntime({
      SEMESTER_APP_ORIGIN: 'https://semester.example',
      SEMESTER_JOURNAL_KEY: 'ab'.repeat(32),
      SEMESTER_AUTH_URL: 'https://project.supabase.co',
    })).toThrow(/Production requires/);
  });

  it('wires maintenance read-only mode into the production gateway and preserves reconciliation', async () => {
    const expires = Math.floor(Date.now() / 1_000) + 3_600;
    const token = [
      Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
      Buffer.from(JSON.stringify({ exp: expires })).toString('base64url'),
      'synthetic',
    ].join('.');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/auth/v1/user')) {
        return Response.json({
          id: 'user-a',
          email: 'student@example.edu',
          app_metadata: { provider: 'sso:campus' },
        });
      }
      if (url.includes('/institution_identity_provider')) {
        return Response.json([{
          id: 'provider-a',
          tenant_id: 'tenant-a',
          provider_identifier: 'sso:campus',
          status: 'authorized',
        }]);
      }
      if (url.includes('/institution_membership')) {
        return Response.json([{
          id: 'membership-a',
          auth_user_id: 'user-a',
          tenant_id: 'tenant-a',
          identity_provider_id: 'provider-a',
          status: 'active',
          roles: ['student'],
        }]);
      }
      if (url.includes('/rpc/gateway_take_rate_limit')) return Response.json(true);
      return Response.json([]);
    }));

    try {
      const env = {
        SEMESTER_APP_ORIGIN: 'https://semester.example',
        SEMESTER_JOURNAL_KEY: 'ab'.repeat(32),
        SEMESTER_AUTH_URL: 'https://project.supabase.co',
        SEMESTER_AUTH_PUBLIC_KEY: 'public-test-key',
        SEMESTER_AUTH_SERVICE_KEY: 'service-test-key',
        SEMESTER_READ_ONLY: ' On ',
      };
      const runtime = createProductionInstitutionRuntime(env);
      const headers = {
        authorization: `Bearer ${token}`,
        origin: 'https://semester.example',
        'content-type': 'application/json',
      };
      const refused = await runtime(new Request('https://semester.example/actions/prepare', {
        method: 'POST',
        headers,
        body: '{}',
      }));
      expect(refused.status).toBe(503);
      expect((await refused.json()).error).toMatchObject({ code: 'read_only', retryable: true });

      const reconcile = await runtime(new Request('https://semester.example/actions/reconcile', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reviewId: 'missing-review' }),
      }));
      expect((await reconcile.json()).error.code).not.toBe('read_only');

      env.SEMESTER_READ_ONLY = 'off';
      const resumed = await runtime(new Request('https://semester.example/actions/prepare', {
        method: 'POST',
        headers,
        body: '{}',
      }));
      expect(resumed.status).not.toBe(503);
      expect((await resumed.json()).error.code).not.toBe('read_only');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
