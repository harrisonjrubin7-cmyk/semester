-- 080_reconciliation_and_overrides.sql — PROPOSED. Reconciliation as a workflow; overrides as a controlled action.
drop table if exists semester_core.reconciliation_cases, semester_core.reconciliation_items, semester_core.override_requests cascade;

create table semester_core.reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  component_key text not null,
  aggregate_type text not null, aggregate_id text not null,
  discrepancy_type text not null check (discrepancy_type in ('missing_external_record','unexpected_external_record','field_value_mismatch','authority_conflict','stale_projection','duplicate_delivery','invalid_transition','policy_decision_mismatch')),
  state text not null default 'detected' check (state in ('detected','classified','queued','repairing','awaiting_source','awaiting_human_review','verified','closed','escalated')),
  repair_action text check (repair_action in ('recheck','refresh_projection','preserve_and_route','stop_and_escalate')),
  authority_system text, source_reference text,
  before_hash text, after_hash text,
  detected_at timestamptz not null default now(), detected_by text not null,
  assigned_to_account_id uuid references semester_core.accounts(id),
  verified_by text, verified_at timestamptz, closed_at timestamptz,
  audit_event_id bigint,
  correlation_id uuid not null,
  unique (tenant_id, id),
  check (state <> 'closed' or (source_reference is not null and repair_action is not null and verified_by is not null and verified_at is not null and audit_event_id is not null and (before_hash is not null or after_hash is not null))),
  check (discrepancy_type <> 'authority_conflict' or repair_action is null or repair_action in ('preserve_and_route','stop_and_escalate'))
);

create table semester_core.reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  case_id uuid,
  external_id text, reason text not null, observed_at timestamptz not null default now(), correlation_id uuid not null,
  foreign key (tenant_id, case_id) references semester_core.reconciliation_cases (tenant_id, id),
  unique (tenant_id, id)
);

create table semester_core.override_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  readiness_case_id uuid not null,
  requested_by_account_id uuid not null references semester_core.accounts(id),
  requested_outcome text not null,
  reason text not null check (char_length(reason) >= 10),
  consequence_preview text not null,
  policy_decision_ref text not null,
  state text not null default 'requested' check (state in ('requested','approved','denied','withdrawn','expired')),
  decided_by_account_id uuid references semester_core.accounts(id),
  decided_at timestamptz, decision_reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, readiness_case_id) references semester_core.readiness_cases (tenant_id, id),
  unique (tenant_id, id), unique (tenant_id, requested_by_account_id, idempotency_key),
  check (decided_by_account_id is null or decided_by_account_id <> requested_by_account_id),   -- requester can't approve
  check ((state in ('approved','denied')) = (decided_by_account_id is not null and decided_at is not null and decision_reason is not null))
);

do $$ declare t text; begin foreach t in array array['reconciliation_cases','reconciliation_items','override_requests'] loop
  execute format('alter table semester_core.%I enable row level security', t); execute format('alter table semester_core.%I force row level security', t); end loop; end $$;
grant select on semester_core.reconciliation_cases, semester_core.override_requests to authenticated;
create policy recon_staff on semester_core.reconciliation_cases for select to authenticated using (semester_core.has_capability(tenant_id, 'registrar.readiness.queue.read') or semester_core.has_capability(tenant_id, 'institution.integrations.read'));
create policy override_registrar on semester_core.override_requests for select to authenticated using (semester_core.has_capability(tenant_id, 'registrar.readiness.case.read'));
-- writes only through override.request / override.decide commands (service role).
create index on semester_core.reconciliation_cases (tenant_id, state, detected_at) where state not in ('closed');
create index on semester_core.override_requests (tenant_id, state, created_at) where state = 'requested';
