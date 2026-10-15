-- 151_finance_campus_admissions_career.sql — PROPOSED, tables 151–180 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

-- 151
create table if not exists semester_core.billing_accounts (
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
alter table semester_core.billing_accounts enable row level security;
alter table semester_core.billing_accounts force row level security;
create index if not exists billing_accounts_tenant_idx on semester_core.billing_accounts (tenant_id);

-- 152
create table if not exists semester_core.invoice_refs (
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
alter table semester_core.invoice_refs enable row level security;
alter table semester_core.invoice_refs force row level security;
create index if not exists invoice_refs_tenant_idx on semester_core.invoice_refs (tenant_id);

-- 153
create table if not exists semester_core.payment_intents (
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
alter table semester_core.payment_intents enable row level security;
alter table semester_core.payment_intents force row level security;
create index if not exists payment_intents_tenant_idx on semester_core.payment_intents (tenant_id);

-- 154
create table if not exists semester_core.payment_receipts (
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
alter table semester_core.payment_receipts enable row level security;
alter table semester_core.payment_receipts force row level security;
create index if not exists payment_receipts_tenant_idx on semester_core.payment_receipts (tenant_id);

-- 155
create table if not exists semester_core.refunds (
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
alter table semester_core.refunds enable row level security;
alter table semester_core.refunds force row level security;
create index if not exists refunds_tenant_idx on semester_core.refunds (tenant_id);

-- 156
create table if not exists semester_core.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ledger_entries enable row level security;
alter table semester_core.ledger_entries force row level security;
create index if not exists ledger_entries_tenant_idx on semester_core.ledger_entries (tenant_id);

-- 157
create table if not exists semester_core.plans_subscriptions (
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
alter table semester_core.plans_subscriptions enable row level security;
alter table semester_core.plans_subscriptions force row level security;
create index if not exists plans_subscriptions_tenant_idx on semester_core.plans_subscriptions (tenant_id);

-- 158
create table if not exists semester_core.financial_aid_refs (
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
alter table semester_core.financial_aid_refs enable row level security;
alter table semester_core.financial_aid_refs force row level security;
create index if not exists financial_aid_refs_tenant_idx on semester_core.financial_aid_refs (tenant_id);

-- 159
create table if not exists semester_core.payment_reconciliation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.payment_reconciliation enable row level security;
alter table semester_core.payment_reconciliation force row level security;
create index if not exists payment_reconciliation_tenant_idx on semester_core.payment_reconciliation (tenant_id);

-- 160
create table if not exists semester_core.housing_refs (
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
alter table semester_core.housing_refs enable row level security;
alter table semester_core.housing_refs force row level security;
create index if not exists housing_refs_tenant_idx on semester_core.housing_refs (tenant_id);

-- 161
create table if not exists semester_core.room_assignments (
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
alter table semester_core.room_assignments enable row level security;
alter table semester_core.room_assignments force row level security;
create index if not exists room_assignments_tenant_idx on semester_core.room_assignments (tenant_id);

-- 162
create table if not exists semester_core.meal_plan_refs (
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
alter table semester_core.meal_plan_refs enable row level security;
alter table semester_core.meal_plan_refs force row level security;
create index if not exists meal_plan_refs_tenant_idx on semester_core.meal_plan_refs (tenant_id);

-- 163
create table if not exists semester_core.dining_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.dining_locations enable row level security;
alter table semester_core.dining_locations force row level security;
create index if not exists dining_locations_tenant_idx on semester_core.dining_locations (tenant_id);

-- 164
create table if not exists semester_core.library_refs (
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
alter table semester_core.library_refs enable row level security;
alter table semester_core.library_refs force row level security;
create index if not exists library_refs_tenant_idx on semester_core.library_refs (tenant_id);

-- 165
create table if not exists semester_core.campus_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.campus_events enable row level security;
alter table semester_core.campus_events force row level security;
create index if not exists campus_events_tenant_idx on semester_core.campus_events (tenant_id);

-- 166
create table if not exists semester_core.activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.activities enable row level security;
alter table semester_core.activities force row level security;
create index if not exists activities_tenant_idx on semester_core.activities (tenant_id);

-- 167
create table if not exists semester_core.service_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.service_requests enable row level security;
alter table semester_core.service_requests force row level security;
create index if not exists service_requests_tenant_idx on semester_core.service_requests (tenant_id);

-- 168
create table if not exists semester_core.applicants (
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
alter table semester_core.applicants enable row level security;
alter table semester_core.applicants force row level security;
create index if not exists applicants_tenant_idx on semester_core.applicants (tenant_id);

-- 169
create table if not exists semester_core.applications (
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
alter table semester_core.applications enable row level security;
alter table semester_core.applications force row level security;
create index if not exists applications_tenant_idx on semester_core.applications (tenant_id);

-- 170
create table if not exists semester_core.application_documents (
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
alter table semester_core.application_documents enable row level security;
alter table semester_core.application_documents force row level security;
create index if not exists application_documents_tenant_idx on semester_core.application_documents (tenant_id);

-- 171
create table if not exists semester_core.decision_letters (
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
alter table semester_core.decision_letters enable row level security;
alter table semester_core.decision_letters force row level security;
create index if not exists decision_letters_tenant_idx on semester_core.decision_letters (tenant_id);

-- 172
create table if not exists semester_core.admit_conversions (
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
alter table semester_core.admit_conversions enable row level security;
alter table semester_core.admit_conversions force row level security;
create index if not exists admit_conversions_tenant_idx on semester_core.admit_conversions (tenant_id);

-- 173
create table if not exists semester_core.employers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.employers enable row level security;
alter table semester_core.employers force row level security;
create index if not exists employers_tenant_idx on semester_core.employers (tenant_id);

-- 174
create table if not exists semester_core.opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.opportunities enable row level security;
alter table semester_core.opportunities force row level security;
create index if not exists opportunities_tenant_idx on semester_core.opportunities (tenant_id);

-- 175
create table if not exists semester_core.applications_career (
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
alter table semester_core.applications_career enable row level security;
alter table semester_core.applications_career force row level security;
create index if not exists applications_career_tenant_idx on semester_core.applications_career (tenant_id);

-- 176
create table if not exists semester_core.career_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.career_events enable row level security;
alter table semester_core.career_events force row level security;
create index if not exists career_events_tenant_idx on semester_core.career_events (tenant_id);

-- 177
create table if not exists semester_core.candidate_consents (
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
alter table semester_core.candidate_consents enable row level security;
alter table semester_core.candidate_consents force row level security;
create index if not exists candidate_consents_tenant_idx on semester_core.candidate_consents (tenant_id);

-- 178
create table if not exists semester_core.recommendation_letters (
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
alter table semester_core.recommendation_letters enable row level security;
alter table semester_core.recommendation_letters force row level security;
create index if not exists recommendation_letters_tenant_idx on semester_core.recommendation_letters (tenant_id);

-- 179
create table if not exists semester_core.nil_profiles (
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
alter table semester_core.nil_profiles enable row level security;
alter table semester_core.nil_profiles force row level security;
create index if not exists nil_profiles_tenant_idx on semester_core.nil_profiles (tenant_id);

-- 180
create table if not exists semester_core.exam_runways (
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
alter table semester_core.exam_runways enable row level security;
alter table semester_core.exam_runways force row level security;
create index if not exists exam_runways_tenant_idx on semester_core.exam_runways (tenant_id);

