-- Semester — asking a person for help, with the student holding the pen.
--
-- A student who is stuck should be able to move from the app to the right
-- human — an advisor, a tutor, the writing center, a librarian, the registrar
-- — without the app deciding for them, and without anything about them
-- leaving that they did not read first. This is that route, and it is built
-- on three refusals:
--
--   * **Nothing is sent that the student did not write or tick.** A request
--     carries their question and, optionally, a handful of named context
--     fields (which course, which assignment, which requirement). The field
--     names are a closed list enforced by `private.help_context_ok`, so a
--     grade, a diagnosis, an aid figure or a visa status cannot ride along in
--     a key somebody invents later. The app's preview and this list are the
--     same list; `app/src/lib/help-routes.test.ts` reads this file and fails
--     when they drift.
--   * **Nobody is referred automatically.** There is no insert path except
--     `send_help_request`, which only ever acts as the caller on the caller's
--     own behalf. No staff capability can open a request about a student.
--   * **Wellbeing is not a destination.** Counseling and crisis support are
--     shown as a directory the student can use on their own; the check on
--     `help_destinations.kind` has no value for them, so no request about a
--     student's wellbeing can be stored here at all.
--
-- Staff never select the request table. They see an inbox of ids, kinds and
-- times (`help_inbox`), and open one through `open_help_request`, which
-- writes an event the student can see — the same shape as
-- `read_shared_accommodation` in 20260926150000.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Capability ─────────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('help_request:respond', 'Open and answer help requests a student chose to send to one office or course. Sees only what the student wrote and ticked; every open is recorded for the student.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('academic_advisor',              'help_request:respond'),
  ('registrar',                     'help_request:respond'),
  ('tutor',                         'help_request:respond'),
  ('learning_center_staff',         'help_request:respond'),
  ('faculty',                       'help_request:respond'),
  ('teaching_assistant',            'help_request:respond'),
  ('career_coach',                  'help_request:respond'),
  ('university_staff',              'help_request:respond')
on conflict (role, capability) do nothing;

-- ── 2. Where help can be asked for ────────────────────────────────────────
--
-- One row per office (or course) that a university has chosen to reach
-- through Semester. Configured during implementation by an account holding
-- `tenant:implement` for the school; read by any signed-in account at that
-- school. A row with `accepts_requests = false` is a directory entry only:
-- the app shows its link and hours and sends nothing.

create table if not exists public.help_destinations (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  kind             text        not null check (kind in (
                     'advisor', 'registrar', 'transfer_center', 'tutoring', 'writing_center',
                     'library', 'instructor', 'career_center', 'accessibility_office',
                     'financial_aid', 'campus_service')),
  scope_kind       text        not null check (scope_kind in ('office', 'course', 'department')),
  scope_id         text        not null check (length(trim(scope_id)) between 1 and 200),
  name             text        not null check (length(trim(name)) between 1 and 200),
  official_url     text        check (official_url is null or (official_url ~ '^https://' and length(official_url) <= 2000)),
  hours            text        not null default '' check (length(hours) <= 300),
  accepts_requests boolean     not null default false,
  created_at       timestamptz not null default now(),
  retired_at       timestamptz,
  constraint help_destination_scope_in_tenant check (private.scope_in_tenant(scope_id, tenant_id)),
  -- Sensitive offices are reached directly, never through a stored request.
  constraint help_destination_sensitive_is_directory check (
    kind not in ('accessibility_office', 'financial_aid') or not accepts_requests)
);
create index if not exists help_destinations_by_tenant on public.help_destinations (tenant_id, kind);
alter table public.help_destinations enable row level security;
revoke all on table public.help_destinations from anon, authenticated;
grant select, insert on table public.help_destinations to authenticated;
grant update (name, official_url, hours, accepts_requests, retired_at) on table public.help_destinations to authenticated;

drop policy if exists "a school's accounts read its help destinations" on public.help_destinations;
create policy "a school's accounts read its help destinations" on public.help_destinations
  for select using (
    (retired_at is null and tenant_id = private.school_of())
    or private.has_capability('tenant:implement', 'school', tenant_id)
  );
drop policy if exists "implementation configures help destinations" on public.help_destinations;
create policy "implementation configures help destinations" on public.help_destinations
  for insert with check (private.has_capability('tenant:implement', 'school', tenant_id));
drop policy if exists "implementation amends help destinations" on public.help_destinations;
create policy "implementation amends help destinations" on public.help_destinations
  for update using (private.has_capability('tenant:implement', 'school', tenant_id))
  with check (private.has_capability('tenant:implement', 'school', tenant_id));

-- ── 3. What a request may carry ───────────────────────────────────────────
--
-- The whole vocabulary. Adding a key here is a decision about what a student
-- can be asked to share, and the app's list must change in the same commit.

create or replace function private.help_context_ok(want jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(want) = 'object'
     and not exists (
       select 1 from jsonb_each(want) e
        where e.key not in ('course', 'assignment', 'requirement', 'plan', 'deadline', 'source', 'tried')
           or jsonb_typeof(e.value) <> 'string'
           or length(e.value #>> '{}') not between 1 and 600
     );
$$;
revoke all on function private.help_context_ok(jsonb) from public;
grant execute on function private.help_context_ok(jsonb) to authenticated;

-- ── 4. Requests ───────────────────────────────────────────────────────────

create table if not exists public.help_requests (
  id             uuid        primary key default gen_random_uuid(),
  student_id     uuid        not null references auth.users on delete cascade,
  destination_id uuid        not null references public.help_destinations on delete cascade,
  question       text        not null default '' check (length(question) <= 2000),
  shared_context jsonb       not null default '{}'::jsonb check (private.help_context_ok(shared_context)),
  status         text        not null default 'sent' check (status in (
                   'sent', 'acknowledged', 'scheduled', 'closed', 'withdrawn')),
  reply          text        not null default '' check (length(reply) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- A withdrawn request keeps its shape and loses its words.
  constraint help_request_withdrawn_is_empty check (
    status <> 'withdrawn' or (question = '' and shared_context = '{}'::jsonb and reply = '')),
  constraint help_request_live_has_question check (
    status = 'withdrawn' or length(trim(question)) between 1 and 2000)
);
create index if not exists help_requests_by_student on public.help_requests (student_id, created_at desc);
create index if not exists help_requests_by_destination on public.help_requests (destination_id, status);
alter table public.help_requests enable row level security;
revoke all on table public.help_requests from anon, authenticated;
grant select on table public.help_requests to authenticated;
drop policy if exists "a student reads their own help requests" on public.help_requests;
create policy "a student reads their own help requests" on public.help_requests
  for select using (student_id = (select auth.uid()));

-- ── 5. What happened to a request, for the student to read ────────────────

create table if not exists public.help_request_events (
  id         uuid        primary key default gen_random_uuid(),
  request_id uuid        not null references public.help_requests on delete cascade,
  kind       text        not null check (kind in (
               'sent', 'opened', 'acknowledged', 'scheduled', 'closed', 'withdrawn')),
  actor_id   uuid        references auth.users on delete set null,
  at         timestamptz not null default now()
);
create index if not exists help_request_events_by_request on public.help_request_events (request_id, at);
create index if not exists help_request_events_by_actor on public.help_request_events (actor_id);
alter table public.help_request_events enable row level security;
revoke all on table public.help_request_events from anon, authenticated;
grant select on table public.help_request_events to authenticated;
drop policy if exists "a student sees what happened to their request" on public.help_request_events;
create policy "a student sees what happened to their request" on public.help_request_events
  for select using (exists (select 1 from public.help_requests r
                             where r.id = request_id and r.student_id = (select auth.uid())));

-- ── 6. The only ways in ───────────────────────────────────────────────────

-- Whether the caller answers for a destination.
create or replace function private.answers_for(want_destination uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.help_destinations d
     where d.id = want_destination
       and private.has_capability('help_request:respond', d.scope_kind, d.scope_id)
  );
$$;
revoke all on function private.answers_for(uuid) from public;
grant execute on function private.answers_for(uuid) to authenticated;

-- A student sends their own question to one destination at their school.
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

  insert into public.help_requests (student_id, destination_id, question, shared_context)
  values (me, d.id, trim(coalesce(want_question, '')), coalesce(want_context, '{}'::jsonb))
  returning id into new_id;

  insert into public.help_request_events (request_id, kind, actor_id) values (new_id, 'sent', me);
  return new_id;
end $$;
revoke all on function public.send_help_request(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.send_help_request(uuid, text, jsonb) to authenticated;

-- A student takes it back. The words go; the fact that it existed stays.
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
     set status = 'withdrawn', question = '', shared_context = '{}'::jsonb, reply = '', updated_at = now()
   where id = want and student_id = me and status in ('sent', 'acknowledged', 'scheduled');
  if not found then
    raise exception 'not a request you can withdraw' using errcode = '42501';
  end if;
  insert into public.help_request_events (request_id, kind, actor_id) values (want, 'withdrawn', me);
end $$;
revoke all on function public.withdraw_help_request(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_help_request(uuid) to authenticated;

-- Staff see that requests exist, not what they say.
create or replace function public.help_inbox(want_destination uuid)
returns table (request_id uuid, status text, created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.answers_for(want_destination) then
    raise exception 'not your inbox' using errcode = '42501';
  end if;
  return query
    select r.id, r.status, r.created_at, r.updated_at
      from public.help_requests r
     where r.destination_id = want_destination and r.status <> 'withdrawn'
     order by r.created_at;
end $$;
revoke all on function public.help_inbox(uuid) from public, anon, authenticated;
grant execute on function public.help_inbox(uuid) to authenticated;

-- Opening one is recorded, every time, where the student can see it.
-- Dropped first so a second run of this file (a repair, a restore rehearsal)
-- can replace the wider version 20260927232000 and 234000 leave behind.
drop function if exists public.open_help_request(uuid);
create or replace function public.open_help_request(want uuid)
returns table (question text, shared_context jsonb, status text, created_at timestamptz)
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
  return query select r.question, r.shared_context, r.status, r.created_at;
end $$;
revoke all on function public.open_help_request(uuid) from public, anon, authenticated;
grant execute on function public.open_help_request(uuid) to authenticated;

-- Staff move a request forward, and may leave the student a short reply.
-- The allowed moves are the table in `app/src/lib/help-routes.ts`.
create or replace function public.answer_help_request(want uuid, want_status text, want_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.help_requests%rowtype;
begin
  select * into r from public.help_requests x where x.id = want for update;
  if not found or not private.answers_for(r.destination_id) or r.student_id = (select auth.uid()) then
    raise exception 'not a request you can answer' using errcode = '42501';
  end if;
  if not ((r.status = 'sent'         and want_status in ('acknowledged', 'scheduled', 'closed'))
       or (r.status = 'acknowledged' and want_status in ('scheduled', 'closed'))
       or (r.status = 'scheduled'    and want_status = 'closed')) then
    raise exception 'cannot move a % request to %', r.status, want_status using errcode = '22023';
  end if;
  update public.help_requests
     set status = want_status,
         reply = left(coalesce(nullif(trim(want_reply), ''), reply), 1000),
         updated_at = now()
   where id = r.id;
  insert into public.help_request_events (request_id, kind, actor_id)
  values (r.id, want_status, (select auth.uid()));
end $$;
revoke all on function public.answer_help_request(uuid, text, text) from public, anon, authenticated;
grant execute on function public.answer_help_request(uuid, text, text) to authenticated;

-- "Delete my account" empties this from the client (`OWNED_TABLES` in
-- `app/src/lib/cloud.ts`), and no API role holds DELETE on the table, so this
-- is the one door. Events go with their request.
create or replace function public.forget_my_help_requests()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.help_requests where student_id = (select auth.uid());
$$;
revoke all on function public.forget_my_help_requests() from public, anon, authenticated;
grant execute on function public.forget_my_help_requests() to authenticated;

-- ── 7. A help request is something a person did ──────────────────────────
--
-- `lti_account_untouched` decides whether a Brightspace launch may adopt an
-- account as a fresh one. An account that has asked an office for help is not
-- fresh, so the list gains `help_requests`; its events cascade from it and
-- need no line of their own. Otherwise the definition from
-- 20260925103000_support_access.sql, unchanged — `ltiaccount.test.ts` reads
-- whichever migration defines it last.
create or replace function public.lti_account_untouched(who uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  hit integer;
begin
  for t in
    select * from (values
      ('public.state',                'user_id'),
      ('public.courses',              'user_id'),
      ('public.notes',                'user_id'),
      ('public.tasks',                'user_id'),
      ('public.appointments',         'user_id'),
      ('public.sittings',             'user_id'),
      ('public.calendar_feeds',       'user_id'),
      ('public.messages',             'user_id'),
      ('public.message_reactions',    'user_id'),
      ('public.group_members',        'user_id'),
      ('public.enrollments',          'user_id'),
      ('public.blocks',               'user_id'),
      ('public.referrals',            'user_id'),
      ('public.referral_codes',       'user_id'),
      ('public.forms',                'owner'),
      ('public.family_grants',        'student_id'),
      ('public.feedback',             'author'),
      ('public.organization_members', 'user_id'),
      ('public.support_access_grant', 'student_id'),
      ('public.support_access_grant', 'supporter_id'),
      ('public.help_requests',        'student_id')
    ) as x(rel, col)
  loop
    if pg_catalog.to_regclass(t.rel) is null then continue; end if;
    execute pg_catalog.format(
      'select 1 from %s where %I = $1 limit 1', t.rel, t.col
    ) into hit using who;
    if hit is not null then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.lti_account_untouched(uuid) from public;
revoke all on function public.lti_account_untouched(uuid)
  from anon, authenticated;
