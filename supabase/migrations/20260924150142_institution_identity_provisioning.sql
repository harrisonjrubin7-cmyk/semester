-- Institution-controlled SAML identity and SCIM provisioning state.
-- Browser metadata never grants membership; service-role functions are the
-- only mutation path used by the provisioning gateway.

create table public.institution_identity_provider (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  provider_identifier text not null check (length(trim(provider_identifier)) between 1 and 300),
  provider_type text not null check (provider_type in ('saml')),
  status text not null default 'pending' check (status in ('pending', 'authorized', 'disabled')),
  domains text[] not null default '{}',
  attribute_mapping jsonb not null default '{}'::jsonb,
  authorized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_identifier),
  unique (id, tenant_id),
  constraint identity_provider_authorization_state check (
    (status = 'authorized' and authorized_at is not null)
    or (status <> 'authorized')
  )
);

create index institution_identity_provider_by_tenant
  on public.institution_identity_provider (tenant_id);

create table public.institution_membership (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  identity_provider_id uuid,
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'deprovisioned')),
  roles text[] not null default '{}',
  source text not null default 'institution_provisioned' check (source in ('institution_provisioned', 'institution_admin')),
  provisioned_at timestamptz not null default now(),
  deprovisioned_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  constraint institution_membership_provider_fkey
    foreign key (identity_provider_id, tenant_id)
    references public.institution_identity_provider (id, tenant_id) on delete restrict,
  constraint institution_membership_roles_valid check (
    roles <@ array[
      'student', 'faculty', 'teaching_assistant', 'advisor', 'admin',
      'staff', 'applicant', 'payer', 'family', 'alumni'
    ]::text[]
  ),
  constraint institution_membership_deprovisioned_state check (
    (status = 'deprovisioned' and deprovisioned_at is not null and roles = '{}')
    or (status <> 'deprovisioned' and deprovisioned_at is null)
  )
);

create unique index institution_membership_one_user_per_tenant
  on public.institution_membership (tenant_id, auth_user_id)
  where auth_user_id is not null;
create index institution_membership_by_auth_user
  on public.institution_membership (auth_user_id);
create index institution_membership_by_provider
  on public.institution_membership (identity_provider_id, tenant_id);
create index institution_membership_by_tenant
  on public.institution_membership (tenant_id);

create table public.scim_credential (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 200),
  secret_salt bytea not null check (octet_length(secret_salt) >= 16),
  secret_hash bytea not null check (octet_length(secret_hash) >= 32),
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (id, tenant_id),
  constraint scim_credential_revocation_state check (
    (status = 'revoked' and revoked_at is not null)
    or (status = 'active' and revoked_at is null)
  )
);

create index scim_credential_by_tenant on public.scim_credential (tenant_id);

create table public.scim_external_identity (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  membership_id uuid not null,
  external_id text not null check (length(trim(external_id)) between 1 and 300),
  user_name text not null check (length(trim(user_name)) between 1 and 300),
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 300),
  active boolean not null default true,
  group_external_ids text[] not null default '{}',
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_id),
  constraint scim_external_identity_membership_fkey
    foreign key (membership_id, tenant_id)
    references public.institution_membership (id, tenant_id) on delete cascade
);

create unique index scim_external_identity_user_name
  on public.scim_external_identity (tenant_id, lower(user_name));
create index scim_external_identity_by_membership
  on public.scim_external_identity (membership_id, tenant_id);

create table public.scim_group_mapping (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  external_group_id text not null check (length(trim(external_group_id)) between 1 and 300),
  display_name text not null check (length(trim(display_name)) between 1 and 300),
  roles text[] not null default '{}',
  active boolean not null default true,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_group_id),
  constraint scim_group_mapping_roles_valid check (
    roles <@ array[
      'student', 'faculty', 'teaching_assistant', 'advisor', 'admin',
      'staff', 'applicant', 'payer', 'family', 'alumni'
    ]::text[]
  )
);

create index scim_group_mapping_by_approver on public.scim_group_mapping (approved_by);

create table public.provisioning_audit_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  credential_id uuid,
  membership_id uuid,
  request_id text not null check (length(trim(request_id)) between 1 and 300),
  resource_type text not null check (resource_type in ('User', 'Group', 'Credential')),
  external_id text check (external_id is null or length(external_id) <= 300),
  action text not null check (action in ('create', 'replace', 'patch', 'deactivate', 'reactivate', 'group_replace', 'refused')),
  outcome text not null check (outcome in ('accepted', 'refused', 'unknown_group', 'idempotent')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (tenant_id, request_id),
  constraint provisioning_audit_credential_fkey
    foreign key (credential_id, tenant_id)
    references public.scim_credential (id, tenant_id) on delete set null,
  constraint provisioning_audit_membership_fkey
    foreign key (membership_id, tenant_id)
    references public.institution_membership (id, tenant_id) on delete set null
);

create index provisioning_audit_by_tenant_time
  on public.provisioning_audit_event (tenant_id, occurred_at desc);
create index provisioning_audit_by_credential
  on public.provisioning_audit_event (credential_id, tenant_id);
create index provisioning_audit_by_membership
  on public.provisioning_audit_event (membership_id, tenant_id);

alter table public.institution_identity_provider enable row level security;
alter table public.institution_membership enable row level security;
alter table public.scim_credential enable row level security;
alter table public.scim_external_identity enable row level security;
alter table public.scim_group_mapping enable row level security;
alter table public.provisioning_audit_event enable row level security;

revoke all on table public.institution_identity_provider from anon, authenticated;
revoke all on table public.institution_membership from anon, authenticated;
revoke all on table public.scim_credential from anon, authenticated;
revoke all on table public.scim_external_identity from anon, authenticated;
revoke all on table public.scim_group_mapping from anon, authenticated;
revoke all on table public.provisioning_audit_event from anon, authenticated;

grant select on table public.institution_identity_provider to authenticated;
grant select on table public.institution_membership to authenticated;
grant select on table public.scim_external_identity to authenticated;
grant select on table public.scim_group_mapping to authenticated;
grant select on table public.provisioning_audit_event to authenticated;
grant insert, update on table public.scim_group_mapping to authenticated;

create policy "tenant auditors read identity providers" on public.institution_identity_provider
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id));

create policy "people read their institutional memberships" on public.institution_membership
  for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or private.has_capability('audit:read', 'school', tenant_id)
  );

create policy "people read their external identity" on public.scim_external_identity
  for select to authenticated
  using (
    exists (
      select 1 from public.institution_membership m
       where m.id = scim_external_identity.membership_id
         and m.tenant_id = scim_external_identity.tenant_id
         and m.auth_user_id = (select auth.uid())
    )
    or private.has_capability('audit:read', 'school', tenant_id)
  );

create policy "tenant administrators read group mappings" on public.scim_group_mapping
  for select to authenticated
  using (
    private.has_capability('tenant:configure', 'school', tenant_id)
    or private.has_capability('audit:read', 'school', tenant_id)
  );
create policy "tenant administrators add group mappings" on public.scim_group_mapping
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id));
create policy "tenant administrators update group mappings" on public.scim_group_mapping
  for update to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id))
  with check (private.has_capability('tenant:configure', 'school', tenant_id));

create policy "tenant auditors read provisioning events" on public.provisioning_audit_event
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id));

create or replace function private.refuse_provisioning_audit_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Provisioning audit events are immutable.';
end $$;

create trigger provisioning_audit_immutable
before update or delete on public.provisioning_audit_event
for each row execute function private.refuse_provisioning_audit_change();

create or replace function private.scim_credential_material(want_id uuid)
returns table (credential_id uuid, tenant_id text, secret_salt bytea, secret_hash bytea)
language sql stable security definer set search_path = '' as $$
  select c.id, c.tenant_id, c.secret_salt, c.secret_hash
    from public.scim_credential c
   where c.id = want_id and c.status = 'active'
     and (c.expires_at is null or c.expires_at > now())
$$;

create or replace function private.provision_scim_user(
  want_tenant text,
  want_credential uuid,
  want_request_id text,
  want_external_id text,
  want_user_name text,
  want_display_name text,
  want_active boolean
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  member_id uuid;
  existing_event public.provisioning_audit_event;
  prior_status text;
begin
  if length(trim(want_request_id)) not between 1 and 300
     or length(trim(want_external_id)) not between 1 and 300
     or length(trim(want_user_name)) not between 1 and 300
     or (want_display_name is not null and length(trim(want_display_name)) not between 1 and 300)
  then raise exception 'Invalid SCIM user input.'; end if;

  if not exists (
    select 1 from public.scim_credential c
     where c.id = want_credential and c.tenant_id = want_tenant
       and c.status = 'active' and (c.expires_at is null or c.expires_at > now())
  ) then raise exception 'SCIM credential is not active for this tenant.'; end if;

  select * into existing_event from public.provisioning_audit_event e
   where e.tenant_id = want_tenant and e.request_id = want_request_id;
  if found then return existing_event.membership_id; end if;

  perform pg_advisory_xact_lock(hashtextextended(want_tenant || ':' || want_external_id, 0));

  select e.membership_id, m.status into member_id, prior_status
    from public.scim_external_identity e
    join public.institution_membership m on m.id = e.membership_id and m.tenant_id = e.tenant_id
   where e.tenant_id = want_tenant and e.external_id = want_external_id;

  if member_id is null then
    insert into public.institution_membership
      (tenant_id, status, roles, source, deprovisioned_at)
    values (
      want_tenant,
      case when want_active then 'active' else 'deprovisioned' end,
      '{}', 'institution_provisioned', case when want_active then null else now() end
    ) returning id into member_id;

    insert into public.scim_external_identity
      (tenant_id, membership_id, external_id, user_name, display_name, active)
    values (want_tenant, member_id, want_external_id, lower(trim(want_user_name)), nullif(trim(want_display_name), ''), want_active);
  else
    update public.scim_external_identity
       set user_name = lower(trim(want_user_name)), display_name = nullif(trim(want_display_name), ''),
           active = want_active, version = version + 1, updated_at = now()
     where tenant_id = want_tenant and external_id = want_external_id;

    update public.institution_membership
       set status = case when want_active then 'active' else 'deprovisioned' end,
           roles = case when want_active and prior_status <> 'deprovisioned' then roles else '{}' end,
           deprovisioned_at = case when want_active then null else now() end,
           updated_at = now()
     where id = member_id and tenant_id = want_tenant;
  end if;

  update public.scim_credential set last_used_at = now() where id = want_credential;
  insert into public.provisioning_audit_event
    (tenant_id, credential_id, membership_id, request_id, resource_type, external_id, action, outcome)
  values (
    want_tenant, want_credential, member_id, want_request_id, 'User', want_external_id,
    case when not want_active then 'deactivate'
         when prior_status = 'deprovisioned' then 'reactivate'
         when prior_status is null then 'create' else 'replace' end,
    'accepted'
  );
  return member_id;
end $$;

create or replace function private.replace_scim_group_members(
  want_tenant text,
  want_credential uuid,
  want_request_id text,
  want_external_group_id text,
  want_display_name text,
  want_member_external_ids text[]
)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  mapped_roles text[];
  changed bigint := 0;
  previous public.provisioning_audit_event;
begin
  if cardinality(want_member_external_ids) > 10000
     or length(trim(want_external_group_id)) not between 1 and 300
     or length(trim(want_display_name)) not between 1 and 300
  then raise exception 'Invalid SCIM group input.'; end if;
  if not exists (
    select 1 from public.scim_credential c
     where c.id = want_credential and c.tenant_id = want_tenant
       and c.status = 'active' and (c.expires_at is null or c.expires_at > now())
  ) then raise exception 'SCIM credential is not active for this tenant.'; end if;

  select * into previous from public.provisioning_audit_event e
   where e.tenant_id = want_tenant and e.request_id = want_request_id;
  if found then return coalesce((previous.metadata ->> 'affected')::bigint, 0); end if;

  select g.roles into mapped_roles from public.scim_group_mapping g
   where g.tenant_id = want_tenant and g.external_group_id = want_external_group_id and g.active;
  if mapped_roles is null then
    insert into public.provisioning_audit_event
      (tenant_id, credential_id, request_id, resource_type, external_id, action, outcome, metadata)
    values (want_tenant, want_credential, want_request_id, 'Group', want_external_group_id,
            'group_replace', 'unknown_group', '{"affected": 0}'::jsonb);
    return 0;
  end if;

  update public.scim_external_identity e
     set group_external_ids = case
           when e.external_id = any(coalesce(want_member_external_ids, '{}'))
             then array_append(array_remove(e.group_external_ids, want_external_group_id), want_external_group_id)
           else array_remove(e.group_external_ids, want_external_group_id)
         end,
         version = version + 1,
         updated_at = now()
   where e.tenant_id = want_tenant and e.active;

  select count(*) into changed from public.scim_external_identity e
   where e.tenant_id = want_tenant and e.active
     and e.external_id = any(coalesce(want_member_external_ids, '{}'));

  update public.institution_membership m
     set roles = coalesce((
       select array_agg(distinct role_name order by role_name)
         from public.scim_external_identity e
         cross join lateral unnest(e.group_external_ids) group_id
         join public.scim_group_mapping g
           on g.tenant_id = e.tenant_id and g.external_group_id = group_id and g.active
         cross join lateral unnest(g.roles) role_name
        where e.membership_id = m.id and e.tenant_id = m.tenant_id and e.active
     ), '{}'), updated_at = now()
   where m.tenant_id = want_tenant and m.status = 'active';

  update public.scim_credential set last_used_at = now() where id = want_credential;
  insert into public.provisioning_audit_event
    (tenant_id, credential_id, request_id, resource_type, external_id, action, outcome, metadata)
  values (want_tenant, want_credential, want_request_id, 'Group', want_external_group_id,
          'group_replace', 'accepted', jsonb_build_object('affected', changed));
  return changed;
end $$;

revoke all on function private.refuse_provisioning_audit_change() from public, anon, authenticated;
revoke all on function private.scim_credential_material(uuid) from public, anon, authenticated;
revoke all on function private.provision_scim_user(text, uuid, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function private.replace_scim_group_members(text, uuid, text, text, text, text[]) from public, anon, authenticated;
grant execute on function private.scim_credential_material(uuid) to service_role;
grant execute on function private.provision_scim_user(text, uuid, text, text, text, text, boolean) to service_role;
grant execute on function private.replace_scim_group_members(text, uuid, text, text, text, text[]) to service_role;

comment on table public.institution_membership is
  'Current institution-authorized access. Gateway authorization reloads this record; user metadata never grants it.';
comment on table public.scim_credential is
  'Tenant-bound salted SCIM credential verification material. The bearer secret is never stored.';
comment on table public.provisioning_audit_event is
  'Immutable metadata-only record of accepted and refused provisioning operations.';
