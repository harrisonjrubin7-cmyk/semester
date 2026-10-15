-- 060_bespoke_core.sql — PROPOSED bespoke columns for the 20 tables the four connected journeys depend on.
-- Replaces the baseline placeholders for these tables in schema semester_core. Not run.
-- Reconcile each against the repo's existing public tables before promoting; RLS forced, policies follow the
-- student_tasks pattern (auth.uid() -> active membership), never current_setting().

create type semester_core.source_type as enum ('institution_verified','connected','student_entered','estimated','ai_assisted','needs_review');
create type semester_core.record_authority as enum ('institution','semester','student','partner','derived');
create type semester_core.freshness_state as enum ('current','stale','syncing','failed','unknown');

drop table if exists semester_core.memberships, semester_core.grants, semester_core.students, semester_core.student_tasks,
  semester_core.courses, semester_core.sections, semester_core.enrollment_refs, semester_core.assignments,
  semester_core.gradebooks, semester_core.grade_entries, semester_core.grade_release_batches, semester_core.grade_sync_receipts,
  semester_core.holds, semester_core.time_tickets, semester_core.readiness_cases, semester_core.readiness_checks,
  semester_core.registration_requests, semester_core.registration_receipts, semester_core.teaching_assignments,
  semester_core.audit_events cascade;

create table semester_core.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  owner_account_id uuid not null references semester_core.accounts(id) on delete cascade,
  role_key text not null,
  status text not null default 'active' check (status in ('invited','active','suspended','ended')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  source_type semester_core.source_type not null default 'institution_verified',
  source_ref text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (tenant_id, id),
  unique (tenant_id, owner_account_id, role_key),
  check (valid_until is null or valid_until > valid_from)
);

create table semester_core.grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  membership_id uuid not null,
  capability_key text not null check (capability_key ~ '^[a-z_]+(\.[a-z_]+)+$'),
  scope_type text not null default 'tenant' check (scope_type in ('tenant','course','section','caseload','record')),
  scope_id uuid,
  granted_by_account_id uuid references semester_core.accounts(id),
  approval_ref text,
  valid_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, membership_id) references semester_core.memberships (tenant_id, id) on delete cascade,
  unique (tenant_id, id),
  check (scope_type = 'tenant' or scope_id is not null)
);

create table semester_core.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  account_id uuid not null references semester_core.accounts(id) on delete cascade,
  institution_student_ref text,
  preferred_name text,
  academic_level text check (academic_level in ('undergraduate','graduate','professional','non_degree')),
  lifecycle_status text not null default 'active' check (lifecycle_status in ('applicant','admitted','active','leave','withdrawn','graduated')),
  source_type semester_core.source_type not null default 'institution_verified',
  record_authority semester_core.record_authority not null default 'institution',
  source_ref text, observed_at timestamptz,
  freshness_state semester_core.freshness_state not null default 'unknown',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, account_id), unique (tenant_id, institution_student_ref)
);

create table semester_core.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  catalog_code text not null, title text not null, credits numeric(4,1) check (credits >= 0),
  catalog_year text not null,
  source_type semester_core.source_type not null default 'institution_verified',
  record_authority semester_core.record_authority not null default 'institution', source_ref text, observed_at timestamptz,
  freshness_state semester_core.freshness_state not null default 'unknown',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, catalog_code, catalog_year)
);

create table semester_core.sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  course_id uuid not null,
  term_code text not null, section_code text not null,
  capacity int check (capacity >= 0), meeting_pattern text, location text,
  status text not null default 'scheduled' check (status in ('scheduled','open','closed','cancelled')),
  source_type semester_core.source_type not null default 'institution_verified',
  record_authority semester_core.record_authority not null default 'institution', source_ref text, observed_at timestamptz,
  freshness_state semester_core.freshness_state not null default 'unknown',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, course_id) references semester_core.courses (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, term_code, course_id, section_code)
);

create table semester_core.enrollment_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  section_id uuid not null, student_id uuid not null,
  status text not null check (status in ('enrolled','waitlisted','dropped','withdrawn','completed')),
  effective_at timestamptz not null,
  source_type semester_core.source_type not null default 'institution_verified',
  record_authority semester_core.record_authority not null default 'institution', source_ref text not null, observed_at timestamptz not null,
  freshness_state semester_core.freshness_state not null default 'current',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, section_id) references semester_core.sections (tenant_id, id),
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, section_id, student_id)
);

create table semester_core.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  section_id uuid not null, membership_id uuid not null,
  teaching_role text not null check (teaching_role in ('instructor','co_instructor','ta','grader')),
  valid_from timestamptz not null default now(), valid_until timestamptz,
  source_type semester_core.source_type not null default 'institution_verified', source_ref text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, section_id) references semester_core.sections (tenant_id, id),
  foreign key (tenant_id, membership_id) references semester_core.memberships (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, section_id, membership_id, teaching_role)
);

create table semester_core.assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  section_id uuid not null,
  title text not null check (char_length(title) between 1 and 240),
  due_at timestamptz, points_possible numeric(8,2) check (points_possible >= 0),
  category text, version int not null default 1,
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','published','closed','archived')),
  ai_policy text not null default 'course_default' check (ai_policy in ('course_default','allowed','hints_only','prohibited','approval_required')),
  source_type semester_core.source_type not null default 'institution_verified',
  record_authority semester_core.record_authority not null default 'institution', source_ref text, observed_at timestamptz,
  freshness_state semester_core.freshness_state not null default 'unknown',
  created_by_account_id uuid references semester_core.accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, section_id) references semester_core.sections (tenant_id, id),
  unique (tenant_id, id)
);

create table semester_core.student_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  owner_account_id uuid not null references semester_core.accounts(id) on delete cascade,
  student_id uuid not null,
  assignment_id uuid,
  title text not null check (char_length(title) between 1 and 240),
  description text, due_at timestamptz, completed_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','blocked','complete','dismissed')),
  source_type semester_core.source_type not null default 'student_entered', source_ref text,
  freshness_state semester_core.freshness_state not null default 'current',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id) on delete cascade,
  foreign key (tenant_id, assignment_id) references semester_core.assignments (tenant_id, id) on delete set null,
  unique (tenant_id, id),
  check ((status = 'complete') = (completed_at is not null))
);

create table semester_core.gradebooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  section_id uuid not null,
  policy_version int not null default 1,
  weights jsonb not null default '{}'::jsonb,
  letter_scale jsonb not null default '[]'::jsonb,
  rounding text not null default 'none' check (rounding in ('none','half_up','truncate')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, section_id) references semester_core.sections (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, section_id)
);

create table semester_core.grade_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  gradebook_id uuid not null, assignment_id uuid not null, student_id uuid not null,
  score numeric(8,2) check (score >= 0),
  status text not null default 'ungraded' check (status in ('ungraded','graded','excused','missing','late')),
  released boolean not null default false,
  released_at timestamptz,
  version int not null default 1,
  entered_by_account_id uuid references semester_core.accounts(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, gradebook_id) references semester_core.gradebooks (tenant_id, id),
  foreign key (tenant_id, assignment_id) references semester_core.assignments (tenant_id, id),
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, assignment_id, student_id),
  check (released = (released_at is not null)),
  check (not released or status in ('graded','excused')),
  check (status <> 'graded' or score is not null)
);

create table semester_core.grade_release_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  gradebook_id uuid not null,
  kind text not null check (kind in ('item_release','final_grades')),
  status text not null default 'draft' check (status in ('draft','submitted','approved','sent','accepted','rejected')),
  submitted_by_account_id uuid references semester_core.accounts(id),
  approved_by_account_id uuid references semester_core.accounts(id),
  idempotency_key text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, gradebook_id) references semester_core.gradebooks (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, idempotency_key),
  check (approved_by_account_id is null or approved_by_account_id <> submitted_by_account_id)
);

create table semester_core.grade_sync_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  batch_id uuid not null,
  outcome text not null check (outcome in ('accepted','rejected','unknown','reconciled')),
  source_ref text, source_message text, observed_at timestamptz not null default now(),
  foreign key (tenant_id, batch_id) references semester_core.grade_release_batches (tenant_id, id),
  unique (tenant_id, id)
);

create table semester_core.holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  student_id uuid not null,
  hold_type text not null, owning_office text not null,
  blocks text[] not null default '{registration}',
  status text not null default 'active' check (status in ('active','released','expired')),
  placed_at timestamptz not null, released_at timestamptz, release_reason text,
  source_type semester_core.source_type not null default 'institution_verified',
  record_authority semester_core.record_authority not null default 'institution', source_ref text not null, observed_at timestamptz not null,
  freshness_state semester_core.freshness_state not null default 'current',
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id),
  unique (tenant_id, id),
  check ((status = 'released') = (released_at is not null and release_reason is not null))
);

create table semester_core.time_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  student_id uuid not null, term_code text not null,
  opens_at timestamptz not null, closes_at timestamptz,
  source_type semester_core.source_type not null default 'institution_verified',
  record_authority semester_core.record_authority not null default 'institution', source_ref text not null, observed_at timestamptz not null,
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, student_id, term_code),
  check (closes_at is null or closes_at > opens_at)
);

create table semester_core.readiness_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  student_id uuid not null, term_code text not null,
  state text not null default 'unknown' check (state in ('ready','not_ready','unknown')),
  evaluated_at timestamptz,
  rule_version text,
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, student_id, term_code)
);

create table semester_core.readiness_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  case_id uuid not null,
  check_type text not null check (check_type in ('hold','prerequisite','time_ticket','plan_approval','balance')),
  result text not null check (result in ('satisfied','not_satisfied','unknown')),
  explanation text not null,
  evidence_ref text,
  evaluated_at timestamptz not null default now(),
  foreign key (tenant_id, case_id) references semester_core.readiness_cases (tenant_id, id) on delete cascade,
  unique (tenant_id, id)
);

create table semester_core.registration_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  student_id uuid not null, section_id uuid not null, term_code text not null,
  action text not null check (action in ('add','drop','swap','waitlist')),
  status text not null default 'pending' check (status in ('pending','sent','accepted','rejected','unknown','cancelled')),
  requested_by_account_id uuid not null references semester_core.accounts(id),
  idempotency_key text not null,
  payload_hash text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (tenant_id, student_id) references semester_core.students (tenant_id, id),
  foreign key (tenant_id, section_id) references semester_core.sections (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, requested_by_account_id, idempotency_key)
);

create table semester_core.registration_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id) on delete cascade,
  request_id uuid not null,
  outcome text not null check (outcome in ('accepted','rejected','unknown','reconciled')),
  source_ref text, source_message text,
  observed_at timestamptz not null default now(),
  foreign key (tenant_id, request_id) references semester_core.registration_requests (tenant_id, id),
  unique (tenant_id, id)
);

create table semester_core.audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid references semester_core.tenants(id),
  actor_account_id uuid references semester_core.accounts(id),
  event_type text not null check (event_type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  entity_type text not null, entity_id text not null,
  policy_decision_ref text, approval_ref text, correlation_id uuid not null,
  occurred_at timestamptz not null default now()
);
-- append-only: no update/delete for anyone, including authenticated
revoke update, delete, truncate on semester_core.audit_events from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['memberships','grants','students','courses','sections','enrollment_refs','teaching_assignments','assignments','student_tasks','gradebooks','grade_entries','grade_release_batches','grade_sync_receipts','holds','time_tickets','readiness_cases','readiness_checks','registration_requests','registration_receipts','audit_events'] loop
    execute format('alter table semester_core.%I enable row level security', t);
    execute format('alter table semester_core.%I force row level security', t);
  end loop;
end $$;

create index on semester_core.student_tasks (tenant_id, owner_account_id, due_at) where status in ('open','in_progress','blocked');
create index on semester_core.grade_entries (tenant_id, student_id) where released;
create index on semester_core.holds (tenant_id, student_id) where status = 'active';
create index on semester_core.audit_events (tenant_id, occurred_at desc);
create index on semester_core.grants (tenant_id, membership_id) where revoked_at is null;
