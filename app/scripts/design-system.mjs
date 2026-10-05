/**
 * The design-system gates, as commands that fail.
 *
 *     npm run tokens:check             the committed token export is in step with its sources
 *     npm run design-system:audit      raw design values against the per-file ledger (--fix rewrites it)
 *     npm run design-system:check      tokens, audit and the Figma mapping, fast, no report
 *     npm run design-system:report     all of that plus the contract tests, written to reports/design-system/
 *
 * Exit 1 on a finding, 2 when something could not run at all — a check that
 * quietly does nothing is the failure this repository keeps finding.
 *
 * The rules are `src/styles/designsystem.ts`; this file is the part that touches
 * the filesystem and spawns Vitest. It builds no token export of its own:
 * `tokens` runs `src/lib/tokenexport.test.ts`, which is what holds
 * `design-tokens/semester.tokens.json` to `tokens.css` and `lib/look.ts`, so
 * there is one export and one judge of it. `lib/tokenexport.ts` imports
 * extensionless TypeScript that Node cannot resolve, which is why Vitest is the
 * way in rather than an import here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const root = join(app, '..');
const src = join(app, 'src');
const ledgerPath = join(src, 'styles', 'rawbudget.ts');
const tokensPath = join(app, 'design-tokens', 'semester.tokens.json');
const manifestPath = join(root, 'docs', 'design-system', 'figma-mapping.json');
const outDir = join(app, 'reports', 'design-system');

const ds = await import(join(src, 'styles', 'designsystem.ts'));

const [command = 'check', ...flags] = process.argv.slice(2);
const bail = (msg) => {
  console.error(`design-system: ${msg}`);
  process.exit(2);
};

// ── Vitest, as a subprocess ──────────────────────────────────────────────────

function vitestBin() {
  const require = createRequire(join(app, 'package.json'));
  for (const spec of ['vitest/package.json']) {
    try {
      const bin = join(dirname(require.resolve(spec)), 'vitest.mjs');
      if (existsSync(bin)) return bin;
    } catch {
      /* fall through to the hoisted location */
    }
  }
  const hoisted = join(root, 'node_modules', 'vitest', 'vitest.mjs');
  return existsSync(hoisted) ? hoisted : bail('vitest is not installed; run `npm ci` at the repository root');
}

/** Runs the named test files and returns, per file, how many tests passed and failed and what failed. */
function runTests(files) {
  const dir = mkdtempSync(join(tmpdir(), 'design-system-'));
  const out = join(dir, 'result.json');
  try {
    // `TOKENS=check` so a stray `TOKENS=write` in the environment cannot turn a check into a rewrite.
    const run = spawnSync(process.execPath, [vitestBin(), 'run', ...files, '--reporter=json', `--outputFile=${out}`], {
      cwd: app,
      encoding: 'utf8',
      env: { ...process.env, TOKENS: 'check', REGISTERS: 'check' },
    });
    if (!existsSync(out)) bail(`vitest produced no result (exit ${run.status}).\n${run.stderr}`);
    const json = JSON.parse(readFileSync(out, 'utf8'));
    return json.testResults.map((r) => {
      const tests = r.assertionResults ?? [];
      const failed = tests.filter((t) => t.status === 'failed');
      return {
        file: r.name.slice(r.name.indexOf('/app/') + 1),
        passed: tests.filter((t) => t.status === 'passed').length,
        failed: failed.length + (tests.length === 0 && r.status === 'failed' ? 1 : 0),
        failures: failed.map((t) => t.fullName),
      };
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function tokenExportStatus() {
  const [r] = runTests(['src/lib/tokenexport.test.ts']);
  if (!r) bail('src/lib/tokenexport.test.ts was not run');
  return { ok: r.failed === 0 && r.passed > 0, passed: r.passed, failed: r.failed, failures: r.failures };
}

const CONTRACT_DIRS = [['src/styles', /\.test\.tsx?$/], ['src/a11y', /\.test\.tsx?$/]];
const CONTRACT_EXTRA = ['src/lib/tokenexport.test.ts', 'src/lib/contrast.test.ts', 'src/lib/tiers.test.ts'];

function contractFiles() {
  const files = CONTRACT_DIRS.flatMap(([dir, re]) =>
    readdirSync(join(app, dir)).filter((n) => re.test(n) && n !== 'designsystem.test.ts').map((n) => `${dir}/${n}`),
  );
  return [...new Set([...files, ...CONTRACT_EXTRA])].filter((f) => existsSync(join(app, f))).sort();
}

// ── Pieces ───────────────────────────────────────────────────────────────────

const { RAW_BUDGET } = await import(ledgerPath);

function auditTree() {
  const hits = ds.scan(src);
  return { hits, drift: ds.overLedger(hits, RAW_BUDGET) };
}

function mappingStatus() {
  if (!existsSync(manifestPath)) bail(`${manifestPath.slice(root.length + 1)} is missing`);
  if (!existsSync(tokensPath)) bail('design-tokens/semester.tokens.json is missing; run `npm run tokens:export`');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
  return ds.validateMapping(manifest, tokens, ds.existsIn(root));
}

const printProblems = (ps) => {
  for (const p of ps) {
    console.error(`${p.file}:${p.line}  ${p.found}`);
    console.error(`    ${p.says}\n`);
  }
};

// ── Commands ─────────────────────────────────────────────────────────────────

function doTokens() {
  const t = tokenExportStatus();
  if (t.ok) {
    console.log(`tokens ok — semester.tokens.json matches tokens.css and look.ts (${t.passed} tests)`);
    return true;
  }
  console.error(`tokens: the committed export has drifted (${t.failed} failing):`);
  for (const f of t.failures) console.error(`  - ${f}`);
  console.error('  Regenerate with `npm run tokens:export` and commit the file with the change that caused it. Never edit it by hand.');
  return false;
}

function doAudit() {
  if (flags.includes('--fix')) {
    const hits = ds.scan(src);
    const next = ds.renderLedger(ds.ledgerOf(hits));
    if (readFileSync(ledgerPath, 'utf8') === next) {
      console.log('design-system: the ledger already matches the tree, nothing to write');
      return true;
    }
    const before = ds.totals(RAW_BUDGET);
    writeFileSync(ledgerPath, next);
    const after = ds.totals(ds.ledgerOf(hits));
    console.log(`design-system: rewrote src/styles/rawbudget.ts — ${ds.AXES.map((a) => `${a} ${before[a]}→${after[a]}`).join(' · ')}`);
    console.log('  Commit it with the change it describes; the diff is the record of what moved.');
    return true;
  }
  const { hits, drift } = auditTree();
  if (drift.length === 0) {
    const t = ds.totals(ds.ledgerOf(hits));
    console.log(`design-system audit ok — no raw value beyond the ledger; carried: ${ds.AXES.map((a) => `${a} ${t[a]}`).join(' · ')}`);
    return true;
  }
  printProblems(drift);
  console.error(`${drift.length} problem${drift.length === 1 ? '' : 's'}.`);
  return false;
}

function doMapping() {
  const r = mappingStatus();
  const bad = r.findings.filter((f) => f.severity !== 'minor');
  for (const f of r.findings) console.error(`${f.severity}  ${f.where}\n    ${f.what}\n`);
  console.log(
    `figma mapping ${bad.length ? 'FAILED' : 'ok'} — ${r.valid.length} variables valid, ${r.missingCodeToken.length} missing a code token, ` +
      `${r.obsolete.length} obsolete, ${r.unresolvedInFigma.length} unresolved; ${r.components.valid.length} components valid; ` +
      `${r.unmappedCandidates} semantic tokens unmapped (candidates, not required)`,
  );
  return bad.length === 0;
}

function doReport() {
  const tokenExport = tokenExportStatus();
  // Vitest finishes files in whatever order the workers do; sorted so the same tree gives the same bytes.
  const contracts = runTests(contractFiles())
    .map(({ file, passed, failed }) => ({ file, passed, failed }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const hits = ds.scan(src);
  const input = { tokenExport, contracts, hits, ledger: RAW_BUDGET, mapping: mappingStatus() };
  const all = ds.findings(input);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'design-system-report.md'), ds.renderReport(input));
  writeFileSync(join(outDir, 'design-system-report.json'), `${JSON.stringify({ findings: all, tokenExport, contracts, mapping: input.mapping, carried: ds.totals(ds.ledgerOf(hits)) }, null, 2)}\n`);
  const n = (s) => all.filter((f) => f.severity === s).length;
  console.log(`design-system report — ${n('blocker')} blocker, ${n('major')} major, ${n('minor')} minor; written to app/reports/design-system/`);
  return n('blocker') + n('major') === 0;
}

const commands = {
  tokens: () => doTokens(),
  audit: () => doAudit(),
  mapping: () => doMapping(),
  // Every gate runs even when an earlier one fails, so one run names everything wrong.
  check: () => [doTokens(), doAudit(), doMapping()].every(Boolean),
  report: () => doReport(),
};

if (!commands[command]) bail(`unknown command "${command}"; one of ${Object.keys(commands).join(', ')}`);
process.exit(commands[command]() ? 0 : 1);
