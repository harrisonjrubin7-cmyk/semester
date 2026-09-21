import { describe, expect, it } from 'vitest';
import {
  SCOPE,
  clientAssertion,
  jwks,
  keyId,
  publicJwk,
  tokenRequest,
} from '../../../supabase/functions/_shared/ltikey';
import type { Registration } from '../../../supabase/functions/_shared/lti';

/**
 * The key this tool signs with, and the endpoint that must never serve it.
 *
 * Most of this file is ordinary. One block is not, and it is the reason the
 * file exists: `publicJwk` is the single function in this repository whose
 * failure mode is **publishing a private key at a URL we invite the world to
 * fetch**. Nothing about that failure looks wrong — the JSON is valid, the
 * endpoint returns 200, and Brightspace works perfectly, because a private JWK
 * contains its own public half.
 *
 * So the test for it is adversarial rather than exemplary: build a private key
 * with every secret field populated, hand it over, and read the answer back
 * field by field by name. A test that checked the output "looks right" would
 * pass against a function that returned its input unchanged.
 */

const REG: Registration & { tokenUrl?: string | null } = {
  issuer: 'https://brightspace.vanderbilt.edu',
  clientId: 'semester-client',
  deploymentId: 'deploy-1',
  authLoginUrl: 'https://brightspace.vanderbilt.edu/d2l/lti/authenticate',
  jwksUrl: 'https://brightspace.vanderbilt.edu/d2l/.well-known/jwks',
  tokenUrl: 'https://auth.brightspace.com/core/connect/token',
};

/** Every field an RSA private JWK can carry, all of them set. */
const PRIVATE_KEY = {
  kty: 'RSA',
  n: 'modulus-value',
  e: 'AQAB',
  d: 'PRIVATE-EXPONENT',
  p: 'PRIME-ONE',
  q: 'PRIME-TWO',
  dp: 'EXPONENT-ONE',
  dq: 'EXPONENT-TWO',
  qi: 'COEFFICIENT',
  ext: true,
  key_ops: ['sign'],
};

/** The six that are the key itself. Any one of them is the whole secret. */
const SECRET_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi'] as const;

describe('the public half, and only the public half', () => {
  it('publishes what a verifier needs', () => {
    const out = publicJwk(PRIVATE_KEY, 'kid-1');
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.value).toEqual({
      kty: 'RSA',
      n: 'modulus-value',
      e: 'AQAB',
      alg: 'RS256',
      use: 'sig',
      kid: 'kid-1',
    });
  });

  /*
   * Named one at a time rather than as a set, so a failure says *which* field
   * escaped. A single assertion on the whole object would too, but this reads
   * back in the output of a failing run as the name of the thing that leaked.
   */
  for (const field of SECRET_FIELDS) {
    it(`never publishes ${field}`, () => {
      const out = publicJwk(PRIVATE_KEY, 'kid-1');
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(Object.keys(out.value)).not.toContain(field);
      expect(JSON.stringify(out.value)).not.toContain(PRIVATE_KEY[field]);
    });
  }

  /*
   * The control, and it is doing real work here. Every assertion above passes
   * against a function that returned an empty object — which is also what a
   * broken allowlist returns.
   */
  it('and the thing it returns is a usable key rather than nothing', () => {
    const out = publicJwk(PRIVATE_KEY, 'kid-1');
    expect(out.ok && out.value.n).toBe('modulus-value');
    expect(out.ok && out.value.kid).toBe('kid-1');
  });

  /*
   * An allowlist cannot fail open on a field nobody thought of, and this is
   * how that is pinned: a key carrying a field invented after this was written
   * does not reach the document either.
   */
  it('drops a field this file has never heard of', () => {
    const out = publicJwk({ ...PRIVATE_KEY, some_future_secret: 'NEW-SECRET' }, 'kid-1');
    expect(out.ok && JSON.stringify(out.value)).not.toContain('NEW-SECRET');
  });

  it('refuses a key that is not RSA rather than publishing half of one', () => {
    const v = publicJwk({ kty: 'EC', x: 'a', y: 'b', d: 'SECRET' }, 'kid-1');
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('not-rsa');
  });

  it('refuses a key with no modulus or no exponent', () => {
    const noN = publicJwk({ kty: 'RSA', e: 'AQAB' }, 'k');
    const noE = publicJwk({ kty: 'RSA', n: 'm' }, 'k');
    expect(!noN.ok && noN.reason).toBe('no-modulus');
    expect(!noE.ok && noE.reason).toBe('no-exponent');
  });
});

describe('the JWKS document', () => {
  it('is a set even with one key in it', () => {
    const one = publicJwk(PRIVATE_KEY, 'kid-1');
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(jwks([one.value])).toEqual({ keys: [one.value] });
  });

  it('and carries no secret field through the wrapper either', () => {
    const one = publicJwk(PRIVATE_KEY, 'kid-1');
    if (!one.ok) throw new Error('unreachable');
    const doc = JSON.stringify(jwks([one.value]));
    for (const f of SECRET_FIELDS) expect(doc).not.toContain(PRIVATE_KEY[f]);
  });
});

describe('the assertion this tool presents instead of a client secret', () => {
  const NOW = 1_790_000_000;

  it('is issued by, and about, the client id — which is not a mistake', () => {
    const v = clientAssertion(REG, 'jti-1', NOW);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.value.iss).toBe('semester-client');
    expect(v.value.sub).toBe('semester-client');
  });

  /*
   * Audienced at the token endpoint, not the issuer. A platform handed an
   * assertion audienced elsewhere is being asked to accept one minted for a
   * different endpoint, which is the replay the field exists to stop.
   */
  it('is audienced at the token endpoint rather than the issuer', () => {
    const v = clientAssertion(REG, 'jti-1', NOW);
    expect(v.ok && v.value.aud).toBe('https://auth.brightspace.com/core/connect/token');
    expect(v.ok && v.value.aud).not.toBe(REG.issuer);
  });

  it('lives five minutes, because it is presented once', () => {
    const v = clientAssertion(REG, 'jti-1', NOW);
    expect(v.ok && v.value.iat).toBe(NOW);
    expect(v.ok && v.value.exp).toBe(NOW + 300);
  });

  it('refuses a registration with no token endpoint, by name', () => {
    const v = clientAssertion({ ...REG, tokenUrl: null }, 'jti-1', NOW);
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe('no-token-url');
      // The administrator has to know which row to fill in.
      expect(v.detail).toContain(REG.issuer);
    }
  });

  it('refuses to sign an assertion for a plain-http endpoint', () => {
    const v = clientAssertion({ ...REG, tokenUrl: 'http://auth.test/token' }, 'jti-1', NOW);
    expect(!v.ok && v.reason).toBe('insecure-token-url');
  });

  it('refuses without a unique id', () => {
    expect(clientAssertion(REG, '', NOW).ok).toBe(false);
  });
});

describe('the token request', () => {
  it('asks by client credentials, with the assertion as the secret', () => {
    const v = tokenRequest('signed.jwt.here', [SCOPE.score]);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const q = new URLSearchParams(v.value);
    expect(q.get('grant_type')).toBe('client_credentials');
    expect(q.get('client_assertion_type')).toBe(
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    );
    expect(q.get('client_assertion')).toBe('signed.jwt.here');
  });

  /*
   * One field, space-separated. Repeated `scope` fields are quietly ignored by
   * some platforms, which then issue a token with no scopes and refuse a
   * request several steps later, a long way from the cause.
   */
  it('sends every scope in one space-separated field', () => {
    const v = tokenRequest('a.b.c', [SCOPE.score, SCOPE.lineItem]);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const q = new URLSearchParams(v.value);
    expect(q.getAll('scope')).toHaveLength(1);
    expect(q.get('scope')).toBe(`${SCOPE.score} ${SCOPE.lineItem}`);
  });

  it('refuses a request with no scope, which could do nothing anyway', () => {
    expect(tokenRequest('a.b.c', []).ok).toBe(false);
  });

  it('refuses a request with no assertion', () => {
    expect(tokenRequest('', [SCOPE.score]).ok).toBe(false);
  });

  /*
   * The roster scope is deliberately not among the ones this tool knows how to
   * ask for. Nothing here needs to know who else is in the class, and a scope
   * that is available is a scope somebody adds later without the argument.
   */
  it('has no name for the roster scope', () => {
    expect(Object.values(SCOPE).join(' ')).not.toContain('contextmembership');
  });
});

describe('the key id', () => {
  it('is the same for the same key, and different for another', async () => {
    const a = await keyId(PRIVATE_KEY);
    expect(a).toBe(await keyId({ ...PRIVATE_KEY }));
    expect(a).not.toBe(await keyId({ ...PRIVATE_KEY, n: 'another-modulus' }));
  });

  it('says nothing about the private half', async () => {
    const id = await keyId(PRIVATE_KEY);
    for (const f of SECRET_FIELDS) expect(id).not.toContain(PRIVATE_KEY[f]);
    // Derived from the modulus alone, so a key that differs only in its
    // private fields is the same key and gets the same id.
    expect(id).toBe(await keyId({ kty: 'RSA', n: PRIVATE_KEY.n, e: PRIVATE_KEY.e }));
  });
});
