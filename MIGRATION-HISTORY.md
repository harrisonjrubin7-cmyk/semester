# Repairing the migration history

The schema this app runs on cannot be rebuilt from its own record.
[`ROLLBACK.md`](ROLLBACK.md) states the finding and why it is a rollback
concern; this is the plan for fixing it, written before any of it was done so
that the reasoning can be argued with rather than discovered in a diff.

**The repair is done.** Steps 1, 2, 4 and 6 were carried out; step 3 turned
out not to be needed and step 5 is withdrawn, both on evidence gathered doing
the others, and each section says why. Step 6 was the last to close and the
only one that could turn the deploy green: steps 1 to 5 change no version, and
a version is the whole of the fault. **No step wrote to the ledger by hand** —
the only production write in any of it is the one a merge makes by deploying.

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

### 3 · Reconstruct the eight — **not needed, and step 4 is why**

This step asked for the delicate thing: the eight as applied are the snapshot
with the ten's effects backed out, reconstructed rather than read, and the one
place in the plan where a mistake is silent.

**It does not have to be done, because nothing depends on it.** Step 4 asked
the only question the reconstruction was for — does `migrations/` build
production? — and the answer is yes, without backing anything out. The eight
files are not a damaged record of 1 September that needs repairing. They are a
baseline of 15 September that is correct as a baseline, and the arithmetic
step 2 describes is already done: they *are* the eight plus the ten.

So the eight rows keep no statements, deliberately. The only SQL that could go
in them is the baseline, and a ledger carrying the baseline at version
`20260901000100` would assert a history that errors ten times when replayed —
step 2 has those ten errors. **A visibly blank row is better than a plausible
false one**, which is the same rule as the one this repair runs under.

What is genuinely lost is the text of what ran on 1 September, and it is lost
for good: it was never written down, and every later edit to those files
overwrote the evidence. That is worth saying plainly rather than leaving a step
open that nobody can close.

### 4 · Prove the baseline against production — **done, 21 September**

The question: does `migrations/`, minus the four files production has never
had, build production's schema? [`supabase/fingerprint.sql`](supabase/fingerprint.sql)
asks it in six numbers, and it is a file rather than a paragraph because
step 1's proof was quoted and never written down, which is half a proof.

Eleven files — the eight baseline, `invites`, `referrals` and `function_grants`
— applied to a throwaway Postgres over `local.stub.sql`:

| | production | built from `migrations/` |
| --- | --- | --- |
| columns | `928e8832…` | `928e8832…` |
| constraints | `ccf10d63…` | `ccf10d63…` |
| indexes | `cbeb582a…` | `cbeb582a…` |
| functions | `19900364…` | `e6606f22…` |
| code (functions, comments out) | `b3f82ed7…` | `b3f82ed7…` |
| policies | `ed31e933…` | `ed31e933…` |

**Five of six match, and the sixth is comments.** `claim_referral`,
`gen_referral_code`, `make_referral_code` and `only_invited` were applied to
production on 21 September with their comments stripped — 375 characters of
body against this repository's 1060, for `only_invited`. Every statement in
them is identical, and the `code` row is what says so. Two numbers that
disagree tell you the databases differ; only the second tells you *how*, which
is why both are in the file.

Production is not re-run to match. The functions behave identically and
rewriting them for the sake of a hash is the tidying this document forbids.

**The control.** Five matches out of six is also what a probe that cannot see
anything looks like. So the same build was run again with the four files
production does not have added back, and **all six numbers moved** — which
discriminates the probe and, separately, re-confirms object by object that
those four have never reached production.

#### The one object no file here created

`public.rls_auto_enable()` and its `ensure_rls` event trigger turn row-level
security on for every table created in `public` afterwards, and nothing in
`migrations/` created them.

This section first said they are what Supabase's "automatically enable RLS"
setting installs, that step 1's snapshot calling `ensure_rls` "the project's"
was wrong, and that the definition therefore belonged in `local.stub.sql`.
**Step 1 was right and this was wrong.** There is no such setting. Supabase's
documentation has a section headed *Auto-enable RLS for new tables* which says
"if you want RLS enabled automatically for new tables, you can create an event
trigger", and prints this exact function and trigger. Somebody ran the
documented recipe against this project by hand — which accounts for both
observations that pointed the other way: the code reads in Supabase's house
style because it was copied from Supabase's documentation, and the only
migration that mentions it merely revokes EXECUTE because by then it already
existed. It is the same habit as every other hand-applied statement this
document is a record of.

What that cost was measured, not argued. With the stub's copy removed and all
fifteen migrations applied — the shape of a real rebuild or a preview branch,
where `local.stub.sql` is deployed nowhere — `ensure_rls` was **absent**, and
nothing failed and nothing said so: the revoke in `function_grants.sql` skips a
function that is not there rather than erroring on it. A recovered database
would have had no RLS-on-by-default and looked entirely healthy. It is created
by `20260901000100_schema.sql` now, and the same probe finds it present with
EXECUTE closed to `anon`, `authenticated` and PUBLIC.

**Settled by measurement, not by reading.** Two Supabase-built preview
branches on 21 September, each a fresh database the platform created and then
ran the migrations against:

| | `#588`, whose migrations do not create it | this branch, whose do |
| --- | --- | --- |
| event triggers | **6** — all Supabase's own | **7** |
| `ensure_rls` | **absent** | present |
| `rls_auto_enable` | **absent** | present, `prosrc` md5 equal to production's |

Both branches applied all their migrations (`public.forms` exists in each), so
the difference is the migration and nothing else. The platform installs six
event triggers — `issue_graphql_placeholder`, `issue_pg_cron_access`,
`issue_pg_graphql_access`, `issue_pg_net_access`, `pgrst_ddl_watch`,
`pgrst_drop_watch` — and `ensure_rls` is not among them. **Every preview branch
built from `main` today has no RLS-on-by-default**, which is also what a
recovery from this directory would have had.

The argument never rested on winning the provenance question, and that is still
the reason to prefer it: if the platform does install the trigger, `create or
replace` and a guarded `create event trigger` match what is there and change
nothing; if it does not, the rebuild is safe instead of quietly unsafe. There
is no reading under which keeping it out of the migrations is safer.

Putting it in the stub did find something no fingerprint would have, and that
part stands.
`grants.check.sql` sweeps every function in `public` and fails on any a client
can reach without being allowlisted, and the moment the stub created
`rls_auto_enable` the way a real project does, it failed:

    ✗ grants.check.sql
        ERROR:  FAILED: a signed-out visitor can call rls_auto_enable()

Production closed that on 7 September, and the statement that closed it lives
in `history/`, which is a record and not a migration — so the revoke lived
nowhere a fresh database would run it. **A rebuild from this directory would
have been less safe than production is**, in exactly one way, and the check
could not see it until the function was there to sweep. It is closed now, in
`20260901001500_function_grants.sql` — and because the function is created by a
migration rather than by the stub, that revoke now runs on a rebuild instead of
skipping an object that is not there. Production is unchanged and did not need
changing: a sweep of its live grants shows only the three allowlisted functions
reachable, by `authenticated` alone.

The revoke needed both spellings, which is the inverse of the defect that file
was written for. `revoke … from anon, authenticated` left `=X/postgres` behind
— Postgres grants EXECUTE to PUBLIC on every new function — and `anon` still
reached it through PUBLIC. The first fix read correctly and the check stayed
red.

**An empty diff is the acceptance criterion for this whole repair**, and on
everything but four function comments it is met.

### 5 · Record the eight — **withdrawn, on the evidence of steps 2 and 4**

This was to be the one production write in the plan: `migration repair` filling
the eight name-only rows with their statements, once step 4's diff was empty.

The diff is empty and the step should still not happen. The statements it would
write are the baseline, the baseline is a squash of everything through
11 September, and a ledger carrying it at version `20260901000100` asserts a
history that cannot replay. The rows are blank today and a reader can see they
are blank. Filled, they would be wrong and look right.

**So the repair completes with no write to production at all.** Nothing was
applied, nothing was repaired, no row was edited. What changed is that this
repository now holds the SQL production was carrying alone, and a way to ask
whether the two still agree.

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

#### Two sessions renumbered these files an hour apart, and one of them was wrong

This is worth the space, because the way it went wrong is the thing this whole
document is about.

**#587 did the same step, at the same time, and picked different numbers.** It
renumbered the seven to `20260921003000`–`003600`: fresh values chosen to sort
after the newest version its author had read, `20260921002658`. That was a
correct reading when it was taken, and the reasoning built on it was sound.

It was not correct by the time the work merged. The ledger took seven more rows
that afternoon — five from the pending migrations being applied by hand at
14:28–14:40, then `forms_relation_grants` at 14:47 and
`access_log_function_search_path` at 15:07 — and the newest became
`20260921150750`. So all seven renumbered files landed **above the watermark
its author saw and below the real one**, which is precisely the state that
broke the deploy in the first place. The repair reproduced the fault it was
for.

Two things made it invisible. The numbers *look* right: they sort after
everything anybody had written down. And the guard that would have caught it
read the ledger out of two constants in `rollback.test.ts` —
`LEDGER_NEWEST = '20260921002658'`, and a comment saying the ledger held
twenty-one rows. Both were true when typed, and a constant copied out of a
database carries no date and cannot go stale loudly.

**This repair uses the versions the ledger actually recorded instead**, which
has the property that no reading can go stale underneath it: a file whose
version is *in* the ledger is never pending, whatever the watermark does next.
The two sets of names differ in one more way that matters — #587's numbers are
new, so a deploy would apply all seven to production a second time; these are
the recorded ones, so a deploy applies nothing.

Both guards now read `supabase/ledger.snapshot`, one dated reading of every
row, and `migrationorder.test.ts` carries #587's seven numbers as a control
alongside the original seven. A guard that only catches the fault as first seen
is a guard against history.

#### The renamed set still builds production

Renaming changes the order files apply in, so the fingerprint was taken again
afterwards — with step 4's own instrument, `supabase/fingerprint.sql`, rather
than a new one written to flatter the change. All fifteen files over
`local.stub.sql` on a throwaway cluster, against the live project:

| | built from `migrations/` | production |
| --- | --- | --- |
| columns | `2c9112d6…` | `2c9112d6…` |
| constraints | `9ea3a171…` | `9ea3a171…` |
| indexes | `05e7e9e3…` | `05e7e9e3…` |
| functions | `48a6a903…` | `7e98a9ef…` |
| code (comments out) | `1a2b60bc…` | `1a2b60bc…` |
| policies | `a85e79d0…` | `a85e79d0…` |

Five of six, and the sixth is the difference step 4 already named and explained:
functions were applied to production with their comments stripped, so
`pg_get_functiondef` differs while the code with comments removed does not.

This is a stronger reading than step 4's, and not because it is a better
instrument — it is the same one. Step 4 measured eleven files against
production as it stood that morning. This measures fifteen against production
as it stands now, four migrations later, and lands on the same five numbers
with the same single explained exception.

#### The rebuild is now less safe than the thing it rebuilds

The fingerprints above compare columns, constraints, indexes, functions, code
and policies. They do not compare **privileges**, and on one relation the two
differ in a way that matters.

`20260921143455_forms.sql` creates `public.published_forms` and grants SELECT
on it. On Supabase a relation in `public` is created with the default
privileges already applied — `grant all on tables to anon, authenticated,
service_role` — so that line adds SELECT on top of ALL rather than settling
the matter. `published_forms` is auto-updatable and keeps the definer's rights
deliberately, so a write grant on it is a write that runs as the view's owner
and never meets `forms`' owner-only policies. Measured on the live project as
`anon`: `delete from public.published_forms` removed a row, while the same
delete against `forms` was refused.

Production does not have that hole, because it was closed by hand at 14:47 —
which is the ledger row `20260921144711 forms_relation_grants`, and that row
has **no file**. So this is fault 2 in its purest form and pointing the other
way: a rebuild from `migrations/` produces a schema that is correct in every
fingerprint above and *more exposed than production*. Disaster recovery is
what this document exists for, and the recovered database would have been the
unsafe one.

The same applies, less sharply, to `20260921150750
access_log_function_search_path`: `note_access` and `read_feed` were created
without a pinned `search_path`, Supabase's linter said so, and the fix is
another ledger row with no file.

Both are folded into the files they belong to rather than added as new
migrations — the versions above them are already in the ledger, so a deploy
applies nothing either way, and what changes is what a *fresh* build produces.
`grants.check.sql` sweeps every view in `public` for a write grant, and
`rehearse.sh` asks the same after a rehearsed deploy, so neither can come back
quietly.

#### And a third time, four hours later, by the same arithmetic

`20260921003700_lti.sql` arrived with #600 and put `main` red on the guard the
section above installed. It is the same mistake a third time and it deserves
no more blame than the second: `003700` is the obvious next number after
`003600`, it sorts after every version its author had read, and it was a
correct reading when it was taken. The ledger had moved to `20260921150750`
by the time the work merged, which is the paragraph above this one with a
different date on it.

What is different is that it did not reach production and it did not stay
invisible for three days. The guard named it on the merge:

    these are pending and below the watermark 20260921150750,
    so the deploy cannot apply them: 20260921003700

That is the whole return on step 6. The fault used to be a deploy failing in a
dashboard nobody was looking at; it is now a red tick with the offending
version printed in it, four minutes after it landed. #608 renumbered the file
to `20260921160000_lti.sql` and hardened `rehearse.sh`.

#### Five sessions, four fixes, fifteen minutes

This is the part worth the space, and it is not about migrations.

Five sessions reached that red tick inside a quarter of an hour. **Four of
them wrote a rename**, each picking a different number — `160000`, `160413`,
`160500`, `155553` — and a fifth, #615, diagnosed it and deliberately left it
alone. #608 merged; the other three were dropped or rewritten on rebase, one
of them after its author had already run `supabase/check.sh` against it.

The section above this one is titled "two sessions renumbered these files an
hour apart". This is the same shape at ten times the rate, and the cause is
the improvement: the guard that makes the fault visible makes it visible to
*everyone at once*, and nothing coordinates who takes it. That is a good trade
and it is still a cost, and it is worth writing down rather than tidying away
— a repository whose guards are this good will keep paying it.

What made the duplication cheap rather than expensive was `CLAUDE.md`'s first
rule working as intended: every one of those sessions checked `main` before
pushing, found the landed fix, and stood down. The convergence is the failure;
the checking is what keeps it from being a merge conflict.

#### And the half nobody could see

The rename was fixed four times over. The four citations *inside* the file
were fixed by none of them, because nothing can see a wrong filename in a
comment.

`20260921160000_lti.sql` cited `20260921003500_referrals.sql` and
`20260921003600_function_grants.sql`, at four sites, and neither name has ever
resolved. #600 wrote that prose against the numbers #587 proposed, which #588
had already replaced with `…002623` and `…144011` — so the same branch-cut
that stranded the migration below the watermark left it pointing at two files
that were never on disk. The same mistake twice in one file: once in a number
a deploy reads, which broke CI in four minutes, and once in a number only a
person reads, which survived four independent fixes of the first half.

Found by #580 while duplicating the rename, and fixed in #621 **with the guard
that closes it** — `lib/migrationcitations.test.ts` reads everything under
`supabase/` and requires every migration filename cited in it to name a file
that exists, in `migrations/` or in `history/`. That is the part this document
could not have supplied: an account of a recurrence is not a guard against it.

This document is deliberately outside that scan, and should stay outside it.
Its job is to discuss the names those seven files had *before* #588; its
dangling citations are correct as history and would have to be excepted, and
an exception list is a thing somebody later widens.

**The habit the whole sequence suggests**, which is the only part a guard
cannot enforce: the number to pick is not "one after the last file in the
directory", it is a clock reading taken when the rename is made, checked
against the last line of `supabase/ledger.snapshot`. Those two agree by
construction and the first only agrees by luck — which is exactly how four
sessions picked four different numbers and #600 picked a wrong one.

#### What it still does not do

**Nothing here flips the status.** The branch record reads what the last deploy
left, and the last deploy was 18 September. It changes when a merge to `main`
runs the deploy again — and that merge is the test of this change, because no
preview branch can rehearse it: a preview starts empty and never consults
production's ledger, which is the whole mechanism at issue. The reading to check
afterwards is the `main` branch record: `MIGRATIONS_FAILED` stamped
`2026-09-18T17:37` before, and a fresh timestamp reaching `FUNCTIONS_DEPLOYED`
after.

### The test was run, and it came back negative

Several merges landed on 21 September after the renumbering. Every one of them
took the `main` branch record to `CREATING_PROJECT` and then back to
`MIGRATIONS_FAILED`. The renumbering did not fix the deploy.

It is worth being exact about what that does and does not mean, because the
renumbering was correct and this is a *second* fault standing behind the first.
The deploy never reached the point of ordering anything. From the project's
`workflow_run_logs`, at 17:30, 17:33, 17:37 twice, 17:42 and 17:44:

    INFO  Cloning git repo... git_ref=main
    INFO  Checking service health... project_ref=lzrqvlugnawcgywkhqlz
    INFO  Skipping configuration for protected branch...
    INFO  Connecting to database...
    ERROR Remote migration versions not found in local migrations directory.

That is not about versions being in the past. `db push` first requires that
**every row already in the ledger has a file in `supabase/migrations/`**, and
thirteen do not:

| rows | where the SQL lives |
| --- | --- |
| the ten of fault 2, `push_devices_and_queue` … `groups` | `supabase/history/` |
| `20260921002658 revoke_function_execute_from_supabase_default_roles` | nowhere |
| `20260921144711 forms_relation_grants` | nowhere |
| `20260921150750 access_log_function_search_path` | nowhere |

**Step 2 put those ten in `history/` on purpose, and that is the thing blocking
the deploy.** Its reasoning holds: the eight baseline files are a squash of
everything through 11 September, so the baseline already contains those ten
migrations' effects, and a file for each in `migrations/` would apply them a
second time on any build from empty. So the two requirements are in direct
conflict —

  * a build from empty must **not** have those files, or it applies them twice;
  * a deploy to production must **have** them, or it refuses to start.

Nothing in this document had noticed that, and `rehearse.sh` says plainly in
its own header that it cannot: *"This script cannot see the ledger."* It
rehearses the SQL, and this fault is not in the SQL.

The last two rows are this repository's own doing and are newer than the plan:
applying the pending migrations by hand closed a live hole and, in closing it,
added two more ledger rows with no file. Their content is folded into
`20260921143455_forms.sql` and `20260921143653_access_log.sql`, so nothing is
lost from a build — but the rows are in the ledger and the deploy counts them.

### The fix: a stub per row, holding the version and nothing else

Three shapes were available. `supabase migration repair` would mark the
thirteen applied, which is a write to the ledger and the thing step 5 was
withdrawn over — worse here than there, because the repair that removes the
complaint is `--status reverted`, and that *deletes the record of what
production ran*. A squashed baseline carrying the ledger's newest version does
not help either: the other twenty-seven rows still have no file. What is left
is the third, and on inspection it is not a compromise but the only statement
that is actually true of both sides.

**`migrations/` now holds a file for every row in the ledger, and thirteen of
them contain no SQL.** Each says, in its own header, what ran, when, where its
statements are recorded, and why they are not repeated in it.

That works because the two requirements were never in conflict about *files* —
only about *statements*:

  * A **deploy** needs the version to exist and reads nothing else. All thirteen
    versions are already in the ledger, so `db push` finds the file, skips it,
    and goes on to the pending migrations. The stub is never executed against
    production.
  * A **build from empty** needs each effect exactly once, and gets it from the
    baseline. The stub runs and does nothing.

Measured rather than argued, with `supabase/fingerprint.sql` — step 4's own
instrument — over two throwaway clusters built from `local.stub.sql` and every
file in `migrations/`, one with the thirteen applied and one with them skipped:

| | with the stubs | without them |
| --- | --- | --- |
| columns | `059a98b5…` | `059a98b5…` |
| constraints | `7476e44a…` | `7476e44a…` |
| indexes | `14ba0a25…` | `14ba0a25…` |
| functions | `ffc6d1b1…` | `ffc6d1b1…` |
| code | `405e2986…` | `405e2986…` |
| policies | `eb520788…` | `eb520788…` |

Six of six identical. The stubs are inert, which is the whole claim.

**Nothing was written to production.** The ledger is untouched; the thirteen
rows still say what they always said. What changed is that the repository now
admits they exist.

### What guards it

`ledgerfiles.test.ts` was written as a ratchet — the rows without files had to
be among the thirteen known — because at the time the thirteen were not a
mistake to delete. With the stubs the count is zero, so it asserts zero, which
is the stronger statement and the one worth keeping: **a migration that reaches
production without a file here is a broken deploy**, and that is as true of the
next one as of these.

`migrationhistory.test.ts` kept the recovered ten out of `migrations/` by
filename, which was the right question until `migrations/` gained a stub under
each of those names. It asks about **content** now — no file in `migrations/`
may be byte-identical to a history record — which is what the filename check
was standing in for, and it gained the other half: every recorded version must
still have its stub, because deleting one puts the deploy straight back to
`Remote migration versions not found in local migrations directory`.

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
| 3 · reconstruct the eight | **not needed** — the baseline builds production, so there is nothing to back out |
| 4 · prove the baseline against production | **done 21 Sep** — five of six fingerprints match, the sixth is comments |
| 5 · `migration repair` | **withdrawn** — it would write a history that cannot replay |
| 6 · the pending migrations | **done 21 Sep** — content applied by hand, seven files renumbered to the versions it recorded |

Step 6 closed last and by a route this plan did not propose. It assumed the
four pending files would be applied *by* the deploy, once the deploy worked.
They were applied by hand instead, on 21 September, and once that had
happened the only thing between the deploy and green was seven filenames.

The rule that **no pull request touching `supabase/` should be merged** is
**lifted**, and [`ROLLBACK.md`](ROLLBACK.md) records the same thing at more
length. It stood while a merge could send an unrehearsed migration to a schema
nothing had reproduced. Both halves are answered: step 4 reproduces the schema
and fingerprints it, `supabase/rehearse.sh` runs the pending set against that
reproduction on every pull request, and after step 6 nothing in `migrations/`
is pending at all.

What replaces it is narrower and permanent, and is the one thing three days of
this cost buys: **a migration whose version is not in the live ledger, and not
greater than every version the ledger holds, cannot be deployed — whatever its
SQL says.** `check.sh` and `rehearse.sh` both apply files in filename order to
a database that has never seen them, so neither can see that fault.
`supabase/ledger.snapshot` and the two guards over it are what can.

What that rule is protecting is `supabase/migrations/`, because that directory
is the only thing a merge can send anywhere. Steps 1 and 2 both landed under
it and neither added a file there: a snapshot and a record are inert, and
`rollback.test.ts` and `migrationhistory.test.ts` are what make that
checkable rather than asserted — each holds a control that goes red when its
file is moved into `migrations/`. A change that adds to `migrations/` is still
the thing to wait on, and the four already sitting there are still not to be
applied.
