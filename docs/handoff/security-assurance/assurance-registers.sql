-- Semester security assurance: generate RLS-COVERAGE-REGISTER and SECURITY-DEFINER-REGISTER from the live catalog.
-- Read-only. Run as a database owner in STAGING first. Export each result to CSV under docs/assurance/.
-- Not run by Claude; review before use.

-- 1. RLS coverage for every table exposed through the API schemas
select n.nspname as schema, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced,
       coalesce(string_agg(distinct p.cmd, ',' order by p.cmd), '') as policy_cmds,
       count(p.polname) as policy_count,
       has_table_privilege('anon', c.oid, 'select') as anon_can_select,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
       has_table_privilege('authenticated', c.oid, 'insert,update,delete') as authenticated_can_write
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policies p on p.schemaname = n.nspname and p.tablename = c.relname
where c.relkind in ('r','p') and n.nspname in ('public')
group by 1,2,3,4,c.oid
order by rls_enabled, anon_can_select desc, 2;

-- 2. SECURITY DEFINER register
select n.nspname as schema, p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as args,
       r.rolname as owner,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ';'), '') as config, -- expect search_path=...
       has_function_privilege('public', p.oid, 'execute') as public_can_execute,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where p.prosecdef and n.nspname not in ('pg_catalog','information_schema','extensions','graphql','storage','auth','realtime','vault')
order by public_can_execute desc, anon_can_execute desc, 2;

-- 3. Public storage buckets (should be intentional)
select id, name, public from storage.buckets order by public desc, name;
