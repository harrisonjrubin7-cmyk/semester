-- Semester — four holes in the governance registries (#828), closed.
--
-- Found reviewing 20260927235000_governance_registries.sql after it merged.
-- Each is walked in governance.check.sql as the account that could have used
-- it, and each check was seen failing against this file's absence.
--
--   1. `governance_policy_nodes` granted every column to `authenticated`, so
--      a school administrator could write `created_by` and attribute a node
--      to someone else. The other four tables grant only the columns a client
--      may set; this one now does too.
--   2. A school administrator could delete their own campus node, taking the
--      school out of its system's policy. Joining a system is the platform's
--      act (the trigger already says so); leaving is now the same.
--   3. A configuration request could move backwards — `launched` to
--      `requested` — which hides that a change ever went live. Status now
--      moves forward only.
--   4. A steward's linked account could be anybody's, and a linked account
--      can read that school's steward list. It must now be a member of the
--      school it stewards for.
--
-- And the four Codex found reviewing #828:
--
--   5. The attach-a-campus guard ran on every update, so a school could not
--      edit its own campus's policy or brand. It now runs on attachment only.
--   6. An incident notice's `approved_by` only had to be non-empty; a
--      security notice passed with ARRAY['anyone'] or ARRAY[NULL]. It must now
--      name every approver its audience requires, and nothing blank.
--   7. `sunset` needed only the steps through UAT, so a request could close
--      as sunset without ever recording its launch or its review. Launched
--      now needs the launch step, and sunset needs every step.
--   8. A notice sent to every school (no tenant) was invisible to every
--      school's auditor. Any holder of `audit:read` now reads those.
--
-- Additive and idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Column grants on policy nodes ─────────────────────────────────────

revoke insert, update on table public.governance_policy_nodes from authenticated;
grant insert (system_id, level, parent_id, tenant_id, name, features, class_routes, ai_allowed, retention_days, brand)
  on public.governance_policy_nodes to authenticated;
grant update (parent_id, name, features, class_routes, ai_allowed, retention_days, brand)
  on public.governance_policy_nodes to authenticated;

-- ── 2. Leaving a system is the platform's act ────────────────────────────

create or replace function private.guard_policy_node_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.parent_id is not null
     and exists (select 1 from public.governance_policy_nodes p
                  where p.id = old.parent_id and p.level = 'system')
     and (select auth.uid()) is not null
     and not private.has_capability('platform:configure') then
    raise exception 'Only the platform detaches a campus from a system.';
  end if;
  return old;
end $$;
revoke all on function private.guard_policy_node_removal() from public, anon, authenticated;
drop trigger if exists guard_policy_node_removal on public.governance_policy_nodes;
create trigger guard_policy_node_removal
  before delete on public.governance_policy_nodes
  for each row execute function private.guard_policy_node_removal();

-- ── 3. Configuration requests move forward only ──────────────────────────
--
-- requested → in_review → approved → launched → sunset, with rejected and
-- withdrawn reachable from anything not yet launched. The existing
-- `advance_config_request` keeps its checks; this adds the order.

create or replace function private.config_request_forward_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'requested' and new.status in ('in_review', 'approved', 'rejected', 'withdrawn'))
    or (old.status = 'in_review' and new.status in ('approved', 'rejected', 'withdrawn'))
    or (old.status = 'approved'  and new.status in ('launched', 'rejected', 'withdrawn'))
    or (old.status = 'launched'  and new.status = 'sunset')) then
    raise exception 'A configuration request cannot move from % to %.', old.status, new.status;
  end if;
  return new;
end $$;
revoke all on function private.config_request_forward_only() from public, anon, authenticated;
drop trigger if exists config_request_forward_only on public.governance_config_requests;
create trigger config_request_forward_only
  before update on public.governance_config_requests
  for each row execute function private.config_request_forward_only();

-- ── 4. A linked steward account belongs to the school ────────────────────

create or replace function private.steward_is_a_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.person_account is not null and not exists (
       select 1 from public.profiles p
        where p.user_id = new.person_account and p.school_id = new.tenant_id) then
    raise exception 'A steward''s linked account must belong to the school it stewards for.';
  end if;
  return new;
end $$;
revoke all on function private.steward_is_a_member() from public, anon, authenticated;
drop trigger if exists steward_is_a_member on public.governance_steward_assignments;
create trigger steward_is_a_member
  before insert on public.governance_steward_assignments
  for each row execute function private.steward_is_a_member();

-- The trigger guards new rows only. A link made through the hole before this
-- file ran would still let an outside account read the steward list, so those
-- links are cleared here. The name stays: the record of who held the role is
-- kept, and only the access it granted goes (Codex, #835).
update public.governance_steward_assignments s
   set person_account = null
 where s.person_account is not null
   and not exists (select 1 from public.profiles p
                    where p.user_id = s.person_account and p.school_id = s.tenant_id);

-- ── 5. A school edits its own attached campus ────────────────────────────

create or replace function private.check_policy_node()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  levels constant text[] := array['system', 'campus', 'school', 'program', 'course'];
  parent public.governance_policy_nodes;
  k text; v jsonb; d text; floor_row public.data_classification_rules; open_on_floor boolean;
begin
  if tg_op = 'UPDATE' and (new.system_id, new.level, new.tenant_id)
                          is distinct from (old.system_id, old.level, old.tenant_id) then
    raise exception 'A policy node''s system, level and school do not change; make a new node.';
  end if;

  if new.parent_id is not null then
    select * into parent from public.governance_policy_nodes where id = new.parent_id;
    if parent.id is null then
      raise exception 'Policy node parent % does not exist.', new.parent_id;
    end if;
    if parent.system_id <> new.system_id then
      raise exception 'A node in system % cannot sit under system %; systems never inherit from each other.',
        new.system_id, parent.system_id;
    end if;
    if array_position(levels, new.level) <= array_position(levels, parent.level) then
      raise exception 'A % cannot sit under a %.', new.level, parent.level;
    end if;
    if parent.level <> 'system' and parent.tenant_id is distinct from new.tenant_id then
      raise exception 'Below a campus, every node belongs to its campus''s school.';
    end if;
    -- Joining a system is an agreement between institutions, made by the
    -- platform, not something a campus administrator declares for itself.
    -- A request with no signed-in caller is the server's own.
    -- Only when the node is being attached: an insert, or a new parent. A
    -- campus already attached is its school's to edit (#828 review).
    if parent.level = 'system' and (select auth.uid()) is not null
       and not private.has_capability('platform:configure') then
      if tg_op = 'INSERT' then
        raise exception 'Only the platform attaches a campus to a system.';
      elsif new.parent_id is distinct from old.parent_id then
        raise exception 'Only the platform attaches a campus to a system.';
      end if;
    end if;
  end if;

  for k, v in select * from jsonb_each(new.features) loop
    if k !~ '^[a-z]+\.[a-z0-9_.]+$' then
      raise exception 'Feature key % is not a flag key.', k;
    end if;
    if jsonb_typeof(v) <> 'string' or (v #>> '{}') not in ('off', 'preview', 'sandbox', 'production') then
      raise exception 'Feature % must be off, preview, sandbox or production.', k;
    end if;
  end loop;

  -- A class route may be narrowed here and resolved narrower still below; it
  -- may never be opened past the platform floor, the same rule
  -- `refuse_looser_classification` enforces on a school's own rules.
  for k, v in select * from jsonb_each(new.class_routes) loop
    if k not in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6') or jsonb_typeof(v) <> 'object' then
      raise exception 'Class routes are keyed T0–T6, each an object of destinations.';
    end if;
    select * into floor_row from public.data_classification_rules r
     where r.tenant_id is null and r.classification = k;
    for d in select jsonb_object_keys(v) loop
      if d not in ('semester', 'approved_ai', 'consumer_ai', 'external_connector', 'community')
         or jsonb_typeof(v -> d) <> 'boolean' then
        raise exception 'Route %.% is not a destination with a true/false value.', k, d;
      end if;
      -- Read into a variable first: PL/pgSQL ends an IF's condition at the
      -- first THEN it meets, which would be the one inside a CASE.
      open_on_floor := case d
          when 'semester'           then floor_row.allowed_in_semester
          when 'approved_ai'        then floor_row.allowed_in_approved_ai
          when 'consumer_ai'        then floor_row.allowed_in_consumer_ai
          when 'external_connector' then floor_row.allowed_in_external_connector
          when 'community'          then floor_row.allowed_in_community end;
      if (v ->> d)::boolean and not coalesce(open_on_floor, false) then
        raise exception 'A policy node may only be stricter than the platform rule for % → %.', k, d;
      end if;
    end loop;
  end loop;

  for k in select jsonb_object_keys(new.brand) loop
    if k not in ('name', 'logo', 'accent') or jsonb_typeof(new.brand -> k) <> 'string' then
      raise exception 'Brand carries only name, logo and accent, as text.';
    end if;
  end loop;

  return new;
end $$;

-- ── 6. A notice names the approvers its audience requires ────────────────

create or replace function private.check_notice_approvers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- registry:approvers
  required text[] := case new.audience
    when 'student_outage'        then array['Incident commander']
    when 'admin_outage'          then array['Incident commander']
    when 'integration_delay'     then array['Integration owner']
    when 'security'              then array['Security owner', 'Legal']
    when 'privacy'               then array['Privacy owner', 'Legal']
    when 'accessibility'         then array['Accessibility lead']
    when 'ai_quality'            then array['AI platform lead', 'AI governance chair']
    when 'marketplace_sponsor'   then array['Trust & Safety lead', 'Legal']
    when 'community_safety'      then array['Trust & Safety lead']
    when 'scheduled_maintenance' then array['Operations lead']
    when 'feature_rollback'      then array['Product owner']
  end;
  -- end registry
begin
  if array_position(new.approved_by, null) is not null
     or exists (select 1 from unnest(new.approved_by) a where length(trim(a)) = 0) then
    raise exception 'An approver is blank.';
  end if;
  if not new.approved_by @> required then
    raise exception 'A % notice must be approved by %.', new.audience, array_to_string(required, ', ');
  end if;
  return new;
end $$;
revoke all on function private.check_notice_approvers() from public, anon, authenticated;
drop trigger if exists check_notice_approvers on public.governance_incident_notices;
create trigger check_notice_approvers
  before insert on public.governance_incident_notices
  for each row execute function private.check_notice_approvers();

-- ── 7. Launched records its launch; sunset records everything ────────────

--
-- NOT VALID: a request that launched under #828's rule (steps through UAT) is
-- a true record of what was required then, and adding a step it never took
-- would falsify it. So existing rows are not re-checked — without this, one
-- such row would abort the whole migration (Codex, #835) — while every insert
-- and every update from here on is held to the stricter rule. That includes
-- sunsetting an old launched request, which will need its launch step first.
alter table public.governance_config_requests
  drop constraint if exists config_request_launched_after_every_step;
alter table public.governance_config_requests
  add constraint config_request_launched_after_every_step check (
    status not in ('launched', 'sunset') or steps_done @> array[
      'request', 'classify_tier', 'security_privacy_accessibility_review', 'governance_score',
      'approve_configure_flag', 'tenant_sandbox_test', 'uat', 'launch_with_monitoring']) not valid;
alter table public.governance_config_requests
  drop constraint if exists config_request_sunset_after_review;
alter table public.governance_config_requests
  add constraint config_request_sunset_after_review check (
    status <> 'sunset' or steps_done @> array['launch_with_monitoring', 'review_sunset_or_scale']) not valid;

-- ── 8. Notices to every school are every school's record ─────────────────

drop policy if exists "responders and school auditors read notices" on public.governance_incident_notices;
create policy "responders and school auditors read notices" on public.governance_incident_notices
  for select to authenticated
  using (private.has_capability('incident:communicate')
         or (tenant_id is not null and private.has_capability('audit:read', 'school', tenant_id))
         or (tenant_id is null and private.has_capability_anywhere('audit:read')));
