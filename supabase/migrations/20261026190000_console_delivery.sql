-- Delivery portfolio for the Operations Console.
--
-- Safe to run again; it replaces one function and restates its grant.
--
-- One row per institution billing account, read from the delivery tables the
-- commercial core already keeps: implementation projects and milestones,
-- success plans and QBRs, renewal opportunities, and the latest account health
-- snapshot. The caller needs the platform console shell (`console:operate`) and
-- Semester's customer-success duty (`success:manage`) at platform scope. A
-- school's configurers can read their own account's delivery records through
-- the tables' policies; this console read is not for them, and refuses them.
--
-- The browser gets an allowlisted summary. Success-plan goals and risks, QBR
-- summaries, health signals and every owner's identity stay out of it; an
-- owner comes back only as assigned or not. Milestone counts and the next
-- milestone come from the recorded dates, not observed progress. Accounts
-- linked to a demo school are excluded unless asked for. Nothing here writes.

create or replace function public.console_delivery(include_demo boolean default false)
returns table (
  billing_account_id uuid,
  account_name text,
  tenant_ids text[],
  tenant_names text[],
  is_demo boolean,
  projects jsonb,
  has_success_plan boolean,
  success_plan_has_owner boolean,
  next_qbr_at date,
  last_qbr_on date,
  qbr_count integer,
  renewals jsonb,
  health_status text,
  health_reason text,
  health_next_action text,
  health_has_owner boolean,
  health_taken_at timestamptz,
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
  if not private.has_capability('success:manage', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'success:manage at platform scope is required.';
  end if;

  return query
  select
    b.id,
    b.name,
    coalesce((select array_agg(t.tenant_id order by t.tenant_id)
                from public.billing_account_tenants t where t.billing_account_id = b.id), '{}'::text[]),
    coalesce((select array_agg(s.name order by t.tenant_id)
                from public.billing_account_tenants t join public.schools s on s.id = t.tenant_id
               where t.billing_account_id = b.id), '{}'::text[]),
    exists (select 1 from public.billing_account_tenants t join public.schools s on s.id = t.tenant_id
             where t.billing_account_id = b.id and s.is_demo),
    coalesce((select jsonb_agg(jsonb_build_object(
                'id', p.id,
                'tenant_id', p.tenant_id,
                'stage', p.stage,
                'status', p.status,
                'kickoff_at', p.kickoff_at,
                'go_live_at', p.go_live_at,
                'has_owner', p.owner_id is not null,
                'milestones_total', (select count(*) from public.implementation_milestones m where m.project_id = p.id),
                'milestones_done', (select count(*) from public.implementation_milestones m
                                     where m.project_id = p.id and m.done_at is not null),
                'milestones_overdue', (select count(*) from public.implementation_milestones m
                                        where m.project_id = p.id and m.done_at is null and m.due_at < current_date),
                'next_milestone', (select jsonb_build_object('name', m.name, 'owner_role', m.owner_role, 'due_at', m.due_at)
                                     from public.implementation_milestones m
                                    where m.project_id = p.id and m.done_at is null
                                    order by m.due_at nulls last, m.name limit 1))
                order by p.created_at)
                from public.implementation_projects p where p.billing_account_id = b.id), '[]'::jsonb),
    sp.id is not null,
    sp.owner_id is not null,
    sp.next_qbr_at,
    (select max(q.held_on) from public.qbrs q where q.success_plan_id = sp.id),
    (select count(*)::integer from public.qbrs q where q.success_plan_id = sp.id),
    coalesce((select jsonb_agg(jsonb_build_object(
                'contract_id', r.contract_id,
                'contract_kind', c.kind,
                'renewal_date', r.renewal_date,
                'stage', r.stage,
                'outcome', r.outcome,
                'decision_on', r.decision_on,
                'has_owner', r.owner_id is not null)
                order by r.renewal_date)
                from public.renewal_opportunities r join public.contracts c on c.id = r.contract_id
               where c.billing_account_id = b.id), '[]'::jsonb),
    h.status,
    h.reason,
    h.next_action,
    h.action_owner is not null,
    h.taken_at,
    'public.implementation_projects + implementation_milestones + success_plans + qbrs + renewal_opportunities + account_health_snapshots'::text,
    'Delivery records as Semester staff entered them. Milestone progress is recorded dates, not observed use; plan goals, risks, QBR summaries, health signals and owner names are excluded.'::text
  from public.billing_accounts b
  left join public.success_plans sp on sp.billing_account_id = b.id
  left join lateral (
    select a.status, a.reason, a.next_action, a.action_owner, a.taken_at
      from public.account_health_snapshots a
     where a.billing_account_id = b.id
     order by a.taken_at desc
     limit 1) h on true
  where b.kind = 'institution'
    and (include_demo or not exists (
      select 1 from public.billing_account_tenants t join public.schools s on s.id = t.tenant_id
       where t.billing_account_id = b.id and s.is_demo))
  order by
    case h.status
      when 'implementation_blocked' then 0 when 'at_risk_commercial' then 1 when 'compliance_action' then 2
      when 'needs_attention' then 3 when 'renewal_planning' then 4 when 'expansion' then 5
      when 'healthy' then 6 else 7 end,
    b.name
  limit 500;
end $$;

revoke all on function public.console_delivery(boolean) from public, anon;
grant execute on function public.console_delivery(boolean) to authenticated;

comment on function public.console_delivery(boolean) is
  'Operations Console delivery portfolio. Requires console:operate and success:manage at platform scope; allowlisted fields only; writes nothing.';
