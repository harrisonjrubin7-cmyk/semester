-- Semester — the K–12 edition, and guardian links for students 13 to 17 (K12-002).
--
-- Safe to run again.
--
-- ## The decision
--
-- D-139 set the minimum age at 13 and asked for the full K–12 edition behind
-- it. This is the edition's first piece: a school can be a K–12 school, it
-- names its grade levels, and its staff can record who a student's parent or
-- guardian is. Nobody under 13 holds an account, so every K–12 student here is
-- 13 or over; a guardian link only matters while the student is a minor.
--
-- ## Why a guardian link is not a family grant
--
-- `family_grants` is consent an adult student gives a supporter, and the
-- student can take it back. For a minor, the parent or guardian holds the
-- education-record rights by default, and the school, not the student, knows
-- who that is. So a guardian link is made and verified by school staff, the
-- student can see it but not end it, and it stops counting on the day the
-- student turns 18 — read at query time from `private.is_minor`, which is
-- already true "until the day they turn 18, with nothing to run on that day".
-- Nothing has to be swept for the rights to move to the student.
--
-- ## What a guardian can see, today
--
-- Their own links, and nothing else. The parent portal (K12-003) will read a
-- student's records through `private.guardian_may_read`; this migration only
-- makes the answer to "who may read" exist and be tested.
--
-- ## What is kept apart
--
-- A restriction (a court order, a named limit) is written for staff, and a
-- guardian must never read what it says about them, so it is its own table
-- with its own policy rather than a column the guardian's row would carry.

-- ── The edition ─────────────────────────────────────────────────────────────

alter table public.schools
  add column if not exists edition text not null default 'higher_ed';
alter table public.schools drop constraint if exists schools_edition_known;
alter table public.schools
  add constraint schools_edition_known check (edition in ('higher_ed', 'k12'));

-- The capability that lets school staff record and verify guardians.
insert into public.app_capabilities (capability, about) values
  ('guardians:manage', 'Record, verify, restrict and end the guardian links of one K–12 school''s students.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('university_admin', 'guardians:manage'),
  ('university_staff', 'guardians:manage')
on conflict do nothing;

-- ── Grade levels ────────────────────────────────────────────────────────────

create table if not exists public.grade_levels (
  school_id  text     not null references public.schools on delete cascade,
  -- Kindergarten to twelfth grade. The codes are the school's; the labels are
  -- what it prints ("Grade 9", "Freshman", "Year 10").
  code       text     not null check (code ~ '^(K|[1-9]|1[0-2])$'),
  label      text     not null check (length(trim(label)) between 1 and 40),
  sort_order smallint not null check (sort_order between 0 and 12),
  primary key (school_id, code)
);
alter table public.grade_levels enable row level security;

drop policy if exists "school members read grade levels" on public.grade_levels;
create policy "school members read grade levels" on public.grade_levels
  for select to authenticated
  using (school_id = (select p.school_id from public.profiles p where p.user_id = (select auth.uid())));

drop policy if exists "tenant administrators write grade levels" on public.grade_levels;
create policy "tenant administrators write grade levels" on public.grade_levels
  for all to authenticated
  using (private.has_capability('tenant:configure', 'school', school_id))
  with check (private.has_capability('tenant:configure', 'school', school_id));

-- Grade levels are configuration of a K–12 school, like the links; an ordinary
-- higher-ed school cannot keep them.
create or replace function private.grade_level_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.schools s where s.id = new.school_id and s.edition = 'k12') then
    raise exception 'semester: grade levels are for K–12 schools' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function private.grade_level_rules() from public;

drop trigger if exists grade_level_rules on public.grade_levels;
create trigger grade_level_rules
  before insert or update on public.grade_levels
  for each row execute function private.grade_level_rules();

-- ── Guardian links ──────────────────────────────────────────────────────────

create table if not exists public.guardian_links (
  id            uuid        primary key default gen_random_uuid(),
  school_id     text        not null references public.schools on delete cascade,
  student_id    uuid        not null references auth.users on delete cascade,
  guardian_id   uuid        not null references auth.users on delete cascade,
  relationship  text        not null check (relationship in ('parent', 'legal_guardian', 'other_caregiver')),
  -- `full` reads and acts (signs a form, books a conference); `view_only`
  -- reads; `none` is recorded and reads nothing, for a parent a court order
  -- keeps out.
  rights        text        not null default 'view_only' check (rights in ('full', 'view_only', 'none')),
  -- Set by the trigger from the caller, never by the client.
  verified_by   uuid        references auth.users on delete set null,
  verified_at   timestamptz not null default now(),
  ended_at      timestamptz,
  ended_reason  text        check (ended_reason in ('school', 'student_left', 'guardian_left')),
  created_at    timestamptz not null default now(),
  constraint guardian_links_not_self check (student_id <> guardian_id),
  constraint guardian_links_end_is_whole check ((ended_at is null) = (ended_reason is null))
);
alter table public.guardian_links enable row level security;

-- One live link per student and guardian; an ended one stays as history.
create unique index if not exists guardian_links_one_live
  on public.guardian_links (student_id, guardian_id) where ended_at is null;
create index if not exists guardian_links_by_guardian on public.guardian_links (guardian_id);
create index if not exists guardian_links_by_school on public.guardian_links (school_id);
create index if not exists guardian_links_by_student on public.guardian_links (student_id);
create index if not exists guardian_links_by_verifier on public.guardian_links (verified_by);

-- What staff may know that a guardian may not read.
create table if not exists public.guardian_link_restrictions (
  link_id      uuid        primary key references public.guardian_links on delete cascade,
  school_id    text        not null references public.schools on delete cascade,
  court_order  boolean     not null default false,
  note         text        not null default '' check (length(note) <= 500),
  written_by   uuid        references auth.users on delete set null,
  written_at   timestamptz not null default now()
);
alter table public.guardian_link_restrictions enable row level security;
create index if not exists guardian_link_restrictions_by_school on public.guardian_link_restrictions (school_id);
create index if not exists guardian_link_restrictions_by_writer on public.guardian_link_restrictions (written_by);

-- Every change to a link, kept. No client writes it, and nobody rewrites it.
create table if not exists public.guardian_link_history (
  id          bigint      generated always as identity primary key,
  link_id     uuid        not null,
  -- Goes with the school and with the student's account, like the link it
  -- records (RETENTION.md): neither may leave their history behind.
  school_id   text        not null references public.schools on delete cascade,
  student_id  uuid        not null references auth.users on delete cascade,
  -- The staff account that made the change. A foreign key, so that erasing
  -- that account finds and clears it (`private.account_data_map()` reads the
  -- foreign keys), and so the name is not left in the history for good.
  changed_by  uuid        references auth.users on delete set null,
  changed_at  timestamptz not null default now(),
  action      text        not null check (action in ('created', 'changed', 'ended')),
  rights      text        not null,
  relationship text       not null
);
alter table public.guardian_link_history enable row level security;
create index if not exists guardian_link_history_by_link on public.guardian_link_history (link_id);
create index if not exists guardian_link_history_by_student on public.guardian_link_history (student_id);
create index if not exists guardian_link_history_by_school on public.guardian_link_history (school_id);
create index if not exists guardian_link_history_by_actor on public.guardian_link_history (changed_by);

-- ── The rules a link must meet ──────────────────────────────────────────────
--
-- A trigger, not a policy, because they hold for every writer — staff, the
-- service role and a migration alike — and because two of them read
-- `private.account_ages`, which no client may.

create or replace function private.guardian_link_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  edition text;
  student_school text;
begin
  -- The verifier's own account being deleted: the foreign key sets
  -- `verified_by` to null, on live and ended links alike, and that is the name
  -- going, not the verification being edited. It is allowed only when nothing
  -- else changes in the same statement, and before the edition check: a school
  -- moved back to `higher_ed` keeps its links, and must not make their
  -- verifier's account impossible to erase.
  -- `pg_trigger_depth() > 1` is what tells the cascade (the foreign key's own
  -- trigger is depth 1, this one depth 2) from a person's UPDATE (depth 1).
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.verified_by is not null and new.verified_by is null
     and new.student_id = old.student_id and new.guardian_id = old.guardian_id
     and new.school_id = old.school_id and new.created_at = old.created_at
     and new.verified_at = old.verified_at and new.relationship = old.relationship
     and new.rights = old.rights and new.ended_at is not distinct from old.ended_at
     and new.ended_reason is not distinct from old.ended_reason then
    return new;
  end if;

  select s.edition into edition from public.schools s where s.id = new.school_id;
  if edition is distinct from 'k12' then
    raise exception 'semester: guardian links are for K–12 schools' using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    select p.school_id into student_school from public.profiles p where p.user_id = new.student_id;
    if student_school is distinct from new.school_id then
      raise exception 'semester: the student is not at this school' using errcode = 'check_violation';
    end if;
    if not private.is_minor(new.student_id) then
      raise exception 'semester: a guardian link is for a student under 18' using errcode = 'check_violation';
    end if;
    -- The guardian has said they are an adult. An account that never stated
    -- an age is not cleared (D-139), so it cannot be made a guardian either.
    if not private.age_cleared(new.guardian_id) then
      raise exception 'semester: a guardian must be an adult who has stated their age' using errcode = 'check_violation';
    end if;
    new.verified_by := (select auth.uid());
    new.verified_at := now();
    new.created_at := now();
    new.ended_at := null;
    new.ended_reason := null;
  else
    -- Who, where and when a link was made are facts, not settings.
    if new.student_id <> old.student_id or new.guardian_id <> old.guardian_id
       or new.school_id <> old.school_id or new.created_at <> old.created_at
       or new.verified_by is distinct from old.verified_by or new.verified_at <> old.verified_at then
      raise exception 'semester: a guardian link''s people, school and verification cannot change; end it and make another'
        using errcode = 'check_violation';
    end if;
    if old.ended_at is not null then
      raise exception 'semester: an ended guardian link cannot change' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guardian_link_rules() from public;

drop trigger if exists guardian_link_rules on public.guardian_links;
create trigger guardian_link_rules
  before insert or update on public.guardian_links
  for each row execute function private.guardian_link_rules();

create or replace function private.record_guardian_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guardian_link_history
    (link_id, school_id, student_id, changed_by, action, rights, relationship)
  values
    (new.id, new.school_id, new.student_id,
     -- Null when the acting account is the one being deleted (the foreign key
     -- would refuse a name that is going).
     (select u.id from auth.users u where u.id = (select auth.uid())),
     case when tg_op = 'INSERT' then 'created'
          when new.ended_at is not null then 'ended'
          else 'changed' end,
     new.rights, new.relationship);
  return null;
end $$;
revoke all on function private.record_guardian_link_change() from public;

drop trigger if exists guardian_link_history on public.guardian_links;
create trigger guardian_link_history
  after insert or update on public.guardian_links
  for each row execute function private.record_guardian_link_change();

create or replace function private.refuse_guardian_history_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The removals allowed: the student's account or the school is being
  -- deleted, and the cascade is taking their history with it.
  if tg_op = 'DELETE' and (
       not exists (select 1 from auth.users u where u.id = old.student_id)
       or not exists (select 1 from public.schools s where s.id = old.school_id)) then
    return old;
  end if;
  -- The one edit allowed: the staff account that made the change is being
  -- deleted, and the foreign key is clearing its name. Nothing else changes.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.changed_by is not null and new.changed_by is null
     and new.id = old.id and new.link_id = old.link_id and new.school_id = old.school_id
     and new.student_id = old.student_id and new.changed_at = old.changed_at
     and new.action = old.action and new.rights = old.rights
     and new.relationship = old.relationship then
    return new;
  end if;
  raise exception 'semester: guardian link history is kept as written' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.refuse_guardian_history_change() from public;

drop trigger if exists guardian_link_history_is_kept on public.guardian_link_history;
create trigger guardian_link_history_is_kept
  before update or delete on public.guardian_link_history
  for each row execute function private.refuse_guardian_history_change();

-- The restriction row belongs to the link's school, whoever writes it.
create or replace function private.guardian_restriction_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The writer's own account being deleted: the foreign key clears the name
  -- and nothing else changes, so the audit time stays what it was.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1
     and old.written_by is not null and new.written_by is null
     and new.link_id = old.link_id and new.school_id = old.school_id
     and new.court_order = old.court_order and new.note = old.note
     and new.written_at = old.written_at then
    return new;
  end if;
  select l.school_id into new.school_id from public.guardian_links l where l.id = new.link_id;
  new.written_by := (select auth.uid());
  new.written_at := now();
  return new;
end $$;
revoke all on function private.guardian_restriction_rules() from public;

drop trigger if exists guardian_restriction_rules on public.guardian_link_restrictions;
create trigger guardian_restriction_rules
  before insert or update on public.guardian_link_restrictions
  for each row execute function private.guardian_restriction_rules();

-- ── Who may read a student's records as their guardian ─────────────────────
--
-- The one answer the parent portal will ask. A live, verified link with
-- rights to read, at a K–12 school, for a student who is still a minor today.
-- On the student's 18th birthday this turns false with nothing run.

create or replace function private.guardian_may_read(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select student is not null
     and private.is_minor(student)
     and exists (
       select 1
         from public.guardian_links l
         join public.schools s on s.id = l.school_id and s.edition = 'k12'
        where l.student_id = student
          and l.guardian_id = (select auth.uid())
          and l.ended_at is null
          and l.rights in ('full', 'view_only')
     );
$$;
revoke all on function private.guardian_may_read(uuid) from public;

-- ── Grants ──────────────────────────────────────────────────────────────────
--
-- What each client role may attempt at all; the policies below decide which
-- rows. Nothing is granted to `anon`, and no client may delete a link or write
-- history.

revoke all on table public.grade_levels, public.guardian_links,
                    public.guardian_link_restrictions, public.guardian_link_history
  from anon, authenticated;
grant select, insert, update, delete on table public.grade_levels to authenticated;
grant select, insert, update on table public.guardian_links to authenticated;
grant select, insert, update on table public.guardian_link_restrictions to authenticated;
grant select on table public.guardian_link_history to authenticated;

-- ── Policies ────────────────────────────────────────────────────────────────

-- A guardian sees their own links; a student sees the links about them; the
-- school's staff with the capability see and manage every link at the school.
drop policy if exists "people in a guardian link read it" on public.guardian_links;
create policy "people in a guardian link read it" on public.guardian_links
  for select to authenticated
  using (guardian_id = (select auth.uid()) or student_id = (select auth.uid()));

drop policy if exists "school staff read guardian links" on public.guardian_links;
create policy "school staff read guardian links" on public.guardian_links
  for select to authenticated
  using (private.has_capability('guardians:manage', 'school', school_id));

drop policy if exists "school staff record guardian links" on public.guardian_links;
create policy "school staff record guardian links" on public.guardian_links
  for insert to authenticated
  with check (private.has_capability('guardians:manage', 'school', school_id)
              and guardian_id <> (select auth.uid())
              and student_id <> (select auth.uid()));

drop policy if exists "school staff change guardian links" on public.guardian_links;
create policy "school staff change guardian links" on public.guardian_links
  for update to authenticated
  using (private.has_capability('guardians:manage', 'school', school_id))
  with check (private.has_capability('guardians:manage', 'school', school_id));

-- No delete policy: a link is ended, never removed.

drop policy if exists "school staff read restrictions" on public.guardian_link_restrictions;
create policy "school staff read restrictions" on public.guardian_link_restrictions
  for select to authenticated
  using (private.has_capability('guardians:manage', 'school', school_id));

drop policy if exists "school staff write restrictions" on public.guardian_link_restrictions;
create policy "school staff write restrictions" on public.guardian_link_restrictions
  for insert to authenticated
  with check (exists (select 1 from public.guardian_links l
                       where l.id = link_id
                         and private.has_capability('guardians:manage', 'school', l.school_id)));

drop policy if exists "school staff change restrictions" on public.guardian_link_restrictions;
create policy "school staff change restrictions" on public.guardian_link_restrictions
  for update to authenticated
  using (private.has_capability('guardians:manage', 'school', school_id))
  with check (private.has_capability('guardians:manage', 'school', school_id));

drop policy if exists "school staff and the student read link history" on public.guardian_link_history;
create policy "school staff and the student read link history" on public.guardian_link_history
  for select to authenticated
  using (student_id = (select auth.uid())
         or private.has_capability('guardians:manage', 'school', school_id));
