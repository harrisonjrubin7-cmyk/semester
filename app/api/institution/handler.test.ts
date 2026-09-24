import { describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { serveInstitutionRequest } from './[...path].ts';
import { MAX_BODY } from '../../server/institution/gateway.ts';

function request(url: string, body = '', method = body ? 'POST' : 'GET'): IncomingMessage {
  return {
    url,
    method,
    headers: { origin: 'https://semester.example', authorization: 'Bearer test', 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); },
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

describe('Vercel institution transport', () => {
  it('strips only the deployment prefix and preserves query, method and headers', async () => {
    const seen: Request[] = [];
    const { res, state } = response();
    await serveInstitutionRequest(request('/api/institution/records?area=courses'), res, async (input) => {
      seen.push(input);
      return Response.json({ ok: true }, { status: 201, headers: { 'X-Test': 'yes' } });
    });
    expect(seen[0].url).toBe('http://institution.internal/records?area=courses');
    expect(seen[0].headers.get('origin')).toBe('https://semester.example');
    expect(state.status).toBe(201);
    expect(state.headers['x-test']).toBe('yes');
    expect(JSON.parse(state.body.toString())).toEqual({ ok: true });
  });

  it('forwards a bounded JSON body without changing it', async () => {
    const handle = vi.fn(async (input: Request) => Response.json({ body: await input.json() }));
    const { res, state } = response();
    await serveInstitutionRequest(request('/api/institution/v1/intelligence/respond', '{"question":"why"}'), res, handle);
    expect(handle).toHaveBeenCalledOnce();
    expect(JSON.parse(state.body.toString())).toEqual({ body: { question: 'why' } });
  });

  it('rejects an oversized body before constructing the gateway request', async () => {
    const handle = vi.fn();
    const { res, state } = response();
    await serveInstitutionRequest(request('/api/institution/actions/prepare', 'x'.repeat(MAX_BODY + 1)), res, handle);
    expect(state.status).toBe(413);
    expect(handle).not.toHaveBeenCalled();
  });
});
