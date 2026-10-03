-- A claimed support notice is already in flight. Preference changes remove
-- only notices that no worker owns and report when one may still arrive.
-- Claiming and consent are decided together in the database, before any
-- recipient lookup or provider request.

-- Some preview/production histories recorded the original outbox migration
-- before this consent column existed in their schema. Keep this repair
-- self-contained instead of trusting migration-history equivalence.
alter table public.support_tickets
  add column if not exists email_notice_enabled boolean not null default false;
alter table public.support_notification_outbox
  add column if not exists claim_id uuid;
alter table public.support_notification_outbox
  add column if not exists claimed_at timestamptz;
do $$ begin
  alter table public.support_notification_outbox
    add constraint support_notification_claim_pair check ((claim_id is null) = (claimed_at is null));
exception when duplicate_object then null;
end $$;

create or replace function public.claim_support_notifications(want_message uuid, want_limit integer)
returns table (message_id uuid, ticket_id uuid, attempts integer, claim_id uuid)
language sql volatile security invoker set search_path = '' as $$
  with due as (
    select o.message_id
      from public.support_notification_outbox o
      join public.support_tickets t on t.id = o.ticket_id
     where t.email_notice_enabled
       and o.accepted_at is null
       and o.dead_lettered_at is null
       and o.next_attempt_at <= now()
       and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
       and (want_message is null or o.message_id = want_message)
     order by o.queued_at
     limit greatest(1, least(coalesce(want_limit, 100), 100))
     for update of o skip locked
  ), claimed as (
    update public.support_notification_outbox o
       set claim_id = pg_catalog.gen_random_uuid(), claimed_at = now()
      from due
     where o.message_id = due.message_id
    returning o.message_id, o.ticket_id, o.attempts, o.claim_id
  )
  select c.message_id, c.ticket_id, c.attempts, c.claim_id from claimed c;
$$;

revoke all on function public.claim_support_notifications(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_support_notifications(uuid, integer) to service_role;

drop function if exists public.set_support_email_notice(uuid, boolean);
create function public.set_support_email_notice(want_ticket uuid, want_enabled boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  in_flight boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('support_notice:' || want_ticket::text, 0));
  update public.support_tickets
     set email_notice_enabled = coalesce(want_enabled, false)
   where id = want_ticket and student_id = (select auth.uid());
  if not found then
    raise exception 'no ticket of yours with that id' using errcode = 'insufficient_privilege';
  end if;

  if not coalesce(want_enabled, false) then
    delete from public.support_notification_outbox
     where ticket_id = want_ticket
       and accepted_at is null
       and dead_lettered_at is null
       and claim_id is null;

    -- Run this after the delete. If a worker won the row-lock race, its claim
    -- is visible here and the student gets an honest in-flight warning.
    select exists (
      select 1 from public.support_notification_outbox o
       where o.ticket_id = want_ticket
         and o.accepted_at is null
         and o.dead_lettered_at is null
         and o.claim_id is not null
    ) into in_flight;
  end if;

  return case
    when coalesce(want_enabled, false) then 'on'
    when in_flight then 'off_with_in_flight'
    else 'off'
  end;
end $$;

revoke all on function public.set_support_email_notice(uuid, boolean) from public, anon;
grant execute on function public.set_support_email_notice(uuid, boolean) to authenticated;
