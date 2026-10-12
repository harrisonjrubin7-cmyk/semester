-- Proposed evidence metadata schema, NOT applied. No customer/secret content.
-- Do not expose to browsers; RLS defaults deny until reviewed policies exist.
create schema if not exists release_control;
create table release_control.candidates (
  id uuid primary key,
  commit_sha text not null,
  deployment_id text not null,
  config_fingerprint text not null,
  schema_fingerprint text not null,
  security_scope text not null,
  cohort text not null,
  operation text not null,
  unique(commit_sha,deployment_id,config_fingerprint,schema_fingerprint,security_scope,cohort,operation)
);
create table release_control.evidence (
  id uuid primary key,
  candidate_id uuid not null references release_control.candidates(id),
  domain_id text not null,
  gate_id text not null,
  evidence_reference text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  passed boolean not null default false,
  accepted_by text,
  accepted_at timestamptz,
  withdrawn_at timestamptz,
  check (expires_at > issued_at),
  check ((accepted_by is null) = (accepted_at is null))
);
alter table release_control.candidates enable row level security;
alter table release_control.candidates force row level security;
alter table release_control.evidence enable row level security;
alter table release_control.evidence force row level security;
revoke all on schema release_control from public;
revoke all on all tables in schema release_control from public;
-- Required before use: reviewed runtime roles, admin policies, immutable audit,
-- authoritative approval ingestion, revocation notifications and scope validation.
