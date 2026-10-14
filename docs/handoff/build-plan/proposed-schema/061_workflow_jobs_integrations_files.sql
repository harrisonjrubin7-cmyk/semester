-- 061_workflow_jobs_integrations_files.sql — PROPOSED, tables 61–90 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

-- 61
create table if not exists semester_core.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.workflow_definitions enable row level security;
alter table semester_core.workflow_definitions force row level security;
create index if not exists workflow_definitions_tenant_idx on semester_core.workflow_definitions (tenant_id);

-- 62
create table if not exists semester_core.workflow_instances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.workflow_instances enable row level security;
alter table semester_core.workflow_instances force row level security;
create index if not exists workflow_instances_tenant_idx on semester_core.workflow_instances (tenant_id);

-- 63
create table if not exists semester_core.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.workflow_steps enable row level security;
alter table semester_core.workflow_steps force row level security;
create index if not exists workflow_steps_tenant_idx on semester_core.workflow_steps (tenant_id);

-- 64
create table if not exists semester_core.workflow_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.workflow_receipts enable row level security;
alter table semester_core.workflow_receipts force row level security;
create index if not exists workflow_receipts_tenant_idx on semester_core.workflow_receipts (tenant_id);

-- 65
create table if not exists semester_core.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.jobs enable row level security;
alter table semester_core.jobs force row level security;
create index if not exists jobs_tenant_idx on semester_core.jobs (tenant_id);

-- 66
create table if not exists semester_core.job_leases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.job_leases enable row level security;
alter table semester_core.job_leases force row level security;
create index if not exists job_leases_tenant_idx on semester_core.job_leases (tenant_id);

-- 67
create table if not exists semester_core.job_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.job_attempts enable row level security;
alter table semester_core.job_attempts force row level security;
create index if not exists job_attempts_tenant_idx on semester_core.job_attempts (tenant_id);

-- 68
create table if not exists semester_core.dead_letters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.dead_letters enable row level security;
alter table semester_core.dead_letters force row level security;
create index if not exists dead_letters_tenant_idx on semester_core.dead_letters (tenant_id);

-- 69
create table if not exists semester_core.outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.outbox_events enable row level security;
alter table semester_core.outbox_events force row level security;
create index if not exists outbox_events_tenant_idx on semester_core.outbox_events (tenant_id);

-- 70
create table if not exists semester_core.inbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.inbox_events enable row level security;
alter table semester_core.inbox_events force row level security;
create index if not exists inbox_events_tenant_idx on semester_core.inbox_events (tenant_id);

-- 71
create table if not exists semester_core.event_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.event_deliveries enable row level security;
alter table semester_core.event_deliveries force row level security;
create index if not exists event_deliveries_tenant_idx on semester_core.event_deliveries (tenant_id);

-- 72
create table if not exists semester_core.integration_providers (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.integration_providers enable row level security;
alter table semester_core.integration_providers force row level security;

-- 73
create table if not exists semester_core.integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.integrations enable row level security;
alter table semester_core.integrations force row level security;
create index if not exists integrations_tenant_idx on semester_core.integrations (tenant_id);

-- 74
create table if not exists semester_core.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.integration_credentials enable row level security;
alter table semester_core.integration_credentials force row level security;
create index if not exists integration_credentials_tenant_idx on semester_core.integration_credentials (tenant_id);

-- 75
create table if not exists semester_core.integration_sync_runs (
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
alter table semester_core.integration_sync_runs enable row level security;
alter table semester_core.integration_sync_runs force row level security;
create index if not exists integration_sync_runs_tenant_idx on semester_core.integration_sync_runs (tenant_id);

-- 76
create table if not exists semester_core.integration_mappings (
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
alter table semester_core.integration_mappings enable row level security;
alter table semester_core.integration_mappings force row level security;
create index if not exists integration_mappings_tenant_idx on semester_core.integration_mappings (tenant_id);

-- 77
create table if not exists semester_core.freshness_snapshots (
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
alter table semester_core.freshness_snapshots enable row level security;
alter table semester_core.freshness_snapshots force row level security;
create index if not exists freshness_snapshots_tenant_idx on semester_core.freshness_snapshots (tenant_id);

-- 78
create table if not exists semester_core.reconciliation_cases (
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
alter table semester_core.reconciliation_cases enable row level security;
alter table semester_core.reconciliation_cases force row level security;
create index if not exists reconciliation_cases_tenant_idx on semester_core.reconciliation_cases (tenant_id);

-- 79
create table if not exists semester_core.reconciliation_items (
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
alter table semester_core.reconciliation_items enable row level security;
alter table semester_core.reconciliation_items force row level security;
create index if not exists reconciliation_items_tenant_idx on semester_core.reconciliation_items (tenant_id);

-- 80
create table if not exists semester_core.files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.files enable row level security;
alter table semester_core.files force row level security;
create index if not exists files_tenant_idx on semester_core.files (tenant_id);

-- 81
create table if not exists semester_core.file_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.file_versions enable row level security;
alter table semester_core.file_versions force row level security;
create index if not exists file_versions_tenant_idx on semester_core.file_versions (tenant_id);

-- 82
create table if not exists semester_core.file_access_logs (
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
alter table semester_core.file_access_logs enable row level security;
alter table semester_core.file_access_logs force row level security;
create index if not exists file_access_logs_tenant_idx on semester_core.file_access_logs (tenant_id);

-- 83
create table if not exists semester_core.uploads (
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
alter table semester_core.uploads enable row level security;
alter table semester_core.uploads force row level security;
create index if not exists uploads_tenant_idx on semester_core.uploads (tenant_id);

-- 84
create table if not exists semester_core.storage_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.storage_locations enable row level security;
alter table semester_core.storage_locations force row level security;
create index if not exists storage_locations_tenant_idx on semester_core.storage_locations (tenant_id);

-- 85
create table if not exists semester_core.search_indices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.search_indices enable row level security;
alter table semester_core.search_indices force row level security;
create index if not exists search_indices_tenant_idx on semester_core.search_indices (tenant_id);

-- 86
create table if not exists semester_core.search_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.search_documents enable row level security;
alter table semester_core.search_documents force row level security;
create index if not exists search_documents_tenant_idx on semester_core.search_documents (tenant_id);

-- 87
create table if not exists semester_core.notifications (
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
alter table semester_core.notifications enable row level security;
alter table semester_core.notifications force row level security;
create index if not exists notifications_tenant_idx on semester_core.notifications (tenant_id);

-- 88
create table if not exists semester_core.notification_deliveries (
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
alter table semester_core.notification_deliveries enable row level security;
alter table semester_core.notification_deliveries force row level security;
create index if not exists notification_deliveries_tenant_idx on semester_core.notification_deliveries (tenant_id);

-- 89
create table if not exists semester_core.templates_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.templates_messages enable row level security;
alter table semester_core.templates_messages force row level security;
create index if not exists templates_messages_tenant_idx on semester_core.templates_messages (tenant_id);

-- 90
create table if not exists semester_core.webhooks_outbound (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.webhooks_outbound enable row level security;
alter table semester_core.webhooks_outbound force row level security;
create index if not exists webhooks_outbound_tenant_idx on semester_core.webhooks_outbound (tenant_id);

