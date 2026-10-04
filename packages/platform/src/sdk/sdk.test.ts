import { describe, expect, it } from 'vitest';
import { sequenceRng, sequentialIds } from '../kernel/clock.ts';
import { PlatformError, errorResponse } from '../gateway/errors.ts';
import { createClient, SemesterApiError, type FetchLike, type HttpResponse } from './client.ts';

const res = (status: number, body: unknown, headers: Record<string, string> = {}): HttpResponse => ({
  status,
  headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  json: async () => body,
});
const err = (e: PlatformError, headers: Record<string, string> = {}) => {
  const r = errorResponse(e, 'corr-server-0001');
  return res(r.status, r.body, { ...r.headers, ...headers });
};

function make(script: (HttpResponse | Error)[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const sleeps: number[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, ...init });
    const next = script.shift();
    if (!next) throw new Error('script exhausted');
    if (next instanceof Error) throw next;
    return next;
  };
  const client = createClient({
    baseUrl: 'https://api.test/v1', fetch, ids: sequentialIds(), rng: sequenceRng([0.5]), sleep: async (ms) => void sleeps.push(ms), token: async () => 'tok',
  });
  return { client, calls, sleeps };
}

describe('SDK client', () => {
  it('sends correlation id and bearer — and never a tenant', async () => {
    const { client, calls } = make([res(200, { ok: true })]);
    await client.get('/tasks');
    const h = calls[0].headers;
    expect(h['x-correlation-id']).toMatch(/^corr_/);
    expect(h['semester-version']).toBeUndefined(); // the major is in the path
    expect(h.authorization).toBe('Bearer tok');
    expect(Object.keys(h).map((k) => k.toLowerCase())).not.toContain('x-tenant-id');
    expect(h['idempotency-key']).toBeUndefined();
  });

  it('mutating calls carry an idempotency key; reads do not', async () => {
    const { client, calls } = make([res(200, {}), res(200, {}), res(200, {}), res(200, {}), res(200, {})]);
    await client.post('/tasks', { a: 1 });
    await client.put('/tasks/1', {});
    await client.patch('/tasks/1', {});
    await client.delete('/tasks/1');
    await client.get('/tasks');
    expect(calls.map((c) => Boolean(c.headers['idempotency-key']))).toEqual([true, true, true, true, false]);
    expect(new Set(calls.slice(0, 4).map((c) => c.headers['idempotency-key'])).size).toBe(4);
  });

  it('retries a 503 with the SAME key and the SAME correlation id, honouring Retry-After', async () => {
    const { client, calls, sleeps } = make([err(new PlatformError('unavailable', 'later'), { 'retry-after': '3' }), res(200, { ok: 1 })]);
    expect(await client.post('/tasks', { a: 1 })).toEqual({ ok: 1 });
    expect(calls).toHaveLength(2);
    expect(calls[1].headers['idempotency-key']).toBe(calls[0].headers['idempotency-key']);
    expect(calls[1].headers['x-correlation-id']).toBe(calls[0].headers['x-correlation-id']);
    expect(sleeps).toEqual([3000]);
  });

  it('does NOT retry a non-retryable error, and exposes the server\'s correlation id', async () => {
    const { client, calls } = make([err(new PlatformError('forbidden', 'No.'))]);
    const e = (await client.post('/tasks', {}).catch((x: unknown) => x)) as SemesterApiError;
    expect(e).toBeInstanceOf(SemesterApiError);
    expect(e).toMatchObject({ code: 'forbidden', status: 403, retryable: false, correlationId: 'corr-server-0001', message: 'No.' });
    expect(calls).toHaveLength(1);
  });

  it('does not retry an unknown-outcome 502 — the caller must reconcile', async () => {
    const { client, calls } = make([err(new PlatformError('outcome_unknown', 'Check before retrying.'))]);
    await expect(client.post('/x', {})).rejects.toMatchObject({ code: 'outcome_unknown', retryable: false });
    expect(calls).toHaveLength(1);
  });

  it('gives up after maxAttempts and surfaces the last error', async () => {
    const { client, calls } = make([1, 2, 3, 4, 5].map(() => err(new PlatformError('rate_limited', 'slow'))));
    await expect(client.get('/x')).rejects.toMatchObject({ code: 'rate_limited', retryable: true });
    expect(calls).toHaveLength(4);
  });

  it('retries a network failure only when it is safe: a read, or a write with a key', async () => {
    const a = make([new Error('socket'), res(200, { ok: 1 })]);
    expect(await a.client.get('/x')).toEqual({ ok: 1 });
    const b = make([new Error('socket'), res(200, { ok: 2 })]);
    expect(await b.client.post('/x', {})).toEqual({ ok: 2 });
    expect(b.calls[1].headers['idempotency-key']).toBe(b.calls[0].headers['idempotency-key']);
    const c = make([1, 2, 3, 4].map(() => new Error('down')));
    await expect(c.client.get('/x')).rejects.toMatchObject({ code: 'network' });
  });

  it('a caller-supplied key and correlation id are used verbatim (offline queues)', async () => {
    const { client, calls } = make([res(200, {})]);
    await client.post('/x', {}, { idempotencyKey: 'queued-offline-0000001', correlationId: 'corr-offline-0001' });
    expect(calls[0].headers['idempotency-key']).toBe('queued-offline-0000001');
    expect(calls[0].headers['x-correlation-id']).toBe('corr-offline-0001');
  });

  it('a non-envelope error body is a malformed_response, not a guess', async () => {
    const { client } = make([res(500, { error: 'sentence' })]);
    await expect(client.get('/x')).rejects.toMatchObject({ code: 'malformed_response', status: 500 });
  });

  it('encodes and drops undefined query values', async () => {
    const { client, calls } = make([res(200, {})]);
    await client.get('/x', { query: { q: 'a b&c', n: 2, skip: undefined } });
    expect(calls[0].url).toBe('https://api.test/v1/x?q=a%20b%26c&n=2');
  });

  it('iterates every page through the cursor', async () => {
    const { client, calls } = make([res(200, { items: [1, 2], nextCursor: 'c1' }), res(200, { items: [3], nextCursor: 'c2' }), res(200, { items: [4], nextCursor: null })]);
    const out: number[] = [];
    for await (const n of client.pages<number>('/tasks', { limit: 2 })) out.push(n);
    expect(out).toEqual([1, 2, 3, 4]);
    expect(calls.map((c) => c.url)).toEqual(['https://api.test/v1/tasks?limit=2', 'https://api.test/v1/tasks?limit=2&cursor=c1', 'https://api.test/v1/tasks?limit=2&cursor=c2']);
  });
});
