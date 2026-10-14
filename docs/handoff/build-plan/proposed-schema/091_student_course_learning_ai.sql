-- 091_student_course_learning_ai.sql — PROPOSED, tables 91–120 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

-- 91
create table if not exists semester_core.students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.students enable row level security;
alter table semester_core.students force row level security;
create index if not exists students_tenant_idx on semester_core.students (tenant_id);

-- 92
create table if not exists semester_core.student_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.student_profiles enable row level security;
alter table semester_core.student_profiles force row level security;
create index if not exists student_profiles_tenant_idx on semester_core.student_profiles (tenant_id);

-- 93
create table if not exists semester_core.student_goals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.student_goals enable row level security;
alter table semester_core.student_goals force row level security;
create index if not exists student_goals_tenant_idx on semester_core.student_goals (tenant_id);

-- 94
create table if not exists semester_core.student_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.student_tasks enable row level security;
alter table semester_core.student_tasks force row level security;
create index if not exists student_tasks_tenant_idx on semester_core.student_tasks (tenant_id);

-- 95
create table if not exists semester_core.student_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.student_checklists enable row level security;
alter table semester_core.student_checklists force row level security;
create index if not exists student_checklists_tenant_idx on semester_core.student_checklists (tenant_id);

-- 96
create table if not exists semester_core.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  source_type text not null default 'native' check (source_type in ('native','connected','imported','derived','student_entered','ai_assisted')),
  source_ref text,
  source_version text,
  source_observed_at timestamptz,
  source_updated_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.calendar_sources enable row level security;
alter table semester_core.calendar_sources force row level security;
create index if not exists calendar_sources_tenant_idx on semester_core.calendar_sources (tenant_id);

-- 97
create table if not exists semester_core.calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  source_type text not null default 'native' check (source_type in ('native','connected','imported','derived','student_entered','ai_assisted')),
  source_ref text,
  source_version text,
  source_observed_at timestamptz,
  source_updated_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.calendar_events enable row level security;
alter table semester_core.calendar_events force row level security;
create index if not exists calendar_events_tenant_idx on semester_core.calendar_events (tenant_id);

-- 98
create table if not exists semester_core.calendar_conflicts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.calendar_conflicts enable row level security;
alter table semester_core.calendar_conflicts force row level security;
create index if not exists calendar_conflicts_tenant_idx on semester_core.calendar_conflicts (tenant_id);

-- 99
create table if not exists semester_core.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  source_type text not null default 'native' check (source_type in ('native','connected','imported','derived','student_entered','ai_assisted')),
  source_ref text,
  source_version text,
  source_observed_at timestamptz,
  source_updated_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.courses enable row level security;
alter table semester_core.courses force row level security;
create index if not exists courses_tenant_idx on semester_core.courses (tenant_id);

-- 100
create table if not exists semester_core.course_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.course_memberships enable row level security;
alter table semester_core.course_memberships force row level security;
create index if not exists course_memberships_tenant_idx on semester_core.course_memberships (tenant_id);

-- 101
create table if not exists semester_core.course_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.course_policies enable row level security;
alter table semester_core.course_policies force row level security;
create index if not exists course_policies_tenant_idx on semester_core.course_policies (tenant_id);

-- 102
create table if not exists semester_core.sections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  source_type text not null default 'native' check (source_type in ('native','connected','imported','derived','student_entered','ai_assisted')),
  source_ref text,
  source_version text,
  source_observed_at timestamptz,
  source_updated_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.sections enable row level security;
alter table semester_core.sections force row level security;
create index if not exists sections_tenant_idx on semester_core.sections (tenant_id);

-- 103
create table if not exists semester_core.enrollment_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  source_type text not null default 'native' check (source_type in ('native','connected','imported','derived','student_entered','ai_assisted')),
  source_ref text,
  source_version text,
  source_observed_at timestamptz,
  source_updated_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.enrollment_refs enable row level security;
alter table semester_core.enrollment_refs force row level security;
create index if not exists enrollment_refs_tenant_idx on semester_core.enrollment_refs (tenant_id);

-- 104
create table if not exists semester_core.assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.assignments enable row level security;
alter table semester_core.assignments force row level security;
create index if not exists assignments_tenant_idx on semester_core.assignments (tenant_id);

-- 105
create table if not exists semester_core.assignment_refs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  source_type text not null default 'native' check (source_type in ('native','connected','imported','derived','student_entered','ai_assisted')),
  source_ref text,
  source_version text,
  source_observed_at timestamptz,
  source_updated_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.assignment_refs enable row level security;
alter table semester_core.assignment_refs force row level security;
create index if not exists assignment_refs_tenant_idx on semester_core.assignment_refs (tenant_id);

-- 106
create table if not exists semester_core.study_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.study_assets enable row level security;
alter table semester_core.study_assets force row level security;
create index if not exists study_assets_tenant_idx on semester_core.study_assets (tenant_id);

-- 107
create table if not exists semester_core.study_asset_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.study_asset_versions enable row level security;
alter table semester_core.study_asset_versions force row level security;
create index if not exists study_asset_versions_tenant_idx on semester_core.study_asset_versions (tenant_id);

-- 108
create table if not exists semester_core.study_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.study_sessions enable row level security;
alter table semester_core.study_sessions force row level security;
create index if not exists study_sessions_tenant_idx on semester_core.study_sessions (tenant_id);

-- 109
create table if not exists semester_core.notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.notes enable row level security;
alter table semester_core.notes force row level security;
create index if not exists notes_tenant_idx on semester_core.notes (tenant_id);

-- 110
create table if not exists semester_core.flashcards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.flashcards enable row level security;
alter table semester_core.flashcards force row level security;
create index if not exists flashcards_tenant_idx on semester_core.flashcards (tenant_id);

-- 111
create table if not exists semester_core.quizzes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.quizzes enable row level security;
alter table semester_core.quizzes force row level security;
create index if not exists quizzes_tenant_idx on semester_core.quizzes (tenant_id);

-- 112
create table if not exists semester_core.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.quiz_attempts enable row level security;
alter table semester_core.quiz_attempts force row level security;
create index if not exists quiz_attempts_tenant_idx on semester_core.quiz_attempts (tenant_id);

-- 113
create table if not exists semester_core.source_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.source_documents enable row level security;
alter table semester_core.source_documents force row level security;
create index if not exists source_documents_tenant_idx on semester_core.source_documents (tenant_id);

-- 114
create table if not exists semester_core.source_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.source_chunks enable row level security;
alter table semester_core.source_chunks force row level security;
create index if not exists source_chunks_tenant_idx on semester_core.source_chunks (tenant_id);

-- 115
create table if not exists semester_core.citations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.citations enable row level security;
alter table semester_core.citations force row level security;
create index if not exists citations_tenant_idx on semester_core.citations (tenant_id);

-- 116
create table if not exists semester_core.source_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.source_reviews enable row level security;
alter table semester_core.source_reviews force row level security;
create index if not exists source_reviews_tenant_idx on semester_core.source_reviews (tenant_id);

-- 117
create table if not exists semester_core.ask_threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ask_threads enable row level security;
alter table semester_core.ask_threads force row level security;
create index if not exists ask_threads_tenant_idx on semester_core.ask_threads (tenant_id);

-- 118
create table if not exists semester_core.ask_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ask_messages enable row level security;
alter table semester_core.ask_messages force row level security;
create index if not exists ask_messages_tenant_idx on semester_core.ask_messages (tenant_id);

-- 119
create table if not exists semester_core.ai_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ai_requests enable row level security;
alter table semester_core.ai_requests force row level security;
create index if not exists ai_requests_tenant_idx on semester_core.ai_requests (tenant_id);

-- 120
create table if not exists semester_core.ai_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ai_responses enable row level security;
alter table semester_core.ai_responses force row level security;
create index if not exists ai_responses_tenant_idx on semester_core.ai_responses (tenant_id);

