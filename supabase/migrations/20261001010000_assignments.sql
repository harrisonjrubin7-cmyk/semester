-- Semester — assignments and submissions: the instructor's half and the
-- student's half of handing work in, when a school has switched the
-- `lms_assignments` module to Core (D-151).
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- `app/src/screens/Work.tsx` is a student's own list of what is due. Nothing
-- here reads or changes it. This is what an institution keeps: an assignment
-- an instructor publishes, a student's attempts at it with the server's clock
-- on each, a receipt the student can keep, and an extension granted to one
-- student with its reason.
--
-- ## What the database decides
--
--   * **Only in Core.** Every writer here refuses unless the school's
--     `lms_assignments` module is `core`, not frozen, and `kill.core_modules`
--     is disengaged for the school. In Connect the school's own LMS is the
--     record, and a row here would be a second one.
--   * **Who.** A course is `<school>/<CODE>` plus a term, and a grant is held
--     on `<school>/<CODE>/<TERM>` exactly as the gradebook's are
--     (`private.gradebook_scope`); a grant with no term authorises nothing.
--     `assignments:author` (faculty) writes and publishes, `assignments:extend`
--     (faculty, teaching assistants) grants an extension, `assignments:review`
--     reads every submission, and `assignments:submit`, held by the student
--     roles, is the roster: only a person holding it for this course and term
--     can hand work in, or be given an extension.
--   * **The clock is the server's.** `submitted_at` is `clock_timestamp()` read
--     inside the writer, never an argument. "Late" is that instant against the
--     due date the student is held to: an extension, if there is one, else the
--     assignment's.
--   * **Late rules.** An assignment either refuses late work (`refuse`) or
--     accepts it (`accept`), flagged late, until an optional cut-off
--     (`late_until`). Past the cut-off nothing is accepted.
--   * **Attempts.** `attempts_allowed` counts a student's submissions. One
--     advisory lock per assignment and student serialises their attempts, so
--     two tabs cannot both take the last one.
--   * **Idempotent.** Every writer takes a key. The same caller, key and
--     request answers as the first call did and writes nothing, so a double
--     click or a retry after a dropped reply is one submission; the same key
--     for anything else is refused.
--   * **Append-only.** No client inserts, updates or deletes any table here.
--     Submissions, their files, receipts and extensions are never rewritten:
--     a later attempt or a later extension is a new row, and the latest
--     extension is the one in force.
--   * **A receipt.** Each submission gets one: its server time, its attempt,
--     whether it was late, and a SHA-256 over those and the work's own hash
--     (the body's and each file's), so a student can later show what was
--     handed in and when. It is a receipt of receipt, not of grade.
--   * **Files** go to the private `assignment-submissions` bucket under
--     `<school>/<assignment>/<student>/<name>`; the path is the rule (a
--     student writes only under their own id, for a published assignment of
--     their own school's course they are on the roster of). A submission may
--     name a file only if that object is there. Size and type are bounded
--     here and by the bucket. Virus scanning is not in this file.
--
-- Not here, on purpose: group submissions and group extensions (an
-- extension is per student), rubrics and grades (the gradebook's), and the
-- instructor's grading view.
--
-- Account deletion: a student's rows cascade from `auth.users`; the people
-- who authored or extended are set null, as `erasure.test.ts` requires of
-- every column naming an account. The school's own export is its copy.

-- ── The school's timezone ───────────────────────────────────────────────
--
-- The completeness matrix asked for this when Core began to serve term dates.
-- A due date is an instant; the school's timezone is how it is shown.

alter table public.schools add column if not exists timezone text not null default 'UTC';

create or replace function private.guard_school_timezone()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.timezone) then
    raise exception 'semester: % is not a timezone', new.timezone using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke all on function private.guard_school_timezone() from public, anon, authenticated;

drop trigger if exists schools_timezone_known on public.schools;
create trigger schools_timezone_known
before insert or update of timezone on public.schools
for each row execute function private.guard_school_timezone();

-- ── The capabilities ────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('assignments:author',  'Create, edit, publish and close assignments for one course and term.'),
  ('assignments:extend',  'Grant one student an extension on an assignment, with a reason, for one course and term.'),
  ('assignments:review',  'Read every submission and receipt for one course and term.'),
  ('assignments:submit',  'Hand work in for one course and term: the assignments roster.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('faculty',               'assignments:author'),
  ('faculty',               'assignments:extend'),
  ('faculty',               'assignments:review'),
  ('teaching_assistant',    'assignments:extend'),
  ('teaching_assistant',    'assignments:review'),
  ('student',               'assignments:submit'),
  ('undergraduate_student', 'assignments:submit'),
  ('graduate_student',      'assignments:submit'),
  ('transfer_student',      'assignments:submit')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.assignment_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('create', 'edit', 'publish', 'close', 'extend', 'submit')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.assignments (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        text          not null references public.schools(id) on delete cascade,
  course_code      text          not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term             text          not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  title            text          not null check (length(btrim(title)) between 1 and 200),
  instructions     text          not null default '' check (length(instructions) <= 20000),
  points_possible  numeric(9, 3) check (points_possible is null or points_possible >= 0),
  due_at           timestamptz   not null,
  late_policy      text          not null default 'refuse' check (late_policy in ('refuse', 'accept')),
  late_until       timestamptz,
  attempts_allowed integer       not null default 1 check (attempts_allowed between 1 and 20),
  status           text          not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_by       uuid          references auth.users on delete set null,
  operation        text          not null,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  published_at     timestamptz,
  constraint assignments_cutoff_after_due check (late_until is null or late_until >= due_at),
  constraint assignments_cutoff_needs_late check (late_until is null or late_policy = 'accept')
);

create table if not exists public.assignment_overrides (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  student_id    uuid        not null references auth.users on delete cascade,
  due_at        timestamptz not null,
  late_until    timestamptz,
  reason        text        not null check (length(btrim(reason)) between 1 and 500),
  granted_by    uuid        references auth.users on delete set null,
  operation     text        not null,
  created_at    timestamptz not null default clock_timestamp(),
  constraint assignment_overrides_cutoff_after_due check (late_until is null or late_until >= due_at)
);

create table if not exists public.submissions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  student_id    uuid        not null references auth.users on delete cascade,
  attempt       integer     not null check (attempt >= 1),
  body          text        not null default '' check (length(body) <= 50000),
  submitted_at  timestamptz not null,
  due_at_used   timestamptz not null,
  late          boolean     not null,
  operation     text        not null,
  unique (assignment_id, student_id, attempt)
);

create table if not exists public.submission_files (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  submission_id uuid        not null references public.submissions on delete cascade,
  path          text        not null unique check (length(path) between 20 and 400),
  name          text        not null check (length(btrim(name)) between 1 and 200),
  size_bytes    bigint      not null check (size_bytes between 1 and 26214400),
  content_type  text        not null check (content_type in (
                  'application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  sha256        text        not null check (sha256 ~ '^[0-9a-f]{64}$')
);

create table if not exists public.submission_receipts (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null references public.schools(id) on delete cascade,
  submission_id uuid        not null unique references public.submissions(id) on delete cascade,
  assignment_id uuid        not null references public.assignments(id) on delete cascade,
  student_id    uuid        not null references auth.users on delete cascade,
  issued_at     timestamptz not null,
  receipt_hash  text        not null check (receipt_hash ~ '^[0-9a-f]{64}$'),
  statement     jsonb       not null
);

-- Every foreign key covered (`indexes.check.sql`), each index by its lead column.
create index if not exists assignment_operations_by_actor on public.assignment_operations (actor);
create index if not exists assignments_by_course on public.assignments (tenant_id, course_code, term);
create index if not exists assignments_by_creator on public.assignments (created_by);
create index if not exists assignment_overrides_by_assignment on public.assignment_overrides (assignment_id, student_id, created_at desc);
create index if not exists assignment_overrides_by_tenant on public.assignment_overrides (tenant_id);
create index if not exists assignment_overrides_by_student on public.assignment_overrides (student_id);
create index if not exists assignment_overrides_by_granter on public.assignment_overrides (granted_by);
create index if not exists submissions_by_tenant on public.submissions (tenant_id);
create index if not exists submissions_by_student on public.submissions (student_id);
create index if not exists submission_files_by_tenant on public.submission_files (tenant_id);
create index if not exists submission_files_by_submission on public.submission_files (submission_id);
create index if not exists submission_receipts_by_tenant on public.submission_receipts (tenant_id);
create index if not exists submission_receipts_by_assignment on public.submission_receipts (assignment_id);
create index if not exists submission_receipts_by_student on public.submission_receipts (student_id);

comment on table public.assignment_operations is 'Idempotency keys the assignment writers spent, with what each asked and answered. Append-only.';
comment on table public.assignments is 'An assignment of one course and term. Written only by its definer functions, and only while the school runs lms_assignments in Core.';
comment on table public.assignment_overrides is 'An extension granted to one student on one assignment, with its reason. Append-only; the latest is in force.';
comment on table public.submissions is 'One row per attempt, submitted_at from the server clock. Append-only.';
comment on table public.submission_files is 'A file named by a submission, stored under the assignment-submissions bucket. Append-only.';
comment on table public.submission_receipts is 'The receipt a student keeps for one submission: server time, attempt, lateness and a SHA-256 over them and the work. Append-only.';

-- ── The guards that refuse to rewrite what was handed in ─────────────────

create or replace function private.refuse_assignment_record_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'semester: submissions, receipts, files and extensions are never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.refuse_assignment_record_change() from public, anon, authenticated;

drop trigger if exists submissions_never_rewritten on public.submissions;
create trigger submissions_never_rewritten before update on public.submissions
for each row execute function private.refuse_assignment_record_change();
drop trigger if exists submission_files_never_rewritten on public.submission_files;
create trigger submission_files_never_rewritten before update on public.submission_files
for each row execute function private.refuse_assignment_record_change();
drop trigger if exists submission_receipts_never_rewritten on public.submission_receipts;
create trigger submission_receipts_never_rewritten before update on public.submission_receipts
for each row execute function private.refuse_assignment_record_change();
-- An extension is never rewritten; only the granter's name may be cleared when
-- that person's account is deleted (`on delete set null`).
create or replace function private.guard_assignment_override()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'granted_by') is distinct from (to_jsonb(old) - 'granted_by')
     or (new.granted_by is distinct from old.granted_by and new.granted_by is not null) then
    raise exception 'semester: submissions, receipts, files and extensions are never rewritten' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_assignment_override() from public, anon, authenticated;

drop trigger if exists assignment_overrides_never_rewritten on public.assignment_overrides;
create trigger assignment_overrides_never_rewritten before update on public.assignment_overrides
for each row execute function private.guard_assignment_override();

-- ── Who reads ───────────────────────────────────────────────────────────

-- Whether the school runs assignments in Core right now.
create or replace function private.assignments_core(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.tenant_module_mode m
                  where m.tenant_id = want_tenant and m.module = 'lms_assignments'
                    and m.mode = 'core' and not m.frozen)
     and not public.kill_switch_engaged('kill.core_modules', want_tenant);
$$;
-- Called only by the writers below and the two Storage helpers, never by a policy
-- or a view, so no client role needs to execute it (`grants.check.sql`).
revoke all on function private.assignments_core(text) from public, anon, authenticated;

-- Anybody holding an assignments capability over this course in this term.
create or replace function private.assignments_staff(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and (private.has_capability('assignments:author', 'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('assignments:review', 'course', private.gradebook_scope(want_tenant, want_code, want_term))
       or private.has_capability('assignments:extend', 'course', private.gradebook_scope(want_tenant, want_code, want_term)));
$$;
revoke all on function private.assignments_staff(text, text, text) from public, anon, authenticated;
grant execute on function private.assignments_staff(text, text, text) to authenticated;

create or replace function private.assignments_roster(want_tenant text, want_code text, want_term text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability('assignments:submit', 'course', private.gradebook_scope(want_tenant, want_code, want_term));
$$;
revoke all on function private.assignments_roster(text, text, text) from public, anon, authenticated;
grant execute on function private.assignments_roster(text, text, text) to authenticated;

alter table public.assignment_operations enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_overrides enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_files enable row level security;
alter table public.submission_receipts enable row level security;

revoke all on table public.assignment_operations from public, anon, authenticated;
revoke all on table public.assignments from public, anon, authenticated;
revoke all on table public.assignment_overrides from public, anon, authenticated;
revoke all on table public.submissions from public, anon, authenticated;
revoke all on table public.submission_files from public, anon, authenticated;
revoke all on table public.submission_receipts from public, anon, authenticated;
grant select on table public.assignment_operations to authenticated;
grant select on table public.assignments to authenticated;
grant select on table public.assignment_overrides to authenticated;
grant select on table public.submissions to authenticated;
grant select on table public.submission_files to authenticated;
grant select on table public.submission_receipts to authenticated;

drop policy if exists "callers read their own assignment operations" on public.assignment_operations;
create policy "callers read their own assignment operations" on public.assignment_operations
  for select to authenticated
  using (actor = (select auth.uid()));

-- Staff read drafts; the roster reads only what is published or closed.
drop policy if exists "staff read assignments, the roster the published ones" on public.assignments;
create policy "staff read assignments, the roster the published ones" on public.assignments
  for select to authenticated
  using (private.assignments_staff(tenant_id, course_code, term)
         or (status in ('published', 'closed') and private.assignments_roster(tenant_id, course_code, term)));

drop policy if exists "staff and the student read an extension" on public.assignment_overrides;
create policy "staff and the student read an extension" on public.assignment_overrides
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assignments a
                     where a.id = assignment_id and private.assignments_staff(a.tenant_id, a.course_code, a.term)));

drop policy if exists "reviewers and the student read a submission" on public.submissions;
create policy "reviewers and the student read a submission" on public.submissions
  for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.assignments a
                     where a.id = assignment_id
                       and (private.has_capability('assignments:review', 'course', private.gradebook_scope(a.tenant_id, a.course_code, a.term))
                         or private.has_capability('assignments:author', 'course', private.gradebook_scope(a.tenant_id, a.course_code, a.term)))));

drop policy if exists "whoever reads the submission reads its files" on public.submission_files;
create policy "whoever reads the submission reads its files" on public.submission_files
  for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));

drop policy if exists "the student and reviewers read a receipt" on public.submission_receipts;
create policy "the student and reviewers read a receipt" on public.submission_receipts
  for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id));

-- ── Files ───────────────────────────────────────────────────────────────

-- A path is `<school>/<assignment id>/<student id>/<name>`. These two answer
-- the Storage policies, and nothing else.
create or replace function private.assignment_upload_allowed(want_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a  public.assignments;
begin
  if me is null or want_path !~ '^[A-Za-z0-9_-]+/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then return false; end if;
  if split_part(want_path, '/', 3) <> me::text then return false; end if;
  select * into a from public.assignments x
   where x.id = split_part(want_path, '/', 2)::uuid and x.tenant_id = split_part(want_path, '/', 1);
  if a.id is null or a.status <> 'published' then return false; end if;
  return private.assignments_core(a.tenant_id) and private.assignments_roster(a.tenant_id, a.course_code, a.term);
end $$;
revoke all on function private.assignment_upload_allowed(text) from public, anon;
grant execute on function private.assignment_upload_allowed(text) to authenticated;

create or replace function private.assignment_read_allowed(want_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a  public.assignments;
begin
  if me is null or want_path !~ '^[A-Za-z0-9_-]+/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then return false; end if;
  if split_part(want_path, '/', 3) = me::text then return true; end if;
  select * into a from public.assignments x
   where x.id = split_part(want_path, '/', 2)::uuid and x.tenant_id = split_part(want_path, '/', 1);
  if a.id is null then return false; end if;
  return private.has_capability('assignments:review', 'course', private.gradebook_scope(a.tenant_id, a.course_code, a.term))
      or private.has_capability('assignments:author', 'course', private.gradebook_scope(a.tenant_id, a.course_code, a.term));
end $$;
revoke all on function private.assignment_read_allowed(text) from public, anon;
grant execute on function private.assignment_read_allowed(text) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('assignment-submissions', 'assignment-submissions', false, 26214400, array[
      'application/pdf', 'image/png', 'image/jpeg', 'text/plain', 'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
    on conflict (id) do nothing;
    drop policy if exists "assignment submissions: upload under your own id" on storage.objects;
    create policy "assignment submissions: upload under your own id" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'assignment-submissions' and private.assignment_upload_allowed(name));
    drop policy if exists "assignment submissions: read your own, or as a reviewer" on storage.objects;
    create policy "assignment submissions: read your own, or as a reviewer" on storage.objects
      for select to authenticated
      using (bucket_id = 'assignment-submissions' and private.assignment_read_allowed(name));
    -- No update or delete policy: a file cannot be swapped after it is handed in.
  end if;
end $$;

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.assignment_require(school text, a public.assignments, want_cap text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_capability(want_cap, 'course', private.gradebook_scope(school, a.course_code, a.term)) then
    raise exception 'semester: that needs % on this course in %', want_cap, a.term
      using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.assignment_require(text, public.assignments, text) from public, anon, authenticated;

create or replace function private.assignment_replay(school text, want_key text, want_kind text, want_request jsonb)
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
revoke all on function private.assignment_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.assignment_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.assignment_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.assignment_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.assignment_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.assignments_core(school) then
    raise exception 'semester: this school does not run assignments in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.assignment_core_required(text) from public, anon, authenticated;

-- ── The instructor's writers ────────────────────────────────────────────

create or replace function public.assignment_create(
  want_course text, want_term text, want_title text, want_instructions text, want_points numeric,
  want_due timestamptz, want_late_policy text, want_late_until timestamptz, want_attempts integer,
  want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  code   text := private.course_code(want_course);
  req    jsonb := jsonb_build_object('course', code, 'term', want_term, 'title', want_title,
                    'instructions', want_instructions, 'points', want_points, 'due', want_due,
                    'late_policy', want_late_policy, 'late_until', want_late_until, 'attempts', want_attempts);
  prior  jsonb;
  made   uuid;
begin
  if code = '' then raise exception 'semester: that is not a course code' using errcode = 'check_violation'; end if;
  if want_term is null or want_term !~ '^[0-9]{4}(FA|SP|SU)$' then
    raise exception 'semester: that is not a term' using errcode = 'check_violation';
  end if;
  if not private.has_capability('assignments:author', 'course', private.gradebook_scope(school, code, want_term)) then
    raise exception 'semester: that needs assignments:author on this course in %', want_term using errcode = 'insufficient_privilege';
  end if;
  prior := private.assignment_replay(school, want_key, 'create', req);
  if prior is not null then return (prior->>'id')::uuid; end if;
  perform private.assignment_core_required(school);

  insert into public.assignments (tenant_id, course_code, term, title, instructions, points_possible, due_at,
                                  late_policy, late_until, attempts_allowed, created_by, operation)
  values (school, code, want_term, btrim(coalesce(want_title, '')), coalesce(want_instructions, ''), want_points,
          want_due, coalesce(want_late_policy, 'refuse'), want_late_until, coalesce(want_attempts, 1), me, want_key)
  returning id into made;
  perform private.assignment_spend(school, want_key, 'create', req, jsonb_build_object('id', made));
  return made;
end $$;

-- Edits what an instructor may still change. Points and attempts are fixed at
-- creation: students have planned against them.
create or replace function public.assignment_edit(
  want_id uuid, want_title text, want_instructions text, want_due timestamptz,
  want_late_policy text, want_late_until timestamptz, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  a      public.assignments;
  req    jsonb := jsonb_build_object('id', want_id, 'title', want_title, 'instructions', want_instructions,
                    'due', want_due, 'late_policy', want_late_policy, 'late_until', want_late_until);
begin
  select * into a from public.assignments x where x.id = want_id and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such assignment' using errcode = 'no_data_found'; end if;
  perform private.assignment_require(school, a, 'assignments:author');
  if private.assignment_replay(school, want_key, 'edit', req) is not null then return; end if;
  perform private.assignment_core_required(school);
  if a.status = 'closed' then raise exception 'semester: a closed assignment is not edited' using errcode = 'check_violation'; end if;

  update public.assignments set
    title = btrim(coalesce(want_title, a.title)),
    instructions = coalesce(want_instructions, a.instructions),
    due_at = coalesce(want_due, a.due_at),
    late_policy = coalesce(want_late_policy, a.late_policy),
    late_until = case when want_late_policy = 'refuse' then null else coalesce(want_late_until, a.late_until) end,
    updated_at = clock_timestamp()
  where id = want_id;
  perform private.assignment_spend(school, want_key, 'edit', req, jsonb_build_object('id', want_id));
end $$;

create or replace function public.assignment_publish(want_id uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  a      public.assignments;
  req    jsonb := jsonb_build_object('id', want_id);
begin
  select * into a from public.assignments x where x.id = want_id and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such assignment' using errcode = 'no_data_found'; end if;
  perform private.assignment_require(school, a, 'assignments:author');
  if private.assignment_replay(school, want_key, 'publish', req) is not null then return; end if;
  perform private.assignment_core_required(school);
  if a.status <> 'draft' then raise exception 'semester: only a draft is published' using errcode = 'check_violation'; end if;
  update public.assignments set status = 'published', published_at = clock_timestamp(), updated_at = clock_timestamp()
   where id = want_id;
  perform private.assignment_spend(school, want_key, 'publish', req, jsonb_build_object('id', want_id));
end $$;

create or replace function public.assignment_close(want_id uuid, want_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  a      public.assignments;
  req    jsonb := jsonb_build_object('id', want_id);
begin
  select * into a from public.assignments x where x.id = want_id and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such assignment' using errcode = 'no_data_found'; end if;
  perform private.assignment_require(school, a, 'assignments:author');
  if private.assignment_replay(school, want_key, 'close', req) is not null then return; end if;
  perform private.assignment_core_required(school);
  if a.status <> 'published' then raise exception 'semester: only a published assignment is closed' using errcode = 'check_violation'; end if;
  update public.assignments set status = 'closed', updated_at = clock_timestamp() where id = want_id;
  perform private.assignment_spend(school, want_key, 'close', req, jsonb_build_object('id', want_id));
end $$;

-- An extension for one student. The latest is in force; it can shorten as
-- well as lengthen, because the instructor may correct a mistake, and the
-- earlier row stays.
create or replace function public.assignment_extend(
  want_id uuid, want_student uuid, want_due timestamptz, want_until timestamptz, want_reason text, want_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  a      public.assignments;
  req    jsonb := jsonb_build_object('id', want_id, 'student', want_student, 'due', want_due,
                    'until', want_until, 'reason', want_reason);
  prior  jsonb;
  made   uuid;
begin
  select * into a from public.assignments x where x.id = want_id and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such assignment' using errcode = 'no_data_found'; end if;
  perform private.assignment_require(school, a, 'assignments:extend');
  prior := private.assignment_replay(school, want_key, 'extend', req);
  if prior is not null then return (prior->>'id')::uuid; end if;
  perform private.assignment_core_required(school);
  if a.status = 'draft' then raise exception 'semester: publish the assignment before extending it' using errcode = 'check_violation'; end if;
  if not private.subject_has_capability(want_student, 'assignments:submit', 'course', private.gradebook_scope(school, a.course_code, a.term)) then
    raise exception 'semester: that student is not on this course''s roster for %', a.term using errcode = 'check_violation';
  end if;
  if want_until is not null and a.late_policy = 'refuse' and want_until > want_due then
    -- A cut-off for late work only means something where late work is taken.
    want_until := null;
  end if;
  insert into public.assignment_overrides (tenant_id, assignment_id, student_id, due_at, late_until, reason, granted_by, operation)
  values (school, want_id, want_student, want_due, want_until, btrim(coalesce(want_reason, '')), me, want_key)
  returning id into made;
  perform private.assignment_spend(school, want_key, 'extend', req, jsonb_build_object('id', made));
  return made;
end $$;

-- ── The student's writer ────────────────────────────────────────────────

-- want_files: [{path, name, size, content_type, sha256}], at most ten.
create or replace function public.assignment_submit(want_id uuid, want_body text, want_files jsonb, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me        uuid := (select auth.uid());
  school    text := private.gradebook_school();
  a         public.assignments;
  files     jsonb := coalesce(want_files, '[]'::jsonb);
  req       jsonb := jsonb_build_object('id', want_id, 'body', coalesce(want_body, ''), 'files', coalesce(want_files, '[]'::jsonb));
  prior     jsonb;
  ov        public.assignment_overrides;
  eff_due   timestamptz;
  eff_until timestamptz;
  at_time   timestamptz;
  n         integer;
  is_late   boolean;
  f         jsonb;
  sub       uuid;
  rec       uuid;
  material  text;
  hash      text;
  result    jsonb;
begin
  select * into a from public.assignments x where x.id = want_id and x.tenant_id = school;
  if a.id is null then raise exception 'semester: no such assignment' using errcode = 'no_data_found'; end if;
  if not private.has_capability('assignments:submit', 'course', private.gradebook_scope(school, a.course_code, a.term)) then
    raise exception 'semester: you are not on this course''s roster for %', a.term using errcode = 'insufficient_privilege';
  end if;
  prior := private.assignment_replay(school, want_key, 'submit', req);
  if prior is not null then return prior; end if;
  perform private.assignment_core_required(school);
  if a.status <> 'published' then raise exception 'semester: this assignment is not open for submissions' using errcode = 'check_violation'; end if;

  if jsonb_typeof(files) <> 'array' or jsonb_array_length(files) > 10 then
    raise exception 'semester: at most ten files' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(want_body, ''))) = 0 and jsonb_array_length(files) = 0 then
    raise exception 'semester: hand in some text or a file' using errcode = 'check_violation';
  end if;
  if length(coalesce(want_body, '')) > 50000 then
    raise exception 'semester: the text is too long' using errcode = 'check_violation';
  end if;

  -- One at a time per student and assignment: the attempt number and the
  -- limit are read under this lock, so two tabs cannot both take the last one.
  perform pg_advisory_xact_lock(hashtext('assignment-submit:' || want_id::text || ':' || me::text));

  select o.* into ov from public.assignment_overrides o
   where o.assignment_id = want_id and o.student_id = me
   order by o.created_at desc limit 1;
  eff_due := coalesce(ov.due_at, a.due_at);
  eff_until := coalesce(case when ov.id is not null then ov.late_until end, a.late_until);
  if eff_until is not null and eff_until < eff_due then eff_until := eff_due; end if;

  at_time := clock_timestamp();
  is_late := at_time > eff_due;
  if is_late then
    if a.late_policy = 'refuse' and not (ov.id is not null and ov.late_until is not null) then
      raise exception 'semester: this assignment was due and takes no late work' using errcode = 'check_violation';
    end if;
    if eff_until is not null and at_time > eff_until then
      raise exception 'semester: this assignment is past the last time late work was taken' using errcode = 'check_violation';
    end if;
  end if;

  select count(*) into n from public.submissions s where s.assignment_id = want_id and s.student_id = me;
  if n >= a.attempts_allowed then
    raise exception 'semester: you have used all % attempts', a.attempts_allowed using errcode = 'check_violation';
  end if;

  for f in select * from jsonb_array_elements(files) loop
    if coalesce(f->>'path', '') not like school || '/' || want_id::text || '/' || me::text || '/%'
       or (f->>'path') !~ '^[A-Za-z0-9_-]+/[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$' then
      raise exception 'semester: a file is not under your own folder for this assignment' using errcode = 'check_violation';
    end if;
    if to_regclass('storage.objects') is not null and not exists (
         select 1 from storage.objects o where o.bucket_id = 'assignment-submissions' and o.name = f->>'path') then
      raise exception 'semester: a file was not uploaded' using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.submissions (tenant_id, assignment_id, student_id, attempt, body, submitted_at, due_at_used, late, operation)
  values (school, want_id, me, n + 1, coalesce(want_body, ''), at_time, eff_due, is_late, want_key)
  returning id into sub;

  for f in select * from jsonb_array_elements(files) loop
    insert into public.submission_files (tenant_id, submission_id, path, name, size_bytes, content_type, sha256)
    values (school, sub, f->>'path', f->>'name', (f->>'size')::bigint, f->>'content_type', f->>'sha256');
  end loop;

  material := concat_ws('|', 'semester-receipt-v1', want_id::text, me::text, (n + 1)::text,
                to_char(at_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), is_late::text,
                encode(sha256(convert_to(coalesce(want_body, ''), 'UTF8')), 'hex'),
                coalesce((select string_agg(x->>'sha256', ',' order by x->>'path') from jsonb_array_elements(files) x), ''));
  hash := encode(sha256(convert_to(material, 'UTF8')), 'hex');
  insert into public.submission_receipts (tenant_id, submission_id, assignment_id, student_id, issued_at, receipt_hash, statement)
  values (school, sub, want_id, me, at_time, hash,
          jsonb_build_object('assignment', a.title, 'course', a.course_code, 'term', a.term, 'attempt', n + 1,
                             'submitted_at', at_time, 'late', is_late, 'files', jsonb_array_length(files), 'material', material))
  returning id into rec;

  result := jsonb_build_object('submission_id', sub, 'attempt', n + 1, 'late', is_late,
                               'submitted_at', at_time, 'receipt_id', rec, 'receipt_hash', hash);
  perform private.assignment_spend(school, want_key, 'submit', req, result);
  return result;
end $$;

-- ── Who may call what ───────────────────────────────────────────────────

revoke all on function public.assignment_create(text, text, text, text, numeric, timestamptz, text, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.assignment_edit(uuid, text, text, timestamptz, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.assignment_publish(uuid, text) from public, anon, authenticated;
revoke all on function public.assignment_close(uuid, text) from public, anon, authenticated;
revoke all on function public.assignment_extend(uuid, uuid, timestamptz, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.assignment_submit(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.assignment_create(text, text, text, text, numeric, timestamptz, text, timestamptz, integer, text) to authenticated;
grant execute on function public.assignment_edit(uuid, text, text, timestamptz, text, timestamptz, text) to authenticated;
grant execute on function public.assignment_publish(uuid, text) to authenticated;
grant execute on function public.assignment_close(uuid, text) to authenticated;
grant execute on function public.assignment_extend(uuid, uuid, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.assignment_submit(uuid, text, jsonb, text) to authenticated;

-- ── An account that handed work in is not untouched ─────────────────────
--
-- `lti_account_untouched` decides whether a provisioned account holds nothing
-- and may be retired. A submission is work that exists nowhere else, so it
-- counts. This is the previous definition
-- (`20260929360000_account_untouched_school_domains.sql`) with three more
-- places to look; `submission_files` goes with its submission.

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
      -- 20261001010000: work a student handed in, its receipt, and an extension.
      ('public.submissions',          'student_id'),
      ('public.submission_receipts',  'student_id'),
      ('public.assignment_overrides', 'student_id')
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
