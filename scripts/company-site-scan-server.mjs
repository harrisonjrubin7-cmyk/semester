import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { readFileSync, statSync, realpathSync, appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = fileURLToPath(new URL('../company-site/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json' };
const receiptPaths = new Set(['/', '/product', '/students', '/personal-academic-os', '/site.css', '/site.js', ...['search', 'today', 'courses', 'calendar', 'path', 'discover'].flatMap(screen => [`/screenshots/${screen}-desktop.jpg`, `/screenshots/${screen}-mobile.jpg`])]);

// Test-only adapter, never deployed. Keep the original production policy and
// intersect it with a complete policy that blocks browser connections, form
// submissions and frames to live services. Copy every other directive so a
// scanner evaluating either policy independently sees the same protections.
export function createCompanySiteScanServer({ root = siteRoot, tls, onResponse } = {}) {
  const directory = realpathSync(root);
  const config = JSON.parse(readFileSync(resolve(directory, 'vercel.json'), 'utf8'));
  const headers = config.headers.flatMap(rule => rule.headers);
  const policies = headers.filter(header => header.key.toLowerCase() === 'content-security-policy');
  if (policies.length !== 1 || typeof policies[0].value !== 'string') throw new Error('One production CSP is required');
  const productionPolicy = policies[0].value;
  if (productionPolicy.includes(',')) throw new Error('One production CSP is required, not a policy list');
  const boundaries = new Map([['connect-src', "'self'"], ['form-action', "'self'"], ['frame-src', "'none'"]]);
  const seen = new Set();
  const isolatedPolicy = productionPolicy.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const [name] = part.split(/\s+/);
    if (!/^[a-z][a-z-]*$/.test(name) || seen.has(name)) throw new Error('Ambiguous production CSP directive');
    seen.add(name);
    return boundaries.has(name) ? `${name} ${boundaries.get(name)}` : part;
  }).join('; ');
  if (!['default-src', ...boundaries.keys()].every(name => seen.has(name))) throw new Error('Incomplete production CSP isolation boundary');
  const sitemap = readFileSync(resolve(directory, 'sitemap.xml'), 'utf8');
  const pagePaths = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => {
    const url = new URL(match[1]);
    if (url.origin !== 'https://www.semester.website' || url.search || url.hash) throw new Error('Invalid company page inventory');
    return decodeURIComponent(url.pathname);
  }));
  if (!pagePaths.has('/')) throw new Error('The company page inventory must include its root');
  const indexFile = realpathSync(resolve(directory, 'index.html'));
  if (!indexFile.startsWith(directory + sep) || !statSync(indexFile).isFile()) throw new Error('The company page must stay within the static root');
  const handler = (request, response) => {
    for (const header of headers) response.setHeader(header.key, header.value);
    response.setHeader('Content-Security-Policy', [productionPolicy, isolatedPolicy]);
    let path;
    const send = (status, type, body) => {
      if (onResponse && receiptPaths.has(path)) {
        const receipt = { method: request.method, path, status, contentType: type, sha256: createHash('sha256').update(request.method === 'HEAD' ? '' : body).digest('hex') };
        response.once('finish', () => onResponse(receipt));
      }
      response.writeHead(status, { 'Content-Type': type });
      response.end(request.method === 'HEAD' ? undefined : body);
    };
    try { path = decodeURIComponent(request.url.split('?')[0]); }
    catch { return send(400, 'text/plain', 'Invalid path'); }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      request.resume();
      return send(405, 'text/plain', 'Static frontend only');
    }
    if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part.startsWith('.'))) {
      return send(400, 'text/plain', 'Invalid path');
    }
    if (path === '/vercel.json') return send(404, 'text/plain', 'Not found');
    const file = pagePaths.has(path) ? indexFile : resolve(directory, `.${path}`);
    if (!file.startsWith(directory + sep) && file !== directory) return send(400, 'text/plain', 'Invalid path');
    try {
      if (!statSync(file).isFile() || !realpathSync(file).startsWith(directory + sep)) return send(404, 'text/plain', 'Not found');
    } catch { return send(404, 'text/plain', 'Not found'); }
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
  const evidencePath = process.env.COMPANY_SCAN_EVIDENCE;
  const checkoutSha = process.env.COMMIT_SHA;
  if (evidencePath && !/^[a-f\d]{40}$/i.test(checkoutSha ?? '')) throw new Error('Company response evidence requires its checkout SHA');
  const onResponse = evidencePath ? record => appendFileSync(evidencePath, `${JSON.stringify({ checkoutSha, ...record })}\n`) : undefined;
  createCompanySiteScanServer({ tls, onResponse }).listen(4186, '127.0.0.1', () => {
    console.log('StackHawk | Company frontend ready at https://localhost:4186; live form connections blocked');
  });
}
