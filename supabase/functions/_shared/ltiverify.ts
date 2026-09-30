/**
 * What is decided about an LTI id_token before its signature is trusted, and
 * how its signature is verified.
 *
 * `lti.ts` holds every rule about the *claims*. This holds the rules about the
 * *envelope*, which `lti/index.ts` used to leave to `jose`'s defaults: it
 * called `jwtVerify(token, keysFor(url))` with no options at all. `jose` is a
 * careful library and its defaults refuse `alg: none` and an HMAC token
 * checked against an RSA key set, so nothing here was exploitable. The
 * defaults were also unstated, unpinned and untested, and a dependency bump
 * that changed one would have changed what an LTI launch accepts without any
 * diff in this repository saying so. These are the same rules, written down.
 *
 * Pure: no network, no clock, no environment, no `jose`. That is what lets
 * `ltiverify.test.ts` forge the headers below and watch each one refused.
 * The key set is the shell's job and comes from a registration row, never
 * from the token: a header that names a key location (`jku`, `x5u`) or
 * carries a key (`jwk`, `x5c`) is refused rather than ignored, because a
 * verifier that ignores it is one refactor from following it.
 */

import { MAX_TOKEN_AGE_SECONDS, type Registration } from './lti.ts';

export { MAX_TOKEN_AGE_SECONDS };

/**
 * The only signature algorithm an LTI 1.3 launch is accepted under.
 *
 * The specification requires RS256 of a platform and allows others by
 * agreement. Nothing here has agreed to another, and an allowlist of one is
 * the cheapest way to make `none` and every `HS*` impossible: the algorithm
 * has to be in this list *and* match the key set's key type, so a token
 * signed with the platform's public key as an HMAC secret has nowhere to go.
 */
export const LTI_ALGORITHMS = ['RS256'] as const;

/** Header parameters that tell a verifier where a key is, or hand it one. */
const KEY_SELECTING_HEADERS = ['jku', 'x5u', 'x5c', 'x5t', 'x5t#S256', 'jwk'] as const;

/**
 * A header, or the reason it is refused. The reasons are stable words: they
 * go in the log and in the reference a student is shown, and a test names them.
 */
export type HeaderVerdict =
  | { ok: true; alg: string; kid: string }
  | { ok: false; reason: string; detail: string };

const bad = (reason: string, detail: string): HeaderVerdict => ({ ok: false, reason, detail });

/** Decode a compact JWT's header without trusting anything in it. */
export function decodeHeader(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0]) return null;
  try {
    const b64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const value: unknown = JSON.parse(json);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Every rule about a token's header, before any key is fetched.
 *
 * Order: shape, key-location parameters, `crit`, algorithm, then `kid`.
 * The key-location check comes before the algorithm check so that a token
 * that is wrong twice is reported as the more dangerous of the two.
 */
export function checkHeader(header: Record<string, unknown> | null): HeaderVerdict {
  if (!header) return bad('bad-token', 'The id_token is not a compact JWT with a JSON header.');

  for (const name of KEY_SELECTING_HEADERS) {
    if (name in header) {
      return bad('key-in-header', `The token header carries ${name}; keys come from the registration only.`);
    }
  }
  // A `crit` header lists extensions the verifier must understand. This one
  // understands none, and RFC 7515 says to refuse what it cannot honour.
  if ('crit' in header) return bad('unsupported-crit', 'The token header carries crit.');

  const alg = typeof header.alg === 'string' ? header.alg : '';
  if (!alg) return bad('no-alg', 'The token header names no algorithm.');
  if (!(LTI_ALGORITHMS as readonly string[]).includes(alg)) {
    return bad('wrong-alg', `Algorithm ${alg} is not one this tool accepts.`);
  }
  if (header.typ !== undefined && header.typ !== 'JWT') {
    return bad('wrong-typ', 'The token header typ is not JWT.');
  }

  const kid = typeof header.kid === 'string' ? header.kid.trim() : '';
  if (!kid) return bad('no-kid', 'The token header names no key id.');
  if (kid.length > 256) return bad('bad-kid', 'The key id is implausibly long.');

  return { ok: true, alg, kid };
}

/** Seconds of clock skew forgiven between the platform and this tool. */
export const CLOCK_SKEW_SECONDS = 60;

/**
 * The options `jwtVerify` is called with. Signature-level rules only;
 * every claim rule lives in `checkLaunch`, and `issuer` and `audience` are
 * repeated here so that a bug in one place is not the only line of defence.
 */
export function verifyOptions(reg: Pick<Registration, 'issuer' | 'clientId'>) {
  return {
    algorithms: [...LTI_ALGORITHMS],
    issuer: reg.issuer,
    audience: reg.clientId,
    clockTolerance: CLOCK_SKEW_SECONDS,
    maxTokenAge: MAX_TOKEN_AGE_SECONDS,
    requiredClaims: ['iss', 'aud', 'exp', 'iat', 'nonce', 'sub'],
  };
}

/**
 * How the platform's key set is fetched and re-fetched.
 *
 * `jose`'s defaults are a 30 s cooldown between re-fetches, a 5 s timeout and
 * a 10 min cache. They are the right numbers; pinning them makes them a
 * reviewed decision. The property that matters is written in `keysFor`'s
 * caller: the URL is a registration's, so an attacker's `kid` can make this
 * tool ask a platform it already trusts for its keys, and never anywhere else.
 */
export const JWKS_OPTIONS = {
  cooldownDuration: 30_000,
  cacheMaxAge: 600_000,
  timeoutDuration: 5_000,
} as const;

/**
 * An error, reduced to what is safe to log.
 *
 * `${e}` puts a library's message in the log, and a library's message can
 * carry a URL, a key id or a fragment of the token. The class name and code
 * say what went wrong, which is all a log line needs.
 */
export function safeError(e: unknown): string {
  if (e && typeof e === 'object') {
    const o = e as { name?: unknown; code?: unknown };
    const name = typeof o.name === 'string' ? o.name : 'Error';
    const code = typeof o.code === 'string' ? o.code : '';
    return code ? `${name}(${code})` : name;
  }
  return 'Error';
}

/**
 * A subject, reduced to something that can sit in a log without being a
 * person. A short digest is enough to tell two launches by one account from
 * two accounts; it is not the platform's identifier for them.
 */
export async function subjectDigest(subject: string): Promise<string> {
  const bytes = new TextEncoder().encode(subject);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash.slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('');
}
