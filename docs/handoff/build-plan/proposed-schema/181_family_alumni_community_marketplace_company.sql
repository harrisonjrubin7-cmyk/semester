-- 181_family_alumni_community_marketplace_company.sql — PROPOSED, tables 181–210 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

-- 181
create table if not exists semester_core.family_profiles (
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
alter table semester_core.family_profiles enable row level security;
alter table semester_core.family_profiles force row level security;
create index if not exists family_profiles_tenant_idx on semester_core.family_profiles (tenant_id);

-- 182
create table if not exists semester_core.family_links (
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
alter table semester_core.family_links enable row level security;
alter table semester_core.family_links force row level security;
create index if not exists family_links_tenant_idx on semester_core.family_links (tenant_id);

-- 183
create table if not exists semester_core.family_visibility_rules (
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
alter table semester_core.family_visibility_rules enable row level security;
alter table semester_core.family_visibility_rules force row level security;
create index if not exists family_visibility_rules_tenant_idx on semester_core.family_visibility_rules (tenant_id);

-- 184
create table if not exists semester_core.alumni_profiles (
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
alter table semester_core.alumni_profiles enable row level security;
alter table semester_core.alumni_profiles force row level security;
create index if not exists alumni_profiles_tenant_idx on semester_core.alumni_profiles (tenant_id);

-- 185
create table if not exists semester_core.alumni_engagements (
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
alter table semester_core.alumni_engagements enable row level security;
alter table semester_core.alumni_engagements force row level security;
create index if not exists alumni_engagements_tenant_idx on semester_core.alumni_engagements (tenant_id);

-- 186
create table if not exists semester_core.donation_refs (
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
alter table semester_core.donation_refs enable row level security;
alter table semester_core.donation_refs force row level security;
create index if not exists donation_refs_tenant_idx on semester_core.donation_refs (tenant_id);

-- 187
create table if not exists semester_core.communities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.communities enable row level security;
alter table semester_core.communities force row level security;
create index if not exists communities_tenant_idx on semester_core.communities (tenant_id);

-- 188
create table if not exists semester_core.groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.groups enable row level security;
alter table semester_core.groups force row level security;
create index if not exists groups_tenant_idx on semester_core.groups (tenant_id);

-- 189
create table if not exists semester_core.posts (
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
alter table semester_core.posts enable row level security;
alter table semester_core.posts force row level security;
create index if not exists posts_tenant_idx on semester_core.posts (tenant_id);

-- 190
create table if not exists semester_core.comments (
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
alter table semester_core.comments enable row level security;
alter table semester_core.comments force row level security;
create index if not exists comments_tenant_idx on semester_core.comments (tenant_id);

-- 191
create table if not exists semester_core.messages_threads (
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
alter table semester_core.messages_threads enable row level security;
alter table semester_core.messages_threads force row level security;
create index if not exists messages_threads_tenant_idx on semester_core.messages_threads (tenant_id);

-- 192
create table if not exists semester_core.messages_entries (
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
alter table semester_core.messages_entries enable row level security;
alter table semester_core.messages_entries force row level security;
create index if not exists messages_entries_tenant_idx on semester_core.messages_entries (tenant_id);

-- 193
create table if not exists semester_core.reports (
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
alter table semester_core.reports enable row level security;
alter table semester_core.reports force row level security;
create index if not exists reports_tenant_idx on semester_core.reports (tenant_id);

-- 194
create table if not exists semester_core.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.moderation_actions enable row level security;
alter table semester_core.moderation_actions force row level security;
create index if not exists moderation_actions_tenant_idx on semester_core.moderation_actions (tenant_id);

-- 195
create table if not exists semester_core.appeals (
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
alter table semester_core.appeals enable row level security;
alter table semester_core.appeals force row level security;
create index if not exists appeals_tenant_idx on semester_core.appeals (tenant_id);

-- 196
create table if not exists semester_core.listings (
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
alter table semester_core.listings enable row level security;
alter table semester_core.listings force row level security;
create index if not exists listings_tenant_idx on semester_core.listings (tenant_id);

-- 197
create table if not exists semester_core.offers (
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
alter table semester_core.offers enable row level security;
alter table semester_core.offers force row level security;
create index if not exists offers_tenant_idx on semester_core.offers (tenant_id);

-- 198
create table if not exists semester_core.orders (
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
alter table semester_core.orders enable row level security;
alter table semester_core.orders force row level security;
create index if not exists orders_tenant_idx on semester_core.orders (tenant_id);

-- 199
create table if not exists semester_core.fulfillments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.fulfillments enable row level security;
alter table semester_core.fulfillments force row level security;
create index if not exists fulfillments_tenant_idx on semester_core.fulfillments (tenant_id);

-- 200
create table if not exists semester_core.disputes (
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
alter table semester_core.disputes enable row level security;
alter table semester_core.disputes force row level security;
create index if not exists disputes_tenant_idx on semester_core.disputes (tenant_id);

-- 201
create table if not exists semester_core.seller_verifications (
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
alter table semester_core.seller_verifications enable row level security;
alter table semester_core.seller_verifications force row level security;
create index if not exists seller_verifications_tenant_idx on semester_core.seller_verifications (tenant_id);

-- 202
create table if not exists semester_core.b2b_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.b2b_accounts enable row level security;
alter table semester_core.b2b_accounts force row level security;
create index if not exists b2b_accounts_tenant_idx on semester_core.b2b_accounts (tenant_id);

-- 203
create table if not exists semester_core.crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.crm_leads enable row level security;
alter table semester_core.crm_leads force row level security;
create index if not exists crm_leads_tenant_idx on semester_core.crm_leads (tenant_id);

-- 204
create table if not exists semester_core.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.crm_opportunities enable row level security;
alter table semester_core.crm_opportunities force row level security;
create index if not exists crm_opportunities_tenant_idx on semester_core.crm_opportunities (tenant_id);

-- 205
create table if not exists semester_core.quotes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.quotes enable row level security;
alter table semester_core.quotes force row level security;
create index if not exists quotes_tenant_idx on semester_core.quotes (tenant_id);

-- 206
create table if not exists semester_core.contracts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.contracts enable row level security;
alter table semester_core.contracts force row level security;
create index if not exists contracts_tenant_idx on semester_core.contracts (tenant_id);

-- 207
create table if not exists semester_core.renewals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.renewals enable row level security;
alter table semester_core.renewals force row level security;
create index if not exists renewals_tenant_idx on semester_core.renewals (tenant_id);

-- 208
create table if not exists semester_core.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.support_tickets enable row level security;
alter table semester_core.support_tickets force row level security;
create index if not exists support_tickets_tenant_idx on semester_core.support_tickets (tenant_id);

-- 209
create table if not exists semester_core.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.campaigns enable row level security;
alter table semester_core.campaigns force row level security;
create index if not exists campaigns_tenant_idx on semester_core.campaigns (tenant_id);

-- 210
create table if not exists semester_core.customer_health_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.customer_health_scores enable row level security;
alter table semester_core.customer_health_scores force row level security;
create index if not exists customer_health_scores_tenant_idx on semester_core.customer_health_scores (tenant_id);

