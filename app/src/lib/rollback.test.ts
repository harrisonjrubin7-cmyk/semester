import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A rollback plan is a claim about the repository, so it is checked like one.
 *
 * `ROLLBACK.md` says three things that are only true while the workflows stay
 * as they are, and every one of them fails silently: a rollback plan whose
 * preconditions have quietly gone is not a plan that breaks loudly during an
 * incident, it is a plan that was already broken and nobody knew. So:
 *
 *   **`pages.yml` must accept `workflow_dispatch`.** Without it the only way
 *   to redeploy an earlier commit is an empty commit on main, which is slower
 *   and puts a lie in the history. The document's whole procedure is that one
 *   trigger.
 *
 *   **`pages.yml` must not cancel a deploy in flight.** A cancelled deploy can
 *   leave the site serving a partial build, which during a rollback means the
 *   incident is now two incidents.
 *
 *   **Nothing may apply a migration.** The document's central rule — that the
 *   app rolls back and the schema does not — is written on the fact that
 *   schema changes are manual. If somebody wires migrations into CI, the rule
 *   stops being the rule and the document is wrong in the most expensive
 *   possible way. This test is the tripwire.
 *
 * What it deliberately does *not* check is the rule that matters most: that a
 * migration leaves the database readable by the previous app version. That is
 * a property of a change, not of a file, and no test in this repository can
 * see it. It is stated in the document rather than pretended at here.
 */

const ROOT = join(process.cwd(), '..');
const DOC = join(ROOT, 'ROLLBACK.md');
const WORKFLOWS = join(ROOT, '.github', 'workflows');

const workflow = (name: string) => readFileSync(join(WORKFLOWS, name), 'utf8');
const doc = () => readFileSync(DOC, 'utf8');

/** The `on:` block only, so a `workflow_dispatch` in a comment is not a trigger. */
function triggers(source: string): string {
  const from = source.indexOf('\non:');
  expect(from, 'the workflow has no on: block').toBeGreaterThan(-1);
  const rest = source.slice(from + 1);
  // Up to the next top-level key, which is the first line starting in column 1
  // after the first.
  const end = rest.slice(1).search(/\n[a-z]/);
  return end === -1 ? rest : rest.slice(0, end + 1);
}

describe('the document exists and names somebody', () => {
  it('is there at all', () => {
    expect(existsSync(DOC), 'ROLLBACK.md is gone').toBe(true);
  });

  it('names an owner, and not a placeholder', () => {
    const said = doc();
    /*
     * The checklist asks for a *defined* owner, so an unfilled one is the
     * exact failure being guarded against — a document that looks complete
     * and names nobody.
     */
    expect(said).toMatch(/@[A-Za-z0-9-]+/);
    for (const placeholder of ['TODO', 'TBD', 'FIXME', '<owner>', 'XXX']) {
      expect(said, `the owner is still ${placeholder}`).not.toContain(placeholder);
    }
  });

  it('commits to a time, in a number somebody can hold it to', () => {
    expect(doc()).toMatch(/under \w+ minutes/i);
  });

  it('says plainly that the schema does not roll back', () => {
    expect(doc()).toMatch(/does not roll the schema back/i);
  });
});

describe('the preconditions the procedure rests on', () => {
  it('pages.yml can be run by hand, which is the whole procedure', () => {
    expect(triggers(workflow('pages.yml')), 'no workflow_dispatch on the Pages deploy').toContain(
      'workflow_dispatch',
    );
  });

  it('functions.yml can be too, which is the other half', () => {
    expect(triggers(workflow('functions.yml'))).toContain('workflow_dispatch');
  });

  it('a deploy is never cancelled in flight, because a partial site is worse', () => {
    expect(workflow('pages.yml')).toContain('cancel-in-progress: false');
  });

  /*
   * The control on the trigger probe, and the second version of it.
   *
   * The first asserted that `ci.yml`'s triggers do not contain
   * `workflow_dispatch` — which is true, and useless: `ci.yml` does not
   * contain that word *anywhere*, so a parser that returned the entire file
   * would have passed it. The mutation harness found that by breaking the
   * parser and watching this test stay green, which is the whole reason a
   * control is mutated rather than admired.
   *
   * So it is pinned to something that certainly is in the file and certainly
   * is not a trigger. If `triggers()` ever starts handing back more than the
   * `on:` block, this goes red before the two tests above start passing on
   * nothing.
   */
  it('and the probe reads triggers rather than the whole file', () => {
    const block = triggers(workflow('pages.yml'));
    expect(block, 'the trigger block now reaches the job body').not.toContain('actions/checkout');
    expect(block, 'the trigger block no longer reaches the triggers').toContain('workflow_dispatch');
    // And the thing it must not reach is genuinely there to be reached.
    expect(workflow('pages.yml')).toContain('actions/checkout');
  });
});

describe('the rule that nothing applies a migration', () => {
  it('holds, and this is the tripwire for the day it stops', () => {
    /*
     * If this goes red, `ROLLBACK.md` is wrong rather than this test being
     * wrong: somebody has automated migrations, and the document's central
     * claim — that the app rolls back and the schema does not — needs
     * rewriting before the next incident rather than after it.
     */
    const applies = /supabase\s+db\s+push|supabase\s+migration\s+up|db\s+reset/;
    for (const name of readdirSync(WORKFLOWS)) {
      expect(applies.test(workflow(name)), `${name} appears to apply migrations`).toBe(false);
    }
  });

  it('and there are migrations for it to be a rule about', () => {
    // The control: a rule about migrations means nothing if there are none,
    // and this test would pass just as well against an empty directory.
    const migrations = readdirSync(join(ROOT, 'supabase', 'migrations'));
    expect(migrations.filter((f) => f.endsWith('.sql')).length).toBeGreaterThan(5);
  });
});

describe('the SQL suites are run by something other than a person remembering', () => {
  /*
   * In this file rather than one of its own because it is the same kind of
   * claim as the three above: an assertion about `.github/workflows/` that
   * fails *silently*. Nothing goes red when a check stops being run; the
   * checks simply stop, and `check.sh`'s own header is the record of how long
   * that can go unnoticed — two suites had been failing on their first block
   * since the migration that broke them, and because a failed block aborts the
   * transaction, thirty-eight checks across two files had never executed.
   *
   * The policies are the only test the database half of this app has, and the
   * invite gate's own suite caught a real hole in it. So the step existing is
   * worth pinning.
   */
  it('CI runs supabase/check.sh', () => {
    /*
     * The `run:` lines only, and that is not fussiness. The first version
     * searched the whole file — which passed against a `ci.yml` with the step
     * *deleted*, because the comment above it explaining why the step exists
     * also names the script. A probe that a feature's own documentation can
     * satisfy is a probe that would pass whatever the workflow did, and this
     * is the third time in one day that one has counted a word in a comment.
     */
    const runs = [...workflow('ci.yml').matchAll(/^\s*run:\s*(.*)$/gm)].map((m) => m[1]);
    expect(
      runs.some((r) => r.includes('supabase/check.sh')),
      'the database policy checks are no longer run by CI',
    ).toBe(true);
  });

  it('and the probe for it reads the run lines, not the comments', () => {
    // The control. `ci.yml` names the script in prose as well, so a scan of
    // the whole file cannot tell the step from the paragraph about the step.
    const raw = workflow('ci.yml');
    const runs = [...raw.matchAll(/^\s*run:\s*(.*)$/gm)].map((m) => m[1]).join('\n');
    expect(raw, 'the explanation naming the script has gone').toContain(
      '`supabase/check.sh` applies every migration',
    );
    expect(runs, 'the run lines are picking up prose').not.toContain('applies every migration');
  });

  /*
   * Running, and running against the right database.
   *
   * The step above only asks that the checks run. They did run, and they were
   * green, and they were about Postgres 16 while `config.toml` records the
   * live project as 17 — `check.sh` took the newest server installed, and
   * `ubuntu-latest` ships 16. That is worse than a skipped check: a skipped
   * check is silent, and this one printed "every policy check passed" about a
   * database nobody is using.
   *
   * Two halves, and both have to hold or the pin is decorative: the script has
   * to refuse a major it was not asked for, and CI has to install the one it
   * will ask for. Either alone goes green while being wrong — a script that
   * refuses on a runner with no 17 fails every build, and an install step
   * feeding a script that accepts anything is the bug this replaced.
   */
  const configToml = () => readFileSync(join(ROOT, 'supabase', 'config.toml'), 'utf8');
  const major = () => /major_version\s*=\s*(\d+)/.exec(configToml())?.[1];

  it('config.toml still records which major the live project runs', () => {
    // Everything below reads this number. Without it there is nothing to pin
    // to, and `check.sh` exits 2 rather than guessing.
    expect(major(), 'no major_version in supabase/config.toml').toMatch(/^\d+$/);
  });

  it('check.sh reads that number rather than carrying its own', () => {
    const script = readFileSync(join(ROOT, 'supabase', 'check.sh'), 'utf8');
    expect(script, 'check.sh no longer reads config.toml').toMatch(
      /major_version[\s\S]{0,200}config\.toml/,
    );
    // The default path asks for that major by name.
    expect(script, 'check.sh no longer looks for the major it was asked for').toContain(
      '/usr/lib/postgresql/$want/bin/initdb',
    );
  });

  it('and only reaches for whichever is newest behind the explicit override', () => {
    /*
     * The real regression is not that "newest installed" appears in the file —
     * it still does, and deliberately: `SEMESTER_CHECK_PG_ANY=1` is how
     * somebody with only 16 can run these at all, and it says on every run
     * that a pass is not a statement about production. What must not come back
     * is that lookup being reachable *without* asking for it, because that is
     * silent and this whole pin is about the silence.
     *
     * So: every newest-installed lookup in the script sits after the override
     * is tested. Comments are stripped first, line for line, so that the
     * paragraph explaining the old behaviour does not read as the behaviour.
     */
    const code = readFileSync(join(ROOT, 'supabase', 'check.sh'), 'utf8').replace(
      /^\s*#.*$/gm,
      '',
    );
    const gate = code.indexOf('SEMESTER_CHECK_PG_ANY');
    expect(gate, 'the override is gone, so there is nothing gating the fallback').toBeGreaterThan(
      -1,
    );
    const newest = [...code.matchAll(/ls -d \/usr\/lib\/postgresql\/\*\/bin/g)].map(
      (m) => m.index ?? -1,
    );
    expect(newest.length, 'the fallback is gone entirely — harmless, but update this').toBe(1);
    for (const at of newest) {
      expect(at, 'check.sh takes the newest Postgres without being asked').toBeGreaterThan(gate);
    }
  });

  it('CI installs that same major before running the checks', () => {
    /*
     * The `run:` lines, for the reason the step above reads them: `ci.yml`
     * explains this pin in prose directly above the step, so a scan of the
     * whole file would pass against the step being deleted.
     */
    const raw = workflow('ci.yml');
    const runs = [...raw.matchAll(/^\s*run:\s*\|?\s*$|^\s*run:\s*(.*)$/gm)];
    expect(runs.length, 'ci.yml has no run steps at all').toBeGreaterThan(0);
    // The install is a block scalar, so match the workflow's steps rather than
    // one line: the package name is built from config.toml in the step itself.
    expect(raw, 'CI no longer installs a Postgres for the checks').toMatch(
      /apt-get install -y "postgresql-\$want"/,
    );
    expect(raw, 'the install no longer fails when the binary is not there').toMatch(
      /\/usr\/lib\/postgresql\/\$want\/bin\/initdb/,
    );
  });

  it('and the install step derives the version instead of writing one down', () => {
    /*
     * The control on the test above. Hard-coding `postgresql-17` in the
     * workflow would satisfy a looser probe and reintroduce exactly the drift
     * this is about — two places holding the number, one of them silently
     * stale the day the project is upgraded.
     */
    const raw = workflow('ci.yml');
    expect(raw, 'ci.yml is naming a Postgres major by hand').not.toMatch(
      /apt-get install -y postgresql-\d+/,
    );
    expect(raw, 'the install step no longer reads config.toml').toMatch(
      /major_version[\s\S]{0,200}supabase\/config\.toml/,
    );
  });

  it('and the script is there to be run, and executable', () => {
    const script = join(ROOT, 'supabase', 'check.sh');
    expect(existsSync(script)).toBe(true);
    // The control on the test above: naming a script CI cannot execute would
    // pass a `toContain` and fail every run.
    expect(statSync(script).mode & 0o111, 'check.sh is not executable').toBeGreaterThan(0);
  });
});

describe('what the document points at exists', () => {
  it('every workflow it names is a workflow that is there', () => {
    const named = [...doc().matchAll(/`(\w+\.yml)`/g)].map((m) => m[1]);
    expect(named.length, 'the document names no workflows at all').toBeGreaterThan(1);
    for (const name of new Set(named)) {
      expect(existsSync(join(WORKFLOWS, name)), `${name} is named but not there`).toBe(true);
    }
  });

  it('and every repository file it links to', () => {
    const linked = [...doc().matchAll(/\]\((?!https?:)([^)#]+)\)/g)].map((m) => m[1]);
    expect(linked.length, 'the document links to no files').toBeGreaterThan(0);
    for (const path of new Set(linked)) {
      expect(existsSync(join(ROOT, path)), `${path} is linked but not there`).toBe(true);
    }
  });
});
