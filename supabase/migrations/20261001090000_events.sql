-- Semester — events with RSVPs, hosted by an office, a community or a course,
-- for a school that runs the `events` module in Core (D-151).
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer refuses unless the school's `events` module is
--     `core`, not frozen, and `kill.core_modules` is disengaged.
--   * **Anyone proposes, a manager publishes.** Any member of the school proposes an
--     event hosted by an office, a community or a course; an `events_manager`
--     (`events:manage`) publishes or declines it, never one they proposed. A
--     manager's own office event is published directly. Only a published event
--     is read by members; the proposer and managers read it throughout.
--   * **A space, if it wants one, is booked or the event is refused.** An event
--     that names a campus space needs the school's `scheduling` module in Core;
--     publishing it writes a confirmed booking for the same time, and an
--     overlapping booking refuses the publication, so an event never stands in a
--     room that is taken.
--   * **RSVPs are the member's own and the server's order.** A member RSVPs going
--     or cancels. Going past the capacity is a place on the waitlist, in the
--     order the server received it; when a place frees, the earliest waiting
--     member is promoted in the same transaction. Every change is a new version;
--     none is rewritten. Members see counts, never who. The proposer and managers
--     read the list.
--   * **A published event is cancelled, not deleted,** by its proposer or a
--     manager, with a reason; RSVPs stay.
--
-- Not here, on purpose: reminders and a calendar feed (the existing calendar
-- surfaces read published events when the school wants them), ticketing and
-- payments, and checking a host's standing in a community (a community's own
-- leaders are the community module's).

insert into public.app_roles (role, global) values ('events_manager', false)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('events:manage', 'Publish or decline a proposed event, publish an office event directly, cancel any event and read its RSVPs, for one school.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values ('events_manager', 'events:manage')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.events_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('propose', 'decide', 'direct', 'cancel', 'rsvp')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.campus_events (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  host_kind   text        not null check (host_kind in ('office', 'community', 'course')),
  host_ref    text        not null check (length(btrim(host_ref)) between 1 and 120),
  title       text        not null check (length(btrim(title)) between 1 and 200),
  description text        not null default '' check (length(description) <= 4000),
  location    text        not null default '' check (length(location) <= 200),
  space_id    uuid        references public.campus_spaces,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  capacity    integer     check (capacity is null or capacity between 1 and 100000),
  proposer    uuid        not null references auth.users on delete cascade,
  created_at  timestamptz not null default clock_timestamp(),
  operation   text        not null,
  constraint campus_event_window check (ends_at > starts_at and ends_at - starts_at <= interval '14 days')
);

create table if not exists public.event_decisions (
  event_id   uuid        primary key references public.campus_events on delete cascade,
  tenant_id  text        not null references public.schools(id) on delete cascade,
  decision   text        not null check (decision in ('published', 'declined')),
  decided_by uuid        references auth.users on delete set null,
  decided_at timestamptz not null default clock_timestamp(),
  note       text        not null default '' check (length(note) <= 1000),
  booking_id uuid        references public.space_bookings on delete set null
);

create table if not exists public.event_cancellations (
  event_id     uuid        primary key references public.campus_events on delete cascade,
  tenant_id    text        not null references public.schools(id) on delete cascade,
  cancelled_by uuid        references auth.users on delete set null,
  cancelled_at timestamptz not null default clock_timestamp(),
  reason       text        not null check (length(btrim(reason)) between 5 and 1000)
);

create table if not exists public.event_rsvps (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  event_id   uuid        not null references public.campus_events on delete cascade,
  member     uuid        not null references auth.users on delete cascade,
  version    integer     not null check (version >= 1),
  status     text        not null check (status in ('going', 'waitlisted', 'cancelled')),
  at         timestamptz not null default clock_timestamp(),
  unique (event_id, member, version)
);

create index if not exists events_operations_by_actor on public.events_operations (actor);
create index if not exists campus_events_by_tenant on public.campus_events (tenant_id, starts_at);
create index if not exists campus_events_by_space on public.campus_events (space_id);
create index if not exists campus_events_by_proposer on public.campus_events (proposer);
create index if not exists event_decisions_by_tenant on public.event_decisions (tenant_id);
create index if not exists event_decisions_by_decider on public.event_decisions (decided_by);
create index if not exists event_decisions_by_booking on public.event_decisions (booking_id);
create index if not exists event_cancellations_by_tenant on public.event_cancellations (tenant_id);
create index if not exists event_cancellations_by_canceller on public.event_cancellations (cancelled_by);
create index if not exists event_rsvps_by_event on public.event_rsvps (event_id, member, version desc);
create index if not exists event_rsvps_by_tenant on public.event_rsvps (tenant_id);
create index if not exists event_rsvps_by_member on public.event_rsvps (member);

comment on table public.events_operations is 'Idempotency keys the events writers spent, with what each asked and answered. Append-only.';
comment on table public.campus_events is 'An event proposed by a member and hosted by an office, a community or a course. Goes with the proposer''s account.';
comment on table public.event_decisions is 'That a manager published or declined an event, and the booking it wrote if it named a space.';
comment on table public.event_cancellations is 'That a published event was cancelled, and why. The RSVPs stay.';
comment on table public.event_rsvps is 'A member''s RSVP, newest version last: going, on the waitlist, or cancelled. Append-only. Goes with the member''s account.';

-- ── Guards ──────────────────────────────────────────────────────────────

create or replace function private.guard_events_record()
returns trigger language plpgsql set search_path = '' as $$
declare
  -- The columns `ON DELETE SET NULL` of an account (or a deleted booking) may clear.
  clearable text[] := case tg_table_name
    when 'event_decisions' then array['decided_by', 'booking_id']
    when 'event_cancellations' then array['cancelled_by']
    else '{}' end;
  col text;
  oj jsonb := to_jsonb(old);
  nj jsonb := to_jsonb(new);
begin
  -- Only those columns may change, and only to null.
  if (nj - clearable) is not distinct from (oj - clearable) then
    foreach col in array clearable loop
      if nj ->> col is not null and nj ->> col is distinct from oj ->> col then
        raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
      end if;
    end loop;
    return new;
  end if;
  raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.guard_events_record() from public, anon, authenticated;

drop trigger if exists campus_events_never_rewritten on public.campus_events;
create trigger campus_events_never_rewritten before update on public.campus_events for each row execute function private.guard_events_record();
drop trigger if exists event_decisions_never_rewritten on public.event_decisions;
create trigger event_decisions_never_rewritten before update on public.event_decisions for each row execute function private.guard_events_record();
drop trigger if exists event_cancellations_never_rewritten on public.event_cancellations;
create trigger event_cancellations_never_rewritten before update on public.event_cancellations for each row execute function private.guard_events_record();
drop trigger if exists event_rsvps_never_rewritten on public.event_rsvps;
create trigger event_rsvps_never_rewritten before update on public.event_rsvps for each row execute function private.guard_events_record();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.events_member(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant);
$$;
revoke all on function private.events_member(text) from public, anon, authenticated;
grant execute on function private.events_member(text) to authenticated;

create or replace function private.events_manager(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.events_member(want_tenant) and private.has_capability('events:manage', 'school', want_tenant);
$$;
revoke all on function private.events_manager(text) from public, anon, authenticated;
grant execute on function private.events_manager(text) to authenticated;

-- Whether an event is published and not cancelled.
create or replace function private.events_live(want_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.event_decisions d where d.event_id = want_event and d.decision = 'published')
     and not exists (select 1 from public.event_cancellations c where c.event_id = want_event);
$$;
revoke all on function private.events_live(uuid) from public, anon, authenticated;
grant execute on function private.events_live(uuid) to authenticated;

alter table public.events_operations enable row level security;
alter table public.campus_events enable row level security;
alter table public.event_decisions enable row level security;
alter table public.event_cancellations enable row level security;
alter table public.event_rsvps enable row level security;

revoke all on table public.events_operations from public, anon, authenticated;
revoke all on table public.campus_events from public, anon, authenticated;
revoke all on table public.event_decisions from public, anon, authenticated;
revoke all on table public.event_cancellations from public, anon, authenticated;
revoke all on table public.event_rsvps from public, anon, authenticated;
grant select on table public.events_operations to authenticated;
grant select on table public.campus_events to authenticated;
grant select on table public.event_decisions to authenticated;
grant select on table public.event_cancellations to authenticated;
grant select on table public.event_rsvps to authenticated;

drop policy if exists "callers read their own events operations" on public.events_operations;
create policy "callers read their own events operations" on public.events_operations
  for select to authenticated using (actor = (select auth.uid()));

drop policy if exists "members read published events, proposers and managers read all" on public.campus_events;
create policy "members read published events, proposers and managers read all" on public.campus_events
  for select to authenticated using (
    proposer = (select auth.uid()) or private.events_manager(tenant_id)
    or (private.events_member(tenant_id) and private.events_live(id)));

drop policy if exists "whoever reads the event reads its decision" on public.event_decisions;
create policy "whoever reads the event reads its decision" on public.event_decisions
  for select to authenticated using (exists (select 1 from public.campus_events e where e.id = event_id));

drop policy if exists "whoever reads the event reads its cancellation" on public.event_cancellations;
create policy "whoever reads the event reads its cancellation" on public.event_cancellations
  for select to authenticated using (exists (select 1 from public.campus_events e where e.id = event_id));

-- An RSVP is its member's, the proposer's and the managers'; everyone else sees counts.
drop policy if exists "members read their own RSVPs, proposers and managers all" on public.event_rsvps;
create policy "members read their own RSVPs, proposers and managers all" on public.event_rsvps
  for select to authenticated using (
    member = (select auth.uid()) or private.events_manager(tenant_id)
    or exists (select 1 from public.campus_events e where e.id = event_id and e.proposer = (select auth.uid())));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.events_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.events_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('events-op:' || school || ':' || want_key));
  select * into op from public.events_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.events_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.events_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.events_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.events_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.events_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'events') then
    raise exception 'semester: this school does not run events in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.events_core_required(text) from public, anon, authenticated;

-- The latest RSVP row of each member for an event.
create or replace function private.events_latest(want_event uuid)
returns setof public.event_rsvps
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (r.member) r.* from public.event_rsvps r where r.event_id = want_event order by r.member, r.version desc;
$$;
revoke all on function private.events_latest(uuid) from public, anon, authenticated;

-- ── Proposing and deciding ──────────────────────────────────────────────

create or replace function public.event_propose(
  want_host_kind text, want_host_ref text, want_title text, want_description text, want_location text, want_space text,
  want_starts timestamptz, want_ends timestamptz, want_capacity integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('host_kind', want_host_kind, 'host_ref', want_host_ref, 'title', want_title, 'description', coalesce(want_description, ''),
                    'location', coalesce(want_location, ''), 'space', coalesce(want_space, ''), 'starts', want_starts, 'ends', want_ends, 'capacity', want_capacity);
  prior  jsonb;
  sp     uuid;
  made   uuid;
  result jsonb;
begin
  prior := private.events_replay(school, want_key, 'propose', req);
  if prior is not null then return prior; end if;
  perform private.events_core_required(school);
  if want_starts is null or want_starts < clock_timestamp() - interval '5 minutes' then
    raise exception 'semester: an event is in the future' using errcode = 'check_violation';
  end if;
  if want_host_kind = 'office' and not private.has_capability('events:manage', 'school', school) then
    raise exception 'semester: an office event is proposed by the events office' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(btrim(want_space), '') <> '' then
    perform private.scheduling_core_required(school);
    select s.id into sp from public.campus_spaces s where s.tenant_id = school and s.code = upper(btrim(want_space)) and s.retired_at is null and s.bookable;
    if sp is null then raise exception 'semester: that space cannot be booked' using errcode = 'check_violation'; end if;
  end if;
  insert into public.campus_events (tenant_id, host_kind, host_ref, title, description, location, space_id, starts_at, ends_at, capacity, proposer, operation)
  values (school, want_host_kind, btrim(coalesce(want_host_ref, '')), btrim(coalesce(want_title, '')), btrim(coalesce(want_description, '')),
          btrim(coalesce(want_location, '')), sp, want_starts, want_ends, want_capacity, me, want_key) returning id into made;
  result := jsonb_build_object('id', made, 'status', 'proposed');
  perform private.events_spend(school, want_key, 'propose', req, result);
  return result;
end $$;

-- Publishes or declines. Publishing an event that names a space books it.
create or replace function private.events_publish(want_event public.campus_events, want_by uuid, want_note text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  booking uuid;
begin
  if want_event.space_id is not null then
    insert into public.space_bookings (tenant_id, space_id, requester, purpose, title, starts_at, ends_at, status, decided_by, decided_at, operation)
    values (want_event.tenant_id, want_event.space_id, want_event.proposer, 'event', want_event.title, want_event.starts_at, want_event.ends_at,
            'confirmed', want_by, clock_timestamp(), 'event:' || want_event.id::text) returning id into booking;
    insert into public.space_booking_events (tenant_id, booking_id, kind, actor, note) values (want_event.tenant_id, booking, 'confirmed', want_by, 'For the event ' || want_event.title);
  end if;
  insert into public.event_decisions (event_id, tenant_id, decision, decided_by, note, booking_id)
  values (want_event.id, want_event.tenant_id, 'published', want_by, btrim(coalesce(want_note, '')), booking);
  return booking;
end $$;
revoke all on function private.events_publish(public.campus_events, uuid, text) from public, anon, authenticated;

create or replace function public.event_decide(want_event uuid, want_publish boolean, want_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('event', want_event, 'publish', want_publish, 'note', coalesce(want_note, ''));
  prior  jsonb;
  e      public.campus_events;
  result jsonb;
begin
  if not private.has_capability('events:manage', 'school', school) then
    raise exception 'semester: that needs events:manage at this school' using errcode = 'insufficient_privilege';
  end if;
  prior := private.events_replay(school, want_key, 'decide', req);
  if prior is not null then return prior; end if;
  perform private.events_core_required(school);
  select * into e from public.campus_events x where x.id = want_event and x.tenant_id = school for update;
  if e.id is null then raise exception 'semester: no such event' using errcode = 'no_data_found'; end if;
  if e.proposer = me then raise exception 'semester: an event is decided by someone other than who proposed it' using errcode = 'insufficient_privilege'; end if;
  if exists (select 1 from public.event_decisions d where d.event_id = want_event) then raise exception 'semester: that event is already decided' using errcode = 'check_violation'; end if;
  if want_publish then
    perform private.events_publish(e, me, want_note);
  else
    insert into public.event_decisions (event_id, tenant_id, decision, decided_by, note) values (want_event, school, 'declined', me, btrim(coalesce(want_note, '')));
  end if;
  result := jsonb_build_object('id', want_event, 'decision', case when want_publish then 'published' else 'declined' end);
  perform private.events_spend(school, want_key, 'decide', req, result);
  return result;
end $$;

-- An events manager's own office event, proposed and published together.
create or replace function public.event_publish_direct(
  want_host_ref text, want_title text, want_description text, want_location text, want_space text,
  want_starts timestamptz, want_ends timestamptz, want_capacity integer, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('host_ref', want_host_ref, 'title', want_title, 'description', coalesce(want_description, ''), 'location', coalesce(want_location, ''),
                    'space', coalesce(want_space, ''), 'starts', want_starts, 'ends', want_ends, 'capacity', want_capacity);
  prior  jsonb;
  sp     uuid;
  e      public.campus_events;
  result jsonb;
begin
  if not private.has_capability('events:manage', 'school', school) then
    raise exception 'semester: that needs events:manage at this school' using errcode = 'insufficient_privilege';
  end if;
  prior := private.events_replay(school, want_key, 'direct', req);
  if prior is not null then return prior; end if;
  perform private.events_core_required(school);
  if want_starts is null or want_starts < clock_timestamp() - interval '5 minutes' then
    raise exception 'semester: an event is in the future' using errcode = 'check_violation';
  end if;
  if coalesce(btrim(want_space), '') <> '' then
    perform private.scheduling_core_required(school);
    select s.id into sp from public.campus_spaces s where s.tenant_id = school and s.code = upper(btrim(want_space)) and s.retired_at is null and s.bookable;
    if sp is null then raise exception 'semester: that space cannot be booked' using errcode = 'check_violation'; end if;
  end if;
  insert into public.campus_events (tenant_id, host_kind, host_ref, title, description, location, space_id, starts_at, ends_at, capacity, proposer, operation)
  values (school, 'office', btrim(coalesce(want_host_ref, '')), btrim(coalesce(want_title, '')), btrim(coalesce(want_description, '')),
          btrim(coalesce(want_location, '')), sp, want_starts, want_ends, want_capacity, me, want_key) returning * into e;
  perform private.events_publish(e, me, 'Published directly by the events office');
  result := jsonb_build_object('id', e.id, 'status', 'published');
  perform private.events_spend(school, want_key, 'direct', req, result);
  return result;
end $$;

create or replace function public.event_cancel(want_event uuid, want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('event', want_event, 'reason', coalesce(want_reason, ''));
  prior  jsonb;
  e      public.campus_events;
  result jsonb;
begin
  prior := private.events_replay(school, want_key, 'cancel', req);
  if prior is not null then return prior; end if;
  perform private.events_core_required(school);
  select * into e from public.campus_events x where x.id = want_event and x.tenant_id = school for update;
  if e.id is null then raise exception 'semester: no such event' using errcode = 'no_data_found'; end if;
  if e.proposer <> me and not private.has_capability('events:manage', 'school', school) then
    raise exception 'semester: only who proposed an event, or the events office, cancels it' using errcode = 'insufficient_privilege';
  end if;
  if not private.events_live(want_event) then raise exception 'semester: only a published event is cancelled' using errcode = 'check_violation'; end if;
  insert into public.event_cancellations (event_id, tenant_id, cancelled_by, reason) values (want_event, school, me, btrim(coalesce(want_reason, '')));
  -- A booking made for the event is cancelled with it.
  update public.space_bookings b set status = 'cancelled', decided_by = coalesce(b.decided_by, me), decided_at = coalesce(b.decided_at, clock_timestamp())
   where b.id = (select d.booking_id from public.event_decisions d where d.event_id = want_event) and b.status = 'confirmed';
  result := jsonb_build_object('id', want_event, 'cancelled', true);
  perform private.events_spend(school, want_key, 'cancel', req, result);
  return result;
end $$;

-- ── RSVPs ───────────────────────────────────────────────────────────────

-- going = true: a place, or the waitlist if the event is full. going = false: cancel,
-- and promote the earliest waiting member if a place freed.
create or replace function public.event_rsvp(want_event uuid, want_going boolean, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  req     jsonb := jsonb_build_object('event', want_event, 'going', want_going);
  prior   jsonb;
  e       public.campus_events;
  mine    public.event_rsvps;
  taken   integer;
  st      text;
  promo   public.event_rsvps;
  result  jsonb;
begin
  prior := private.events_replay(school, want_key, 'rsvp', req);
  if prior is not null then return prior; end if;
  perform private.events_core_required(school);
  perform pg_advisory_xact_lock(hashtext('event:' || want_event::text));
  select * into e from public.campus_events x where x.id = want_event and x.tenant_id = school;
  if e.id is null or not private.events_live(want_event) then raise exception 'semester: no such event' using errcode = 'no_data_found'; end if;
  if e.ends_at < clock_timestamp() then raise exception 'semester: that event is over' using errcode = 'check_violation'; end if;
  select r.* into mine from private.events_latest(want_event) r where r.member = me;
  if want_going then
    if mine.id is not null and mine.status in ('going', 'waitlisted') then
      raise exception 'semester: you have already answered going' using errcode = 'check_violation';
    end if;
    select count(*) into taken from private.events_latest(want_event) r where r.status = 'going';
    st := case when e.capacity is not null and taken >= e.capacity then 'waitlisted' else 'going' end;
    insert into public.event_rsvps (tenant_id, event_id, member, version, status) values (school, want_event, me, coalesce(mine.version, 0) + 1, st);
  else
    if mine.id is null or mine.status = 'cancelled' then raise exception 'semester: you have no RSVP to cancel' using errcode = 'check_violation'; end if;
    st := 'cancelled';
    insert into public.event_rsvps (tenant_id, event_id, member, version, status) values (school, want_event, me, mine.version + 1, 'cancelled');
    if mine.status = 'going' then
      select r.* into promo from private.events_latest(want_event) r where r.status = 'waitlisted' order by r.at, r.member limit 1;
      if promo.id is not null then
        insert into public.event_rsvps (tenant_id, event_id, member, version, status) values (school, want_event, promo.member, promo.version + 1, 'going');
      end if;
    end if;
  end if;
  result := jsonb_build_object('status', st);
  perform private.events_spend(school, want_key, 'rsvp', req, result);
  return result;
end $$;

-- Counts only, for any member of the school: no one is named.
create or replace function public.event_headcount(want_event uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
begin
  if not exists (select 1 from public.campus_events e where e.id = want_event and e.tenant_id = school)
     or not (private.events_live(want_event) or private.events_manager(school)
             or exists (select 1 from public.campus_events e where e.id = want_event and e.proposer = (select auth.uid()))) then
    raise exception 'semester: no such event' using errcode = 'no_data_found';
  end if;
  return jsonb_build_object(
    'going',      (select count(*) from private.events_latest(want_event) r where r.status = 'going'),
    'waitlisted', (select count(*) from private.events_latest(want_event) r where r.status = 'waitlisted'));
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────

revoke all on function public.event_propose(text, text, text, text, text, text, timestamptz, timestamptz, integer, text) from public, anon;
revoke all on function public.event_decide(uuid, boolean, text, text) from public, anon;
revoke all on function public.event_publish_direct(text, text, text, text, text, timestamptz, timestamptz, integer, text) from public, anon;
revoke all on function public.event_cancel(uuid, text, text) from public, anon;
revoke all on function public.event_rsvp(uuid, boolean, text) from public, anon;
revoke all on function public.event_headcount(uuid) from public, anon;
grant execute on function public.event_propose(text, text, text, text, text, text, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.event_decide(uuid, boolean, text, text) to authenticated;
grant execute on function public.event_publish_direct(text, text, text, text, text, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.event_cancel(uuid, text, text) to authenticated;
grant execute on function public.event_rsvp(uuid, boolean, text) to authenticated;
grant execute on function public.event_headcount(uuid) to authenticated;

-- ── An account that proposed or RSVPed to an event is not untouched ─────
--
-- The previous definition is `20261001080000_scheduling.sql`, with two more
-- places to look; an event and its RSVPs go with the account.

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
      ('public.space_bookings',       'requester'),
      -- 20261001090000: an event is its proposer's; an RSVP is its member's.
      ('public.campus_events',        'proposer'),
      ('public.event_rsvps',          'member')
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
