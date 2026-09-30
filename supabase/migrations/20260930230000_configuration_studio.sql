-- The Configuration Studio: how a school sets its own policy without anyone
-- writing code for it (D-1011).
--
-- The platform brief of 30 September asks for "one configurable codebase
-- rather than hundreds of custom deployments" and lists eleven domains a
-- school configures: academic structure, workflows, roles, branding, content,
-- AI, notifications, data, features, accessibility and reporting.
--
-- One table holds it, and a trigger holds the rules:
--
--   1. A school's configuration for a domain is a sequence of published
--      versions, 1, 2, 3 … Nothing published is ever edited or deleted; the
--      current configuration is the highest version. A rollback is a new
--      draft copied from an older version and published like any other.
--   2. A domain has at most one draft. Whoever holds `config:manage` writes
--      it; only `config:publish` publishes it; and *whoever drafted a change
--      does not publish it*. Publishing changes nothing else in the row.
--   3. Every write — a draft as much as a version — is checked against
--      `private.config_spec()`: a domain's keys are a closed list, each with
--      a type and a range. An unknown key or an out-of-range value is refused
--      by the database, so nothing in the browser is trusted to have checked.
--      `lib/config/studio.ts` carries the same spec and `studio.test.ts`
--      holds the two to each other.
--   4. A setting can tighten a floor the platform already keeps and never
--      lower it: the reporting threshold starts at the platform's n = 10.
--
-- What it never holds is a person, a credential or a student record. The
-- spec has no free-form key, and the size of a version is capped.
--
-- Every function here is a trigger or a helper in `private`; none is callable
-- by a client, so the grants allowlist and the definer register are unchanged.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('config:manage',  'Draft one school''s configuration in the Configuration Studio. Cannot publish a draft they wrote.'),
  ('config:publish', 'Publish a draft configuration for one school, never one they drafted.'),
  ('config:view',    'Read one school''s configuration drafts and published versions.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('implementation_manager', 'config:manage'),
  ('implementation_manager', 'config:view'),
  ('integration_admin',      'config:manage'),
  ('integration_admin',      'config:view'),
  ('university_admin',       'config:manage'),
  ('university_admin',       'config:publish'),
  ('university_admin',       'config:view'),
  ('registrar',              'config:publish'),
  ('registrar',              'config:view'),
  ('institutional_researcher', 'config:view')
on conflict (role, capability) do nothing;

-- ── 2. The spec ───────────────────────────────────────────────────────────

-- The closed list of what a school may set, by domain. Kinds: int (min, max),
-- bool, enum (values), set (a non-empty array of distinct values), text (max)
-- and pattern (re, max). Every key is optional; an unset key takes the
-- platform's default, which lives in `lib/config/studio.ts`.
create or replace function private.config_spec()
returns jsonb language sql immutable set search_path = '' as $$
  select $j${
    "academic_structure": {
      "calendar_kind":        {"kind": "enum", "values": ["semester", "trimester", "quarter", "block", "year_round"]},
      "terms_per_year":       {"kind": "int", "min": 1, "max": 12},
      "grading_scale":        {"kind": "enum", "values": ["letter", "numeric", "pass_fail", "competency", "ects"]},
      "catalog_year_start_month": {"kind": "int", "min": 1, "max": 12}
    },
    "workflows": {
      "registration_clearance_required": {"kind": "bool"},
      "advisor_approval_required":       {"kind": "bool"},
      "approval_sla_days":               {"kind": "int", "min": 1, "max": 60},
      "escalate_after_days":             {"kind": "int", "min": 1, "max": 90}
    },
    "roles": {
      "enabled_roles": {"kind": "set", "values": ["student", "faculty", "advisor", "registrar", "tutor", "staff", "parent", "alumni"]}
    },
    "branding": {
      "display_name":   {"kind": "text", "max": 120},
      "course_term":    {"kind": "text", "max": 40},
      "default_locale": {"kind": "pattern", "re": "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$", "max": 16},
      "accent_color":   {"kind": "pattern", "re": "^#[0-9a-fA-F]{6}$", "max": 7}
    },
    "content": {
      "policy_review_months":  {"kind": "int", "min": 1, "max": 36},
      "resource_review_months": {"kind": "int", "min": 1, "max": 36},
      "forms_owner":           {"kind": "text", "max": 120}
    },
    "ai": {
      "ai_enabled":         {"kind": "bool"},
      "default_course_mode": {"kind": "enum", "values": ["off", "assist", "full"]},
      "allowed_actions":    {"kind": "set", "values": ["explain", "quiz", "summarize", "plan", "feedback"]},
      "require_citations":  {"kind": "bool"}
    },
    "notifications": {
      "channels":          {"kind": "set", "values": ["in_app", "push", "email"]},
      "quiet_hours_start": {"kind": "int", "min": 0, "max": 23},
      "quiet_hours_end":   {"kind": "int", "min": 0, "max": 23},
      "escalation_hours":  {"kind": "int", "min": 1, "max": 168}
    },
    "data": {
      "sync_interval_minutes":   {"kind": "int", "min": 5, "max": 1440},
      "retention_days_after_exit": {"kind": "int", "min": 0, "max": 3650},
      "export_on_offboarding":   {"kind": "bool"}
    },
    "features": {
      "default_release_stage": {"kind": "enum", "values": ["off", "pilot", "on"]},
      "pilot_cohort_label":    {"kind": "text", "max": 80}
    },
    "accessibility": {
      "plain_language_default": {"kind": "bool"},
      "default_text_scale":     {"kind": "enum", "values": ["standard", "large", "larger"]},
      "languages":              {"kind": "set", "values": ["en", "es", "fr", "de", "pt", "zh", "ar", "hi", "ja", "ko"]}
    },
    "reporting": {
      "min_cohort_size":   {"kind": "int", "min": 10, "max": 1000},
      "board_dashboard":   {"kind": "bool"},
      "export_formats":    {"kind": "set", "values": ["csv", "json", "pdf"]}
    }
  }$j$::jsonb;
$$;
revoke all on function private.config_spec() from public, anon;
grant execute on function private.config_spec() to authenticated;

-- What is wrong with a domain's settings, as codes, in key order. Empty means
-- it may be stored. Codes: `unknown_domain`, `not_object`, `too_large`,
-- `unknown_key:<key>`, `bad_value:<key>`.
create or replace function private.config_problems(p_domain text, p_settings jsonb)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  spec jsonb := private.config_spec() -> p_domain;
  out text[] := '{}';
  k text;
  v jsonb;
  s jsonb;
  kind text;
  ok boolean;
begin
  if spec is null then return array['unknown_domain']; end if;
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then return array['not_object']; end if;
  if length(p_settings::text) > 8192 then return array['too_large']; end if;

  for k, v in select key, value from jsonb_each(p_settings) order by key loop
    s := spec -> k;
    if s is null then
      out := array_append(out, 'unknown_key:' || k);
      continue;
    end if;
    kind := s ->> 'kind';
    -- Nested cases, not `and`: SQL does not promise to stop at the first false,
    -- and each cast below is only safe once the type above it has matched.
    ok := case kind
      when 'bool' then jsonb_typeof(v) = 'boolean'
      when 'int' then case when jsonb_typeof(v) = 'number' and (v #>> '{}') ~ '^-?[0-9]{1,9}$'
                        then (v #>> '{}')::numeric between (s ->> 'min')::numeric and (s ->> 'max')::numeric
                        else false end
      when 'enum' then case when jsonb_typeof(v) = 'string'
                        then (s -> 'values') @> jsonb_build_array(v #>> '{}')
                        else false end
      when 'text' then case when jsonb_typeof(v) = 'string'
                        then length(trim(v #>> '{}')) between 1 and (s ->> 'max')::int
                             and (v #>> '{}') !~ '[[:cntrl:]]'
                             and (v #>> '{}') !~ '[0-9]([ -]?[0-9]){12,18}'
                        else false end
      when 'pattern' then case when jsonb_typeof(v) = 'string'
                          then length(v #>> '{}') <= (s ->> 'max')::int and (v #>> '{}') ~ (s ->> 're')
                          else false end
      when 'set' then case when jsonb_typeof(v) = 'array'
                        then jsonb_array_length(v) between 1 and jsonb_array_length(s -> 'values')
                             and not exists (
                               select 1 from jsonb_array_elements(v) e
                                where jsonb_typeof(e) <> 'string' or not ((s -> 'values') @> jsonb_build_array(e #>> '{}')))
                             and (select count(distinct e) from jsonb_array_elements_text(v) e) = jsonb_array_length(v)
                        else false end
      else false
    end;
    if not coalesce(ok, false) then out := array_append(out, 'bad_value:' || k); end if;
  end loop;
  return out;
end $$;
revoke all on function private.config_problems(text, jsonb) from public, anon;
grant execute on function private.config_problems(text, jsonb) to authenticated;

-- ── 3. The record ─────────────────────────────────────────────────────────

create table if not exists public.school_config_versions (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  domain         text        not null check (domain in (
                   'academic_structure', 'workflows', 'roles', 'branding', 'content', 'ai',
                   'notifications', 'data', 'features', 'accessibility', 'reporting')),
  state          text        not null default 'draft' check (state in ('draft', 'published')),
  -- Null while a draft; the domain's next number when published.
  version        integer     check (version >= 1),
  settings       jsonb       not null default '{}'::jsonb,
  note           text        not null default '' check (length(note) <= 500),
  -- The published version this draft started from, when it is a rollback or an edit of the current one.
  based_on       integer     check (based_on >= 1),
  -- Cleared if the person's account is deleted; the version stays with the school.
  created_by     uuid        default auth.uid() references auth.users(id) on delete set null,
  published_by   uuid        references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  published_at   timestamptz,
  constraint school_config_state check ((state = 'published') = (version is not null and published_at is not null))
);
create unique index if not exists school_config_one_draft
  on public.school_config_versions (tenant_id, domain) where state = 'draft';
create unique index if not exists school_config_one_version
  on public.school_config_versions (tenant_id, domain, version) where state = 'published';
-- The two unique indexes above are partial, so neither covers the school's foreign key on its own.
create index if not exists school_config_by_tenant on public.school_config_versions (tenant_id, domain);
create index if not exists school_config_by_creator on public.school_config_versions (created_by);
create index if not exists school_config_by_publisher on public.school_config_versions (published_by);

-- ── 4. The guard ──────────────────────────────────────────────────────────

create or replace function private.school_config_guard()
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
    -- Account deletion clearing a person is not a change to the configuration.
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
    if new.tenant_id is distinct from old.tenant_id or new.domain is distinct from old.domain then
      raise exception 'A configuration stays with its school and its domain.' using errcode = '42501';
    end if;
    if new.created_by is distinct from old.created_by then
      raise exception 'Who drafted a configuration is not changed.' using errcode = '42501';
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
       and (new.settings is distinct from old.settings
            or new.note is distinct from old.note
            or new.based_on is distinct from old.based_on) then
      new.created_by := auth.uid();
    end if;
  end if;

  -- Saving a draft is drafting: publishing rights alone do not edit what they are to review.
  if tg_op = 'UPDATE' and new.state = 'draft'
     and not private.has_capability('config:manage', 'school', new.tenant_id) then
    raise exception 'Your account cannot change a draft at this school.' using errcode = '42501';
  end if;

  problems := private.config_problems(new.domain, new.settings);
  if cardinality(problems) > 0 then
    raise exception 'This configuration is not valid: %', array_to_string(problems, ', ') using errcode = '23514';
  end if;

  if new.based_on is not null and not exists (
       select 1 from public.school_config_versions v
        where v.tenant_id = new.tenant_id and v.domain = new.domain
          and v.state = 'published' and v.version = new.based_on) then
    raise exception 'There is no published version % of %.', new.based_on, new.domain using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.state = 'published' then
    -- Publishing: a second person, with the capability, and nothing else changing.
    if not private.has_capability('config:publish', 'school', new.tenant_id) then
      raise exception 'Your account cannot publish configuration at this school.' using errcode = '42501';
    end if;
    if auth.uid() is not distinct from old.created_by then
      raise exception 'Whoever drafted a configuration does not publish it.' using errcode = '42501';
    end if;
    if new.settings is distinct from old.settings or new.note is distinct from old.note or new.based_on is distinct from old.based_on then
      raise exception 'A draft is published as it was reviewed; save it again and have it published.' using errcode = '23514';
    end if;
    select coalesce(max(v.version), 0) + 1 into next_v
      from public.school_config_versions v
     where v.tenant_id = new.tenant_id and v.domain = new.domain and v.state = 'published';
    new.version := next_v;
    new.published_by := auth.uid();
    new.published_at := now();
  end if;
  return new;
end $$;
revoke all on function private.school_config_guard() from public, anon, authenticated;
drop trigger if exists school_config_guard on public.school_config_versions;
create trigger school_config_guard before insert or update on public.school_config_versions
  for each row execute function private.school_config_guard();

-- ── 5. Row-level security ─────────────────────────────────────────────────

alter table public.school_config_versions enable row level security;
revoke all on table public.school_config_versions from anon, authenticated;
grant select, insert, update, delete on table public.school_config_versions to authenticated;

drop policy if exists "config staff read their school's configuration" on public.school_config_versions;
create policy "config staff read their school's configuration" on public.school_config_versions
  for select to authenticated
  using (private.has_capability('config:manage', 'school', tenant_id)
         or private.has_capability('config:publish', 'school', tenant_id)
         or private.has_capability('config:view', 'school', tenant_id));
drop policy if exists "config editors write drafts" on public.school_config_versions;
create policy "config editors write drafts" on public.school_config_versions
  for insert to authenticated
  with check (private.has_capability('config:manage', 'school', tenant_id));
drop policy if exists "config editors and publishers change drafts" on public.school_config_versions;
create policy "config editors and publishers change drafts" on public.school_config_versions
  for update to authenticated
  using (state = 'draft'
         and (private.has_capability('config:manage', 'school', tenant_id)
              or private.has_capability('config:publish', 'school', tenant_id)))
  with check (private.has_capability('config:manage', 'school', tenant_id)
              or private.has_capability('config:publish', 'school', tenant_id));
drop policy if exists "config editors discard drafts" on public.school_config_versions;
create policy "config editors discard drafts" on public.school_config_versions
  for delete to authenticated
  using (state = 'draft' and private.has_capability('config:manage', 'school', tenant_id));

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
    'school_config_versions'
  ));

create or replace function private.audit_school_config_change()
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
  -- A configuration going with its school leaves nothing to attribute.
  if not exists (select 1 from public.schools s where s.id = event_tenant) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('config:manage', 'config:publish')
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
revoke all on function private.audit_school_config_change() from public, anon, authenticated;

drop trigger if exists audit_school_config_versions on public.school_config_versions;
create trigger audit_school_config_versions after insert or update or delete on public.school_config_versions
  for each row execute function private.audit_school_config_change();

-- ── 7. Descriptions ───────────────────────────────────────────────────────

comment on table public.school_config_versions is
  'A school''s configuration for one domain (D-1011): at most one draft, and published versions 1, 2, 3 … that are never edited. Checked against private.config_spec() on every write; published by someone who did not draft it. Holds no person, credential or student record.';
comment on function private.config_spec() is
  'The closed list of settings a school may set, by domain, with each key''s type and range. lib/config/studio.ts carries the same spec and studio.test.ts holds them equal.';
