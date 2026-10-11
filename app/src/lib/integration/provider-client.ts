/**
 * The client an adapter makes its provider calls through, and the one place a
 * thrown error becomes a category the worker can act on.
 *
 * `tick.ts` builds one per pull and hands it to `adapter.pull(request, client)`.
 * Every provider call goes through `client.call(fn)`, which, in order:
 *
 *   1. asks the connection's `ConnectionGuard` — token bucket, Retry-After
 *      penalty box, concurrency cap, circuit breaker — and refuses before any
 *      credential is touched when the answer is no;
 *   2. gets the credential: one lease per pull from the `LeaseBroker`
 *      (tenant-bound, audited first), and for OAuth the access token from the
 *      `TokenManager`, which refreshes once and stops on a dead grant;
 *   3. runs the call with a `CallAuth` valid for that call, and reports how it
 *      went to the guard so the next call knows.
 *
 * **Fail closed.** An adapter that declares a `credentialsReference`, run
 * where no credential services were provided, gets `CredentialRefused`, not an
 * anonymous call. The production Edge Function provides none today, so a real
 * adapter registered before its secret store, token store and audit sink exist
 * dead-letters on its first pull and says why; it never calls the provider.
 *
 * What the guard protects is the calls *inside* a pull — the pages an adapter
 * walks — and that is where a provider is hammered. Between pulls the tick's
 * own ladder holds: failures are counted from stored runs, the fifth
 * dead-letters, and a dead letter holds the connection for an operator. This
 * file adds no second ladder; it classifies errors so that ladder is told the
 * truth (a dead grant is `authentication`, which dead-letters at once; a
 * throttle is `rate_limit`, which carries the provider's wait).
 */
import type { AdapterDeclaration } from './adapter.ts';
import type { ErrorCategory } from './catalog.ts';
import { ConnectionGuard, type Outcome } from './rate-control.ts';
import type { CredentialLease, LeaseBroker, RefusalReason } from './vault.ts';
import {
  ReauthorizationRequired, TokenManager, TransientTokenError, type TokenResponse, type TokenStore,
} from './oauth.ts';

/** What a call is given. Valid for that call; adapter code must not keep it. */
export interface CallAuth {
  /** OAuth 2 / OIDC bearer token, or null. */
  accessToken: string | null;
  /** The leased secret for `api_key`, `sftp`, `mtls` and the like, or null. */
  secret: string | null;
}

export interface ProviderClient {
  call<T>(fn: (auth: CallAuth) => Promise<T>): Promise<T>;
}

/** The platform services an adapter's credentials come from. */
export interface CredentialServices {
  broker: LeaseBroker;
  /** Where OAuth tokens live. Required for `oauth2` and `oidc` adapters. */
  tokens?: TokenStore;
}

/** How an adapter that authenticates with OAuth gets a new access token. */
export interface OAuthBinding {
  /** `clientSecret` is the leased credential; the adapter never reads the vault itself. */
  refresh(refreshToken: string, clientSecret: string): Promise<TokenResponse>;
}

// ----------------------------------------------------------------- errors ----

/** Thrown by adapter code (or `providerHttp`) from a provider's HTTP response. */
export class ProviderHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | undefined;
  constructor(status: number, retryAfterMs?: number) {
    super(`The provider answered ${status}`);
    this.name = 'ProviderHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * The provider's `Retry-After`, as milliseconds. Seconds or an HTTP date;
 * anything else, or a negative, is no hint. Capped at one hour so a hostile
 * or broken value cannot park a connection for a week.
 */
export function retryAfterMs(header: string | null | undefined, now: Date): number | undefined {
  if (!header) return undefined;
  const value = header.trim();
  const ms = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now.getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 3_600_000) : undefined;
}

function providerHttpError(error: unknown): { status: number; retryAfterMs?: number } | null {
  if (error instanceof ProviderHttpError) return error;
  if (!(error instanceof Error) || error.name !== 'ProviderHttpError') return null;
  const candidate = error as Error & { status?: unknown; retryAfterMs?: unknown };
  if (!Number.isInteger(candidate.status) || (candidate.retryAfterMs !== undefined && typeof candidate.retryAfterMs !== 'number')) return null;
  return candidate as Error & { status: number; retryAfterMs?: number };
}

/** The credential could not be obtained. Nothing was sent to the provider. */
export class CredentialRefused extends Error {
  readonly reason: RefusalReason | 'not_configured' | 'no_token_store' | 'no_oauth_binding';
  constructor(reason: CredentialRefused['reason']) {
    super(`The credential was refused: ${reason}`);
    this.reason = reason;
  }
}

/** The guard said not now. Nothing was sent to the provider. */
export class GuardRefusal extends Error {
  readonly reason: 'circuit_open' | 'penalized' | 'concurrency' | 'rate_limited';
  readonly retryAtMs: number;
  constructor(reason: GuardRefusal['reason'], retryAtMs: number) {
    super(`The provider call was held: ${reason}`);
    this.reason = reason;
    this.retryAtMs = retryAtMs;
  }
}

// --------------------------------------------------------- classification ----

export interface Failure {
  category: ErrorCategory;
  /** A short machine code for `integration_sync_errors.error_code`. */
  code: string;
  /** What the guard should learn from it. */
  outcome: Outcome;
  retryAfterMs?: number;
}

/**
 * What a thrown error means. The worker uses `category` and `retryAfterMs`
 * for the ladder, `code` for the dashboard; the client uses `outcome` for the
 * breaker.
 *
 * Only a failure that is the provider's counts against the breaker
 * (`retryable_failure`). A rejected grant, a malformed request and a
 * credential we could not get are ours, and say so.
 */
export function classifyFailure(error: unknown, now: Date): Failure {
  if (error instanceof ReauthorizationRequired) {
    return { category: 'authentication', code: 'reauthorization_required', outcome: 'permanent_failure' };
  }
  if (error instanceof CredentialRefused) {
    // A platform that could not audit the lease is down, not misconfigured:
    // retry. Every other refusal is configuration, and waiting will not fix it.
    return error.reason === 'audit_unavailable'
      ? { category: 'provider_unavailable', code: 'audit_unavailable', outcome: 'permanent_failure' }
      : { category: 'authentication', code: `credential_${error.reason}`, outcome: 'permanent_failure' };
  }
  if (error instanceof TransientTokenError) {
    return { category: 'provider_unavailable', code: 'token_refresh_unavailable', outcome: 'retryable_failure' };
  }
  if (error instanceof GuardRefusal) {
    const wait = Math.max(0, error.retryAtMs - now.getTime());
    return error.reason === 'circuit_open'
      ? { category: 'provider_unavailable', code: 'circuit_open', outcome: 'permanent_failure', retryAfterMs: wait }
      : { category: 'rate_limit', code: error.reason, outcome: 'permanent_failure', retryAfterMs: wait };
  }
  const http = providerHttpError(error);
  if (http) {
    const { status } = http;
    if (status === 401 || status === 403) return { category: 'authentication', code: `http_${status}`, outcome: 'permanent_failure' };
    if (status === 429) {
      return { category: 'rate_limit', code: 'http_429', outcome: 'retryable_failure', ...(http.retryAfterMs ? { retryAfterMs: http.retryAfterMs } : {}) };
    }
    if (status === 408 || status >= 500) {
      return { category: 'provider_unavailable', code: `http_${status}`, outcome: 'retryable_failure', ...(http.retryAfterMs ? { retryAfterMs: http.retryAfterMs } : {}) };
    }
    // Any other 4xx: the provider rejected what we sent. Asking again will not change it.
    return { category: 'schema_validation', code: `http_${status}`, outcome: 'permanent_failure' };
  }
  return { category: 'provider_unavailable', code: 'provider_error', outcome: 'retryable_failure' };
}

// ----------------------------------------------------------------- client ----

export interface ClientDeps {
  adapter: { declaration: AdapterDeclaration; oauth?: OAuthBinding };
  tenantId: string;
  connectionPublicId: string;
  /** Connection-scoped secret-manager pointer. Omitted only by legacy callers/tests. */
  credentialReference?: string | null;
  guard: ConnectionGuard;
  /** Absent means no credentials can be issued; an adapter that needs one is refused. */
  credentials?: CredentialServices;
  now: () => Date;
}

/**
 * The provider-call machinery as the tick wants it (`ProviderRuntime` in
 * `server/integration/tick.ts`): a client per pull, each with its own guard
 * sized from the adapter's declared rate limit, and the classifier the worker
 * uses. The Edge Function composes this with whatever credential services the
 * deployment has — none today — and the tests compose it with in-memory ones.
 *
 * It lives here and is handed to the gateway, rather than imported by it,
 * because the gateway may not take on more client source than the boundary
 * ledger records.
 */
export function providerRuntime(options: { credentials?: CredentialServices } = {}) {
  return {
    clientFor(context: {
      adapter: { declaration: AdapterDeclaration; oauth?: OAuthBinding };
      tenantId: string;
      connectionPublicId: string;
      credentialReference?: string | null;
      now: () => Date;
    }): ProviderClient {
      return createProviderClient({
        adapter: context.adapter, tenantId: context.tenantId, connectionPublicId: context.connectionPublicId,
        // Test fixtures predate connection rows carrying credential pointers.
        // Live adapters never fall back to their registry declaration.
        credentialReference: context.credentialReference === undefined && context.adapter.declaration.mock
          ? context.adapter.declaration.credentialsReference
          : context.credentialReference,
        guard: new ConnectionGuard({ perMinute: context.adapter.declaration.rateLimitPerMinute }),
        credentials: options.credentials, now: context.now,
      });
    },
    classify: classifyFailure,
  };
}

export function createProviderClient(deps: ClientDeps): ProviderClient {
  const { declaration: d } = deps.adapter;
  const credentialReference = Object.prototype.hasOwnProperty.call(deps, 'credentialReference')
    ? deps.credentialReference
    : d.credentialsReference;
  const { tenantId, connectionPublicId: connection } = deps;
  let lease: CredentialLease | null = null;
  let manager: TokenManager | null = null;

  /** One lease per pull, renewed if it has lapsed. */
  async function credential(): Promise<CredentialLease> {
    if (lease) {
      try {
        lease.reveal();
        return lease;
      } catch {
        lease = null;
      }
    }
    if (!deps.credentials) throw new CredentialRefused('not_configured');
    const result = await deps.credentials.broker.lease({
      reference: credentialReference as string, tenantId, connectionId: connection, purpose: 'sync',
    });
    if (!result.ok) throw new CredentialRefused(result.reason);
    lease = result.lease;
    return lease;
  }

  async function authorize(): Promise<CallAuth> {
    if (credentialReference === null) return { accessToken: null, secret: null };
    if (!credentialReference) throw new CredentialRefused('not_configured');
    const held = await credential();
    if (d.authentication !== 'oauth2' && d.authentication !== 'oidc') return { accessToken: null, secret: held.reveal() };

    const tokens = deps.credentials?.tokens;
    const oauth = deps.adapter.oauth;
    if (!tokens) throw new CredentialRefused('no_token_store');
    if (!oauth) throw new CredentialRefused('no_oauth_binding');
    manager ??= new TokenManager({
      store: tokens,
      now: deps.now,
      // The client secret is read from the lease at the moment of refresh, so a
      // renewed lease is the one used and nothing holds the value in between.
      refresh: (refreshToken) => oauth.refresh(refreshToken, (lease as CredentialLease).reveal()),
    });
    return { accessToken: await manager.accessToken(connection), secret: null };
  }

  return {
    async call(fn) {
      const admission = deps.guard.admit(tenantId, connection, deps.now().getTime());
      if (!admission.ok) throw new GuardRefusal(admission.reason, admission.retryAtMs);
      try {
        // Before the call: a refused credential says nothing about the provider,
        // so a failure here is never reported to the guard.
        const auth = await authorize();
        try {
          const value = await fn(auth);
          deps.guard.record(tenantId, connection, 'success', deps.now().getTime());
          return value;
        } catch (error) {
          const failure = classifyFailure(error, deps.now());
          deps.guard.record(tenantId, connection, failure.outcome, deps.now().getTime(), failure.retryAfterMs);
          throw error;
        }
      } finally {
        admission.release();
      }
    },
  };
}
