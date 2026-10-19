-- 018_remaining_access_tests.sql: AC-09, 10, 12, 13 and 16 from your access standard. Disposable local database only, after all
-- migrations. Run as the real runtime roles. Results not claimed.
BEGIN;
SET LOCAL search_path = semester, extensions, public;
SELECT no_plan();

-- AC-09: mixed permissive policies → no unexpected allow. Permissive policies OR together, so list every table with more than one
-- permissive SELECT policy for review; each combination is then exercised by the behavioral tests (014, 017).
SELECT diag(string_agg(tablename || ' (' || n || ' permissive SELECT policies)', ', ')) FROM (
  SELECT tablename, count(*) n FROM pg_policies WHERE schemaname = 'semester' AND cmd IN ('SELECT', 'ALL') AND permissive = 'PERMISSIVE' GROUP BY tablename HAVING count(*) > 1) x;
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'semester' AND (qual IS NULL OR qual = 'true') AND roles @> ARRAY['authenticated']::name[] AND tablename NOT IN ('courses', 'sections', 'dining_locations', 'dining_hours', 'menus')),
  'AC-09: no unconditional (USING true) policy for authenticated outside the public catalog tables');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'semester' AND roles @> ARRAY['anon']::name[]), 'AC-09: no policy grants anything to anon');

-- AC-10: public views and derived exports → no unauthorized rows or columns underneath.
-- Views run with their owner's rights unless security_invoker is set, which bypasses RLS on the base tables.
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'semester' AND c.relkind = 'v'
  AND NOT coalesce((SELECT option_value::boolean FROM pg_options_to_table(c.reloptions) WHERE option_name = 'security_invoker'), false)),
  'AC-10: every semester view is security_invoker (so base-table RLS applies)');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'semester' AND c.relkind = 'm'
  AND has_table_privilege('authenticated', c.oid, 'SELECT')), 'AC-10: no materialized view is readable by clients (they ignore RLS)');

-- AC-12: guessed object paths and stale signed URLs. Storage objects live in private buckets; access goes through signed URLs issued
-- after authorize(). Structural check here; the URL-expiry behavior is an HTTP test in the app suite.
SELECT ok(NOT EXISTS (SELECT 1 FROM storage.buckets WHERE public = true AND id IN ('documents', 'submissions', 'accommodations', 'housing', 'admissions')), 'AC-12: record buckets are private');
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND roles @> ARRAY['anon']::name[]), 'AC-12: no anon storage policy');

-- AC-13: forged claims. RLS helpers read identity_links by auth.uid() only; a forged role claim or user_metadata must not matter.
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000dead', 'role', 'authenticated', 'user_metadata', json_build_object('role', 'registrar', 'tenant_id', '11111111-0000-0000-0000-000000000001'))::text, true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM semester.student_records)::int, 0, 'AC-13: a forged registrar claim in user_metadata reads nothing');
SELECT is((SELECT count(*) FROM semester.my_people())::int, 0, 'AC-13: an unlinked subject resolves to no person');
RESET ROLE;
SELECT ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'semester' AND (qual ILIKE '%user_metadata%' OR qual ILIKE '%auth.jwt()%')), 'AC-13: no policy trusts JWT metadata');

-- AC-16: fresh vs upgraded database → identical grants and policies. Run this query on both and diff the output in CI.
SELECT diag('AC-16 fingerprint: ' || md5(string_agg(x, '|' ORDER BY x))) FROM (
  SELECT 'pol:' || tablename || ':' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') x FROM pg_policies WHERE schemaname = 'semester'
  UNION ALL SELECT 'grant:' || table_name || ':' || grantee || ':' || privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'semester'
  UNION ALL SELECT 'fn:' || p.proname || ':' || p.prosecdef || ':' || coalesce(array_to_string(p.proconfig, ','), '') || ':' || coalesce(array_to_string(p.proacl::text[], ','), '') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'semester') f;
SELECT * FROM finish();
ROLLBACK;
