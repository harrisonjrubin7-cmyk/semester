import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createCompanySiteScanServer } from './company-site-scan-server.mjs';
import { assertCompleteFindingEvidence, evaluate, evidenceDiagnostics, evidenceShape, expectedResponses, findingHash, findingHashes, findingPluginIds, findingsFromEvidence, parseJson, scanId, scannedPaths } from './company-site-scan-report.mjs';

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
