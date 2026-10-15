import type { IncomingMessage, ServerResponse } from 'node:http';

export type VercelApiHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;

export interface VercelApiHandlers {
  institution: VercelApiHandler;
  productivity: VercelApiHandler;
}

function owns(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function createVercelApiRouter(
  handlers: VercelApiHandlers,
): VercelApiHandler {
  return async (request, response) => {
    const path = new URL(request.url || '/', 'http://api.internal').pathname;
    if (owns(path, '/api/institution')) {
      await handlers.institution(request, response);
      return;
    }
    if (owns(path, '/api/productivity')) {
      await handlers.productivity(request, response);
      return;
    }
    response.writeHead(404, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ error: { code: 'not_found', message: 'API route not found.', retryable: false } }));
  };
}
