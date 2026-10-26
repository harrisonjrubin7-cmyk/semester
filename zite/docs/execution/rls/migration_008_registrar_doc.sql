-- Registrar migration transcribed verbatim from "Semester full-stack architecture" §3.1-3.4.
\set ON_ERROR_STOP on
begin;
-- CHANGED (defect 1): semester_owner has no CREATE on the database, so the schema is created
-- before switching role, as the foundation migration does.
create schema registrar authorization semester_owner;
set local role semester_owner;
revoke all on schema registrar from public;
grant usage on schema registrar to semester_api;
create table registrar.students (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null references iam.tenants(id),
user_id uuid references iam.users(id),
student_number text not null,
status text not null
check (status in (
'applicant', 'active', 'leave',
'withdrawn', 'graduated', 'inactive'
)),
created_at timestamptz not null default now(),
unique (tenant_id, id),
unique (tenant_id, student_number),
unique (tenant_id, user_id)
);
create table registrar.terms (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null references iam.tenants(id),
code text not null,
name text not null,
starts_on date not null,
ends_on date not null,
timezone text not null,
state text not null
check (state in ('draft', 'published', 'closed')),
check (ends_on >= starts_on),
unique (tenant_id, id),
unique (tenant_id, code)
);
create table registrar.courses (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null references iam.tenants(id),
code text not null,
unique (tenant_id, id),
unique (tenant_id, code)
);
create table registrar.course_versions (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
course_id uuid not null,
version integer not null check (version > 0),
title text not null,
credits_min numeric(5,2) not null check (credits_min >= 0),
credits_max numeric(5,2) not null,
state text not null
check (state in ('draft', 'approved', 'retired')),
check (credits_max >= credits_min),
unique (tenant_id, id),
unique (tenant_id, course_id, version),
foreign key (tenant_id, course_id)
references registrar.courses(tenant_id, id)
);
create table registrar.programs (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null references iam.tenants(id),
code text not null,
title text not null,
unique (tenant_id, id),
unique (tenant_id, code)
);
create table registrar.program_versions (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
program_id uuid not null,
version integer not null check (version > 0),
requirement_definition jsonb not null,
state text not null
check (state in ('draft', 'approved', 'retired')),
unique (tenant_id, id),
unique (tenant_id, program_id, version),
foreign key (tenant_id, program_id)
references registrar.programs(tenant_id, id)
);
create table registrar.student_programs (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
student_id uuid not null,
program_version_id uuid not null,
state text not null
check (state in ('active', 'completed', 'withdrawn')),
starts_on date not null,
ends_on date,
check (ends_on is null or ends_on >= starts_on),
foreign key (tenant_id, student_id)
references registrar.students(tenant_id, id),
foreign key (tenant_id, program_version_id)
references registrar.program_versions(tenant_id, id)
);
create table registrar.sections (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
term_id uuid not null,
course_version_id uuid not null,
section_code text not null,
capacity integer not null check (capacity >= 0),
enrolled_count integer not null default 0,
state text not null
check (state in ('draft', 'open', 'closed', 'cancelled')),
version bigint not null default 1,
check (
enrolled_count >= 0
and enrolled_count <= capacity
),
unique (tenant_id, id),
unique (tenant_id, term_id, section_code),
foreign key (tenant_id, term_id)
references registrar.terms(tenant_id, id),
foreign key (tenant_id, course_version_id)
references registrar.course_versions(tenant_id, id)
);
create table registrar.registration_requests (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
student_id uuid not null,
section_id uuid not null,
action text not null
check (action in ('add', 'drop', 'withdraw')),
state text not null
check (state in (
'submitted', 'evaluating', 'needs_approval',
'accepted', 'rejected', 'cancelled'
)),
idempotency_key text not null,
policy_version text not null,
decision_code text,
created_at timestamptz not null default now(),
decided_at timestamptz,
unique (tenant_id, id),
unique (tenant_id, student_id, idempotency_key),
foreign key (tenant_id, student_id)
references registrar.students(tenant_id, id),
foreign key (tenant_id, section_id)
references registrar.sections(tenant_id, id)
);
create table registrar.enrollments (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
student_id uuid not null,
section_id uuid not null,
state text not null
check (state in (
'enrolled', 'dropped', 'withdrawn', 'completed'
)),
credits numeric(5,2) not null check (credits >= 0),
version bigint not null default 1,
created_at timestamptz not null default now(),
unique (tenant_id, id),
unique (tenant_id, student_id, section_id),
foreign key (tenant_id, student_id)
references registrar.students(tenant_id, id),
foreign key (tenant_id, section_id)
references registrar.sections(tenant_id, id)
);
create table registrar.enrollment_events (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
enrollment_id uuid not null,
actor_user_id uuid references iam.users(id),
event_type text not null,
policy_version text not null,
occurred_at timestamptz not null default now(),
safe_metadata jsonb not null default '{}'::jsonb,
foreign key (tenant_id, enrollment_id)
references registrar.enrollments(tenant_id, id)
);
create table registrar.released_grades (
id uuid primary key default gen_random_uuid(),
tenant_id uuid not null,
enrollment_id uuid not null,
revision integer not null check (revision > 0),
grade_code text not null,
grade_scale_version text not null,
released_at timestamptz not null,
supersedes_grade_id uuid,
unique (tenant_id, id),
unique (tenant_id, enrollment_id, revision),
foreign key (tenant_id, enrollment_id)
references registrar.enrollments(tenant_id, id),
foreign key (tenant_id, supersedes_grade_id)
references registrar.released_grades(tenant_id, id)
);
create index enrollments_student
on registrar.enrollments(tenant_id, student_id, state);
create index enrollment_events_history
on registrar.enrollment_events(
tenant_id, enrollment_id, occurred_at
);
create index registration_pending
on registrar.registration_requests(
tenant_id, state, created_at
);
alter table registrar.students enable row level security;
alter table registrar.students force row level security;
alter table registrar.terms enable row level security;
alter table registrar.terms force row level security;
alter table registrar.courses enable row level security;
alter table registrar.courses force row level security;
alter table registrar.course_versions enable row level security;
alter table registrar.course_versions force row level security;
alter table registrar.programs enable row level security;
alter table registrar.programs force row level security;
alter table registrar.program_versions enable row level security;
alter table registrar.program_versions force row level security;
alter table registrar.student_programs enable row level security;
alter table registrar.student_programs force row level security;
alter table registrar.sections enable row level security;
alter table registrar.sections force row level security;
alter table registrar.registration_requests enable row level security;
alter table registrar.registration_requests force row level security;
alter table registrar.enrollments enable row level security;
alter table registrar.enrollments force row level security;
alter table registrar.enrollment_events enable row level security;
alter table registrar.enrollment_events force row level security;
alter table registrar.released_grades enable row level security;
alter table registrar.released_grades force row level security;
revoke all on all tables in schema registrar
from public, semester_api;
grant select on
registrar.students,
registrar.enrollments,
registrar.registration_requests,
registrar.released_grades
to semester_api;
create policy students_read_self
on registrar.students
for select to semester_api
using (
tenant_id = iam.current_tenant_id()
and user_id = iam.current_user_id()
and iam.is_active_member(tenant_id)
);
create policy enrollments_read_self
on registrar.enrollments
for select to semester_api
using (
tenant_id = iam.current_tenant_id()
and iam.is_active_member(tenant_id)
and exists (
select 1
from registrar.students s
where s.tenant_id = enrollments.tenant_id
and s.id = enrollments.student_id
and s.user_id = iam.current_user_id()
)
);
create policy requests_read_self
on registrar.registration_requests
for select to semester_api
using (
tenant_id = iam.current_tenant_id()
and iam.is_active_member(tenant_id)
and exists (
select 1
from registrar.students s
where s.tenant_id = registration_requests.tenant_id
and s.id = registration_requests.student_id
and s.user_id = iam.current_user_id()
)
);
create policy released_grades_read_self
on registrar.released_grades
for select to semester_api
using (
tenant_id = iam.current_tenant_id()
and iam.is_active_member(tenant_id)
and exists (
select 1
from registrar.enrollments e
where e.tenant_id = released_grades.tenant_id
and e.id = released_grades.enrollment_id
)
);
commit;
