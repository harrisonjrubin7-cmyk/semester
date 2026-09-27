-- Semester — three corrections to help requests, found in review.
--
-- 1. **A closed request can be erased.** `withdraw_help_request` accepted
--    only sent, acknowledged and scheduled, so once an office closed a
--    request the student's words and identity stayed until account deletion,
--    while the screen promised withdrawal "at any time". Closed is now
--    withdrawable too; the words go, the fact and dates stay.
--
-- 2. **Retiring an office does not strand what it was sent.** An office that
--    is retired or stops accepting requests dropped out of
--    `my_help_destinations`, the staff screen's only way to find its inbox,
--    while its open requests still read as waiting to the student. Intake now
--    closes without hiding: a destination stays listed for the people who
--    answer it while any request to it is still open.
--
-- 3. **The office sees the identity the student confirmed, not a later one.**
--    Identity was read at open time, so a display name or email changed after
--    sending reached the office unreviewed. `send_help_request` now records
--    the name and confirmed email at the moment of sending — the moment the
--    confirm screen showed them — and `open_help_request` returns that
--    record. Withdrawal erases it with the rest of the words; account deletion
--    takes the row.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 3. The identity, as sent ──────────────────────────────────────────────

alter table public.help_requests
  add column if not exists student_name  text not null default '' check (length(student_name) <= 200),
  add column if not exists student_email text not null default '' check (length(student_email) <= 320);

-- Requests sent before this migration were answered with the identity read
-- live at open time. Blank snapshot columns would now show them as "A
-- student" with no email and leave them unactionable, so every live request
-- without a snapshot takes the identity it would have shown the moment before
-- this ran. Withdrawn requests are left empty; that is what withdrawal means.
-- A function rather than a bare statement, so `help-requests.check.sql` can
-- run it against a row it has deliberately emptied.
create or replace function private.backfill_help_request_identity()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.help_requests r
     set student_name = coalesce(p.handle, ''),
         student_email = coalesce(u.email::text, '')
    from auth.users u
    left join public.profiles p on p.user_id = u.id
   where u.id = r.student_id
     and r.status <> 'withdrawn'
     and r.student_email = '';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.backfill_help_request_identity() from public, anon, authenticated;

select private.backfill_help_request_identity();

alter table public.help_requests drop constraint if exists help_request_withdrawn_is_empty;
alter table public.help_requests add constraint help_request_withdrawn_is_empty check (
  status <> 'withdrawn'
  or (question = '' and shared_context = '{}'::jsonb and reply = '' and student_name = '' and student_email = ''));

create or replace function public.send_help_request(want_destination uuid, want_question text, want_context jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me  uuid := (select auth.uid());
  d   public.help_destinations%rowtype;
  new_id uuid;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into d from public.help_destinations x
   where x.id = want_destination and x.retired_at is null;
  if not found or d.tenant_id is distinct from private.school_of() then
    raise exception 'no such destination at your school' using errcode = '42501';
  end if;
  if not d.accepts_requests then
    raise exception 'this office is reached directly, not through Semester' using errcode = '22023';
  end if;

  -- Who they are, as the confirm screen showed it, recorded now rather than
  -- looked up when an office opens it. The email is the confirmed one.
  insert into public.help_requests (student_id, destination_id, question, shared_context, student_name, student_email)
  select me, d.id, trim(coalesce(want_question, '')), coalesce(want_context, '{}'::jsonb),
         coalesce(p.handle, ''), coalesce(u.email::text, '')
    from auth.users u
    left join public.profiles p on p.user_id = u.id
   where u.id = me
  returning id into new_id;

  insert into public.help_request_events (request_id, kind, actor_id) values (new_id, 'sent', me);
  return new_id;
end $$;
revoke all on function public.send_help_request(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.send_help_request(uuid, text, jsonb) to authenticated;

create or replace function public.open_help_request(want uuid)
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
  return query select r.student_name, r.student_email, r.question, r.shared_context, r.status, r.created_at;
end $$;
revoke all on function public.open_help_request(uuid) from public, anon, authenticated;
grant execute on function public.open_help_request(uuid) to authenticated;

-- ── 1. A closed request can be erased ─────────────────────────────────────

create or replace function public.withdraw_help_request(want uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  update public.help_requests
     set status = 'withdrawn', question = '', shared_context = '{}'::jsonb, reply = '',
         student_name = '', student_email = '', updated_at = now()
   where id = want and student_id = me and status in ('sent', 'acknowledged', 'scheduled', 'closed');
  if not found then
    raise exception 'not a request you can withdraw' using errcode = '42501';
  end if;
  insert into public.help_request_events (request_id, kind, actor_id) values (want, 'withdrawn', me);
end $$;
revoke all on function public.withdraw_help_request(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_help_request(uuid) to authenticated;

-- ── 2. Closing intake does not hide what is already there ─────────────────

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
                   where r.destination_id = d.id and r.status in ('sent', 'acknowledged', 'scheduled'))
     )
   order by d.name;
$$;
revoke all on function public.my_help_destinations() from public, anon, authenticated;
grant execute on function public.my_help_destinations() to authenticated;
