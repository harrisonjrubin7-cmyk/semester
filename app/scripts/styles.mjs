/**
 * The style rule, as a command that fails.
 *
 * `npm run lint` runs oxlint and then this. The checking itself lives in
 * `src/styles/rules.ts` next to the tokens it is about, and `scale.test.ts`
 * calls the same functions — one implementation, two ways in, so a rule cannot
 * pass the test suite and fail the linter or the reverse.
 *
 * Node runs the TypeScript directly: this file only needs the exports, and a
 * build step between a linter and the code it lints is a build step that will
 * be out of date at exactly the wrong moment.
 *
 * ## `--fix`
 *
 * `npm run lint:styles -- --fix` rewrites `src/styles/budget.ts` from the
 * tree. That is the whole maintenance story for the ledger, and it is why the
 * ledger can be per file without anybody having to keep 150 numbers by hand.
 *
 * It only ever writes what is measured, so it cannot be used to grant a file
 * room it has not already taken: running it after adding drift records the
 * drift, which then shows up in the diff as a raised number with somebody's
 * name on it. That is the visible line the old single figure was trying to be
 * and could not, because every branch had to touch it anyway.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const ledgerPath = join(src, 'styles', 'budget.ts');

const { AXES, check, counts, countsByFile, multipliers, overBudget, owed, render, ALLOWED } =
  await import(join(src, 'styles', 'rules.ts'));

if (process.argv.includes('--fix')) {
  const was = readFileSync(ledgerPath, 'utf8');
  const next = render(countsByFile(src));
  if (was === next) {
    console.log('styles: the ledger already matches the tree, nothing to write');
    process.exit(0);
  }
  // Read before writing. Totalling the ledger after the write would report the
  // new numbers twice and always print "no change", which is the kind of
  // summary that is worse than none.
  const before = owed((await import(ledgerPath)).BUDGET);
  writeFileSync(ledgerPath, next);
  const after = counts(src);
  console.log(
    `styles: rewrote src/styles/budget.ts — ${AXES.map((a) => `${a} ${before[a]}→${after[a]}`).join(' · ')}`,
  );
  console.log('  Commit it with the change it describes; the diff is the record of what moved.');
  process.exit(0);
}

const { BUDGET } = await import(ledgerPath);

const problems = [
  ...check(src),
  ...multipliers(readFileSync(join(src, 'styles', 'app.css'), 'utf8')),
  ...overBudget(src, BUDGET),
];

if (problems.length === 0) {
  const now = counts(src);
  const kept = AXES.map((a) => `${a} ${now[a]}`).join(' · ');
  console.log(
    `styles ok — every font size is on the scale; ${kept} still off it across ` +
      `${Object.keys(BUDGET).length} files; ${ALLOWED.length} allowed exceptions`,
  );
  process.exit(0);
}

for (const p of problems) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${p.says}\n`);
}
console.error(`${problems.length} problem${problems.length === 1 ? '' : 's'}.`);
process.exit(1);
