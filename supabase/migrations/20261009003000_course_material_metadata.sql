-- Private metadata and controlled lifecycle for institution-published course material.
--
-- This migration does not provision `course-materials`, accept bytes, settle a
-- storage or scanner receipt, extract content, or expose a read route. It only
-- persists the upload plan that a future private adapter may execute. Every
-- plan is bound to the current retention-policy id/version and to a live
-- `course:publish` grant over the exact tenant/course key. Retention-policy
-- withdrawal closes new intake and restore; existing rows keep their recorded
-- authority. Metadata and operation history are never physically deleted, so
-- a future hold-aware purge remains a separate migration and release gate.

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'private.course_material_retention_policy'::regclass
       and conname = 'course_material_retention_policy_identity'
  ) then
    alter table private.course_material_retention_policy
      add constraint course_material_retention_policy_identity
      unique (id, tenant_id, version);
  end if;
end $$;

create table if not exists public.course_materials (
  id                       uuid        primary key,
  tenant_id                text        not null references public.schools(id) on delete restrict,
  course_code              text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term                     text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  published_by             uuid        references auth.users(id) on delete set null,
  publisher_sha256         text        not null check (publisher_sha256 ~ '^[0-9a-f]{64}$'),
  bucket                   text        not null default 'course-materials' check (bucket = 'course-materials'),
  classification           text        not null default 'internal' check (classification = 'internal'),
  object_key               text        not null unique,
  filename                 text        not null check (
                                      length(filename) between 1 and 120
                                      and filename !~ '[\\/[:cntrl:]"<>|:*?]'),
  declared_content_type    text        not null check (declared_content_type in (
                                      'application/pdf', 'text/plain', 'text/markdown',
                                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                      'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  size_bytes               bigint      not null check (size_bytes between 1 and 104857600),
  lifecycle_state          text        not null default 'pending_upload'
                                      check (lifecycle_state in ('pending_upload', 'withdrawn')),
  retention_policy_id      uuid        not null,
  retention_policy_version integer     not null check (retention_policy_version >= 1),
  days_after_withdrawal    integer     not null check (days_after_withdrawal between 0 and 3650),
  withdrawn_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (id, tenant_id),
  constraint course_material_policy_fk
    foreign key (retention_policy_id, tenant_id, retention_policy_version)
    references private.course_material_retention_policy (id, tenant_id, version) on delete restrict,
  constraint course_material_object_key check (
    object_key = 't/' || tenant_id || '/internal/' ||
      to_char(created_at at time zone 'UTC', 'YYYY-MM') || '/' || id::text),
  constraint course_material_withdrawal_state check (
    (lifecycle_state = 'withdrawn' and withdrawn_at is not null)
    or (lifecycle_state = 'pending_upload' and withdrawn_at is null))
);

create index if not exists course_materials_by_course
  on public.course_materials (tenant_id, course_code, term, created_at desc);
create index if not exists course_materials_by_policy
  on public.course_materials (retention_policy_id, tenant_id, retention_policy_version);
create index if not exists course_materials_by_publisher
  on public.course_materials (published_by) where published_by is not null;

create table if not exists public.course_material_operations (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null references public.schools(id) on delete restrict,
  actor_id         uuid        references auth.users(id) on delete set null,
  actor_sha256     text        not null check (actor_sha256 ~ '^[0-9a-f]{64}$'),
  action           text        not null check (action in ('upload_planned', 'withdrawn', 'restored')),
  idempotency_key  text        not null check (idempotency_key ~ '^[A-Za-z0-9_.:-]{16,128}$'),
  request_sha256   text        not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  material_id      uuid        not null,
  result_json      jsonb       not null check (jsonb_typeof(result_json) = 'object' and pg_column_size(result_json) <= 1024),
  occurred_at      timestamptz not null default now(),
  unique (tenant_id, actor_sha256, action, idempotency_key),
  constraint course_material_operation_material_fk foreign key (material_id, tenant_id)
    references public.course_materials (id, tenant_id) on delete restrict
);

create index if not exists course_material_operations_by_material
  on public.course_material_operations (material_id, tenant_id, occurred_at);
create index if not exists course_material_operations_by_actor
  on public.course_material_operations (actor_id) where actor_id is not null;

alter table public.course_materials enable row level security;
alter table public.course_material_operations enable row level security;
revoke all on table public.course_materials from public, anon, authenticated, service_role;
revoke all on table public.course_material_operations from public, anon, authenticated, service_role;
grant select on table public.course_materials to service_role;
grant select on table public.course_material_operations to service_role;

create or replace function private.keep_course_material_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'course_material_operations' or tg_op = 'DELETE' then
    raise exception 'Course-material metadata and operation history are append-only.' using errcode = '42501';
  end if;
  return new;
end $$;

revoke all on function private.keep_course_material_history()
  from public, anon, authenticated, service_role;

drop trigger if exists keep_course_material_rows on public.course_materials;
create trigger keep_course_material_rows before delete on public.course_materials
  for each row execute function private.keep_course_material_history();
drop trigger if exists keep_course_material_operations on public.course_material_operations;
create trigger keep_course_material_operations before update or delete on public.course_material_operations
  for each row execute function private.keep_course_material_history();

create or replace function private.course_material_service()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the course-material service may persist shared metadata.' using errcode = '42501';
  end if;
end $$;

create or replace function private.course_material_publisher(
  want_actor uuid, want_tenant text, want_course text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.role_grants g on g.subject = p.user_id
      join public.role_capabilities rc on rc.role = g.role
     where p.user_id = want_actor
       and p.school_id = want_tenant
       and rc.capability = 'course:publish'
       and g.scope_kind = 'course'
       and g.scope_id = want_tenant || '/' || want_course
       and g.revoked_at is null
       and (g.expires_at is null or g.expires_at > now())
  );
$$;

create or replace function private.course_material_audit(
  want_actor uuid, want_tenant text, want_action text, want_material uuid,
  want_correlation text, want_course text, want_term text, want_outcome text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare made uuid;
begin
  insert into public.audit_event (
    tenant_id, correlation_id, action, object_kind, object_sha256,
    outcome, actor_sha256, actor_kind, detail
  ) values (
    want_tenant, want_correlation, want_action, 'course_material',
    private.role_audit_sha256(want_material::text), 'allowed',
    private.role_audit_sha256(want_actor::text), 'authenticated',
    jsonb_build_object('courseCode', want_course, 'term', want_term, 'outcome', want_outcome)
  ) returning id into made;
  return made;
end $$;

revoke all on function private.course_material_service()
  from public, anon, authenticated, service_role;
revoke all on function private.course_material_publisher(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.course_material_audit(uuid, text, text, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.persist_course_material(
  want_material uuid, want_actor uuid, want_tenant text, want_course text, want_term text,
  want_policy uuid, want_policy_version integer, want_object_key text,
  want_filename text, want_content_type text, want_size_bytes bigint,
  want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  code text := private.course_code(want_course);
  policy record;
  prior public.course_material_operations;
  made public.course_materials;
  actor_hash text;
  request_hash text;
begin
  perform private.course_material_service();
  if want_material is null or want_actor is null or code = ''
     or want_term !~ '^[0-9]{4}(FA|SP|SU)$'
     or want_policy is null or want_policy_version is null or want_policy_version < 1
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The course-material request is incomplete.' using errcode = '22023';
  end if;
  if not private.course_material_publisher(want_actor, want_tenant, code) then
    raise exception 'The current course publishing grant could not be verified.' using errcode = '42501';
  end if;
  select * into policy
    from private.current_course_material_retention_policy(want_tenant, now());
  if not found or policy.policy_id <> want_policy or policy.policy_version <> want_policy_version then
    raise exception 'The current course-material retention policy could not be verified.' using errcode = '55000';
  end if;

  actor_hash := private.role_audit_sha256(want_actor::text);
  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_material::text,
    want_actor::text, want_tenant, code, want_term, want_policy::text,
    want_policy_version::text, want_object_key, want_filename,
    want_content_type, want_size_bytes::text));
  perform pg_advisory_xact_lock(hashtext(want_tenant || ':' || actor_hash || ':material:' || want_idempotency));
  select * into prior from public.course_material_operations o
   where o.tenant_id = want_tenant and o.actor_sha256 = actor_hash
     and o.action = 'upload_planned' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different course-material request.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;

  insert into public.course_materials (
    id, tenant_id, course_code, term, published_by, publisher_sha256,
    object_key, filename, declared_content_type, size_bytes,
    retention_policy_id, retention_policy_version, days_after_withdrawal
  ) values (
    want_material, want_tenant, code, want_term, want_actor, actor_hash,
    want_object_key, want_filename, want_content_type, want_size_bytes,
    policy.policy_id, policy.policy_version, policy.days_after_withdrawal
  ) returning * into made;

  perform private.course_material_audit(want_actor, want_tenant,
    'course_material.upload_planned', made.id, want_correlation,
    made.course_code, made.term, 'pending');
  insert into public.course_material_operations
    (tenant_id, actor_id, actor_sha256, action, idempotency_key,
     request_sha256, material_id, result_json)
  values (want_tenant, want_actor, actor_hash, 'upload_planned', want_idempotency,
    request_hash, made.id, jsonb_build_object('materialId', made.id,
      'state', made.lifecycle_state, 'policyId', made.retention_policy_id,
      'policyVersion', made.retention_policy_version, 'idempotent', false));
  return jsonb_build_object('materialId', made.id, 'state', made.lifecycle_state,
    'policyId', made.retention_policy_id,
    'policyVersion', made.retention_policy_version, 'idempotent', false);
end $$;

create or replace function public.change_course_material_state(
  want_material uuid, want_actor uuid, want_action text,
  want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  material public.course_materials;
  current_policy record;
  prior public.course_material_operations;
  operation text;
  actor_hash text;
  request_hash text;
begin
  perform private.course_material_service();
  if want_material is null or want_actor is null or want_action not in ('withdraw', 'restore')
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The course-material lifecycle request is incomplete.' using errcode = '22023';
  end if;
  select * into material from public.course_materials m where m.id = want_material for update;
  if not found or not private.course_material_publisher(
    want_actor, material.tenant_id, material.course_code
  ) then
    raise exception 'The current course publishing grant could not be verified.' using errcode = '42501';
  end if;

  operation := case want_action when 'withdraw' then 'withdrawn' else 'restored' end;
  actor_hash := private.role_audit_sha256(want_actor::text);
  request_hash := private.role_audit_sha256(concat_ws(chr(31),
    want_material::text, want_actor::text, want_action));
  perform pg_advisory_xact_lock(hashtext(material.tenant_id || ':' || actor_hash || ':' || operation || ':' || want_idempotency));
  select * into prior from public.course_material_operations o
   where o.tenant_id = material.tenant_id and o.actor_sha256 = actor_hash
     and o.action = operation and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different lifecycle request.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;

  if want_action = 'withdraw' then
    if material.lifecycle_state = 'withdrawn' then
      raise exception 'That course material is already withdrawn.' using errcode = '55000';
    end if;
    update public.course_materials set lifecycle_state = 'withdrawn', withdrawn_at = now(), updated_at = now()
      where id = material.id returning * into material;
  else
    if material.lifecycle_state <> 'withdrawn' then
      raise exception 'That course material is not withdrawn.' using errcode = '55000';
    end if;
    select * into current_policy
      from private.current_course_material_retention_policy(material.tenant_id, now());
    if not found then
      raise exception 'Shared course-material intake is currently withdrawn.' using errcode = '55000';
    end if;
    update public.course_materials set lifecycle_state = 'pending_upload', withdrawn_at = null, updated_at = now()
      where id = material.id returning * into material;
  end if;

  perform private.course_material_audit(want_actor, material.tenant_id,
    case want_action when 'withdraw' then 'course_material.withdrawn' else 'course_material.restored' end,
    material.id, want_correlation, material.course_code, material.term, material.lifecycle_state);
  insert into public.course_material_operations
    (tenant_id, actor_id, actor_sha256, action, idempotency_key,
     request_sha256, material_id, result_json)
  values (material.tenant_id, want_actor, actor_hash, operation, want_idempotency,
    request_hash, material.id, jsonb_build_object('materialId', material.id,
      'state', material.lifecycle_state, 'policyId', material.retention_policy_id,
      'policyVersion', material.retention_policy_version, 'idempotent', false));
  return jsonb_build_object('materialId', material.id, 'state', material.lifecycle_state,
    'policyId', material.retention_policy_id,
    'policyVersion', material.retention_policy_version, 'idempotent', false);
end $$;

revoke all on function public.persist_course_material(uuid, uuid, text, text, text, uuid, integer, text, text, text, bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.change_course_material_state(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.persist_course_material(uuid, uuid, text, text, text, uuid, integer, text, text, text, bigint, text, text)
  to service_role;
grant execute on function public.change_course_material_state(uuid, uuid, text, text, text)
  to service_role;

comment on table public.course_materials is
  'Private metadata for institution-published course material. Binds exact tenant/course/term, publisher grant and retention-policy version; contains no bytes, extracted text or readable URL.';
comment on table public.course_material_operations is
  'Append-only idempotency and provenance ledger for shared course-material planning, withdrawal and restore.';
comment on function public.persist_course_material(uuid, uuid, text, text, text, uuid, integer, text, text, text, bigint, text, text) is
  'Service-only metadata persistence after rechecking the current exact course:publish grant and current active retention-policy version. Creates no object or upload URL.';
comment on function public.change_course_material_state(uuid, uuid, text, text, text) is
  'Service-only idempotent metadata withdrawal/restore. Restore requires current policy authority; the originally bound retention version never changes.';

-- Rollback is safe only before a storage adapter or later schema references
-- these rows: drop the two public functions, both tables, three private helper
-- functions and course_material_retention_policy_identity.
