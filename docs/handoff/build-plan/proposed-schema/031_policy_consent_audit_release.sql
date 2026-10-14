-- 031_policy_consent_audit_release.sql — PROPOSED, tables 31–60 of 227. Not run.
-- Created in schema semester_core so nothing collides with the repo's existing public tables. Reconcile each table with the
-- repo's ~233 migrations before moving anything into public. Every table: RLS enabled + forced, NO policies yet = deny all.
-- Write per-table policies from the capability registry; tenant comes from auth.uid() -> active membership, never from a client-settable setting.

-- 31
create table if not exists semester_core.policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.policies enable row level security;
alter table semester_core.policies force row level security;
create index if not exists policies_tenant_idx on semester_core.policies (tenant_id);

-- 32
create table if not exists semester_core.policy_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.policy_versions enable row level security;
alter table semester_core.policy_versions force row level security;
create index if not exists policy_versions_tenant_idx on semester_core.policy_versions (tenant_id);

-- 33
create table if not exists semester_core.policy_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.policy_bindings enable row level security;
alter table semester_core.policy_bindings force row level security;
create index if not exists policy_bindings_tenant_idx on semester_core.policy_bindings (tenant_id);

-- 34
create table if not exists semester_core.policy_decisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.policy_decisions enable row level security;
alter table semester_core.policy_decisions force row level security;
create index if not exists policy_decisions_tenant_idx on semester_core.policy_decisions (tenant_id);

-- 35
create table if not exists semester_core.decision_obligations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.decision_obligations enable row level security;
alter table semester_core.decision_obligations force row level security;
create index if not exists decision_obligations_tenant_idx on semester_core.decision_obligations (tenant_id);

-- 36
create table if not exists semester_core.consents (
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
alter table semester_core.consents enable row level security;
alter table semester_core.consents force row level security;
create index if not exists consents_tenant_idx on semester_core.consents (tenant_id);

-- 37
create table if not exists semester_core.consent_scopes (
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
alter table semester_core.consent_scopes enable row level security;
alter table semester_core.consent_scopes force row level security;
create index if not exists consent_scopes_tenant_idx on semester_core.consent_scopes (tenant_id);

-- 38
create table if not exists semester_core.delegations (
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
alter table semester_core.delegations enable row level security;
alter table semester_core.delegations force row level security;
create index if not exists delegations_tenant_idx on semester_core.delegations (tenant_id);

-- 39
create table if not exists semester_core.delegation_scopes (
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
alter table semester_core.delegation_scopes enable row level security;
alter table semester_core.delegation_scopes force row level security;
create index if not exists delegation_scopes_tenant_idx on semester_core.delegation_scopes (tenant_id);

-- 40
create table if not exists semester_core.revocations (
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
alter table semester_core.revocations enable row level security;
alter table semester_core.revocations force row level security;
create index if not exists revocations_tenant_idx on semester_core.revocations (tenant_id);

-- 41
create table if not exists semester_core.authority_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.authority_registry enable row level security;
alter table semester_core.authority_registry force row level security;
create index if not exists authority_registry_tenant_idx on semester_core.authority_registry (tenant_id);

-- 42
create table if not exists semester_core.record_ownership (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.record_ownership enable row level security;
alter table semester_core.record_ownership force row level security;
create index if not exists record_ownership_tenant_idx on semester_core.record_ownership (tenant_id);

-- 43
create table if not exists semester_core.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.audit_events enable row level security;
alter table semester_core.audit_events force row level security;
create index if not exists audit_events_tenant_idx on semester_core.audit_events (tenant_id);

-- 44
create table if not exists semester_core.audit_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.audit_attachments enable row level security;
alter table semester_core.audit_attachments force row level security;
create index if not exists audit_attachments_tenant_idx on semester_core.audit_attachments (tenant_id);

-- 45
create table if not exists semester_core.audit_projections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.audit_projections enable row level security;
alter table semester_core.audit_projections force row level security;
create index if not exists audit_projections_tenant_idx on semester_core.audit_projections (tenant_id);

-- 46
create table if not exists semester_core.evidence_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.evidence_artifacts enable row level security;
alter table semester_core.evidence_artifacts force row level security;
create index if not exists evidence_artifacts_tenant_idx on semester_core.evidence_artifacts (tenant_id);

-- 47
create table if not exists semester_core.evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.evidence_reviews enable row level security;
alter table semester_core.evidence_reviews force row level security;
create index if not exists evidence_reviews_tenant_idx on semester_core.evidence_reviews (tenant_id);

-- 48
create table if not exists semester_core.control_register (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.control_register enable row level security;
alter table semester_core.control_register force row level security;
create index if not exists control_register_tenant_idx on semester_core.control_register (tenant_id);

-- 49
create table if not exists semester_core.control_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.control_checks enable row level security;
alter table semester_core.control_checks force row level security;
create index if not exists control_checks_tenant_idx on semester_core.control_checks (tenant_id);

-- 50
create table if not exists semester_core.release_manifests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.release_manifests enable row level security;
alter table semester_core.release_manifests force row level security;
create index if not exists release_manifests_tenant_idx on semester_core.release_manifests (tenant_id);

-- 51
create table if not exists semester_core.release_artifacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.release_artifacts enable row level security;
alter table semester_core.release_artifacts force row level security;
create index if not exists release_artifacts_tenant_idx on semester_core.release_artifacts (tenant_id);

-- 52
create table if not exists semester_core.release_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.release_approvals enable row level security;
alter table semester_core.release_approvals force row level security;
create index if not exists release_approvals_tenant_idx on semester_core.release_approvals (tenant_id);

-- 53
create table if not exists semester_core.release_rollbacks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.release_rollbacks enable row level security;
alter table semester_core.release_rollbacks force row level security;
create index if not exists release_rollbacks_tenant_idx on semester_core.release_rollbacks (tenant_id);

-- 54
create table if not exists semester_core.incidents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.incidents enable row level security;
alter table semester_core.incidents force row level security;
create index if not exists incidents_tenant_idx on semester_core.incidents (tenant_id);

-- 55
create table if not exists semester_core.incident_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.incident_updates enable row level security;
alter table semester_core.incident_updates force row level security;
create index if not exists incident_updates_tenant_idx on semester_core.incident_updates (tenant_id);

-- 56
create table if not exists semester_core.incident_impacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.incident_impacts enable row level security;
alter table semester_core.incident_impacts force row level security;
create index if not exists incident_impacts_tenant_idx on semester_core.incident_impacts (tenant_id);

-- 57
create table if not exists semester_core.postmortems (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.postmortems enable row level security;
alter table semester_core.postmortems force row level security;
create index if not exists postmortems_tenant_idx on semester_core.postmortems (tenant_id);

-- 58
create table if not exists semester_core.access_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, id)
);
alter table semester_core.access_reviews enable row level security;
alter table semester_core.access_reviews force row level security;
create index if not exists access_reviews_tenant_idx on semester_core.access_reviews (tenant_id);

-- 59
create table if not exists semester_core.data_exports (
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
alter table semester_core.data_exports enable row level security;
alter table semester_core.data_exports force row level security;
create index if not exists data_exports_tenant_idx on semester_core.data_exports (tenant_id);

-- 60
create table if not exists semester_core.deletion_requests (
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
alter table semester_core.deletion_requests enable row level security;
alter table semester_core.deletion_requests force row level security;
create index if not exists deletion_requests_tenant_idx on semester_core.deletion_requests (tenant_id);

