-- Registrar core: sections + capacity, enrollments, grade attempts/postings. Proposed; not run.
-- Enforces: tenant-consistent FKs, no double-allocated last seat, unique active enrollment, atomic swap, grade posting tied to the attempt, supersession not rewrite.
create schema if not exists registrar;

create table registrar.sections (
  institution_id uuid not null, id uuid not null default gen_random_uuid(),
  term_id uuid not null, course_version_id uuid not null, section_code text not null,
  capacity int not null check (capacity >= 0), enrolled int not null default 0,
  version bigint not null default 1,
  primary key (institution_id, id), unique (institution_id, term_id, course_version_id, section_code),
  constraint seats_not_overallocated check (enrolled between 0 and capacity)
);

create type registrar.enrollment_status as enum ('pending_external','enrolled','waitlisted','dropped','withdrawn');
create table registrar.enrollments (
  institution_id uuid not null, id uuid not null default gen_random_uuid(),
  student_career_id uuid not null, section_id uuid not null,
  status registrar.enrollment_status not null, idempotency_key text not null,
  effective_at timestamptz not null default now(), recorded_at timestamptz not null default now(),
  actor uuid not null, policy_version text not null,
  primary key (institution_id, id),
  foreign key (institution_id, section_id) references registrar.sections (institution_id, id),
  unique (institution_id, idempotency_key)
);
create unique index one_active_enrollment on registrar.enrollments (institution_id, student_career_id, section_id) where status in ('enrolled','pending_external','waitlisted');

-- Seat allocation: the CHECK above makes a second "last seat" update fail; the function serialises on the section row.
create or replace function registrar.enroll(p_inst uuid, p_student uuid, p_section uuid, p_key text, p_actor uuid, p_policy text)
returns registrar.enrollments language plpgsql security definer set search_path = registrar, pg_temp as $$
declare e registrar.enrollments; s registrar.sections;
begin
  select * into e from enrollments where institution_id = p_inst and idempotency_key = p_key;
  if found then return e; end if;                                   -- replay returns the original
  select * into s from sections where institution_id = p_inst and id = p_section for update;
  if not found then raise exception 'section not found in this institution'; end if;
  if s.enrolled >= s.capacity then raise exception 'section full' using errcode = 'P0001'; end if;
  update sections set enrolled = enrolled + 1, version = version + 1 where institution_id = p_inst and id = p_section;
  insert into enrollments(institution_id, student_career_id, section_id, status, idempotency_key, actor, policy_version)
    values (p_inst, p_student, p_section, 'enrolled', p_key, p_actor, p_policy) returning * into e;
  return e;
end $$;

-- Atomic swap: drop + add in one transaction; if the add fails the drop rolls back.
create or replace function registrar.swap(p_inst uuid, p_student uuid, p_from uuid, p_to uuid, p_key text, p_actor uuid, p_policy text)
returns registrar.enrollments language plpgsql security definer set search_path = registrar, pg_temp as $$
declare e registrar.enrollments;
begin
  update enrollments set status = 'dropped', recorded_at = now() where institution_id = p_inst and student_career_id = p_student and section_id = p_from and status = 'enrolled';
  if not found then raise exception 'not enrolled in the from-section'; end if;
  update sections set enrolled = enrolled - 1 where institution_id = p_inst and id = p_from;
  e := registrar.enroll(p_inst, p_student, p_to, p_key, p_actor, p_policy);  -- raises → whole swap rolls back
  return e;
end $$;
revoke execute on function registrar.enroll, registrar.swap from public, anon, authenticated;

create table registrar.course_attempts (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), enrollment_id uuid not null,
  primary key (institution_id, id), foreign key (institution_id, enrollment_id) references registrar.enrollments (institution_id, id)
);
create table registrar.grade_postings (
  institution_id uuid not null, id uuid not null default gen_random_uuid(), attempt_id uuid not null,
  grade text not null, grade_mode text not null, policy_version text not null,
  posted_by uuid not null, approval_ref text, effective_at timestamptz not null, recorded_at timestamptz not null default now(),
  supersedes uuid, reason text,
  primary key (institution_id, id), foreign key (institution_id, attempt_id) references registrar.course_attempts (institution_id, id),
  foreign key (institution_id, supersedes) references registrar.grade_postings (institution_id, id),
  constraint correction_needs_reason check (supersedes is null or (reason is not null and approval_ref is not null))
);
-- Postings are append-only: corrections insert a new row that supersedes, never update.
create or replace function registrar.no_update() returns trigger language plpgsql as $$ begin raise exception 'grade postings are append-only; insert a superseding posting'; end $$;
create trigger grade_postings_append_only before update or delete on registrar.grade_postings for each row execute function registrar.no_update();

do $$ declare t text; begin foreach t in array array['sections','enrollments','course_attempts','grade_postings'] loop
  execute format('alter table registrar.%I enable row level security', t); execute format('alter table registrar.%I force row level security', t); end loop; end $$;
