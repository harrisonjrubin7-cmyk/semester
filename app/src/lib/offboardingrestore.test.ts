/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  join(process.cwd(), '..', 'supabase', 'migrations', '20261026120000_offboarding_restore_integrity.sql'),
  'utf8',
);

describe('school offboarding restore integrity', () => {
  it('validates and locks every immutable undo target before enabling restoration', () => {
    const validate = sql.indexOf('for u in\n    select * from public.school_offboarding_undo');
    const enable = sql.indexOf("set_config('semester.offboarding_restore', 'on', true)");

    expect(validate).toBeGreaterThan(0);
    expect(enable).toBeGreaterThan(validate);
    expect(sql.slice(validate, enable)).toContain('for update');
    expect(sql.slice(validate, enable)).toContain("g.scope_id = c.tenant_id");
    expect(sql.slice(validate, enable)).toContain("i.tenant_id = c.tenant_id");
    expect(sql.slice(validate, enable)).toContain("r.tenant_id = c.tenant_id and r.state = 'suspended'");
  });

  it('fails visibly and atomically instead of counting attempted updates', () => {
    expect(sql).toContain('Restore paused:');
    expect(sql.match(/get diagnostics affected = row_count;/g)).toHaveLength(3);
    expect(sql.match(/if affected <> 1 then/g)).toHaveLength(3);
    expect(sql).not.toContain('n_grants := n_grants + affected');
    expect(sql).not.toContain('n_conns := n_conns + affected');
  });

  it('keeps purge, separation-of-duty, and successful audit boundaries', () => {
    expect(sql).toContain('if c.purge_authorized_by is not null then');
    expect(sql).toContain('if me = c.access_disabled_by then');
    expect(sql).toContain("'school.offboarding_restored'");
    expect(sql.indexOf("set status = 'restored'")).toBeLessThan(sql.indexOf("'school.offboarding_restored'"));
  });
});
