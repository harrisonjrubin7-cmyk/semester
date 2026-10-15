import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * No table or view reaches the database unclassified.
 *
 * `database/schema/table-classification.json` says what each table is for
 * isolation purposes: global, person-private, tenant-scoped, relationship-
 * scoped, parent-scoped or service-only. This test compares it with what the
 * migrations create, in both directions, so a new table cannot arrive without
 * a class and a class cannot outlive its table.
 *
 * What it does NOT check, because a static scan cannot: that the class is
 * *right* (the register was derived from production's catalog and has not been
 * read table by table), or that the policies on a table do what its class
 * says. That is `supabase/*.check.sql`'s job, against a real database.
 *
 * The scan strips SQL comments first. The first version of it did not, read the
 * rollback notes (`--   drop table if exists public.notes ...`) as drops, and
 * reported 28 tables production certainly has as missing.
 */
const root = new URL('../../../', import.meta.url).pathname;
const register = JSON.parse(readFileSync(join(root, 'database/schema/table-classification.json'), 'utf8')) as {
  classes: Record<string, string[]>;
};

const strip = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
const qualify = (schema: string | undefined, name: string) => (schema === 'private.' ? `private.${name}` : name);

/** Tables and views the migrations leave behind, applied in filename order. */
function migrated(dir = join(root, 'supabase/migrations')): Set<string> {
  const live = new Set<string>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
    const sql = strip(readFileSync(join(dir, f), 'utf8'));
    const events: Array<{ at: number; add: boolean; name: string }> = [];
    for (const m of sql.matchAll(/create (?:unlogged )?table (?:if not exists )?((?:public|private)\.)?([a-z_0-9]+)/g)) {
      events.push({ at: m.index ?? 0, add: true, name: qualify(m[1], m[2]) });
    }
    for (const m of sql.matchAll(/create (?:or replace )?(?:materialized )?view ((?:public|private)\.)?([a-z_0-9]+)/g)) {
      events.push({ at: m.index ?? 0, add: true, name: qualify(m[1], m[2]) });
    }
    for (const m of sql.matchAll(/drop (?:materialized )?(?:table|view) (?:if exists )?([^;]+);/g)) {
      for (const part of m[1].split(',')) {
        const t = /^\s*((?:public|private)\.)?([a-z_0-9]+)\s*$/.exec(part.replace(/\s+cascade\s*$/i, ''));
        if (t) events.push({ at: m.index ?? 0, add: false, name: qualify(t[1], t[2]) });
      }
    }
    for (const e of events.sort((a, b) => a.at - b.at)) {
      if (e.add) live.add(e.name);
      else live.delete(e.name);
    }
  }
  return live;
}

const classified = () => Object.values(register.classes).flat();

describe('table classification register', () => {
  it('finds what it is supposed to be looking at (the control)', () => {
    const live = migrated();
    // A scan that reads nothing, or a regex that matches nothing, makes the
    // assertions below vacuously true. These are tables that certainly exist.
    expect(live.size).toBeGreaterThan(300);
    for (const known of ['notes', 'family_grants', 'private.gateway_audit', 'published_forms']) {
      expect(live.has(known), `the scan does not see ${known}`).toBe(true);
    }
    // And it must not read a rollback comment as a drop.
    expect(live.has('notes')).toBe(true);
  });

  it('puts every name in exactly one known class', () => {
    const names = classified();
    expect(names.filter((n, i) => names.indexOf(n) !== i), 'classified twice').toEqual([]);
    expect(Object.keys(register.classes).sort()).toEqual(
      ['global-public', 'global-reference', 'parent-scoped', 'person-private', 'relationship-scoped', 'service-only', 'tenant-scoped', 'view'],
    );
    expect(register.classes['needs-review'], 'an unresolved class is not a class').toBeUndefined();
  });

  it('classifies every table the migrations create', () => {
    const have = new Set(classified());
    const missing = [...migrated()].filter((n) => !have.has(n)).sort();
    expect(missing, `add these to database/schema/table-classification.json: ${missing.join(', ')}`).toEqual([]);
  });

  it('lists nothing the migrations no longer create', () => {
    const live = migrated();
    const stale = classified().filter((n) => !live.has(n)).sort();
    expect(stale, `remove these from the register: ${stale.join(', ')}`).toEqual([]);
  });
});
