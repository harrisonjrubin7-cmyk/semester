-- Pilot portfolio for the Operations Console.
--
-- Safe to run again; it replaces one function and restates its grant.
--
-- A read of Semester's pilot pipeline, `public.gtm_pilots`, for the person who
-- runs it. The caller needs both the platform console shell (`console:operate`)
-- and the pipeline's own write duty (`account:manage` at platform scope),
-- which is the same question the table's read policy asks through
-- `private.gtm_account_visible`. A school's configurers can read their own
-- account's pilots through that policy. This console read is not for them, and
-- it refuses them.
--
-- The browser gets an allowlisted summary. Cohort text, baselines, stakeholder
-- names, metric names and outcome signatories stay out of it. Sponsor and
-- champion come back only as yes/no. Readiness is the same list
-- `gtm_pilot_problems` gives the move to active, so the console and the
-- database guard cannot disagree. Demo schools are excluded unless asked for.
-- Nothing here writes.

create or replace function public.console_pilots(include_demo boolean default false)
returns table (
  pilot_id uuid,
  account_id uuid,
  account_public_id text,
  account_name text,
  account_status text,
  segment text,
  tenant_id text,
  tenant_name text,
  is_demo boolean,
  workflow text,
  status text,
  start_date date,
  end_date date,
  midpoint_review_date date,
  conversion_date date,
  has_sponsor boolean,
  has_champion boolean,
  annual_price_agreed boolean,
  production_data_approved boolean,
  metric_count integer,
  readiness_problems text[],
  outcome_decision text,
  outcome_signed_at date,
  unresolved_high_severity integer,
  updated_at timestamptz,
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
  if not private.has_capability('account:manage', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'account:manage at platform scope is required.';
  end if;

  return query
  select
    p.id,
    a.id,
    a.public_id,
    a.name,
    a.status,
    a.segment,
    a.tenant_id,
    s.name,
    coalesce(s.is_demo, false),
    p.workflow,
    p.status,
    p.start_date,
    p.end_date,
    p.midpoint_review_date,
    p.conversion_date,
    p.executive_sponsor is not null,
    p.operational_champion is not null,
    p.annual_price_agreed,
    p.production_data_approved,
    (select count(*)::integer from public.gtm_pilot_metrics m where m.pilot_id = p.id),
    case when p.status = 'decided' then '{}'::text[] else public.gtm_pilot_problems(p.id) end,
    o.decision,
    o.signed_at,
    o.unresolved_high_severity,
    p.updated_at,
    'public.gtm_pilots + public.gtm_accounts + public.gtm_pilot_metrics + public.gtm_pilot_outcomes'::text,
    'Pipeline records as sales entered them. Readiness is checked against the recorded plan, not observed use; cohort, baselines, names and metric text are excluded.'::text
  from public.gtm_pilots p
  join public.gtm_accounts a on a.id = p.account_id
  left join public.schools s on s.id = a.tenant_id
  left join public.gtm_pilot_outcomes o on o.pilot_id = p.id
  where include_demo or not coalesce(s.is_demo, false)
  order by
    case p.status when 'active' then 0 when 'proposed' then 1 else 2 end,
    p.end_date,
    a.name;
end $$;

revoke all on function public.console_pilots(boolean) from public, anon;
grant execute on function public.console_pilots(boolean) to authenticated;

comment on function public.console_pilots(boolean) is
  'Operations Console pilot portfolio. Requires console:operate and account:manage at platform scope; allowlisted fields only; writes nothing.';
