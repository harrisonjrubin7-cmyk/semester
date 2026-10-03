import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { joinGroup, react, saveProfile } from './classmates';

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

/**
 * Profile ownership is insert-only: the pin on school_id also removed the
 * table-wide UPDATE grant, and user_id is not on the column UPDATE list.
 * Restoring saveProfile's old merge-upsert must fail these tests: PostgREST
 * would put every submitted column, including user_id, in the UPDATE clause.
 * These inspect the real SDK requests; they do not replace its query builder.
 */
describe('saving a profile without updating its pinned owner', () => {
  const requests: { url: URL; options: RequestInit | undefined }[] = [];
  const fetcher = vi.fn<typeof fetch>();
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  const body = (index: number) => JSON.parse(String(requests[index].options?.body));
  const prefer = (index: number) => new Headers(requests[index].options?.headers).get('Prefer') ?? '';

  beforeEach(() => {
    requests.length = 0;
    fetcher.mockReset();
    cloud.mockResolvedValue(createClient('https://semester-check.invalid', 'test-publishable-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (input, options) => {
        requests.push({ url: new URL(String(input)), options });
        return fetcher(input, options);
      } },
    }));
  });

  it('creates a first profile without requesting UPDATE on user_id', async () => {
    fetcher.mockResolvedValueOnce(json([{ user_id: 'u1' }], 201));
    await saveProfile('u1', '  <New>   Name  ', 'a'.repeat(150));
    expect(requests).toHaveLength(1);
    expect(requests[0].url.pathname).toBe('/rest/v1/profiles');
    expect(requests[0].options?.method).toBe('POST');
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('user_id');
    expect(requests[0].url.searchParams.get('select')).toBe('user_id');
    expect(prefer(0)).toContain('resolution=ignore-duplicates');
    expect(prefer(0)).toContain('return=representation');
    expect(body(0)).toEqual({ user_id: 'u1', handle: 'New Name', about: 'a'.repeat(140) });
  });

  it('updates an existing profile using only editable fields and an owner filter', async () => {
    fetcher.mockResolvedValueOnce(json([]));
    fetcher.mockResolvedValueOnce(json([{ user_id: 'u1' }]));
    await saveProfile('u1', 'New Name', 'New about');
    expect(requests).toHaveLength(2);
    expect(prefer(0)).toContain('resolution=ignore-duplicates');
    expect(requests[1].url.pathname).toBe('/rest/v1/profiles');
    expect(requests[1].options?.method).toBe('PATCH');
    expect(requests[1].url.searchParams.get('user_id')).toBe('eq.u1');
    expect(requests[1].url.searchParams.get('select')).toBe('user_id');
    expect(prefer(1)).toContain('return=representation');
    expect(body(1)).toEqual({ handle: 'New Name', about: 'New about' });
  });

  it('keeps last-writer-wins when two devices create the same profile', async () => {
    // Transport models the two possible server responses to concurrent
    // INSERT ... ON CONFLICT DO NOTHING. The second save must still land.
    let stored: Record<string, unknown> | null = null;
    fetcher.mockImplementation(async (_input, options) => {
      const incoming = JSON.parse(String(options?.body));
      if (options?.method === 'POST') {
        const preference = new Headers(options.headers).get('Prefer') ?? '';
        if (preference.includes('resolution=merge-duplicates')) {
          return json({ code: '42501', message: 'permission denied for table profiles' }, 403);
        }
        if (stored) return json([]);
        stored = { ...incoming, school_id: 'verified-school', account_role: 'student' };
        return json([{ user_id: incoming.user_id }], 201);
      }
      stored = { ...stored, ...incoming };
      return json([{ user_id: 'u1' }]);
    });
    await Promise.all([
      saveProfile('u1', 'Phone Name', 'phone'),
      saveProfile('u1', 'Laptop Name', 'laptop'),
    ]);
    expect(stored).toEqual({
      user_id: 'u1', handle: 'Laptop Name', about: 'laptop',
      school_id: 'verified-school', account_role: 'student',
    });
    expect(requests.map((r) => r.options?.method)).toEqual(['POST', 'POST', 'PATCH']);
    expect(body(2)).toEqual({ handle: 'Laptop Name', about: 'laptop' });
  });

  it('reports a profile deleted or no longer writable between the two requests', async () => {
    fetcher.mockResolvedValueOnce(json([]));
    fetcher.mockResolvedValueOnce(json([]));
    await expect(saveProfile('u1', 'New Name', '')).rejects.toThrow('could not be saved');
    expect(requests).toHaveLength(2);
    // No retry INSERT that would silently resurrect a deleted profile.
    expect(requests.map((r) => r.options?.method)).toEqual(['POST', 'PATCH']);
  });

  it.each([
    ['insert', 403, '42501', 'permission denied for table profiles'],
    ['insert', 400, '23514', 'new row violates check constraint profiles_handle_check'],
    ['update', 403, '42501', 'permission denied for table profiles'],
    ['update', 400, '23514', 'new row violates check constraint profiles_handle_check'],
  ] as const)('reports a refused %s (%s), without retrying it', async (operation, status, code, message) => {
    if (operation === 'update') fetcher.mockResolvedValueOnce(json([]));
    fetcher.mockResolvedValueOnce(json({ code, message }, status));
    await expect(saveProfile('u1', 'New Name', '')).rejects.toThrow(
      code === '23514' ? 'A display name has to be between 2 and 40 characters.' : message,
    );
    expect(requests).toHaveLength(operation === 'update' ? 2 : 1);
  });

  it('does not turn a failed request into an attempt to update another copy', async () => {
    fetcher.mockRejectedValueOnce(new TypeError('connection failed'));
    await expect(saveProfile('u1', 'New Name', '')).rejects.toThrow('connection failed');
    expect(requests).toHaveLength(1);
  });

  it('CONTROL: rejects an invalid name before sending anything', async () => {
    await expect(saveProfile('u1', 'x', '')).rejects.toThrow('at least two characters');
    expect(requests).toHaveLength(0);
  });
});
