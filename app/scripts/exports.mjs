/**
 * Which exports nothing imports — asked of the compiler, not of the text.
 *
 * The twenty-third pass ran a dead-export census, got **1,054 dead exports in
 * 714 files**, hand-checked three rows and threw the whole thing away. All
 * three were the probe's fault, and each named a different blind spot:
 *
 * - `screens/Import.tsx`'s `Import` is reached by `lazy(() => import(...))`,
 *   which its parser never followed, so every lazily-loaded screen read dead;
 * - `data/schools/index.ts`'s `BUNDLED` is used twice inside its own module;
 * - `styles/rules.ts`'s `sources` is a helper that test files import.
 *
 * "Three blind spots, one number, no way to tell which rows were real."
 *
 * ## So this one does not read the source at all
 *
 * It builds the same `ts.Program` the types gate builds and asks the checker
 * what every identifier resolves to. A dynamic `import('./x').then((m) =>
 * m.Thing)` resolves `m.Thing` to the export; so does `typeof
 * import('./Panel')['Panel']`; so does a JSX tag; so does a namespace import's
 * property access; so does a re-export chain. None of that is special-cased
 * here, because none of it is special to the checker.
 *
 * ## Four buckets, because "dead" was three questions wearing one coat
 *
 * The old census could not tell them apart, which is why its number meant
 * nothing:
 *
 * - **alive** — imported by a file that ships.
 * - **test-only** — imported, but only by tests. A helper, not a defect, and
 *   the row says how many test files so a reader can judge it.
 * - **export-surplus** — used inside its own module and nowhere else. The
 *   *export* is surplus; the code is not dead. This is `BUNDLED`'s case.
 * - **dead** — no reference anywhere, in or out.
 *
 * ## The fourth blind spot, which the first census could not have seen
 *
 * `app/src` is imported from outside `app/src`: eleven files under
 * `app/scripts` and `video/src` pull in `lib/look`, `lib/beats`, `lib/fnv`,
 * `lib/guidebook` and more. A program built from `tsconfig.app.json` alone
 * calls every one of those dead. They are added as roots below.
 *
 * Two more were ruled out by absence rather than by assumption: there is no
 * `import.meta.glob` in `src`, and no dynamic `import()` with a non-literal
 * specifier. Either would be invisible here, so either appearing later makes
 * this census wrong until it is taught about them.
 *
 * ## It is a script and not a test, on the twenty-fifth pass's argument
 *
 * That pass declined to land its own census as a gate: "a guard whose probe is
 * that young would fail on correct code before it caught anything." This one
 * is younger still, and it takes 24 seconds — a 40% tax on a suite that runs
 * in 60. It graduates to a gate when it has run across several passes without
 * a false positive, and not before.
 *
 *   npm run census:exports              — the four counts
 *   npm run census:exports -- --rows dead
 *   npm run census:exports -- --check lib/cloud.ts::providersOn
 */
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const APP = resolve(process.argv[2] ?? '.');
const ROOT = resolve(APP, '..');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts)$/.test(p) && !p.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * The scripts the checker cannot follow, read as text — on purpose, and loudly.
 *
 * `npm run lint` is `node scripts/styles.mjs && node scripts/labels.mjs`, and
 * those two, with `icons.mjs`, reach into `src` like this:
 *
 *     const { …, owed, … } = await import(join(src, 'styles', 'rules.ts'));
 *
 * A plain-JS file, and a *computed* specifier. The checker cannot resolve
 * either, so the first version of this census called `styles/rules.ts`'s
 * `owed` and `components/mark.svg.ts`'s `APPLE` dead — a function the lint
 * gate calls, and the SVG `apple-touch-icon.png` is rasterised from. Its own
 * blind-spot note claimed there was no non-literal `import()`; it had looked
 * only under `src`, where the imports are, rather than at the callers, where
 * they are not.
 *
 * So these sites are matched by shape and their names credited. The shape is
 * narrow deliberately, and **anything import-like that does not match it is
 * counted and printed**: a census that silently skips what it cannot parse is
 * the 1,054 again. A new caller in a new shape shows up as a number that is
 * not zero, which is the only part of this that has to keep working.
 */
const JOIN_SRC = /join\(\s*src\s*,([^)]*)\)/;
const PATH_VAR = /const\s+(\w+)\s*=\s*join\(\s*src\s*,([^)]*)\)/g;
// The specifier is either `join(src, 'a', 'b')` — parens and all — or a
// variable holding one. A capture of `[^)]+` stops at join's own bracket.
const SPEC = "(join\\([^)]*\\)|\\w+)";
const NAMED = new RegExp(`const\\s*\\{([^}]*)\\}\\s*=\\s*await\\s+import\\(\\s*${SPEC}\\s*\\)`, 'g');
const PICKED = new RegExp(`\\(\\s*await\\s+import\\(\\s*${SPEC}\\s*\\)\\s*\\)\\.(\\w+)`, 'g');
const ANY_COMPUTED = /await\s+import\(\s*(?!['"`])/g;

function scriptReaches(dirs) {
  const out = [];
  let sites = 0;
  let unmatched = 0;
  for (const dir of dirs) {
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => /\.(mjs|cjs|js)$/.test(f)).map((f) => join(dir, f));
    } catch {
      continue;
    }
    for (const file of files) {
      const text = readFileSync(file, 'utf8');

      // `const ledgerPath = join(src, 'styles', 'budget.ts')` — the specifier a
      // line away from the import that uses it.
      const vars = new Map();
      for (const v of text.matchAll(PATH_VAR)) vars.set(v[1], v[2]);

      const partsOf = (spec) => {
        const s = spec.trim();
        const inline = s.match(JOIN_SRC);
        const arglist = inline ? inline[1] : vars.get(s);
        if (!arglist) return null;
        const parts = [...arglist.matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]);
        return parts.length > 0 ? parts : null;
      };

      let matched = 0;
      const take = (spec, names) => {
        const parts = partsOf(spec);
        if (!parts) return false;
        matched += 1;
        sites += 1;
        out.push({ file, target: join(SRC, ...parts), names });
        return true;
      };

      for (const m of text.matchAll(NAMED)) {
        take(
          m[2],
          m[1].split(',').map((n) => n.trim().split(':')[0].trim()).filter(Boolean),
        );
      }
      for (const m of text.matchAll(PICKED)) take(m[1], [m[2]]);

      // Literal specifiers — `await import('playwright')` — are none of our
      // business. Only a *computed* one we could not follow is a gap, and it
      // is printed rather than swallowed.
      unmatched += Math.max(0, (text.match(ANY_COMPUTED) ?? []).length - matched);
    }
  }
  return { out, sites, unmatched };
}

const cfgPath = join(APP, 'tsconfig.app.json');
const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, APP);

// The blind spot that made the first census worthless: app/src is imported from
// outside app/src. These roots are in the program so their references count.
const OUTSIDE = [
  ...walk(join(APP, 'scripts')),
  ...walk(join(ROOT, 'video', 'src')),
];

const rootNames = [...new Set([...parsed.fileNames, ...OUTSIDE])];
const program = ts.createProgram(rootNames, {
  ...parsed.options,
  noEmit: true,
  skipLibCheck: true,
  allowJs: false,
});
const checker = program.getTypeChecker();

const SRC = join(APP, 'src');
const inSrc = (f) => f.startsWith(SRC + '/');
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f);
const rel = (f) => relative(ROOT, f);

function deAlias(sym) {
  if (sym && sym.flags & ts.SymbolFlags.Alias) {
    try { return checker.getAliasedSymbol(sym); } catch { return sym; }
  }
  return sym;
}
function keyOf(sym) {
  const d = sym?.declarations?.[0];
  if (!d) return null;
  return `${d.getSourceFile().fileName}#${d.getStart()}`;
}

// One pass over every file: every identifier, resolved by the checker.
const refs = new Map();
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  const f = sf.fileName;
  if (!inSrc(f) && !OUTSIDE.includes(f)) continue;
  const visit = (node) => {
    if (ts.isIdentifier(node)) {
      const sym = deAlias(checker.getSymbolAtLocation(node));
      const k = sym && keyOf(sym);
      if (k) {
        if (!refs.has(k)) refs.set(k, []);
        refs.get(k).push({ file: f, pos: node.getStart() });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
}

// The script reaches, credited as production references to the named exports.
const reaches = scriptReaches([join(APP, 'scripts')]);
for (const r of reaches.out) {
  const sf = program.getSourceFile(r.target);
  if (!sf) continue;
  const mod = checker.getSymbolAtLocation(sf);
  if (!mod) continue;
  for (const ex of checker.getExportsOfModule(mod)) {
    if (!r.names.includes(ex.getName())) continue;
    const k = keyOf(deAlias(ex));
    if (!k) continue;
    if (!refs.has(k)) refs.set(k, []);
    refs.get(k).push({ file: r.file, pos: -1 });
  }
}

const rows = [];
for (const sf of program.getSourceFiles()) {
  if (sf.isDeclarationFile) continue;
  if (!inSrc(sf.fileName)) continue;
  const mod = checker.getSymbolAtLocation(sf);
  if (!mod) continue;
  for (const raw of checker.getExportsOfModule(mod)) {
    const sym = deAlias(raw);
    const decl = sym?.declarations?.[0];
    if (!decl) continue;
    // Attribute each export to the file that declares it, so a re-export is
    // counted once, where it lives.
    if (decl.getSourceFile().fileName !== sf.fileName) continue;

    const nameNode = ts.getNameOfDeclaration(decl);
    const declPos = nameNode ? nameNode.getStart() : decl.getStart();
    const all = refs.get(keyOf(sym)) ?? [];
    const external = all.filter((r) => r.file !== sf.fileName);
    const internal = all.filter((r) => r.file === sf.fileName && r.pos !== declPos);
    const prod = external.filter((r) => !isTest(r.file));
    const tests = external.filter((r) => isTest(r.file));

    let bucket;
    if (prod.length) bucket = 'alive';
    else if (tests.length) bucket = 'test-only';
    else if (internal.length) bucket = 'export-surplus';
    else bucket = 'dead';

    rows.push({
      file: rel(sf.fileName),
      name: raw.getName(),
      bucket,
      prod: prod.length,
      tests: tests.length,
      internal: internal.length,
      testFiles: [...new Set(tests.map((r) => rel(r.file)))].length,
      self: isTest(sf.fileName),
    });
  }
}

const live = rows.filter((r) => !r.self);
const by = (b) => live.filter((r) => r.bucket === b);
console.log(`files in program: ${program.getSourceFiles().filter((s) => !s.isDeclarationFile).length}`);
console.log(
  `script reaches followed: ${reaches.sites}` +
    (reaches.unmatched > 0
      ? `  ⚠ ${reaches.unmatched} computed import(s) NOT followed — this census is incomplete until they are`
      : '  (no unfollowed computed imports)'),
);
console.log(`exports declared under app/src (excluding test files): ${live.length}`);
for (const b of ['alive', 'test-only', 'export-surplus', 'dead']) {
  console.log(`  ${b.padEnd(15)} ${by(b).length}`);
}

if (process.argv.includes('--rows')) {
  const want = process.argv[process.argv.indexOf('--rows') + 1] ?? 'dead';
  for (const r of by(want).sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`${want === 'test-only' ? `[${r.testFiles} test files] ` : ''}${r.file} :: ${r.name}`);
  }
}
if (process.argv.includes('--check')) {
  const q = process.argv[process.argv.indexOf('--check') + 1];
  const [f, n] = q.split('::');
  for (const r of rows.filter((r) => r.file.includes(f) && (!n || r.name === n))) {
    console.log(JSON.stringify(r));
  }
}
