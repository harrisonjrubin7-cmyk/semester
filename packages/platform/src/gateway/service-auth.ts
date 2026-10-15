/**
 * Service-to-service authentication: short-lived, audience-bound, tenant-bound
 * tokens between Semester's own services, workers and gateways.
 *
 * A service is an actor (`ActorType: 'service'`), and it gets the same
 * treatment as a person: it is authenticated, it is tied to a tenant, and its
 * every action is policy-checked and audited. What it must not get is a
 * standing key that opens every tenant.
 *
 * Token = `base64url(header).base64url(claims).base64url(HMAC-SHA-256)`.
 *
 * - **`alg` is fixed** to HS256 and read from our own constant, never from the
 *   token — the classic "alg: none" and algorithm-confusion downgrades have
 *   nothing to negotiate.
 * - **`kid`** selects a key from the ring, so keys rotate without an outage:
 *   add the new key, sign with it, retire the old one after the longest token
 *   lifetime has passed.
 * - **`aud`** names the one service the token is for. A token minted for the
 *   search service is refused by the files service.
 * - **`ten`** binds the token to one tenant. A token with no `ten` is
 *   platform-level and is refused for tenant data unless it carries the
 *   `platform:cross_tenant` scope *and* its audience is `platform-ops` — the
 *   narrow door for support and operations tooling, which also needs a
 *   justified, time-limited grant at the policy layer.
 * - **Lifetime is capped** at five minutes; `jti` feeds a replay guard.
 */

import { fromBase64Url, hmacSha256, timingSafeEqual, toBase64Url, utf8 } from '../kernel/canonical.ts';
import type { Clock, IdSource } from '../kernel/clock.ts';
import { PlatformError } from './errors.ts';

export const SERVICE_TOKEN_MAX_LIFETIME_S = 300;
export const CROSS_TENANT_SCOPE = 'platform:cross_tenant';
export const PLATFORM_OPS_AUDIENCE = 'platform-ops';
const ALG = 'HS256';

export interface ServiceClaims {
  /** Issuer: the service that minted it. */
  iss: string;
  /** Subject: the calling service identity. */
  sub: string;
  /** Audience: the one service it is for. */
  aud: string;
  /** Tenant binding. */
  ten?: string;
  scope: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface ServiceKeyRing {
  currentKid: string;
  keys: Readonly<Record<string, Uint8Array>>;
}

export interface ReplayGuard {
  /** Returns true the first time a `jti` is seen before `expSeconds`, false on any replay. */
  firstUse(jti: string, expSeconds: number): Promise<boolean> | boolean;
}

export class MemoryReplayGuard implements ReplayGuard {
  private readonly seen = new Map<string, number>();
  private readonly clock: Clock;
  constructor(clock: Clock) {
    this.clock = clock;
  }
  firstUse(jti: string, expSeconds: number): boolean {
    const nowS = Math.floor(this.clock.now().getTime() / 1000);
    for (const [k, exp] of this.seen) if (exp <= nowS) this.seen.delete(k);
    if (this.seen.has(jti)) return false;
    this.seen.set(jti, expSeconds);
    return true;
  }
}

export async function signServiceToken(
  ring: ServiceKeyRing,
  input: { iss: string; sub: string; aud: string; ten?: string; scope?: string[]; ttlSeconds?: number },
  deps: { clock: Clock; ids: IdSource },
): Promise<string> {
  const ttl = input.ttlSeconds ?? 60;
  if (ttl < 1 || ttl > SERVICE_TOKEN_MAX_LIFETIME_S) throw new Error(`A service token lives between 1 and ${SERVICE_TOKEN_MAX_LIFETIME_S} seconds.`);
  const iat = Math.floor(deps.clock.now().getTime() / 1000);
  const claims: ServiceClaims = {
    iss: input.iss,
    sub: input.sub,
    aud: input.aud,
    ...(input.ten !== undefined ? { ten: input.ten } : {}),
    scope: input.scope ?? [],
    iat,
    exp: iat + ttl,
    jti: deps.ids.next('jti'),
  };
  const head = toBase64Url(utf8(JSON.stringify({ alg: ALG, kid: ring.currentKid, typ: 'svc' })));
  const body = toBase64Url(utf8(JSON.stringify(claims)));
  const sig = await hmacSha256(ring.keys[ring.currentKid], utf8(`${head}.${body}`));
  return `${head}.${body}.${toBase64Url(sig)}`;
}

export interface VerifyExpectation {
  audience: string;
  /** The tenant the request is about, when it is about one. */
  tenantId?: string;
}

const unauthenticated = () => new PlatformError('unauthenticated', 'The service credential was not accepted.');

export async function verifyServiceToken(
  ring: ServiceKeyRing,
  token: string,
  expect: VerifyExpectation,
  deps: { clock: Clock; replay?: ReplayGuard },
): Promise<ServiceClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw unauthenticated();
  const [h, b, s] = parts;
  const head = parseJson(h) as { alg?: unknown; kid?: unknown } | null;
  // The algorithm is ours, not the token's.
  if (!head || head.alg !== ALG || typeof head.kid !== 'string') throw unauthenticated();
  const key = Object.prototype.hasOwnProperty.call(ring.keys, head.kid) ? ring.keys[head.kid] : undefined;
  const sig = fromBase64Url(s);
  if (!key || !sig) throw unauthenticated();
  if (!timingSafeEqual(await hmacSha256(key, utf8(`${h}.${b}`)), sig)) throw unauthenticated();

  const c = parseJson(b) as ServiceClaims | null;
  if (!c || typeof c.iss !== 'string' || typeof c.sub !== 'string' || typeof c.aud !== 'string' || typeof c.jti !== 'string') throw unauthenticated();
  if (!Array.isArray(c.scope) || !Number.isInteger(c.iat) || !Number.isInteger(c.exp)) throw unauthenticated();

  const nowS = Math.floor(deps.clock.now().getTime() / 1000);
  if (c.exp <= nowS || c.iat > nowS + 30) throw unauthenticated();
  if (c.exp - c.iat > SERVICE_TOKEN_MAX_LIFETIME_S) throw unauthenticated();
  if (c.aud !== expect.audience) throw unauthenticated();

  if (expect.tenantId !== undefined) {
    if (c.ten !== undefined) {
      if (c.ten !== expect.tenantId) throw new PlatformError('tenant_mismatch', 'The service credential is for a different school.');
    } else if (!(c.scope.includes(CROSS_TENANT_SCOPE) && c.aud === PLATFORM_OPS_AUDIENCE)) {
      throw new PlatformError('tenant_unresolved', 'The service credential is not bound to a school.');
    }
  }
  if (deps.replay && !(await deps.replay.firstUse(c.jti, c.exp))) throw unauthenticated();
  return c;
}

function parseJson(part: string): unknown {
  const bytes = fromBase64Url(part);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
