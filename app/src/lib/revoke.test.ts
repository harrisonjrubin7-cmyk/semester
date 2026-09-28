/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokens, type ProviderId, type Token } from './connect';
import {
  GOOGLE_REVOKE,
  MANAGE,
  disconnect,
  disconnectAll,
  lastRevocation,
  revocations,
  revokeAtProvider,
  saidAboutDisconnect,
} from './revoke';

/**
 * Disconnect withdraws the grant at the provider, where the provider allows
 * it, and deletes the local token whatever the provider says.
 *
 * The network is a stand-in (`send`), so what is pinned is this side of the
 * wire: what is sent to Google and in what order, that nothing is sent where
 * no browser-callable endpoint exists, that the token goes in every branch,
 * and that the sentence the student reads matches what actually happened.
 */

const REFRESH = 'rt-secret-refresh-value';
const ACCESS = 'at-secret-access-value';

function hold(provider: ProviderId, over: Partial<Token> = {}): void {
  const token: Token = { provider, access: ACCESS, refresh: REFRESH, expires: Date.now() + 3_600_000, account: '', ...over };
  localStorage.setItem('semester.tokens.v1', JSON.stringify({ ...tokens(), [provider]: token }));
}

const answer = (status: number) => new Response(status === 200 ? '' : '{"error":"invalid_token"}', { status });

/** The `token` each call posted, in order. */
function posted(send: ReturnType<typeof vi.fn>): string[] {
  return send.mock.calls.map((c) => new URLSearchParams(String((c[1] as RequestInit).body)).get('token') ?? '');
}

/** A localStorage that lives in a plain object, since tests run without a DOM. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Google: revoked at the provider', () => {
  it('posts the refresh token to Google’s revoke endpoint, form-encoded', async () => {
    hold('google');
    const send = vi.fn(async () => answer(200));
    const outcome = await disconnect('google', send);

    expect(outcome).toEqual({ provider: 'google', status: 'revoked' });
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GOOGLE_REVOKE);
    expect(url).toBe('https://oauth2.googleapis.com/revoke');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(posted(send)).toEqual([REFRESH]);
    expect(tokens().google).toBeUndefined();
    expect(lastRevocation('google')?.status).toBe('revoked');
  });

  it('by default goes over the real fetch, with a deadline', async () => {
    hold('google');
    const fetch = vi.fn(async () => answer(200));
    vi.stubGlobal('fetch', fetch);
    expect((await disconnect('google')).status).toBe('revoked');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GOOGLE_REVOKE);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(tokens().google).toBeUndefined();
  });

  it('falls back to the access token when the refresh token is refused', async () => {
    hold('google');
    const send = vi.fn().mockResolvedValueOnce(answer(400)).mockResolvedValueOnce(answer(200));
    expect((await disconnect('google', send)).status).toBe('revoked');
    expect(posted(send)).toEqual([REFRESH, ACCESS]);
  });

  it('with no refresh token, revokes the access token', async () => {
    hold('google', { refresh: '' });
    const send = vi.fn(async () => answer(200));
    expect((await disconnect('google', send)).status).toBe('revoked');
    expect(posted(send)).toEqual([ACCESS]);
  });

  it('a 200 is the only answer taken as revoked', async () => {
    for (const status of [400, 401, 429, 500, 503]) {
      const outcome = await revokeAtProvider({ provider: 'google', access: ACCESS, refresh: REFRESH }, vi.fn(async () => answer(status)));
      expect(outcome.status, String(status)).toBe('failed');
    }
  });
});

describe('a failed revoke never keeps the token', () => {
  it('Google refuses: token deleted, failure recorded, student told', async () => {
    hold('google');
    const send = vi.fn(async () => answer(400));
    const outcome = await disconnect('google', send);

    expect(outcome.status).toBe('failed');
    expect(tokens().google).toBeUndefined();
    expect(lastRevocation('google')).toMatchObject({ provider: 'google', status: 'failed' });
    const said = saidAboutDisconnect(outcome);
    expect(said).toMatch(/did not work/);
    expect(said).toMatch(/may still list Semester/);
    expect(said).not.toMatch(/confirmed/);
  });

  it('Google unreachable (the fetch throws): token deleted all the same', async () => {
    hold('google');
    const send = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const outcome = await disconnect('google', send);
    expect(outcome).toMatchObject({ status: 'failed', reason: 'Google could not be reached.' });
    expect(tokens().google).toBeUndefined();
  });

  it('the record never carries a token', async () => {
    hold('google');
    hold('microsoft');
    await disconnect('google', vi.fn(async () => answer(400)));
    await disconnect('microsoft', vi.fn());
    const stored = localStorage.getItem('semester.revocations.v1') ?? '';
    expect(stored).not.toContain(REFRESH);
    expect(stored).not.toContain(ACCESS);
    expect(revocations()).toHaveLength(2);
  });
});

describe('providers with no endpoint a browser can call', () => {
  it.each(['microsoft', 'zoom', 'apple'] as const)('%s: nothing is sent, the token is deleted, the student is told where to finish', async (id) => {
    hold(id);
    const send = vi.fn();
    const outcome = await disconnect(id, send);

    expect(send).not.toHaveBeenCalled();
    expect(outcome.status).toBe('manual');
    expect(tokens()[id]).toBeUndefined();
    expect(lastRevocation(id)?.status).toBe('manual');
    // Truthful: never claims the grant was withdrawn at the provider.
    const said = saidAboutDisconnect(outcome);
    expect(said).not.toMatch(/confirmed|withdrawn at/i);
    expect(said).toMatch(/may still list Semester/);
    expect(MANAGE[id].length).toBeGreaterThan(0);
    for (const link of MANAGE[id]) expect(link.url).toMatch(/^https:\/\//);
  });

  it('Microsoft points at both the work-or-school and the personal consent pages', () => {
    const urls = MANAGE.microsoft.map((l) => l.url);
    expect(urls).toContain('https://myapps.microsoft.com');
    expect(urls).toContain('https://account.live.com/consent/Manage');
  });

  it('only a confirmed revoke says confirmed', () => {
    expect(saidAboutDisconnect({ provider: 'google', status: 'revoked' })).toMatch(/confirmed/);
  });
});

describe('disconnectAll, for Erase from this device', () => {
  it('disconnects every connected account and leaves no token', async () => {
    hold('google');
    hold('microsoft');
    hold('zoom');
    const send = vi.fn(async () => answer(200));
    const outcomes = await disconnectAll(send);
    expect(outcomes.map((o) => `${o.provider}:${o.status}`).sort()).toEqual(['google:revoked', 'microsoft:manual', 'zoom:manual']);
    expect(send).toHaveBeenCalledTimes(1);
    expect(tokens()).toEqual({});
  });
});

describe('the two places that delete tokens go through it', () => {
  /*
   * The recurrence is a button that calls `forget()` again — the local
   * delete alone, which is what Disconnect was before this file existed.
   */
  const src = join(process.cwd(), 'src');
  const read = (p: string) => readFileSync(join(src, p), 'utf8');

  it('the Connect screen disconnects through lib/revoke, not forget()', () => {
    const screen = read('screens/Connect.tsx');
    expect(screen).toMatch(/from '\.\.\/lib\/revoke'/);
    expect(screen).toMatch(/disconnect\(id\)/);
    expect(screen).not.toMatch(/\bforget\(id\)/);
  });

  it('Erase from this device withdraws before it wipes', () => {
    const erase = read('lib/erase.ts');
    const withdraw = erase.indexOf('disconnectAll()');
    const wipe = erase.indexOf('empty(localStorage)');
    expect(withdraw).toBeGreaterThan(-1);
    expect(withdraw).toBeLessThan(wipe);
  });
});
