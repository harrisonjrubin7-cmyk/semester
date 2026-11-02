-- 011: private files (security blueprint §1-2). Metadata and grants live in Postgres under RLS; bytes live
-- in private storage under an opaque key. Access to bytes is decided by the same row policy every time.
\set ON_ERROR_STOP on
begin;
set local role semester_owner;

create table platform.files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  owner_user_id uuid not null,
  classification text not null check (classification in ('student_private', 'institution_shared', 'official_record')),
  storage_key text not null unique check (storage_key ~ '^[0-9a-f]{64}$'),   -- opaque: no names or ids
  filename text not null check (length(filename) between 1 and 200),
  content_type text not null check (content_type in ('application/pdf', 'image/png', 'image/jpeg', 'text/plain')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  unique (tenant_id, id),
  foreign key (tenant_id, owner_user_id) references iam.memberships(tenant_id, user_id)
);
-- A grant names one person, one file, an expiry, and can be revoked. No grant to "everyone".
create table platform.file_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  file_id uuid not null,
  grantee_user_id uuid not null,
  granted_by uuid not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '180 days'),
  foreign key (tenant_id, file_id) references platform.files(tenant_id, id),
  foreign key (tenant_id, grantee_user_id) references iam.memberships(tenant_id, user_id)
);
create index file_grants_lookup on platform.file_grants(tenant_id, file_id, grantee_user_id);

alter table platform.files enable row level security;       alter table platform.files force row level security;
alter table platform.file_grants enable row level security; alter table platform.file_grants force row level security;

grant select, insert on platform.files to semester_api;
grant select, insert on platform.file_grants to semester_api;
grant update (revoked_at) on platform.file_grants to semester_api;
commit;

begin;
grant usage on schema platform to semester_api;
set local role semester_owner;

-- Grants are visible to the file owner and to the grantee.
create policy grants_visible on platform.file_grants for select to semester_api using (
  tenant_id = iam.current_tenant_id() and iam.is_active_member(tenant_id)
  and (granted_by = iam.current_user_id() or grantee_user_id = iam.current_user_id()));
-- Only the owner grants, only on their own file (the files policy filters the subquery to visible files).
create policy grants_insert_owner on platform.file_grants for insert to semester_api with check (
  tenant_id = iam.current_tenant_id() and iam.is_active_member(tenant_id)
  and granted_by = iam.current_user_id() and revoked_at is null
  and exists (select 1 from platform.files f where f.id = file_id and f.owner_user_id = iam.current_user_id()));
create policy grants_revoke_owner on platform.file_grants for update to semester_api
  using (tenant_id = iam.current_tenant_id() and granted_by = iam.current_user_id())
  with check (tenant_id = iam.current_tenant_id() and granted_by = iam.current_user_id());

-- A file is visible to its owner, or to someone holding a live, unrevoked grant for it.
-- The grant lookup runs as the caller through the grants policy, so it only ever sees the caller's grants.
create policy files_visible on platform.files for select to semester_api using (
  tenant_id = iam.current_tenant_id() and iam.is_active_member(tenant_id)
  and (owner_user_id = iam.current_user_id()
       or exists (select 1 from platform.file_grants g
                  where g.tenant_id = files.tenant_id and g.file_id = files.id
                    and g.grantee_user_id = iam.current_user_id()
                    and g.revoked_at is null and g.expires_at > statement_timestamp())));
create policy files_insert_own on platform.files for insert to semester_api with check (
  tenant_id = iam.current_tenant_id() and iam.is_active_member(tenant_id) and owner_user_id = iam.current_user_id());
commit;

begin;
-- Signed-link lookup: the only path that reads file metadata without a user. It answers for one exact
-- 256-bit storage key, which is only ever revealed inside a signed link minted after authorization.
create role semester_files_cmd nologin nobypassrls;
grant usage on schema platform to semester_files_cmd;
grant select (storage_key, filename, content_type) on platform.files to semester_files_cmd;
create policy files_link_lookup on platform.files for select to semester_files_cmd using (true);
create function platform.file_link_lookup(p_key text)
returns table (storage_key text, filename text, content_type text)
language sql stable security definer set search_path = pg_catalog as $$
  select f.storage_key, f.filename, f.content_type from platform.files f
  where p_key ~ '^[0-9a-f]{64}$' and f.storage_key = p_key
$$;
alter function platform.file_link_lookup(text) owner to semester_files_cmd;
revoke all on function platform.file_link_lookup(text) from public;
grant execute on function platform.file_link_lookup(text) to semester_api;
commit;
