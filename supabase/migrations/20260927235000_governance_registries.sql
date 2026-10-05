-- Semester — the governance registries, as data.
--
-- `app/src/lib/governance/` (#813) holds the operating model's rules in code:
-- the scorecard, the configuration tiers, the multi-campus hierarchy, the data
-- contracts, the incident audiences. This migration gives each of them the
-- place its *records* live, following the split the flag registry already
-- uses (see 20260927170000_integration_control_plane.sql): what a thing *is*
-- lives in code, once, held to its docs by a test; what a school or the
-- company *did* about it is a row here.
--
--   governance_policy_nodes        system → campus → school → program → course
--   governance_steward_assignments the named person in each stewardship role
--   governance_decisions           the portfolio council's decision log
--   governance_config_requests     a tenant's configuration change, step by step
--   governance_incident_notices    every incident notice that was sent
--
-- Nothing here is only a promise made by a screen. Each rule the code states
-- is enforced again where the row is written:
--
--   * a decision's total and route are computed by the database from its
--     scores, never taken from the client, and `build` on a route that does
--     not support it is refused;
--   * a configuration request names a registered setting at its own tier, and
--     cannot reach `launched` until every step before launch is recorded;
--   * a policy node sits strictly below its parent, inside the same system,
--     and cannot open a data-class route the platform floor keeps closed;
--   * a steward is a named person, not an inbox;
--   * an incident notice carries all seven sections, no unfilled placeholder,
--     its audience's required details, and a next update inside the audience's
--     cadence.
--
-- The vocabularies below are copies of the TypeScript registries, and
-- `app/src/lib/governance/schema.test.ts` reads this file and fails when the
-- two disagree. Each copy sits between `registry:` markers for that test.
--
-- Additive and idempotent. No begin/commit — the runner opens the transaction.

-- ── 0. Roles and capabilities ─────────────────────────────────────────────
--
-- The portfolio council is Semester's, not a school's, so its role is global.
-- `platform_admin` is not given `governance:decide`: it holds exactly three
-- capabilities and `capabilities.check.sql` counts them.

insert into public.app_roles (role, global) values
  ('portfolio_council', true)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('governance:decide',     'Record a portfolio decision: score a proposed capability or tenant request and decide build, partner, integrate, defer or decline.'),
  ('incident:communicate',  'Record an incident notice as sent, to one university or to every one.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('portfolio_council',  'governance:decide'),
  ('incident_responder', 'incident:communicate')
on conflict (role, capability) do nothing;

-- ── 1. The policy hierarchy ───────────────────────────────────────────────
--
-- A system node spans campuses, so it belongs to no one school; every other
-- node belongs to exactly one. Features, class routes, AI and retention may
-- only narrow going down, and brand overrides — `resolve()` in hierarchy.ts
-- computes that, reporting every clamp. What the database adds is the part a
-- resolver cannot: a node can only be *written* in a shape that resolves.

create table if not exists public.governance_policy_nodes (
  id              uuid        primary key default gen_random_uuid(),
  system_id       text        not null check (system_id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  -- registry:levels
  level           text        not null check (level in ('system', 'campus', 'school', 'program', 'course')),
  -- end registry
  parent_id       uuid        references public.governance_policy_nodes(id) on delete restrict,
  tenant_id       text        references public.schools(id) on delete cascade,
  name            text        not null check (length(trim(name)) between 1 and 200),
  features        jsonb       not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  class_routes    jsonb       not null default '{}'::jsonb check (jsonb_typeof(class_routes) = 'object'),
  ai_allowed      boolean,
  retention_days  integer     check (retention_days is null or retention_days between 1 and 3650),
  brand           jsonb       not null default '{}'::jsonb check (jsonb_typeof(brand) = 'object'),
  created_by      uuid        references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint policy_node_root_is_system check ((level = 'system') = (parent_id is null)),
  constraint policy_node_system_has_no_school check ((level = 'system') = (tenant_id is null))
);
create index if not exists governance_policy_nodes_by_parent  on public.governance_policy_nodes (parent_id);
create index if not exists governance_policy_nodes_by_tenant  on public.governance_policy_nodes (tenant_id);
create index if not exists governance_policy_nodes_by_system  on public.governance_policy_nodes (system_id, level);
create index if not exists governance_policy_nodes_by_creator on public.governance_policy_nodes (created_by);
create unique index if not exists governance_policy_nodes_one_system_root
  on public.governance_policy_nodes (system_id) where level = 'system';

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
    if parent.level = 'system' and (select auth.uid()) is not null
       and not private.has_capability('platform:configure') then
      raise exception 'Only the platform attaches a campus to a system.';
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
revoke all on function private.check_policy_node() from public, anon, authenticated;
drop trigger if exists check_policy_node on public.governance_policy_nodes;
create trigger check_policy_node
  before insert or update on public.governance_policy_nodes
  for each row execute function private.check_policy_node();
drop trigger if exists touch_governance_policy_nodes on public.governance_policy_nodes;
create trigger touch_governance_policy_nodes
  before update on public.governance_policy_nodes
  for each row execute function public.touch_updated_at();

-- The systems a school belongs to. A policy on this table cannot ask this
-- table itself without recursing, so the question goes through a definer.
create or replace function private.systems_of_school(want_school text)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select distinct n.system_id from public.governance_policy_nodes n where n.tenant_id = want_school;
$$;
revoke all on function private.systems_of_school(text) from public;
grant execute on function private.systems_of_school(text) to authenticated;

alter table public.governance_policy_nodes enable row level security;
revoke all on table public.governance_policy_nodes from anon, authenticated;
grant select, insert, update, delete on table public.governance_policy_nodes to authenticated;

drop policy if exists "school members read their policy nodes" on public.governance_policy_nodes;
create policy "school members read their policy nodes" on public.governance_policy_nodes
  for select to authenticated
  using (
    (tenant_id is not null and (tenant_id = (select private.school_of())
                                or private.has_capability('tenant:configure', 'school', tenant_id)))
    or (tenant_id is null and system_id in (select private.systems_of_school((select private.school_of()))))
    or private.has_capability('platform:configure'));
-- The platform writes any node: it is the only one that may attach a campus
-- to a system (the trigger), and a campus belongs to a school. A school's
-- configurers write that school's nodes and nobody else's.
drop policy if exists "configurers add policy nodes" on public.governance_policy_nodes;
create policy "configurers add policy nodes" on public.governance_policy_nodes
  for insert to authenticated
  with check (private.has_capability('platform:configure')
              or (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id)));
drop policy if exists "configurers change policy nodes" on public.governance_policy_nodes;
create policy "configurers change policy nodes" on public.governance_policy_nodes
  for update to authenticated
  using (private.has_capability('platform:configure')
              or (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id)))
  with check (private.has_capability('platform:configure')
              or (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id)));
drop policy if exists "configurers remove policy nodes" on public.governance_policy_nodes;
create policy "configurers remove policy nodes" on public.governance_policy_nodes
  for delete to authenticated
  using (private.has_capability('platform:configure')
              or (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id)));

-- ── 2. Steward assignments ────────────────────────────────────────────────
--
-- `readiness()` in data-contracts.ts reports a school's contract unstaffed
-- until a named person holds the data owner, data steward, integration owner
-- and privacy owner roles for it. These rows are those people. An assignment
-- is never edited into someone else: it is revoked, and a new one is made,
-- so the record says who held a role and when.

create table if not exists public.governance_steward_assignments (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete cascade,
  -- registry:connectors
  connector       text        not null check (connector in (
                    'integration.sis_read', 'integration.lms_lti', 'integration.degree_audit_read',
                    'integration.advising_crm', 'integration.career', 'integration.campus_services',
                    'integration.erp_bursar_actions')),
  -- end registry
  -- registry:steward-roles
  steward_role    text        not null check (steward_role in (
                    'data_owner', 'data_steward', 'system_owner', 'integration_owner',
                    'privacy_owner', 'security_owner', 'metric_owner', 'content_owner')),
  -- end registry
  -- A person's name. Not an address and not a placeholder: a department
  -- inbox is not an owner.
  person_name     text        not null check (
                    length(trim(person_name)) between 2 and 200
                    and position('@' in person_name) = 0
                    and trim(person_name) !~* '^(tbd|tba|todo|n/?a|none|unknown|vacant|team|office|department|inbox)$'),
  person_account  uuid        references auth.users(id) on delete set null,
  assigned_by     uuid        references auth.users(id) on delete set null default auth.uid(),
  assigned_at     timestamptz not null default now(),
  revoked_at      timestamptz,
  constraint steward_revoked_after_assigned check (revoked_at is null or revoked_at >= assigned_at)
);
create index if not exists governance_steward_by_contract
  on public.governance_steward_assignments (tenant_id, connector, steward_role);
create unique index if not exists governance_steward_one_live_holder
  on public.governance_steward_assignments (tenant_id, connector, steward_role) where revoked_at is null;
create index if not exists governance_steward_by_person   on public.governance_steward_assignments (person_account);
create index if not exists governance_steward_by_assigner on public.governance_steward_assignments (assigned_by);

alter table public.governance_steward_assignments enable row level security;
revoke all on table public.governance_steward_assignments from anon, authenticated;
grant select on table public.governance_steward_assignments to authenticated;
grant insert (tenant_id, connector, steward_role, person_name, person_account)
  on public.governance_steward_assignments to authenticated;
grant update (revoked_at) on public.governance_steward_assignments to authenticated;

drop policy if exists "school governance reads its stewards" on public.governance_steward_assignments;
create policy "school governance reads its stewards" on public.governance_steward_assignments
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('audit:read', 'school', tenant_id)
         or private.has_capability('integration:view', 'school', tenant_id)
         or person_account = (select auth.uid()));
drop policy if exists "tenant configurers assign stewards" on public.governance_steward_assignments;
create policy "tenant configurers assign stewards" on public.governance_steward_assignments
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id));
drop policy if exists "tenant configurers revoke stewards" on public.governance_steward_assignments;
create policy "tenant configurers revoke stewards" on public.governance_steward_assignments
  for update to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id) and revoked_at is null)
  with check (private.has_capability('tenant:configure', 'school', tenant_id)
              and revoked_at is not null and revoked_at <= now());

-- ── 3. The portfolio decision log ─────────────────────────────────────────
--
-- Append-only: a decision is revisited by recording a new one that
-- `supersedes` it. The total and the route are the database's arithmetic,
-- the same as `assess()` in scorecard.ts — including the rule that a single 0
-- routes to reject-or-redesign whatever the total — so a client cannot
-- record a route its own scores do not earn.

create table if not exists public.governance_decisions (
  id           uuid        primary key default gen_random_uuid(),
  public_id    text        not null unique default private.public_id('dec'),
  -- Null: a decision about the platform. Set: a decision on that school's request.
  tenant_id    text        references public.schools(id) on delete cascade,
  subject      text        not null check (length(trim(subject)) between 1 and 200),
  summary      text        not null check (length(trim(summary)) between 1 and 2000),
  scores       jsonb       not null check (jsonb_typeof(scores) = 'object'),
  total        smallint    not null default 0,
  route        text        not null default 'reject_or_redesign'
                 check (route in ('core', 'module', 'pilot', 'partner_or_decline', 'reject_or_redesign')),
  decision     text        not null check (decision in ('build', 'partner', 'integrate', 'defer', 'decline')),
  rationale    text        not null check (length(trim(rationale)) between 1 and 4000),
  review_at    date        not null,
  supersedes   uuid        references public.governance_decisions(id) on delete restrict,
  decided_by   uuid        references auth.users(id) on delete set null default auth.uid(),
  decided_at   timestamptz not null default now(),
  constraint decision_build_needs_a_buildable_route check (
    decision <> 'build' or route in ('core', 'module', 'pilot'))
);
create index if not exists governance_decisions_by_tenant_time on public.governance_decisions (tenant_id, decided_at desc);
create index if not exists governance_decisions_by_supersedes  on public.governance_decisions (supersedes);
create index if not exists governance_decisions_by_decider     on public.governance_decisions (decided_by);
create index if not exists governance_decisions_by_review      on public.governance_decisions (review_at);

create or replace function private.score_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- registry:criteria
  criteria constant text[] := array['reusability', 'security', 'privacy', 'accessibility', 'integration',
                                    'operations', 'cost', 'configuration', 'auditability', 'rollback', 'adoption'];
  -- end registry
  c text; v jsonb; sum integer := 0; zero boolean := false;
begin
  -- Every decision is looked at again. A review date already past is a
  -- decision nobody intends to revisit.
  if new.review_at <= current_date then
    raise exception 'A decision''s review date must be in the future.';
  end if;
  for c in select jsonb_object_keys(new.scores) loop
    if not c = any (criteria) then
      raise exception 'Scorecard criterion % is not one of the eleven.', c;
    end if;
  end loop;
  foreach c in array criteria loop
    v := new.scores -> c;
    -- A blank is somebody not having asked, not a pass: an incomplete card is not recorded.
    if v is null or jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[0-3]$' then
      raise exception 'Scorecard criterion % must be scored 0, 1, 2 or 3.', c;
    end if;
    sum := sum + (v #>> '{}')::integer;
    zero := zero or (v #>> '{}')::integer = 0;
  end loop;
  new.total := sum;
  new.route := case
    when zero       then 'reject_or_redesign'
    when sum >= 27  then 'core'
    when sum >= 21  then 'module'
    when sum >= 15  then 'pilot'
    else                 'partner_or_decline' end;
  return new;
end $$;
revoke all on function private.score_decision() from public, anon, authenticated;
drop trigger if exists score_decision on public.governance_decisions;
create trigger score_decision
  before insert on public.governance_decisions
  for each row execute function private.score_decision();

alter table public.governance_decisions enable row level security;
revoke all on table public.governance_decisions from anon, authenticated;
grant select on table public.governance_decisions to authenticated;
grant insert (tenant_id, subject, summary, scores, decision, rationale, review_at, supersedes)
  on public.governance_decisions to authenticated;

drop policy if exists "the council and the school read decisions" on public.governance_decisions;
create policy "the council and the school read decisions" on public.governance_decisions
  for select to authenticated
  using (private.has_capability('governance:decide')
         or (tenant_id is not null and (private.has_capability('tenant:configure', 'school', tenant_id)
                                        or private.has_capability('audit:read', 'school', tenant_id))));
drop policy if exists "the council records decisions" on public.governance_decisions;
create policy "the council records decisions" on public.governance_decisions
  for insert to authenticated
  with check (private.has_capability('governance:decide'));

-- ── 4. Configuration change requests ──────────────────────────────────────
--
-- A school asks for a registered setting; anything else is a product request
-- and goes to the council, and the never-permitted list cannot even be named
-- here because none of it is a registered key. Steps accumulate, are never
-- removed, and `launched` needs every step before launch.

create table if not exists public.governance_config_requests (
  id               uuid        primary key default gen_random_uuid(),
  public_id        text        not null unique default private.public_id('cfg'),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  setting_key      text        not null,
  tier             smallint    not null,
  requested_value  jsonb       not null,
  reason           text        not null check (length(trim(reason)) between 1 and 2000),
  -- registry:approval-steps
  steps_done       text[]      not null default array['request'] check (steps_done <@ array[
                     'request', 'classify_tier', 'security_privacy_accessibility_review', 'governance_score',
                     'approve_configure_flag', 'tenant_sandbox_test', 'uat', 'launch_with_monitoring',
                     'review_sunset_or_scale']),
  -- end registry
  status           text        not null default 'requested'
                     check (status in ('requested', 'in_review', 'approved', 'launched', 'rejected', 'withdrawn', 'sunset')),
  requested_by     uuid        references auth.users(id) on delete set null default auth.uid(),
  requested_at     timestamptz not null default now(),
  updated_by       uuid        references auth.users(id) on delete set null,
  updated_at       timestamptz not null default now(),
  -- The tier is the setting's, never the requester's choice. An unregistered
  -- key has no tier, and the coalesce is what makes that a refusal: a CHECK
  -- passes on NULL, so `tier = case … end` alone would let `tenant_script`
  -- through. (governance.check.sql caught exactly that.)
  -- registry:settings
  constraint config_request_registered_setting_at_its_tier check (tier = coalesce(case setting_key
    when 'brand.logo'                   then 1
    when 'brand.accent_color'           then 1
    when 'brand.campus_labels'          then 1
    when 'content.help_contacts'        then 1
    when 'content.public_resources'     then 1
    when 'workflow.action_templates'    then 2
    when 'workflow.deadlines'           then 2
    when 'workflow.service_routing'     then 2
    when 'workflow.notification_cadence' then 2
    when 'policy.ai_rules'              then 3
    when 'policy.data_classification'   then 3
    when 'policy.visibility'            then 3
    when 'policy.retention'             then 3
    when 'policy.marketplace'           then 3
    when 'integration.field_mapping'    then 4
    when 'integration.freshness_sla'    then 4
    when 'integration.source_ownership' then 4
    when 'extension.approved_module'    then 5
  end, 0)),
  -- end registry
  constraint config_request_approved_after_review check (
    status not in ('approved', 'launched', 'sunset') or steps_done @> array[
      'request', 'classify_tier', 'security_privacy_accessibility_review', 'governance_score',
      'approve_configure_flag']),
  constraint config_request_no_launch_step_before_the_rest check (
    not (steps_done && array['launch_with_monitoring', 'review_sunset_or_scale']) or steps_done @> array[
      'request', 'classify_tier', 'security_privacy_accessibility_review', 'governance_score',
      'approve_configure_flag', 'tenant_sandbox_test', 'uat']),
  constraint config_request_launched_after_every_step check (
    status not in ('launched', 'sunset') or steps_done @> array[
      'request', 'classify_tier', 'security_privacy_accessibility_review', 'governance_score',
      'approve_configure_flag', 'tenant_sandbox_test', 'uat'])
);
create index if not exists governance_config_requests_by_tenant_status
  on public.governance_config_requests (tenant_id, status);
create index if not exists governance_config_requests_by_requester on public.governance_config_requests (requested_by);
create index if not exists governance_config_requests_by_updater   on public.governance_config_requests (updated_by);

create or replace function private.advance_config_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.tenant_id, new.setting_key, new.tier, new.requested_value, new.reason, new.requested_by, new.requested_at)
     is distinct from
     (old.tenant_id, old.setting_key, old.tier, old.requested_value, old.reason, old.requested_by, old.requested_at) then
    raise exception 'A configuration request''s content does not change once made; make a new request.';
  end if;
  if not new.steps_done @> old.steps_done then
    raise exception 'A recorded approval step cannot be removed.';
  end if;
  if old.status in ('rejected', 'withdrawn', 'sunset') and new.status <> old.status then
    raise exception 'A % request is closed.', old.status;
  end if;
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.advance_config_request() from public, anon, authenticated;
drop trigger if exists advance_config_request on public.governance_config_requests;
create trigger advance_config_request
  before update on public.governance_config_requests
  for each row execute function private.advance_config_request();

alter table public.governance_config_requests enable row level security;
revoke all on table public.governance_config_requests from anon, authenticated;
grant select on table public.governance_config_requests to authenticated;
grant insert (tenant_id, setting_key, tier, requested_value, reason)
  on public.governance_config_requests to authenticated;
grant update (steps_done, status) on public.governance_config_requests to authenticated;

drop policy if exists "the school and its implementers read requests" on public.governance_config_requests;
create policy "the school and its implementers read requests" on public.governance_config_requests
  for select to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id)
         or private.has_capability('tenant:implement', 'school', tenant_id)
         or private.has_capability('audit:read', 'school', tenant_id));
-- A request starts at the beginning. Only an implementer moves it on.
drop policy if exists "tenant configurers make requests" on public.governance_config_requests;
create policy "tenant configurers make requests" on public.governance_config_requests
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id)
              and status = 'requested' and steps_done = array['request']);
drop policy if exists "implementers advance requests" on public.governance_config_requests;
create policy "implementers advance requests" on public.governance_config_requests
  for update to authenticated
  using (private.has_capability('tenant:implement', 'school', tenant_id))
  with check (private.has_capability('tenant:implement', 'school', tenant_id));

-- ── 5. Incident notices ───────────────────────────────────────────────────
--
-- Every notice that was sent, as it was sent. `compose()` in incident-comms.ts
-- is where a notice is built; this is where the rule is held again, because a
-- notice can be recorded by something other than that function.

create table if not exists public.governance_incident_notices (
  id              uuid        primary key default gen_random_uuid(),
  public_id       text        not null unique default private.public_id('inc'),
  -- Null: sent to every university.
  tenant_id       text        references public.schools(id) on delete cascade,
  incident_ref    text        not null check (length(trim(incident_ref)) between 1 and 100),
  -- registry:audiences
  audience        text        not null check (audience in (
                    'student_outage', 'admin_outage', 'integration_delay', 'security', 'privacy',
                    'accessibility', 'ai_quality', 'marketplace_sponsor', 'community_safety',
                    'scheduled_maintenance', 'feature_rollback')),
  -- end registry
  sections        jsonb       not null check (jsonb_typeof(sections) = 'object'),
  details         jsonb       not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  approved_by     text[]      not null check (cardinality(approved_by) >= 1),
  next_update_at  timestamptz not null,
  sent_by         uuid        references auth.users(id) on delete set null default auth.uid(),
  sent_at         timestamptz not null default now()
);
create index if not exists governance_incident_notices_by_tenant_time
  on public.governance_incident_notices (tenant_id, sent_at desc);
create index if not exists governance_incident_notices_by_incident on public.governance_incident_notices (incident_ref);
create index if not exists governance_incident_notices_by_sender   on public.governance_incident_notices (sent_by);

create or replace function private.check_incident_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- registry:sections
  sections constant text[] := array['what_happened', 'who_is_affected', 'what_is_impacted', 'what_to_do_now',
                                    'what_semester_is_doing', 'next_update', 'where_to_get_help'];
  -- end registry
  -- registry:avoid
  avoid constant text[] := array['we believe', 'probably', 'hereinafter', 'notwithstanding',
                                 'out of an abundance of caution'];
  -- end registry
  -- registry:required-details
  required jsonb := case new.audience
    when 'student_outage'    then '{"deadline_contact": null}'
    when 'integration_delay' then '{"source_system": null, "last_successful_sync": null}'
    when 'security'          then '{"data_exposure": ["Not indicated", "Suspected", "Confirmed", "Unknown"]}'
    when 'privacy'           then '{"data_classes": null, "data_exposure": ["Not indicated", "Suspected", "Confirmed", "Unknown"]}'
    when 'accessibility'     then '{"alternative_route": null}'
    when 'ai_quality'        then '{"outputs_to_distrust": null, "feature_paused": ["Yes", "No"]}'
    when 'community_safety'  then '{"crisis_contact": null}'
    when 'feature_rollback'  then '{"instead": null, "work_affected": ["Yes", "No"]}'
    else '{}' end::jsonb;
  -- end registry
  -- registry:cadence
  cadence integer := case new.audience
    when 'student_outage'        then 60
    when 'admin_outage'          then 60
    when 'integration_delay'     then 240
    when 'security'              then 60
    when 'privacy'               then 60
    when 'accessibility'         then 240
    when 'ai_quality'            then 240
    when 'marketplace_sponsor'   then 240
    when 'community_safety'      then 60
    when 'scheduled_maintenance' then 1440
    when 'feature_rollback'      then 1440 end;
  -- end registry
  s text; k text; allowed jsonb; body text := '';
begin
  foreach s in array sections loop
    if jsonb_typeof(new.sections -> s) is distinct from 'string' or length(trim(new.sections ->> s)) = 0 then
      raise exception 'Incident notice section % is missing.', s;
    end if;
    body := body || E'\n' || (new.sections ->> s);
  end loop;
  for k, allowed in select * from jsonb_each(required) loop
    if jsonb_typeof(new.details -> k) is distinct from 'string' or length(trim(new.details ->> k)) = 0 then
      raise exception 'A % notice must state %.', new.audience, k;
    end if;
    if jsonb_typeof(allowed) = 'array' and not allowed ? trim(new.details ->> k) then
      raise exception '% must be one of %.', k, allowed;
    end if;
    body := body || E'\n' || (new.details ->> k);
  end loop;
  -- Bracketed text of any case is an unfilled placeholder; a markdown link is not.
  if body ~ '\[[^]\n]+\]($|[^(])' then
    raise exception 'An incident notice still carries a placeholder.';
  end if;
  foreach s in array avoid loop
    if position(s in lower(body)) > 0 then
      raise exception 'An incident notice may not say "%": no speculation or legalese.', s;
    end if;
  end loop;
  if new.next_update_at <= new.sent_at
     or new.next_update_at > new.sent_at + make_interval(mins => cadence) then
    raise exception 'A % notice promises its next update within % minutes.', new.audience, cadence;
  end if;
  return new;
end $$;
revoke all on function private.check_incident_notice() from public, anon, authenticated;
drop trigger if exists check_incident_notice on public.governance_incident_notices;
create trigger check_incident_notice
  before insert on public.governance_incident_notices
  for each row execute function private.check_incident_notice();

alter table public.governance_incident_notices enable row level security;
revoke all on table public.governance_incident_notices from anon, authenticated;
grant select on table public.governance_incident_notices to authenticated;
grant insert (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
  on public.governance_incident_notices to authenticated;

drop policy if exists "responders and school auditors read notices" on public.governance_incident_notices;
create policy "responders and school auditors read notices" on public.governance_incident_notices
  for select to authenticated
  using (private.has_capability('incident:communicate')
         or (tenant_id is not null and private.has_capability('audit:read', 'school', tenant_id)));
drop policy if exists "responders record notices" on public.governance_incident_notices;
create policy "responders record notices" on public.governance_incident_notices
  for insert to authenticated
  with check (private.has_capability('incident:communicate'));

-- ── 6. Audit ──────────────────────────────────────────────────────────────
--
-- The three tables that change are audited into the existing
-- `tenant_policy_audit_event`, the same as every other tenant setting. The
-- decision log and the notices are append-only and are their own record.
-- A row with no school (a system node) is recorded through its own
-- `created_by` and `updated_at`, as a global kill switch is, because the audit
-- table requires a school.

alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record',
    'feature_kill_switch', 'data_classification_rules', 'integration_connections',
    'integration_scopes', 'integration_mappings', 'integration_dead_letter_events',
    'governance_policy_nodes', 'governance_steward_assignments', 'governance_config_requests'
  ));

create or replace function private.audit_governance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data   jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  caller uuid := auth.uid();
  grant_id uuid;
begin
  if event_tenant is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('tenant:configure', 'tenant:implement')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;
  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, row_data ->> 'id', lower(tg_op), before_row, after_row, caller, grant_id);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.audit_governance_change() from public, anon, authenticated;

drop trigger if exists audit_governance_policy_nodes on public.governance_policy_nodes;
create trigger audit_governance_policy_nodes
  after insert or update or delete on public.governance_policy_nodes
  for each row execute function private.audit_governance_change();
drop trigger if exists audit_governance_steward_assignments on public.governance_steward_assignments;
create trigger audit_governance_steward_assignments
  after insert or update or delete on public.governance_steward_assignments
  for each row execute function private.audit_governance_change();
drop trigger if exists audit_governance_config_requests on public.governance_config_requests;
create trigger audit_governance_config_requests
  after insert or update or delete on public.governance_config_requests
  for each row execute function private.audit_governance_change();

-- ── 7. Descriptions ───────────────────────────────────────────────────────

comment on table public.governance_policy_nodes is
  'Multi-campus policy hierarchy: system → campus → school → program → course. Policy narrows downward (resolved in app/src/lib/governance/hierarchy.ts); brand overrides. Written only in shapes that resolve.';
comment on table public.governance_steward_assignments is
  'The named person holding each stewardship role for a school''s data contract. Revoked, never reassigned in place.';
comment on table public.governance_decisions is
  'The portfolio council''s decision log. Append-only; total and route are computed from the scores by the database.';
comment on table public.governance_config_requests is
  'A school''s request to change a registered setting, and the approval steps it has passed. Launch needs every step before it.';
comment on table public.governance_incident_notices is
  'Every incident notice sent, as sent: seven sections, the audience''s required details, and a next update inside its cadence.';
