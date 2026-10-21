-- 016_structural_tests.sql: structural pgTAP checks for the semester schema (from the interactive ERD PDF, 6 Oct).
-- Isolated test database, after all migrations. These prove structure; behavioral tests (014_semester_read_policies_test.sql)
-- prove the policies work for real runtime identities. A default-deny "everything invisible" result isn't a working authorization.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(8);
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'semester' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity), 'All semester tables enable RLS');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'semester' AND c.relkind IN ('r', 'p') AND NOT c.relforcerowsecurity), 'All semester tables force RLS');
SELECT ok(NOT EXISTS (
  SELECT 1 FROM pg_constraint fk JOIN pg_class child ON child.oid = fk.conrelid JOIN pg_namespace cn ON cn.oid = child.relnamespace
  JOIN pg_class parent ON parent.oid = fk.confrelid JOIN pg_namespace pn ON pn.oid = parent.relnamespace
  WHERE fk.contype = 'f' AND cn.nspname = 'semester' AND pn.nspname = 'semester'
    AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = parent.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped)
    AND NOT EXISTS (SELECT 1 FROM unnest(fk.conkey, fk.confkey) AS k(c, p) JOIN pg_attribute ca ON ca.attrelid = child.oid AND ca.attnum = k.c JOIN pg_attribute pa ON pa.attrelid = parent.oid AND pa.attnum = k.p WHERE ca.attname = 'tenant_id' AND pa.attname = 'tenant_id')
), 'Tenant-owned foreign keys include tenant_id on both sides');
SELECT ok(EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid = 'semester.housing_allocations'::regclass AND c.contype = 'x'), 'Housing allocation exclusion constraint exists');
SELECT ok(EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'semester.audit_events'::regclass AND NOT t.tgisinternal AND t.tgenabled <> 'D'), 'Audit history mutation guard is enabled');
SELECT ok(NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants WHERE table_schema = 'semester' AND grantee = 'PUBLIC'), 'No PUBLIC table grants in semester');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'semester' AND p.prosecdef AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')), 'Every SECURITY DEFINER function pins search_path');
SELECT ok(NOT has_table_privilege('authenticated', 'semester.ferpa_disclosure_records', 'TRUNCATE'), 'authenticated cannot TRUNCATE disclosure records');
SELECT * FROM finish();
ROLLBACK;
