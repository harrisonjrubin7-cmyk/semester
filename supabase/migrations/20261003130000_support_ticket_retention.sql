-- Support questions are operational records, not permanent profiles.
-- Resolved and student-closed tickets are retained for 180 days after their
-- last activity, then removed with their messages and notification intents.
-- An active account, tenant or platform legal hold always wins.

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
     and not private.account_is_held(t.student_id);
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
  if private.account_is_held(who) then
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
