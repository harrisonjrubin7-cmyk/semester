import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { serveProductivityRequest } from '../../api/productivity/[...path].ts';
import { MAX_BODY_BYTES } from './http.ts';

function request(url: string, body = '', method = body ? 'POST' : 'GET'): IncomingMessage {
  return {
    url,
    method,
    headers: { authorization: 'Bearer test', 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); },
  } as IncomingMessage;
}

function response() {
  const state = { status: 0, headers: {} as Record<string, string>, body: Buffer.alloc(0) };
  const res = {
    writeHead: (status: number, headers: Record<string, string>) => { state.status = status; state.headers = headers; return res; },
    end: (body?: Uint8Array | string) => { state.body = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body ?? []); return res; },
  } as unknown as ServerResponse;
  return { res, state };
}

describe('Vercel productivity transport', () => {
  it('strips only the deployment prefix and preserves query, method and headers', async () => {
    const seen: Request[] = [];
    const { res, state } = response();
    await serveProductivityRequest(request('/api/productivity/v1/tasks?limit=5'), res, async (input) => {
      seen.push(input);
      return Response.json({ ok: true }, { status: 201, headers: { 'X-Test': 'yes' } });
    });
    expect(new URL(seen[0]!.url).pathname + new URL(seen[0]!.url).search).toBe('/v1/tasks?limit=5');
    expect(seen[0]!.headers.get('authorization')).toBe('Bearer test');
    expect(state.status).toBe(201);
    expect(state.headers['x-test']).toBe('yes');
  });

  it('forwards a bounded JSON body without changing it', async () => {
    const handle = vi.fn(async (input: Request) => Response.json({ body: await input.json() }));
    const { res, state } = response();
    await serveProductivityRequest(request('/api/productivity/v1/productivity/commands', '{"commands":[]}'), res, handle);
    expect(JSON.parse(state.body.toString())).toEqual({ body: { commands: [] } });
  });

  it('rejects an oversized body before building a request, in the error envelope\'s shape', async () => {
    const handle = vi.fn();
    const { res, state } = response();
    await serveProductivityRequest(request('/api/productivity/v1/productivity/commands', 'x'.repeat(MAX_BODY_BYTES + 1)), res, handle);
    expect(state.status).toBe(413);
    expect(JSON.parse(state.body.toString()).error).toMatchObject({ code: 'payload_too_large', retryable: false });
    expect(handle).not.toHaveBeenCalled();
  });
});
