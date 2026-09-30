-- Semester — the instructor gradebook of record, and grade passback.
--
-- The faculty side of grading. `app/src/lib/grades.ts` is a student's own
-- arithmetic over numbers they typed; nothing here reads or changes it. This
-- is what an institution keeps: grade items in weighted categories, scores as
-- an append-only history, a second person's moderation, controlled release,
-- regrade requests and their answers, the registrar's export, and a queue of
-- released grades for passback to an LMS. `app/src/lib/gradebook/` decides
-- the same things in TypeScript so a refusal is named before a call; this
-- file is the authority.
--
-- What it decides, and where:
--
--   * **Scope.** A course is `<school>/<CODE>` plus a term, exactly as
--     `20260928309000_course_studio.sql` keys one. The school is the caller's
--     own (`profiles.school_id`), never a parameter.
--   * **Grading authority is per term.** Every course-scope gradebook grant
--     is held on scope id `<school>/<CODE>/<TERM>` — `vu/ECON 1020/2027SP` —
--     and every check here passes the row's own term. Grades are the most
--     private thing an instructor holds about a student, and teaching a
--     course this term is not a reason to read last year's section: a grant
--     keyed on `<school>/<CODE>` alone would let this spring's TA read every
--     earlier cohort's drafts, comments and regrade history. So a grant with
--     no term authorises nothing in the gradebook. (Course Studio's
--     `course:publish` stays on `<school>/<CODE>`; an instructor who does
--     both holds a grant at each scope.) The registrar's `grades:export` at
--     school scope is the one grant that spans terms, and it reads released
--     rows only.
--   * **Who.** Four new capabilities, checked with `private.has_capability`
--     at course-and-term scope — `grades:enter` (faculty, teaching assistants),
--     `grades:moderate` (faculty: a second instructor on the course),
--     `grades:release` (faculty), `grades:export` (faculty, the registrar).
--     Export is also honoured at school scope, where a registrar's grant
--     sits. A department chair gets nothing here: the role register says a
--     chair sees aggregates and never individual records, and moderation is
--     reading individual grades. A fifth, `grades:receive`, is the
--     roster: the student roles carry it, and only somebody holding it on
--     this course can be graded here. Grants are written by the institution;
--     nothing here grants one.
--   * **Append-only.** No client may insert, update or delete any table here.
--     Every change to a grade is a new row in `grade_entries` — entered,
--     changed, moderated, released, regraded — carrying who, why and the
--     operation that made it, so how a grade came to be is always answerable.
--     A student sees only `released` rows, and only their own; a change
--     after release is a new draft, so the released grade stays what they
--     see until the change is released.
--   * **Moderation** is a second person: the grader cannot moderate their own
--     grade, and a scheme can require it before release.
--   * **Idempotent.** Every mutation takes a key. The same key and request
--     from the same caller answers as the first call did and writes nothing;
--     the same key for anything else is refused. `gradebook_operations` is the
--     ledger of keys, and its row is the audit correlation for the rows each
--     operation wrote.
--   * **Passback** queues only a released version with a score, once per
--     version (`grade_passbacks.entry_id` is unique), and only while
--     `kill.writeback` and `kill.integration_sync` are disengaged and
--     `integration.lms_lti` and `writeback.lms_grade_passback` are on in
--     production for the school. The sender is a service; it records the
--     outcome through `gradebook_record_passback`, which no client can call.
--
-- Account deletion: a student's grade rows cascade from `auth.users`, and the
-- people who graded them are set null, as `erasure.test.ts` requires of every
-- column naming an account. The registrar's copy, exported, is the
-- institution's record.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The capabilities ──────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('grades:enter',    'Enter and change draft grades, and resolve regrade requests, for one course.'),
  ('grades:moderate', 'Moderate another grader''s draft grades before release, for one course.'),
  ('grades:release',  'Set the grading scheme, add items, release grades and queue passback for one course.'),
  ('grades:export',   'Read and export released grades for one course or school, for the registrar.'),
  ('grades:receive',  'Be graded in one course: the gradebook''s roster.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('faculty',               'grades:enter'),
  ('faculty',               'grades:moderate'),
  ('faculty',               'grades:release'),
  ('faculty',               'grades:export'),
  ('teaching_assistant',    'grades:enter'),
  ('registrar',             'grades:export'),
  ('student',               'grades:receive'),
  ('undergraduate_student', 'grades:receive'),
  ('graduate_student',      'grades:receive'),
  ('transfer_student',      'grades:receive')
on conflict do nothing;

-- ── Tables ────────────────────────────────────────────────────────────────

-- The keys every mutation spends. `request` is what was asked, `result` what
-- was answered; a replay compares the first and returns the second.
create table if not exists public.gradebook_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('scheme', 'item', 'enter', 'moderate', 'release', 'regrade', 'resolve', 'passback')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

-- The grading scheme, one row per version: categories and weights, the letter
-- scale, and whether moderation is required. The latest version is in force.
create table if not exists public.gradebook_schemes (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null references public.schools(id) on delete cascade,
  course_code         text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term                text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  version             integer     not null check (version >= 1),
  -- [{key, name, weight, drop_lowest}], weights summing to 100: checked by
  -- the setter, item by item.
  categories          jsonb       not null check (jsonb_typeof(categories) = 'array' and jsonb_array_length(categories) between 1 and 30),
  -- [{letter, min}], strictly descending to 0.
  letters             jsonb       not null check (jsonb_typeof(letters) = 'array' and jsonb_array_length(letters) between 1 and 30),
  moderation_required boolean     not null default false,
  set_by              uuid        references auth.users on delete set null,
  operation           text        not null,
  set_at              timestamptz not null default now(),
  unique (tenant_id, course_code, term, version)
);

create table if not exists public.gradebook_items (
  id              uuid          primary key default gen_random_uuid(),
  tenant_id       text          not null references public.schools(id) on delete cascade,
  course_code     text          not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term            text          not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  category_key    text          not null check (category_key ~ '^[a-z][a-z0-9-]{0,30}$'),
  title           text          not null check (length(btrim(title)) between 1 and 200),
  points_possible numeric(9, 3) not null check (points_possible > 0 and points_possible <= 100000),
  -- The LMS column this passes back to; null keeps it out of passback.
  line_item       text          check (line_item is null or length(btrim(line_item)) between 1 and 500),
  created_by      uuid          references auth.users on delete set null,
  operation       text          not null,
  created_at      timestamptz   not null default now()
);

create table if not exists public.grade_entries (
  id          uuid          primary key default gen_random_uuid(),
  tenant_id   text          not null references public.schools(id) on delete cascade,
  course_code text          not null,
  term        text          not null,
  item_id     uuid          not null references public.gradebook_items(id) on delete cascade,
  student_id  uuid          not null references auth.users on delete cascade,
  version     integer       not null check (version >= 1),
  score       numeric(9, 3) check (score is null or score >= 0),
  mark        text          check (mark in ('late', 'excused', 'incomplete', 'missing')),
  comment     text          not null default '' check (length(comment) <= 4000),
  status      text          not null check (status in ('draft', 'moderated', 'released')),
  action      text          not null check (action in ('entered', 'changed', 'moderated', 'released', 'regraded')),
  graded_by   uuid          references auth.users on delete set null,
  actor       uuid          references auth.users on delete set null,
  reason      text          not null default '' check (length(reason) <= 2000),
  regrade_id  uuid,
  operation   text          not null,
  created_at  timestamptz   not null default now(),
  unique (item_id, student_id, version),
  -- A number, or a mark that stands in for one; never a number on work that
  -- was excused or never handed in.
  check (score is not null or mark in ('excused', 'incomplete', 'missing')),
  check (not (score is not null and mark in ('excused', 'missing')))
);

create table if not exists public.regrade_requests (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  course_code     text        not null,
  term            text        not null,
  item_id         uuid        not null references public.gradebook_items(id) on delete cascade,
  student_id      uuid        not null references auth.users on delete cascade,
  -- The released version the student was shown and contested.
  contested_entry uuid        not null references public.grade_entries(id) on delete cascade,
  reason          text        not null check (length(btrim(reason)) between 1 and 2000),
  operation       text        not null,
  filed_at        timestamptz not null default now()
);

-- A request's answer: at most one, never changed.
create table if not exists public.regrade_resolutions (
  request_id  uuid        primary key references public.regrade_requests on delete cascade,
  tenant_id   text        not null references public.schools(id) on delete cascade,
  outcome     text        not null check (outcome in ('upheld', 'changed')),
  note        text        not null check (length(btrim(note)) between 1 and 2000),
  -- The new draft version, when the outcome changed the grade.
  entry_id    uuid        references public.grade_entries(id) on delete cascade,
  resolved_by uuid        references auth.users on delete set null,
  operation   text        not null,
  resolved_at timestamptz not null default now(),
  check ((outcome = 'changed') = (entry_id is not null))
);

-- The passback queue: one row per released version, ever.
create table if not exists public.grade_passbacks (
  id          uuid          primary key default gen_random_uuid(),
  tenant_id   text          not null references public.schools(id) on delete cascade,
  course_code text          not null,
  term        text          not null,
  entry_id    uuid          not null unique references public.grade_entries(id) on delete cascade,
  item_id     uuid          not null references public.gradebook_items(id) on delete cascade,
  student_id  uuid          not null references auth.users on delete cascade,
  line_item   text          not null,
  score       numeric(9, 3) not null,
  points      numeric(9, 3) not null,
  status      text          not null default 'queued' check (status in ('queued', 'sent', 'failed', 'abandoned')),
  attempts    integer       not null default 0 check (attempts >= 0),
  detail      text          not null default '' check (length(detail) <= 500),
  queued_by   uuid          references auth.users on delete set null,
  operation   text          not null,
  queued_at   timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

-- `grade_entries.regrade_id` names the request a regraded version answers.
-- Added here rather than in the table because the two tables name each other.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'grade_entries_regrade_id_fkey') then
    alter table public.grade_entries
      add constraint grade_entries_regrade_id_fkey
      foreign key (regrade_id) references public.regrade_requests(id) on delete cascade;
  end if;
end $$;

-- Every foreign key covered (`indexes.check.sql`), each index by its lead column.
create index if not exists gradebook_operations_by_actor on public.gradebook_operations (actor);
create index if not exists gradebook_schemes_by_setter on public.gradebook_schemes (set_by);
create index if not exists gradebook_items_by_course on public.gradebook_items (tenant_id, course_code, term);
create index if not exists gradebook_items_by_creator on public.gradebook_items (created_by);
create index if not exists grade_entries_by_course on public.grade_entries (tenant_id, course_code, term);
create index if not exists grade_entries_by_student on public.grade_entries (student_id);
create index if not exists grade_entries_by_grader on public.grade_entries (graded_by);
create index if not exists grade_entries_by_actor on public.grade_entries (actor);
create index if not exists grade_entries_by_regrade on public.grade_entries (regrade_id);
create index if not exists regrade_requests_by_course on public.regrade_requests (tenant_id, course_code, term);
create index if not exists regrade_requests_by_item on public.regrade_requests (item_id, student_id);
create index if not exists regrade_requests_by_student on public.regrade_requests (student_id);
create index if not exists regrade_requests_by_entry on public.regrade_requests (contested_entry);
create index if not exists regrade_resolutions_by_tenant on public.regrade_resolutions (tenant_id);
create index if not exists regrade_resolutions_by_entry on public.regrade_resolutions (entry_id);
create index if not exists regrade_resolutions_by_resolver on public.regrade_resolutions (resolved_by);
create index if not exists grade_passbacks_by_course on public.grade_passbacks (tenant_id, course_code, term);
create index if not exists grade_passbacks_by_item on public.grade_passbacks (item_id);
create index if not exists grade_passbacks_by_student on public.grade_passbacks (student_id);
create index if not exists grade_passbacks_by_queuer on public.grade_passbacks (queued_by);

comment on table public.gradebook_operations is 'Idempotency keys the gradebook''s mutations spent, with what each asked and answered. Append-only.';
comment on table public.gradebook_schemes is 'A course''s grading scheme per term, one row per version. Append-only.';
comment on table public.gradebook_items is 'The graded items of a course and term, each in a scheme category. Append-only.';
comment on table public.grade_entries is 'Every version of every grade: entered, changed, moderated, released, regraded. Append-only; students read only their own released rows.';
comment on table public.regrade_requests is 'A student''s request to look again at a released grade. Append-only.';
comment on table public.regrade_resolutions is 'The one answer to a regrade request. Append-only.';
comment on table public.grade_passbacks is 'Released grade versions queued for LMS passback, one row per version; the status is the sender''s.';

-- ── Who reads ─────────────────────────────────────────────────────────────

-- The scope id a course's gradebook grants are held on: `<school>/<CODE>/<TERM>`.
-- Null when any part is null, and `has_capability` answers false for null, so
-- a missing term authorises nothing rather than falling back to the course.
create or replace function private.gradebook_scope(want_tenant text, want_code text, want_term text)
returns text
language sql
immutable
set search_path = ''
as $$
  select want_tenant || '/' || want_code || '/' || want_term;
$$;

revoke all on function private.gradebook_scope(text, text, text) from public, anon, authenticated;
grant execute on function private.gradebook_scope(text, text, text) to authenticated;

-- Course staff: anybody holding a gradebook capability over this course in
-- this term, or export over the school, at their own school.
create or replace function private.gradebook_staff(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and (private.has_capability('grades:enter',    'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('grades:moderate', 'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('grades:release',  'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('grades:export',   'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('grades:export',   'school', want_tenant));
$$;

revoke all on function private.gradebook_staff(text, text, text) from public, anon, authenticated;
grant execute on function private.gradebook_staff(text, text, text) to authenticated;

-- Who may see a grade before it is released: the people who enter, moderate
-- or release it for this course. Export is deliberately not among them — the
-- registrar exports released grades, and an instructor's working draft is
-- not the registrar's to read. Per term, like every course grant here.
create or replace function private.gradebook_author(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and (private.has_capability('grades:enter',    'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('grades:moderate', 'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('grades:release',  'course', private.gradebook_scope(want_tenant, want_code, want_term)));
$$;

revoke all on function private.gradebook_author(text, text, text) from public, anon, authenticated;
grant execute on function private.gradebook_author(text, text, text) to authenticated;

alter table public.gradebook_operations enable row level security;
alter table public.gradebook_schemes enable row level security;
alter table public.gradebook_items enable row level security;
alter table public.grade_entries enable row level security;
alter table public.regrade_requests enable row level security;
alter table public.regrade_resolutions enable row level security;
alter table public.grade_passbacks enable row level security;

revoke all on table public.gradebook_operations from anon, authenticated;
revoke all on table public.gradebook_schemes from anon, authenticated;
revoke all on table public.gradebook_items from anon, authenticated;
revoke all on table public.grade_entries from anon, authenticated;
revoke all on table public.regrade_requests from anon, authenticated;
revoke all on table public.regrade_resolutions from anon, authenticated;
revoke all on table public.grade_passbacks from anon, authenticated;
grant select on table public.gradebook_operations to authenticated;
grant select on table public.gradebook_schemes to authenticated;
grant select on table public.gradebook_items to authenticated;
grant select on table public.grade_entries to authenticated;
grant select on table public.regrade_requests to authenticated;
grant select on table public.regrade_resolutions to authenticated;
grant select on table public.grade_passbacks to authenticated;

drop policy if exists "callers read their own operations" on public.gradebook_operations;
create policy "callers read their own operations" on public.gradebook_operations
  for select to authenticated
  using (actor = (select auth.uid()));

-- The scheme and the items are the course's, not any student's: its staff and
-- its enrolled students read them, for the term they hold.
--
-- `grades:receive`, the roster, is per term too. It is not only a read: it is
-- what `gradebook_enter` checks before accepting a score, so it answers "may
-- this person be graded in this section". Enrollment is per term — a student
-- who took ECON 1020 in 2026FA is not in 2027SP's section — and an untermed
-- roster grant would let any later term's grader enter a grade for every
-- student who ever took the course. A scheme and an item list are not
-- secret, but reading them under the same key the grade is written under
-- keeps one scope for one offering, and a student reading an old section
-- still holds that section's term grant.
drop policy if exists "staff and the roster read the scheme" on public.gradebook_schemes;
create policy "staff and the roster read the scheme" on public.gradebook_schemes
  for select to authenticated
  using (private.gradebook_staff(tenant_id, course_code, term)
         or private.has_capability('grades:receive', 'course', private.gradebook_scope(tenant_id, course_code, term)));
drop policy if exists "staff and the roster read the items" on public.gradebook_items;
create policy "staff and the roster read the items" on public.gradebook_items
  for select to authenticated
  using (private.gradebook_staff(tenant_id, course_code, term)
         or private.has_capability('grades:receive', 'course', private.gradebook_scope(tenant_id, course_code, term)));

-- The rule a student relies on: their own released rows, and no others. The
-- course's authors read drafts; other staff (the registrar, through export)
-- read released rows only.
drop policy if exists "staff read grades, students their own released ones" on public.grade_entries;
create policy "staff read grades, students their own released ones" on public.grade_entries
  for select to authenticated
  using (private.gradebook_author(tenant_id, course_code, term)
         or (status = 'released' and private.gradebook_staff(tenant_id, course_code, term))
         or (student_id = (select auth.uid()) and status = 'released'));

drop policy if exists "staff and the student read a regrade request" on public.regrade_requests;
create policy "staff and the student read a regrade request" on public.regrade_requests
  for select to authenticated
  using (private.gradebook_staff(tenant_id, course_code, term) or student_id = (select auth.uid()));

drop policy if exists "whoever reads the request reads its answer" on public.regrade_resolutions;
create policy "whoever reads the request reads its answer" on public.regrade_resolutions
  for select to authenticated
  using (exists (select 1 from public.regrade_requests r where r.id = request_id));

drop policy if exists "staff read the passback queue" on public.grade_passbacks;
create policy "staff read the passback queue" on public.grade_passbacks
  for select to authenticated
  using (private.gradebook_staff(tenant_id, course_code, term));

-- ── Helpers the writers share ─────────────────────────────────────────────

-- The caller's school, or an error when there is no caller or no school.
create or replace function private.gradebook_school()
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
    raise exception 'semester: your account has no school' using errcode = 'insufficient_privilege';
  end if;
  return school;
end $$;

-- Raises unless the caller holds `want_cap` over this course in this term,
-- or — when `school_ok` — over the whole school.
create or replace function private.gradebook_require(school text, code text, want_term text, want_cap text, school_ok boolean)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_capability(want_cap, 'course', private.gradebook_scope(school, code, want_term))
          or (school_ok and private.has_capability(want_cap, 'school', school))) then
    raise exception 'semester: that needs % on this course in %', want_cap, coalesce(want_term, 'this term')
      using errcode = 'insufficient_privilege';
  end if;
end $$;

-- The key check every mutation starts with. Null means go ahead; otherwise
-- it is the first answer to replay. Holds a lock on the key until commit, so
-- two calls with one key cannot both do the work.
create or replace function private.gradebook_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.gradebook_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('gradebook-op:' || school || ':' || want_key));
  select * into op from public.gradebook_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;

create or replace function private.gradebook_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.gradebook_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;

-- Why a score cannot stand on this item, or null when it can.
create or replace function private.gradebook_score_problem(points numeric, want_score numeric, want_mark text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when want_mark is not null and want_mark not in ('late', 'excused', 'incomplete', 'missing') then 'that is not a mark'
    when want_score is null and coalesce(want_mark, '') not in ('excused', 'incomplete', 'missing')
      then 'a score is needed unless the item is excused, incomplete or missing'
    when want_score is not null and (want_score < 0 or want_score > points * 2) then 'the score is out of range for this item'
    when want_score is not null and want_mark in ('excused', 'missing') then 'an excused or missing item carries no score'
  end;
$$;

-- The highest version of one grade, locked against a concurrent writer.
create or replace function private.gradebook_current(want_item uuid, want_student uuid)
returns public.grade_entries
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e public.grade_entries;
begin
  perform pg_advisory_xact_lock(hashtext('grade:' || want_item::text || ':' || want_student::text));
  select * into e from public.grade_entries g
   where g.item_id = want_item and g.student_id = want_student
   order by g.version desc limit 1;
  return e;
end $$;

revoke all on function private.gradebook_school() from public, anon, authenticated;
revoke all on function private.gradebook_require(text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function private.gradebook_replay(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.gradebook_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.gradebook_score_problem(numeric, numeric, text) from public, anon, authenticated;
revoke all on function private.gradebook_current(uuid, uuid) from public, anon, authenticated;

-- ── The scheme ────────────────────────────────────────────────────────────

create or replace function public.gradebook_set_scheme(
  want_course text, want_term text, want_categories jsonb, want_letters jsonb,
  want_moderation boolean, want_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  code   text := private.course_code(want_course);
  req    jsonb := jsonb_build_object('course', code, 'term', want_term, 'categories', want_categories,
                                     'letters', want_letters, 'moderation', coalesce(want_moderation, false));
  prior  jsonb;
  c      jsonb;
  l      jsonb;
  seen_keys   text[] := '{}';
  total  numeric := 0;
  floor_min   numeric := null;
  ver    integer;
begin
  if code = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then
    raise exception 'semester: that is not a term' using errcode = 'check_violation';
  end if;
  perform private.gradebook_require(school, code, want_term, 'grades:release', false);
  prior := private.gradebook_replay(school, want_key, 'scheme', req);
  if prior is not null then return (prior->>'version')::integer; end if;

  if want_categories is null or jsonb_typeof(want_categories) <> 'array' or jsonb_array_length(want_categories) = 0 then
    raise exception 'semester: a scheme needs at least one category' using errcode = 'check_violation';
  end if;
  for c in select * from jsonb_array_elements(want_categories) loop
    if jsonb_typeof(c) <> 'object'
       or (c - array['key', 'name', 'weight', 'drop_lowest']::text[]) <> '{}'::jsonb
       or coalesce(c->>'key', '') !~ '^[a-z][a-z0-9-]{0,30}$'
       or jsonb_typeof(c->'name') is distinct from 'string'
       or length(btrim(c->>'name')) not between 1 and 80
       or jsonb_typeof(c->'weight') is distinct from 'number'
       or (c->>'weight')::numeric <= 0
       or (c->>'weight')::numeric <> round((c->>'weight')::numeric, 3)
       or (c ? 'drop_lowest' and (jsonb_typeof(c->'drop_lowest') <> 'number'
                                   or (c->>'drop_lowest')::numeric < 0
                                   or (c->>'drop_lowest')::numeric <> trunc((c->>'drop_lowest')::numeric))) then
      raise exception 'semester: each category needs a key, a name, a weight above zero and a whole number to drop'
        using errcode = 'check_violation';
    end if;
    if (c->>'key') = any(seen_keys) then
      raise exception 'semester: the category key % is used twice', c->>'key' using errcode = 'check_violation';
    end if;
    seen_keys := seen_keys || (c->>'key');
    total := total + (c->>'weight')::numeric;
  end loop;
  if total <> 100 then
    raise exception 'semester: the weights sum to %, not 100', total using errcode = 'check_violation';
  end if;

  if want_letters is null or jsonb_typeof(want_letters) <> 'array' or jsonb_array_length(want_letters) = 0 then
    raise exception 'semester: a scheme needs a letter scale' using errcode = 'check_violation';
  end if;
  for l in select * from jsonb_array_elements(want_letters) loop
    if jsonb_typeof(l) <> 'object'
       or (l - array['letter', 'min']::text[]) <> '{}'::jsonb
       or coalesce(l->>'letter', '') !~ '^[A-Z][A-Z+-]{0,2}$'
       or jsonb_typeof(l->'min') is distinct from 'number'
       or (l->>'min')::numeric not between 0 and 100
       or (floor_min is not null and (l->>'min')::numeric >= floor_min) then
      raise exception 'semester: the letter scale is letters with minimums, strictly descending'
        using errcode = 'check_violation';
    end if;
    floor_min := (l->>'min')::numeric;
  end loop;
  if floor_min <> 0 then
    raise exception 'semester: the last letter must start at 0' using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(hashtext('gradebook-scheme:' || school || '/' || code || '/' || want_term));
  if exists (select 1 from public.gradebook_items i
              where i.tenant_id = school and i.course_code = code and i.term = want_term
                and not (i.category_key = any(seen_keys))) then
    raise exception 'semester: an item is still in a category this scheme leaves out' using errcode = 'check_violation';
  end if;
  select coalesce(max(s.version), 0) + 1 into ver from public.gradebook_schemes s
   where s.tenant_id = school and s.course_code = code and s.term = want_term;
  insert into public.gradebook_schemes (tenant_id, course_code, term, version, categories, letters, moderation_required, set_by, operation)
  values (school, code, want_term, ver, want_categories, want_letters, coalesce(want_moderation, false), me, want_key);
  perform private.gradebook_spend(school, want_key, 'scheme', req, jsonb_build_object('version', ver));
  return ver;
end $$;

-- ── Items ─────────────────────────────────────────────────────────────────

create or replace function public.gradebook_add_item(
  want_course text, want_term text, want_category text, want_title text,
  want_points numeric, want_line_item text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  code   text := private.course_code(want_course);
  req    jsonb := jsonb_build_object('course', code, 'term', want_term, 'category', want_category,
                                     'title', want_title, 'points', want_points, 'line_item', want_line_item);
  prior  jsonb;
  scheme public.gradebook_schemes;
  made   uuid;
begin
  if code = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then
    raise exception 'semester: that is not a term' using errcode = 'check_violation';
  end if;
  perform private.gradebook_require(school, code, want_term, 'grades:release', false);
  prior := private.gradebook_replay(school, want_key, 'item', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  select * into scheme from public.gradebook_schemes s
   where s.tenant_id = school and s.course_code = code and s.term = want_term
   order by s.version desc limit 1;
  if not found then
    raise exception 'semester: set the grading scheme before adding items' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from jsonb_array_elements(scheme.categories) c where c->>'key' = want_category) then
    raise exception 'semester: the scheme has no category %', want_category using errcode = 'check_violation';
  end if;
  insert into public.gradebook_items (tenant_id, course_code, term, category_key, title, points_possible, line_item, created_by, operation)
  values (school, code, want_term, want_category, btrim(coalesce(want_title, '')), want_points,
          nullif(btrim(coalesce(want_line_item, '')), ''), me, want_key)
  returning id into made;
  perform private.gradebook_spend(school, want_key, 'item', req, jsonb_build_object('id', made));
  return made;
end $$;

-- ── Entering a score ──────────────────────────────────────────────────────

create or replace function public.gradebook_enter(
  want_item uuid, want_student uuid, want_score numeric, want_mark text,
  want_comment text, want_reason text, want_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  school   text := private.gradebook_school();
  it       public.gradebook_items;
  req      jsonb := jsonb_build_object('item', want_item, 'student', want_student, 'score', want_score, 'mark', want_mark,
                                       'comment', coalesce(want_comment, ''), 'reason', coalesce(want_reason, ''));
  prior    jsonb;
  cur      public.grade_entries;
  released boolean;
  problem  text;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, it.course_code, it.term, 'grades:enter', false);
  prior := private.gradebook_replay(school, want_key, 'enter', req);
  if prior is not null then return (prior->>'version')::integer; end if;

  if not private.subject_has_capability(want_student, 'grades:receive', 'course', private.gradebook_scope(school, it.course_code, it.term)) then
    raise exception 'semester: that student is not enrolled in this course' using errcode = 'check_violation';
  end if;
  if want_student = me then
    raise exception 'semester: nobody enters their own grade' using errcode = 'insufficient_privilege';
  end if;
  problem := private.gradebook_score_problem(it.points_possible, want_score, want_mark);
  if problem is not null then raise exception 'semester: %', problem using errcode = 'check_violation'; end if;
  if length(coalesce(want_comment, '')) > 4000 or length(btrim(coalesce(want_reason, ''))) > 2000 then
    raise exception 'semester: the comment or reason is too long' using errcode = 'check_violation';
  end if;

  cur := private.gradebook_current(it.id, want_student);
  released := exists (select 1 from public.grade_entries g
                       where g.item_id = it.id and g.student_id = want_student and g.status = 'released');
  if released and btrim(coalesce(want_reason, '')) = '' then
    raise exception 'semester: this grade has been released; a change needs a reason' using errcode = 'check_violation';
  end if;
  if cur.id is not null and cur.score is not distinct from want_score and cur.mark is not distinct from want_mark
     and cur.comment = coalesce(want_comment, '') then
    raise exception 'semester: that is already the grade' using errcode = 'check_violation';
  end if;

  insert into public.grade_entries
    (tenant_id, course_code, term, item_id, student_id, version, score, mark, comment,
     status, action, graded_by, actor, reason, operation)
  values (school, it.course_code, it.term, it.id, want_student, coalesce(cur.version, 0) + 1, want_score, want_mark,
          coalesce(want_comment, ''), 'draft', case when released then 'changed' else 'entered' end,
          me, me, btrim(coalesce(want_reason, '')), want_key);
  perform private.gradebook_spend(school, want_key, 'enter', req, jsonb_build_object('version', coalesce(cur.version, 0) + 1));
  return coalesce(cur.version, 0) + 1;
end $$;

-- ── Moderation ────────────────────────────────────────────────────────────

create or replace function public.gradebook_moderate(want_item uuid, want_student uuid, want_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  it     public.gradebook_items;
  req    jsonb := jsonb_build_object('item', want_item, 'student', want_student);
  prior  jsonb;
  cur    public.grade_entries;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, it.course_code, it.term, 'grades:moderate', false);
  prior := private.gradebook_replay(school, want_key, 'moderate', req);
  if prior is not null then return (prior->>'version')::integer; end if;

  cur := private.gradebook_current(it.id, want_student);
  if cur.id is null or cur.status <> 'draft' then
    raise exception 'semester: there is no draft grade here to moderate' using errcode = 'check_violation';
  end if;
  if cur.graded_by is not distinct from me then
    raise exception 'semester: the grader cannot moderate their own grade' using errcode = 'insufficient_privilege';
  end if;
  insert into public.grade_entries
    (tenant_id, course_code, term, item_id, student_id, version, score, mark, comment,
     status, action, graded_by, actor, reason, regrade_id, operation)
  values (cur.tenant_id, cur.course_code, cur.term, cur.item_id, cur.student_id, cur.version + 1, cur.score, cur.mark,
          cur.comment, 'moderated', 'moderated', cur.graded_by, me, '', cur.regrade_id, want_key);
  perform private.gradebook_spend(school, want_key, 'moderate', req, jsonb_build_object('version', cur.version + 1));
  return cur.version + 1;
end $$;

-- ── Release ───────────────────────────────────────────────────────────────
-- Every current draft or moderated grade on the item, except drafts the
-- scheme says must be moderated first. Answers {released, held}.

create or replace function public.gradebook_release(want_item uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  school   text := private.gradebook_school();
  it       public.gradebook_items;
  req      jsonb := jsonb_build_object('item', want_item);
  prior    jsonb;
  must     boolean;
  s        uuid;
  cur      public.grade_entries;
  released integer := 0;
  held     integer := 0;
  answer   jsonb;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, it.course_code, it.term, 'grades:release', false);
  prior := private.gradebook_replay(school, want_key, 'release', req);
  if prior is not null then return prior; end if;

  select coalesce((select sc.moderation_required from public.gradebook_schemes sc
                    where sc.tenant_id = school and sc.course_code = it.course_code and sc.term = it.term
                    order by sc.version desc limit 1), false) into must;
  for s in select distinct g.student_id from public.grade_entries g where g.item_id = it.id order by 1 loop
    cur := private.gradebook_current(it.id, s);
    continue when cur.status = 'released';
    if must and cur.status <> 'moderated' then
      held := held + 1;
      continue;
    end if;
    insert into public.grade_entries
      (tenant_id, course_code, term, item_id, student_id, version, score, mark, comment,
       status, action, graded_by, actor, reason, regrade_id, operation)
    values (cur.tenant_id, cur.course_code, cur.term, cur.item_id, cur.student_id, cur.version + 1, cur.score, cur.mark,
            cur.comment, 'released', 'released', cur.graded_by, me, '', cur.regrade_id, want_key);
    released := released + 1;
  end loop;
  if released = 0 then
    raise exception 'semester: nothing to release (% waiting for moderation)', held using errcode = 'check_violation';
  end if;
  answer := jsonb_build_object('released', released, 'held', held);
  perform private.gradebook_spend(school, want_key, 'release', req, answer);
  return answer;
end $$;

-- ── Regrade requests ──────────────────────────────────────────────────────

create or replace function public.gradebook_file_regrade(want_item uuid, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  it     public.gradebook_items;
  req    jsonb := jsonb_build_object('item', want_item, 'reason', want_reason);
  prior  jsonb;
  shown  public.grade_entries;
  made   uuid;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  prior := private.gradebook_replay(school, want_key, 'regrade', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  perform pg_advisory_xact_lock(hashtext('grade:' || it.id::text || ':' || me::text));
  select * into shown from public.grade_entries g
   where g.item_id = it.id and g.student_id = me and g.status = 'released'
   order by g.version desc limit 1;
  if not found then
    raise exception 'semester: a regrade is asked of a released grade, and there is none here' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_reason, ''))) not between 1 and 2000 then
    raise exception 'semester: say what should be looked at again, in at most 2,000 characters' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.regrade_requests r
              where r.item_id = it.id and r.student_id = me
                and not exists (select 1 from public.regrade_resolutions x where x.request_id = r.id)) then
    raise exception 'semester: there is already an open request on this item' using errcode = 'check_violation';
  end if;
  insert into public.regrade_requests (tenant_id, course_code, term, item_id, student_id, contested_entry, reason, operation)
  values (school, it.course_code, it.term, it.id, me, shown.id, btrim(want_reason), want_key)
  returning id into made;
  perform private.gradebook_spend(school, want_key, 'regrade', req, jsonb_build_object('id', made));
  return made;
end $$;

-- 'upheld' leaves the grade; 'changed' adds a draft version answering the
-- request, released like any other. Answers the new version's id, or null.
create or replace function public.gradebook_resolve_regrade(
  want_request uuid, want_outcome text, want_score numeric, want_mark text, want_note text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me      uuid := (select auth.uid());
  school  text := private.gradebook_school();
  r       public.regrade_requests;
  it      public.gradebook_items;
  req     jsonb := jsonb_build_object('request', want_request, 'outcome', want_outcome, 'score', want_score,
                                      'mark', want_mark, 'note', want_note);
  prior   jsonb;
  cur     public.grade_entries;
  problem text;
  made    uuid := null;
begin
  select * into r from public.regrade_requests x where x.id = want_request and x.tenant_id = school;
  if not found then raise exception 'semester: no such regrade request here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, r.course_code, r.term, 'grades:enter', false);
  prior := private.gradebook_replay(school, want_key, 'resolve', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if r.student_id = me then
    raise exception 'semester: nobody resolves a request about their own grade' using errcode = 'insufficient_privilege';
  end if;
  if want_outcome is null or want_outcome not in ('upheld', 'changed') then
    raise exception 'semester: a request is upheld or changed' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_note, ''))) not between 1 and 2000 then
    raise exception 'semester: a resolution says why, and the student reads it' using errcode = 'check_violation';
  end if;
  cur := private.gradebook_current(r.item_id, r.student_id);
  if exists (select 1 from public.regrade_resolutions x where x.request_id = r.id) then
    raise exception 'semester: that request has been resolved' using errcode = 'check_violation';
  end if;
  if want_outcome = 'changed' then
    select * into it from public.gradebook_items i where i.id = r.item_id;
    problem := private.gradebook_score_problem(it.points_possible, want_score, want_mark);
    if problem is not null then raise exception 'semester: %', problem using errcode = 'check_violation'; end if;
    insert into public.grade_entries
      (tenant_id, course_code, term, item_id, student_id, version, score, mark, comment,
       status, action, graded_by, actor, reason, regrade_id, operation)
    values (cur.tenant_id, cur.course_code, cur.term, cur.item_id, cur.student_id, cur.version + 1, want_score, want_mark,
            cur.comment, 'draft', 'regraded', me, me, btrim(want_note), r.id, want_key)
    returning id into made;
  end if;
  insert into public.regrade_resolutions (request_id, tenant_id, outcome, note, entry_id, resolved_by, operation)
  values (r.id, school, want_outcome, btrim(want_note), made, me, want_key);
  perform private.gradebook_spend(school, want_key, 'resolve', req, jsonb_build_object('id', made));
  return made;
end $$;

-- ── The registrar's reading ───────────────────────────────────────────────
-- Each student's latest released version of each item, and nothing else: the
-- export can hold only what every student in it has been shown.

create or replace function public.gradebook_export(want_course text, want_term text)
returns table (student_id uuid, item_id uuid, category_key text, title text, points_possible numeric,
               score numeric, mark text, released_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  code   text := private.course_code(want_course);
begin
  perform private.gradebook_require(school, code, want_term, 'grades:export', true);
  return query
    select distinct on (g.student_id, g.item_id)
           g.student_id, g.item_id, i.category_key, i.title, i.points_possible, g.score, g.mark, g.created_at
      from public.grade_entries g
      join public.gradebook_items i on i.id = g.item_id
     where g.tenant_id = school and g.course_code = code and g.term = want_term and g.status = 'released'
     order by g.student_id, g.item_id, g.version desc;
end $$;

-- ── Passback ──────────────────────────────────────────────────────────────
-- Queues each student's latest released, scored version of the item that has
-- not been queued before. Answers {queued, reason}; a closed gate queues
-- nothing, spends no key, and says which gate.

create or replace function public.gradebook_queue_passback(want_item uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  it     public.gradebook_items;
  req    jsonb := jsonb_build_object('item', want_item);
  prior  jsonb;
  n      integer;
  answer jsonb;
begin
  select * into it from public.gradebook_items i where i.id = want_item and i.tenant_id = school;
  if not found then raise exception 'semester: no such item here' using errcode = 'check_violation'; end if;
  perform private.gradebook_require(school, it.course_code, it.term, 'grades:release', false);
  prior := private.gradebook_replay(school, want_key, 'passback', req);
  if prior is not null then return prior; end if;

  if public.kill_switch_engaged('kill.writeback', school) or public.kill_switch_engaged('kill.integration_sync', school) then
    return jsonb_build_object('queued', 0, 'reason', 'kill-switch');
  end if;
  if public.feature_state('integration.lms_lti', school) <> 'production' then
    return jsonb_build_object('queued', 0, 'reason', 'module-off');
  end if;
  if public.feature_state('writeback.lms_grade_passback', school) <> 'production' then
    return jsonb_build_object('queued', 0, 'reason', 'flag-off');
  end if;
  -- The school's role and cohort limits on passback (a pilot of named
  -- instructors): `private.feature_admits_caller`, defined in 20260929370000
  -- and resolved when this runs. Left out reads as the flag being off.
  if not private.feature_admits_caller('writeback.lms_grade_passback', school) then
    return jsonb_build_object('queued', 0, 'reason', 'flag-off');
  end if;
  if it.line_item is null then
    return jsonb_build_object('queued', 0, 'reason', 'no-line-item');
  end if;

  insert into public.grade_passbacks
    (tenant_id, course_code, term, entry_id, item_id, student_id, line_item, score, points, queued_by, operation)
  select school, it.course_code, it.term, g.id, it.id, g.student_id, it.line_item, g.score, it.points_possible, me, want_key
    from (select distinct on (e.student_id) e.*
            from public.grade_entries e
           where e.item_id = it.id and e.status = 'released'
           order by e.student_id, e.version desc) g
   where g.score is not null
  on conflict (entry_id) do nothing;
  get diagnostics n = row_count;
  answer := jsonb_build_object('queued', n, 'reason', 'queued');
  perform private.gradebook_spend(school, want_key, 'passback', req, answer);
  return answer;
end $$;

-- The sender's report: 'sent', 'failed' (retryable) or 'abandoned'. A version
-- already sent stays sent. Five failures abandon it. Service role only.
create or replace function public.gradebook_record_passback(want_passback uuid, want_outcome text, want_detail text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  p    public.grade_passbacks;
  now_ text;
begin
  select * into p from public.grade_passbacks x where x.id = want_passback for update;
  if not found then return 'no-such-passback'; end if;
  if p.status = 'sent' then return 'already-sent'; end if;
  if want_outcome is null or want_outcome not in ('sent', 'failed', 'abandoned') then return 'bad-outcome'; end if;
  now_ := case when want_outcome = 'failed' and p.attempts + 1 >= 5 then 'abandoned' else want_outcome end;
  update public.grade_passbacks
     set status = now_,
         attempts = p.attempts + 1,
         detail = left(coalesce(want_detail, ''), 500),
         updated_at = now()
   where id = p.id;
  -- The status it now has: a fifth failure answers 'abandoned', not 'failed'.
  return now_;
end $$;

revoke all on function public.gradebook_set_scheme(text, text, jsonb, jsonb, boolean, text) from public, anon, authenticated;
revoke all on function public.gradebook_add_item(text, text, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.gradebook_enter(uuid, uuid, numeric, text, text, text, text) from public, anon, authenticated;
revoke all on function public.gradebook_moderate(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.gradebook_release(uuid, text) from public, anon, authenticated;
revoke all on function public.gradebook_file_regrade(uuid, text, text) from public, anon, authenticated;
revoke all on function public.gradebook_resolve_regrade(uuid, text, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.gradebook_export(text, text) from public, anon, authenticated;
revoke all on function public.gradebook_queue_passback(uuid, text) from public, anon, authenticated;
revoke all on function public.gradebook_record_passback(uuid, text, text) from public, anon, authenticated;
grant execute on function public.gradebook_set_scheme(text, text, jsonb, jsonb, boolean, text) to authenticated;
grant execute on function public.gradebook_add_item(text, text, text, text, numeric, text, text) to authenticated;
grant execute on function public.gradebook_enter(uuid, uuid, numeric, text, text, text, text) to authenticated;
grant execute on function public.gradebook_moderate(uuid, uuid, text) to authenticated;
grant execute on function public.gradebook_release(uuid, text) to authenticated;
grant execute on function public.gradebook_file_regrade(uuid, text, text) to authenticated;
grant execute on function public.gradebook_resolve_regrade(uuid, text, numeric, text, text, text) to authenticated;
grant execute on function public.gradebook_export(text, text) to authenticated;
grant execute on function public.gradebook_queue_passback(uuid, text) to authenticated;
grant execute on function public.gradebook_record_passback(uuid, text, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   begin;
--   drop function if exists public.gradebook_record_passback(uuid, text, text);
--   drop function if exists public.gradebook_queue_passback(uuid, text);
--   drop function if exists public.gradebook_export(text, text);
--   drop function if exists public.gradebook_resolve_regrade(uuid, text, numeric, text, text, text);
--   drop function if exists public.gradebook_file_regrade(uuid, text, text);
--   drop function if exists public.gradebook_release(uuid, text);
--   drop function if exists public.gradebook_moderate(uuid, uuid, text);
--   drop function if exists public.gradebook_enter(uuid, uuid, numeric, text, text, text, text);
--   drop function if exists public.gradebook_add_item(text, text, text, text, numeric, text, text);
--   drop function if exists public.gradebook_set_scheme(text, text, jsonb, jsonb, boolean, text);
--   drop table if exists public.grade_passbacks, public.regrade_resolutions, public.regrade_requests,
--     public.grade_entries, public.gradebook_items, public.gradebook_schemes, public.gradebook_operations cascade;
--   drop function if exists private.gradebook_current(uuid, uuid);
--   drop function if exists private.gradebook_score_problem(numeric, numeric, text);
--   drop function if exists private.gradebook_spend(text, text, text, jsonb, jsonb);
--   drop function if exists private.gradebook_replay(text, text, text, jsonb);
--   drop function if exists private.gradebook_require(text, text, text, text, boolean);
--   drop function if exists private.gradebook_school();
--   drop function if exists private.gradebook_author(text, text, text);
--   drop function if exists private.gradebook_staff(text, text, text);
--   drop function if exists private.gradebook_scope(text, text, text);
--   delete from public.role_capabilities where capability like 'grades:%';
--   delete from public.app_capabilities where capability like 'grades:%';
--   commit;
