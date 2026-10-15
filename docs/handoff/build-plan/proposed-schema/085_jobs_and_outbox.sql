-- 085_jobs_and_outbox.sql — PROPOSED. Durable jobs with leases, generations and attempts; core outbox.
create type semester_core.job_state as enum ('queued','leased','running','retry_scheduled','succeeded','quarantined','cancelled','expired');
drop table if exists semester_core.job_attempts, semester_core.job_leases, semester_core.jobs, semester_core.outbox_events cascade;

create table semester_core.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  job_type text not null, aggregate_type text not null, aggregate_id uuid not null,
  generation int not null default 1,                -- must match the aggregate's generation when the result is applied
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,       -- ids and parameters only, never record contents
  state semester_core.job_state not null default 'queued',
  attempt_count int not null default 0, max_attempts int not null default 5 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  lease_owner text, lease_token uuid, lease_expires_at timestamptz,
  last_error_code text, last_error_detail text,
  correlation_id uuid not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, id), unique (tenant_id, job_type, idempotency_key),
  check ((state = 'leased') = (lease_token is not null and lease_expires_at is not null))
);
create index jobs_claim_idx on semester_core.jobs (available_at, created_at) where state in ('queued','retry_scheduled');
create index jobs_lease_expiry_idx on semester_core.jobs (lease_expires_at) where state = 'leased';

create table semester_core.job_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null, job_id uuid not null,
  attempt_number int not null, worker_id text not null,
  started_at timestamptz not null default now(), finished_at timestamptz,
  outcome text check (outcome in ('succeeded','retryable_failure','permanent_failure','cancelled_or_revoked','expired')),
  error_code text, error_detail text, correlation_id uuid not null,
  foreign key (tenant_id, job_id) references semester_core.jobs (tenant_id, id) on delete cascade,
  unique (job_id, attempt_number)
);

create table semester_core.outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references semester_core.tenants(id),
  event_type text not null, event_version int not null default 1,
  aggregate_type text not null, aggregate_id uuid not null,
  causation_id uuid, correlation_id uuid not null,
  payload jsonb not null,
  available_at timestamptz not null default now(), delivered_at timestamptz,
  delivery_attempts int not null default 0, last_delivery_error text,
  created_at timestamptz not null default now(),
  unique (tenant_id, event_type, aggregate_type, aggregate_id, correlation_id)
);
create index outbox_pending_idx on semester_core.outbox_events (available_at) where delivered_at is null;

-- Claim up to n jobs. Reclaims expired leases. Worker id passed as an argument (not a session setting).
create or replace function semester_core.claim_jobs(p_worker text, p_n int default 20, p_lease interval default interval '2 minutes')
returns setof semester_core.jobs language sql security definer set search_path = semester_core, pg_temp as $$
  with next_jobs as (
    select id from semester_core.jobs
    where (state in ('queued','retry_scheduled') and available_at <= now())
       or (state = 'leased' and lease_expires_at < now())
    order by available_at, created_at
    for update skip locked limit least(p_n, 100))
  update semester_core.jobs j set state = 'leased', lease_owner = p_worker, lease_token = gen_random_uuid(),
         lease_expires_at = now() + p_lease, attempt_count = j.attempt_count + 1, updated_at = now()
  from next_jobs where j.id = next_jobs.id
  returning j.*;
$$;
revoke execute on function semester_core.claim_jobs(text,int,interval) from public, anon, authenticated;
grant execute on function semester_core.claim_jobs(text,int,interval) to service_role;

do $$ declare t text; begin foreach t in array array['jobs','job_attempts','outbox_events'] loop
  execute format('alter table semester_core.%I enable row level security', t); execute format('alter table semester_core.%I force row level security', t);
  execute format('revoke all on semester_core.%I from anon, authenticated', t); end loop; end $$;
-- No client access at all: jobs and outbox are service-role only. Operators see them through ops views.
