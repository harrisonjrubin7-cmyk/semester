-- Migrations 001-005 transcribed from "Semester: PostgreSQL RLS, Authentication, RBAC, and API Gateway".
-- Changes from the document are marked "CHANGED:" with the reason.
\set ON_ERROR_STOP on

-- 001 restricted roles and schemas
begin;
create role semester_owner nologin nobypassrls;
create role semester_api nologin nobypassrls;
create schema iam authorization semester_owner;
create schema app authorization semester_owner;
revoke all on schema iam from public;
revoke all on schema app from public;
grant usage on schema iam, app to semester_api;
set local role semester_owner;
alter default privileges in schema iam revoke execute on functions from public;
alter default privileges in schema app revoke execute on functions from public;
commit;

-- runtime login (the document leaves this to the secrets process; test-only, no password)
create role semester_runtime_login login nobypassrls nosuperuser nocreatedb nocreaterole noinherit;
grant semester_api to semester_runtime_login;
-- CHANGED: the login is NOINHERIT and must SET ROLE semester_api; with INHERIT it would also work.
-- Kept NOINHERIT so the test proves the login itself holds nothing.

-- 002 schema
begin;
set local role semester_owner;
create table iam.users (
  id uuid primary key,
  display_name text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);
create table iam.tenants (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('personal', 'institution', 'company')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now()
);
create table iam.workspaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references iam.tenants(id),
  name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  unique (tenant_id, id)
);
create table iam.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references iam.tenants(id),
  user_id uuid not null references iam.users(id),
  status text not null check (status in ('invited', 'active', 'suspended', 'revoked')),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);
create table iam.roles (id uuid primary key default gen_random_uuid(), key text not null unique);
create table iam.capabilities (id uuid primary key default gen_random_uuid(), key text not null unique);
create table iam.role_capabilities (
  role_id uuid not null references iam.roles(id),
  capability_id uuid not null references iam.capabilities(id),
  primary key (role_id, capability_id)
);
create table iam.role_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null references iam.roles(id),
  workspace_id uuid,
  valid_until timestamptz,
  foreign key (tenant_id, membership_id) references iam.memberships(tenant_id, id),
  foreign key (tenant_id, workspace_id) references iam.workspaces(tenant_id, id)
);
create table app.tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  workspace_id uuid not null,
  owner_user_id uuid not null references iam.users(id),
  title text not null check (length(title) between 1 and 500),
  state text not null default 'open' check (state in ('open', 'in_progress', 'completed', 'cancelled')),
  due_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, workspace_id) references iam.workspaces(tenant_id, id),
  foreign key (tenant_id, owner_user_id) references iam.memberships(tenant_id, user_id)
);
create index memberships_user_tenant on iam.memberships(user_id, tenant_id, status);
create index role_assignments_member_scope on iam.role_assignments(tenant_id, membership_id, workspace_id);
create index tasks_tenant_owner_due on app.tasks(tenant_id, owner_user_id, due_at);
create index tasks_tenant_workspace on app.tasks(tenant_id, workspace_id, id);
commit;

-- 003 context and authorization functions
begin;
set local role semester_owner;
create function iam.current_user_id() returns uuid language sql stable security invoker
  set search_path = pg_catalog as $$ select nullif(current_setting('semester.user_id', true), '')::uuid $$;
create function iam.current_tenant_id() returns uuid language sql stable security invoker
  set search_path = pg_catalog as $$ select nullif(current_setting('semester.tenant_id', true), '')::uuid $$;
create function iam.is_active_member(p_tenant_id uuid) returns boolean language sql stable security invoker
  set search_path = pg_catalog as $$
  select p_tenant_id = iam.current_tenant_id()
    and exists (
      select 1 from iam.memberships m
      join iam.users u on u.id = m.user_id
      join iam.tenants t on t.id = m.tenant_id
      where m.tenant_id = p_tenant_id and m.user_id = iam.current_user_id()
        and m.status = 'active' and u.status = 'active' and t.status = 'active'
        and (m.valid_until is null or m.valid_until > statement_timestamp()))
$$;
create function iam.has_capability(p_tenant_id uuid, p_workspace_id uuid, p_capability text)
  returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select iam.is_active_member(p_tenant_id)
    and exists (
      select 1 from iam.memberships m
      join iam.role_assignments ra on ra.tenant_id = m.tenant_id and ra.membership_id = m.id
      join iam.role_capabilities rc on rc.role_id = ra.role_id
      join iam.capabilities c on c.id = rc.capability_id
      where m.tenant_id = p_tenant_id and m.user_id = iam.current_user_id()
        and c.key = p_capability
        and (ra.workspace_id is null or ra.workspace_id = p_workspace_id)
        and (ra.valid_until is null or ra.valid_until > statement_timestamp()))
$$;
grant execute on function iam.current_user_id() to semester_api;
grant execute on function iam.current_tenant_id() to semester_api;
grant execute on function iam.is_active_member(uuid) to semester_api;
grant execute on function iam.has_capability(uuid, uuid, text) to semester_api;
commit;

-- 004 RLS
begin;
set local role semester_owner;
alter table iam.users enable row level security;            alter table iam.users force row level security;
alter table iam.tenants enable row level security;          alter table iam.tenants force row level security;
alter table iam.workspaces enable row level security;       alter table iam.workspaces force row level security;
alter table iam.memberships enable row level security;      alter table iam.memberships force row level security;
alter table iam.role_assignments enable row level security; alter table iam.role_assignments force row level security;
alter table app.tasks enable row level security;            alter table app.tasks force row level security;
grant select on iam.users, iam.tenants, iam.workspaces, iam.memberships, iam.roles,
  iam.capabilities, iam.role_capabilities, iam.role_assignments to semester_api;
create policy users_self on iam.users for select to semester_api using (id = iam.current_user_id());
create policy tenants_current on iam.tenants for select to semester_api using (id = iam.current_tenant_id());
create policy memberships_self on iam.memberships for select to semester_api
  using (user_id = iam.current_user_id() and tenant_id = iam.current_tenant_id());
create policy workspaces_member on iam.workspaces for select to semester_api
  using (tenant_id = iam.current_tenant_id() and iam.is_active_member(tenant_id));
create policy assignments_self on iam.role_assignments for select to semester_api
  using (tenant_id = iam.current_tenant_id() and exists (
    select 1 from iam.memberships m where m.id = membership_id
      and m.tenant_id = role_assignments.tenant_id and m.user_id = iam.current_user_id()));
grant select, insert, delete on app.tasks to semester_api;
grant update (title, state, due_at) on app.tasks to semester_api;
create policy tasks_read on app.tasks for select to semester_api using (
  tenant_id = iam.current_tenant_id() and (
    (owner_user_id = iam.current_user_id() and iam.has_capability(tenant_id, workspace_id, 'tasks.read_own'))
    or iam.has_capability(tenant_id, workspace_id, 'tasks.read_any')));
create policy tasks_insert_own on app.tasks for insert to semester_api with check (
  tenant_id = iam.current_tenant_id() and owner_user_id = iam.current_user_id()
  and iam.has_capability(tenant_id, workspace_id, 'tasks.create_own'));
create policy tasks_update on app.tasks for update to semester_api
  using (tenant_id = iam.current_tenant_id() and (
    (owner_user_id = iam.current_user_id() and iam.has_capability(tenant_id, workspace_id, 'tasks.update_own'))
    or iam.has_capability(tenant_id, workspace_id, 'tasks.update_any')))
  with check (tenant_id = iam.current_tenant_id() and (
    (owner_user_id = iam.current_user_id() and iam.has_capability(tenant_id, workspace_id, 'tasks.update_own'))
    or iam.has_capability(tenant_id, workspace_id, 'tasks.update_any')));
create policy tasks_delete_own on app.tasks for delete to semester_api using (
  tenant_id = iam.current_tenant_id() and owner_user_id = iam.current_user_id()
  and iam.has_capability(tenant_id, workspace_id, 'tasks.delete_own'));
commit;

-- 005 version trigger
begin;
set local role semester_owner;
create function app.bump_task_version() returns trigger language plpgsql security invoker
  set search_path = pg_catalog as $$
begin
  new.version := old.version + 1;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
create trigger tasks_version_before_update before update on app.tasks
  for each row execute function app.bump_task_version();
commit;
