/**
 * The architecture census: what the import graph says about this codebase, in
 * numbers anybody can re-derive.
 *
 *   npm run census:arch                       the report, as markdown
 *   npm run census:arch -- --json             the same, as JSON
 *   npm run census:arch -- --inventory FILE   also write the per-file legacy inventory (CSV)
 *
 * `docs/architecture/modularization/01-current-state-audit.md` quotes these
 * figures and names the commit they were taken at. They come from
 * `src/architecture/` — the same scanner the architecture tests use — so a
 * figure in the audit and a rule in the test cannot disagree about what an
 * import is.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { codeOf, cycles, productionOnly } from '../src/architecture/graph.ts';
import { classify, csv, summarize } from '../src/architecture/inventory.ts';
import { areaOf, LEGACY_AREAS, RANK, treeOf, upwardEdges } from '../src/architecture/rules.ts';
import { externalEntries, readSources } from '../src/architecture/tree.ts';

const app = join(import.meta.dirname, '..');
const sources = readSources(join(app, 'src'));
const tree = treeOf(sources);
const prod = productionOnly(tree.graph);
const loc = (p: string) => (sources[p] ?? '').split('\n').length;

const size: Record<string, { files: number; loc: number; tests: number }> = {};
for (const f of tree.graph.files) {
  const a = areaOf(f);
  const s = (size[a] ??= { files: 0, loc: 0, tests: 0 });
  if (prod.files.has(f)) {
    s.files++;
    s.loc += loc(f);
  } else s.tests++;
}

const matrix: Record<string, Record<string, number>> = {};
for (const e of prod.edges) {
  if (!e.to) continue;
  const a = areaOf(e.from);
  const b = areaOf(e.to);
  if (a === b) continue;
  (matrix[a] ??= {})[b] = (matrix[a][b] ?? 0) + 1;
}

const fanIn = new Map<string, number>();
for (const e of prod.edges) if (e.to) fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);
const fanOut = new Map<string, number>();
for (const e of prod.edges) if (e.to) fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
const top = (m: Map<string, number>, n = 12) => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);

const loops = cycles(prod);

/**
 * Ambient dependencies, in the legacy areas only: the new areas are held to
 * zero by `architecture.test.ts`, and their rules mention these words.
 * Counted in code, not in comments or strings, so a doc comment that says
 * "localStorage" is not a file that uses it.
 */
const AMBIENT = {
  'localStorage / sessionStorage / indexedDB': (f: string) => /\b(?:localStorage|sessionStorage|indexedDB)\b/.test(codeOf(sources[f])),
  'fetch(': (f: string) => /\bfetch\s*\(/.test(codeOf(sources[f])),
  'imports the Supabase SDK': (f: string) => (prod.byFile.get(f) ?? []).some((e) => e.external === '@supabase/supabase-js'),
  'Date.now() or new Date()': (f: string) => /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)/.test(codeOf(sources[f])),
  'import.meta.env': (f: string) => /import\.meta\.env/.test(codeOf(sources[f])),
};
const legacy = [...prod.files].filter((f) => LEGACY_AREAS.includes(areaOf(f) as never) || areaOf(f) === 'root');
const ambient: Record<string, Record<string, number>> = {};
for (const [name, test] of Object.entries(AMBIENT)) {
  const row: Record<string, number> = { total: 0 };
  for (const f of legacy) {
    if (test(f)) {
      row.total++;
      row[areaOf(f)] = (row[areaOf(f)] ?? 0) + 1;
    }
  }
  ambient[name] = row;
}

const screens = [...prod.files].filter((f) => areaOf(f) === 'screens');
const importsFrom = (f: string, area: string) => (prod.byFile.get(f) ?? []).some((e) => e.to && areaOf(e.to) === area);
const screenStats = {
  files: screens.length,
  importLib: screens.filter((f) => importsFrom(f, 'lib')).length,
  importState: screens.filter((f) => importsFrom(f, 'state')).length,
  distinctLibFiles: new Set(screens.flatMap((f) => (prod.byFile.get(f) ?? []).flatMap((e) => (e.to && areaOf(e.to) === 'lib' ? [e.to] : [])))).size,
};

const sizes = [...prod.files].map((f) => [f, loc(f)] as const).sort((a, b) => b[1] - a[1]);
const libFlat = [...prod.files].filter((f) => /^lib\/[^/]+$/.test(f)).length;
const libNested = [...prod.files].filter((f) => /^lib\/[^/]+\//.test(f)).length;

const rows = classify(tree, externalEntries(app, tree.graph.files));
const inventory = summarize(rows);

const report = {
  files: { prod: prod.files.size, tests: tree.graph.files.size - prod.files.size, prodLoc: [...prod.files].reduce((n, f) => n + loc(f), 0) },
  size,
  edges: { resolved: prod.edges.filter((e) => e.to).length, matrix },
  upward: { count: upwardEdges(tree.graph).length, rank: RANK },
  cycles: { count: loops.length, largest: loops[0]?.length ?? 0, sizes: loops.map((c) => c.length), largestAreas: [...new Set((loops[0] ?? []).map(areaOf))] },
  fanIn: top(fanIn),
  fanOut: top(fanOut),
  ambient,
  screens: screenStats,
  large: { over1000: sizes.filter(([, n]) => n >= 1000).length, over500: sizes.filter(([, n]) => n >= 500).length, largest: sizes.slice(0, 10) },
  lib: { flat: libFlat, nested: libNested },
  inventory,
};

const flag = process.argv.indexOf('--inventory');
if (flag > 0) writeFileSync(process.argv[flag + 1], csv(rows));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const t = (title: string, body: string) => console.log(`\n### ${title}\n\n${body}`);
  console.log(`# Architecture census\n\n${report.files.prod} production files (${report.files.prodLoc.toLocaleString()} lines), ${report.files.tests} test files, ${report.edges.resolved} resolved imports.`);
  t('Size by area', ['| area | files | lines | test files |', '|---|---:|---:|---:|', ...Object.entries(size).sort((a, b) => b[1].loc - a[1].loc).map(([a, s]) => `| ${a} | ${s.files} | ${s.loc.toLocaleString()} | ${s.tests} |`)].join('\n'));
  t('Imports between areas (from → to: count)', Object.entries(matrix).sort().map(([a, row]) => `- ${a}: ${Object.entries(row).sort((x, y) => y[1] - x[1]).map(([b, n]) => `${b} ${n}`).join(', ')}`).join('\n'));
  t('Layering', `${report.upward.count} imports point up the legacy order (lib → state, lib → ai, …); ${report.cycles.count} import cycles, the largest ${report.cycles.largest} files across ${report.cycles.largestAreas.join(', ')}.`);
  t('Highest fan-in', report.fanIn.map(([f, n]) => `- ${n} ${f}`).join('\n'));
  t('Highest fan-out', report.fanOut.map(([f, n]) => `- ${n} ${f}`).join('\n'));
  const cols = [...LEGACY_AREAS, 'root'].filter((a) => Object.values(ambient).some((r) => r[a]));
  t('Ambient dependencies (legacy files, by area)', ['| what | files | ' + cols.join(' | ') + ' |', '|---|---:|' + cols.map(() => '---:|').join(''), ...Object.entries(ambient).map(([k, r]) => `| ${k} | ${r.total} | ${cols.map((a) => r[a] ?? '').join(' | ')} |`)].join('\n'));
  t('Screens', `${screenStats.files} screen files; ${screenStats.importLib} import \`lib/\` directly (${screenStats.distinctLibFiles} distinct lib files between them) and ${screenStats.importState} import \`state/\`.`);
  t('Large files', `${report.large.over1000} files ≥ 1,000 lines; ${report.large.over500} ≥ 500. Largest: ${report.large.largest.map(([f, n]) => `${f} (${n})`).join(', ')}.`);
  t('lib/', `${libFlat} files directly in \`lib/\`, ${libNested} in its subfolders.`);
  t('Proposed disposition of every production file', ['| disposition | files | lines |', '|---|---:|---:|', ...Object.entries(inventory.byDisposition).map(([d, v]) => `| ${d} | ${v.files} | ${v.loc.toLocaleString()} |`)].join('\n') + `\n\n${inventory.unassigned} files could not be assigned an owning domain.`);
  t('By owning domain', ['| domain | files | lines | reuse | migrate | replace | archive | delete? |', '|---|---:|---:|---:|---:|---:|---:|---:|', ...Object.entries(inventory.byDomain).sort((a, b) => b[1].loc - a[1].loc).map(([d, v]) => `| ${d} | ${v.files} | ${v.loc.toLocaleString()} | ${v.reuse} | ${v.migrate} | ${v.replace} | ${v.archive} | ${v['delete-candidate']} |`)].join('\n'));
}
