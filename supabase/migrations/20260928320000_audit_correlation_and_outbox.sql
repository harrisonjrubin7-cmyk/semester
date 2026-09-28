-- A correlation id on every gateway audit row, and the transactional outbox.
--
-- Two of the four foundations in docs/ZERO-TRUST-EVENT-API-OBSERVABILITY-
-- ROADMAP.md live in the database: the audit event that answers "what proves
-- this action happened" has to carry the id that ties it to the request, the
-- telemetry line and the support ticket; and an event that must reach other
-- modules has to be written in the same transaction as the record it
-- describes, or a database write can succeed while the notification, the
-- passback and the audit step fail silently.
--
-- ## The audit column, and why a second function rather than a wider one
--
-- `private.gateway_write_audit(text, text, text, text, uuid)` keeps its
-- signature. Adding a defaulted sixth parameter to it would leave two
-- overloads that a five-argument call cannot choose between, and the earlier
-- migration re-creates the five-argument one on every re-apply — so the
-- schema after two passes would not be the schema after one, which
-- `check.sh` refuses. `_v2` sits beside it; the gateway calls `_v2`; nothing
-- calls the old one but it is left standing, harmless, rather than dropped
-- from under a deploy that is mid-rollout.
--
-- The correlation id is validated by the same pattern the gateway accepts in
-- `X-Correlation-Id` and the policy module requires of every request
-- (`packages/institution/src/policy.ts`, CORRELATION_ID_PATTERN). A row with
-- a malformed one is refused, not stored with the id nulled: an audit row
-- that silently lost its trace is the failure the column exists to prevent.
--
-- ## The outbox and the receipts
--
-- `domain_outbox_events` is the specification's schema with the parking
-- column it left implicit (`dead_lettered_at`): a row the publisher has given
-- up on stays, visible to an operator, and is not offered again. The pending
-- index is partial on both columns so a large parked set costs the publisher
-- nothing. `domain_event_receipts` is the consumer side: one row per
-- (consumer, event), whose primary key is what makes a second delivery a
-- no-op at the database rather than in a code path somebody forgot.
--
-- Both are `private` and service-role only. No client writes an event; the
-- server writes one inside the transaction that made it true.
-- `packages/institution/src/events.ts` is the same contract in TypeScript,
-- and `events.test.ts` holds the classification list and the type pattern
-- here equal to that file's.

alter table private.gateway_audit
  add column if not exists correlation_id text;

alter table private.gateway_audit
  drop constraint if exists gateway_audit_correlation_shape;
alter table private.gateway_audit
  add constraint gateway_audit_correlation_shape
  check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$');

create index if not exists gateway_audit_by_correlation
  on private.gateway_audit (correlation_id)
  where correlation_id is not null;

create or replace function private.gateway_write_audit_v2(
  want_tenant text,
  want_actor text,
  want_area text,
  want_event text,
  want_review uuid default null,
  want_correlation text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.gateway_audit (tenant_id, actor_id, area, event, review_id, correlation_id)
  values (want_tenant, want_actor, want_area, want_event, want_review, want_correlation);
  return true;
exception when foreign_key_violation or check_violation then
  return false;
end $$;

create or replace function public.gateway_write_audit_v2(
  want_tenant text, want_actor text, want_area text, want_event text,
  want_review uuid default null, want_correlation text default null
)
returns boolean language sql volatile security definer set search_path = ''
as $$ select private.gateway_write_audit_v2(want_tenant, want_actor, want_area, want_event, want_review, want_correlation) $$;

revoke all on function private.gateway_write_audit_v2(text, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.gateway_write_audit_v2(text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.gateway_write_audit_v2(text, text, text, text, uuid, text) to service_role;

-- ── The outbox ─────────────────────────────────────────────────────────────

create table if not exists private.domain_outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null check (length(aggregate_type) between 1 and 100),
  aggregate_id text not null check (length(aggregate_id) between 1 and 200),
  event_type text not null check (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  event_version integer not null check (event_version > 0),
  environment text not null check (environment in ('production', 'staging', 'demo')),
  tenant_id text references public.schools(id) on delete cascade,
  producer text not null check (length(producer) between 1 and 200),
  correlation_id text not null check (correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  causation_id uuid,
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 1 and 300),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  data_classification text not null
    check (data_classification in ('public', 'internal', 'student_private', 'education_record')),
  retention_class text not null
    check (retention_class in ('operational', 'student_record', 'audit', 'commercial')),
  occurred_at timestamptz not null default now(),
  published_at timestamptz,
  publish_attempts integer not null default 0 check (publish_attempts >= 0),
  last_error text check (last_error is null or length(last_error) <= 500),
  dead_lettered_at timestamptz,
  constraint domain_outbox_one_outcome check (published_at is null or dead_lettered_at is null)
);

-- A producer that stamps the same idempotency key twice for one aggregate has
-- written the same event twice; the second insert fails in its transaction.
create unique index if not exists domain_outbox_idempotent
  on private.domain_outbox_events (aggregate_type, aggregate_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists domain_outbox_pending
  on private.domain_outbox_events (occurred_at)
  where published_at is null and dead_lettered_at is null;

create index if not exists domain_outbox_by_correlation
  on private.domain_outbox_events (correlation_id);

create table if not exists private.domain_event_receipts (
  consumer text not null check (length(consumer) between 1 and 100),
  event_id uuid not null,
  outcome text not null check (outcome in ('processed', 'skipped', 'failed')),
  last_error text check (last_error is null or length(last_error) <= 500),
  processed_at timestamptz not null default now(),
  primary key (consumer, event_id)
);

alter table private.domain_outbox_events enable row level security;
alter table private.domain_event_receipts enable row level security;
revoke all on table private.domain_outbox_events from public, anon, authenticated;
revoke all on table private.domain_event_receipts from public, anon, authenticated;
grant select, insert, update, delete on table private.domain_outbox_events to service_role;
grant select, insert, update, delete on table private.domain_event_receipts to service_role;
