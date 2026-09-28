-- Semester — support tickets: a student asks Semester for help, and Semester's
-- support staff answer, without either side handing over more than it chose.
--
-- Launch-readiness Phase 5. `20260926150000_expansion_roles_and_features.sql`
-- created the `support:ticket` capability and gave it to `support_agent`, with
-- the description "Handle support tickets. Grants no student data without a
-- support_access_grant." There were no tickets. This is them, and the
-- description is the rule they are built to:
--
--   * **The agent never learns who asked.** The queue and the thread return a
--     ticket's category, words, the context the student ticked and its
--     timings — never an account id, an address or a name. A reply goes back
--     in the app. If an agent needs the student's data to help, that is the
--     existing student-granted `support_access_grant`, not this table.
--   * **Context is a closed list the student ticked.** `private.support_context_ok`
--     allows six keys, all about the app rather than the person: version,
--     device class, screen shape, whether signed in, sync state, offline. A
--     grade or a diagnosis cannot ride along in a key invented later.
--     `app/src/lib/supporttickets.test.ts` holds the app's list to this one.
--   * **Accessibility and privacy come first.** Priority and the first-response
--     target are computed here from the category, not chosen by anybody:
--     accessibility and privacy one business day (the window in
--     `docs/vanderbilt/incident-routing.md`), everything else three.
--   * **Only the student opens a ticket**, and only about themselves. No
--     staff capability can open one on a student's behalf. Five a day per
--     account, so a script cannot bury the queue people read.
--
-- Every table has RLS on and no grant; the functions below are the only way
-- in. `supabase/support-tickets.check.sql` walks each rule with two accounts
-- and an agent.

-- ── 1. Tables ─────────────────────────────────────────────────────────────

create or replace function private.support_context_ok(want jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(want) = 'object'
     and not exists (
       select 1 from jsonb_each(want) e
        where e.key not in ('app_version', 'device_class', 'screen', 'signed_in', 'sync_state', 'offline')
           or jsonb_typeof(e.value) <> 'string'
           or length(e.value #>> '{}') not between 1 and 80
     );
$$;
revoke all on function private.support_context_ok(jsonb) from public;

create table if not exists public.support_tickets (
  id                   uuid        primary key default gen_random_uuid(),
  student_id           uuid        not null references auth.users on delete cascade,
  category             text        not null check (category in (
                         'account', 'sync', 'bug', 'accessibility', 'privacy', 'how_to', 'other')),
  subject              text        not null check (length(trim(subject)) between 1 and 140),
  body                 text        not null check (length(trim(body)) between 1 and 4000),
  context              jsonb       not null default '{}'::jsonb check (private.support_context_ok(context)),
  priority             text        not null check (priority in ('high', 'normal')),
  status               text        not null default 'open' check (status in (
                         'open', 'waiting_on_student', 'resolved', 'closed')),
  created_at           timestamptz not null default now(),
  first_response_due   timestamptz not null,
  first_responded_at   timestamptz,
  updated_at           timestamptz not null default now(),
  constraint support_ticket_due_after_open check (first_response_due > created_at)
);
create index if not exists support_tickets_by_student on public.support_tickets (student_id, created_at desc);
create index if not exists support_tickets_queue on public.support_tickets (status, priority, first_response_due);

create table if not exists public.support_ticket_messages (
  id          uuid        primary key default gen_random_uuid(),
  ticket_id   uuid        not null references public.support_tickets on delete cascade,
  from_side   text        not null check (from_side in ('student', 'support')),
  body        text        not null check (length(trim(body)) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index if not exists support_ticket_messages_by_ticket on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_tickets enable row level security;
revoke all on public.support_tickets from anon, authenticated;
alter table public.support_ticket_messages enable row level security;
revoke all on public.support_ticket_messages from anon, authenticated;

-- ── 2. Service levels ─────────────────────────────────────────────────────

-- First-response target in hours, by category. `lib/supporttickets.ts` holds the same
-- numbers and a test compares them.
create or replace function private.support_first_response_hours(want_category text)
returns integer language sql immutable set search_path = '' as $$
  select case want_category when 'accessibility' then 24 when 'privacy' then 24 else 72 end;
$$;
revoke all on function private.support_first_response_hours(text) from public;

create or replace function private.support_agent()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_capability('support:ticket', 'platform', '');
$$;
revoke all on function private.support_agent() from public;

-- ── 3. The student's side ─────────────────────────────────────────────────

create or replace function public.open_support_ticket(
  want_category text, want_subject text, want_body text, want_context jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare made uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  -- Five a day is more than a student with a real problem sends and fewer
  -- than a script would. The queue is read by people; flooding it is the
  -- cheapest way to make a real accessibility ticket wait.
  --
  -- The count and the insert are one decision, so they happen under a lock
  -- held per account until this transaction ends. Without it, concurrent
  -- calls each count the same four rows and all of them insert.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('support_ticket:' || (select auth.uid())::text, 0));
  if (select count(*) from public.support_tickets t
       where t.student_id = (select auth.uid()) and t.created_at > now() - interval '1 day') >= 5 then
    raise exception 'five questions a day is the limit; reply on an open one instead'
      using errcode = 'check_violation';
  end if;
  insert into public.support_tickets
    (student_id, category, subject, body, context, priority, first_response_due)
  values (
    (select auth.uid()), want_category, want_subject, want_body, coalesce(want_context, '{}'::jsonb),
    case when want_category in ('accessibility', 'privacy') then 'high' else 'normal' end,
    now() + make_interval(hours => private.support_first_response_hours(want_category))
  )
  returning id into made;
  return made;
end $$;

create or replace function public.my_support_tickets()
returns table (id uuid, category text, subject text, status text, priority text,
               created_at timestamptz, first_response_due timestamptz, first_responded_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, t.category, t.subject, t.status, t.priority, t.created_at, t.first_response_due,
         t.first_responded_at, t.updated_at
    from public.support_tickets t
   where t.student_id = (select auth.uid())
   order by t.updated_at desc;
$$;

create or replace function public.my_support_thread(want_ticket uuid)
returns table (from_side text, body text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select 'student'::text, t.body, t.created_at from public.support_tickets t
   where t.id = want_ticket and t.student_id = (select auth.uid())
  union all
  select m.from_side, m.body, m.created_at from public.support_ticket_messages m
    join public.support_tickets t on t.id = m.ticket_id
   where t.id = want_ticket and t.student_id = (select auth.uid())
   order by 3;
$$;

create or replace function public.reply_to_my_ticket(want_ticket uuid, want_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.support_tickets t
                  where t.id = want_ticket and t.student_id = (select auth.uid()) and t.status <> 'closed') then
    raise exception 'no open ticket of yours with that id' using errcode = 'insufficient_privilege';
  end if;
  insert into public.support_ticket_messages (ticket_id, from_side, body) values (want_ticket, 'student', want_body);
  update public.support_tickets set status = 'open', updated_at = now() where id = want_ticket;
end $$;

create or replace function public.close_my_ticket(want_ticket uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.support_tickets set status = 'closed', updated_at = now()
   where id = want_ticket and student_id = (select auth.uid());
  if not found then raise exception 'no ticket of yours with that id' using errcode = 'insufficient_privilege'; end if;
end $$;

-- Account deletion: `OWNED_TABLES` in `app/src/lib/cloud.ts` names this as the
-- way these rows go; messages cascade.
create or replace function public.forget_my_support_tickets()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = 'insufficient_privilege';
  end if;
  delete from public.support_tickets where student_id = (select auth.uid());
end $$;

-- ── 4. Support's side: no identity, ever ──────────────────────────────────

create or replace function public.support_ticket_queue()
returns table (id uuid, category text, subject text, status text, priority text,
               created_at timestamptz, first_response_due timestamptz, first_responded_at timestamptz, overdue boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
  return query
    select t.id, t.category, t.subject, t.status, t.priority, t.created_at, t.first_response_due,
           t.first_responded_at, (t.first_responded_at is null and t.first_response_due < now())
      from public.support_tickets t
     where t.status in ('open', 'waiting_on_student')
     order by (t.priority = 'high') desc, t.first_response_due;
end $$;

create or replace function public.support_ticket_thread(want_ticket uuid)
returns table (from_side text, body text, context jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
  return query
    select 'student'::text, t.body, t.context, t.created_at from public.support_tickets t where t.id = want_ticket
    union all
    select m.from_side, m.body, null::jsonb, m.created_at from public.support_ticket_messages m
     where m.ticket_id = want_ticket
    order by 4;
end $$;

create or replace function public.support_reply(want_ticket uuid, want_body text, want_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.support_agent() then
    raise exception 'support:ticket is required' using errcode = 'insufficient_privilege';
  end if;
  if want_status not in ('open', 'waiting_on_student', 'resolved') then
    raise exception 'support may leave a ticket open, waiting on the student, or resolved; only the student closes it';
  end if;
  insert into public.support_ticket_messages (ticket_id, from_side, body) values (want_ticket, 'support', want_body);
  update public.support_tickets
     set status = want_status, updated_at = now(),
         first_responded_at = coalesce(first_responded_at, now())
   where id = want_ticket and status <> 'closed';
  if not found then raise exception 'no open ticket with that id'; end if;
end $$;

-- ── 5. Who may call what ──────────────────────────────────────────────────

revoke all on function public.open_support_ticket(text, text, text, jsonb) from public, anon;
revoke all on function public.my_support_tickets() from public, anon;
revoke all on function public.my_support_thread(uuid) from public, anon;
revoke all on function public.reply_to_my_ticket(uuid, text) from public, anon;
revoke all on function public.close_my_ticket(uuid) from public, anon;
revoke all on function public.forget_my_support_tickets() from public, anon;
revoke all on function public.support_ticket_queue() from public, anon;
revoke all on function public.support_ticket_thread(uuid) from public, anon;
revoke all on function public.support_reply(uuid, text, text) from public, anon;

grant execute on function public.open_support_ticket(text, text, text, jsonb) to authenticated;
grant execute on function public.my_support_tickets() to authenticated;
grant execute on function public.my_support_thread(uuid) to authenticated;
grant execute on function public.reply_to_my_ticket(uuid, text) to authenticated;
grant execute on function public.close_my_ticket(uuid) to authenticated;
grant execute on function public.forget_my_support_tickets() to authenticated;
grant execute on function public.support_ticket_queue() to authenticated;
grant execute on function public.support_ticket_thread(uuid) to authenticated;
grant execute on function public.support_reply(uuid, text, text) to authenticated;
