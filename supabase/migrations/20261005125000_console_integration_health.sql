-- Integration health for the Operations Console.
--
-- The browser gets an allowlisted operational summary, never the credential
-- pointer, cursor, webhook payload reference, external record reference or
-- sanitized provider message held by the underlying integration tables.
-- Tenants are derived from live exact-school `integration:view` grants in
-- addition to the platform console shell.

create or replace function public.console_integration_health(include_demo boolean default false)
returns table (
  connection_id text,
  tenant_id text,
  tenant_name text,
  is_demo boolean,
  connection_name text,
  provider_domain text,
  provider_name text,
  configuration_state text,
  health_state text,
  feature_state text,
  last_successful_sync_at timestamptz,
  freshness_target_minutes integer,
  minutes_since_success integer,
  latest_run_status text,
  latest_run_at timestamptz,
  reconciliation_state text,
  records_received integer,
  records_rejected integer,
  open_errors integer,
  critical_errors integer,
  open_dead_letters integer,
  owner_name text,
  backup_owner_name text,
  customer_impact text,
  next_safe_action text,
  configuration_approval_id uuid,
  configuration_approval_status text,
  can_request boolean,
  classification text,
  provenance text,
  limitation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.has_capability('console:operate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'console:operate at platform scope is required.';
  end if;

  if not exists (
    select 1
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
     where g.subject = (select auth.uid())
       and rc.capability = 'integration:view'
       and g.scope_kind = 'school'
       and g.scope_id <> ''
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception using errcode = '42501',
      message = 'integration:view over an exact school is required.';
  end if;

  if include_demo and exists (
    select 1
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
      join public.schools s on s.id = g.scope_id and s.is_demo
     where g.subject = (select auth.uid())
       and rc.capability = 'integration:view'
       and g.scope_kind = 'school'
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and not private.has_capability('tenant:implement', 'school', s.id)
  ) then
    raise exception using errcode = '42501',
      message = 'tenant:implement over each demo school is required to include demo integrations.';
  end if;

  return query
  with allowed as (
    select distinct s.id, s.name, s.is_demo
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
      join public.schools s on s.id = g.scope_id
     where g.subject = (select auth.uid())
       and rc.capability = 'integration:view'
       and g.scope_kind = 'school'
       and g.scope_id <> ''
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and (include_demo or not s.is_demo)
  ), facts as (
    select
      c.id,
      c.public_id,
      a.id as allowed_tenant_id,
      a.name as allowed_tenant_name,
      a.is_demo as allowed_is_demo,
      c.connection_name,
      c.provider_domain,
      c.provider_name,
      c.status,
      coalesce(flag.state::text, 'not configured') as flag_state,
      c.last_successful_sync_at,
      coalesce(owners.freshness_target_minutes,
        case when c.freshness_target is null then null
             else (extract(epoch from c.freshness_target) / 60)::integer end) as target_minutes,
      case when c.last_successful_sync_at is null or c.last_successful_sync_at > now() then null
           else (extract(epoch from now() - c.last_successful_sync_at) / 60)::integer end as since_success,
      latest.status as run_status,
      latest.started_at as run_at,
      latest.reconciliation_state,
      coalesce(latest.records_received, 0) as received,
      coalesce(latest.records_rejected, 0) as rejected,
      coalesce(problems.open_errors, 0) as open_errors,
      coalesce(problems.critical_errors, 0) as critical_errors,
      coalesce(letters.open_dead_letters, 0) as open_dead_letters,
      owners.owner_name,
      owners.backup_owner_name,
      approval.id as approval_id,
      case when approval.status in ('pending', 'approved') and approval.expires_at <= now()
        then 'expired' else approval.status end as approval_status,
      case
        when c.status in ('disconnected', 'configuring') then 'unconfigured'
        when c.last_successful_sync_at > now() then 'failed'
        when c.status = 'error' or latest.status = 'failed' or coalesce(problems.critical_errors, 0) > 0 then 'failed'
        when c.approved_at is not null
         and c.status in ('healthy', 'degraded')
         and (c.last_successful_sync_at is null
              or c.last_successful_sync_at < now() - make_interval(mins =>
                coalesce(owners.stale_threshold_minutes,
                  case when c.freshness_target is null then 2880
                       else (2 * extract(epoch from c.freshness_target) / 60)::integer end))) then 'stale'
        when c.status in ('degraded', 'paused')
          or latest.status = 'partial'
          or coalesce(problems.open_errors, 0) > 0
          or coalesce(letters.open_dead_letters, 0) > 0 then 'degraded'
        when c.status = 'healthy' then 'healthy'
        else 'unconfigured'
      end as computed_health
    from allowed a
    join public.integration_connections c on c.tenant_id = a.id
    left join public.integration_source_owners owners on owners.connection_id = c.id
    left join lateral (
      select p.state
        from public.tenant_feature_policy p
       where p.tenant_id = c.tenant_id and p.capability = c.feature_flag_key
       limit 1
    ) flag on true
    left join lateral (
      select r.status, r.started_at, r.reconciliation_state,
             r.records_received, r.records_rejected
        from public.integration_sync_runs r
       where r.connection_id = c.id
       order by r.started_at desc, r.id desc
       limit 1
    ) latest on true
    left join lateral (
      select count(*)::integer as open_errors,
             count(*) filter (where e.severity = 'critical')::integer as critical_errors
        from public.integration_sync_errors e
       where e.connection_id = c.id and e.resolved_at is null
    ) problems on true
    left join lateral (
      select count(*)::integer as open_dead_letters
        from public.integration_dead_letter_events d
       where d.connection_id = c.id and d.resolved_at is null
    ) letters on true
    left join lateral (
      select ar.id, ar.status, ar.expires_at
        from public.approval_request ar
       where ar.duty_id = 'integration-config'
         and ar.tenant_id is not distinct from c.tenant_id
         and ar.target = c.public_id
       order by ar.created_at desc, ar.id desc
       limit 1
    ) approval on true
  )
  select
    f.public_id,
    f.allowed_tenant_id,
    f.allowed_tenant_name,
    f.allowed_is_demo,
    f.connection_name,
    f.provider_domain,
    f.provider_name,
    f.status,
    f.computed_health,
    f.flag_state,
    f.last_successful_sync_at,
    f.target_minutes,
    f.since_success,
    f.run_status,
    f.run_at,
    f.reconciliation_state,
    f.received,
    f.rejected,
    f.open_errors,
    f.critical_errors,
    f.open_dead_letters,
    coalesce(f.owner_name, 'Unassigned'),
    coalesce(f.backup_owner_name, 'Unassigned'),
    case
      when f.computed_health = 'healthy' then 'No current customer impact is indicated by connector telemetry.'
      when f.computed_health = 'unconfigured' then 'This connector is not currently carrying institutional data.'
      when f.provider_domain in ('sis', 'degree_audit', 'catalog') then 'Course, degree or registration information may be delayed or incomplete.'
      when f.provider_domain in ('identity', 'advising') then 'Account access or advising workflows may be delayed.'
      when f.provider_domain = 'lms' then 'Course activity and assignment information may be delayed.'
      else 'Workflows supplied by this provider may be delayed or incomplete.'
    end,
    case
      when f.approval_status in ('pending', 'approved') then 'Keep the connector unchanged while the integration-config approval is pending or awaiting execution.'
      when f.computed_health = 'unconfigured' then 'Request integration-config approval with scope, fallback, rollback and credential-expiry evidence; never paste a credential here.'
      when f.computed_health = 'failed' then 'Keep writes stopped, confirm the provider and source owner, and use the incident path before any replay.'
      when f.computed_health = 'stale' then 'Confirm scheduler and provider freshness with the source owner; do not force a replay while a dead letter is open.'
      when f.computed_health = 'degraded' and f.open_dead_letters > 0 then 'Review the redacted dead-letter count and request a bounded replay only after the cause is understood.'
      when f.computed_health = 'degraded' then 'Review redacted error categories and reconciliation state before changing configuration.'
      else 'Continue monitoring against the declared freshness target.'
    end,
    f.approval_id,
    f.approval_status,
    private.has_capability('integration:configure', 'school', f.allowed_tenant_id) as can_request,
    'restricted'::text,
    'public.integration_connections + sync runs + redacted error/dead-letter counts + source ownership + approval_request'::text,
    'Operational metadata only. Credentials, cursors, payload references, external record references and provider messages are never returned.'::text
  from facts f
  order by
    array_position(array['failed', 'stale', 'degraded', 'unconfigured', 'healthy']::text[], f.computed_health),
    f.allowed_tenant_name,
    f.connection_name,
    f.public_id;
end $$;

revoke all on function public.console_integration_health(boolean) from public, anon;
grant execute on function public.console_integration_health(boolean) to authenticated;

comment on function public.console_integration_health(boolean) is
  'Credential-free connector health for exact schools from live integration:view grants. Demo schools require explicit inclusion plus tenant:implement.';
