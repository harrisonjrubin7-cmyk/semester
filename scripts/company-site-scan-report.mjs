import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const host = 'https://localhost:4186';
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const requiredPaths = ['/', '/product', '/students', '/personal-academic-os', ...['search', 'today', 'courses', 'calendar', 'path', 'discover'].flatMap(screen => [`/screenshots/${screen}-desktop.jpg`, `/screenshots/${screen}-mobile.jpg`])];
const safeText = value => String(value).replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 180);

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
  if (uris?.scanId && uris.scanId !== expectedId) return paths;
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
    const bytes = readFileSync(new URL(`../company-site/${image ? path.slice(1) : 'index.html'}`, import.meta.url));
    return { path, contentType: image ? 'image/jpeg' : 'text/html; charset=utf-8', sha256: createHash('sha256').update(bytes).digest('hex') };
  });
}

export function evaluate(report, uris, routes = expectedRoutes(), evidence = {}) {
  const id = scanId(report);
  const gaps = [];
  if (report.scan.host !== host || report.scan.environment !== 'CompanySiteCI') gaps.push('surface-unscanned: wrong host or environment');
  if (report.scan.status !== 'COMPLETED') gaps.push('env-unreachable: scan did not complete');
  if (!Array.isArray(report.errors) || report.errors.length) gaps.push('scan errors or missing error evidence');
  if (!Array.isArray(report.findings)) gaps.push('missing findings evidence');
  if (report.thresholdResult !== 'PASS') gaps.push('security threshold did not pass');
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const actionable = findings.filter(finding => !Array.isArray(finding.paths) || !finding.paths.length || finding.paths.some(path => !['FALSE_POSITIVE', 'RISK_ACCEPTED'].includes(path.status)));
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
    const paths = (finding.paths ?? []).map(path => `${safeText(path.method)} ${safeText(String(path.path).split('?')[0])} [${safeText(path.status)}]`);
    write(`StackHawk | Finding: ${safeText(finding.severity)} ${safeText(finding.name)}; ${paths.join(', ')}`);
  }
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
  try {
    const report = parseJson(readFileSync(process.argv[3], 'utf8'));
    if (process.argv[2] === 'id') {
      console.error(`StackHawk | Scan status: ${safeText(report?.scan?.status)}; threshold: ${safeText(report.thresholdResult)}`);
      printFindings(Array.isArray(report.findings) ? report.findings : [], console.error);
      for (const error of report.errors ?? []) console.error(`StackHawk | Scan error category: ${safeText(error.category)}`);
      console.log(scanId(report));
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
    } else throw new Error('Use id or verify with scan evidence files');
  } catch (error) {
    console.error(`StackHawk | Evidence unavailable: ${safeText(error.message)}`);
    process.exitCode = 1;
  }
}
