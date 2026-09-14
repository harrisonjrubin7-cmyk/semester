/**
 * The label rule, as a command that fails.
 *
 * `npm run lint` runs oxlint, then the style rule, then this. The checking
 * lives in `src/a11y/labels.ts` next to its test, and `labels.test.ts` calls
 * the same function — one implementation, two ways in, so a control cannot
 * pass the suite and fail the linter or the reverse.
 *
 * Node runs the TypeScript directly, for the reason given in `styles.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

const { unnamed, says, silenced, saysSilenced } = await import(join(src, 'a11y', 'labels.ts'));

const css = readFileSync(join(src, 'styles', 'app.css'), 'utf8');

// Two rules, reported together. The first asks whether a control was given a
// name; the second whether a stylesheet takes the one it has away. See the
// note above `hushed` for the bug the second was written for.
const problems = [
  ...unnamed(src).map((p) => ({ ...p, why: says(p) })),
  ...silenced(src, css).map((p) => ({ ...p, why: saysSilenced(p) })),
];

if (problems.length === 0) {
  console.log(
    'labels ok — every form control has a name a screen reader can read, and no stylesheet hides one',
  );
  process.exit(0);
}

for (const p of problems) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${p.why}\n`);
}
console.error(`${problems.length} control${problems.length === 1 ? '' : 's'} with no accessible name.`);
process.exit(1);
