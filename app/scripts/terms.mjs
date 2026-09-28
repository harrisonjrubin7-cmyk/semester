/**
 * The vocabulary rule, as a command that fails.
 *
 * `npm run lint` runs oxlint, the style rule, the label rule, then this. The
 * checking lives in `src/content/terms.ts` next to its test, and
 * `terms.test.ts` calls the same functions — one implementation, two ways in.
 *
 * `npm run lint:terms -- --fix` rewrites `src/content/ledger.ts` from the
 * tree. Like the style ledger it only writes what is measured, so a raised
 * number shows up in the diff for a reviewer to question.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const ledgerPath = join(src, 'content', 'ledger.ts');

const { countsByFile, overLedger, render, total, RETIRED } = await import(join(src, 'content', 'terms.ts'));

if (process.argv.includes('--fix')) {
  const was = readFileSync(ledgerPath, 'utf8');
  const next = render(countsByFile(src));
  if (was === next) {
    console.log('terms: the ledger already matches the tree, nothing to write');
    process.exit(0);
  }
  const before = total((await import(ledgerPath)).LEDGER);
  writeFileSync(ledgerPath, next);
  console.log(`terms: rewrote src/content/ledger.ts — retired words on screen ${before}→${total(countsByFile(src))}`);
  console.log('  Commit it with the change it describes; the diff is the record of what moved.');
  process.exit(0);
}

const { LEDGER } = await import(ledgerPath);
const problems = overLedger(src, LEDGER);

if (problems.length === 0) {
  console.log(
    `terms ok — no file uses more retired words than the ledger allows; ` +
      `${total(countsByFile(src))} still on screen across ${Object.keys(LEDGER).length} files, ` +
      `${RETIRED.length} words retired`,
  );
  process.exit(0);
}

for (const p of problems) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${p.says}\n`);
}
console.error(`${problems.length} use${problems.length === 1 ? '' : 's'} of a retired word over the ledger.`);
process.exit(1);
