-- 002_benchmark_grading.sql
-- Benchmark suites, tasks, per-platform runs and human grades.
--
-- Visibility model (enforced by RLS, not by the UI):
--   * personal suite  (organization_id is null): readable and writable by its owner only
--   * shared suite    (organization_id set):     readable by every member of the organization;
--                                                writable by owner/admin/member; viewers are read-only
--   * template suite  (is_template):             readable by every signed-in user, writable by nobody
--                                                (it is seeded by supabase/seed.sql as the database owner)
-- Runs and grades inherit the visibility of their suite.

create type public.benchmark_run_status as enum
  ('queued', 'running', 'completed', 'manual-review-required', 'unsupported', 'failed');
create type public.persistence_mode as enum
  ('none', 'local-preview', 'browser-local', 'session', 'database', 'project-backed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.benchmark_suites (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text check (char_length(description) <= 2000),
  owner_id uuid default auth.uid() references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  constraint benchmark_suites_owner_or_template check (
    (is_template and owner_id is null and organization_id is null)
    or (not is_template and owner_id is not null)
  )
);
create index benchmark_suites_owner_idx on public.benchmark_suites (owner_id);
create index benchmark_suites_org_idx on public.benchmark_suites (organization_id) where organization_id is not null;

-- Weights are integer percentages over the eight criteria and must total 100.
create function private.weights_valid(w jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(w) = 'object'
    and (select count(*) from jsonb_object_keys(w)) = 8
    and w ?& array['correctness', 'code_quality', 'rendering', 'state_management', 'maintainability', 'handoff', 'sandbox_fit', 'persistence']
    and (select bool_and(jsonb_typeof(v.value) = 'number' and (v.value)::text::numeric between 0 and 100) from jsonb_each(w) v)
    and (select sum((v.value)::text::numeric) from jsonb_each(w) v) = 100;
$$;
grant execute on function private.weights_valid(jsonb) to authenticated;

create table public.benchmark_tasks (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid not null references public.benchmark_suites (id) on delete cascade,
  task_number integer not null check (task_number between 1 and 99),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  category text not null check (char_length(btrim(category)) between 1 and 100),
  prompt text not null check (char_length(btrim(prompt)) > 0),
  requirements jsonb not null default '[]' check (jsonb_typeof(requirements) = 'array'),
  capabilities jsonb not null default '{}' check (jsonb_typeof(capabilities) = 'object'),
  acceptance_criteria jsonb not null default '[]' check (jsonb_typeof(acceptance_criteria) = 'array'),
  recommended_platform public.platform_id not null,
  rubric_weights jsonb not null check (private.weights_valid(rubric_weights)),
  requires_persistence boolean not null default false,
  created_at timestamptz not null default now(),
  unique (suite_id, task_number),
  unique (id, suite_id)
);

create table public.benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  suite_id uuid not null,
  platform public.platform_id not null,
  attempt integer not null default 1 check (attempt >= 1),
  status public.benchmark_run_status not null default 'manual-review-required',
  -- The exact text that was executed. Never rewritten to match the canonical prompt.
  executed_prompt text not null check (char_length(btrim(executed_prompt)) > 0),
  model_name text check (char_length(model_name) <= 200),
  model_version text check (char_length(model_version) <= 200),
  runtime_notes text check (char_length(runtime_notes) <= 10000),
  output_url text check (output_url ~* '^https?://'),
  output_text text,
  source_manifest jsonb not null default '[]' check (jsonb_typeof(source_manifest) = 'array'),
  console_notes text check (char_length(console_notes) <= 20000),
  duration_seconds numeric check (duration_seconds >= 0),
  persistence_mode public.persistence_mode not null default 'none',
  persistence_tested boolean not null default false,
  persistence_survived_reload boolean,
  persistence_evidence text check (char_length(persistence_evidence) <= 10000),
  persistence_evidence_url text check (persistence_evidence_url ~* '^https?://'),
  persistence_failure_notes text check (char_length(persistence_failure_notes) <= 10000),
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (task_id, suite_id) references public.benchmark_tasks (id, suite_id) on delete cascade,
  -- one row per (task, platform, attempt): each platform/task pair is recorded independently
  unique (task_id, platform, attempt),
  unique (id, suite_id),
  constraint benchmark_runs_survival_needs_test check (persistence_survived_reload is null or persistence_tested)
);
create index benchmark_runs_suite_idx on public.benchmark_runs (suite_id);
create index benchmark_runs_task_idx on public.benchmark_runs (task_id);

create table public.benchmark_grades (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  suite_id uuid not null,
  grader_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  correctness smallint check (correctness between 0 and 5),
  code_quality smallint check (code_quality between 0 and 5),
  rendering smallint check (rendering between 0 and 5),
  state_management smallint check (state_management between 0 and 5),
  maintainability smallint check (maintainability between 0 and 5),
  handoff smallint check (handoff between 0 and 5),
  sandbox_fit smallint check (sandbox_fit between 0 and 5),
  persistence smallint check (persistence between 0 and 5),
  criterion_notes jsonb not null default '{}' check (jsonb_typeof(criterion_notes) = 'object'),
  evidence_urls text[] not null default '{}' check (cardinality(evidence_urls) <= 20),
  evaluator_notes text check (char_length(evaluator_notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (run_id, suite_id) references public.benchmark_runs (id, suite_id) on delete cascade,
  unique (run_id, grader_id),
  constraint benchmark_grades_has_a_score check (
    correctness is not null or code_quality is not null or rendering is not null or state_management is not null
    or maintainability is not null or handoff is not null or sandbox_fit is not null or persistence is not null
  )
);
create index benchmark_grades_run_idx on public.benchmark_grades (run_id);
create index benchmark_grades_suite_idx on public.benchmark_grades (suite_id);
create index benchmark_grades_grader_idx on public.benchmark_grades (grader_id);

-- ---------------------------------------------------------------------------
-- Visibility helpers
-- ---------------------------------------------------------------------------
create function private.can_read_suite(p_suite uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.benchmark_suites s
    where s.id = p_suite
      and (
        s.is_template
        or (s.organization_id is null and s.owner_id = (select auth.uid()))
        or (s.organization_id is not null and private.is_org_member(s.organization_id))
      )
  );
$$;

create function private.can_write_suite(p_suite uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.benchmark_suites s
    where s.id = p_suite
      and not s.is_template
      and (
        (s.organization_id is null and s.owner_id = (select auth.uid()))
        or (s.organization_id is not null
            and private.has_org_role(s.organization_id, array['owner', 'admin', 'member']::public.org_role[]))
      )
  );
$$;

create function private.can_admin_suite(p_suite uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.benchmark_suites s
    where s.id = p_suite
      and not s.is_template
      and (
        (s.organization_id is null and s.owner_id = (select auth.uid()))
        or (s.organization_id is not null
            and private.has_org_role(s.organization_id, array['owner', 'admin']::public.org_role[]))
      )
  );
$$;

revoke execute on function private.can_read_suite(uuid), private.can_write_suite(uuid), private.can_admin_suite(uuid) from public;
grant execute on function private.can_read_suite(uuid), private.can_write_suite(uuid), private.can_admin_suite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Persistence ceiling: a persistence grade may not exceed what was actually tested.
-- Mirrors lib/benchmark/probes/persistence.ts; tests/persistence-parity.test.ts keeps them equal.
-- ---------------------------------------------------------------------------
create function private.persistence_ceiling(
  p_required boolean,
  p_tested boolean,
  p_survived boolean,
  p_mode public.persistence_mode,
  p_has_evidence boolean
) returns integer language plpgsql immutable set search_path = '' as $$
declare
  mode_cap integer;
begin
  if not p_required then return 5; end if;
  if not p_tested then return 0; end if;
  mode_cap := case p_mode
    when 'none' then 0
    when 'local-preview' then 1
    when 'session' then 2
    when 'browser-local' then 3
    else 5
  end;
  if p_survived is distinct from true then return least(1, mode_cap); end if;
  if p_mode in ('database', 'project-backed') and not p_has_evidence then return 3; end if;
  return mode_cap;
end;
$$;
grant execute on function private.persistence_ceiling(boolean, boolean, boolean, public.persistence_mode, boolean) to authenticated;

create function private.run_persistence_ceiling(p_run uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select private.persistence_ceiling(
    t.requires_persistence,
    r.persistence_tested,
    r.persistence_survived_reload,
    r.persistence_mode,
    coalesce(nullif(btrim(r.persistence_evidence), ''), nullif(btrim(r.persistence_evidence_url), '')) is not null
  )
  from public.benchmark_runs r
  join public.benchmark_tasks t on t.id = r.task_id
  where r.id = p_run;
$$;
revoke execute on function private.run_persistence_ceiling(uuid) from public;
grant execute on function private.run_persistence_ceiling(uuid) to authenticated;

create function private.enforce_persistence_ceiling()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ceil integer;
begin
  if new.persistence is null then return new; end if;
  ceil := private.run_persistence_ceiling(new.run_id);
  if ceil is not null and new.persistence > ceil then
    raise exception 'Persistence grade % exceeds the ceiling of % allowed by the recorded persistence evidence', new.persistence, ceil
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger benchmark_grades_enforce_persistence_ceiling
  before insert or update on public.benchmark_grades
  for each row execute function private.enforce_persistence_ceiling();

-- If a run's persistence facts are later weakened, existing grades are pulled down with them.
create function private.reclamp_persistence_grades()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  ceil integer;
begin
  ceil := private.run_persistence_ceiling(new.id);
  if ceil is not null then
    update public.benchmark_grades set persistence = ceil, updated_at = now()
    where run_id = new.id and persistence > ceil;
  end if;
  return null;
end;
$$;
create trigger benchmark_runs_reclamp_persistence_grades
  after update on public.benchmark_runs
  for each row execute function private.reclamp_persistence_grades();

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger benchmark_runs_touch before update on public.benchmark_runs
  for each row execute function private.touch_updated_at();
create trigger benchmark_grades_touch before update on public.benchmark_grades
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.benchmark_suites enable row level security;
alter table public.benchmark_tasks enable row level security;
alter table public.benchmark_runs enable row level security;
alter table public.benchmark_grades enable row level security;

revoke all on public.benchmark_suites, public.benchmark_tasks, public.benchmark_runs, public.benchmark_grades from anon;
grant select, insert, update, delete on public.benchmark_suites, public.benchmark_tasks, public.benchmark_runs, public.benchmark_grades to authenticated;

-- suites
create policy benchmark_suites_select on public.benchmark_suites for select to authenticated
  using (
    is_template
    or (organization_id is null and owner_id = (select auth.uid()))
    or (organization_id is not null and private.is_org_member(organization_id))
  );
create policy benchmark_suites_insert on public.benchmark_suites for insert to authenticated
  with check (
    not is_template
    and owner_id = (select auth.uid())
    and (organization_id is null or private.has_org_role(organization_id, array['owner', 'admin', 'member']::public.org_role[]))
  );
create policy benchmark_suites_update on public.benchmark_suites for update to authenticated
  using (not is_template and private.can_admin_suite(id))
  with check (
    not is_template
    and owner_id is not null
    and (organization_id is null or private.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]))
  );
create policy benchmark_suites_delete on public.benchmark_suites for delete to authenticated
  using (not is_template and private.can_admin_suite(id));

-- tasks
create policy benchmark_tasks_select on public.benchmark_tasks for select to authenticated
  using (private.can_read_suite(suite_id));
create policy benchmark_tasks_insert on public.benchmark_tasks for insert to authenticated
  with check (private.can_write_suite(suite_id));
create policy benchmark_tasks_update on public.benchmark_tasks for update to authenticated
  using (private.can_write_suite(suite_id)) with check (private.can_write_suite(suite_id));
create policy benchmark_tasks_delete on public.benchmark_tasks for delete to authenticated
  using (private.can_admin_suite(suite_id));

-- runs
create policy benchmark_runs_select on public.benchmark_runs for select to authenticated
  using (private.can_read_suite(suite_id));
create policy benchmark_runs_insert on public.benchmark_runs for insert to authenticated
  with check (private.can_write_suite(suite_id) and recorded_by = (select auth.uid()));
create policy benchmark_runs_update on public.benchmark_runs for update to authenticated
  using (private.can_write_suite(suite_id) and (recorded_by = (select auth.uid()) or private.can_admin_suite(suite_id)))
  with check (private.can_write_suite(suite_id));
create policy benchmark_runs_delete on public.benchmark_runs for delete to authenticated
  using (recorded_by = (select auth.uid()) and private.can_write_suite(suite_id) or private.can_admin_suite(suite_id));

-- grades
create policy benchmark_grades_select on public.benchmark_grades for select to authenticated
  using (private.can_read_suite(suite_id));
create policy benchmark_grades_insert on public.benchmark_grades for insert to authenticated
  with check (grader_id = (select auth.uid()) and private.can_write_suite(suite_id));
create policy benchmark_grades_update on public.benchmark_grades for update to authenticated
  using (grader_id = (select auth.uid()) and private.can_write_suite(suite_id))
  with check (grader_id = (select auth.uid()) and private.can_write_suite(suite_id));
create policy benchmark_grades_delete on public.benchmark_grades for delete to authenticated
  using (grader_id = (select auth.uid()) or private.can_admin_suite(suite_id));

-- ---------------------------------------------------------------------------
-- Clone the canonical template into the caller's own suite. SECURITY INVOKER:
-- every insert goes through the caller's RLS policies.
-- ---------------------------------------------------------------------------
create function public.clone_benchmark_template(p_name text default null, p_organization_id uuid default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  template_id uuid;
  new_id uuid := gen_random_uuid();
  template_name text;
begin
  select s.id, s.name into template_id, template_name
  from public.benchmark_suites s where s.is_template order by s.created_at limit 1;
  if template_id is null then
    raise exception 'No benchmark template has been seeded (run supabase/seed.sql)' using errcode = 'no_data_found';
  end if;

  insert into public.benchmark_suites (id, name, description, owner_id, organization_id)
  values (new_id, coalesce(nullif(btrim(p_name), ''), template_name), 'Cloned from the canonical 12-workflow template.', auth.uid(), p_organization_id);

  insert into public.benchmark_tasks
    (suite_id, task_number, slug, title, category, prompt, requirements, capabilities,
     acceptance_criteria, recommended_platform, rubric_weights, requires_persistence)
  select new_id, t.task_number, t.slug, t.title, t.category, t.prompt, t.requirements, t.capabilities,
         t.acceptance_criteria, t.recommended_platform, t.rubric_weights, t.requires_persistence
  from public.benchmark_tasks t where t.suite_id = template_id;

  return new_id;
end;
$$;
revoke execute on function public.clone_benchmark_template(text, uuid) from public, anon;
grant execute on function public.clone_benchmark_template(text, uuid) to authenticated;
