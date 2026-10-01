import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { joinGroup, react } from './classmates';

const { cloud } = vi.hoisted(() => ({ cloud: vi.fn() }));
vi.mock('./cloud', () => ({ cloud }));
vi.mock('./locale', () => ({ appLocale: () => 'en-US' }));
vi.mock('./date', () => ({ localClock: () => '', weekdayShort: () => '' }));

/** Real PostgREST request builder; only transport is intercepted. */
describe('insert-only room memberships and reactions', () => {
  const requests: { url: URL; options: RequestInit | undefined }[] = [];
  const fetcher = vi.fn<typeof fetch>();

  beforeEach(() => {
    requests.length = 0;
    fetcher.mockReset();
    fetcher.mockImplementation(async (input, options) => {
      requests.push({ url: new URL(String(input)), options });
      return new Response('[]', { status: 201, headers: { 'Content-Type': 'application/json' } });
    });
    cloud.mockResolvedValue(createClient('https://semester-check.invalid', 'test-publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetcher },
    }));
  });

  it('repeating a reaction never asks for an UPDATE policy', async () => {
    for (let i = 0; i < 2; i++) await react('u1', '2026FA', 'school/ECON 1020', 'm1', 'yes');
    expect(requests).toHaveLength(2);
    for (const { url, options } of requests) {
      expect(url.pathname).toBe('/rest/v1/message_reactions');
      expect(url.searchParams.get('on_conflict')).toBe('message_id,user_id,emoji');
      expect(options?.method).toBe('POST');
      expect(new Headers(options?.headers).get('Prefer')).toContain('resolution=ignore-duplicates');
      expect(JSON.parse(String(options?.body))).toEqual({
        message_id: 'm1', user_id: 'u1', emoji: 'yes', term: '2026FA', code: 'school/ECON 1020',
      });
    }
  });

  it('rejoining a group uses duplicate-ignore insertion', async () => {
    await joinGroup('u1', 'g1');
    await joinGroup('u1', 'g1');
    expect(requests).toHaveLength(2);
    for (const { url, options } of requests) {
      expect(url.pathname).toBe('/rest/v1/group_members');
      expect(url.searchParams.get('on_conflict')).toBe('group_id,user_id');
      expect(options?.method).toBe('POST');
      expect(new Headers(options?.headers).get('Prefer')).toContain('resolution=ignore-duplicates');
      expect(JSON.parse(String(options?.body))).toEqual({ group_id: 'g1', user_id: 'u1' });
    }
  });

  it('still reports an actual insert refusal', async () => {
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({
      code: '42501', message: 'permission denied for table group_members',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    await expect(joinGroup('u1', 'g1')).rejects.toThrow();
  });
});

