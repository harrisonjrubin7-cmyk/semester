import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, FUNCTIONS, type Category } from './definerregister';

/**
 * The 5 October 2026 foundation reading
 * (`docs/native-platform/FOUNDATION_EXPOSURE_READING.md`).
 *
 * Two controls are easy to "simplify" and both are load-bearing:
 *
 * - School enforcement defaults off, and the only writer asks the caller to
 *   acknowledge how many people a switch-on would lock out. Flipping the
 *   default to true skips that count. The reading measured zero schools, so
 *   the default is the control, not a forgotten flag.
 * - The anon grant reduction stays a proposal. Landing it as a migration
 *   without the check suites is the change the proposal itself refuses.
 *
 * Shown red by renaming `acknowledge_locked_out` in the migration (the
 * acknowledgement assertion fails) and by copying the proposal into
 * `supabase/migrations` (the unapplied assertion fails). Both edits were
 * reverted; neither is the committed tree.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const ENFORCEMENT = 'supabase/migrations/20260930185000_school_membership_enforcement.sql';
const SCHOOLS = 'supabase/migrations/20260921170000_schools.sql';
const PROPOSAL = 'database/proposed/anon_grant_reduction.sql';

describe('foundation exposure reading', () => {
  it('classifies every signed-in security-definer function the register names', () => {
    const names = FUNCTIONS.map(([name]) => name);
    expect(new Set(names).size).toBe(names.length);
    for (const [name, category] of FUNCTIONS) {
      expect(CATEGORIES[category as Category], name).toBeTruthy();
    }
  });

  it('keeps school enforcement off until the lockout count is acknowledged', () => {
    const sql = read(ENFORCEMENT);
    expect(sql).toContain('enforce_membership boolean not null default false');
    expect(sql).toContain('acknowledge_locked_out');
    expect(sql).toContain('school_enforcement_readiness');
    expect(read('supabase/tenancy.check.sql')).toContain('off for every school');
  });

  it('keeps the school list readable before sign-in and writes admin-only', () => {
    const sql = read(SCHOOLS);
    expect(sql).toMatch(/create policy schools_read on public\.schools\s+for select using \(true\)/);
    expect(sql).toContain('private.is_app_admin()');
  });

  it('has not applied the anon grant reduction as a migration', () => {
    expect(read(PROPOSAL)).toContain('PROPOSED, NOT APPLIED');
    const applied = readdirSync(join(root, 'supabase/migrations')).filter((name) =>
      name.includes('anon_grant'),
    );
    expect(applied).toEqual([]);
  });
});
