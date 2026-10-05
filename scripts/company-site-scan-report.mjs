import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const host = 'https://localhost:4186';
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const requiredPaths = ['/', '/product', '/students', '/personal-academic-os', '/site.css', '/site.js', ...['search', 'today', 'courses', 'calendar', 'path', 'discover'].flatMap(screen => [`/screenshots/${screen}-desktop.jpg`, `/screenshots/${screen}-mobile.jpg`])];
const safeText = value => String(value).replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 180);
const triageStatus = value => String(value ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase();

export function parseJson(text) {
  // Some CLI builds put a skills-update banner before platform lookup output.
  const start = text.search(/[\[{]/);
  if (start < 0) throw new Error('No structured scan evidence was returned');
  return JSON.parse(text.slice(start));
}

export function scanId(report) {
  const id = report?.scan?.id;
  if (!uuid.test(id ?? '')) throw new Error('Scan did not return a valid scan ID');
  return id;
}

export function expectedRoutes() {
  const sitemap = readFileSync(new URL('../company-site/sitemap.xml', import.meta.url), 'utf8');
  return [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname))];
}

export function scannedPaths(uris, expectedId) {
  const paths = new Set();
  // Only URI records, never recursively collected URLs in errors or metadata.
  // Unknown native CLI envelopes stay unverified until their schema is observed.
  if (uris?.error || (uris?.errors && (!Array.isArray(uris.errors) || uris.errors.length)) || uris?.success === false) return paths;
  // The observed native envelope must actually identify the expected scan.
  // Missing/null/empty IDs are not evidence of association.
  if (Array.isArray(uris?.uris) && (!uuid.test(expectedId ?? '') || uris.scanId !== expectedId)) return paths;
  if (uris && !Array.isArray(uris) && 'scanId' in uris && uris.scanId !== expectedId) return paths;
  const records = Array.isArray(uris) ? uris : Array.isArray(uris?.uris) ? uris.uris : uris?.data;
  if (!Array.isArray(records)) return paths;
  for (const record of records) {
    const value = typeof record === 'string' ? record : record?.uri;
    if (record && typeof record === 'object') {
      if (record.error || record.errors?.length) continue;
      if ('status' in record && (!Number.isInteger(record.status) || record.status < 200 || record.status >= 300)) continue;
      if ('statusCode' in record && (!Number.isInteger(record.statusCode) || record.statusCode < 200 || record.statusCode >= 300)) continue;
    }
    if (typeof value !== 'string' || !/^(https?:\/\/|\/)/.test(value)) continue;
    try {
      const url = new URL(value, host);
      if (url.origin === host) paths.add(url.pathname);
    } catch { /* Malformed scanner probes are not coverage evidence. */ }
  }
  return paths;
}

export function expectedResponses() {
  return requiredPaths.map(path => {
    const image = path.startsWith('/screenshots/');
    const asset = path === '/site.css' || path === '/site.js';
    const file = image || asset ? path.slice(1) : 'index.html';
    const contentType = image ? 'image/jpeg' : path === '/site.css' ? 'text/css' : path === '/site.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8';
    const bytes = readFileSync(new URL(`../company-site/${file}`, import.meta.url));
    return { path, contentType, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
}

export function evaluate(report, uris, routes = expectedRoutes(), evidence = {}) {
  const id = scanId(report);
  const gaps = [];
  if (report.scan.host !== host || report.scan.environment !== 'CompanySiteCI') gaps.push('surface-unscanned: wrong host or environment');
  if (report.scan.status !== 'COMPLETED') gaps.push('env-unreachable: scan did not complete');
  if (!Array.isArray(report.errors) || report.errors.length) gaps.push('scan errors or missing error evidence');
  if (!Array.isArray(report.warnings) || report.warnings.length) gaps.push('scan warnings or missing warning evidence');
  if (!Array.isArray(report.findings)) gaps.push('missing findings evidence');
  if (report.thresholdResult !== 'PASS') gaps.push('security threshold did not pass');
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const actionable = findings.filter(finding => !Array.isArray(finding.paths) || !finding.paths.length || finding.paths.some(path => !['FALSE_POSITIVE', 'RISK_ACCEPTED'].includes(triageStatus(path.status))));
  if (actionable.length) gaps.push(`${actionable.length} actionable findings remain`);
  const paths = scannedPaths(uris, id);
  if (!paths.size) gaps.push('surface-unscanned: no target URI evidence');
  const missingRequired = requiredPaths.filter(path => !paths.has(path));
  if (missingRequired.length) gaps.push(`surface-unscanned: changed pages/assets untouched: ${missingRequired.join(', ')}`);
  const records = Array.isArray(evidence.records) ? evidence.records : [];
  const validSha = /^[a-f\d]{40}$/i.test(evidence.checkoutSha ?? '');
  const unhealthy = expectedResponses().filter(expected => !validSha || !records.some(record =>
    record.checkoutSha === evidence.checkoutSha && record.method === 'GET' && record.path === expected.path &&
    record.status === 200 && record.contentType === expected.contentType && record.sha256 === expected.sha256));
  if (unhealthy.length) gaps.push(`response health unverified: successful byte-exact scanner responses missing: ${unhealthy.map(record => record.path).join(', ')}`);
  const untouched = routes.filter(path => !paths.has(path));
  return { id, gaps, findings, paths, untouched, expectedCount: routes.length, healthyCount: requiredPaths.length - unhealthy.length, checkoutSha: evidence.checkoutSha };
}

function printFindings(findings, write = console.log) {
  for (const finding of findings) {
    const paths = (finding.paths ?? []).map(path => {
      const uri = path.path ?? path.uri;
      const pathname = typeof uri === 'string' ? new URL(uri, host).pathname : 'undefined';
      return `${safeText(path.method)} ${safeText(pathname)} [${safeText(path.status)}]`;
    });
    const hashes = findingHashes(finding);
    write(`StackHawk | Finding: ${safeText(finding.severity)} ${safeText(finding.name ?? finding.plugin_name)}; triage-hashes=${hashes.length ? hashes.join(',') : 'unavailable'}; ${paths.join(', ')}`);
  }
}

export function findingHash(finding) {
  return /^[a-f\d]{64}$/i.test(finding?.findingHash ?? '') ? finding.findingHash : null;
}

export function findingHashes(finding) {
  const hashes = [findingHash(finding), ...(finding?.paths ?? []).map(path => path?.finding_hash)]
    .filter(hash => /^[a-f\d]{64}$/i.test(hash ?? ''));
  return [...new Set(hashes)];
}

export function evidenceShape(value) {
  if (Array.isArray(value)) {
    const item = value[0];
    const itemShape = item && typeof item === 'object' && !Array.isArray(item)
      ? `object(${Object.keys(item).sort().map(safeText).join(',')})`
      : Array.isArray(item) ? `array(${item.length})` : typeof item;
    return `array(${value.length};item=${itemShape})`;
  }
  if (value && typeof value === 'object') {
    const fields = Object.keys(value).sort().map(key => {
      const field = value[key];
      const shape = field === null
        ? 'null'
        : Array.isArray(field)
        ? `array(${field.length}${field[0] && typeof field[0] === 'object' ? `;item=object(${Object.keys(field[0]).sort().map(safeText).join(',')})` : ''})`
        : field && typeof field === 'object'
          ? `object(${Object.keys(field).sort().map(safeText).join(',')})`
          : typeof field;
      return `${safeText(key)}:${shape}`;
    });
    return `object(${fields.join(';')})`;
  }
  return typeof value;
}

export function evidenceDiagnostics(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) return [];
  const lines = ['alert', 'applicationScanAlertUris', 'findings', 'nextPageToken', 'totalCount']
    .filter(key => key in report)
    .map(key => `${key}=${evidenceShape(report[key])}`);
  if (Array.isArray(report.findings?.[0]?.paths)) lines.push(`findings[0].paths=${evidenceShape(report.findings[0].paths)}`);
  if (report.applicationScanAlertUris?.[0]?.scan && typeof report.applicationScanAlertUris[0].scan === 'object') {
    lines.push(`applicationScanAlertUris[0].scan=${evidenceShape(report.applicationScanAlertUris[0].scan)}`);
  }
  return lines;
}

export function findingsFromEvidence(report) {
  assertFindingEnvelope(report, 'detail');
  if (Array.isArray(report?.findings)) return report.findings;
  if (report?.finding && typeof report.finding === 'object') return [report.finding];
  if (report?.plugin_id && Array.isArray(report.paths)) return [report];
  throw new Error(`Finding evidence used an unsupported schema: ${evidenceShape(report)}`);
}

export function findingPluginIds(report) {
  const ids = findingsFromEvidence(report).map(finding => String(finding?.plugin_id ?? ''));
  if (ids.some(id => !/^[a-z\d._:-]{1,128}$/i.test(id))) throw new Error('Finding evidence did not include a safe plugin identifier');
  return [...new Set(ids)];
}

export function assertCompleteFindingEvidence(finding) {
  // Structural consistency only: a CLI can return ten paths and total_paths=10
  // while the independently produced scan summary reports fourteen instances.
  const plugin = String(finding?.plugin_id ?? 'unknown');
  if (!Number.isInteger(finding?.total_paths) || finding.total_paths < 1 || !Array.isArray(finding.paths) || finding.paths.length !== finding.total_paths) {
    throw new Error(`Incomplete finding evidence for plugin ${safeText(plugin)}`);
  }
  if (finding.paths.some(path => !/^[a-f\d]{64}$/i.test(path?.finding_hash ?? ''))) {
    throw new Error(`Missing triage hash for plugin ${safeText(plugin)}`);
  }
}

function assertFindingEnvelope(report, source) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error(`Unsupported ${source} finding evidence schema`);
  if (report.error || ('success' in report && report.success !== true)) throw new Error(`${source} finding evidence contains an error`);
  for (const field of ['errors', 'warnings']) {
    if (field in report && (!Array.isArray(report[field]) || report[field].length)) throw new Error(`${source} finding evidence contains ${field}`);
  }
  for (const field of ['nextPageToken', 'next_page_token']) {
    if (field in report && report[field] !== null && report[field] !== '') throw new Error(`${source} finding evidence has an unconsumed continuation`);
  }
}

const cweIdentity = /^(?:CWE-)?([1-9]\d*)$/i;
// HawkScan 6.5.0 writes the WASC category (for example "Information Leakage")
// into the summary field named cweId. A category is not a CWE number.
const categoryIdentity = /^(?!Unknown$)(?!Server$)[A-Za-z][A-Za-z ]{1,80}$/;

function cweNumber(value) {
  const match = cweIdentity.exec(String(value ?? ''));
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  return Number(match[1]);
}

function evidenceMode(findings) {
  const classified = findings.map(finding => cweNumber(finding?.cweId) !== null);
  if (classified.every(Boolean)) return 'cwe';
  if (classified.some(Boolean)) throw new Error('summary finding has unsupported CWE identity');
  return 'category';
}

function findingGroup(finding, source, mode) {
  const severity = String(finding?.severity ?? '').toUpperCase();
  if (!['LOW', 'MEDIUM', 'HIGH'].includes(severity)) throw new Error(`${source} finding has unsupported severity`);
  if (mode === 'cwe') {
    const raw = source === 'summary' ? finding?.cweId : finding?.cwe_id;
    const cwe = cweNumber(raw);
    if (cwe === null) throw new Error(`${source} finding has unsupported CWE identity`);
    return `CWE-${cwe}/${severity}`;
  }
  const category = source === 'summary' ? finding?.cweId : finding?.category;
  if (typeof category !== 'string' || !categoryIdentity.test(category)) throw new Error(`${source} finding has unsupported CWE identity`);
  if (source === 'detail' && cweNumber(finding?.cwe_id) === null) throw new Error('detail finding has unsupported CWE identity');
  return `category:${category}/${severity}`;
}

function findingPathCounts(records, source) {
  const counts = new Map();
  for (const record of records) {
    const method = record?.method;
    const value = source === 'summary' ? record?.path : record?.uri;
    if (typeof method !== 'string' || !/^[A-Z]{1,16}$/i.test(method) || typeof value !== 'string' || !/^(https?:\/\/|\/)/.test(value)) {
      throw new Error(`${source} finding has unsupported method or path evidence`);
    }
    let url;
    try { url = new URL(value, host); } catch { throw new Error(`${source} finding has malformed path evidence`); }
    if (url.origin !== host || url.username || url.password) throw new Error(`${source} finding path has the wrong target origin`);
    const key = `${method.toUpperCase()} ${url.pathname}${url.search}${url.hash}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function assertReconciledFindingEvidence(summary, detail) {
  const id = scanId(summary);
  assertFindingEnvelope(summary, 'summary');
  if (summary.scan.status !== 'COMPLETED' || summary.scan.host !== host || summary.scan.environment !== 'CompanySiteCI') {
    throw new Error('Summary finding evidence is not a completed scan of the expected target');
  }
  if (!Array.isArray(summary.errors) || !Array.isArray(summary.warnings) || !Array.isArray(summary.findings)) {
    throw new Error('Summary finding evidence is missing findings, errors or warnings');
  }
  assertFindingEnvelope(detail, 'detail');
  if (!Array.isArray(detail.findings)) throw new Error('Unsupported full-detail finding evidence schema');
  // Do not synthesize native association from the query argument. If supplied,
  // an explicit identity must match; absence remains unverified, not cleared.
  if (('scanId' in detail && detail.scanId !== id) || ('scan' in detail && detail.scan?.id !== id)) {
    throw new Error('Detail finding evidence claims a mismatched scan association');
  }
  const mode = evidenceMode(summary.findings);
  const groups = new Map();
  for (const finding of summary.findings) {
    const key = findingGroup(finding, 'summary', mode);
    if (groups.has(key)) throw new Error('Ambiguous duplicate summary finding group');
    if (!Number.isInteger(finding.count) || finding.count < 1 || !Array.isArray(finding.paths) || finding.paths.length !== finding.count) {
      throw new Error(`Incomplete independent summary count for ${key}`);
    }
    groups.set(key, { count: finding.count, paths: findingPathCounts(finding.paths, 'summary') });
  }
  const seenGroups = new Set();
  const plugins = new Set();
  const hashes = new Set();
  for (const finding of detail.findings) {
    const key = findingGroup(finding, 'detail', mode);
    if (seenGroups.has(key)) throw new Error('Ambiguous duplicate detail finding group');
    seenGroups.add(key);
    const plugin = finding?.plugin_id;
    if (typeof plugin !== 'string' || !/^[a-z\d._:-]{1,128}$/i.test(plugin) || plugins.has(plugin)) throw new Error('Missing, unsafe or duplicate detail plugin identity');
    plugins.add(plugin);
    const expected = groups.get(key);
    if (!expected) throw new Error(`Unmatched independent finding group ${key}`);
    assertCompleteFindingEvidence(finding);
    if (finding.total_paths !== expected.count) throw new Error(`Finding count mismatch for ${key}: summary ${expected.count}, detail ${finding.total_paths}`);
    const actual = findingPathCounts(finding.paths, 'detail');
    if (actual.size !== expected.paths.size || [...expected.paths].some(([path, count]) => actual.get(path) !== count)) {
      throw new Error(`Finding method/path reconciliation mismatch for ${key}`);
    }
    for (const path of finding.paths) {
      const hash = path.finding_hash.toLowerCase();
      if (hashes.has(hash)) throw new Error('Duplicate finding hash cannot count as another evidence record');
      hashes.add(hash);
    }
  }
  if (seenGroups.size !== groups.size) throw new Error('Independent finding groups are missing from the detail evidence');
  return detail.findings;
}

const pageTokenIdentity = /^\d{1,6}$/;
const alertPageLimit = 50;

function alertUriRecord(uri, scan) {
  if (!uri || typeof uri !== 'object') throw new Error('Unsupported alert page schema');
  if (uri.scan && typeof uri.scan === 'object' && 'id' in uri.scan && uri.scan.id !== scan) {
    throw new Error('Detail finding evidence claims a mismatched scan association');
  }
  const method = uri.requestMethod ?? uri.method;
  const hash = uri.findingHash ?? uri.finding_hash;
  if (typeof method !== 'string' || typeof uri.uri !== 'string' || typeof hash !== 'string') {
    throw new Error('Unsupported alert page schema');
  }
  return { method, uri: uri.uri, status: typeof uri.status === 'string' ? uri.status : 'UNKNOWN', finding_hash: hash };
}

export function assemblePluginPaths(pages, scan) {
  if (!uuid.test(scan ?? '')) throw new Error('Scan did not return a valid scan ID');
  if (!Array.isArray(pages) || !pages.length) throw new Error('Incomplete finding evidence: no alert pages');
  if (pages.length > alertPageLimit) throw new Error('Alert page evidence has an unconsumed continuation');
  const paths = [];
  let total = null;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (!page || typeof page !== 'object' || Array.isArray(page) || !Array.isArray(page.applicationScanAlertUris)) {
      throw new Error('Unsupported alert page schema');
    }
    if (!Number.isInteger(page.totalCount) || page.totalCount < 1) throw new Error('Incomplete finding evidence: alert page omitted totalCount');
    if (total === null) total = page.totalCount;
    else if (page.totalCount !== total) throw new Error('Finding count mismatch between alert pages');
    const next = page.nextPageToken;
    const continued = next !== null && next !== undefined && next !== '';
    if (continued && !pageTokenIdentity.test(String(next))) throw new Error('Unsupported alert page schema');
    if (index < pages.length - 1 && !continued) throw new Error('Alert pages ended before the reported total');
    if (index === pages.length - 1 && continued) throw new Error('Alert page evidence has an unconsumed continuation');
    for (const uri of page.applicationScanAlertUris) paths.push(alertUriRecord(uri, scan));
  }
  if (paths.length !== total) throw new Error(`Finding count mismatch: alert pages ${paths.length}, totalCount ${total}`);
  return paths;
}

export function apiBase() {
  const raw = process.env.STACKHAWK_API_BASE;
  if (!raw) return 'https://api.stackhawk.com';
  const url = new URL(raw);
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if ((url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) || (!loopback && url.origin !== 'https://api.stackhawk.com')) {
    throw new Error('unsupported API base');
  }
  return url.origin;
}

const jwtIdentity = /^[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{1,4096}$/;

// GET /api/v1/scan/{scan}/alert/{plugin} rejects X-ApiKey with 401. The key is
// only valid on GET /api/v1/auth/login, which returns the bearer used below.
async function accessToken(fetchImpl) {
  const apiKey = process.env.HAWK_API_KEY;
  if (!/^[^\s]{8,}$/.test(apiKey ?? '')) throw new Error('API key unavailable');
  const response = await fetchImpl(new URL('/api/v1/auth/login', apiBase()), {
    headers: { Accept: 'application/json', 'X-ApiKey': apiKey },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`API login failed (${response.status})`);
  const body = await response.json();
  if (typeof body?.token !== 'string' || !jwtIdentity.test(body.token)) throw new Error('API login returned no access token');
  return body.token;
}

export async function fetchAlertPages(scan, pluginId, fetchImpl = globalThis.fetch) {
  if (!uuid.test(scan ?? '') || !/^[a-z\d._:-]{1,128}$/i.test(pluginId ?? '')) throw new Error('Finding evidence did not include a safe plugin identifier');
  const token = await accessToken(fetchImpl);
  const pages = [];
  let pageToken = '0';
  for (let index = 0; index < alertPageLimit; index += 1) {
    const url = new URL(`/api/v1/scan/${scan}/alert/${encodeURIComponent(pluginId)}`, apiBase());
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('pageToken', pageToken);
    const response = await fetchImpl(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`alert page request failed (${response.status})`);
    const page = await response.json();
    pages.push(page);
    const next = page?.nextPageToken;
    if (next === null || next === undefined || next === '') return pages;
    const advanced = String(next);
    if (advanced === pageToken) throw new Error('Alert page evidence has an unconsumed continuation');
    pageToken = advanced;
  }
  throw new Error('Alert page evidence has an unconsumed continuation');
}

export async function completeFindingDetail(detail, scan, fetchPages = pluginId => fetchAlertPages(scan, pluginId)) {
  assertFindingEnvelope(detail, 'detail');
  if (!uuid.test(scan ?? '')) throw new Error('Scan did not return a valid scan ID');
  if (('scanId' in detail && detail.scanId !== scan) || ('scan' in detail && detail.scan?.id !== scan)) {
    throw new Error('Detail finding evidence claims a mismatched scan association');
  }
  const findings = findingsFromEvidence(detail);
  if (!findings.length) return { ...detail, findings };
  const completed = [];
  for (const finding of findings) {
    const plugin = finding?.plugin_id;
    if (typeof plugin !== 'string' || !/^[a-z\d._:-]{1,128}$/i.test(plugin)) throw new Error('Finding evidence did not include a safe plugin identifier');
    const paths = assemblePluginPaths(await fetchPages(plugin), scan);
    completed.push({ ...finding, total_paths: paths.length, paths });
  }
  return { ...detail, findings: completed };
}

function printResult(result) {
  console.log(`StackHawk | Quality gate: ${result.expectedCount - result.untouched.length}/${result.expectedCount} sitemap routes observed; ${result.paths.size} target paths total`);
  console.log('StackHawk | Scope: public company frontend; live APIs, authentication and backend data are not scanned');
  console.log(`StackHawk | Response health: ${result.healthyCount}/${requiredPaths.length} changed pages/assets returned 200 with expected MIME and bytes; checkout ${safeText(result.checkoutSha)}`);
  if (result.untouched.length) console.log(`StackHawk | coverage-gap (evidence): ${result.untouched.map(safeText).join(', ')}`);
  printFindings(result.findings);
  for (const gap of result.gaps) console.error(`StackHawk | Gate failed: ${gap}`);
  console.log(`StackHawk | Results: https://app.stackhawk.com/scans/${result.id}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runCli = async () => {
    if (process.argv[2] === 'pages') {
      const detail = parseJson(readFileSync(process.argv[4], 'utf8'));
      const completed = await completeFindingDetail(detail, process.argv[3]);
      const findings = completed.findings ?? [];
      console.error(`StackHawk | Paged finding evidence: ${findings.length} findings, ${findings.reduce((count, finding) => count + finding.paths.length, 0)} instances`);
      process.stdout.write(`${JSON.stringify(completed)}\n`);
      return;
    }
    const report = parseJson(readFileSync(process.argv[3], 'utf8'));
    if (process.argv[2] === 'id') {
      evidenceDiagnostics(report).forEach(shape => console.error(`StackHawk | Scan report shape: ${shape}`));
      console.error(`StackHawk | Scan status: ${safeText(report?.scan?.status)}; threshold: ${safeText(report.thresholdResult)}`);
      printFindings(Array.isArray(report.findings) ? report.findings : [], console.error);
      for (const error of report.errors ?? []) console.error(`StackHawk | Scan error category: ${safeText(error.category)}`);
      for (const warning of report.warnings ?? []) console.error(`StackHawk | Scan warning category: ${safeText(warning.category)}`);
      console.log(scanId(report));
    }
    else if (process.argv[2] === 'plugin-ids') {
      evidenceDiagnostics(report).forEach(shape => console.error(`StackHawk | Finding evidence shape: ${shape}`));
      findingPluginIds(report).forEach(id => console.log(id));
    }
    else if (process.argv[2] === 'hashes') {
      evidenceDiagnostics(report).forEach(shape => console.error(`StackHawk | Finding evidence shape: ${shape}`));
      const findings = findingsFromEvidence(report);
      findings.forEach(assertCompleteFindingEvidence);
      console.log(`StackHawk | Structural finding detail: ${findings.length} findings; exhaustive enumeration unverified`);
      printFindings(findings);
    }
    else if (process.argv[2] === 'reconcile') {
      const detail = parseJson(readFileSync(process.argv[4], 'utf8'));
      const findings = assertReconciledFindingEvidence(report, detail);
      console.log(`StackHawk | Summary-reconciled finding evidence: ${findings.length} findings, ${findings.reduce((count, finding) => count + finding.paths.length, 0)} instances`);
      console.log('StackHawk | Native full-detail scan association and vendor pagination require separate verification');
    }
    else if (process.argv[2] === 'verify') {
      const uris = parseJson(readFileSync(process.argv[4], 'utf8'));
      const records = readFileSync(process.argv[5], 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
      const result = evaluate(report, uris, expectedRoutes(), { records, checkoutSha: process.env.COMMIT_SHA });
      // Structural diagnostics only: never print arbitrary API values or credentials.
      const list = Array.isArray(uris) ? uris : Array.isArray(uris?.uris) ? uris.uris : uris?.data;
      console.log(`StackHawk | URI schema: ${Array.isArray(uris) ? 'array' : safeText(Object.keys(uris ?? {}).join(', '))}; records=${Array.isArray(list) ? list.length : 'unsupported'}; first record=${list?.[0] && typeof list[0] === 'object' ? safeText(Object.keys(list[0]).join(', ')) : typeof list?.[0]}`);
      printResult(result);
      if (result.gaps.length) process.exitCode = 1;
    } else throw new Error('Use id, plugin-ids, hashes, pages, reconcile or verify with scan evidence files');
  };
  runCli().catch(error => {
    console.error(`StackHawk | Evidence unavailable: ${safeText(error.message)}`);
    process.exitCode = 1;
  });
}
