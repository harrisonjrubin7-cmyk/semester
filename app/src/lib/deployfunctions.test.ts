/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A function directory on main is a deployed function.
 *
 * `.github/workflows/functions.yml` runs on `push` to main with
 * `paths: ['supabase/functions/**']` and deploys the directories that changed.
 * So the moment a pull request adding a function merges, that function is live
 * — nobody runs a command, nobody updates a document, and the document is the
 * only thing that could have been wrong.
 *
 * It was. `supabase/DEPLOY.md` opened with a two-line "What is live" naming
 * `claude` and `push` at v1, and filed `fetchcal`, `canvas` and `lti` under
 * headings reading *"Not deployed yet"*. Measured against the project on
 * 21 September 2026: all six were ACTIVE, `claude` at v19, `fetchcal` live
 * since the 9th, `calendar` live since the 8th and named nowhere in the file at
 * all, and `lti` deployed at 15:48 — roughly two hours after the section
 * saying it had not.
 *
 * The cost is not tidiness. `fetchcal`'s section ended *"until this is
 * deployed, fails on the built app"*, about the Connect screen's Subscribe
 * button, which had been working in production for twelve days. A student or an
 * agent reading that file to find out whether calendar subscription works was
 * told the opposite of the truth by the document written to answer exactly
 * that.
 *
 * ## Why a test can hold this when it cannot see the project
 *
 * It cannot, and it does not try — `ledger.snapshot` exists because a test that
 * pretended to reach production would be worse than one that says what it is.
 * Two things here are true of the *repository*, and both are what actually went
 * wrong:
 *
 *   - every function directory is named in `DEPLOY.md`, which is what
 *     `calendar` failed for two weeks; and
 *   - none of them is described as unshipped, which is the claim that cannot be
 *     true of a directory on main and was true of three.
 *
 * The version numbers in that file are deliberately **not** checked. They go
 * stale on every deploy, they are the part of the record that misleads nobody,
 * and a test that failed on them would be a test somebody deletes.
 */

const ROOT = join(process.cwd(), '..');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');

/**
 * Every deployable function, by slug.
 *
 * `_shared` is not one — it holds modules the others import (`cors.ts`), has no
 * `index.ts`, and the Supabase CLI does not treat a directory starting with an
 * underscore as a function. Excluded by that rule rather than by name, so a
 * second shared directory needs no edit here.
 */
function slugs(): string[] {
  return readdirSync(FUNCTIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();
}

const deployDoc = () => readFileSync(join(ROOT, 'supabase', 'DEPLOY.md'), 'utf8');
const configToml = () => readFileSync(join(ROOT, 'supabase', 'config.toml'), 'utf8');

/**
 * The indented block under `## What is live`, and nothing else.
 *
 * The first version of the check below asked whether the document *contained*
 * each slug, and that is useless for exactly the function it was written to
 * catch: `calendar` appears all over this file as an ordinary English word —
 * "a calendar server sends no CORS headers", "points at the calendar link" —
 * so `includes('calendar')` was true throughout the fortnight the `calendar`
 * *function* was named nowhere. The probe would have passed on the fault it
 * exists for.
 *
 * So it reads the one place a deployed function has to be listed, which is
 * also the place somebody looks to answer the question.
 */
function liveBlock(): string {
  const doc = deployDoc();
  const start = doc.indexOf('## What is live');
  expect(start, 'DEPLOY.md should have a "What is live" section').toBeGreaterThan(-1);
  const after = doc.slice(start);
  const next = after.indexOf('\n## ', 1);
  return next === -1 ? after : after.slice(0, next);
}

describe('what DEPLOY.md says is deployed', () => {
  it('has functions to be right or wrong about', () => {
    // The control. A directory listing that came back empty would make every
    // assertion below vacuously true.
    expect(slugs().length).toBeGreaterThan(1);
  });

  it('lists every function that exists under "What is live"', () => {
    const live = liveBlock();
    const missing = slugs().filter((s) => !new RegExp(String.raw`^\s+${s}\s`, 'm').test(live));
    expect(
      missing,
      `deployed but not listed under "What is live": ${missing.join(', ')}`,
    ).toEqual([]);
  });

  /*
   * Supabase Branching deploys to a preview branch only what `config.toml`
   * declares. With no `[functions]` blocks it deployed none of them, and said
   * so on every branch — *"Only Functions declared in config.toml will be
   * automatically deployed to branches"* — so a branch could exercise a
   * migration and never a function.
   *
   * The blocks are there now. The failure they end returns one function at a
   * time, though: the next function added without a block does not error, it
   * silently never reaches a preview branch, and the warning about it looks
   * exactly like the warning about nothing being wrong. So the list is held to
   * the directory rather than to somebody remembering.
   *
   * Matched on the section header rather than on the slug appearing anywhere,
   * for the same reason the "What is live" check reads one block: `calendar`
   * and `claude` are ordinary words in that file's prose, and a looser probe
   * would be true of them whether or not the block existed.
   */
  it('declares every one of them in config.toml, or previews skip it', () => {
    const toml = configToml();
    const undeclared = slugs().filter(
      (s) => !new RegExp(String.raw`^\[functions\.${s}\]\s*$`, 'm').test(toml),
    );
    expect(
      undeclared,
      `no [functions.<slug>] block, so a preview branch deploys nothing for: ${undeclared.join(', ')}`,
    ).toEqual([]);
  });

  it('does not call any of them undeployed, because main deploys them', () => {
    /*
     * Matched on the phrase rather than on the heading shape, because the
     * sentence is the thing that misleads and it has appeared in prose as well
     * as in `## Not deployed yet: \`x\``. A function genuinely not on main has
     * no directory here, so it cannot reach this list.
     */
    const doc = deployDoc();
    const claimed = slugs().filter((s) =>
      new RegExp(String.raw`not deployed[^.\n]{0,40}\b${s}\b|\b${s}\b[^.\n]{0,40}not deployed`, 'i').test(doc),
    );
    expect(
      claimed,
      `DEPLOY.md calls these undeployed, but a directory on main has been deployed by ` +
        `functions.yml: ${claimed.join(', ')}`,
    ).toEqual([]);
  });
});
