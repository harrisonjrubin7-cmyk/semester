#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function day(value, field) {
  if (!ISO_DATE.test(value)) throw new Error(`${field} must be an ISO date`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${field} is not a date`);
  return parsed;
}

function validateAllowlist(allowlist, now) {
  if (allowlist?.schema !== 1 || !Array.isArray(allowlist.entries)) {
    throw new Error('allowlist must use schema 1 and contain an entries array');
  }
  const seen = new Set();
  for (const [index, entry] of allowlist.entries.entries()) {
    const label = `entries[${index}]`;
    if (!entry || typeof entry !== 'object') throw new Error(`${label} must be an object`);
    if (typeof entry.package !== 'string' || entry.package.length === 0) throw new Error(`${label}.package is required`);
    if (!Number.isInteger(entry.source) || entry.source <= 0) throw new Error(`${label}.source must be a positive npm advisory source`);
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) throw new Error(`${label}.reason must explain the risk acceptance`);
    if (entry.owner !== 'security') throw new Error(`${label}.owner must be security`);
    const reviewed = day(entry.reviewedOn, `${label}.reviewedOn`);
    const expires = day(entry.expiresOn, `${label}.expiresOn`);
    if (reviewed > now) throw new Error(`${label}.reviewedOn cannot be in the future`);
    if (expires < reviewed) throw new Error(`${label}.expiresOn cannot precede reviewedOn`);
    const key = `${entry.package}:${entry.source}`;
    if (seen.has(key)) throw new Error(`${label} duplicates ${key}`);
    seen.add(key);
  }
}

function issuesFrom(report) {
  if (!report || typeof report !== 'object') throw new Error('audit report must be an object');
  if (report.error) throw new Error(`npm audit did not complete: ${report.error.summary ?? report.error.code ?? 'unknown error'}`);
  if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object') {
    throw new Error('npm audit report has no vulnerabilities object');
  }
  const issues = [];
  for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities)) {
    if (!BLOCKING_SEVERITIES.has(vulnerability?.severity)) continue;
    const advisories = Array.isArray(vulnerability.via)
      ? vulnerability.via.filter((via) => via && typeof via === 'object' && BLOCKING_SEVERITIES.has(via.severity))
      : [];
    if (advisories.length === 0) {
      issues.push({ package: packageName, source: null, severity: vulnerability.severity, fixAvailable: vulnerability.fixAvailable });
      continue;
    }
    for (const advisory of advisories) {
      issues.push({
        package: packageName,
        source: Number.isInteger(advisory.source) ? advisory.source : null,
        severity: advisory.severity,
        title: advisory.title,
        url: advisory.url,
        fixAvailable: vulnerability.fixAvailable,
      });
    }
  }
  return issues;
}

export function evaluateAudit(report, allowlist, { now = new Date() } = {}) {
  const today = day(now.toISOString().slice(0, 10), 'current date');
  validateAllowlist(allowlist, today);
  const issues = issuesFrom(report);
  const allowed = [];
  const blocked = [];
  for (const issue of issues) {
    const exception = allowlist.entries.find((entry) => entry.package === issue.package && entry.source === issue.source);
    const exceptionIsCurrent = exception && day(exception.expiresOn, 'expiresOn') >= today;
    if (exceptionIsCurrent && issue.fixAvailable === false) allowed.push({ ...issue, exception });
    else blocked.push({
      ...issue,
      reason: !exception
        ? 'no reviewed exception'
        : !exceptionIsCurrent
          ? `exception expired ${exception.expiresOn}`
          : 'npm reports a fix is available',
    });
  }
  return { allowed, blocked };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`${name} is required`);
  return process.argv[index + 1];
}

function run() {
  const auditPath = argument('--audit');
  const allowlistPath = argument('--allowlist');
  const now = process.env.DEPENDENCY_AUDIT_DATE ? day(process.env.DEPENDENCY_AUDIT_DATE, 'DEPENDENCY_AUDIT_DATE') : new Date();
  const report = JSON.parse(readFileSync(auditPath, 'utf8'));
  const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
  const result = evaluateAudit(report, allowlist, { now });
  for (const issue of result.allowed) {
    console.log(`Allowed until ${issue.exception.expiresOn}: ${issue.package} advisory ${issue.source} (${issue.severity})`);
  }
  if (result.blocked.length > 0) {
    console.error('Dependency audit blocked:');
    for (const issue of result.blocked) {
      console.error(`- ${issue.package} advisory ${issue.source ?? 'unidentified'} (${issue.severity}): ${issue.reason}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log(`Dependency audit passed: ${result.allowed.length} time-bound exception(s), no unaccepted high or critical advisories.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(`Dependency audit could not be evaluated: ${error.message}`);
    process.exitCode = 2;
  }
}
