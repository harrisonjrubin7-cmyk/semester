-- Semester — the official registration transaction.
--
-- Until this file, `writeback.registration_submit` (app/src/lib/flags.ts) was
-- a flag with nothing behind it: "the flag exists so the gate does". This is
-- what it gates. A school's registrar sets the term's calendar and its
-- sections; a student enrolls, joins a waitlist, drops inside add/drop and
-- withdraws after it; the registrar approves restricted sections and grants
-- overrides. The pure model of the same rules, with the same reason codes, is
-- app/src/lib/enrollment/ — the two are written to agree, and
-- supabase/registration_transaction.check.sql and enrollment.test.ts each
-- walk the same refusals.
--
-- What is decided here, and where:
--
--   * **Who.** Every writer is `security definer`, reads `auth.uid()`, and
--     takes the school from `profiles.school_id` — never a parameter. A
--     student acts only on their own enrollments. The registrar's writers
--     need `registration:administer` over that school, which `registrar`
--     holds; nothing here grants a role.
--   * **Whether at all.** Every change of an enrollment's state first asks
--     `private.registration_gate`: `kill.writeback` or `kill.integration_sync`
--     engaged (globally or for the school) stops it, and so does
--     `writeback.registration_submit` being anything but `production` for the
--     school — the reading `lti_passback_decision` gives its own writeback
--     flag. Stopped outranks off.
--   * **Holds.** A hold blocks enrolling, never leaving. Its reason is stored
--     for the office that placed it and is not readable by any signed-in
--     account: the table has no client grant, and the one function a student
--     has (`my_registration_hold`) returns whether, which office, and the
--     link — `scope.sis.registration_hold_summary_read`, "never the reason".
--     Holds and completed courses arrive from the SIS through the sync
--     worker (service role); nothing here lets a client write them.
--   * **Seats.** Taken at commit, never at review. `want_expect` is what the
--     student confirmed ('seat' or 'waitlist'); if the section changed
--     under them the answer is `stale_seat_count` and nothing is written.
--   * **Idempotency.** Every writer takes a key. The same caller, key and
--     arguments return the stored result with `replayed: true`; the same key
--     with other arguments is `idempotency_conflict`. Refusals are not
--     stored, so a refused request may be retried under its key.
--   * **Order, and the last seat.** One transaction-scoped advisory lock per
--     school and term serialises every change to that term's seats and
--     waitlists — the simplest lock that cannot deadlock against a promotion
--     that reaches another student's schedule; the cost is that one school's
--     term is one queue. Under it, every writer that can take or free a seat
--     re-reads the section `for update`, so the seat count it decides on is
--     the committed one and the row stays locked until it commits. Two
--     students taking the last seat at once: the second waits, then reads
--     the section full. `registration_transaction.check.sql` holds each
--     writer to both locks.
--   * **Withdrawal is a W.** No row is deleted by anything here. A drop, a
--     withdrawal, a denial and leaving a waitlist are states, and every
--     change writes `registration_audit_event`.
--
-- What is reused, and what deliberately is not:
--
--   * `private.course_code` (Course Studio) normalises every course code, and
--     `private.has_capability` and `public.kill_switch_engaged` /
--     `public.feature_state` are the gates everything else uses.
--   * `public.catalog_sections` is a mirror the SIS sync overwrites, with a
--     nullable capacity and no waitlist or prerequisites. A seat count that a
--     sync can overwrite is not one a transaction can hold, so sections here
--     are their own table.
--   * `public.registration_time_tickets` is the student's own copy of their
--     time ticket, and the student may write every column of it, including
--     its `source_label`. It cannot decide when somebody may enroll, so the
--     server enforces only the term's opening; the pure model accepts a
--     verified ticket (`StudentFacts.ticketAt`) from a caller that has one.
--   * `public.registration_windows` is a published notice for an audience;
--     `registration_terms` is the calendar a transaction is checked against.
--
-- What is not here: the adapter that sends a committed change on to a
-- school's SIS (the flag's `scope.sis.registration_write` and connection
-- requirements describe that half, and it is not built), and any screen.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── 1. The capability ─────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('registration:administer', 'Run one school''s registration: term calendars, sections, approvals and overrides; read its enrollments and their audit. Never a hold''s reason.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar', 'registration:administer')
on conflict do nothing;

-- ── 2. The term's calendar ────────────────────────────────────────────────

create table if not exists public.registration_terms (
  tenant_id         text          not null references public.schools(id) on delete cascade,
  term              text          not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  opens_at          timestamptz   not null,
  add_drop_ends_at  timestamptz   not null,
  withdraw_ends_at  timestamptz   not null,
  max_credits       numeric(4, 1) not null check (max_credits > 0 and max_credits <= 40),
  updated_by        uuid          references auth.users on delete set null,
  updated_at        timestamptz   not null default now(),
  primary key (tenant_id, term),
  constraint registration_terms_in_order check (opens_at < add_drop_ends_at and add_drop_ends_at < withdraw_ends_at)
);
create index if not exists registration_terms_by_updater on public.registration_terms (updated_by);

-- ── 3. Sections ───────────────────────────────────────────────────────────
--
-- `meetings` is the planner's shape (`Meeting` in lib/registration.ts):
-- [{days: [0–6], start: minutes, end: minutes}]. `seats_taken` is kept by the
-- writers below, under the term lock, and is what a student reads before
-- confirming; `version` moves whenever it or the waitlist does.

create table if not exists public.registration_sections (
  id                 uuid          primary key default gen_random_uuid(),
  tenant_id          text          not null,
  term               text          not null,
  course_code        text          not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  section            text          not null check (section ~ '^[A-Za-z0-9-]{1,10}$'),
  title              text          not null check (length(btrim(title)) between 1 and 200),
  credits            numeric(4, 1) not null check (credits >= 0 and credits <= 30),
  capacity           integer       not null check (capacity >= 0),
  waitlist_capacity  integer       not null default 0 check (waitlist_capacity >= 0),
  meetings           jsonb         not null default '[]'::jsonb check (jsonb_typeof(meetings) = 'array'),
  prerequisites      text[]        not null default '{}',
  requires_approval  boolean       not null default false,
  seats_taken        integer       not null default 0 check (seats_taken >= 0),
  waiting            integer       not null default 0 check (waiting >= 0),
  version            bigint        not null default 1,
  updated_by         uuid          references auth.users on delete set null,
  updated_at         timestamptz   not null default now(),
  unique (tenant_id, term, course_code, section),
  foreign key (tenant_id, term) references public.registration_terms (tenant_id, term) on delete cascade
);
create index if not exists registration_sections_by_updater on public.registration_sections (updated_by);

-- ── 4. Enrollments ────────────────────────────────────────────────────────
--
-- One live row (enrolled, waitlisted, pending_approval) per student and
-- section; history rows stay. `grade` is 'W' exactly when withdrawn.

create table if not exists public.registration_enrollments (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  section_id  uuid        not null references public.registration_sections(id) on delete cascade,
  student     uuid        not null references auth.users on delete cascade,
  state       text        not null check (state in (
                'enrolled', 'waitlisted', 'pending_approval', 'dropped', 'left_waitlist', 'withdrawn', 'denied')),
  wait_seq    bigint,
  grade       text        check (grade = 'W'),
  version     integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint registration_enrollments_w_is_withdrawn check ((state = 'withdrawn') = (grade is not distinct from 'W')),
  constraint registration_enrollments_waiting_has_place check ((state = 'waitlisted') = (wait_seq is not null))
);
create unique index if not exists registration_enrollments_one_live
  on public.registration_enrollments (section_id, student)
  where state in ('enrolled', 'waitlisted', 'pending_approval');
create index if not exists registration_enrollments_by_section on public.registration_enrollments (section_id, state, wait_seq);
create index if not exists registration_enrollments_by_student on public.registration_enrollments (student, state);
create index if not exists registration_enrollments_by_tenant on public.registration_enrollments (tenant_id);

create sequence if not exists public.registration_wait_seq;
revoke all on sequence public.registration_wait_seq from public, anon, authenticated;

-- ── 5. What the SIS tells the registrar: holds and completions ───────────

create table if not exists public.registration_holds (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  student     uuid        not null references auth.users on delete cascade,
  office      text        not null check (length(btrim(office)) between 1 and 120),
  link        text        not null default '' check (link = '' or (link ~ '^https://[^\s]+$' and length(link) <= 500)),
  -- For the office that placed it. No client role can select this table.
  reason      text        not null default '' check (length(reason) <= 1000),
  placed_at   timestamptz not null default now(),
  released_at timestamptz
);
-- Whole, not partial on `released_at is null`: a partial index does not
-- cover the foreign key a deleted account's cascade follows.
create index if not exists registration_holds_by_student on public.registration_holds (student, tenant_id);
create index if not exists registration_holds_by_tenant on public.registration_holds (tenant_id);

create table if not exists public.registration_completions (
  tenant_id    text        not null references public.schools(id) on delete cascade,
  student      uuid        not null references auth.users on delete cascade,
  course_code  text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  recorded_at  timestamptz not null default now(),
  primary key (student, tenant_id, course_code)
);
create index if not exists registration_completions_by_tenant on public.registration_completions (tenant_id);


-- ── 6. Overrides, requests, audit ─────────────────────────────────────────

create table if not exists public.registration_overrides (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  section_id  uuid        not null references public.registration_sections(id) on delete cascade,
  student     uuid        not null references auth.users on delete cascade,
  -- A hold is not on the list: the registrar cannot waive another office's hold here.
  -- Written without BETWEEN: a BETWEEN inside an AND is stored nested, a dump
  -- prints it that way and a restore reads it back flat, so the constraint
  -- would not survive a restore unchanged (supabase/restore.sh).
  waives      text[]      not null check (
                cardinality(waives) >= 1
                and cardinality(waives) <= 6
                and waives <@ array['capacity', 'prerequisite', 'time_conflict', 'credit_limit', 'approval', 'late_add']::text[]),
  reason      text        not null check (length(btrim(reason)) between 1 and 1000),
  granted_by  uuid        references auth.users on delete set null,
  granted_at  timestamptz not null default now()
);
create index if not exists registration_overrides_by_student on public.registration_overrides (student, section_id);
create index if not exists registration_overrides_by_section on public.registration_overrides (section_id);
create index if not exists registration_overrides_by_tenant on public.registration_overrides (tenant_id);
create index if not exists registration_overrides_by_granter on public.registration_overrides (granted_by);

create table if not exists public.registration_requests (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null references public.schools(id) on delete cascade,
  actor        uuid        not null references auth.users on delete cascade,
  idem_key     text        not null check (idem_key ~ '^[A-Za-z0-9:_.-]{8,128}$'),
  action       text        not null check (action in ('enroll', 'drop', 'withdraw', 'override', 'decide')),
  fingerprint  text        not null,
  result       jsonb       not null,
  created_at   timestamptz not null default now(),
  unique (actor, idem_key)
);
create index if not exists registration_requests_by_tenant on public.registration_requests (tenant_id);

create table if not exists public.registration_audit_event (
  id             bigint      generated always as identity primary key,
  tenant_id      text        not null references public.schools(id) on delete cascade,
  actor          uuid        references auth.users on delete set null,
  student        uuid        references auth.users on delete set null,
  section_id     uuid        references public.registration_sections(id) on delete set null,
  enrollment_id  uuid        references public.registration_enrollments(id) on delete set null,
  action         text        not null check (action in (
                   'term_set', 'section_set', 'enrolled', 'waitlisted', 'pending_approval', 'dropped',
                   'left_waitlist', 'withdrawn', 'denied', 'approved', 'override_granted',
                   'promoted', 'promotion_skipped')),
  reason         text        not null default 'ok',
  detail         jsonb       not null default '{}'::jsonb,
  at             timestamptz not null default now()
);
create index if not exists registration_audit_by_tenant on public.registration_audit_event (tenant_id, at desc);
create index if not exists registration_audit_by_actor on public.registration_audit_event (actor);
create index if not exists registration_audit_by_student on public.registration_audit_event (student);
create index if not exists registration_audit_by_section on public.registration_audit_event (section_id);
create index if not exists registration_audit_by_enrollment on public.registration_audit_event (enrollment_id);

comment on table public.registration_terms is
  'A school''s registration calendar per term and its credit ceiling. Written by registration:administer through registrar_put_term.';
comment on table public.registration_sections is
  'Sections a student can enroll in, with capacity, waitlist, prerequisites and the kept seat count. Written through registrar_put_section.';
comment on table public.registration_enrollments is
  'One row per enrollment attempt that took effect. Never deleted: a drop, withdrawal (grade W), denial or leaving a waitlist is a state.';
comment on table public.registration_holds is
  'Registration holds from the SIS. No client grant: a student learns only whether, which office, and its link, through my_registration_hold.';
comment on table public.registration_completions is
  'Courses a student has passed, from the SIS, for prerequisite checks. No client grant.';
comment on table public.registration_overrides is
  'Registrar overrides for one student in one section: what is waived, why, and who granted it.';
comment on table public.registration_requests is
  'Idempotency: each committed request by caller and key, with a fingerprint of its arguments and its result. No client grant.';
comment on table public.registration_audit_event is
  'Append-only record of every registration change, promotion and override. Readable by registration:administer at the school.';

-- ── 7. Who reads, and that nobody writes directly ─────────────────────────

alter table public.registration_terms enable row level security;
alter table public.registration_sections enable row level security;
alter table public.registration_enrollments enable row level security;
alter table public.registration_holds enable row level security;
alter table public.registration_completions enable row level security;
alter table public.registration_overrides enable row level security;
alter table public.registration_requests enable row level security;
alter table public.registration_audit_event enable row level security;

revoke all on table public.registration_terms from anon, authenticated;
revoke all on table public.registration_sections from anon, authenticated;
revoke all on table public.registration_enrollments from anon, authenticated;
revoke all on table public.registration_holds from anon, authenticated;
revoke all on table public.registration_completions from anon, authenticated;
revoke all on table public.registration_overrides from anon, authenticated;
revoke all on table public.registration_requests from anon, authenticated;
revoke all on table public.registration_audit_event from anon, authenticated;

-- Deliberate reads. The calendar and the sections are the school's
-- catalogue; an enrollment is its student's and the registrar's; an override
-- is the registrar's (its reason is theirs to write); the audit is the
-- registrar's.
grant select on table public.registration_terms to authenticated;
grant select on table public.registration_sections to authenticated;
grant select on table public.registration_enrollments to authenticated;
grant select on table public.registration_overrides to authenticated;
grant select on table public.registration_audit_event to authenticated;

drop policy if exists "school members read the registration calendar" on public.registration_terms;
create policy "school members read the registration calendar" on public.registration_terms
  for select to authenticated
  using (tenant_id = (select private.school_of()));
drop policy if exists "school members read sections" on public.registration_sections;
create policy "school members read sections" on public.registration_sections
  for select to authenticated
  using (tenant_id = (select private.school_of()));
drop policy if exists "a student reads their own enrollments" on public.registration_enrollments;
create policy "a student reads their own enrollments" on public.registration_enrollments
  for select to authenticated
  using (student = (select auth.uid()));
drop policy if exists "the registrar reads the school's enrollments" on public.registration_enrollments;
create policy "the registrar reads the school's enrollments" on public.registration_enrollments
  for select to authenticated
  using (private.has_capability('registration:administer', 'school', tenant_id));
drop policy if exists "the registrar reads the school's overrides" on public.registration_overrides;
create policy "the registrar reads the school's overrides" on public.registration_overrides
  for select to authenticated
  using (private.has_capability('registration:administer', 'school', tenant_id));
drop policy if exists "the registrar reads the school's registration audit" on public.registration_audit_event;
create policy "the registrar reads the school's registration audit" on public.registration_audit_event
  for select to authenticated
  using (private.has_capability('registration:administer', 'school', tenant_id));

-- ── 8. The private helpers ────────────────────────────────────────────────

-- The caller's school, or raise. The one place that decides who a caller is.
create or replace function private.registration_school()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  select p.school_id into school from public.profiles p where p.user_id = me;
  if school is null then
    raise exception 'semester: claim your school first' using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;

-- The registrar's school, or raise.
create or replace function private.registration_registrar()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare school text := private.registration_school();
begin
  if not private.has_capability('registration:administer', 'school', school) then
    raise exception 'semester: only the registrar can do that' using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;

-- Null when registration changes may happen at this school; otherwise why not.
create or replace function private.registration_gate(want_school text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.kill_switch_engaged('kill.writeback', want_school)
      or public.kill_switch_engaged('kill.integration_sync', want_school) then 'kill_switch'
    when public.feature_state('writeback.registration_submit', want_school) <> 'production' then 'flag_off'
  end;
$$;

create or replace function private.registration_refusal(want_reason text, want_message text, want_extra jsonb default '{}'::jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object('ok', false, 'outcome', 'refused', 'reason', want_reason,
                            'message', want_message, 'replayed', false, 'promoted', 0) || coalesce(want_extra, '{}'::jsonb);
$$;

-- Two meeting lists overlap: a shared day and overlapping minutes. The
-- planner's `conflicts` in lib/registration.ts, in SQL.
create or replace function private.registration_clash(a jsonb, b jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1
      from jsonb_array_elements(a) x, jsonb_array_elements(b) y
     where (x->>'start')::int < (y->>'end')::int
       and (y->>'start')::int < (x->>'end')::int
       and exists (select 1 from jsonb_array_elements(x->'days') d where (y->'days') @> jsonb_build_array(d))
  );
$$;

create or replace function private.registration_waived(want_student uuid, want_section uuid, want_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.registration_overrides o
     where o.student = want_student and o.section_id = want_section and want_kind = any(o.waives)
  );
$$;

create or replace function private.registration_audit(
  want_school text, want_actor uuid, want_student uuid, want_section uuid, want_enrollment uuid,
  want_action text, want_reason text, want_detail jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.registration_audit_event (tenant_id, actor, student, section_id, enrollment_id, action, reason, detail)
  values (want_school, want_actor, want_student, want_section, want_enrollment, want_action, want_reason, coalesce(want_detail, '{}'::jsonb));
$$;

/*
 * What stands between this student and a seat in this section, other than the
 * seat itself, in a registrar's order: window, hold, duplicate, prerequisite,
 * clash, credit load. Null when nothing does. Shared by enroll, approval and
 * promotion so the three cannot disagree. `blocker` in lib/enrollment/service.ts.
 */
create or replace function private.registration_blocker(
  want_student uuid, sec public.registration_sections, t public.registration_terms,
  check_window boolean, ignore_row uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  live   text;
  load   numeric;
begin
  if check_window then
    if now() < t.opens_at then
      return 'window_not_open';
    end if;
    if now() > t.add_drop_ends_at and not private.registration_waived(want_student, sec.id, 'late_add') then
      return 'window_closed';
    end if;
  end if;

  if exists (select 1 from public.registration_holds h
              where h.tenant_id = sec.tenant_id and h.student = want_student and h.released_at is null) then
    return 'hold';
  end if;

  select e.state into live from public.registration_enrollments e
   where e.section_id = sec.id and e.student = want_student
     and e.state in ('enrolled', 'waitlisted', 'pending_approval')
     and e.id is distinct from ignore_row
   limit 1;
  if live is not null then
    return case live when 'enrolled' then 'already_enrolled' when 'waitlisted' then 'already_waitlisted' else 'already_pending' end;
  end if;

  if exists (select 1 from unnest(sec.prerequisites) need
              where not exists (select 1 from public.registration_completions c
                                 where c.tenant_id = sec.tenant_id and c.student = want_student and c.course_code = need))
     and not private.registration_waived(want_student, sec.id, 'prerequisite') then
    return 'prerequisite_missing';
  end if;

  if exists (select 1 from public.registration_enrollments e
               join public.registration_sections o on o.id = e.section_id
              where e.student = want_student and e.state = 'enrolled'
                and o.tenant_id = sec.tenant_id and o.term = sec.term and o.id <> sec.id
                and private.registration_clash(o.meetings, sec.meetings))
     and not private.registration_waived(want_student, sec.id, 'time_conflict') then
    return 'time_conflict';
  end if;

  select coalesce(sum(o.credits), 0) into load
    from public.registration_enrollments e
    join public.registration_sections o on o.id = e.section_id
   where e.student = want_student and e.state = 'enrolled'
     and o.tenant_id = sec.tenant_id and o.term = sec.term and o.id <> sec.id;
  if load + sec.credits > t.max_credits and not private.registration_waived(want_student, sec.id, 'credit_limit') then
    return 'credit_limit';
  end if;

  return null;
end $$;

-- Recount a section's seats and queue from its rows, and move its version.
create or replace function private.registration_recount(want_section uuid)
returns public.registration_sections
language sql
security definer
set search_path = ''
as $$
  update public.registration_sections s
     set seats_taken = (select count(*) from public.registration_enrollments e where e.section_id = s.id and e.state = 'enrolled'),
         waiting     = (select count(*) from public.registration_enrollments e where e.section_id = s.id and e.state = 'waitlisted'),
         version     = s.version + 1
   where s.id = want_section
  returning s.*;
$$;

-- One-based place in the queue, or null.
create or replace function private.registration_position(want_enrollment uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*)::int from public.registration_enrollments o
           where o.section_id = e.section_id and o.state = 'waitlisted' and o.wait_seq <= e.wait_seq)
    from public.registration_enrollments e
   where e.id = want_enrollment and e.state = 'waitlisted';
$$;

/*
 * Fill free seats from the waitlist in order. A head of the queue who is now
 * blocked is passed over for this seat, keeps their place, and the audit says
 * why; the caller is told only how many moved. Nothing moves when the gate
 * is shut or add/drop has closed. The caller holds the term lock.
 */
create or replace function private.registration_promote(want_section uuid, want_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  sec   public.registration_sections;
  t     public.registration_terms;
  w     public.registration_enrollments;
  why   text;
  moved integer := 0;
  taken integer;
begin
  select * into sec from public.registration_sections where id = want_section;
  select * into t from public.registration_terms where tenant_id = sec.tenant_id and term = sec.term;
  if private.registration_gate(sec.tenant_id) is not null or now() > t.add_drop_ends_at then
    return 0;
  end if;
  for w in select * from public.registration_enrollments e
            where e.section_id = want_section and e.state = 'waitlisted' order by e.wait_seq loop
    select count(*) into taken from public.registration_enrollments e where e.section_id = want_section and e.state = 'enrolled';
    exit when taken >= sec.capacity;
    why := private.registration_blocker(w.student, sec, t, false, w.id);
    if why is not null then
      perform private.registration_audit(sec.tenant_id, want_actor, w.student, sec.id, w.id, 'promotion_skipped', why);
      continue;
    end if;
    update public.registration_enrollments
       set state = 'enrolled', wait_seq = null, version = version + 1, updated_at = now()
     where id = w.id;
    perform private.registration_audit(sec.tenant_id, want_actor, w.student, sec.id, w.id, 'promoted', 'ok');
    moved := moved + 1;
  end loop;
  perform private.registration_recount(want_section);
  return moved;
end $$;

/*
 * The stored answer for this caller and key, or null when there is none.
 * Takes the key's lock first, so two deliveries of one request serialise and
 * the second finds the first.
 */
create or replace function private.registration_replay(want_actor uuid, want_key text, want_action text, want_print text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r public.registration_requests;
begin
  perform pg_advisory_xact_lock(hashtext('registration:key:' || want_actor::text || ':' || want_key));
  select * into r from public.registration_requests q where q.actor = want_actor and q.idem_key = want_key;
  if r.id is null then return null; end if;
  if r.action <> want_action or r.fingerprint <> want_print then
    return private.registration_refusal('idempotency_conflict',
      'That idempotency key was already used for a different request. Nothing was changed.');
  end if;
  return r.result || '{"replayed": true}'::jsonb;
end $$;

create or replace function private.registration_commit(
  want_school text, want_actor uuid, want_key text, want_action text, want_print text, want_result jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  insert into public.registration_requests (tenant_id, actor, idem_key, action, fingerprint, result)
  values (want_school, want_actor, want_key, want_action, want_print, want_result)
  returning result;
$$;

create or replace function private.registration_lock_term(want_school text, want_term text)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('registration:term:' || want_school || '/' || want_term));
$$;

-- The answer for a committed change of one enrollment.
create or replace function private.registration_answer(
  want_outcome text, want_message text, want_enrollment uuid, want_section uuid, want_promoted integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true, 'outcome', want_outcome, 'reason', 'ok', 'message', want_message, 'replayed', false,
    'promoted', coalesce(want_promoted, 0),
    'enrollment', (select jsonb_build_object('id', e.id, 'state', e.state, 'grade', e.grade, 'version', e.version)
                     from public.registration_enrollments e where e.id = want_enrollment),
    'wait_position', private.registration_position(want_enrollment),
    'seats_taken', s.seats_taken, 'capacity', s.capacity, 'section_version', s.version)
    from public.registration_sections s where s.id = want_section;
$$;

-- The idempotency key's shape, or raise. A key is required on every writer.
create or replace function private.registration_key(want_key text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:_.-]{8,128}$' then
    raise exception 'semester: an idempotency key of 8 to 128 letters, digits or : _ . - is required'
      using errcode = 'check_violation';
  end if;
  return want_key;
end $$;

revoke all on function private.registration_school() from public, anon, authenticated;
revoke all on function private.registration_registrar() from public, anon, authenticated;
revoke all on function private.registration_gate(text) from public, anon, authenticated;
revoke all on function private.registration_refusal(text, text, jsonb) from public, anon, authenticated;
revoke all on function private.registration_clash(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.registration_waived(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.registration_audit(text, uuid, uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.registration_blocker(uuid, public.registration_sections, public.registration_terms, boolean, uuid) from public, anon, authenticated;
revoke all on function private.registration_recount(uuid) from public, anon, authenticated;
revoke all on function private.registration_position(uuid) from public, anon, authenticated;
revoke all on function private.registration_promote(uuid, uuid) from public, anon, authenticated;
revoke all on function private.registration_replay(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.registration_commit(text, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.registration_lock_term(text, text) from public, anon, authenticated;
revoke all on function private.registration_answer(text, text, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function private.registration_key(text) from public, anon, authenticated;

-- ── 9. The student's three writers ────────────────────────────────────────

/*
 * Enroll: a seat, the waitlist, or a request for approval. `want_expect` is
 * what the student confirmed on review — 'seat', 'waitlist', or null for
 * either — and a section that changed under them is `stale_seat_count`.
 */
create or replace function public.registration_enroll(want_section uuid, want_key text, want_expect text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_school();
  k      text := private.registration_key(want_key);
  print  text := md5(jsonb_build_array('enroll', want_section, want_expect)::text);
  prior  jsonb;
  shut   text;
  sec    public.registration_sections;
  t      public.registration_terms;
  why    text;
  where_ text;
  row_id uuid;
  h      public.registration_holds;
begin
  if want_expect is not null and want_expect not in ('seat', 'waitlist') then
    raise exception 'semester: expect a seat, the waitlist, or say nothing' using errcode = 'check_violation';
  end if;
  prior := private.registration_replay(me, k, 'enroll', print);
  if prior is not null then return prior; end if;

  shut := private.registration_gate(school);
  if shut = 'kill_switch' then
    return private.registration_refusal(shut, 'Registration changes are stopped by a kill switch right now. Nothing was changed.');
  elsif shut is not null then
    return private.registration_refusal(shut, 'Registration through Semester is not turned on for this school. Nothing was changed.');
  end if;

  select * into sec from public.registration_sections s where s.id = want_section and s.tenant_id = school;
  if sec.id is null then
    return private.registration_refusal('unknown_section', 'No such section this term.');
  end if;
  perform private.registration_lock_term(school, sec.term);
  -- The last-seat lock. Read again under it, so the count below is the one
  -- the previous writer committed, and hold the row until this commits.
  select * into sec from public.registration_sections s where s.id = want_section for update;
  select * into t from public.registration_terms where tenant_id = school and term = sec.term;

  why := private.registration_blocker(me, sec, t, true, null);
  if why = 'hold' then
    -- Which office, and its link. Never why.
    select * into h from public.registration_holds x
     where x.tenant_id = school and x.student = me and x.released_at is null
     order by x.placed_at limit 1;
    return private.registration_refusal('hold',
      'A hold on your account blocks registration. The office that placed it can clear it.',
      jsonb_build_object('hold', jsonb_build_object('office', h.office, 'link', h.link)));
  elsif why is not null then
    return private.registration_refusal(why, sec.course_code || ' ' || sec.section || ': ' || replace(why, '_', ' ') || '.');
  end if;

  if sec.requires_approval and not private.registration_waived(me, sec.id, 'approval') then
    insert into public.registration_enrollments (tenant_id, section_id, student, state)
    values (school, sec.id, me, 'pending_approval') returning id into row_id;
    perform private.registration_audit(school, me, me, sec.id, row_id, 'pending_approval', 'approval_required');
    perform private.registration_recount(sec.id);
    return private.registration_commit(school, me, k, 'enroll', print,
      private.registration_answer('pending_approval', sec.course_code || ' ' || sec.section || ' needs the registrar''s approval.', row_id, sec.id));
  end if;

  where_ := case
    when sec.seats_taken < sec.capacity or private.registration_waived(me, sec.id, 'capacity') then 'seat'
    when sec.waiting < sec.waitlist_capacity then 'waitlist'
    else 'full' end;
  if where_ = 'full' then
    return private.registration_refusal('full', sec.course_code || ' ' || sec.section || ' is full and its waitlist is full.');
  end if;
  if want_expect is not null and want_expect <> where_ then
    return private.registration_refusal('stale_seat_count',
      'The seats in ' || sec.course_code || ' ' || sec.section || ' changed since you reviewed it. Review it again; nothing was changed.',
      jsonb_build_object('seats_taken', sec.seats_taken, 'capacity', sec.capacity, 'waiting', sec.waiting, 'section_version', sec.version));
  end if;

  if where_ = 'seat' then
    insert into public.registration_enrollments (tenant_id, section_id, student, state)
    values (school, sec.id, me, 'enrolled') returning id into row_id;
  else
    insert into public.registration_enrollments (tenant_id, section_id, student, state, wait_seq)
    values (school, sec.id, me, 'waitlisted', nextval('public.registration_wait_seq')) returning id into row_id;
  end if;
  perform private.registration_audit(school, me, me, sec.id, row_id, case where_ when 'seat' then 'enrolled' else 'waitlisted' end, 'ok');
  perform private.registration_recount(sec.id);
  return private.registration_commit(school, me, k, 'enroll', print,
    private.registration_answer(case where_ when 'seat' then 'enrolled' else 'waitlisted' end,
      case where_ when 'seat' then 'Enrolled in ' else 'On the waitlist for ' end || sec.course_code || ' ' || sec.section || '.',
      row_id, sec.id));
end $$;

/*
 * Drop: inside add/drop, leave a seat (the next person waiting may get it);
 * any time, leave a waitlist or withdraw a request for approval. A hold never
 * stops a student getting out of something. After add/drop a seat is left by
 * withdrawing, which records a W.
 */
create or replace function public.registration_drop(want_section uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_school();
  k      text := private.registration_key(want_key);
  print  text := md5(jsonb_build_array('drop', want_section)::text);
  prior  jsonb;
  shut   text;
  sec    public.registration_sections;
  t      public.registration_terms;
  e      public.registration_enrollments;
  next_  text;
  moved  integer := 0;
begin
  prior := private.registration_replay(me, k, 'drop', print);
  if prior is not null then return prior; end if;
  shut := private.registration_gate(school);
  if shut is not null then
    return private.registration_refusal(shut, case shut when 'kill_switch'
      then 'Registration changes are stopped by a kill switch right now. Nothing was changed.'
      else 'Registration through Semester is not turned on for this school. Nothing was changed.' end);
  end if;

  select * into sec from public.registration_sections s where s.id = want_section and s.tenant_id = school;
  if sec.id is null then
    return private.registration_refusal('unknown_section', 'No such section this term.');
  end if;
  perform private.registration_lock_term(school, sec.term);
  select * into sec from public.registration_sections s where s.id = want_section for update;
  select * into t from public.registration_terms where tenant_id = school and term = sec.term;
  select * into e from public.registration_enrollments x
   where x.section_id = sec.id and x.student = me and x.state in ('enrolled', 'waitlisted', 'pending_approval');
  if e.id is null then
    return private.registration_refusal('not_enrolled', 'You are not enrolled or waiting in ' || sec.course_code || ' ' || sec.section || '.');
  end if;

  if e.state = 'enrolled' and now() > t.add_drop_ends_at then
    return private.registration_refusal('drop_deadline_passed',
      'The add/drop deadline for ' || sec.course_code || ' ' || sec.section || ' has passed. You can withdraw instead, which records a W.');
  end if;

  next_ := case e.state when 'waitlisted' then 'left_waitlist' else 'dropped' end;
  update public.registration_enrollments
     set state = next_, wait_seq = null, version = version + 1, updated_at = now()
   where id = e.id;
  perform private.registration_audit(school, me, me, sec.id, e.id, next_, 'ok');
  if e.state = 'enrolled' then
    moved := private.registration_promote(sec.id, me);
  end if;
  perform private.registration_recount(sec.id);
  return private.registration_commit(school, me, k, 'drop', print,
    private.registration_answer(next_, case next_ when 'left_waitlist' then 'Left the waitlist for ' else 'Dropped ' end
      || sec.course_code || ' ' || sec.section || '.', e.id, sec.id, moved));
end $$;

/*
 * Withdraw: after add/drop and before the withdrawal deadline. The
 * enrollment is kept with a W; the seat is not re-sold, because a waitlist is
 * dead once add/drop has closed.
 */
create or replace function public.registration_withdraw(want_section uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_school();
  k      text := private.registration_key(want_key);
  print  text := md5(jsonb_build_array('withdraw', want_section)::text);
  prior  jsonb;
  shut   text;
  sec    public.registration_sections;
  t      public.registration_terms;
  e      public.registration_enrollments;
begin
  prior := private.registration_replay(me, k, 'withdraw', print);
  if prior is not null then return prior; end if;
  shut := private.registration_gate(school);
  if shut is not null then
    return private.registration_refusal(shut, case shut when 'kill_switch'
      then 'Registration changes are stopped by a kill switch right now. Nothing was changed.'
      else 'Registration through Semester is not turned on for this school. Nothing was changed.' end);
  end if;

  select * into sec from public.registration_sections s where s.id = want_section and s.tenant_id = school;
  if sec.id is null then
    return private.registration_refusal('unknown_section', 'No such section this term.');
  end if;
  perform private.registration_lock_term(school, sec.term);
  select * into sec from public.registration_sections s where s.id = want_section for update;
  select * into t from public.registration_terms where tenant_id = school and term = sec.term;
  select * into e from public.registration_enrollments x
   where x.section_id = sec.id and x.student = me and x.state = 'enrolled';
  if e.id is null then
    return private.registration_refusal('not_enrolled', 'You are not enrolled in ' || sec.course_code || ' ' || sec.section || '.');
  end if;
  if now() <= t.add_drop_ends_at then
    return private.registration_refusal('withdraw_not_yet',
      'Add/drop is still open for ' || sec.course_code || ' ' || sec.section || ': drop it instead, and no W is recorded.');
  end if;
  if now() > t.withdraw_ends_at then
    return private.registration_refusal('withdraw_deadline_passed',
      'The withdrawal deadline for ' || sec.course_code || ' ' || sec.section || ' has passed. Ask the registrar.');
  end if;

  update public.registration_enrollments
     set state = 'withdrawn', grade = 'W', version = version + 1, updated_at = now()
   where id = e.id;
  perform private.registration_audit(school, me, me, sec.id, e.id, 'withdrawn', 'ok');
  perform private.registration_recount(sec.id);
  return private.registration_commit(school, me, k, 'withdraw', print,
    private.registration_answer('withdrawn', 'Withdrew from ' || sec.course_code || ' ' || sec.section || '. A W is recorded; the enrollment is kept.', e.id, sec.id));
end $$;

-- ── 10. What a student reads ──────────────────────────────────────────────

-- The caller's own enrollments this term, with their place in any queue.
create or replace function public.my_registration(want_term text)
returns table (enrollment_id uuid, section_id uuid, course_code text, section text, state text, grade text, wait_position integer)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, s.id, s.course_code, s.section, e.state, e.grade, private.registration_position(e.id)
    from public.registration_enrollments e
    join public.registration_sections s on s.id = e.section_id
   where e.student = (select auth.uid())
     and s.tenant_id = (select private.school_of())
     and s.term = want_term
   order by s.course_code, s.section, e.created_at;
$$;

-- Whether the caller has a hold, which office, and its link. Never the reason.
-- One row for a caller with a school; none for one without, who has no
-- registration to hold.
create or replace function public.my_registration_hold()
returns table (held boolean, office text, link text)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id is not null, h.office, h.link
    from (select 1) one
    left join lateral (
      select x.id, x.office, x.link from public.registration_holds x
       where x.student = (select auth.uid())
         and x.tenant_id = (select private.school_of())
         and x.released_at is null
       order by x.placed_at limit 1) h on true
   where (select private.school_of()) is not null;
$$;

-- ── 11. The registrar's writers ───────────────────────────────────────────

create or replace function public.registrar_put_term(
  want_term text, want_opens timestamptz, want_add_drop_ends timestamptz,
  want_withdraw_ends timestamptz, want_max_credits numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_registrar();
begin
  perform private.registration_lock_term(school, coalesce(want_term, ''));
  insert into public.registration_terms (tenant_id, term, opens_at, add_drop_ends_at, withdraw_ends_at, max_credits, updated_by)
  values (school, want_term, want_opens, want_add_drop_ends, want_withdraw_ends, want_max_credits, me)
  on conflict (tenant_id, term) do update
     set opens_at = excluded.opens_at, add_drop_ends_at = excluded.add_drop_ends_at,
         withdraw_ends_at = excluded.withdraw_ends_at, max_credits = excluded.max_credits,
         updated_by = excluded.updated_by, updated_at = now();
  perform private.registration_audit(school, me, null, null, null, 'term_set', 'ok',
    jsonb_build_object('term', want_term, 'opens_at', want_opens, 'add_drop_ends_at', want_add_drop_ends,
                       'withdraw_ends_at', want_withdraw_ends, 'max_credits', want_max_credits));
end $$;

/*
 * Create or change a section. Raising its capacity promotes from the
 * waitlist when the gate is open; lowering it below the seats taken moves
 * nobody out — a seat, once given, is the student's until they leave it.
 */
create or replace function public.registrar_put_section(
  want_term text, want_course text, want_section text, want_title text, want_credits numeric,
  want_capacity integer, want_waitlist integer, want_meetings jsonb, want_prerequisites text[],
  want_requires_approval boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_registrar();
  code   text := private.course_code(want_course);
  needs  text[];
  m      jsonb;
  sid    uuid;
begin
  if code = '' then
    raise exception 'semester: that is not a course code' using errcode = 'check_violation';
  end if;
  if want_meetings is null or jsonb_typeof(want_meetings) <> 'array' or jsonb_array_length(want_meetings) > 14 then
    raise exception 'semester: meetings are a list of at most 14' using errcode = 'check_violation';
  end if;
  for m in select * from jsonb_array_elements(want_meetings) loop
    if jsonb_typeof(m) <> 'object'
       or (m - array['days', 'start', 'end']::text[]) <> '{}'::jsonb
       or jsonb_typeof(m->'days') is distinct from 'array'
       or jsonb_array_length(m->'days') = 0
       or jsonb_path_exists(m->'days', '$[*] ? (@.type() != "number" || @ < 0 || @ > 6 || @ != @.floor())')
       or jsonb_typeof(m->'start') is distinct from 'number'
       or jsonb_typeof(m->'end') is distinct from 'number'
       or (m->>'start')::numeric not between 0 and 1439
       or (m->>'end')::numeric not between 1 and 1440
       or (m->>'start')::numeric <> floor((m->>'start')::numeric)
       or (m->>'end')::numeric <> floor((m->>'end')::numeric)
       or (m->>'end')::numeric <= (m->>'start')::numeric then
      raise exception 'semester: a meeting is {days: 0–6, start and end in minutes, end after start}'
        using errcode = 'check_violation';
    end if;
  end loop;
  select coalesce(array_agg(distinct private.course_code(p)), '{}') into needs
    from unnest(coalesce(want_prerequisites, '{}')) p;
  if '' = any(needs) then
    raise exception 'semester: a prerequisite is not a course code' using errcode = 'check_violation';
  end if;

  perform private.registration_lock_term(school, coalesce(want_term, ''));
  insert into public.registration_sections
    (tenant_id, term, course_code, section, title, credits, capacity, waitlist_capacity, meetings,
     prerequisites, requires_approval, updated_by)
  values (school, want_term, code, btrim(coalesce(want_section, '')), btrim(coalesce(want_title, '')), want_credits,
          want_capacity, coalesce(want_waitlist, 0), want_meetings, needs, coalesce(want_requires_approval, false), me)
  on conflict (tenant_id, term, course_code, section) do update
     set title = excluded.title, credits = excluded.credits, capacity = excluded.capacity,
         waitlist_capacity = excluded.waitlist_capacity, meetings = excluded.meetings,
         prerequisites = excluded.prerequisites, requires_approval = excluded.requires_approval,
         updated_by = excluded.updated_by, updated_at = now()
  returning id into sid;
  perform private.registration_audit(school, me, null, sid, null, 'section_set', 'ok',
    jsonb_build_object('capacity', want_capacity, 'waitlist_capacity', coalesce(want_waitlist, 0)));
  perform private.registration_promote(sid, me);
  perform private.registration_recount(sid);
  return sid;
end $$;

/*
 * An override for one student in one section. A capacity override for a
 * student already waiting seats them now, out of turn, if nothing else
 * blocks them — that is what the registrar granted.
 */
create or replace function public.registrar_grant_override(
  want_student uuid, want_section uuid, want_waives text[], want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_registrar();
  k      text := private.registration_key(want_key);
  kinds  text[] := array(select distinct x from unnest(coalesce(want_waives, '{}')) x order by 1);
  print  text := md5(jsonb_build_array('override', want_student, want_section, kinds, btrim(coalesce(want_reason, '')))::text);
  prior  jsonb;
  shut   text;
  sec    public.registration_sections;
  t      public.registration_terms;
  w      public.registration_enrollments;
  moved  integer := 0;
begin
  prior := private.registration_replay(me, k, 'override', print);
  if prior is not null then return prior; end if;
  shut := private.registration_gate(school);
  if shut is not null then
    return private.registration_refusal(shut, 'Registration changes are stopped or off for this school. Nothing was changed.');
  end if;
  select * into sec from public.registration_sections s where s.id = want_section and s.tenant_id = school;
  if sec.id is null then
    return private.registration_refusal('unknown_section', 'No such section at this school.');
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = want_student and p.school_id = school) then
    return private.registration_refusal('unknown_student', 'No such student at this school.');
  end if;
  if cardinality(kinds) = 0
     or not kinds <@ array['capacity', 'prerequisite', 'time_conflict', 'credit_limit', 'approval', 'late_add']::text[]
     or length(btrim(coalesce(want_reason, ''))) = 0 then
    return private.registration_refusal('bad_override',
      'An override needs a reason and names only capacity, prerequisite, time_conflict, credit_limit, approval or late_add. A hold cannot be overridden here.');
  end if;

  perform private.registration_lock_term(school, sec.term);
  select * into sec from public.registration_sections s where s.id = want_section for update;
  insert into public.registration_overrides (tenant_id, section_id, student, waives, reason, granted_by)
  values (school, sec.id, want_student, kinds, btrim(want_reason), me);
  perform private.registration_audit(school, me, want_student, sec.id, null, 'override_granted', 'ok',
    jsonb_build_object('waives', kinds));

  select * into w from public.registration_enrollments x
   where x.section_id = sec.id and x.student = want_student and x.state = 'waitlisted';
  select * into t from public.registration_terms where tenant_id = school and term = sec.term;
  if w.id is not null and 'capacity' = any(kinds)
     and private.registration_blocker(want_student, sec, t, true, w.id) is null then
    update public.registration_enrollments
       set state = 'enrolled', wait_seq = null, version = version + 1, updated_at = now()
     where id = w.id;
    perform private.registration_audit(school, me, want_student, sec.id, w.id, 'promoted', 'ok');
    moved := 1;
  end if;
  perform private.registration_recount(sec.id);
  return private.registration_commit(school, me, k, 'override', print,
    private.registration_answer('override_granted', 'Override recorded: ' || array_to_string(kinds, ', ') || '.', w.id, sec.id, moved));
end $$;

/*
 * Approve or deny a request waiting for approval. An approval is re-checked
 * against now: a hold or a clash that arrived while it waited still stops it,
 * and a full section is still full.
 */
create or replace function public.registrar_decide(want_enrollment uuid, want_approve boolean, want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_registrar();
  k      text := private.registration_key(want_key);
  print  text := md5(jsonb_build_array('decide', want_enrollment, want_approve, btrim(coalesce(want_reason, '')))::text);
  prior  jsonb;
  shut   text;
  e      public.registration_enrollments;
  sec    public.registration_sections;
  t      public.registration_terms;
  why    text;
  next_  text;
begin
  prior := private.registration_replay(me, k, 'decide', print);
  if prior is not null then return prior; end if;
  shut := private.registration_gate(school);
  if shut is not null then
    return private.registration_refusal(shut, 'Registration changes are stopped or off for this school. Nothing was changed.');
  end if;
  select * into e from public.registration_enrollments x where x.id = want_enrollment and x.tenant_id = school;
  if e.id is null or e.state <> 'pending_approval' then
    return private.registration_refusal('not_pending', 'No request with that id is waiting for approval here.');
  end if;
  if want_approve is null or length(btrim(coalesce(want_reason, ''))) = 0 then
    return private.registration_refusal('bad_override', 'A decision needs yes or no and a reason.');
  end if;
  select * into sec from public.registration_sections where id = e.section_id;
  perform private.registration_lock_term(school, sec.term);
  select * into sec from public.registration_sections where id = e.section_id for update;
  select * into e from public.registration_enrollments where id = want_enrollment;
  if e.state <> 'pending_approval' then
    return private.registration_refusal('not_pending', 'No request with that id is waiting for approval here.');
  end if;

  if not want_approve then
    update public.registration_enrollments set state = 'denied', version = version + 1, updated_at = now() where id = e.id;
    perform private.registration_audit(school, me, e.student, sec.id, e.id, 'denied', 'ok', jsonb_build_object('reason', btrim(want_reason)));
    perform private.registration_recount(sec.id);
    return private.registration_commit(school, me, k, 'decide', print,
      private.registration_answer('denied', 'The request for ' || sec.course_code || ' ' || sec.section || ' was not approved.', e.id, sec.id));
  end if;

  select * into t from public.registration_terms where tenant_id = school and term = sec.term;
  why := private.registration_blocker(e.student, sec, t, true, e.id);
  if why is not null then
    return private.registration_refusal(why, 'The approval cannot take effect now: ' || replace(why, '_', ' ') || '.');
  end if;
  next_ := case
    when sec.seats_taken < sec.capacity or private.registration_waived(e.student, sec.id, 'capacity') then 'enrolled'
    when sec.waiting < sec.waitlist_capacity then 'waitlisted' end;
  if next_ is null then
    return private.registration_refusal('full', sec.course_code || ' ' || sec.section || ' is full and its waitlist is full.');
  end if;

  insert into public.registration_overrides (tenant_id, section_id, student, waives, reason, granted_by)
  values (school, sec.id, e.student, array['approval'], btrim(want_reason), me);
  update public.registration_enrollments
     set state = next_, wait_seq = case next_ when 'waitlisted' then nextval('public.registration_wait_seq') end,
         version = version + 1, updated_at = now()
   where id = e.id;
  perform private.registration_audit(school, me, e.student, sec.id, e.id, 'approved', 'ok', jsonb_build_object('reason', btrim(want_reason)));
  perform private.registration_audit(school, me, e.student, sec.id, e.id, next_, 'ok');
  perform private.registration_recount(sec.id);
  return private.registration_commit(school, me, k, 'decide', print,
    private.registration_answer(next_, 'Approved: ' || case next_ when 'enrolled' then 'enrolled in ' else 'on the waitlist for ' end
      || sec.course_code || ' ' || sec.section || '.', e.id, sec.id));
end $$;

revoke all on function public.registration_enroll(uuid, text, text) from public, anon, authenticated;
revoke all on function public.registration_drop(uuid, text) from public, anon, authenticated;
revoke all on function public.registration_withdraw(uuid, text) from public, anon, authenticated;
revoke all on function public.my_registration(text) from public, anon, authenticated;
revoke all on function public.my_registration_hold() from public, anon, authenticated;
revoke all on function public.registrar_put_term(text, timestamptz, timestamptz, timestamptz, numeric) from public, anon, authenticated;
revoke all on function public.registrar_put_section(text, text, text, text, numeric, integer, integer, jsonb, text[], boolean) from public, anon, authenticated;
revoke all on function public.registrar_grant_override(uuid, uuid, text[], text, text) from public, anon, authenticated;
revoke all on function public.registrar_decide(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.registration_enroll(uuid, text, text) to authenticated;
grant execute on function public.registration_drop(uuid, text) to authenticated;
grant execute on function public.registration_withdraw(uuid, text) to authenticated;
grant execute on function public.my_registration(text) to authenticated;
grant execute on function public.my_registration_hold() to authenticated;
grant execute on function public.registrar_put_term(text, timestamptz, timestamptz, timestamptz, numeric) to authenticated;
grant execute on function public.registrar_put_section(text, text, text, text, numeric, integer, integer, jsonb, text[], boolean) to authenticated;
grant execute on function public.registrar_grant_override(uuid, uuid, text[], text, text) to authenticated;
grant execute on function public.registrar_decide(uuid, boolean, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.registrar_decide(uuid, boolean, text, text);
--   drop function if exists public.registrar_grant_override(uuid, uuid, text[], text, text);
--   drop function if exists public.registrar_put_section(text, text, text, text, numeric, integer, integer, jsonb, text[], boolean);
--   drop function if exists public.registrar_put_term(text, timestamptz, timestamptz, timestamptz, numeric);
--   drop function if exists public.my_registration_hold();
--   drop function if exists public.my_registration(text);
--   drop function if exists public.registration_withdraw(uuid, text);
--   drop function if exists public.registration_drop(uuid, text);
--   drop function if exists public.registration_enroll(uuid, text, text);
--   drop function if exists private.registration_key(text);
--   drop function if exists private.registration_answer(text, text, uuid, uuid, integer);
--   drop function if exists private.registration_lock_term(text, text);
--   drop function if exists private.registration_commit(text, uuid, text, text, text, jsonb);
--   drop function if exists private.registration_replay(uuid, text, text, text);
--   drop function if exists private.registration_promote(uuid, uuid);
--   drop function if exists private.registration_position(uuid);
--   drop function if exists private.registration_recount(uuid);
--   drop function if exists private.registration_blocker(uuid, public.registration_sections, public.registration_terms, boolean, uuid);
--   drop function if exists private.registration_audit(text, uuid, uuid, uuid, uuid, text, text, jsonb);
--   drop function if exists private.registration_waived(uuid, uuid, text);
--   drop function if exists private.registration_clash(jsonb, jsonb);
--   drop function if exists private.registration_refusal(text, text, jsonb);
--   drop function if exists private.registration_gate(text);
--   drop function if exists private.registration_registrar();
--   drop function if exists private.registration_school();
--   drop table if exists public.registration_audit_event, public.registration_requests,
--     public.registration_overrides, public.registration_completions,
--     public.registration_holds, public.registration_enrollments, public.registration_sections,
--     public.registration_terms;
--   drop sequence if exists public.registration_wait_seq;
--   delete from public.role_capabilities where capability = 'registration:administer';
--   delete from public.app_capabilities where capability = 'registration:administer';
--   commit;
