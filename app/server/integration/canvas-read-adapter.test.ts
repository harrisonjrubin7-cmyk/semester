import { describe, expect, it, vi } from 'vitest';
import { contractFailures, runContract } from '../../src/lib/integration/contract-harness.ts';
import type { ProviderClient } from '../../src/lib/integration/provider-client.ts';
import { canvasOrigin, createCanvasReadAdapter } from '../../../packages/platform/src/index.ts';

const client: ProviderClient = {
  call: (fn) => fn({ accessToken: null, secret: 'canvas-test-token-do-not-log' }),
};

const response = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json', ...headers },
});

describe('Canvas read adapter', () => {
  it('accepts only a bare hosted-Instructure HTTPS origin', () => {
    expect(canvasOrigin('https://northstar.instructure.com')).toBe('https://northstar.instructure.com');
    for (const value of [
      'http://northstar.instructure.com', 'https://northstar.instructure.com/path',
      'https://northstar.instructure.com?x=1', 'https://northstar.instructure.com.evil.test',
      'https://instructure.com', 'https://-bad.instructure.com',
      'https://127.0.0.1', 'https://user:pass@northstar.instructure.com',
    ]) expect(() => canvasOrigin(value)).toThrow(/origin/);
  });

  it('reads one bounded course page through the guarded client and maps only declared fields', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      response([{ id: 7, name: ' Economics ', course_code: 'ECON-101', sis_course_id: 'secret' }]));
    const adapter = createCanvasReadAdapter(fetcher as typeof fetch);
    const batch = await adapter.pull({
      connectionPublicId: 'conn-1', tenantId: 'northstar', providerBaseUrl: 'https://northstar.instructure.com',
      cursor: {}, trigger: 'scheduled',
    }, client);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://northstar.instructure.com/api/v1/courses?enrollment_state=active&per_page=100');
    expect(init).toMatchObject({ method: 'GET', redirect: 'error', headers: { authorization: 'Bearer canvas-test-token-do-not-log' } });
    expect(batch.records).toEqual([{ entityType: 'course', id: '7', fields: { id: '7', name: ' Economics ', course_code: 'ECON-101' } }]);
    expect(JSON.stringify(batch)).not.toContain('sis_course_id');
    expect(JSON.stringify(batch)).not.toContain('canvas-test-token');
  });

  it('follows only an opaque next link on the same origin and course path', async () => {
    const next = 'https://northstar.instructure.com/api/v1/courses?opaque=two';
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      response([{ id: 1, name: 'A' }], { link: `<${next}>; rel="next"` }));
    const adapter = createCanvasReadAdapter(fetcher as typeof fetch);
    const first = await adapter.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com', cursor: {}, trigger: 'scheduled' }, client);
    expect(first.cursorAfter).toEqual({ next });
    await adapter.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com', cursor: first.cursorAfter, trigger: 'scheduled' }, client);
    expect(String(fetcher.mock.calls[1][0])).toBe(next);
    for (const bad of ['https://evil.test/api/v1/courses', 'https://northstar.instructure.com/api/v1/users']) {
      await expect(adapter.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com', cursor: { next: bad }, trigger: 'scheduled' }, client)).rejects.toThrow(/pagination/);
    }
    await expect(adapter.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com',
      cursor: { next: 'https://northstar.instructure.com/api/v1/courses?access_token=nope' }, trigger: 'scheduled' }, client))
      .rejects.toThrow(/credential-shaped/);
  });

  it('classifies provider status without reading its body and rejects non-JSON or oversized content', async () => {
    const limited = createCanvasReadAdapter(vi.fn(async () => new Response('busy', { status: 429, headers: { 'retry-after': '60' } })) as typeof fetch);
    await expect(limited.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com', cursor: {}, trigger: 'scheduled' }, client))
      .rejects.toMatchObject({ status: 429, retryAfterMs: 60_000 });
    const dated = createCanvasReadAdapter(
      vi.fn(async () => new Response('busy', { status: 503, headers: { 'retry-after': 'Thu, 09 Oct 2026 18:01:00 GMT' } })) as typeof fetch,
      { now: () => new Date('2026-10-09T18:00:00Z') },
    );
    await expect(dated.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com', cursor: {}, trigger: 'scheduled' }, client))
      .rejects.toMatchObject({ status: 503, retryAfterMs: 60_000 });
    const html = createCanvasReadAdapter(vi.fn(async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })) as typeof fetch);
    await expect(html.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com', cursor: {}, trigger: 'scheduled' }, client)).rejects.toThrow(/non-JSON/);
    const huge = createCanvasReadAdapter(vi.fn(async () => response([], { 'content-length': String(2 * 1024 * 1024 + 1) })) as typeof fetch);
    await expect(huge.pull({ connectionPublicId: 'c', tenantId: 't', providerBaseUrl: 'https://northstar.instructure.com', cursor: {}, trigger: 'scheduled' }, client)).rejects.toThrow(/size limit/);
  });

  it('passes the live adapter contract with two non-overlapping provider pages', async () => {
    const pages = [
      response([{ id: 1, name: 'One' }], { link: '<https://contract.instructure.com/api/v1/courses?page=2>; rel="next"' }),
      response([{ id: 2, name: 'Two' }]),
    ];
    const adapter = createCanvasReadAdapter(vi.fn(async () => pages.shift() ?? response([])) as typeof fetch);
    expect(contractFailures(await runContract(adapter, { live: true }))).toEqual([]);
  });
});
