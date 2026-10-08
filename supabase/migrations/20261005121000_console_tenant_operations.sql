-- Tenant and pilot operations, as a metadata-only console read.
--
-- The browser supplies no tenant identifier. The function derives its tenant
-- set from the caller's live, exact-school `tenant:implement` grants and also
-- requires the platform-scoped console shell grant. This keeps a changed URL,
-- filter or saved view from widening authority.
--
-- Every result is an operational summary. In particular, the support fact
-- counts scoped, expiring access grants; it never reads support tickets,
-- student identifiers, consent reasons or student content.

create or replace function private.support_grant_current(want_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.support_access_grant g
     where g.id = want_id
       and g.revoked_at is null
       and g.expires_at > now()
       and 'learning-progress' = any(g.scopes)
       and private.support_consent_active(g.consent_id, g.tenant_id, g.student_id)
       and private.subject_has_capability(g.supporter_id, 'support:read', 'school', g.tenant_id)
  );
$$;

revoke all on function private.support_grant_current(uuid) from public, anon, authenticated;

create or replace function public.console_tenant_operations(include_demo boolean default false)
returns table (
  tenant_id text,
  tenant_name text,
  is_demo boolean,
  fact_key text,
  category text,
  label text,
  value text,
  classification text,
  provenance text,
  owner text,
  observed_at timestamptz,
  stale_after_days integer,
  limitation text,
  visibility_reason text
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

  return query
  with allowed as (
    select distinct s.id, s.name, s.is_demo, s.created_at
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
      join public.schools s on s.id = g.scope_id
     where g.subject = (select auth.uid())
       and rc.capability = 'tenant:implement'
       and g.scope_kind = 'school'
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and (include_demo or not s.is_demo)
  )
  select
    a.id,
    a.name,
    a.is_demo,
    f.fact_key,
    f.category,
    f.label,
    f.value,
    f.classification,
    f.provenance,
    f.owner,
    f.observed_at,
    f.stale_after_days,
    f.limitation,
    'Live tenant:implement grant at exact school scope.'::text
  from allowed a
  cross join lateral (
    values
      (
        'tenant'::text,
        'tenant'::text,
        'Tenant record'::text,
        'Registered tenant'::text,
        'internal'::text,
        'public.schools'::text,
        'implementation'::text,
        a.created_at,
        3650,
        'Registration proves that the tenant exists; it does not prove approval, activation or observed operation.'::text
      ),
      (
        'rollout'::text,
        'rollout'::text,
        'Rollout state'::text,
        coalesce((select r.state from public.tenant_rollout r where r.tenant_id = a.id), 'Not recorded'),
        'internal'::text,
        'public.tenant_rollout'::text,
        'implementation'::text,
        (select r.updated_at from public.tenant_rollout r where r.tenant_id = a.id),
        14,
        'A recorded lifecycle state is not evidence that every gate for that state was approved.'::text
      ),
      (
        'pilot'::text,
        'pilot'::text,
        'Pilot portfolio'::text,
        coalesce((
          select count(*)::text || ' recorded; ' || count(*) filter (where p.status = 'active') || ' active'
            from public.gtm_accounts ga
            join public.gtm_pilots p on p.account_id = ga.id
           where ga.tenant_id = a.id
          having count(*) > 0
        ), 'No pilot recorded'),
        'internal'::text,
        'public.gtm_accounts + public.gtm_pilots'::text,
        'go-to-market'::text,
        (select max(p.updated_at)
           from public.gtm_accounts ga
           join public.gtm_pilots p on p.account_id = ga.id
          where ga.tenant_id = a.id),
        14,
        'Counts and lifecycle state only; cohorts, stakeholder names, baselines and notes are intentionally excluded.'::text
      ),
      (
        'entitlement'::text,
        'entitlement'::text,
        'Tenant plan'::text,
        coalesce((select p.tier || ' / ' || p.status from public.tenant_plan p where p.tenant_id = a.id), 'No tenant plan recorded'),
        'restricted'::text,
        'public.tenant_plan'::text,
        'commercial'::text,
        (select p.updated_at from public.tenant_plan p where p.tenant_id = a.id),
        30,
        'Plan status is an entitlement input; it does not prove provider billing state or institutional activation.'::text
      ),
      (
        'contract'::text,
        'contract'::text,
        'Customer contracts'::text,
        coalesce((
          select count(k.id)::text || ' recorded; ' || count(k.id) filter (where k.signed_on is not null) || ' signed'
            from public.customer c
            join public.customer_contract k on k.customer_id = c.id
           where c.tenant_id = a.id
          having count(k.id) > 0
        ), 'No customer contract recorded'),
        'restricted'::text,
        'public.customer + public.customer_contract'::text,
        'commercial'::text,
        (select max(coalesce(k.signed_on, k.starts_on, k.ends_on))::timestamptz
           from public.customer c
           join public.customer_contract k on k.customer_id = c.id
          where c.tenant_id = a.id),
        30,
        'Contract counts and signature state only; document references, terms and commercial amounts are excluded.'::text
      ),
      (
        'integration'::text,
        'integration'::text,
        'Integration connections'::text,
        coalesce((
          select count(*)::text || ' configured; ' || count(*) filter (where c.status = 'healthy') || ' healthy; '
                 || count(*) filter (where c.status in ('degraded', 'error')) || ' degraded or error'
            from public.integration_connections c
           where c.tenant_id = a.id
          having count(*) > 0
        ), 'No integration connection recorded'),
        'restricted'::text,
        'public.integration_connections'::text,
        'integration'::text,
        (select max(c.updated_at) from public.integration_connections c where c.tenant_id = a.id),
        7,
        'Connection counts and health only; credentials, cursor state, provider details and error content are excluded.'::text
      ),
      (
        'support'::text,
        'support'::text,
        'Active support access'::text,
        (select count(*)::text || ' active scoped grant(s)'
           from public.support_access_grant g
          where g.tenant_id = a.id
            and private.support_grant_current(g.id)),
        'restricted'::text,
        'public.support_access_grant aggregate'::text,
        'support'::text,
        (select max(g.updated_at) from public.support_access_grant g where g.tenant_id = a.id),
        1,
        'Aggregate grant state only; no student identifiers, reasons, consent records, tickets or student content are queried.'::text
      ),
      (
        'readiness'::text,
        'readiness'::text,
        'Recorded rollout gates'::text,
        (select count(distinct e.gate)::text || ' distinct gate(s) recorded'
           from public.tenant_rollout_evidence e
          where e.tenant_id = a.id),
        'internal'::text,
        'public.tenant_rollout_evidence aggregate'::text,
        'trust'::text,
        (select max(e.recorded_at) from public.tenant_rollout_evidence e where e.tenant_id = a.id),
        30,
        'A gate count does not substitute repository, configuration, deployment, approval and observed-operation evidence for the same subject.'::text
      )
  ) as f(
    fact_key, category, label, value, classification, provenance, owner,
    observed_at, stale_after_days, limitation
  )
  order by a.name, a.id, f.fact_key;
end $$;

revoke all on function public.console_tenant_operations(boolean) from public, anon;
grant execute on function public.console_tenant_operations(boolean) to authenticated;

comment on function public.console_tenant_operations(boolean) is
  'Metadata-only tenant operations facts for exact-school implementation grants. Demo tenants are opt-in; student content and identifiers are excluded.';
