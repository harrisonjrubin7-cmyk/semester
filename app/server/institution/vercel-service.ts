import { createServer } from 'node:http';
import institution from '../../api/institution/[...path].ts';
import productivity from '../../api/productivity/[...path].ts';
import { createVercelApiRouter } from './vercel-router.ts';

const routeVercelApiRequest = createVercelApiRouter({ institution, productivity });

const server = createServer((request, response) => {
  void routeVercelApiRequest(request, response).catch(() => {
    if (response.headersSent) {
      response.end();
      return;
    }
    response.writeHead(500, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify({ error: { code: 'internal_error', message: 'API request failed.', retryable: true } }));
  });
});

server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.listen(Number(process.env.PORT ?? 3000));

export default server;
