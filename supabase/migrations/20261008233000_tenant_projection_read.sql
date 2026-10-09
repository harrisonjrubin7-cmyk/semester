-- P1-07: the first client-readable contract over the private tenant projections.
--
-- The two materializations remain private and service-only. This single RPC
-- checks live authority for the exact requested school, returns a bounded
-- entitlement page plus the one rollout row, and computes freshness from each
-- registered model's watermark and SLO at read time. It performs no mutation
-- and does not imply that the dormant worker is deployed or scheduled.

create or replace function public.read_tenant_projection(
  want_tenant text,
  after_capability text default null,
  want_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  entitlement_registry private.read_model_registry%rowtype;
  rollout_registry private.read_model_registry%rowtype;
  entitlement_watermark private.projection_watermark%rowtype;
  rollout_watermark private.projection_watermark%rowtype;
  entitlement_freshness text;
  rollout_freshness text;
  overall_freshness text;
  entitlement_rows jsonb;
  rollout_row jsonb;
  has_more boolean;
  generated_at timestamptz := statement_timestamp();
  source_updated_at timestamptz;
  warning_rows jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not (
    private.has_capability('console:operate', 'platform', '')
    or private.has_capability('tenant:configure', 'school', want_tenant)
  ) then
    raise exception using errcode = '42501',
      message = 'console:operate at platform scope or tenant:configure over the requested tenant is required.';
  end if;

  if want_tenant is null or not exists (
    select 1 from public.schools s where s.id = want_tenant
  ) then
    raise exception using errcode = '22023', message = 'Unknown tenant.';
  end if;
  if want_limit is null or want_limit < 1 or want_limit > 100 then
    raise exception using errcode = '22023', message = 'want_limit must be between 1 and 100.';
  end if;

  select r.* into entitlement_registry
    from private.read_model_registry r
   where r.name = 'ops_tenant_entitlements' and r.version = 1
     and r.status = 'active' and r.scope_kind = 'school'
     and r.capability = 'tenant:configure';
  if not found then
    raise exception 'The tenant entitlement read model is not registered active.' using errcode = '55000';
  end if;

  select r.* into rollout_registry
    from private.read_model_registry r
   where r.name = 'ops_tenant_rollout' and r.version = 1
     and r.status = 'active' and r.scope_kind = 'school'
     and r.capability = 'tenant:configure';
  if not found then
    raise exception 'The tenant rollout read model is not registered active.' using errcode = '55000';
  end if;

  select w.* into entitlement_watermark
    from private.projection_watermark w
   where w.projection = entitlement_registry.name
     and w.version = entitlement_registry.version;
  entitlement_freshness := case
    when not found or entitlement_watermark.last_occurred_at is null then 'unknown'
    when entitlement_watermark.status = 'failed' then 'failed'
    when entitlement_watermark.status = 'rebuilding' then 'stale'
    when entitlement_watermark.last_occurred_at
         < generated_at - make_interval(secs => entitlement_registry.freshness_slo_seconds)
      then 'stale'
    else 'fresh'
  end;

  select w.* into rollout_watermark
    from private.projection_watermark w
   where w.projection = rollout_registry.name
     and w.version = rollout_registry.version;
  rollout_freshness := case
    when not found or rollout_watermark.last_occurred_at is null then 'unknown'
    when rollout_watermark.status = 'failed' then 'failed'
    when rollout_watermark.status = 'rebuilding' then 'stale'
    when rollout_watermark.last_occurred_at
         < generated_at - make_interval(secs => rollout_registry.freshness_slo_seconds)
      then 'stale'
    else 'fresh'
  end;

  overall_freshness := case
    when entitlement_freshness = 'failed' or rollout_freshness = 'failed' then 'failed'
    when entitlement_freshness = 'unknown' or rollout_freshness = 'unknown' then 'unknown'
    when entitlement_freshness = 'stale' or rollout_freshness = 'stale' then 'stale'
    else 'fresh'
  end;

  with page as (
    select p.capability, p.state::text, p.deleted, p.revision,
           p.source_occurred_at, p.projected_at
      from private.ops_tenant_entitlement_projection p
     where p.tenant_id = want_tenant
       and (after_capability is null or p.capability > after_capability)
     order by p.capability
     limit want_limit + 1
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'capability', page.capability,
        'state', page.state,
        'deleted', page.deleted,
        'revision', page.revision,
        'sourceOccurredAt', page.source_occurred_at,
        'projectedAt', page.projected_at
      ) order by page.capability
    ) filter (where page.ordinal <= want_limit), '[]'::jsonb),
    coalesce(bool_or(page.ordinal > want_limit), false)
  into entitlement_rows, has_more
  from (
    select page.*, row_number() over (order by page.capability) as ordinal
      from page
  ) page;

  select jsonb_build_object(
    'state', p.state,
    'resumeState', p.resume_state,
    'revision', p.revision,
    'sourceOccurredAt', p.source_occurred_at,
    'projectedAt', p.projected_at
  ) into rollout_row
  from private.ops_tenant_rollout_projection p
  where p.tenant_id = want_tenant;

  source_updated_at := greatest(
    entitlement_watermark.source_updated_at,
    rollout_watermark.source_updated_at
  );

  if entitlement_freshness <> 'fresh' then
    warning_rows := warning_rows || jsonb_build_array(
      'Tenant entitlement projection is ' || entitlement_freshness || '; verify against the authoritative tenant policy before a consequential action.'
    );
  end if;
  if rollout_freshness <> 'fresh' then
    warning_rows := warning_rows || jsonb_build_array(
      'Tenant rollout projection is ' || rollout_freshness || '; verify against the authoritative rollout record before a consequential action.'
    );
  end if;
  if entitlement_watermark.status = 'rebuilding' or rollout_watermark.status = 'rebuilding' then
    warning_rows := warning_rows || jsonb_build_array(
      'A projection rebuild is in progress; the returned snapshot may change after parity is verified.'
    );
  end if;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'tenantId', want_tenant,
      'entitlements', entitlement_rows,
      'rollout', rollout_row
    ),
    'meta', jsonb_build_object(
      'generatedAt', generated_at,
      'sourceUpdatedAt', source_updated_at,
      'computedAt', generated_at,
      'freshness', overall_freshness,
      'coverage', jsonb_build_object(
        'entitlements', jsonb_build_object(
          'freshness', entitlement_freshness,
          'modelVersion', entitlement_registry.version,
          'freshnessSloSeconds', entitlement_registry.freshness_slo_seconds,
          'workerStatus', coalesce(entitlement_watermark.status, 'unknown'),
          'hasMore', has_more,
          'nextCursor', case
            when has_more then entitlement_rows -> -1 ->> 'capability'
            else null
          end
        ),
        'rollout', jsonb_build_object(
          'freshness', rollout_freshness,
          'modelVersion', rollout_registry.version,
          'freshnessSloSeconds', rollout_registry.freshness_slo_seconds,
          'workerStatus', coalesce(rollout_watermark.status, 'unknown'),
          'present', rollout_row is not null
        )
      ),
      'authority', 'projection',
      'modelVersion', 1,
      'correlationId', 'tenant-projection:' || want_tenant || ':'
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

revoke all on function public.read_tenant_projection(text, text, integer)
  from public, anon;
grant execute on function public.read_tenant_projection(text, text, integer)
  to authenticated;

comment on function public.read_tenant_projection(text, text, integer) is
  'Bounded, exact-tenant read envelope over private entitlement and rollout projections with computed freshness; it performs no source mutation and does not prove worker activation.';
