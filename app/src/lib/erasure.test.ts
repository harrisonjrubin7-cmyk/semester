/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEPT_TABLES, OWNED_TABLES } from './cloud';

/**
 * What the privacy page says deleting an account does, held to what the
 * database will actually do when the account is deleted.
 *
 * Until 20260929010000 the two could not disagree in practice, because the
 * auth row was never deleted: the button sent one filtered DELETE per
 * `OWNED_TABLES` entry, and the `on delete cascade` hanging everything off
 * `auth.users` never fired. Now it does. `erase_account` walks every foreign
 * key to `auth.users` by its own rule, the `delete-account` function then
 * deletes the auth user, and `export_my_data` walks the same list. So the
 * schema's `on delete` rules *are* the deletion, and this file reads them.
 *
 * Three questions, each a different way for the page to become untrue:
 *
 *   * Is every table the page says goes actually taken — by a cascade from
 *     `auth.users`, by a cascade from a table that is, or by one of the
 *     `forget_my_*` functions `erase_account` calls?
 *   * Is every table the page says *stays* free of a cascade from `auth.users`?
 *     A group you started was not, and the first real deletion would have
 *     taken it from every other member. That is the bug this file was written
 *     against, and the reason the migration changed four such rules.
 *   * Does every column that names an account have a rule the auth delete can
 *     follow, and do erasure and export read the same list?
 *
 * `supabase/deletion.check.sql` asks the same things of a real database. This
 * asks them of the migrations, so it runs on every `npm test` rather than only
 * where there is a Postgres.
 */

const MIGRATIONS = join(process.cwd(), '..', 'supabase', 'migrations');

type Rule = 'cascade' | 'set null' | 'set default' | 'restrict' | 'no action';
type Fk = { table: string; cols: string[]; target: string; rule: Rule };

/** Dollar-quoted bodies and comments out, so a `;` in either ends nothing. */
function strip(sql: string): string {
  return sql
    .replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, "''")
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Split on commas that are not inside parentheses. */
function items(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim());
}

const REF = /references\s+(?:(auth|public|private)\s*\.\s*)?"?([a-z_]+)"?\s*(?:\(([^)]*)\))?([\s\S]*)$/i;

function target(schema: string | undefined, name: string): string {
  return schema?.toLowerCase() === 'auth' ? 'auth.users' : name.toLowerCase();
}

function ruleOf(rest: string): Rule {
  const m = /on\s+delete\s+(cascade|set\s+null|set\s+default|restrict|no\s+action)/i.exec(rest);
  return (m ? m[1].toLowerCase().replace(/\s+/g, ' ') : 'no action') as Rule;
}

/** One item of a create table, or one action of an alter table, as a foreign key. */
function fkOf(table: string, item: string): Fk | null {
  const tableLevel = /^(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]*)\)\s*(references[\s\S]*)$/i.exec(item);
  if (tableLevel) {
    const ref = REF.exec(tableLevel[2]);
    if (!ref) return null;
    return {
      table,
      cols: tableLevel[1].split(',').map((c) => c.trim().replace(/"/g, '').toLowerCase()),
      target: target(ref[1], ref[2]),
      rule: ruleOf(ref[4]),
    };
  }
  const column = /^(?:add\s+column\s+(?:if\s+not\s+exists\s+)?)?"?([a-z_][a-z0-9_]*)"?\s+[\s\S]*?(references[\s\S]*)$/i.exec(item);
  if (!column || /^(constraint|primary|unique|check|exclude)$/i.test(column[1])) return null;
  const ref = REF.exec(column[2]);
  if (!ref) return null;
  return { table, cols: [column[1].toLowerCase()], target: target(ref[1], ref[2]), rule: ruleOf(ref[4]) };
}

/**
 * Every foreign key the migrations leave standing, read in the order they
 * apply. A later `add constraint` on the same columns replaces an earlier one,
 * which is how 20260929010000 turns four cascades into set-nulls.
 */
function foreignKeys(): Fk[] {
  const byKey = new Map<string, Fk>();
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    for (const stmt of strip(readFileSync(join(MIGRATIONS, f), 'utf8')).split(';')) {
      const s = stmt.trim();
      const create = /^create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(public|private)\.)?"?([a-z_]+)"?\s*\(([\s\S]*)\)[^)]*$/i.exec(s);
      const alter = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:(public|private)\.)?"?([a-z_]+)"?\s+([\s\S]*)$/i.exec(s);
      let found: Fk[] = [];
      if (create) {
        const table = create[2].toLowerCase();
        found = items(create[3]).map((i) => fkOf(table, i)).filter((x): x is Fk => x !== null);
      } else if (alter) {
        const table = alter[2].toLowerCase();
        found = items(alter[3])
          .map((a) => a.replace(/^add\s+constraint\s+\S+\s+/i, ''))
          .filter((a) => /references/i.test(a))
          .map((a) => fkOf(table, a))
          .filter((x): x is Fk => x !== null);
      }
      for (const fk of found) byKey.set(`${fk.table}(${fk.cols.join(',')})->${fk.target}`, fk);
    }
  }
  return [...byKey.values()];
}

const FKS = foreignKeys();
const toAuth = FKS.filter((f) => f.target === 'auth.users' && f.cols.length === 1);const erasureSql = () => readFileSync(join(MIGRATIONS, '20260929010000_account_erasure_and_export.sql'), 'utf8');

/** Tables `auth.users`' deletion takes, directly or down a chain of cascades. */
function takenByTheAuthDelete(): Set<string> {
  const taken = new Set(toAuth.filter((f) => f.rule === 'cascade').map((f) => f.table));
  for (let grew = true; grew; ) {
    grew = false;
    for (const f of FKS) {
      if (f.rule === 'cascade' && taken.has(f.target) && !taken.has(f.table)) {
        taken.add(f.table);
        grew = true;
      }
    }
  }
  return taken;
}

/** The `forget_my_*` functions `erase_account` runs, read off its own body. */
function calledByErase(): Set<string> {
  const sql = erasureSql();
  const body = /create or replace function public\.erase_account[\s\S]*?\nend \$\$;/.exec(sql)?.[0] ?? '';
  return new Set([...body.matchAll(/perform public\.([a-z_]+)\(\)/g)].map((m) => m[1]));
}

describe('the probe reads the migrations', () => {
  it('finds the foreign keys it is supposed to find', () => {
    /*
     * The control. Every assertion below is vacuously true of an empty list,
     * and a regex that stopped matching returns one. So: the columns known to
     * be there, with the rules known to be theirs — including one declared in
     * a table-level clause and the four this migration rewrote.
     *
     * Measured once against a real one: with every migration applied, the
     * parse's 153 columns and their rules matched `pg_constraint` line for
     * line, and its cascade edges matched in `public`.
     */
    expect(toAuth.length, 'foreign keys to auth.users found').toBeGreaterThan(120);
    const rule = (t: string, c: string) => toAuth.find((f) => f.table === t && f.cols[0] === c)?.rule;
    expect(rule('courses', 'user_id')).toBe('cascade');
    expect(rule('forms', 'owner')).toBe('cascade');
    expect(rule('data_requests', 'user_id')).toBe('set null');
    expect(rule('groups', 'created_by')).toBe('set null');
    expect(rule('reports', 'reporter')).toBe('set null');
    expect(rule('community_posts', 'author_id')).toBe('set null');
    expect(rule('consent_record', 'recorded_by')).toBe('set null');
    expect(FKS.some((f) => f.table === 'form_responses' && f.target === 'forms' && f.rule === 'cascade')).toBe(true);
    expect(FKS.some((f) => f.table === 'capture_segment' && f.target === 'capture_asset' && f.cols.length === 3)).toBe(true);
    expect(calledByErase()).toContain('forget_my_community');
  });
});

describe('deleting an account does what the privacy page says', () => {
  it('takes every table the page says goes', () => {
    const taken = takenByTheAuthDelete();
    const forgets = calledByErase();
    const missed = OWNED_TABLES.filter((t) => !taken.has(t.table) && !(t.via && forgets.has(t.via))).map(
      (t) => t.table,
    );
    expect(missed, 'the page says these go, and neither a cascade nor erase_account takes them').toEqual([]);
  });

  it('calls every forget_my_* function the page relies on', () => {
    const forgets = calledByErase();
    const vias = [...new Set(OWNED_TABLES.flatMap((t) => (t.via ? [t.via] : [])))];
    expect(vias.length).toBeGreaterThan(3);
    expect(vias.filter((v) => !forgets.has(v)), 'not run by erase_account').toEqual([]);
  });

  it('takes none of the tables the page says stay', () => {
    /*
     * The bug, stated as the test. `groups.created_by`, `group_tasks.created_by`,
     * `reports.reporter` and `community_reports.reporter_id` were all
     * `on delete cascade` from `auth.users`, so the privacy page's "a group you
     * started belongs to everyone in it … the group stays" was true only for
     * as long as no account was ever really deleted.
     */
    const taken = takenByTheAuthDelete();
    const lost = KEPT_TABLES.filter((t) => taken.has(t.table)).map((t) => t.table);
    expect(lost, 'the page says these stay, and the auth delete would take them').toEqual([]);
  });

  it('leaves no column naming an account without a rule the auth delete can follow', () => {
    // `no action` or `restrict` makes the auth delete of anybody named there
    // fail outright; `erase_account` refuses before it starts rather than
    // half way. `consent_record.recorded_by` was the one.
    const stuck = toAuth.filter((f) => f.rule !== 'cascade' && f.rule !== 'set null');
    expect(stuck.map((f) => `${f.table}.${f.cols[0]} (${f.rule})`)).toEqual([]);
  });
});

describe('erasure and export are one list', () => {
  const sql = erasureSql();
  const body = (name: string) =>
    new RegExp(`create or replace function ${name.replace('.', '\\.')}[\\s\\S]*?\\nend \\$\\$;`).exec(sql)?.[0] ?? '';

  it('both walk private.account_data_map(), and neither keeps a list of its own', () => {
    for (const fn of ['public.erase_account', 'private.account_export']) {
      expect(body(fn), fn).toContain('private.account_data_map()');
      // A hand-written table name in either would be a second list.
      expect(body(fn), fn).not.toMatch(/from public\.(courses|state|notes|messages|profiles)\b/);
    }
    expect(body('public.export_my_data'), 'the API entry point').toContain('private.account_export(me)');
  });

  it('exports every column that names an account, but three, and says why those three', () => {
    const map = /not in \(([\s\S]*?)\)\s*or /.exec(
      /create or replace function private\.account_data_map[\s\S]*?\$\$;/.exec(sql)?.[0] ?? '',
    )?.[1] ?? '';
    const withheld = [...map.matchAll(/\('([a-z_]+)', '([a-z_]+)'\)/g)].map((m) => `${m[1]}.${m[2]}`).sort();
    expect(withheld).toEqual(['blocks.blocked', 'community_safety_entries.user_id', 'reports.about']);
    // Each withheld column is real — a typo would silently export it.
    for (const w of withheld) {
      const [t, c] = w.split('.');
      expect(toAuth.some((f) => f.table === t && f.cols[0] === c), w).toBe(true);
    }
    // And the file says, in its own words, that each kind is left out.
    const explained = /'withheld', jsonb_build_array\(([\s\S]*?)\)\s*\)/.exec(body('private.account_export'))?.[1] ?? '';
    expect(explained.split(/',\s*\n/).length).toBe(withheld.length);
  });

  it('the export that replaced it keeps one list, and leaves out a school\'s guardian restrictions', () => {
    /*
     * `20261004150000` replaces `private.account_export` to stop the cascade walk
     * carrying `guardian_link_restrictions` into the person's file. The test above
     * reads the original migration only, so it would go on passing against a
     * function that no longer runs. This reads the one that does.
     */
    const next = readFileSync(join(MIGRATIONS, '20261004150000_export_withholds_guardian_restrictions.sql'), 'utf8');
    const fn = new RegExp('create or replace function private\\.account_export[\\s\\S]*?\\nend \\$\\$;').exec(next)?.[0] ?? '';
    expect(fn.length, 'the probe found the function').toBeGreaterThan(1000);
    expect(fn).toContain('private.account_data_map()');
    // Read in both places rows are gathered: the account's own columns, and the cascade below them.
    expect(fn.match(/private\.export_withheld_tables\(\)/g)?.length).toBe(2);
    const listed = /private\.export_withheld_tables\(\)[\s\S]*?array\[([^\]]*)\]/.exec(next)?.[1] ?? '';
    const tables = [...listed.matchAll(/'public\.([a-z_]+)'::regclass/g)].map((m) => m[1]);
    expect(tables).toEqual(['guardian_link_restrictions']);
    // The table is real — a typo would be a withheld table that exports.
    for (const t of tables) expect(FKS.some((f) => f.table === t), t).toBe(true);
    // And the file says what it leaves out: three columns and the table.
    const explained = /'withheld', jsonb_build_array\(([\s\S]*?)\)\s*\)/.exec(fn)?.[1] ?? '';
    expect(explained.split(/',\s*\n/).length).toBe(3 + tables.length);
  });
});
