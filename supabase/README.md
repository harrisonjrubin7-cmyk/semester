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

## `*.check.sql` — the tests

`classmates.check.sql`, `groups.check.sql`, `records.check.sql`,
`calendar.check.sql`, `sync.check.sql`.

Each one invents two to five users, proves the row-level policies refuse what
they should refuse, and ends in `rollback;`. They answer the questions a policy
can only be wrong about when a second person is involved — can a stranger read
your room, can one member throw another out — without needing a second person.

**They must never be migrations.** They write to `auth.users`.

### Running them

    supabase/check.sh

That is the whole thing. It initialises a throwaway Postgres in a temporary
directory, applies `local.sql` (the parts of a Supabase project that are not in
this repo — the `auth` schema, `auth.uid()`, the three roles), applies every
migration in order, runs every check, and deletes the cluster. It binds no TCP
port and touches nothing you have running. Needs a Postgres *server* installed,
not just `psql`.

Before it existed the only way to run one was to paste it into a live project's
SQL Editor, against real data, by hand — so they were not run, and two of them
had been failing on their first block since the migration that broke them
landed. A failed block aborts the transaction, so everything after it is
skipped: thirteen of the twenty checks in `records.check.sql` and all
twenty-four in `classmates.check.sql` had never executed. That is the whole
argument for a script.

You can still paste one into the SQL Editor. It is the same file.

## `local.sql` — not deployed anywhere

The furniture a real Supabase project already has and a bare Postgres does not.
Read only by `check.sh`. It is not a reimplementation of Supabase and nothing
should grow in it that the checks do not need.

## `scheduler.sql` — infrastructure, applied once by hand

Extensions (`pg_cron`, `pg_net`), a Vault secret, and the job that calls the
`push` function every fifteen minutes.

**Not a migration, and the reason is specific:** it hard-codes the production
function URL. As a migration it would run on every preview branch too, and each
branch would schedule its own job pointing at *production's* push endpoint. It
also generates a secret, which is not a thing that should happen once per
branch. See DEPLOY.md.

## Deploying

Preview branches and automatic deploys need the GitHub integration pointed at
this repository, with **Working directory** set to `.` — the directory
*containing* `supabase/`, which is the repository root.

Until **Deploy to production** is switched on, migrations are still applied by
hand: SQL Editor → New query → paste a file's contents → Run, in filename
order. SETUP.md walks through it.
