#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function required(value, name) {
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function iso(value, name) {
  const parsed = new Date(required(value, name));
  if (Number.isNaN(parsed.valueOf())) throw new Error(`${name} must be an ISO-8601 timestamp.`);
  return parsed.toISOString();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument: ${key ?? ''}`);
    args[key.slice(2)] = value;
  }
  return args;
}

function validateRegister(register) {
  if (register.schemaVersion !== 1 || register.targetPostgresMajor !== 17 || !Array.isArray(register.items)) {
    throw new Error('The unresolved-policy register has an unsupported shape.');
  }
  const ids = new Set();
  for (const item of register.items) {
    if (!/^POL-RLS-\d{3}$/.test(item.id) || ids.has(item.id)) throw new Error(`Invalid or duplicate policy id: ${item.id}`);
    if (!['open', 'accepted', 'closed'].includes(item.status)) throw new Error(`Invalid status for ${item.id}.`);
    if (!['critical', 'high', 'medium', 'low'].includes(item.severity)) throw new Error(`Invalid severity for ${item.id}.`);
    if (!item.title || !item.closureCriteria || !Array.isArray(item.evidence) || item.evidence.length === 0) {
      throw new Error(`Incomplete policy item: ${item.id}.`);
    }
    ids.add(item.id);
  }
}

function suiteResults(log, suites) {
  return suites.map((suite) => {
    const escaped = suite.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pass = new RegExp(`✓ ${escaped} — (\\d+) checks`).exec(log);
    if (pass) return { suite, outcome: 'passed', checkCount: Number(pass[1]) };
    if (new RegExp(`✗ ${escaped}(?: —|$)`, 'm').test(log)) return { suite, outcome: 'failed', checkCount: 0 };
    return { suite, outcome: 'not_run', checkCount: 0 };
  });
}

export function buildPolicyEvidence(args) {
  const status = required(args.status, 'status');
  if (!['passed', 'failed'].includes(status)) throw new Error('status must be passed or failed.');
  const exitCode = Number(required(args['exit-code'], 'exit-code'));
  if (!Number.isInteger(exitCode) || exitCode < 0) throw new Error('exit-code must be a non-negative integer.');
  if ((status === 'passed') !== (exitCode === 0)) throw new Error('status and exit-code disagree.');

  const registerPath = resolve(root, 'database/UNRESOLVED_POLICY_REGISTER.json');
  const registerText = readFileSync(registerPath, 'utf8');
  const register = JSON.parse(registerText);
  validateRegister(register);

  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  const major = Number(/^\s*major_version\s*=\s*(\d+)/m.exec(config)?.[1]);
  if (major !== register.targetPostgresMajor) throw new Error('PostgreSQL target and unresolved-policy register disagree.');

  const suites = readdirSync(resolve(root, 'supabase'))
    .filter((file) => file.endsWith('.check.sql'))
    .sort();
  const migrations = readdirSync(resolve(root, 'supabase/migrations'))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const log = readFileSync(resolve(args.log), 'utf8');
  const results = suiteResults(log, suites);
  const openItems = register.items.filter((item) => item.status === 'open');
  const clusterCreated = new RegExp(`starting a throwaway PostgreSQL ${major}\\b`).test(log);
  const migrationReapplyVerified = log.includes('every other migration applied twice; the schema and the rows in');
  const passedSuiteCount = results.filter((result) => result.outcome === 'passed').length;
  const failedSuiteCount = results.filter((result) => result.outcome === 'failed').length;
  const notRunSuiteCount = results.filter((result) => result.outcome === 'not_run').length;
  if (status === 'passed' && (!clusterCreated || !migrationReapplyVerified || passedSuiteCount !== suites.length)) {
    throw new Error('A passing report requires the PostgreSQL 17 cluster, successful migration reapply, and every policy suite.');
  }

  return {
    schemaVersion: 1,
    generatedAt: iso(args['finished-at'], 'finished-at'),
    repository: {
      commitSha: required(args.commit, 'commit'),
      ref: required(args.ref, 'ref'),
      workflowRunId: args['run-id'] || null,
    },
    target: {
      engine: 'PostgreSQL',
      majorVersion: major,
      source: 'supabase/config.toml',
    },
    execution: {
      status,
      exitCode,
      startedAt: iso(args['started-at'], 'started-at'),
      finishedAt: iso(args['finished-at'], 'finished-at'),
      cleanClusterCreated: clusterCreated,
      migrationReapplyVerified,
      productionDataTouched: false,
      migrationCount: migrations.length,
      suiteCount: suites.length,
      passedSuiteCount,
      failedSuiteCount,
      notRunSuiteCount,
      assertionCount: results.reduce((total, result) => total + result.checkCount, 0),
    },
    suites: results,
    unresolvedPolicyRegister: {
      path: 'database/UNRESOLVED_POLICY_REGISTER.json',
      sha256: sha256(registerText),
      reviewedAt: register.reviewedAt,
      openCount: openItems.length,
      openIds: openItems.map((item) => item.id),
    },
    claimBoundary: 'This artifact proves only the recorded ephemeral PostgreSQL policy run for this commit. It does not prove production tenant isolation, institutional approval, or GA readiness.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const output = resolve(required(args.output, 'output'));
  const report = buildPolicyEvidence(args);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
}
