-- Run in disposable local DB. This is structural coverage + grant-denial coverage,
-- NOT proof of every table's positive/negative row filtering without fixtures.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=extensions,public;
SELECT no_plan();
SELECT ok(c.relrowsecurity,format('%I.%I: RLS enabled',n.nspname,c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('sx','sx_private','sx_personal') AND c.relkind='r';
SELECT ok(NOT has_table_privilege('authenticated',c.oid,'INSERT') AND NOT has_table_privilege('authenticated',c.oid,'UPDATE') AND NOT has_table_privilege('authenticated',c.oid,'DELETE'),format('%I.%I: direct authenticated writes denied',n.nspname,c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('sx','sx_private','sx_personal') AND c.relkind='r';
SELECT ok(NOT has_table_privilege('anon',c.oid,'SELECT') AND NOT has_table_privilege('anon',c.oid,'INSERT') AND NOT has_table_privilege('anon',c.oid,'UPDATE') AND NOT has_table_privilege('anon',c.oid,'DELETE'),format('%I.%I: anon grants absent',n.nspname,c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('sx','sx_private','sx_personal') AND c.relkind='r';
SELECT ok(NOT EXISTS(SELECT 1 FROM pg_policies p WHERE p.schemaname=n.nspname AND p.tablename=c.relname AND p.cmd IN ('INSERT','UPDATE','DELETE','ALL')),format('%I.%I: no direct write policies',n.nspname,c.relname))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('sx','sx_private','sx_personal') AND c.relkind='r';
SELECT * FROM finish();
ROLLBACK;
