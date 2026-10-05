/**
 * The raw-value ledger for stylesheets, as a command that fails.
 *
 *     npm run design-system:css            # raw values in .css, and colour functions in .tsx, against the ledger
 *     npm run design-system:css -- --fix   # rewrites src/styles/rawbudget.ts from the tree
 *
 * Exit 1 on a finding. The rules are `src/styles/rawvalues.ts`, which also says
 * what this leaves to `design-system-audit.mjs` (`.tsx` z-index, shadow, radius,
 * motion and type, undefined custom properties, the Figma mapping) and to
 * `hex.test.ts`: two ledgers on one value is two files to update when it is
 * fixed. `--fix` only ever writes what is measured, so it cannot grant a file
 * room it has not already taken, and the raised number shows in the diff.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const ledgerPath = join(src, 'styles', 'rawbudget.ts');

const rv = await import(join(src, 'styles', 'rawvalues.ts'));
const { RAW_BUDGET } = await import(ledgerPath);

if (process.argv.includes('--fix')) {
  const hits = rv.scan(src);
  const next = rv.renderLedger(rv.ledgerOf(hits));
  if (readFileSync(ledgerPath, 'utf8') === next) {
    console.log('design-system:css — the ledger already matches the tree, nothing to write');
    process.exit(0);
  }
  const before = rv.totals(RAW_BUDGET);
  writeFileSync(ledgerPath, next);
  const after = rv.totals(rv.ledgerOf(hits));
  console.log(`design-system:css — rewrote src/styles/rawbudget.ts — ${rv.AXES.map((a) => `${a} ${before[a]}→${after[a]}`).join(' · ')}`);
  console.log('  Commit it with the change it describes; the diff is the record of what moved.');
  process.exit(0);
}

const hits = rv.scan(src);
const drift = rv.overLedger(hits, RAW_BUDGET);
if (drift.length === 0) {
  const t = rv.totals(rv.ledgerOf(hits));
  console.log(`design-system:css ok — no raw value beyond the ledger; carried: ${rv.AXES.map((a) => `${a} ${t[a]}`).join(' · ')}`);
  process.exit(0);
}
for (const p of drift) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${p.says}\n`);
}
console.error(`${drift.length} problem${drift.length === 1 ? '' : 's'}.`);
process.exit(1);
