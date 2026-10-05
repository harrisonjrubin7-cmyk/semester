import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCompanySiteScanServer } from './company-site-scan-server.mjs';
import { apiBase, assemblePluginPaths, assertCompleteFindingEvidence, completeFindingDetail, evaluate, evidenceDiagnostics, evidenceShape, expectedResponses, findingHash, findingHashes, findingPluginIds, findingsFromEvidence, parseJson, scanId, scannedPaths } from './company-site-scan-report.mjs';
import { createServer } from 'node:http';
import * as findingEvidence from './company-site-scan-report.mjs';

const root = new URL('../', import.meta.url);
const read = path => existsSync(new URL(path, root)) ? readFileSync(new URL(path, root), 'utf8') : '';
const workflow = read('.github/workflows/hawkscan.yml');
const companyJob = workflow.split('\n  company_site:')[1] ?? '';
const capturePaths = ['search', 'today', 'courses', 'calendar', 'path', 'discover'].flatMap(screen => [`/screenshots/${screen}-desktop.jpg`, `/screenshots/${screen}-mobile.jpg`]);
const companyAssets = ['/site.css', '/site.js'];

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
  assert.match(companyJob, /hawkop-v0\.11\.0-x86_64-unknown-linux-gnu\.tar\.gz/);
  assert.match(companyJob, /8e37168b6361b39d6a67eb1426b31328b2a8bb8472a53b8c7dcffd35ffa720c3/);
  assert.match(companyJob, /HAWK_API_KEY:\s*\$\{\{ secrets\.HAWK_API_KEY \}\}/);
  assert.doesNotMatch(companyJob, /HAWKOP_API_KEY/);
  assert.match(companyJob, /"\$RUNNER_TEMP\/hawkop" scan get "\$scan_id" --detail full --format json/);
  assert.match(companyJob, /company-site-scan-report\.mjs hashes/);
  assert.match(companyJob, /API_KEY="\$HAWK_API_KEY" hawk op scan uris "\$scan_id" --format json/);
  assert.doesNotMatch(companyJob, /latest-version|hawk op scan get --help/);
});

test('the company configuration does not reuse the app environment or suppress findings', () => {
  const config = read('stackhawk-company-site.yml');
  assert.match(config, /env: CompanySiteCI/);
  assert.match(config, /ajax: true/);
  assert.match(config, /failureThreshold: low/);
  assert.match(config, /pscans\.maxAlertsPerRule=0/);
  assert.doesNotMatch(config, /excludePaths|excludePlugins/);
  const forms = [...`${read('company-site/index.html')}\n${read('company-site/site.js')}`.matchAll(/<form\b[^>]*>/gs)].map(match => {
    const id = match[0].match(/\bid="([^"]+)"/);
    assert.ok(id, 'every company form has an id so the CSRF rule can name it');
    assert.doesNotMatch(match[0], /\bmethod\s*=\s*["']?post/i, id[1]);
    return id[1];
  });
  assert.ok(forms.length > 1);
  const listed = config.match(/^ {4}- rules\.csrf\.ignorelist=(\S+)$/m)?.[1].split(',') ?? [];
  assert.deepEqual([...listed].sort(), [...new Set(forms)].sort(), 'the ignore list is exactly the static form ids');
  assert.equal(new Set(listed).size, listed.length);
  assert.ok(!listed.includes('session-form'), 'a form that is not on the site stays under plugin 20012');
  assert.doesNotMatch(read('company-site/site.js'), /credentials\s*:\s*['"]include['"]/);
  for (const path of companyAssets) assert.match(config, new RegExp(`\\s- ${path.replaceAll('.', '\\.')}(?:\\n|$)`), path);
  for (const path of capturePaths) assert.match(config, new RegExp(`\\s- ${path.replaceAll('.', '\\.')}(?:\\n|$)`), path);
});

test('the company scan cannot cancel an unrelated queued scan', () => {
  assert.doesNotMatch(companyJob, /group:\s*hawkscan-company-site\s*(?:\n|$)/);
});

test('the scan target preserves production headers without dropping its isolation policy', () => {
  const source = read('scripts/company-site-scan-server.mjs');
  assert.match(source, /vercel\.json/);
  assert.doesNotMatch(source, /unsafe-inline.*replace|delete.*Content-Security-Policy/);
});

test('the published CSP does not permit inline executable scripts', () => {
  const page = read('company-site/index.html');
  const policy = JSON.parse(read('company-site/vercel.json')).headers
    .flatMap(rule => rule.headers)
    .find(header => header.key === 'Content-Security-Policy')?.value ?? '';
  assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/);
  assert.match(page, /<script src="\/site\.js" defer><\/script>/);
  assert.doesNotMatch(page, /\son(?:click|change|submit|input|keydown|load|error)=/i);
  assert.ok(read('company-site/site.js').length > 1000);
});

test('the published CSP permits no inline styles and ships all styling from self', () => {
  const html = read('company-site/index.html');
  const script = read('company-site/site.js');
  const config = JSON.parse(read('company-site/vercel.json'));
  const csp = config.headers.flatMap(rule => rule.headers).find(header => header.key === 'Content-Security-Policy')?.value ?? '';
  const styleSource = csp.match(/(?:^|;)\s*style-src\s+([^;]+)/)?.[1] ?? '';
  assert.match(html, /<link rel="stylesheet" href="\/site\.css">/);
  assert.doesNotMatch(html, /<style\b|\sstyle=/i);
  assert.doesNotMatch(script, /\sstyle=/i);
  assert.doesNotMatch(script, /\.style\b|setAttribute\(\s*['"]style/i);
  assert.match(script, /sheet\.insertRule/);
  assert.match(styleSource, /'self'/);
  assert.doesNotMatch(styleSource, /'unsafe-inline'/);
  assert.ok(read('company-site/site.css').length > 1000);
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

test('a complete independent policy isolates live connections, submissions and frames', async t => {
  const server = createCompanySiteScanServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const page = await fetchTarget(server, '/');
  const published = JSON.parse(read('company-site/vercel.json')).headers.flatMap(rule => rule.headers)
    .find(header => header.key === 'Content-Security-Policy').value;
  const policies = page.headers['content-security-policy'].split(', ');
  assert.equal(policies.length, 2, 'production policy alone allows live services');
  assert.equal(policies[0], published, 'retain the exact published policy');
  const directives = policy => {
    const entries = policy.split(';').map(part => part.trim()).filter(Boolean)
      .map(part => { const [name, ...values] = part.split(/\s+/); return [name, values.join(' ')]; });
    assert.equal(new Set(entries.map(([name]) => name)).size, entries.length, 'no duplicate directives');
    return new Map(entries);
  };
  const production = directives(published);
  const isolated = directives(policies[1]);
  const boundaries = { 'connect-src': "'self'", 'form-action': "'self'", 'frame-src': "'none'" };
  assert.deepEqual([...isolated.keys()].sort(), [...production.keys()].sort(), 'no partial fallback policy');
  for (const [name, values] of production) assert.equal(isolated.get(name), boundaries[name] ?? values, name);
  // Control: the fixture really includes live destinations, so a lone copy of
  // the production header cannot satisfy these isolation assertions.
  assert.match(production.get('connect-src'), /https:\/\//);
  assert.notEqual(production.get('connect-src'), boundaries['connect-src']);
  assert.notEqual(production.get('frame-src'), boundaries['frame-src']);
});

test('ambiguous or incomplete isolation policies fail before the scan target starts', t => {
  const fixture = mkdtempSync(join(tmpdir(), 'semester-scan-policy-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const cases = [
    [config => { config.headers[0].headers = config.headers[0].headers.filter(header => header.key !== 'Content-Security-Policy'); }, /One production CSP/],
    [config => { config.headers[0].headers.push({ ...config.headers[0].headers[0] }); }, /One production CSP/],
    [config => { config.headers[0].headers[0].value += ", default-src 'self'"; }, /One production CSP/],
    [config => { config.headers[0].headers[0].value += "; connect-src 'self'"; }, /Ambiguous production CSP/],
    [config => { config.headers[0].headers[0].value = config.headers[0].headers[0].value.replace(/form-action[^;]+; /, ''); }, /Incomplete production CSP/],
  ];
  for (const [mutate, error] of cases) {
    const config = JSON.parse(read('company-site/vercel.json'));
    mutate(config);
    writeFileSync(join(fixture, 'vercel.json'), JSON.stringify(config));
    assert.throws(() => createCompanySiteScanServer({ root: fixture }), error);
  }
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
      assert.equal(actual.split(', ')[0], header.value);
    } else assert.equal(actual, header.value);
  }
  for (const path of capturePaths) {
    const image = await fetchTarget(server, path);
    assert.equal(image.status, 200, path);
    assert.equal(image.headers['content-type'], 'image/jpeg', path);
    assert.deepEqual(image.bytes, readFileSync(new URL(`company-site${path}`, root)), path);
  }
  const script = await fetchTarget(server, '/site.js');
  assert.equal(script.status, 200);
  assert.equal(script.headers['content-type'], 'text/javascript; charset=utf-8');
  assert.equal(script.bytes.toString(), read('company-site/site.js'));
  const stylesheet = await fetchTarget(server, '/site.css');
  assert.equal(stylesheet.status, 200);
  assert.equal(stylesheet.headers['content-type'], 'text/css');
  assert.equal(stylesheet.bytes.toString(), read('company-site/site.css'));
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
  assert.equal((await fetchTarget(server, '/a-virtual-route')).status, 404);
});

test('runtime target serves every canonical sitemap page without inventing page or asset coverage', async t => {
  const server = createCompanySiteScanServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const pages = [...read('company-site/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname);
  assert.ok(pages.includes('/') && pages.includes('/product') && pages.includes('/students') && pages.includes('/personal-academic-os'));
  for (const path of pages) {
    const page = await fetchTarget(server, path);
    assert.equal(page.status, 200, path);
    assert.equal(page.headers['content-type'], 'text/html; charset=utf-8', path);
    assert.equal(page.bytes.toString(), read('company-site/index.html'), path);
  }
  const queriedPage = await fetchTarget(server, '/product?scan=control');
  assert.equal(queriedPage.status, 200);
  assert.equal(queriedPage.bytes.toString(), read('company-site/index.html'));
  for (const path of ['/a-virtual-route', '/product/not-a-page']) {
    assert.equal((await fetchTarget(server, path)).status, 404, path);
  }
});

test('runtime target returns 404 for missing assets instead of successful HTML', async t => {
  const server = createCompanySiteScanServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  for (const path of ['/screenshots/not-a-screenshot.jpg', '/screenshots/today-mobile.jpg/missing', '/fonts/not-a-font.woff2', '/missing.css', '/missing.json']) {
    const missing = await fetchTarget(server, path);
    assert.equal(missing.status, 404, path);
    assert.equal(missing.headers['content-type'], 'text/plain', path);
    assert.equal(missing.bytes.toString(), 'Not found', path);
  }
});

test('runtime target records completed responses only for the required exact surfaces', async t => {
  const receipts = [];
  const server = createCompanySiteScanServer({ onResponse: receipt => receipts.push(receipt) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const paths = ['/', '/product', '/students', '/personal-academic-os', ...companyAssets, ...capturePaths];
  for (const path of paths) {
    const response = await fetchTarget(server, `${path}?scan=not-recorded`);
    assert.deepEqual(receipts.at(-1), {
      method: 'GET', path, status: 200, contentType: response.headers['content-type'],
      sha256: createHash('sha256').update(response.bytes).digest('hex'),
    }, path);
  }
  for (const path of ['/typefaces.css', '/a-virtual-route', '/screenshots/not-a-screenshot.jpg']) await fetchTarget(server, path);
  assert.equal(receipts.length, paths.length);
  const head = await fetchTarget(server, '/product', { method: 'HEAD' });
  assert.deepEqual(receipts.at(-1), {
    method: 'HEAD', path: '/product', status: 200, contentType: head.headers['content-type'],
    sha256: createHash('sha256').update(head.bytes).digest('hex'),
  });
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
const coveredUris = ['/', '/product', '/students', '/personal-academic-os', ...companyAssets, ...capturePaths];
const checkoutSha = 'a'.repeat(40);
const healthyEvidence = () => ({ checkoutSha, records: expectedResponses().map(record => ({ ...record, checkoutSha, method: 'GET', status: 200 })) });

test('error and metadata URL strings are not actual scanned URI evidence', () => {
  for (const uris of [{ errors: coveredUris }, { metadata: { urls: coveredUris } }, { data: coveredUris, error: 'timeout' }, { data: coveredUris, success: false }]) {
    assert.ok(evaluate(cleanReport(), uris, coveredUris, healthyEvidence()).gaps.length);
  }
});

test('URI presence alone cannot pass without successful response receipts', () => {
  assert.ok(evaluate(cleanReport(), coveredUris, coveredUris).gaps.some(gap => /response health/.test(gap)));
  const failed = coveredUris.map(uri => ({ uri, status: 404 }));
  assert.equal(scannedPaths(failed).size, 0);
  assert.equal(scannedPaths(coveredUris.map(uri => ({ uri, error: 'timeout' }))).size, 0);
});

test('clean complete scan evidence passes (reporting control)', () => {
  const result = evaluate(cleanReport(), { data: coveredUris }, coveredUris, healthyEvidence());
  assert.deepEqual(result.gaps, []);
  assert.equal(result.paths.size, 18);
  assert.deepEqual(result.untouched, []);
});

test('native HawkScan URI envelope is bound to the expected scan', () => {
  const id = cleanReport().scan.id;
  const result = evaluate(cleanReport(), {
    graphqlOperations: [], jsonrpcMethods: [], scanId: id, sources: ['spider'], uris: coveredUris,
  }, coveredUris, healthyEvidence());
  assert.deepEqual(result.gaps, []);
  assert.equal(result.paths.size, 18);

  const wrongScan = evaluate(cleanReport(), {
    scanId: '87654321-1234-1234-1234-123456789abc', uris: coveredUris,
  }, coveredUris, healthyEvidence());
  assert.ok(wrongScan.gaps.some(gap => /URI|untouched/.test(gap)));
});

test('wrong surface, incomplete scans, errors, warnings, threshold failure and absent findings fail closed', () => {
  const mutations = [
    report => { report.scan.host = 'http://localhost:4173'; },
    report => { report.scan.environment = 'CI'; },
    report => { report.scan.status = 'ERROR'; },
    report => { report.errors.push({ category: 'CONNECTION', message: 'Target unavailable' }); },
    report => { delete report.errors; },
    report => { report.warnings.push({ category: 'DISCOVERY', message: 'A route could not be crawled' }); },
    report => { delete report.warnings; },
    report => { report.thresholdResult = 'FAIL'; },
    report => { delete report.findings; },
  ];
  for (const mutate of mutations) {
    const report = cleanReport();
    mutate(report);
    assert.ok(evaluate(report, coveredUris, coveredUris, healthyEvidence()).gaps.length);
  }
});

test('NEW and ASSIGNED findings are actionable; existing human triage is respected', () => {
  for (const status of ['NEW', 'ASSIGNED', 'unknown']) {
    const report = cleanReport();
    report.findings = [{ name: 'Header policy', paths: [{ path: '/', status }] }];
    assert.ok(evaluate(report, coveredUris, coveredUris, healthyEvidence()).gaps.some(gap => gap.includes('actionable')));
  }
  const report = cleanReport();
  report.findings = [{ name: 'Header policy', paths: [
    { path: '/', status: 'RISK_ACCEPTED' },
    { path: '/product', status: 'FALSE_POSITIVE' },
    { path: '/students', status: 'Risk Accepted' },
    { path: '/academy', status: 'False Positive' },
  ] }];
  assert.deepEqual(evaluate(report, coveredUris, coveredUris, healthyEvidence()).gaps, []);
});

test('finding hashes are exposed only when they are valid triage identifiers', () => {
  const hash = 'a'.repeat(64);
  assert.equal(findingHash({ findingHash: hash }), hash);
  assert.equal(findingHash({ findingHash: 'not-a-hash' }), null);
  assert.equal(findingHash({}), null);
  assert.deepEqual(findingHashes({ paths: [{ finding_hash: hash }, { finding_hash: hash }, { finding_hash: 'bad' }] }), [hash]);
});

test('triage evidence is collected per plugin and rejects CLI path truncation', () => {
  const firstHash = 'a'.repeat(64);
  const secondHash = 'b'.repeat(64);
  const csrf = {
    plugin_id: '10202',
    plugin_name: 'Anti CSRF Tokens Scanner',
    total_paths: 2,
    paths: [
      { method: 'GET', uri: '/', status: 'UNKNOWN', finding_hash: firstHash },
      { method: 'GET', uri: '/academy', status: 'UNKNOWN', finding_hash: secondHash },
    ],
  };
  assert.deepEqual(findingPluginIds({ findings: [csrf, { ...csrf, plugin_id: '10032' }, csrf] }), ['10202', '10032']);
  assert.deepEqual(findingPluginIds({ findings: [] }), [], 'an explicit clean findings list needs no plugin detail requests');
  assert.throws(() => findingPluginIds({}), /unsupported schema/i, 'missing finding evidence still fails closed');
  assert.deepEqual(findingsFromEvidence(csrf), [csrf], 'plugin detail is a single finding');
  assert.deepEqual(findingsFromEvidence({ finding: csrf }), [csrf], 'plugin detail may use a finding envelope');
  assert.doesNotThrow(() => assertCompleteFindingEvidence(csrf));
  assert.throws(() => assertCompleteFindingEvidence({ ...csrf, total_paths: 3 }), /incomplete.*10202/i);
  assert.throws(() => assertCompleteFindingEvidence({ ...csrf, total_paths: 2, paths: csrf.paths.slice(0, 1) }), /incomplete.*10202/i);
  assert.throws(() => assertCompleteFindingEvidence({ ...csrf, paths: [{ ...csrf.paths[0], finding_hash: 'redacted' }, csrf.paths[1]] }), /triage hash.*10202/i);
  assert.throws(() => findingPluginIds({ findings: [{ ...csrf, plugin_id: '../unsafe' }] }), /plugin identifier/i);
  assert.equal(
    evidenceShape({ alert: [{ id: 'not-printed' }], nextPageToken: null, totalCount: 1 }),
    'object(alert:array(1;item=object(id));nextPageToken:null;totalCount:number)',
  );
  assert.deepEqual(
    evidenceDiagnostics({
      alert: { pluginId: 'secret-value', uriCount: 2 },
      applicationScanAlertUris: [{ findingHash: 'secret-hash', method: 'GET', uri: '/private', scan: { id: 'secret-scan' } }],
      nextPageToken: 'secret-token',
      totalCount: 2,
    }),
    [
      'alert=object(pluginId:string;uriCount:number)',
      'applicationScanAlertUris=array(1;item=object(findingHash,method,scan,uri))',
      'nextPageToken=string',
      'totalCount=number',
      'applicationScanAlertUris[0].scan=object(id:string)',
    ],
  );
  assert.throws(() => findingPluginIds({ vulnerabilities: [csrf] }), /unsupported schema: object\(vulnerabilities:array\(1;item=object\(/i);
});

// Synthetic values in the observed native formats: the raw scan summary has
// count/cweId and method/path records; full-get detail has cwe_id/plugin_id,
// total_paths and method/uri/finding_hash records. No private response bodies,
// real finding hashes, or unobserved full-get scan association are fixtures.
const reconciliationFixture = () => {
  const summary = cleanReport();
  summary.thresholdResult = 'FAIL';
  const groups = [
    { cweId: 'CWE-200', cwe_id: 'CWE-200', severity: 'low', plugin_id: '10032', name: 'Synthetic email evidence', count: 14, stem: 'email' },
    { cweId: 'CWE-352', cwe_id: 'CWE-352', severity: 'medium', plugin_id: '10202', name: 'Synthetic form evidence', count: 2, stem: 'form' },
  ];
  summary.findings = groups.map(group => ({
    count: group.count, cweId: group.cweId, name: group.name, severity: group.severity,
    paths: Array.from({ length: group.count }, (_, index) => ({
      method: 'GET', path: `/synthetic-${group.stem}-${index + 1}`, status: 'NEW',
    })),
  }));
  const detail = {
    findings: groups.map((group, index) => ({
      cwe_id: group.cwe_id, plugin_id: group.plugin_id, plugin_name: group.name,
      severity: group.severity, total_paths: group.count,
      paths: summary.findings[index].paths.map(path => ({
        method: path.method, uri: path.path, status: 'UNKNOWN',
        finding_hash: createHash('sha256').update(`${group.plugin_id}:${path.method}:${path.path}`).digest('hex'),
      })),
    })),
  };
  return { summary, detail };
};

const reconciliationValidator = () => {
  assert.equal(typeof findingEvidence.assertReconciledFindingEvidence, 'function', 'the independent reconciliation validator must exist');
  return findingEvidence.assertReconciledFindingEvidence;
};

test('reconciliation accepts full independent finding evidence without inventing human triage', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = reconciliationFixture();
  const before = structuredClone({ summary, detail });
  assert.deepEqual(reconcile(summary, detail), detail.findings);
  assert.deepEqual({ summary, detail }, before, 'reconciliation must not mutate findings or their statuses');
  assert.ok(detail.findings.every(finding => finding.paths.every(path => path.status === 'UNKNOWN')));
});

test('reconciliation accepts explicitly clean complete summary and full-detail evidence', () => {
  const reconcile = reconciliationValidator();
  assert.deepEqual(reconcile(cleanReport(), { findings: [] }), []);
});

test('reconciliation rejects independently reported 14 paths versus self-consistent 10-path detail', () => {
  const { summary, detail } = reconciliationFixture();
  detail.findings[0].total_paths = 10;
  detail.findings[0].paths = detail.findings[0].paths.slice(0, 10);
  assert.equal(summary.findings[0].count, 14);
  assert.doesNotThrow(() => detail.findings.forEach(assertCompleteFindingEvidence), 'control: the old self-count check accepts the truncated evidence');
  const reconcile = reconciliationValidator();
  assert.throws(() => reconcile(summary, detail), /reconcil|mismatch|incomplete|count/i);
});

test('reconciliation does not trust a summary count that contradicts its own paths', () => {
  const reconcile = reconciliationValidator();
  for (const count of [13, 15, 0, -1, 14.5, '14', null, undefined]) {
    const { summary, detail } = reconciliationFixture();
    summary.findings[0].count = count;
    assert.throws(() => reconcile(summary, detail), /summary|count|incomplete|reconcil/i, String(count));
  }
});

test('reconciliation rejects a whole finding omitted from either independent source', () => {
  const reconcile = reconciliationValidator();
  for (const omitted of ['summary', 'detail']) {
    const fixture = reconciliationFixture();
    fixture[omitted].findings.pop();
    assert.throws(() => reconcile(fixture.summary, fixture.detail), /finding|group|mismatch|reconcil/i, omitted);
  }
});

test('reconciliation rejects an empty detail list when the raw summary reports findings', () => {
  const reconcile = reconciliationValidator();
  const { summary } = reconciliationFixture();
  assert.throws(() => reconcile(summary, { findings: [] }), /finding|group|mismatch|reconcil/i);
});

test('reconciliation rejects summary schema failures instead of treating them as clean evidence', () => {
  const reconcile = reconciliationValidator();
  const mutations = [
    summary => { delete summary.findings; },
    summary => { summary.findings = null; },
    summary => { summary.errors.push({ category: 'LOOKUP' }); },
    summary => { delete summary.errors; },
    summary => { summary.warnings.push({ category: 'DISCOVERY' }); },
    summary => { delete summary.warnings; },
    summary => { delete summary.scan.id; },
    summary => { summary.scan.id = 'wrong-scan'; },
  ];
  for (const mutate of mutations) {
    const summary = cleanReport();
    mutate(summary);
    assert.throws(() => reconcile(summary, { findings: [] }), /summary|finding|scan|error|warning|evidence/i);
  }
});

test('reconciliation rejects error envelopes even when they include findings empty-list bait', () => {
  const reconcile = reconciliationValidator();
  const envelopes = [
    { error: 'Synthetic API failure', findings: [] },
    { errors: [{ category: 'LOOKUP' }], findings: [] },
    { warnings: [{ category: 'DISCOVERY' }], findings: [] },
    { success: false, findings: [] },
    {},
    { findings: null },
    { data: { findings: [] } },
  ];
  for (const detail of envelopes) {
    assert.throws(() => reconcile(cleanReport(), detail), /detail|finding|error|warning|evidence|schema/i);
  }
});

test('reconciliation rejects changed methods, paths, query strings and fragments', () => {
  const reconcile = reconciliationValidator();
  const mutations = [
    detail => { detail.findings[0].paths[0].method = 'POST'; },
    detail => { detail.findings[0].paths[0].uri = '/another-synthetic-path'; },
    detail => { detail.findings[0].paths[0].uri += '?record=another'; },
    detail => { detail.findings[0].paths[0].uri += '#another'; },
  ];
  for (const mutate of mutations) {
    const { summary, detail } = reconciliationFixture();
    mutate(detail);
    assert.doesNotThrow(() => detail.findings.forEach(assertCompleteFindingEvidence), 'control: detail counts and hashes still look complete');
    assert.throws(() => reconcile(summary, detail), /path|method|mismatch|reconcil/i);
  }
});

test('reconciliation permits matching query and fragment records without collapsing their identity', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = reconciliationFixture();
  summary.findings[0].paths[0].path += '?record=one#part-one';
  detail.findings[0].paths[0].uri = summary.findings[0].paths[0].path;
  assert.deepEqual(reconcile(summary, detail), detail.findings);
});

test('reconciliation preserves legitimate repeated URI records as a multiset rather than deduplicating counts', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = reconciliationFixture();
  summary.findings[0].paths[13].path = summary.findings[0].paths[0].path;
  detail.findings[0].paths[13].uri = summary.findings[0].paths[13].path;
  assert.notEqual(detail.findings[0].paths[13].finding_hash, detail.findings[0].paths[0].finding_hash, 'each evidence record retains its own hash');
  assert.deepEqual(reconcile(summary, detail), detail.findings);
});

test('reconciliation binds absolute URI detail to the target origin, path, query and fragment', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = reconciliationFixture();
  summary.findings[0].paths[0].path += '?record=one#part-one';
  detail.findings[0].paths[0].uri = `https://localhost:4186${summary.findings[0].paths[0].path}`;
  assert.deepEqual(reconcile(summary, detail), detail.findings, 'control: absolute target URI and relative summary path refer to the same target');
  detail.findings[0].paths[0].uri = `https://another.invalid${summary.findings[0].paths[0].path}`;
  assert.throws(() => reconcile(summary, detail), /origin|target|path|reconcil/i);
});

test('reconciliation rejects duplicate-path substitution even with equal counts and unique hashes', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = reconciliationFixture();
  detail.findings[0].paths[13].uri = detail.findings[0].paths[0].uri;
  assert.doesNotThrow(() => detail.findings.forEach(assertCompleteFindingEvidence));
  assert.throws(() => reconcile(summary, detail), /path|duplicate|mismatch|reconcil/i);
});

test('reconciliation rejects duplicated triage hashes rather than counting another record twice', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = reconciliationFixture();
  detail.findings[0].paths[13].finding_hash = detail.findings[0].paths[0].finding_hash;
  assert.doesNotThrow(() => detail.findings.forEach(assertCompleteFindingEvidence), 'control: the existing hash check verifies syntax, not uniqueness');
  assert.throws(() => reconcile(summary, detail), /hash|duplicate|reconcil/i);
});

test('reconciliation rejects omitted or changed group identity without guessing plugin identity from names', () => {
  const reconcile = reconciliationValidator();
  const mutations = [
    detail => { detail.findings[1].cwe_id = 'CWE-200'; detail.findings[1].severity = 'low'; },
    detail => { delete detail.findings[0].cwe_id; },
    detail => { detail.findings[0].cwe_id = 'CWE-999'; },
    detail => { detail.findings[0].severity = 'high'; },
    detail => { delete detail.findings[0].plugin_id; },
    detail => { detail.findings[0].plugin_id = '../unsafe'; },
    detail => { detail.findings[1].plugin_id = detail.findings[0].plugin_id; },
  ];
  for (const mutate of mutations) {
    const { summary, detail } = reconciliationFixture();
    mutate(detail);
    assert.throws(() => reconcile(summary, detail), /CWE|group|severity|plugin|identity|reconcil|finding/i);
  }
});

test('reconciliation rejects ambiguous repeated CWE and severity groups in either source', () => {
  const reconcile = reconciliationValidator();
  for (const duplicated of ['summary', 'detail']) {
    const fixture = reconciliationFixture();
    fixture[duplicated].findings.push(structuredClone(fixture[duplicated].findings[0]));
    assert.throws(() => reconcile(fixture.summary, fixture.detail), /ambiguous|duplicate|group|reconcil/i, duplicated);
  }
});

test('native URI evidence requires an explicit matching scan association', () => {
  const id = cleanReport().scan.id;
  const envelope = { graphqlOperations: [], jsonrpcMethods: [], sources: ['spider'], uris: coveredUris };
  assert.equal(scannedPaths({ ...envelope, scanId: id }, id).size, coveredUris.length, 'control: matching observed native association passes');
  for (const scanId of [undefined, null, '', 'wrong-scan', '87654321-1234-1234-1234-123456789abc']) {
    assert.equal(scannedPaths({ ...envelope, scanId }, id).size, 0, `native scanId ${String(scanId)}`);
  }
});

const runFindingCli = (t, mode, summary, detail) => {
  const fixture = mkdtempSync(join(tmpdir(), 'semester-finding-cli-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const summaryFile = join(fixture, 'summary.json');
  const detailFile = join(fixture, 'detail.json');
  writeFileSync(summaryFile, JSON.stringify(summary));
  writeFileSync(detailFile, JSON.stringify(detail));
  const reportScript = fileURLToPath(new URL('./company-site-scan-report.mjs', import.meta.url));
  const args = mode === 'hashes' ? [reportScript, mode, detailFile] : [reportScript, mode, summaryFile, detailFile];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(result.error, undefined, 'the exact test runtime must execute the shipped CLI');
  return result;
};

test('the hashes CLI labels self-count evidence as structural, never exhaustive vendor evidence', t => {
  const { summary, detail } = reconciliationFixture();
  detail.findings[0].total_paths = 10;
  detail.findings[0].paths = detail.findings[0].paths.slice(0, 10);
  const result = runFindingCli(t, 'hashes', summary, detail);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Structural finding detail/);
  assert.match(result.stdout, /exhaustive enumeration unverified/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Complete finding evidence/);
});

test('the reconcile CLI rejects the independent 14-versus-10 reporting gap with nonzero status', t => {
  const { summary, detail } = reconciliationFixture();
  detail.findings[0].total_paths = 10;
  detail.findings[0].paths = detail.findings[0].paths.slice(0, 10);
  const result = runFindingCli(t, 'reconcile', summary, detail);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /count mismatch.*summary 14, detail 10/i);
  assert.doesNotMatch(result.stdout, /Summary-reconciled finding evidence/);
});

test('the reconcile CLI accepts full 14-path and clean controls while retaining vendor association limitations', t => {
  const { summary, detail } = reconciliationFixture();
  const full = runFindingCli(t, 'reconcile', summary, detail);
  assert.equal(full.status, 0, full.stderr);
  assert.match(full.stdout, /Summary-reconciled finding evidence: 2 findings, 16 instances/);
  assert.match(full.stdout, /Native full-detail scan association and vendor pagination require separate verification/);
  assert.doesNotMatch(full.stdout, /Complete finding evidence/);
  const clean = runFindingCli(t, 'reconcile', cleanReport(), { findings: [] });
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /0 findings, 0 instances/);
});

test('the reconcile CLI cannot turn an error envelope with findings empty-list bait into success', t => {
  for (const detail of [
    { findings: [], error: 'Synthetic lookup error' },
    { findings: [], errors: [{ category: 'LOOKUP' }] },
    { findings: [], success: false },
  ]) {
    const result = runFindingCli(t, 'reconcile', cleanReport(), detail);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error/i);
    assert.doesNotMatch(result.stdout, /Summary-reconciled finding evidence/);
  }
});

test('the reconcile CLI rejects invalid explicitly claimed scan identities without inventing native association', t => {
  // These are adversarial identity claims, not assertions that full-get emits
  // these fields. Absent identity remains separately unverified in the CLI.
  for (const id of ['87654321-1234-1234-1234-123456789abc', null, '']) {
    for (const claim of [{ scanId: id }, { scan: { id } }]) {
      const result = runFindingCli(t, 'reconcile', cleanReport(), { findings: [], ...claim });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /scan association/i);
      assert.doesNotMatch(result.stdout, /Summary-reconciled finding evidence/);
    }
  }
});

test('the reconcile CLI rejects an explicitly unconsumed continuation rather than claiming pagination completeness', t => {
  for (const continuation of [{ nextPageToken: 'synthetic-next-page' }, { next_page_token: 'synthetic-next-page' }]) {
    const result = runFindingCli(t, 'reconcile', cleanReport(), { findings: [], ...continuation });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unconsumed continuation/i);
    assert.doesNotMatch(result.stdout, /Summary-reconciled finding evidence/);
  }
});

test('the workflow requires independent reconciliation and keeps its failure after later URI and receipt checks', () => {
  const verification = companyJob.split('      - name: Verify company-site scan evidence')[1] ?? '';
  assert.match(verification, /node scripts\/company-site-scan-report\.mjs pages "\$scan_id" "\$RUNNER_TEMP\/company-site-findings\.json" > "\$RUNNER_TEMP\/company-site-findings-complete\.json" \|\| evidence_status=1/);
  assert.match(verification, /node scripts\/company-site-scan-report\.mjs reconcile "\$RUNNER_TEMP\/company-site-scan\.json" "\$RUNNER_TEMP\/company-site-findings-complete\.json" \|\| evidence_status=1/);
  assert.match(verification, /node scripts\/company-site-scan-report\.mjs hashes "\$RUNNER_TEMP\/company-site-findings-complete\.json" \|\| evidence_status=1/);
  assert.match(verification, /node scripts\/company-site-scan-report\.mjs verify "\$RUNNER_TEMP\/company-site-scan\.json" "\$RUNNER_TEMP\/company-site-uris\.json" "\$RUNNER_TEMP\/company-site-responses\.jsonl" \|\| evidence_status=1/);
  assert.match(verification, /exit "\$evidence_status"/);
  assert.ok(verification.indexOf(' pages ') < verification.indexOf(' hashes '), 'full alert pages are assembled before the structural hash check');
  assert.ok(verification.indexOf(' reconcile ') < verification.indexOf('hawk op scan uris'), 'the independent check precedes URI retrieval');
  assert.ok(verification.indexOf('hawk op scan uris') < verification.indexOf(' verify '), 'response/URI verification still runs after reconciliation');

  // Execute only the extracted status aggregation, substituting constant local
  // true/false commands for every real collector. No scanner or vendor API runs.
  const lines = verification.split('\n').map(line => line.trim());
  const statusLines = lines.filter(line => line === 'evidence_status=0' || line === 'exit "$evidence_status"' || /^node scripts\/company-site-scan-report\.mjs (?:pages|hashes|reconcile|verify) /.test(line));
  assert.equal(statusLines.length, 6);
  const simulate = failed => {
    const script = statusLines.map(line => {
      if (!line.startsWith('node ')) return line;
      const mode = line.match(/company-site-scan-report\.mjs (pages|hashes|reconcile|verify) /)?.[1];
      assert.ok(mode);
      assert.match(line, / \|\| evidence_status=1$/);
      return `${mode === failed ? 'false' : 'true'} || evidence_status=1`;
    }).join('\n');
    assert.doesNotMatch(script, /hawk|node|API_KEY|RUNNER_TEMP/);
    return spawnSync('bash', ['-c', script], { encoding: 'utf8' });
  };
  for (const failed of ['pages', 'hashes', 'reconcile', 'verify']) {
    const result = simulate(failed);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, `${failed}: ${result.stderr}`);
  }
  assert.equal(simulate(null).status, 0, 'control: every evidence check succeeding leaves a zero status');
});

test('empty coverage and missing changed assets cannot clear the company gate', () => {
  assert.ok(evaluate(cleanReport(), []).gaps.some(gap => gap.includes('no target URI')));
  assert.ok(evaluate(cleanReport(), coveredUris.slice(0, 4)).gaps.some(gap => gap.includes('changed pages/assets')));
  assert.deepEqual([...scannedPaths(['https://live.example/product', 'https://localhost:4186/product?q=test'])], ['/product']);
});

test('wrong scan association and unsupported URI envelopes fail closed', () => {
  for (const uris of [{ data: coveredUris, scanId: '87654321-1234-1234-1234-123456789abc' }, { urls: coveredUris }, { data: { urls: coveredUris } }]) {
    assert.ok(evaluate(cleanReport(), uris, coveredUris, healthyEvidence()).gaps.some(gap => /URI|untouched/.test(gap)));
  }
});

test('stale, failed, timed-out, wrong MIME or wrong bytes cannot pass response health', () => {
  const mutations = [
    evidence => { evidence.checkoutSha = 'b'.repeat(40); },
    evidence => { evidence.records.forEach(record => { record.status = 404; }); },
    evidence => { evidence.records = []; },
    evidence => { evidence.records[4].contentType = 'text/html'; },
    evidence => { evidence.records[5].sha256 = '0'.repeat(64); },
    evidence => { evidence.records[6].method = 'HEAD'; },
    evidence => { delete evidence.checkoutSha; },
  ];
  for (const mutate of mutations) {
    const evidence = healthyEvidence();
    mutate(evidence);
    assert.ok(evaluate(cleanReport(), coveredUris, coveredUris, evidence).gaps.some(gap => /response health/.test(gap)));
  }
});

test('invalid/missing scan IDs and malformed structured output fail closed', () => {
  assert.throws(() => scanId({ scan: { id: null } }));
  assert.throws(() => scanId({ scan: { id: 'not-a-scan' } }));
  assert.throws(() => parseJson('No result'));
  assert.deepEqual(parseJson('skills update available\n{"scan":{}}'), { scan: {} });
});

const categoryFixture = () => {
  const fixture = reconciliationFixture();
  assert.equal(/^(?:CWE-)?([1-9]\d*)$/i.test('Information Leakage'), false, 'control: a WASC category is not a CWE token');
  fixture.summary.findings[0].cweId = 'Information Leakage';
  fixture.summary.findings[1].cweId = 'HTTP Header Protection';
  fixture.detail.findings[0].category = 'Information Leakage';
  fixture.detail.findings[0].cwe_id = 'CWE-311';
  fixture.detail.findings[1].category = 'HTTP Header Protection';
  fixture.detail.findings[1].cwe_id = 'CWE-352';
  return fixture;
};

test('reconciliation accepts Hawk 6.5.0 WASC categories in the summary field named cweId', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = categoryFixture();
  assert.deepEqual(reconcile(summary, detail), detail.findings);
});

test('reconciliation still rejects a 10-path page when the summary identity is a category', () => {
  const reconcile = reconciliationValidator();
  const { summary, detail } = categoryFixture();
  detail.findings[0].total_paths = 10;
  detail.findings[0].paths = detail.findings[0].paths.slice(0, 10);
  assert.doesNotThrow(() => detail.findings.forEach(assertCompleteFindingEvidence), 'control: the self-count check still accepts the short page');
  assert.throws(() => reconcile(summary, detail), /count mismatch.*summary 14, detail 10/i);
});

test('reconciliation rejects category identities that cannot be paired with a real detail CWE', () => {
  const reconcile = reconciliationValidator();
  const mutations = [
    summary => { summary.findings[0].cweId = 'Unknown'; },
    summary => { summary.findings[0].cweId = '../secret'; },
    summary => { summary.findings[1].cweId = 'CWE-352'; },
    (summary, detail) => { detail.findings[0].category = 'Session Management'; },
    (summary, detail) => { delete detail.findings[0].cwe_id; },
    (summary, detail) => { detail.findings[0].cwe_id = 'not-a-cwe'; },
  ];
  for (const mutate of mutations) {
    const { summary, detail } = categoryFixture();
    mutate(summary, detail);
    assert.throws(() => reconcile(summary, detail), /CWE|group|identity|reconcil|finding/i);
  }
});

test('alert page assembly rejects a 10-uri page whose totalCount is 14', () => {
  const scan = cleanReport().scan.id;
  const record = index => ({
    requestMethod: 'GET', uri: `/synthetic-email-${index}`, status: 'RISK_ACCEPTED',
    findingHash: createHash('sha256').update(`email-${index}`).digest('hex'), scan: { id: scan },
  });
  const first = Array.from({ length: 10 }, (_, index) => record(index + 1));
  const rest = Array.from({ length: 4 }, (_, index) => record(index + 11));
  assert.throws(() => assemblePluginPaths([{ applicationScanAlertUris: first, totalCount: 14, nextPageToken: '' }], scan), /count mismatch/i);
  assert.throws(() => assemblePluginPaths([{ applicationScanAlertUris: first, totalCount: 14, nextPageToken: '1' }], scan), /continuation/i);
  const paths = assemblePluginPaths([
    { applicationScanAlertUris: first, totalCount: 14, nextPageToken: 1 },
    { applicationScanAlertUris: rest, totalCount: 14, nextPageToken: null },
  ], scan);
  assert.equal(paths.length, 14);
  assert.equal(paths[13].uri, '/synthetic-email-14');
  assert.throws(() => assemblePluginPaths([
    { applicationScanAlertUris: [{ ...first[0], scan: { id: '87654321-1234-1234-1234-123456789abc' } }], totalCount: 1, nextPageToken: '' },
  ], scan), /scan association/i);
});

test('complete finding detail replaces a self-consistent 10-path plugin with both alert pages', async () => {
  const scan = cleanReport().scan.id;
  const { detail } = reconciliationFixture();
  const truncated = structuredClone(detail);
  truncated.findings[0].total_paths = 10;
  truncated.findings[0].paths = truncated.findings[0].paths.slice(0, 10);
  assert.doesNotThrow(() => truncated.findings.forEach(assertCompleteFindingEvidence), 'control: hawkop self-count still looks complete');
  const pagesFor = plugin => {
    const finding = detail.findings.find(item => item.plugin_id === plugin);
    const records = finding.paths.map(path => ({
      method: path.method, uri: path.uri, status: path.status, finding_hash: path.finding_hash, scan: { id: scan },
    }));
    const mid = Math.ceil(records.length / 2);
    return [
      { applicationScanAlertUris: records.slice(0, mid), totalCount: records.length, nextPageToken: records.length > mid ? '1' : '' },
      ...(records.length > mid ? [{ applicationScanAlertUris: records.slice(mid), totalCount: records.length, nextPageToken: '' }] : []),
    ];
  };
  const completed = await completeFindingDetail(truncated, scan, pagesFor);
  assert.equal(completed.findings[0].paths.length, 14);
  assert.equal(completed.findings[0].total_paths, 14);
  assert.equal(truncated.findings[0].paths.length, 10, 'paging must not rewrite the truncated vendor file');
  assert.deepEqual(completed.findings[1].paths.map(path => path.uri), detail.findings[1].paths.map(path => path.uri));
});

test('the pages CLI follows the alert URI page token and does not print the API key', async t => {
  const scan = cleanReport().scan.id;
  const key = 'synthetic-key-value';
  const hash = index => createHash('sha256').update(`page-${index}`).digest('hex');
  const seen = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    seen.push({ path: url.pathname, pageSize: url.searchParams.get('pageSize'), pageToken: url.searchParams.get('pageToken'), key: request.headers['x-apikey'] });
    const token = url.searchParams.get('pageToken');
    const body = token === '0'
      ? { applicationScanAlertUris: [{ requestMethod: 'GET', uri: '/synthetic-email-1', status: 'RISK_ACCEPTED', findingHash: hash(1), scan: { id: scan } }], totalCount: 2, nextPageToken: 1 }
      : { applicationScanAlertUris: [{ requestMethod: 'GET', uri: '/synthetic-email-2', status: 'RISK_ACCEPTED', findingHash: hash(2), scan: { id: scan } }], totalCount: 2, nextPageToken: '' };
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const fixture = mkdtempSync(join(tmpdir(), 'semester-alert-pages-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const detailFile = join(fixture, 'detail.json');
  writeFileSync(detailFile, JSON.stringify({
    findings: [{ plugin_id: '100009', cwe_id: 'CWE-311', severity: 'low', total_paths: 1, paths: [{ method: 'GET', uri: '/truncated', status: 'UNKNOWN', finding_hash: hash(0) }] }],
  }));
  const reportScript = fileURLToPath(new URL('./company-site-scan-report.mjs', import.meta.url));
  // spawn, not spawnSync: a synchronous child would stall this process's HTTP server.
  const child = spawn(process.execPath, [reportScript, 'pages', scan, detailFile], {
    env: { ...process.env, HAWK_API_KEY: key, STACKHAWK_API_BASE: `http://127.0.0.1:${server.address().port}` },
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  const status = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });
  const result = { status, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') };
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, new RegExp(key));
  assert.deepEqual(seen.map(call => [call.pageSize, call.pageToken, call.key]), [['100', '0', key], ['100', '1', key]]);
  assert.match(seen[0].path, new RegExp(`/api/v1/scan/${scan}/alert/100009$`));
  const completed = JSON.parse(result.stdout);
  assert.equal(completed.findings[0].total_paths, 2);
  assert.deepEqual(completed.findings[0].paths.map(path => path.uri), ['/synthetic-email-1', '/synthetic-email-2']);
  assert.match(result.stderr, /Paged finding evidence: 1 findings, 2 instances/);
});

test('the API base used for alert pages is the StackHawk host unless a loopback test server is named', () => {
  const previous = process.env.STACKHAWK_API_BASE;
  try {
    delete process.env.STACKHAWK_API_BASE;
    assert.equal(apiBase(), 'https://api.stackhawk.com');
    process.env.STACKHAWK_API_BASE = 'https://evil.example';
    assert.throws(() => apiBase(), /unsupported API base/);
    process.env.STACKHAWK_API_BASE = 'http://127.0.0.1:9';
    assert.equal(apiBase(), 'http://127.0.0.1:9');
  } finally {
    if (previous === undefined) delete process.env.STACKHAWK_API_BASE;
    else process.env.STACKHAWK_API_BASE = previous;
  }
});
