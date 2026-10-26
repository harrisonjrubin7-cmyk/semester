import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20261026180000_offboarding_purge_preview.sql'),
  'utf8',
);

const previewBody = migration.match(
  /create or replace function public\.preview_school_purge[\s\S]*?\$\$;\n\nrevoke all on function public\.preview_school_purge/,
)?.[0] ?? '';

describe('synthetic-only purge preview boundary', () => {
  it('adds a preview but no purge implementation or tenant mutation', () => {
    expect(previewBody).toContain("tenant_is_demo is distinct from true");
    expect(previewBody).toContain("'available', false");
    expect(previewBody).toContain("'enabled', false");
    expect(previewBody).toContain("'executed', false");
    expect(previewBody).not.toMatch(/\b(delete\s+from|truncate\s+|update\s+public\.|insert\s+into\s+public\.)/i);
    expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?function\s+public\.(purge|delete)_/i);
  });

  it('requires both platform authorities and binds replay to actor and snapshot', () => {
    expect(previewBody).toContain("private.has_capability('console:operate', 'platform', '')");
    expect(previewBody).toContain('private.offboarding_operator()');
    expect(previewBody).toContain('prior.generated_by <> me');
    expect(previewBody).toContain('prior.snapshot_sha256 <> snapshot_hash');
    expect(migration).toContain('before update or delete on private.offboarding_purge_preview_receipt');
  });

  it('exposes explicit holds, retention, manifest integrity, exact counts, audit, and fallback metadata', () => {
    for (const required of [
      "'legal_hold'", "'retention'", "'export_manifest'", "'affected_records'", "'approval'",
      "'blockers'", "'destructive_action'", "'fallback'", 'private.record_audit',
    ]) expect(previewBody).toContain(required);
    expect(previewBody).toContain('private.school_tenant_tables(c.tenant_id)');
    expect(previewBody).toContain('generation.manifest_sha256 = encode');
  });
});
