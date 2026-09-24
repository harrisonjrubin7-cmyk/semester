-- Immutable, tenant-readable evidence for future role grant changes.
--
-- `tenant_policy_audit_event` already records tenant settings, AI policy,
-- approved-source and consent changes. Role grants are deliberately written
-- only by trusted services, but until this migration a grant, revocation or
-- expiry change left no tenant-readable evidence. This table closes that gap
-- without copying names, email addresses or full grant rows into the log.

create table if not exists public.role_grant_audit_event (
  id uuid primary key default gen_random_uuid(),
  -- Null only for a genuinely platform-scoped event or a resource whose
  -- subject had no verified school at the moment of the change. Those events
  -- remain service-readable and are never exposed through tenant RLS.
  tenant_id text,
  grant_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  role text not null,
  scope_kind text not null,
  scope_id text not null,
  provenance text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  -- Stable pseudonymous identifiers let an authorized investigator correlate
  -- events when necessary without retaining raw account IDs in this table.
  subject_sha256 text not null check (subject_sha256 ~ '^[0-9a-f]{64}$'),
  grantor_sha256 text check (grantor_sha256 is null or grantor_sha256 ~ '^[0-9a-f]{64}$'),
  actor_sha256 text check (actor_sha256 is null or actor_sha256 ~ '^[0-9a-f]{64}$'),
  actor_kind text not null check (actor_kind in ('authenticated', 'service')),
  occurred_at timestamptz not null default now()
);

create index if not exists role_grant_audit_by_tenant_time
  on public.role_grant_audit_event (tenant_id, occurred_at desc);
create index if not exists role_grant_audit_by_grant_time
  on public.role_grant_audit_event (grant_id, occurred_at desc);

alter table public.role_grant_audit_event enable row level security;
revoke all on table public.role_grant_audit_event from anon, authenticated;
grant select on table public.role_grant_audit_event to authenticated;

create policy "tenant auditors read role grant events" on public.role_grant_audit_event
  for select to authenticated
  using (
    tenant_id is not null
    and private.has_capability('audit:read', 'school', tenant_id)
  );

-- Supabase installs pgcrypto in `extensions`; the disposable plain-Postgres
-- harness historically installs it in `public`. Resolve that environmental
-- difference once, at migration time, rather than weakening the production
-- function's empty search path or silently substituting a shorter hash.
do $$
begin
  if to_regprocedure('extensions.digest(text,text)') is not null then
    execute $fn$
      create or replace function private.role_audit_sha256(value text)
      returns text language sql immutable security invoker set search_path = ''
      as 'select encode(extensions.digest(value, ''sha256''), ''hex'')'
    $fn$;
  elsif to_regprocedure('public.digest(text,text)') is not null then
    execute $fn$
      create or replace function private.role_audit_sha256(value text)
      returns text language sql immutable security invoker set search_path = ''
      as 'select encode(public.digest(value, ''sha256''), ''hex'')'
    $fn$;
  else
    raise exception 'pgcrypto digest(text,text) is required for role audit pseudonyms.';
  end if;
end $$;

revoke all on function private.role_audit_sha256(text) from public, anon, authenticated;

create or replace function private.audit_role_grant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data public.role_grants;
  event_tenant text;
  caller uuid := auth.uid();
begin
  if tg_op = 'DELETE' then row_data := old; else row_data := new; end if;
  event_tenant := case
    when row_data.scope_kind = 'school' then row_data.scope_id
    else (
      select p.school_id from public.profiles p where p.user_id = row_data.subject
    )
  end;

  insert into public.role_grant_audit_event (
    tenant_id, grant_id, action, role, scope_kind, scope_id, provenance,
    expires_at, revoked_at, subject_sha256, grantor_sha256, actor_sha256,
    actor_kind
  ) values (
    event_tenant,
    row_data.id,
    lower(tg_op),
    row_data.role,
    row_data.scope_kind,
    row_data.scope_id,
    row_data.provenance,
    row_data.expires_at,
    row_data.revoked_at,
    private.role_audit_sha256(row_data.subject::text),
    case when row_data.granted_by is null then null
      else private.role_audit_sha256(row_data.granted_by::text) end,
    case when caller is null then null
      else private.role_audit_sha256(caller::text) end,
    case when caller is null then 'service' else 'authenticated' end
  );

  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function private.refuse_role_grant_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Role grant audit events are immutable.';
end $$;

revoke all on function private.audit_role_grant_change() from public, anon, authenticated;
revoke all on function private.refuse_role_grant_audit_change() from public, anon, authenticated;

create trigger audit_role_grant_change
  after insert or update or delete on public.role_grants
  for each row execute function private.audit_role_grant_change();

create trigger keep_role_grant_audit_immutable
  before update or delete on public.role_grant_audit_event
  for each row execute function private.refuse_role_grant_audit_change();

comment on table public.role_grant_audit_event is
  'Append-only, metadata-minimized evidence of role grants, changes and revocations. Tenant auditors see only their school.';
