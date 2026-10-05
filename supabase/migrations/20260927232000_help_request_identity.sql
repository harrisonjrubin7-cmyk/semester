-- Semester — the office learns who is asking, because the student was told.
--
-- An advisor cannot book an appointment with a question. The student's
-- confirm screen now lists their display name and confirmed university
-- email as sent with every request (`IDENTITY_SENT` in
-- `app/src/lib/help-routes.ts`), so opening a request returns both.
--
-- Read at open time rather than copied into the request: there is no second
-- copy of a student's address to retain, withdraw or delete, and a withdrawn
-- request cannot be opened at all. The email is `auth.users.email`, the
-- address the server confirmed — never one the profile claims. The inbox
-- list (`help_inbox`) still carries no identity; only an open, which the
-- student sees, does.
--
-- The return type changes, which `create or replace` cannot do, so the
-- function is dropped and recreated with the same arguments and grants.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

drop function if exists public.open_help_request(uuid);

create function public.open_help_request(want uuid)
returns table (student_name text, student_email text, question text, shared_context jsonb, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.help_requests%rowtype;
begin
  select * into r from public.help_requests x where x.id = want and x.status <> 'withdrawn';
  if not found or not private.answers_for(r.destination_id) or r.student_id = (select auth.uid()) then
    raise exception 'not a request you can open' using errcode = '42501';
  end if;
  insert into public.help_request_events (request_id, kind, actor_id)
  values (r.id, 'opened', (select auth.uid()));
  return query
    select p.handle, u.email::text, r.question, r.shared_context, r.status, r.created_at
      from auth.users u
      left join public.profiles p on p.user_id = u.id
     where u.id = r.student_id;
end $$;
revoke all on function public.open_help_request(uuid) from public, anon, authenticated;
grant execute on function public.open_help_request(uuid) to authenticated;
