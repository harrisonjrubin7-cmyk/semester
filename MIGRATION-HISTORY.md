# Repairing the migration history

The schema this app runs on cannot be rebuilt from its own record.
[`ROLLBACK.md`](ROLLBACK.md) states the finding and why it is a rollback
concern; this is the plan for fixing it, written before any of it was done so
that the reasoning can be argued with rather than discovered in a diff.

**Nothing here has been carried out.** Every step below is a proposal.

## What is actually wrong

Three separate faults, and they are usually described as one. Repairing them in
the wrong order makes two of them worse.

**1 · Eight migrations have no SQL.** Production's
`supabase_migrations.schema_migrations` records `schema`, `classmates`,
`classmates_schools`, `rooms`, `groups`, `push`, `records` and `calendar` with
zero statements. A replay runs nothing for them. This is the one that removes
disaster recovery.

**2 · Ten migrations exist only in production.** `push_devices_and_queue`,
`push_scheduler_extensions`, `harden_security_definer_helpers`,
`rls_initplan_and_policy_overlap`, `wrap_auth_uid_in_helpers`,
`index_foreign_keys`, `classmates_any_school`,
`per_record_sync_with_soft_deletes`, `calendar_feeds` and `groups`
(20260911151826) have full SQL in the database and no file in
`supabase/migrations/`. They were applied through the dashboard or the
management API. The repository has never described the database it deploys to.

**3 · Six files have never been applied.** `usage_atomic`,
`group_columns_pinned`, `forms`, `invites`, `access_log` and `referrals` are in
`supabase/migrations/` and absent from production — verified object by object,
not inferred from the history, for the first five. Two of them matter for the pilot: the atomic AI
metering fix and the invite gate are merged code sitting on a schema that does
not support them.

It was four when this was written and became five the same evening.
`20260901001300_access_log.sql` merged to main at 17:34 on 18 September and
production had not received it twenty-five minutes later — no failure, no
notice. It became six on 20 September with
`20260901001400_referrals.sql`, which is counted here on the strength of the
same argument rather than a fresh object-by-object check: nothing has applied
a file from this directory in the window, so a file that landed after the
audit is unapplied unless somebody has gone and done it by hand. **The gap
grows on its own**, which is the argument for doing this rather than watching
it.

## The rule this repair runs under

> **Read before write, and never write to production to make a record tidy.**

The temptation is to "fix" fault 1 by running the repo's `schema.sql` against
production so the history matches. That would attempt to create tables that
already hold real data. Every step below either reads production or writes
files in this repository. The only production write in the whole plan is step 5,
it is to the history table alone, and it is the last thing that happens.

## The steps

### 1 · Capture what production actually is

Dump the live schema — `pg_dump --schema-only`, or the equivalent through the
management API — and commit it as `supabase/schema.snapshot.sql`, marked
plainly as a record rather than a migration.

This is worth doing first even if the rest of the plan is rejected, because it
is the only step that on its own restores disaster recovery. Everything after it
is about making the record *structured*; this makes it *exist*.

### 2 · Write the ten missing migrations into files

Their SQL is in the history table and is complete. Each becomes a file under its
own version number, byte-for-byte as recorded. No editing, no tidying, no
merging two into one: the point is that the file and the row agree, and any
improvement breaks that.

### 3 · Reconstruct the eight name-only migrations

The delicate step, and the only one where a mistake is silent.

The repository's own `schema.sql`, `classmates.sql` and the rest are presumably
what was run. **Presumably is not good enough**, because the eight ran a year of
dashboard edits ago and nothing recorded what was actually executed.

So each reconstruction is checked against production rather than trusted:
compare the objects a file creates against `information_schema` and `pg_proc` on
the live database — every table, column, type, default, constraint, index,
policy and function signature — and record each difference. Where the file and
production disagree, **production is right** and the file is amended with a
comment saying what was found and that it was found rather than intended.

The expected differences are the ones faults 2 and 3 predict: production has had
ten later migrations applied, so a column added by `calendar_feeds` will not be
in `calendar.sql`. That is fine and is exactly what the version ordering is for.
A difference that *cannot* be explained by a later migration is the interesting
kind, and each one gets written down.

### 4 · Prove the reconstruction before trusting it

`supabase/check.sh` already builds a throwaway Postgres 17 from the migrations
directory. After steps 2 and 3 it will be applying twenty-two files instead of
twelve, and the suites must still pass.

That is necessary and not sufficient — the suites test policies, not schema
shape. The real check is a diff: build the schema from the repaired file set,
dump it, and diff it against step 1's snapshot of production. **An empty diff is
the acceptance criterion for this whole repair.** Anything else is a list of
things still unexplained, and the list goes in this file rather than being
waved through.

The control matters as much as the check. A diff tool that reports "no
differences" between two schemas is also what a broken diff looks like, so it
gets shown failing first — against the twelve-file set, where the difference is
known to be large.

### 5 · Record the eight, and only then

Once the diff is empty, the eight name-only rows can carry their statements.
`supabase migration repair` is the supported route.

This is the one production write in the plan and it touches only the history
table. It creates no object, drops none, and changes no data. If step 4's diff
is not empty, this step does not happen.

### 6 · Then, and separately, the pending migrations

Out of scope here and worth naming so it is not forgotten. Once production is
reproducible, a preview branch can finally be built that matches it, and
`usage_atomic`, `group_columns_pinned`, `forms`, `invites`, `access_log` and
`referrals` can
be rehearsed against it before a merge applies them. That is the staging work the rest of the
plan was always about; it could not start until this was true.

## What this costs, and what it does not fix

Steps 1–4 touch no live system and can be abandoned at any point with nothing
to undo. Step 5 is reversible in the sense that matters: the rows already exist,
only their statements change, and the previous values can be captured first.

It does not fix the habit. Ten migrations reached production without files
because applying SQL from a dashboard is easier than writing one, and nothing
stops that happening again — `rollback.test.ts` watches the workflows, and the
dashboard is not a workflow. A guard for that is worth its own thought and is
not proposed here, because a check that compares the repository against a live
project on every run is a different kind of thing from the tests in this
repository, and it should be argued for on its own.

## Status

| Step | State |
| --- | --- |
| 1 · snapshot production | not started |
| 2 · ten missing migrations into files | not started |
| 3 · reconstruct the eight | not started |
| 4 · diff against the snapshot | not started |
| 5 · `migration repair` | not started |
| 6 · the pending migrations (five as of 18 Sep) | blocked on 1–5 |

Until step 5 is done, **no pull request touching `supabase/` should be merged**.
If Branching is applying migrations, a merge sends the pending ones to a schema
nothing has reproduced; if it is not, the merge widens the gap by one more file.
See [`ROLLBACK.md`](ROLLBACK.md).
