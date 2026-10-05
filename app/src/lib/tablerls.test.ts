import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every table this repository creates says `enable row level security` itself.
 *
 * It does not have to. `20260901000100_schema.sql` installs an event trigger,
 * `ensure_rls`, that turns row-level security on for every table created in
 * `public` — production has it, `local.stub.sql` reproduces it, and a
 * migration that forgets the line therefore ends up with RLS on anyway. Which
 * means **nothing that runs SQL can tell the difference** between a migration
 * that meant it and one that forgot: the database looks identical either way,
 * and every policy suite passes.
 *
 * The difference matters because of what sits on the other side of it. A new
 * table in `public` is created with Supabase's default privileges already
 * attached — `grant all on tables to anon, authenticated, service_role` — so
 * RLS is the only thing between a fresh table and the publishable key that
 * ships in the page source. A table that has it only because an event trigger
 * supplied it is a table whose safety is a dashboard setting, one `drop event
 * trigger` away, and nowhere in this repository's own text.
 *
 * So this reads the migrations rather than the database, for the reason
 * `CLAUDE.md` gives about `rootunmount.test.ts`: a structural check catches
 * what a runtime probe cannot. It cannot be satisfied by the platform being
 * helpful, because it never asks the platform.
 *
 * ## Why the parser strips quotes and comments first
 *
 * The first version of this reported one table missing, named `AS`. It had
 * matched `'CREATE TABLE AS'` — a *string literal* inside the `ensure_rls`
 * trigger definition, listing the command tags it fires on. A census that
 * counts the thing it is looking for inside a quoted string is the
 * false-positive shape this directory keeps finding in its own instruments, so
 * comments and single-quoted strings come out before anything is matched.
 */

const ROOT = join(process.cwd(), '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

/**
 * The SQL with comments and string literals removed.
 *
 * Dollar-quoted bodies are left alone deliberately: a `create table` inside a
 * function body is still a table this repository creates, and blanking those
 * would hide it. What is removed is only what cannot be a statement — `--` to
 * end of line, `/* … *\/` spans, and `'…'` literals.
 */
function code(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

type Made = { table: string; file: string };

/** Every table created across `migrations/`, schema-qualified names included. */
function created(): Made[] {
  const out: Made[] = [];
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql'))) {
    const sql = code(readFileSync(join(MIGRATIONS, f), 'utf8'));
    const re =
      /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(private|public)\s*\.\s*)?([a-z_][a-z0-9_]*)/gi;
    for (const m of sql.matchAll(re)) {
      out.push({ table: `${(m[1] ?? 'public').toLowerCase()}.${m[2].toLowerCase()}`, file: f });
    }
  }
  return out;
}

/** Every table `migrations/` turns row-level security on for, anywhere. */
function enabled(): Set<string> {
  const found = new Set<string>();
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql'))) {
    const sql = code(readFileSync(join(MIGRATIONS, f), 'utf8'));
    const re =
      /\balter\s+table\s+(?:(private|public)\s*\.\s*)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi;
    for (const m of sql.matchAll(re)) {
      found.add(`${(m[1] ?? 'public').toLowerCase()}.${m[2].toLowerCase()}`);
    }
  }
  return found;
}

describe('row-level security is stated, not inherited', () => {
  /*
   * The control, first. A parser that stopped matching returns no tables, and
   * no tables means nothing is missing one — the assertion below would pass
   * having read nothing, which is the failure this repository keeps finding in
   * its own instruments rather than in its schema.
   *
   * A floor rather than a count: tables arrive, and an exact number turns every
   * new one into a failing test that gets its number bumped without being read.
   */
  it('finds the tables the migrations create', () => {
    const tables = new Set(created().map((c) => c.table));
    expect(tables.size).toBeGreaterThanOrEqual(30);
    // Named, so that a parse which matched thirty of the wrong thing still fails.
    expect([...tables]).toContain('public.courses');
    expect([...tables]).toContain('public.forms');
  });

  /* And the other half of it: the enable side must parse too. */
  it('finds the enable statements', () => {
    expect(enabled().size).toBeGreaterThanOrEqual(30);
  });

  /*
   * The false positive that was actually there, pinned so it cannot come back.
   * `'CREATE TABLE AS'` appears as a command tag inside `ensure_rls`; a census
   * that counts it reports a table called `AS` that nothing can ever enable.
   */
  it('does not count SQL written inside a string literal', () => {
    expect(created().map((c) => c.table)).not.toContain('public.as');
    expect(code("create event trigger t when tag in ('CREATE TABLE AS')")).not.toMatch(
      /create\s+table/i,
    );
  });

  it('has every created table enabling it in the repository, not via ensure_rls', () => {
    const on = enabled();
    const missing = created().filter((c) => !on.has(c.table));

    expect(
      [...new Set(missing.map((m) => `${m.table} (${m.file})`))],
      'this table is created without `alter table … enable row level security`. The ' +
        '`ensure_rls` event trigger will turn it on, so no policy suite can see the ' +
        'omission — but a new table in `public` carries Supabase\'s default grants to ' +
        '`anon`, and RLS is the only thing between it and the publishable key. Say it ' +
        'in the migration rather than relying on a trigger a dashboard setting installs.',
    ).toEqual([]);
  });
});
