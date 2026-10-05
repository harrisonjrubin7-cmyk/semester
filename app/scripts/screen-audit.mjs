/*
 * The screen inventory: every screen, the area it belongs to, and the half of
 * the consistency rubric a program can score.
 *
 *     npm run audit:screens            prints the table
 *     npm run audit:screens -- --write writes docs/design/SCREEN-AUDIT.md
 *
 * The rubric is the one in `docs/design/SEMESTER-UI-CONSTITUTION.md` §9: ten
 * criteria scored 0–2. Five of them can be read from source — whether the
 * screen sits in the shared frame, whether it says what it is for, whether it
 * uses colour tokens, how many primary actions it offers, and how much of it
 * is hand-styled. The other five — responsive layout, verified accessibility,
 * complete states, navigation clarity and plain language — need a person with
 * the app open, and this does not pretend to score them. A screen that reads
 * 10/10 here has passed the half that a grep can check, which is the half that
 * drifts without anybody noticing.
 *
 * ## It measures modules, not screens
 *
 * `screens/Courses.tsx` draws three screens, and the numbers below are the
 * file's. Every screen drawn from one module carries that module's row, and
 * the table says which module each screen comes from so the repetition is
 * visible rather than read as three findings.
 *
 * ## Why a parse and not an import
 *
 * The same reason as `destinations.mjs`: `lib/nav.ts` and `lib/navareas.ts`
 * import half the app and node cannot load them. Each parse throws on a short
 * answer rather than returning one, because an empty inventory prints as a
 * clean one.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const read = (p) => readFileSync(join(src, p), 'utf8');

function need(what, n, floor) {
  if (n < floor) throw new Error(`screen-audit: read ${n} ${what}, expected at least ${floor} — has the file moved?`);
}

/** screen id -> module path, from the SCREENS table plus the statically imported Today. */
function screenModules() {
  const source = read('screens.tsx');
  const moduleOf = new Map();
  for (const m of source.matchAll(/const (\w+) = lazy\(\(\) =>\s*import\('\.\/([^']+)'\)/g)) moduleOf.set(m[1], m[2]);
  const table = /export const SCREENS[^=]*= \{([\s\S]*?)\n\};/.exec(source)?.[1] ?? '';
  const out = new Map([['home', 'screens/Today.tsx']]);
  for (const m of table.matchAll(/^\s*(\w+): (\w+),$/gm)) {
    const mod = moduleOf.get(m[2]);
    if (mod) out.set(m[1], /\.tsx?$/.test(mod) ? mod : `${mod}.tsx`);
  }
  need('screens', out.size, 80);
  return out;
}

/** The body of `const NAME ... = {` up to its closing `};`. */
function block(source, name) {
  const at = source.indexOf(`const ${name}`);
  if (at < 0) throw new Error(`screen-audit: no ${name}`);
  const open = source.indexOf('{', source.indexOf('=', at));
  return source.slice(open + 1, source.indexOf('\n};', open));
}

function areas() {
  const j = read('lib/navareas.ts');
  const areaOf = new Map();
  for (const m of block(j, 'NAV_AREA_OF').matchAll(/^\s+(\w+): '(\w+)',$/gm)) areaOf.set(m[1], m[2]);
  need('area entries', areaOf.size, 50);
  for (const m of block(j, 'UNROOTED').matchAll(/^\s+(\w+): '(\w+)',$/gm)) areaOf.set(m[1], m[2]);
  const labels = new Map();
  for (const m of j.matchAll(/id: '(\w+)',\s*\n\s*label: '([^']+)'/g)) labels.set(m[1], m[2]);
  need('areas', labels.size, 6);
  return { areaOf, labels };
}

function registry() {
  const nav = read('lib/nav.ts');
  const start = nav.indexOf('export const DESTINATIONS');
  const body = nav.slice(start, nav.indexOf('\n];', start));
  const shelf = new Map();
  const label = new Map();
  for (const row of body.split(/\n  \{\n/).slice(1)) {
    const s = /screen: '(\w+)'/.exec(row)?.[1];
    if (!s) continue;
    shelf.set(s, /group: '(\w+)'/.exec(row)?.[1] ?? '');
    label.set(s, /label: '([^']+)'/.exec(row)?.[1] ?? /label: "([^"]+)"/.exec(row)?.[1] ?? s);
  }
  need('destinations', shelf.size, 50);
  const named = new Map();
  for (const m of block(nav, 'NESTED_NAMES').matchAll(/^\s+(\w+): '([^']+)',$/gm)) named.set(m[1], m[2]);
  const nested = new Map();
  for (const m of block(nav, 'NESTED').matchAll(/^\s+(\w+): '(\w+)',$/gm)) nested.set(m[1], m[2]);
  return { shelf, label, nested, named };
}

/** Source with comments removed, so a hex value quoted in prose is not counted. */
function code(source) {
  // The same stripper as `src/pageframe.test.ts`: only comments that open a
  // line or a JSX expression, so `accept="image/*"` does not eat the code.
  return source.replace(/(^|\{)[ \t]*\/\*[\s\S]*?\*\//gm, '$1').replace(/^[ \t]*\/\/.*$/gm, '');
}

function measure(file) {
  const raw = read(file);
  const c = code(raw);
  const lines = raw.split('\n').length;
  const frame = /<Page\b/.test(c) ? 'Page' : /<SettingsPage\b/.test(c) ? 'SettingsPage' : 'none';
  const hex = (c.match(/['"`]#[0-9a-fA-F]{3,8}\b/g) ?? []).length + (c.match(/rgba?\(/g) ?? []).length;
  const styles = (c.match(/style=\{\{/g) ?? []).length;
  const primaries = (c.match(/btn-primary|portal-primary|<ActionButton\b/g) ?? []).length;
  // The second primary-button style: `.portal-primary` in `styles/features.css`.
  const portal = /portal-primary/.test(c);
  return {
    lines,
    frame,
    // An explicit sentence, as against `blurb={null}`, which opts out of the default.
    blurb: /\bblurb=(?!\{null\})/.test(c),
    optOut: /\bblurb=\{null\}/.test(c),
    hex,
    styles,
    primaries,
    portal,
    empty: /<EmptyState\b/.test(c),
    trust: /<SourceBadge\b|<NotOfficial\b|sourceLine\(|IntelligenceDisclosure/.test(c),
  };
}

function score(m, said) {
  const frame = m.frame === 'Page' ? 2 : m.frame === 'SettingsPage' ? 1 : 0;
  const purpose = said === '—' ? 0 : 2;
  const colour = m.hex === 0 ? 2 : m.hex <= 3 ? 1 : 0;
  // A module with no primary at all may be a list whose rows are the action;
  // that is not a finding, only not evidence of a clear one.
  const action = m.primaries === 0 ? 1 : m.primaries <= 2 ? 2 : m.primaries <= 4 ? 1 : 0;
  const density = (m.styles / m.lines) * 100;
  const styled = density <= 3 ? 2 : density <= 8 ? 1 : 0;
  return { frame, purpose, colour, action, styled, total: frame + purpose + colour + action + styled };
}

const SHELL = new Set(['search', 'directory']);

const band = (t) => (t >= 9 ? 'System-ready' : t >= 6 ? 'Targeted migration' : 'Redesign before new features');

function build() {
  const mods = screenModules();
  const { areaOf, labels } = areas();
  const { shelf, label, nested, named } = registry();
  const cache = new Map();
  const rows = [];
  for (const [screen, file] of mods) {
    if (!cache.has(file)) cache.set(file, measure(file));
    const m = cache.get(file);
    const root = nested.get(screen) ?? screen;
    // `search` and `directory` are the workspace shell looking at itself
    // (`lib/desk.ts`), not places in the navigation.
    const area = /^set[A-Z]/.test(screen)
      ? 'you'
      : SHELL.has(screen)
        ? 'shell'
        : areaOf.get(screen) ?? areaOf.get(root) ?? '—';
    // `App.tsx` hands `Page` the registry sentence for every destination but
    // Today (`PagePurpose` in components/Page.tsx), so a framed destination
    // says what it is for unless it opted out or wrote its own.
    const said = m.blurb
      ? 'own'
      : m.frame === 'Page' && label.has(screen) && screen !== 'home' && !m.optOut
        ? 'registry'
        : '—';
    rows.push({
      said,
      screen,
      name: label.get(screen) ?? named.get(screen) ?? (/^set[A-Z]/.test(screen) ? `Settings: ${screen.slice(3)}` : screen),
      area,
      areaLabel: area === 'shell' ? 'Shell' : labels.get(area) ?? '—',
      shelf: shelf.get(screen) ?? shelf.get(root) ?? '—',
      file,
      m,
      s: score(m, said),
    });
  }
  const order = [...labels.keys(), 'shell'];
  rows.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area) || a.s.total - b.s.total || a.screen.localeCompare(b.screen));
  return { rows, labels, modules: cache };
}

function markdown({ rows, labels, modules }) {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim();
  } catch {
    /* not a checkout */
  }
  const today = new Date().toISOString().slice(0, 10);
  const yes = (b) => (b ? 'yes' : '—');
  const bands = {};
  for (const r of rows) bands[band(r.s.total)] = (bands[band(r.s.total)] ?? 0) + 1;
  const mods = [...modules.values()];
  const out = [];
  out.push('# Screen audit');
  out.push('');
  out.push(`Generated ${today} at \`${commit}\` by \`npm run audit:screens -- --write\` (run from \`app/\`). Do not edit by hand.`);
  out.push('');
  out.push(
    'Every screen in `app/src/screens.tsx`, the navigation area `lib/navareas.ts` files it under, and the five criteria of the constitution’s rubric (§9) that can be read from source. ' +
      'The other five — responsive layout, verified accessibility, complete states, navigation clarity, plain language — need a person with the app open and are **not scored here**. ' +
      'Scores are per module: screens drawn from the same file share a row’s numbers.',
  );
  out.push('');
  out.push('## Summary');
  out.push('');
  out.push(`- **${rows.length} screens** from **${modules.size} modules**.`);
  out.push(`- In the shared \`Page\` frame: ${mods.filter((m) => m.frame === 'Page').length} modules; in \`SettingsPage\`: ${mods.filter((m) => m.frame === 'SettingsPage').length}; frameless: ${mods.filter((m) => m.frame === 'none').length}.`);
  out.push(`- Showing a purpose sentence: ${rows.filter((r) => r.said !== '—').length} of ${rows.length} screens — ${rows.filter((r) => r.said === 'own').length} their own, ${rows.filter((r) => r.said === 'registry').length} the registry's by default.`);
  out.push(`- With colour literals (hex or \`rgb()\`/\`rgba()\`) instead of tokens: ${mods.filter((m) => m.hex > 0).length} modules, ${mods.reduce((n, m) => n + m.hex, 0)} literals in all.`);
  out.push(`- Using the second primary-button style, \`.portal-primary\` (\`styles/features.css\`), beside \`.btn-primary\`: ${mods.filter((m) => m.portal).length} screen modules (components are not scanned).`);
  out.push(`- Showing a source or trust label: ${mods.filter((m) => m.trust).length} modules. Using the shared \`EmptyState\`: ${mods.filter((m) => m.empty).length}.`);
  out.push('');
  out.push('| Band (automatable half, out of 10) | Screens |');
  out.push('|---|---:|');
  for (const b of ['System-ready', 'Targeted migration', 'Redesign before new features']) out.push(`| ${b} (${b === 'System-ready' ? '9–10' : b === 'Targeted migration' ? '6–8' : '0–5'}) | ${bands[b] ?? 0} |`);
  out.push('');
  out.push('| Area | Screens | Mean score |');
  out.push('|---|---:|---:|');
  for (const [id, lbl] of labels) {
    const inArea = rows.filter((r) => r.area === id);
    if (!inArea.length) continue;
    const mean = inArea.reduce((n, r) => n + r.s.total, 0) / inArea.length;
    out.push(`| ${lbl} | ${inArea.length} | ${mean.toFixed(1)} |`);
  }
  out.push('');
  out.push('## Criteria');
  out.push('');
  out.push('| Column | 2 | 1 | 0 |');
  out.push('|---|---|---|---|');
  out.push('| Frame | renders `<Page>` | renders `<SettingsPage>` (the second frame) | neither |');
  out.push('| Purpose | its own `blurb`, or the registry sentence `Page` draws by default | — | neither |');
  out.push('| Colour | no colour literals | 1–3 | 4 or more |');
  out.push('| Action | 1–2 primary buttons | none, or 3–4 | 5 or more |');
  out.push('| Styling | ≤3 inline `style={{` per 100 lines | ≤8 | more |');
  out.push('');
  out.push('## Every screen');
  out.push('');
  out.push('| Area | Screen | Shelf | Module | Frame | Purpose | Colour literals | Primaries | Inline styles / 100 lines | Empty state | Trust label | Score | Band |');
  out.push('|---|---|---|---|---|---|---:|---:|---:|---|---|---:|---|');
  for (const r of rows) {
    const d = ((r.m.styles / r.m.lines) * 100).toFixed(1);
    out.push(
      `| ${r.areaLabel} | ${r.name} \`${r.screen}\` | ${r.shelf} | \`${r.file}\` | ${r.m.frame} | ${r.said} | ${r.m.hex} | ${r.m.primaries} | ${d} | ${yes(r.m.empty)} | ${yes(r.m.trust)} | ${r.s.total} | ${band(r.s.total)} |`,
    );
  }
  out.push('');
  return out.join('\n');
}

const result = build();
const md = markdown(result);
if (process.argv.includes('--write')) {
  const to = join(here, '..', '..', 'docs', 'design', 'SCREEN-AUDIT.md');
  writeFileSync(to, md);
  console.log(`wrote ${to} — ${result.rows.length} screens`);
} else {
  console.log(md);
}
