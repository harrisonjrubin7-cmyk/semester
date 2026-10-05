-- A representative scoped read for the Operations Console.
--
-- The caller names a tenant only as a requested resource. The function derives
-- authority from live server-side grants over that exact tenant (or the
-- platform), never from the parameter itself. An optional subject narrows the
-- already-authorized result and cannot widen it. Demo access is a second gate:
-- even a platform console operator needs tenant:implement over the named demo
-- tenant and must opt in explicitly.

create or replace function public.console_tenant_access(
  want_tenant      text,
  want_subject     uuid default null,
  after_granted_at timestamptz default null,
  after_id         uuid default null,
  want_limit       integer default 50,
  include_demo     boolean default false
)
returns table (
  grant_id uuid,
  subject uuid,
  role text,
  scope_kind text,
  scope_id text,
  provenance text,
  granted_by uuid,
  granted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  active boolean,
  source text,
  observed_at timestamptz,
  limitation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  tenant_is_demo boolean;
begin
  if auth.uid() is null or not (
    private.has_capability('console:operate', 'platform', '')
    or private.has_capability('console:operate', 'school', want_tenant)
    or private.has_capability('audit:read', 'school', want_tenant)
  ) then
    raise exception using errcode = '42501',
      message = 'console:operate or audit:read over the requested tenant is required.';
  end if;

  if want_limit is null or want_limit < 1 or want_limit > 100 then
    raise exception using errcode = '22023', message = 'want_limit must be between 1 and 100.';
  end if;
  if (after_granted_at is null) <> (after_id is null) then
    raise exception using errcode = '22023', message = 'Both pagination cursor fields are required together.';
  end if;

  select s.is_demo into tenant_is_demo
    from public.schools s
   where s.id = want_tenant;
  if not found then
    raise exception using errcode = '22023', message = 'Unknown tenant.';
  end if;

  if include_demo and not private.has_capability('tenant:implement', 'school', want_tenant) then
    raise exception using errcode = '42501',
      message = 'tenant:implement over the requested tenant is required to include demo data.';
  end if;
  if tenant_is_demo and not include_demo then
    return;
  end if;

  return query
  select
    g.id,
    g.subject,
    g.role,
    g.scope_kind,
    g.scope_id,
    g.provenance,
    g.granted_by,
    g.granted_at,
    g.expires_at,
    g.revoked_at,
    g.revoked_at is null and (g.expires_at is null or g.expires_at > now()),
    'public.role_grants'::text,
    now(),
    'A grant records authorization provenance; it does not independently prove institutional approval or current employment.'::text
  from public.role_grants g
  where g.scope_kind <> 'platform'
    and private.scope_in_tenant(g.scope_id, want_tenant)
    and (want_subject is null or g.subject = want_subject)
    and (
      after_granted_at is null
      or (g.granted_at, g.id) < (after_granted_at, after_id)
    )
  order by g.granted_at desc, g.id desc
  limit want_limit;
end $$;

revoke all on function public.console_tenant_access(text, uuid, timestamptz, uuid, integer, boolean)
  from public, anon;
grant execute on function public.console_tenant_access(text, uuid, timestamptz, uuid, integer, boolean)
  to authenticated;

comment on function public.console_tenant_access(text, uuid, timestamptz, uuid, integer, boolean) is
  'Bounded, provenance-bearing tenant access inventory. Scope is derived from live grants; demo access additionally requires tenant:implement for that tenant.';
