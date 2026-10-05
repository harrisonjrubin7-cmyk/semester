-- The browser's two roles stop holding the table privileges row-level security does not govern.
--
-- Supabase's default privileges grant every privilege on every new table in `public` to `anon`,
-- `authenticated` and `service_role` (`arwdDxtm`; on Postgres 17 that is INSERT, SELECT, UPDATE,
-- DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN). Row-level security governs the first four. It
-- does not govern the last four:
--
--   * TRUNCATE   empties a table without evaluating a policy;
--   * TRIGGER    lets a role create a trigger on the table;
--   * REFERENCES lets a role create a foreign key to it;
--   * MAINTAIN   (Postgres 17) lets a role VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH and LOCK it.
--
-- PostgREST exposes none of them, and no exploit path was found (`database/GRANT_ALLOWLIST.md` rates
-- it P2). But a privilege nobody uses is a privilege nobody needs. A read-only catalog read of
-- production on 2026-10-04 found `anon` and `authenticated` each holding all four on 25 `public`
-- tables, left from before a migration said `revoke all`, and default privileges that would hand the
-- same four to the next table. This closes both. It touches no INSERT, SELECT, UPDATE or DELETE grant,
-- so no policy-governed access changes; `client-privileges.check.sql` holds that too.
--
-- Not done here, and recorded in `database/GRANT_ALLOWLIST.md`: `anon`'s DML on 32 tables, the
-- `authenticated` table allowlist, and `schools` being readable by `anon`. Each needs a decision.
--
-- `service_role` is deliberately untouched: it bypasses RLS and is held server-side.
--
-- Rollback: a forward migration that grants the four back. Nothing in the app uses them.
--
-- Idempotent, and no `begin` or `commit`, as `docs/developers/HOW-TO-ADD-A-MIGRATION.md` requires.

revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- The default privileges for tables the executing role creates in `public` from here on. Written
-- without `for role`, so it binds the role that applies migrations, which is the one whose defaults
-- the catalog shows (`postgres`, `public`, `r`).
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;

-- MAINTAIN exists from Postgres 17. The local check harness may run an older server, and a revoke of
-- a privilege the server does not know is an error, so it is stated only where it exists.
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;
