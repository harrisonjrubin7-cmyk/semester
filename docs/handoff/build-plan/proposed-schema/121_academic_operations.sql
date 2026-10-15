-- 121_academic_operations.sql — PROPOSED, tables 121–150 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

-- 121
create table if not exists semester_core.gradebooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.gradebooks enable row level security;
alter table semester_core.gradebooks force row level security;
create index if not exists gradebooks_tenant_idx on semester_core.gradebooks (tenant_id);

-- 122
create table if not exists semester_core.grade_entries (
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
alter table semester_core.grade_entries enable row level security;
alter table semester_core.grade_entries force row level security;
create index if not exists grade_entries_tenant_idx on semester_core.grade_entries (tenant_id);

-- 123
create table if not exists semester_core.grade_drafts (
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
alter table semester_core.grade_drafts enable row level security;
alter table semester_core.grade_drafts force row level security;
create index if not exists grade_drafts_tenant_idx on semester_core.grade_drafts (tenant_id);

-- 124
create table if not exists semester_core.grade_release_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.grade_release_batches enable row level security;
alter table semester_core.grade_release_batches force row level security;
create index if not exists grade_release_batches_tenant_idx on semester_core.grade_release_batches (tenant_id);

-- 125
create table if not exists semester_core.grade_sync_receipts (
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
alter table semester_core.grade_sync_receipts enable row level security;
alter table semester_core.grade_sync_receipts force row level security;
create index if not exists grade_sync_receipts_tenant_idx on semester_core.grade_sync_receipts (tenant_id);

-- 126
create table if not exists semester_core.degree_programs (
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
alter table semester_core.degree_programs enable row level security;
alter table semester_core.degree_programs force row level security;
create index if not exists degree_programs_tenant_idx on semester_core.degree_programs (tenant_id);

-- 127
create table if not exists semester_core.degree_requirements (
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
alter table semester_core.degree_requirements enable row level security;
alter table semester_core.degree_requirements force row level security;
create index if not exists degree_requirements_tenant_idx on semester_core.degree_requirements (tenant_id);

-- 128
create table if not exists semester_core.degree_audits (
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
alter table semester_core.degree_audits enable row level security;
alter table semester_core.degree_audits force row level security;
create index if not exists degree_audits_tenant_idx on semester_core.degree_audits (tenant_id);

-- 129
create table if not exists semester_core.what_if_plans (
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
alter table semester_core.what_if_plans enable row level security;
alter table semester_core.what_if_plans force row level security;
create index if not exists what_if_plans_tenant_idx on semester_core.what_if_plans (tenant_id);

-- 130
create table if not exists semester_core.advising_caseloads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.advising_caseloads enable row level security;
alter table semester_core.advising_caseloads force row level security;
create index if not exists advising_caseloads_tenant_idx on semester_core.advising_caseloads (tenant_id);

-- 131
create table if not exists semester_core.advising_assignments (
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
alter table semester_core.advising_assignments enable row level security;
alter table semester_core.advising_assignments force row level security;
create index if not exists advising_assignments_tenant_idx on semester_core.advising_assignments (tenant_id);

-- 132
create table if not exists semester_core.appointments (
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
alter table semester_core.appointments enable row level security;
alter table semester_core.appointments force row level security;
create index if not exists appointments_tenant_idx on semester_core.appointments (tenant_id);

-- 133
create table if not exists semester_core.success_plans (
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
alter table semester_core.success_plans enable row level security;
alter table semester_core.success_plans force row level security;
create index if not exists success_plans_tenant_idx on semester_core.success_plans (tenant_id);

-- 134
create table if not exists semester_core.referrals (
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
alter table semester_core.referrals enable row level security;
alter table semester_core.referrals force row level security;
create index if not exists referrals_tenant_idx on semester_core.referrals (tenant_id);

-- 135
create table if not exists semester_core.support_cases (
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
alter table semester_core.support_cases enable row level security;
alter table semester_core.support_cases force row level security;
create index if not exists support_cases_tenant_idx on semester_core.support_cases (tenant_id);

-- 136
create table if not exists semester_core.support_case_updates (
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
alter table semester_core.support_case_updates enable row level security;
alter table semester_core.support_case_updates force row level security;
create index if not exists support_case_updates_tenant_idx on semester_core.support_case_updates (tenant_id);

-- 137
create table if not exists semester_core.readiness_cases (
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
alter table semester_core.readiness_cases enable row level security;
alter table semester_core.readiness_cases force row level security;
create index if not exists readiness_cases_tenant_idx on semester_core.readiness_cases (tenant_id);

-- 138
create table if not exists semester_core.readiness_checks (
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
alter table semester_core.readiness_checks enable row level security;
alter table semester_core.readiness_checks force row level security;
create index if not exists readiness_checks_tenant_idx on semester_core.readiness_checks (tenant_id);

-- 139
create table if not exists semester_core.holds (
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
alter table semester_core.holds enable row level security;
alter table semester_core.holds force row level security;
create index if not exists holds_tenant_idx on semester_core.holds (tenant_id);

-- 140
create table if not exists semester_core.override_requests (
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
alter table semester_core.override_requests enable row level security;
alter table semester_core.override_requests force row level security;
create index if not exists override_requests_tenant_idx on semester_core.override_requests (tenant_id);

-- 141
create table if not exists semester_core.time_tickets (
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
alter table semester_core.time_tickets enable row level security;
alter table semester_core.time_tickets force row level security;
create index if not exists time_tickets_tenant_idx on semester_core.time_tickets (tenant_id);

-- 142
create table if not exists semester_core.registration_requests (
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
alter table semester_core.registration_requests enable row level security;
alter table semester_core.registration_requests force row level security;
create index if not exists registration_requests_tenant_idx on semester_core.registration_requests (tenant_id);

-- 143
create table if not exists semester_core.registration_receipts (
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
alter table semester_core.registration_receipts enable row level security;
alter table semester_core.registration_receipts force row level security;
create index if not exists registration_receipts_tenant_idx on semester_core.registration_receipts (tenant_id);

-- 144
create table if not exists semester_core.faculty_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.faculty_profiles enable row level security;
alter table semester_core.faculty_profiles force row level security;
create index if not exists faculty_profiles_tenant_idx on semester_core.faculty_profiles (tenant_id);

-- 145
create table if not exists semester_core.teaching_assignments (
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
alter table semester_core.teaching_assignments enable row level security;
alter table semester_core.teaching_assignments force row level security;
create index if not exists teaching_assignments_tenant_idx on semester_core.teaching_assignments (tenant_id);

-- 146
create table if not exists semester_core.rubrics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.rubrics enable row level security;
alter table semester_core.rubrics force row level security;
create index if not exists rubrics_tenant_idx on semester_core.rubrics (tenant_id);

-- 147
create table if not exists semester_core.rubric_rows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.rubric_rows enable row level security;
alter table semester_core.rubric_rows force row level security;
create index if not exists rubric_rows_tenant_idx on semester_core.rubric_rows (tenant_id);

-- 148
create table if not exists semester_core.accommodations_refs (
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
alter table semester_core.accommodations_refs enable row level security;
alter table semester_core.accommodations_refs force row level security;
create index if not exists accommodations_refs_tenant_idx on semester_core.accommodations_refs (tenant_id);

-- 149
create table if not exists semester_core.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.outreach_campaigns enable row level security;
alter table semester_core.outreach_campaigns force row level security;
create index if not exists outreach_campaigns_tenant_idx on semester_core.outreach_campaigns (tenant_id);

-- 150
create table if not exists semester_core.outreach_messages (
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
alter table semester_core.outreach_messages enable row level security;
alter table semester_core.outreach_messages force row level security;
create index if not exists outreach_messages_tenant_idx on semester_core.outreach_messages (tenant_id);

