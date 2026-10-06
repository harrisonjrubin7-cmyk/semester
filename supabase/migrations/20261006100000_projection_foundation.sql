-- The projection side of the read-model design: where the worker is up to, what
-- a read model is allowed to claim, and the columns the outbox needs so a
-- worker can claim an event without two workers taking the same one.
--
-- Design: docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md §1 and §3 (backlog P1-01).
-- This is the tables and nothing else. No function, no producer, no worker: the
-- claim, complete, fail and replay RPCs are P1-03, the emit helper is P1-02,
-- and nothing here reads or writes a row until they exist.
--
-- Everything is in `private`, as the design recommends (open decision B-01),
-- because `rls-coverage`, `grants` and the definer register all scan `public`
-- and `private` and a new schema would have to be kept out of the API's exposed
-- schemas by hand. Every table has row-level security on and no grant to a
-- client role; only the service role, which the worker runs as, reaches them.
--
-- A projection with no watermark row is *unknown*, not fresh. That is why
-- `status` below describes the worker and not the data: freshness is computed
-- from `last_occurred_at` against the read model's `freshness_slo_seconds` when
-- a read is made, and is never stored where somebody could assert it.

-- ── The outbox, additively ──────────────────────────────────────────────────
-- A claim is stale after five minutes (the support outbox's rule), so a worker
-- that died holding events does not park them. `next_attempt_at` is where the
-- bounded backoff lands; null means "now". Existing rows and existing writers
-- are unaffected: all three columns are nullable and unread until P1-03.
alter table private.domain_outbox_events
  add column if not exists claim_id uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists next_attempt_at timestamptz;

alter table private.domain_outbox_events
  drop constraint if exists domain_outbox_claim_pair;
alter table private.domain_outbox_events
  add constraint domain_outbox_claim_pair
  check ((claim_id is null) = (claimed_at is null));

-- What a claim scans: events nobody has published or parked, oldest due first.
create index if not exists domain_outbox_claimable
  on private.domain_outbox_events (coalesce(next_attempt_at, occurred_at), occurred_at)
  where published_at is null and dead_lettered_at is null;

-- ── Which read models exist, and what each may claim ───────────────────────
create table if not exists private.read_model_registry (
  name text not null check (name ~ '^[a-z][a-z0-9_]{2,63}$'),
  version integer not null check (version > 0),
  capability text not null check (capability ~ '^[a-z_]+:[a-z_]+$'),
  scope_kind text not null check (scope_kind in ('platform', 'school')),
  freshness_slo_seconds integer not null check (freshness_slo_seconds > 0),
  source_tables text[] not null default '{}',
  redaction_profile text not null check (length(redaction_profile) between 1 and 100),
  status text not null default 'proposed'
    check (status in ('proposed', 'active', 'deprecated')),
  primary key (name, version)
);

-- ── Where each projection is up to ──────────────────────────────────────────
create table if not exists private.projection_watermark (
  projection text not null check (projection ~ '^[a-z][a-z0-9_]{2,63}$'),
  version integer not null check (version > 0),
  last_event_id uuid,
  last_occurred_at timestamptz,
  last_processed_at timestamptz,
  source_updated_at timestamptz,
  status text not null default 'idle'
    check (status in ('idle', 'running', 'failed', 'rebuilding')),
  last_error text check (last_error is null or length(last_error) <= 500),
  lag_seconds integer check (lag_seconds is null or lag_seconds >= 0),
  primary key (projection, version),
  -- A watermark that names an event must say when it happened, or lag cannot be
  -- computed from it and the projection would read as fresh by accident.
  constraint projection_watermark_event_has_time
    check (last_event_id is null or last_occurred_at is not null)
);

-- ── What a projection has made stale, for a reader to refetch ──────────────
create table if not exists private.projection_invalidation (
  id uuid primary key default gen_random_uuid(),
  namespace text not null check (namespace ~ '^[a-z][a-z0-9_.]{2,63}$'),
  tenant_id text references public.schools(id) on delete cascade,
  customer_id text check (customer_id is null or length(customer_id) between 1 and 200),
  resource_id text check (resource_id is null or length(resource_id) between 1 and 200),
  version bigint not null check (version > 0),
  reason text not null check (length(reason) between 1 and 200),
  occurred_at timestamptz not null default now(),
  correlation_id text not null check (correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$')
);

create index if not exists projection_invalidation_by_namespace
  on private.projection_invalidation (namespace, occurred_at desc);

-- Covers the school key (indexes.check.sql: deleting a school scans a child
-- table once per row without one) and serves the read that matters, a tenant's
-- latest invalidations for a namespace.
create index if not exists projection_invalidation_by_tenant
  on private.projection_invalidation (tenant_id, namespace, occurred_at desc);

-- ── A rebuild, and whether it matched the live projection ──────────────────
create table if not exists private.projection_rebuild_run (
  id uuid primary key default gen_random_uuid(),
  projection text not null check (projection ~ '^[a-z][a-z0-9_]{2,63}$'),
  from_version integer not null check (from_version > 0),
  to_version integer not null check (to_version > 0),
  mode text not null check (mode in ('shadow', 'in_place')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'abandoned')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  parity_ok boolean,
  events_replayed bigint not null default 0 check (events_replayed >= 0),
  -- A rebuild is only "succeeded" with a verdict on parity and an end time; a
  -- running one has neither, so a half-finished run cannot read as a pass.
  constraint projection_rebuild_finished_has_verdict
    check (status = 'running' or finished_at is not null),
  constraint projection_rebuild_success_has_parity
    check (status <> 'succeeded' or parity_ok is not null)
);

alter table private.read_model_registry enable row level security;
alter table private.projection_watermark enable row level security;
alter table private.projection_invalidation enable row level security;
alter table private.projection_rebuild_run enable row level security;

revoke all on table private.read_model_registry from public, anon, authenticated;
revoke all on table private.projection_watermark from public, anon, authenticated;
revoke all on table private.projection_invalidation from public, anon, authenticated;
revoke all on table private.projection_rebuild_run from public, anon, authenticated;

grant select, insert, update, delete on table private.read_model_registry to service_role;
grant select, insert, update, delete on table private.projection_watermark to service_role;
grant select, insert, update, delete on table private.projection_invalidation to service_role;
grant select, insert, update, delete on table private.projection_rebuild_run to service_role;
