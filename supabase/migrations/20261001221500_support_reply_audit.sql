-- Record each support reply in the common immutable audit envelope. The
-- ticket and message are pseudonymized independently; the student's identity
-- and the reply body never enter the audit trail.

create or replace function public.support_reply(want_ticket uuid, want_body text, want_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare made uuid;
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
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

  perform private.record_audit(
    null,
    'support.reply',
    'support_ticket',
    want_ticket::text,
    'allowed',
    private.role_audit_sha256(made::text),
    jsonb_build_object('next_status', want_status)
  );
end $$;

revoke all on function public.support_reply(uuid, text, text) from public, anon;
grant execute on function public.support_reply(uuid, text, text) to authenticated;
