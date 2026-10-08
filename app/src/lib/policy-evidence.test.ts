import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('PostgreSQL policy evidence', () => {
  it('keeps a finite machine-readable register of unresolved policy work', () => {
    const register = JSON.parse(readFileSync(join(root, 'database/UNRESOLVED_POLICY_REGISTER.json'), 'utf8'));
    expect(register.schemaVersion).toBe(1);
    expect(register.targetPostgresMajor).toBe(17);
    expect(register.items.length).toBeGreaterThan(0);
    expect(new Set(register.items.map((item: { id: string }) => item.id)).size).toBe(register.items.length);
    for (const item of register.items) {
      expect(item.id).toMatch(/^POL-RLS-\d{3}$/);
      expect(['open', 'accepted', 'closed']).toContain(item.status);
      expect(item.evidence.length).toBeGreaterThan(0);
      expect(item.closureCriteria.length).toBeGreaterThan(20);
      for (const evidence of item.evidence) expect(readFileSync(join(root, evidence), 'utf8').length).toBeGreaterThan(0);
    }
  });

  it('renders an exact-commit pass report without claiming production verification', () => {
    const directory = mkdtempSync(join(tmpdir(), 'semester-policy-evidence-'));
    temporary.push(directory);
    const log = join(directory, 'check.log');
    const output = join(directory, 'evidence.json');
    const suites = readFileSync(join(root, 'supabase/check.sh'), 'utf8');
    expect(suites).toContain('every policy check passed');
    const suiteNames = readdirSync(join(root, 'supabase')).filter((file) => file.endsWith('.check.sql')).sort();
    writeFileSync(log, [
      '· starting a throwaway PostgreSQL 17 in /tmp/example',
      '  ✓ every other migration applied twice; the schema and the rows in 70 tables are unchanged',
      ...suiteNames.map((suite) => `  ✓ ${suite} — 4 checks`),
      '· every policy check passed',
      '',
    ].join('\n'));

    execFileSync(process.execPath, [
      join(root, 'scripts/write-pg-policy-evidence.mjs'),
      '--output', output,
      '--status', 'passed',
      '--exit-code', '0',
      '--started-at', '2026-10-08T12:00:00Z',
      '--finished-at', '2026-10-08T12:01:00Z',
      '--commit', '0123456789abcdef',
      '--ref', 'refs/heads/test',
      '--run-id', '1234',
      '--log', log,
    ]);

    const report = JSON.parse(readFileSync(output, 'utf8'));
    expect(report.repository).toEqual({ commitSha: '0123456789abcdef', ref: 'refs/heads/test', workflowRunId: '1234' });
    expect(report.target).toMatchObject({ engine: 'PostgreSQL', majorVersion: 17 });
    expect(report.execution).toMatchObject({ status: 'passed', exitCode: 0, cleanClusterCreated: true, migrationReapplyVerified: true, productionDataTouched: false });
    expect(report.execution.suiteCount).toBeGreaterThan(20);
    expect(report.execution.passedSuiteCount).toBe(report.execution.suiteCount);
    expect(report.execution.notRunSuiteCount).toBe(0);
    expect(report.unresolvedPolicyRegister.openCount).toBeGreaterThan(0);
    expect(report.claimBoundary).toContain('does not prove production tenant isolation');
  });

  it('retains an honest failed report when the harness stops before the suites', () => {
    const directory = mkdtempSync(join(tmpdir(), 'semester-policy-evidence-failure-'));
    temporary.push(directory);
    const log = join(directory, 'check.log');
    const output = join(directory, 'evidence.json');
    writeFileSync(log, 'No PostgreSQL 17 server found\n');

    execFileSync(process.execPath, [
      join(root, 'scripts/write-pg-policy-evidence.mjs'),
      '--output', output,
      '--status', 'failed',
      '--exit-code', '2',
      '--started-at', '2026-10-08T12:00:00Z',
      '--finished-at', '2026-10-08T12:00:01Z',
      '--commit', 'fedcba9876543210',
      '--ref', 'refs/heads/test',
      '--run-id', '',
      '--log', log,
    ]);

    const report = JSON.parse(readFileSync(output, 'utf8'));
    expect(report.execution).toMatchObject({
      status: 'failed',
      exitCode: 2,
      cleanClusterCreated: false,
      migrationReapplyVerified: false,
      passedSuiteCount: 0,
      failedSuiteCount: 0,
    });
    expect(report.execution.notRunSuiteCount).toBe(report.execution.suiteCount);
  });

  it('uploads the report even when the policy gate fails', () => {
    const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toMatch(/name: Check the database policies[\s\S]*?if: always\(\)[\s\S]*?run: supabase\/policy-evidence\.sh/);
    expect(workflow).toMatch(/name: Keep the PostgreSQL policy evidence[\s\S]*if: always\(\)/);
    expect(workflow).toContain('pg17-policy-evidence-${{ github.sha }}');
    expect(workflow).toContain('if-no-files-found: error');
  });
});
