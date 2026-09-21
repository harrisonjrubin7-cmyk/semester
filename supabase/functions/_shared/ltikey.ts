/**
 * The key this tool signs with, and the one function that must never leak it.
 *
 * `20260921160000_lti.sql` said why there was no key material in either LTI
 * migration: *a private key in a table before anything signs with it is a
 * secret with no use and a blast radius.* Something is about to sign with it,
 * so this is that key — and the answer to "where does it live" is the one the
 * repository already uses for `VAPID_PRIVATE_KEY`, which is the same shape of
 * thing: a private key used only by an Edge Function, held as a **function
 * secret**, with its public half published on purpose.
 *
 * Not the Vault. `SECURITY.md` has exactly one secret there, `CRON_SECRET`,
 * and the reason is that *Postgres* has to read it — the cron job sends it as
 * a bearer token. Nothing in the database needs this one, so putting it in the
 * Vault would widen who can reach it for no gain.
 *
 * Not a table, still. `lti_platform` is registration a school installed and is
 * readable by the service role; the signing key is not that kind of fact.
 *
 * ## Why a tool needs a key at all
 *
 * A launch is the *platform* proving who it is to us, and it does that with
 * its key. Everything after a launch runs the other way. Grade passback and
 * deep linking are this tool calling **back into** Brightspace, and there is
 * no session to do it with: the standard's answer is OAuth2 client
 * credentials, where the client secret is a JWT we sign ourselves and the
 * platform verifies against a JWKS we publish.
 *
 * So the key is what turns "Brightspace can open Semester" into "Semester can
 * answer Brightspace", and the two halves of it go in opposite directions —
 * which is the whole hazard this file is shaped around.
 *
 * ## Everything here is pure
 *
 * Same rule as `_shared/lti.ts` and for the same reason: arguments in, values
 * out, no `Deno.env`, so `app/src/lib/ltikey.test.ts` can walk it. The one
 * function that touches WebCrypto takes the key as an argument rather than
 * reading it from anywhere.
 */

import type { Registration } from './lti.ts';

/**
 * The scopes this tool asks for, and nothing beyond them.
 *
 * Named individually rather than requested as a set, because an access token
 * is granted the scopes it asked for: a tool that asks for everything the
 * standard defines gets a token that can do everything, and then the only
 * thing standing between a bug and somebody's gradebook is the code path that
 * happened not to be taken.
 *
 * `score` writes a mark. `lineitem` creates and edits the column it goes in.
 * `result` reads back what is there. `contextmembership` is the roster and is
 * **not** here: this tool has no feature that needs to know who else is in the
 * class, and asking for it anyway would be collecting a roster because it was
 * available.
 */
export const SCOPE = {
  score: 'https://purl.imsglobal.org/spec/lti-ags/scope/score',
  lineItem: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem',
  lineItemReadonly: 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
  result: 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
} as const;

/** What a refusal carries. Mirrors `_shared/lti.ts`, deliberately. */
export interface Refused {
  ok: false;
  reason: string;
  detail: string;
}
export type Verdict<T> = { ok: true; value: T } | Refused;

const no = (reason: string, detail: string): Refused => ({ ok: false, reason, detail });

/**
 * **The one function in this file that can leak the key.**
 *
 * A JWK for an RSA private key and a JWK for its public half differ by the
 * presence of five fields — `d`, `p`, `q`, `dp`, `dq`, `qi` — and an export
 * that forgets to drop them publishes the private key at a URL the platform,
 * and everyone else, is invited to fetch. Nothing about the document *looks*
 * different: it is still valid JSON, the endpoint still returns 200, and the
 * platform still works.
 *
 * So this is an allowlist rather than a deletion. Naming what may be published
 * cannot fail open; deleting what may not is one forgotten field away from
 * doing so, and the forgotten field would be invisible in every test that
 * checked the endpoint worked.
 *
 * `ltikey.test.ts` asserts that by feeding it a private JWK with every secret
 * field set and reading the result back for each one by name.
 */
export function publicJwk(key: Record<string, unknown>, kid: string): Verdict<Record<string, unknown>> {
  const kty = typeof key.kty === 'string' ? key.kty : '';
  if (kty !== 'RSA') return no('not-rsa', `Key type ${kty || '(absent)'} is not RSA.`);
  if (typeof key.n !== 'string' || !key.n) return no('no-modulus', 'The key has no modulus.');
  if (typeof key.e !== 'string' || !key.e) return no('no-exponent', 'The key has no public exponent.');

  /*
   * Everything a verifier needs and nothing else. `alg` and `use` are stated
   * rather than copied from the key, because a platform reading this should
   * be told what the key is for by us, not by whatever generated it.
   */
  return {
    ok: true,
    value: { kty: 'RSA', n: key.n, e: key.e, alg: 'RS256', use: 'sig', kid },
  };
}

/** A JWKS document is a set, even when the set has one key in it. */
export function jwks(keys: Record<string, unknown>[]): { keys: Record<string, unknown>[] } {
  return { keys };
}

/**
 * The claims of the JWT this tool presents instead of a client secret.
 *
 * `iss` and `sub` are both the client id — that is not a mistake in the
 * standard and it is the part people get wrong: the tool is both the issuer of
 * this assertion and the subject it is about.
 *
 * `aud` is the platform's **token endpoint**, not its issuer. A platform that
 * receives an assertion audienced at something else is being asked to accept a
 * token minted for a different endpoint, which is the replay this field exists
 * to stop.
 *
 * `jti` is passed in rather than generated, for the same reason `startLogin`
 * takes its state and nonce: it must be unpredictable, and a value a test
 * cannot fix is a value a test cannot assert about.
 */
export function clientAssertion(
  reg: Registration & { tokenUrl?: string | null },
  jti: string,
  now: number,
): Verdict<Record<string, unknown>> {
  const tokenUrl = (reg.tokenUrl ?? '').trim();
  if (!tokenUrl) {
    /*
     * A registration installed before this existed has no token endpoint, and
     * there is nothing to guess: the URL is per-platform and a wrong one sends
     * a signed assertion to somebody else's server. Refusing by name tells the
     * administrator exactly which row to fill in.
     */
    return no('no-token-url', `Registration for ${reg.issuer} has no token endpoint recorded.`);
  }
  if (!tokenUrl.startsWith('https://')) {
    return no('insecure-token-url', `Token endpoint ${tokenUrl} is not https.`);
  }
  if (!jti) return no('no-jti', 'A client assertion needs a unique id.');

  return {
    ok: true,
    value: {
      iss: reg.clientId,
      sub: reg.clientId,
      aud: tokenUrl,
      iat: now,
      /*
       * Five minutes. The assertion is presented once, immediately, over one
       * round trip — a longer life buys nothing and widens the window in which
       * a copy of it is worth having.
       */
      exp: now + 300,
      jti,
    },
  };
}

/**
 * The form body of the client-credentials request.
 *
 * Scopes are space-separated in one field, which is the part that looks wrong
 * and is correct; sending them as repeated fields is silently ignored by some
 * platforms, which then issue a token with no scopes and a 403 several
 * requests later, far from the cause.
 */
export function tokenRequest(assertion: string, scopes: readonly string[]): Verdict<string> {
  if (!assertion) return no('no-assertion', 'There is no signed assertion to present.');
  if (scopes.length === 0) return no('no-scope', 'A token with no scope can do nothing.');

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  body.set('client_assertion', assertion);
  body.set('scope', scopes.join(' '));
  return { ok: true, value: body.toString() };
}

/**
 * A stable `kid` for a key, so a platform can cache our JWKS and still find
 * the right entry after a rotation.
 *
 * Derived from the modulus rather than chosen, because a hand-picked id has to
 * be kept in step with the key by somebody remembering to, and the failure
 * when they do not is a platform holding a cached key under an id that now
 * means a different one.
 */
export async function keyId(key: Record<string, unknown>): Promise<string> {
  const n = typeof key.n === 'string' ? key.n : '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(n));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
