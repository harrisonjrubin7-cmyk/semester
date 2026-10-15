-- Run after applying in a scratch/staging project. Every row should be rls=true, forced=true.
select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='semester_core' and c.relkind='r' order by 1;
-- Expect 227 rows:
select count(*) from pg_tables where schemaname='semester_core';
