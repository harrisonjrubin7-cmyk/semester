# Running the check suites against a Supabase branch

`check.sh` runs every `.check.sql` suite against a throwaway local Postgres
with stubbed `auth` and `storage` schemas. Release-certification gate item
**T-2** asks for more than that: the same negative checks against a database
Supabase itself built from the migrations, with the real `auth` schema, the
real roles and the platform's own grants. Production is never that database.
The suites insert accounts into `auth.users`, and production holds real
students.

## Which database

A Supabase preview branch of `lzrqvlugnawcgywkhqlz`. The GitHub integration
builds one for every open, non-draft pull request that touches `supabase/`,
applying that branch's migrations to a fresh database with no production data
(`with_data: false`). Find its `project_ref` with the Supabase MCP tool
`list_branches`, or on the dashboard's **Branches** page, and check its status
reads `FUNCTIONS_DEPLOYED`, not `MIGRATIONS_FAILED`.

Never point this at `lzrqvlugnawcgywkhqlz` itself.

## How

1. Check the branch has the migrations under test: `list_migrations` on the
   branch's `project_ref` against `ls supabase/migrations`.
2. Run each suite as one `execute_sql` call on the branch's `project_ref`,
   whole file, one file per call. Every suite opens `begin;` and ends
   `rollback;`, so nothing it writes survives.
3. A suite passes when the call returns without an error. The `ok` notices
   `check.sh` counts are not returned over this path; a failed assertion is a
   raised exception, which is.
4. Read `get_advisors` (security) on the same branch.
5. Record what ran, when, on which `project_ref`, and what failed, under
   `docs/drills/`, and cite it from T-2 in
   `app/src/lib/governance/certification.ts`.

## What this does not prove

It is not a penetration test, and it checks what the suites assert, not what
nobody thought to assert. A suite that depends on `check.sh`'s local stubs
(its adult-by-default age fixture, for one) fails here for that reason. That
is a difference in environment, not a security failure, and the record should
say which is which.

## Check table defaults locally as well

The disposable harness supports two table-grant profiles:

    supabase/check.sh
    SEMESTER_CHECK_TABLE_GRANTS=explicit supabase/check.sh

The first preserves legacy implicit CRUD grants so migrations still face the
older, more permissive starting point. The second removes those implicit
grants before migrations run, matching the observed postgres-owned table
defaults on this PR's fresh preview. It does not emulate every hosted service
or platform privilege. Both profiles need to pass; a local pass does not
replace the hosted-preview run above.

`explicit-client-grants.check.sql` is a catalog-only regression for the two
confirmed profile/calendar paths. It needs no accounts or age fixture and
runs in a read-only transaction. It preserves profile column pins and checks
that intentionally RPC/server-only tables have no direct client read grant.
It is not a replacement for the feature suites' cross-account RLS checks.

The focused repair in `20261001075450_explicit_profiles_calendar_grants.sql`
adds only authenticated SELECT on profiles and SELECT/INSERT/UPDATE on
calendar_feeds. It does not close T-2: other client-table grants, service-role
callers and whole-suite hosted execution remain unresolved. A permission
change must be reviewed and approved before application to a hosted project.
