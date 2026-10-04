import { describe, expect, it } from 'vitest';
import { MOCK_SIS } from './mock-sis';
import type { AdapterDeclaration } from './adapter';
import { ConnectionGuard } from './rate-control';
import { LeaseBroker, memoryBackend, type VaultAuditEvent } from './vault';
import {
  OAuthError, ReauthorizationRequired, TransientTokenError,
  type TokenRecord, type TokenResponse, type TokenStore,
} from './oauth';
import {
  CredentialRefused, GuardRefusal, ProviderHttpError, classifyFailure, createProviderClient, providerRuntime, retryAfterMs,
  type CredentialServices, type OAuthBinding,
} from './provider-client';

const t0 = new Date('2026-10-01T12:00:00Z');
const TENANT = 'school-a';
const CONNECTION = 'conn-1';
const SECRET = 'tenant-client-secret-must-not-print';
const rotatedAt = new Date('2026-09-01T00:00:00Z');

const oauthDeclaration: AdapterDeclaration = { ...MOCK_SIS, credentialsReference: 'vault:tenants/school-a/sis', authentication: 'oauth2' };
const apiKeyDeclaration: AdapterDeclaration = { ...oauthDeclaration, authentication: 'api_key' };
const openDeclaration: AdapterDeclaration = { ...oauthDeclaration, credentialsReference: null, authentication: 'none' };

function memoryTokens(initial: TokenRecord | null) {
  let record = initial;
  const flagged: string[] = [];
  const store: TokenStore = {
    async load() { return record ? { ...record } : null; },
    async save(_id, next, expected) {
      if ((record?.refreshToken ?? null) !== expected) return false;
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

const tokenRecord = (secondsLeft: number): TokenRecord => ({
  accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: new Date(t0.getTime() + secondsLeft * 1000), needsReauth: false,
});

interface Rig {
  declaration?: AdapterDeclaration;
  guard?: ConnectionGuard;
  tokens?: TokenRecord | null;
  refresh?: OAuthBinding['refresh'];
  noCredentials?: boolean;
  audit?: (e: VaultAuditEvent) => void | Promise<void>;
  ttlMs?: number;
}

function rig(over: Rig = {}) {
  const events: VaultAuditEvent[] = [];
  const backend = memoryBackend({ 'vault:tenants/school-a/sis': { value: SECRET, version: 'v1', rotatedAt } });
  const broker = new LeaseBroker({ backend, now: () => t0, audit: over.audit ?? ((e) => { events.push(e); }) });
  const tokens = memoryTokens(over.tokens === undefined ? tokenRecord(3600) : over.tokens);
  const refreshCalls: { refreshToken: string; clientSecret: string }[] = [];
  const oauth: OAuthBinding = {
    refresh: over.refresh ?? (async (refreshToken, clientSecret) => {
      refreshCalls.push({ refreshToken, clientSecret });
      return { accessToken: 'access-2', refreshToken: 'refresh-2', expiresInSeconds: 3600 } satisfies TokenResponse;
    }),
  };
  const credentials: CredentialServices | undefined = over.noCredentials ? undefined : { broker, tokens: tokens.store };
  let now = t0;
  const guard = over.guard ?? new ConnectionGuard({ perMinute: 1000, maxConcurrent: 10 });
  const client = createProviderClient({
    adapter: { declaration: over.declaration ?? oauthDeclaration, oauth }, tenantId: TENANT, connectionPublicId: CONNECTION,
    guard, credentials, now: () => now,
  });
  return { client, guard, events, backend, tokens, refreshCalls, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

const refuses = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e);

describe('classifying a failure', () => {
  const failure = (e: unknown) => classifyFailure(e, t0);

  it('says what each thrown error means', () => {
    expect(failure(new ReauthorizationRequired('invalid_grant'))).toMatchObject({ category: 'authentication', outcome: 'permanent_failure' });
    expect(failure(new TransientTokenError('network'))).toMatchObject({ category: 'provider_unavailable', code: 'token_refresh_unavailable' });
    expect(failure(new ProviderHttpError(401))).toMatchObject({ category: 'authentication', code: 'http_401', outcome: 'permanent_failure' });
    expect(failure(new ProviderHttpError(403))).toMatchObject({ category: 'authentication' });
    expect(failure(new ProviderHttpError(429, 30_000))).toMatchObject({ category: 'rate_limit', outcome: 'retryable_failure', retryAfterMs: 30_000 });
    expect(failure(new ProviderHttpError(503))).toMatchObject({ category: 'provider_unavailable', outcome: 'retryable_failure' });
    expect(failure(new ProviderHttpError(408))).toMatchObject({ category: 'provider_unavailable' });
    expect(failure(new ProviderHttpError(422))).toMatchObject({ category: 'schema_validation', outcome: 'permanent_failure' });
    expect(failure(new ProviderHttpError(404))).toMatchObject({ category: 'schema_validation' });
    expect(failure(new Error('ECONNRESET'))).toMatchObject({ category: 'provider_unavailable', code: 'provider_error', outcome: 'retryable_failure' });
    expect(failure('not even an error')).toMatchObject({ category: 'provider_unavailable' });
  });

  it('treats a held call as a wait, and an open breaker as an outage with the time left', () => {
    expect(failure(new GuardRefusal('rate_limited', t0.getTime() + 5_000))).toMatchObject({ category: 'rate_limit', code: 'rate_limited', retryAfterMs: 5_000 });
    expect(failure(new GuardRefusal('penalized', t0.getTime() + 1))).toMatchObject({ category: 'rate_limit', retryAfterMs: 1 });
    expect(failure(new GuardRefusal('circuit_open', t0.getTime() + 60_000))).toMatchObject({ category: 'provider_unavailable', code: 'circuit_open', retryAfterMs: 60_000 });
    expect(failure(new GuardRefusal('concurrency', t0.getTime() - 1)).retryAfterMs).toBe(0);
  });

  it('retries only a credential platform that could not audit; every other refusal is configuration', () => {
    expect(failure(new CredentialRefused('audit_unavailable'))).toMatchObject({ category: 'provider_unavailable' });
    for (const reason of ['wrong_tenant', 'not_found', 'malformed_reference', 'not_configured', 'no_token_store'] as const) {
      expect(failure(new CredentialRefused(reason)), reason).toMatchObject({ category: 'authentication', code: `credential_${reason}` });
    }
  });

  it('never counts a failure that is ours against the provider', () => {
    for (const e of [new ReauthorizationRequired('x'), new ProviderHttpError(401), new ProviderHttpError(400), new CredentialRefused('not_found'), new GuardRefusal('rate_limited', 0)]) {
      expect(failure(e).outcome, e.constructor.name).toBe('permanent_failure');
    }
  });

  it('reads Retry-After as seconds or a date, ignores nonsense, and caps it at an hour', () => {
    expect(retryAfterMs('30', t0)).toBe(30_000);
    expect(retryAfterMs(new Date(t0.getTime() + 90_000).toUTCString(), t0)).toBe(90_000);
    for (const bad of [undefined, null, '', 'soon', '-5', '0', new Date(t0.getTime() - 1000).toUTCString()]) expect(retryAfterMs(bad, t0), String(bad)).toBeUndefined();
    expect(retryAfterMs('999999', t0)).toBe(3_600_000);
  });
});

describe('a provider call through the client', () => {
  it('hands the call an OAuth access token and leases the credential once per pull', async () => {
    const r = rig();
    const seen: (string | null)[] = [];
    for (let i = 0; i < 3; i++) await r.client.call(async (auth) => { seen.push(auth.accessToken); expect(auth.secret).toBeNull(); });
    expect(seen).toEqual(['access-1', 'access-1', 'access-1']);
    expect(r.events.filter((e) => e.event === 'credential.leased')).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ reference: 'vault:tenants/school-a/sis', tenantId: TENANT, connectionId: CONNECTION, purpose: 'sync' });
  });

  it('refreshes a token about to expire, with the leased client secret, and stores the rotated one', async () => {
    const r = rig({ tokens: tokenRecord(30) });
    let token: string | null = null;
    await r.client.call(async (auth) => { token = auth.accessToken; });
    expect(token).toBe('access-2');
    expect(r.refreshCalls).toEqual([{ refreshToken: 'refresh-1', clientSecret: SECRET }]);
    expect(r.tokens.record).toMatchObject({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  });

  it('refreshes once however many calls run at the same time', async () => {
    const r = rig({ tokens: tokenRecord(30) });
    await Promise.all(Array.from({ length: 6 }, () => r.client.call(async () => undefined)));
    expect(r.refreshCalls).toHaveLength(1);
  });

  it('gives an API-key adapter the leased secret, for that call', async () => {
    const r = rig({ declaration: apiKeyDeclaration });
    let seen: string | null = null;
    await r.client.call(async (auth) => { seen = auth.secret; expect(auth.accessToken).toBeNull(); });
    expect(seen).toBe(SECRET);
  });

  it('gives a connection with no credential none, and asks the vault for nothing', async () => {
    const r = rig({ declaration: openDeclaration, noCredentials: true });
    let auth: unknown = null;
    await r.client.call(async (a) => { auth = a; });
    expect(auth).toEqual({ accessToken: null, secret: null });
    expect(r.backend.reads).toEqual([]);
  });

  it('fails closed: an adapter that declares a credential, with none provided, never reaches the provider', async () => {
    for (const declaration of [oauthDeclaration, apiKeyDeclaration]) {
      const r = rig({ declaration, noCredentials: true });
      let called = false;
      const error = await refuses(r.client.call(async () => { called = true; }));
      expect(error).toBeInstanceOf(CredentialRefused);
      expect(error).toMatchObject({ reason: 'not_configured' });
      expect(called).toBe(false);
    }
  });

  it('refuses an OAuth adapter that has no token store, or no refresh binding', async () => {
    const noStore = createProviderClient({
      adapter: { declaration: oauthDeclaration, oauth: { refresh: async () => ({ accessToken: 'x', expiresInSeconds: 1 }) } },
      tenantId: TENANT, connectionPublicId: CONNECTION, guard: new ConnectionGuard({ perMinute: 100 }), now: () => t0,
      credentials: { broker: new LeaseBroker({ backend: memoryBackend({ 'vault:tenants/school-a/sis': { value: SECRET, version: 'v1', rotatedAt } }), audit: () => undefined, now: () => t0 }) },
    });
    expect(await refuses(noStore.call(async () => undefined))).toMatchObject({ reason: 'no_token_store' });

    const tokens = memoryTokens(tokenRecord(3600));
    const noBinding = createProviderClient({
      adapter: { declaration: oauthDeclaration }, tenantId: TENANT, connectionPublicId: CONNECTION,
      guard: new ConnectionGuard({ perMinute: 100 }), now: () => t0,
      credentials: { tokens: tokens.store, broker: new LeaseBroker({ backend: memoryBackend({ 'vault:tenants/school-a/sis': { value: SECRET, version: 'v1', rotatedAt } }), audit: () => undefined, now: () => t0 }) },
    });
    expect(await refuses(noBinding.call(async () => undefined))).toMatchObject({ reason: 'no_oauth_binding' });
  });

  it('refuses another school’s credential and a lease it cannot audit, without calling the provider', async () => {
    const foreign = rig({ declaration: { ...oauthDeclaration, credentialsReference: 'vault:tenants/school-b/sis' } });
    expect(await refuses(foreign.client.call(async () => undefined))).toMatchObject({ reason: 'wrong_tenant' });
    expect(foreign.backend.reads).toEqual([]);

    const unaudited = rig({ audit: () => { throw new Error('audit store down'); } });
    let called = false;
    expect(await refuses(unaudited.client.call(async () => { called = true; }))).toMatchObject({ reason: 'audit_unavailable' });
    expect(called).toBe(false);
  });

  it('stops on a dead grant: flags it once, never offers it again, and never calls the provider', async () => {
    const r = rig({ tokens: tokenRecord(30), refresh: async () => { throw new OAuthError('invalid_grant'); } });
    let called = 0;
    for (let i = 0; i < 3; i++) {
      expect(await refuses(r.client.call(async () => { called++; }))).toBeInstanceOf(ReauthorizationRequired);
    }
    expect(called).toBe(0);
    expect(r.tokens.flagged).toEqual(['invalid_grant']);
  });

  it('keeps a secret out of every error it throws', async () => {
    const r = rig({ declaration: apiKeyDeclaration });
    const error = await refuses(r.client.call(async (auth) => { throw new Error(`upstream said no to ${auth.secret}`); }));
    // The adapter's own error is the adapter's to scrub; the worker passes it through sanitizeMessage.
    expect(error).toBeInstanceOf(Error);
    const credentialError = await refuses(rig({ declaration: apiKeyDeclaration, noCredentials: true }).client.call(async () => undefined));
    expect(JSON.stringify(credentialError) + (credentialError as Error).message).not.toContain(SECRET);
  });
});

describe('the guard behind the client', () => {
  it('refuses before touching any credential when the guard says no', async () => {
    const guard = new ConnectionGuard({ perMinute: 1000, failureThreshold: 2, openMs: 60_000 });
    const r = rig({ guard });
    for (let i = 0; i < 2; i++) await refuses(r.client.call(async () => { throw new ProviderHttpError(503); }));
    r.events.length = 0;
    r.backend.reads.length = 0;
    let called = false;
    const error = await refuses(r.client.call(async () => { called = true; }));
    expect(error).toBeInstanceOf(GuardRefusal);
    expect(error).toMatchObject({ reason: 'circuit_open' });
    expect(called).toBe(false);
    expect(r.backend.reads).toEqual([]);
    expect(r.events).toEqual([]);
  });

  it('opens the breaker on the provider’s failures and not on ours', async () => {
    const provider = rig({ guard: new ConnectionGuard({ perMinute: 1000, failureThreshold: 3 }) });
    for (let i = 0; i < 3; i++) await refuses(provider.client.call(async () => { throw new ProviderHttpError(500); }));
    expect(provider.guard.breaker(TENANT, CONNECTION, t0.getTime())).toBe('open');

    const ours = rig({ guard: new ConnectionGuard({ perMinute: 1000, failureThreshold: 3 }) });
    for (const status of [401, 403, 400, 404, 422, 401, 401]) await refuses(ours.client.call(async () => { throw new ProviderHttpError(status); }));
    expect(ours.guard.breaker(TENANT, CONNECTION, t0.getTime())).toBe('closed');

    const refusedCredential = rig({ declaration: { ...oauthDeclaration, credentialsReference: 'vault:tenants/school-b/sis' }, guard: new ConnectionGuard({ perMinute: 1000, failureThreshold: 3 }) });
    for (let i = 0; i < 6; i++) await refuses(refusedCredential.client.call(async () => undefined));
    expect(refusedCredential.guard.breaker(TENANT, CONNECTION, t0.getTime())).toBe('closed');
  });

  it('waits out the provider’s Retry-After, then lets calls through', async () => {
    const r = rig();
    await refuses(r.client.call(async () => { throw new ProviderHttpError(429, 30_000); }));
    const held = await refuses(r.client.call(async () => undefined));
    expect(held).toMatchObject({ reason: 'penalized', retryAtMs: t0.getTime() + 30_000 });
    r.advance(30_000);
    await expect(r.client.call(async () => 'ok')).resolves.toBe('ok');
  });

  it('applies the connection’s own rate limit, and says it is a wait and not a failure', async () => {
    const r = rig({ guard: new ConnectionGuard({ perMinute: 2, maxConcurrent: 10 }) });
    await r.client.call(async () => undefined);
    await r.client.call(async () => undefined);
    const error = await refuses(r.client.call(async () => undefined));
    expect(error).toMatchObject({ reason: 'rate_limited' });
    expect(classifyFailure(error, t0)).toMatchObject({ category: 'rate_limit' });
  });

  it('caps calls in flight, and frees the slot when a call throws', async () => {
    const r = rig({ guard: new ConnectionGuard({ perMinute: 1000, maxConcurrent: 1 }) });
    let release: () => void = () => undefined;
    const slow = r.client.call(() => new Promise<void>((resolve) => { release = resolve; }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await refuses(r.client.call(async () => undefined))).toMatchObject({ reason: 'concurrency' });
    release();
    await slow;
    await refuses(r.client.call(async () => { throw new Error('boom'); }));
    await expect(r.client.call(async () => 'free')).resolves.toBe('free');
  });

  it('keeps one school’s connection from spending another’s allowance', async () => {
    const guard = new ConnectionGuard({ perMinute: 1, maxConcurrent: 10 });
    const a = createProviderClient({ adapter: { declaration: openDeclaration }, tenantId: 'school-a', connectionPublicId: 'c', guard, now: () => t0 });
    const b = createProviderClient({ adapter: { declaration: openDeclaration }, tenantId: 'school-b', connectionPublicId: 'c', guard, now: () => t0 });
    await a.call(async () => undefined);
    expect(await refuses(a.call(async () => undefined))).toBeInstanceOf(GuardRefusal);
    await expect(b.call(async () => 'mine')).resolves.toBe('mine');
  });
});

describe('the runtime the tick is handed', () => {
  const limited: AdapterDeclaration = { ...openDeclaration, rateLimitPerMinute: 2 };
  const context = (declaration: AdapterDeclaration) =>
    ({ adapter: { declaration }, tenantId: TENANT, connectionPublicId: CONNECTION, now: () => t0 });

  it('sizes each pull\u2019s guard from the adapter\u2019s declared rate limit', async () => {
    const client = providerRuntime().clientFor(context(limited));
    await client.call(async () => undefined);
    await client.call(async () => undefined);
    expect(await refuses(client.call(async () => undefined))).toMatchObject({ reason: 'rate_limited' });
  });

  it('gives every pull its own guard: one pull\u2019s spent allowance is not the next one\u2019s', async () => {
    const runtime = providerRuntime();
    const first = runtime.clientFor(context(limited));
    await first.call(async () => undefined);
    await first.call(async () => undefined);
    expect(await refuses(first.call(async () => undefined))).toBeInstanceOf(GuardRefusal);
    await expect(runtime.clientFor(context(limited)).call(async () => 'fresh')).resolves.toBe('fresh');
  });

  it('hands the credential services to every client, and fails closed without them', async () => {
    const r = rig({ declaration: apiKeyDeclaration });
    const withServices = providerRuntime({ credentials: { broker: new LeaseBroker({
      backend: r.backend, now: () => t0, audit: () => undefined,
    }) } }).clientFor(context(apiKeyDeclaration));
    let seen: string | null = null;
    await withServices.call(async (auth) => { seen = auth.secret; });
    expect(seen).toBe(SECRET);

    const without = providerRuntime().clientFor(context(apiKeyDeclaration));
    expect(await refuses(without.call(async () => undefined))).toMatchObject({ reason: 'not_configured' });
  });

  it('classifies with the same function the worker would have imported', () => {
    expect(providerRuntime().classify).toBe(classifyFailure);
  });
});
