/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The two paths an Edge Function reaches a project by, held to each other.
 *
 * `supabase/config.toml` used to carry an argument for having only one, and it
 * was a good argument: "declaring them here as well would give one function two
 * deploy paths that can disagree about which version is live." What it did not
 * account for is that Supabase Branching deploys **only** the functions named
 * in that file — so with no block, a preview branch had no functions at all,
 * and staging was missing every AI feature and every reminder in a way that
 * reads as an app bug. `STAGING.md` has the whole finding, including the
 * branch warning that produced it.
 *
 * The objection is answered here rather than overruled. Two deploy paths hurt
 * when they can disagree *silently*, so this file removes the silence. It is
 * the instrument `lib/referral.test.ts` and `lib/allowance.test.ts` use on
 * every other pair of sides in this repository that cannot import from each
 * other: read the other side as text, and go red when they stop agreeing.
 *
 * Three claims, and each of them is a thing that would otherwise be found by a
 * student in the pilot rather than by a test:
 *
 *   - Every function declared here exists as a directory. A typo in a slug is
 *     a deploy of nothing, reported as a success.
 *   - The declared set is exactly what `DEPLOY.md` records as live. Declaring
 *     a function is how Branching deploys it, so a name added here is a
 *     function shipped — `fetchcal`, `canvas`, `lti` and `calendar` are
 *     deliberately not live, and a preview branch that carried them would not
 *     match production, it would exceed it.
 *   - `verify_jwt` agrees with the flag the workflow passes. This is the one
 *     that can actually break the app: `claude` answers a CORS preflight,
 *     which carries no Authorization header at all, so a path that quietly
 *     turned the platform's own check back on would fail every AI request in
 *     the browser, and it would do it at whichever deploy ran last.
 */

const repo = join(process.cwd(), '..');
const config = () => readFileSync(join(repo, 'supabase/config.toml'), 'utf8');
const workflow = () => readFileSync(join(repo, '.github/workflows/functions.yml'), 'utf8');
const deploydoc = () => readFileSync(join(repo, 'supabase/DEPLOY.md'), 'utf8');

/** Every `[functions.<slug>]` block, with the `verify_jwt` under it. */
function declared(): Map<string, string | null> {
  const found = new Map<string, string | null>();
  const text = config();
  const heads = [...text.matchAll(/^\[functions\.([a-z0-9_-]+)\]\s*$/gm)];
  for (let i = 0; i < heads.length; i++) {
    const from = heads[i].index! + heads[i][0].length;
    const to = i + 1 < heads.length ? heads[i + 1].index! : text.length;
    const body = text.slice(from, to);
    const flag = /^\s*verify_jwt\s*=\s*(true|false)\s*$/m.exec(body);
    found.set(heads[i][1], flag ? flag[1] : null);
  }
  return found;
}

/** The function directories that exist, which `_shared` is not one of. */
const directories = (): string[] =>
  readdirSync(join(repo, 'supabase/functions'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '_shared')
    .map((e) => e.name)
    .sort();

/**
 * What `DEPLOY.md` records as live, read out of its own block.
 *
 * That block is two columns of fixed text — `claude   ACTIVE, v1, verify_jwt
 * off` — and it is the only record anywhere of what the live project actually
 * has. Reading it rather than repeating it is what makes deploying a function
 * for real and forgetting this file a failure rather than a silence.
 */
function live(): string[] {
  const block = /## What is live\n([\s\S]*?)\n## /.exec(deploydoc());
  expect(block, 'DEPLOY.md no longer has a "What is live" section').toBeTruthy();
  return [...block![1].matchAll(/^\s{2,}([a-z0-9_-]+)\s+ACTIVE/gm)].map((m) => m[1]).sort();
}

describe('the probes read their subjects', () => {
  /*
   * The control, and it is not a formality: every assertion below passes
   * against an empty map, which is exactly what a regex that has stopped
   * matching returns. `CLAUDE.md` is a record of this repository's own
   * instruments reporting all clear having read nothing.
   */
  it('finds function blocks, directories and a live list at all', () => {
    expect(declared().size, 'no [functions.*] blocks found in config.toml').toBeGreaterThan(0);
    expect(directories().length, 'no function directories found').toBeGreaterThan(3);
    expect(live().length, 'DEPLOY.md lists nothing as live').toBeGreaterThan(0);
  });
});

describe('config.toml and the functions that exist', () => {
  it('declares nothing that is not a real function directory', () => {
    const dirs = new Set(directories());
    const ghosts = [...declared().keys()].filter((slug) => !dirs.has(slug));
    expect(
      ghosts,
      `config.toml declares functions with no directory: ${ghosts.join(', ')}. ` +
        'A slug that matches nothing deploys nothing and reports success.',
    ).toEqual([]);
  });
});

describe('config.toml and what is actually live', () => {
  /*
   * Both directions, because each catches a different accident.
   *
   * A live function missing from here is one a preview branch does not get,
   * which is the whole fault this file was written for. A function declared
   * here and not live is worse: declaring it is what deploys it, so the
   * mistake ships rather than merely being absent.
   */
  it('declares every function DEPLOY.md records as live', () => {
    const missing = live().filter((slug) => !declared().has(slug));
    expect(
      missing,
      `these are live but not in config.toml, so a preview branch will not have them: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('and declares nothing that is not', () => {
    const known = new Set(live());
    const extra = [...declared().keys()].filter((slug) => !known.has(slug));
    expect(
      extra,
      `these are declared but DEPLOY.md does not record them as live: ${extra.join(', ')}. ` +
        'Declaring a function is how Branching deploys it — deploy it for real and say so there first.',
    ).toEqual([]);
  });
});

describe('the one flag the two deploy paths can disagree about', () => {
  /*
   * Read off the workflow rather than asserted against a copy of it, and
   * asserted to have been found. The workflow passes one flag to every deploy
   * in the loop; if that ever becomes per-function, this goes red rather than
   * quietly comparing against a string that is no longer there.
   */
  it('the workflow still deploys with the platform check off', () => {
    const text = workflow();
    expect(text).toMatch(/supabase functions deploy "\$fn"[^\n]*--no-verify-jwt/);
    // And nothing in it turns the check back on for a subset.
    expect(text).not.toMatch(/--verify-jwt(?!\w)/);
  });

  it('and config.toml says the same thing about every function it declares', () => {
    for (const [slug, flag] of declared()) {
      expect(
        flag,
        `[functions.${slug}] does not set verify_jwt, so the platform default applies ` +
          'and the two deploy paths disagree about it',
      ).not.toBeNull();
      expect(
        flag,
        `[functions.${slug}] sets verify_jwt = ${flag}, but functions.yml deploys with ` +
          '--no-verify-jwt. A preflight carries no Authorization header, so the stricter ' +
          'of the two would fail every request in the browser.',
      ).toBe('false');
    }
  });
});
