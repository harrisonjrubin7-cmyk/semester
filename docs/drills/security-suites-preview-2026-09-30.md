# Security suites on a Supabase preview branch, 30 September 2026 (T-2)

Gate item **T-2** asks for the negative checks against a database Supabase
built itself, not only the local harness. The run was made on the preview
branch of draft PR #1028: project `ibprwifagxqvowpanvel`, built by the GitHub
integration from main at c369196 with every migration applied, including
`20260929300000`–`20260929370000`. It holds no production data. Production
(`lzrqvlugnawcgywkhqlz`) was not touched.

Method: `supabase/BRANCH-CHECKS.md`. Each suite ran as one `execute_sql` call,
`begin` … `rollback`, with check.sh's two fixtures (the `auth.users` grant and
the adult-by-default age trigger) added inside the same transaction. A
follow-up read showed the fixture trigger absent afterwards: nothing persisted.

## What ran

| Suite | Result |
|---|---|
| `space-availability` | pass |
| `academic-record` | pass |
| `activity` | pass (10 of 11 blocks; the analytics-arithmetic block was not sent) |
| `access` | fail: `permission denied for table calendar_feeds` (insert as `authenticated`) |
| `admins` | fail: `permission denied for table profiles` (select as `authenticated`) |

The other 89 suites were not run, for the reason below.

## The finding: the migrations do not grant what the app reads

On this preview, `pg_default_acl` for tables created by `postgres` in
`public` grants `anon` and `authenticated` only `Dxtm` (truncate, references,
trigger, maintain), not select, insert, update or delete. Supabase-owned
defaults (`supabase_admin`) still grant `arwdDxtm`, but the migrations run as
`postgres`. So a table gets data-API access only where a migration grants it
explicitly.

237 of 307 public tables have such a grant. **57 have no `SELECT` for
`authenticated` at all**, among them `profiles`, `state`, `notes`, `courses`,
`enrollments`, `groups`, `group_members`, `messages`, `tasks`, `schools`,
`invites`, `referrals`, `connections`, `push_devices`, `calendar_feeds`,
`support_tickets` and `registration_holds`, `registration_requests` and
`registration_completions`. `profiles` has column-level insert and update
grants and no select.

Production is in use and the app reads these tables, so production almost
certainly still carries Supabase's earlier default of `arwdDxtm` for `postgres`
tables. That was not checked here, because production was out of scope. If so,
two things follow:

- These two failures are an environment difference, not a policy defect in
  production today.
- But **the migrations alone do not reproduce a working database.** A restore
  into a new project, a new region, or any new branch would come up with 57
  tables unreadable by signed-in users. `check.sh` and `restore.sh` cannot see
  this, because `local.stub.sql` reinstates the old default before the
  migrations run.

## What this does not prove

It is not a penetration test, and 89 of 94 suites did not run. T-2 stays
**partial**.

## What would close it

1. Confirm production's default privileges, read-only: `select
   pg_get_userbyid(defaclrole), defaclobjtype, defaclacl from pg_default_acl
   where defaclnamespace = 'public'::regnamespace;`
2. Add a migration that grants each table's intended privileges explicitly,
   the way the 237 already do. Then change `local.stub.sql` to model the new
   Supabase default, so `check.sh` fails whenever a table relies on the
   implicit grant.
3. Rebuild this preview (or any branch) and run all 94 suites.
