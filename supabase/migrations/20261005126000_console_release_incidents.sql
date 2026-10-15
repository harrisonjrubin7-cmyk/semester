-- Release and incident operations for the Operations Console.
--
-- Release state is evidence-derived and deliberately conservative: a dated
-- pass is not current without its source, deployment/migration/verification
-- evidence is not current without an exact commit, and post-deploy evidence
-- must name the same commit as the deployment. Incident rows expose only
-- operational metadata and communication cadence, never notice bodies.

alter table public.platform_release_evidence
  add column if not exists source text,
  add column if not exists commit_sha text,
  add column if not exists deployment_id text,
  add column if not exists rollback_ref text;

alter table public.platform_release_evidence
  drop constraint if exists platform_release_evidence_gate_check;
alter table public.platform_release_evidence
  drop constraint if exists platform_release_evidence_source_shape,
  drop constraint if exists platform_release_evidence_commit_shape,
  drop constraint if exists platform_release_evidence_deployment_shape,
  drop constraint if exists platform_release_evidence_rollback_shape;
alter table public.platform_release_evidence
  add constraint platform_release_evidence_gate_check check (gate in (
    'production_restore', 'legal_approval', 'paid_infrastructure',
    'production_deployment', 'production_verification', 'domain_tls', 'production_migrations'));
alter table public.platform_release_evidence
  add constraint platform_release_evidence_source_shape check (
    source is null or length(trim(source)) between 3 and 300),
  add constraint platform_release_evidence_commit_shape check (
    commit_sha is null or commit_sha ~ '^[0-9a-f]{40}$'),
  add constraint platform_release_evidence_deployment_shape check (
    deployment_id is null or length(trim(deployment_id)) between 3 and 300),
  add constraint platform_release_evidence_rollback_shape check (
    rollback_ref is null or length(trim(rollback_ref)) between 3 and 300);

comment on column public.platform_release_evidence.source is
  'The system or signed record that produced the evidence; required by console_release_incidents before a gate is current.';
comment on column public.platform_release_evidence.commit_sha is
  'Exact lowercase commit for deployment, migration and post-deploy verification evidence.';

create table if not exists public.platform_incident (
  id                 uuid        primary key default gen_random_uuid(),
  public_id          text        not null unique default private.public_id('incident'),
  tenant_id          text        references public.schools(id) on delete restrict,
  title              text        not null check (length(trim(title)) between 3 and 200),
  severity           text        not null check (severity in ('critical', 'high', 'medium', 'low')),
  status             text        not null check (status in ('detected', 'investigating', 'mitigating', 'rollback', 'recovered')),
  owner              text        not null check (length(trim(owner)) between 2 and 200),
  affected_workflows text[]      not null check (cardinality(affected_workflows) between 1 and 20),
  customer_impact    text        not null check (length(trim(customer_impact)) between 3 and 1000),
  started_at         timestamptz not null,
  recovered_at       timestamptz,
  release_commit     text        check (release_commit is null or release_commit ~ '^[0-9a-f]{40}$'),
  rollback_ref       text        check (rollback_ref is null or length(trim(rollback_ref)) between 3 and 300),
  recorded_by        uuid        references auth.users(id) on delete set null default auth.uid(),
  recorded_at        timestamptz not null default now(),
  constraint platform_incident_recovery check (
    (status = 'recovered') = (recovered_at is not null) and
    (recovered_at is null or recovered_at >= started_at))
);

create index if not exists platform_incident_by_status_time
  on public.platform_incident (status, started_at desc);
create index if not exists platform_incident_by_tenant_time
  on public.platform_incident (tenant_id, started_at desc);
create index if not exists platform_incident_by_recorder
  on public.platform_incident (recorded_by);

alter table public.platform_incident enable row level security;
revoke all on table public.platform_incident from public, anon, authenticated;

comment on table public.platform_incident is
  'Service-recorded incident lifecycle metadata. Browser sessions read an allowlisted summary only through console_release_incidents.';

create or replace function public.console_release_incidents(include_demo boolean default false)
returns table (
  item_id text,
  item_kind text,
  tenant_id text,
  tenant_name text,
  is_demo boolean,
  state text,
  title text,
  severity text,
  owner text,
  affected_workflows text[],
  customer_impact text,
  communication_status text,
  last_notice_at timestamptz,
  next_update_at timestamptz,
  rollback_status text,
  release_commit text,
  deployment_source text,
  deployment_id text,
  observed_at timestamptz,
  expires_at timestamptz,
  approval_id uuid,
  approval_status text,
  can_request boolean,
  evidence text,
  next_safe_action text,
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
     or not private.has_capability('console:operate', 'platform', '')
     or not private.has_capability('incident:communicate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'console:operate and incident:communicate at platform scope are required.';
  end if;

  return query
  with gate_definition(gate, max_age, needs_commit, needs_deployment, needs_rollback) as (
    values
      ('production_restore', interval '90 days', false, false, false),
      ('legal_approval', interval '365 days', false, false, false),
      ('paid_infrastructure', interval '30 days', false, false, false),
      ('domain_tls', interval '30 days', false, false, false),
      ('production_migrations', interval '14 days', true, false, false),
      ('production_deployment', interval '14 days', true, true, true),
      ('production_verification', interval '14 days', true, true, false)
  ), latest_gate as (
    select distinct on (e.gate)
      e.gate, e.status, e.evidence, e.source, e.commit_sha, e.deployment_id,
      e.rollback_ref, e.observed_at, e.expires_at
    from public.platform_release_evidence e
    order by e.gate, e.observed_at desc, e.recorded_at desc, e.id desc
  ), gate_state as (
    select g.gate, l.evidence, l.source, l.commit_sha, l.deployment_id, l.rollback_ref,
      l.observed_at, coalesce(l.expires_at, l.observed_at + g.max_age) as expires_at,
      l.gate is not null
        and l.status = 'pass'
        and l.observed_at <= now()
        and coalesce(l.expires_at, l.observed_at + g.max_age) > now()
        and coalesce(length(trim(l.source)), 0) >= 3
        and (not g.needs_commit or l.commit_sha ~ '^[0-9a-f]{40}$')
        and (not g.needs_deployment or coalesce(length(trim(l.deployment_id)), 0) >= 3)
        and (not g.needs_rollback or coalesce(length(trim(l.rollback_ref)), 0) >= 3) as current
    from gate_definition g
    left join latest_gate l on l.gate = g.gate
  ), release_approval as (
    select r.id,
      case when r.status in ('pending', 'approved') and r.expires_at <= now()
        then 'expired' else r.status end as status
    from public.approval_request r
    where r.duty_id = 'release'
      and r.tenant_id is null
      and r.target = 'platform'
      and r.detail ->> 'action' = 'release'
      and r.detail ->> 'release_commit' ~ '^[0-9a-f]{40}$'
      and r.detail ->> 'release_commit' =
        (select g.commit_sha from gate_state g where g.gate = 'production_migrations')
    order by r.created_at desc, r.id desc
    limit 1
  ), release_row as (
    select
      'release:platform'::text as item_id,
      'release'::text as item_kind,
      null::text as tenant_id,
      null::text as tenant_name,
      false as is_demo,
      case
        when exists (select 1 from gate_state where gate in (
          'production_restore', 'legal_approval', 'paid_infrastructure', 'domain_tls', 'production_migrations') and not current)
          then 'blocked'
        when not (select current from gate_state where gate = 'production_deployment')
          and exists (select 1 from release_approval where status in ('pending', 'approved', 'executed'))
          then 'release_candidate'
        when not (select current from gate_state where gate = 'production_deployment')
          then 'blocked'
        when not (select current from gate_state where gate = 'production_verification')
          or (select g.commit_sha from gate_state g where g.gate = 'production_verification')
             is distinct from (select g.commit_sha from gate_state g where g.gate = 'production_deployment')
          or (select g.deployment_id from gate_state g where g.gate = 'production_verification')
             is distinct from (select g.deployment_id from gate_state g where g.gate = 'production_deployment')
          or (select g.observed_at from gate_state g where g.gate = 'production_verification')
             < (select g.observed_at from gate_state g where g.gate = 'production_deployment')
          then 'deployed_unverified'
        else 'verified'
      end::text as state,
      'Production release'::text as title,
      case when exists (select 1 from gate_state where not current) then 'critical' else 'low' end::text as severity,
      'engineering'::text as owner,
      array['application', 'database', 'public origin']::text[] as affected_workflows,
      case
        when (select current from gate_state where gate = 'production_verification') then 'No current customer impact is indicated by the recorded post-deploy verification.'
        when (select current from gate_state where gate = 'production_deployment') then 'A deployment is recorded, but current post-deploy behavior is not verified.'
        else 'No production deployment is established by current evidence.'
      end::text as customer_impact,
      'not_applicable'::text as communication_status,
      null::timestamptz as last_notice_at,
      null::timestamptz as next_update_at,
      case when coalesce(length(trim((select g.rollback_ref from gate_state g where g.gate = 'production_deployment'))), 0) >= 3
        then 'documented' else 'missing' end::text as rollback_status,
      coalesce(
        (select g.commit_sha from gate_state g where g.gate = 'production_deployment' and g.current),
        (select g.commit_sha from gate_state g where g.gate = 'production_migrations' and g.current)
      )::text as release_commit,
      (select g.source from gate_state g where g.gate = 'production_deployment')::text as deployment_source,
      (select g.deployment_id from gate_state g where g.gate = 'production_deployment')::text as deployment_id,
      (select g.observed_at from gate_state g where g.gate = 'production_deployment')::timestamptz as observed_at,
      (select g.expires_at from gate_state g where g.gate = 'production_deployment')::timestamptz as expires_at,
      (select a.id from release_approval a)::uuid as approval_id,
      (select a.status from release_approval a)::text as approval_status,
      (private.party_held('engineering') and not exists (
        select 1 from gate_state where gate in (
          'production_restore', 'legal_approval', 'paid_infrastructure', 'domain_tls', 'production_migrations'
        ) and not current
      )) as can_request,
      coalesce((select string_agg(gate || '=' || case when current then 'current' else 'blocked' end, '; ' order by gate) from gate_state), '')::text as evidence,
      case
        when exists (select 1 from gate_state where gate in (
          'production_restore', 'legal_approval', 'paid_infrastructure', 'domain_tls', 'production_migrations') and not current)
          then 'Resolve every blocked prerequisite with dated source evidence before requesting or executing a release.'
        when not (select current from gate_state where gate = 'production_deployment')
          then 'Use the release approval path; execution and post-deploy verification remain separate.'
        when not (select current from gate_state where gate = 'production_verification')
          or (select g.commit_sha from gate_state g where g.gate = 'production_verification')
             is distinct from (select g.commit_sha from gate_state g where g.gate = 'production_deployment')
          or (select g.deployment_id from gate_state g where g.gate = 'production_verification')
             is distinct from (select g.deployment_id from gate_state g where g.gate = 'production_deployment')
          or (select g.observed_at from gate_state g where g.gate = 'production_verification')
             < (select g.observed_at from gate_state g where g.gate = 'production_deployment')
          then 'Run the production smoke, rollback-readiness and readback checks against the exact deployed commit.'
        else 'Continue monitoring until the evidence window expires; a green row is not institutional activation.'
      end::text as next_safe_action,
      'restricted'::text as classification,
      'public.platform_release_evidence + approval_request'::text as provenance,
      'Repository, CI, deployment, migration and runtime evidence remain separate. This summary does not deploy, approve an institution or activate a tenant.'::text as limitation
  ), incident_rows as (
    select
      i.public_id::text as item_id,
      'incident'::text as item_kind,
      i.tenant_id::text,
      s.name::text as tenant_name,
      coalesce(s.is_demo, false) as is_demo,
      case when i.status = 'rollback' then 'rollback'
           when i.status = 'recovered' then 'recovered'
           else 'incident' end::text as state,
      i.title::text,
      i.severity::text,
      i.owner::text,
      i.affected_workflows::text[],
      i.customer_impact::text,
      case when notice.sent_at is null then 'missing'
           when i.status = 'recovered' and notice.sent_at >= i.recovered_at then 'complete'
           when i.status = 'recovered' then 'missing'
           when notice.next_update_at <= now() then 'overdue'
           else 'current' end::text as communication_status,
      notice.sent_at::timestamptz as last_notice_at,
      notice.next_update_at::timestamptz,
      case when rollback_approval.status is not null then rollback_approval.status
           when i.rollback_ref is not null then 'documented'
           else 'not_requested' end::text as rollback_status,
      i.release_commit::text,
      null::text as deployment_source,
      null::text as deployment_id,
      i.started_at::timestamptz as observed_at,
      i.recovered_at::timestamptz as expires_at,
      rollback_approval.id::uuid as approval_id,
      rollback_approval.status::text as approval_status,
      private.party_held('engineering') as can_request,
      coalesce(i.rollback_ref, 'No rollback reference recorded.')::text as evidence,
      case when i.status = 'recovered' then 'Confirm the resolution notice, preserve evidence and schedule the post-incident review.'
           when i.status = 'rollback' and rollback_approval.status in ('pending', 'approved') then 'Keep the release unchanged while rollback approval awaits execution.'
           when i.status = 'rollback' and rollback_approval.status = 'executed' then 'Use the executed rollback authorization, then verify customer workflows and publish the next update.'
           when i.status = 'rollback' then 'Request rollback approval and keep the release unchanged until that approval is executed.'
           when notice.sent_at is null or notice.next_update_at <= now() then 'Publish the required audience update through the incident communications procedure.'
           else 'Maintain the narrow mitigation and update at the promised cadence.' end::text as next_safe_action,
      'restricted'::text as classification,
      'public.platform_incident + governance_incident_notices + approval_request'::text as provenance,
      'Operational impact and communication cadence only. Notice bodies, personal data and security investigation detail are not returned.'::text as limitation
    from public.platform_incident i
    left join public.schools s on s.id = i.tenant_id
    left join lateral (
      select n.sent_at, n.next_update_at
      from public.governance_incident_notices n
      where n.incident_ref = i.public_id
        and (n.tenant_id is null or n.tenant_id is not distinct from i.tenant_id)
      order by n.sent_at desc, n.id desc
      limit 1
    ) notice on true
    left join lateral (
      select r.id,
        case when r.status in ('pending', 'approved') and r.expires_at <= now()
          then 'expired' else r.status end as status
      from public.approval_request r
      where r.duty_id = 'release'
        and r.tenant_id is not distinct from i.tenant_id
        and r.target = i.public_id
        and r.detail ->> 'action' = 'rollback'
      order by r.created_at desc, r.id desc
      limit 1
    ) rollback_approval on true
    where not coalesce(s.is_demo, false)
       or (include_demo and private.has_capability('tenant:implement', 'school', i.tenant_id))
  )
  select combined.* from (
    select * from release_row
    union all
    select * from incident_rows
  ) combined
  order by
    case combined.state when 'incident' then 1 when 'rollback' then 2 when 'blocked' then 3
               when 'deployed_unverified' then 4 when 'release_candidate' then 5
               when 'recovered' then 6 else 7 end,
    combined.observed_at desc nulls last,
    combined.item_id;
end $$;

revoke all on function public.console_release_incidents(boolean) from public, anon;
grant execute on function public.console_release_incidents(boolean) to authenticated;

comment on function public.console_release_incidents(boolean) is
  'Evidence-derived release and incident summary for platform incident operators; no deployment or incident mutation is performed.';

-- Keep the command center's release exceptions on the same evidence contract
-- as the dedicated release workspace. Preserve the established non-release
-- queue behind a private function, then replace the public RPC with a wrapper
-- that recomputes release gates from the stricter schema above.
do $$
begin
  if to_regprocedure('private.console_command_center_legacy(boolean)') is null
     and to_regprocedure('public.console_command_center(boolean)') is not null then
    execute 'alter function public.console_command_center(boolean) set schema private';
    execute 'alter function private.console_command_center(boolean) rename to console_command_center_legacy';
  end if;
end $$;
revoke all on function private.console_command_center_legacy(boolean) from public, anon, authenticated;

create or replace function public.console_command_center(include_demo boolean default false)
returns table (
  id text, severity text, category text, title text,
  tenant_id text, tenant_name text, is_demo boolean,
  owner text, due_at timestamptz, status text, next_step text, route text,
  source text, evidence text, limitation text, observed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_capability('console:operate', 'platform', '') then
    raise exception using errcode = '42501', message = 'console:operate at platform scope is required.';
  end if;

  return query
  with required_gate(gate, label, owner_name, route_name, max_age, needs_commit, needs_deployment, needs_rollback) as (
    values
      ('production_restore', 'Production restore evidence', 'engineering', 'Recovery runbook', interval '90 days', false, false, false),
      ('legal_approval', 'Legal approval evidence', 'founder', 'Trust and legal', interval '365 days', false, false, false),
      ('paid_infrastructure', 'Paid infrastructure evidence', 'engineering', 'Infrastructure', interval '30 days', false, false, false),
      ('production_deployment', 'Production deployment evidence', 'engineering', 'Releases', interval '14 days', true, true, true),
      ('production_verification', 'Production verification evidence', 'engineering', 'Releases', interval '14 days', true, true, false),
      ('domain_tls', 'Production domain and TLS evidence', 'engineering', 'Infrastructure', interval '30 days', false, false, false),
      ('production_migrations', 'Production migration evidence', 'data', 'Releases', interval '14 days', true, false, false)
  ), latest_gate as (
    select distinct on (e.gate) e.gate, e.status, e.evidence, e.source, e.commit_sha,
           e.deployment_id, e.rollback_ref, e.observed_at, e.expires_at
      from public.platform_release_evidence e
     order by e.gate, e.observed_at desc, e.recorded_at desc, e.id desc
  ), gate_exception as (
    select
      ('gate:' || g.gate)::text,
      'critical'::text,
      'release gate'::text,
      g.label::text,
      null::text,
      null::text,
      false,
      g.owner_name::text,
      coalesce(l.expires_at, l.observed_at + g.max_age)::timestamptz,
      case
        when l.gate is null then 'missing'
        when l.status <> 'pass' then 'failed'
        when l.observed_at > now() then 'future_dated'
        when coalesce(l.expires_at, l.observed_at + g.max_age) <= now() then 'expired'
        when coalesce(length(trim(l.source)), 0) < 3 then 'missing_source'
        when g.needs_commit and coalesce(l.commit_sha, '') !~ '^[0-9a-f]{40}$' then 'missing_commit'
        when g.needs_deployment and coalesce(length(trim(l.deployment_id)), 0) < 3 then 'missing_deployment'
        when g.needs_rollback and coalesce(length(trim(l.rollback_ref)), 0) < 3 then 'missing_rollback'
        else 'blocked'
      end::text,
      ('Record current, source-backed production evidence for ' || g.label || '.')::text,
      g.route_name::text,
      'public.platform_release_evidence'::text,
      coalesce(l.evidence, '')::text,
      'A statement, draft, backup listing, preview deployment or synthetic run is not execution evidence.'::text,
      coalesce(l.observed_at, now())::timestamptz
    from required_gate g
    left join latest_gate l on l.gate = g.gate
    where l.gate is null
       or l.status <> 'pass'
       or l.observed_at > now()
       or coalesce(l.expires_at, l.observed_at + g.max_age) <= now()
       or coalesce(length(trim(l.source)), 0) < 3
       or (g.needs_commit and coalesce(l.commit_sha, '') !~ '^[0-9a-f]{40}$')
       or (g.needs_deployment and coalesce(length(trim(l.deployment_id)), 0) < 3)
       or (g.needs_rollback and coalesce(length(trim(l.rollback_ref)), 0) < 3)
  )
  select * from gate_exception
  union all
  select legacy.*
    from private.console_command_center_legacy(include_demo) legacy
   where legacy.category <> 'release gate';
end $$;

revoke all on function public.console_command_center(boolean) from public, anon;
grant execute on function public.console_command_center(boolean) to authenticated;

comment on function public.console_command_center(boolean) is
  'Exception queue whose release gates use the same exact-commit, source, deployment, rollback and freshness contract as console_release_incidents.';
