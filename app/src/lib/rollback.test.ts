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

describe('what the history findings say, which is not about a dashboard', () => {
  /*
   * Two of these were written the other way round and are gone, and the reason
   * is worth keeping.
   *
   * They asserted that `ROLLBACK.md` says Branching applies migrations on merge
   * and no longer says schema changes are made by hand. That was written from
   * Supabase's documentation and from a bot comment, and the repository then
   * produced evidence against it: `access_log` — then numbered
   * `20260901001300`, now `20260921143653` — merged to main at 17:34 on
   * 18 September and production had eighteen rows, no `access_log`, and the
   * same newest version twenty-five minutes later. A merged migration did not
   * arrive, and the old number is why: it sorted before thirteen versions the
   * ledger already held, so a deploy would never have applied it.
   *
   * Whether the integration is on is a dashboard setting no test here can read,
   * so no test here should pin a claim about it — that is how a document ends
   * up with a tripwire guarding a sentence nobody checked. What is left is what
   * was measured against the database directly, which is true whatever the
   * setting turns out to be.
   */
  it('says the schema cannot be rebuilt from its own history', () => {
    // The finding that removed disaster recovery. A document that drops it
    // reads as though the record is sound.
    expect(doc()).toMatch(/cannot be rebuilt from its own history/i);
    expect(doc(), 'the repair is no longer pointed at').toContain('MIGRATION-HISTORY.md');
  });

  /*
   * The snapshot, and the one way it could do harm.
   *
   * `supabase/schema.snapshot.sql` is a record of the live schema, written
   * because eight of production's twenty-one recorded migrations carry no SQL
   * and cannot rebuild it. It creates every table the project has.
   *
   * Dropped into `supabase/migrations/` it stops being a record and becomes a
   * migration — one that `check.sh` would apply to a throwaway cluster twice
   * over, and that Branching would send at a production database where all of
   * those objects already exist. That is the mistake worth a test; the file
   * being merely absent is the lesser one.
   */
  it('the snapshot exists and is pointed at', () => {
    expect(existsSync(join(ROOT, 'supabase', 'schema.snapshot.sql'))).toBe(true);
    expect(
      readFileSync(join(ROOT, 'MIGRATION-HISTORY.md'), 'utf8'),
      'the repair plan no longer links the snapshot',
    ).toContain('supabase/schema.snapshot.sql');
  });

  it('and is not in the migrations directory, where it would be applied', () => {
    const migrations = readdirSync(join(ROOT, 'supabase', 'migrations'));
    for (const f of migrations) {
      expect(f, `${f} looks like the snapshot, inside migrations/`).not.toMatch(/snapshot/i);
    }
    // And the control: there are migrations there to be confused with.
    expect(migrations.filter((f) => f.endsWith('.sql')).length).toBeGreaterThan(5);
  });

  it('and says on its face that it is not one', () => {
    /*
     * The header is the only thing standing between a reader and applying it.
     * A snapshot that does not say so is a migration nobody has noticed yet.
     */
    const snap = readFileSync(join(ROOT, 'supabase', 'schema.snapshot.sql'), 'utf8');
    expect(snap, 'the snapshot no longer warns against applying it').toMatch(
      /not\s+a\s+migration/i,
    );
    expect(snap, 'the snapshot no longer says not to apply it to production').toMatch(
      /[Dd]o\s+not\s+apply\s+this\s+to\s+production/,
    );
  });

  it('and the repair plan is there, with a status somebody has to maintain', () => {
    const plan = join(ROOT, 'MIGRATION-HISTORY.md');
    expect(existsSync(plan), 'MIGRATION-HISTORY.md is gone').toBe(true);
    const text = readFileSync(plan, 'utf8');
    // Its own claim is that nothing has been done yet. The day that stops being
    // true, the table is what says so — an untouched status table on a finished
    // repair is worse than none.
    expect(text, 'the repair plan has no status table').toMatch(/\|\s*Step\s*\|/i);
    /*
     * `\s+` between every word, not a space. These documents are hard-wrapped
     * at 80 columns, so where a sentence breaks is a property of its length
     * and not of its meaning — this exact phrase wraps after "is". A probe
     * that spells the gap as one space passes or fails on the line width,
     * which is the kind of test that goes red for a reformat and green for a
     * deletion.
     */
    expect(text, 'the plan no longer names the acceptance criterion').toMatch(
      /empty\s+diff\s+is\s+the\s+acceptance\s+criterion/i,
    );
  });

  /*
   * This used to require both documents to carry the merge freeze — "do not
   * merge a pull request that touches `supabase/`" — in either word order.
   * It did its job: lifting the freeze turned it red, which is exactly what a
   * tripwire on an operational instruction is for, and the instruction was
   * then lifted deliberately and in writing rather than by deletion.
   *
   * What replaces it is the rule the freeze was standing in for. The freeze was
   * temporary and vague; this is permanent and arithmetic.
   */
  it('and no migration is numbered where a deploy cannot apply it', () => {
    /*
     * The fault that broke production's schema deploy on 18 September, as a
     * comparison between numbers.
     *
     * Supabase applies a migration only if its version is newer than every
     * version the live ledger holds. So a file here is deployable if the
     * ledger already holds its version, or if it sorts after the newest one.
     * Anything in between will sit in this directory looking applied and never
     * reach the database, which is what `access_log` did for three days while
     * nothing said so. `rehearse.sh` cannot catch it — Postgres applies a file
     * whatever it is called.
     *
     * **This read the ledger out of two constants until 21 September, and the
     * constants went stale within the hour they were written.** They said the
     * ledger held twenty-one rows, newest `20260921002658`, and both were true
     * when typed; then five pending migrations were applied by hand and two
     * more followed, and the newest became `20260921150750`. A renumbering
     * done against the stale figure put seven files at `20260921003000`–`003600`
     * — above the watermark the constant named, below the real one — which is
     * the same fault the renumbering was for.
     *
     * So the ledger is read from `supabase/ledger.snapshot` instead: one dated
     * reading of every row, in a file that says when it was taken. A constant
     * copied out of a database has no date on it and cannot go stale loudly.
     * `migrationorder.test.ts` holds the same rule from the other end.
     */
    const LEDGER = readFileSync(join(ROOT, 'supabase', 'ledger.snapshot'), 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[0]);
    // The control on the reading, before anything is concluded from it: an
    // unparsed snapshot yields an empty list, and an empty list makes
    // `LEDGER_NEWEST` undefined and every comparison below vacuous.
    expect(LEDGER.length, 'ledger.snapshot did not parse').toBeGreaterThan(20);
    const LEDGER_NEWEST = LEDGER[LEDGER.length - 1];
    const IN_LEDGER_ALREADY = LEDGER;
    const versions = readdirSync(join(ROOT, 'supabase', 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.slice(0, 14));
    // The control: a rule about migration versions means nothing if there are
    // no migrations, and an empty directory would otherwise satisfy every
    // assertion below.
    expect(versions.length, 'there are no migrations to be a rule about').toBeGreaterThan(5);
    for (const v of versions) {
      if (IN_LEDGER_ALREADY.includes(v)) continue;
      expect(
        v > LEDGER_NEWEST,
        `${v} is not in the live ledger and sorts before ${LEDGER_NEWEST}, so a deploy will never apply it`,
      ).toBe(true);
    }
  });

  it('and both documents say the freeze lifted, rather than losing it', () => {
    // A rule that disappears reads the same as a rule nobody wrote. Both
    // documents carried the freeze, so both have to account for its going.
    for (const [name, text] of [
      ['ROLLBACK.md', doc()],
      ['MIGRATION-HISTORY.md', readFileSync(join(ROOT, 'MIGRATION-HISTORY.md'), 'utf8')],
    ] as const) {
      expect(
        /lift(s|ed)?\b/i.test(text) && /`supabase\/`/.test(text),
        `${name} no longer says what happened to the supabase/ merge freeze`,
      ).toBe(true);
    }
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

/*
 * The fingerprint, which is the only reason anyone can say the repository and
 * production agree.
 *
 * Step 1 of the repair proved the snapshot against production and did not
 * write down the queries, so the proof could be quoted and not repeated. Step
 * 4 ran six of them and five matched; `supabase/fingerprint.sql` is the file
 * that makes those numbers something a person can produce again rather than
 * read in a commit message.
 *
 * `code` is pinned alongside `functions` for a reason worth keeping: they
 * disagreed. Four functions were applied to production with their comments
 * stripped, so `functions` said the two databases differ and `code` said every
 * statement in them is the same. Dropping either row leaves a measurement that
 * cannot tell those two cases apart.
 */
describe('the fingerprint queries', () => {
  const PATH = join(ROOT, 'supabase', 'fingerprint.sql');

  it('exist as a file somebody can run again', () => {
    expect(existsSync(PATH), 'supabase/fingerprint.sql is gone').toBe(true);
  });

  it('and measure the six things the repair claims to have matched', () => {
    const sql = readFileSync(PATH, 'utf8');
    for (const what of ['columns', 'constraints', 'indexes', 'functions', 'code', 'policies']) {
      expect(sql, `the fingerprint no longer measures ${what}`).toMatch(
        new RegExp(`'${what}\\s*'\\s*\\|\\|`),
      );
    }
  });

  it('and are pointed at by the plan that rests on them', () => {
    expect(
      readFileSync(join(ROOT, 'MIGRATION-HISTORY.md'), 'utf8'),
      'the repair plan no longer links the fingerprint',
    ).toContain('supabase/fingerprint.sql');
  });
});

/*
 * `rls_auto_enable` is this project's, and a migration has to create it.
 *
 * Production has an event trigger that turns row-level security on for every
 * table created in `public`. This block used to assert the opposite of what it
 * asserts now — that the platform owns it, that no migration should create it,
 * and that defining it in `local.stub.sql` was the fix. That was wrong, and it
 * was pinned, which is worse: the test enforced the hole.
 *
 * What settled it is Supabase's own documentation. Under the heading
 * *Auto-enable RLS for new tables* it says "if you want RLS enabled
 * automatically for new tables, you can create an event trigger", and prints
 * this exact function and trigger. There is no dashboard setting that installs
 * them. Somebody ran the documented recipe against this project by hand, which
 * is why the code reads in Supabase's house style and why the only migration
 * that mentions it merely revokes EXECUTE on something already there.
 *
 * The cost of having it in the stub was measured rather than argued. With the
 * stub's copy removed and all fifteen migrations applied — the shape of a real
 * rebuild or a preview branch, where `local.stub.sql` is not deployed at all —
 * `ensure_rls` was absent. Nothing failed and nothing said so: the revoke in
 * `function_grants.sql` skips a function that is not there rather than erroring
 * on it. A recovered database would have had no RLS-on-by-default and looked
 * entirely healthy.
 *
 * So three halves are pinned: a migration creates the function, a migration
 * creates the trigger, and a migration closes the grant.
 */
describe('the event trigger that makes RLS the default', () => {
  const migrations = () => {
    const dir = join(ROOT, 'supabase', 'migrations');
    return readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .map((n) => readFileSync(join(dir, n), 'utf8'))
      .join('\n');
  };

  it('is created by a migration, with its trigger', () => {
    /*
     * The creation, not the name — kept from the version of this test that
     * pointed at the stub. Asking whether the string `rls_auto_enable` appears
     * passes against a control that renames the function to
     * `rls_auto_enabled_x`, because the new name contains the old one. A
     * substring is not a definition.
     */
    expect(migrations(), 'no migration defines rls_auto_enable').toMatch(
      /create\s+(or\s+replace\s+)?function\s+public\.rls_auto_enable\s*\(\s*\)/i,
    );
    expect(migrations(), 'no migration creates the ensure_rls event trigger').toMatch(
      /create\s+event\s+trigger\s+ensure_rls\b/i,
    );
  });

  it('and not only in the stub, which is deployed nowhere', () => {
    /*
     * The control for the test above, and the whole point of this change. An
     * object defined only in `local.stub.sql` exists in no rebuilt database and
     * on no preview branch — `supabase/README.md` says that file is "not
     * deployed anywhere" — so every local check can pass while the thing it is
     * checking is missing everywhere it matters.
     */
    const stub = readFileSync(join(ROOT, 'supabase', 'local.stub.sql'), 'utf8');
    expect(
      /create\s+(or\s+replace\s+)?function\s+public\.rls_auto_enable\s*\(\s*\)/i.test(stub),
      'local.stub.sql defines rls_auto_enable again, where a rebuild cannot see it',
    ).toBe(false);
    expect(
      /create\s+event\s+trigger\s+ensure_rls\b/i.test(stub),
      'local.stub.sql creates the ensure_rls trigger again, where a rebuild cannot see it',
    ).toBe(false);
  });

  it('and a migration does revoke it, from PUBLIC as well as by name', () => {
    const dir = join(ROOT, 'supabase', 'migrations');
    const all = readdirSync(dir)
      .filter((n) => n.endsWith('.sql'))
      .map((n) => readFileSync(join(dir, n), 'utf8'))
      .join('\n');
    /*
     * The role list, not the line. The first draft asked whether a line
     * mentioning `rls_auto_enable` also said `public` and `anon` — and
     * `['public.rls_auto_enable()', 'anon, authenticated']` says both, because
     * the schema is called public. A control that removed the PUBLIC half left
     * the test green while the check went red, which is the wrong way round.
     * So the second element is read on its own.
     */
    const entry = all.match(
      /\[\s*'public\.rls_auto_enable\(\)'\s*,\s*'([^']*)'\s*\]/i,
    );
    expect(entry, 'nothing in migrations/ revokes rls_auto_enable').toBeTruthy();
    const roles = (entry?.[1] ?? '').split(',').map((r) => r.trim().toLowerCase());
    for (const role of ['public', 'anon', 'authenticated']) {
      expect(roles, `the revoke no longer takes the grant away from ${role}`).toContain(role);
    }
  });
});
