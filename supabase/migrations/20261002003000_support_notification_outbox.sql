-- A support reply and its notification intent commit together. Email remains
-- a generic delivery hint; the authenticated in-app thread is authoritative.

create table if not exists public.support_notification_outbox (
  message_id uuid primary key references public.support_ticket_messages(id) on delete cascade,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  queued_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 8),
  accepted_at timestamptz,
  dead_lettered_at timestamptz,
  claim_id uuid,
  claimed_at timestamptz,
  last_error text check (last_error is null or length(last_error) <= 160),
  constraint support_notification_claim_pair check ((claim_id is null) = (claimed_at is null)),
  constraint support_notification_one_outcome check (accepted_at is null or dead_lettered_at is null)
);

alter table public.support_notification_outbox
  add column if not exists claim_id uuid;
alter table public.support_notification_outbox
  add column if not exists claimed_at timestamptz;
do $$ begin
  alter table public.support_notification_outbox
    add constraint support_notification_claim_pair check ((claim_id is null) = (claimed_at is null));
exception when duplicate_object then null;
end $$;

create index if not exists support_notification_outbox_due
  on public.support_notification_outbox (next_attempt_at, queued_at)
  where accepted_at is null and dead_lettered_at is null;

-- The immediate operator-triggered attempt resolves one ticket while the
-- scheduled worker scans every due row. Keep separate indexes for those two
-- access paths. This ticket-first index is deliberately not partial: deletes
-- must also find accepted and dead-lettered rows through the foreign key.
create index if not exists support_notification_outbox_ticket_due
  on public.support_notification_outbox (ticket_id, next_attempt_at, queued_at);

alter table public.support_notification_outbox enable row level security;
revoke all on table public.support_notification_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.support_notification_outbox to service_role;

-- Claim before recipient lookup or provider delivery. SKIP LOCKED keeps the
-- immediate operator attempt and the scheduled drain from ever owning the
-- same row. A stale claim is recoverable after an interrupted worker.
create or replace function public.claim_support_notifications(want_message uuid, want_limit integer)
returns table (message_id uuid, ticket_id uuid, attempts integer, claim_id uuid)
language sql volatile security invoker set search_path = '' as $$
  with due as (
    select o.message_id
      from public.support_notification_outbox o
     where o.accepted_at is null
       and o.dead_lettered_at is null
       and o.next_attempt_at <= now()
       and (o.claimed_at is null or o.claimed_at < now() - interval '5 minutes')
       and (want_message is null or o.message_id = want_message)
     order by o.queued_at
     limit greatest(1, least(coalesce(want_limit, 100), 100))
     for update skip locked
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

-- Support email is a per-ticket choice. It starts off, can be changed by the
-- student at any time, and never exposes the ticket content.
alter table public.support_tickets
  add column if not exists email_notice_enabled boolean not null default false;

-- The operator creates this once for an attempted reply and reuses it after
-- an ambiguous network response. The database, not the browser, is the final
-- duplicate-write boundary.
alter table public.support_ticket_messages
  add column if not exists client_operation_id uuid;
alter table public.support_ticket_messages
  add column if not exists support_notice_outcome text
    check (support_notice_outcome is null or support_notice_outcome in ('queued', 'preference_off', 'capped'));
create unique index if not exists support_ticket_messages_reply_operation
  on public.support_ticket_messages (ticket_id, client_operation_id)
  where from_side = 'support' and client_operation_id is not null;

create or replace function public.open_support_ticket(
  want_category text, want_subject text, want_body text, want_context jsonb,
  want_email_notice boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare made uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('support_ticket:' || (select auth.uid())::text, 0));
  if (select count(*) from public.support_tickets t
       where t.student_id = (select auth.uid()) and t.created_at > now() - interval '1 day') >= 5 then
    raise exception 'five questions a day is the limit; reply on an open one instead'
      using errcode = 'check_violation';
  end if;
  insert into public.support_tickets
    (student_id, category, subject, body, context, priority, first_response_due, email_notice_enabled)
  values (
    (select auth.uid()), want_category, want_subject, want_body, coalesce(want_context, '{}'::jsonb),
    case when want_category in ('accessibility', 'privacy') then 'high' else 'normal' end,
    now() + make_interval(hours => private.support_first_response_hours(want_category)),
    coalesce(want_email_notice, false)
  ) returning id into made;
  return made;
end $$;

-- The five-argument form is the only client entry point after this migration.
-- Keeping the legacy overload callable would let a name-only security inventory
-- silently validate the wrong body.
drop function if exists public.open_support_ticket(text, text, text, jsonb);

create or replace function public.my_support_email_notices()
returns table (ticket_id uuid, enabled boolean)
language sql stable security definer set search_path = '' as $$
  select t.id, t.email_notice_enabled
    from public.support_tickets t
   where t.student_id = (select auth.uid())
   order by t.id;
$$;

-- A later migration may change this function's return contract. Dropping the
-- exact signature keeps a full migration replay idempotent because PostgreSQL
-- cannot change a function return type through create or replace.
drop function if exists public.set_support_email_notice(uuid, boolean);
create function public.set_support_email_notice(want_ticket uuid, want_enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
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
       and dead_lettered_at is null;
  end if;
end $$;

drop function if exists public.support_reply(uuid, text, text);
drop function if exists public.support_reply(uuid, text, text, uuid);
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

  -- A committed response may be lost in transit. Reusing the same operation
  -- ID returns its original notification outcome without writing again.
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

  -- Preference changes and reply-notice decisions share this lock, so an
  -- opt-out cannot race with the enqueue decision.
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
    -- The same lock makes the three-per-ticket rolling-day cap hold under
    -- concurrent replies as well as ordinary sequential use.
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

revoke all on function public.open_support_ticket(text, text, text, jsonb, boolean) from public, anon;
revoke all on function public.my_support_email_notices() from public, anon;
revoke all on function public.set_support_email_notice(uuid, boolean) from public, anon;
revoke all on function public.support_reply(uuid, text, text, uuid) from public, anon;
grant execute on function public.open_support_ticket(text, text, text, jsonb, boolean) to authenticated;
grant execute on function public.my_support_email_notices() to authenticated;
grant execute on function public.set_support_email_notice(uuid, boolean) to authenticated;
grant execute on function public.support_reply(uuid, text, text, uuid) to authenticated;
