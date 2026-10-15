import { describe, expect, it } from 'vitest';
import {
  ProofUnavailable,
  proveDeletedAccountAbsent,
  tryDeletedAccountStateWrite,
} from './account-sync-proof.mjs';

describe('deleted account state proof', () => {
  it('attempts the protected PostgREST state write that account deletion must deny', async () => {
    const seen = [];
    const request = async (url, options) => {
      seen.push({
        method: options.method,
        url,
        authorization: options.headers.Authorization,
        apikey: options.headers.apikey,
        prefer: options.headers.Prefer,
        body: JSON.parse(options.body),
      });
      return new Response(JSON.stringify({ code: '23503' }), { status: 409 });
    };

    const result = await tryDeletedAccountStateWrite({
      origin: 'http://127.0.0.1:54321',
      publicKey: 'local-publishable',
      staleToken: 'deleted-account-jwt',
      userId: '00000000-0000-4000-8000-000000000001',
      request,
    });

    expect(result).toEqual({ denied: true, status: 409, reason: 'deleted-user' });
    expect(seen).toEqual([{
      method: 'POST',
      url: 'http://127.0.0.1:54321/rest/v1/state?on_conflict=user_id',
      authorization: 'Bearer deleted-account-jwt',
      apikey: 'local-publishable',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        user_id: '00000000-0000-4000-8000-000000000001',
        data: { deletion_probe: true },
      },
    }]);
  });

  it.each([400, 404, 500])('does not mistake an unrelated %s response for stale-token denial', async (status) => {
    await expect(tryDeletedAccountStateWrite({
      origin: 'http://127.0.0.1:54321',
      publicKey: 'local-publishable',
      staleToken: 'deleted-account-jwt',
      userId: '00000000-0000-4000-8000-000000000001',
      request: async () => new Response(JSON.stringify({ code: 'unrelated' }), { status }),
    })).rejects.toBeInstanceOf(ProofUnavailable);
  });

  it('recognizes an authorization denial without relying on a response body', async () => {
    await expect(tryDeletedAccountStateWrite({
      origin: 'http://127.0.0.1:54321',
      publicKey: 'local-publishable',
      staleToken: 'deleted-account-jwt',
      userId: '00000000-0000-4000-8000-000000000001',
      request: async () => new Response(null, { status: 403 }),
    })).resolves.toEqual({ denied: true, status: 403, reason: 'authorization' });
  });

  it('independently proves the auth user and application state are absent with the local service key', async () => {
    const seen = [];
    const request = async (url, options) => {
      seen.push({
        url,
        authorization: options.headers.Authorization,
        apikey: options.headers.apikey,
      });
      if (url.includes('/auth/v1/admin/users/')) {
        return new Response(JSON.stringify({ message: 'User not found' }), { status: 404 });
      }
      return new Response('[]', { status: 200 });
    };

    await expect(proveDeletedAccountAbsent({
      origin: 'http://127.0.0.1:54321',
      serviceKey: 'local-service-key',
      userId: '00000000-0000-4000-8000-000000000001',
      request,
    })).resolves.toEqual({ authUserAbsent: true, stateAbsent: true });
    expect(seen).toEqual([
      {
        url: 'http://127.0.0.1:54321/auth/v1/admin/users/00000000-0000-4000-8000-000000000001',
        authorization: undefined,
        apikey: 'local-service-key',
      },
      {
        url: 'http://127.0.0.1:54321/rest/v1/state?user_id=eq.00000000-0000-4000-8000-000000000001&select=user_id',
        authorization: undefined,
        apikey: 'local-service-key',
      },
    ]);
  });

  it('uses bearer authorization only for a legacy JWT service-role key', async () => {
    const authorizations = [];
    const request = async (url, options) => {
      authorizations.push(options.headers.Authorization);
      return url.includes('/auth/v1/admin/users/')
        ? new Response('{}', { status: 404 })
        : new Response('[]', { status: 200 });
    };
    await proveDeletedAccountAbsent({
      origin: 'http://127.0.0.1:54321',
      serviceKey: 'header.payload.signature',
      userId: '00000000-0000-4000-8000-000000000001',
      request,
    });
    expect(authorizations).toEqual([
      'Bearer header.payload.signature',
      'Bearer header.payload.signature',
    ]);
  });

  it('reports surviving state as a measured deletion failure', async () => {
    const request = async (url) => url.includes('/auth/v1/admin/users/')
      ? new Response('{}', { status: 404 })
      : new Response('[{"user_id":"00000000-0000-4000-8000-000000000001"}]', { status: 200 });
    await expect(proveDeletedAccountAbsent({
      origin: 'http://127.0.0.1:54321',
      serviceKey: 'local-service-key',
      userId: '00000000-0000-4000-8000-000000000001',
      request,
    })).resolves.toEqual({ authUserAbsent: true, stateAbsent: false });
  });

  it('reports an unauthorized admin check as unavailable, not deletion proof', async () => {
    await expect(proveDeletedAccountAbsent({
      origin: 'http://127.0.0.1:54321',
      serviceKey: 'local-service-key',
      userId: '00000000-0000-4000-8000-000000000001',
      request: async () => new Response('{}', { status: 401 }),
    })).rejects.toBeInstanceOf(ProofUnavailable);
  });

  it('refuses to send a service key anywhere except loopback', async () => {
    await expect(proveDeletedAccountAbsent({
      origin: 'https://project.supabase.co',
      serviceKey: 'must-not-leave-this-process',
      userId: '00000000-0000-4000-8000-000000000001',
    })).rejects.toThrow(/loopback/);
  });
});
