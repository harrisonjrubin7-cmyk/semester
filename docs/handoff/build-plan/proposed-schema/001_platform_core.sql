-- 001_platform_core.sql — PROPOSED, tables 1–30 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

create schema if not exists semester_core;
revoke all on schema semester_core from anon;

-- 1
create table if not exists semester_core.tenants (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.tenants enable row level security;
alter table semester_core.tenants force row level security;

-- 2
create table if not exists semester_core.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.tenant_domains enable row level security;
alter table semester_core.tenant_domains force row level security;
create index if not exists tenant_domains_tenant_idx on semester_core.tenant_domains (tenant_id);

-- 3
create table if not exists semester_core.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.tenant_settings enable row level security;
alter table semester_core.tenant_settings force row level security;
create index if not exists tenant_settings_tenant_idx on semester_core.tenant_settings (tenant_id);

-- 4
create table if not exists semester_core.tenant_branding (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.tenant_branding enable row level security;
alter table semester_core.tenant_branding force row level security;
create index if not exists tenant_branding_tenant_idx on semester_core.tenant_branding (tenant_id);

-- 5
create table if not exists semester_core.tenant_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.tenant_policies enable row level security;
alter table semester_core.tenant_policies force row level security;
create index if not exists tenant_policies_tenant_idx on semester_core.tenant_policies (tenant_id);

-- 6
create table if not exists semester_core.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.accounts enable row level security;
alter table semester_core.accounts force row level security;

-- 7
create table if not exists semester_core.account_emails (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.account_emails enable row level security;
alter table semester_core.account_emails force row level security;

-- 8
create table if not exists semester_core.account_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.account_profiles enable row level security;
alter table semester_core.account_profiles force row level security;

-- 9
create table if not exists semester_core.account_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.account_preferences enable row level security;
alter table semester_core.account_preferences force row level security;

-- 10
create table if not exists semester_core.devices (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.devices enable row level security;
alter table semester_core.devices force row level security;

-- 11
create table if not exists semester_core.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid references semester_core.accounts(id),
  subject_account_id uuid references semester_core.accounts(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.sessions enable row level security;
alter table semester_core.sessions force row level security;

-- 12
create table if not exists semester_core.memberships (
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
alter table semester_core.memberships enable row level security;
alter table semester_core.memberships force row level security;
create index if not exists memberships_tenant_idx on semester_core.memberships (tenant_id);

-- 13
create table if not exists semester_core.membership_history (
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
alter table semester_core.membership_history enable row level security;
alter table semester_core.membership_history force row level security;
create index if not exists membership_history_tenant_idx on semester_core.membership_history (tenant_id);

-- 14
create table if not exists semester_core.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.roles enable row level security;
alter table semester_core.roles force row level security;
create index if not exists roles_tenant_idx on semester_core.roles (tenant_id);

-- 15
create table if not exists semester_core.role_inheritance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.role_inheritance enable row level security;
alter table semester_core.role_inheritance force row level security;
create index if not exists role_inheritance_tenant_idx on semester_core.role_inheritance (tenant_id);

-- 16
create table if not exists semester_core.grants (
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
alter table semester_core.grants enable row level security;
alter table semester_core.grants force row level security;
create index if not exists grants_tenant_idx on semester_core.grants (tenant_id);

-- 17
create table if not exists semester_core.grant_reviews (
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
alter table semester_core.grant_reviews enable row level security;
alter table semester_core.grant_reviews force row level security;
create index if not exists grant_reviews_tenant_idx on semester_core.grant_reviews (tenant_id);

-- 18
create table if not exists semester_core.workspaces (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.workspaces enable row level security;
alter table semester_core.workspaces force row level security;

-- 19
create table if not exists semester_core.workspace_routes (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.workspace_routes enable row level security;
alter table semester_core.workspace_routes force row level security;

-- 20
create table if not exists semester_core.capabilities (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.capabilities enable row level security;
alter table semester_core.capabilities force row level security;

-- 21
create table if not exists semester_core.capability_dependencies (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.capability_dependencies enable row level security;
alter table semester_core.capability_dependencies force row level security;

-- 22
create table if not exists semester_core.screens (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.screens enable row level security;
alter table semester_core.screens force row level security;

-- 23
create table if not exists semester_core.screen_states (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.screen_states enable row level security;
alter table semester_core.screen_states force row level security;

-- 24
create table if not exists semester_core.feature_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.feature_configs enable row level security;
alter table semester_core.feature_configs force row level security;
create index if not exists feature_configs_tenant_idx on semester_core.feature_configs (tenant_id);

-- 25
create table if not exists semester_core.environment_flags (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.environment_flags enable row level security;
alter table semester_core.environment_flags force row level security;

-- 26
create table if not exists semester_core.api_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.api_clients enable row level security;
alter table semester_core.api_clients force row level security;
create index if not exists api_clients_tenant_idx on semester_core.api_clients (tenant_id);

-- 27
create table if not exists semester_core.api_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.api_tokens enable row level security;
alter table semester_core.api_tokens force row level security;
create index if not exists api_tokens_tenant_idx on semester_core.api_tokens (tenant_id);

-- 28
create table if not exists semester_core.service_identities (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.service_identities enable row level security;
alter table semester_core.service_identities force row level security;

-- 29
create table if not exists semester_core.regions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.regions enable row level security;
alter table semester_core.regions force row level security;

-- 30
create table if not exists semester_core.timezones (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table semester_core.timezones enable row level security;
alter table semester_core.timezones force row level security;

