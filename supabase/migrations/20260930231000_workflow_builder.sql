-- The Workflow Builder: how a school defines a process, and the checks a
-- student must pass for it, without anyone writing code for it (D-1018).
--
-- The platform brief of 30 September asks for "a visual and API-backed system
-- for approved workflows": trigger, eligibility check, a plain explanation for
-- the student, a form or action, the student's confirmation, the official
-- system handoff, staff review, completion, audit. Its ten examples are the
-- ten templates below (registration clearance, advisor approval, transfer
-- credit review, study-abroad approval, tutoring referral, scholarship
-- deadline, organisation event request, internship approval, course
-- substitution, graduation application).
--
-- This file holds the DEFINITION of a workflow, never a student going through
-- one: no student, no request, no answer is stored here. One table, versioned
-- the way a school's configuration is (D-150), and one trigger:
--
--   1. A workflow's definition is a sequence of published versions 1, 2, 3 …
--      that no client edits or deletes; a rollback is a new draft copied from
--      an older version. At most one draft per school and workflow.
--   2. Whoever holds `workflow:manage` writes the draft; only
--      `workflow:publish` publishes; and whoever drafted a definition does
--      not publish it. Publishing changes nothing else in the row, and saving
--      a draft needs `workflow:manage`, so a publisher alone cannot rewrite
--      what they are to review.
--   3. Every write is checked against `private.workflow_spec()` and
--      `private.workflow_problems()`: the steps, the eligibility rules and the
--      facts a rule may read are closed lists. A rule is a fact, an operator
--      and a value; the engine (lib/workflow/engine.ts) evaluates them in
--      order and never asks a model. There is no expression a school writes.
--   4. The facts are the ones the data-governance example allows — enrolment
--      in a programme, an active term, a prerequisite, a hold's presence, an
--      advisor, an open deadline, credits earned, class year. None is a
--      grade, a balance, a diagnosis, a disciplinary or an immigration
--      detail; the test holds that list to the governance prohibitions.
--   5. A definition with an official handoff must have the student confirm
--      first, must name the office it hands off to, and must end by
--      completing. "Official systems retain authority until formally
--      replaced": the handoff step is a pointer, not a write into one.
--
-- Every function here is a trigger or a helper in `private`; none is callable
-- by a client, so the grants allowlist and the definer register are unchanged.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('workflow:manage',  'Draft one school''s workflow definitions in the Workflow Builder. Cannot publish a definition they wrote.'),
  ('workflow:publish', 'Publish a draft workflow definition for one school, never one they drafted.'),
  ('workflow:view',    'Read one school''s workflow drafts and published versions.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('implementation_manager',   'workflow:manage'),
  ('implementation_manager',   'workflow:view'),
  ('integration_admin',        'workflow:manage'),
  ('integration_admin',        'workflow:view'),
  ('university_admin',         'workflow:manage'),
  ('university_admin',         'workflow:publish'),
  ('university_admin',         'workflow:view'),
  ('registrar',                'workflow:publish'),
  ('registrar',                'workflow:view'),
  ('institutional_researcher', 'workflow:view')
on conflict (role, capability) do nothing;

-- ── 2. The spec ───────────────────────────────────────────────────────────

-- The closed lists a definition is built from. `lib/workflow/spec.ts` carries
-- the same and `spec.test.ts` holds them equal.
create or replace function private.workflow_spec()
returns jsonb language sql immutable set search_path = '' as $$
  select $j${
    "workflows": ["registration_clearance", "advisor_approval", "transfer_credit_review", "study_abroad_approval",
                  "tutoring_referral", "scholarship_deadline", "org_event_request", "internship_approval",
                  "course_substitution", "graduation_application"],
    "step_kinds": ["student_form", "rule_check", "staff_review", "student_confirm", "official_handoff", "notify", "complete"],
    "owners": ["student", "advisor", "registrar", "office", "system"],
    "facts": {
      "program_enrolled":      {"type": "bool"},
      "term_active":           {"type": "bool"},
      "prerequisite_complete": {"type": "bool"},
      "hold_present":          {"type": "bool"},
      "advisor_assigned":      {"type": "bool"},
      "deadline_open":         {"type": "bool"},
      "credits_earned":        {"type": "int", "min": 0, "max": 400},
      "class_year":            {"type": "int", "min": 1, "max": 6}
    },
    "ops": {"bool": ["eq"], "int": ["eq", "neq", "gte", "lte"]},
    "limits": {"steps_max": 12, "requires_max": 10, "sla_days_max": 60,
               "title_max": 120, "explain_max": 300, "next_step_max": 200, "handoff_max": 200}
  }$j$::jsonb;
$$;
revoke all on function private.workflow_spec() from public, anon;
grant execute on function private.workflow_spec() to authenticated;

-- Whether a string is fit to store: printable, and no run of 13 to 19 digits.
create or replace function private.workflow_text_ok(t text, max_len int)
returns boolean language sql immutable set search_path = '' as $$
  select length(trim(t)) between 1 and max_len
     and t !~ '[[:cntrl:]]'
     and t !~ '[0-9]([ -]?[0-9]){12,18}';
$$;
revoke all on function private.workflow_text_ok(text, int) from public, anon;
grant execute on function private.workflow_text_ok(text, int) to authenticated;

-- What is wrong with a definition, as codes, in the order lib/workflow/spec.ts
-- checks them. Empty means it may be stored.
create or replace function private.workflow_problems(d jsonb)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  spec jsonb := private.workflow_spec();
  lim jsonb := spec -> 'limits';
  out text[] := '{}';
  k text;
  st jsonb;
  rq jsonb;
  i int;
  seen text[] := '{}';
  sid text;
  fact_spec jsonb;
  ftype text;
  ok boolean;
  n_steps int;
  n_req int;
  has_confirm boolean := false;
  has_handoff boolean := false;
  last_kind text;
begin
  if d is null or jsonb_typeof(d) <> 'object' then return array['not_object']; end if;
  if length(d::text) > 16384 then return array['too_large']; end if;

  for k in select key from jsonb_object_keys(d) as key order by key loop
    if k not in ('title', 'steps', 'requires', 'handoff') then out := array_append(out, 'unknown_key:' || k); end if;
  end loop;

  if jsonb_typeof(d -> 'title') is distinct from 'string'
     or not private.workflow_text_ok(d ->> 'title', (lim ->> 'title_max')::int) then
    out := array_append(out, 'title');
  end if;

  if jsonb_typeof(d -> 'steps') is distinct from 'array' then
    out := array_append(out, 'steps_count');
  else
    n_steps := jsonb_array_length(d -> 'steps');
    if n_steps < 1 or n_steps > (lim ->> 'steps_max')::int then out := array_append(out, 'steps_count'); end if;
    i := 0;
    for st in select value from jsonb_array_elements(d -> 'steps') loop
      i := i + 1;
      if jsonb_typeof(st) <> 'object' then
        out := array_append(out, 'step_shape:' || i);
        continue;
      end if;
      sid := case when jsonb_typeof(st -> 'id') = 'string' then st ->> 'id' else null end;
      if sid is null or sid !~ '^[a-z][a-z0-9_]{0,23}$' then
        out := array_append(out, 'step_id:' || i);
        sid := '#' || i;
      elsif sid = any (seen) then
        out := array_append(out, 'dup_step:' || sid);
      end if;
      seen := array_append(seen, sid);
      -- Closed, like the definition itself: a step holds these five keys and
      -- nothing else, so a field such as a student's email has nowhere to sit.
      if exists (select 1 from jsonb_object_keys(st) as key
                  where key not in ('id', 'kind', 'title', 'owner', 'sla_days')) then
        out := array_append(out, 'step_unknown_key:' || sid);
      end if;
      if jsonb_typeof(st -> 'kind') is distinct from 'string'
         or not ((spec -> 'step_kinds') @> jsonb_build_array(st ->> 'kind')) then
        out := array_append(out, 'step_kind:' || sid);
      else
        if st ->> 'kind' = 'student_confirm' then has_confirm := true; end if;
        if st ->> 'kind' = 'official_handoff' then
          has_handoff := true;
          if not has_confirm then out := array_append(out, 'confirm_before_handoff:' || sid); end if;
        end if;
      end if;
      if jsonb_typeof(st -> 'title') is distinct from 'string'
         or not private.workflow_text_ok(st ->> 'title', (lim ->> 'title_max')::int) then
        out := array_append(out, 'step_title:' || sid);
      end if;
      if jsonb_typeof(st -> 'owner') is distinct from 'string'
         or not ((spec -> 'owners') @> jsonb_build_array(st ->> 'owner')) then
        out := array_append(out, 'step_owner:' || sid);
      end if;
      if st ? 'sla_days' then
        ok := case when jsonb_typeof(st -> 'sla_days') = 'number' and (st ->> 'sla_days') ~ '^[0-9]{1,3}$'
                   then (st ->> 'sla_days')::int between 1 and (lim ->> 'sla_days_max')::int
                   else false end;
        if not ok then out := array_append(out, 'step_sla:' || sid); end if;
      end if;
      last_kind := st ->> 'kind';
    end loop;
    if n_steps >= 1 and last_kind is distinct from 'complete' then out := array_append(out, 'last_step_complete'); end if;
  end if;

  if d ? 'requires' then
    if jsonb_typeof(d -> 'requires') <> 'array' then
      out := array_append(out, 'requires_count');
    else
      n_req := jsonb_array_length(d -> 'requires');
      if n_req > (lim ->> 'requires_max')::int then out := array_append(out, 'requires_count'); end if;
      seen := '{}';
      i := 0;
      for rq in select value from jsonb_array_elements(d -> 'requires') loop
        i := i + 1;
        if jsonb_typeof(rq) <> 'object' then
          out := array_append(out, 'req_shape:' || i);
          continue;
        end if;
        sid := case when jsonb_typeof(rq -> 'id') = 'string' then rq ->> 'id' else null end;
        if sid is null or sid !~ '^[a-z][a-z0-9_]{0,23}$' then
          out := array_append(out, 'req_id:' || i);
          sid := '#' || i;
        elsif sid = any (seen) then
          out := array_append(out, 'dup_req:' || sid);
        end if;
        seen := array_append(seen, sid);
        if exists (select 1 from jsonb_object_keys(rq) as key
                    where key not in ('id', 'fact', 'op', 'value', 'explain', 'next_step')) then
          out := array_append(out, 'req_unknown_key:' || sid);
        end if;
        fact_spec := case when jsonb_typeof(rq -> 'fact') = 'string' then spec -> 'facts' -> (rq ->> 'fact') else null end;
        if fact_spec is null then
          out := array_append(out, 'req_fact:' || sid);
        else
          ftype := fact_spec ->> 'type';
          if jsonb_typeof(rq -> 'op') is distinct from 'string'
             or not ((spec -> 'ops' -> ftype) @> jsonb_build_array(rq ->> 'op')) then
            out := array_append(out, 'req_op:' || sid);
          end if;
          ok := case ftype
            when 'bool' then jsonb_typeof(rq -> 'value') = 'boolean'
            else case when jsonb_typeof(rq -> 'value') = 'number' and (rq ->> 'value') ~ '^[0-9]{1,4}$'
                   then (rq ->> 'value')::int between (fact_spec ->> 'min')::int and (fact_spec ->> 'max')::int
                   else false end
          end;
          if not ok then out := array_append(out, 'req_value:' || sid); end if;
        end if;
        if jsonb_typeof(rq -> 'explain') is distinct from 'string'
           or not private.workflow_text_ok(rq ->> 'explain', (lim ->> 'explain_max')::int) then
          out := array_append(out, 'req_explain:' || sid);
        end if;
        if jsonb_typeof(rq -> 'next_step') is distinct from 'string'
           or not private.workflow_text_ok(rq ->> 'next_step', (lim ->> 'next_step_max')::int) then
          out := array_append(out, 'req_next:' || sid);
        end if;
      end loop;
    end if;
  end if;

  if d ? 'handoff' then
    if jsonb_typeof(d -> 'handoff') is distinct from 'string'
       or not private.workflow_text_ok(d ->> 'handoff', (lim ->> 'handoff_max')::int) then
      out := array_append(out, 'handoff');
    end if;
  end if;
  if has_handoff and not (d ? 'handoff') then out := array_append(out, 'handoff_missing'); end if;
  return out;
end $$;
revoke all on function private.workflow_problems(jsonb) from public, anon;
grant execute on function private.workflow_problems(jsonb) to authenticated;

-- ── 3. The record ─────────────────────────────────────────────────────────

create table if not exists public.workflow_versions (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  workflow       text        not null check (workflow in (
                   'registration_clearance', 'advisor_approval', 'transfer_credit_review', 'study_abroad_approval',
                   'tutoring_referral', 'scholarship_deadline', 'org_event_request', 'internship_approval',
                   'course_substitution', 'graduation_application')),
  state          text        not null default 'draft' check (state in ('draft', 'published')),
  -- Null while a draft; the workflow's next number when published.
  version        integer     check (version >= 1),
  definition     jsonb       not null,
  note           text        not null default '' check (length(note) <= 500),
  -- The published version this draft started from, when it is a rollback or an edit of the current one.
  based_on       integer     check (based_on >= 1),
  -- Cleared if the person's account is deleted; the version stays with the school.
  created_by     uuid        default auth.uid() references auth.users(id) on delete set null,
  published_by   uuid        references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz,
  constraint workflow_state check ((state = 'published') = (version is not null and published_at is not null))
);
create unique index if not exists workflow_one_draft
  on public.workflow_versions (tenant_id, workflow) where state = 'draft';
create unique index if not exists workflow_one_version
  on public.workflow_versions (tenant_id, workflow, version) where state = 'published';
-- The two unique indexes above are partial, so neither covers the school's foreign key on its own.
create index if not exists workflow_by_tenant on public.workflow_versions (tenant_id, workflow);
create index if not exists workflow_by_creator on public.workflow_versions (created_by);
create index if not exists workflow_by_publisher on public.workflow_versions (published_by);

-- ── 4. The guard ──────────────────────────────────────────────────────────

create or replace function private.workflow_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  problems text[];
  next_v integer;
begin
  if tg_op = 'INSERT' then
    new.state := 'draft';
    new.version := null;
    new.published_at := null;
    new.published_by := null;
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
  else
    -- Account deletion clearing a person is not a change to the workflow.
    -- Only the deletion itself is exempt: it runs with no signed-in caller. A
    -- signed-in client nulling `created_by` is a change like any other, or a
    -- drafter could clear their own name and then publish their own draft.
    if auth.uid() is null
       and ((new.created_by is null and old.created_by is not null)
            or (new.published_by is null and old.published_by is not null)) then
      if (to_jsonb(new) - array['created_by', 'published_by']) = (to_jsonb(old) - array['created_by', 'published_by']) then
        return new;
      end if;
    end if;

    if old.state = 'published' then
      raise exception 'A published version is not edited; draft a new one.' using errcode = '23514';
    end if;
    if new.tenant_id is distinct from old.tenant_id or new.workflow is distinct from old.workflow then
      raise exception 'A workflow stays with its school and its kind.' using errcode = '42501';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Who drafted a workflow is not changed.' using errcode = '42501';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
    -- Whoever last changed what a draft says is the person who wrote it. The
    -- name is otherwise pinned, which let an account holding both capabilities
    -- rewrite somebody else's draft and then publish it: a second person who
    -- had reviewed nothing of what they wrote. Now the rewrite makes them the
    -- drafter, the original drafter becomes the one who may review it, and
    -- saving the same content again changes nothing.
    if old.state = 'draft' and new.state = 'draft' and auth.uid() is not null
       and auth.uid() is distinct from old.created_by
       and (new.definition is distinct from old.definition
            or new.note is distinct from old.note
            or new.based_on is distinct from old.based_on) then
      new.created_by := auth.uid();
    end if;
  end if;

  -- Saving a draft is drafting: publishing rights alone do not edit what they are to review.
  if tg_op = 'UPDATE' and new.state = 'draft'
     and not private.has_capability('workflow:manage', 'school', new.tenant_id) then
    raise exception 'Your account cannot change a draft at this school.' using errcode = '42501';
  end if;

  problems := private.workflow_problems(new.definition);
  if cardinality(problems) > 0 then
    raise exception 'This workflow is not valid: %', array_to_string(problems, ', ') using errcode = '23514';
  end if;

  if new.based_on is not null and not exists (
       select 1 from public.workflow_versions v
        where v.tenant_id = new.tenant_id and v.workflow = new.workflow
          and v.state = 'published' and v.version = new.based_on) then
    raise exception 'There is no published version % of %.', new.based_on, new.workflow using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.state = 'published' then
    -- Publishing: a second person, with the capability, and nothing else changing.
    if not private.has_capability('workflow:publish', 'school', new.tenant_id) then
      raise exception 'Your account cannot publish workflows at this school.' using errcode = '42501';
    end if;
    if auth.uid() is not distinct from old.created_by then
      raise exception 'Whoever drafted a workflow does not publish it.' using errcode = '42501';
    end if;
    if new.definition is distinct from old.definition or new.note is distinct from old.note or new.based_on is distinct from old.based_on then
      raise exception 'A draft is published as it was reviewed; save it again and have it published.' using errcode = '23514';
    end if;
    select coalesce(max(v.version), 0) + 1 into next_v
      from public.workflow_versions v
     where v.tenant_id = new.tenant_id and v.workflow = new.workflow and v.state = 'published';
    new.version := next_v;
    new.published_by := auth.uid();
    new.published_at := now();
  end if;
  return new;
end $$;
revoke all on function private.workflow_guard() from public, anon, authenticated;
drop trigger if exists workflow_guard on public.workflow_versions;
create trigger workflow_guard before insert or update on public.workflow_versions
  for each row execute function private.workflow_guard();

-- ── 5. Row-level security ─────────────────────────────────────────────────

alter table public.workflow_versions enable row level security;
revoke all on table public.workflow_versions from anon, authenticated;
grant select, insert, update, delete on table public.workflow_versions to authenticated;

drop policy if exists "workflow staff read their school's workflows" on public.workflow_versions;
create policy "workflow staff read their school's workflows" on public.workflow_versions
  for select to authenticated
  using (private.has_capability('workflow:manage', 'school', tenant_id)
         or private.has_capability('workflow:publish', 'school', tenant_id)
         or private.has_capability('workflow:view', 'school', tenant_id));
drop policy if exists "workflow editors write drafts" on public.workflow_versions;
create policy "workflow editors write drafts" on public.workflow_versions
  for insert to authenticated
  with check (private.has_capability('workflow:manage', 'school', tenant_id));
drop policy if exists "workflow editors and publishers change drafts" on public.workflow_versions;
create policy "workflow editors and publishers change drafts" on public.workflow_versions
  for update to authenticated
  using (state = 'draft'
         and (private.has_capability('workflow:manage', 'school', tenant_id)
              or private.has_capability('workflow:publish', 'school', tenant_id)))
  with check (private.has_capability('workflow:manage', 'school', tenant_id)
              or private.has_capability('workflow:publish', 'school', tenant_id));
drop policy if exists "workflow editors discard drafts" on public.workflow_versions;
create policy "workflow editors discard drafts" on public.workflow_versions
  for delete to authenticated
  using (state = 'draft' and private.has_capability('workflow:manage', 'school', tenant_id));

-- ── 6. Audit ──────────────────────────────────────────────────────────────

alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record',
    'feature_kill_switch', 'data_classification_rules', 'integration_connections',
    'integration_scopes', 'integration_mappings', 'integration_dead_letter_events',
    'governance_policy_nodes', 'governance_steward_assignments', 'governance_config_requests',
    'gtm_campaigns', 'gtm_campaign_reviews', 'gtm_sponsor_policy', 'gtm_sponsor_placements',
    'migration_projects', 'migration_field_maps', 'migration_runs', 'migration_approvals',
    'academic_record_changes', 'academic_record_subjects',
    'student_account_requests', 'student_account_settings', 'student_account_reconciliations', 'student_account_closes',
    'student_payment_plans',
    'school_config_versions',
    'workflow_versions'
  ));

create or replace function private.audit_workflow_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row  jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data   jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  caller uuid := auth.uid();
  grant_id uuid;
begin
  -- Account deletion clearing a person reference is its own record.
  if tg_op = 'UPDATE'
     and (before_row - array['created_by', 'published_by']) = (after_row - array['created_by', 'published_by']) then
    return new;
  end if;
  -- A workflow going with its school leaves nothing to attribute.
  if not exists (select 1 from public.schools s where s.id = event_tenant) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('workflow:manage', 'workflow:publish')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;

  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, coalesce(row_data ->> 'id', event_tenant), lower(tg_op),
     before_row, after_row, caller, grant_id);
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.audit_workflow_change() from public, anon, authenticated;

drop trigger if exists audit_workflow_versions on public.workflow_versions;
create trigger audit_workflow_versions after insert or update or delete on public.workflow_versions
  for each row execute function private.audit_workflow_change();

-- ── 7. Descriptions ───────────────────────────────────────────────────────

comment on table public.workflow_versions is
  'A school''s definition of one workflow (D-1018): at most one draft, and published versions 1, 2, 3 … that are never edited. Checked against private.workflow_spec() on every write; published by someone who did not draft it. Holds a definition, never a student or a request.';
comment on function private.workflow_spec() is
  'The closed lists a workflow definition is built from: templates, step kinds, owners, the facts a rule may read and their operators. lib/workflow/spec.ts carries the same and spec.test.ts holds them equal.';
