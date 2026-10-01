-- Semester — rooms and spaces, a booking flow, and a timetable a person
-- publishes, for a school that runs the `scheduling` module in Core (D-151).
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- These are a campus's physical spaces (`campus_spaces`), not the study rooms
-- of `20260901000400_rooms.sql`.
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer refuses unless the school's `scheduling`
--     module is `core`, not frozen, and `kill.core_modules` is disengaged.
--   * **A space is kept by history.** A `scheduling_officer` (`space:manage`)
--     saves a space — code, building, capacity, features, whether it can be
--     booked — and retires it; each change writes an event with the old and the
--     new, and nothing is deleted.
--   * **A double booking cannot exist.** No two confirmed bookings of a space
--     overlap, whoever writes the row: a trigger takes a per-space lock and
--     refuses the second, so two officers confirming at once cannot both win.
--   * **Who books what.** Any member of the school requests a booking of a
--     bookable space for a meeting, an event or study, in the future and for at
--     most twelve hours; a different `space:approve` holder confirms or
--     declines it (never the requester). A class or an exam is booked only by a
--     `space:approve` holder, directly. The requester or an officer cancels.
--   * **A timetable is verified, then published by a second person.** A solver
--     runs in the browser (`app/src/lib/timetable/`) over sections, instructors,
--     rooms and time patterns and proposes an assignment; `timetable_run_save`
--     (`timetable:run`) keeps the input and the proposal, and the database
--     re-checks it itself — a room or an instructor in two places at once, a room
--     smaller than the section, a missing feature, a space that is retired or not
--     bookable, a time pattern that is not one. `timetable_publish`
--     (`timetable:publish`, never the person who saved the run) refuses a run with
--     any conflict and otherwise writes each section's meeting times to the
--     registration catalog and keeps the rooms with the run.
--   * **Nothing is decided by a model.** The solver is a deterministic rule set
--     with a seed; a person publishes.
--
-- Not here, on purpose: recurring class meetings are not turned into bookings,
-- so an ad hoc booking is not checked against a published class meeting (a
-- school that wants a class hold books it as a `class` booking); the registration
-- catalog stores meeting times, not rooms, so the rooms live with the published
-- run.

-- ── Roles and capabilities ──────────────────────────────────────────────

insert into public.app_roles (role, global) values ('scheduling_officer', false)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('space:manage',      'Save and retire a campus space, for one school.'),
  ('space:approve',     'Confirm or decline a booking request and book a class or an exam directly, never one they requested, for one school.'),
  ('timetable:run',     'Keep a solver run: its input and the assignment it proposed, for one school.'),
  ('timetable:publish', 'Publish a verified timetable run to the registration catalog, never one they saved, for one school.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('scheduling_officer', 'space:manage'),
  ('scheduling_officer', 'space:approve'),
  ('scheduling_officer', 'timetable:run'),
  ('registrar',          'timetable:publish'),
  ('scheduling_officer', 'timetable:publish')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.scheduling_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('space', 'retire', 'request', 'decide', 'make', 'cancel', 'run', 'publish')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.campus_spaces (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  code        text        not null check (code ~ '^[A-Z0-9][A-Z0-9 .-]{0,29}$'),
  name        text        not null check (length(btrim(name)) between 1 and 200),
  building    text        not null default '' check (length(building) <= 200),
  capacity    integer     not null check (capacity between 1 and 10000),
  features    text[]      not null default '{}',
  bookable    boolean     not null default true,
  retired_at  timestamptz,
  created_by  uuid        references auth.users on delete set null,
  created_at  timestamptz not null default clock_timestamp(),
  unique (tenant_id, code)
);

create table if not exists public.space_events (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  space_id   uuid        not null references public.campus_spaces on delete cascade,
  kind       text        not null check (kind in ('created', 'changed', 'retired')),
  before     jsonb,
  after      jsonb,
  actor      uuid        references auth.users on delete set null,
  at         timestamptz not null default clock_timestamp()
);

create table if not exists public.space_bookings (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  space_id     uuid        not null references public.campus_spaces on delete cascade,
  requester    uuid        not null references auth.users on delete cascade,
  purpose      text        not null check (purpose in ('meeting', 'event', 'study', 'class', 'exam')),
  title        text        not null check (length(btrim(title)) between 1 and 200),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text        not null default 'requested' check (status in ('requested', 'confirmed', 'declined', 'cancelled')),
  decided_by   uuid        references auth.users on delete set null,
  decided_at   timestamptz,
  note         text        not null default '' check (length(note) <= 1000),
  created_at   timestamptz not null default clock_timestamp(),
  operation    text        not null,
  constraint space_booking_window check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours')
);

create table if not exists public.space_booking_events (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  booking_id uuid        not null references public.space_bookings on delete cascade,
  kind       text        not null check (kind in ('requested', 'confirmed', 'declined', 'cancelled')),
  actor      uuid        references auth.users on delete set null,
  note       text        not null default '' check (length(note) <= 1000),
  at         timestamptz not null default clock_timestamp()
);

create table if not exists public.timetable_runs (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  term        text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  input       jsonb       not null,
  proposal    jsonb       not null,
  input_hash  text        not null check (input_hash ~ '^[0-9a-f]{64}$'),
  conflicts   jsonb       not null,
  saved_by    uuid        references auth.users on delete set null,
  saved_at    timestamptz not null default clock_timestamp(),
  operation   text        not null
);

create table if not exists public.timetable_publications (
  run_id       uuid        primary key references public.timetable_runs on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  sections     integer     not null,
  published_by uuid        references auth.users on delete set null,
  published_at timestamptz not null default clock_timestamp()
);

create index if not exists scheduling_operations_by_actor on public.scheduling_operations (actor);
create index if not exists campus_spaces_by_creator on public.campus_spaces (created_by);
create index if not exists space_events_by_space on public.space_events (space_id, at);
create index if not exists space_events_by_tenant on public.space_events (tenant_id);
create index if not exists space_events_by_actor on public.space_events (actor);
create index if not exists space_bookings_by_space on public.space_bookings (space_id, starts_at);
create index if not exists space_bookings_by_tenant on public.space_bookings (tenant_id);
create index if not exists space_bookings_by_requester on public.space_bookings (requester);
create index if not exists space_bookings_by_decider on public.space_bookings (decided_by);
create index if not exists space_booking_events_by_booking on public.space_booking_events (booking_id, at);
create index if not exists space_booking_events_by_tenant on public.space_booking_events (tenant_id);
create index if not exists space_booking_events_by_actor on public.space_booking_events (actor);
create index if not exists timetable_runs_by_term on public.timetable_runs (tenant_id, term, saved_at desc);
create index if not exists timetable_runs_by_saver on public.timetable_runs (saved_by);
create index if not exists timetable_publications_by_tenant on public.timetable_publications (tenant_id);
create index if not exists timetable_publications_by_publisher on public.timetable_publications (published_by);

comment on table public.scheduling_operations is 'Idempotency keys the scheduling writers spent, with what each asked and answered. Append-only.';
comment on table public.campus_spaces is 'A physical room or space a school books. Changes are kept as events; nothing is deleted.';
comment on table public.space_events is 'Every change to a space: the old and the new. Append-only.';
comment on table public.space_bookings is 'A booking of a space. Confirmed bookings of one space never overlap. Goes with the requester''s account.';
comment on table public.space_booking_events is 'Every step of a booking. Append-only.';
comment on table public.timetable_runs is 'A solver run: its input, the assignment it proposed and the conflicts the database found. Never rewritten.';
comment on table public.timetable_publications is 'That a person published a run, and how many sections it set.';

-- ── Guards ──────────────────────────────────────────────────────────────

-- No two confirmed bookings of a space overlap, whoever writes the row.
create or replace function private.guard_space_booking()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'confirmed' then
    perform pg_advisory_xact_lock(hashtext('space:' || new.space_id::text));
    if exists (select 1 from public.space_bookings b
                where b.space_id = new.space_id and b.status = 'confirmed' and b.id <> new.id
                  and tstzrange(b.starts_at, b.ends_at) && tstzrange(new.starts_at, new.ends_at)) then
      raise exception 'semester: that space is already booked at that time' using errcode = 'exclusion_violation';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'status' - 'decided_by' - 'decided_at' - 'note' - 'requester') is distinct from (to_jsonb(old) - 'status' - 'decided_by' - 'decided_at' - 'note' - 'requester') then
      raise exception 'semester: a booking''s space, time and title are never edited; cancel it and make another' using errcode = 'insufficient_privilege';
    end if;
    if old.status in ('declined', 'cancelled') and new.status is distinct from old.status then
      raise exception 'semester: a declined or cancelled booking stays so' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_space_booking() from public, anon, authenticated;
drop trigger if exists space_bookings_no_overlap on public.space_bookings;
create trigger space_bookings_no_overlap before insert or update on public.space_bookings
for each row execute function private.guard_space_booking();

-- Spaces change only by retiring (once); the rest is saved by the writer, which
-- writes an event for every change.
create or replace function private.guard_campus_space()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.retired_at is not null and (to_jsonb(new) - 'created_by') is distinct from (to_jsonb(old) - 'created_by') then
    raise exception 'semester: a retired space is never changed' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'name' - 'building' - 'capacity' - 'features' - 'bookable' - 'retired_at' - 'created_by')
     is distinct from (to_jsonb(old) - 'name' - 'building' - 'capacity' - 'features' - 'bookable' - 'retired_at' - 'created_by') then
    raise exception 'semester: a space''s code and school are never changed' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_campus_space() from public, anon, authenticated;
drop trigger if exists campus_spaces_guarded on public.campus_spaces;
create trigger campus_spaces_guarded before update on public.campus_spaces
for each row execute function private.guard_campus_space();

-- Append-only records: only `ON DELETE SET NULL` of the person column may touch one.
create or replace function private.guard_scheduling_record()
returns trigger language plpgsql set search_path = '' as $$
declare
  person_col text := case tg_table_name
    when 'space_events' then 'actor'
    when 'space_booking_events' then 'actor'
    when 'timetable_runs' then 'saved_by'
    when 'timetable_publications' then 'published_by'
    else null end;
  was uuid;
  became uuid;
begin
  if person_col is not null then
    was := (to_jsonb(old) ->> person_col)::uuid;
    became := (to_jsonb(new) ->> person_col)::uuid;
    if (to_jsonb(new) - person_col) is not distinct from (to_jsonb(old) - person_col) and (became is null or became is not distinct from was) then
      return new;
    end if;
  end if;
  raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.guard_scheduling_record() from public, anon, authenticated;
drop trigger if exists space_events_never_rewritten on public.space_events;
create trigger space_events_never_rewritten before update on public.space_events for each row execute function private.guard_scheduling_record();
drop trigger if exists space_booking_events_never_rewritten on public.space_booking_events;
create trigger space_booking_events_never_rewritten before update on public.space_booking_events for each row execute function private.guard_scheduling_record();
drop trigger if exists timetable_runs_never_rewritten on public.timetable_runs;
create trigger timetable_runs_never_rewritten before update on public.timetable_runs for each row execute function private.guard_scheduling_record();
drop trigger if exists timetable_publications_never_rewritten on public.timetable_publications;
create trigger timetable_publications_never_rewritten before update on public.timetable_publications for each row execute function private.guard_scheduling_record();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.scheduling_member(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant);
$$;
revoke all on function private.scheduling_member(text) from public, anon, authenticated;
grant execute on function private.scheduling_member(text) to authenticated;

create or replace function private.scheduling_staff(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.scheduling_member(want_tenant)
     and (private.has_capability('space:approve', 'school', want_tenant) or private.has_capability('space:manage', 'school', want_tenant)
          or private.has_capability('timetable:run', 'school', want_tenant) or private.has_capability('timetable:publish', 'school', want_tenant));
$$;
revoke all on function private.scheduling_staff(text) from public, anon, authenticated;
grant execute on function private.scheduling_staff(text) to authenticated;

alter table public.scheduling_operations enable row level security;
alter table public.campus_spaces enable row level security;
alter table public.space_events enable row level security;
alter table public.space_bookings enable row level security;
alter table public.space_booking_events enable row level security;
alter table public.timetable_runs enable row level security;
alter table public.timetable_publications enable row level security;

revoke all on table public.scheduling_operations from public, anon, authenticated;
revoke all on table public.campus_spaces from public, anon, authenticated;
revoke all on table public.space_events from public, anon, authenticated;
revoke all on table public.space_bookings from public, anon, authenticated;
revoke all on table public.space_booking_events from public, anon, authenticated;
revoke all on table public.timetable_runs from public, anon, authenticated;
revoke all on table public.timetable_publications from public, anon, authenticated;
grant select on table public.scheduling_operations to authenticated;
grant select on table public.campus_spaces to authenticated;
grant select on table public.space_events to authenticated;
grant select on table public.space_bookings to authenticated;
grant select on table public.space_booking_events to authenticated;
grant select on table public.timetable_runs to authenticated;
grant select on table public.timetable_publications to authenticated;

drop policy if exists "callers read their own scheduling operations" on public.scheduling_operations;
create policy "callers read their own scheduling operations" on public.scheduling_operations
  for select to authenticated using (actor = (select auth.uid()));

-- Members of the school see its spaces (to choose one); retired ones too, for the record.
drop policy if exists "school members read spaces" on public.campus_spaces;
create policy "school members read spaces" on public.campus_spaces
  for select to authenticated using (private.scheduling_member(tenant_id));

drop policy if exists "staff read space history" on public.space_events;
create policy "staff read space history" on public.space_events
  for select to authenticated using (private.scheduling_staff(tenant_id));

-- A booking is read by its requester, by staff, and, once confirmed, by any
-- member (so a room shows as taken without saying by whom, in the app).
drop policy if exists "requesters and staff read bookings, members read confirmed" on public.space_bookings;
create policy "requesters and staff read bookings, members read confirmed" on public.space_bookings
  for select to authenticated using (
    requester = (select auth.uid()) or private.scheduling_staff(tenant_id)
    or (status = 'confirmed' and private.scheduling_member(tenant_id)));

drop policy if exists "requesters and staff read booking history" on public.space_booking_events;
create policy "requesters and staff read booking history" on public.space_booking_events
  for select to authenticated using (
    private.scheduling_staff(tenant_id) or exists (select 1 from public.space_bookings b where b.id = booking_id and b.requester = (select auth.uid())));

drop policy if exists "staff read timetable runs" on public.timetable_runs;
create policy "staff read timetable runs" on public.timetable_runs
  for select to authenticated using (private.scheduling_staff(tenant_id));

drop policy if exists "staff read publications" on public.timetable_publications;
create policy "staff read publications" on public.timetable_publications
  for select to authenticated using (private.scheduling_staff(tenant_id));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.scheduling_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.scheduling_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('scheduling-op:' || school || ':' || want_key));
  select * into op from public.scheduling_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.scheduling_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.scheduling_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.scheduling_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.scheduling_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.scheduling_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'scheduling') then
    raise exception 'semester: this school does not run scheduling in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.scheduling_core_required(text) from public, anon, authenticated;

create or replace function private.scheduling_require(school text, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'school', school) then
    raise exception 'semester: that needs % at this school', want_cap using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.scheduling_require(text, text) from public, anon, authenticated;

-- A meeting pattern is {days: [0-6], start, end} in minutes, end after start.
create or replace function private.scheduling_pattern_ok(m jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(m) = 'object'
     and (m - array['days', 'start', 'end']::text[]) = '{}'::jsonb
     and jsonb_typeof(m->'days') = 'array' and jsonb_array_length(m->'days') > 0
     and not jsonb_path_exists(m->'days', '$[*] ? (@.type() != "number" || @ < 0 || @ > 6 || @ != @.floor())')
     and jsonb_typeof(m->'start') = 'number' and jsonb_typeof(m->'end') = 'number'
     and (m->>'start')::numeric between 0 and 1439 and (m->>'end')::numeric between 1 and 1440
     and (m->>'start')::numeric = floor((m->>'start')::numeric) and (m->>'end')::numeric = floor((m->>'end')::numeric)
     and (m->>'end')::numeric > (m->>'start')::numeric;
$$;
revoke all on function private.scheduling_pattern_ok(jsonb) from public, anon, authenticated;

-- Whether two patterns share a day and overlap in time.
create or replace function private.scheduling_clash(a jsonb, b jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (a->>'start')::numeric < (b->>'end')::numeric and (b->>'start')::numeric < (a->>'end')::numeric
     and exists (select 1 from jsonb_array_elements(a->'days') x join jsonb_array_elements(b->'days') y on x = y);
$$;
revoke all on function private.scheduling_clash(jsonb, jsonb) from public, anon, authenticated;

-- What is wrong with a proposed timetable, found from the input it names and the
-- database's own facts about rooms. Input: {sections: [{course, section,
-- enrolment, instructor, needs: [feature]}]}. Proposal: {assignments: [{course,
-- section, room, meeting: {days, start, end}}]}. An empty array is a clean run.
create or replace function private.timetable_conflicts(want_tenant text, want_input jsonb, want_proposal jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  found jsonb := '[]'::jsonb;
  a jsonb;
  b jsonb;
  sa jsonb;
  sb jsonb;
  sp public.campus_spaces;
  i integer;
  j integer;
  items jsonb := coalesce(want_proposal->'assignments', '[]'::jsonb);
  n integer := jsonb_array_length(coalesce(want_proposal->'assignments', '[]'::jsonb));
  who text;
begin
  for i in 0 .. n - 1 loop
    a := items -> i;
    if not private.scheduling_pattern_ok(a->'meeting') then
      found := found || jsonb_build_array(jsonb_build_object('kind', 'pattern', 'section', (a->>'course') || ' ' || (a->>'section')));
      continue;
    end if;
    select x into sa from jsonb_array_elements(want_input->'sections') x where x->>'course' = a->>'course' and x->>'section' = a->>'section' limit 1;
    if sa is null then
      found := found || jsonb_build_array(jsonb_build_object('kind', 'unknown_section', 'section', (a->>'course') || ' ' || (a->>'section')));
      continue;
    end if;
    select * into sp from public.campus_spaces s where s.tenant_id = want_tenant and s.code = a->>'room';
    if sp.id is null or sp.retired_at is not null or not sp.bookable then
      found := found || jsonb_build_array(jsonb_build_object('kind', 'room_unavailable', 'section', (a->>'course') || ' ' || (a->>'section'), 'room', a->>'room'));
    else
      if sp.capacity < coalesce((sa->>'enrolment')::integer, 0) then
        found := found || jsonb_build_array(jsonb_build_object('kind', 'too_small', 'section', (a->>'course') || ' ' || (a->>'section'), 'room', sp.code));
      end if;
      if exists (select 1 from jsonb_array_elements_text(coalesce(sa->'needs', '[]'::jsonb)) f where not (f = any (sp.features))) then
        found := found || jsonb_build_array(jsonb_build_object('kind', 'missing_feature', 'section', (a->>'course') || ' ' || (a->>'section'), 'room', sp.code));
      end if;
    end if;
  end loop;
  for i in 0 .. n - 2 loop
    a := items -> i;
    continue when not private.scheduling_pattern_ok(a->'meeting');
    for j in i + 1 .. n - 1 loop
      b := items -> j;
      continue when not private.scheduling_pattern_ok(b->'meeting');
      continue when not private.scheduling_clash(a->'meeting', b->'meeting');
      if a->>'room' = b->>'room' then
        found := found || jsonb_build_array(jsonb_build_object('kind', 'room_twice', 'room', a->>'room',
          'sections', jsonb_build_array((a->>'course') || ' ' || (a->>'section'), (b->>'course') || ' ' || (b->>'section'))));
      end if;
      select x into sa from jsonb_array_elements(want_input->'sections') x where x->>'course' = a->>'course' and x->>'section' = a->>'section' limit 1;
      select x into sb from jsonb_array_elements(want_input->'sections') x where x->>'course' = b->>'course' and x->>'section' = b->>'section' limit 1;
      who := nullif(btrim(coalesce(sa->>'instructor', '')), '');
      if who is not null and who = nullif(btrim(coalesce(sb->>'instructor', '')), '') then
        found := found || jsonb_build_array(jsonb_build_object('kind', 'instructor_twice', 'instructor', who,
          'sections', jsonb_build_array((a->>'course') || ' ' || (a->>'section'), (b->>'course') || ' ' || (b->>'section'))));
      end if;
    end loop;
  end loop;
  return found;
end $$;
revoke all on function private.timetable_conflicts(text, jsonb, jsonb) from public, anon, authenticated;

-- ── Spaces ──────────────────────────────────────────────────────────────

create or replace function public.space_save(
  want_code text, want_name text, want_building text, want_capacity integer, want_features text[], want_bookable boolean, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  scode  text := upper(btrim(coalesce(want_code, '')));
  req    jsonb := jsonb_build_object('code', upper(btrim(coalesce(want_code, ''))), 'name', want_name, 'building', coalesce(want_building, ''),
                    'capacity', want_capacity, 'features', coalesce(want_features, '{}'), 'bookable', coalesce(want_bookable, true));
  prior  jsonb;
  old    public.campus_spaces;
  made   uuid;
  feats  text[];
  result jsonb;
begin
  perform private.scheduling_require(school, 'space:manage');
  prior := private.scheduling_replay(school, want_key, 'space', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  select coalesce(array_agg(distinct lower(btrim(f)) order by lower(btrim(f))), '{}') into feats from unnest(coalesce(want_features, '{}')) f where btrim(f) <> '';
  select * into old from public.campus_spaces s where s.tenant_id = school and s.code = scode for update;
  if old.id is null then
    insert into public.campus_spaces (tenant_id, code, name, building, capacity, features, bookable, created_by)
    values (school, scode, btrim(want_name), btrim(coalesce(want_building, '')), want_capacity, feats, coalesce(want_bookable, true), me) returning id into made;
    insert into public.space_events (tenant_id, space_id, kind, after, actor)
    values (school, made, 'created', jsonb_build_object('name', btrim(want_name), 'building', btrim(coalesce(want_building, '')), 'capacity', want_capacity, 'features', feats, 'bookable', coalesce(want_bookable, true)), me);
  else
    if old.retired_at is not null then raise exception 'semester: that space is retired' using errcode = 'check_violation'; end if;
    update public.campus_spaces set name = btrim(want_name), building = btrim(coalesce(want_building, '')), capacity = want_capacity,
           features = feats, bookable = coalesce(want_bookable, true) where id = old.id;
    made := old.id;
    insert into public.space_events (tenant_id, space_id, kind, before, after, actor)
    values (school, old.id, 'changed',
            jsonb_build_object('name', old.name, 'building', old.building, 'capacity', old.capacity, 'features', old.features, 'bookable', old.bookable),
            jsonb_build_object('name', btrim(want_name), 'building', btrim(coalesce(want_building, '')), 'capacity', want_capacity, 'features', feats, 'bookable', coalesce(want_bookable, true)), me);
  end if;
  result := jsonb_build_object('id', made);
  perform private.scheduling_spend(school, want_key, 'space', req, result);
  return result;
end $$;

create or replace function public.space_retire(want_code text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  scode  text := upper(btrim(coalesce(want_code, '')));
  req    jsonb := jsonb_build_object('code', upper(btrim(coalesce(want_code, ''))));
  prior  jsonb;
  s      public.campus_spaces;
  result jsonb;
begin
  perform private.scheduling_require(school, 'space:manage');
  prior := private.scheduling_replay(school, want_key, 'retire', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  select * into s from public.campus_spaces x where x.tenant_id = school and x.code = scode for update;
  if s.id is null then raise exception 'semester: no such space' using errcode = 'no_data_found'; end if;
  if s.retired_at is not null then raise exception 'semester: that space is already retired' using errcode = 'check_violation'; end if;
  update public.campus_spaces set retired_at = clock_timestamp() where id = s.id;
  insert into public.space_events (tenant_id, space_id, kind, actor) values (school, s.id, 'retired', me);
  result := jsonb_build_object('code', scode, 'retired', true);
  perform private.scheduling_spend(school, want_key, 'retire', req, result);
  return result;
end $$;

-- ── Bookings ────────────────────────────────────────────────────────────

create or replace function public.space_booking_request(
  want_space text, want_purpose text, want_title text, want_starts timestamptz, want_ends timestamptz, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  scode  text := upper(btrim(coalesce(want_space, '')));
  req    jsonb := jsonb_build_object('space', upper(btrim(coalesce(want_space, ''))), 'purpose', want_purpose, 'title', want_title, 'starts', want_starts, 'ends', want_ends);
  prior  jsonb;
  s      public.campus_spaces;
  made   uuid;
  result jsonb;
begin
  prior := private.scheduling_replay(school, want_key, 'request', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  if want_purpose not in ('meeting', 'event', 'study') then
    raise exception 'semester: a request is for a meeting, an event or study; a class or an exam is booked by the scheduling office' using errcode = 'check_violation';
  end if;
  select * into s from public.campus_spaces x where x.tenant_id = school and x.code = scode;
  if s.id is null or s.retired_at is not null or not s.bookable then raise exception 'semester: that space cannot be booked' using errcode = 'check_violation'; end if;
  if want_starts is null or want_ends is null or want_starts < clock_timestamp() - interval '5 minutes' then
    raise exception 'semester: a booking is for the future' using errcode = 'check_violation';
  end if;
  insert into public.space_bookings (tenant_id, space_id, requester, purpose, title, starts_at, ends_at, operation)
  values (school, s.id, me, want_purpose, btrim(coalesce(want_title, '')), want_starts, want_ends, want_key) returning id into made;
  insert into public.space_booking_events (tenant_id, booking_id, kind, actor) values (school, made, 'requested', me);
  result := jsonb_build_object('id', made, 'status', 'requested');
  perform private.scheduling_spend(school, want_key, 'request', req, result);
  return result;
end $$;

create or replace function public.space_booking_decide(want_booking uuid, want_confirm boolean, want_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('booking', want_booking, 'confirm', want_confirm, 'note', coalesce(want_note, ''));
  prior  jsonb;
  b      public.space_bookings;
  result jsonb;
begin
  perform private.scheduling_require(school, 'space:approve');
  prior := private.scheduling_replay(school, want_key, 'decide', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  select * into b from public.space_bookings x where x.id = want_booking and x.tenant_id = school for update;
  if b.id is null then raise exception 'semester: no such booking' using errcode = 'no_data_found'; end if;
  if b.requester = me then raise exception 'semester: a booking is decided by someone other than who requested it' using errcode = 'insufficient_privilege'; end if;
  if b.status <> 'requested' then raise exception 'semester: that booking is already decided' using errcode = 'check_violation'; end if;
  update public.space_bookings set status = case when want_confirm then 'confirmed' else 'declined' end,
         decided_by = me, decided_at = clock_timestamp(), note = btrim(coalesce(want_note, '')) where id = want_booking;
  insert into public.space_booking_events (tenant_id, booking_id, kind, actor, note)
  values (school, want_booking, case when want_confirm then 'confirmed' else 'declined' end, me, btrim(coalesce(want_note, '')));
  result := jsonb_build_object('id', want_booking, 'status', case when want_confirm then 'confirmed' else 'declined' end);
  perform private.scheduling_spend(school, want_key, 'decide', req, result);
  return result;
end $$;

-- A class or an exam, booked by the scheduling office straight into a space.
create or replace function public.space_booking_make(
  want_space text, want_purpose text, want_title text, want_starts timestamptz, want_ends timestamptz, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  scode  text := upper(btrim(coalesce(want_space, '')));
  req    jsonb := jsonb_build_object('space', upper(btrim(coalesce(want_space, ''))), 'purpose', want_purpose, 'title', want_title, 'starts', want_starts, 'ends', want_ends);
  prior  jsonb;
  s      public.campus_spaces;
  made   uuid;
  result jsonb;
begin
  perform private.scheduling_require(school, 'space:approve');
  prior := private.scheduling_replay(school, want_key, 'make', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  if want_purpose not in ('class', 'exam', 'meeting', 'event') then
    raise exception 'semester: a class, an exam, a meeting or an event' using errcode = 'check_violation';
  end if;
  select * into s from public.campus_spaces x where x.tenant_id = school and x.code = scode;
  if s.id is null or s.retired_at is not null then raise exception 'semester: that space cannot be booked' using errcode = 'check_violation'; end if;
  insert into public.space_bookings (tenant_id, space_id, requester, purpose, title, starts_at, ends_at, status, decided_by, decided_at, operation)
  values (school, s.id, me, want_purpose, btrim(coalesce(want_title, '')), want_starts, want_ends, 'confirmed', me, clock_timestamp(), want_key) returning id into made;
  insert into public.space_booking_events (tenant_id, booking_id, kind, actor) values (school, made, 'confirmed', me);
  result := jsonb_build_object('id', made, 'status', 'confirmed');
  perform private.scheduling_spend(school, want_key, 'make', req, result);
  return result;
end $$;

create or replace function public.space_booking_cancel(want_booking uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('booking', want_booking);
  prior  jsonb;
  b      public.space_bookings;
  result jsonb;
begin
  prior := private.scheduling_replay(school, want_key, 'cancel', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  select * into b from public.space_bookings x where x.id = want_booking and x.tenant_id = school for update;
  if b.id is null then raise exception 'semester: no such booking' using errcode = 'no_data_found'; end if;
  if b.requester <> me and not private.has_capability('space:approve', 'school', school) then
    raise exception 'semester: only who requested a booking, or the scheduling office, cancels it' using errcode = 'insufficient_privilege';
  end if;
  if b.status in ('declined', 'cancelled') then raise exception 'semester: that booking is already closed' using errcode = 'check_violation'; end if;
  update public.space_bookings set status = 'cancelled', decided_by = coalesce(decided_by, me), decided_at = coalesce(decided_at, clock_timestamp()) where id = want_booking;
  insert into public.space_booking_events (tenant_id, booking_id, kind, actor) values (school, want_booking, 'cancelled', me);
  result := jsonb_build_object('id', want_booking, 'status', 'cancelled');
  perform private.scheduling_spend(school, want_key, 'cancel', req, result);
  return result;
end $$;

-- ── Timetables ──────────────────────────────────────────────────────────

create or replace function public.timetable_run_save(want_term text, want_input jsonb, want_proposal jsonb, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('term', want_term, 'input', want_input, 'proposal', want_proposal);
  prior  jsonb;
  found  jsonb;
  made   uuid;
  result jsonb;
begin
  perform private.scheduling_require(school, 'timetable:run');
  prior := private.scheduling_replay(school, want_key, 'run', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then raise exception 'semester: that is not a term' using errcode = 'check_violation'; end if;
  if jsonb_typeof(want_input->'sections') is distinct from 'array' or jsonb_typeof(want_proposal->'assignments') is distinct from 'array'
     or length(want_input::text) > 400000 or length(want_proposal::text) > 400000 then
    raise exception 'semester: a run has sections and assignments, each a list, under 400,000 characters' using errcode = 'check_violation';
  end if;
  found := private.timetable_conflicts(school, want_input, want_proposal);
  insert into public.timetable_runs (tenant_id, term, input, proposal, input_hash, conflicts, saved_by, operation)
  values (school, want_term, want_input, want_proposal, encode(sha256(convert_to(want_input::text, 'UTF8')), 'hex'), found, me, want_key) returning id into made;
  result := jsonb_build_object('id', made, 'conflicts', found);
  perform private.scheduling_spend(school, want_key, 'run', req, result);
  return result;
end $$;

create or replace function public.timetable_publish(want_run uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('run', want_run);
  prior  jsonb;
  r      public.timetable_runs;
  found  jsonb;
  codes  text;
  n      integer := 0;
  result jsonb;
begin
  perform private.scheduling_require(school, 'timetable:publish');
  prior := private.scheduling_replay(school, want_key, 'publish', req);
  if prior is not null then return prior; end if;
  perform private.scheduling_core_required(school);
  select * into r from public.timetable_runs x where x.id = want_run and x.tenant_id = school for update;
  if r.id is null then raise exception 'semester: no such run' using errcode = 'no_data_found'; end if;
  if r.saved_by is not distinct from me then raise exception 'semester: a timetable is published by someone other than who saved the run' using errcode = 'insufficient_privilege'; end if;
  if exists (select 1 from public.timetable_publications p where p.run_id = want_run) then raise exception 'semester: that run is already published' using errcode = 'check_violation'; end if;
  -- Verified again now: the rooms may have changed since the run was saved.
  found := private.timetable_conflicts(school, r.input, r.proposal);
  if jsonb_array_length(found) > 0 then
    raise exception 'semester: that run has % conflict(s); a timetable with a conflict is not published', jsonb_array_length(found) using errcode = 'check_violation';
  end if;
  select string_agg(distinct (x->>'course') || ' ' || (x->>'section'), ', ') into codes
    from jsonb_array_elements(r.proposal->'assignments') x
   where not exists (select 1 from public.registration_sections s
                      where s.tenant_id = school and s.term = r.term and s.course_code = x->>'course' and s.section = x->>'section');
  if codes is not null then raise exception 'semester: the registration catalog has no section % for this term', codes using errcode = 'check_violation'; end if;
  -- Each section's meetings are all of its assignments' patterns.
  update public.registration_sections s
     set meetings = (select coalesce(jsonb_agg(x->'meeting' order by x->>'room'), '[]'::jsonb)
                       from jsonb_array_elements(r.proposal->'assignments') x
                      where x->>'course' = s.course_code and x->>'section' = s.section),
         version = s.version + 1, updated_by = me, updated_at = clock_timestamp()
   where s.tenant_id = school and s.term = r.term
     and exists (select 1 from jsonb_array_elements(r.proposal->'assignments') x where x->>'course' = s.course_code and x->>'section' = s.section);
  get diagnostics n = row_count;
  insert into public.timetable_publications (run_id, tenant_id, sections, published_by) values (want_run, school, n, me);
  result := jsonb_build_object('run', want_run, 'sections', n);
  perform private.scheduling_spend(school, want_key, 'publish', req, result);
  return result;
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────

revoke all on function public.space_save(text, text, text, integer, text[], boolean, text) from public, anon;
revoke all on function public.space_retire(text, text) from public, anon;
revoke all on function public.space_booking_request(text, text, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.space_booking_decide(uuid, boolean, text, text) from public, anon;
revoke all on function public.space_booking_make(text, text, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.space_booking_cancel(uuid, text) from public, anon;
revoke all on function public.timetable_run_save(text, jsonb, jsonb, text) from public, anon;
revoke all on function public.timetable_publish(uuid, text) from public, anon;
grant execute on function public.space_save(text, text, text, integer, text[], boolean, text) to authenticated;
grant execute on function public.space_retire(text, text) to authenticated;
grant execute on function public.space_booking_request(text, text, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.space_booking_decide(uuid, boolean, text, text) to authenticated;
grant execute on function public.space_booking_make(text, text, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.space_booking_cancel(uuid, text) to authenticated;
grant execute on function public.timetable_run_save(text, jsonb, jsonb, text) to authenticated;
grant execute on function public.timetable_publish(uuid, text) to authenticated;

-- ── An account that booked a space is not untouched ─────────────────────
--
-- The previous definition is `20261001060000_admissions.sql`, with one more
-- place to look; a booking goes with its requester's account.

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
      ('public.help_requests',        'student_id'),
      ('public.mentor_requests',      'requester'),
      ('public.mentor_requests',      'recipient'),
      ('public.peer_mentor_offers',   'user_id'),
      ('public.alumni_mentor_offers', 'user_id'),
      ('public.community_posts',      'author_id'),
      ('public.community_sessions',   'host_id'),
      ('public.community_session_participants', 'user_id'),
      ('public.community_mutes',      'user_id'),
      ('public.community_members',    'user_id'),
      ('public.community_aliases',    'user_id'),
      ('public.community_volunteers', 'user_id'),
      ('public.community_media',      'uploader_id'),
      ('public.graduation_scenarios', 'user_id'),
      ('public.advisor_shares',       'student_id'),
      ('public.advisor_shares',       'advisor_id'),
      ('public.family_invites',       'student_id'),
      ('public.family_shared_items',  'student_id'),
      ('public.family_access_events', 'student_id'),
      ('public.support_shares',       'student_id'),
      ('public.support_shares',       'staff_id'),
      ('public.registration_enrollments', 'student'),
      ('public.regrade_requests',     'student_id'),
      ('public.dining_orders',        'student'),
      ('public.submissions',          'student_id'),
      ('public.submission_receipts',  'student_id'),
      ('public.assignment_overrides', 'student_id'),
      ('public.attendance_marks',     'student_id'),
      -- 20261001030000: a student's test attempts and any extra time granted.
      ('public.assessment_attempts',  'student_id'),
      ('public.assessment_time_extensions', 'student_id'),
      -- 20261001060000: an application is the applicant's own.
      ('public.applications',         'applicant'),
      -- 20261001080000: a booking is its requester's own.
      ('public.space_bookings',       'requester')
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
