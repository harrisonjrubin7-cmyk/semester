-- Live operations command center.
--
-- This deliberately creates an exception queue, not a synthetic dashboard.
-- A gate is green only while a current passing evidence row exists. Tenant
-- rows are read from their operational sources and demo schools are excluded
-- unless the caller explicitly asks for them.

create table if not exists public.platform_release_evidence (
  id           uuid        primary key default gen_random_uuid(),
  gate         text        not null check (gate in (
                 'production_restore', 'legal_approval', 'paid_infrastructure',
                 'production_deployment', 'domain_tls', 'production_migrations')),
  status       text        not null check (status in ('pass', 'fail')),
  approved_by  text        not null check (length(trim(approved_by)) between 2 and 200),
  evidence     text        not null check (length(trim(evidence)) between 3 and 1000),
  observed_at  timestamptz not null,
  expires_at   timestamptz,
  recorded_by  uuid        references auth.users(id) on delete set null default auth.uid(),
  recorded_at  timestamptz not null default now(),
  constraint platform_release_evidence_expiry check (expires_at is null or expires_at > observed_at)
);

create index if not exists platform_release_evidence_by_gate_time
  on public.platform_release_evidence (gate, observed_at desc);
create index if not exists platform_release_evidence_by_recorder
  on public.platform_release_evidence (recorded_by);

alter table public.platform_release_evidence enable row level security;
revoke all on table public.platform_release_evidence from public, anon, authenticated;
grant select on table public.platform_release_evidence to authenticated;

drop policy if exists "console operators read release evidence" on public.platform_release_evidence;
create policy "console operators read release evidence" on public.platform_release_evidence
  for select to authenticated using (private.has_capability('console:operate', 'platform', ''));

comment on table public.platform_release_evidence is
  'Dated evidence for platform release gates. Written by an audited service operation; never inferred from a verbal claim or demo.';

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
  with required_gate(gate, label, owner_name, route_name, max_age) as (
    values
      ('production_restore', 'Production restore evidence', 'engineering', 'Recovery runbook', interval '90 days'),
      ('legal_approval', 'Legal approval evidence', 'founder', 'Trust and legal', interval '365 days'),
      ('paid_infrastructure', 'Paid infrastructure evidence', 'engineering', 'Infrastructure', interval '30 days'),
      ('production_deployment', 'Production deployment evidence', 'engineering', 'Releases', interval '14 days'),
      ('domain_tls', 'Production domain and TLS evidence', 'engineering', 'Infrastructure', interval '30 days'),
      ('production_migrations', 'Production migration evidence', 'data', 'Releases', interval '14 days')
  ), latest_gate as (
    select distinct on (e.gate) e.gate, e.status, e.approved_by, e.evidence,
           e.observed_at, e.expires_at
      from public.platform_release_evidence e
     order by e.gate, e.observed_at desc
  ), queue as (
    select
      ('gate:' || g.gate)::text as id,
      'critical'::text as severity,
      'release gate'::text as category,
      g.label::text as title,
      null::text as tenant_id,
      null::text as tenant_name,
      false as is_demo,
      g.owner_name::text as owner,
      coalesce(l.expires_at, l.observed_at + g.max_age)::timestamptz as due_at,
      case
        when l.gate is null then 'missing'
        when l.status = 'fail' then 'failed'
        when coalesce(l.expires_at, l.observed_at + g.max_age) <= now() then 'expired'
        else 'pass'
      end::text as status,
      ('Record a dated production result, named approver and evidence reference for ' || g.label || '.')::text as next_step,
      g.route_name::text as route,
      'public.platform_release_evidence'::text as source,
      coalesce(l.evidence, '')::text as evidence,
      'A statement, draft, backup listing, preview deployment or synthetic run is not execution evidence.'::text as limitation,
      coalesce(l.observed_at, now())::timestamptz as observed_at
    from required_gate g
    left join latest_gate l on l.gate = g.gate
    where l.gate is null
       or l.status <> 'pass'
       or coalesce(l.expires_at, l.observed_at + g.max_age) <= now()

    union all

    select
      ('approval:' || r.id)::text,
      case when r.expires_at <= now() + interval '24 hours' then 'high' else 'medium' end::text,
      'approval'::text,
      ('Approval awaiting decision: ' || d.action)::text,
      r.tenant_id::text,
      s.name::text,
      coalesce(s.is_demo, false),
      array_to_string(d.approvers, ', ')::text,
      r.expires_at,
      r.status::text,
      'Decide in Approvals; the requester cannot approve their own request.'::text,
      'Approvals'::text,
      'public.approval_request'::text,
      r.evidence::text,
      'Only pending, unexpired requests are shown.'::text,
      now()
    from public.approval_request r
    join public.console_duty d on d.id = r.duty_id
    left join public.schools s on s.id = r.tenant_id
    where r.status = 'pending' and r.expires_at > now()
      and (include_demo or not coalesce(s.is_demo, false))

    union all

    select
      ('breakglass:' || b.id)::text,
      'critical'::text,
      'access'::text,
      'Break-glass review overdue'::text,
      b.tenant_id::text,
      s.name::text,
      s.is_demo,
      'security'::text,
      b.review_due,
      'overdue'::text,
      'Close access if still open and complete the independent post-use review.'::text,
      'Break-glass'::text,
      'public.break_glass_grant'::text,
      b.ticket::text,
      'The queue reports the grant and ticket, not student data.'::text,
      now()
    from public.break_glass_grant b
    join public.schools s on s.id = b.tenant_id
    where b.reviewed_at is null and b.review_due <= now()
      and (include_demo or not s.is_demo)

    union all

    select
      ('integration:' || c.id)::text,
      case when c.status = 'error' then 'critical' else 'high' end::text,
      'integration'::text,
      ('Integration ' || c.connection_name || ' is ' || c.status)::text,
      c.tenant_id::text,
      s.name::text,
      s.is_demo,
      coalesce(c.owner_account_id::text, 'integration')::text,
      case when c.freshness_target is null or c.last_successful_sync_at is null then null
           else c.last_successful_sync_at + c.freshness_target end,
      c.status::text,
      'Reconcile the last run, use the documented fallback, then restore or deliberately pause the connection.'::text,
      'Integrations'::text,
      'public.integration_connections'::text,
      coalesce('last successful sync ' || c.last_successful_sync_at::text, '')::text,
      'Provider availability is external; a healthy row still requires reconciliation evidence.'::text,
      coalesce(c.last_attempt_at, c.updated_at)
    from public.integration_connections c
    join public.schools s on s.id = c.tenant_id
    where c.status in ('degraded', 'error')
      and (include_demo or not s.is_demo)

    union all

    select
      ('support:' || t.id)::text,
      case when t.priority = 'high' then 'critical' else 'high' end::text,
      'support'::text,
      ('Support first response overdue: ' || t.subject)::text,
      null::text,
      null::text,
      false,
      'support'::text,
      t.first_response_due,
      t.status::text,
      'Respond through the support queue and preserve the accessibility or privacy escalation path.'::text,
      'Support'::text,
      'public.support_tickets'::text,
      ('ticket ' || t.id)::text,
      'Student identity and message body are deliberately excluded from the command center.'::text,
      t.updated_at
    from public.support_tickets t
    where t.status in ('open', 'waiting_on_student')
      and t.first_responded_at is null
      and t.first_response_due <= now()

    union all

    select
      ('rollout:' || r.tenant_id)::text,
      'high'::text,
      'launch'::text,
      ('Production tenant is missing one or more launch gates')::text,
      r.tenant_id::text,
      s.name::text,
      s.is_demo,
      'success'::text,
      null::timestamptz,
      r.state::text,
      'Record the missing security, DPA, UAT, isolation, SSO, reconciliation, accessibility, cutover and sponsor evidence before GO.'::text,
      'Customers'::text,
      'public.tenant_rollout_evidence'::text,
      (select count(distinct e.gate)::text || '/9 required gates recorded'
         from public.tenant_rollout_evidence e
        where e.tenant_id = r.tenant_id
          and e.gate in ('security_privacy_approval','dpa_executed','uat_signoff','rls_isolation_passed','sso_login_verified','source_reconciliation_passed','accessibility_review_passed','cutover_checklist_complete','sponsor_go_live'))::text,
      'Presence proves a referenced approval was recorded; it does not independently validate the linked artifact.'::text,
      r.updated_at
    from public.tenant_rollout r
    join public.schools s on s.id = r.tenant_id
    where r.state in ('production_limited', 'production_active', 'expansion')
      and (include_demo or not s.is_demo)
      and 9 > (select count(distinct e.gate) from public.tenant_rollout_evidence e
                where e.tenant_id = r.tenant_id
                  and e.gate in ('security_privacy_approval','dpa_executed','uat_signoff','rls_isolation_passed','sso_login_verified','source_reconciliation_passed','accessibility_review_passed','cutover_checklist_complete','sponsor_go_live'))
  )
  select q.id, q.severity, q.category, q.title, q.tenant_id, q.tenant_name, q.is_demo,
         q.owner, q.due_at, q.status, q.next_step, q.route, q.source, q.evidence,
         q.limitation, q.observed_at
    from queue q
   order by case q.severity when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end,
            q.due_at nulls last, q.title
   limit 500;
end $$;

revoke all on function public.console_command_center(boolean) from public, anon;
grant execute on function public.console_command_center(boolean) to authenticated;

comment on function public.console_command_center(boolean) is
  'Live, fail-closed operational exceptions for a platform console operator. Excludes demo tenants by default.';
