# Repairing the migration history

The schema this app runs on cannot be rebuilt from its own record.
[`ROLLBACK.md`](ROLLBACK.md) states the finding and why it is a rollback
concern; this is the plan for fixing it, written before any of it was done so
that the reasoning can be argued with rather than discovered in a diff.

**The repair is done.** Steps 1, 2, 4 and 6 were carried out; step 3 turned out
not to be needed and step 5 is withdrawn, both on evidence gathered doing the
others, and each section says why. The only write to production in any of it is
the one a merge makes by deploying the renumbered migrations — nothing here
edited the ledger by hand.

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
fault 2 should have been: `supabase/migrations/20260921003600_function_grants.sql`
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

## Why production's deploy fails, which is now measured

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

#### The one object no file here creates

`public.rls_auto_enable()` and its `ensure_rls` event trigger are what
Supabase's "automatically enable RLS" setting installs. They are in Supabase's
house style rather than this repository's, and the one migration that names
them — `history/20260907134823_…` — only revokes EXECUTE, which is a thing you
do to something that already exists. Step 1's snapshot calls `ensure_rls` "the
project's"; that was wrong, and this corrects it. The definition now sits in
`local.stub.sql` with the rest of what the platform provides, which is both
where it belongs and the whole of why the function fingerprints differed by one
entry.

Putting it there then found something no fingerprint would have.
`grants.check.sql` sweeps every function in `public` and fails on any a client
can reach without being allowlisted, and the moment the stub created
`rls_auto_enable` the way a real project does, it failed:

    ✗ grants.check.sql
        ERROR:  FAILED: a signed-out visitor can call rls_auto_enable()

Production closed that on 7 September, and the statement that closed it lives
in `history/`, which is a record and not a migration — so the revoke lived
nowhere a fresh database would run it. **A rebuild from this directory would
have been less safe than production is**, in exactly one way, and the check
could not see it until the stub was faithful. It is closed now, in
`20260901001500_function_grants.sql`. Production is unchanged and did not need
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

### 6 · Then, and separately, the pending migrations

Out of scope here and worth naming so it is not forgotten. Once production is
reproducible, a preview branch can finally be built that matches it, and
`usage_atomic`, `group_columns_pinned`, `forms` and `access_log` can be
rehearsed against it before a merge applies them. That is the staging work the
rest of the plan was always about; it could not start until this was true.

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
| 6 · the pending files | **done 21 Sep** — seven renumbered above the ledger, rehearsed against production's shape |

Step 6 was the call nobody could make from the evidence alone, and it has been
made: **renumber.** The alternative was applying the files by hand and letting
a fourth version stop matching its filename, which is the fault this whole
document exists about.

It was seven files and not four. `invites`, `referrals` and `function_grants`
have their *content* in production, applied by hand on 21 September, but under
versions the ledger assigned — `20260921002428`, `…2623`, `…2658` — and their
*file* versions were as pending as the other four. Renumbering four would have
left three files that `db push` still refuses, and the deploy still broken.

| was | is | why it moved |
| --- | --- | --- |
| `20260901000900_usage_atomic` | `20260921003000_usage_atomic` | never applied |
| `20260901001000_group_columns_pinned` | `20260921003100_group_columns_pinned` | never applied |
| `20260901001100_forms` | `20260921003200_forms` | never applied |
| `20260901001200_invites` | `20260921003300_invites` | applied under `20260921002428` |
| `20260901001300_access_log` | `20260921003400_access_log` | never applied |
| `20260901001400_referrals` | `20260921003500_referrals` | applied under `20260921002623` |
| `20260901001500_function_grants` | `20260921003600_function_grants` | applied under `20260921002658` |

Relative order is unchanged, so a build from empty applies them in the same
sequence it always did — and the six fingerprints are byte-identical before and
after, which is what says the renumbering moved names and not schema.

Three of the seven will therefore be applied to production a second time. Every
one is idempotent by construction — `create table if not exists`, `create or
replace function`, `drop policy if exists` then create, and revokes guarded by
`to_regprocedure` — and re-applying them replaces the comment-stripped function
bodies of step 4 with this repository's, which closes the one fingerprint that
did not match. The seed in `invites` carries `on conflict (only_one) do
nothing`, so it cannot reset the gate; that was checked rather than read, below.

### Rehearsed, because reading a migration is not running one

[`supabase/rehearse.sh`](supabase/rehearse.sh) builds production's shape from
the snapshot, puts rows in it — the invite gate on, an account, a course —
applies every migration numbered above the ledger's newest, and checks that the
rows did not move.

    · the migrations a deploy would apply, in the order it would apply them
      ✓ 20260921003000_usage_atomic.sql
      ✓ 20260921003100_group_columns_pinned.sql
      ✓ 20260921003200_forms.sql
      ✓ 20260921003300_invites.sql
      ✓ 20260921003400_access_log.sql
      ✓ 20260921003500_referrals.sql
      ✓ 20260921003600_function_grants.sql
    · the pilot's invite gate: t → t
    · one account's courses:   1 → 1

`check.sh` could not have caught a fault here, and that is the point of adding
a second script rather than a case to the first: it builds from empty, where
there is no live state to damage and no earlier migration to collide with. **A
deploy asks a different question, and nothing in this repository had ever asked
it** — which is part of why production's deploy failed on 18 September with
nobody aware.

Two controls, because a rehearsal that always passes proves nothing. A
migration edited to reference a column that does not exist is reported `✗` with
its error. A migration edited to write `invite_only = false` is reported as
`t → f` and **STATE MOVED**. A third control was run first and was a bad one: a
`not null` column added to `forms`, which succeeds against an empty table and
told me nothing until I noticed the table it was added to had no rows in it.

What this cannot prove is that the *ledger* accepts them: Postgres applies a
file whatever it is called, and the refusal that was failing lives in Supabase's
CLI. The filenames are what decide that, and `rollback.test.ts` pins them.

### The freeze

**It lifts with this change, and not before.** The instruction was: no pull
request touching `supabase/` gets merged, because a merge sends pending
migrations to a schema nothing has reproduced, or widens the gap by one more
file. Both halves are now answered — the schema is reproduced and fingerprinted
(step 4), and the pending migrations are rehearsed against it with live state
in place. This pull request is the one that was always going to have to touch
`supabase/` to end it. See [`ROLLBACK.md`](ROLLBACK.md).

What that rule is protecting is `supabase/migrations/`, because that directory
is the only thing a merge can send anywhere. Steps 1 and 2 both landed under
it and neither added a file there: a snapshot and a record are inert, and
`rollback.test.ts` and `migrationhistory.test.ts` are what make that
checkable rather than asserted — each holds a control that goes red when its
file is moved into `migrations/`. A change that adds to `migrations/` is still
the thing to wait on, and the four already sitting there are still not to be
applied.
