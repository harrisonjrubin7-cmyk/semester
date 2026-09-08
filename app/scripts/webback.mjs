/**
 * The return link, as a build step.
 *
 * `npm run build` runs this after Vite has copied `public/` into `dist/`. The
 * work itself lives in `src/lib/webback.ts`, next to the app it links to, and
 * `webback.test.ts` calls the same function — one implementation, two ways in,
 * so the thing the tests check is the thing the build runs.
 *
 * Node runs the TypeScript directly, for the reason `styles.mjs` gives: a
 * build step between a build step and the code it uses is one more thing to be
 * out of date.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { apply } = await import(join(here, '..', 'src', 'lib', 'webback.ts'));

const dir = join(here, '..', 'dist', 'web');

// Silent when there is no website in this build, because a build without one
// is a perfectly good build.
if (!existsSync(dir)) {
  console.log('webback: no dist/web, nothing to do');
} else {
  const { patched, lapsed } = await apply(dir);
  console.log(patched.length ? `webback: repaired ${patched.join(', ')}` : 'webback: already done');
  // A repair that stops applying must say so. Silently doing nothing is how a
  // regenerated website quietly gets its bugs back.
  for (const one of lapsed) console.warn(`webback: NOTHING TO PATCH — ${one}. See SETUP.md.`);
}
