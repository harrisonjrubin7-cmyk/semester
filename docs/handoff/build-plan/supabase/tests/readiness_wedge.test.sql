-- Readiness wedge: state machine + evaluate function tests. Requires 001…, 060, 065, the two policy files and the
-- live_integration migration (for live_outbox). Run: supabase test db
begin;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1','d1@vu.test');
insert into semester_core.tenants (id) values ('d0000000-0000-0000-0000-000000000001');
insert into semester_core.accounts (id) values ('00000000-0000-0000-0000-0000000000d1');
insert into semester_core.memberships (id, tenant_id, owner_account_id, role_key) values ('dd000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1','student');
insert into semester_core.students (id, tenant_id, account_id) values ('d5000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1');
insert into semester_core.time_tickets (tenant_id, student_id, term_code, opens_at, source_ref, observed_at) values ('d0000000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000001','2027SP', now() + interval '20 days', 'SIS:TT1', now());
insert into semester_core.holds (tenant_id, student_id, hold_type, owning_office, placed_at, source_ref, observed_at) values ('d0000000-0000-0000-0000-000000000001','d5000000-0000-0000-0000-000000000001','advising','Advising',now(),'SIS:H1',now());

-- evaluate (as service role)
select is((semester_core.readiness_evaluate('d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1','d5000000-0000-0000-0000-000000000001','2027SP','{}',1,gen_random_uuid())).status, 'completed', 'evaluation completes');
select is((select state::text from semester_core.readiness_cases), 'blocked', 'active hold -> blocked');
select is((select assigned_office from semester_core.readiness_cases), 'Advising', 'blocked case names the owning office');
select ok((select statement from semester_core.readiness_receipts) ilike '%not enrollment%', 'receipt says it is not enrollment');

-- idempotent
select semester_core.readiness_evaluate('d0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d1','d5000000-0000-0000-0000-000000000001','2027SP','{}',1,gen_random_uuid());
select is((select count(*) from semester_core.readiness_cases)::int, 1, 'duplicate command returns existing case, no second row');
select is((select count(*) from semester_core.audit_events where event_type = 'readiness.evaluated')::int, 1, 'one audit event, not two');

-- state machine
select throws_ok($$ update semester_core.readiness_cases set state = 'resolved', resolved_at = now() $$, '23514', null, 'blocked -> resolved is illegal');
select lives_ok($$ update semester_core.readiness_cases set state = 'needs_review' $$, 'blocked -> needs_review is legal');
select throws_ok($$ update semester_core.readiness_cases set state = 'ready', source_freshness_state = 'stale' $$, '23514', null, 'ready with stale source is rejected by check constraint');

select * from finish();
rollback;
