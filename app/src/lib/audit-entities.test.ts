/*
 * `tenant_policy_audit_event.entity_type` is a closed list, and a migration
 * that audits a new table widens it by dropping the constraint and adding it
 * back with the whole list written out. The last migration to do that wins.
 *
 * Several sessions write migrations at once, so two of them can each widen the
 * list from the same starting point: the second to land then re-adds the
 * constraint without the first one's names, and every audit insert for those
 * tables starts failing — in production, on the next write to a governed
 * table, and in no test that exercises only its own tables. That is what
 * 20260928090000_gtm_foundation.sql did to 20260927235000_governance_registries.sql
 * until it was caught by hand.
 *
 * So: walking the migrations in the order they apply, no redefinition of the
 * list may drop a name an earlier one allowed.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), '..', 'supabase', 'migrations');
const CONSTRAINT = /add constraint tenant_policy_audit_event_entity_type_check check \(entity_type in \(([^)]*)\)\)/g;

function redefinitions(): { file: string; names: string[] }[] {
  const out: { file: string; names: string[] }[] = [];
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const m of sql.matchAll(CONSTRAINT)) out.push({ file, names: [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) });
  }
  return out;
}

/** The table the original migration created the list with, which is not written as `add constraint`. */
function original(): string[] {
  const sql = readFileSync(join(MIGRATIONS, '20260923210000_intelligence_policy.sql'), 'utf8');
  const m = sql.match(/entity_type text not null check \(entity_type in \(([^)]*)\)\)/);
  expect(m, 'the original entity_type list was not found').not.toBeNull();
  return [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
}

describe('the audit entity list', () => {
  it('never loses a name as later migrations redefine it', () => {
    let allowed = new Set(original());
    for (const { file, names } of redefinitions()) {
      const dropped = [...allowed].filter((n) => !names.includes(n));
      expect(dropped, `${file} redefines the audit entity list without ${dropped.join(', ')}`).toEqual([]);
      allowed = new Set(names);
    }
  });

  it('and the probe sees the redefinitions it is guarding (the control)', () => {
    const files = redefinitions().map((r) => r.file);
    expect(files).toContain('20260927170000_integration_control_plane.sql');
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(original()).toContain('consent_record');
  });
});
