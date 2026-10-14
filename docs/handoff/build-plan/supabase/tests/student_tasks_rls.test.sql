-- Real allow/deny tests for semester_core.student_tasks (the starter PDF's tests were ok(true) placeholders).
-- Run with: supabase test db   (needs pgTAP; proposed-schema/*.sql and policies/student_tasks_policies.sql applied)
begin;
select plan(9);

-- fixtures (as postgres)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test.edu'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test.edu'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@other.edu');
insert into semester_core.tenants (id) values ('10000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000002');
insert into semester_core.accounts (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into semester_core.memberships (tenant_id, owner_account_id, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'active'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c1', 'active');
insert into semester_core.student_tasks (id, tenant_id, owner_account_id) values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1');

-- act as student A
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*) from semester_core.student_tasks)::int, 1, 'A sees own task');
select lives_ok($$ insert into semester_core.student_tasks (tenant_id, owner_account_id) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1') $$, 'A can create own task');
select throws_ok($$ insert into semester_core.student_tasks (tenant_id, owner_account_id) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b1') $$, '42501', null, 'A cannot create a task owned by B');
select throws_ok($$ insert into semester_core.student_tasks (tenant_id, owner_account_id) values ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'A cannot write into a tenant without membership');
select is((select count(*) from semester_core.student_tasks where id = '30000000-0000-0000-0000-0000000000a1' and deleted_at is null)::int, 1, 'baseline before delete attempt');
delete from semester_core.student_tasks where id = '30000000-0000-0000-0000-0000000000a1';
select is((select count(*) from semester_core.student_tasks where id = '30000000-0000-0000-0000-0000000000a1')::int, 1, 'hard delete is a no-op (no delete policy)');

-- act as student B, same tenant
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select is((select count(*) from semester_core.student_tasks where owner_account_id = '00000000-0000-0000-0000-0000000000a1')::int, 0, 'B cannot read A''s tasks');

-- act as C, other tenant
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select is((select count(*) from semester_core.student_tasks)::int, 0, 'cross-tenant read denied');

-- anon
set local role anon;
select throws_ok($$ select * from semester_core.student_tasks $$, '42501', null, 'anon has no access');

select * from finish();
rollback;
