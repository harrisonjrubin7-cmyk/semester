create extension if not exists pgcrypto;

-- Supabase provides anon/authenticated; plain Postgres does not, so create them
-- only when absent.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

-- Subject role for row-level security. Connection roles must be granted this
-- role so repository code can `set local role` into it (see withRlsTransaction).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'semester_app') then
    create role semester_app nologin noinherit;
  end if;
end $$;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  primary_email text not null unique,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  account_id uuid not null references public.accounts(id),
  role_key text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (tenant_id, account_id)
);
create index memberships_account_idx on public.memberships (account_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  account_id uuid not null references public.accounts(id),
  tenant_id uuid references public.tenants(id),
  membership_id uuid references public.memberships(id),
  active_workspace text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Identity tables are never exposed to anon/authenticated; the app reads them
-- only through resolve_session below.
alter table public.tenants enable row level security;
alter table public.accounts enable row level security;
alter table public.memberships enable row level security;
alter table public.sessions enable row level security;
revoke all on public.tenants, public.accounts, public.memberships, public.sessions from anon, authenticated;

-- Resolves a hashed session token to its account context. Returns no row for an
-- unknown, expired, or suspended-membership session.
create or replace function public.resolve_session(p_token_hash text)
returns table (
  session_id uuid,
  account_id uuid,
  tenant_id uuid,
  membership_id uuid,
  active_workspace text,
  role_key text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.account_id, s.tenant_id, s.membership_id, s.active_workspace, m.role_key
    from public.sessions s
    left join public.memberships m on m.id = s.membership_id
   where s.token_hash = p_token_hash
     and s.expires_at > now()
     and (m.id is null or m.status = 'active');
$$;

revoke execute on function public.resolve_session(text) from public;
