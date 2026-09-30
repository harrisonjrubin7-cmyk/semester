-- The Migration Center (D-144): how an institution moves a domain out of a
-- system it is retiring and into Semester, one gate at a time.
--
-- The brief of 29 September lists the path — source inventory, data
-- classification, field mapping, cleaning rules, transformation preview,
-- sample import, validation, reconciliation, parallel run, cutover, archive,
-- post-cutover monitoring — and what each migration must record: source
-- platform and version, data owner, classifications, retention, mapping,
-- duplicate rule, historical cutoff, validation and reconciliation totals,
-- go-live date, rollback plan, archive location and authorized approvers.
--
-- Four tables hold that, and a trigger holds the path:
--
--   1. A migration moves forward one stage at a time, and only when the
--      evidence its stage asks for exists — recorded in that stage, since it
--      last entered it. `private.migration_gate_failures` is the list of what
--      is owed; `lib/migration/center.ts` mirrors it for the screen, and
--      `center.test.ts` holds the codes to this file.
--   2. It may go back to any earlier stage until cutover has happened, which
--      restarts the evidence of every stage it re-enters.
--   3. Cutover needs a date, a rollback plan, and the latest decision in every
--      required approval area to be an approval — each recorded in the
--      cutover stage, by someone holding `migration:approve` who did not
--      create the migration. At least two areas are always required.
--   4. Runs and approvals are append-only. A run's `passed` is a generated
--      column: nobody records "passed", they record counts.
--
-- What it never holds is a student record. A sample is read in the browser;
-- a run is counts and the file's SHA-256. The counts are the recorder's
-- attributed claim about a file they hold, and the column comments say so.
--
-- No function here is callable by a client: every rule is a policy or a
-- trigger, so `grants.check.sql` and the definer register are unchanged.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. Capabilities ───────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('migration:manage',  'Plan and run one school''s migrations out of a retiring system: inventory, mapping, cleaning rules and recorded counts. Never a student record; cannot approve a cutover.'),
  ('migration:approve', 'Record an approval or rejection of one school''s migration cutover in an area such as registrar, IT or academic leadership. Never on a migration they created.'),
  ('migration:view',    'Read one school''s migrations, their evidence counts and approvals.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('implementation_manager',   'migration:manage'),
  ('implementation_manager',   'migration:view'),
  ('integration_admin',        'migration:manage'),
  ('integration_admin',        'migration:view'),
  ('registrar',                'migration:approve'),
  ('registrar',                'migration:view'),
  ('university_admin',         'migration:approve'),
  ('university_admin',         'migration:view'),
  ('dean',                     'migration:approve'),
  ('dean',                     'migration:view'),
  ('institutional_researcher', 'migration:view')
on conflict (role, capability) do nothing;

-- ── 2. The record ─────────────────────────────────────────────────────────

create table if not exists public.migration_projects (
  id                     uuid        primary key default gen_random_uuid(),
  tenant_id              text        not null references public.schools(id) on delete cascade,
  name                   text        not null check (length(trim(name)) between 1 and 200),
  domain                 text        not null check (domain in (
                           'lms', 'registration', 'degree_audit', 'advising', 'student_accounts', 'housing',
                           'career', 'campus_events', 'communications', 'catalog', 'other')),
  source_platform        text        not null default '' check (length(source_platform) <= 200),
  source_version         text        not null default '' check (length(source_version) <= 100),
  data_owner             text        not null default '' check (length(data_owner) <= 200),
  classifications        text[]      not null default '{}' check (classifications <@ array['public', 'internal', 'confidential', 'restricted']),
  retention              text        not null default '' check (length(retention) <= 1000),
  historical_cutoff      date,
  duplicate_rule         text        check (duplicate_rule in ('reject', 'keep_first', 'keep_last')),
  cutover_date           date,
  rollback_plan          text        not null default '' check (length(rollback_plan) <= 4000),
  archive_location       text        not null default '' check (length(archive_location) <= 1000),
  required_approvals     text[]      not null default array['data_owner', 'it']
                           check (cardinality(required_approvals) >= 2
                                  and required_approvals <@ array['data_owner', 'registrar', 'it', 'academic_leadership', 'faculty', 'finance']),
  parallel_runs_required smallint    not null default 2 check (parallel_runs_required between 1 and 52),
  stage                  text        not null default 'inventory' check (stage in (
                           'inventory', 'classification', 'mapping', 'cleaning', 'preview', 'sample_import',
                           'validation', 'reconciliation', 'parallel_run', 'cutover', 'archive', 'monitoring')),
  stage_entered_at       timestamptz not null default clock_timestamp(),
  -- Cleared if the creator's account is deleted; the migration stays with the school.
  created_by             uuid        default auth.uid() references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (id, tenant_id)
);
create index if not exists migration_projects_by_tenant on public.migration_projects (tenant_id, stage);
create index if not exists migration_projects_by_creator on public.migration_projects (created_by);

create table if not exists public.migration_field_maps (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null,
  project_id    uuid        not null,
  source_field  text        not null check (length(trim(source_field)) between 1 and 200),
  target_field  text        not null check (target_field ~ '^[a-z][a-z0-9_]{0,62}$'),
  transform     text        not null default 'trim' check (transform in (
                  'none', 'trim', 'collapse_spaces', 'lowercase', 'uppercase', 'email', 'date_iso', 'integer', 'decimal')),
  required      boolean     not null default false,
  is_key        boolean     not null default false,
  created_at    timestamptz not null default now(),
  unique (project_id, target_field),
  foreign key (project_id, tenant_id) references public.migration_projects (id, tenant_id) on delete cascade
);
create index if not exists migration_field_maps_by_project_tenant on public.migration_field_maps (project_id, tenant_id);
create index if not exists migration_field_maps_by_tenant on public.migration_field_maps (tenant_id);

create table if not exists public.migration_runs (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null,
  project_id      uuid        not null,
  kind            text        not null check (kind in ('preview', 'sample_import', 'validation', 'reconciliation', 'parallel_run', 'monitoring')),
  -- Set by the trigger from the project, never by the client.
  stage           text        not null,
  period_label    text        not null default '' check (length(period_label) <= 120),
  rows_in         integer     not null check (rows_in >= 0),
  rows_ok         integer     not null default 0 check (rows_ok >= 0),
  rows_failed     integer     not null default 0 check (rows_failed >= 0),
  rows_missing    integer     not null default 0 check (rows_missing >= 0),
  rows_extra      integer     not null default 0 check (rows_extra >= 0),
  rows_differing  integer     not null default 0 check (rows_differing >= 0),
  sample_sha256   text        not null check (sample_sha256 ~ '^[0-9a-f]{64}$'),
  passed          boolean     generated always as (
                    rows_in > 0 and case
                      when kind = 'validation' then rows_failed = 0
                      when kind in ('reconciliation', 'parallel_run', 'monitoring') then rows_missing + rows_extra + rows_differing = 0
                      else true
                    end) stored,
  recorded_by     uuid        default auth.uid() references auth.users(id) on delete set null,
  recorded_at     timestamptz not null default clock_timestamp(),
  constraint migration_run_counts check (rows_ok + rows_failed <= rows_in),
  constraint migration_run_period check (kind <> 'parallel_run' or length(trim(period_label)) > 0),
  foreign key (project_id, tenant_id) references public.migration_projects (id, tenant_id) on delete cascade
);
create index if not exists migration_runs_by_project on public.migration_runs (project_id, tenant_id, stage, recorded_at desc);
create index if not exists migration_runs_by_tenant on public.migration_runs (tenant_id);
create index if not exists migration_runs_by_recorder on public.migration_runs (recorded_by);

create table if not exists public.migration_approvals (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    text        not null,
  project_id   uuid        not null,
  area         text        not null check (area in ('data_owner', 'registrar', 'it', 'academic_leadership', 'faculty', 'finance')),
  decision     text        not null check (decision in ('approved', 'rejected')),
  note         text        not null default '' check (length(note) <= 2000),
  approver_id  uuid        default auth.uid() references auth.users(id) on delete set null,
  recorded_at  timestamptz not null default clock_timestamp(),
  foreign key (project_id, tenant_id) references public.migration_projects (id, tenant_id) on delete cascade
);
create index if not exists migration_approvals_by_project on public.migration_approvals (project_id, tenant_id, area, recorded_at desc);
create index if not exists migration_approvals_by_tenant on public.migration_approvals (tenant_id);
create index if not exists migration_approvals_by_approver on public.migration_approvals (approver_id);

-- ── 3. The gates ──────────────────────────────────────────────────────────

-- What stops a migration leaving its stage, as codes, in the order
-- `gateFailures` in lib/migration/center.ts checks them. Empty means it may
-- move on. Invoker rights: whoever moves a migration can read its evidence.
create or replace function private.migration_gate_failures(p public.migration_projects)
returns text[] language plpgsql stable set search_path = '' as $$
declare
  out text[] := '{}';
  latest boolean;
  periods int;
  want_area text;
  last_decision text;
begin
  if p.stage = 'inventory' then
    if trim(p.source_platform) = '' then out := array_append(out, 'source_platform'); end if;
    if trim(p.source_version) = '' then out := array_append(out, 'source_version'); end if;
    if trim(p.data_owner) = '' then out := array_append(out, 'data_owner'); end if;
  elsif p.stage = 'classification' then
    if cardinality(p.classifications) = 0 then out := array_append(out, 'classifications'); end if;
    if trim(p.retention) = '' then out := array_append(out, 'retention'); end if;
    if p.historical_cutoff is null then out := array_append(out, 'historical_cutoff'); end if;
  elsif p.stage = 'mapping' then
    if not exists (select 1 from public.migration_field_maps m where m.project_id = p.id) then out := array_append(out, 'field_map'); end if;
    if not exists (select 1 from public.migration_field_maps m where m.project_id = p.id and m.is_key) then out := array_append(out, 'key_field'); end if;
  elsif p.stage = 'cleaning' then
    if p.duplicate_rule is null then out := array_append(out, 'duplicate_rule'); end if;
  elsif p.stage in ('preview', 'sample_import', 'validation', 'reconciliation', 'monitoring') then
    select r.passed into latest
      from public.migration_runs r
     where r.project_id = p.id and r.stage = p.stage and r.kind = p.stage and r.recorded_at >= p.stage_entered_at
     order by r.recorded_at desc, r.id desc
     limit 1;
    if p.stage = 'preview' and latest is null then out := array_append(out, 'preview_run');
    elsif p.stage = 'sample_import' and latest is null then out := array_append(out, 'sample_import_run');
    elsif p.stage = 'validation' and latest is not true then out := array_append(out, 'validation_passed');
    elsif p.stage = 'reconciliation' and latest is not true then out := array_append(out, 'reconciliation_passed');
    elsif p.stage = 'monitoring' then out := array_append(out, 'terminal');
    end if;
  elsif p.stage = 'parallel_run' then
    select count(distinct lower(trim(r.period_label))) into periods
      from public.migration_runs r
     where r.project_id = p.id and r.stage = 'parallel_run' and r.kind = 'parallel_run'
       and r.passed and r.recorded_at >= p.stage_entered_at;
    select r.passed into latest
      from public.migration_runs r
     where r.project_id = p.id and r.stage = 'parallel_run' and r.kind = 'parallel_run' and r.recorded_at >= p.stage_entered_at
     order by r.recorded_at desc, r.id desc
     limit 1;
    if periods < p.parallel_runs_required or latest is not true then out := array_append(out, 'parallel_runs'); end if;
  elsif p.stage = 'cutover' then
    if p.cutover_date is null then out := array_append(out, 'cutover_date'); end if;
    if trim(p.rollback_plan) = '' then out := array_append(out, 'rollback_plan'); end if;
    declare
      unapproved boolean := false;
      refused boolean := false;
    begin
      foreach want_area in array p.required_approvals loop
        last_decision := (
          select a.decision from public.migration_approvals a
           where a.project_id = p.id and a.area = want_area and a.recorded_at >= p.stage_entered_at
           order by a.recorded_at desc, a.id desc
           limit 1);
        if last_decision is distinct from 'approved' then unapproved := true; end if;
        if last_decision = 'rejected' then refused := true; end if;
      end loop;
      if unapproved then out := array_append(out, 'approvals'); end if;
      if refused then out := array_append(out, 'rejected'); end if;
    end;
  elsif p.stage = 'archive' then
    if trim(p.archive_location) = '' then out := array_append(out, 'archive_location'); end if;
  end if;
  return out;
end $$;
revoke all on function private.migration_gate_failures(public.migration_projects) from public, anon;
grant execute on function private.migration_gate_failures(public.migration_projects) to authenticated;

create or replace function private.migration_stage_index(s text)
returns int language sql immutable set search_path = '' as $$
  select array_position(array['inventory', 'classification', 'mapping', 'cleaning', 'preview', 'sample_import',
                              'validation', 'reconciliation', 'parallel_run', 'cutover', 'archive', 'monitoring'], s);
$$;
revoke all on function private.migration_stage_index(text) from public, anon;
grant execute on function private.migration_stage_index(text) to authenticated;

-- Born at inventory; forward one stage when its gate is clear; back until
-- cutover has happened. The school, the creator and the stage clock are not
-- the client's to set.
create or replace function private.migration_project_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  owed text[];
  from_i int;
  to_i int;
begin
  -- Each area named once: ['it', 'it'] is one area, and the cutover gate needs two.
  if (select count(distinct a) from unnest(new.required_approvals) a) <> cardinality(new.required_approvals) then
    raise exception 'Each approval area is named once.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.stage := 'inventory';
    new.stage_entered_at := clock_timestamp();
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- Account deletion clearing the creator is not a change to the migration.
  if new.created_by is null and old.created_by is not null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;

  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'A migration stays with its school.' using errcode = '42501';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'Who created a migration is not changed.' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();

  if new.stage is distinct from old.stage then
    from_i := private.migration_stage_index(old.stage);
    to_i := private.migration_stage_index(new.stage);
    if to_i = from_i + 1 then
      owed := private.migration_gate_failures(old);
      if cardinality(owed) > 0 then
        raise exception 'This migration cannot move to % yet: %', new.stage, array_to_string(owed, ', ')
          using errcode = '23514';
      end if;
    elsif to_i < from_i then
      if from_i > private.migration_stage_index('cutover') then
        raise exception 'A migration past cutover does not go back; roll back with the plan and open a new migration.'
          using errcode = '23514';
      end if;
    else
      raise exception 'A migration moves forward one stage at a time.' using errcode = '23514';
    end if;
    new.stage_entered_at := clock_timestamp();
  elsif (to_jsonb(new) - array['name', 'updated_at', 'stage_entered_at'])
        <> (to_jsonb(old) - array['name', 'updated_at', 'stage_entered_at']) then
    -- A material edit within a stage — a new cutover date, a different
    -- rollback plan — restarts the stage's clock: evidence and approvals
    -- recorded before it were about something else, and are recorded again.
    new.stage_entered_at := clock_timestamp();
  else
    new.stage_entered_at := old.stage_entered_at;
  end if;
  return new;
end $$;
revoke all on function private.migration_project_guard() from public, anon, authenticated;
drop trigger if exists migration_project_guard on public.migration_projects;
create trigger migration_project_guard before insert or update on public.migration_projects
  for each row execute function private.migration_project_guard();

-- Field maps change only while the mapping is still being decided: after
-- cleaning, evidence depends on them. Move back to change one.
create or replace function private.migration_map_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  s text;
begin
  select p.stage into s from public.migration_projects p
   where p.id = coalesce(new.project_id, old.project_id);
  if private.migration_stage_index(s) > private.migration_stage_index('cleaning') then
    raise exception 'The mapping is fixed once a migration is past cleaning; move it back to change the mapping.'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.project_id is distinct from old.project_id or new.tenant_id is distinct from old.tenant_id) then
    raise exception 'A field map stays with its migration.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.migration_map_guard() from public, anon, authenticated;
drop trigger if exists migration_map_guard on public.migration_field_maps;
create trigger migration_map_guard before insert or update or delete on public.migration_field_maps
  for each row execute function private.migration_map_guard();

-- A run is stamped with the project's stage and the time, by the database.
create or replace function private.migration_run_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  select p.stage into new.stage from public.migration_projects p where p.id = new.project_id;
  new.recorded_at := clock_timestamp();
  new.recorded_by := auth.uid();
  return new;
end $$;
revoke all on function private.migration_run_stamp() from public, anon, authenticated;
drop trigger if exists migration_run_stamp on public.migration_runs;
create trigger migration_run_stamp before insert on public.migration_runs
  for each row execute function private.migration_run_stamp();

-- An approval is recorded in the cutover stage, by someone other than the
-- migration's creator, stamped by the database.
create or replace function private.migration_approval_stamp()
returns trigger language plpgsql set search_path = '' as $$
declare
  p public.migration_projects;
begin
  select * into p from public.migration_projects where id = new.project_id;
  if p.id is null or p.stage <> 'cutover' then
    raise exception 'Approvals are recorded at cutover, on the evidence as it stands then.' using errcode = '23514';
  end if;
  if p.created_by = auth.uid() then
    raise exception 'The person who created a migration does not approve its cutover.' using errcode = '42501';
  end if;
  new.recorded_at := clock_timestamp();
  new.approver_id := auth.uid();
  return new;
end $$;
revoke all on function private.migration_approval_stamp() from public, anon, authenticated;
drop trigger if exists migration_approval_stamp on public.migration_approvals;
create trigger migration_approval_stamp before insert on public.migration_approvals
  for each row execute function private.migration_approval_stamp();

-- Runs and approvals are evidence: append-only, except for the person
-- reference account deletion clears.
create or replace function private.migration_append_only()
returns trigger language plpgsql set search_path = '' as $$
declare
  col text := tg_argv[0];
begin
  -- `passed` is left out: a stored generated column is not yet computed in a
  -- BEFORE trigger's NEW, so it would read as changed when nothing but the
  -- person reference was.
  if tg_op = 'UPDATE' and (to_jsonb(new) ->> col) is null and (to_jsonb(old) ->> col) is not null
     and (to_jsonb(new) - col - 'passed') = (to_jsonb(old) - col - 'passed') then
    return new;
  end if;
  raise exception '% is append-only; record a new row instead', tg_table_name using errcode = '42501';
end $$;
revoke all on function private.migration_append_only() from public, anon, authenticated;
drop trigger if exists migration_runs_append_only on public.migration_runs;
create trigger migration_runs_append_only before update or delete on public.migration_runs
  for each row execute function private.migration_append_only('recorded_by');
drop trigger if exists migration_approvals_append_only on public.migration_approvals;
create trigger migration_approvals_append_only before update or delete on public.migration_approvals
  for each row execute function private.migration_append_only('approver_id');

-- ── 4. Row-level security ─────────────────────────────────────────────────

alter table public.migration_projects   enable row level security;
alter table public.migration_field_maps enable row level security;
alter table public.migration_runs       enable row level security;
alter table public.migration_approvals  enable row level security;

revoke all on table public.migration_projects, public.migration_field_maps,
                    public.migration_runs, public.migration_approvals
  from anon, authenticated;
grant select, insert, update on table public.migration_projects to authenticated;
grant select, insert, update, delete on table public.migration_field_maps to authenticated;
grant select, insert on table public.migration_runs to authenticated;
grant select, insert on table public.migration_approvals to authenticated;

drop policy if exists "migration staff read their school's migrations" on public.migration_projects;
create policy "migration staff read their school's migrations" on public.migration_projects
  for select to authenticated
  using (private.has_capability('migration:manage', 'school', tenant_id)
         or private.has_capability('migration:approve', 'school', tenant_id)
         or private.has_capability('migration:view', 'school', tenant_id));
drop policy if exists "migration leads open migrations" on public.migration_projects;
create policy "migration leads open migrations" on public.migration_projects
  for insert to authenticated
  with check (private.has_capability('migration:manage', 'school', tenant_id));
drop policy if exists "migration leads change migrations" on public.migration_projects;
create policy "migration leads change migrations" on public.migration_projects
  for update to authenticated
  using (private.has_capability('migration:manage', 'school', tenant_id))
  with check (private.has_capability('migration:manage', 'school', tenant_id));

drop policy if exists "migration staff read field maps" on public.migration_field_maps;
create policy "migration staff read field maps" on public.migration_field_maps
  for select to authenticated
  using (private.has_capability('migration:manage', 'school', tenant_id)
         or private.has_capability('migration:approve', 'school', tenant_id)
         or private.has_capability('migration:view', 'school', tenant_id));
drop policy if exists "migration leads write field maps" on public.migration_field_maps;
create policy "migration leads write field maps" on public.migration_field_maps
  for insert to authenticated
  with check (private.has_capability('migration:manage', 'school', tenant_id));
drop policy if exists "migration leads change field maps" on public.migration_field_maps;
create policy "migration leads change field maps" on public.migration_field_maps
  for update to authenticated
  using (private.has_capability('migration:manage', 'school', tenant_id))
  with check (private.has_capability('migration:manage', 'school', tenant_id));
drop policy if exists "migration leads remove field maps" on public.migration_field_maps;
create policy "migration leads remove field maps" on public.migration_field_maps
  for delete to authenticated
  using (private.has_capability('migration:manage', 'school', tenant_id));

drop policy if exists "migration staff read runs" on public.migration_runs;
create policy "migration staff read runs" on public.migration_runs
  for select to authenticated
  using (private.has_capability('migration:manage', 'school', tenant_id)
         or private.has_capability('migration:approve', 'school', tenant_id)
         or private.has_capability('migration:view', 'school', tenant_id));
drop policy if exists "migration leads record runs" on public.migration_runs;
create policy "migration leads record runs" on public.migration_runs
  for insert to authenticated
  with check (private.has_capability('migration:manage', 'school', tenant_id));

drop policy if exists "migration staff read approvals" on public.migration_approvals;
create policy "migration staff read approvals" on public.migration_approvals
  for select to authenticated
  using (private.has_capability('migration:manage', 'school', tenant_id)
         or private.has_capability('migration:approve', 'school', tenant_id)
         or private.has_capability('migration:view', 'school', tenant_id));
drop policy if exists "migration approvers record decisions" on public.migration_approvals;
create policy "migration approvers record decisions" on public.migration_approvals
  for insert to authenticated
  with check (private.has_capability('migration:approve', 'school', tenant_id));

-- ── 5. Audit ──────────────────────────────────────────────────────────────

alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record',
    'feature_kill_switch', 'data_classification_rules', 'integration_connections',
    'integration_scopes', 'integration_mappings', 'integration_dead_letter_events',
    'governance_policy_nodes', 'governance_steward_assignments', 'governance_config_requests',
    'gtm_campaigns', 'gtm_campaign_reviews', 'gtm_sponsor_policy', 'gtm_sponsor_placements',
    'migration_projects', 'migration_field_maps', 'migration_runs', 'migration_approvals'
  ));

create or replace function private.audit_migration_change()
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
     and (before_row - array['created_by', 'recorded_by', 'approver_id']) = (after_row - array['created_by', 'recorded_by', 'approver_id']) then
    return new;
  end if;
  -- A migration going with its school leaves nothing to attribute.
  if not exists (select 1 from public.schools s where s.id = event_tenant) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('migration:manage', 'migration:approve')
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
revoke all on function private.audit_migration_change() from public, anon, authenticated;

drop trigger if exists audit_migration_projects on public.migration_projects;
create trigger audit_migration_projects after insert or update on public.migration_projects
  for each row execute function private.audit_migration_change();
drop trigger if exists audit_migration_field_maps on public.migration_field_maps;
create trigger audit_migration_field_maps after insert or update or delete on public.migration_field_maps
  for each row execute function private.audit_migration_change();
drop trigger if exists audit_migration_runs on public.migration_runs;
create trigger audit_migration_runs after insert on public.migration_runs
  for each row execute function private.audit_migration_change();
drop trigger if exists audit_migration_approvals on public.migration_approvals;
create trigger audit_migration_approvals after insert on public.migration_approvals
  for each row execute function private.audit_migration_change();

-- ── 6. Descriptions ───────────────────────────────────────────────────────

comment on table public.migration_projects is
  'One migration of a domain out of a retiring system (D-144). Born at inventory; forward one stage at a time through private.migration_gate_failures; back until cutover. Holds no student record.';
comment on table public.migration_field_maps is
  'Source field to Semester field, with the cleaning transform. Fixed once the migration is past cleaning.';
comment on table public.migration_runs is
  'Append-only evidence: counts and the sample file''s SHA-256, recorded in a stage. The counts are the recorder''s attributed claim about a file processed in their browser; passed is generated from them.';
comment on table public.migration_approvals is
  'Append-only cutover decisions by area, recorded at cutover by a migration:approve holder who did not create the migration.';
