import type { IncomingMessage, ServerResponse } from 'node:http';
import { MAX_BODY_BYTES } from '../../server/productivity/http.ts';
import { createProductionProductivityRuntime, productivityEnabled } from '../../server/productivity/runtime.ts';

let runtime: ReturnType<typeof createProductionProductivityRuntime> | null = null;

async function bodyOf(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
  }
  return headers;
}

export async function serveProductivityRequest(
  req: IncomingMessage,
  res: ServerResponse,
  handle: (request: Request) => Promise<Response>,
): Promise<void> {
  const body = await bodyOf(req);
  if (!body) {
    res.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: { code: 'payload_too_large', message: 'Request is too large.', retryable: false } }));
    return;
  }
  const method = req.method || 'GET';
  const incoming = new URL(req.url || '/', 'http://productivity.internal');
  const path = incoming.pathname.replace(/^\/api\/productivity/, '') || '/';
  const request = new Request(`http://productivity.internal${path}${incoming.search}`, {
    method,
    headers: requestHeaders(req),
    ...(['GET', 'HEAD'].includes(method) ? {} : { body: new Uint8Array(body) }),
  });
  const response = await handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(new Uint8Array(await response.arrayBuffer()));
}

export default async function productivity(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (!productivityEnabled(process.env)) throw new Error('off');
    runtime ??= createProductionProductivityRuntime(process.env);
    await serveProductivityRequest(req, res, runtime);
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: { code: 'unavailable', message: 'Planning sync is unavailable. Please try again later.', retryable: true } }));
  }
}
