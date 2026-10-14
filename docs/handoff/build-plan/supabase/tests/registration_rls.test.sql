-- Registration-readiness slice: allow/deny tests. Requires 001…, 060_bespoke_core.sql, student_tasks_policies.sql
-- (for is_active_member) and registration_policies.sql. Run: supabase test db
begin;
select plan(10);

-- tenants, accounts: S1 student, S2 student, R registrar, A advisor (S1 in caseload), X student at other tenant
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-000000000001','s1@vu.test'),('00000000-0000-0000-0000-000000000002','s2@vu.test'),
 ('00000000-0000-0000-0000-000000000003','reg@vu.test'),('00000000-0000-0000-0000-000000000004','adv@vu.test'),
 ('00000000-0000-0000-0000-000000000009','x@other.test');
insert into semester_core.tenants (id) values ('a0000000-0000-0000-0000-000000000001'),('b0000000-0000-0000-0000-000000000002');
insert into semester_core.accounts (id) select id from auth.users where email like '%.test';
insert into semester_core.memberships (id, tenant_id, owner_account_id, role_key) values
 ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','student'),
 ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','student'),
 ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','registrar'),
 ('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','advisor'),
 ('c0000000-0000-0000-0000-000000000009','b0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000009','student');
insert into semester_core.students (id, tenant_id, account_id) values
 ('51000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('52000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'),
 ('59000000-0000-0000-0000-000000000009','b0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000009');
insert into semester_core.grants (tenant_id, membership_id, capability_key, scope_type, scope_id) values
 ('a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003','registrar.readiness.read','tenant',null),
 ('a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000004','advisor.caseload.read','record','51000000-0000-0000-0000-000000000001');
insert into semester_core.holds (tenant_id, student_id, hold_type, owning_office, placed_at, source_ref, observed_at) values
 ('a0000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001','advising','Advising',now(),'SIS:H1',now()),
 ('a0000000-0000-0000-0000-000000000001','52000000-0000-0000-0000-000000000002','bursar','Bursar',now(),'SIS:H2',now()),
 ('b0000000-0000-0000-0000-000000000002','59000000-0000-0000-0000-000000000009','bursar','Bursar',now(),'SIS:H9',now());

set local role authenticated;
-- S1
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*) from semester_core.holds)::int, 1, 'student sees only own hold');
select is((select source_ref from semester_core.holds), 'SIS:H1', 'and it is the right one');
select throws_ok($$ insert into semester_core.registration_requests (tenant_id, student_id, section_id, term_code, action, requested_by_account_id, idempotency_key, payload_hash)
  values ('a0000000-0000-0000-0000-000000000001','51000000-0000-0000-0000-000000000001',gen_random_uuid(),'2027SP','add','00000000-0000-0000-0000-000000000001','k','h') $$,
  '42501', null, 'students cannot insert registration requests directly (must go through the command function)');
select throws_ok($$ update semester_core.holds set status='released' $$, '42501', null, 'students cannot release holds');
-- S2
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from semester_core.holds where student_id = '51000000-0000-0000-0000-000000000001')::int, 0, 'classmate cannot see S1 hold');
-- registrar
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*) from semester_core.holds)::int, 2, 'registrar sees all holds in own tenant');
select is((select count(*) from semester_core.holds where tenant_id = 'b0000000-0000-0000-0000-000000000002')::int, 0, 'registrar sees nothing at another tenant');
-- advisor
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from semester_core.holds)::int, 1, 'advisor sees only caseload student');
-- revoke the advisor grant (as owner), then re-check
reset role;
update semester_core.grants set revoked_at = now() where membership_id = 'c0000000-0000-0000-0000-000000000004';
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from semester_core.holds)::int, 0, 'revoked grant takes effect immediately');
-- other tenant student
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000009","role":"authenticated"}';
select is((select count(*) from semester_core.holds where tenant_id = 'a0000000-0000-0000-0000-000000000001')::int, 0, 'cross-tenant student sees nothing');

select * from finish();
rollback;
