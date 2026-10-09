-- Service-only storage receipt and scan settlement for student course sources.
--
-- This migration records facts reported by a future private storage/scanner
-- runtime. It does not provision a bucket, store bytes, issue a signed URL,
-- invoke a scanner, extract content or expose a client route.

alter table public.course_sources
  add column if not exists storage_sha256 text
    check (storage_sha256 is null or storage_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists stored_size_bytes bigint
    check (stored_size_bytes is null or stored_size_bytes between 1 and 52428800),
  add column if not exists storage_version text
    check (storage_version is null or storage_version ~ '^[A-Za-z0-9._:-]{1,120}$'),
  add column if not exists stored_at timestamptz,
  add column if not exists scan_verdict text
    check (scan_verdict is null or scan_verdict in (
      'clean', 'blocked', 'error', 'type_mismatch', 'integrity_mismatch'
    )),
  add column if not exists scan_settled_at timestamptz;

alter table public.course_sources
  drop constraint if exists course_source_storage_receipt_shape,
  add constraint course_source_storage_receipt_shape check (
    (storage_sha256 is null and stored_size_bytes is null and storage_version is null and stored_at is null)
    or
    (storage_sha256 is not null and stored_size_bytes = size_bytes
      and storage_version is not null and stored_at is not null)
  ),
  drop constraint if exists course_source_scan_settlement_shape,
  add constraint course_source_scan_settlement_shape check (
    (scan_verdict is null and scan_settled_at is null)
    or
    (scan_verdict is not null and scan_settled_at is not null and scanner_version is not null)
  ),
  drop constraint if exists course_source_available_receipt,
  add constraint course_source_available_receipt check (
    lifecycle_state <> 'available'
    or (scan_verdict is not null and scan_verdict = 'clean'
      and sha256 is not null and storage_sha256 is not null and sha256 = storage_sha256
      and detected_content_type is not null and detected_content_type = declared_content_type
      and scanner_version is not null and scan_settled_at is not null)
  );

alter table public.course_source_operations
  drop constraint if exists course_source_operations_action_check,
  add constraint course_source_operations_action_check check (action in (
    'upload_planned', 'storage_received', 'scan_settled',
    'correction_confirmed', 'deletion_requested', 'restored'
  ));

create or replace function private.course_source_service_audit(
  want_service uuid, want_tenant text, want_action text, want_source uuid,
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
    private.role_audit_sha256(want_service::text), 'service',
    jsonb_build_object('courseCode', want_course_code, 'term', want_term, 'outcome', want_outcome)
  ) returning id into made;
  return made;
end $$;

revoke all on function private.course_source_service_audit(uuid, text, text, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function public.record_student_course_source_storage(
  want_source uuid, want_tenant text, want_service uuid, want_object_key text,
  want_size_bytes bigint, want_storage_sha256 text, want_storage_version text,
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
  prior public.course_source_operations;
  request_hash text;
begin
  perform private.course_source_service();
  if want_source is null or want_tenant is null or want_service is null
     or want_storage_sha256 !~ '^[0-9a-f]{64}$'
     or want_storage_version !~ '^[A-Za-z0-9._:-]{1,120}$'
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The storage receipt is incomplete.' using errcode = '22023';
  end if;

  select * into src from public.course_sources s
   where s.id = want_source and s.tenant_id = want_tenant for update;
  if not found then
    raise exception 'The course source was not found.' using errcode = '42501';
  end if;
  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_source::text,
    want_tenant, want_service::text, want_object_key, want_size_bytes::text,
    want_storage_sha256, want_storage_version));
  perform pg_advisory_xact_lock(hashtext(want_tenant || ':' || want_service::text || ':storage:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = want_tenant and o.actor_id = want_service
     and o.action = 'storage_received' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different storage receipt.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;
  if src.lifecycle_state <> 'pending_upload' then
    raise exception 'That source is not awaiting storage.' using errcode = '55000';
  end if;
  if not private.course_source_relationship(src.owner_id, src.tenant_id, src.membership_id, src.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;
  if want_object_key <> src.object_key or want_size_bytes <> src.size_bytes then
    raise exception 'The storage receipt does not match the planned object.' using errcode = '22023';
  end if;

  update public.course_sources set
    lifecycle_state = 'quarantined', storage_sha256 = want_storage_sha256,
    stored_size_bytes = want_size_bytes, storage_version = want_storage_version,
    stored_at = now()
  where id = src.id returning * into src;
  perform private.course_source_service_audit(want_service, src.tenant_id,
    'course_source.storage_received', src.id, want_correlation,
    src.course_code, src.term, 'quarantined');
  insert into public.course_source_operations
    (tenant_id, actor_id, action, idempotency_key, request_sha256, source_id, result_json)
  values (src.tenant_id, want_service, 'storage_received', want_idempotency,
    request_hash, src.id, jsonb_build_object('sourceId', src.id,
      'state', src.lifecycle_state, 'idempotent', false));
  return jsonb_build_object('sourceId', src.id, 'state', src.lifecycle_state, 'idempotent', false);
end $$;

create or replace function public.settle_student_course_source_scan(
  want_source uuid, want_tenant text, want_service uuid, want_detected_type text,
  want_scan_sha256 text, want_scanner_version text, want_verdict text,
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
  prior public.course_source_operations;
  request_hash text;
  allowed_type boolean;
  valid_hash boolean;
  resolved_verdict text;
  next_state text;
begin
  perform private.course_source_service();
  if want_source is null or want_tenant is null or want_service is null
     or want_scanner_version !~ '^[A-Za-z0-9._:-]{1,120}$'
     or want_verdict not in ('clean', 'blocked', 'error')
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The scan settlement is incomplete.' using errcode = '22023';
  end if;

  select * into src from public.course_sources s
   where s.id = want_source and s.tenant_id = want_tenant for update;
  if not found then
    raise exception 'The course source was not found.' using errcode = '42501';
  end if;
  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_source::text,
    want_tenant, want_service::text, want_detected_type, want_scan_sha256,
    want_scanner_version, want_verdict));
  perform pg_advisory_xact_lock(hashtext(want_tenant || ':' || want_service::text || ':scan:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = want_tenant and o.actor_id = want_service
     and o.action = 'scan_settled' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different scan settlement.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;
  if src.lifecycle_state <> 'quarantined' then
    raise exception 'That source is not awaiting a scan.' using errcode = '55000';
  end if;
  if not private.course_source_relationship(src.owner_id, src.tenant_id, src.membership_id, src.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;

  allowed_type := want_detected_type in (
    'application/pdf', 'text/plain', 'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  );
  valid_hash := want_scan_sha256 ~ '^[0-9a-f]{64}$';
  resolved_verdict := case
    when want_verdict = 'blocked' then 'blocked'
    when want_verdict = 'error' then 'error'
    when not allowed_type or want_detected_type <> src.declared_content_type then 'type_mismatch'
    when not valid_hash or want_scan_sha256 <> src.storage_sha256 then 'integrity_mismatch'
    else 'clean'
  end;
  next_state := case resolved_verdict when 'clean' then 'available' else 'rejected' end;

  update public.course_sources set
    lifecycle_state = next_state,
    detected_content_type = case when allowed_type then want_detected_type else null end,
    sha256 = case when valid_hash then want_scan_sha256 else null end,
    scanner_version = want_scanner_version, scan_verdict = resolved_verdict,
    scan_settled_at = now()
  where id = src.id returning * into src;
  perform private.course_source_service_audit(want_service, src.tenant_id,
    'course_source.scan_settled', src.id, want_correlation,
    src.course_code, src.term, resolved_verdict);
  insert into public.course_source_operations
    (tenant_id, actor_id, action, idempotency_key, request_sha256, source_id, result_json)
  values (src.tenant_id, want_service, 'scan_settled', want_idempotency,
    request_hash, src.id, jsonb_build_object('sourceId', src.id,
      'state', src.lifecycle_state, 'verdict', resolved_verdict, 'idempotent', false));
  return jsonb_build_object('sourceId', src.id, 'state', src.lifecycle_state,
    'verdict', resolved_verdict, 'idempotent', false);
end $$;

revoke all on function public.record_student_course_source_storage(uuid, text, uuid, text, bigint, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.settle_student_course_source_scan(uuid, text, uuid, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_student_course_source_storage(uuid, text, uuid, text, bigint, text, text, text, text)
  to service_role;
grant execute on function public.settle_student_course_source_scan(uuid, text, uuid, text, text, text, text, text, text)
  to service_role;

comment on function public.record_student_course_source_storage(uuid, text, uuid, text, bigint, text, text, text, text) is
  'Service-only, idempotent storage-receipt transition. Records no bytes and leaves the source quarantined.';
comment on function public.settle_student_course_source_scan(uuid, text, uuid, text, text, text, text, text, text) is
  'Service-only, idempotent scan settlement. Availability requires a clean named scanner, matching allowlisted type and matching stored/scanned SHA-256.';
