select json_agg(row_to_json(x) order by schema, tbl) from (
select n.nspname as schema, c.relname as tbl,
 (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as cols,
 (select format_type(a.atttypid,a.atttypmod) from pg_attribute a where a.attrelid=c.oid and a.attname='tenant_id') as tenant_type,
 (select not a.attnotnull from pg_attribute a where a.attrelid=c.oid and a.attname='tenant_id') as tenant_nullable,
 exists(select 1 from pg_constraint k where k.contype='f' and k.conrelid=c.oid and k.confrelid='public.schools'::regclass) as tenant_fk,
 exists(select 1 from pg_constraint k where k.contype='f' and k.conrelid=c.oid and k.confrelid='auth.users'::regclass) as account_fk,
 c.relrowsecurity as rls,
 coalesce(c.reltuples,0)::bigint as est_rows
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','private') and c.relkind in ('r','p')) x;
