-- Support questions are operational records, not permanent profiles.
-- Resolved and student-closed tickets are retained for 180 days after their
-- last activity, then removed with their messages and notification intents.
-- An active account, tenant or platform legal hold always wins.

-- A tenant hold protects the record, not merely the student's current profile.
-- Keep the ticket's tenant at creation time so leaving a school cannot detach
-- an existing ticket from a hold that still covers it. The value deliberately
-- has no school foreign key: retained evidence must survive tenant offboarding.
alter table public.support_tickets
  add column if not exists tenant_id text;

-- Serialize the one-time snapshot with membership changes. Once this update
-- completes, the ticket carries its own durable tenant association.
lock table public.profiles in share mode;
update public.support_tickets t
   set tenant_id = p.school_id
  from public.profiles p
 where p.user_id = t.student_id
   and t.tenant_id is null
   and p.school_id is not null;

comment on column public.support_tickets.tenant_id is
  'Tenant associated with the ticket when it was opened; retained after membership changes so tenant legal holds continue to cover the record.';

-- Re-state the only client entry point so every new ticket snapshots the
-- caller's current tenant. Staff-facing reads still omit both account and
-- tenant identity.
create or replace function public.open_support_ticket(
  want_category text, want_subject text, want_body text, want_context jsonb,
  want_email_notice boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  made uuid;
  who uuid := (select auth.uid());
  ticket_tenant text;
begin
  if who is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('support_ticket:' || who::text, 0));
  if (select count(*) from public.support_tickets t
       where t.student_id = who and t.created_at > now() - interval '1 day') >= 5 then
    raise exception 'five questions a day is the limit; reply on an open one instead'
      using errcode = 'check_violation';
  end if;
  select p.school_id into ticket_tenant
    from public.profiles p where p.user_id = who;
  insert into public.support_tickets
    (student_id, tenant_id, category, subject, body, context, priority,
     first_response_due, email_notice_enabled)
  values (
    who, ticket_tenant, want_category, want_subject, want_body,
    coalesce(want_context, '{}'::jsonb),
    case when want_category in ('accessibility', 'privacy') then 'high' else 'normal' end,
    now() + make_interval(hours => private.support_first_response_hours(want_category)),
    coalesce(want_email_notice, false)
  ) returning id into made;
  return made;
end $$;

revoke all on function public.open_support_ticket(text, text, text, jsonb, boolean) from public, anon;
grant execute on function public.open_support_ticket(text, text, text, jsonb, boolean) to authenticated;

create or replace function private.sweep_support_ticket_retention()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare removed integer;
begin
  -- Serialize the hold decision with every placement or release. INSERT and
  -- UPDATE take ROW EXCLUSIVE on legal_holds, which conflicts with SHARE, so
  -- no hold can become active between this check and the DELETE below.
  lock table public.legal_holds in share mode;
  delete from public.support_tickets t
   where t.status in ('resolved', 'closed')
     and t.updated_at < now() - interval '180 days'
     and not private.account_is_held(t.student_id)
     and not (t.tenant_id is not null and private.tenant_is_held(t.tenant_id));
  get diagnostics removed = row_count;
  return jsonb_build_object('support_tickets', removed);
end $$;

revoke all on function private.sweep_support_ticket_retention() from public, anon, authenticated;
grant execute on function private.sweep_support_ticket_retention() to service_role;

comment on function private.sweep_support_ticket_retention() is
  'Deletes resolved or closed support tickets after 180 days unless an active legal hold applies; messages and notification intents cascade.';

-- A direct self-service deletion is still a deletion and therefore must obey
-- the same hold as the scheduled sweep. Account erasure already checks holds,
-- but this narrower RPC is independently callable by authenticated users.
create or replace function public.forget_my_support_tickets()
returns void language plpgsql security definer set search_path = '' as $$
declare who uuid := (select auth.uid());
begin
  if who is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  -- Hold placement and release write legal_holds and therefore wait for this
  -- transaction. Recheck only after taking the lock, then keep it through the
  -- deletion so a new hold cannot slip into the check/delete boundary.
  lock table public.legal_holds in share mode;
  if private.account_is_held(who)
     or exists (
       select 1 from public.support_tickets t
        where t.student_id = who
          and t.tenant_id is not null
          and private.tenant_is_held(t.tenant_id)
     ) then
    raise exception 'support tickets are preserved by an active legal hold'
      using errcode = 'insufficient_privilege';
  end if;
  delete from public.support_tickets where student_id = who;
end $$;

revoke all on function public.forget_my_support_tickets() from public, anon;
grant execute on function public.forget_my_support_tickets() to authenticated;

comment on function public.forget_my_support_tickets() is
  'Deletes the caller''s support tickets unless an account, tenant or platform legal hold requires preservation.';

-- scheduler.sql remains the complete infrastructure source. This one
-- credential-free job is also installed by the migration when pg_cron is
-- available, so the retention promise cannot land without its enforcement.
-- The dynamic calls keep the plain-Postgres verification harness valid.
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is not null then
    execute $cron$
      select cron.schedule(
        'support-ticket-retention',
        '43 5 * * *',
        $job$select private.sweep_support_ticket_retention()$job$
      )
    $cron$;
    execute $cron$
      select cron.alter_job(
        (select jobid from cron.job where jobname = 'support-ticket-retention'),
        active := true
      )
    $cron$;
  end if;
end $$;
