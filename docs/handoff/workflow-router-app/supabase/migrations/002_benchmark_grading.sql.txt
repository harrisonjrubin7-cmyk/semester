create table public.benchmark_suites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  visibility public.visibility not null default 'private',
  name text not null, description text, created_at timestamptz not null default now(),
  check (visibility = 'private' or organization_id is not null)
);
create table public.benchmark_tasks (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid not null references public.benchmark_suites(id) on delete cascade,
  number int not null check (number between 1 and 99), slug text not null, title text not null, category text not null,
  prompt text not null, requirements jsonb not null default '[]', acceptance jsonb not null default '[]',
  recommended_platform text not null check (recommended_platform in ('claude-artifacts','chatgpt-canvas','v0')),
  requires_persistence boolean not null default false, weights jsonb,
  unique (suite_id, number)
);
create table public.benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.benchmark_tasks(id) on delete cascade,
  platform text not null check (platform in ('claude-artifacts','chatgpt-canvas','v0')),
  created_by uuid not null default auth.uid() references auth.users(id),
  status text not null check (status in ('pending','running','completed','manual-review-required','unsupported','failed')),
  status_reason text, executed_prompt text not null, model_name text, model_version text,
  output_url text, source_manifest jsonb not null default '[]', runtime_notes text, console_notes text, duration_ms int check (duration_ms >= 0),
  persistence_tested boolean not null default false, persistence_survived_reload boolean,
  persistence_mode text not null default 'none' check (persistence_mode in ('none','local-preview','browser-local','session','database','project-backed')),
  persistence_evidence text, persistence_failure_notes text,
  created_at timestamptz not null default now(),
  check (status not in ('manual-review-required','unsupported') or status_reason is not null),
  check (not persistence_tested or (persistence_survived_reload is not null and persistence_evidence is not null))
);
create table public.benchmark_grades (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.benchmark_runs(id) on delete cascade,
  grader_id uuid not null default auth.uid() references auth.users(id),
  correctness smallint check (correctness between 0 and 5), code_quality smallint check (code_quality between 0 and 5),
  rendering smallint check (rendering between 0 and 5), state_management smallint check (state_management between 0 and 5),
  maintainability smallint check (maintainability between 0 and 5), handoff smallint check (handoff between 0 and 5),
  sandbox_fit smallint check (sandbox_fit between 0 and 5), persistence smallint check (persistence between 0 and 5),
  evidence text, notes text, created_at timestamptz not null default now(),
  unique (run_id, grader_id)
);
create index on public.benchmark_tasks (suite_id);
create index on public.benchmark_runs (task_id, platform);
create index on public.benchmark_grades (run_id);

-- Access follows the suite.
create or replace function public.can_read_suite(s uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from benchmark_suites b where b.id = s and (b.owner_id = auth.uid() or (b.visibility = 'organization' and is_org_member(b.organization_id)))) $$;
create or replace function public.can_write_suite(s uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from benchmark_suites b where b.id = s and (b.owner_id = auth.uid() or (b.visibility = 'organization' and has_org_role(b.organization_id, array['owner','admin','member']::org_role[])))) $$;
grant execute on function public.can_read_suite(uuid), public.can_write_suite(uuid) to authenticated;

alter table public.benchmark_suites enable row level security;
alter table public.benchmark_tasks enable row level security;
alter table public.benchmark_runs enable row level security;
alter table public.benchmark_grades enable row level security;

create policy suite_select on public.benchmark_suites for select to authenticated using (public.can_read_suite(id));
create policy suite_insert on public.benchmark_suites for insert to authenticated with check (owner_id = auth.uid() and (organization_id is null or public.has_org_role(organization_id, array['owner','admin','member']::public.org_role[])));
create policy suite_update on public.benchmark_suites for update to authenticated using (public.can_write_suite(id));
create policy suite_delete on public.benchmark_suites for delete to authenticated using (owner_id = auth.uid());
create policy task_select on public.benchmark_tasks for select to authenticated using (public.can_read_suite(suite_id));
create policy task_write on public.benchmark_tasks for all to authenticated using (public.can_write_suite(suite_id)) with check (public.can_write_suite(suite_id));
create policy run_select on public.benchmark_runs for select to authenticated using (public.can_read_suite((select suite_id from public.benchmark_tasks t where t.id = task_id)));
create policy run_insert on public.benchmark_runs for insert to authenticated with check (created_by = auth.uid() and public.can_write_suite((select suite_id from public.benchmark_tasks t where t.id = task_id)));
create policy run_update on public.benchmark_runs for update to authenticated using (created_by = auth.uid());
create policy grade_select on public.benchmark_grades for select to authenticated using (public.can_read_suite((select t.suite_id from public.benchmark_runs r join public.benchmark_tasks t on t.id = r.task_id where r.id = run_id)));
create policy grade_insert on public.benchmark_grades for insert to authenticated with check (grader_id = auth.uid() and public.can_write_suite((select t.suite_id from public.benchmark_runs r join public.benchmark_tasks t on t.id = r.task_id where r.id = run_id)));
create policy grade_update on public.benchmark_grades for update to authenticated using (grader_id = auth.uid()) with check (grader_id = auth.uid());
