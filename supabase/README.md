# The database, and what runs it

Three kinds of SQL live here, and the difference between them is the whole
reason this file exists. Putting the wrong one in `migrations/` is how you
create test users on production or point a preview branch's cron job at the
live deployment.

## `migrations/` — the schema, applied automatically

Every table, policy, function and index the app depends on, in dependency
order:

| | |
|---|---|
| `…0100_schema.sql` | accounts and cross-device sync: `state`, `courses`, `usage` |
| `…0200_classmates.sql` | the `private` schema, verified students, rooms, messages |
| `…0300_classmates_schools.sql` | widens a room key to `school/CODE` |
| `…0400_rooms.sql` | reactions and presence on a message |
| `…0500_groups.sql` | group work: groups, members, parts |
| `…0600_push.sql` | the reminder queue and the devices it sends to |
| `…0700_records.sql` | per-record sync with soft deletes |
| `…0800_calendar.sql` | the published `.ics` feed |

Every one is idempotent — `create … if not exists`, `drop policy if exists`,
`create or replace` — so running the set twice is a no-op. That is not
politeness: a migration that only works on an empty database cannot be used to
repair a database that is half set up, which is exactly the state anything
real is in when you need it most.

**The order is a dependency order, not a history.** The timestamps put them in
the sequence they have to run in; they are not the dates anything happened.

Nothing in here may contain a `begin;`/`commit;` of its own. The runner opens a
transaction per file, and a `commit` inside one ends *its* transaction and
leaves the rest of the file running unprotected.

## `*.check.sql` — the tests, run by hand

`classmates.check.sql`, `groups.check.sql`, `records.check.sql`,
`calendar.check.sql`, `sync.check.sql`.

Each one invents two to four users, proves the row-level policies refuse what
they should refuse, and ends in `rollback;`. They answer the questions a policy
can only be wrong about when a second person is involved — can a stranger read
your room, can one member throw another out — without needing a second person.

**They must never be migrations.** They write to `auth.users`. Run one by
opening the SQL Editor and pasting its contents.

## `scheduler.sql` — infrastructure, applied once by hand

Extensions (`pg_cron`, `pg_net`), a Vault secret, and the job that calls the
`push` function every fifteen minutes.

**Not a migration, and the reason is specific:** it hard-codes the production
function URL. As a migration it would run on every preview branch too, and each
branch would schedule its own job pointing at *production's* push endpoint. It
also generates a secret, which is not a thing that should happen once per
branch. See DEPLOY.md.

## Running the checks, without a project

Each suite needs an empty database, for the reason its own header gives: the
counts are wrong wherever real rows already exist, and the live project has
enrolments in the very rooms `classmates.check.sql` counts. `local.stub.sql`
stands in for what the platform supplies, so a bare Postgres will do and
nothing live is touched.

    supabase/check.sh              # all five
    supabase/check.sh groups       # or just one

which is the sequence below with the failures reported rather than left in the
log. It drops and rebuilds the database every run, so a suite that somehow left
rows behind cannot quietly change the next run's answer, and it exits non-zero
on a failure with the database kept for you to look at.

By hand, which is worth reading once because the order matters:

    createdb semester_check
    psql -1 -v ON_ERROR_STOP=1 -d semester_check -f supabase/local.stub.sql
    for f in supabase/migrations/*.sql; do
      psql -1 -v ON_ERROR_STOP=1 -d semester_check -f "$f" || break
    done
    psql -d semester_check <<'SQL'
      grant usage on schema auth, public to anon, authenticated;
      grant select, insert on auth.users to anon, authenticated;
      grant all on all tables in schema public to anon, authenticated;
    SQL
    psql -v ON_ERROR_STOP=1 -d semester_check -f supabase/classmates.check.sql

All five suites pass this way, and each rolls itself back. The grants come
last because they are `on all tables` and there are no tables until the
migrations have run; Supabase applies the equivalent as default privileges,
which is why nothing in `migrations/` grants them itself.

It is also how you find out whether the migrations still build the schema from
nothing, which is the one thing a project that already has the schema cannot
tell you.

## Deploying

Preview branches and automatic deploys need the GitHub integration pointed at
this repository, with **Working directory** set to `.` — the directory
*containing* `supabase/`, which is the repository root.

**How to tell whether it is actually connected**, which is worth knowing
because the failure is silent: open any pull request that changes a file under
`supabase/`. A working integration builds a preview branch and says so. A
misconfigured one comments that there are *no changes detected* in a directory
it then names — and the name it prints is the configured working directory, so
that comment is the setting read back to you. A path that is not a path means
the field holds something that is not one.

Until **Deploy to production** is switched on, migrations are still applied by
hand: SQL Editor → New query → paste a file's contents → Run, in filename
order. SETUP.md walks through it.
