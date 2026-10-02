import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCRIPT = join(__dirname, '../../../supabase/gateway-journal-backup-drill.sh');
const source = readFileSync(SCRIPT, 'utf8');

describe('the gateway-journal physical-backup marker', () => {
  it('is valid shell and has separate seed and verify phases', () => {
    expect(spawnSync('bash', ['-n', SCRIPT]).status).toBe(0);
    expect(source).toContain('seed|verify');
    expect(source).toContain('DRILL_DB_URL');
    expect(source).toContain('DRILL_TENANT_ID');
    expect(source).toContain('DRILL_MARKER');
    expect(source).toContain('DRILL_PROJECT_REF');
    expect(source).toContain('DRILL_SOURCE_PROJECT_REF');
  });

  it('writes only a labelled operational audit marker through the guarded RPC', () => {
    expect(source).toContain('public.gateway_write_audit_v2');
    expect(source).toContain("'semester-restore-drill'");
    expect(source).toContain("'backup.restore.marker'");
    expect(source).toContain('review_id is null');
    expect(source).not.toMatch(/gateway_save_review|sealed_body|student[_ -]?(name|email|id)/i);
  });

  it('refuses duplicates and verifies exactly one restored row', () => {
    expect(source).toContain('already exists; use a new unique marker');
    expect(source).toContain('expected 1 row');
    expect(source).toContain("correlation_id = :'marker'");
  });

  it('cannot verify against production or a connection for the wrong project', () => {
    expect(source).toContain('Verify must target a separately restored project, never production');
    expect(source).toContain('DRILL_DB_URL does not contain the declared DRILL_PROJECT_REF');
    expect(source).toMatch(/\^semester-restore-\[A-Za-z0-9\._:-\]\+\$/);

    const production = 'lzrqvlugnawcgywkhqlz';
    const marker = 'semester-restore-2026-10-02T150000Z';
    const againstProduction = spawnSync('bash', [SCRIPT, 'verify'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DRILL_DB_URL: `postgresql://postgres@db.${production}.supabase.co/postgres`,
        DRILL_PROJECT_REF: production,
        DRILL_SOURCE_PROJECT_REF: production,
        DRILL_MARKER: marker,
      },
    });
    expect(againstProduction.status).toBe(2);
    expect(againstProduction.stderr).toContain('never production');

    const wrongConnection = spawnSync('bash', [SCRIPT, 'verify'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        DRILL_DB_URL: `postgresql://postgres@db.${production}.supabase.co/postgres`,
        DRILL_PROJECT_REF: 'neykbjfxoxgaxjrprylt',
        DRILL_SOURCE_PROJECT_REF: production,
        DRILL_MARKER: marker,
      },
    });
    expect(wrongConnection.status).toBe(2);
    expect(wrongConnection.stderr).toContain('does not contain the declared DRILL_PROJECT_REF');
  });
});
