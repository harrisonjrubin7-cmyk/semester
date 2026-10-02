import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, statSync, realpathSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = fileURLToPath(new URL('../company-site/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json' };

// Test-only adapter, never deployed. Preserve the published header policy while
// adding an independent policy that prevents scanner forms contacting live APIs.
export function createCompanySiteScanServer({ root = siteRoot, tls } = {}) {
  const directory = realpathSync(root);
  const config = JSON.parse(readFileSync(resolve(directory, 'vercel.json'), 'utf8'));
  const headers = config.headers.flatMap(rule => rule.headers);
  const handler = (request, response) => {
    for (const header of headers) response.setHeader(header.key, header.value);
    const productionPolicy = response.getHeader('Content-Security-Policy');
    if (!productionPolicy) throw new Error('The company scan must preserve its production CSP');
    response.setHeader('Content-Security-Policy', [productionPolicy, "connect-src 'self'; form-action 'self'; frame-src 'none'"]);
    const send = (status, type, body) => {
      response.writeHead(status, { 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      request.resume();
      return send(405, 'text/plain', 'Static frontend only');
    }
    let path;
    try { path = decodeURIComponent(request.url.split('?')[0]); }
    catch { return send(400, 'text/plain', 'Invalid path'); }
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) {
      return send(400, 'text/plain', 'Invalid path');
    }
    if (path === '/vercel.json') return send(404, 'text/plain', 'Not found');
    let file = resolve(directory, `.${path}`);
    if (!file.startsWith(directory + sep) && file !== directory) return send(400, 'text/plain', 'Invalid path');
    try {
      if (!statSync(file).isFile()) file = resolve(directory, 'index.html');
      else if (!realpathSync(file).startsWith(directory + sep)) return send(404, 'text/plain', 'Not found');
    } catch { file = resolve(directory, 'index.html'); }
    let bytes = readFileSync(file);
    if (extname(file) === '.xml') {
      const origin = `${tls ? 'https' : 'http'}://localhost:${response.socket.localPort}`;
      bytes = Buffer.from(bytes.toString().replaceAll('https://www.semester.website', origin));
    }
    send(200, types[extname(file)] ?? 'application/octet-stream', bytes);
  };
  return tls ? createHttpsServer(tls, handler) : createHttpServer(handler);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.COMPANY_SCAN_KEY || !process.env.COMPANY_SCAN_CERT) throw new Error('An ephemeral scan TLS certificate is required');
  const tls = { key: readFileSync(process.env.COMPANY_SCAN_KEY), cert: readFileSync(process.env.COMPANY_SCAN_CERT) };
  createCompanySiteScanServer({ tls }).listen(4186, '127.0.0.1', () => {
    console.log('StackHawk | Company frontend ready at https://localhost:4186; live form connections blocked');
  });
}
