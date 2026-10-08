-- 001_core_workflow_router.sql
-- Organizations, memberships and saved workflow recommendations.
--
-- Authorization lives here, in Row Level Security. The UI hides buttons for
-- convenience only; nothing in the application relies on that.
--
-- Roles (organization_members.role):
--   owner   full control, including deleting the organization and managing owners/admins
--   admin   manages members and viewers, plus everything a member can do
--   member  creates and edits shared data
--   viewer  read-only
--
-- Helper functions live in the `private` schema, which is NOT exposed through
-- the Data API, and run SECURITY DEFINER so policies on organization_members
-- can check membership without recursing into their own policies.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.platform_id as enum ('claude-artifacts', 'chatgpt-canvas', 'v0');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  created_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_id_idx on public.organization_members (user_id);

create table public.workflow_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- null: private to user_id. set: shared with that organization's members.
  organization_id uuid references public.organizations (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  primary_platform public.platform_id not null,
  secondary_platform public.platform_id not null,
  confidence integer not null check (confidence between 0 and 100),
  created_at timestamptz not null default now()
);
create index workflow_recommendations_user_id_idx on public.workflow_recommendations (user_id, created_at desc);
create index workflow_recommendations_org_id_idx on public.workflow_recommendations (organization_id)
  where organization_id is not null;

-- ---------------------------------------------------------------------------
-- Policy helpers (private schema, security definer, fixed search_path)
-- ---------------------------------------------------------------------------
create function private.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create function private.has_org_role(p_org uuid, p_roles public.org_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

revoke execute on function private.is_org_member(uuid) from public;
revoke execute on function private.has_org_role(uuid, public.org_role[]) from public;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.has_org_role(uuid, public.org_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- The creator of an organization becomes its first owner.
create function private.add_creator_as_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger organizations_add_creator_as_owner
  after insert on public.organizations
  for each row execute function private.add_creator_as_owner();

-- An organization can never be left without an owner (except by deleting it).
create function private.guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if exists (select 1 from public.organizations o where o.id = old.organization_id)
       and not exists (
         select 1 from public.organization_members m
         where m.organization_id = old.organization_id and m.role = 'owner' and m.user_id <> old.user_id
       ) then
      raise exception 'An organization must keep at least one owner' using errcode = 'check_violation';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger organization_members_guard_last_owner
  before update or delete on public.organization_members
  for each row execute function private.guard_last_owner();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.workflow_recommendations enable row level security;

revoke all on public.organizations, public.organization_members, public.workflow_recommendations from anon;
grant select, insert, update, delete on public.organizations, public.organization_members, public.workflow_recommendations to authenticated;

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using (private.is_org_member(id) or created_by = (select auth.uid()));
create policy organizations_insert on public.organizations for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy organizations_update on public.organizations for update to authenticated
  using (private.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (private.has_org_role(id, array['owner', 'admin']::public.org_role[]));
create policy organizations_delete on public.organizations for delete to authenticated
  using (private.has_org_role(id, array['owner']::public.org_role[]));

-- organization_members: owners manage everyone; admins manage members and viewers only.
create policy organization_members_select on public.organization_members for select to authenticated
  using (private.is_org_member(organization_id));
create policy organization_members_insert on public.organization_members for insert to authenticated
  with check (
    private.has_org_role(organization_id, array['owner']::public.org_role[])
    or (private.has_org_role(organization_id, array['admin']::public.org_role[]) and role in ('member', 'viewer'))
  );
create policy organization_members_update on public.organization_members for update to authenticated
  using (
    private.has_org_role(organization_id, array['owner']::public.org_role[])
    or (private.has_org_role(organization_id, array['admin']::public.org_role[]) and role in ('member', 'viewer'))
  )
  with check (
    private.has_org_role(organization_id, array['owner']::public.org_role[])
    or (private.has_org_role(organization_id, array['admin']::public.org_role[]) and role in ('member', 'viewer'))
  );
create policy organization_members_delete on public.organization_members for delete to authenticated
  using (
    user_id = (select auth.uid())  -- anyone may leave (the last-owner trigger still applies)
    or private.has_org_role(organization_id, array['owner']::public.org_role[])
    or (private.has_org_role(organization_id, array['admin']::public.org_role[]) and role in ('member', 'viewer'))
  );

-- workflow_recommendations: private to the author unless shared with an organization.
create policy workflow_recommendations_select on public.workflow_recommendations for select to authenticated
  using (
    user_id = (select auth.uid())
    or (organization_id is not null and private.is_org_member(organization_id))
  );
create policy workflow_recommendations_insert on public.workflow_recommendations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (organization_id is null or private.has_org_role(organization_id, array['owner', 'admin', 'member']::public.org_role[]))
  );
create policy workflow_recommendations_update on public.workflow_recommendations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (organization_id is null or private.has_org_role(organization_id, array['owner', 'admin', 'member']::public.org_role[]))
  );
create policy workflow_recommendations_delete on public.workflow_recommendations for delete to authenticated
  using (
    user_id = (select auth.uid())
    or (organization_id is not null and private.has_org_role(organization_id, array['owner', 'admin']::public.org_role[]))
  );
