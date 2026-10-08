-- Close the remaining post-review operations-console boundaries on projects
-- that already applied the original console migrations.

-- A deleted verifier removes the account link, not the non-identifying fact
-- that verification occurred. Both console and pseudonymous verification
-- shapes remain valid.
alter table public.data_subject_request
  drop constraint if exists data_subject_request_verification_complete;

alter table public.data_subject_request
  add constraint data_subject_request_verification_complete
  check (
    (
      verified_at is null and verified_by is null
      and verification_basis is null and verification_evidence is null
      and verified_rung is null and verified_by_sha256 is null
    )
    or
    (
      verified_at is not null
      and verification_basis is not null and verification_evidence is not null
      and verified_rung is null and verified_by_sha256 is null
    )
    or
    (
      verified_at is not null and verified_by is null
      and verification_basis is null and verification_evidence is null
      and verified_rung is not null and verified_by_sha256 is not null
    )
  );

create or replace function private.clear_privacy_request_user_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.data_subject_request
     set assigned_to = null, assigned_at = null
   where assigned_to = old.id;
  update public.data_subject_request
     set verified_by = null
   where verified_by = old.id;
  return old;
end $$;

revoke all on function private.clear_privacy_request_user_links() from public, anon, authenticated;

create or replace function private.assert_current_release_request(request_detail jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requested_commit text := coalesce(request_detail ->> 'release_commit', '');
begin
  if requested_commit !~ '^[0-9a-f]{40}$' then
    raise exception 'A platform release request must name its exact 40-character commit.' using errcode = '22023';
  end if;

  if requested_commit is distinct from (
    select e.commit_sha
      from public.platform_release_evidence e
     where e.gate = 'production_migrations'
     order by e.observed_at desc, e.recorded_at desc, e.id desc
     limit 1
  ) then
    raise exception 'The release request commit does not match current migration evidence.' using errcode = '23514';
  end if;

  if exists (
    with required(gate, max_age, needs_commit) as (values
      ('production_restore', interval '90 days', false),
      ('legal_approval', interval '365 days', false),
      ('paid_infrastructure', interval '30 days', false),
      ('domain_tls', interval '30 days', false),
      ('production_migrations', interval '14 days', true)
    ), latest as (
      select distinct on (e.gate) e.gate, e.status, e.source, e.commit_sha,
             e.observed_at, e.expires_at
        from public.platform_release_evidence e
       order by e.gate, e.observed_at desc, e.recorded_at desc, e.id desc
    )
    select 1
      from required r
      left join latest l on l.gate = r.gate
     where l.gate is null or l.status <> 'pass' or l.observed_at > now()
        or coalesce(l.expires_at, l.observed_at + r.max_age) <= now()
        or coalesce(length(trim(l.source)), 0) < 3
        or (r.needs_commit and l.commit_sha is distinct from requested_commit)
  ) then
    raise exception 'Every release prerequisite must be current for the exact commit.' using errcode = '23514';
  end if;
end $$;

revoke all on function private.assert_current_release_request(jsonb) from public, anon, authenticated;

create or replace function private.check_approval_request_boundaries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_detail jsonb := coalesce(new.detail, '{}'::jsonb);
  action text := coalesce(request_detail ->> 'action', '');
begin
  -- Administrative fixtures and restore tooling may insert with no user
  -- claim. Execution transitions are always revalidated, including service
  -- tooling, because the action must not outlive its evidence.
  if tg_op = 'INSERT' and auth.uid() is null then
    return new;
  end if;

  if new.duty_id = 'integration-config' then
    if tg_op = 'INSERT' and (
      new.tenant_id is null
      or not private.has_capability('integration:configure', 'school', new.tenant_id)
    ) then
      raise exception 'integration:configure over this exact school is required.' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.integration_connections c
       where c.public_id = new.target and c.tenant_id = new.tenant_id
    ) then
      raise exception 'The integration target must belong to the authorized school.' using errcode = '23514';
    end if;
    if coalesce(request_detail ->> 'requested_change', '') not in (
      'configure', 'rotate-credential-reference', 'disable'
    ) then
      raise exception 'requested_change must be configure, rotate-credential-reference or disable.'
        using errcode = '22023';
    end if;
    if request_detail ->> 'requested_change' <> 'disable' then
      if coalesce(request_detail ->> 'credential_expiry', '') !~ '^\d{4}-\d{2}-\d{2}$'
         or (request_detail ->> 'credential_expiry')::date <= current_date then
        raise exception 'A future credential expiry date is required.' using errcode = '22023';
      end if;
    end if;
  end if;

  if new.duty_id = 'data-deletion' and tg_op = 'INSERT' and exists (
    select 1 from public.approval_request r
     where r.duty_id = 'data-deletion'
       and r.tenant_id is not distinct from new.tenant_id
       and r.target = new.target
       and (r.status = 'executed'
         or (r.status in ('pending', 'approved') and r.expires_at > now()))
  ) then
    raise exception 'A current deletion approval already exists for this request.' using errcode = '23505';
  end if;

  if new.duty_id = 'release' then
    if action not in ('release', 'rollback') then
      raise exception 'Release action must be release or rollback.' using errcode = '22023';
    end if;

    if action = 'release' then
      if new.tenant_id is not null or new.target is distinct from 'platform' then
        raise exception 'A platform release request must target platform.' using errcode = '22023';
      end if;
      perform private.assert_current_release_request(request_detail);
    else
      if coalesce(request_detail ->> 'incident_ref', '') is distinct from new.target
         or coalesce(request_detail ->> 'release_commit', '') !~ '^[0-9a-f]{40}$'
         or not exists (
           select 1 from public.platform_incident i
            where i.public_id = new.target
              and i.tenant_id is not distinct from new.tenant_id
              and i.release_commit = request_detail ->> 'release_commit'
         ) then
        raise exception 'A rollback approval must match the incident tenant and exact release commit.' using errcode = '23514';
      end if;
    end if;

    if tg_op = 'INSERT' and exists (
      select 1 from public.approval_request r
       where r.duty_id = 'release'
         and r.tenant_id is not distinct from new.tenant_id
         and r.target = new.target
         and r.detail ->> 'action' = action
         and r.detail ->> 'release_commit' = request_detail ->> 'release_commit'
         and (r.status = 'executed'
           or (r.status in ('pending', 'approved') and r.expires_at > now()))
    ) then
      raise exception 'A current exact release approval already exists.' using errcode = '23505';
    end if;
  end if;

  return new;
end $$;

revoke all on function private.check_approval_request_boundaries() from public, anon, authenticated;
drop trigger if exists approval_request_boundaries on public.approval_request;
create trigger approval_request_boundaries
  before insert or update on public.approval_request
  for each row execute function private.check_approval_request_boundaries();

-- Preserve the original reader privately, then publish a wrapper that binds
-- approvals to the exact deployed or incident commit.
do $$
begin
  if to_regprocedure('private.console_release_incidents_unbound(boolean)') is null
     and to_regprocedure('public.console_release_incidents(boolean)') is not null then
    execute 'alter function public.console_release_incidents(boolean) set schema private';
    execute 'alter function private.console_release_incidents(boolean) rename to console_release_incidents_unbound';
  end if;
end $$;

revoke all on function private.console_release_incidents_unbound(boolean) from public, anon, authenticated;

create or replace function public.console_release_incidents(include_demo boolean default false)
returns table (
  item_id text, item_kind text, tenant_id text, tenant_name text, is_demo boolean,
  state text, title text, severity text, owner text, affected_workflows text[],
  customer_impact text, communication_status text, last_notice_at timestamptz,
  next_update_at timestamptz, rollback_status text, release_commit text,
  deployment_source text, deployment_id text, observed_at timestamptz,
  expires_at timestamptz, approval_id uuid, approval_status text,
  can_request boolean, evidence text, next_safe_action text,
  classification text, provenance text, limitation text
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
  with legacy as (
    select * from private.console_release_incidents_unbound(include_demo)
  ), bound as (
    select l.*, exact.id as exact_approval_id, exact.status as exact_approval_status
      from legacy l
      left join lateral (
        select r.id,
          case when r.status in ('pending', 'approved') and r.expires_at <= now()
            then 'expired' else r.status end as status
          from public.approval_request r
         where r.duty_id = 'release'
           and r.tenant_id is not distinct from l.tenant_id
           and r.detail ->> 'release_commit' = l.release_commit
           and (
             (l.item_kind = 'release' and r.target = 'platform' and r.detail ->> 'action' = 'release')
             or
             (l.item_kind = 'incident' and r.target = l.item_id
               and r.detail ->> 'action' = 'rollback'
               and r.detail ->> 'incident_ref' = l.item_id)
           )
         order by case when r.status = 'executed' then 0 else 1 end,
                  r.created_at desc, r.id desc
         limit 1
      ) exact on true
  )
  select
    b.item_id, b.item_kind, b.tenant_id, b.tenant_name, b.is_demo,
    case when b.item_kind = 'release' and b.state = 'verified'
                   and b.exact_approval_status is distinct from 'executed'
      then 'deployed_unverified' else b.state end,
    b.title,
    case when b.item_kind = 'release' and b.state = 'verified'
                   and b.exact_approval_status is distinct from 'executed'
      then 'critical' else b.severity end,
    b.owner, b.affected_workflows,
    case when b.item_kind = 'release' and b.state = 'verified'
                   and b.exact_approval_status is distinct from 'executed'
      then 'A deployment is recorded, but no executed approval is bound to its exact commit.'
      else b.customer_impact end,
    b.communication_status, b.last_notice_at, b.next_update_at,
    case when b.item_kind = 'incident' and b.exact_approval_status is not null
      then b.exact_approval_status else b.rollback_status end,
    b.release_commit, b.deployment_source, b.deployment_id, b.observed_at, b.expires_at,
    b.exact_approval_id, b.exact_approval_status, b.can_request, b.evidence,
    case
      when b.item_kind = 'release' and b.state = 'verified'
           and b.exact_approval_status is distinct from 'executed'
        then 'Treat the deployment as unauthorized; use incident and change-control procedures before recording new exact-commit verification.'
      when b.item_kind = 'incident' and b.state = 'rollback'
           and b.exact_approval_status = 'executed'
        then 'Use the executed exact-commit rollback authorization, then verify customer workflows and publish the next update.'
      when b.item_kind = 'incident' and b.state = 'rollback'
           and b.exact_approval_status in ('pending', 'approved')
        then 'Keep the release unchanged while exact-commit rollback approval awaits execution.'
      when b.item_kind = 'incident' and b.state = 'rollback'
        then 'Request exact-commit rollback approval and keep the release unchanged until it is executed.'
      else b.next_safe_action
    end,
    b.classification, b.provenance, b.limitation
  from bound b;
end;
$$;

revoke all on function public.console_release_incidents(boolean) from public, anon;
grant execute on function public.console_release_incidents(boolean) to authenticated;

comment on function public.console_release_incidents(boolean) is
  'Evidence-derived release and incident summary for platform incident operators; no deployment or incident mutation is performed.';

do $$
begin
  if to_regprocedure('private.console_command_center_release_unbound(boolean)') is null
     and to_regprocedure('public.console_command_center(boolean)') is not null then
    execute 'alter function public.console_command_center(boolean) set schema private';
    execute 'alter function private.console_command_center(boolean) rename to console_command_center_release_unbound';
  end if;
end $$;

revoke all on function private.console_command_center_release_unbound(boolean) from public, anon, authenticated;

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
  with latest as (
    select distinct on (e.gate) e.gate, e.status, e.evidence, e.source,
           e.commit_sha, e.deployment_id, e.rollback_ref, e.observed_at, e.expires_at
      from public.platform_release_evidence e
     where e.gate in ('production_deployment', 'production_verification')
     order by e.gate, e.observed_at desc, e.recorded_at desc, e.id desc
  ), deployment as (
    select * from latest where gate = 'production_deployment'
  ), verification as (
    select * from latest where gate = 'production_verification'
  ), valid_pair as (
    select d.*, v.commit_sha as verified_commit, v.deployment_id as verified_deployment,
           v.observed_at as verified_at, v.expires_at as verification_expires,
           v.evidence as verification_evidence
      from deployment d cross join verification v
     where d.status = 'pass' and v.status = 'pass'
       and d.observed_at <= now() and v.observed_at <= now()
       and coalesce(d.expires_at, d.observed_at + interval '14 days') > now()
       and coalesce(v.expires_at, v.observed_at + interval '14 days') > now()
       and d.commit_sha ~ '^[0-9a-f]{40}$' and v.commit_sha ~ '^[0-9a-f]{40}$'
       and coalesce(length(trim(d.deployment_id)), 0) >= 3
       and coalesce(length(trim(v.deployment_id)), 0) >= 3
       and coalesce(length(trim(d.rollback_ref)), 0) >= 3
       and coalesce(length(trim(d.source)), 0) >= 3
       and coalesce(length(trim(v.source)), 0) >= 3
  ), mismatch as (
    select
      'gate:production_verification'::text, 'critical'::text, 'release gate'::text,
      'Production verification evidence'::text, null::text, null::text, false,
      'engineering'::text, coalesce(p.verification_expires, p.verified_at + interval '14 days')::timestamptz,
      'mismatched_deployment'::text,
      'Run post-deploy checks against the exact deployed commit and deployment.'::text,
      'Releases'::text, 'public.platform_release_evidence'::text,
      coalesce(p.verification_evidence, '')::text,
      'Verification for another commit, deployment, or an earlier observation cannot clear the deployed release.'::text,
      p.verified_at::timestamptz
    from valid_pair p
    where p.verified_commit is distinct from p.commit_sha
       or p.verified_deployment is distinct from p.deployment_id
       or p.verified_at < p.observed_at
  ), authorization_gap as (
    select
      'gate:release_approval'::text, 'critical'::text, 'release gate'::text,
      'Executed release approval'::text, null::text, null::text, false,
      'engineering'::text, coalesce(d.expires_at, d.observed_at + interval '14 days')::timestamptz,
      'missing_exact_approval'::text,
      'Treat the deployment as unauthorized and follow incident and change-control procedures.'::text,
      'Releases'::text, 'public.approval_request + public.platform_release_evidence'::text,
      coalesce(d.commit_sha, '')::text,
      'Deployment evidence does not become verified without an executed approval for the exact commit.'::text,
      d.observed_at::timestamptz
    from deployment d
    where d.status = 'pass' and d.observed_at <= now()
      and coalesce(d.expires_at, d.observed_at + interval '14 days') > now()
      and d.commit_sha ~ '^[0-9a-f]{40}$'
      and not exists (
        select 1 from public.approval_request r
         where r.duty_id = 'release' and r.tenant_id is null and r.target = 'platform'
           and r.detail ->> 'action' = 'release'
           and r.detail ->> 'release_commit' = d.commit_sha
           and r.status = 'executed'
      )
  )
  select * from private.console_command_center_release_unbound(include_demo)
  union all select * from mismatch
  union all select * from authorization_gap;
end;
$$;

revoke all on function public.console_command_center(boolean) from public, anon;
grant execute on function public.console_command_center(boolean) to authenticated;

comment on function public.console_command_center(boolean) is
  'Exception queue whose release gates use the same exact-commit, source, deployment, rollback and freshness contract as console_release_incidents.';
