import { accessSync, chmodSync, constants, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('the live staging parity comparator', () => {
  const script = read('supabase/compare-databases.sh');

  it('is executable and fails closed', () => {
    expect(() => accessSync(join(root, 'supabase/compare-databases.sh'), constants.X_OK)).not.toThrow();
    expect(script).toContain('set -euo pipefail');
    expect(script).toContain('exit "$fail"');
  });

  it('uses named libpq services rather than secrets in arguments or output', () => {
    expect(script).toContain('SEMESTER_STAGING_PGSERVICE');
    expect(script).toContain('SEMESTER_PRODUCTION_PGSERVICE');
    expect(script).not.toMatch(/DATABASE_URL|SUPABASE_DB_PASSWORD/);
    expect(script).not.toMatch(/set -x|echo .*service=/);
  });

  it('compares fingerprints, Postgres major, live RLS and the default-RLS trigger', () => {
    for (const held of ['fingerprint.sql', 'major_version', 'public_tables_without_rls', 'ensure_rls_trigger', 'diff -u']) {
      expect(script, held).toContain(held);
    }
  });

  it('keeps Edge Function versions and branch secrets outside its claim', () => {
    expect(script).toContain('It does not inspect Edge Function');
    expect(script).toContain('Still verify Edge Function versions and branch secrets');
    expect(read('STAGING.md')).toContain('supabase/compare-databases.sh');
  });

  it('passes only when both live reads match and both controls are healthy', () => {
    const work = mkdtempSync(join(tmpdir(), 'semester-parity-'));
    const fake = join(work, 'psql');
    writeFileSync(fake, `#!/usr/bin/env bash
case "$*" in
  *fingerprint.sql*)
    if [[ "$1" == service=drifted ]]; then echo 'columns drift'; else echo 'columns same'; fi
    ;;
  *)
    printf 'major=17\\npublic_tables_without_rls=0\\nensure_rls_trigger=1\\n'
    ;;
esac
`);
    chmodSync(fake, 0o700);
    try {
      const run = (stage: string) => spawnSync(join(root, 'supabase/compare-databases.sh'), [], {
        encoding: 'utf8',
        env: {
          PATH: process.env.PATH,
          SEMESTER_PSQL_BIN: fake,
          SEMESTER_STAGING_PGSERVICE: stage,
          SEMESTER_PRODUCTION_PGSERVICE: 'production',
        },
      });
      const pass = run('staging');
      expect(pass.status, pass.stderr).toBe(0);
      expect(pass.stdout).toContain('database parity passed');
      const drift = run('drifted');
      expect(drift.status).toBe(1);
      expect(drift.stderr).toContain('schema fingerprints differ');
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
