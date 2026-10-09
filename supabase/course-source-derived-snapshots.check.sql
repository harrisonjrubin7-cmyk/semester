-- supabase/course-source-derived-snapshots.check.sql — hash-only extraction
-- receipts and fail-closed re-import binding.

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.service_call(statement text)
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
  student constant uuid := '12000000-0000-0000-0000-000000000001';
  membership constant uuid := '22000000-0000-0000-0000-000000000001';
  current_source constant uuid := '32000000-0000-0000-0000-000000000001';
  imported_source constant uuid := '32000000-0000-0000-0000-000000000002';
  receipt constant uuid := '42000000-0000-0000-0000-000000000001';
  corrected_receipt constant uuid := '42000000-0000-0000-0000-000000000002';
  correction constant uuid := '62000000-0000-0000-0000-000000000001';
  batch constant uuid := '52000000-0000-0000-0000-000000000001';
  month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  result jsonb;
begin
  insert into public.schools (id, name, email_domains)
    values ('derived-u', 'Derived University', array['derived.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values (student, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'student@derived.example', now(), now(), now());
  insert into public.institution_membership (id, tenant_id, auth_user_id, status, roles, source)
    values (membership, 'derived-u', student, 'active', array['student'], 'institution_admin');
  insert into public.courses (user_id, id, data)
    values (student, 'course-derived', '{}'::jsonb);
  insert into public.course_sources (
    id, tenant_id, owner_id, membership_id, course_record_id, course_code, term,
    object_key, filename, declared_content_type, size_bytes, lifecycle_state,
    sha256, detected_content_type, scanner_version,
    storage_sha256, stored_size_bytes, storage_version, stored_at,
    scan_verdict, scan_settled_at
  ) values
    (current_source, 'derived-u', student, membership, 'course-derived', 'ECON 1020', '2026FA',
      't/derived-u/student_private/' || month || '/' || current_source,
      'current.pdf', 'application/pdf', 100, 'available', repeat('a',64), 'application/pdf', 'scanner-1',
      repeat('a',64), 100, 'object-current', now(), 'clean', now()),
    (imported_source, 'derived-u', student, membership, 'course-derived', 'ECON 1020', '2026FA',
      't/derived-u/student_private/' || month || '/' || imported_source,
      'imported.pdf', 'application/pdf', 100, 'available', repeat('b',64), 'application/pdf', 'scanner-1',
      repeat('b',64), 100, 'object-imported', now(), 'clean', now());

  perform pg_temp.counted('the derived-receipt table has RLS enabled',
    (select c.relrowsecurity::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'course_source_derived_snapshots'), 1);
  perform pg_temp.counted('the derived-receipt table has no browser policy',
    (select count(*) from pg_policies where schemaname = 'public'
      and tablename = 'course_source_derived_snapshots'), 0);
  perform pg_temp.counted('client roles have no derived-receipt table privilege',
    (select count(*) from information_schema.role_table_grants where table_schema = 'public'
      and table_name = 'course_source_derived_snapshots'
      and grantee in ('anon', 'authenticated')), 0);

  perform pg_temp.refused('conflict recording without an extraction receipt', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'derived-conflict-key01','corr-derived-conflict1')$q$,
      batch, student, current_source, imported_source, repeat('d',64), repeat('e',64),
      jsonb_build_object('moved:item-one', 'keep_current')));
  perform pg_temp.refused('a signed-in student forging an extraction receipt', 'authenticated',
    jsonb_build_object('sub', student, 'role', 'authenticated'),
    format($q$select public.record_course_source_derived_snapshot(
      %L,%L,%L,%L,%L,'extractor-1','derived-receipt-key01','corr-derived-receipt1')$q$,
      receipt, imported_source, student, repeat('b',64), repeat('e',64)));
  perform pg_temp.refused('a receipt that does not match the scanned source hash', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_derived_snapshot(
      %L,%L,%L,%L,%L,'extractor-1','derived-receipt-key02','corr-derived-receipt2')$q$,
      receipt, imported_source, student, repeat('c',64), repeat('e',64)));

  create function pg_temp.fail_derived_audit() returns trigger language plpgsql as $f$
  begin
    if new.action = 'course_source.snapshot_derived' then raise exception 'audit unavailable'; end if;
    return new;
  end $f$;
  create trigger fail_derived_audit before insert on public.audit_event
    for each row execute function pg_temp.fail_derived_audit();
  perform pg_temp.refused('a receipt whose audit append fails', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_derived_snapshot(
      %L,%L,%L,%L,%L,'extractor-1','derived-receipt-key03','corr-derived-receipt3')$q$,
      receipt, imported_source, student, repeat('b',64), repeat('e',64)));
  perform pg_temp.counted('audit failure rolls back receipt and operation evidence',
    (select count(*) from public.course_source_derived_snapshots where id = receipt)
    + (select count(*) from public.course_source_operations
      where idempotency_key = 'derived-receipt-key03'), 0);
  drop trigger fail_derived_audit on public.audit_event;

  result := pg_temp.service_call(format($q$select public.record_course_source_derived_snapshot(
    %L,%L,%L,%L,%L,'extractor-1','derived-receipt-key01','corr-derived-receipt1')$q$,
    receipt, imported_source, student, repeat('b',64), repeat('e',64)));
  perform pg_temp.counted('one hash-only receipt, operation and audit fact commit atomically',
    (select count(*) from public.course_source_derived_snapshots d
      where d.id = receipt and d.source_id = imported_source and d.tenant_id = 'derived-u'
        and d.owner_id = student and d.revision = 1 and d.source_sha256 = repeat('b',64)
        and d.snapshot_sha256 = repeat('e',64) and d.extractor_version = 'extractor-1')
    + (select count(*) from public.course_source_operations
      where source_id = imported_source and action = 'snapshot_derived')
    + (select count(*) from public.audit_event
      where action = 'course_source.snapshot_derived'
        and object_sha256 = private.role_audit_sha256(imported_source::text)), 3);
  perform pg_temp.counted('the first receipt is not an idempotent replay',
    ((result ->> 'idempotent')::boolean = false and (result ->> 'revision')::int = 1)::int, 1);
  perform pg_temp.counted('the receipt table stores no extracted content column',
    (select count(*) from information_schema.columns where table_schema = 'public'
      and table_name = 'course_source_derived_snapshots'
      and column_name in ('content','data','text','quote','snapshot')), 0);

  result := pg_temp.service_call(format($q$select public.record_course_source_derived_snapshot(
    %L,%L,%L,%L,%L,'extractor-1','derived-receipt-key01','corr-derived-receipt1')$q$,
    receipt, imported_source, student, repeat('b',64), repeat('e',64)));
  perform pg_temp.counted('an exact retry returns the first receipt without duplication',
    ((result ->> 'idempotent')::boolean)::int
    + (select count(*) from public.course_source_derived_snapshots where source_id = imported_source)
    + (select count(*) from public.course_source_operations
      where source_id = imported_source and action = 'snapshot_derived'), 3);
  perform pg_temp.refused('the same idempotency key with a changed snapshot hash', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_derived_snapshot(
      %L,%L,%L,%L,%L,'extractor-1','derived-receipt-key01','corr-derived-receipt1')$q$,
      receipt, imported_source, student, repeat('b',64), repeat('f',64)));
  perform pg_temp.refused('service role rewriting append-only receipt evidence', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$update public.course_source_derived_snapshots set extractor_version = 'rewritten'
      where id = %L$q$, receipt));
  perform pg_temp.refused('conflict recording with an unreceipted imported hash', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'derived-conflict-key02','corr-derived-conflict2')$q$,
      batch, student, current_source, imported_source, repeat('d',64), repeat('f',64),
      jsonb_build_object('moved:item-one', 'keep_current')));

  result := pg_temp.service_call(format($q$select public.confirm_course_source_correction(
    %L,%L,%L,'item-one','title',%L,%L,
    'derived-correction-key01','corr-derived-correct1')$q$,
    correction, imported_source, student, repeat('1',64), repeat('2',64)));
  perform pg_temp.counted('the student correction commits after the first snapshot receipt',
    ((result ->> 'revision')::int = 1)::int, 1);
  perform pg_temp.refused('a snapshot receipt that predates a confirmed correction', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'derived-conflict-key01','corr-derived-conflict1')$q$,
      batch, student, current_source, imported_source, repeat('d',64), repeat('e',64),
      jsonb_build_object('moved:item-one', 'keep_current')));

  result := pg_temp.service_call(format($q$select public.record_course_source_derived_snapshot(
    %L,%L,%L,%L,%L,'extractor-2','derived-receipt-key05','corr-derived-receipt5')$q$,
    corrected_receipt, imported_source, student, repeat('b',64), repeat('f',64)));
  perform pg_temp.counted('a new receipt binds the current confirmed-correction state',
    (select count(*) from public.course_source_derived_snapshots d
      where d.id = corrected_receipt and d.correction_count = 1
        and d.corrections_sha256 = private.course_source_corrections_sha256(imported_source)), 1);

  result := pg_temp.service_call(format($q$select public.record_course_source_conflict_resolution(
    %L,%L,%L,%L,%L,%L,%L::jsonb,'derived-conflict-key03','corr-derived-conflict3')$q$,
    batch, student, current_source, imported_source, repeat('d',64), repeat('f',64),
    jsonb_build_object('moved:item-one', 'keep_current')));
  perform pg_temp.counted('a correction-current receipt unlocks only its exact imported hash',
    ((result ->> 'state') = 'recorded')::int
    + (select count(*) from public.course_source_resolution_batches
      where id = batch and imported_source_id = imported_source
        and imported_snapshot_sha256 = repeat('f',64)), 2);

  update public.institution_membership set status = 'suspended' where id = membership;
  perform pg_temp.refused('relationship revocation blocking a later derived receipt', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_derived_snapshot(
      %L,%L,%L,%L,%L,'extractor-2','derived-receipt-key04','corr-derived-receipt4')$q$,
      gen_random_uuid(), current_source, student, repeat('a',64), repeat('c',64)));
end $$;

rollback;
