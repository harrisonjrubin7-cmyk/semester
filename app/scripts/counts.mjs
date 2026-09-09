/**
 * The README's counts, written from the registries they count.
 *
 * `npm run counts`. Reads `src/lib/counts.ts` — the same module
 * `readme.test.ts` reads — and rewrites every marked number in both READMEs,
 * so a screen added to `lib/nav.ts` is a screen the README says exists without
 * anybody having to remember the word for fifty-one.
 *
 * Both, because there are two: `app/README.md` and the repository's front
 * page. `STATED` in `src/lib/counts.ts` says which counts each one carries.
 *
 * `--check` writes nothing and fails if it would have. Nothing runs it in CI —
 * `readme.test.ts` is that check, and one is enough — but it is what to run
 * when a diff is confusing and you want to know whether the README is stale
 * without changing it.
 *
 * ## Why this loads through Vite
 *
 * `styles.mjs` next door hands its TypeScript straight to Node, which works
 * because `styles/rules.ts` imports nothing but `node:fs`. This one has to
 * count screens, tabs and guide modes, so it reaches the app's own registries
 * — and those import each other the way the app writes imports, without file
 * extensions, which is not something Node will resolve.
 *
 * The alternative was a second copy of the registry lengths in a file Node can
 * read, which is the exact duplication this whole mechanism exists to remove.
 * So the generator borrows the resolver the app is already built with. It
 * costs about a second and it cannot drift.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const vite = await createServer({
  root,
  // No plugins, no dev server, no HMR: this wants the module resolver and
  // nothing else, and loading the React plugin to read four numbers would be
  // paying for a build to avoid a build.
  configFile: false,
  appType: 'custom',
  server: { middlewareMode: true },
  resolve: {
    alias: {
      '@semester/contract': fileURLToPath(
        new URL('../../packages/contract/src/index.ts', import.meta.url),
      ),
    },
  },
});

let all;
let fill;
let stated;
let statedIn;
try {
  const mod = await vite.ssrLoadModule('/src/lib/counts.ts');
  all = mod.counts(root);
  fill = mod.fill;
  stated = mod.STATED;
  statedIn = mod.statedIn;
} finally {
  await vite.close();
}

// `root` is `app/`, and one of the two files is its parent's. Every path in
// `STATED` is from the repository root for that reason.
const repo = join(root, '..');
const named = all.map((c) => `${c.key} ${c.said} (${c.from})`).join(' · ');

const written = [];
for (const file of stated) {
  const path = join(repo, file.path);
  const before = readFileSync(path, 'utf8');
  const { text: after, missing } = fill(before, statedIn(all, file));

  if (missing.length > 0) {
    console.error(
      `${file.path} has no place to put: ${missing.join(', ')}.\n` +
        `    Every generated number sits between markers, like\n` +
        `    <!--screens-->forty-nine<!--/--> screens.\n` +
        `    Add the marker where the number belongs, or drop the count from\n` +
        `    the file's entry in src/lib/counts.ts if it no longer states it.\n`,
    );
    process.exit(1);
  }

  if (after === before) continue;

  if (process.argv.includes('--check')) {
    console.error(
      `${file.path}'s counts are out of date: ${named}.\n` +
        `    Run \`npm run counts\` and commit what it writes.\n`,
    );
    process.exit(1);
  }

  writeFileSync(path, after);
  written.push(file.path);
}

console.log(
  written.length === 0
    ? `counts ok — ${named}`
    : `counts written to ${written.join(', ')} — ${named}`,
);
