import { describe, expect, it } from 'vitest';
import { sha256Base64Url } from './crypto';
import {
  OAuthError, ReauthorizationRequired, TokenManager, TransientTokenError, authorizationUrl, createPkce,
  idTokenProblems, signState, verifyState,
  type OAuthErrorCode, type StatePayload, type TokenRecord, type TokenResponse, type TokenStore,
} from './oauth';

const t0 = new Date('2026-10-01T12:00:00Z');
const ACCESS = 'access-token-AAAAAAAAAAAA';
const REFRESH = 'refresh-token-RRRRRRRRRRRR';

describe('PKCE and the authorization request', () => {
  it('matches the RFC 7636 appendix B vector', async () => {
    expect(await sha256Base64Url('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('makes a verifier of at least 43 URL-safe characters and the S256 challenge of it', async () => {
    const pkce = await createPkce();
    expect(pkce.verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(pkce.challenge).toBe(await sha256Base64Url(pkce.verifier));
    expect(pkce.method).toBe('S256');
    expect((await createPkce()).verifier).not.toBe(pkce.verifier);
  });

  const request = {
    endpoint: 'https://login.example.edu/authorize', clientId: 'semester', redirectUri: 'https://app.example.com/cb',
    scopes: ['openid', 'courses.read'], state: 's.t', challenge: 'c', nonce: 'n',
  };

  it('builds an authorization URL with PKCE and the exact redirect', () => {
    const url = new URL(authorizationUrl(request));
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid courses.read');
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/cb');
    expect(url.searchParams.get('nonce')).toBe('n');
  });

  it('refuses anything but https, no scopes, and a scope with a space in it', () => {
    expect(() => authorizationUrl({ ...request, endpoint: 'http://login.example.edu/authorize' })).toThrow(/https/);
    expect(() => authorizationUrl({ ...request, redirectUri: 'http://app.example.com/cb' })).toThrow(/https/);
    expect(() => authorizationUrl({ ...request, scopes: [] })).toThrow(/scope/);
    expect(() => authorizationUrl({ ...request, scopes: ['a b'] })).toThrow(/whitespace/);
  });
});

describe('the signed state parameter', () => {
  const secret = 'state-signing-secret';
  const payload: StatePayload = { tenantId: 'school-a', connectionId: 'conn-1', nonce: 'abc', expiresAt: t0.getTime() + 600_000 };
  const mine = { tenantId: 'school-a', connectionId: 'conn-1' };

  it('round-trips for the connection it was made for', async () => {
    expect(await verifyState(secret, await signState(secret, payload), mine, t0)).toEqual({ ok: true, payload });
  });

  it('refuses a callback for a different connection or tenant', async () => {
    const state = await signState(secret, payload);
    expect(await verifyState(secret, state, { ...mine, connectionId: 'conn-2' }, t0)).toEqual({ ok: false, reason: 'wrong_connection' });
    expect(await verifyState(secret, state, { ...mine, tenantId: 'school-b' }, t0)).toEqual({ ok: false, reason: 'wrong_connection' });
  });

  it('refuses a tampered body, another secret, and an expired state', async () => {
    const state = await signState(secret, payload);
    const forged = await signState(secret, { ...payload, tenantId: 'school-b' });
    // A body swapped under a signature that belonged to another body.
    expect(await verifyState(secret, `${forged.split('.')[0]}.${state.split('.')[1]}`, mine, t0)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifyState('other-secret', state, mine, t0)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verifyState(secret, state, mine, new Date(payload.expiresAt))).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses a state that is not shaped like one', async () => {
    for (const bad of ['', 'abc', 'a.b.c', '.']) expect(await verifyState(secret, bad, mine, t0), bad).toMatchObject({ ok: false, reason: 'malformed' });
  });
});

/** A store that behaves like the real one: compare-and-swap on the refresh token. */
function memoryTokens(initial: TokenRecord | null) {
  let record = initial;
  const flagged: string[] = [];
  const store: TokenStore & { raceOnce?: TokenRecord } = {
    async load() { return record ? { ...record } : null; },
    async save(_id, next, expectedRefreshToken) {
      if (store.raceOnce) {
        record = store.raceOnce;
        store.raceOnce = undefined;
      }
      if ((record?.refreshToken ?? null) !== expectedRefreshToken) return false;
      record = next;
      return true;
    },
    async markNeedsReauth(_id, reason) {
      flagged.push(reason);
      if (record) record = { ...record, needsReauth: true };
    },
  };
  return { store, flagged, get record() { return record; } };
}

const expiring = (secondsLeft: number): TokenRecord => ({
  accessToken: ACCESS, refreshToken: REFRESH, expiresAt: new Date(t0.getTime() + secondsLeft * 1000), needsReauth: false,
});

function manager(initial: TokenRecord | null, refresh: (token: string) => Promise<TokenResponse>) {
  const tokens = memoryTokens(initial);
  let calls = 0;
  const m = new TokenManager({
    store: tokens.store, now: () => t0,
    refresh: async (token) => { calls++; return refresh(token); },
  });
  return { m, tokens, calls: () => calls };
}

const fresh: TokenResponse = { accessToken: 'new-access', refreshToken: 'new-refresh', expiresInSeconds: 3600 };

describe('the token lifecycle', () => {
  it('returns a token that is not near expiry without calling the provider', async () => {
    const { m, calls } = manager(expiring(3600), async () => fresh);
    expect(await m.accessToken('c')).toBe(ACCESS);
    expect(calls()).toBe(0);
  });

  it('refreshes inside the skew window and keeps the rotated refresh token', async () => {
    const { m, tokens } = manager(expiring(30), async (token) => { expect(token).toBe(REFRESH); return fresh; });
    expect(await m.accessToken('c')).toBe('new-access');
    expect(tokens.record).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('keeps the old refresh token when the provider does not rotate it', async () => {
    const { m, tokens } = manager(expiring(30), async () => ({ accessToken: 'new-access', expiresInSeconds: 3600 }));
    await m.accessToken('c');
    expect(tokens.record?.refreshToken).toBe(REFRESH);
  });

  it('refreshes once however many callers arrive at the same time', async () => {
    const { m, calls } = manager(expiring(30), async () => { await new Promise((r) => setTimeout(r, 5)); return fresh; });
    const tokens = await Promise.all(Array.from({ length: 12 }, () => m.accessToken('c')));
    expect(new Set(tokens)).toEqual(new Set(['new-access']));
    expect(calls()).toBe(1);
  });

  it('stops for good on a dead grant, and never asks the provider again', async () => {
    for (const code of ['invalid_grant', 'invalid_client', 'unauthorized_client', 'invalid_scope'] as OAuthErrorCode[]) {
      const { m, tokens, calls } = manager(expiring(30), async () => { throw new OAuthError(code); });
      await expect(m.accessToken('c')).rejects.toBeInstanceOf(ReauthorizationRequired);
      expect(tokens.flagged, code).toEqual([code]);
      await expect(m.accessToken('c')).rejects.toMatchObject({ reason: 'previously_rejected' });
      await expect(m.accessToken('c')).rejects.toMatchObject({ reason: 'previously_rejected' });
      expect(calls(), code).toBe(1);
    }
  });

  it('retries a transient failure later, without marking the grant dead', async () => {
    let healthy = false;
    const { m, tokens } = manager(expiring(30), async () => {
      if (!healthy) throw new OAuthError('temporarily_unavailable');
      return fresh;
    });
    await expect(m.accessToken('c')).rejects.toBeInstanceOf(TransientTokenError);
    expect(tokens.flagged).toEqual([]);
    healthy = true;
    expect(await m.accessToken('c')).toBe('new-access');
  });

  it('treats an error that is not an OAuthError as the network', async () => {
    const { m, tokens } = manager(expiring(30), async () => { throw new Error('ECONNRESET to https://idp?code=SECRET'); });
    await expect(m.accessToken('c')).rejects.toMatchObject({ code: 'network' });
    expect(tokens.flagged).toEqual([]);
  });

  it('needs reauthorization when there is no token, or nothing to refresh with', async () => {
    await expect(manager(null, async () => fresh).m.accessToken('c')).rejects.toMatchObject({ reason: 'no_token' });
    const noRefresh = manager({ ...expiring(30), refreshToken: null }, async () => fresh);
    await expect(noRefresh.m.accessToken('c')).rejects.toMatchObject({ reason: 'no_refresh_token' });
    expect(noRefresh.tokens.flagged).toEqual(['no_refresh_token']);
  });

  it('uses the other worker’s token when it lost the rotation race', async () => {
    const { m, tokens } = manager(expiring(30), async () => ({ accessToken: 'loser-access', refreshToken: 'loser-refresh', expiresInSeconds: 3600 }));
    tokens.store.raceOnce = { accessToken: 'winner-access', refreshToken: 'winner-refresh', expiresAt: new Date(t0.getTime() + 3_600_000), needsReauth: false };
    expect(await m.accessToken('c')).toBe('winner-access');
    expect(tokens.record).toMatchObject({ refreshToken: 'winner-refresh' });
  });

  it('puts no token and nothing the provider said into an error', async () => {
    const { m } = manager(expiring(30), async () => { throw new OAuthError('invalid_grant'); });
    let error: Error | null = null;
    try {
      await m.accessToken('c');
    } catch (e) {
      error = e as Error;
    }
    if (!error) throw new Error('expected a refusal');
    for (const secret of [ACCESS, REFRESH]) {
      expect(JSON.stringify(error) + error.message + String(error.stack ?? '').split('\n')[0]).not.toContain(secret);
    }
  });

  it('revokes at the provider, and still forgets the grant when the provider cannot', async () => {
    const ok = manager(expiring(3600), async () => fresh);
    let revoked = '';
    expect(await ok.m.revoke('c', async (t) => { revoked = t; })).toEqual({ providerRevoked: true });
    expect(revoked).toBe(REFRESH);
    expect(ok.tokens.flagged).toEqual(['disconnected']);

    const down = manager(expiring(3600), async () => fresh);
    expect(await down.m.revoke('c', async () => { throw new Error('revocation endpoint is down'); })).toEqual({ providerRevoked: false });
    expect(down.tokens.flagged).toEqual(['disconnected']);
    await expect(down.m.accessToken('c')).rejects.toBeInstanceOf(ReauthorizationRequired);
  });
});

describe('OIDC claims', () => {
  const expectation = { issuer: 'https://idp.example.edu', audience: 'semester', nonce: 'n-1', now: t0 };
  const nowS = Math.floor(t0.getTime() / 1000);
  const good = { iss: 'https://idp.example.edu', aud: 'semester', exp: nowS + 300, iat: nowS - 10, nonce: 'n-1' };

  it('passes claims that are right (the control for every refusal below)', () => {
    expect(idTokenProblems(good, expectation)).toEqual([]);
    expect(idTokenProblems({ ...good, aud: ['semester'] }, expectation)).toEqual([]);
  });

  it('names each thing that is wrong', () => {
    const cases: [object, string][] = [
      [{ iss: 'https://evil.example' }, 'issuer does not match'],
      [{ aud: 'another-client' }, 'audience does not include this client'],
      [{ aud: ['semester', 'other'] }, 'multiple audiences are not accepted'],
      [{ exp: nowS - 61 }, 'token has expired'],
      [{ exp: undefined }, 'expiry is missing'],
      [{ iat: nowS + 61 }, 'token was issued in the future'],
      [{ iat: nowS - 4000 }, 'token is older than the maximum age'],
      [{ iat: undefined }, 'issued-at is missing'],
      [{ nonce: 'replayed' }, 'nonce does not match'],
      [{ nonce: undefined }, 'nonce does not match'],
    ];
    for (const [over, problem] of cases) expect(idTokenProblems({ ...good, ...over }, expectation), problem).toContain(problem);
  });

  it('allows the clock skew it promises and not a second more', () => {
    expect(idTokenProblems({ ...good, exp: nowS - 59 }, expectation)).toEqual([]);
    expect(idTokenProblems({ ...good, exp: nowS - 60 }, expectation)).toContain('token has expired');
  });
});
