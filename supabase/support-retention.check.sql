-- The support retention clock: terminal tickets age out, active work stays,
-- and a legal hold suspends deletion. LOCAL/DISPOSABLE DATABASES ONLY.
--
--   supabase/check.sh support-retention

begin;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.error_as(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlstate || ' ' || sqlerrm;
end $$;

do $$
declare
  school text := 'support-retention-school';
  who uuid := gen_random_uuid();
  tenant_who uuid := gen_random_uuid();
  billing_account uuid := gen_random_uuid();
  contract_id uuid := gen_random_uuid();
  old_resolved uuid := gen_random_uuid();
  old_closed uuid := gen_random_uuid();
  recent_resolved uuid := gen_random_uuid();
  old_open uuid := gen_random_uuid();
  held uuid := gen_random_uuid();
  legacy_unclassified uuid := gen_random_uuid();
  snapshot_ticket uuid;
  hold_id uuid;
  tenant_hold_id uuid;
  operator_id uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains)
  values (school, 'Support Retention School', array['support-retention.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values
    (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'support-retention@example.test', now(), now(), now()),
    (tenant_who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'tenant-support-retention@example.test', now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values
    (who, 'support_retention', null),
    (tenant_who, 'tenant_support_retention', school);

  insert into public.support_tickets
    (id, student_id, tenant_id, retention_classified, category, subject, body, priority, status, created_at, first_response_due, updated_at)
  values
    (old_resolved, who, null, true, 'bug', 'old resolved', 'body', 'normal', 'resolved', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days'),
    (old_closed, who, null, true, 'bug', 'old closed', 'body', 'normal', 'closed', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days'),
    (recent_resolved, who, null, true, 'bug', 'recent resolved', 'body', 'normal', 'resolved', now() - interval '20 days', now() - interval '19 days', now() - interval '179 days'),
    (old_open, who, null, true, 'bug', 'old open', 'body', 'normal', 'open', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days'),
    (held, who, null, true, 'bug', 'held resolved', 'body', 'normal', 'resolved', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days'),
    (legacy_unclassified, who, null, false, 'bug', 'legacy unresolved provenance', 'body', 'normal', 'resolved', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days');

  insert into public.support_ticket_messages (ticket_id, from_side, body)
  values (old_resolved, 'support', 'cascades with the ticket');

  -- An auto-claimed school profile is still individual beta until a signed,
  -- currently effective institutional order form covers the school.
  perform set_config('request.jwt.claims',
    json_build_object('sub', tenant_who::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  snapshot_ticket := public.open_support_ticket(
    'how_to', 'Domain membership', 'This is still an individual-beta ticket.', '{}'::jsonb, false);
  reset role;
  perform pg_temp.must('school-domain membership alone does not create a deployment tenant',
    (select tenant_id from public.support_tickets where id = snapshot_ticket) is null);
  delete from public.support_tickets where id = snapshot_ticket;

  insert into public.billing_accounts (id, kind, name)
  values (billing_account, 'institution', 'Support Retention Institution');
  insert into public.billing_account_tenants (billing_account_id, tenant_id)
  values (billing_account, school);
  insert into public.contracts
    (id, billing_account_id, kind, status, signed_at, effective_at)
  values
    (contract_id, billing_account, 'order_form', 'signed', now(), now() - interval '1 day');

  perform set_config('request.jwt.claims',
    json_build_object('sub', tenant_who::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  snapshot_ticket := public.open_support_ticket(
    'how_to', 'Deployment snapshot', 'Preserve the signed deployment that covered this ticket.', '{}'::jsonb, false);
  reset role;
  perform pg_temp.must('opening a ticket snapshots an effective signed deployment tenant',
    (select tenant_id from public.support_tickets where id = snapshot_ticket) = school);
  update public.support_tickets
     set status = 'resolved', created_at = now() - interval '220 days',
         first_response_due = now() - interval '219 days', updated_at = now() - interval '181 days'
   where id = snapshot_ticket;

  -- Legal-hold triggers prefer auth.uid() over supplied actor ids. Clear the
  -- ticket-opening identity so this service-role fixture keeps distinct named
  -- placers and releasers, as the two-person release constraint requires.
  perform set_config('request.jwt.claims', '{}'::text, true);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('account', who::text, school, 'Preserve this account.', 'SUPPORT-RETENTION-CHECK', operator_id)
  returning id into hold_id;

  perform private.sweep_support_ticket_retention();
  perform pg_temp.must('an account hold preserves every ticket for that account',
    (select count(*) from public.support_tickets where student_id = who) = 6);
  perform pg_temp.must('the same hold blocks direct self-service ticket erasure',
    pg_temp.error_as(who, 'select public.forget_my_support_tickets()')
      like '55006 %active legal hold%');
  perform pg_temp.must('direct erasure refusal leaves every held ticket in place',
    (select count(*) from public.support_tickets where student_id = who) = 6);

  perform set_config('request.jwt.claims', '{}'::text, true);
  update public.legal_holds
     set released_by = gen_random_uuid(), release_reason = 'Test release.'
   where id = hold_id;

  perform private.sweep_support_ticket_retention();

  perform pg_temp.must('old individual-beta resolved and closed tickets are removed',
    not exists (select 1 from public.support_tickets where id in (old_resolved, old_closed, held)));
  perform pg_temp.must('recent resolved and active individual-beta tickets remain',
    exists (select 1 from public.support_tickets where id = recent_resolved)
    and exists (select 1 from public.support_tickets where id = old_open));
  perform pg_temp.must('unclassified legacy tickets are preserved pending evidence review',
    exists (select 1 from public.support_tickets where id = legacy_unclassified));
  perform pg_temp.must('unclassified legacy tickets also block direct deletion pending evidence review',
    pg_temp.error_as(who, 'select public.forget_my_support_tickets()')
      like '55000 %evidence-backed retention classification%');
  perform pg_temp.must('ticket messages cascade when the individual-beta ticket expires',
    not exists (select 1 from public.support_ticket_messages where ticket_id = old_resolved));

  perform set_config('request.jwt.claims', '{}'::text, true);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant', school, school, 'Preserve this tenant.', 'SUPPORT-TENANT-RETENTION-CHECK', operator_id)
  returning id into tenant_hold_id;

  perform set_config('request.jwt.claims',
    json_build_object('sub', tenant_who::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.leave_school();
  reset role;

  perform private.sweep_support_ticket_retention();

  perform pg_temp.must('a tenant hold still preserves tickets after the student leaves the school',
    exists (select 1 from public.support_tickets where id = snapshot_ticket));
  perform pg_temp.must('the ticket keeps the tenant association after membership changes',
    (select tenant_id from public.support_tickets where id = snapshot_ticket) = school);
  perform pg_temp.must('the same tenant hold blocks direct erasure after the student leaves',
    pg_temp.error_as(tenant_who, 'select public.forget_my_support_tickets()')
      like '55006 %active legal hold%');

  perform set_config('request.jwt.claims', '{}'::text, true);
  update public.legal_holds
     set released_by = gen_random_uuid(), release_reason = 'Test release.'
   where id = tenant_hold_id;
  perform private.sweep_support_ticket_retention();

  perform pg_temp.must('signed-deployment tickets await a contract-specific retention rule',
    exists (select 1 from public.support_tickets where id = snapshot_ticket));
  perform pg_temp.must('direct erasure is available after the tenant hold is released',
    pg_temp.error_as(tenant_who, 'select public.forget_my_support_tickets()') is null);
  perform pg_temp.must('direct erasure removes the released tenant ticket',
    not exists (select 1 from public.support_tickets where id = snapshot_ticket));
end $$;

set local role authenticated;
select pg_temp.must('a signed-in client cannot run the retention sweep',
  not has_function_privilege('authenticated', 'private.sweep_support_ticket_retention()', 'EXECUTE'));

rollback;
