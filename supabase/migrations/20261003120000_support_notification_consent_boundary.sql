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

-- A student may opt out while a worker owns a notice. If that worker later
-- releases the claim after a delivery or recipient-lookup failure, remove the
-- retry instead of leaving a dormant notice that could send after a future
-- opt-in. The ordinary opt-out transaction deletes rows released first; this
-- trigger covers the opposite commit order.
create or replace function private.cancel_unconsented_support_retry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.accepted_at is null
     and new.dead_lettered_at is null
     and not exists (
       select 1 from public.support_tickets t
        where t.id = new.ticket_id and t.email_notice_enabled
     ) then
    delete from public.support_notification_outbox o
     where o.message_id = new.message_id and o.claim_id is null;
  end if;
  return null;
end $$;

revoke all on function private.cancel_unconsented_support_retry() from public, anon, authenticated;
drop trigger if exists cancel_unconsented_support_retry on public.support_notification_outbox;
create trigger cancel_unconsented_support_retry
after update of claim_id on public.support_notification_outbox
for each row
when (old.claim_id is not null and new.claim_id is null)
execute function private.cancel_unconsented_support_retry();

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

-- Re-state the reply boundary so production histories that already recorded
-- the original outbox migration receive the corrected cap. Every still-
-- deliverable notice counts, however old it is, and an accepted notice keeps
-- its slot for 24 hours from provider acceptance rather than queue time.
create or replace function public.support_reply(
  want_ticket uuid, want_body text, want_status text, want_operation uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  made uuid;
  notices boolean;
  notice_outcome text := 'preference_off';
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_fresh_mfa();
  if want_status not in ('open', 'waiting_on_student', 'resolved') then
    raise exception 'support may leave a ticket open, waiting on the student, or resolved; only the student closes it';
  end if;
  if want_operation is null then
    raise exception 'a stable reply operation id is required' using errcode = 'not_null_violation';
  end if;

  insert into public.support_ticket_messages (ticket_id, from_side, body, client_operation_id)
    values (want_ticket, 'support', want_body, want_operation)
    on conflict (ticket_id, client_operation_id)
      where from_side = 'support' and client_operation_id is not null
      do nothing
    returning id into made;

  if made is null then
    select m.id into made
      from public.support_ticket_messages m
     where m.ticket_id = want_ticket
       and m.from_side = 'support'
       and m.client_operation_id = want_operation;
    return (
      select jsonb_build_object('outcome', m.support_notice_outcome, 'message_id', m.id)
        from public.support_ticket_messages m where m.id = made
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('support_notice:' || want_ticket::text, 0));

  update public.support_tickets
     set status = want_status, updated_at = now(),
         first_responded_at = coalesce(first_responded_at, now())
   where id = want_ticket and status <> 'closed';
  if not found then raise exception 'no open ticket with that id'; end if;

  select t.email_notice_enabled into notices
    from public.support_tickets t where t.id = want_ticket;
  if notices then
    if (select count(*) from public.support_notification_outbox o
         where o.ticket_id = want_ticket
           and (
             (o.accepted_at is null and o.dead_lettered_at is null)
             or o.accepted_at > now() - interval '1 day'
           )) < 3 then
      insert into public.support_notification_outbox (message_id, ticket_id)
        values (made, want_ticket);
      notice_outcome := 'queued';
    else
      notice_outcome := 'capped';
    end if;
  end if;

  update public.support_ticket_messages
     set support_notice_outcome = notice_outcome
   where id = made;

  perform private.record_audit(
    null,
    'support.reply',
    'support_ticket',
    want_ticket::text,
    'allowed',
    private.role_audit_sha256(made::text),
    jsonb_build_object('next_status', want_status, 'notification_queued', notice_outcome = 'queued')
  );
  return jsonb_build_object('outcome', notice_outcome, 'message_id', made);
end $$;

revoke all on function public.support_reply(uuid, text, text, uuid) from public, anon;
grant execute on function public.support_reply(uuid, text, text, uuid) to authenticated;
