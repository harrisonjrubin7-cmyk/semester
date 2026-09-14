import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A check nothing runs is not a check.
 *
 * `package.json` carries `check:university`, which typechecks
 * `server/institution/` and `packages/institution/` — the half of this repo
 * that `tsc -b` does not reach, because `tsconfig.json` references the app and
 * the Vite config and nothing else. Nothing ran it. It sat in the scripts
 * block looking like coverage for months.
 *
 * Four of that server's seven files were typechecked anyway, and how is the
 * part worth writing down: `src` imports `gateway.ts`, `adapter.ts` and
 * `auth.ts`, so they are pulled into the app's own program and an error in
 * them does fail CI. `start.ts` — the entry point — along with `adapters.ts`
 * and `gateway.test.ts` are imported by nothing in `src`, and were checked by
 * nothing at all. Measured by planting a type error in each and watching
 * `tsc -b` stay green.
 *
 * So the coverage that existed was an accident of the import graph rather
 * than a decision, and a refactor that stopped `src` importing the gateway
 * would have quietly dropped three more files with nothing going red.
 *
 * The rule is deliberately narrow: a script *named* `check:` is a script
 * somebody wrote to verify something, and the workflow has to run it. It says
 * nothing about `counts`, `mirror` or `transcripts`, which are tooling, or
 * about `dev` and `preview`, which are for a person at a keyboard.
 */

const ROOT = join(process.cwd(), '..');
const WORKFLOW = join(ROOT, '.github', 'workflows', 'ci.yml');

describe('the checks in package.json', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  const ci = readFileSync(WORKFLOW, 'utf8');

  it('names at least one, so this rule has something to hold', () => {
    const checks = Object.keys(pkg.scripts).filter((s) => s.startsWith('check:'));
    expect(checks.length, '`check:` scripts').toBeGreaterThan(0);
  });

  for (const name of Object.keys(
    JSON.parse(readFileSync('package.json', 'utf8')).scripts as Record<string, string>,
  ).filter((s) => s.startsWith('check:'))) {
    it(`runs ${name}`, () => {
      expect(ci, `${name} is in package.json but no CI step runs it`).toContain(
        `npm run ${name}`,
      );
    });
  }

  /*
   * The three the workflow has always run, asserted so that a rewrite of the
   * file cannot quietly drop one. `test:zones` is the one most easily lost:
   * it looks like a duplicate of `npm test` and is the only thing standing
   * between this app and the off-by-one-day bug its own comment describes.
   */
  for (const step of ['npm run lint', 'npm test', 'npm run test:zones', 'npm run build']) {
    it(`still runs \`${step}\``, () => {
      expect(ci).toContain(step);
    });
  }
});
