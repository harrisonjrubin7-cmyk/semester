-- Semester — the official degree audit, run on the server, when a school runs
-- the `degree_audit` module in Core (D-151).
--
-- Safe to run again. NOT APPLIED to production; applying it needs owner
-- approval.
--
-- `app/src/lib/degree.ts` is a student's own Path Snapshot, a planning
-- estimate labelled as one. Nothing here reads or changes it. This is what an
-- institution keeps: a program's requirements per catalog year, which version a
-- student is held to, an engine that reads the student's record from the
-- academic-record ledger (`20260929210000_academic_record_ledger.sql`) and says
-- what is met and what is not, and exceptions and substitutions an advisor
-- proposes and someone else approves.
--
-- ## What the database decides
--
--   * **Only in Core.** Every function here refuses unless the school's
--     `degree_audit` module is `core`, not frozen, and `kill.core_modules` is
--     disengaged. In Connect the school's own degree audit is the record.
--   * **Who.** School-scope capabilities: `degree:author` (registrar) writes and
--     publishes a program's requirements; `degree:declare` (registrar, academic
--     advisor) holds a student to a catalog year and saves an official run;
--     `degree:propose` (registrar, academic advisor) proposes an exception;
--     `degree:approve` (registrar, dean) decides one, never one they proposed;
--     `degree:read` (registrar, academic advisor, dean) reads every student's
--     audit. A student reads their own through the link the ledger already keeps
--     (`academic_record_subjects`).
--   * **A catalog year is immutable once published.** A version is a draft
--     until published and is never edited after: the next catalog year, or a
--     correction, is a new version. A student is held to the version they were
--     declared into; a change is a new declaration, and the history stays.
--   * **The record is the ledger's, as of a date.** A completed course is the
--     student's latest graded attempt of that course (`grade` entries, keyed
--     `<CODE> · <term>`, in effect on the date); its credits come from a
--     `credit` entry for the course; a `transfer_credit` entry counts as a
--     completed course with its credits and no grade points. A grade below the
--     version's passing line, a W, an I or an NP does not count.
--   * **Rules.** A group is `all` (every rule met by a different course),
--     `n_of` (at least n courses from any of its rules) or `credits` (at least
--     that many credits). A rule names one course or a subject prefix with an
--     optional number range. A course counts toward the first group it fits, in
--     group order, and only once: this is greedy, and an advisor's substitution
--     is the way to put a course somewhere else.
--   * **Exceptions are two-person.** A waiver marks a group met; a substitution
--     lets a named course count in a group, with its credits. Each needs a
--     reason, is proposed by one holder and decided by a different one, and an
--     approved one is part of the audit with its reason shown.
--   * **A saved run is a record.** `degree_audit_run` with `want_save` writes the
--     result, the version, a fingerprint of the ledger rows it read and who ran
--     it, and that row is never rewritten. A what-if (a different version than
--     the one declared) is computed and never saved.
--   * **AI decides nothing.** The engine is a rule applied to a record; it is
--     deterministic and cites the courses behind every line.
--
-- Not here, on purpose: prerequisite checking, course availability, and any
-- prediction of whether a student will graduate.

-- ── The capabilities ────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('degree:author',  'Write and publish a program''s requirements for a catalog year, for one school.'),
  ('degree:declare', 'Hold a student to a catalog year and save an official audit run, for one school.'),
  ('degree:propose', 'Propose a waiver or a substitution on a student''s degree audit, for one school.'),
  ('degree:approve', 'Decide a proposed waiver or substitution, never one they proposed, for one school.'),
  ('degree:read',    'Read every student''s degree audit, declaration and exceptions, for one school.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('registrar',        'degree:author'),
  ('registrar',        'degree:declare'),
  ('academic_advisor', 'degree:declare'),
  ('registrar',        'degree:propose'),
  ('academic_advisor', 'degree:propose'),
  ('registrar',        'degree:approve'),
  ('dean',             'degree:approve'),
  ('registrar',        'degree:read'),
  ('academic_advisor', 'degree:read'),
  ('dean',             'degree:read')
on conflict do nothing;

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.degree_operations (
  tenant_id       text        not null references public.schools(id) on delete cascade,
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9:._-]{8,200}$'),
  actor           uuid        references auth.users on delete set null,
  kind            text        not null check (kind in ('save', 'publish', 'declare', 'propose', 'decide', 'run')),
  request         jsonb       not null,
  result          jsonb       not null,
  at              timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create table if not exists public.degree_programs (
  id         uuid        primary key default gen_random_uuid(),
  tenant_id  text        not null references public.schools(id) on delete cascade,
  code       text        not null check (code ~ '^[A-Z0-9-]{2,20}$'),
  name       text        not null check (length(btrim(name)) between 1 and 200),
  kind       text        not null default 'major' check (kind in ('major', 'minor', 'certificate')),
  created_by uuid        references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.degree_versions (
  id               uuid          primary key default gen_random_uuid(),
  tenant_id        text          not null references public.schools(id) on delete cascade,
  program_id       uuid          not null references public.degree_programs on delete cascade,
  catalog_year     integer       not null check (catalog_year between 2000 and 2100),
  total_credits    numeric(6, 2) not null check (total_credits between 0 and 400),
  min_gpa          numeric(3, 2) not null default 2.00 check (min_gpa between 0 and 4),
  passing_points   numeric(3, 2) not null default 0.70 check (passing_points between 0 and 4),
  status           text          not null default 'draft' check (status in ('draft', 'published')),
  created_by       uuid          references auth.users on delete set null,
  operation        text          not null,
  created_at       timestamptz   not null default now(),
  published_at     timestamptz
);

create table if not exists public.degree_groups (
  id         uuid          primary key default gen_random_uuid(),
  tenant_id  text          not null references public.schools(id) on delete cascade,
  version_id uuid          not null references public.degree_versions on delete cascade,
  position   integer       not null check (position >= 1),
  name       text          not null check (length(btrim(name)) between 1 and 200),
  kind       text          not null check (kind in ('all', 'n_of', 'credits')),
  need_n     integer       check (need_n is null or need_n between 1 and 100),
  need_credits numeric(6, 2) check (need_credits is null or need_credits > 0),
  unique (version_id, position),
  constraint degree_group_need check (
    (kind = 'all' and need_n is null and need_credits is null)
    or (kind = 'n_of' and need_n is not null and need_credits is null)
    or (kind = 'credits' and need_credits is not null and need_n is null))
);

create table if not exists public.degree_rules (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  group_id    uuid        not null references public.degree_groups on delete cascade,
  course_code text        check (course_code is null or course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  prefix      text        check (prefix is null or prefix ~ '^[A-Z]{2,4}$'),
  min_number  integer     check (min_number is null or min_number between 0 and 9999),
  max_number  integer     check (max_number is null or max_number between 0 and 9999),
  constraint degree_rule_shape check ((course_code is not null) <> (prefix is not null)),
  constraint degree_rule_range check (min_number is null or max_number is null or min_number <= max_number),
  constraint degree_rule_course_no_range check (course_code is null or (min_number is null and max_number is null))
);

create table if not exists public.student_degrees (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  student_ref text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  version_id  uuid        not null references public.degree_versions on delete cascade,
  declared_by uuid        references auth.users on delete set null,
  declared_at timestamptz not null default clock_timestamp(),
  operation   text        not null
);

create table if not exists public.degree_exceptions (
  id          uuid          primary key default gen_random_uuid(),
  tenant_id   text          not null references public.schools(id) on delete cascade,
  student_ref text          not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  version_id  uuid          not null references public.degree_versions on delete cascade,
  group_id    uuid          not null references public.degree_groups on delete cascade,
  kind        text          not null check (kind in ('waive', 'substitute')),
  course_code text          check (course_code is null or course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  credits     numeric(5, 2) check (credits is null or credits > 0),
  reason      text          not null check (length(btrim(reason)) between 10 and 1000),
  status      text          not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  proposed_by uuid          references auth.users on delete set null,
  proposed_at timestamptz   not null default clock_timestamp(),
  decided_by  uuid          references auth.users on delete set null,
  decided_at  timestamptz,
  note        text          not null default '' check (length(note) <= 1000),
  operation   text          not null,
  constraint degree_exception_shape check (
    (kind = 'waive' and course_code is null and credits is null) or (kind = 'substitute' and course_code is not null and credits is not null)),
  constraint degree_exception_decided check ((status = 'proposed') = (decided_at is null))
);

create table if not exists public.degree_audit_runs (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  student_ref text        not null,
  version_id  uuid        not null references public.degree_versions on delete cascade,
  run_by      uuid        references auth.users on delete set null,
  run_at      timestamptz not null default clock_timestamp(),
  result      jsonb       not null,
  fingerprint text        not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  operation   text        not null
);

create index if not exists degree_operations_by_actor on public.degree_operations (actor);
create index if not exists degree_programs_by_creator on public.degree_programs (created_by);
create index if not exists degree_versions_by_program on public.degree_versions (program_id, catalog_year);
create index if not exists degree_versions_by_tenant on public.degree_versions (tenant_id);
create index if not exists degree_versions_by_creator on public.degree_versions (created_by);
create index if not exists degree_groups_by_tenant on public.degree_groups (tenant_id);
create index if not exists degree_rules_by_group on public.degree_rules (group_id);
create index if not exists degree_rules_by_tenant on public.degree_rules (tenant_id);
create index if not exists student_degrees_by_student on public.student_degrees (tenant_id, student_ref, declared_at desc);
create index if not exists student_degrees_by_version on public.student_degrees (version_id);
create index if not exists student_degrees_by_declarer on public.student_degrees (declared_by);
create index if not exists degree_exceptions_by_student on public.degree_exceptions (tenant_id, student_ref, version_id);
create index if not exists degree_exceptions_by_version on public.degree_exceptions (version_id);
create index if not exists degree_exceptions_by_group on public.degree_exceptions (group_id);
create index if not exists degree_exceptions_by_proposer on public.degree_exceptions (proposed_by);
create index if not exists degree_exceptions_by_decider on public.degree_exceptions (decided_by);
create index if not exists degree_audit_runs_by_student on public.degree_audit_runs (tenant_id, student_ref, run_at desc);
create index if not exists degree_audit_runs_by_version on public.degree_audit_runs (version_id);
create index if not exists degree_audit_runs_by_runner on public.degree_audit_runs (run_by);

comment on table public.degree_operations is 'Idempotency keys the degree-audit writers spent, with what each asked and answered. Append-only.';
comment on table public.degree_programs is 'A program a school offers: a major, a minor or a certificate.';
comment on table public.degree_versions is 'A program''s requirements for one catalog year. A draft until published; never edited after.';
comment on table public.degree_groups is 'One requirement group of a version: every rule, n courses, or a credit total.';
comment on table public.degree_rules is 'One rule of a group: a course, or a subject prefix with an optional number range.';
comment on table public.student_degrees is 'Which version a student is held to. Append-only; the latest declaration is in force.';
comment on table public.degree_exceptions is 'A waiver or substitution on a student''s audit, proposed by one holder and decided by another.';
comment on table public.degree_audit_runs is 'A saved official audit result with a fingerprint of the ledger it read. Never rewritten.';

-- ── Guards ──────────────────────────────────────────────────────────────

-- A published version, its groups and rules are never edited. Draft children
-- may be inserted by the writer; once the version is published nothing changes.
create or replace function private.guard_degree_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- `ON DELETE SET NULL` of the author's account may touch a published row.
  if (to_jsonb(new) - 'created_by') is not distinct from (to_jsonb(old) - 'created_by') and new.created_by is null then
    return new;
  end if;
  if old.status = 'published' then
    raise exception 'semester: a published catalog year is never edited; make a new version' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'status' - 'published_at' - 'created_by') is distinct from (to_jsonb(old) - 'status' - 'published_at' - 'created_by')
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'semester: only publishing changes a draft version' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_degree_version() from public, anon, authenticated;

create or replace function private.guard_degree_child()
returns trigger language plpgsql set search_path = '' as $$
declare
  vid uuid;
begin
  -- A record has only its own table's fields, so each table reads its own.
  if tg_table_name = 'degree_groups' then
    vid := case when tg_op = 'DELETE' then old.version_id else new.version_id end;
  else
    vid := (select g.version_id from public.degree_groups g
             where g.id = case when tg_op = 'DELETE' then old.group_id else new.group_id end);
  end if;
  if exists (select 1 from public.degree_versions v where v.id = vid and v.status = 'published') then
    raise exception 'semester: a published catalog year is never edited; make a new version' using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function private.guard_degree_child() from public, anon, authenticated;

create or replace function private.guard_degree_exception()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- `ON DELETE SET NULL` of a staff account may touch a decided row.
  if (to_jsonb(new) - 'proposed_by' - 'decided_by') is not distinct from (to_jsonb(old) - 'proposed_by' - 'decided_by')
     and (new.proposed_by is null or new.proposed_by is not distinct from old.proposed_by)
     and (new.decided_by is null or new.decided_by is not distinct from old.decided_by) then
    return new;
  end if;
  if old.status <> 'proposed'
     or (to_jsonb(new) - 'status' - 'decided_by' - 'decided_at' - 'note')
        is distinct from (to_jsonb(old) - 'status' - 'decided_by' - 'decided_at' - 'note') then
    raise exception 'semester: an exception is decided once and never rewritten' using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;
revoke all on function private.guard_degree_exception() from public, anon, authenticated;

create or replace function private.guard_degree_record()
returns trigger language plpgsql set search_path = '' as $$
declare
  staff_col text := case tg_table_name when 'student_degrees' then 'declared_by' else 'run_by' end;
  was uuid := (to_jsonb(old) ->> staff_col)::uuid;
  now_ uuid := (to_jsonb(new) ->> staff_col)::uuid;
begin
  -- Only `ON DELETE SET NULL` of the staff column may touch a row.
  if (to_jsonb(new) - staff_col) is not distinct from (to_jsonb(old) - staff_col)
     and (now_ is null or now_ is not distinct from was) then
    return new;
  end if;
  raise exception 'semester: this record is never rewritten' using errcode = 'insufficient_privilege';
end $$;
revoke all on function private.guard_degree_record() from public, anon, authenticated;

drop trigger if exists degree_versions_frozen on public.degree_versions;
create trigger degree_versions_frozen before update on public.degree_versions
for each row execute function private.guard_degree_version();
drop trigger if exists degree_groups_frozen on public.degree_groups;
create trigger degree_groups_frozen before insert or update or delete on public.degree_groups
for each row execute function private.guard_degree_child();
drop trigger if exists degree_rules_frozen on public.degree_rules;
create trigger degree_rules_frozen before insert or update or delete on public.degree_rules
for each row execute function private.guard_degree_child();
drop trigger if exists degree_exceptions_decided_once on public.degree_exceptions;
create trigger degree_exceptions_decided_once before update on public.degree_exceptions
for each row execute function private.guard_degree_exception();
drop trigger if exists student_degrees_never_rewritten on public.student_degrees;
create trigger student_degrees_never_rewritten before update on public.student_degrees
for each row execute function private.guard_degree_record();
drop trigger if exists degree_audit_runs_never_rewritten on public.degree_audit_runs;
create trigger degree_audit_runs_never_rewritten before update on public.degree_audit_runs
for each row execute function private.guard_degree_record();

-- ── Who reads ───────────────────────────────────────────────────────────

create or replace function private.degree_cap(want_tenant text, want_cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant)
     and private.has_capability(want_cap, 'school', want_tenant);
$$;
-- Called only from `degree_staff`, a definer function, so no client role needs it.
revoke all on function private.degree_cap(text, text) from public, anon, authenticated;

-- Staff who read audits: anyone holding a degree capability at the school.
create or replace function private.degree_staff(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.degree_cap(want_tenant, 'degree:read') or private.degree_cap(want_tenant, 'degree:author');
$$;
revoke all on function private.degree_staff(text) from public, anon, authenticated;
grant execute on function private.degree_staff(text) to authenticated;

-- Whether the caller is the account linked to a student's record.
create or replace function private.degree_is_subject(want_tenant text, want_student text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.academic_record_subjects s
                  where s.tenant_id = want_tenant and s.student_ref = want_student and s.user_id = (select auth.uid()));
$$;
revoke all on function private.degree_is_subject(text, text) from public, anon, authenticated;
grant execute on function private.degree_is_subject(text, text) to authenticated;

-- Whether a school member may read a published version's requirements.
create or replace function private.degree_member(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.user_id = (select auth.uid()) and p.school_id = want_tenant);
$$;
revoke all on function private.degree_member(text) from public, anon, authenticated;
grant execute on function private.degree_member(text) to authenticated;

alter table public.degree_operations enable row level security;
alter table public.degree_programs enable row level security;
alter table public.degree_versions enable row level security;
alter table public.degree_groups enable row level security;
alter table public.degree_rules enable row level security;
alter table public.student_degrees enable row level security;
alter table public.degree_exceptions enable row level security;
alter table public.degree_audit_runs enable row level security;

revoke all on table public.degree_operations from public, anon, authenticated;
revoke all on table public.degree_programs from public, anon, authenticated;
revoke all on table public.degree_versions from public, anon, authenticated;
revoke all on table public.degree_groups from public, anon, authenticated;
revoke all on table public.degree_rules from public, anon, authenticated;
revoke all on table public.student_degrees from public, anon, authenticated;
revoke all on table public.degree_exceptions from public, anon, authenticated;
revoke all on table public.degree_audit_runs from public, anon, authenticated;
grant select on table public.degree_operations to authenticated;
grant select on table public.degree_programs to authenticated;
grant select on table public.degree_versions to authenticated;
grant select on table public.degree_groups to authenticated;
grant select on table public.degree_rules to authenticated;
grant select on table public.student_degrees to authenticated;
grant select on table public.degree_exceptions to authenticated;
grant select on table public.degree_audit_runs to authenticated;

drop policy if exists "callers read their own degree operations" on public.degree_operations;
create policy "callers read their own degree operations" on public.degree_operations
  for select to authenticated using (actor = (select auth.uid()));

drop policy if exists "school members read programs" on public.degree_programs;
create policy "school members read programs" on public.degree_programs
  for select to authenticated using (private.degree_member(tenant_id));

-- Requirements: members read what is published; staff read drafts too.
drop policy if exists "members read published versions, staff drafts" on public.degree_versions;
create policy "members read published versions, staff drafts" on public.degree_versions
  for select to authenticated
  using ((status = 'published' and private.degree_member(tenant_id)) or private.degree_staff(tenant_id));

drop policy if exists "whoever reads the version reads its groups" on public.degree_groups;
create policy "whoever reads the version reads its groups" on public.degree_groups
  for select to authenticated using (exists (select 1 from public.degree_versions v where v.id = version_id));

drop policy if exists "whoever reads the group reads its rules" on public.degree_rules;
create policy "whoever reads the group reads its rules" on public.degree_rules
  for select to authenticated using (exists (select 1 from public.degree_groups g where g.id = group_id));

drop policy if exists "staff and the student read a declaration" on public.student_degrees;
create policy "staff and the student read a declaration" on public.student_degrees
  for select to authenticated using (private.degree_staff(tenant_id) or private.degree_is_subject(tenant_id, student_ref));

drop policy if exists "staff and the student read an exception" on public.degree_exceptions;
create policy "staff and the student read an exception" on public.degree_exceptions
  for select to authenticated using (private.degree_staff(tenant_id) or private.degree_is_subject(tenant_id, student_ref));

drop policy if exists "staff and the student read a saved audit" on public.degree_audit_runs;
create policy "staff and the student read a saved audit" on public.degree_audit_runs
  for select to authenticated using (private.degree_staff(tenant_id) or private.degree_is_subject(tenant_id, student_ref));

-- ── Helpers the writers share ───────────────────────────────────────────

create or replace function private.degree_replay(school text, want_key text, want_kind text, want_request jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  op public.degree_operations;
begin
  if want_key is null or want_key !~ '^[A-Za-z0-9:._-]{8,200}$' then
    raise exception 'semester: an idempotency key is 8 to 200 letters, digits or : . _ -' using errcode = 'check_violation';
  end if;
  perform pg_advisory_xact_lock(hashtext('degree-op:' || school || ':' || want_key));
  select * into op from public.degree_operations o where o.tenant_id = school and o.idempotency_key = want_key;
  if not found then return null; end if;
  if op.actor is distinct from (select auth.uid()) or op.kind <> want_kind or op.request <> want_request then
    raise exception 'semester: that idempotency key was already used for a different request' using errcode = 'unique_violation';
  end if;
  return op.result;
end $$;
revoke all on function private.degree_replay(text, text, text, jsonb) from public, anon, authenticated;

create or replace function private.degree_spend(school text, want_key text, want_kind text, want_request jsonb, want_result jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.degree_operations (tenant_id, idempotency_key, actor, kind, request, result)
  values (school, want_key, (select auth.uid()), want_kind, want_request, want_result);
$$;
revoke all on function private.degree_spend(text, text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function private.degree_core_required(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.module_is_core(school, 'degree_audit') then
    raise exception 'semester: this school does not run the degree audit in Core' using errcode = 'check_violation';
  end if;
end $$;
revoke all on function private.degree_core_required(text) from public, anon, authenticated;

create or replace function private.degree_require(school text, want_cap text)
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
revoke all on function private.degree_require(text, text) from public, anon, authenticated;

-- Grade points for a letter, or null for one that carries none.
create or replace function private.degree_points(want_grade text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case upper(btrim(want_grade))
    when 'A+' then 4.0 when 'A' then 4.0 when 'A-' then 3.7 when 'B+' then 3.3 when 'B' then 3.0 when 'B-' then 2.7
    when 'C+' then 2.3 when 'C' then 2.0 when 'C-' then 1.7 when 'D+' then 1.3 when 'D' then 1.0 when 'D-' then 0.7
    when 'F' then 0.0 end;
$$;
revoke all on function private.degree_points(text) from public, anon, authenticated;

-- The course code at the start of a ledger key (`ECON 1020 · Fall 2026`), or null.
create or replace function private.degree_course_of(want_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select (regexp_match(upper(btrim(want_key)), '^([A-Z]{2,4} [0-9]{3,4}[A-Z]?)(\s|$|·)'))[1];
$$;
revoke all on function private.degree_course_of(text) from public, anon, authenticated;

-- Whether a course code fits a rule.
create or replace function private.degree_fits(want_code text, r public.degree_rules)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when r.course_code is not null then want_code = r.course_code
    else split_part(want_code, ' ', 1) = r.prefix
      and coalesce((regexp_match(split_part(want_code, ' ', 2), '^[0-9]+'))[1]::int, -1) between coalesce(r.min_number, 0) and coalesce(r.max_number, 9999)
  end;
$$;
revoke all on function private.degree_fits(text, public.degree_rules) from public, anon, authenticated;

-- The audit itself: a student's record as of a date against one version.
-- Pure of side effects. Returns the result and, under 'ledger', the entries it read.
create or replace function private.degree_compute(want_tenant text, want_student text, want_version uuid, on_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v        public.degree_versions;
  prog     public.degree_programs;
  courses  jsonb;
  g        record;
  r        public.degree_rules;
  c        jsonb;
  pool     jsonb;
  used     text[] := '{}';
  groups   jsonb := '[]'::jsonb;
  taken    jsonb;
  met      boolean;
  have     numeric;
  waived   boolean;
  sub      record;
  total    numeric := 0;
  pts      numeric := 0;
  gcred    numeric := 0;
  warns    jsonb := '[]'::jsonb;
  all_met  boolean := true;
  unmet    jsonb := '[]'::jsonb;
  gpa      numeric;
  unusedc  jsonb := '[]'::jsonb;
  seen     boolean;
  picked   text;
begin
  select * into v from public.degree_versions x where x.id = want_version and x.tenant_id = want_tenant;
  if v.id is null then raise exception 'semester: no such catalog year' using errcode = 'no_data_found'; end if;
  select * into prog from public.degree_programs x where x.id = v.program_id;

  -- Every course the student has completed, once: their latest graded attempt,
  -- or transfer credit, with credits from the ledger's credit entry.
  with in_effect as (
    select distinct on (e.kind, e.subject_key) e.kind, e.subject_key, e.action, e.value, e.effective_on, e.recorded_at
      from public.academic_record_entries e
     where e.tenant_id = want_tenant and e.student_ref = want_student
       and e.kind in ('grade', 'credit', 'transfer_credit') and e.effective_on <= on_date
     order by e.kind, e.subject_key, e.effective_on desc, e.recorded_at desc, e.id desc),
  grades as (
    select distinct on (private.degree_course_of(subject_key)) private.degree_course_of(subject_key) as code, upper(btrim(value)) as grade, 'grade' as src
      from in_effect where kind = 'grade' and action = 'set' and private.degree_course_of(subject_key) is not null
     order by private.degree_course_of(subject_key), effective_on desc, recorded_at desc),
  credits as (
    select distinct on (private.degree_course_of(subject_key)) private.degree_course_of(subject_key) as code,
           case when btrim(value) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(value)::numeric end as credits
      from in_effect where kind = 'credit' and action = 'set' and private.degree_course_of(subject_key) is not null
     order by private.degree_course_of(subject_key), effective_on desc, recorded_at desc),
  transfers as (
    select private.degree_course_of(subject_key) as code, 'TR' as grade, 'transfer' as src,
           case when btrim(value) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(value)::numeric end as credits
      from in_effect where kind = 'transfer_credit' and action = 'set' and private.degree_course_of(subject_key) is not null),
  merged as (
    select gd.code, gd.grade, gd.src, cr.credits from grades gd left join credits cr using (code)
    union all
    select t.code, t.grade, t.src, t.credits from transfers t where not exists (select 1 from grades g2 where g2.code = t.code))
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'grade', grade, 'src', src, 'credits', credits,
           'points', private.degree_points(grade),
           'counts', (src = 'transfer') or grade in ('P') or coalesce(private.degree_points(grade), -1) >= v.passing_points)
         order by code), '[]'::jsonb)
    into courses from merged;

  -- Credits that are missing are said, never guessed.
  for c in select * from jsonb_array_elements(courses) loop
    if (c->>'counts')::boolean and (c->'credits') = 'null'::jsonb then
      warns := warns || jsonb_build_array('No credit entry for ' || (c->>'code') || '; it counts for no credits until the record has one.');
    end if;
  end loop;

  -- GPA over graded, counted courses, weighted by credits.
  for c in select * from jsonb_array_elements(courses) loop
    if (c->'points') <> 'null'::jsonb and (c->'credits') <> 'null'::jsonb and (c->>'src') = 'grade' and (c->>'credits')::numeric > 0 then
      pts := pts + (c->>'points')::numeric * (c->>'credits')::numeric;
      gcred := gcred + (c->>'credits')::numeric;
    end if;
    if (c->>'counts')::boolean and (c->'credits') <> 'null'::jsonb then total := total + (c->>'credits')::numeric; end if;
  end loop;
  gpa := case when gcred > 0 then round(pts / gcred, 3) end;

  -- Substitutions add a named course, with its credits, to one group's pool.
  for g in select * from public.degree_groups x where x.version_id = want_version order by x.position loop
    waived := exists (select 1 from public.degree_exceptions e where e.student_ref = want_student and e.tenant_id = want_tenant
                       and e.group_id = g.id and e.version_id = want_version and e.kind = 'waive' and e.status = 'approved');
    -- The pool: unused counted courses that fit any rule, plus approved substitutions.
    pool := '[]'::jsonb;
    for c in select * from jsonb_array_elements(courses) loop
      if (c->>'counts')::boolean and not ((c->>'code') = any(used)) then
        if exists (select 1 from public.degree_rules ru where ru.group_id = g.id and private.degree_fits(c->>'code', ru)) then
          pool := pool || jsonb_build_array(c);
        end if;
      end if;
    end loop;
    for sub in select * from public.degree_exceptions e where e.student_ref = want_student and e.tenant_id = want_tenant
                and e.group_id = g.id and e.version_id = want_version and e.kind = 'substitute' and e.status = 'approved' loop
      if not (sub.course_code = any(used)) then
        pool := pool || jsonb_build_array(jsonb_build_object('code', sub.course_code, 'grade', 'SUB', 'src', 'substitution', 'credits', sub.credits, 'points', null, 'counts', true));
      end if;
    end loop;

    taken := '[]'::jsonb;
    have := 0;
    if g.kind = 'all' then
      met := true;
      for r in select * from public.degree_rules ru where ru.group_id = g.id order by ru.id loop
        picked := null;
        for c in select * from jsonb_array_elements(pool) loop
          if private.degree_fits(c->>'code', r) and not exists (select 1 from jsonb_array_elements(taken) tk where tk->>'code' = c->>'code') then
            picked := c->>'code'; taken := taken || jsonb_build_array(c); exit;
          end if;
        end loop;
        if picked is null then met := false; end if;
      end loop;
      have := (select count(*) from jsonb_array_elements(taken));
      -- 'all' needs one distinct course per rule.
      met := met and have = (select count(*) from public.degree_rules ru where ru.group_id = g.id);
    elsif g.kind = 'n_of' then
      for c in select * from jsonb_array_elements(pool) order by coalesce((value->>'points')::numeric, 0) desc, value->>'code' loop
        exit when (select count(*) from jsonb_array_elements(taken)) >= g.need_n;
        taken := taken || jsonb_build_array(c);
      end loop;
      have := (select count(*) from jsonb_array_elements(taken));
      met := have >= g.need_n;
    else
      for c in select * from jsonb_array_elements(pool) order by coalesce((value->>'points')::numeric, 0) desc, value->>'code' loop
        exit when have >= g.need_credits;
        taken := taken || jsonb_build_array(c);
        have := have + coalesce((c->>'credits')::numeric, 0);
      end loop;
      met := have >= g.need_credits;
    end if;

    -- The courses used here are used for good.
    for c in select * from jsonb_array_elements(taken) loop
      used := used || (c->>'code');
      -- A substituted course is not in the record; its approved credits join the total.
      if (c->>'src') = 'substitution' then total := total + coalesce((c->>'credits')::numeric, 0); end if;
    end loop;
    if waived then met := true; end if;
    if not met then all_met := false; unmet := unmet || jsonb_build_array(g.name); end if;
    groups := groups || jsonb_build_array(jsonb_build_object(
      'position', g.position, 'name', g.name, 'kind', g.kind, 'need', coalesce(g.need_n::numeric, g.need_credits, (select count(*) from public.degree_rules ru where ru.group_id = g.id)),
      'have', have, 'met', met, 'waived', waived,
      'courses', (select coalesce(jsonb_agg(t->>'code'), '[]'::jsonb) from jsonb_array_elements(taken) t),
      'substituted', (select coalesce(jsonb_agg(t->>'code'), '[]'::jsonb) from jsonb_array_elements(taken) t where t->>'src' = 'substitution')));
  end loop;

  for c in select * from jsonb_array_elements(courses) loop
    if (c->>'counts')::boolean and not ((c->>'code') = any(used)) then unusedc := unusedc || jsonb_build_array(c->>'code'); end if;
  end loop;

  return jsonb_build_object(
    'program', prog.code, 'program_name', prog.name, 'kind', prog.kind, 'catalog_year', v.catalog_year, 'version', v.id, 'as_of', on_date,
    'status', case when all_met and total >= v.total_credits and coalesce(gpa, 0) >= v.min_gpa and gcred > 0 then 'complete' else 'in_progress' end,
    'credits', jsonb_build_object('have', trim_scale(total), 'need', trim_scale(v.total_credits), 'met', total >= v.total_credits),
    'gpa', jsonb_build_object('have', gpa, 'need', v.min_gpa, 'met', coalesce(gpa, 0) >= v.min_gpa and gcred > 0),
    'groups', groups, 'unmet', unmet, 'unused', unusedc, 'warnings', warns,
    'courses', courses);
end $$;
revoke all on function private.degree_compute(text, text, uuid, date) from public, anon, authenticated;

-- ── The writers ─────────────────────────────────────────────────────────

-- Saves a draft catalog year for a program (creating the program the first
-- time). `want_groups` is an array of
-- {name, kind, need, rules: [{course | prefix, min, max}]}. Returns its id.
create or replace function public.degree_version_save(
  want_program text, want_name text, want_kind text, want_year integer,
  want_total numeric, want_min_gpa numeric, want_groups jsonb, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  pcode  text := upper(btrim(coalesce(want_program, '')));
  req    jsonb := jsonb_build_object('program', upper(btrim(coalesce(want_program, ''))), 'name', want_name, 'kind', want_kind,
                    'year', want_year, 'total', want_total, 'min_gpa', want_min_gpa, 'groups', want_groups);
  prior  jsonb;
  prog   uuid;
  made   uuid;
  gid    uuid;
  gr     jsonb;
  ru     jsonb;
  pos    integer := 0;
  result jsonb;
begin
  perform private.degree_require(school, 'degree:author');
  prior := private.degree_replay(school, want_key, 'save', req);
  if prior is not null then return prior; end if;
  perform private.degree_core_required(school);
  if want_groups is null or jsonb_typeof(want_groups) <> 'array' or jsonb_array_length(want_groups) = 0 then
    raise exception 'semester: a catalog year needs at least one requirement group' using errcode = 'check_violation';
  end if;

  select p.id into prog from public.degree_programs p where p.tenant_id = school and p.code = pcode;
  if prog is null then
    insert into public.degree_programs (tenant_id, code, name, kind, created_by)
    values (school, pcode, btrim(want_name), coalesce(want_kind, 'major'), me) returning id into prog;
  end if;
  if exists (select 1 from public.degree_versions v where v.program_id = prog and v.catalog_year = want_year and v.status = 'draft') then
    raise exception 'semester: that catalog year already has a draft; publish it or save under another year' using errcode = 'unique_violation';
  end if;

  insert into public.degree_versions (tenant_id, program_id, catalog_year, total_credits, min_gpa, created_by, operation)
  values (school, prog, want_year, want_total, coalesce(want_min_gpa, 2.00), me, want_key) returning id into made;

  for gr in select * from jsonb_array_elements(want_groups) loop
    pos := pos + 1;
    insert into public.degree_groups (tenant_id, version_id, position, name, kind, need_n, need_credits)
    values (school, made, pos, btrim(gr->>'name'), gr->>'kind',
            case when gr->>'kind' = 'n_of' then (gr->>'need')::integer end,
            case when gr->>'kind' = 'credits' then (gr->>'need')::numeric end)
    returning id into gid;
    for ru in select * from jsonb_array_elements(coalesce(gr->'rules', '[]'::jsonb)) loop
      insert into public.degree_rules (tenant_id, group_id, course_code, prefix, min_number, max_number)
      values (school, gid, upper(nullif(btrim(ru->>'course'), '')), upper(nullif(btrim(ru->>'prefix'), '')),
              (ru->>'min')::integer, (ru->>'max')::integer);
    end loop;
    if not exists (select 1 from public.degree_rules x where x.group_id = gid) then
      raise exception 'semester: group "%" has no rules', gr->>'name' using errcode = 'check_violation';
    end if;
  end loop;

  result := jsonb_build_object('id', made, 'program', pcode, 'catalog_year', want_year);
  perform private.degree_spend(school, want_key, 'save', req, result);
  return result;
end $$;

-- Publishes a draft. After this the version is never edited.
create or replace function public.degree_version_publish(want_id uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('id', want_id);
  prior  jsonb;
  v      public.degree_versions;
  result jsonb;
begin
  perform private.degree_require(school, 'degree:author');
  prior := private.degree_replay(school, want_key, 'publish', req);
  if prior is not null then return prior; end if;
  perform private.degree_core_required(school);
  select * into v from public.degree_versions x where x.id = want_id and x.tenant_id = school for update;
  if v.id is null then raise exception 'semester: no such catalog year' using errcode = 'no_data_found'; end if;
  if v.status = 'published' then raise exception 'semester: already published' using errcode = 'check_violation'; end if;
  update public.degree_versions set status = 'published', published_at = clock_timestamp() where id = want_id;
  result := jsonb_build_object('id', want_id, 'status', 'published');
  perform private.degree_spend(school, want_key, 'publish', req, result);
  return result;
end $$;

-- Holds a student to a published catalog year. The history stays; the latest wins.
create or replace function public.degree_declare(want_student text, want_version uuid, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('student', want_student, 'version', want_version);
  prior  jsonb;
  made   uuid;
  result jsonb;
begin
  perform private.degree_require(school, 'degree:declare');
  prior := private.degree_replay(school, want_key, 'declare', req);
  if prior is not null then return prior; end if;
  perform private.degree_core_required(school);
  if want_student is null or want_student !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'semester: that is not a student reference' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.degree_versions v where v.id = want_version and v.tenant_id = school and v.status = 'published') then
    raise exception 'semester: a student is held only to a published catalog year' using errcode = 'check_violation';
  end if;
  insert into public.student_degrees (tenant_id, student_ref, version_id, declared_by, operation)
  values (school, want_student, want_version, me, want_key) returning id into made;
  result := jsonb_build_object('id', made);
  perform private.degree_spend(school, want_key, 'declare', req, result);
  return result;
end $$;

-- Proposes a waiver (want_course null) or a substitution for one group, by its position.
create or replace function public.degree_exception_propose(
  want_student text, want_version uuid, want_position integer, want_kind text,
  want_course text, want_credits numeric, want_reason text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('student', want_student, 'version', want_version, 'position', want_position,
                    'kind', want_kind, 'course', upper(btrim(coalesce(want_course, ''))), 'credits', want_credits, 'reason', want_reason);
  prior  jsonb;
  gid    uuid;
  made   uuid;
  result jsonb;
begin
  perform private.degree_require(school, 'degree:propose');
  prior := private.degree_replay(school, want_key, 'propose', req);
  if prior is not null then return prior; end if;
  perform private.degree_core_required(school);
  select g.id into gid from public.degree_groups g join public.degree_versions v on v.id = g.version_id
   where g.version_id = want_version and g.position = want_position and v.tenant_id = school and v.status = 'published';
  if gid is null then raise exception 'semester: no such requirement group in a published catalog year' using errcode = 'no_data_found'; end if;
  if want_kind not in ('waive', 'substitute') then raise exception 'semester: an exception is a waiver or a substitution' using errcode = 'check_violation'; end if;
  insert into public.degree_exceptions (tenant_id, student_ref, version_id, group_id, kind, course_code, credits, reason, proposed_by, operation)
  values (school, want_student, want_version, gid, want_kind,
          case when want_kind = 'substitute' then upper(btrim(want_course)) end,
          case when want_kind = 'substitute' then want_credits end, btrim(coalesce(want_reason, '')), me, want_key)
  returning id into made;
  result := jsonb_build_object('id', made, 'status', 'proposed');
  perform private.degree_spend(school, want_key, 'propose', req, result);
  return result;
end $$;

-- Decides a proposal. Never the person who proposed it.
create or replace function public.degree_exception_decide(want_exception uuid, want_approve boolean, want_note text, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.gradebook_school();
  req    jsonb := jsonb_build_object('exception', want_exception, 'approve', want_approve, 'note', coalesce(want_note, ''));
  prior  jsonb;
  ex     public.degree_exceptions;
  result jsonb;
begin
  perform private.degree_require(school, 'degree:approve');
  prior := private.degree_replay(school, want_key, 'decide', req);
  if prior is not null then return prior; end if;
  perform private.degree_core_required(school);
  select * into ex from public.degree_exceptions x where x.id = want_exception and x.tenant_id = school for update;
  if ex.id is null then raise exception 'semester: no such exception' using errcode = 'no_data_found'; end if;
  if ex.status <> 'proposed' then raise exception 'semester: that exception is already decided' using errcode = 'check_violation'; end if;
  if ex.proposed_by is not distinct from me then
    raise exception 'semester: an exception is decided by someone other than who proposed it' using errcode = 'insufficient_privilege';
  end if;
  update public.degree_exceptions
     set status = case when want_approve then 'approved' else 'rejected' end,
         decided_by = me, decided_at = clock_timestamp(), note = coalesce(want_note, '')
   where id = want_exception;
  result := jsonb_build_object('id', want_exception, 'status', case when want_approve then 'approved' else 'rejected' end);
  perform private.degree_spend(school, want_key, 'decide', req, result);
  return result;
end $$;

-- Runs the audit. A staff member with degree:read, or the student, may run it;
-- only degree:declare may save it, and only against the version the student is
-- held to. A different version is a what-if: computed, never saved.
create or replace function public.degree_audit_run(want_student text, want_version uuid, want_save boolean, want_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := (select auth.uid());
  school   text := private.gradebook_school();
  declared uuid;
  ver      uuid;
  res      jsonb;
  fp       text;
  made     uuid;
  req      jsonb := jsonb_build_object('student', want_student, 'version', want_version, 'save', coalesce(want_save, false));
  prior    jsonb;
  result   jsonb;
begin
  if not (private.has_capability('degree:read', 'school', school) or private.degree_is_subject(school, want_student)) then
    raise exception 'semester: that needs degree:read at this school, or to be the student' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(want_save, false) then
    perform private.degree_require(school, 'degree:declare');
    prior := private.degree_replay(school, want_key, 'run', req);
    if prior is not null then return prior; end if;
  end if;
  perform private.degree_core_required(school);

  select d.version_id into declared from public.student_degrees d
   where d.tenant_id = school and d.student_ref = want_student order by d.declared_at desc, d.id desc limit 1;
  ver := coalesce(want_version, declared);
  if ver is null then raise exception 'semester: this student has not been held to a catalog year' using errcode = 'no_data_found'; end if;
  if coalesce(want_save, false) and ver is distinct from declared then
    raise exception 'semester: a what-if against another catalog year is never saved' using errcode = 'check_violation';
  end if;

  res := private.degree_compute(school, want_student, ver, current_date);
  select encode(sha256(convert_to(coalesce(string_agg(e.id::text || e.recorded_at::text, ',' order by e.id), ''), 'UTF8')), 'hex')
    into fp from public.academic_record_entries e
   where e.tenant_id = school and e.student_ref = want_student and e.kind in ('grade', 'credit', 'transfer_credit');
  res := res || jsonb_build_object('what_if', ver is distinct from declared, 'fingerprint', fp);

  if coalesce(want_save, false) then
    insert into public.degree_audit_runs (tenant_id, student_ref, version_id, run_by, result, fingerprint, operation)
    values (school, want_student, ver, me, res, fp, want_key) returning id into made;
    result := res || jsonb_build_object('saved', made);
    perform private.degree_spend(school, want_key, 'run', req, result);
    return result;
  end if;
  return res || jsonb_build_object('saved', null);
end $$;

revoke all on function public.degree_version_save(text, text, text, integer, numeric, numeric, jsonb, text) from public, anon;
revoke all on function public.degree_version_publish(uuid, text) from public, anon;
revoke all on function public.degree_declare(text, uuid, text) from public, anon;
revoke all on function public.degree_exception_propose(text, uuid, integer, text, text, numeric, text, text) from public, anon;
revoke all on function public.degree_exception_decide(uuid, boolean, text, text) from public, anon;
revoke all on function public.degree_audit_run(text, uuid, boolean, text) from public, anon;
grant execute on function public.degree_version_save(text, text, text, integer, numeric, numeric, jsonb, text) to authenticated;
grant execute on function public.degree_version_publish(uuid, text) to authenticated;
grant execute on function public.degree_declare(text, uuid, text) to authenticated;
grant execute on function public.degree_exception_propose(text, uuid, integer, text, text, numeric, text, text) to authenticated;
grant execute on function public.degree_exception_decide(uuid, boolean, text, text) to authenticated;
grant execute on function public.degree_audit_run(text, uuid, boolean, text) to authenticated;

-- No student-owned column lives in these tables (a student is a `student_ref`
-- linked through the ledger, not a user id), so `lti_account_untouched` needs
-- no new row here.
