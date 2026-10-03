import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function scannedPaths(uris) {
  const paths = new Set();
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (value && typeof value === 'object') return Object.values(value).forEach(visit);
    if (typeof value !== 'string' || !/^(https?:\/\/|\/)/.test(value)) return;
    try {
      const url = new URL(value, host);
      if (url.origin === host) paths.add(url.pathname);
    } catch { /* Malformed scanner probes are not coverage evidence. */ }
  };
  visit(uris);
  return paths;
}

export function evaluate(report, uris, routes = expectedRoutes()) {
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
  const paths = scannedPaths(uris);
  if (!paths.size) gaps.push('surface-unscanned: no target URI evidence');
  const missingRequired = requiredPaths.filter(path => !paths.has(path));
  if (missingRequired.length) gaps.push(`surface-unscanned: changed pages/assets untouched: ${missingRequired.join(', ')}`);
  const untouched = routes.filter(path => !paths.has(path));
  return { id, gaps, findings, paths, untouched, expectedCount: routes.length };
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
      const result = evaluate(report, uris);
      printResult(result);
      if (result.gaps.length) process.exitCode = 1;
    } else throw new Error('Use id or verify with scan evidence files');
  } catch (error) {
    console.error(`StackHawk | Evidence unavailable: ${safeText(error.message)}`);
    process.exitCode = 1;
  }
}
