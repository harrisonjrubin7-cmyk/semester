\pset format unaligned
\pset fieldsep '|'
\pset tuples_only on
select 'ROLE', role, global from public.app_roles order by role;
select 'CAP', capability, about from public.app_capabilities order by capability;
select 'RC', role, string_agg(capability, ',' order by capability) from public.role_capabilities group by role order by role;
select 'TABLE', c.relname, c.relrowsecurity,
  (select count(*) from pg_policy p where p.polrelid=c.oid),
  exists(select 1 from pg_attribute a where a.attrelid=c.oid and a.attname='tenant_id' and not a.attisdropped),
  exists(select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='f' and k.confrelid='auth.users'::regclass),
  has_table_privilege('authenticated', c.oid, 'select'),
  has_table_privilege('authenticated', c.oid, 'insert,update,delete') as w
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;
