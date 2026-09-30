-- Semester — assignments and submissions: the LMS's first Core module.
--
-- D-151 says Semester runs beside a school's systems (Connect) and takes a
-- module over only when the school switches that module to Core. This is the
-- module `lms_assignments`: an instructor publishes an assignment, a student
-- submits work, and the student is handed a receipt that proves what was
-- submitted and when. Nothing here replaces `lib/draft.ts` (a student's own
-- autosaved draft on their own device) or the student's own planner; a draft
-- leaves the device only when the student submits it.
--
-- What it decides, and where:
--
--   * **Scope.** A course is `<school>/<CODE>` plus a term, exactly as the
--     gradebook keys one, and every grant here is held on scope id
--     `<school>/<CODE>/<TERM>`. A grant with no term authorises nothing:
--     teaching a course this term is not a reason to read last year's section.
--   * **Who.** Two new capabilities, checked with `private.has_capability` at
--     course-and-term scope: `assignments:author` (faculty: create, revise a
--     draft, publish, close, grant an extension) and `assignments:review`
--     (faculty and teaching assistants: read every submission and receipt).
--     The roster is the gradebook's: a student is somebody holding
--     `grades:receive` on this course in this term, and only a student can
--     submit. Grants are written by the institution; nothing here grants one.
--   * **Core only.** Every mutation is refused unless the school has switched
--     `lms_assignments` to Core (`effective_module_modes`), and refused while
--     the module is frozen or `kill.core_modules` is engaged. Reading is not
--     gated by mode: a frozen module's data stays readable.
--   * **Append-only.** No client may insert, update or delete any table here.
--     An assignment moves draft → published → closed and every move is a row in
--     `assignment_events` with who, when and what changed. A submission is a
--     container and every version of it is a new row in `submission_versions`;
--     nothing is overwritten, so what a student submitted first is still there
--     after what they submitted last.
--   * **A receipt** is written in the same transaction as the version it
--     names: a code, the SHA-256 of the submitted text, the time the database
--     took it, the due time that applied to that student then, and whether it
--     was late. The student can read it back; nobody can issue one any other
--     way.
--   * **No double submissions.** Every mutation takes an idempotency key. The
--     same key and request from the same caller answers as the first call did
--     and writes nothing; the same key for anything else is refused. A version
--     identical to the student's latest is refused, and so is a version past
--     the assignment's cap, or a second version where resubmission is off.
--   * **Late is the school's call, not a code path.** A late submission is
--     accepted and marked late, until the assignment's `closes_at` (when one is
--     set). An extension moves one student's due time, and their closing time
--     when it would otherwise fall before it; it is a row with a reason, and
--     the latest row for that student is the one in force.
--
-- **Text only.** A version holds text. Attached files need somewhere to live,
-- and where they live (and whether they upload over a phone plan) is an open
-- owner decision; this file does not pretend otherwise.
--
-- Account deletion: a student's submissions, versions, receipts and extensions
-- cascade from `auth.users`, and the people who wrote the assignments and
-- granted the extensions are set null, as `erasure.test.ts` requires of every
-- column naming an account. The school's own system keeps its copy.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

-- ── The capabilities ─────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('assignments:author', 'Create, revise, publish and close assignments, and grant extensions, for one course.'),
  ('assignments:review', 'Read every student''s submissions and receipts for one course.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('faculty',            'assignments:author'),
  ('faculty',            'assignments:review'),
  ('teaching_assistant', 'assignments:review')
on conflict do nothing;

-- ── Tables ─────────────────────────────────────────────────

-- The keys every mutation spends. `request` is what was asked, `result` what
-- was answered; a replay compares the first and returns the second.
create table if not exists public.assignment_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('create', 'revise', 'publish', 'close', 'extend', 'submit')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

-- The one table a function updates: an assignment's status and the times it
-- changed. Every change is also an event below, so the row is never the only
-- account of what happened.
create table if not exists public.assignments (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          text        not null references public.schools(id) on delete cascade,
  course_code        text        not null check (length(course_code) between 1 and 40),
  term               text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  title              text        not null check (length(btrim(title)) between 1 and 200),
  instructions       text        not null default '' check (length(instructions) <= 20000),
  due_at             timestamptz not null,
  closes_at          timestamptz check (closes_at is null or closes_at >= due_at),
  allow_resubmission boolean     not null default true,
  max_versions       integer     not null default 5 check (max_versions between 1 and 20),
  status             text        not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by         uuid        references auth.users on delete set null,
  operation          text        not null,
  created_at         timestamptz not null default now(),
  published_at       timestamptz,
  closed_at          timestamptz
);

-- What happened to an assignment, who did it and what it was before.
create table if not exists public.assignment_events (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  action        text        not null check (action in ('created', 'revised', 'published', 'closed', 'extended')),
  actor         uuid        references auth.users on delete set null,
  detail        jsonb       not null default '{}'::jsonb,
  operation     text        not null,
  at            timestamptz not null default now()
);

-- One student's own due time, with the reason. The newest row for a student
-- is in force; an earlier one is history, not a second deadline.
create table if not exists public.assignment_extensions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  student_id    uuid        not null references auth.users on delete cascade,
  due_at        timestamptz not null,
  closes_at     timestamptz check (closes_at is null or closes_at >= due_at),
  reason        text        not null check (length(btrim(reason)) between 1 and 500),
  granted_by    uuid        references auth.users on delete set null,
  operation     text        not null,
  at            timestamptz not null default now()
);

-- A student's work on one assignment. The container; the work is its versions.
create table if not exists public.submissions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  student_id    uuid        not null references auth.users on delete cascade,
  created_at    timestamptz not null default now(),
  unique (assignment_id, student_id)
);

-- Every version a student submitted. Nothing here is ever changed.
create table if not exists public.submission_versions (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  submission_id  uuid        not null references public.submissions(id) on delete cascade,
  assignment_id  uuid        not null references public.assignments(id) on delete cascade,
  student_id     uuid        not null references auth.users on delete cascade,
  version        integer     not null check (version >= 1),
  body           text        not null check (length(btrim(body)) between 1 and 50000),
  content_sha256 text        not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  due_at_then    timestamptz not null,
  late           boolean     not null,
  submitted_at   timestamptz not null default now(),
  operation      text        not null,
  unique (submission_id, version)
);

-- The receipt for one version: what the student keeps.
create table if not exists public.submission_receipts (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  version_id     uuid        not null unique references public.submission_versions(id) on delete cascade,
  assignment_id  uuid        not null references public.assignments(id) on delete cascade,
  student_id     uuid        not null references auth.users on delete cascade,
  receipt_code   text        not null unique check (receipt_code ~ '^SR-[0-9A-F]{12}$'),
  content_sha256 text        not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  submitted_at   timestamptz not null,
  due_at_then    timestamptz not null,
  late           boolean     not null
);

-- Every foreign key covered (`indexes.check.sql`), each index by its lead column.
create index if not exists assignment_operations_by_actor on public.assignment_operations (actor);
create index if not exists assignments_by_course on public.assignments (tenant_id, course_code, term);
create index if not exists assignments_by_creator on public.assignments (created_by);
create index if not exists assignment_events_by_assignment on public.assignment_events (assignment_id);
create index if not exists assignment_events_by_tenant on public.assignment_events (tenant_id);
create index if not exists assignment_events_by_actor on public.assignment_events (actor);
create index if not exists assignment_extensions_by_assignment on public.assignment_extensions (assignment_id, student_id);
create index if not exists assignment_extensions_by_tenant on public.assignment_extensions (tenant_id);
create index if not exists assignment_extensions_by_student on public.assignment_extensions (student_id);
create index if not exists assignment_extensions_by_grantor on public.assignment_extensions (granted_by);
create index if not exists submissions_by_tenant on public.submissions (tenant_id);
create index if not exists submissions_by_student on public.submissions (student_id);
create index if not exists submission_versions_by_tenant on public.submission_versions (tenant_id);
create index if not exists submission_versions_by_assignment on public.submission_versions (assignment_id);
create index if not exists submission_versions_by_student on public.submission_versions (student_id);
create index if not exists submission_receipts_by_tenant on public.submission_receipts (tenant_id);
create index if not exists submission_receipts_by_assignment on public.submission_receipts (assignment_id);
create index if not exists submission_receipts_by_student on public.submission_receipts (student_id);

comment on table public.assignment_operations is 'Idempotency keys the assignment mutations spent, with what each asked and answered. Append-only.';
comment on table public.assignments is 'An instructor''s assignment for a course and term. Moves draft, published, closed through functions only; every move is an assignment_events row.';
comment on table public.assignment_events is 'What happened to an assignment, who did it and what it was before. Append-only.';
comment on table public.assignment_extensions is 'One student''s own due time, with the reason. The newest row for a student is in force. Append-only.';
comment on table public.submissions is 'A student''s work on one assignment; the versions are the work. Append-only.';
comment on table public.submission_versions is 'Every version a student submitted, with the time the database took it and whether it was late. Append-only.';
comment on table public.submission_receipts is 'The receipt for one submitted version: a code, the SHA-256 of the text, the time and the due time then. Append-only.';

-- ── Who reads ──────────────────────────────────────────────

-- The scope id a course's assignment grants are held on: `<school>/<CODE>/<TERM>`.
-- Null when any part is null, and `has_capability` answers false for null, so
-- a missing term authorises nothing rather than falling back to the course.
create or replace function private.assignments_scope(want_tenant text, want_code text, want_term text)
returns text
language sql
immutable
set search_path = ''
as $$
  select want_tenant || '/' || want_code || '/' || want_term;
$$;

revoke all on function private.assignments_scope(text, text, text) from public, anon, authenticated;
grant execute on function private.assignments_scope(text, text, text) to authenticated;

-- Course staff: anybody holding an assignment capability over this course in
-- this term, at their own school.
create or replace function private.assignments_staff(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and (private.has_capability('assignments:author', 'course', private.assignments_scope(want_tenant, want_code, want_term))
       or private.has_capability('assignments:review', 'course', private.assignments_scope(want_tenant, want_code, want_term)));
$$;

revoke all on function private.assignments_staff(text, text, text) from public, anon, authenticated;
grant execute on function private.assignments_staff(text, text, text) to authenticated;

-- The roster: a student of this course in this term, at their own school. It
-- is the gradebook's roster (`grades:receive`), on purpose: there is one list
-- of who is in a course, and this does not keep a second.
create or replace function private.assignments_roster(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability('grades:receive', 'course', private.assignments_scope(want_tenant, want_code, want_term));
$$;

revoke all on function private.assignments_roster(text, text, text) from public, anon, authenticated;
grant execute on function private.assignments_roster(text, text, text) to authenticated;

alter table public.assignment_operations enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_events enable row level security;
alter table public.assignment_extensions enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_versions enable row level security;
alter table public.submission_receipts enable row level security;

revoke all on table public.assignment_operations from anon, authenticated;
revoke all on table public.assignments from anon, authenticated;
revoke all on table public.assignment_events from anon, authenticated;
revoke all on table public.assignment_extensions from anon, authenticated;
revoke all on table public.submissions from anon, authenticated;
revoke all on table public.submission_versions from anon, authenticated;
revoke all on table public.submission_receipts from anon, authenticated;
grant select on table public.assignment_operations to authenticated;
grant select on table public.assignments to authenticated;
grant select on table public.assignment_events to authenticated;
grant select on table public.assignment_extensions to authenticated;
grant select on table public.submissions to authenticated;
grant select on table public.submission_versions to authenticated;
grant select on table public.submission_receipts to authenticated;

drop policy if exists "callers read their own operations" on public.assignment_operations;
create policy "callers read their own operations" on public.assignment_operations
  for select to authenticated
  using (actor = (select auth.uid()));

-- Staff read every assignment of the course; a student reads the published and
-- closed ones. A draft is the instructor's until it is published.
drop policy if exists "staff read all, the roster reads what is published" on public.assignments;
create policy "staff read all, the roster reads what is published" on public.assignments
  for select to authenticated
  using (private.assignments_staff(tenant_id, course_code, term)
         or (status in ('published', 'closed') and private.assignments_roster(tenant_id, course_code, term)));

drop policy if exists "staff read the events" on public.assignment_events;
create policy "staff read the events" on public.assignment_events
  for select to authenticated
  using (exists (select 1 from public.assignments a
                  where a.id = assignment_id
                    and private.assignments_staff(a.tenant_id, a.course_code, a.term)));

drop policy if exists "staff read extensions, a student their own" on public.assignment_extensions;
create policy "staff read extensions, a student their own" on public.assignment_extensions
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assignments a
                     where a.id = assignment_id
                       and private.assignments_staff(a.tenant_id, a.course_code, a.term)));

drop policy if exists "staff read submissions, a student their own" on public.submissions;
create policy "staff read submissions, a student their own" on public.submissions
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assignments a
                     where a.id = assignment_id
                       and private.assignments_staff(a.tenant_id, a.course_code, a.term)));

drop policy if exists "staff read versions, a student their own" on public.submission_versions;
create policy "staff read versions, a student their own" on public.submission_versions
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assignments a
                     where a.id = assignment_id
                       and private.assignments_staff(a.tenant_id, a.course_code, a.term)));

drop policy if exists "staff read receipts, a student their own" on public.submission_receipts;
create policy "staff read receipts, a student their own" on public.submission_receipts
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assignments a
                     where a.id = assignment_id
                       and private.assignments_staff(a.tenant_id, a.course_code, a.term)));

-- ── The rules every mutation starts with ──────────────────────

create or replace function private.assignments_school()
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

-- Raises unless the caller holds `want_cap` over this course in this term.
create or replace function private.assignments_require(school text, code text, want_term text, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'course', private.assignments_scope(school, code, want_term)) then
    raise exception 'semester: that needs % on this course in %', want_cap, coalesce(want_term, 'this term')
      using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Raises unless this school has switched assignments to Semester Core, and
-- the module is neither frozen nor paused by the kill switch. A school in
-- Connect never reaches a write here: its assignments are in its own system.
create or replace function private.assignments_require_core(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m record;
begin
  select e.mode, e.frozen, e.killed into m
    from public.effective_module_modes(school) e
   where e.module = 'lms_assignments';
  -- While the kill switch is engaged every module reads Connect, so a school
  -- that really is in Core has to be recognised from its own row to be told
  -- the truth: paused, not "never switched".
  if found and m.killed and exists (select 1 from public.tenant_module_mode t
                                     where t.tenant_id = school and t.module = 'lms_assignments' and t.mode = 'core') then
    raise exception 'semester: Core modules are paused for your school' using errcode = 'insufficient_privilege';
  end if;
  if not found or m.mode <> 'core' then
    raise exception 'semester: your school has not switched assignments to Semester Core' using errcode = 'insufficient_privilege';
  end if;
  if m.frozen then
    raise exception 'semester: assignments are frozen; the work is kept and read-only' using errcode = 'insufficient_privilege';
  end if;
end $$;

-- The key check every mutation starts with. Null means go ahead; otherwise it
-- is the first answer to replay. Holds a lock on the key until commit, so two
-- calls with one key cannot both do the work.
create or replace function private.assignments_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.assignment_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('assignment-op:' || school || ':' || want_key));
  select * into op from public.assignment_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;

create or replace function private.assignments_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.assignment_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;

-- The due and closing time that apply to one student on one assignment: their
-- own newest extension if they have one, otherwise the assignment's. An
-- extension that leaves `closes_at` empty keeps the assignment's, unless that
-- would fall before the extended due time, when the student's closing time is
-- their due time: an extension never leaves a student unable to submit by it.
create or replace function private.assignments_window(want_assignment uuid, want_student uuid)
returns table (due_at timestamptz, closes_at timestamptz, extended boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(e.due_at, a.due_at),
         case
           when e.id is null then a.closes_at
           when e.closes_at is not null then e.closes_at
           when a.closes_at is null then null
           else greatest(a.closes_at, e.due_at)
         end,
         e.id is not null
    from public.assignments a
    left join lateral (
      select x.* from public.assignment_extensions x
       where x.assignment_id = a.id and x.student_id = want_student
       order by x.at desc, x.id desc limit 1
    ) e on true
   where a.id = want_assignment
$$;

-- Only this file's own definer functions call it; no client role needs to.
revoke all on function private.assignments_window(uuid, uuid) from public, anon, authenticated;

-- ── Writing an assignment ──────────────────────────────────────

create or replace function public.assignments_create(
  want_course text, want_term text, want_title text, want_instructions text,
  want_due timestamptz, want_closes timestamptz, want_resubmit boolean, want_max_versions integer,
  want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.assignments_school();
  code   text := private.course_code(want_course);
  req    jsonb := jsonb_build_object('course', code, 'term', want_term, 'title', btrim(coalesce(want_title, '')),
                                     'instructions', coalesce(want_instructions, ''), 'due', want_due, 'closes', want_closes,
                                     'resubmit', coalesce(want_resubmit, true), 'max', coalesce(want_max_versions, 5));
  prior  jsonb;
  made   uuid;
begin
  if code = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then
    raise exception 'semester: that is not a term' using errcode = 'check_violation';
  end if;
  perform private.assignments_require(school, code, want_term, 'assignments:author');
  perform private.assignments_require_core(school);
  prior := private.assignments_replay(school, want_key, 'create', req);
  if prior is not null then return (prior->>'id')::uuid; end if;

  if want_due is null then raise exception 'semester: an assignment needs a due time' using errcode = 'check_violation'; end if;
  if want_closes is not null and want_closes < want_due then
    raise exception 'semester: it cannot close before it is due' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_title, ''))) not between 1 and 200 then
    raise exception 'semester: a title is 1 to 200 characters' using errcode = 'check_violation';
  end if;
  if length(coalesce(want_instructions, '')) > 20000 then
    raise exception 'semester: the instructions are too long' using errcode = 'check_violation';
  end if;
  if coalesce(want_max_versions, 5) not between 1 and 20 then
    raise exception 'semester: a student may submit between 1 and 20 versions' using errcode = 'check_violation';
  end if;

  insert into public.assignments
    (tenant_id, course_code, term, title, instructions, due_at, closes_at, allow_resubmission, max_versions, created_by, operation)
  values (school, code, want_term, btrim(want_title), coalesce(want_instructions, ''), want_due, want_closes,
          coalesce(want_resubmit, true), case when coalesce(want_resubmit, true) then coalesce(want_max_versions, 5) else 1 end,
          me, want_key)
  returning id into made;
  insert into public.assignment_events (tenant_id, assignment_id, action, actor, detail, operation)
  values (school, made, 'created', me, req, want_key);
  perform private.assignments_spend(school, want_key, 'create', req, jsonb_build_object('id', made));
  return made;
end $$;

-- A draft can be revised; a published assignment cannot, because a student may
-- already have read it. What changes after publication is a close or an
-- extension, each its own event.
create or replace function public.assignments_revise(
  want_assignment uuid, want_title text, want_instructions text,
  want_due timestamptz, want_closes timestamptz, want_resubmit boolean, want_max_versions integer,
  want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.assignments_school();
  a      public.assignments;
  req    jsonb := jsonb_build_object('assignment', want_assignment, 'title', btrim(coalesce(want_title, '')),
                                     'instructions', coalesce(want_instructions, ''), 'due', want_due, 'closes', want_closes,
                                     'resubmit', coalesce(want_resubmit, true), 'max', coalesce(want_max_versions, 5));
  prior  jsonb;
begin
  select * into a from public.assignments x where x.id = want_assignment and x.tenant_id = school;
  if not found then raise exception 'semester: no such assignment here' using errcode = 'check_violation'; end if;
  perform private.assignments_require(school, a.course_code, a.term, 'assignments:author');
  perform private.assignments_require_core(school);
  prior := private.assignments_replay(school, want_key, 'revise', req);
  if prior is not null then return; end if;

  if a.status <> 'draft' then
    raise exception 'semester: only a draft can be revised; this one is %', a.status using errcode = 'check_violation';
  end if;
  if want_due is null then raise exception 'semester: an assignment needs a due time' using errcode = 'check_violation'; end if;
  if want_closes is not null and want_closes < want_due then
    raise exception 'semester: it cannot close before it is due' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_title, ''))) not between 1 and 200 then
    raise exception 'semester: a title is 1 to 200 characters' using errcode = 'check_violation';
  end if;
  if length(coalesce(want_instructions, '')) > 20000 then
    raise exception 'semester: the instructions are too long' using errcode = 'check_violation';
  end if;
  if coalesce(want_max_versions, 5) not between 1 and 20 then
    raise exception 'semester: a student may submit between 1 and 20 versions' using errcode = 'check_violation';
  end if;

  insert into public.assignment_events (tenant_id, assignment_id, action, actor, detail, operation)
  values (school, a.id, 'revised', me,
          jsonb_build_object('before', jsonb_build_object('title', a.title, 'instructions', a.instructions, 'due', a.due_at,
                                                          'closes', a.closes_at, 'resubmit', a.allow_resubmission, 'max', a.max_versions),
                             'after', req - 'assignment'),
          want_key);
  update public.assignments x
     set title = btrim(want_title), instructions = coalesce(want_instructions, ''), due_at = want_due, closes_at = want_closes,
         allow_resubmission = coalesce(want_resubmit, true),
         max_versions = case when coalesce(want_resubmit, true) then coalesce(want_max_versions, 5) else 1 end
   where x.id = a.id;
  perform private.assignments_spend(school, want_key, 'revise', req, '{}'::jsonb);
end $$;

create or replace function public.assignments_publish(want_assignment uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.assignments_school();
  a      public.assignments;
  req    jsonb := jsonb_build_object('assignment', want_assignment);
  prior  jsonb;
begin
  select * into a from public.assignments x where x.id = want_assignment and x.tenant_id = school;
  if not found then raise exception 'semester: no such assignment here' using errcode = 'check_violation'; end if;
  perform private.assignments_require(school, a.course_code, a.term, 'assignments:author');
  perform private.assignments_require_core(school);
  prior := private.assignments_replay(school, want_key, 'publish', req);
  if prior is not null then return; end if;

  if a.status <> 'draft' then
    raise exception 'semester: only a draft can be published; this one is %', a.status using errcode = 'check_violation';
  end if;
  if a.due_at <= now() then
    raise exception 'semester: the due time has passed; revise it before publishing' using errcode = 'check_violation';
  end if;
  update public.assignments x set status = 'published', published_at = now() where x.id = a.id;
  insert into public.assignment_events (tenant_id, assignment_id, action, actor, detail, operation)
  values (school, a.id, 'published', me, jsonb_build_object('due', a.due_at, 'closes', a.closes_at), want_key);
  perform private.assignments_spend(school, want_key, 'publish', req, '{}'::jsonb);
end $$;

create or replace function public.assignments_close(want_assignment uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.assignments_school();
  a      public.assignments;
  req    jsonb := jsonb_build_object('assignment', want_assignment);
  prior  jsonb;
begin
  select * into a from public.assignments x where x.id = want_assignment and x.tenant_id = school;
  if not found then raise exception 'semester: no such assignment here' using errcode = 'check_violation'; end if;
  perform private.assignments_require(school, a.course_code, a.term, 'assignments:author');
  perform private.assignments_require_core(school);
  prior := private.assignments_replay(school, want_key, 'close', req);
  if prior is not null then return; end if;

  if a.status <> 'published' then
    raise exception 'semester: only a published assignment can be closed; this one is %', a.status using errcode = 'check_violation';
  end if;
  update public.assignments x set status = 'closed', closed_at = now() where x.id = a.id;
  insert into public.assignment_events (tenant_id, assignment_id, action, actor, detail, operation)
  values (school, a.id, 'closed', me, '{}'::jsonb, want_key);
  perform private.assignments_spend(school, want_key, 'close', req, '{}'::jsonb);
end $$;

-- An extension moves one student's due time later, with a reason. It cannot
-- move it earlier than what already applies to them, and it does not reopen a
-- closed assignment: closing is the instructor's last word.
create or replace function public.assignments_extend(
  want_assignment uuid, want_student uuid, want_due timestamptz, want_closes timestamptz,
  want_reason text, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.assignments_school();
  a      public.assignments;
  w      record;
  req    jsonb := jsonb_build_object('assignment', want_assignment, 'student', want_student, 'due', want_due,
                                     'closes', want_closes, 'reason', btrim(coalesce(want_reason, '')));
  prior  jsonb;
begin
  select * into a from public.assignments x where x.id = want_assignment and x.tenant_id = school;
  if not found then raise exception 'semester: no such assignment here' using errcode = 'check_violation'; end if;
  perform private.assignments_require(school, a.course_code, a.term, 'assignments:author');
  perform private.assignments_require_core(school);
  prior := private.assignments_replay(school, want_key, 'extend', req);
  if prior is not null then return; end if;

  if a.status <> 'published' then
    raise exception 'semester: an extension is for a published assignment; this one is %', a.status using errcode = 'check_violation';
  end if;
  if not private.subject_has_capability(want_student, 'grades:receive', 'course', private.assignments_scope(school, a.course_code, a.term)) then
    raise exception 'semester: that student is not enrolled in this course' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_reason, ''))) not between 1 and 500 then
    raise exception 'semester: an extension needs a reason of up to 500 characters' using errcode = 'check_violation';
  end if;
  select * into w from private.assignments_window(a.id, want_student);
  if want_due is null or want_due <= w.due_at then
    raise exception 'semester: an extension must be later than the time that already applies to this student' using errcode = 'check_violation';
  end if;
  if want_closes is not null and want_closes < want_due then
    raise exception 'semester: it cannot close before it is due' using errcode = 'check_violation';
  end if;

  insert into public.assignment_extensions (tenant_id, assignment_id, student_id, due_at, closes_at, reason, granted_by, operation)
  values (school, a.id, want_student, want_due, want_closes, btrim(want_reason), me, want_key);
  insert into public.assignment_events (tenant_id, assignment_id, action, actor, detail, operation)
  values (school, a.id, 'extended', me,
          jsonb_build_object('student', want_student, 'was', w.due_at, 'now', want_due, 'reason', btrim(want_reason)), want_key);
  perform private.assignments_spend(school, want_key, 'extend', req, '{}'::jsonb);
end $$;

-- ── Submitting ─────────────────────────────────────────────────

-- A student submits a version. The answer is the version number, the receipt
-- code, the time the database took it and whether it was late; a replay of the
-- same key answers the same and writes nothing.
create or replace function public.submissions_submit(want_assignment uuid, want_body text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  school   text := private.assignments_school();
  a        public.assignments;
  w        record;
  sub      uuid;
  latest   public.submission_versions;
  n        integer;
  body     text := coalesce(want_body, '');
  sha      text := encode(sha256(convert_to(coalesce(want_body, ''), 'UTF8')), 'hex');
  req      jsonb := jsonb_build_object('assignment', want_assignment, 'sha256', sha);
  prior    jsonb;
  made     uuid;
  code     text;
  stamp    timestamptz := clock_timestamp();
  is_late  boolean;
  answer   jsonb;
begin
  select * into a from public.assignments x where x.id = want_assignment and x.tenant_id = school;
  if not found or a.status = 'draft' then raise exception 'semester: no such assignment here' using errcode = 'check_violation'; end if;
  if not private.has_capability('grades:receive', 'course', private.assignments_scope(school, a.course_code, a.term)) then
    raise exception 'semester: only a student of this course can submit to it' using errcode = 'insufficient_privilege';
  end if;
  perform private.assignments_require_core(school);
  prior := private.assignments_replay(school, want_key, 'submit', req);
  if prior is not null then return prior; end if;

  if a.status = 'closed' then
    raise exception 'semester: this assignment is closed' using errcode = 'check_violation';
  end if;
  if length(btrim(body)) not between 1 and 50000 then
    raise exception 'semester: a submission is 1 to 50000 characters' using errcode = 'check_violation';
  end if;
  select * into w from private.assignments_window(a.id, me);
  if w.closes_at is not null and stamp > w.closes_at then
    raise exception 'semester: this assignment stopped accepting work at its closing time' using errcode = 'check_violation';
  end if;

  select s.id into sub from public.submissions s where s.assignment_id = a.id and s.student_id = me;
  if sub is null then
    insert into public.submissions (tenant_id, assignment_id, student_id) values (school, a.id, me)
    returning id into sub;
  end if;
  select * into latest from public.submission_versions v where v.submission_id = sub order by v.version desc limit 1;
  n := coalesce(latest.version, 0) + 1;
  if latest.id is not null and not a.allow_resubmission then
    raise exception 'semester: this assignment takes one submission, and you have made it' using errcode = 'check_violation';
  end if;
  if n > a.max_versions then
    raise exception 'semester: this assignment takes at most % submissions', a.max_versions using errcode = 'check_violation';
  end if;
  if latest.id is not null and latest.content_sha256 = sha then
    raise exception 'semester: that is what you already submitted' using errcode = 'check_violation';
  end if;

  is_late := stamp > w.due_at;
  insert into public.submission_versions
    (tenant_id, submission_id, assignment_id, student_id, version, body, content_sha256, due_at_then, late, submitted_at, operation)
  values (school, sub, a.id, me, n, body, sha, w.due_at, is_late, stamp, want_key)
  returning id into made;
  code := 'SR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.submission_receipts
    (tenant_id, version_id, assignment_id, student_id, receipt_code, content_sha256, submitted_at, due_at_then, late)
  values (school, made, a.id, me, code, sha, stamp, w.due_at, is_late);

  answer := jsonb_build_object('version', n, 'receipt', code, 'submitted_at', stamp, 'late', is_late);
  perform private.assignments_spend(school, want_key, 'submit', req, answer);
  return answer;
end $$;

revoke all on function public.assignments_create(text, text, text, text, timestamptz, timestamptz, boolean, integer, text) from public, anon;
revoke all on function public.assignments_revise(uuid, text, text, timestamptz, timestamptz, boolean, integer, text) from public, anon;
revoke all on function public.assignments_publish(uuid, text) from public, anon;
revoke all on function public.assignments_close(uuid, text) from public, anon;
revoke all on function public.assignments_extend(uuid, uuid, timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.submissions_submit(uuid, text, text) from public, anon;
grant execute on function public.assignments_create(text, text, text, text, timestamptz, timestamptz, boolean, integer, text) to authenticated;
grant execute on function public.assignments_revise(uuid, text, text, timestamptz, timestamptz, boolean, integer, text) to authenticated;
grant execute on function public.assignments_publish(uuid, text) to authenticated;
grant execute on function public.assignments_close(uuid, text) to authenticated;
grant execute on function public.assignments_extend(uuid, uuid, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.submissions_submit(uuid, text, text) to authenticated;

revoke all on function private.assignments_school() from public, anon, authenticated;
revoke all on function private.assignments_require(text, text, text, text) from public, anon, authenticated;
revoke all on function private.assignments_require_core(text) from public, anon, authenticated;
revoke all on function private.assignments_replay(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.assignments_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

-- ── An account that has submitted work is not untouched ─────────────────
--
-- `lti_account_untouched` decides whether a provisioned account holds nothing
-- a person did, so it can be retired safely. A version a student submitted, the
-- receipt written with it and an extension granted to them are all something
-- the person did or was given, so they are read here; otherwise a student who
-- had submitted to Core assignments could be retired as "never opened".
-- Everything else in the list is the definition of 20260929360000, unchanged.
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
      -- 20260929360000: what a person did in three school domains.
      ('public.registration_enrollments', 'student'),
      ('public.regrade_requests',     'student_id'),
      ('public.dining_orders',        'student'),
      -- 20260930240000: work a student submitted, and the extensions they were given.
      ('public.submission_versions',  'student_id'),
      ('public.submission_receipts',  'student_id'),
      ('public.assignment_extensions','student_id')
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
