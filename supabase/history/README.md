# The migrations that existed only in production

Step 2 of [`MIGRATION-HISTORY.md`](../../MIGRATION-HISTORY.md). Ten migrations
were applied to the live project through the dashboard or the management API
and never had a file here, so the repository had never described the database
it deploys to. These are those ten, read out of
`supabase_migrations.schema_migrations` on 21 September 2026 and written to
disk byte-for-byte.

**They are a record, not a migration set.** Nothing applies this directory:
not `supabase/check.sh`, not Branching, not `db push`. Read the next section
before moving any of it into `migrations/`.

## Why they are not in `migrations/`

The plan said they would be. Putting them there does not work, and finding out
why is the useful part of doing it.

Applied in filename order after the fifteen files in `migrations/`, the third
of them fails outright:

```
20260907134823_harden_security_definer_helpers.sql:31:
  ERROR: function public.verified_student() does not exist
```

The statement is `alter function public.verified_student() set schema
private`. It cannot run because `20260901000200_classmates.sql` — which ran
a year of dashboard edits ago — now *creates* those helpers in `private`
already, with the `(select auth.uid())` hoist and the split policies that
`20260907141019` and `20260907141324` introduced.

That is not one stale file. Every one of the ten is already folded into the
eight base files: `push_devices` into `push.sql`, `blocks_blocked` into
`classmates.sql`, the `vanderbilt/` prefix into `classmates_schools.sql`,
`deleted_at` into `records.sql`, `calendar_feeds` into `calendar.sql`,
`group_tasks` into `groups.sql`.

So the finding is larger than the one the plan was written around.
`MIGRATION-HISTORY.md` said the eight name-only migrations are *presumably*
what the repository's own files ran. They are provably not: those files have
been edited continuously to absorb every later migration, which is why
replaying the fifteen produces roughly the right schema and why the directory
has never been a history. Until step 3 reconstructs the eight as they were
actually applied, there is no order in which twenty-five files replay, and
adding these ten to `migrations/` would turn CI red and break every preview
branch for nothing.

## The fourteenth file is a different shape

The ten above, and the three added on 21 September, are all the same case: a
ledger row whose version has no real SQL in `migrations/`. A stand-in sits
there so `db push` can see the version, and the statements live here.

`20260921144011_function_grants_rerun_after_access_log.sql` is not that.
`migrations/20260921144011_function_grants.sql` is a real migration, 8,088
bytes of it, and it is **not the text the ledger holds at that version**. The
row is 2,050 bytes and one statement: the second time production ran that
file, after `access_log` existed, which is the run that closed `note_access`
and `read_feed`. A directory cannot hold two files at one version, so the
repository's own migration stays in `migrations/` and the row's text is here.

**Why this one was invisible.** `ledgerfiles.test.ts` asks whether every
version the database already ran has a file in `migrations/`. At this version
it always did, so the check passed the whole time — it is not a question about
what the file says. That is the right scope for it; the gap was that nothing
else was asking the second question either. `migrationhistory.test.ts` now
asserts this case by name, so a second version acquiring two texts is a test
somebody has to edit rather than a thing nobody sees.

## How they were proved

Transcribing 29,325 bytes out of a query result is a step that can go wrong
silently, so it was not trusted. The database reported an md5 per row before
anything was copied; the bytes came across base64-encoded in chunks, each with
its own md5; and a file was only written once every chunk matched and the
assembled file matched the row. [`MANIFEST`](MANIFEST) holds those
fingerprints and `app/src/lib/migrationhistory.test.ts` re-checks them on
every run.

The guard earned itself twice. Two chunks of
`20260907141019_rls_initplan_and_policy_overlap.sql` came across wrong, both
inside long runs of the `─` rule characters its comments are ruled with —
miscounted repetitions, which is exactly the error a whole-file comparison
would have caught only after the fact and a careful read would not have caught
at all. Collapsing the runs before transfer and expanding them locally removed
the failure mode rather than re-rolling the dice on it.

## One thing step 4 will hit

`20260907133756_push_scheduler_extensions.sql` installs `pg_cron` and `pg_net`.
`local.stub.sql` stands in for the roles, schemas and default privileges
Supabase provides, because those are SQL; an extension is not, and needs a
control file in the server's share directory. When step 4 replays a repaired
file set on a bare cluster, this file is the one that cannot be applied there —
and skipping it silently is not an option, so it will want a named skip with a
control that refuses to fire when the extension is actually available.
