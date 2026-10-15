-- supabase/course-source-scan-settlement.check.sql — Service-only,
-- tenant-bound storage receipt and fail-closed scan settlement proof.

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.call_service(statement text)
returns jsonb language plpgsql as $$
declare got jsonb;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  execute statement into got;
  execute 'reset role';
  return got;
exception when others then
  execute 'reset role';
  raise;
end $$;

create or replace function pg_temp.err_as(role_name text, claims jsonb, statement text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', claims::text, true);
  execute 'set local role ' || quote_ident(role_name);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.refused(what text, role_name text, claims jsonb, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err_as(role_name, claims, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

do $$
declare
  student constant uuid := '51000000-0000-0000-0000-000000000001';
  service constant uuid := '51000000-0000-0000-0000-000000000002';
  membership constant uuid := '52000000-0000-0000-0000-000000000001';
  clean_source constant uuid := '53000000-0000-0000-0000-000000000001';
  reject_source constant uuid := '53000000-0000-0000-0000-000000000002';
  rollback_source constant uuid := '53000000-0000-0000-0000-000000000003';
  loop_source uuid;
  month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  object_key text;
  got jsonb;
begin
  insert into public.schools (id, name, email_domains)
  values ('scan-u', 'Scan University', array['scan.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@scan.example', now(), now(), now()),
    (service, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'service@scan.example', now(), now(), now());
  insert into public.institution_membership (id, tenant_id, auth_user_id, status, roles, source)
  values (membership, 'scan-u', student, 'active', array['student'], 'institution_admin');
  insert into public.courses (user_id, id, data) values (student, 'scan-course', '{}'::jsonb);

  foreach loop_source in array array[clean_source, reject_source, rollback_source] loop
    object_key := format('t/scan-u/student_private/%s/%s', month, loop_source);
    perform pg_temp.call_service(format($q$select public.persist_student_course_source(
      %L,%L,'scan-u',%L,'scan-course','ECON 1020','2026FA',%L,'syllabus.pdf',
      'application/pdf',100,%L,%L)$q$, loop_source, student, membership, object_key,
      'plan-key-' || replace(loop_source::text, '-', ''),
      'corr-plan-' || left(replace(loop_source::text, '-', ''), 24)));
  end loop;

  object_key := format('t/scan-u/student_private/%s/%s', month, clean_source);
  perform pg_temp.refused('a client recording a storage receipt', 'authenticated',
    jsonb_build_object('sub', student, 'role', 'authenticated'),
    format($q$select public.record_student_course_source_storage(
      %L,'scan-u',%L,%L,100,%L,'object-v1','storage-key-client1','corr-storage-client1')$q$,
      clean_source, service, object_key, repeat('a',64)));
  perform pg_temp.refused('a service crossing the source tenant', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_student_course_source_storage(
      %L,'other-u',%L,%L,100,%L,'object-v1','storage-key-cross01','corr-storage-cross01')$q$,
      clean_source, service, object_key, repeat('a',64)));
  perform pg_temp.refused('a mismatched object receipt', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_student_course_source_storage(
      %L,'scan-u',%L,'t/scan-u/wrong',100,%L,'object-v1','storage-key-wrong01','corr-storage-wrong01')$q$,
      clean_source, service, repeat('a',64)));

  got := pg_temp.call_service(format($q$select public.record_student_course_source_storage(
    %L,'scan-u',%L,%L,100,%L,'object-v1','storage-key-clean01','corr-storage-clean01')$q$,
    clean_source, service, object_key, repeat('a',64)));
  perform pg_temp.counted('a matching receipt leaves the source quarantined',
    (select count(*) from public.course_sources where id = clean_source
      and lifecycle_state = 'quarantined' and storage_sha256 = repeat('a',64)
      and stored_size_bytes = 100 and storage_version = 'object-v1' and stored_at is not null), 1);
  perform pg_temp.counted('the first receipt is not an idempotent replay',
    ((got ->> 'idempotent')::boolean = false)::int, 1);
  got := pg_temp.call_service(format($q$select public.record_student_course_source_storage(
    %L,'scan-u',%L,%L,100,%L,'object-v1','storage-key-clean01','corr-storage-clean01')$q$,
    clean_source, service, object_key, repeat('a',64)));
  perform pg_temp.counted('an exact receipt retry replays without another audit or operation',
    ((got ->> 'idempotent')::boolean)::int
    + (select count(*) from public.course_source_operations where source_id = clean_source and action = 'storage_received')
    + (select count(*) from public.audit_event where action = 'course_source.storage_received'
        and object_sha256 = private.role_audit_sha256(clean_source::text)), 3);
  perform pg_temp.refused('a receipt idempotency collision', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_student_course_source_storage(
      %L,'scan-u',%L,%L,100,%L,'object-v2','storage-key-clean01','corr-storage-clean01')$q$,
      clean_source, service, object_key, repeat('a',64)));

  got := pg_temp.call_service(format($q$select public.settle_student_course_source_scan(
    %L,'scan-u',%L,'application/pdf',%L,'scanner-2026.10','clean',
    'scan-key-clean-001','corr-scan-clean01')$q$, clean_source, service, repeat('a',64)));
  perform pg_temp.counted('matching clean scan facts make the source available',
    (select count(*) from public.course_sources where id = clean_source
      and lifecycle_state = 'available' and scan_verdict = 'clean'
      and sha256 = storage_sha256 and detected_content_type = declared_content_type
      and scanner_version = 'scanner-2026.10' and scan_settled_at is not null), 1);
  perform pg_temp.counted('clean scan settlement reports availability',
    ((got ->> 'state') = 'available' and (got ->> 'verdict') = 'clean')::int, 1);
  got := pg_temp.call_service(format($q$select public.settle_student_course_source_scan(
    %L,'scan-u',%L,'application/pdf',%L,'scanner-2026.10','clean',
    'scan-key-clean-001','corr-scan-clean01')$q$, clean_source, service, repeat('a',64)));
  perform pg_temp.counted('an exact scan retry is idempotent',
    ((got ->> 'idempotent')::boolean)::int
    + (select count(*) from public.course_source_operations where source_id = clean_source and action = 'scan_settled')
    + (select count(*) from public.audit_event where action = 'course_source.scan_settled'
        and object_sha256 = private.role_audit_sha256(clean_source::text)), 3);

  object_key := format('t/scan-u/student_private/%s/%s', month, reject_source);
  perform pg_temp.call_service(format($q$select public.record_student_course_source_storage(
    %L,'scan-u',%L,%L,100,%L,'object-v1','storage-key-reject1','corr-storage-reject1')$q$,
    reject_source, service, object_key, repeat('a',64)));
  got := pg_temp.call_service(format($q$select public.settle_student_course_source_scan(
    %L,'scan-u',%L,'application/pdf',%L,'scanner-2026.10','clean',
    'scan-key-reject-01','corr-scan-reject01')$q$, reject_source, service, repeat('b',64)));
  perform pg_temp.counted('an integrity mismatch settles rejected and never readable',
    (select count(*) from public.course_sources where id = reject_source
      and lifecycle_state = 'rejected' and scan_verdict = 'integrity_mismatch'
      and sha256 = repeat('b',64) and storage_sha256 = repeat('a',64)), 1);
  perform pg_temp.counted('rejected result names the bounded reason',
    ((got ->> 'state') = 'rejected' and (got ->> 'verdict') = 'integrity_mismatch')::int, 1);

  object_key := format('t/scan-u/student_private/%s/%s', month, rollback_source);
  perform pg_temp.call_service(format($q$select public.record_student_course_source_storage(
    %L,'scan-u',%L,%L,100,%L,'object-v1','storage-key-rollback','corr-storage-rollback')$q$,
    rollback_source, service, object_key, repeat('c',64)));
  create function pg_temp.fail_scan_audit() returns trigger language plpgsql as $f$
  begin
    if new.action = 'course_source.scan_settled' then raise exception 'audit unavailable'; end if;
    return new;
  end $f$;
  create trigger fail_scan_audit before insert on public.audit_event
    for each row execute function pg_temp.fail_scan_audit();
  perform pg_temp.refused('scan settlement whose audit append fails', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.settle_student_course_source_scan(
      %L,'scan-u',%L,'application/pdf',%L,'scanner-2026.10','clean',
      'scan-key-rollback01','corr-scan-rollback01')$q$, rollback_source, service, repeat('c',64)));
  perform pg_temp.counted('audit failure rolls scan state and idempotency back',
    (select count(*) from public.course_sources where id = rollback_source
      and lifecycle_state = 'quarantined' and scan_verdict is null)
    + (select count(*) from public.course_source_operations where source_id = rollback_source
        and action = 'scan_settled'), 1);
  drop trigger fail_scan_audit on public.audit_event;

  update public.institution_membership set status = 'suspended' where id = membership;
  perform pg_temp.refused('relationship revocation blocks a pending scan', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.settle_student_course_source_scan(
      %L,'scan-u',%L,'application/pdf',%L,'scanner-2026.10','clean',
      'scan-key-revoked-01','corr-scan-revoked01')$q$, rollback_source, service, repeat('c',64)));

  perform pg_temp.counted('service audit facts contain no filename, object key or content hash',
    (select count(*) from public.audit_event where action in
      ('course_source.storage_received', 'course_source.scan_settled')
      and detail ?| array['filename','objectKey','sha256','storageVersion','excerpt','text']), 0);
  perform pg_temp.refused('the service role bypassing settlement with a direct update', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$update public.course_sources set lifecycle_state = 'available' where id = %L$q$, rollback_source));
end $$;

rollback;
