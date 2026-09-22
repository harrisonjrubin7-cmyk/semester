/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Two pipelines deploy the Edge Functions, and for three days neither reached
 * two of them.
 *
 * `deployfunctions.test.ts` holds `DEPLOY.md` and `config.toml` to the
 * directories that exist, and refuses the `https://` specifiers that caused
 * this. It cannot catch the *symptom*, because the symptom is not in the
 * repository: a function frozen in production looks, from here, exactly like a
 * function nobody has changed lately.
 *
 * `supabase/functions.snapshot` is a dated reading of which pipeline last
 * deployed each one, and this holds the repository to that reading — the same
 * arrangement as `ledger.snapshot` and `migrationorder.test.ts`, for the same
 * stated reason: nothing in a test run can reach the project, and a test that
 * pretended to would be worse than one that says what it is.
 *
 * ## What is asserted, and what is deliberately not
 *
 * The **pipeline** column is asserted. A `runner` row is positive evidence that
 * the platform deploy — which runs on every merge — is not building that
 * function, because if it were, it would have overwritten the path.
 *
 * The **version and timestamp are not asserted**, only recorded. They move on
 * every merge, and this repository's own rule about that is explicit: version
 * numbers in `DEPLOY.md` are left unchecked because a test that failed on them
 * is a test somebody deletes. They are in the file for the reader who needs to
 * know how old the reading is.
 */

const ROOT = join(process.cwd(), '..');
const FUNCTIONS = join(ROOT, 'supabase', 'functions');
const SNAPSHOT = join(ROOT, 'supabase', 'functions.snapshot');

interface Row {
  slug: string;
  version: string;
  pipeline: string;
  at: string;
}

/** `slug version pipeline at` per line, comments and blanks dropped. */
function reading(): Row[] {
  return readFileSync(SNAPSHOT, 'utf8')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean)
    .map((l) => {
      const [slug, version, pipeline, at] = l.split(/\s+/);
      return { slug, version, pipeline, at };
    });
}

/**
 * Every deployable function, by slug — the same underscore rule
 * `deployfunctions.test.ts` uses, so a second shared directory needs no edit
 * in either file.
 */
function slugs(): string[] {
  return readdirSync(FUNCTIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();
}

/** The rows this reading says are outside the continuous pipeline. */
function frozen(rows: Row[]): string[] {
  return rows.filter((r) => r.pipeline !== 'platform').map((r) => `${r.slug} (${r.pipeline})`);
}

describe('the functions snapshot is a reading, and still reads like one', () => {
  it('parses as rows, every one a slug, a version, a pipeline and a time', () => {
    /*
     * The control, and it is not decoration. A parse that stopped matching
     * returns an empty list, and every assertion below is vacuously true of an
     * empty list — all clear, from a probe that read nothing. This repository
     * has had exactly that happen to two separate instruments, so the shape is
     * asserted before anything is concluded from it.
     */
    const rows = reading();
    // A floor, not a count. `migrationorder.test.ts` records asserting an exact
    // number and going red twenty minutes later when the snapshot was re-read,
    // which is the file working rather than failing.
    expect(rows.length, 'no rows parsed out of functions.snapshot').toBeGreaterThan(4);
    for (const r of rows) {
      expect(r.slug, `slug missing in: ${JSON.stringify(r)}`).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(r.version, `version not a number for ${r.slug}`).toMatch(/^\d+$/);
      expect(['platform', 'runner'], `unknown pipeline for ${r.slug}`).toContain(r.pipeline);
      expect(r.at, `timestamp not ISO for ${r.slug}`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    }
  });

  it('can tell a frozen row from a live one', () => {
    /*
     * The detector, shown both answers. A check that only ever sees `platform`
     * rows is not known to be able to report anything else — which is the
     * failure mode of a guard that has never failed, and this repository has
     * shipped two tests that passed against a faithful revert of the bug they
     * were written for.
     */
    const at = '2026-09-18T17:35:25Z';
    expect(
      frozen([
        { slug: 'push', version: '16', pipeline: 'runner', at },
        { slug: 'calendar', version: '12', pipeline: 'runner', at },
        { slug: 'claude', version: '44', pipeline: 'platform', at },
      ]),
    ).toEqual(['push (runner)', 'calendar (runner)']);
    expect(frozen([{ slug: 'claude', version: '44', pipeline: 'platform', at }])).toEqual([]);
  });

  it('has a row for every function that exists', () => {
    // `calendar` was live for a fortnight and named in no document. The same
    // omission here would mean a function nobody has ever looked at the project
    // for, which is the state this file exists to make impossible to hold
    // quietly.
    const seen = new Set(reading().map((r) => r.slug));
    const missing = slugs().filter((s) => !seen.has(s));
    expect(missing, `no reading recorded for: ${missing.join(', ')}`).toEqual([]);
  });

  it('has no row for a function that does not', () => {
    // The other direction, so a deleted function cannot sit here reading
    // healthy forever.
    const have = new Set(slugs());
    const extra = reading()
      .map((r) => r.slug)
      .filter((s) => !have.has(s));
    expect(extra, `recorded but no directory under supabase/functions: ${extra.join(', ')}`).toEqual([]);
  });

  it('records every function inside the continuous pipeline', () => {
    /*
     * The rule. See `functions.snapshot` for why a `runner` row is evidence of
     * exclusion rather than a note about provenance, and for the one reading
     * that is transient rather than a fault — a `workflow_dispatch` deploy,
     * which the next merge overwrites. Re-read before concluding; if it
     * survives a merge, that function is frozen.
     */
    const out = frozen(reading());
    expect(
      out,
      `these are outside the platform deploy, so a merge elsewhere will not ` +
        `redeploy them and nothing will say so: ${out.join(', ')}. Re-read the ` +
        `project before concluding — a hand-started deploy reads this way once.`,
    ).toEqual([]);
  });
});
