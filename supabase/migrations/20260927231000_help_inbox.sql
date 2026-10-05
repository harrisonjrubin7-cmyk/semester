-- Semester — which help inboxes a staff account answers for.
--
-- `help_inbox`, `open_help_request` and `answer_help_request` in
-- 20260927230000_help_requests.sql each take a destination or request the
-- caller must already know. This is how the staff screen learns which
-- destinations those are: the ones `private.answers_for` says yes to, and no
-- others. It returns the office, never a request or a student.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

create or replace function public.my_help_destinations()
returns table (id uuid, kind text, name text, scope_kind text, scope_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.kind, d.name, d.scope_kind, d.scope_id
    from public.help_destinations d
   where d.retired_at is null
     and d.accepts_requests
     and private.has_capability('help_request:respond', d.scope_kind, d.scope_id)
   order by d.name;
$$;
revoke all on function public.my_help_destinations() from public, anon, authenticated;
grant execute on function public.my_help_destinations() to authenticated;
