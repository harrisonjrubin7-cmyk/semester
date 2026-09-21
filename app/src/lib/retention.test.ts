import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * How long this project keeps things is a claim about the project, so it is
 * checked like one.
 *
 * `RETENTION.md` exists because the schedule was real and scattered: ninety
 * days in one migration, "until sent" in an Edge Function, a sweep in a third
 * file that nothing calls, and the promise they are all held to in a paragraph
 * of `lib/privacy.ts`. Nobody could have assembled that under pressure, and the
 * first person who needed to would have been doing it in the one hour it
 * mattered.
 *
 * The failure this guards is specific and, like `security.test.ts`'s, silent:
 * **somebody adds a table, and the retention document does not know it
 * exists.** Nothing goes red. The document still reads well. A migration adds
 * `public.transcripts` in March and the answer to "how long do you keep that?"
 * is missing in the week somebody from a university asks it.
 *
 * So the tripwire is bidirectional, the way that one is:
 *
 *   - every table the migrations create must be named in `RETENTION.md`
 *   - every table `RETENTION.md` names must be one the migrations create
 *
 * The second direction is the one that is easy to leave out and it is not
 * decoration. A row in that document for a table that no longer exists sends a
 * reviewer looking for a clock on nothing, and worse, it pads the list so the
 * first direction looks better covered than it is.
 *
 * ## What this does not check
 *
 * Whether ninety days is the right number, whether the tombstone sweep should
 * be scheduled, and whether an abandoned account should age out. Those are
 * decisions, the document says so in as many words, and a test asserting `90`
 * would dress a judgement up as a measurement. What it does check is that the
 * document cannot quietly stop describing the schema it is about, and that the
 * one promise the whole thing rests on is still on the screen a student reads.
 */

const ROOT = join(process.cwd(), '..');
const DOC = join(ROOT, 'RETENTION.md');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');

const doc = () => readFileSync(DOC, 'utf8');

/**
 * The document with its line breaks taken out.
 *
 * A sentence quoted in a blockquote wraps, so `There is no retention schedule`
 * is two lines in the file and one sentence to a reader. Matching the raw text
 * would hold the document to a line width, which is a formatting rule dressed
 * up as a correctness one — and it fails the moment somebody reflows a
 * paragraph. `security.test.ts` flattens for the same reason.
 */
const flat = () =>
  doc()
    // The blockquote markers go first. Flattening whitespace alone turns a
    // wrapped quotation into `no retention > schedule that quietly`, which
    // matches nothing and reads, in a failure message, exactly like the
    // sentence having been changed.
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/\s+/g, ' ');

/**
 * Every table the migrations create.
 *
 * Read from the `create table` statements rather than from a list here, for
 * the reason `scripts/destinations.mjs` gives about screens: a list in a test
 * is a list that drifts from the thing it is about and says nothing when it
 * does. `if not exists` and a bare or `public.`-qualified name are all in use
 * across the migrations, so the pattern takes all four shapes.
 *
 * **Anchored to the start of a line**, which it was not until 21 September.
 * `20260901000100_schema.sql` now carries `public.rls_auto_enable()`, and that
 * function's body filters on `command_tag IN ('CREATE TABLE', 'CREATE TABLE
 * AS', 'SELECT INTO')`. Unanchored and case-insensitive, the pattern read
 * `CREATE TABLE AS` out of that string literal and reported a table called
 * `AS` with no retention answer. The statement was a quoted tag inside a
 * function, not DDL — so this was the probe reading prose, and the assertion
 * was right to go red about a thing that is not a table.
 *
 * Every real `create table` in this directory sits at column 0 and always has;
 * the only two occurrences that do not are the indented literals above.
 * Anchoring is therefore a narrower question honestly asked, rather than an
 * exception carved for one file — and if somebody indents a genuine
 * `create table` one day, the count assertion below is what notices.
 */
function tablesCreated(): string[] {
  const found = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    for (const m of sql.matchAll(/^create table\s+(?:if not exists\s+)?(?:public\.)?([a-z_]+)/gim)) {
      found.add(m[1]);
    }
  }
  return [...found].sort();
}

/**
 * Every table the document names, read from `\`backticked\`` runs.
 *
 * Scoped to names that look like a table rather than every backticked token,
 * because the document also quotes column names, function names and file
 * paths. Intersecting with what the migrations create would defeat the whole
 * second direction — a stale row would intersect to nothing and vanish — so
 * the filter is on shape, and the known non-tables are named.
 */
const NOT_TABLES = new Set([
  'id',
  'deleted_at',
  'gone_at',
  'user_id',
  'row_count',
  'email',
  'invited_at',
  'note',
  'blocked',
  'public',
  'anon',
  'authenticated',
  'pg_cron',
  'note_access',
  'sweep_tombstones',
  // Migrations, named where the document explains which have not been applied
  // to production. `forms` and `access_log` are in that list too and are left
  // out of this one, because those two are also real tables.
  'usage_atomic',
  'group_columns_pinned',
  'deleteEverything',
  'KEPT_TABLES',
  'tombstones',
]);

function tablesNamed(): string[] {
  const found = new Set<string>();
  for (const m of doc().matchAll(/`([a-z_]+)`/g)) {
    const name = m[1];
    if (NOT_TABLES.has(name)) continue;
    if (!name.includes('_') && name.length < 5) continue;
    found.add(name);
  }
  return [...found].sort();
}

describe('the document exists and says what it is for', () => {
  it('is there at all', () => {
    expect(existsSync(DOC)).toBe(true);
  });

  it('carries no placeholder where an answer should be', () => {
    const said = doc();
    for (const placeholder of ['TODO', 'TBD', 'FIXME', '<owner>', 'XXX']) {
      expect(said).not.toContain(placeholder);
    }
  });

  /*
   * The promise the schedule is shaped around, held to the text a student
   * actually reads rather than to a paraphrase of it. If somebody rewrites the
   * privacy page to allow a retention schedule over a student's work, this
   * goes red — which is the point. That would be a product decision worth
   * making deliberately, and this is the thing that makes it deliberate.
   */
  it('rests on the promise the privacy page actually makes', async () => {
    const { CLAIMS } = await import('./privacy');
    const said = JSON.stringify(CLAIMS);
    expect(said).toContain('There is no retention schedule that quietly removes your work');
    expect(flat()).toContain('There is no retention schedule that quietly removes your work');
  });
});

describe('every table in the schema has a retention answer', () => {
  it('names every table the migrations create', () => {
    const missing = tablesCreated().filter((t) => !doc().includes(`\`${t}\``));
    expect(missing, `tables with no retention answer in RETENTION.md: ${missing.join(', ')}`).toEqual([]);
  });

  it('and names nothing that no longer exists', () => {
    const real = new Set(tablesCreated());
    const stale = tablesNamed().filter((t) => !real.has(t));
    expect(stale, `RETENTION.md names tables the migrations do not create: ${stale.join(', ')}`).toEqual([]);
  });

  /*
   * The probe, pointed at the fault it is meant to see.
   *
   * A regex that stopped matching would report an empty tree, and an empty
   * tree passes both directions above — the same "green tick for the wrong
   * question" that `CLAUDE.md` keeps finding in this repository's own
   * instruments. Thirteen migrations create twenty-four tables today; a run
   * that finds fewer than fifteen has stopped reading them.
   */
  it('and the probe reads the migrations rather than reporting an empty tree', () => {
    const seen = tablesCreated();
    expect(seen.length).toBeGreaterThan(15);
    expect(seen).toContain('access_log');
    expect(seen).toContain('push_queue');
  });
});

describe('the clocks that run are still the clocks the document describes', () => {
  /*
   * Not an assertion that ninety is right — see the header. An assertion that
   * the number in the document and the number in the migration are the same
   * number, which is the drift a reader cannot see from either end alone.
   */
  it('agrees with the migration about the access log', () => {
    const sql = readFileSync(join(MIGRATIONS, '20260901001300_access_log.sql'), 'utf8');
    expect(sql).toMatch(/date - 90\b/);
    expect(flat()).toMatch(/\*\*90 days\*\*/);
  });

  /*
   * The tombstone sweep, and the one number three files have to agree on.
   *
   * This test used to assert the opposite — that nothing scheduled the sweep —
   * because for weeks nothing did, and the document said so. Scheduling it
   * turned this red, which is what it was for: the schedule and the sentence
   * describing it cannot move independently.
   *
   * `supabase/check.sh` cannot cover this. It applies the migrations to a
   * throwaway Postgres with no `pg_cron`, so no `.check.sql` suite can see a
   * schedule at all. This is the only thing standing between the job and a
   * quiet edit.
   *
   * What would actually go wrong without it: somebody tunes the sweep to
   * `'30 days'` in `scheduler.sql` and `RETENTION.md` goes on promising
   * ninety. The document is what a reviewer reads and what the owner decided
   * from, and it would be describing a retention the database no longer has —
   * for the one table class holding a promise about other people's devices.
   */
  /*
   * The device row, which this document got wrong once and could again.
   *
   * It said "a 404 or 410 from the endpoint retires the row". It does not. A
   * single rejection marks the row; the retire happens only if the *next* run
   * finds it gone as well, and any success in a run clears the mark. The
   * difference is the entire reason `gone_at` exists — `functions/push`
   * records that a single 404 deleting the device is "exactly the behaviour
   * the column exists to prevent", and that the failure is silent when it
   * happens.
   *
   * So the document described the bug rather than the fix, and nothing was
   * going to catch that: it reads plausibly, the column is real, and both 404
   * and 410 do appear in the function. This pins the property that actually
   * distinguishes the two — that a mark and a retire are separate steps — at
   * both ends.
   */
  it('agrees with the push function about when a device is actually retired', () => {
    const push = readFileSync(join(ROOT, 'supabase', 'functions', 'push', 'index.ts'), 'utf8');

    // Two steps, not one: a mark that sets `gone_at`, and a delete.
    expect(push).toMatch(/update\(\{\s*gone_at:/);
    expect(push).toMatch(/from\('push_devices'\)\.delete\(\)/);
    // And a success outranks a rejection, which is what makes it two runs.
    expect(push).toContain('answered');

    const said = flat();
    expect(said).toContain('gone twice running');
    // The wording that was wrong, in either of the forms it took.
    expect(said).not.toMatch(/A 404 or 410 from the endpoint retires the row/);
  });

  it('agrees with the migration and the scheduler about the tombstone sweep', () => {
    const sql = readFileSync(join(MIGRATIONS, '20260901000700_records.sql'), 'utf8');
    expect(sql).toContain('sweep_tombstones');
    expect(sql).toMatch(/default '90 days'/);

    // Scheduled, under the name the document names.
    const scheduler = readFileSync(join(ROOT, 'supabase', 'scheduler.sql'), 'utf8');
    expect(scheduler).toContain('sweep_tombstones');
    expect(scheduler).toMatch(/cron\.schedule\(\s*'tombstones'/);

    /*
     * The retention the job actually passes, read out of the call rather than
     * matched loosely anywhere in the file — the migration's own `default '90
     * days'` is in scope of a bare search and would satisfy it whatever the
     * job said.
     */
    const call = /sweep_tombstones\('([^']+)'\)/.exec(scheduler);
    expect(call, 'scheduler.sql no longer calls sweep_tombstones with a literal interval').not.toBeNull();
    expect(call![1]).toBe('90 days');

    // And the document says the same number, and no longer says it is unrun.
    expect(flat()).toContain('**90 days after deletion**');
    expect(flat()).not.toContain('**Nothing calls it.**');
  });
});
