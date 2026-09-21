# Repairing the migration history

The schema this app runs on cannot be rebuilt from its own record.
[`ROLLBACK.md`](ROLLBACK.md) states the finding and why it is a rollback
concern; this is the plan for fixing it, written before any of it was done so
that the reasoning can be argued with rather than discovered in a diff.

**Steps 1, 2 and 6 are done — see their own sections. Steps 3 to 5 are still
proposals, step 2 changed what step 3 has to be, and step 6 jumped the queue
because the four pending migrations were applied to production by hand on
21 September, leaving seven filenames as the only thing between the deploy and
green.**

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
management API. The repository had never described the database it deploys to.

Step 2 closed that on 21 September: all ten are now in
[`supabase/history/`](supabase/history/), byte-for-byte. They are a record
rather than a migration set, and the step says why.

Three more records arrived on 21 September and are *not* in this count, because
each has a file — under a different version. Item 3 explains why, and item 4
explains the third. A version that does not match its filename is a different
fault from a migration with no file at all, and counting them together hides
both.

**3 · Four files have never been applied**, and it was six until 21 September.
`usage_atomic`, `group_columns_pinned`, `forms` and `access_log` are in
`supabase/migrations/` and absent from production — verified object by object,
not inferred from the history.

*Closed the same day, and not by this plan.* All four were applied by hand
between 14:28 and 14:40 UTC on 21 September, and `function_grants` was run a
second time behind them. Step 6 has the ledger rows, the verification against
the live catalogs, and what it did and did not fix. The paragraphs below are
kept as the statement of what was wrong, because the shape of it — a version
the ledger chose rather than the one on disk — is the fault that survived.

`invites` and `referrals` were applied by hand on 21 September, which is the
first time anything in this directory reached the database since the audit.
They are recorded as `20260921002428` and `20260921002623` — **today's
timestamps, not their filenames**, because the management API assigns its own
version and the ledger was not edited afterwards to match. `ROLLBACK.md` says
why: never write to production to make a record tidy. So the two names are in
the ledger and the two versions are not the ones on disk, and that is the
truthful state rather than a tidy one.

A third record, `20260921002658`
`revoke_function_execute_from_supabase_default_roles`, has no file behind it
and is the subject of item 4 below. Two of them matter for the pilot: the atomic AI
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

**4 · One migration exists only in production, and it is three days old.**
`20260921002658 revoke_function_execute_from_supabase_default_roles` was
applied by hand on 21 September, immediately after `invites`, because applying
`invites` opened a live hole: `set_invite_only(boolean)` landed with `anon=X`
and `authenticated=X`, so anybody holding the publishable key that ships in the
browser could have turned the pilot's invite gate on or off.

The cause is a gap this repository did not know it had. Every migration here
writes `revoke all on function … from public`, which is the correct spelling
as far as it goes — `invites.check.sql` exists partly to prove that revoking
from `anon` and `authenticated` *by name* leaves the inherited PUBLIC grant
intact. But Supabase's `pg_default_acl` for schema `public`, objtype `f`,
grants EXECUTE to those roles **explicitly** on every function as it is
created, and a revoke aimed at PUBLIC does not touch an explicit grant. Both
spellings are needed. `check.sh` granted tables and never functions, so the
suite was green on a hole that was open.

This is fault 2 happening again in miniature, and it is being closed the way
fault 2 should have been: `supabase/migrations/20260921144011_function_grants.sql`
is the file, `local.stub.sql` now sets the same default privileges Supabase
does so the harness can see the hole, and `grants.check.sql` is an allowlist
over the whole schema so the next function cannot ship reachable quietly.

Two things are deliberately left alone. **Production is not re-run to match the
file.** The hand-applied statement already closed every function that exists
there, and re-running it for the sake of the ledger is the tidying this
document's own rule forbids. And the file revokes two functions —
`note_access` and `read_feed` from `access_log` — that production does not
have, so every revoke in it is guarded by `to_regprocedure`: it is safe to run
early, and running it again after `access_log` finally lands is what closes
those two.

## Why production's deploy fails, which is now measured — and is fixed in step 6

Settled 21 September, from three facts that fit together:

1. **A preview branch built from this repository succeeds.** PR #545 got one,
   and it applied exactly the thirteen files in `supabase/migrations/` — the
   eight shared ones and then `usage_atomic`, `group_columns_pinned`, `forms`,
   `invites` and `access_log` — reaching `FUNCTIONS_DEPLOYED`.
2. **Production's deploy fails.** Its branch record has read
   `MIGRATIONS_FAILED` since `2026-09-18T17:37`, three minutes after the merge
   carrying `access_log`.
3. **The two databases are not the same schema.** The preview branch has
   thirteen migrations, all from files. Production has twenty-one, thirteen of
   which have no file. They share eight and diverge after that.

The cause is structural. The four files production lacks are numbered
`20260901000900` through `20260901001300`, and the two applied by hand were
recorded at `2026092100…`. Either way production has thirteen migrations
applied with numbers *higher* than the unapplied files, from `20260907050718`
onward. Migrations run in timestamp order, so every file version in that range
is in the past relative to what is already applied — the four that production
lacks, and the two whose SQL it has under a version of its own. Supabase's
documentation names exactly this: "Using the Dashboard's SQL editor or Table
Editor on your remote database bypasses the migration history, and `db push`
will start failing with sync errors."

**This diagnosis held, and it was one file short of complete.** It counts the
four production lacks and the two applied by hand; `function_grants` was in the
same position and is not named here, so the true count of stranded files was
**seven**, not six. Step 6 renames all seven to the versions the ledger records,
which empties the pending set and is what the fix turned out to be.

**Three things follow, and they change the plan below rather than decorate it.**

- **A preview branch does not rehearse production.** It rehearses the
  repository. That was the whole premise of the staging work, and it is not
  true until the two describe one database. A green preview branch says nothing
  about what a merge will do.
- **And it has no Edge Functions**, which is a second reason, independent of
  the schema and still true after the repair. The same build warned: "Only
  Functions declared in config.toml will be automatically deployed to
  branches." `config.toml` declares none, deliberately — its own header says a
  `[functions]` block would give one function two deploy paths that can
  disagree about which version is live, and `functions.yml` is the one path.
  So a preview branch has no `claude`, `push`, `fetchcal` or `calendar`. The
  metering `usage_atomic` exists to make race-safe is reached through the
  `claude` function, and the function is not there to reach it with. Rehearsing
  that particular migration wants either a `[functions]` block accepted as a
  second deploy path, or a test that drives the SQL directly.
- **Step 6 cannot be "apply the four".** They cannot apply as numbered: they
  need timestamps ahead of `20260921002658`. Renumbering files that are already
  merged is its own decision, because a version is what the ledger keys on.
- **The deploy being broken is, for now, the thing stopping a bad apply.** No
  merge can push those four at production while the step that pushes them is
  failing. That is not safety, it is a stuck valve, and fixing the history is
  what lets it open onto something correct.

## The rule this repair runs under

> **Read before write, and never write to production to make a record tidy.**

The temptation is to "fix" fault 1 by running the repo's `schema.sql` against
production so the history matches. That would attempt to create tables that
already hold real data. Every step below either reads production or writes
files in this repository. The only production write in the whole plan is step 5,
it is to the history table alone, and it is the last thing that happens.

## The steps

### 1 · Capture what production actually is — **done, 21 September**

[`supabase/schema.snapshot.sql`](supabase/schema.snapshot.sql). 23 tables, 67
constraints, 44 indexes, 17 functions, 41 policies, 11 triggers and one event
trigger, read out of the live catalogs.

`pg_dump` was not available: this session reaches the project through the
management API and has no database connection, so the DDL was generated by
querying `pg_catalog` and `information_schema` and then transcribed. **That is
a step that can go wrong silently**, so it was proved rather than trusted — the
file is applied to a throwaway cluster and the same fingerprint queries are run
against it and against production:

| | production | replayed snapshot |
| --- | --- | --- |
| md5 of every column, type and nullability | `9d8c08dc…` | `9d8c08dc…` |
| md5 of every constraint definition | `d434135b…` | `d434135b…` |
| md5 of every policy, command and expression | `33680d66…` | `33680d66…` |

Two things the control caught that reading alone had not:

- **Alphabetical order does not replay.** `private.group_in_my_class` calls
  `private.in_class`, and a SQL-language function is parsed when created, so the
  first draft failed with `function private.in_class(text, text) does not
  exist`. The functions are ordered by dependency and the file says so.
- **An event trigger was missing.** Production has seven; six belong to Supabase
  and one, `ensure_rls`, is this project's and is what makes RLS-on-by-default
  true. A schema rebuilt without it would have been quietly less safe than the
  original, and no count of tables or policies would have shown it.

Two harmless oddities are recorded rather than tidied, because both are
evidence of the same migration having been applied twice: `public.courses`
carries two identical touch triggers (`courses_touch` and `touch_courses`), and
`calendar_feeds.token` has both a unique constraint and a separate unique index.

What it does not contain: data, roles, extensions, the schemas Supabase owns,
and the `supabase_migrations` table itself.

### 2 · Write the ten missing migrations into files — **done, 21 September**

[`supabase/history/`](supabase/history/), with
[`MANIFEST`](supabase/history/MANIFEST) and its own README. Their SQL is in the
history table and is complete, so each is a file under its own version number,
byte-for-byte as recorded — no editing, no tidying, no merging two into one.
The point is that the file and the row agree, and any improvement breaks that.

This is the ten from fault 2 only. The three records from 21 September already
have files and need no new ones: what is wrong with them is the version, and a
version is what step 5 exists to correct. Writing a second copy of `invites`
under today's timestamp would make the ledger tidy and the directory a liar.

**Proved rather than trusted.** Transcribing 29,325 bytes out of a query result
is a step that can go wrong silently, so the database reported an md5 per row
before anything was copied, the bytes came across base64-encoded in chunks each
carrying its own md5, and a file was written only once every chunk matched and
the assembled file matched the row. Two chunks did come across wrong — both
inside long runs of the `─` characters the comments are ruled with, miscounted
repetitions — and were named by chunk number rather than discovered as a wrong
file. `app/src/lib/migrationhistory.test.ts` re-checks the fingerprints on
every run.

**They are not in `migrations/`, and that is the finding.** The plan said they
would be. The third of them fails outright there:
`20260907134823_harden_security_definer_helpers.sql` runs `alter function
public.verified_student() set schema private`, and
`20260901000200_classmates.sql` now *creates* those helpers in `private`
already. Every one of the ten is likewise folded into the eight base files —
`push_devices` into `push.sql`, `blocks_blocked` into `classmates.sql`, the
`vanderbilt/` prefix into `classmates_schools.sql`, `deleted_at` into
`records.sql`, `calendar_feeds` into `calendar.sql`, `group_tasks` into
`groups.sql`. So until step 3 is done there is no order in which twenty-five
files replay, and putting them in `migrations/` would turn CI red and break
every preview branch for nothing. They sit beside the snapshot instead, as a
record, and step 3 is what earns them a move.

### 3 · Reconstruct the eight name-only migrations

The delicate step, and the only one where a mistake is silent.

The repository's own `schema.sql`, `classmates.sql` and the rest were taken here
to be presumably what was run. **Step 2 disproved that**, and it is the reason
this step got harder rather than easier: those files contain the content of
migrations applied *after* them, so they are not a record of what ran at all.
They are a statement of the current intended schema, edited continuously, which
is why replaying the fifteen produces roughly the right database and why the
directory has never been a history.

So the eight cannot be recovered by reading the repository. What ran was never
written down, and the only evidence left is arithmetic: production's schema is
the eight plus the ten, and the ten are now known exactly. The eight as applied
are therefore the snapshot with the ten's effects backed out — which is a
reconstruction, not a reading, and the one place in this plan where a mistake
is silent.

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
directory. After steps 2 and 3 it will be applying twenty-five files instead of
fifteen, and the suites must still pass.

One of the twenty-five cannot be applied there at all.
`20260907133756_push_scheduler_extensions.sql` installs `pg_cron` and `pg_net`.
`local.stub.sql` stands in for the roles, schemas and default privileges
Supabase provides because all of those are SQL; an extension is not, and needs
a control file in the server's share directory. That file wants a named skip
carrying a control that refuses to fire when the extension *is* available —
a skip nobody can check is how a harness starts reporting green for work it
did not do.

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

### 6 · Then, and separately, the pending migrations — **done, 21 September**

Out of scope when this was written, and the only step that was ever going to
turn the deploy green. Steps 1 to 5 change no version, and a version is the
whole of the fault.

#### What happened, in the order it happened

Two things, by two different hands, within twenty minutes of each other.

**The content went in.** Between 14:28 and 14:40 UTC on 21 September the four
unapplied files were applied to production, and `function_grants` was run a
second time now that `access_log` existed. Five new ledger rows:

| version | name |
| --- | --- |
| `20260921142822` | `usage_atomic` |
| `20260921142841` | `group_columns_pinned` |
| `20260921143455` | `forms` |
| `20260921143653` | `access_log` |
| `20260921144011` | `function_grants_rerun_after_access_log` |

Verified against the live catalogs rather than taken from the ledger:
`access_log`, `forms` and `form_responses` are real tables, `note_access` and
`count_call` are real functions, and the schema is twenty-six tables against
twenty-three that morning.

**The deploy stayed broken anyway**, and this is the part worth understanding.
Applying SQL by hand does not tell `db push` anything. It reads the ledger,
takes every local version the ledger lacks, and runs them **in version order**.
Seven files here were numbered `20260901000900`–`20260901001500`, all below a
watermark that had stood at `20260911151826` since 11 September. Every one was
pending; every one was in the past. Not four — **seven**, because `invites`,
`referrals` and `function_grants` were in the same position, their content
applied on 21 September under versions of the ledger's own choosing.

#### The fix, and why it is a rename rather than a write

Each of the seven files is renamed to the version production recorded its
content under:

| was | is now |
| --- | --- |
| `20260901000900_usage_atomic.sql` | `20260921142822_usage_atomic.sql` |
| `20260901001000_group_columns_pinned.sql` | `20260921142841_group_columns_pinned.sql` |
| `20260901001100_forms.sql` | `20260921143455_forms.sql` |
| `20260901001200_invites.sql` | `20260921002428_invites.sql` |
| `20260901001300_access_log.sql` | `20260921143653_access_log.sql` |
| `20260901001400_referrals.sql` | `20260921002623_referrals.sql` |
| `20260901001500_function_grants.sql` | `20260921144011_function_grants.sql` |

Pending is now empty, so the step that has been failing has nothing to do.

The alternative was `supabase migration repair --status applied` on the seven
old versions, which would have left every filename alone. It is rejected on
this document's own rule: it writes seven rows to production asserting that
versions ran which never ran, **to make a record tidy**. The rename keeps every
change inside the repository and, for the first time, makes every filename in
`migrations/` equal the version the ledger holds — which is fault 3, cured
rather than described.

**`function_grants` had two rows to choose between** and the choice is not
cosmetic. Production ran that file twice: `20260921002658` before `access_log`
existed, and `20260921144011` after. Its revokes on `note_access` and
`read_feed` are guarded by `to_regprocedure`, so on the first run they are
no-ops. Taking the earlier version would have sorted the file before
`access_log` and left both functions reachable by `anon` and `authenticated` in
any database rebuilt from this directory — measured on a throwaway cluster
rather than reasoned about:

```
file ordered before access_log:  note_access  anon=X/postgres authenticated=X/postgres …
file ordered after  access_log:  note_access  postgres=X/postgres service_role=X/postgres
```

So `20260921144011`, which is also where the file's own comment says it belongs.
`20260921002658` keeps no file, and is the one ledger row in the project with
none; it is the same file's first run.

#### What the rename costs, stated rather than buried

Twenty-seven references across nineteen files, all updated — except in
`ROLLBACK.md` and in the fault list above, where the old numbers are load-bearing
history: they are what those files *were called* when the deploy broke on
18 September, and renaming them there would make the account of the failure
untrue. `security.test.ts` caught the one link left dangling.

Two things this does not reach. The ledger rows' own SQL carries comments
naming the old filenames — `-- Repo file: supabase/migrations/20260901001400_referrals.sql`
— and those are production's bytes, which this plan does not rewrite to match a
rename. And the rows are not byte-identical to the files in any case: they were
applied with comments stripped, 6,092 bytes against the file's 17,934 for
`referrals`. #577 measured what that does and does not mean — every statement
identical, only the comments gone.

#### The guard

`app/src/lib/migrationorder.test.ts`, against `supabase/ledger.snapshot`, a
dated reading of the live ledger. It holds the one rule that matters — **no
pending version below the watermark** — and it is deliberately not "nothing is
pending", which was the first version of it and went red for a newly added
migration, the one thing the rule permits. It also pins that each renamed file
sits on the row its own content was recorded as, by name, because a version
that exists but belongs to different content would satisfy everything else and
be a silent lie.

Mutation-checked four ways: one file back on its old number goes red, a new
migration above the watermark stays green, a truncated snapshot goes red rather
than reporting all clear, and a file moved onto another file's row goes red
naming both.

#### What it still does not do

**Nothing here flips the status.** The branch record reads what the last deploy
left, and the last deploy was 18 September. It changes when a merge to `main`
runs the deploy again — and that merge is the test of this change, because no
preview branch can rehearse it: a preview starts empty and never consults
production's ledger, which is the whole mechanism at issue. The reading to check
afterwards is the `main` branch record: `MIGRATIONS_FAILED` stamped
`2026-09-18T17:37` before, and a fresh timestamp reaching `FUNCTIONS_DEPLOYED`
after.

## What this costs, and what it does not fix

Steps 1–4 touch no live system and can be abandoned at any point with nothing
to undo. Step 5 is reversible in the sense that matters: the rows already exist,
only their statements change, and the previous values can be captured first.

It does not fix the habit. Ten migrations reached production without files, and
three more under versions that are not their filenames', because applying SQL
from a dashboard is easier than writing one, and nothing
stops that happening again — `rollback.test.ts` watches the workflows, and the
dashboard is not a workflow. A guard for that is worth its own thought and is
not proposed here, because a check that compares the repository against a live
project on every run is a different kind of thing from the tests in this
repository, and it should be argued for on its own.

## Status

| Step | State |
| --- | --- |
| 1 · snapshot production | **done 21 Sep** — verified by three matching fingerprints |
| 2 · ten missing migrations into files | **done 21 Sep** — fingerprint-checked |
| 3 · reconstruct the eight | not started — and harder than written: see the step |
| 4 · diff against the snapshot | not started |
| 5 · `migration repair` | not started, and see step 6 for why it is no longer on the path |
| 6 · the pending migrations | **done 21 Sep** — content applied by hand, seven files renumbered to the versions it recorded |

Step 6 is done and steps 3 to 5 are not, which is the opposite of the order this
plan assumed. That is because it assumed the four would be applied *by* the
deploy, and they were applied by hand instead; once that had happened, the only
thing between the deploy and green was seven filenames.

The rule that **no pull request touching `supabase/` should be merged** stood
while a merge could send an unrehearsed migration to production. It cannot any
more: nothing in `migrations/` is pending. It still stands for any change that
**adds** a migration, which is pending by definition, until step 4 gives the
preview branch something that rehearses production.
If Branching is applying migrations, a merge sends the pending ones to a schema
nothing has reproduced; if it is not, the merge widens the gap by one more file.
See [`ROLLBACK.md`](ROLLBACK.md).

What that rule is protecting is `supabase/migrations/`, because that directory
is the only thing a merge can send anywhere. Steps 1 and 2 both landed under
it and neither added a file there: a snapshot and a record are inert, and
`rollback.test.ts` and `migrationhistory.test.ts` are what make that
checkable rather than asserted — each holds a control that goes red when its
file is moved into `migrations/`. A change that adds to `migrations/` is still
the thing to wait on, and the four already sitting there are still not to be
applied.
