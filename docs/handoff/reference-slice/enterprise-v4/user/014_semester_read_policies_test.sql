-- 014_semester_read_policies_test.sql: pgTAP checks for 014. Disposable local database only, after semester_campus_portals.sql + 014.
-- Results not claimed: run it. Synthetic ids.
BEGIN;
SET LOCAL search_path = semester, extensions, public;
SELECT no_plan();
\set T  '11111111-0000-0000-0000-000000000001'
\set T2 '11111111-0000-0000-0000-000000000002'
\set U_MAYA '22222222-0000-0000-0000-000000000001'
\set U_PROF '22222222-0000-0000-0000-000000000002'
\set U_ADV  '22222222-0000-0000-0000-000000000003'
\set U_MOM  '22222222-0000-0000-0000-000000000004'
\set U_SAM  '22222222-0000-0000-0000-000000000005'
\set P_MAYA '33333333-0000-0000-0000-000000000001'
\set P_PROF '33333333-0000-0000-0000-000000000002'
\set P_ADV  '33333333-0000-0000-0000-000000000003'
\set P_MOM  '33333333-0000-0000-0000-000000000004'
\set P_SAM  '33333333-0000-0000-0000-000000000005'
-- Fixture rows (institutions, people, identity_links, memberships, a section, an enrollment, a hold, an advisor assignment,
-- a delegation with items ["holds"], a wallet) are inserted here as the migration owner; omitted for brevity. Sam is a student
-- at tenant T with no relationship to Maya. Tenant T2 has a second student with the same name.

CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE sql AS $$ SELECT set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $$;

SELECT pg_temp.as_user(:'U_MAYA'); SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM student_holds) = 1, 'student sees own hold');
SELECT ok((SELECT count(*) FROM campus_wallets) = 1, 'student sees own wallet');
SELECT ok((SELECT count(*) FROM people WHERE id <> :'P_MAYA') = 0, 'student sees no other people');
SELECT ok((SELECT count(*) FROM audit_events) = 0, 'student sees no audit events');
SELECT throws_ok($$ INSERT INTO student_holds(tenant_id, person_id, hold_code, issuer_team_reference, blocks_registration) VALUES ('11111111-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', 'x', 'x', false) $$, '42501', NULL, 'no direct writes');
RESET ROLE;

SELECT pg_temp.as_user(:'U_PROF'); SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM enrollments) >= 1, 'instructor sees roster enrollments for own section');
SELECT ok((SELECT count(*) FROM student_holds) = 0, 'instructor does not see holds');
SELECT ok((SELECT count(*) FROM campus_wallets) = 0, 'instructor does not see wallets');
RESET ROLE;

SELECT pg_temp.as_user(:'U_ADV'); SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM student_holds WHERE person_id = :'P_MAYA') = 1, 'advisor sees assigned advisee hold');
SELECT ok((SELECT count(*) FROM student_holds WHERE person_id = :'P_SAM') = 0, 'advisor does not see unassigned student');
SELECT ok((SELECT count(*) FROM campus_wallets) = 0, 'advisor does not see wallets');
RESET ROLE;

SELECT pg_temp.as_user(:'U_MOM'); SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM student_holds WHERE person_id = :'P_MAYA') = 1, 'delegate sees delegated item (holds)');
SELECT ok((SELECT count(*) FROM campus_wallets) = 0, 'delegate does not see undelegated item (wallets)');
SELECT ok((SELECT count(*) FROM enrollments) = 0, 'delegate does not see undelegated schedule');
RESET ROLE;

SELECT pg_temp.as_user(:'U_SAM'); SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM student_holds WHERE person_id = :'P_MAYA') = 0, 'peer student sees nothing of another student');
SELECT ok((SELECT count(*) FROM people WHERE tenant_id = :'T2') = 0, 'no cross-tenant visibility');
RESET ROLE;

-- Revocation takes effect immediately (helpers re-read relationships; no stale claims)
UPDATE delegations SET revoked_at = now() WHERE delegate_person_id = :'P_MOM';
SELECT pg_temp.as_user(:'U_MOM'); SET LOCAL ROLE authenticated;
SELECT ok((SELECT count(*) FROM student_holds) = 0, 'revoked delegation stops access in the same session');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
