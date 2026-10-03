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

do $$
declare
  school text := 'support-retention-school';
  who uuid := gen_random_uuid();
  old_resolved uuid := gen_random_uuid();
  old_closed uuid := gen_random_uuid();
  recent_resolved uuid := gen_random_uuid();
  old_open uuid := gen_random_uuid();
  held uuid := gen_random_uuid();
  hold_id uuid;
  operator_id uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains)
  values (school, 'Support Retention School', array['support-retention.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'support-retention@example.test', now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, 'support_retention', school);

  insert into public.support_tickets
    (id, student_id, category, subject, body, priority, status, created_at, first_response_due, updated_at)
  values
    (old_resolved, who, 'bug', 'old resolved', 'body', 'normal', 'resolved', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days'),
    (old_closed, who, 'bug', 'old closed', 'body', 'normal', 'closed', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days'),
    (recent_resolved, who, 'bug', 'recent resolved', 'body', 'normal', 'resolved', now() - interval '20 days', now() - interval '19 days', now() - interval '179 days'),
    (old_open, who, 'bug', 'old open', 'body', 'normal', 'open', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days'),
    (held, who, 'bug', 'held resolved', 'body', 'normal', 'resolved', now() - interval '220 days', now() - interval '219 days', now() - interval '181 days');

  insert into public.support_ticket_messages (ticket_id, from_side, body)
  values (old_resolved, 'support', 'cascades with the ticket');

  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('account', who::text, school, 'Preserve this account.', 'SUPPORT-RETENTION-CHECK', operator_id)
  returning id into hold_id;

  perform private.sweep_support_ticket_retention();
  perform pg_temp.must('an account hold preserves every ticket for that account',
    (select count(*) from public.support_tickets where student_id = who) = 5);

  update public.legal_holds
     set released_by = gen_random_uuid(), release_reason = 'Test release.'
   where id = hold_id;
  perform private.sweep_support_ticket_retention();

  perform pg_temp.must('old resolved and closed tickets are removed',
    not exists (select 1 from public.support_tickets where id in (old_resolved, old_closed, held)));
  perform pg_temp.must('recent resolved and active tickets remain',
    exists (select 1 from public.support_tickets where id = recent_resolved)
    and exists (select 1 from public.support_tickets where id = old_open));
  perform pg_temp.must('ticket messages cascade when the ticket expires',
    not exists (select 1 from public.support_ticket_messages where ticket_id = old_resolved));
end $$;

set local role authenticated;
select pg_temp.must('a signed-in client cannot run the retention sweep',
  not has_function_privilege('authenticated', 'private.sweep_support_ticket_retention()', 'EXECUTE'));

rollback;
