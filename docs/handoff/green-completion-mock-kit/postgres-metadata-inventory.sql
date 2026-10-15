-- Metadata-only PostgreSQL query. Execute only against an approved target.
SELECT ns.nspname AS schema_name, cls.relname AS table_name,
 pg_catalog.pg_get_userbyid(cls.relowner) AS database_owner,
 cls.relrowsecurity AS rls_enabled, cls.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class cls JOIN pg_catalog.pg_namespace ns ON ns.oid=cls.relnamespace
WHERE cls.relkind IN ('r','p') AND ns.nspname NOT IN ('pg_catalog','information_schema') ORDER BY 1,2;

SELECT child_ns.nspname AS child_schema, child.relname AS child_table,
 con.conname AS foreign_key, parent_ns.nspname AS parent_schema,
 parent.relname AS parent_table, pg_catalog.pg_get_constraintdef(con.oid) AS definition,
 con.convalidated AS validated
FROM pg_catalog.pg_constraint con
JOIN pg_catalog.pg_class child ON child.oid=con.conrelid
JOIN pg_catalog.pg_namespace child_ns ON child_ns.oid=child.relnamespace
JOIN pg_catalog.pg_class parent ON parent.oid=con.confrelid
JOIN pg_catalog.pg_namespace parent_ns ON parent_ns.oid=parent.relnamespace
WHERE con.contype='f' ORDER BY 1,2,3;
-- This does NOT inventory function/view/application/event dependencies; review separately.
