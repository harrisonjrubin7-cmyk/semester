#!/usr/bin/env node
/**
 * Semester design-system audit — read-only, no dependencies.
 *
 * Checks, against the repository's own authorities:
 *   1. Raw colour literals in .ts/.tsx (quoted #hex, rgb()/hsl()/oklch()) against the
 *      LEDGER in src/styles/hex.test.ts — the same count the census prints.
 *   2. CSS custom properties used with var() and no fallback that are defined nowhere
 *      (stylesheets, inline style objects, or tokensFor keys in src/lib/look.ts).
 *   3. tokens.css ↔ design-tokens/semester.tokens.json: every semantic name exported, and
 *      no exported semantic name missing from tokens.css.
 *   4. docs/design-system/FIGMA-MAPPING.md: every primitive.* / semantic.* path resolves in the export;
 *      valid / missing (obsolete) / unmapped-but-not-required candidates are reported separately.
 *   5. Warnings (minor, file:line): numeric zIndex, raw durations, cubic-bezier, raw box-shadow,
 *      numeric fontSize, numeric borderRadius in .ts/.tsx — each with the token to use instead.
 *
 * Usage (from app/):  node scripts/design-system-audit.mjs [--json] [--root <repo-root>]
 * Exit 1 when any violation is found. Warnings never fail.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
// Comments are blanked, newlines kept, so reported line numbers match the source file.
const noComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, '')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const lineOf = (t, i) => t.slice(0, i).split('\n').length;
const SUGGEST = { colour: 'an --app-* / --surface-* / --text-* / --status-* token, or a hex.test.ts LEDGER entry with a reason', z: 'var(--layer-*) (styles/stacking.test.ts)', ms: 'var(--motion-*) (zeroed by reduced motion and data-calm)', ease: 'var(--ease-standard) / var(--ease-emphasized)', shadow: 'var(--elevation-*) / var(--lift-*)', font: 'var(--type-*) (scaled by --text-scale; styles/scale.test.ts)', radius: 'var(--shape-*) / var(--r-*) (follow the Corners setting)' };
const isTest = (p) => /\.test\.(t|j)sx?$/.test(p) || /\/__fixtures__\//.test(p);

export function readLedger(hexTestText) {
  const out = {};
  for (const m of hexTestText.matchAll(/'([^']+\.tsx?)'\s*:\s*\{\s*count:\s*(\d+)/g)) out[m[1]] = Number(m[2]);
  return out;
}

export function semanticNames(tokensCss) {
  const clean = tokensCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(clean)?.[1] ?? '';
  return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1].slice(2));
}

export function mappingPaths(mappingMd) {
  const out = [];
  for (const line of mappingMd.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cell = line.split('|').map((c) => c.trim()).find((c) => /^(primitive|semantic)\.[a-z0-9-]+$/.test(c));
    if (cell) out.push(cell);
  }
  return out;
}

export function audit({ root = resolve(here, '../..') } = {}) {
  const app = join(root, 'app');
  const src = join(app, 'src');
  const violations = [];
  const warnings = [];
  const stats = {};

  // 1. Raw colours vs the hex ledger
  const ledger = readLedger(read(join(src, 'styles/hex.test.ts')));
  const HEX = /['"`]#[0-9a-fA-F]{3,8}\b/g;
  const FN = /\b(rgba?|hsla?|oklch)\(\s*\d/g;
  const code = walk(src, ['.ts', '.tsx']).filter((p) => !isTest(p));
  let hexTotal = 0;
  for (const p of code) {
    const rel = relative(src, p).split('\\').join('/');
    if (rel === 'lib/look.ts' || rel.startsWith('lib/contrast')) continue; // the colour authorities
    const text = noComments(read(p));
    // hex.test.ts counts .tsx only (palettes in lib/*.ts are data, not styling), so the ledger is an authority there alone.
    const n = p.endsWith('.tsx') ? (text.match(HEX)?.length ?? 0) : 0;
    hexTotal += n;
    const allowed = ledger[rel] ?? 0;
    if (n > allowed) for (const m of text.matchAll(HEX)) violations.push({ check: 'raw-colour', severity: 'major', file: rel, line: lineOf(text, m.index), value: m[0].slice(1), detail: n + ' hex literal(s); ledger allows ' + allowed + ' — use ' + SUGGEST.colour });
    const fns = text.match(FN)?.length ?? 0;
    if (fns && !(rel in ledger)) warnings.push({ check: 'raw-colour-fn', file: rel, detail: fns + ' rgb()/hsl()/oklch() literal(s) — prefer an --app-* / --status-* token' });
    const W = [['z-index', /zIndex:\s*(\d{2,})/g, SUGGEST.z], ['duration', /(?:transition|animation)(?:Duration)?:\s*['"`][^'"`]*?\b(\d{2,4}ms)/g, SUGGEST.ms], ['easing', /(cubic-bezier\([^)]*\))/g, SUGGEST.ease], ['shadow', /boxShadow:\s*['"`]((?!var\()[^'"`]*\d+px[^'"`]*)['"`]/g, SUGGEST.shadow], ['font-size', /fontSize:\s*(\d+(?:\.\d+)?)\b(?!\s*\*)/g, SUGGEST.font], ['radius', /borderRadius:\s*(\d+)\b/g, SUGGEST.radius]];
    for (const [check, re, suggest] of W) for (const m of text.matchAll(re)) warnings.push({ check, severity: 'minor', file: rel, line: lineOf(text, m.index), value: m[1], detail: 'raw value — prefer ' + suggest });
  }
  stats.hexLiterals = hexTotal;
  stats.ledgerTotal = Object.values(ledger).reduce((a, b) => a + b, 0);

  // 2. Undefined custom properties
  const css = walk(src, ['.css']);
  const defined = new Set();
  const prefixes = new Set();
  const addDefs = (t) => { for (const m of t.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(m[1]); for (const m of t.matchAll(/['"`](--[a-z0-9-]+)['"`](?:\s+as\s+\w+)?\s*[:\]]/gi)) defined.add(m[1]); for (const m of t.matchAll(/`(--[a-z0-9-]+-)\$\{/gi)) prefixes.add(m[1]); };
  for (const p of css) addDefs(read(p));
  for (const p of code) addDefs(read(p));
  addDefs(read(join(src, 'lib/look.ts')));
  const used = new Map();
  const scan = (p, t) => { for (const m of t.matchAll(/var\(\s*(--[a-z0-9]+(?:-[a-z0-9]+)*)(?![a-z0-9*-])\s*(,)?/gi)) { if (m[2]) continue; if (!used.has(m[1])) used.set(m[1], relative(src, p).split('\\').join('/')); } };
  for (const p of css) scan(p, noComments(read(p)));
  for (const p of code) scan(p, noComments(read(p)));
  const undefinedVars = [...used].filter(([v]) => !defined.has(v) && ![...prefixes].some((x) => v.startsWith(x)));
  for (const [v, file] of undefinedVars) violations.push({ check: 'undefined-var', severity: 'major', file, value: v, detail: v + ' is used without a fallback and defined nowhere' });
  stats.customPropertiesDefined = defined.size;

  // 3. tokens.css ↔ export
  const tokensCss = read(join(src, 'styles/tokens.css'));
  const exportPath = join(app, 'design-tokens/semester.tokens.json');
  let exported = null;
  try { exported = JSON.parse(read(exportPath)); } catch { violations.push({ check: 'export', file: 'design-tokens/semester.tokens.json', detail: 'missing or not valid JSON — run npm run tokens:export' }); }
  if (exported) {
    const names = semanticNames(tokensCss);
    const sem = Object.keys(exported.semantic ?? {});
    for (const n of names) if (!sem.includes(n)) violations.push({ check: 'export-sync', file: 'styles/tokens.css', detail: '--' + n + ' is not in semester.tokens.json — run npm run tokens:export' });
    for (const n of sem) if (!names.includes(n)) violations.push({ check: 'export-sync', file: 'design-tokens/semester.tokens.json', detail: 'semantic.' + n + ' no longer exists in tokens.css — run npm run tokens:export' });
    stats.semanticTokens = sem.length;
    stats.primitiveTokens = Object.keys(exported.primitive ?? {}).length;
  }

  // 4. Figma mapping
  const MAP = 'docs/design-system/FIGMA-MAPPING.md';
  const mapping = read(join(root, MAP));
  const map = { valid: [], missing: [], unmappedCandidates: [] };
  if (!mapping) warnings.push({ check: 'figma-mapping', severity: 'minor', file: MAP, detail: 'not found — Figma parity is unchecked' });
  else if (exported) {
    const paths = mappingPaths(mapping);
    for (const p of paths) {
      const [layer, key] = p.split('.');
      if (exported[layer] && key in exported[layer]) map.valid.push(p);
      else { map.missing.push(p); violations.push({ check: 'figma-mapping', severity: 'major', file: MAP, value: p, detail: p + ' does not resolve in semester.tokens.json (obsolete or misspelt)' }); }
    }
    const mapped = new Set(paths);
    map.unmappedCandidates = Object.keys(exported.semantic ?? {}).map((k) => 'semantic.' + k).filter((p) => !mapped.has(p));
  }
  stats.figma = { valid: map.valid.length, missing: map.missing.length, unmappedCandidates: map.unmappedCandidates.length };

  // Ratchet: app/design-system-baseline.json records today's raw-value warnings per check|file.
  // Anything above the baseline is a violation; a file below it must lower its entry (it only shrinks).
  const basePath = join(app, 'design-system-baseline.json');
  const counts = {};
  for (const w of warnings) if (w.line) counts[w.check + '|' + w.file] = (counts[w.check + '|' + w.file] ?? 0) + 1;
  stats.rawValueWarnings = Object.values(counts).reduce((x, y) => x + y, 0);
  if (existsSync(basePath)) {
    const base = JSON.parse(read(basePath));
    for (const [k, n] of Object.entries(counts)) if (n > (base[k] ?? 0)) { const [check, file] = k.split('|'); violations.push({ check: 'baseline-' + check, severity: 'major', file, detail: n + ' raw ' + check + ' value(s); baseline allows ' + (base[k] ?? 0) + ' — use the suggested token' }); }
    for (const [k, n] of Object.entries(base)) if ((counts[k] ?? 0) < n) { const [check, file] = k.split('|'); violations.push({ check: 'baseline-stale', severity: 'minor', file, detail: check + ': baseline says ' + n + ', file has ' + (counts[k] ?? 0) + ' — lower the entry (npm run design-system:baseline)' }); }
    stats.baselineTotal = Object.values(base).reduce((x, y) => x + y, 0);
  }
  return { ok: violations.length === 0, violations, warnings, stats, figma: map, rawCounts: counts };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('design-system-audit.mjs')) {
  const args = process.argv.slice(2);
  const rootArg = args.indexOf('--root');
  const result = audit(rootArg >= 0 ? { root: resolve(args[rootArg + 1]) } : {});
  if (args.includes('--write-baseline')) { const { writeFileSync } = await import('node:fs'); const p = join(rootArg >= 0 ? resolve(args[rootArg + 1]) : resolve(here, '../..'), 'app/design-system-baseline.json'); writeFileSync(p, JSON.stringify(Object.fromEntries(Object.entries(result.rawCounts).sort()), null, 2) + '\n'); console.log('Baseline written: ' + p + ' (' + result.stats.rawValueWarnings + ' entries counted)'); process.exit(0); }
  if (args.includes('--json')) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else {
    const loc = (x) => x.file + (x.line ? ':' + x.line : '');
    for (const v of result.violations) console.log('✕ [' + v.check + '] ' + loc(v) + (v.value ? ' ' + v.value : '') + ' — ' + v.detail);
    for (const w of result.warnings) console.log('! [' + w.check + '] ' + loc(w) + (w.value ? ' ' + w.value : '') + ' — ' + w.detail);
    console.log((result.ok ? '✓ ' : '✕ ') + result.violations.length + ' violation(s), ' + result.warnings.length + ' warning(s) · ' + JSON.stringify(result.stats));
  }
  process.exit(result.ok ? 0 : 1);
}
