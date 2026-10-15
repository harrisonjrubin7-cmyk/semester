import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  JWKS_OPTIONS,
  LTI_ALGORITHMS,
  checkHeader,
  decodeHeader,
  safeError,
  subjectDigest,
  verifyOptions,
} from '../../../supabase/functions/_shared/ltiverify';

/**
 * The envelope of an LTI id_token: what is refused before a key is fetched,
 * and what `jwtVerify` is pinned to.
 *
 * The tokens below are built with `node:crypto`, not hand-written strings, so
 * the classic attacks are the real ones: an RS256-shaped token, an `alg: none`
 * token, and an HS256 token whose HMAC secret is the platform's *public* key,
 * which is what a verifier that lets the token choose its algorithm accepts.
 * `jose` is not installed for the app's tests and the rules are pure, so each
 * is checked at `checkHeader`, the gate the edge function runs first.
 */

const b64u = (v: unknown) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const PAYLOAD = { iss: 'https://platform.example', aud: 'client-1', sub: 'u-1' };

function rs256(header: Record<string, unknown> = {}): string {
  const h = b64u({ alg: 'RS256', typ: 'JWT', kid: 'key-1', ...header });
  const p = b64u(PAYLOAD);
  const sig = sign('sha256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${sig}`;
}
const unsigned = (header: Record<string, unknown>) => `${b64u(header)}.${b64u(PAYLOAD)}.`;
function hs256WithPublicKey(): string {
  const h = b64u({ alg: 'HS256', typ: 'JWT', kid: 'key-1' });
  const p = b64u(PAYLOAD);
  return `${h}.${p}.${createHmac('sha256', publicPem).update(`${h}.${p}`).digest('base64url')}`;
}

const verdict = (token: string) => checkHeader(decodeHeader(token));
const why = (token: string) => {
  const v = verdict(token);
  return v.ok ? 'accepted' : v.reason;
};

describe('the control, which must pass', () => {
  it('accepts an RS256 token with a key id', () => {
    const v = verdict(rs256());
    expect(v).toEqual({ ok: true, alg: 'RS256', kid: 'key-1' });
  });
});

describe('algorithm confusion', () => {
  it('refuses alg none', () => {
    expect(why(unsigned({ alg: 'none', kid: 'key-1' }))).toBe('wrong-alg');
    expect(why(unsigned({ alg: 'None', kid: 'key-1' }))).toBe('wrong-alg');
  });

  it("refuses an HS256 token signed with the platform's public key as the secret", () => {
    expect(why(hs256WithPublicKey())).toBe('wrong-alg');
  });

  it('refuses every other algorithm, symmetric or not', () => {
    for (const alg of ['HS256', 'HS384', 'HS512', 'ES256', 'PS256', 'RS384', 'RS512', 'EdDSA', '']) {
      expect(why(rs256({ alg })), alg).not.toBe('accepted');
    }
  });

  it('allows exactly one algorithm', () => {
    expect([...LTI_ALGORITHMS]).toEqual(['RS256']);
  });

  it('refuses a header with no algorithm at all', () => {
    expect(why(unsigned({ kid: 'key-1' }))).toBe('no-alg');
  });
});

describe('keys named by the token', () => {
  it.each([
    ['jku', 'https://attacker.example/keys'],
    ['x5u', 'https://attacker.example/cert'],
    ['x5c', ['MIIB...']],
    ['x5t', 'thumb'],
    ['x5t#S256', 'thumb'],
    ['jwk', { kty: 'RSA', n: 'x', e: 'AQAB' }],
  ])('refuses a header carrying %s', (name, value) => {
    expect(why(rs256({ [name]: value }))).toBe('key-in-header');
  });

  it('reports the key parameter before the algorithm when a token is wrong twice', () => {
    expect(why(rs256({ alg: 'HS256', jku: 'https://attacker.example/keys' }))).toBe('key-in-header');
  });

  it('refuses crit, which it cannot honour', () => {
    expect(why(rs256({ crit: ['exp'] }))).toBe('unsupported-crit');
  });
});

describe('the rest of the header', () => {
  it('refuses a missing, blank or absurd key id', () => {
    expect(why(rs256({ kid: undefined }))).toBe('no-kid');
    expect(why(rs256({ kid: '   ' }))).toBe('no-kid');
    expect(why(rs256({ kid: 'k'.repeat(300) }))).toBe('bad-kid');
  });

  it('refuses a typ that is not JWT, and accepts none', () => {
    expect(why(rs256({ typ: 'at+jwt' }))).toBe('wrong-typ');
    expect(why(rs256({ typ: undefined }))).toBe('accepted');
  });

  it('refuses what is not a compact JWT', () => {
    for (const t of ['', 'abc', 'a.b', 'a.b.c.d', '!!!.b.c', `${b64u('[]')}.b.c`, `${b64u('"str"')}.b.c`]) {
      expect(why(t), t).toBe('bad-token');
    }
  });
});

describe('what jwtVerify is given', () => {
  const reg = { issuer: 'https://platform.example', clientId: 'client-1' };

  it('pins the algorithm, issuer, audience and age', () => {
    const o = verifyOptions(reg);
    expect(o.algorithms).toEqual(['RS256']);
    expect(o.issuer).toBe(reg.issuer);
    expect(o.audience).toBe(reg.clientId);
    expect(o.maxTokenAge).toBe(600);
    expect(o.clockTolerance).toBe(60);
    expect(o.requiredClaims).toEqual(expect.arrayContaining(['iss', 'aud', 'exp', 'iat', 'nonce', 'sub']));
  });

  it("takes the issuer and audience from the registration, so two tenants' options differ", () => {
    const a = verifyOptions({ issuer: 'https://a.example', clientId: 'a' });
    const b = verifyOptions({ issuer: 'https://b.example', clientId: 'b' });
    expect(a.audience).not.toBe(b.audience);
    expect(a.issuer).not.toBe(b.issuer);
  });

  it('pins how the key set is re-fetched', () => {
    expect(JWKS_OPTIONS).toEqual({ cooldownDuration: 30_000, cacheMaxAge: 600_000, timeoutDuration: 5_000 });
  });
});

describe('what a log line may carry', () => {
  it('reduces an error to its class and code, never its message', () => {
    const e = Object.assign(new Error('failed for https://x.example/keys?token=SECRET'), { code: 'ERR_JWKS_TIMEOUT' });
    expect(safeError(e)).toBe('Error(ERR_JWKS_TIMEOUT)');
    expect(safeError(e)).not.toContain('SECRET');
    expect(safeError('a string with a token')).toBe('Error');
    expect(safeError(null)).toBe('Error');
  });

  it('digests a subject: stable, short, and not the subject', async () => {
    const a = await subjectDigest('platform-user-88');
    expect(a).toBe(await subjectDigest('platform-user-88'));
    expect(a).not.toBe(await subjectDigest('platform-user-89'));
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(a).not.toContain('platform-user');
  });
});

/**
 * The edge function is Deno and is not run here, so the properties that live
 * in it are held structurally, the way `rootunmount.test.ts` holds a teardown:
 * by reading the file. Each assertion below fails against the code as it was
 * before this change.
 */
describe('the edge function keeps to these rules', () => {
  const src = readFileSync(new URL('../../../supabase/functions/lti/index.ts', import.meta.url), 'utf8');

  it('checks the header before it verifies, and verifies under pinned options', () => {
    const header = src.indexOf('checkHeader(decodeHeader(token))');
    const verify = src.indexOf('jwtVerify(token, keysFor(reg.jwksUrl), verifyOptions(reg))');
    expect(header, 'header check present').toBeGreaterThan(-1);
    expect(verify, 'pinned jwtVerify present').toBeGreaterThan(-1);
    expect(header).toBeLessThan(verify);
    expect(src).not.toMatch(/jwtVerify\(token, keysFor\([^)]*\)\)/);
  });

  it('builds the key set from the registration with pinned options, and reads no key location from a request', () => {
    expect(src).toContain('createRemoteJWKSet(new URL(jwksUrl), { ...JWKS_OPTIONS })');
    expect(src).not.toMatch(/jku|x5u|jwks_uri/);
  });

  it('logs no raw exception and no platform subject', () => {
    expect(src).not.toMatch(/\$\{e\}/);
    expect(src).not.toMatch(/sub=\$\{(?!await subjectDigest)/);
    expect(src).not.toMatch(/console\.\w+\([^)]*id_token/);
  });
});
