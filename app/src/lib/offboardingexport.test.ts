import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(import.meta.dirname, '../../../supabase/migrations/20261026150000_offboarding_export_package.sql'),
  'utf8',
);

const body = (name: string) =>
  new RegExp(`create or replace function ${name.replace('.', '\\.')}` + String.raw`[\s\S]*?\nend \$\$;`)
    .exec(sql)?.[0] ?? '';

describe('institution offboarding export package', () => {
  it('is operator-only and derives the tenant from an access-disabled case', () => {
    const fn = body('public.generate_offboarding_export');
    expect(fn).toContain('private.offboarding_operator()');
    expect(fn).toContain("private.offboarding_case(want, array['access_disabled'])");
    expect(fn).toContain('private.build_offboarding_export_package(want, c.tenant_id');
    expect(fn).not.toMatch(/want_tenant|tenant_id\s+text/);
  });

  it('locks the catalog-derived tenant scope, canonicalizes rows, and discloses redactions', () => {
    const fn = body('private.build_offboarding_export_package');
    expect(fn).toContain("lock table public.%I in share mode");
    expect(fn).toContain('private.school_tenant_tables(want_tenant)');
    expect(fn).toContain("jsonb_agg(q.row_data order by q.row_data::text)");
    expect(fn).toMatch(/password\|secret\|token\|credential/);
    expect(fn).toContain("rec.tbl = 'legal_holds'");
    expect(fn).toContain("'reason', 'matter_ref', 'release_reason'");
    expect(fn).toContain("'excluded_columns', to_jsonb(omitted)");
    expect(fn).toContain("'destructive_actions', '[]'::jsonb");
    expect(fn).not.toMatch(/\b(delete|truncate)\s+from\b/i);
  });

  it('fails visibly before assembling an oversized synchronous package', () => {
    const build = body('private.build_offboarding_export_package');
    const generate = body('public.generate_offboarding_export');
    expect(build).toContain('total_rows > 100000');
    expect(build).toContain("'synchronous_export_limit_exceeded'");
    expect(generate).toContain("if package ? '_error'");
    expect(generate).toContain('school.offboarding_export_generation_rejected');
  });

  it('hashes every file, the manifest, and the complete package', () => {
    const build = body('private.build_offboarding_export_package');
    const generate = body('public.generate_offboarding_export');
    expect(build).toContain("pg_catalog.sha256(pg_catalog.convert_to(rows::text, 'UTF8'))");
    expect(generate).toContain("pg_catalog.sha256(pg_catalog.convert_to(manifest::text, 'UTF8'))");
    expect(generate).toContain("pg_catalog.sha256(pg_catalog.convert_to(package::text, 'UTF8'))");
    expect(build).toContain("'legal_hold_effect', 'preserve_data; export_does_not_authorize_deletion'");
    expect(sql).not.toContain('jsonb_object_length');
    expect(generate).toContain('from jsonb_object_keys(counts)');
  });

  it('makes retries actor-bound and returns no package when the snapshot changed', () => {
    const fn = body('public.generate_offboarding_export');
    expect(fn).toContain("'replay_operator_mismatch'");
    expect(fn).toContain("'snapshot_changed'");
    const changed = /if \(prior\.manifest_sha256[\s\S]*?end if;/.exec(fn)?.[0] ?? '';
    expect(changed).toContain("'ok', false");
    expect(changed).not.toContain("'package', package");
    expect(fn).toContain("'school.offboarding_export_replay_rejected'");
  });

  it('records delivery only against the caller\'s immutable generation receipt', () => {
    const fn = body('public.record_generated_offboarding_export');
    expect(fn).toContain('from private.offboarding_export_generation');
    expect(fn).toContain('id = want_generation and case_id = want and generated_by = me');
    expect(fn).toContain('export_generation_id = g.id');
    expect(fn).toContain('export_package_sha256 = g.package_sha256');
  });
});
