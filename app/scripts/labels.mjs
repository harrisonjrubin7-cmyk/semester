/**
 * The label rule, as a command that fails.
 *
 * `npm run lint` runs oxlint, then the style rule, then this. The checking
 * lives in `src/a11y/labels.ts` next to its test, and `labels.test.ts` calls
 * the same function — one implementation, two ways in, so a control cannot
 * pass the suite and fail the linter or the reverse.
 *
 * Two rules, because there are two ways to lose a name. `unnamed` reads the
 * markup and finds a control that never had one. `hiddenNames` reads the
 * stylesheet and finds a control whose name CSS takes away at a width — the
 * one the markup cannot show you, because in the markup the text is right
 * there. See the note over `hiddenNames`.
 *
 * Node runs the TypeScript directly, for the reason given in `styles.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

const { unnamed, says, hiddenNames, saysHidden } = await import(join(src, 'a11y', 'labels.ts'));

const css = readFileSync(join(src, 'styles', 'app.css'), 'utf8');
const problems = unnamed(src);
const hidden = hiddenNames(src, css);

if (problems.length === 0 && hidden.length === 0) {
  console.log(
    'labels ok — every form control has a name a screen reader can read, and no control loses one to CSS',
  );
  process.exit(0);
}

for (const p of problems) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${says(p)}\n`);
}
for (const p of hidden) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${saysHidden(p)}\n`);
}

const n = problems.length + hidden.length;
console.error(`${n} control${n === 1 ? '' : 's'} with no accessible name.`);
process.exit(1);
