import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCompanySiteScanServer } from './company-site-scan-server.mjs';
import { evaluate, parseJson, scanId, scannedPaths } from './company-site-scan-report.mjs';

const root = new URL('../', import.meta.url);
const read = path => existsSync(new URL(path, root)) ? readFileSync(new URL(path, root), 'utf8') : '';
const workflow = read('.github/workflows/hawkscan.yml');
const companyJob = workflow.split('\n  company_site:')[1] ?? '';

test('the existing app scan remains intact (control)', () => {
  assert.match(workflow, /working-directory: app/);
  assert.match(workflow, /APP_HOST: http:\/\/localhost:4173/);
  assert.match(workflow, /Run HawkScan/);
});

test('the company scan runs after the app and does not ignore failures', () => {
  assert.match(companyJob, /needs: hawkscan/);
  assert.doesNotMatch(companyJob, /continue-on-error:\s*true/);
  assert.match(companyJob, /secrets\.HAWK_API_KEY/);
});

test('the company scan uses an isolated HTTPS target and its own configuration', () => {
  assert.match(companyJob, /node scripts\/company-site-scan-server\.mjs/);
  assert.match(companyJob, /APP_HOST: https:\/\/localhost:4186/);
  assert.match(companyJob, /configurationFiles: stackhawk-company-site\.yml/);
});

test('the company configuration does not reuse the app environment or suppress findings', () => {
  const config = read('stackhawk-company-site.yml');
  assert.match(config, /env: CompanySiteCI/);
  assert.match(config, /ajax: true/);
  assert.match(config, /failureThreshold: low/);
  assert.doesNotMatch(config, /excludePaths|excludePlugins/);
});

test('the scan target reuses production headers and blocks external submissions', () => {
  const source = read('scripts/company-site-scan-server.mjs');
  assert.match(source, /vercel\.json/);
  assert.match(source, /connect-src 'self'; form-action 'self'; frame-src 'none'/);
  assert.doesNotMatch(source, /unsafe-inline.*replace|delete.*Content-Security-Policy/);
});

const fetchTarget = (server, path, { method = 'GET', ca } = {}) => new Promise((resolve, reject) => {
  const req = (ca ? httpsRequest : request)({ hostname: 'localhost', port: server.address().port, path, method, ca }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) }));
  });
  req.on('error', reject);
  req.end();
});

test('runtime target preserves production headers and byte-exact screenshots', async t => {
  const server = createCompanySiteScanServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const page = await fetchTarget(server, '/product');
  assert.equal(page.status, 200);
  assert.equal(page.bytes.toString(), read('company-site/index.html'));
  const published = JSON.parse(read('company-site/vercel.json')).headers.flatMap(rule => rule.headers);
  for (const header of published) {
    const actual = page.headers[header.key.toLowerCase()];
    if (header.key.toLowerCase() === 'content-security-policy') {
      assert.equal(actual, `${header.value}, connect-src 'self'; form-action 'self'; frame-src 'none'`);
    } else assert.equal(actual, header.value);
  }
  const image = await fetchTarget(server, '/screenshots/today-desktop.jpg');
  assert.equal(image.headers['content-type'], 'image/jpeg');
  assert.deepEqual(image.bytes, readFileSync(new URL('company-site/screenshots/today-desktop.jpg', root)));
  const sitemap = await fetchTarget(server, '/sitemap.xml');
  assert.doesNotMatch(sitemap.bytes.toString(), /https:\/\/www.semester.website/);
  assert.match(sitemap.bytes.toString(), new RegExp(`http://localhost:${server.address().port}/product`));
});

test('runtime target rejects submissions, private files and traversal probes', async t => {
  const server = createCompanySiteScanServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  assert.equal((await fetchTarget(server, '/contact', { method: 'POST' })).status, 405);
  for (const path of ['/../CLAUDE.md', '/%2e%2e/CLAUDE.md', '/.env', '/.git/config', '/%00', '/%5c..', '/%broken']) {
    assert.equal((await fetchTarget(server, path)).status, 400, path);
  }
  assert.equal((await fetchTarget(server, '/vercel.json')).status, 404);
  const head = await fetchTarget(server, '/product', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.bytes.length, 0);
  assert.equal((await fetchTarget(server, '/a-virtual-route')).bytes.toString(), read('company-site/index.html'));
});

test('HTTPS works with the generated certificate trusted explicitly, without disabling verification', async t => {
  const fixture = mkdtempSync(join(tmpdir(), 'semester-scan-tls-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const key = join(fixture, 'key.pem');
  const cert = join(fixture, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
  const ca = readFileSync(cert);
  const server = createCompanySiteScanServer({ tls: { key: readFileSync(key), cert: ca } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const page = await fetchTarget(server, '/students', { ca });
  assert.equal(page.status, 200);
  assert.match(page.headers['content-security-policy'], /upgrade-insecure-requests/);
  await assert.rejects(fetchTarget(server, '/students'), /socket|hang|reset/i);
});

const cleanReport = () => ({ scan: { id: '12345678-1234-1234-1234-123456789abc', host: 'https://localhost:4186', environment: 'CompanySiteCI', status: 'COMPLETED' }, findings: [], errors: [], warnings: [], thresholdResult: 'PASS' });
const coveredUris = ['/', '/product', '/students', '/personal-academic-os', ...['search', 'today', 'courses', 'calendar', 'path', 'discover'].flatMap(screen => [`/screenshots/${screen}-desktop.jpg`, `/screenshots/${screen}-mobile.jpg`])];

test('clean complete scan evidence passes (reporting control)', () => {
  const result = evaluate(cleanReport(), { urls: coveredUris }, coveredUris);
  assert.deepEqual(result.gaps, []);
  assert.equal(result.paths.size, 16);
  assert.deepEqual(result.untouched, []);
});

test('wrong surface, incomplete scans, errors, threshold failure and absent findings fail closed', () => {
  const mutations = [
    report => { report.scan.host = 'http://localhost:4173'; },
    report => { report.scan.environment = 'CI'; },
    report => { report.scan.status = 'ERROR'; },
    report => { report.errors.push({ category: 'CONNECTION', message: 'Target unavailable' }); },
    report => { delete report.errors; },
    report => { report.thresholdResult = 'FAIL'; },
    report => { delete report.findings; },
  ];
  for (const mutate of mutations) {
    const report = cleanReport();
    mutate(report);
    assert.ok(evaluate(report, coveredUris).gaps.length);
  }
});

test('NEW and ASSIGNED findings are actionable; existing human triage is respected', () => {
  for (const status of ['NEW', 'ASSIGNED', 'unknown']) {
    const report = cleanReport();
    report.findings = [{ name: 'Header policy', paths: [{ path: '/', status }] }];
    assert.ok(evaluate(report, coveredUris).gaps.some(gap => gap.includes('actionable')));
  }
  const report = cleanReport();
  report.findings = [{ name: 'Header policy', paths: [{ path: '/', status: 'RISK_ACCEPTED' }, { path: '/product', status: 'FALSE_POSITIVE' }] }];
  assert.deepEqual(evaluate(report, coveredUris, coveredUris).gaps, []);
});

test('empty coverage and missing changed assets cannot clear the company gate', () => {
  assert.ok(evaluate(cleanReport(), []).gaps.some(gap => gap.includes('no target URI')));
  assert.ok(evaluate(cleanReport(), coveredUris.slice(0, 4)).gaps.some(gap => gap.includes('changed pages/assets')));
  assert.deepEqual([...scannedPaths(['https://live.example/product', 'https://localhost:4186/product?q=test'])], ['/product']);
});

test('invalid/missing scan IDs and malformed structured output fail closed', () => {
  assert.throws(() => scanId({ scan: { id: null } }));
  assert.throws(() => scanId({ scan: { id: 'not-a-scan' } }));
  assert.throws(() => parseJson('No result'));
  assert.deepEqual(parseJson('skills update available\n{"scan":{}}'), { scan: {} });
});
