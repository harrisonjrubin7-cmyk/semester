create extension if not exists pgcrypto;
create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.visibility as enum ('private', 'organization');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create table public.workflow_recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  visibility public.visibility not null default 'private',
  title text not null check (char_length(title) between 1 and 160),
  answers jsonb not null,
  primary_platform text not null check (primary_platform in ('claude-artifacts','chatgpt-canvas','v0')),
  secondary_platform text not null check (secondary_platform in ('claude-artifacts','chatgpt-canvas','v0')),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  result jsonb not null,
  created_at timestamptz not null default now(),
  check (visibility = 'private' or organization_id is not null)
);

-- Membership helpers. SECURITY DEFINER avoids recursive RLS on organization_members.
create or replace function public.is_org_member(org uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m where m.organization_id = org and m.user_id = auth.uid()) $$;
create or replace function public.has_org_role(org uuid, roles public.org_role[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_members m where m.organization_id = org and m.user_id = auth.uid() and m.role = any(roles)) $$;
revoke all on function public.is_org_member(uuid), public.has_org_role(uuid, public.org_role[]) from public;
grant execute on function public.is_org_member(uuid), public.has_org_role(uuid, public.org_role[]) to authenticated;

-- Creator becomes owner.
create or replace function public.add_org_owner() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into organization_members (organization_id, user_id, role) values (new.id, new.created_by, 'owner'); return new; end $$;
create trigger organizations_owner after insert on public.organizations for each row execute function public.add_org_owner();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.workflow_recommendations enable row level security;

create policy org_select on public.organizations for select to authenticated using (public.is_org_member(id));
create policy org_insert on public.organizations for insert to authenticated with check (created_by = auth.uid());
create policy org_update on public.organizations for update to authenticated using (public.has_org_role(id, array['owner','admin']::public.org_role[]));
create policy org_delete on public.organizations for delete to authenticated using (public.has_org_role(id, array['owner']::public.org_role[]));

create policy mem_select on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
create policy mem_write on public.organization_members for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.org_role[]) and (role <> 'owner' or public.has_org_role(organization_id, array['owner']::public.org_role[])));

create policy rec_select on public.workflow_recommendations for select to authenticated
  using (owner_id = auth.uid() or (visibility = 'organization' and public.is_org_member(organization_id)));
create policy rec_insert on public.workflow_recommendations for insert to authenticated
  with check (owner_id = auth.uid() and (organization_id is null or public.has_org_role(organization_id, array['owner','admin','member']::public.org_role[])));
create policy rec_update on public.workflow_recommendations for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy rec_delete on public.workflow_recommendations for delete to authenticated
  using (owner_id = auth.uid() or (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']::public.org_role[])));
create index on public.workflow_recommendations (owner_id, created_at desc);
create index on public.workflow_recommendations (organization_id) where organization_id is not null;
