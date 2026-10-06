-- Reading the approval and break-glass records takes more than console:operate.
--
-- `console:operate` opens the console shell and is held by six roles
-- (platform_admin, support_agent, implementation_manager, data_steward,
-- incident_responder, trust_officer). The four policies below asked nothing
-- else, so any of the six could read every tenant's approval requests (the
-- evidence text and detail), decisions, executed-action records and
-- break-glass grants (ticket and scope) — directly through the REST API, and
-- through the three INVOKER readers `console_approvals` and
-- `console_break_glass`, which return whatever the policies let through.
-- docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md finding F-2; the permission
-- matrix rule is that console:operate is a platform-wide read key and is never
-- sufficient on its own.
--
-- The security queue is now readable by an account that holds console:operate
-- AND one of approval:decide, breakglass:request, trust:publish — in the
-- current matrix platform_admin, incident_responder and trust_officer.
-- Requesters, approvers, actors and a grant's subject keep reading their own
-- rows exactly as before; those branches are unchanged.
--
-- What this does not touch: `customer`, `customer_commitment` and
-- `customer_contract` (their readers stay platform-wide until the owner decides
-- how account_executive and customer_success reach the console, since neither
-- holds console:operate), and every other console:operate gate.
--
-- Rolling back: re-create the four policies from 20260929110000 and drop
-- private.console_security_reader().

create or replace function private.console_security_reader()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_capability('console:operate')
     and (   private.has_capability('approval:decide')
          or private.has_capability('breakglass:request')
          or private.has_capability('trust:publish'));
$$;
revoke all on function private.console_security_reader() from public, anon;
grant execute on function private.console_security_reader() to authenticated;

drop policy if exists "operators, requesters and approvers read requests" on public.approval_request;
create policy "operators, requesters and approvers read requests" on public.approval_request
  for select to authenticated
  using (
    private.console_security_reader()
    or requester = (select auth.uid())
    or private.approver_party(duty_id) is not null
  );

drop policy if exists "operators, requesters and approvers read decisions" on public.approval_decision;
create policy "operators, requesters and approvers read decisions" on public.approval_decision
  for select to authenticated
  using (
    private.console_security_reader()
    or approver = (select auth.uid())
    or exists (
      select 1 from public.approval_request r
       where r.id = request_id
         and (r.requester = (select auth.uid()) or private.approver_party(r.duty_id) is not null)
    )
  );

drop policy if exists "operators and actors read action records" on public.console_action_record;
create policy "operators and actors read action records" on public.console_action_record
  for select to authenticated
  using (private.console_security_reader() or actor = (select auth.uid()));

drop policy if exists "operators and subjects read break-glass grants" on public.break_glass_grant;
create policy "operators and subjects read break-glass grants" on public.break_glass_grant
  for select to authenticated
  using (private.console_security_reader() or subject = (select auth.uid()));
