/**
 * The catalog's lists against the check constraints the database enforces,
 * value for value.
 *
 * `pipeline.test.ts` asks a weaker question: that every word in the catalog
 * appears *somewhere* in the migrations. That passes when the database
 * accepts a value the catalog has never heard of, and when a word only turns
 * up in an unrelated table. This asks the question the catalog's header
 * promises: that each list equals the constraint that wins, where a later
 * migration's `add constraint` replaces an earlier inline check.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANONICAL_ENTITIES, CONFLICT_KINDS, CONNECTION_STATUSES, PROVIDER_DOMAINS } from './catalog';

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations');

const uncommented = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

/**
 * The values of the check on `table.column` that production enforces: the
 * last `check (<column> in (…))` across the migrations in filename order —
 * `check (<column> is null or <column> in (…))` included — unless a later
 * `drop constraint` removed it with nothing put back, in which case there is
 * none and this throws, because the database then accepts anything.
 *
 * A check belongs to the `create table` or `alter table` statement it sits
 * in, so the same column name on another table is never read. A drop is
 * matched by Postgres's name for the check, `<table>_<column>_check`, which
 * is the name an inline check gets and the name every replacement here uses.
 */
function enforced(table: string, column: string): string[] {
  let last: string[] | null = null;
  const name = `${table}_${column}_check`;
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    const sql = uncommented(readFileSync(resolve(MIGRATIONS, f), 'utf8'));
    const events: { at: number; values: string[] | null }[] = [];
    const check = new RegExp(`check\\s*\\(\\s*(?:${column}\\s+is\\s+null\\s+or\\s+)?${column}\\s+in\\s*\\(([^)]*)\\)`, 'gi');
    for (const m of sql.matchAll(check)) {
      const owner = [...sql.slice(0, m.index).matchAll(/\b(?:create|alter)\s+table\s+(?:if\s+(?:not\s+)?exists\s+)?(?:only\s+)?(?:public\s*\.\s*)?([a-z_][a-z0-9_]*)/gi)].pop();
      if (owner?.[1].toLowerCase() !== table) continue;
      events.push({ at: m.index, values: [...m[1].matchAll(/'([^']+)'/g)].map((v) => v[1]) });
    }
    const drop = new RegExp(`\\bdrop\\s+constraint\\s+(?:if\\s+exists\\s+)?"?${name}"?\\b`, 'gi');
    for (const m of sql.matchAll(drop)) events.push({ at: m.index, values: null });
    for (const e of events.sort((a, b) => a.at - b.at)) last = e.values;
  }
  if (!last) throw new Error(`no check constraint on ${table}.${column} is in force`);
  return last;
}

describe('the integration catalog', () => {
  it('names exactly the provider domains the database accepts', () => {
    expect([...PROVIDER_DOMAINS].sort()).toEqual(enforced('integration_connections', 'provider_domain').sort());
  });

  it('names exactly the canonical entities a mapping may target', () => {
    expect([...CANONICAL_ENTITIES].sort()).toEqual(enforced('integration_mappings', 'canonical_entity_type').sort());
  });

  it('names exactly the conflict kinds a mapping may record', () => {
    expect([...CONFLICT_KINDS].sort()).toEqual(enforced('integration_mappings', 'conflict_kind').sort());
  });

  it('names exactly the statuses a connection may be in', () => {
    expect([...CONNECTION_STATUSES].sort()).toEqual(enforced('integration_connections', 'status').sort());
  });

  it('reads the constraint that wins, not the first one written', () => {
    // A control on the reader: space_availability was added to the canonical
    // entities by a later migration's `add constraint`, not by the original
    // inline check. A reader that stopped at the first match would miss it.
    expect(enforced('integration_mappings', 'canonical_entity_type')).toContain('space_availability');
  });
});
