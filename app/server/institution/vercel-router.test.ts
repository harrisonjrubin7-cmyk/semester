import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createVercelApiRouter } from './vercel-router.ts';

function request(url: string): IncomingMessage {
  return {
    url,
    method: 'GET',
    headers: {},
    async *[Symbol.asyncIterator]() {},
  } as IncomingMessage;
}

function response() {
  const state = { status: 0, headers: {} as Record<string, string>, body: Buffer.alloc(0) };
  const res = {
    writeHead: (status: number, headers: Record<string, string>) => {
      state.status = status;
      state.headers = headers;
      return res;
    },
    end: (body?: Uint8Array | string) => {
      state.body = typeof body === 'string' ? Buffer.from(body) : Buffer.from(body ?? []);
      return res;
    },
  } as unknown as ServerResponse;
  return { res, state };
}

describe('Vercel API service router', () => {
  it('routes both prefixes without changing the original request path', async () => {
    const institution = vi.fn(async (_request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(204);
      response.end();
    });
    const productivity = vi.fn(async (_request: IncomingMessage, response: ServerResponse) => {
      response.writeHead(204);
      response.end();
    });
    const route = createVercelApiRouter({ institution, productivity });

    const institutionRequest = request('/api/institution/health?probe=ready');
    await route(institutionRequest, response().res);
    expect(institution).toHaveBeenCalledWith(institutionRequest, expect.anything());
    expect(institutionRequest.url).toBe('/api/institution/health?probe=ready');

    const productivityRequest = request('/api/productivity/v1/tasks?limit=5');
    await route(productivityRequest, response().res);
    expect(productivity).toHaveBeenCalledWith(productivityRequest, expect.anything());
    expect(productivityRequest.url).toBe('/api/productivity/v1/tasks?limit=5');
  });

  it('returns structured JSON rather than falling through to app HTML', async () => {
    const route = createVercelApiRouter({
      institution: vi.fn(),
      productivity: vi.fn(),
    });
    const { res, state } = response();

    await route(request('/api/unknown'), res);

    expect(state.status).toBe(404);
    expect(state.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(state.body.toString()).error).toMatchObject({ code: 'not_found', retryable: false });
    expect(state.body.toString()).not.toContain('<html');
  });

});
