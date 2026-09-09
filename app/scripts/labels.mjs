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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

const { unnamed, says } = await import(join(src, 'a11y', 'labels.ts'));

const problems = unnamed(src);

if (problems.length === 0) {
  console.log('labels ok — every form control has a name a screen reader can read');
  process.exit(0);
}

for (const p of problems) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${says(p)}\n`);
}
console.error(`${problems.length} control${problems.length === 1 ? '' : 's'} with no accessible name.`);
process.exit(1);
