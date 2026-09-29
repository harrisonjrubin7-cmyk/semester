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
 * Anchored to the start of a line, because a migration can *mention* the words
 * without creating anything. `20260901000100_schema.sql` lists the command tags
 * its RLS event trigger fires on — `'CREATE TABLE'`, `'CREATE TABLE AS'`,
 * `'SELECT INTO'` — and read as DDL that is a table called `as`, which this
 * test then demanded a retention answer for: a failure of exactly the right
 * shape, about nothing. Every real `create table` in this directory begins a
 * line, indented or not, and the only mid-line ones are those two literals.
 *
 * Blanking quoted strings instead was tried first and is worse: the bodies here
 * are dollar-quoted and full of `''`, so pairing apostrophes swallows whole
 * statements and the probe goes quiet about tables that do exist.
 */
function tablesCreated(): string[] {
  const found = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    const statements = /^[ \t]*create table\s+(?:if not exists\s+)?(?:(?:public|private)\.)?([a-z_]+)/gim;
    for (const m of sql.matchAll(statements)) {
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

describe('the provider’s backups have a lifecycle here, held to the HECVAT answer', () => {
  const hecvat = () => readFileSync(join(ROOT, 'docs', 'market-readiness', 'HECVAT_DRAFT_RESPONSE.md'), 'utf8');
  const daysFromHecvat = () => {
    const row = hecvat().split('\n').find((l) => l.startsWith('| BCDR-01 '));
    expect(row, 'HECVAT_DRAFT_RESPONSE.md has no BCDR-01 row').toBeDefined();
    return Number(/(\d+)-day retention/.exec(row!)?.[1]);
  };

  it('states how long a backup lives, with the number BCDR-01 gives', () => {
    // Two documents answer "how long are backups kept"; they may not answer
    // differently. The HECVAT row is where a reviewer reads it, this file is
    // where the deletion consequence is worked out from it.
    const days = daysFromHecvat();
    expect(days).toBeGreaterThan(0);
    expect(flat()).toMatch(new RegExp(`Each daily backup expires \\*\\*${days} days\\*\\* after it is taken`));
    expect(flat()).toMatch(new RegExp(`outlives its deletion by at most the backup retention — ${days} days — and then by nothing, with one exception`));
  });

  it('says the number is the tier’s documentation and not a dashboard reading, and that the test cannot verify the provider', () => {
    // Codex on #940: holding two documents to one number proves consistency,
    // not the provider's configuration. The section must say which it is.
    expect(flat()).toMatch(/not yet read off the dashboard on any date/);
    expect(flat()).toMatch(/it cannot verify the provider/);
    const hecvatRow = hecvat().split('\n').find((l) => l.startsWith('| BCDR-01 '))!;
    expect(hecvatRow).toMatch(/not yet read from the project dashboard/);
  });

  it('carries the restore exception into RESTORE.md and the privacy-policy draft', () => {
    // A restore from a pre-deletion backup brings deleted rows back, so "at
    // most seven days" is only true if the deletions are re-applied. The
    // restore procedure has to carry that step, and the draft policy has to
    // carry the exception, or the promise is one the tree cannot keep.
    const restore = readFileSync(join(ROOT, 'RESTORE.md'), 'utf8').replace(/\s+/g, ' ');
    expect(restore).toMatch(/## Re-apply the deletions made after the backup point/);
    expect(restore).toMatch(/cannot be replayed/);
    // Codex on #944: the restored rows are an incident the moment they are
    // reachable, so the replay happens before the cutover, not after; and a
    // deletion record with no account cannot support an individual notice,
    // so the promise is a broad one.
    expect(restore).toMatch(/Do not cut over until steps 2 to 4 are done/);
    expect(restore).toMatch(/tell every account that existed in the window/);
    expect(flat()).toMatch(/before the restored project is opened to anyone/);
    const policy = readFileSync(join(ROOT, 'docs', 'legal', 'PRIVACY-POLICY-DRAFT.md'), 'utf8').replace(/\s+/g, ' ');
    expect(policy).toMatch(/\[VERIFY on the provider dashboard before publishing/);
    expect(policy).toMatch(/restored from a backup taken before you deleted something/);
    expect(policy).toMatch(/before the restored service is opened/);
    expect(policy).toMatch(/may need to be made again, because we cannot tell whose it was/);
    expect(policy).not.toMatch(/tell you if yours/);
  });

  it('says what a deletion means for the copy in a backup, and that a restore owes the deletions again', () => {
    expect(flat()).toMatch(/No process reads it in that window, and nothing restores it on its own/);
    expect(flat()).toMatch(/have to be run again/);
    expect(flat()).toMatch(/is not confirmed to be on/);
  });

  it('and the probe would catch a different number', () => {
    // The control: the same pattern with the wrong number must miss.
    const probe = new RegExp(`Each daily backup expires \\*\\*${daysFromHecvat()} days\\*\\* after it is taken`);
    expect('Each daily backup expires **14 days** after it is taken').not.toMatch(probe);
  });
});

describe('the clocks that run are still the clocks the document describes', () => {
  /*
   * Not an assertion that ninety is right — see the header. An assertion that
   * the number in the document and the number in the migration are the same
   * number, which is the drift a reader cannot see from either end alone.
   */
  it('agrees with the migration about the access log', () => {
    const sql = readFileSync(join(MIGRATIONS, '20260921143653_access_log.sql'), 'utf8');
    expect(sql).toMatch(/date - 90\b/);
    expect(flat()).toMatch(/\*\*90 days\*\*/);
  });

  /*
   * The second clock, and the first one added since this document existed —
   * which is the case the whole file was written for. `activity` is a record
   * about a student's work rather than the work, so it is allowed a clock at
   * all; what it is not allowed is a clock the document does not know about.
   *
   * Pinned at both ends, like the access log's: the migration's prune and the
   * table above cannot move independently. `lib/activity.ts` exports the same
   * number for the app's side of it, and `activity.test.ts` is what holds
   * that third copy to these two.
   */
  it('agrees with the migration about the activity record', () => {
    const sql = readFileSync(join(MIGRATIONS, '20260921151000_activity.sql'), 'utf8');
    expect(sql).toMatch(/date - 400\b/);
    expect(flat()).toMatch(/\*\*400 days\*\*/);
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

  it('keeps the institutional gateway purge hourly and its readiness window wider than the cadence', () => {
    const scheduler = readFileSync(join(ROOT, 'supabase', 'scheduler.sql'), 'utf8');
    expect(scheduler).toMatch(
      /cron\.schedule\(\s*'institution-gateway-retention',\s*'11 \* \* \* \*',\s*\$job\$select public\.gateway_purge_journal\(\)\$job\$/,
    );

    const readiness = readFileSync(
      join(MIGRATIONS, '20260924200000_gateway_observability.sql'),
      'utf8',
    );
    expect(readiness).toMatch(/last_retention_at > now\(\) - interval '2 hours'/);
    expect(flat()).toContain('hourly sweep');
  });

  it('runs the integration retention sweep daily, as the document says, and nothing parks it', () => {
    const scheduler = readFileSync(join(ROOT, 'supabase', 'scheduler.sql'), 'utf8');
    expect(scheduler).toMatch(
      /cron\.schedule\(\s*'integration-retention',\s*'29 3 \* \* \*',\s*\$job\$select public\.integration_retention_sweep\(\)\$job\$/,
    );
    expect(scheduler).not.toMatch(/jobname = 'integration-retention'\),\s*active := false/);
    expect(flat()).toContain('daily at 03:29 UTC');
    expect(flat()).not.toContain('nothing schedules it yet');
  });

  /*
   * Community evidence. The periods are promises made to students about
   * records of what they posted and reported, so the document, the scheduler
   * and the sweep are read against each other rather than trusted to agree.
   * Each interval is taken from the statement that uses it, not matched
   * anywhere in the file, so a comment cannot satisfy it.
   */
  it('agrees with the migration and the scheduler about the Community sweep', () => {
    const scheduler = readFileSync(join(ROOT, 'supabase', 'scheduler.sql'), 'utf8');
    expect(scheduler).toMatch(
      /cron\.schedule\(\s*'community-retention',\s*'29 4 \* \* \*',\s*\$job\$select private\.sweep_community_retention\(\)\$job\$/,
    );

    const sql = readFileSync(join(MIGRATIONS, '20260928032000_community.sql'), 'utf8');
    const sweep = sql.split('create or replace function private.sweep_community_retention()')[1]?.split('$$')[1] ?? '';
    expect(sweep, 'the sweep is no longer in the migration').not.toBe('');
    expect(sweep).toMatch(/k\.retain_until < now\(\) and k\.status not in \('open', 'appealed'\)/);
    expect(sweep, 'a case over a known-abuse match outlives its clock').toMatch(
      /status not in \('open', 'appealed'\)[^;]*and not exists \(select 1 from public\.community_media m where m\.post_id = k\.post_id and m\.known_abuse_match\)/,
    );
    expect(sweep).toMatch(/r\.case_id is null and r\.created_at < now\(\) - interval '90 days'/);
    expect(sweep).toMatch(/< now\(\) - interval '90 days';\s*get diagnostics n_restrictions/);
    expect(sweep).toMatch(/s\.ends_at < now\(\) - interval '30 days'/);
    expect(sweep).toMatch(/ran_at < now\(\) - interval '1 year'/);
    expect(sweep).toMatch(/t\.answered_at is null and t\.assigned_at < now\(\) - interval '1 day'/);
    expect(sweep).toMatch(/or t\.answered_at < now\(\) - interval '1 year'/);
    expect(sweep).toMatch(/e\.occurred_at < now\(\) - interval '1 year'/);

    // The dates a decision sets, which are what the sweep then reads.
    expect(sql).toMatch(/then interval '90 days' else interval '1 year' end/);
    expect(sql).toMatch(/set status = 'closed', retain_until = now\(\) \+ interval '1 year'/);

    const doc = flat();
    expect(doc).toContain('**90 days after a case is closed with no action; 1 year after anything is enforced or an appeal is decided. Open and appealed cases are never swept**');
    expect(doc).toContain('**30 days after the session ended**');
    expect(doc).toContain('**90 days after the restriction ended or was lifted**');
    expect(doc).toContain('**90 days after it was made, once no case holds it**');
    expect(doc).toContain('**1 day if never answered; 1 year once answered**');
  });

  /*
   * The three answers 20260929030000 gave to what this document used to list
   * as unanswered. Each period is read out of the statement that applies it,
   * and the audit period out of both places it lives — the sweep that deletes
   * and the trigger that lets it — because a sweep at two years against a
   * trigger at three deletes nothing and reports success.
   */
  it('agrees with the migration and the scheduler about invitations, sign-ups and audit events', () => {
    const sql = readFileSync(join(MIGRATIONS, '20260929030000_retention_sweeps.sql'), 'utf8');
    const body = (fn: string) => sql.split(`create or replace function ${fn}`)[1]?.split('$$')[1] ?? '';

    const invites = body('private.sweep_stale_invites()');
    expect(invites).toMatch(/i\.invited_at < now\(\) - interval '90 days'\s*and not exists/);
    expect(invites).toMatch(/b\.invited_at < now\(\) - interval '90 days'/);
    expect(invites).toMatch(/b\.revoked_at < now\(\) - interval '90 days'/);

    const signups = body('private.sweep_abandoned_signups()');
    expect(signups).toMatch(
      /email_confirmed_at is null\s*and u\.last_sign_in_at is null\s*and u\.created_at < now\(\) - interval '30 days'/,
    );

    const audit = body('private.sweep_audit_retention()');
    const allowed = body('private.audit_purge_allowed(occurred timestamptz)');
    const periods = [...audit.matchAll(/occurred_at < now\(\) - interval '([^']+)'/g)].map((m) => m[1]);
    expect(periods).toEqual(['3 years', '3 years', '3 years']);
    expect(allowed).toMatch(/occurred < now\(\) - interval '3 years'/);
    expect(audit, 'the FERPA disclosure record is swept').not.toContain('support_access_event');

    const scheduler = readFileSync(join(ROOT, 'supabase', 'scheduler.sql'), 'utf8');
    for (const [job, fn] of [
      ['invite-retention', 'sweep_stale_invites'],
      ['abandoned-signups', 'sweep_abandoned_signups'],
      ['audit-retention', 'sweep_audit_retention'],
    ]) {
      expect(scheduler).toMatch(
        new RegExp(`cron\\.schedule\\(\\s*'${job}',\\s*'[^']+',\\s*\\$job\\$select private\\.${fn}\\(\\)\\$job\\$`),
      );
      expect(scheduler).not.toMatch(new RegExp(`jobname = '${job}'\\),\\s*active := false`));
    }

    const said = flat();
    expect(said).toContain('**90 days after sending, when no account has the address**');
    expect(said).toContain('**30 days after creation, for an account never confirmed and never signed in**');
    expect(said).toContain('**3 years after the event**');
    expect(said).toContain('deliberately not on the 3-year clock');
    expect(said).not.toContain('**no answer yet**');
    expect(said).not.toContain('An invitation that is never taken up has no clock yet');
  });
});
