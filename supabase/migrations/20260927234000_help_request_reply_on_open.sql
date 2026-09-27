-- Semester — an office can read back what it replied.
--
-- `answer_help_request` stores a reply the student reads beside their
-- question, but `open_help_request` did not return it, so an advisor who
-- came back to a scheduled request could not see what they had told the
-- student. It now returns the reply too. Nothing new is stored or exposed:
-- the reply is the office's own words, already on the row.
--
-- The return type changes, which `create or replace` cannot do, so the
-- function is dropped and recreated with the same arguments, checks and grants.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

drop function if exists public.open_help_request(uuid);

create function public.open_help_request(want uuid)
returns table (student_name text, student_email text, question text, shared_context jsonb, status text, reply text, created_at timestamptz)
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
  return query select r.student_name, r.student_email, r.question, r.shared_context, r.status, r.reply, r.created_at;
end $$;
revoke all on function public.open_help_request(uuid) from public, anon, authenticated;
grant execute on function public.open_help_request(uuid) to authenticated;
