/**
 * The style rule, as a command that fails.
 *
 * `npm run lint` runs oxlint and then this. The checking itself lives in
 * `src/styles/rules.ts` next to the tokens it is about, and `scale.test.ts`
 * calls the same function — one implementation, two ways in, so a rule cannot
 * pass the test suite and fail the linter or the reverse.
 *
 * Node runs the TypeScript directly: this file only needs the exports, and a
 * build step between a linter and the code it lints is a build step that will
 * be out of date at exactly the wrong moment.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

const { check, multipliers, counts, BUDGET, ALLOWED } = await import(
  join(src, 'styles', 'rules.ts')
);

const problems = [...check(src), ...multipliers(readFileSync(join(src, 'styles', 'app.css'), 'utf8'))];
const now = counts(src);
const grown = Object.entries(BUDGET).filter(([k, cap]) => now[k] > cap);

if (problems.length === 0 && grown.length === 0) {
  const kept = Object.entries(now)
    .map(([k, n]) => `${k} ${n}/${BUDGET[k]}`)
    .join(' · ');
  console.log(`styles ok — every font size is on the scale; ${kept}; ${ALLOWED.length} allowed exceptions`);
  process.exit(0);
}

for (const p of problems) {
  console.error(`${p.file}:${p.line}  ${p.found}`);
  console.error(`    ${p.says}\n`);
}
for (const [k, cap] of grown) {
  console.error(
    `${k}: ${now[k]} values are off the scale, and the budget is ${cap}.\n` +
      `    Use a token, or — if the value is genuinely not on the scale — raise\n` +
      `    the number in src/styles/rules.ts and say why in the same diff.\n`,
  );
}
console.error(`${problems.length + grown.length} problem${problems.length + grown.length === 1 ? '' : 's'}.`);
process.exit(1);
