-- The platform registry, as tables the database can enforce.
--
-- `packages/platform-control/registry/` is the authority for what a workspace,
-- a capability, a dependency and a piece of evidence are; its validators hold
-- the shape and CI holds the generated reports. These four tables are that
-- registry projected into Postgres (`generated/registry-projection.sql`
-- renders the upserts), so that anything running inside the database — a
-- release gate, a navigation builder, a tenant activation — can ask the same
-- question the files answer: is this capability live?
--
-- The answer the specification gives is "only when its full chain resolves",
-- and that is what the two triggers enforce rather than describe:
--
--   * a capability cannot be `deployed` or `active` while its workspace, or
--     any workspace or capability it depends on, is below the status the
--     dependency requires; a `blocked` or `retired` dependency never satisfies;
--   * a capability cannot be `tested` or beyond without test evidence, and
--     cannot be `active` without evidence somebody verified that has not
--     expired — a row existing is not a capability being live;
--   * a workspace cannot fall to `draft`, `blocked` or `retired` while a
--     capability in it is `deployed` or `active`.
--
-- Service-role only: these are not student data and no browser reads them.
-- The specification sketched them in `public` with a reference to an
-- `accounts` table; this repository keeps service tables in `private` and its
-- identity is `auth.users`, so both differ here on purpose.
--
-- Rollback: a forward migration that drops the two triggers first, then the
-- tables in dependency order (evidence, dependencies, capabilities,
-- workspaces), then the functions and the type. Nothing else references them.
--
-- Idempotent, and no `begin` or `commit`, as docs/developers/HOW-TO-ADD-A-MIGRATION.md requires.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'private' and t.typname = 'registry_status'
  ) then
    create type private.registry_status as enum ('draft', 'implemented', 'tested', 'deployed', 'active', 'blocked', 'retired');
  end if;
end $$;

create table if not exists private.registry_workspaces (
  id                  uuid primary key default gen_random_uuid(),
  workspace_key       text not null unique check (workspace_key ~ '^[a-z][a-z0-9_]*$'),
  name                text not null check (length(name) between 1 and 200),
  os_family           text not null check (length(os_family) between 1 and 200),
  base_route          text not null check (base_route ~ '^/'),
  owner_team          text not null check (length(owner_team) between 1 and 200),
  data_classification text not null check (length(data_classification) between 1 and 100),
  status              private.registry_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint registry_workspaces_time_order check (updated_at >= created_at)
);

create table if not exists private.registry_capabilities (
  id                      uuid primary key default gen_random_uuid(),
  capability_key          text not null unique check (capability_key ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)*$'),
  workspace_id            uuid not null references private.registry_workspaces(id),
  name                    text not null check (length(name) between 1 and 200),
  description             text not null check (length(description) between 1 and 2000),
  risk_tier               smallint not null check (risk_tier between 0 and 3),
  authority_model         text not null check (length(authority_model) between 1 and 300),
  status                  private.registry_status not null default 'draft',
  requires_consent        boolean not null default false,
  requires_human_approval boolean not null default false,
  requires_reconciliation boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint registry_capabilities_time_order check (updated_at >= created_at)
);

create index if not exists registry_capabilities_by_workspace
  on private.registry_capabilities (workspace_id);

create table if not exists private.registry_capability_dependencies (
  capability_id   uuid not null references private.registry_capabilities(id) on delete cascade,
  dependency_type text not null check (dependency_type in ('workspace', 'capability', 'system', 'integration', 'policy')),
  dependency_key  text not null check (length(dependency_key) between 1 and 200),
  required_status private.registry_status not null default 'active',
  primary key (capability_id, dependency_type, dependency_key)
);

create table if not exists private.registry_capability_evidence (
  id            uuid primary key default gen_random_uuid(),
  capability_id uuid not null references private.registry_capabilities(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('design', 'schema', 'code', 'test', 'deployment', 'approval', 'activation', 'monitoring')),
  evidence_url  text not null check (length(evidence_url) between 1 and 1000),
  checksum      text check (checksum is null or length(checksum) between 1 and 200),
  verified_by   uuid references auth.users(id) on delete set null,
  verified_at   timestamptz,
  expires_at    timestamptz,
  status        private.registry_status not null default 'draft',
  unique (capability_id, evidence_type, evidence_url),
  constraint registry_evidence_expiry_after_verification check (expires_at is null or verified_at is null or expires_at > verified_at)
);

create index if not exists registry_capability_evidence_by_verifier
  on private.registry_capability_evidence (verified_by);

alter table private.registry_workspaces enable row level security;
alter table private.registry_capabilities enable row level security;
alter table private.registry_capability_dependencies enable row level security;
alter table private.registry_capability_evidence enable row level security;

revoke all on table private.registry_workspaces from public, anon, authenticated;
revoke all on table private.registry_capabilities from public, anon, authenticated;
revoke all on table private.registry_capability_dependencies from public, anon, authenticated;
revoke all on table private.registry_capability_evidence from public, anon, authenticated;

grant select, insert, update on table private.registry_workspaces to service_role;
grant select, insert, update on table private.registry_capabilities to service_role;
grant select, insert, update, delete on table private.registry_capability_dependencies to service_role;
grant select, insert, update, delete on table private.registry_capability_evidence to service_role;

-- How far along a status is. `blocked` and `retired` rank nowhere: they never satisfy a requirement.
create or replace function private.registry_status_rank(s private.registry_status)
returns integer language sql immutable set search_path = '' as $$
  select case s
    when 'draft' then 1
    when 'implemented' then 2
    when 'tested' then 3
    when 'deployed' then 4
    when 'active' then 5
    else 0
  end;
$$;

create or replace function private.registry_capability_gate()
returns trigger language plpgsql set search_path = '' as $$
declare
  ws  private.registry_workspaces%rowtype;
  dep record;
begin
  new.updated_at := now();

  if private.registry_status_rank(new.status) >= private.registry_status_rank('tested') then
    if not exists (
      select 1 from private.registry_capability_evidence e
       where e.capability_id = new.id and e.evidence_type = 'test'
    ) then
      raise exception 'registry: capability % cannot be % without test evidence', new.capability_key, new.status
        using errcode = 'check_violation';
    end if;
  end if;

  if new.status in ('deployed', 'active') then
    select * into ws from private.registry_workspaces where id = new.workspace_id;
    if ws.id is null or private.registry_status_rank(ws.status) < private.registry_status_rank(new.status) then
      raise exception 'registry: capability % cannot be % while workspace % is %',
        new.capability_key, new.status, coalesce(ws.workspace_key, '?'), coalesce(ws.status::text, 'missing')
        using errcode = 'check_violation';
    end if;

    for dep in
      select d.dependency_type, d.dependency_key, d.required_status,
             case d.dependency_type
               when 'workspace'  then (select w.status from private.registry_workspaces w where w.workspace_key = d.dependency_key)
               when 'capability' then (select c.status from private.registry_capabilities c where c.capability_key = d.dependency_key)
             end as actual
        from private.registry_capability_dependencies d
       where d.capability_id = new.id and d.dependency_type in ('workspace', 'capability')
       order by d.dependency_type, d.dependency_key
    loop
      if dep.actual is null or private.registry_status_rank(dep.actual) < private.registry_status_rank(dep.required_status) then
        raise exception 'registry: capability % cannot be % until % % is % (it is %)',
          new.capability_key, new.status, dep.dependency_type, dep.dependency_key, dep.required_status, coalesce(dep.actual::text, 'missing')
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  if new.status = 'active' then
    if not exists (
      select 1 from private.registry_capability_evidence e
       where e.capability_id = new.id
         and e.verified_at is not null
         and e.status <> 'draft'
         and (e.expires_at is null or e.expires_at > now())
    ) then
      raise exception 'registry: capability % cannot be active without unexpired verified evidence', new.capability_key
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists registry_capability_gate on private.registry_capabilities;
create trigger registry_capability_gate
  before insert or update on private.registry_capabilities
  for each row execute function private.registry_capability_gate();

create or replace function private.registry_workspace_gate()
returns trigger language plpgsql set search_path = '' as $$
declare
  live text;
begin
  new.updated_at := now();
  if new.status in ('draft', 'blocked', 'retired') then
    select string_agg(c.capability_key, ', ' order by c.capability_key) into live
      from private.registry_capabilities c
     where c.workspace_id = new.id and c.status in ('deployed', 'active');
    if live is not null then
      raise exception 'registry: workspace % cannot be % while % is deployed or active', new.workspace_key, new.status, live
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists registry_workspace_gate on private.registry_workspaces;
create trigger registry_workspace_gate
  before insert or update on private.registry_workspaces
  for each row execute function private.registry_workspace_gate();

-- Invoker functions, but a browser role has no business calling them either.
revoke execute on function private.registry_status_rank(private.registry_status) from public, anon, authenticated;
revoke execute on function private.registry_capability_gate() from public, anon, authenticated;
revoke execute on function private.registry_workspace_gate() from public, anon, authenticated;
