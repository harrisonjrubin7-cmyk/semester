import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AFTER_SECOND_READING, BRIEF, CATEGORIES, FUNCTIONS, NOT_YET_APPLIED, OPEN, PROJECT, READ_COUNT, READ_ON, READ_TABLES, SECOND_READING, SINCE_READING, SOURCES, TABLES, type Category } from './definerregister';

/**
 * Holds the Security Definer and RLS remediation register to the migrations:
 * the function set to what `migrations/` defines and `grants.check.sql`
 * allows, every row's gates to the body that wins, and every pinned table to
 * being created with row-level security, never given a policy and never
 * granted to a client role.
 *
 * `docs/DEFINER-RLS-REGISTER.md` is rendered from the data; run
 * `npm run registers` from app/ to rewrite it. The last test fails while stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const MIGRATIONS = 'supabase/migrations';
const DOC = 'docs/DEFINER-RLS-REGISTER.md';

/**
 * The SQL with comments removed. String literals are kept — a gate such as
 * `mine is distinct from 'MEMBER'` is one — and dollar-quoted bodies are what
 * the gates are read from.
 */
const uncommented = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');

const files = () =>
  readdirSync(join(root, MIGRATIONS))
    .filter((f) => f.endsWith('.sql'))
    .sort();

type Definition = { file: string; definer: boolean; body: string };

/**
 * The winning definition of every `public` function: migrations apply in
 * filename order, so a later `create or replace` is the one production runs.
 */
export function definitions(): Map<string, Definition> {
  const out = new Map<string, Definition>();
  for (const file of files()) {
    const sql = uncommented(read(`${MIGRATIONS}/${file}`));
    const head = /\bcreate\s+(?:or\s+replace\s+)?function\s+(private\s*\.\s*|public\s*\.\s*)?"?([a-z_0-9]+)"?\s*\(/gi;
    for (const m of sql.matchAll(head)) {
      if (m[1] && /^private/i.test(m[1])) continue;
      const rest = sql.slice(m.index + m[0].length);
      const as = /\bas\s+(\$[a-z_]*\$)/i.exec(rest);
      if (!as) continue;
      const start = as.index + as[0].length;
      const end = rest.indexOf(as[1], start);
      const after = rest.slice(end + as[1].length, end + as[1].length + 400).split(';')[0];
      const definer = /security\s+definer/i.test(rest.slice(0, as.index) + after);
      out.set(m[2].toLowerCase(), { file, definer, body: rest.slice(start, end) });
    }
  }
  return out;
}

/** The names in `grants.check.sql`'s allowlist: what a signed-in account may call. */
export function allowlisted(): Set<string> {
  const src = read('supabase/grants.check.sql');
  const from = src.indexOf('allowed constant text[] := array[');
  const block = src.slice(from, src.indexOf('];', from));
  return new Set([...block.matchAll(/'([a-z_0-9]+)\(/g)].map((m) => m[1]));
}

/** Every `security definer` function in `public` a signed-in account can call. */
export function exposedDefiners(): string[] {
  const allowed = allowlisted();
  return [...definitions()]
    .filter(([name, d]) => d.definer && allowed.has(name))
    .map(([name]) => name)
    .sort();
}

describe('the Security Definer and RLS remediation register', () => {
  const defs = definitions();

  it('names every definer function a signed-in account can call, and nothing else', () => {
    const want = exposedDefiners();
    const have = FUNCTIONS.map(([name]) => name);
    expect(have, 'FUNCTIONS is sorted by name').toEqual([...have].sort());
    expect(new Set(have).size, 'no function is listed twice').toBe(have.length);
    const missing = want.filter((n) => !have.includes(n));
    const extra = have.filter((n) => !want.includes(n));
    expect(missing, 'callable definer functions with no register row — classify each one').toEqual([]);
    expect(extra, 'register rows for functions that are not callable definers').toEqual([]);
  });

  it('finds the 151 the advisor listed, plus the two added since, so the parser is reading what production runs', () => {
    // A control on the instrument: a parser that silently lost half the
    // functions would also agree with a register that lost the same half.
    // Functions from files not yet applied to production are counted
    // separately, each held to the file it is said to come from.
    const since = SINCE_READING.flatMap((s) => s.functions);
    const afterSecond = AFTER_SECOND_READING.flatMap((s) => s.functions);
    expect(READ_COUNT).toBe(151);
    expect(exposedDefiners().length).toBe(READ_COUNT + since.length + afterSecond.length);
    expect(FUNCTIONS.length).toBe(READ_COUNT + since.length + afterSecond.length);
    // The second reading found every one of them applied on production except
    // the files named as not yet applied: the register's rows minus those are
    // the 180 the advisor listed.
    const unapplied = SINCE_READING.filter((s) => NOT_YET_APPLIED.includes(s.file)).flatMap((s) => s.functions);
    expect(NOT_YET_APPLIED.every((f) => SINCE_READING.some((s) => s.file === f)), 'every unapplied file is a since-reading file').toBe(true);
    expect(FUNCTIONS.length - unapplied.length - afterSecond.length).toBe(SECOND_READING.functions);
    for (const s of [...SINCE_READING, ...AFTER_SECOND_READING]) {
      for (const name of s.functions) expect(defs.get(name)?.file, name).toBe(s.file);
    }
  });

  it('holds every row to a gate its winning body actually makes', () => {
    for (const [name, category, gates] of FUNCTIONS) {
      expect(Object.keys(CATEGORIES), name).toContain(category);
      expect(gates.length, `${name} names no gate`).toBeGreaterThan(0);
      const body = defs.get(name)?.body ?? '';
      for (const g of gates) expect(body.includes(g), `${name} (${defs.get(name)?.file}) no longer checks ${g}`).toBe(true);
      if (category === 'admin' || category === 'moderation') {
        expect(
          gates.some((g) => g !== 'auth.uid()'),
          `${name} is ${category} and checks only who is calling, not whether they may`,
        ).toBe(true);
      }
    }
  });

  it('keeps gtm_pilot_problems behind the read policy of the table it reads', () => {
    const d = defs.get('gtm_pilot_problems');
    expect(d?.file).toBe('20260929140000_gtm_pilot_26_weeks.sql');
    expect(d?.body).toMatch(/if not found or not private\.gtm_account_visible\(p\.account_id\) then\s+return array\['not_found'\]/);
  });

  it('pins each policy-less table to row-level security, no policy, and no client grant', () => {
    const sql = files().map((f) => uncommented(read(`${MIGRATIONS}/${f}`))).join('\n');
    const names = TABLES.map(([t]) => t);
    expect(names).toEqual([...names].sort());
    expect(new Set(names).size).toBe(SECOND_READING.tables);
    expect(READ_TABLES).toBe(45);
    // The four that arrived between the readings are the ones with a later migration.
    expect(names.length - READ_TABLES).toBe(4);
    for (const t of ['private.account_ages', 'public.registration_completions', 'public.registration_holds', 'public.registration_requests']) expect(names, t).toContain(t);
    for (const [table, disposition] of TABLES) {
      const [schema, name] = table.split('.');
      const q = schema === 'public' ? `(?:public\\s*\\.\\s*)?${name}` : `private\\s*\\.\\s*${name}`;
      expect(disposition, table).toBe(schema === 'private' ? 'private-internal' : 'server-only');
      expect(new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${q}\\b`, 'i').test(sql), `${table} is created`).toBe(true);
      expect(
        new RegExp(`\\balter\\s+table\\s+(?:if\\s+exists\\s+)?${q}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql),
        `${table} turns row-level security on`,
      ).toBe(true);
      expect(new RegExp(`\\bcreate\\s+policy\\s+(?:"[^"]*"|\\w+)\\s+on\\s+${q}\\b`, 'i').test(sql), `${table} has a policy now — re-read it`).toBe(false);
      expect(
        new RegExp(`\\bgrant\\s+[^;]*\\bon\\s+(?:table\\s+)?${q}\\s+to\\s+[^;]*\\b(anon|authenticated|public)\\b`, 'i').test(sql),
        `${table} is granted to a client role`,
      ).toBe(false);
    }
  });

  it('cites briefs that exist and keeps every open item closable', () => {
    for (const s of SOURCES) expect(existsSync(join(root, s.path)), s.path).toBe(true);
    for (const o of OPEN) {
      if (o.closedBy) {
        expect(existsSync(join(root, o.closedBy)), `${o.id} is closed by ${o.closedBy}`).toBe(true);
        expect(read(o.closedBy), `${o.id}'s closing suite names every callable definer function`).toMatch(/has_function_privilege\('authenticated', p\.oid, 'execute'\)/);
      }
      expect(o.what.length, o.id).toBeGreaterThan(40);
      expect(o.closes.length, o.id).toBeGreaterThan(20);
    }
  });

  it('holds every brief item to paths that exist, and a held item to a test', () => {
    const isTest = (p: string) => /\.test\.tsx?$/.test(p) || /^supabase\/[^/]+\.check\.sql$/.test(p);
    const isProse = (p: string) => /\.(md|pdf)$/.test(p);
    expect(BRIEF.map((b) => b.id)).toEqual([...Array(20)].map((_, i) => `A${String(i + 1).padStart(2, '0')}`).concat([...Array(15)].map((_, i) => `B${String(i + 1).padStart(2, '0')}`)));
    for (const b of BRIEF) {
      for (const p of b.paths) expect(existsSync(join(root, p)), `${b.id} cites ${p}`).toBe(true);
      if (b.status === 'held') expect(b.paths.some(isTest), `${b.id} is held and cites no test`).toBe(true);
      if (b.status === 'owed') expect(b.paths.every(isProse), `${b.id} is owed yet cites code`).toBe(true);
      if (b.status !== 'held') expect(b.gap.length, b.id).toBeGreaterThan(10);
    }
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (s: string) => `\`${s.replace(/`/g, "'")}\``;

function render(): string {
  const defs = definitions();
  const by = (c: Category) => FUNCTIONS.filter(([, cat]) => cat === c);
  const out: string[] = [
    '# Security Definer and RLS remediation register',
    '',
    '<!-- Rendered from app/src/lib/definerregister.ts by definerregister.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'The architecture audit of 29 September 2026 names this register as the',
    'first artifact of the audit, "because it tells you exactly where',
    'application authority currently crosses database trust boundaries". It',
    `read production's Supabase advisor and found **${READ_TABLES} tables with row-level`,
    `security on and no policy** and **${READ_COUNT} \`security definer\` functions a`,
    'signed-in account can call**. Neither is a vulnerability by itself; the',
    'audit asked for a disposition for every one, and a guard so the next one',
    'cannot arrive without one. This page is both.',
    '',
    '## Sources',
    '',
    ...SOURCES.map((s) => `- [${s.title}](${s.path.replace(/^docs\//, '')}) — ${s.what}`),
    '',
    '## The reading',
    '',
    `Production (\`${PROJECT}\`), ${READ_ON}, read-only, through the advisor and \`pg_catalog\`:`,
    '',
    `- all ${READ_TABLES} policy-less tables: no SELECT, INSERT, UPDATE or DELETE for \`anon\` or \`authenticated\`. Each is deny-by-default, not open;`,
    `- all ${READ_COUNT} functions: not executable by \`anon\` or PUBLIC, \`search_path\` pinned, no dynamic \`execute\`;`,
    '- two bodies named neither `auth.uid()` nor a `private.` gate. `gtm_pilot_problems` answered any signed-in caller about any pilot — a student could read whether a pilot\'s price was agreed, who sponsored it and whether its dates fit. It is fixed in `supabase/migrations/20260929120000_gtm_pilot_problems_visibility.sql` and held by `supabase/gtm.check.sql`. `kill_switch_engaged` is a deliberate one-boolean read, kept open as DR-01.',
    '',
    ...(SINCE_READING.length
      ? [
          `Since the reading, ${SINCE_READING.reduce((n, s) => n + s.functions.length, 0)} more, from migrations not applied to production, each with a row below: ${SINCE_READING.map((s) => `\`${s.file}\` (${s.functions.map((f) => `\`${f}\``).join(', ')})`).join('; ')}.`,
          '',
        ]
      : []),
    '## The second reading',
    '',
    `Production (\`${PROJECT}\`), ${SECOND_READING.on}, read-only, through the advisor and \`pg_catalog\`. Against the register above: **${SECOND_READING.tables} policy-less tables** and **${SECOND_READING.functions} \`security definer\` functions** a signed-in account can call, which is the first reading's ${READ_TABLES} and ${READ_COUNT} plus what arrived since.`,
    '',
    `- the ${SECOND_READING.functions} functions are exactly the register's rows below, less the ${NOT_YET_APPLIED.length} migration not yet applied (${NOT_YET_APPLIED.join(', ')}); none unlisted and none listed that production has; none is executable by \`anon\` or PUBLIC; every \`search_path\` is pinned; none uses dynamic \`execute\`. 179 name \`auth.uid()\` or a \`private.\` gate; the one that names neither is \`kill_switch_engaged\` (DR-01);`,
    `- all ${SECOND_READING.tables} policy-less tables hold no privilege of any kind for \`anon\` or \`authenticated\`, table or column. The ${SECOND_READING.tables - READ_TABLES} that were not in the first reading (\`private.account_ages\`, \`public.registration_completions\`, \`public.registration_holds\`, \`public.registration_requests\`) now have a disposition below. No policy was added to any of the ${SECOND_READING.tables}, and none should be;`,
    '- the rest of that day\'s advisor findings, what was fixed and what was left, with the before and after: [`ADVISOR-RECONCILIATION-2026-09-30.md`](ADVISOR-RECONCILIATION-2026-09-30.md).',
    '',
    '### After the second reading',
    '',
    `The current register also includes ${AFTER_SECOND_READING.reduce((n, s) => n + s.functions.length, 0)} callable definers whose current definitions were added after that dated catalogue snapshot: ${AFTER_SECOND_READING.map((s) => `\`${s.file}\` (${s.functions.map((f) => `\`${f}\``).join(', ')})`).join('; ')}. They are held to their migration bodies and grant declarations below and are not retroactively counted in the 30 September reading.`,
    '',
    '## How this page is held',
    '',
    '- The function set is derived: `definerregister.test.ts` reads every migration, takes the winning definition of each `public` function, keeps the `security definer` ones and intersects them with the allowlist in `supabase/grants.check.sql`. That set must equal the register exactly. A new definer function granted to clients is red until it has a row — the audit\'s release-gate line "new SECURITY DEFINER functions have an approved inventory entry", as a test.',
    '- Every row\'s gates are literal checks that must appear in the winning body. Removing one turns its row red.',
    '- An admin or moderation row must name a gate other than `auth.uid()`.',
    '- The tables are the advisor\'s list, pinned: some tables get their policies from `format()` loops a static parser cannot read. Each is held to being created with row-level security, having no `create policy` naming it, and never being granted to `anon`, `authenticated` or PUBLIC.',
    '',
    '## Functions by category',
    '',
    '| Category | Functions | Controls the audit requires |',
    '| --- | --- | --- |',
    ...(Object.keys(CATEGORIES) as Category[]).map((c) => `| ${c} | ${by(c).length} | ${cell(CATEGORIES[c])} |`),
    `| **total** | ${FUNCTIONS.length} | |`,
    '',
  ];
  for (const c of Object.keys(CATEGORIES) as Category[]) {
    out.push(`### ${c} (${by(c).length})`, '', '| Function | Gates in its body | Defined in |', '| --- | --- | --- |');
    for (const [name, , gates] of by(c)) out.push(`| \`${name}\` | ${gates.map(code).join(', ')} | \`${defs.get(name)?.file ?? ''}\` |`);
    out.push('');
  }
  out.push(
    '## Policy-less tables',
    '',
    '`private-internal`: in `private`, which PostgREST does not expose. `server-only`: in `public` with every client privilege revoked, reached only through a definer function above or an Edge Function holding the service key.',
    '',
    '| Table | Disposition | Written by |',
    '| --- | --- | --- |',
    ...TABLES.map(([t, d, w]) => `| \`${t}\` | ${d} | ${cell(w)} |`),
    '',
    '## Both briefs, item by item',
    '',
    `Read against main on ${READ_ON}. \`held\` cites a test or check that guards it; \`partial\` cites what exists and names what does not; \`owed\` cites only prose. A01–A20 are the architecture brief's twenty priorities; B01–B15 are the audit's named artifacts and remediation items. ${(['held', 'partial', 'owed'] as const).map((s) => `${s} ${BRIEF.filter((b) => b.status === s).length}`).join(', ')}.`,
    '',
    '| ID | Item | Status | Evidence | Gap |',
    '| --- | --- | --- | --- | --- |',
    ...BRIEF.map((b) => `| ${b.id} | ${cell(b.item)} | ${b.status} | ${b.paths.map((p) => `\`${p}\``).join('<br>')} | ${cell(b.gap)} |`),
    '',
    '## Open',
    '',
    '| ID | Severity | State | What | What closes it |',
    '| --- | --- | --- | --- | --- |',
    ...OPEN.map((o) => `| ${o.id} | ${o.severity} | ${o.closedBy ? `closed by \`${o.closedBy}\`` : 'open'} | ${cell(o.what)} | ${cell(o.closes)} |`),
    '',
  );
  return out.join('\n');
}
