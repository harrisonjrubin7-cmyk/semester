-- ops_projection_dashboard: how every registered read model is doing, in one
-- permissioned read.
--
-- Design: docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md §4 (envelope, 42501 on
-- refusal, in-body capability, search_path = '') and §9, and
-- docs/ops/PROJECTION_AND_CACHE_POLICY.md §9: per projection, status, version,
-- lag, last error, events behind, dead letters, last rebuild and parity.
-- docs/ops/OPERATIONS_CONSOLE_RUNBOOK.md §3 is the reader's guide: `unknown`
-- (no watermark) is never healthy, and lag is never fixed by editing a row.
--
-- ## What it reads, and what it does not
--
-- It reads only operability metadata: the read-model registry, the projection
-- watermark, the rebuild runs, and counts and ages from the domain outbox. It
-- never selects an event payload, an aggregate id, a tenant id or a person, and
-- it returns no row of any projection. It writes nothing, so it writes no
-- sensitive-read audit event: none of what it returns is a sensitive data class.
--
-- ## Freshness
--
-- Computed at read time, exactly as `read_tenant_projection` computes it, so
-- the two cannot disagree: no watermark, or a watermark with no event time, is
-- `unknown`; a failed worker is `failed`; a rebuild in progress or an event
-- time older than the SLO is `stale`; otherwise `fresh`. The envelope's overall
-- freshness is the worst of them, ordered failed, unknown, stale, fresh. An
-- empty registry is `unknown`.
--
-- Note for readers: that rule measures the *last processed event's time*
-- against the SLO, so a projection with nothing new to process reads `stale`
-- once its last event is older than the SLO. `events_behind` and
-- `oldest_pending_seconds` are the signals that tell "idle" from "stuck": a
-- stale projection with zero events behind is idle, not broken.
--
-- ## Events behind, dead letters, last error
--
-- The registry does not say which outbox events feed a model, so the mapping is
-- declared here, next to the query, for the two models that have a worker:
--   ops_tenant_entitlements -> entitlement.changed v1
--   ops_tenant_rollout      -> tenant_rollout.changed v1
-- (the consumers `run_ops_projector` writes receipts under). A model with no
-- entry reports `null` for those three figures and a warning that it has no
-- event source mapped. It is never reported as zero, because zero would read as
-- healthy. `supabase/ops-projection-dashboard.check.sql` fails if an active
-- model has no entry, so a new projection cannot be added without teaching the
-- dashboard.
--
-- `last_error` is the sanitized error the failing writer stored (at most 500
-- characters by the table's own check; capped again at 200 here). It is the
-- writer's own text, never a payload.
--
-- ## Scope
--
-- `console:operate` at platform scope, like the command center. A
-- school-scoped operator is refused: the dashboard spans every tenant's events.

create or replace function public.ops_projection_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  generated_at timestamptz := statement_timestamp();
  projection_rows jsonb;
  warning_rows jsonb;
  model_count integer;
  mapped_count integer;
  worst_rank integer;
  overall_freshness text;
begin
  if auth.uid() is null or not private.has_capability('console:operate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'console:operate at platform scope is required.';
  end if;

  with sources(projection, version, consumer, event_type, event_version) as (
    values
      ('ops_tenant_entitlements', 1, 'ops.tenant-entitlements.v1', 'entitlement.changed', 1),
      ('ops_tenant_rollout',      1, 'ops.tenant-rollout.v1',      'tenant_rollout.changed', 1)
  ),
  models as (
    select r.name, r.version, r.freshness_slo_seconds
      from private.read_model_registry r
     where r.status = 'active'
     order by r.name, r.version
     limit 100
  ),
  measured as (
    select m.name, m.version, m.freshness_slo_seconds,
           s.consumer, s.event_type,
           (s.projection is not null) as mapped,
           w.status as worker_status,
           w.last_occurred_at, w.last_processed_at,
           case
             when w.projection is null or w.last_occurred_at is null then 'unknown'
             when w.status = 'failed' then 'failed'
             when w.status = 'rebuilding' then 'stale'
             when w.last_occurred_at
                  < generated_at - make_interval(secs => m.freshness_slo_seconds) then 'stale'
             else 'fresh'
           end as freshness,
           pending.behind, pending.oldest_at,
           dead.dead_letters,
           failure.last_error,
           rebuild.status as rebuild_status, rebuild.mode as rebuild_mode,
           rebuild.finished_at as rebuild_finished_at, rebuild.parity_ok
      from models m
      left join sources s on s.projection = m.name and s.version = m.version
      left join private.projection_watermark w on w.projection = m.name and w.version = m.version
      left join lateral (
        select count(*) as behind, min(e.occurred_at) as oldest_at
          from private.domain_outbox_events e
         where s.projection is not null
           and e.event_type = s.event_type and e.event_version = s.event_version
           and e.published_at is null and e.dead_lettered_at is null
           and not exists (
             select 1 from private.domain_event_receipts r
              where r.consumer = s.consumer and r.event_id = e.id
                and r.outcome in ('processed', 'skipped'))
      ) pending on true
      left join lateral (
        select count(*) as dead_letters
          from private.domain_outbox_events e
         where s.projection is not null
           and e.event_type = s.event_type and e.event_version = s.event_version
           and e.dead_lettered_at is not null
      ) dead on true
      left join lateral (
        select left(e.last_error, 200) as last_error
          from private.domain_outbox_events e
         where s.projection is not null
           and e.event_type = s.event_type and e.event_version = s.event_version
           and e.last_error is not null
         order by coalesce(e.dead_lettered_at, e.next_attempt_at, e.occurred_at) desc, e.id
         limit 1
      ) failure on true
      left join lateral (
        select rr.status, rr.mode, rr.finished_at, rr.parity_ok
          from private.projection_rebuild_run rr
         where rr.projection = m.name
         order by rr.started_at desc, rr.id
         limit 1
      ) rebuild on true
  ),
  shaped as (
    select x.name, x.version, x.mapped,
           case x.freshness when 'failed' then 3 when 'unknown' then 2 when 'stale' then 1 else 0 end as rank,
           jsonb_build_object(
             'projection', x.name,
             'version', x.version,
             'freshness', x.freshness,
             'freshnessSloSeconds', x.freshness_slo_seconds,
             'workerStatus', coalesce(x.worker_status, 'unknown'),
             'lastEventAt', x.last_occurred_at,
             'lastProcessedAt', x.last_processed_at,
             'lagSeconds', case when x.last_occurred_at is null then null
               else greatest(0, floor(extract(epoch from generated_at - x.last_occurred_at)))::integer end,
             'eventsBehind', case when x.mapped then x.behind else null end,
             'oldestPendingSeconds', case when x.mapped and x.oldest_at is not null
               then greatest(0, floor(extract(epoch from generated_at - x.oldest_at)))::integer else null end,
             'deadLetters', case when x.mapped then x.dead_letters else null end,
             'lastError', case when x.mapped then x.last_error else null end,
             'lastRebuild', case when x.rebuild_status is null then null else jsonb_build_object(
               'status', x.rebuild_status, 'mode', x.rebuild_mode,
               'finishedAt', x.rebuild_finished_at, 'parityOk', x.parity_ok) end,
             'eventSourceMapped', x.mapped
           ) as item,
           array_remove(array[
             case when x.freshness = 'unknown' then x.name || ' has never run; do not treat it as healthy.' end,
             case when x.freshness = 'failed' then x.name || ' is failed; read lastError and let retries drain.' end,
             case when x.freshness = 'stale' and x.worker_status = 'rebuilding'
               then x.name || ' is rebuilding; its snapshot may change after parity is verified.' end,
             case when x.freshness = 'stale' and coalesce(x.worker_status, '') <> 'rebuilding'
               then x.name || ' is past its freshness SLO; check eventsBehind to tell idle from stuck.' end,
             case when x.mapped and x.dead_letters > 0
               then x.name || ' has dead-lettered events awaiting a decision.' end,
             case when not x.mapped
               then x.name || ' has no event source mapped, so eventsBehind, deadLetters and lastError are not reported.' end,
             case when x.parity_ok is false
               then x.name || ' last rebuild did not match the live projection.' end
           ], null) as warns
      from measured x
  )
  select coalesce(jsonb_agg(s.item order by s.name, s.version), '[]'::jsonb),
         count(*)::integer,
         count(*) filter (where s.mapped)::integer,
         coalesce(max(s.rank), 2),
         (select coalesce(jsonb_agg(w.warning order by w.warning), '[]'::jsonb)
            from shaped s2 cross join lateral unnest(s2.warns) as w(warning))
    into projection_rows, model_count, mapped_count, worst_rank, warning_rows
    from shaped s;

  overall_freshness := case
    when model_count = 0 then 'unknown'
    when worst_rank = 3 then 'failed'
    when worst_rank = 2 then 'unknown'
    when worst_rank = 1 then 'stale'
    else 'fresh'
  end;

  return jsonb_build_object(
    'data', jsonb_build_object('projections', projection_rows),
    'meta', jsonb_build_object(
      'generatedAt', generated_at,
      'computedAt', generated_at,
      'freshness', overall_freshness,
      'coverage', jsonb_build_object(
        'activeModels', model_count,
        'eventSourcesMapped', mapped_count
      ),
      'authority', 'derived',
      'modelVersion', 1,
      'correlationId', 'ops-projection-dashboard:'
        || floor(extract(epoch from generated_at) * 1000)::bigint::text
    ),
    'permissions', jsonb_build_object(
      'canView', true,
      'canExport', false,
      'allowedActions', '[]'::jsonb
    ),
    'warnings', warning_rows
  );
end
$$;

revoke all on function public.ops_projection_dashboard() from public, anon;
grant execute on function public.ops_projection_dashboard() to authenticated;

comment on function public.ops_projection_dashboard() is
  'Per registered read model: computed freshness, lag, events behind, dead letters, last sanitized error and last rebuild with parity. console:operate at platform scope. Reads operability metadata only, never an event payload, and writes nothing.';
