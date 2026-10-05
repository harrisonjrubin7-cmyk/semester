-- A read-only mirror of the four Supabase advisor lints this repository
-- reconciles against (D-1026), so a before and an after can be taken on any
-- database, production included, without the dashboard.
--
--   0008 rls_enabled_no_policy                        -> no_policy_tables
--   0029 authenticated_security_definer_function_executable -> definer_executable
--   0001 unindexed_foreign_keys                       -> unindexed_foreign_keys
--   0004 no_primary_key                               -> no_primary_key
--
-- Plus the fact that makes the first one benign: how many of those tables a
-- client role holds any privilege on. It should be 0.
--
-- It only reads the catalogue. Run it with `psql -f supabase/advisor-probe.sql`
-- or paste it into the SQL editor. Its counts are held to the advisor's own on
-- production (49, 180, 4, 2 on 30 September 2026) in
-- docs/ADVISOR-RECONCILIATION-2026-09-30.md: a probe that disagrees with the
-- advisor on the day it was written is the probe's fault, not the database's.

with own_schemas as (
  select n.oid, n.nspname
    from pg_namespace n
   where n.nspname !~ '^pg_'
     and n.nspname not in ('information_schema', 'auth', 'storage', 'realtime', 'extensions', 'graphql',
                           'graphql_public', 'vault', 'pgsodium', 'pgsodium_masks', 'supabase_functions',
                           'supabase_migrations', 'net', 'pgbouncer', 'cron', '_realtime', '_analytics')
),
own_tables as (
  select c.oid, s.nspname, c.relname, c.relrowsecurity
    from pg_class c
    join own_schemas s on s.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and not c.relispartition
     and not exists (select 1 from pg_depend d where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'e')
),
no_policy as (
  select t.* from own_tables t
   where t.relrowsecurity and not exists (select 1 from pg_policy p where p.polrelid = t.oid)
),
definer as (
  select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
     and has_function_privilege('authenticated', p.oid, 'execute')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e')
),
fk_uncovered as (
  select c.conrelid::regclass::text as tbl, c.conname
    from pg_constraint c
    join own_tables t on t.oid = c.conrelid
   where c.contype = 'f'
     and not exists (
       select 1 from pg_index x
        where x.indrelid = c.conrelid
          and (x.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
),
keyless as (
  select t.* from own_tables t
   where not exists (select 1 from pg_index x where x.indrelid = t.oid and x.indisprimary)
)
select 'no_policy_tables' as lint, count(*)::int as n,
       string_agg(nspname || '.' || relname, ', ' order by nspname, relname) as names from no_policy
union all
select 'no_policy_tables_a_client_can_touch', count(*)::int,
       string_agg(nspname || '.' || relname, ', ' order by nspname, relname)
  from no_policy
 where has_table_privilege('anon', oid, 'select,insert,update,delete,truncate,references,trigger')
    or has_table_privilege('authenticated', oid, 'select,insert,update,delete,truncate,references,trigger')
    or has_any_column_privilege('anon', oid, 'select,insert,update,references')
    or has_any_column_privilege('authenticated', oid, 'select,insert,update,references')
union all
select 'definer_executable', count(*)::int, null from definer
union all
select 'definer_executable_by_anon_or_public', count(*)::int, string_agg(proname, ', ' order by proname)
  from definer d
 where has_function_privilege('anon', d.oid, 'execute')
union all
select 'unindexed_foreign_keys', count(*)::int, string_agg(tbl || '(' || conname || ')', ', ' order by tbl) from fk_uncovered
union all
select 'no_primary_key', count(*)::int, string_agg(nspname || '.' || relname, ', ' order by nspname, relname) from keyless
order by 1;
