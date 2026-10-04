-- PROPOSAL 08 · partitioning and archival for append-heavy tables
--
-- Measured today: 0 partitioned tables among 348. Append-heavy and time-pruned tables
-- are: audit_event, access_log, activity, domain_outbox_events, payment_events,
-- gateway_audit, gateway_intelligence_audit, integration_sync_runs/_errors,
-- integration_webhook_events, source_freshness_events, ai.retrieval_log, ledger entries.
-- Retention today deletes row by row ("on write", hourly or daily sweeps). A partitioned
-- table lets a retention window be a DETACH of one partition (instant, no bloat, no
-- vacuum debt) and lets the detached partition be exported to cold storage first.
--
-- NOT an in-place conversion: Postgres cannot partition an existing table. The path is
-- new partitioned table, dual-write, backfill by partition, verify counts, swap names in
-- one short transaction (procedure in 10-physical-design.md). This file provides the
-- machinery and the target shape for audit_event.
-- Requires: 01.

create table if not exists private.audit_event_p (
  id             uuid not null default gen_random_uuid(),
  occurred_at    timestamptz not null default now(),
  tenant_id      text references public.schools(id),     -- nullable: platform events; school rows are never deleted
  correlation_id text,
  action         text not null,
  object_kind    text not null,
  object_sha256  text,
  outcome        text not null check (outcome in ('allowed','denied','failed')),
  actor_sha256   text,
  actor_kind     text not null check (actor_kind in ('authenticated','service','anonymous')),
  purpose        text,                    -- why the access was made (FERPA "legitimate educational interest" basis, or the product purpose)
  policy_version text,                    -- the policy that decided
  classification text check (classification in ('T0','T1','T2','T3')),
  detail         jsonb not null default '{}',
  primary key (id, occurred_at)           -- the partition key must be in every unique constraint
) partition by range (occurred_at);
create index if not exists audit_event_p_tenant_time on private.audit_event_p (tenant_id, occurred_at desc);
create index if not exists audit_event_p_correlation on private.audit_event_p (correlation_id) where correlation_id is not null;
alter table private.audit_event_p enable row level security;
revoke all on private.audit_event_p from public, anon, authenticated;

-- Monthly partitions, created ahead, idempotent.
create or replace function private.ensure_month_partitions(_parent regclass, _months_ahead integer default 3)
returns integer language plpgsql as $$
declare m date; made integer := 0; child text; parent_name text; sch text;
begin
  select n.nspname, c.relname into sch, parent_name from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.oid = _parent;
  for i in 0.._months_ahead loop
    m := (date_trunc('month', now()) + make_interval(months => i))::date;
    child := format('%s_%s', parent_name, to_char(m, 'YYYYMM'));
    if to_regclass(format('%I.%I', sch, child)) is null then
      execute format('create table %I.%I partition of %s for values from (%L) to (%L)',
                     sch, child, _parent, m, (m + interval '1 month')::date);
      made := made + 1;
    end if;
  end loop;
  return made;
end $$;

-- Detach (never drop) partitions wholly older than the window. The caller exports then drops.
-- Detach is metadata-only; a held tenant makes the partition ineligible, because a partition
-- holds many tenants and a hold must not be defeated by a calendar.
create or replace function private.detach_old_partitions(_parent regclass, _older_than interval, _tenant_column text default 'tenant_id')
returns table (partition_name text, held boolean) language plpgsql as $$
declare r record; upper_bound timestamptz; h boolean;
begin
  for r in
    select c.oid, n.nspname, c.relname, pg_get_expr(c.relpartbound, c.oid) as bound
      from pg_inherits i join pg_class c on c.oid = i.inhrelid join pg_namespace n on n.oid = c.relnamespace
     where i.inhparent = _parent
  loop
    upper_bound := (regexp_match(r.bound, 'TO \(''([^'']+)''\)'))[1]::timestamptz;
    continue when upper_bound is null or upper_bound > now() - _older_than;
    execute format('select private.platform_is_held() or exists (select 1 from %I.%I p where p.%I is not null and private.tenant_is_held(p.%I))',
                   r.nspname, r.relname, _tenant_column, _tenant_column) into h;
    partition_name := r.nspname || '.' || r.relname; held := h;
    if not h then execute format('alter table %s detach partition %I.%I', _parent, r.nspname, r.relname); end if;
    return next;
  end loop;
end $$;
revoke all on function private.ensure_month_partitions(regclass, integer) from public, anon, authenticated;
revoke all on function private.detach_old_partitions(regclass, interval, text) from public, anon, authenticated;
grant execute on function private.ensure_month_partitions(regclass, integer), private.detach_old_partitions(regclass, interval, text) to service_role;

insert into private.data_registry (table_schema, table_name, domain, record_class, classification, authority,
   retention_class, retention_days, deletion_mode, review_state)
values ('private','audit_event_p','governance','append_only_evidence','T1','semester','fixed_term',1095,'append_only','proposed')
on conflict do nothing;
