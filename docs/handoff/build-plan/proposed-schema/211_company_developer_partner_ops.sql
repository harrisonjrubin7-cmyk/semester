-- 211_company_developer_partner_ops.sql — PROPOSED, tables 211–227 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

-- 211
create table if not exists semester_core.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.vendors enable row level security;
alter table semester_core.vendors force row level security;
create index if not exists vendors_tenant_idx on semester_core.vendors (tenant_id);

-- 212
create table if not exists semester_core.vendor_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.vendor_reviews enable row level security;
alter table semester_core.vendor_reviews force row level security;
create index if not exists vendor_reviews_tenant_idx on semester_core.vendor_reviews (tenant_id);

-- 213
create table if not exists semester_core.employees (
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
alter table semester_core.employees enable row level security;
alter table semester_core.employees force row level security;
create index if not exists employees_tenant_idx on semester_core.employees (tenant_id);

-- 214
create table if not exists semester_core.candidates_hiring (
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
alter table semester_core.candidates_hiring enable row level security;
alter table semester_core.candidates_hiring force row level security;
create index if not exists candidates_hiring_tenant_idx on semester_core.candidates_hiring (tenant_id);

-- 215
create table if not exists semester_core.board_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.board_reports enable row level security;
alter table semester_core.board_reports force row level security;
create index if not exists board_reports_tenant_idx on semester_core.board_reports (tenant_id);

-- 216
create table if not exists semester_core.developer_orgs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.developer_orgs enable row level security;
alter table semester_core.developer_orgs force row level security;
create index if not exists developer_orgs_tenant_idx on semester_core.developer_orgs (tenant_id);

-- 217
create table if not exists semester_core.developer_apps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.developer_apps enable row level security;
alter table semester_core.developer_apps force row level security;
create index if not exists developer_apps_tenant_idx on semester_core.developer_apps (tenant_id);

-- 218
create table if not exists semester_core.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.api_keys enable row level security;
alter table semester_core.api_keys force row level security;
create index if not exists api_keys_tenant_idx on semester_core.api_keys (tenant_id);

-- 219
create table if not exists semester_core.scope_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.scope_grants enable row level security;
alter table semester_core.scope_grants force row level security;
create index if not exists scope_grants_tenant_idx on semester_core.scope_grants (tenant_id);

-- 220
create table if not exists semester_core.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.webhook_endpoints enable row level security;
alter table semester_core.webhook_endpoints force row level security;
create index if not exists webhook_endpoints_tenant_idx on semester_core.webhook_endpoints (tenant_id);

-- 221
create table if not exists semester_core.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.webhook_deliveries enable row level security;
alter table semester_core.webhook_deliveries force row level security;
create index if not exists webhook_deliveries_tenant_idx on semester_core.webhook_deliveries (tenant_id);

-- 222
create table if not exists semester_core.sandbox_tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.sandbox_tenants enable row level security;
alter table semester_core.sandbox_tenants force row level security;
create index if not exists sandbox_tenants_tenant_idx on semester_core.sandbox_tenants (tenant_id);

-- 223
create table if not exists semester_core.partner_orgs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.partner_orgs enable row level security;
alter table semester_core.partner_orgs force row level security;
create index if not exists partner_orgs_tenant_idx on semester_core.partner_orgs (tenant_id);

-- 224
create table if not exists semester_core.partner_agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.partner_agreements enable row level security;
alter table semester_core.partner_agreements force row level security;
create index if not exists partner_agreements_tenant_idx on semester_core.partner_agreements (tenant_id);

-- 225
create table if not exists semester_core.ops_queues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ops_queues enable row level security;
alter table semester_core.ops_queues force row level security;
create index if not exists ops_queues_tenant_idx on semester_core.ops_queues (tenant_id);

-- 226
create table if not exists semester_core.ops_work_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ops_work_items enable row level security;
alter table semester_core.ops_work_items force row level security;
create index if not exists ops_work_items_tenant_idx on semester_core.ops_work_items (tenant_id);

-- 227
create table if not exists semester_core.ops_runbooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.ops_runbooks enable row level security;
alter table semester_core.ops_runbooks force row level security;
create index if not exists ops_runbooks_tenant_idx on semester_core.ops_runbooks (tenant_id);

