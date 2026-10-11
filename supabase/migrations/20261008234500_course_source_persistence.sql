-- Private persistence for student-owned course sources.
--
-- This is intentionally narrower than an upload API. It creates no bucket,
-- signed URL, scanner, extraction worker or browser-callable function. A
-- tenant-bound server using service_role may record the metadata planned by
-- app/server/course-sources/contract.ts only after this database independently
-- reloads the exact current course row and active institutional membership.
-- Institution-published material remains closed until a current, versioned
-- retention-policy authority exists in the repository.

create table if not exists public.course_sources (
  id                   uuid        primary key,
  tenant_id            text        not null references public.schools(id) on delete restrict,
  owner_id             uuid        not null references auth.users(id) on delete cascade,
  membership_id        uuid        not null,
  course_record_id     text        not null,
  course_code          text        not null check (course_code ~ '^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$'),
  term                 text        not null check (term ~ '^[0-9]{4}(FA|SP|SU)$'),
  source_kind          text        not null default 'student_owned' check (source_kind = 'student_owned'),
  bucket               text        not null default 'student-files' check (bucket = 'student-files'),
  classification       text        not null default 'student_private' check (classification = 'student_private'),
  object_key           text        not null unique,
  filename             text        not null check (
                                  length(filename) between 1 and 120
                                  and filename !~ '[\\/[:cntrl:]"<>|:*?]'),
  declared_content_type text       not null check (declared_content_type in (
                                  'application/pdf', 'text/plain', 'text/markdown',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  size_bytes           bigint      not null check (size_bytes between 1 and 52428800),
  lifecycle_state      text        not null default 'pending_upload' check (
                                  lifecycle_state in ('pending_upload', 'quarantined', 'available', 'rejected', 'deleted')),
  sha256               text        check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  detected_content_type text       check (detected_content_type is null or detected_content_type in (
                                  'application/pdf', 'text/plain', 'text/markdown',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'application/vnd.openxmlformats-officedocument.presentationml.presentation')),
  scanner_version      text        check (scanner_version is null or length(scanner_version) between 1 and 120),
  retention_policy_id  text        not null default 'student-file-trash' check (retention_policy_id = 'student-file-trash'),
  retention_policy_version integer not null default 1 check (retention_policy_version = 1),
  deleted_at           timestamptz,
  recovery_until       timestamptz,
  pre_delete_state     text        check (pre_delete_state is null or pre_delete_state in (
                                  'pending_upload', 'quarantined', 'available', 'rejected')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (id, tenant_id),
  constraint course_source_membership_fk foreign key (membership_id, tenant_id)
    references public.institution_membership (id, tenant_id) on delete restrict,
  constraint course_source_object_key check (
    object_key = 't/' || tenant_id || '/student_private/' || to_char(created_at at time zone 'UTC', 'YYYY-MM') || '/' || id::text),
  constraint course_source_deletion_state check (
    (lifecycle_state = 'deleted' and deleted_at is not null and recovery_until is not null
      and pre_delete_state is not null and recovery_until = deleted_at + interval '30 days')
    or
    (lifecycle_state <> 'deleted' and deleted_at is null and recovery_until is null and pre_delete_state is null)),
  constraint course_source_scan_state check (
    (lifecycle_state = 'available' and sha256 is not null and detected_content_type = declared_content_type
      and scanner_version is not null)
    or lifecycle_state <> 'available')
);

create index if not exists course_sources_by_owner_course
  on public.course_sources (owner_id, course_record_id, created_at desc);
create index if not exists course_sources_by_tenant_course
  on public.course_sources (tenant_id, course_code, term, created_at desc);
create index if not exists course_sources_by_membership
  on public.course_sources (membership_id, tenant_id);
create index if not exists course_sources_recovery_due
  on public.course_sources (recovery_until) where lifecycle_state = 'deleted';

create table if not exists public.course_source_corrections (
  id                     uuid        primary key,
  source_id              uuid        not null,
  tenant_id              text        not null references public.schools(id) on delete restrict,
  confirmed_by           uuid        not null references auth.users(id) on delete cascade,
  derived_record_id      text        not null check (length(derived_record_id) between 1 and 200 and derived_record_id !~ '[[:cntrl:]]'),
  field_name             text        not null check (length(field_name) between 1 and 80 and field_name ~ '^[A-Za-z][A-Za-z0-9_.:-]*$'),
  revision               integer     not null check (revision > 0),
  previous_correction_id uuid        references public.course_source_corrections(id) on delete restrict,
  source_sha256          text        not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  prior_value_sha256     text        not null check (prior_value_sha256 ~ '^[0-9a-f]{64}$'),
  corrected_value_sha256 text        not null check (corrected_value_sha256 ~ '^[0-9a-f]{64}$'),
  confirmed_at           timestamptz not null default now(),
  check (prior_value_sha256 <> corrected_value_sha256),
  constraint course_source_correction_source_fk foreign key (source_id, tenant_id)
    references public.course_sources (id, tenant_id) on delete cascade,
  unique (source_id, derived_record_id, field_name, revision)
);

create index if not exists course_source_corrections_by_source
  on public.course_source_corrections (source_id, tenant_id, confirmed_at);
create index if not exists course_source_corrections_by_tenant
  on public.course_source_corrections (tenant_id);
create index if not exists course_source_corrections_by_confirmer
  on public.course_source_corrections (confirmed_by);
create index if not exists course_source_corrections_by_previous
  on public.course_source_corrections (previous_correction_id)
  where previous_correction_id is not null;

create table if not exists public.course_source_operations (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       text        not null references public.schools(id) on delete restrict,
  actor_id        uuid        not null references auth.users(id) on delete cascade,
  action          text        not null check (action in ('upload_planned', 'correction_confirmed', 'deletion_requested', 'restored')),
  idempotency_key text        not null check (idempotency_key ~ '^[A-Za-z0-9_.:-]{16,128}$'),
  request_sha256  text        not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  source_id       uuid        not null,
  correction_id   uuid        references public.course_source_corrections(id) on delete cascade,
  result_json     jsonb       not null check (jsonb_typeof(result_json) = 'object' and pg_column_size(result_json) <= 1024),
  occurred_at     timestamptz not null default now(),
  unique (tenant_id, actor_id, action, idempotency_key),
  constraint course_source_operation_source_fk foreign key (source_id, tenant_id)
    references public.course_sources (id, tenant_id) on delete cascade,
  check ((action = 'correction_confirmed') = (correction_id is not null))
);

create index if not exists course_source_operations_by_actor
  on public.course_source_operations (actor_id);
create index if not exists course_source_operations_by_source
  on public.course_source_operations (source_id, tenant_id);
create index if not exists course_source_operations_by_correction
  on public.course_source_operations (correction_id)
  where correction_id is not null;

alter table public.course_sources enable row level security;
alter table public.course_source_corrections enable row level security;
alter table public.course_source_operations enable row level security;

-- No client policy exists. Service role may reconcile the ledger but cannot
-- mutate around the controlled functions below through a table grant.
revoke all on table public.course_sources from public, anon, authenticated, service_role;
revoke all on table public.course_source_corrections from public, anon, authenticated, service_role;
revoke all on table public.course_source_operations from public, anon, authenticated, service_role;
grant select on table public.course_sources to service_role;
grant select on table public.course_source_corrections to service_role;
grant select on table public.course_source_operations to service_role;

drop trigger if exists course_sources_touch on public.course_sources;
create trigger course_sources_touch before update on public.course_sources
  for each row execute function public.touch_updated_at();

create or replace function private.keep_course_source_history()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Course-source correction and operation history is append-only.' using errcode = '42501';
end $$;

revoke all on function private.keep_course_source_history() from public, anon, authenticated, service_role;

drop trigger if exists keep_course_source_corrections on public.course_source_corrections;
create trigger keep_course_source_corrections before update or delete on public.course_source_corrections
  for each row execute function private.keep_course_source_history();
drop trigger if exists keep_course_source_operations on public.course_source_operations;
create trigger keep_course_source_operations before update or delete on public.course_source_operations
  for each row execute function private.keep_course_source_history();

create or replace function private.course_source_service()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the course-source service may persist source metadata.' using errcode = '42501';
  end if;
end $$;

create or replace function private.course_source_relationship(
  want_actor uuid, want_tenant text, want_membership uuid, want_course text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.institution_membership m
      join public.courses c on c.user_id = m.auth_user_id and c.id = want_course
     where m.id = want_membership
       and m.tenant_id = want_tenant
       and m.auth_user_id = want_actor
       and m.status = 'active'
       and c.deleted_at is null
  );
$$;

create or replace function private.course_source_audit(
  want_actor uuid, want_tenant text, want_action text, want_source uuid,
  want_correlation text, want_course_code text, want_term text, want_outcome text
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
    want_tenant, want_correlation, want_action, 'course_source',
    private.role_audit_sha256(want_source::text), 'allowed',
    private.role_audit_sha256(want_actor::text), 'authenticated',
    jsonb_build_object('courseCode', want_course_code, 'term', want_term, 'outcome', want_outcome)
  ) returning id into made;
  return made;
end $$;

revoke all on function private.course_source_service() from public, anon, authenticated, service_role;
revoke all on function private.course_source_relationship(uuid, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function private.course_source_audit(uuid, text, text, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.persist_student_course_source(
  want_source uuid, want_actor uuid, want_tenant text, want_membership uuid,
  want_course_record text, want_course_code text, want_term text,
  want_object_key text, want_filename text, want_content_type text, want_size_bytes bigint,
  want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  code text := private.course_code(want_course_code);
  request_hash text;
  prior public.course_source_operations;
  made public.course_sources;
begin
  perform private.course_source_service();
  if want_actor is null or want_source is null or want_membership is null
     or code = '' or want_term !~ '^[0-9]{4}(FA|SP|SU)$'
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The course-source request is incomplete.' using errcode = '22023';
  end if;
  if not private.course_source_relationship(want_actor, want_tenant, want_membership, want_course_record) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;

  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_source::text, want_actor::text,
    want_tenant, want_membership::text, want_course_record, code, want_term, want_object_key,
    want_filename, want_content_type, want_size_bytes::text));
  perform pg_advisory_xact_lock(hashtext(want_tenant || ':' || want_actor::text || ':upload:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = want_tenant and o.actor_id = want_actor
     and o.action = 'upload_planned' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different course-source request.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;

  insert into public.course_sources (
    id, tenant_id, owner_id, membership_id, course_record_id, course_code, term,
    object_key, filename, declared_content_type, size_bytes
  ) values (
    want_source, want_tenant, want_actor, want_membership, want_course_record, code, want_term,
    want_object_key, want_filename, want_content_type, want_size_bytes
  ) returning * into made;

  perform private.course_source_audit(want_actor, want_tenant, 'course_source.upload_planned',
    made.id, want_correlation, made.course_code, made.term, 'pending');
  insert into public.course_source_operations
    (tenant_id, actor_id, action, idempotency_key, request_sha256, source_id, result_json)
  values (want_tenant, want_actor, 'upload_planned', want_idempotency, request_hash, made.id,
    jsonb_build_object('sourceId', made.id, 'state', made.lifecycle_state, 'idempotent', false));
  return jsonb_build_object('sourceId', made.id, 'state', made.lifecycle_state, 'idempotent', false);
end $$;

create or replace function public.confirm_course_source_correction(
  want_correction uuid, want_source uuid, want_actor uuid,
  want_derived_record text, want_field text, want_prior_sha256 text, want_corrected_sha256 text,
  want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  src public.course_sources;
  latest public.course_source_corrections;
  prior public.course_source_operations;
  request_hash text;
  next_revision integer;
begin
  perform private.course_source_service();
  if want_correction is null or want_source is null or want_actor is null
     or want_derived_record is null or length(want_derived_record) not between 1 and 200
     or want_derived_record ~ '[[:cntrl:]]'
     or want_field !~ '^[A-Za-z][A-Za-z0-9_.:-]{0,79}$'
     or want_prior_sha256 !~ '^[0-9a-f]{64}$' or want_corrected_sha256 !~ '^[0-9a-f]{64}$'
     or want_prior_sha256 = want_corrected_sha256
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The correction is incomplete.' using errcode = '22023';
  end if;
  select * into src from public.course_sources s where s.id = want_source for update;
  if not found or src.owner_id <> want_actor then
    raise exception 'The course source was not found.' using errcode = '42501';
  end if;
  if not private.course_source_relationship(src.owner_id, src.tenant_id, src.membership_id, src.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;
  if src.lifecycle_state <> 'available' or src.sha256 is null then
    raise exception 'Only an available source can support a correction.' using errcode = '55000';
  end if;

  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_correction::text, want_source::text,
    want_actor::text, want_derived_record, want_field, want_prior_sha256, want_corrected_sha256));
  perform pg_advisory_xact_lock(hashtext(src.tenant_id || ':' || want_actor::text || ':correction:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = src.tenant_id and o.actor_id = want_actor
     and o.action = 'correction_confirmed' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different correction.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;

  select * into latest from public.course_source_corrections c
   where c.source_id = want_source and c.derived_record_id = want_derived_record and c.field_name = want_field
   order by c.revision desc limit 1;
  if found and latest.corrected_value_sha256 <> want_prior_sha256 then
    raise exception 'The correction is based on an older derived revision.' using errcode = '40001';
  end if;
  next_revision := coalesce(latest.revision, 0) + 1;
  insert into public.course_source_corrections (
    id, source_id, tenant_id, confirmed_by, derived_record_id, field_name, revision,
    previous_correction_id, source_sha256, prior_value_sha256, corrected_value_sha256
  ) values (
    want_correction, want_source, src.tenant_id, want_actor, want_derived_record, want_field,
    next_revision, latest.id, src.sha256, want_prior_sha256, want_corrected_sha256
  );
  perform private.course_source_audit(want_actor, src.tenant_id, 'course_source.correction_confirmed',
    src.id, want_correlation, src.course_code, src.term, 'confirmed');
  insert into public.course_source_operations
    (tenant_id, actor_id, action, idempotency_key, request_sha256, source_id, correction_id, result_json)
  values (src.tenant_id, want_actor, 'correction_confirmed', want_idempotency, request_hash, src.id, want_correction,
    jsonb_build_object('sourceId', src.id, 'correctionId', want_correction,
      'revision', next_revision, 'idempotent', false));
  return jsonb_build_object('sourceId', src.id, 'correctionId', want_correction,
    'revision', next_revision, 'idempotent', false);
end $$;

create or replace function public.change_course_source_recovery_state(
  want_source uuid, want_actor uuid, want_action text, want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  src public.course_sources;
  prior public.course_source_operations;
  request_hash text;
  operation text;
begin
  perform private.course_source_service();
  if want_source is null or want_actor is null or want_action not in ('delete', 'restore')
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The recovery request is incomplete.' using errcode = '22023';
  end if;
  select * into src from public.course_sources s where s.id = want_source for update;
  if not found or src.owner_id <> want_actor then
    raise exception 'The course source was not found.' using errcode = '42501';
  end if;
  if not private.course_source_relationship(src.owner_id, src.tenant_id, src.membership_id, src.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;
  operation := case want_action when 'delete' then 'deletion_requested' else 'restored' end;
  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_source::text, want_actor::text, want_action));
  perform pg_advisory_xact_lock(hashtext(src.tenant_id || ':' || want_actor::text || ':' || operation || ':' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = src.tenant_id and o.actor_id = want_actor
     and o.action = operation and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different recovery request.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;

  if want_action = 'delete' then
    if src.lifecycle_state = 'deleted' then
      raise exception 'That source is already in recovery.' using errcode = '55000';
    end if;
    if private.account_is_held(want_actor) or private.tenant_is_held(src.tenant_id) then
      raise exception 'That source is under a legal hold and cannot enter deletion.' using errcode = '55006';
    end if;
    update public.course_sources set
      pre_delete_state = lifecycle_state, lifecycle_state = 'deleted',
      deleted_at = now(), recovery_until = now() + interval '30 days'
    where id = src.id returning * into src;
  else
    if src.lifecycle_state <> 'deleted' or src.recovery_until <= now() then
      raise exception 'That source is not recoverable.' using errcode = '55000';
    end if;
    update public.course_sources set
      lifecycle_state = pre_delete_state, pre_delete_state = null,
      deleted_at = null, recovery_until = null
    where id = src.id returning * into src;
  end if;

  perform private.course_source_audit(want_actor, src.tenant_id,
    case want_action when 'delete' then 'course_source.deletion_requested' else 'course_source.restored' end,
    src.id, want_correlation, src.course_code, src.term, src.lifecycle_state);
  insert into public.course_source_operations
    (tenant_id, actor_id, action, idempotency_key, request_sha256, source_id, result_json)
  values (src.tenant_id, want_actor, operation, want_idempotency, request_hash, src.id,
    jsonb_build_object('sourceId', src.id, 'state', src.lifecycle_state,
      'recoveryUntil', src.recovery_until, 'idempotent', false));
  return jsonb_build_object('sourceId', src.id, 'state', src.lifecycle_state,
    'recoveryUntil', src.recovery_until, 'idempotent', false);
end $$;

revoke all on function public.persist_student_course_source(uuid, uuid, text, uuid, text, text, text, text, text, text, bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.confirm_course_source_correction(uuid, uuid, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.change_course_source_recovery_state(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.persist_student_course_source(uuid, uuid, text, uuid, text, text, text, text, text, text, bigint, text, text)
  to service_role;
grant execute on function public.confirm_course_source_correction(uuid, uuid, uuid, text, text, text, text, text, text)
  to service_role;
grant execute on function public.change_course_source_recovery_state(uuid, uuid, text, text, text)
  to service_role;

comment on table public.course_sources is
  'Private metadata for student-owned course sources. No bytes, extracted text or public storage URL. Client roles have no direct access.';
comment on table public.course_source_corrections is
  'Append-only hash lineage for student-confirmed derived-record corrections; corrected content is not stored here.';
comment on table public.course_source_operations is
  'Append-only idempotency ledger for course-source persistence, correction and recovery operations.';
comment on function public.persist_student_course_source(uuid, uuid, text, uuid, text, text, text, text, text, text, bigint, text, text) is
  'Service-only metadata persistence after independently verifying the current student course row and active membership. Creates no object or upload URL.';
comment on function public.confirm_course_source_correction(uuid, uuid, uuid, text, text, text, text, text, text) is
  'Service-only append of hash-linked correction provenance for an available source after rechecking its current relationship.';
comment on function public.change_course_source_recovery_state(uuid, uuid, text, text, text) is
  'Service-only, idempotent 30-day deletion/recovery state change with legal-hold and current-relationship checks. Does not delete object bytes.';
