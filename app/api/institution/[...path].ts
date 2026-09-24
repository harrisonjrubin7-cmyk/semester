import type { IncomingMessage, ServerResponse } from 'node:http';
import { MAX_BODY } from '../../server/institution/gateway.ts';
import { createProductionInstitutionRuntime } from '../../server/institution/runtime.ts';

let runtime: ReturnType<typeof createProductionInstitutionRuntime> | null = null;

async function bodyOf(req: IncomingMessage): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) return null;
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

export async function serveInstitutionRequest(
  req: IncomingMessage,
  res: ServerResponse,
  handle: (request: Request) => Promise<Response>,
): Promise<void> {
  const body = await bodyOf(req);
  if (!body) {
    res.writeHead(413, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Request is too large.' }));
    return;
  }
  const method = req.method || 'GET';
  const incoming = new URL(req.url || '/', 'http://institution.internal');
  const path = incoming.pathname.replace(/^\/api\/institution/, '') || '/';
  const request = new Request(`http://institution.internal${path}${incoming.search}`, {
    method,
    headers: requestHeaders(req),
    ...(['GET', 'HEAD'].includes(method) ? {} : { body: new Uint8Array(body) }),
  });
  const response = await handle(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(new Uint8Array(await response.arrayBuffer()));
}

export default async function institution(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    runtime ??= createProductionInstitutionRuntime(process.env);
    await serveInstitutionRequest(req, res, runtime);
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'The university service is unavailable. Please try again later.' }));
  }
}
