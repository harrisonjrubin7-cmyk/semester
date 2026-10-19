# How to add a migration and its check

> **Type:** how-to · **Audience:** contributors · **Owner:** `engineering` · **Truth:** held · **Reviewed:** 2026-10-04 · **Held by:** `app/src/lib/docs/developers.test.ts`

This page is for adding a schema change to `supabase/migrations/` together with the SQL check that walks a second account; stop reading if you only need to run the existing checks, which is step 8 of [`ONBOARDING.md`](ONBOARDING.md).

**Status:** LIVE. The SQL checks run in CI against a throwaway PostgreSQL. They cannot run without a PostgreSQL server of the major version in `supabase/config.toml`.

The README for this directory, [`supabase/README.md`](../../supabase/README.md), says which SQL belongs where. A migration is applied automatically. Anything that writes to `auth.users`, hard-codes a production URL or creates a secret is not a migration.

1. Read the watermark. `supabase/ledger.snapshot` is a dated reading of the live migration ledger. The last version in it is the watermark. A new file must be numbered above it, because `db push` applies pending versions in version order and a pending version below the highest applied one can never run.
2. Name the file `supabase/migrations/<14-digit version>_<name>.sql` with a version above the watermark. No two files may share a version.
3. Write it so it can run twice: `create table if not exists`, `drop policy if exists` before `create policy`, `create or replace`. CI applies the whole set a second time with `SEMESTER_CHECK_REAPPLY=1` and requires identical schema and rows.
4. Do not put `begin;` or `commit;` in the file. The runner opens a transaction per file.
5. For every new table in `public`, write `alter table ... enable row level security` in the migration itself. An event trigger would turn it on anyway, but the test requires the statement to be written.
6. Add or extend a `supabase/<subject>.check.sql` suite. Make synthetic users, walk a second account through what a real pair would do, assert what each may see, and roll back. `check.sh` runs every `*.check.sql` file.
7. A new `security definer` function needs its EXECUTE grant stated; `supabase/grants.check.sql` is an allowlist over the whole schema and `supabase/rls-coverage.check.sql` asks that every definer function pins its search path.
8. If the table holds data a student writes from the client, add it to `OWNED_TABLES` in `app/src/lib/cloud.ts` in the same change so export and deletion stay complete ([`docs/ARCHITECTURE.md`](../ARCHITECTURE.md), invariant 3).
9. Run the JavaScript tests that read the migrations directory, from `app/`.

   ```bash
   npx vitest run src/lib/migrationorder.test.ts src/lib/tablerls.test.ts src/lib/ledgerfiles.test.ts src/lib/migrationhistory.test.ts src/lib/migrationcitations.test.ts
   ```

10. Run the SQL checks, from the repository root, where a server of the right major is installed.

    ```bash
    supabase/check.sh <subject>
    SEMESTER_CHECK_REAPPLY=1 supabase/check.sh
    ```

11. If the change is a policy, permission, retention rule or data flow, fill in the Change advisory section of the pull request. [`ROLLBACK.md`](../../ROLLBACK.md) says the schema cannot go back; ship an additive forward repair instead.

## What fails if you get it wrong

These were followed in a scratch copy on 2026-10-04.

| Mistake | What failed |
| --- | --- |
| A `create table` with no `enable row level security` in the repository | `app/src/lib/tablerls.test.ts`, `has every created table enabling it in the repository, not via ensure_rls`. |
| A new file numbered `20260901000000`, below the watermark | `app/src/lib/migrationorder.test.ts`, `every pending migration is above the watermark`, naming the version. |
| The same file with `enable row level security` added and a version above the watermark | Both tests passed. |

The scratch copy could not run `supabase/check.sh`: the container had PostgreSQL 16 and the script requires 17. The SQL half of this procedure was therefore not exercised, and a table that passes the JavaScript tests can still fail `rls-coverage.check.sql`.
