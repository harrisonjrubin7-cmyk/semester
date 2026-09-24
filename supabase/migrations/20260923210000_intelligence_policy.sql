-- Semester Intelligence policy is tenant data, not a browser feature flag.
-- Every administrative write below requires a live, school-scoped role grant.

do $$ begin
  create type public.feature_state as enum ('off', 'preview', 'sandbox', 'production');
exception when duplicate_object then null;
end $$;

alter table public.role_grants
  drop constraint if exists role_grants_scope_kind_check;
alter table public.role_grants
  add constraint role_grants_scope_kind_check check (scope_kind in (
    'platform', 'school', 'organization', 'course', 'department',
    'office', 'residence', 'business', 'employer'
  ));

insert into public.app_capabilities (capability, about) values
  ('tenant:configure', 'Change one university tenant configuration.'),
  ('ai:configure', 'Change one university tenant AI policy and budget.'),
  ('source:approve', 'Approve course sources for one university tenant.'),
  ('audit:read', 'Read configuration and access audit events for one university tenant.'),
  ('support:read', 'Inspect explainable support signals for one university tenant.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('university_admin', 'tenant:configure'),
  ('university_admin', 'ai:configure'),
  ('university_admin', 'source:approve'),
  ('university_admin', 'audit:read'),
  ('university_staff', 'support:read')
on conflict (role, capability) do nothing;

create table if not exists public.tenant_feature_policy (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  capability text not null check (length(trim(capability)) between 1 and 100),
  state public.feature_state not null default 'off',
  permitted_roles text[] not null default '{}',
  reason text not null default '' check (length(reason) <= 1000),
  effective_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (tenant_id, capability)
);

create index if not exists tenant_feature_policy_by_updater
  on public.tenant_feature_policy (updated_by);

create table if not exists public.ai_policy (
  tenant_id text primary key references public.schools(id) on delete cascade,
  allowed_modes text[] not null default array['explain', 'hint', 'practice', 'review'],
  allowed_providers text[] not null default '{}',
  default_provider text,
  web_sources_allowed boolean not null default false,
  course_sources_only boolean not null default true,
  monthly_budget_cents bigint not null default 0 check (monthly_budget_cents >= 0),
  retention_days integer not null default 30 check (retention_days between 0 and 3650),
  policy_version text not null default '1' check (length(trim(policy_version)) between 1 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint ai_policy_modes_valid check (
    allowed_modes <@ array['explain', 'hint', 'practice', 'review', 'draft']::text[]
  ),
  constraint ai_policy_default_provider_allowed check (
    default_provider is null or default_provider = any(allowed_providers)
  )
);

create index if not exists ai_policy_by_updater on public.ai_policy (updated_by);

create table if not exists public.approved_source (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  course_id text not null check (length(trim(course_id)) between 1 and 200),
  title text not null check (length(trim(title)) between 1 and 300),
  origin text not null check (origin in ('course', 'institution', 'library', 'web')),
  authority text not null check (authority in ('authoritative', 'supplemental', 'prohibited')),
  source_uri text check (source_uri is null or length(source_uri) <= 2000),
  citation_label text not null default '' check (length(citation_label) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, course_id, title)
);

create index if not exists approved_source_by_tenant_course
  on public.approved_source (tenant_id, course_id);
create index if not exists approved_source_by_creator
  on public.approved_source (created_by);

create table if not exists public.consent_record (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (length(trim(capability)) between 1 and 100),
  status text not null check (status in ('consented', 'declined', 'revoked')),
  policy_version text not null check (length(trim(policy_version)) between 1 and 100),
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique (tenant_id, subject_user_id, capability, policy_version),
  constraint consent_revocation_matches_status check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  )
);

create index if not exists consent_record_by_tenant_subject
  on public.consent_record (tenant_id, subject_user_id);
create index if not exists consent_record_by_subject
  on public.consent_record (subject_user_id);
create index if not exists consent_record_by_recorder
  on public.consent_record (recorded_by);

create table if not exists public.tenant_policy_audit_event (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record'
  )),
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  old_data jsonb,
  new_data jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  actor_grant_id uuid references public.role_grants(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index if not exists tenant_policy_audit_by_tenant_time
  on public.tenant_policy_audit_event (tenant_id, occurred_at desc);
create index if not exists tenant_policy_audit_by_actor
  on public.tenant_policy_audit_event (actor_id);
create index if not exists tenant_policy_audit_by_grant
  on public.tenant_policy_audit_event (actor_grant_id);

alter table public.tenant_feature_policy enable row level security;
alter table public.ai_policy enable row level security;
alter table public.approved_source enable row level security;
alter table public.consent_record enable row level security;
alter table public.tenant_policy_audit_event enable row level security;

revoke all on table public.tenant_feature_policy from anon, authenticated;
revoke all on table public.ai_policy from anon, authenticated;
revoke all on table public.approved_source from anon, authenticated;
revoke all on table public.consent_record from anon, authenticated;
revoke all on table public.tenant_policy_audit_event from anon, authenticated;

grant select, insert, update, delete on table public.tenant_feature_policy to authenticated;
grant select, insert, update, delete on table public.ai_policy to authenticated;
grant select, insert, update, delete on table public.approved_source to authenticated;
grant select, insert, update, delete on table public.consent_record to authenticated;
grant select on table public.tenant_policy_audit_event to authenticated;

create policy "school members read feature policy" on public.tenant_feature_policy
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));
create policy "tenant administrators insert feature policy" on public.tenant_feature_policy
  for insert to authenticated
  with check (private.has_capability('tenant:configure', 'school', tenant_id));
create policy "tenant administrators update feature policy" on public.tenant_feature_policy
  for update to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id))
  with check (private.has_capability('tenant:configure', 'school', tenant_id));
create policy "tenant administrators delete feature policy" on public.tenant_feature_policy
  for delete to authenticated
  using (private.has_capability('tenant:configure', 'school', tenant_id));

create policy "school members read ai policy" on public.ai_policy
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));
create policy "tenant administrators insert ai policy" on public.ai_policy
  for insert to authenticated
  with check (private.has_capability('ai:configure', 'school', tenant_id));
create policy "tenant administrators update ai policy" on public.ai_policy
  for update to authenticated
  using (private.has_capability('ai:configure', 'school', tenant_id))
  with check (private.has_capability('ai:configure', 'school', tenant_id));
create policy "tenant administrators delete ai policy" on public.ai_policy
  for delete to authenticated
  using (private.has_capability('ai:configure', 'school', tenant_id));

create policy "school members read approved sources" on public.approved_source
  for select to authenticated
  using (tenant_id = (select school_id from public.profiles where user_id = (select auth.uid())));
create policy "source approvers insert approved sources" on public.approved_source
  for insert to authenticated
  with check (
    private.has_capability('source:approve', 'school', tenant_id)
    and created_by = (select auth.uid())
  );
create policy "source approvers update approved sources" on public.approved_source
  for update to authenticated
  using (private.has_capability('source:approve', 'school', tenant_id))
  with check (private.has_capability('source:approve', 'school', tenant_id));
create policy "source approvers delete approved sources" on public.approved_source
  for delete to authenticated
  using (private.has_capability('source:approve', 'school', tenant_id));

create policy "people read their consent or tenant auditors read it" on public.consent_record
  for select to authenticated
  using (
    subject_user_id = (select auth.uid())
    or private.has_capability('audit:read', 'school', tenant_id)
  );
create policy "people record their own consent" on public.consent_record
  for insert to authenticated
  with check (
    subject_user_id = (select auth.uid())
    and recorded_by = (select auth.uid())
    and tenant_id = (select school_id from public.profiles where user_id = (select auth.uid()))
  );
create policy "people update their own consent" on public.consent_record
  for update to authenticated
  using (subject_user_id = (select auth.uid()))
  with check (
    subject_user_id = (select auth.uid())
    and recorded_by = (select auth.uid())
    and tenant_id = (select school_id from public.profiles where user_id = (select auth.uid()))
  );
create policy "people delete their own consent" on public.consent_record
  for delete to authenticated
  using (subject_user_id = (select auth.uid()));

create policy "tenant auditors read policy events" on public.tenant_policy_audit_event
  for select to authenticated
  using (private.has_capability('audit:read', 'school', tenant_id));

create or replace function private.audit_tenant_policy_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  after_row jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_data jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  event_id text := coalesce(row_data ->> 'id', event_tenant || ':' || coalesce(row_data ->> 'capability', 'policy'));
  caller uuid := auth.uid();
  grant_id uuid;
begin
  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('tenant:configure', 'ai:configure', 'source:approve', 'audit:read')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;

  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, event_id, lower(tg_op), before_row, after_row, caller, grant_id);

  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke all on function private.audit_tenant_policy_change() from public, anon, authenticated;

create trigger audit_tenant_feature_policy
  after insert or update or delete on public.tenant_feature_policy
  for each row execute function private.audit_tenant_policy_change();
create trigger audit_ai_policy
  after insert or update or delete on public.ai_policy
  for each row execute function private.audit_tenant_policy_change();
create trigger audit_approved_source
  after insert or update or delete on public.approved_source
  for each row execute function private.audit_tenant_policy_change();
create trigger audit_consent_record
  after insert or update or delete on public.consent_record
  for each row execute function private.audit_tenant_policy_change();

create or replace function public.feature_state(want_capability text, want_tenant text)
returns public.feature_state
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select p.state from public.tenant_feature_policy p
      where p.tenant_id = want_tenant and p.capability = want_capability),
    'off'::public.feature_state
  );
$$;

create or replace function public.effective_ai_policy(want_tenant text, want_user uuid)
returns setof public.ai_policy
language sql
stable
security invoker
set search_path = ''
as $$
  select p.*
    from public.ai_policy p
   where p.tenant_id = want_tenant
     and (
       want_user = (select auth.uid())
       or private.has_capability('audit:read', 'school', want_tenant)
     );
$$;

revoke all on function public.feature_state(text, text) from public, anon, authenticated;
revoke all on function public.effective_ai_policy(text, uuid) from public, anon, authenticated;
grant execute on function public.feature_state(text, text) to authenticated;
grant execute on function public.effective_ai_policy(text, uuid) to authenticated;

comment on table public.tenant_feature_policy is
  'Tenant-controlled release state for Semester capabilities; writes require a verified school-scoped grant.';
comment on table public.ai_policy is
  'One institution AI provider, integrity, web-source, retention and budget policy per school.';
comment on table public.approved_source is
  'Faculty or institution approved learning sources, bounded to one school and course.';
comment on table public.consent_record is
  'Versioned student consent decisions for capture and other policy-controlled capabilities.';
comment on table public.tenant_policy_audit_event is
  'Append-only old/new records for tenant policy, source and consent changes, including the actor grant when one authorized the write.';
