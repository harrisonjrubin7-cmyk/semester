/**
 * Does this change document itself?
 *
 *     npm run docs:impact                 # the branch against origin/main
 *     npm run docs:impact -- --base HEAD~3
 *     PR_BODY="$BODY" npm run docs:impact # CI passes the pull request's description
 *
 * The rules are `src/lib/docs/impact.ts` and are explained in
 * `docs/documentation/OWNERSHIP-AND-REVIEW.md`. This file is only the part that
 * touches git and the environment: it lists what changed against the merge
 * base, joins the commit messages with the pull request body (a waiver may be
 * in either), and exits 1 with what was wanted if the change owes a page and
 * brought none.
 *
 * A waiver is a line of its own, `Docs: none because <reason>`; it is printed
 * back so a reviewer sees it in the log.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const { impact } = await import(join(here, '..', 'src', 'lib', 'docs', 'impact.ts'));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const base = arg('--base', 'origin/main');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

let changed;
let log;
try {
  const mergeBase = git('merge-base', base, 'HEAD').trim();
  changed = git('diff', '--name-only', `${mergeBase}..HEAD`).split('\n').filter(Boolean);
  log = git('log', '--format=%B', `${mergeBase}..HEAD`);
} catch (e) {
  console.error(`docs:impact: cannot compare against ${base} (${String(e.message).split('\n')[0]}).`);
  console.error('  Fetch it first: git fetch origin main');
  process.exit(2);
}

const verdict = impact(changed, `${process.env.PR_BODY ?? ''}\n${log}`);

if (verdict.findings.length === 0) {
  console.log(`docs:impact: ${changed.length} changed file(s) against ${base}; none obliges a page that is missing.`);
  process.exit(0);
}
for (const f of verdict.findings) {
  console.log(`\n${f.rule}: ${f.why}`);
  for (const p of f.because.slice(0, 8)) console.log(`  changed   ${p}`);
  if (f.because.length > 8) console.log(`  … and ${f.because.length - 8} more`);
  console.log(`  wants one of   ${f.wants.join('   ')}`);
}
if (verdict.waived) {
  console.log(`\ndocs:impact: waived — "${verdict.waived}"`);
  process.exit(0);
}
console.log('\ndocs:impact: this change touches paths whose documentation it did not touch.');
console.log('  Update the page, or say why none is needed on a line of its own in the pull request:');
console.log('    Docs: none because <the reason, in a sentence>');
process.exit(1);
