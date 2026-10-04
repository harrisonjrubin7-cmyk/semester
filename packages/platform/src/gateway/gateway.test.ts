import { describe, expect, it } from 'vitest';
import { fixedClock, sequentialIds } from '../kernel/clock.ts';
import { toBase64Url, utf8 } from '../kernel/canonical.ts';
import { ERROR_CODES, PlatformError, errorResponse, isPlatformError, parseErrorEnvelope, toPlatformError } from './errors.ts';
import { HEADERS, header, isIdempotencyKey, resolveCorrelationId } from './headers.ts';
import { IDEMPOTENCY_LEASE_MS, MemoryIdempotencyStore, withIdempotency } from './idempotency.ts';
import { CursorCodec, MAX_PAGE_SIZE, clampLimit, paginate, type Page } from './pagination.ts';
import { API_MAJORS, majorOf, negotiateMajor, registryProblems, type ApiMajor } from './versioning.ts';
import { MemoryReplayGuard, signServiceToken, verifyServiceToken, CROSS_TENANT_SCOPE, PLATFORM_OPS_AUDIENCE } from './service-auth.ts';
import { TENANT_A, TENANT_B, harness } from '../testing/memory.ts';

const clock = fixedClock('2026-10-04T12:00:00Z');
const ids = sequentialIds();

describe('error envelope', () => {
  it('has the shape ADR 0010 gave the gateway, with the legacy top-level message', () => {
    const r = errorResponse(new PlatformError('forbidden', 'No.', { userAction: { label: 'Ask', kind: 'contact_support' } }), 'corr-12345678');
    expect(r.status).toBe(403);
    expect(r.body).toEqual({
      error: { code: 'forbidden', message: 'No.', correlation_id: 'corr-12345678', retryable: false, user_action: { label: 'Ask', kind: 'contact_support' } },
      message: 'No.',
    });
    expect(r.headers['x-correlation-id']).toBe('corr-12345678');
  });

  it('is retryable only for 429 and 503, and an unknown outcome says not to retry', () => {
    const retryable = Object.entries(ERROR_CODES).filter(([, v]) => v.retryable).map(([, v]) => v.status).sort();
    expect(retryable).toEqual([429, 503]);
    expect(ERROR_CODES.outcome_unknown).toEqual({ status: 502, retryable: false });
  });

  it('flattens anything it did not mean to say — no stack, no query, no connection string', () => {
    const leaked = new Error('connection postgres://svc:hunter2@db.internal:5432/semester refused');
    const r = errorResponse(leaked, 'corr-12345678');
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('hunter2');
    expect(JSON.stringify(r.body)).not.toContain('postgres://');
    expect(isPlatformError(toPlatformError(leaked))).toBe(true);
  });

  it('sets Retry-After from the error', () => {
    expect(errorResponse(new PlatformError('rate_limited', 'Slow down.', { retryAfterSeconds: 2.2 }), 'corr-12345678').headers['retry-after']).toBe('3');
  });

  it('parses its own envelope and rejects look-alikes', () => {
    const r = errorResponse(new PlatformError('not_found', 'Gone.'), 'corr-12345678');
    expect(parseErrorEnvelope(r.body)).not.toBeNull();
    expect(parseErrorEnvelope({ error: 'sentence' })).toBeNull();
    expect(parseErrorEnvelope({ error: { code: 'made_up', message: 'x', correlation_id: 'y', retryable: true } })).toBeNull();
    expect(parseErrorEnvelope(null)).toBeNull();
  });

  it('survives two bundled copies of the class: it is branded, not instanceof-checked', () => {
    class Impostor extends Error { readonly platformError = true; }
    expect(isPlatformError(new Impostor('x'))).toBe(true);
    expect(isPlatformError(new Error('x'))).toBe(false);
  });
});

describe('headers', () => {
  it('looks headers up case-insensitively', () => {
    expect(header({ 'X-Correlation-Id': 'abc' }, HEADERS.correlationId)).toBe('abc');
    expect(header({ 'x-a': ['first', 'second'] }, 'X-A')).toBe('first');
  });
  it('mints a correlation id for a missing or hostile one', () => {
    expect(resolveCorrelationId(undefined, ids)).toMatch(/^corr_/);
    expect(resolveCorrelationId('a b', ids)).toMatch(/^corr_/);
    expect(resolveCorrelationId('x'.repeat(200), ids)).toMatch(/^corr_/);
    expect(resolveCorrelationId('client-chosen-1', ids)).toBe('client-chosen-1');
  });
  it('idempotency keys are 16–128 safe characters', () => {
    expect(isIdempotencyKey('a'.repeat(15))).toBe(false);
    expect(isIdempotencyKey('a'.repeat(16))).toBe(true);
    expect(isIdempotencyKey('has space in it, not ok')).toBe(false);
  });
});

describe('idempotency', () => {
  const setup = () => {
    const c = fixedClock('2026-10-04T12:00:00Z');
    const store = new MemoryIdempotencyStore();
    const h = harness([]);
    const ctx = (tenant: string, person: string, key = 'key-0000000000000001') => h.context(tenant, person, { key });
    return { c, store, ctx };
  };

  it('runs once and replays the stored result for the same key and body', async () => {
    const { c, store, ctx } = setup();
    let runs = 0;
    const fn = async () => ({ n: ++runs });
    const first = await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'task.create', { title: 'x' }, fn);
    const second = await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'task.create', { title: 'x' }, fn);
    expect(runs).toBe(1);
    expect(first).toEqual({ value: { n: 1 }, replayed: false });
    expect(second).toEqual({ value: { n: 1 }, replayed: true });
  });

  it('treats key order in the body as the same request', async () => {
    const { c, store, ctx } = setup();
    let runs = 0;
    const fn = async () => ++runs;
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', { a: 1, b: { c: 2, d: 3 } }, fn);
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', { b: { d: 3, c: 2 }, a: 1 }, fn);
    expect(runs).toBe(1);
  });

  it('the same key with a different body is a conflict, not a replay', async () => {
    const { c, store, ctx } = setup();
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', { a: 1 }, async () => 1);
    await expect(withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', { a: 2 }, async () => 2)).rejects.toMatchObject({ code: 'idempotency_key_reused', status: 422 });
  });

  it('is scoped by tenant, actor and command — a key is never a way to read someone else\'s response', async () => {
    const { c, store, ctx } = setup();
    let runs = 0;
    const fn = async () => ++runs;
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', { a: 1 }, fn);
    await withIdempotency(store, { clock: c }, ctx(TENANT_B, 'p'), 'x.y', { a: 1 }, fn);
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'q'), 'x.y', { a: 1 }, fn);
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.z', { a: 1 }, fn);
    expect(runs).toBe(4);
  });

  it('a second attempt while the first runs gets in_progress; a lapsed lease is taken over', async () => {
    const { c, store, ctx } = setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', {}, async () => {
      await gate;
      return 1;
    });
    await Promise.resolve();
    await expect(withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', {}, async () => 2)).rejects.toMatchObject({ code: 'idempotency_in_progress', retryAfterSeconds: 60 });
    c.advance(IDEMPOTENCY_LEASE_MS + 1);
    const takeover = await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', {}, async () => 3);
    expect(takeover.value).toBe(3);
    release();
    await first;
  });

  it('stores deterministic refusals and replays them; releases the key on a failure that may differ next time', async () => {
    const { c, store, ctx } = setup();
    let runs = 0;
    const refuse = async () => {
      runs++;
      throw new PlatformError('validation_failed', 'Bad.');
    };
    for (let i = 0; i < 2; i++) await expect(withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p', 'key-validation-0001'), 'x.y', {}, refuse)).rejects.toMatchObject({ code: 'validation_failed' });
    expect(runs).toBe(1);

    let flaky = 0;
    const transient = async () => {
      flaky++;
      if (flaky === 1) throw new PlatformError('unavailable', 'Try later.');
      return 'ok';
    };
    await expect(withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p', 'key-transient-0001'), 'x.y', {}, transient)).rejects.toMatchObject({ code: 'unavailable' });
    expect((await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p', 'key-transient-0001'), 'x.y', {}, transient)).value).toBe('ok');
    let unknown = 0;
    await expect(withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p', 'key-crash-000000001'), 'x.y', {}, async () => { unknown++; throw new Error('boom'); })).rejects.toBeTruthy();
    await expect(withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p', 'key-crash-000000001'), 'x.y', {}, async () => { unknown++; throw new Error('boom'); })).rejects.toBeTruthy();
    expect(unknown).toBe(2);
  });

  it('refuses a command with no key', async () => {
    const { c, store } = setup();
    const h = harness([]);
    await expect(withIdempotency(store, { clock: c }, h.context(TENANT_A, 'p'), 'x.y', {}, async () => 1)).rejects.toMatchObject({ code: 'invalid_request' });
  });

  it('expires after its TTL', async () => {
    const { c, store, ctx } = setup();
    let runs = 0;
    const fn = async () => ++runs;
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', {}, fn);
    c.advance(25 * 60 * 60 * 1000);
    await withIdempotency(store, { clock: c }, ctx(TENANT_A, 'p'), 'x.y', {}, fn);
    expect(runs).toBe(2);
  });
});

describe('pagination', () => {
  const ring = { currentKid: 'k1', keys: { k1: utf8('cursor-secret-one-0000000000000000'), k0: utf8('retired-cursor-secret-000000000000') } };
  const codec = () => new CursorCodec(ring, clock);
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: `r${String(i).padStart(2, '0')}`, at: 100 - Math.floor(i / 3) }));
  const deps = (tenantId = TENANT_A, query: unknown = { status: 'open' }) => ({ codec: codec(), tenantId, query });

  it('walks every row exactly once, in a stable order, with ties broken by id', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Page<(typeof rows)[number]> = await paginate(rows, (r) => r.at, { limit: 5, cursor }, deps());
      seen.push(...page.items.map((r) => r.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(5);
    expect(seen).toHaveLength(23);
    expect(new Set(seen).size).toBe(23);
  });

  it('does not skip or repeat rows when one is inserted behind the cursor', async () => {
    const first = await paginate(rows, (r) => r.at, { limit: 5 }, deps());
    const withNew = [...rows, { id: 'r99', at: -1 }];
    const second = await paginate(withNew, (r) => r.at, { limit: 5, cursor: first.nextCursor }, deps());
    expect(second.items.some((r) => first.items.some((f) => f.id === r.id))).toBe(false);
    const undisturbed = await paginate(rows, (r) => r.at, { limit: 5, cursor: first.nextCursor }, deps());
    expect(second.items.map((r) => r.id)).toEqual(undisturbed.items.map((r) => r.id));
  });

  it('refuses a cursor from another tenant, for another query, tampered, expired, or unsigned', async () => {
    const page = await paginate(rows, (r) => r.at, { limit: 5 }, deps());
    const cursor = page.nextCursor!;
    const refuse = (d: ReturnType<typeof deps>, c: string) => expect(paginate(rows, (r) => r.at, { limit: 5, cursor: c }, d)).rejects.toMatchObject({ code: 'invalid_cursor' });
    await refuse(deps(TENANT_B), cursor);
    await refuse(deps(TENANT_A, { status: 'closed' }), cursor);
    const [kid, body, sig] = cursor.split('.');
    const forged = toBase64Url(utf8(JSON.stringify({ ...JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/'))), p: { sort: 0, id: 'r00' } })));
    await refuse(deps(), `${kid}.${forged}.${sig}`);
    await refuse(deps(), `${kid}.${body}.${sig.slice(0, -2)}AA`);
    await refuse(deps(), 'not-a-cursor');
    await refuse(deps(), `unknown-kid.${body}.${sig}`);
    clock.advance(16 * 60 * 1000);
    await refuse(deps(), cursor);
    clock.set('2026-10-04T12:00:00Z');
  });

  it('verifies with a retired key until it is removed from the ring', async () => {
    const old = new CursorCodec({ currentKid: 'k0', keys: ring.keys }, clock);
    const cursor = await old.encode(TENANT_A, { status: 'open' }, { sort: 1, id: 'a' });
    expect(await codec().decode(cursor, TENANT_A, { status: 'open' })).toEqual({ sort: 1, id: 'a' });
    const rotated = new CursorCodec({ currentKid: 'k1', keys: { k1: ring.keys.k1 } }, clock);
    await expect(rotated.decode(cursor, TENANT_A, { status: 'open' })).rejects.toMatchObject({ code: 'invalid_cursor' });
  });

  it('clamps and validates limits', () => {
    expect(clampLimit(undefined)).toBe(50);
    expect(clampLimit('10')).toBe(10);
    expect(clampLimit(10_000)).toBe(MAX_PAGE_SIZE);
    for (const bad of [0, -1, 1.5, 'abc', NaN]) expect(() => clampLimit(bad)).toThrow(PlatformError);
  });

  it('the last page has no cursor', async () => {
    const page = await paginate(rows, (r) => r.at, { limit: 100 }, deps());
    expect(page.nextCursor).toBeNull();
    expect(page.items).toHaveLength(23);
  });
});

describe('versioning', () => {
  const NOW = Date.parse('2026-10-04T12:00:00Z');
  const registry: ApiMajor[] = [
    { major: 3, status: 'current' },
    { major: 2, status: 'deprecated', deprecatedAt: '2026-04-15', sunsetAt: '2027-04-15', guide: 'docs/platform/GATEWAY-STANDARDS.md' },
    { major: 1, status: 'sunset', sunsetAt: '2025-12-01' },
  ];

  it('reads the major from the path, and only from the front of it', () => {
    expect(majorOf('/v1/tasks')).toBe(1);
    expect(majorOf('/v12')).toBe(12);
    for (const bad of ['/tasks/v1', '/v/tasks', '/v1x/tasks', 'v1/tasks', '/V1/tasks', '']) expect(majorOf(bad), bad).toBeNull();
  });

  it('serves the current major with no deprecation headers', () => {
    expect(negotiateMajor('/v3/tasks', registry, NOW)).toEqual({ major: registry[0], headers: {} });
  });

  it('announces deprecation on every response, with the sunset date', () => {
    const n = negotiateMajor('/v2/tasks', registry, NOW);
    expect(n.headers[HEADERS.deprecation]).toBe('2026-04-15');
    expect(n.headers[HEADERS.sunset]).toContain('2027');
  });

  it('refuses a retired, unknown or unversioned request, naming where to go', () => {
    for (const p of ['/v1/tasks', '/v9/tasks', '/tasks']) expect(() => negotiateMajor(p, registry, NOW), p).toThrow(PlatformError);
    expect(() => negotiateMajor('/v1/tasks', registry, NOW)).toThrow(/v3/);
    // A deprecated major stops working on its sunset date without anybody editing the registry.
    expect(() => negotiateMajor('/v2/tasks', registry, Date.parse('2027-04-15T00:00:00Z'))).toThrow(/retired/);
  });

  it('the shipped registry is itself valid, and a short notice is a problem — shorter still allowed first-party only', () => {
    expect(registryProblems(API_MAJORS)).toEqual([]);
    const short = { major: 1, status: 'deprecated' as const, deprecatedAt: '2026-09-01', sunsetAt: '2026-12-01' };
    expect(registryProblems([{ major: 2, status: 'current' }, short])).toEqual([expect.stringContaining('365 days')]);
    expect(registryProblems([{ major: 2, status: 'current' }, { ...short, firstPartyOnly: true }])).toEqual([]);
    expect(registryProblems([{ major: 2, status: 'current' }, { ...short, firstPartyOnly: true, sunsetAt: '2026-10-01' }])).toEqual([expect.stringContaining('90 days')]);
    expect(registryProblems([])).toContain('exactly one major must be current');
    expect(registryProblems([{ major: 1, status: 'current' }, { major: 1, status: 'supported' }])).toContain('v1: listed twice');
  });
});

describe('service authentication', () => {
  const ring = { currentKid: 'k2', keys: { k2: utf8('service-secret-two-0000000000000000'), k1: utf8('service-secret-one-0000000000000000') } };
  const mint = (over: Partial<Parameters<typeof signServiceToken>[1]> = {}) =>
    signServiceToken(ring, { iss: 'gateway', sub: 'worker', aud: 'search', ten: TENANT_A, ...over }, { clock, ids });
  const verify = (t: string, e: Parameters<typeof verifyServiceToken>[2] = { audience: 'search', tenantId: TENANT_A }, replay?: MemoryReplayGuard) =>
    verifyServiceToken(ring, t, e, { clock, replay });

  it('accepts a token for its audience and tenant', async () => {
    expect(await verify(await mint())).toMatchObject({ sub: 'worker', ten: TENANT_A });
  });

  it('refuses another audience, another tenant, an unbound token, a tampered one, and an expired one', async () => {
    const t = await mint();
    await expect(verify(t, { audience: 'files', tenantId: TENANT_A })).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(verify(t, { audience: 'search', tenantId: TENANT_B })).rejects.toMatchObject({ code: 'tenant_mismatch' });
    await expect(verify(await mint({ ten: undefined }))).rejects.toMatchObject({ code: 'tenant_unresolved' });
    const [h, b, s] = t.split('.');
    const swapped = toBase64Url(utf8(JSON.stringify({ ...JSON.parse(atob(b.replace(/-/g, '+').replace(/_/g, '/'))), ten: TENANT_B })));
    await expect(verify(`${h}.${swapped}.${s}`, { audience: 'search', tenantId: TENANT_B })).rejects.toMatchObject({ code: 'unauthenticated' });
    clock.advance(61_000);
    await expect(verify(t)).rejects.toMatchObject({ code: 'unauthenticated' });
    clock.set('2026-10-04T12:00:00Z');
  });

  it('ignores the algorithm the token claims — alg:none and algorithm confusion have nothing to negotiate', async () => {
    const claims = toBase64Url(utf8(JSON.stringify({ iss: 'x', sub: 'x', aud: 'search', ten: TENANT_A, scope: [], iat: 1_790_000_000, exp: 1_790_000_060, jti: 'j' })));
    for (const alg of ['none', 'RS256', 'HS512']) {
      const head = toBase64Url(utf8(JSON.stringify({ alg, kid: 'k2' })));
      await expect(verify(`${head}.${claims}.`)).rejects.toMatchObject({ code: 'unauthenticated' });
    }
  });

  it('rotates: a token signed by a retired key verifies until the key is removed', async () => {
    const old = await signServiceToken({ currentKid: 'k1', keys: ring.keys }, { iss: 'g', sub: 'w', aud: 'search', ten: TENANT_A }, { clock, ids });
    await expect(verify(old)).resolves.toBeTruthy();
    await expect(verifyServiceToken({ currentKid: 'k2', keys: { k2: ring.keys.k2 } }, old, { audience: 'search', tenantId: TENANT_A }, { clock })).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('caps lifetime at five minutes, at signing and at verifying', async () => {
    await expect(mint({ ttlSeconds: 301 })).rejects.toThrow(/between 1 and 300/);
    await expect(mint({ ttlSeconds: 0 })).rejects.toThrow();
    expect(await verify(await mint({ ttlSeconds: 300 }))).toBeTruthy();
  });

  it('a platform-level token reaches tenant data only with the cross-tenant scope on the ops audience', async () => {
    const ops = await mint({ ten: undefined, aud: PLATFORM_OPS_AUDIENCE, scope: [CROSS_TENANT_SCOPE] });
    expect(await verify(ops, { audience: PLATFORM_OPS_AUDIENCE, tenantId: TENANT_B })).toBeTruthy();
    const wrongAud = await mint({ ten: undefined, aud: 'search', scope: [CROSS_TENANT_SCOPE] });
    await expect(verify(wrongAud, { audience: 'search', tenantId: TENANT_B })).rejects.toMatchObject({ code: 'tenant_unresolved' });
    const noScope = await mint({ ten: undefined, aud: PLATFORM_OPS_AUDIENCE });
    await expect(verify(noScope, { audience: PLATFORM_OPS_AUDIENCE, tenantId: TENANT_B })).rejects.toMatchObject({ code: 'tenant_unresolved' });
  });

  it('a replayed jti is refused when a guard is supplied', async () => {
    const guard = new MemoryReplayGuard(clock);
    const t = await mint();
    await expect(verify(t, undefined, guard)).resolves.toBeTruthy();
    await expect(verify(t, undefined, guard)).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('rejects garbage without throwing anything but unauthenticated', async () => {
    for (const junk of ['', 'a.b', 'a.b.c', '....', 'e30.e30.e30']) await expect(verify(junk)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});
