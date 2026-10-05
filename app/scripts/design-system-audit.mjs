/**
 * The design-system contract that no other gate reads, as a command that fails.
 *
 *     npm run design-system:audit
 *
 * `npm run lint` already holds the type scale and the label and vocabulary
 * rules; `src/styles/hex.test.ts` holds hex colours in `.tsx`;
 * `src/lib/tokenexport.test.ts` holds `design-tokens/semester.tokens.json` to
 * the code that generates it. This is the part that sat between them:
 *
 *   1. **A colour is a token.** A colour written into a stylesheet or an inline
 *      style is one colour on thirteen grounds, outside `lib/contrast.test.ts`.
 *      Every file that still holds one is on a ledger below with its count:
 *      more fails, a file that is not listed fails at one, and fewer fails too,
 *      so the ledger can only get shorter (the idiom of `hex.test.ts`).
 *
 *   2. **A `var(--x)` names something.** A custom property that nothing defines
 *      makes its declaration invalid at computed-value time and CSS says
 *      nothing: `border: 1px solid var(--app-border)` with no `--app-border`
 *      has no border, on every ground, and no test noticed. A reference with a
 *      fallback is a deliberate optional hook and is not read. The names that
 *      are undefined today are on a ledger of their own and may only shrink.
 *
 *   3. **The export is the Figma interchange file.** It has to exist and carry
 *      the schema the exporter writes. That it matches the code is
 *      `tokenexport.test.ts`'s to prove; this reads the committed file because
 *      plain `node` cannot import `lib/look.ts` (its imports have no
 *      extension), which is also why `tokens:export` runs under vitest.
 *
 *   4. **A Figma mapping row resolves.** `docs/FIGMA-MAPPING.md` names, for each
 *      Figma variable, the exported path it takes its value from. A row whose
 *      path is not in the export, whose CSS name is not the path's own, or
 *      whose Figma name is used twice is a broken mapping and fails. A semantic
 *      token with no row is *reported*, not failed, until the Figma file exists
 *      (docs/design/DESIGN-SYSTEM-PRODUCT-SPEC.md §7.2 step 4).
 *
 * What it does not read, so no consumer assumes it: named colours (`white`),
 * `prefers-contrast: more` values, a colour built at runtime, a hex in a `.ts`
 * file (the registers hold `#1234`-style references that read as hex), and any
 * Figma file — nothing here reaches Figma.
 *
 * `src/styles/designsync.test.ts` drives this against fixture trees and against
 * the real one, so a rule cannot pass the suite and fail the command or the
 * reverse. `audit()` is exported for it and for `design-system-report.mjs`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const APP = resolve(here, '..');

export const SCHEMA = 'semester.tokens/1';
export const PARITY = ['Planned', 'Match', 'Partial', 'Obsolete'];

/*
 * Colour literals, per file, relative to `src/`. Measured by `--print-ledger`.
 * A file lands here only for a colour that must not follow the ground, or for
 * debt that has not been paid; the reason is the value's second element.
 */
const WHY = {
  decides: 'The place a colour is decided: the grounds and accents, measured by lib/contrast.test.ts.',
  primitive: '36 of the 111 are the :root primitives. The other 75 are literals in rules (document paper, device frames, chrome ink, the map attribution among them) and are owed.',
  system: "All 36 are in industry.css's own :root: the Industry palette (--color-*), in the file that calls itself the source of truth for the look.",
  sheet: 'Spreadsheet cell inks and their washes: a palette the student picks from per cell, which must not move with the ground.',
  site: 'The public site wears the fixed Graphite/Brass editorial palette, not the selected ground (DESIGN-SYSTEM-GUIDE.md).',
  scrim: 'A scrim fallback behind var(--scrim): black over any ground is the point.',
  map: 'A Leaflet marker drawn outside the DOM, where var() is not resolved against the ground (hex.test.ts holds its hex).',
  inline: 'An inline style colour, not yet a token. Debt: pay it by using an --app-* or --status-* token.',
};

export const COLOUR_LEDGER = {
  'components/LiveMap.tsx': [3, WHY.map],
  'lib/look.ts': [15, WHY.decides],
  'site/site.css': [11, WHY.site],
  'styles/app.css': [111, WHY.primitive],
  'styles/industry.css': [36, WHY.system],
  'styles/operating-rhythm.css': [1, WHY.scrim],
  'styles/unity.css': [1, WHY.scrim],
  'ai/AskAbout.tsx': [1, WHY.inline],
  'ai/Assistant.tsx': [1, WHY.inline],
  'ai/Panel.tsx': [1, WHY.inline],
  'components/Appearance.tsx': [2, WHY.inline],
  'components/Capture.tsx': [1, WHY.inline],
  'components/Command.tsx': [1, WHY.inline],
  'components/CoursePicker.tsx': [1, WHY.inline],
  'components/Fresh.tsx': [1, WHY.inline],
  'components/GridCard.tsx': [1, WHY.inline],
  'components/Keys.tsx': [1, WHY.inline],
  'components/Popover.tsx': [1, WHY.inline],
  'components/TabPeek.tsx': [1, WHY.inline],
  'components/Undone.tsx': [1, WHY.inline],
  'components/creation/VideoEditor.tsx': [1, WHY.inline],
  'components/ui.tsx': [1, WHY.inline],
  'lib/sheet.ts': [6, WHY.sheet],
  'screens/Drill.tsx': [2, WHY.inline],
  'screens/Import.tsx': [1, WHY.inline],
  'screens/Update.tsx': [1, WHY.inline],
  'screens/call/Tile.tsx': [1, WHY.inline],
  'screens/settings/Assistant.tsx': [1, WHY.inline],
};

/*
 * Custom properties used with no fallback and defined nowhere, with how many
 * times. Each is a declaration that is silently invalid today. Fixing one is
 * a visual change (the declaration starts to apply), so it is a decision for
 * the person who owns that screen, not a cleanup this script makes.
 */
export const UNDEFINED_LEDGER = {
  '--app-ink': 9,
  '--app-border': 3,
  '--app-paper': 2,
  '--card': 2,
  '--line': 2,
  '--app-font': 1,
  '--app-ground': 1,
  '--app-raised': 1,
  '--leading-snug': 1,
  '--on-chrome': 1,
  '--r-xs': 1,
};

const LEDGER_DEFAULT = { colour: COLOUR_LEDGER, undefinedVars: UNDEFINED_LEDGER };

const COLOUR_FN = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;
const COLOUR_HEX = /(?<![\w&(#-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name === 'node_modules' || name === 'gallery') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

/** Comments blanked, newlines kept, so an index still maps to its line. */
const blank = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const blankTs = (t) => blank(t).replace(/^([ \t]*)\/\/.*$/gm, (_, s) => s);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Colour literals in a stylesheet's declaration bodies; selectors and `url(#id)` are not colours. */
export function cssColours(text) {
  const clean = blank(text);
  const hits = [];
  for (const body of clean.matchAll(/\{([^{}]*)\}/g)) {
    const at = body.index + 1;
    for (const re of [COLOUR_HEX, COLOUR_FN]) {
      re.lastIndex = 0;
      for (const m of body[1].matchAll(re)) hits.push({ line: lineOf(clean, at + m.index), text: m[0] });
    }
  }
  return hits;
}

/** Functional colours (`rgba(`, `hsl(`…) written inside a string in a `.ts`/`.tsx` file. */
export function scriptColours(text) {
  const clean = blankTs(text);
  const hits = [];
  for (const m of clean.matchAll(/(['"`])[^'"`\n]*\b(?:rgba?|hsla?|hwb|oklch|oklab)\([^'"`\n]*\1/g)) {
    hits.push({ line: lineOf(clean, m.index), text: m[0].slice(0, 60) });
  }
  return hits;
}

/** Every custom property the tree defines, and every `var(--x)` with no fallback that nothing defines. */
export function customProperties(files, exported) {
  const defined = new Set([...Object.keys(exported.primitive ?? {}), ...Object.keys(exported.semantic ?? {})].map((k) => `--${k}`));
  const read = files.map((f) => ({ ...f, raw: readFileSync(f.path, 'utf8') }));
  for (const f of read) {
    for (const m of f.raw.matchAll(/(--[a-zA-Z][\w-]*)['"]?\s*:/g)) defined.add(m[1]);
    // A property React sets is a quoted key: `{ ['--adband-cols' as string]: n }`, or `setProperty('--x', …)`.
    if (!f.rel.endsWith('.css')) for (const m of f.raw.matchAll(/['"`](--[a-zA-Z][\w-]*)['"`]/g)) defined.add(m[1]);
  }
  const unresolved = [];
  for (const f of read) {
    const clean = f.rel.endsWith('.css') ? blank(f.raw) : blankTs(f.raw);
    for (const m of clean.matchAll(/var\(\s*(--[a-zA-Z][\w-]*)\s*([,)])/g)) {
      if (m[2] === ',' || m[1].endsWith('-') || defined.has(m[1])) continue; // a fallback, a prefix named in prose, or defined
      unresolved.push({ name: m[1], file: f.rel, line: lineOf(clean, m.index) });
    }
  }
  return { defined, used: unresolved };
}

/** The mapping rows in `FIGMA-MAPPING.md`: a table row whose second cell is an exported path. */
export function mappingRows(markdown) {
  const rows = [];
  markdown.split('\n').forEach((line, i) => {
    if (!line.trim().startsWith('|')) return;
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (cells.length < 4) return;
    const tick = (c) => /^`([^`]*)`$/.exec(c)?.[1];
    const path = tick(cells[1]);
    if (!path || !/^(primitive|semantic|collections)\./.test(path)) return;
    rows.push({ line: i + 1, figma: tick(cells[0]) ?? cells[0], path, css: tick(cells[2]) ?? cells[2], parity: cells[3] });
  });
  return rows;
}

function problem(severity, check, file, line, found, says) {
  return { severity, check, file, line, found, says };
}

export function audit({ app = APP, mapping, ledger = LEDGER_DEFAULT } = {}) {
  const src = join(app, 'src');
  const mappingFile = mapping ?? join(app, '..', 'docs', 'FIGMA-MAPPING.md');
  const findings = [];
  const stats = {};

  const sources = walk(src)
    .filter((p) => /\.(css|tsx?)$/.test(p) && !/\.test\.tsx?$/.test(p) && !/\.d\.ts$/.test(p))
    .map((path) => ({ path, rel: relative(src, path) }));

  // 3. The export exists and says what it is.
  const exportPath = join(app, 'design-tokens', 'semester.tokens.json');
  let exported = { primitive: {}, semantic: {}, collections: {} };
  if (!existsSync(exportPath)) {
    findings.push(problem('blocker', 'export', 'design-tokens/semester.tokens.json', 1, 'the token export is missing', 'Run `npm run tokens:export` and commit the file; Figma and native read it.'));
  } else {
    exported = JSON.parse(readFileSync(exportPath, 'utf8'));
    if (exported.$schema !== SCHEMA) {
      findings.push(problem('blocker', 'export', 'design-tokens/semester.tokens.json', 1, `$schema is ${JSON.stringify(exported.$schema)}, expected ${SCHEMA}`, 'The exporter writes this schema; a hand edit or a stale file changed it. Regenerate with `npm run tokens:export`.'));
    }
  }
  stats.exported = {
    collections: Object.keys(exported.collections ?? {}).length,
    primitive: Object.keys(exported.primitive ?? {}).length,
    semantic: Object.keys(exported.semantic ?? {}).length,
  };

  // 1. Colour literals against the ledger.
  const colours = {};
  for (const f of sources) {
    const text = readFileSync(f.path, 'utf8');
    const hits = f.rel.endsWith('.css') ? cssColours(text) : f.rel.endsWith('.tsx') || f.rel.endsWith('.ts') ? scriptColours(text) : [];
    if (hits.length) colours[f.rel] = hits;
  }
  for (const [file, hits] of Object.entries(colours)) {
    const owed = ledger.colour[file]?.[0] ?? 0;
    if (hits.length > owed) {
      const first = hits[owed];
      findings.push(problem('major', 'raw-colour', `src/${file}`, first.line, `${hits.length} colour literal${hits.length === 1 ? '' : 's'} (\`${first.text}\`), the ledger allows ${owed}`, 'Use an --app-*, --surface-*, --text-* or --status-* token; a literal is one colour on every ground. Or list the file in COLOUR_LEDGER with the reason it must not follow the ground.'));
    }
  }
  for (const [file, [owed]] of Object.entries(ledger.colour)) {
    const now = colours[file]?.length ?? 0;
    if (now < owed) {
      findings.push(problem('major', 'ledger', `scripts/design-system-audit.mjs`, 1, `${file}: the ledger says ${owed} colour literals, the file has ${now}`, 'Lower the count or delete the entry: the ledger only shrinks.'));
    }
  }
  stats.colours = Object.fromEntries(Object.entries(colours).map(([k, v]) => [k, v.length]));

  // 2. A var() names something.
  const { used } = customProperties(sources, exported);
  const byName = {};
  for (const u of used) (byName[u.name] ??= []).push(u);
  for (const [name, uses] of Object.entries(byName)) {
    const owed = ledger.undefinedVars[name] ?? 0;
    if (uses.length > owed) {
      const at = uses[owed];
      findings.push(problem('major', 'undefined-var', `src/${at.file}`, at.line, `var(${name}) is used ${uses.length} times with no fallback and is defined nowhere, the ledger allows ${owed}`, 'The declaration is invalid at computed-value time and applies nothing. Point it at a defined token (see docs/DESIGN-TOKENS.md), or give the reference a fallback if the property is an optional hook.'));
    }
  }
  for (const [name, owed] of Object.entries(ledger.undefinedVars)) {
    const now = byName[name]?.length ?? 0;
    if (now < owed) {
      findings.push(problem('major', 'ledger', 'scripts/design-system-audit.mjs', 1, `${name}: the ledger says ${owed} undefined uses, the tree has ${now}`, 'Lower the count or delete the entry: the ledger only shrinks.'));
    }
  }
  stats.undefinedVars = Object.fromEntries(Object.entries(byName).map(([k, v]) => [k, v.length]));

  // 4. The Figma mapping resolves.
  const mappingRel = relative(join(app, '..'), mappingFile);
  const rows = existsSync(mappingFile) ? mappingRows(readFileSync(mappingFile, 'utf8')) : [];
  if (!existsSync(mappingFile)) {
    findings.push(problem('major', 'figma-mapping', mappingRel, 1, 'the Figma mapping file is missing', 'Create docs/FIGMA-MAPPING.md: one row per Figma variable, naming the exported path it takes its value from.'));
  }
  const seen = new Map();
  const mapped = new Set();
  for (const row of rows) {
    const [kind, ...rest] = row.path.split('.');
    const key = rest.join('.');
    const table = kind === 'collections' ? exported.collections : exported[kind];
    if (!table?.[key]) {
      findings.push(problem('blocker', 'figma-mapping', mappingRel, row.line, `${row.figma} → ${row.path} is not in the export`, 'The path does not resolve in design-tokens/semester.tokens.json. A rename or removal is a major token change: update the row, or map the token that replaced it.'));
    } else if (kind !== 'collections' && row.css !== `--${key}`) {
      findings.push(problem('major', 'figma-mapping', mappingRel, row.line, `${row.figma}: the CSS cell says ${row.css}, the path is --${key}`, 'The CSS name is the path with `--` in front; a different name means the row was edited without its neighbour.'));
    }
    if (kind !== 'collections' && !/^[A-Za-z0-9]+(\/[A-Za-z0-9-]+)+$/.test(row.figma)) {
      findings.push(problem('minor', 'figma-mapping', mappingRel, row.line, `${row.figma} is not a collection/group/name path`, 'Figma variable names are slash-separated: the collection, then the token key split at its first hyphen.'));
    }
    if (!PARITY.includes(row.parity)) {
      findings.push(problem('major', 'figma-mapping', mappingRel, row.line, `${row.figma}: parity "${row.parity}" is not one of ${PARITY.join(', ')}`, 'Say whether the Figma variable has been compared with the export.'));
    }
    if (seen.has(row.figma)) {
      findings.push(problem('major', 'figma-mapping', mappingRel, row.line, `${row.figma} is mapped twice (line ${seen.get(row.figma)})`, 'One Figma variable takes its value from one exported path.'));
    }
    seen.set(row.figma, row.line);
    if (kind === 'semantic' || kind === 'primitive') mapped.add(`${kind}.${key}`);
  }
  const semantic = Object.keys(exported.semantic ?? {});
  stats.mapping = {
    rows: rows.length,
    semanticMapped: semantic.filter((k) => mapped.has(`semantic.${k}`)).length,
    semanticTotal: semantic.length,
    unmapped: semantic.filter((k) => !mapped.has(`semantic.${k}`)),
    parity: Object.fromEntries(PARITY.map((p) => [p, rows.filter((r) => r.parity === p).length])),
  };

  return { findings, stats, failing: findings.filter((f) => f.severity !== 'minor') };
}

export function print({ findings, stats }, log = console) {
  const order = { blocker: 0, major: 1, minor: 2 };
  for (const p of [...findings].sort((a, b) => order[a.severity] - order[b.severity])) {
    log.error(`${p.file}:${p.line}  [${p.severity}] ${p.found}`);
    log.error(`    ${p.says}\n`);
  }
  const owedColours = Object.values(stats.colours).reduce((a, b) => a + b, 0);
  const owedVars = Object.values(stats.undefinedVars).reduce((a, b) => a + b, 0);
  return `${stats.exported.semantic} semantic and ${stats.exported.primitive} primitive tokens exported · ${owedColours} colour literals in ${Object.keys(stats.colours).length} files · ${owedVars} undefined var() uses across ${Object.keys(stats.undefinedVars).length} names · ${stats.mapping.rows} Figma rows, ${stats.mapping.semanticMapped} of ${stats.mapping.semanticTotal} semantic tokens mapped`;
}

const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};

/** The options the command line gives `audit()`; `design-system-report.mjs` reads them the same way. */
export function cliOptions() {
  const ledger = arg('--ledger');
  return {
    app: arg('--app') ? resolve(arg('--app')) : APP,
    mapping: arg('--mapping') ? resolve(arg('--mapping')) : undefined,
    // `--ledger none` measures against an empty ledger; `--ledger f.json` reads `{ colour, undefinedVars }`.
    ledger: ledger === 'none' ? { colour: {}, undefinedVars: {} } : ledger ? { colour: {}, undefinedVars: {}, ...JSON.parse(readFileSync(resolve(ledger), 'utf8')) } : undefined,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const options = cliOptions();
  const result = audit(options);

  if (process.argv.includes('--print-ledger')) {
    // Measured against an empty ledger, so every literal and every undefined use is counted.
    const bare = audit({ ...options, ledger: { colour: {}, undefinedVars: {} } });
    console.log('colour:', JSON.stringify(bare.stats.colours, null, 2));
    console.log('undefinedVars:', JSON.stringify(bare.stats.undefinedVars, null, 2));
    process.exit(0);
  }
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.failing.length ? 1 : 0);
  }

  const summary = print(result);
  if (result.failing.length === 0) {
    console.log(`design-system ok — ${summary}`);
    process.exit(0);
  }
  console.error(`${result.failing.length} problem${result.failing.length === 1 ? '' : 's'}. ${summary}`);
  process.exit(1);
}
