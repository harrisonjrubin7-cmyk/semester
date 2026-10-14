-- pgTAP. Run against a staging DB with 100/110/120 applied: pg_prove tests/registrar_invariants.sql
-- Fixed ids keep the fixtures readable. Everything rolls back.
begin; select plan(10);
\set inst '''00000000-0000-0000-0000-000000000001'''
insert into registrar.sections(institution_id,id,term_id,course_version_id,section_code,capacity) values (:inst,'00000000-0000-0000-0000-0000000000a1',gen_random_uuid(),gen_random_uuid(),'01',1);

select lives_ok($$select registrar.enroll('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','K-1','00000000-0000-0000-0000-0000000000f0','p1')$$,'first student gets the last seat');
select throws_ok($$select registrar.enroll('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000a1','K-2','00000000-0000-0000-0000-0000000000f0','p1')$$,'P0001',null,'second student is refused: section full');
select is((select (registrar.enroll('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000a1','K-1','00000000-0000-0000-0000-0000000000f0','p1')).student_career_id),'00000000-0000-0000-0000-0000000000b1'::uuid,'replaying K-1 returns the original enrollment, even though the section is now full');
select is((select enrolled from registrar.sections where id='00000000-0000-0000-0000-0000000000a1'),1,'capacity counter matches enrollments after the replay');
select throws_ok($$update registrar.sections set enrolled = 2 where id='00000000-0000-0000-0000-0000000000a1'$$,'23514',null,'CHECK forbids over-allocation');
select throws_ok($$insert into registrar.registration_overrides(institution_id,academic_context_id,restriction_type,scope,requested_by,approver,valid_until) values ('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'prereq','{}','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f1',now()+interval '1 day')$$,'23514',null,'requester cannot approve their own override');

-- grade chain fixtures: attempt on the K-1 enrollment, a scale, one original decision
insert into registrar.course_attempts(institution_id,id,enrollment_id) select :inst,'00000000-0000-0000-0000-0000000000c1',id from registrar.enrollments where idempotency_key='K-1';
insert into registrar.grade_scale_versions(institution_id,id,codes,effective_from,approval_ref) values (:inst,'00000000-0000-0000-0000-0000000000d1','{"A":4,"B":3}','2026-01-01','POL-1');
insert into registrar.official_grade_decisions(institution_id,id,course_attempt_id,grade_code,grade_scale_version_id,decision_type,effective_at,authority_reference,approval_reference) values (:inst,'00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000c1','B','00000000-0000-0000-0000-0000000000d1','original',now(),'faculty:sec01','APR-1');

select throws_ok($$update registrar.official_grade_decisions set grade_code='A' where id='00000000-0000-0000-0000-0000000000e1'$$,'P0001',null,'posted grades are append-only — no in-place edit');
select throws_ok($$insert into registrar.official_grade_decisions(institution_id,course_attempt_id,grade_code,grade_scale_version_id,decision_type,effective_at,authority_reference,approval_reference) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','A','00000000-0000-0000-0000-0000000000d1','original',now(),'faculty:sec01','APR-2')$$,'23505',null,'a second original grade for the same attempt is refused');
select lives_ok($$insert into registrar.official_grade_decisions(institution_id,course_attempt_id,grade_code,grade_scale_version_id,decision_type,sequence_number,supersedes_decision_id,effective_at,authority_reference,approval_reference,reason_reference) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','A','00000000-0000-0000-0000-0000000000d1','correction',2,'00000000-0000-0000-0000-0000000000e1',now(),'registrar','APR-3','CASE-7')$$,'a correction that supersedes the original, with a reason, is accepted (original kept)');
select throws_ok($$insert into registrar.registration_operations(institution_id,academic_context_id,term_id,operation_type,idempotency_key,request_digest,status,expected_schedule_version,policy_version_id,actor) values ('00000000-0000-0000-0000-000000000001',gen_random_uuid(),gen_random_uuid(),'admin_change','K-9','d','accepted',1,gen_random_uuid(),gen_random_uuid())$$,null,null,'admin change without a reason is refused');
select * from finish(); rollback;
