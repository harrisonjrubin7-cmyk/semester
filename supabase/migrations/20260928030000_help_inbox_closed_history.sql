-- A staff inbox keeps an office's closed requests reachable.
--
-- `my_help_destinations()` listed a retired office, or one that no longer
-- accepts requests, only while it held an open request (sent, acknowledged or
-- scheduled). Closing the last one removed the office from the list, so the
-- staff inbox's Closed and All filters could never show that office's closed
-- requests, and the card just closed vanished with it (Codex, #855).
--
-- The office now stays listed while it holds any request a student has not
-- withdrawn. Withdrawn requests were already invisible to staff (`help_inbox`
-- leaves them out, and withdrawing clears their words), so an office whose
-- every request is withdrawn still drops away. Offices open for intake are
-- listed as before. Nothing else about the function changes: the same
-- capability check, columns, grant and order.

create or replace function public.my_help_destinations()
returns table (id uuid, kind text, name text, scope_kind text, scope_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.kind, d.name, d.scope_kind, d.scope_id
    from public.help_destinations d
   where private.has_capability('help_request:respond', d.scope_kind, d.scope_id)
     and (
       (d.retired_at is null and d.accepts_requests)
       or exists (select 1 from public.help_requests r
                   where r.destination_id = d.id and r.status <> 'withdrawn')
     )
   order by d.name;
$$;
revoke all on function public.my_help_destinations() from public, anon, authenticated;
grant execute on function public.my_help_destinations() to authenticated;
