/**
 * The OAuth 2.0 / OIDC pattern every connector with `authentication: 'oauth2'
 * | 'oidc'` follows, so no adapter writes its own.
 *
 * Three parts:
 *
 *  - **The authorization dance**: PKCE (S256), an authorization URL that
 *    refuses anything but https, and a signed, expiring `state` bound to one
 *    tenant and one connection so a callback cannot be replayed into another.
 *  - **The token lifecycle**: `TokenManager` hands out a fresh access token,
 *    refreshes once however many callers ask, survives two workers racing a
 *    rotating refresh token, and — the part that matters at three in the
 *    morning — **stops** when the provider says the grant is dead. A revoked
 *    grant is never retried: retrying `invalid_grant` is how a school's
 *    identity provider locks the integration out.
 *  - **OIDC claim checks**: issuer, audience, expiry and nonce. Signature
 *    verification against the provider's keys is the caller's step and happens
 *    first; these are the claims checks that follow it.
 *
 * Tokens pass through here and are never logged, thrown or returned in an
 * error. Anything the provider says is reduced to a code.
 */
import { base64Url, constantTimeEqual, hmacSha256Hex, randomBase64Url, sha256Base64Url } from './crypto.ts';

// ---------------------------------------------------------------- PKCE ----

export interface Pkce {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export async function createPkce(fill?: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array): Promise<Pkce> {
  // 32 random bytes encode to a 43-character verifier, the RFC 7636 minimum.
  const verifier = randomBase64Url(32, fill);
  return { verifier, challenge: await sha256Base64Url(verifier), method: 'S256' };
}

export interface AuthorizationRequest {
  endpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
  state: string;
  challenge: string;
  nonce?: string;
}

export function authorizationUrl(r: AuthorizationRequest): string {
  const endpoint = new URL(r.endpoint);
  const redirect = new URL(r.redirectUri);
  if (endpoint.protocol !== 'https:') throw new Error('The authorization endpoint must be https');
  if (redirect.protocol !== 'https:') throw new Error('The redirect URI must be https');
  if (r.scopes.length === 0) throw new Error('At least one scope is required');
  if (r.scopes.some((s) => /\s/.test(s))) throw new Error('A scope cannot contain whitespace');
  const q = endpoint.searchParams;
  q.set('response_type', 'code');
  q.set('client_id', r.clientId);
  q.set('redirect_uri', r.redirectUri);
  q.set('scope', r.scopes.join(' '));
  q.set('state', r.state);
  q.set('code_challenge', r.challenge);
  q.set('code_challenge_method', 'S256');
  if (r.nonce) q.set('nonce', r.nonce);
  return endpoint.toString();
}

// --------------------------------------------------------------- state ----

export interface StatePayload {
  tenantId: string;
  connectionId: string;
  nonce: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

const encodeState = (p: StatePayload) => base64Url(new TextEncoder().encode(JSON.stringify(p)));

export async function signState(secret: string, payload: StatePayload): Promise<string> {
  const body = encodeState(payload);
  return `${body}.${await hmacSha256Hex(secret, body)}`;
}

export type StateCheck =
  | { ok: true; payload: StatePayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_connection' };

function decodeState(body: string): StatePayload | null {
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(body.length / 4) * 4, '=');
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
    return typeof p?.tenantId === 'string' && typeof p.connectionId === 'string'
      && typeof p.nonce === 'string' && typeof p.expiresAt === 'number' ? p : null;
  } catch {
    return null;
  }
}

/** The callback's `state`, against the connection the callback arrived for. */
export async function verifyState(
  secret: string, state: string, expected: { tenantId: string; connectionId: string }, now: Date,
): Promise<StateCheck> {
  const [body, signature, ...rest] = state.split('.');
  if (!body || !signature || rest.length > 0) return { ok: false, reason: 'malformed' };
  if (!constantTimeEqual(signature, await hmacSha256Hex(secret, body))) return { ok: false, reason: 'bad_signature' };
  const payload = decodeState(body);
  if (!payload) return { ok: false, reason: 'malformed' };
  if (payload.expiresAt <= now.getTime()) return { ok: false, reason: 'expired' };
  if (payload.tenantId !== expected.tenantId || payload.connectionId !== expected.connectionId) {
    return { ok: false, reason: 'wrong_connection' };
  }
  return { ok: true, payload };
}

// -------------------------------------------------------- token lifecycle ----

export interface TokenRecord {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  needsReauth: boolean;
}

export interface TokenStore {
  load(connectionId: string): Promise<TokenRecord | null>;
  /**
   * Compare-and-swap on the refresh token: write `next` only if the stored
   * refresh token is still `expectedRefreshToken`. False means another worker
   * rotated it first, and the caller should reload and use theirs.
   */
  save(connectionId: string, next: TokenRecord, expectedRefreshToken: string | null): Promise<boolean>;
  markNeedsReauth(connectionId: string, reason: string): Promise<void>;
}

export interface TokenResponse {
  accessToken: string;
  /** Present when the provider rotates refresh tokens. */
  refreshToken?: string;
  expiresInSeconds: number;
}

export type OAuthErrorCode =
  | 'invalid_grant' | 'invalid_client' | 'unauthorized_client' | 'invalid_scope'
  | 'temporarily_unavailable' | 'server_error' | 'network';

/** What a refresh function throws. Carries a code and nothing the provider said. */
export class OAuthError extends Error {
  readonly code: OAuthErrorCode;
  constructor(code: OAuthErrorCode) {
    super(`OAuth error: ${code}`);
    this.code = code;
  }
}

/** The grant is dead. Not retryable; a person has to authorize again. */
export class ReauthorizationRequired extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super('The connection must be authorized again');
    this.reason = reason;
  }
}

/** The provider could not be reached or is struggling. Retryable. */
export class TransientTokenError extends Error {
  readonly code: OAuthErrorCode;
  constructor(code: OAuthErrorCode) {
    super('The token could not be refreshed right now');
    this.code = code;
  }
}

const GRANT_IS_DEAD: ReadonlySet<OAuthErrorCode> = new Set(['invalid_grant', 'invalid_client', 'unauthorized_client', 'invalid_scope']);

export interface TokenManagerOptions {
  store: TokenStore;
  refresh: (refreshToken: string) => Promise<TokenResponse>;
  now?: () => Date;
  /** Refresh this long before expiry, so a token never dies mid-call. */
  skewMs?: number;
}

export class TokenManager {
  private readonly inflight = new Map<string, Promise<string>>();
  private readonly options: TokenManagerOptions;
  private readonly now: () => Date;
  private readonly skewMs: number;

  constructor(options: TokenManagerOptions) {
    this.options = options;
    this.now = options.now ?? (() => new Date());
    this.skewMs = options.skewMs ?? 60_000;
  }

  async accessToken(connectionId: string): Promise<string> {
    const record = await this.options.store.load(connectionId);
    if (!record) throw new ReauthorizationRequired('no_token');
    // A grant already known to be dead is never offered to the provider again.
    if (record.needsReauth) throw new ReauthorizationRequired('previously_rejected');
    if (record.expiresAt.getTime() - this.now().getTime() > this.skewMs) return record.accessToken;

    const existing = this.inflight.get(connectionId);
    if (existing) return existing;
    const pending = this.refreshOnce(connectionId, record).finally(() => this.inflight.delete(connectionId));
    this.inflight.set(connectionId, pending);
    return pending;
  }

  private async refreshOnce(connectionId: string, record: TokenRecord): Promise<string> {
    const { store } = this.options;
    if (!record.refreshToken) {
      await store.markNeedsReauth(connectionId, 'no_refresh_token');
      throw new ReauthorizationRequired('no_refresh_token');
    }
    let response: TokenResponse;
    try {
      response = await this.options.refresh(record.refreshToken);
    } catch (error) {
      const code = error instanceof OAuthError ? error.code : 'network';
      if (GRANT_IS_DEAD.has(code)) {
        await store.markNeedsReauth(connectionId, code);
        throw new ReauthorizationRequired(code);
      }
      throw new TransientTokenError(code);
    }
    const next: TokenRecord = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken ?? record.refreshToken,
      expiresAt: new Date(this.now().getTime() + response.expiresInSeconds * 1000),
      needsReauth: false,
    };
    if (await store.save(connectionId, next, record.refreshToken)) return next.accessToken;
    // Another worker rotated the refresh token between our read and our write.
    // Ours is now spent and theirs is the one on record: use that.
    const winner = await store.load(connectionId);
    if (!winner || winner.needsReauth) throw new ReauthorizationRequired('lost_rotation_race');
    return winner.accessToken;
  }

  /**
   * Disconnect. Asks the provider to revoke, then forgets the tokens either
   * way; `providerRevoked: false` tells the operator to finish in the
   * provider's portal (`declaration.disconnect`).
   */
  async revoke(connectionId: string, revokeAtProvider: (token: string) => Promise<void>): Promise<{ providerRevoked: boolean }> {
    const record = await this.options.store.load(connectionId);
    let providerRevoked = false;
    const token = record?.refreshToken ?? record?.accessToken;
    if (token) {
      try {
        await revokeAtProvider(token);
        providerRevoked = true;
      } catch {
        providerRevoked = false;
      }
    }
    await this.options.store.markNeedsReauth(connectionId, 'disconnected');
    return { providerRevoked };
  }
}

// ----------------------------------------------------------------- OIDC ----

export interface IdTokenClaims {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
}

export interface IdTokenExpectation {
  issuer: string;
  audience: string;
  nonce: string;
  now: Date;
  /** Allowed clock disagreement. Default 60 seconds. */
  clockSkewSeconds?: number;
  /** Refuse a token issued longer ago than this. Default one hour. */
  maxAgeSeconds?: number;
}

/** Everything wrong with an ID token's claims; empty means they pass. */
export function idTokenProblems(claims: IdTokenClaims, e: IdTokenExpectation): string[] {
  const problems: string[] = [];
  const skew = e.clockSkewSeconds ?? 60;
  const maxAge = e.maxAgeSeconds ?? 3600;
  const nowS = Math.floor(e.now.getTime() / 1000);
  if (claims.iss !== e.issuer) problems.push('issuer does not match');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(e.audience)) problems.push('audience does not include this client');
  // With several audiences the token must name an authorized party; keep it strict.
  if (audiences.length > 1) problems.push('multiple audiences are not accepted');
  if (typeof claims.exp !== 'number') problems.push('expiry is missing');
  else if (claims.exp + skew <= nowS) problems.push('token has expired');
  if (typeof claims.iat !== 'number') problems.push('issued-at is missing');
  else if (claims.iat - skew > nowS) problems.push('token was issued in the future');
  else if (nowS - claims.iat > maxAge) problems.push('token is older than the maximum age');
  if (typeof claims.nonce !== 'string' || !constantTimeEqual(claims.nonce, e.nonce)) problems.push('nonce does not match');
  return problems;
}
