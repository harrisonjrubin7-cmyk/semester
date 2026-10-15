-- Semester workflow engine + integration health. Additive; follows 20261011120000_live_integration.sql.
-- Tenant scope is derived from live_workspace_grants via auth.uid(), NOT from a client-settable setting.
-- (Policies keyed on current_setting('app.current_tenant_id') are unsafe with PostgREST unless the setting is
--  bound server-side from a verified JWT claim; a client could otherwise choose its own tenant.)

create table if not exists public.live_workflows (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  workflow_type text not null check (workflow_type in (
    'student_onboarding','sso_link','course_ingestion','study_asset','registration_readiness','override_approval',
    'grade_release','payment','refund','family_delegation','referral_routing','employer_sharing',
    'moderation_review','marketplace_dispute','integration_reconnect','release_promotion')),
  status text not null default 'received' check (status in (
    'received','validated','waiting_on_policy','waiting_on_external','waiting_on_human','executing',
    'completed','failed','compensating','compensated','cancelled','revoked')),
  subject_user uuid references auth.users(id),
  started_by uuid not null references auth.users(id),
  idempotency_key text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  current_step text,
  deadline_at timestamptz,
  correlation_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, idempotency_key)
);
create index if not exists live_workflows_inst_status on public.live_workflows (institution_id, status, updated_at desc);
create index if not exists live_workflows_subject on public.live_workflows (subject_user, updated_at desc);

create table if not exists public.live_workflow_steps (
  id bigserial primary key,
  workflow_id uuid not null references public.live_workflows(id) on delete cascade,
  institution_id uuid not null,
  step text not null,
  from_status text not null,
  to_status text not null,
  actor uuid references auth.users(id),     -- null = worker
  evidence_ref text,
  note text,
  at timestamptz not null default now()
);
create index if not exists live_workflow_steps_wf on public.live_workflow_steps (workflow_id, at);

-- Allowed transitions. Anything else is rejected by the trigger below.
create table if not exists public.live_workflow_transitions (
  from_status text not null, to_status text not null, primary key (from_status, to_status)
);
insert into public.live_workflow_transitions values
  ('received','validated'),('received','failed'),('received','cancelled'),
  ('validated','waiting_on_policy'),('validated','executing'),('validated','waiting_on_human'),
  ('waiting_on_policy','executing'),('waiting_on_policy','failed'),('waiting_on_policy','waiting_on_human'),
  ('waiting_on_human','executing'),('waiting_on_human','cancelled'),('waiting_on_human','failed'),
  ('executing','waiting_on_external'),('executing','completed'),('executing','failed'),('executing','compensating'),
  ('waiting_on_external','executing'),('waiting_on_external','completed'),('waiting_on_external','failed'),('waiting_on_external','compensating'),
  ('failed','compensating'),('compensating','compensated'),('compensating','failed'),
  ('completed','revoked'),('completed','compensating')
on conflict do nothing;

create or replace function public.live_workflow_guard() returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status then
    if not exists (select 1 from public.live_workflow_transitions where from_status = old.status and to_status = new.status) then
      raise exception 'illegal workflow transition % -> %', old.status, new.status using errcode = '22023';
    end if;
    insert into public.live_workflow_steps(workflow_id, institution_id, step, from_status, to_status, actor, note)
      values (new.id, new.institution_id, coalesce(new.current_step, new.status), old.status, new.status, auth.uid(), null);
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists live_workflow_guard on public.live_workflows;
create trigger live_workflow_guard before update on public.live_workflows for each row execute function public.live_workflow_guard();

-- Integration health (one row per institution × integration × provider)
create table if not exists public.live_integration_health (
  institution_id uuid not null,
  integration_key text not null,
  provider text not null,
  status text not null default 'configured' check (status in ('configured','pending_authorization','healthy','stale','degraded','blocked','disabled')),
  freshness_at timestamptz,
  last_sync_at timestamptz,
  consecutive_failures int not null default 0,
  last_error_code text,
  updated_at timestamptz not null default now(),
  primary key (institution_id, integration_key, provider)
);

-- RLS
do $$ declare t text; begin
  foreach t in array array['live_workflows','live_workflow_steps','live_workflow_transitions','live_integration_health'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- A user sees workflows about them or that they started; staff with an institution/operations grant see their institution's.
create policy live_wf_read on public.live_workflows for select to authenticated using (
  subject_user = auth.uid() or started_by = auth.uid()
  or exists (select 1 from public.live_workspace_grants g where g.user_id = auth.uid() and g.institution_id = live_workflows.institution_id
             and g.workspace in ('institution','operations','registrar') and (g.valid_until is null or g.valid_until > now())));
create policy live_wf_steps_read on public.live_workflow_steps for select to authenticated using (
  exists (select 1 from public.live_workflows w where w.id = live_workflow_steps.workflow_id));   -- inherits live_wf_read
create policy live_wf_transitions_read on public.live_workflow_transitions for select to authenticated using (true);
create policy live_health_read on public.live_integration_health for select to authenticated using (
  exists (select 1 from public.live_workspace_grants g where g.user_id = auth.uid() and g.institution_id = live_integration_health.institution_id
          and g.workspace in ('institution','operations') and (g.valid_until is null or g.valid_until > now())));
grant select on public.live_workflows, public.live_workflow_steps, public.live_workflow_transitions, public.live_integration_health to authenticated;
-- No client writes. Workers (service role) create and advance workflows; the trigger enforces the state machine for everyone.

-- Verify after applying:
-- select relname, relrowsecurity, relforcerowsecurity from pg_class where relname like 'live\_%' and relkind = 'r';
-- update live_workflows set status = 'completed' where status = 'received';  -- must fail: illegal transition
