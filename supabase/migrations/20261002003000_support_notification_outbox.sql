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
  last_error text check (last_error is null or length(last_error) <= 160),
  constraint support_notification_one_outcome check (accepted_at is null or dead_lettered_at is null)
);

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

create or replace function public.support_reply(want_ticket uuid, want_body text, want_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare made uuid;
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_fresh_mfa();
  if want_status not in ('open', 'waiting_on_student', 'resolved') then
    raise exception 'support may leave a ticket open, waiting on the student, or resolved; only the student closes it';
  end if;
  insert into public.support_ticket_messages (ticket_id, from_side, body)
    values (want_ticket, 'support', want_body) returning id into made;
  update public.support_tickets
     set status = want_status, updated_at = now(),
         first_responded_at = coalesce(first_responded_at, now())
   where id = want_ticket and status <> 'closed';
  if not found then raise exception 'no open ticket with that id'; end if;

  insert into public.support_notification_outbox (message_id, ticket_id)
    values (made, want_ticket);

  perform private.record_audit(
    null,
    'support.reply',
    'support_ticket',
    want_ticket::text,
    'allowed',
    private.role_audit_sha256(made::text),
    jsonb_build_object('next_status', want_status, 'notification_queued', true)
  );
end $$;

revoke all on function public.support_reply(uuid, text, text) from public, anon;
grant execute on function public.support_reply(uuid, text, text) to authenticated;
