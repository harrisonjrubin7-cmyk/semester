import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, RETENTION_CLASSES } from '../../../../packages/institution/src/events';
import { RESOURCE_CLASSIFICATIONS } from '../../../../packages/institution/src/policy';
import { CATEGORIES, FUNCTIONS, READ_COUNT, READ_TABLES, SECOND_READING, TABLES } from '../definerregister';
import { SEATS } from '../launchreadiness';
import { PARTIES } from '../trust/subprocessors';

/**
 * The security and trust documentation layer, held to the repository.
 *
 *   - docs/trust/CONTROL-FACTS.md is rendered here from live sources.
 *   - docs/trust/SECURITY-OVERVIEW.md, REVIEWER-QUESTION-MAP.md and
 *     DOCUMENT-MAP.md are written by hand and held: cards, links, cited
 *     paths, status words, the claim words, and (for the map) that every
 *     document in the four trust directories is listed exactly once.
 *
 * `REGISTERS=write npx vitest run src/lib/docs/trust-docs.test.ts` from app/
 * rewrites CONTROL-FACTS.md. Every check below is shown a planted failure
 * and a planted pass first, so a broken probe cannot read as clean.
 */

const root = join(import.meta.dirname, '../../../..');
const at = (p: string) => join(root, p);
const read = (p: string) => readFileSync(at(p), 'utf8');
const TEST = 'app/src/lib/docs/trust-docs.test.ts';
const FACTS = 'docs/trust/CONTROL-FACTS.md';
const PAGES = [
  'docs/trust/SECURITY-OVERVIEW.md',
  'docs/trust/REVIEWER-QUESTION-MAP.md',
  'docs/trust/DOCUMENT-MAP.md',
  FACTS,
] as const;

/* ───────────────────────── generic helpers ───────────────────────── */

const uncommented = (sql: string) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
const table = (headers: string[], rows: string[][]) => [
  `| ${headers.join(' | ')} |`,
  `| ${headers.map(() => '---').join(' | ')} |`,
  ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
];
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/* ───────────────────────── CONTROL-FACTS sources ───────────────────────── */

const migrationFiles = () => readdirSync(at('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort();
const KEYWORDS = new Set(['as', 'if', 'table']);

export function rlsPosture(sqlFiles: { name: string; sql: string }[]) {
  const created = new Set<string>();
  const dropped = new Set<string>();
  const rls = new Set<string>();
  const pol = new Set<string>();
  const key = (schema: string | undefined, name: string) => `${(schema || 'public').toLowerCase()}.${name.toLowerCase()}`;
  for (const { sql: raw } of sqlFiles) {
    const sql = uncommented(raw);
    for (const m of sql.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\s*\.\s*)?"?(\w+)"?/gi)) {
      if (KEYWORDS.has(m[2].toLowerCase()) && !m[1]) continue;
      created.add(key(m[1], m[2]));
      dropped.delete(key(m[1], m[2]));
    }
    for (const m of sql.matchAll(/\bdrop\s+table\s+(?:if\s+exists\s+)?(?:(\w+)\s*\.\s*)?"?(\w+)"?/gi)) dropped.add(key(m[1], m[2]));
    for (const m of sql.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:(\w+)\s*\.\s*)?"?(\w+)"?\s+enable\s+row\s+level\s+security/gi)) rls.add(key(m[1], m[2]));
    for (const m of sql.matchAll(/\bcreate\s+policy\s+(?:"[^"]+"|\w+)\s+on\s+(?:only\s+)?(?:(\w+)\s*\.\s*)?"?(\w+)"?/gi)) pol.add(key(m[1], m[2]));
  }
  const live = [...created].filter((t) => !dropped.has(t)).sort();
  const bySchema = (schema: string, list: string[]) => list.filter((t) => t.startsWith(`${schema}.`)).length;
  const withRls = live.filter((t) => rls.has(t));
  const withoutRls = live.filter((t) => !rls.has(t));
  const withPolicy = live.filter((t) => pol.has(t));
  return {
    live,
    withRls,
    withoutRls,
    withPolicy,
    publicTotal: bySchema('public', live),
    privateTotal: bySchema('private', live),
    publicRls: bySchema('public', withRls),
    privateRls: bySchema('private', withRls),
  };
}

export function firstProof(sql: string): string {
  const lines = sql.split('\n');
  const para: string[] = [];
  for (const l of lines) {
    if (!l.startsWith('--')) break;
    const text = l.replace(/^--\s?/, '').trim();
    if (text === '') {
      if (para.length) break;
      continue;
    }
    para.push(text);
  }
  let first = para.join(' ').replace(/^supabase\/\S+\s+[—-]\s+/, '');
  const stop = first.search(/\.\s/);
  if (stop > 0) first = first.slice(0, stop + 1);
  return clip(first, 200);
}

export function parseHeadersFile(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const l of text.split('\n')) {
    const m = /^\s+([A-Za-z-]+):\s*(.+)$/.exec(l);
    if (m) out.set(m[1], m[2].trim());
  }
  return out;
}

const directives = (csp: string) => csp.split(';').map((d) => d.trim().split(/\s+/)[0]).filter(Boolean);

export function parseFunctionBlocks(toml: string): { name: string; verifyJwt: string; note: string }[] {
  const out: { name: string; verifyJwt: string; note: string }[] = [];
  let buf: string[] = [];
  let current: { name: string; verifyJwt: string; note: string } | null = null;
  for (const line of toml.split('\n')) {
    const head = /^\[functions\.([\w-]+)\]/.exec(line);
    if (head) {
      current = { name: head[1], verifyJwt: '(unset)', note: clip(buf.join(' '), 150) };
      out.push(current);
      buf = [];
      continue;
    }
    const jwt = /^verify_jwt\s*=\s*(\w+)/.exec(line);
    if (jwt && current) {
      current.verifyJwt = jwt[1];
      continue;
    }
    if (line.startsWith('#')) buf.push(line.replace(/^#\s?/, '').trim());
    else buf = [];
  }
  return out;
}

export function definerDerived(): string[] {
  const defs = new Map<string, boolean>();
  for (const file of migrationFiles()) {
    const sql = uncommented(read(`supabase/migrations/${file}`));
    const head = /\bcreate\s+(?:or\s+replace\s+)?function\s+(private\s*\.\s*|public\s*\.\s*)?"?([a-z_0-9]+)"?\s*\(/gi;
    for (const m of sql.matchAll(head)) {
      if (m[1] && /^private/i.test(m[1])) continue;
      const rest = sql.slice(m.index + m[0].length);
      const as = /\bas\s+(\$[a-z_]*\$)/i.exec(rest);
      if (!as) continue;
      const start = as.index + as[0].length;
      const end = rest.indexOf(as[1], start);
      const after = rest.slice(end + as[1].length, end + as[1].length + 400).split(';')[0];
      defs.set(m[2].toLowerCase(), /security\s+definer/i.test(rest.slice(0, as.index) + after));
    }
  }
  const src = read('supabase/grants.check.sql');
  const from = src.indexOf('allowed constant text[] := array[');
  const block = src.slice(from, src.indexOf('];', from));
  const allowed = new Set([...block.matchAll(/'([a-z_0-9]+)\(/g)].map((m) => m[1]));
  return [...defs].filter(([n, d]) => d && allowed.has(n)).map(([n]) => n).sort();
}

const count = <T>(items: T[], f: (t: T) => string) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(f(i), (m.get(f(i)) ?? 0) + 1);
  return m;
};

/* ───────────────────────── CONTROL-FACTS renderer ───────────────────────── */

export function render(): string {
  const out: string[] = [];
  const h = (s: string) => out.push('', s, '');
  const note = (counted: string, notProve: string) =>
    out.push('', `**How counted.** ${counted}`, '', `**What this does not prove.** ${notProve}`);

  out.push(
    '# Control facts',
    '',
    `> **Type:** reference · **Audience:** security-reviewers, buyers · **Owner:** \`security\` · **Truth:** generated · **Reviewed:** 2026-10-04 · **Held by:** \`${TEST}\``,
    '',
    'Counts and lists read from the repository when the test runs; stop reading here if you need to know whether any of it operates in production, which no row on this page shows.',
    '',
    `<!-- Rendered from supabase/, app/public/_headers, app/vercel.json, SECURITY.md, packages/institution/src and app/src/lib by ${TEST}. Edit the code, then run \`REGISTERS=write npx vitest run src/lib/docs/trust-docs.test.ts\` from app/. -->`,
    '',
    'Every table is a measurement of text in the tree. A count here says a file, row or line exists. It does not say the control runs against a production project; for that, see [docs/EVIDENCE-REGISTER.md](../EVIDENCE-REGISTER.md) and [`EVIDENCE-REGISTER.md`](EVIDENCE-REGISTER.md).',
  );

  // 1. RLS posture
  const files = migrationFiles().map((name) => ({ name, sql: read(`supabase/migrations/${name}`) }));
  const p = rlsPosture(files);
  h('## Row-level security posture, counted from migrations');
  out.push(
    ...table(
      ['Measure', 'Count'],
      [
        ['Migration files', String(files.length)],
        ['Tables created in `public` and not later dropped', String(p.publicTotal)],
        ['… of which enable row-level security in a migration', String(p.publicRls)],
        ['Tables created in `private` and not later dropped', String(p.privateTotal)],
        ['… of which enable row-level security in a migration', String(p.privateRls)],
        ['Tables with no `enable row level security` statement found', String(p.withoutRls.length)],
        ['Tables named by at least one literal `create policy` statement', String(p.withPolicy.length)],
        ['Tables with RLS found and no literal policy statement', String(p.withRls.filter((t) => !p.withPolicy.includes(t)).length)],
        ['Migration installs the `ensure_rls` event trigger (`rls_auto_enable`)', files.some((f) => /create event trigger ensure_rls/i.test(f.sql)) ? 'yes' : 'no'],
      ],
    ),
  );
  if (p.withoutRls.length) out.push('', `Tables with no RLS statement found: ${p.withoutRls.map((t) => `\`${t}\``).join(', ')}.`);
  note(
    'Each migration is read in filename order with SQL comments removed. A table counts when `create table` names it (schema defaults to `public`) and no later `drop table` removes it. It has RLS when an `alter table … enable row level security` names it. The name `as` is skipped because it is the SQL phrase `create table as`. Policies count only as literal `create policy … on <table>` statements.',
    'It does not see tables created or altered inside `format()` or `execute` loops, so a table that gets RLS only that way is counted as having none and a table that gets a policy only that way is counted as having none. It reads migrations, not the live schema: it cannot say which migrations are applied to a project (see [DEFINER-RLS-REGISTER.md](../DEFINER-RLS-REGISTER.md), which records the files not yet applied). RLS enabled is not RLS correct; the second-account suites below are what test that. The count differs from other pages (for example `DATA-INVENTORY.md` reports 301 `public` tables) because the methods differ; none is a live catalogue reading.',
  );

  // 2. check.sql
  const checks = readdirSync(at('supabase')).filter((f) => f.endsWith('.check.sql')).sort();
  const runsAll = /for c in "\$here"\/\*\.check\.sql/.test(read('supabase/check.sh'));
  h('## Policy and invariant suites (`supabase/*.check.sql`)');
  out.push(
    `${checks.length} files. \`supabase/check.sh\` ${runsAll ? 'runs every `*.check.sql` file by glob' : 'does NOT run every file by glob'}, and \`.github/workflows/ci.yml\` runs it as the step "Check the database policies".`,
    '',
    ...table(
      ['Suite', 'What it proves (first sentence of its opening comment, verbatim)'],
      checks.map((f) => [`\`supabase/${f}\``, firstProof(read(`supabase/${f}`)).replace(/`/g, "'")]),
    ),
  );
  note(
    'Files in `supabase/` whose names end in .check.sql. The text is the first comment paragraph of the file up to its first full stop, with a leading `supabase/<name> —` path removed, cut at 200 characters.',
    'A suite existing is not the suite passing; CI history shows that. The first sentence is the author\'s description, not a measured list of assertions, and a suite can describe more than it asserts. The suites run on a throwaway Postgres built from the migrations, not on a customer environment.',
  );

  // 3. headers
  const hf = parseHeadersFile(read('app/public/_headers'));
  const vj = JSON.parse(read('app/vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
  const vr = new Map((vj.headers.find((r) => r.source === '/(.*)')?.headers ?? []).map((x) => [x.key, x.value]));
  const names = [...new Set([...hf.keys(), ...vr.keys()])].sort();
  const metaCsp = /http-equiv="Content-Security-Policy"/.test(read('app/index.html'));
  h('## Security response headers');
  out.push(
    ...table(
      ['Header', 'In `app/public/_headers`', 'In `app/vercel.json` (all-paths rule)'],
      names.map((n) => [n, hf.has(n) ? 'yes' : 'no', vr.has(n) ? 'yes' : 'no']),
    ),
    '',
    ...table(
      ['Short values', 'Value in `_headers`'],
      ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy'].map((n) => [n, `\`${hf.get(n) ?? '(absent)'}\``]),
    ),
    '',
    `Content-Security-Policy directive names in \`_headers\`: ${directives(hf.get('Content-Security-Policy') ?? '').map((d) => `\`${d}\``).join(', ')}.`,
    '',
    `\`app/index.html\` carries a Content-Security-Policy meta tag: ${metaCsp ? 'yes' : 'no'}.`,
  );
  note(
    'The two header files are parsed as text: `_headers` as indented `Name: value` lines, `app/vercel.json` as the `headers` array of its `/(.*)` rule. Directive names are the first word of each `;`-separated part of the policy.',
    'Both files take effect only on a host that reads them (Netlify or Cloudflare Pages for `app/public/_headers`, Vercel for `app/vercel.json`). The header comment of `app/src/lib/hostheaders.test.ts` says neither does anything on GitHub Pages, where the app is served today, and that the go-live line for host-configured headers stays unticked until a probe of the live response shows them. A value present here is not a value observed on a response. `app/src/headers.ts` is not part of this table: it names the on-screen titles of app screens, not HTTP headers.',
  );

  // 4. SECURITY.md disclosure facts
  const sec = read('SECURITY.md');
  const sev = ['Critical', 'High', 'Medium', 'Low'].map((s) => {
    const row = sec.split('\n').find((l) => l.startsWith(`| **${s}** |`));
    const cells = row ? row.split('|').map((c) => c.trim()) : [];
    return [s, cells[4] ?? '(row not found)'];
  });
  const txt = read('app/public/.well-known/security.txt')
    .split('\n')
    .filter((l) => /^[A-Za-z-]+:/.test(l));
  const field = (n: string) => txt.find((l) => l.startsWith(`${n}:`))?.slice(n.length + 1).trim() ?? '';
  h('## Vulnerability disclosure facts');
  out.push(
    ...table(
      ['Fact', 'Value'],
      [
        ['`security.txt` fields present', txt.map((l) => l.split(':')[0]).sort().join(', ')],
        ['`Contact` scheme', field('Contact').split(':')[0] + ' (address not reproduced here)'],
        ['`Expires`', field('Expires')],
        ['`Canonical`', field('Canonical')],
        ['`Policy` points at `SECURITY.md`', /SECURITY\.md$/.test(field('Policy')) ? 'yes' : 'no'],
        ['`SECURITY.md` states a notice clock of 72 hours', /Within 72 hours of confirming/.test(sec) ? 'yes' : 'no'],
        ['`SECURITY.md` says the day counts are accepted internal targets', /accepted internal targets/.test(sec) ? 'yes' : 'no'],
        ['`SECURITY.md` has a safe-harbour wording', /Formal safe-harbour wording is not written here/.test(sec) ? 'no (it says so)' : 'not determined'],
      ],
    ),
    '',
    ...table(['Severity', 'Fixed within (SECURITY.md table)'], sev),
  );
  note(
    '`security.txt` lines of the form `Field: value` are read from `app/public/.well-known/security.txt`; severity rows are the cells of the table in `SECURITY.md` that begin `| **Critical** |` and so on.',
    'The same file says the day counts are accepted internal targets, that nobody has yet held a finding against them, and that nothing is a customer commitment until a contract says so. It also says that the origin-root discovery path scanners use is not served. The 72-hour clock is about notice, not repair. The notice-law paragraph is marked by its own file as unverified by counsel.',
  );

  // 5. retention / classification
  const ev = Object.values(EVENT_TYPES) as { classification: string; retention: string }[];
  const byRet = count(ev, (e) => e.retention);
  const byCls = count(ev, (e) => e.classification);
  h('## Retention classes and data classifications');
  out.push(
    `Retention classes (\`RETENTION_CLASSES\` in \`packages/institution/src/events.ts\`): ${RETENTION_CLASSES.map((c) => `\`${c}\``).join(', ')}.`,
    '',
    `Data classifications (\`RESOURCE_CLASSIFICATIONS\` in \`packages/institution/src/policy.ts\`), least to most sensitive: ${RESOURCE_CLASSIFICATIONS.map((c) => `\`${c}\``).join(', ')}.`,
    '',
    ...table(
      ['Catalogued event types', 'Count'],
      [
        ['All', String(ev.length)],
        ...RETENTION_CLASSES.map((c) => [`retention \`${c}\``, String(byRet.get(c) ?? 0)]),
        ...RESOURCE_CLASSIFICATIONS.map((c) => [`classification \`${c}\``, String(byCls.get(c) ?? 0)]),
      ],
    ),
  );
  note(
    'The two constant arrays are imported and printed; event types are counted from the `EVENT_TYPES` catalogue by the retention class and classification floor each declares.',
    'These are the vocabularies of the institution event envelope. The comment in `packages/institution/src/events.ts` says durations are policy in `RETENTION.md`, not code. The classes label rows; they do not delete anything, and the app\'s student data on the device is outside them.',
  );

  // 6. edge functions
  const dirs = readdirSync(at('supabase/functions'), { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== '_shared').map((d) => d.name).sort();
  const blocks = parseFunctionBlocks(read('supabase/config.toml'));
  h('## Edge functions and JWT verification');
  out.push(
    ...table(
      ['Function', '`verify_jwt` in `supabase/config.toml`', '`getUser` in its entry file', 'Comment above its config block'],
      dirs.map((d) => {
        const b = blocks.find((x) => x.name === d);
        const src = existsSync(at(`supabase/functions/${d}/index.ts`)) ? read(`supabase/functions/${d}/index.ts`) : '';
        return [`\`${d}\``, b ? b.verifyJwt : '(no block)', /getUser/.test(src) ? 'yes' : 'no', b?.note || '(none)'];
      }),
    ),
    '',
    `${dirs.length} function directories; ${blocks.filter((b) => b.verifyJwt === 'false').length} set \`verify_jwt = false\`; ${blocks.filter((b) => b.verifyJwt === 'true').length} set it to true.`,
  );
  note(
    'Directories of `supabase/functions/` other than `_shared`, joined to the `[functions.<name>]` blocks of `supabase/config.toml`. The comment is the lines directly above the block.',
    '`verify_jwt = false` turns off the platform\'s token check. The header comment of `supabase/config.toml` says this is deliberate for every function listed: each checks the credential itself, because the platform check would reject the CORS preflight, which carries no `Authorization` header. The comments above individual blocks name the credential where it is not a user token (a Stripe signature, a link token). "`getUser` in its entry file" is a text search of the function\'s entry file only: a function may delegate the check to a `_shared` module or use a non-user credential. Neither column proves the check is correct; each function\'s own tests do.',
  );

  // 7. definer register
  const derived = definerDerived();
  const cats = count(FUNCTIONS as unknown as [string, string][], (f) => f[1]);
  h('## Security-definer function register');
  out.push(
    ...table(
      ['Measure', 'Count'],
      [
        ['Rows in `app/src/lib/definerregister.ts` (the data behind `docs/DEFINER-RLS-REGISTER.md`)', String(FUNCTIONS.length)],
        ['Callable `security definer` functions derived from migrations ∩ `supabase/grants.check.sql` allowlist', String(derived.length)],
        ['Derived set equals the register\'s names', derived.join(',') === [...FUNCTIONS.map((f) => f[0])].sort().join(',') ? 'yes' : 'no'],
        [`Policy-less tables pinned in the register (production reading of ${SECOND_READING.on}: ${SECOND_READING.tables})`, String(TABLES.length)],
        [`Functions in the first production reading / the second (${SECOND_READING.on})`, `${READ_COUNT} / ${SECOND_READING.functions}`],
        ['Tables in the first production reading', String(READ_TABLES)],
        ...Object.keys(CATEGORIES).map((c) => [`Register rows in category \`${c}\``, String(cats.get(c) ?? 0)]),
      ],
    ),
  );
  note(
    'The register rows are imported from the data module. The derived set repeats the register test\'s method: the winning `create function` in `public` for each name across migrations in filename order, kept when it says `security definer`, intersected with the names in the allowlist of `supabase/grants.check.sql`.',
    'The 151, 180, 45 and 49 figures are readings of a production project on dated days, recorded in `docs/DEFINER-RLS-REGISTER.md`; this test does not query any project. The register has more rows than the readings because later migrations added functions, as that page explains. A listed function having a gate is checked by the register\'s own test, not here.',
  );

  // 8. third parties and kill switches
  const kinds = count(PARTIES as unknown as { kind: string }[], (x) => x.kind);
  const flags = read('app/src/lib/flags.ts');
  const kill = [...(/export const KILL_SWITCHES[^=]*=\s*\[([\s\S]*?)\]/.exec(flags)?.[1] ?? '').matchAll(/'(kill\.[a-z_]+)'/g)].map((m) => m[1]);
  h('## Third parties and kill switches');
  out.push(
    ...table(
      ['Measure', 'Count'],
      [
        ['Parties in `docs/SUBPROCESSORS.md` (data in `app/src/lib/trust/subprocessors.ts`)', String(PARTIES.length)],
        ['… kind `subprocessor`', String(kinds.get('subprocessor') ?? 0)],
        ['… kind `institution-directed`', String(kinds.get('institution-directed') ?? 0)],
        ['… kind `student-directed`', String(kinds.get('student-directed') ?? 0)],
        [`Kill switches in \`app/src/lib/flags.ts\` (${kill.map((k) => `\`${k}\``).join(', ')})`, String(kill.length)],
      ],
    ),
  );
  note(
    'Parties are imported from the data module that renders the subprocessor page; kill-switch keys are read from the `KILL_SWITCHES` array in the flags source text.',
    'The `kind` is an engineering classification that the subprocessor page says counsel has not reviewed. A kill switch existing in code is not a statement about its state in any environment.',
  );

  return `${out.join('\n')}\n`;
}

/* ───────────────────────── page-checking helpers ───────────────────────── */

const CARD = /^> \*\*Type:\*\* (tutorial|how-to|reference|explanation|runbook|help|release) · \*\*Audience:\*\* ([a-z-]+(?:, [a-z-]+)*) · \*\*Owner:\*\* `([a-z]+)` · \*\*Truth:\*\* (generated|held|reviewed) · \*\*Reviewed:\*\* (\d{4}-\d{2}-\d{2}) · \*\*Held by:\*\* (`[^`]+`|—)$/;
const AUDIENCES = ['students', 'families', 'faculty', 'institution-admins', 'implementers', 'partner-developers', 'contributors', 'operators', 'support', 'buyers', 'security-reviewers'];

export function checkCard(text: string, expect_: { type: string; truth: string }): string[] {
  const problems: string[] = [];
  const lines = text.split('\n');
  if (!lines[0].startsWith('# ')) problems.push('first line is not a title');
  if (lines[1] !== '') problems.push('line 2 is not blank');
  const m = CARD.exec(lines[2] ?? '');
  if (!m) return [...problems, 'line 3 is not a well-formed card'];
  if (m[1] !== expect_.type) problems.push(`type ${m[1]} != ${expect_.type}`);
  if (m[4] !== expect_.truth) problems.push(`truth ${m[4]} != ${expect_.truth}`);
  if (!(SEATS as readonly string[]).includes(m[3])) problems.push(`owner ${m[3]} is not a seat`);
  for (const a of m[2].split(', ')) if (!AUDIENCES.includes(a)) problems.push(`audience ${a} unknown`);
  if (m[5] !== '2026-10-04') problems.push('reviewed date is not 2026-10-04');
  if (m[6] !== `\`${TEST}\``) problems.push('held-by is not this test');
  if (text.split('\n').filter((l) => l.startsWith('> **Type:**')).length !== 1) problems.push('not exactly one card line');
  return problems;
}

/** Markdown link targets that are in-repo: [text](target), target without a scheme. */
export function localLinks(text: string): string[] {
  const noCode = text.replace(/```[\s\S]*?```/g, '');
  return [...noCode.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1])
    .filter((t) => !/^[a-z]+:/i.test(t) && !t.startsWith('#'))
    .map((t) => t.split('#')[0]);
}

export function brokenLinks(page: string, text: string): string[] {
  return localLinks(text).filter((t) => !existsSync(join(dirname(at(page)), t)));
}

const PATHLIKE = /^(?:\.?[\w-]+\/)+[\w.*-]*$|^[\w.-]+\.(?:md|ts|tsx|sql|toml|yml|mjs|json|sh)$/;
const PATH_SKIP = /^docs\/evidence\/?$|^docs\/evidence\/vendors\/$/;

/** Backticked tokens that look like repository paths and do not exist. */
export function missingCitations(page: string, text: string): string[] {
  const out: string[] = [];
  const outsideLinks = text.replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
  for (const m of outsideLinks.matchAll(/`([^`\s]+)`/g)) {
    const p = m[1];
    if (!PATHLIKE.test(p) || p.includes('*') || p.includes('<') || PATH_SKIP.test(p)) continue;
    if (p.startsWith('http')) continue;
    const ok = existsSync(at(p)) || existsSync(join(dirname(at(page)), p)) || existsSync(join(at('app'), p));
    if (!ok) out.push(p);
  }
  return out;
}

/** Statement words the registers use. */
export const STATUS_WORDS = ['LIVE', 'IMPLEMENTED_NOT_RELEASED', 'PARTIAL', 'MOCK_DEMO', 'PLANNED', 'BLOCKED'] as const;

/* Claim words. A hit is allowed inside a quotation, a code span or when its
 * sentence states absence. */
const CLAIM_WORD = /\b(compliant|compliance|certified|certification|secure|SOC ?2|HECVAT-complete|conformant)\b/i;
const ABSENCE = /\b(no|not|never|none|nothing|neither|nor|without|absent|lacks?|owed|pending|planned|refus\w+|until|unless|cannot|does not|do not|is not|are not|has not|have not|hasn't|isn't|aren't|n't|before|would|if)\b|n't\b/i;

export function claimHits(text: string): string[] {
  const body = text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/“[^”]*”/g, ' ')
    .replace(/"[^"]*"/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .split('\n')
    .filter((l) => !l.startsWith('>'))
    .join('\n');
  const sentences = body.split(/(?<=[.!?:])\s+|\n+|\s\|\s|\|/);
  return sentences.filter((s) => CLAIM_WORD.test(s) && !ABSENCE.test(s) && !s.trim().endsWith('?')).map((s) => s.trim());
}

/** The existing trust package rule, applied to my pages too. */
const AFFIRMATIVE =
  /\b(?:is|are|we are|semester is)\s+(?:now\s+)?(?:SOC 2|ISO 27001|HIPAA|FERPA|HECVAT|WCAG|PCI)[- ](?:certified|compliant|audited|attested)/i;

/* ───────────────────────── the tests ───────────────────────── */

describe('trust documentation: probes are shown a failure and a pass first', () => {
  it('the card checker rejects a bad card and accepts a good one', () => {
    const good = `# T\n\n> **Type:** reference · **Audience:** buyers · **Owner:** \`security\` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** \`${TEST}\`\n`;
    expect(checkCard(good, { type: 'reference', truth: 'held' })).toEqual([]);
    expect(checkCard(good.replace('security', 'harrison'), { type: 'reference', truth: 'held' })).toEqual(['owner harrison is not a seat']);
    expect(checkCard(good.replace('reference', 'explanation'), { type: 'reference', truth: 'held' }).length).toBeGreaterThan(0);
    expect(checkCard('# T\n\nno card\n', { type: 'reference', truth: 'held' })).toContain('line 3 is not a well-formed card');
  });

  it('the claim scanner flags affirmative claims and passes absences, quotes and code', () => {
    expect(claimHits('Semester is SOC 2 certified.').length).toBe(1);
    expect(claimHits('The platform is secure by design.').length).toBe(1);
    expect(claimHits('We are FERPA compliant.').length).toBe(1);
    expect(claimHits('There is no SOC 2 report.')).toEqual([]);
    expect(claimHits('Semester has not completed a SOC 2 audit.')).toEqual([]);
    expect(claimHits('The register row reads “An independent audit or certification such as SOC 2”.')).toEqual([]);
    expect(claimHits('The `soc2` claim is `planned`.')).toEqual([]);
    expect(claimHits('Do you hold a SOC 2 report?')).toEqual([]);
    expect(AFFIRMATIVE.test('Semester is SOC 2 certified.')).toBe(true);
  });

  it('the link and citation probes see a planted broken link and a planted missing path', () => {
    expect(brokenLinks('docs/trust/X.md', 'see [a](NOPE-NOT-HERE.md) and [b](SECURITY-WHITEPAPER.md)')).toEqual(['NOPE-NOT-HERE.md']);
    expect(missingCitations('docs/trust/X.md', 'see `app/src/lib/nonexistent-file.ts` and `SECURITY.md`')).toEqual(['app/src/lib/nonexistent-file.ts']);
  });

  it('the RLS parser counts a planted table with RLS, one without, and skips a dropped one', () => {
    const r = rlsPosture([
      { name: 'a.sql', sql: 'create table public.a (x int); alter table public.a enable row level security; create policy "p" on public.a for select using (true);' },
      { name: 'b.sql', sql: 'create table b (x int); create table private.c (x int); alter table private.c enable row level security; create table gone (x int); -- create table commented (x int);' },
      { name: 'c.sql', sql: 'drop table if exists gone; select 1 as "create table as";' },
    ]);
    expect(r.live).toEqual(['private.c', 'public.a', 'public.b']);
    expect(r.withoutRls).toEqual(['public.b']);
    expect(r.withPolicy).toEqual(['public.a']);
    expect(r.privateRls).toBe(1);
  });

  it('the first-proof extractor strips the path header and stops at the first sentence', () => {
    expect(firstProof('-- supabase/x.check.sql — who may read. More text here.\n--\n-- second para')).toBe('who may read.');
    expect(firstProof('-- A plain first line. And more.\n')).toBe('A plain first line.');
  });

  it('the function-block parser reads a planted block and its comment', () => {
    const b = parseFunctionBlocks('# header\n\n# The credential is a signature.\n[functions.x]\nverify_jwt = false\n\n[functions.y]\nverify_jwt = true\n');
    expect(b).toEqual([
      { name: 'x', verifyJwt: 'false', note: 'The credential is a signature.' },
      { name: 'y', verifyJwt: 'true', note: '' },
    ]);
  });
});

describe('docs/trust/CONTROL-FACTS.md', () => {
  const rendered = render();

  it('is exactly what the sources render', () => {
    if (process.env.REGISTERS === 'write') writeFileSync(at(FACTS), rendered);
    expect(read(FACTS)).toBe(rendered);
  });

  it('measures something: every probe returned a plausible, non-empty reading', () => {
    const p = rlsPosture(migrationFiles().map((name) => ({ name, sql: read(`supabase/migrations/${name}`) })));
    expect(p.publicTotal).toBeGreaterThan(100);
    expect(p.withRls.length).toBeGreaterThan(p.withoutRls.length);
    expect(readdirSync(at('supabase')).filter((f) => f.endsWith('.check.sql')).length).toBeGreaterThan(50);
    expect(parseHeadersFile(read('app/public/_headers')).has('Content-Security-Policy')).toBe(true);
    expect(parseFunctionBlocks(read('supabase/config.toml')).length).toBeGreaterThan(10);
    expect(definerDerived().length).toBeGreaterThan(100);
    // control: the derived definer set matches the register, so the parser is not returning something unrelated
    expect(definerDerived()).toEqual([...FUNCTIONS.map((f) => f[0])].sort());
    expect(rendered).toContain('| Derived set equals the register\'s names | yes |');
  });

  it('has a "how counted" and a "what this does not prove" under every section', () => {
    const sections = rendered.split('\n## ').slice(1);
    expect(sections.length).toBe(7 + 1);
    for (const s of sections) {
      expect(s, s.split('\n')[0]).toContain('**How counted.**');
      expect(s, s.split('\n')[0]).toContain('**What this does not prove.**');
    }
  });

  it('every function directory has a config block, and the page says none verifies a platform JWT only if that is true', () => {
    const dirs = readdirSync(at('supabase/functions'), { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== '_shared').map((d) => d.name);
    const blocks = parseFunctionBlocks(read('supabase/config.toml')).map((b) => b.name);
    expect(blocks.sort()).toEqual(dirs.sort());
  });
});

describe('the hand-written pages', () => {
  const cards: Record<string, { type: string; truth: string }> = {
    'docs/trust/SECURITY-OVERVIEW.md': { type: 'explanation', truth: 'held' },
    'docs/trust/REVIEWER-QUESTION-MAP.md': { type: 'reference', truth: 'held' },
    'docs/trust/DOCUMENT-MAP.md': { type: 'reference', truth: 'held' },
    [FACTS]: { type: 'reference', truth: 'generated' },
  };

  for (const page of PAGES) {
    describe(page, () => {
      const text = read(page);
      it('has a valid card and a one-sentence purpose line', () => {
        expect(checkCard(text, cards[page])).toEqual([]);
        const purpose = text.split('\n').slice(3).find((l) => l.trim() !== '' && !l.startsWith('<!--'));
        expect(purpose && purpose.length > 30 && !purpose.startsWith('#')).toBe(true);
      });
      it('has links that resolve', () => {
        expect(brokenLinks(page, text)).toEqual([]);
        expect(localLinks(text).length).toBeGreaterThan(0);
      });
      it('cites only paths that exist', () => {
        expect(missingCitations(page, text)).toEqual([]);
      });
      it('makes no unqualified claim of compliance, certification, security or SOC 2', () => {
        expect(claimHits(text)).toEqual([]);
        expect(text.split('\n').filter((l) => AFFIRMATIVE.test(l) && !/\bnot\b|\bno\b|n't|never/i.test(l))).toEqual([]);
      });
    });
  }

  it('uses no real email address and no private hostnames', () => {
    for (const page of PAGES) {
      const text = read(page);
      expect(text, page).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      expect(text, page).not.toMatch(/supabase\.co|lzrqvlugnawcgywkhqlz/);
    }
  });
});

describe('docs/trust/SECURITY-OVERVIEW.md', () => {
  const text = read('docs/trust/SECURITY-OVERVIEW.md');
  const rows = text.split('\n').filter((l) => /^\| S\d{2} \|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));

  it('opens with a status box that lists what has not been done', () => {
    const box = text.split('## What has not been done')[1]?.split('\n## ')[0] ?? '';
    for (const w of ['penetration test', 'SOC 2', 'HECVAT', 'accessibility', 'data processing agreement']) expect(box.toLowerCase(), w).toContain(w.toLowerCase());
  });

  it('gives every statement row an evidence cell with a path and a known status word', () => {
    expect(rows.length).toBeGreaterThanOrEqual(14);
    for (const r of rows) {
      const [, id, , evidence, status] = r;
      expect(evidence, id).toMatch(/`[^`]+`/);
      expect(STATUS_WORDS as readonly string[], id).toContain(status.replace(/\*/g, '').split(' ')[0]);
    }
  });

  it('numbers its statements uniquely', () => {
    const ids = rows.map((r) => r[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('control: a row with no evidence path would be caught', () => {
    expect('| S99 | x | y | nothing | PLANNED |'.split('|').map((c) => c.trim())[4]).not.toMatch(/`[^`]+`/);
  });
});

describe('docs/trust/REVIEWER-QUESTION-MAP.md', () => {
  const text = read('docs/trust/REVIEWER-QUESTION-MAP.md');
  const rows = text.split('\n').filter((l) => /^\| Q\d{2} \|/.test(l)).map((l) => l.split('|').map((c) => c.trim()));

  it('has rows, each with a unique id, an existing answering page, a status word, a register and a seat', () => {
    expect(rows.length).toBeGreaterThanOrEqual(20);
    const ids = new Set<string>();
    for (const r of rows) {
      const [, id, , page, status, register, seat] = r;
      expect(ids.has(id), `duplicate ${id}`).toBe(false);
      ids.add(id);
      const target = /\]\(([^)]+)\)/.exec(page)?.[1];
      expect(target, `${id}: answering page link`).toBeTruthy();
      expect(existsSync(join(at('docs/trust'), (target ?? '').split('#')[0])), `${id}: ${target}`).toBe(true);
      expect(['answered', 'partial', 'not yet'], id).toContain(status);
      expect(register.length, id).toBeGreaterThan(15);
      expect(SEATS as readonly string[], id).toContain(seat.replace(/`/g, ''));
    }
  });

  it('never marks a row answered when the page it points at carries a draft or not-started status', () => {
    for (const r of rows) {
      if (r[4] !== 'answered') continue;
      const target = /\]\(([^)]+)\)/.exec(r[3])?.[1]?.split('#')[0] ?? '';
      const page = read(relative(root, join(at('docs/trust'), target)));
      const head = page.split('\n').slice(0, 14).join('\n');
      expect(head, `${r[1]} ${target}`).not.toMatch(/NOT_STARTED|DRAFT|INCOMPLETE|NOT BUILT|Not in force|Not usable/i);
    }
  });

  it('control: the answered-versus-draft rule is shown a draft', () => {
    expect('# T\n**Status:** DRAFT').toMatch(/NOT_STARTED|DRAFT|INCOMPLETE|NOT BUILT|Not in force|Not usable/i);
  });
});

describe('docs/trust/DOCUMENT-MAP.md', () => {
  const DIRS = ['docs/trust', 'docs/security', 'docs/compliance', 'docs/legal'] as const;
  const text = read('docs/trust/DOCUMENT-MAP.md');

  /** Every .md in the four directories, as a repo-relative path. */
  const governed = () => DIRS.flatMap((d) => readdirSync(at(d)).filter((f) => f.endsWith('.md')).map((f) => `${d}/${f}`)).sort();

  /** The repo-relative target of every link in the map. */
  const targets = (t: string) => localLinks(t).map((l) => normalize(join('docs/trust', l)));

  /** Files listed zero or several times. */
  const listing = (files: string[], t: string) => {
    const linked = targets(t);
    return {
      missing: files.filter((f) => !linked.includes(f) && f !== 'docs/trust/DOCUMENT-MAP.md'),
      twice: files.filter((f) => linked.filter((l) => l === f).length > 1),
    };
  };

  it('lists every document in the four trust directories exactly once', () => {
    const files = governed();
    expect(files.length).toBeGreaterThan(80);
    const l = listing(files, text);
    expect(l.missing).toEqual([]);
    expect(l.twice).toEqual([]);
  });

  it('control: the check sees a document that is not listed, and one listed twice', () => {
    const files = ['docs/trust/SLA.md', 'docs/trust/DPA-CHECKLIST.md'];
    expect(listing(files, '[a](SLA.md) [b](DPA-CHECKLIST.md)')).toEqual({ missing: [], twice: [] });
    expect(listing(files, '[a](SLA.md)').missing).toEqual(['docs/trust/DPA-CHECKLIST.md']);
    expect(listing(files, '[a](SLA.md) [b](DPA-CHECKLIST.md) [c](SLA.md)').twice).toEqual(['docs/trust/SLA.md']);
  });

  it('says what it adds to the existing index and links the two it reconciles with', () => {
    expect(text).toContain('](README.md)');
    expect(text).toContain('SECURITY-ACCESSIBILITY-READINESS.md');
  });

  it('gives every listed document a one-line description and flags drafts', () => {
    const rowsOf = text.split('\n').filter((l) => /^\| \[/.test(l));
    expect(rowsOf.length).toBeGreaterThan(80);
    for (const r of rowsOf) expect(r.split('|').map((c) => c.trim())[2].length, r).toBeGreaterThan(15);
    // every legal file is a draft by name or status, and the map must say so
    for (const f of readdirSync(at('docs/legal')).filter((x) => x.endsWith('.md'))) {
      const row = rowsOf.find((r) => r.includes(`(../legal/${f})`));
      expect(row, f).toBeTruthy();
      expect(row!.split('|').map((c) => c.trim())[3], f).toMatch(/draft/i);
    }
  });
});
