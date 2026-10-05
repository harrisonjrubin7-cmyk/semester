-- Privacy and data-rights case operations for the Operations Console.
--
-- This first boundary is metadata-only. The caller cannot name a tenant and
-- the result never returns the request subject or the request's free-text
-- detail. Allowed tenants are derived from live, exact-school
-- `data_request:handle` grants, in addition to the platform console shell.

alter table public.data_subject_request
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists verification_basis text
    check (verification_basis is null or length(trim(verification_basis)) between 3 and 200),
  add column if not exists verification_evidence text
    check (verification_evidence is null or verification_evidence ~ '^[A-Za-z0-9._:/-]{3,200}$');

-- Older requests may have a timestamp without the actor or evidence that the
-- new verification contract requires. Make those rows explicitly unverified
-- so the constraint can be installed without inventing provenance.
update public.data_subject_request
   set verified_at = null
 where verified_at is not null
   and (verified_by is null or verification_basis is null or verification_evidence is null);

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.data_subject_request'::regclass
       and conname = 'data_subject_request_assignment_pair'
  ) then
    alter table public.data_subject_request
      add constraint data_subject_request_assignment_pair
      check ((assigned_to is null) = (assigned_at is null));
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.data_subject_request'::regclass
       and conname = 'data_subject_request_verification_complete'
  ) then
    alter table public.data_subject_request
      add constraint data_subject_request_verification_complete
      check (
        (verified_at is null and verified_by is null and verification_basis is null and verification_evidence is null)
        or
        (verified_at is not null and verified_by is not null and verification_basis is not null and verification_evidence is not null)
      );
  end if;
end $$;

create or replace function private.clear_privacy_request_user_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.data_subject_request
     set assigned_to = null, assigned_at = null
   where assigned_to = old.id;
  update public.data_subject_request
     set verified_by = null, verified_at = null,
         verification_basis = null, verification_evidence = null
   where verified_by = old.id;
  return old;
end $$;

revoke all on function private.clear_privacy_request_user_links() from public, anon, authenticated;
drop trigger if exists clear_privacy_request_user_links on auth.users;
create trigger clear_privacy_request_user_links
  before delete on auth.users
  for each row execute function private.clear_privacy_request_user_links();

create index if not exists data_subject_request_by_assignee
  on public.data_subject_request (assigned_to, due_at);

create index if not exists data_subject_request_by_verifier
  on public.data_subject_request (verified_by);

create or replace function public.console_privacy_requests(include_demo boolean default false)
returns table (
  request_id uuid,
  request_ref text,
  tenant_id text,
  tenant_name text,
  is_demo boolean,
  kind text,
  requested_by text,
  status text,
  received_at timestamptz,
  due_at timestamptz,
  overdue boolean,
  identity_state text,
  assigned_to uuid,
  assigned_at timestamptz,
  assigned_to_me boolean,
  hold_state text,
  affected_stores text[],
  deletion_approval_id uuid,
  deletion_approval_status text,
  classification text,
  provenance text,
  limitation text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or not private.has_capability('console:operate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'console:operate at platform scope is required.';
  end if;

  if not private.has_capability('data_request:handle', 'platform', '')
     and not exists (
    select 1
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
     where g.subject = (select auth.uid())
       and rc.capability = 'data_request:handle'
       and g.scope_kind = 'school'
       and g.scope_id <> ''
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  ) then
    raise exception using errcode = '42501',
      message = 'data_request:handle at platform scope or over an exact school is required.';
  end if;

  if include_demo and exists (
    select 1
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
      join public.schools s on s.id = g.scope_id and s.is_demo
     where g.subject = (select auth.uid())
       and rc.capability = 'data_request:handle'
       and g.scope_kind = 'school'
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and not private.has_capability('tenant:implement', 'school', s.id)
  ) then
    raise exception using errcode = '42501',
      message = 'tenant:implement over each demo school is required to include demo requests.';
  end if;

  return query
  with allowed as (
    select distinct s.id, s.name, s.is_demo
      from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role
      join public.schools s on s.id = g.scope_id
     where g.subject = (select auth.uid())
       and rc.capability = 'data_request:handle'
       and g.scope_kind = 'school'
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
       and (include_demo or not s.is_demo)
    union all
    select null::text, 'Platform / unassigned'::text, false
     where private.has_capability('data_request:handle', 'platform', '')
  )
  select
    r.id,
    'DSR-' || upper(left(replace(r.id::text, '-', ''), 10)),
    a.id,
    a.name,
    a.is_demo,
    r.kind,
    r.requested_by,
    r.status,
    r.received_at,
    r.due_at,
    r.resolved_at is null and r.due_at < now(),
    case when r.verified_at is null then 'unverified' else 'verified' end,
    r.assigned_to,
    r.assigned_at,
    coalesce(r.assigned_to = (select auth.uid()), false),
    case when private.account_is_held(r.subject) then 'live_hold' else 'clear' end,
    case r.kind
      when 'export' then array['account-scoped server records', 'retained audit history', 'device-only data outside server scope']::text[]
      when 'erasure' then array['erasable account-scoped server records', 'retained audit history', 'external and backup propagation review']::text[]
      when 'correction' then array['named source-of-record fields', 'downstream copies identified in evidence']::text[]
      else array['named processing purpose', 'downstream processors identified in evidence']::text[]
    end,
    approval.id,
    case when approval.status in ('pending', 'approved') and approval.expires_at <= now()
      then 'expired' else approval.status end,
    'restricted'::text,
    'public.data_subject_request + public.legal_holds + public.approval_request'::text,
    'Metadata only. The subject identifier and request detail require a separate, audited, MFA-gated read after assignment.'::text
  from allowed a
  join public.data_subject_request r on r.tenant_id is not distinct from a.id
  left join lateral (
    select ar.id, ar.status, ar.expires_at
      from public.approval_request ar
     where ar.duty_id = 'data-deletion'
       and ar.tenant_id is not distinct from r.tenant_id
       and ar.target = r.id::text
     order by case when ar.status = 'executed' then 0 else 1 end,
              ar.created_at desc, ar.id desc
     limit 1
  ) approval on true
  order by (r.resolved_at is null) desc, r.due_at, r.received_at, r.id;
end $$;

revoke all on function public.console_privacy_requests(boolean) from public, anon;
grant execute on function public.console_privacy_requests(boolean) to authenticated;

comment on function public.console_privacy_requests(boolean) is
  'Identity-minimized privacy request queue. Tenantless requests require platform data_request:handle; school requests come from live exact-school grants; demo requests require explicit inclusion plus tenant:implement.';
