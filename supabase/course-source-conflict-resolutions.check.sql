-- supabase/course-source-conflict-resolutions.check.sql — Durable, private,
-- student-controlled evidence for re-import conflict choices.

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
  student constant uuid := '11000000-0000-0000-0000-000000000001';
  other constant uuid := '11000000-0000-0000-0000-000000000002';
  membership constant uuid := '21000000-0000-0000-0000-000000000001';
  other_membership constant uuid := '21000000-0000-0000-0000-000000000002';
  current_source constant uuid := '31000000-0000-0000-0000-000000000001';
  imported_source constant uuid := '31000000-0000-0000-0000-000000000002';
  other_source constant uuid := '31000000-0000-0000-0000-000000000003';
  batch constant uuid := '41000000-0000-0000-0000-000000000001';
  month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  choices jsonb := jsonb_build_object(
    'moved:item-one', 'keep_current',
    'provenance:item-one', 'use_imported',
    'field:Professor', 'keep_current',
    'grading:reweighted:Exams', 'use_imported');
  recorded jsonb;
  voided jsonb;
begin
  insert into public.schools (id, name, email_domains) values
    ('resolution-u', 'Resolution University', array['resolution.example']),
    ('resolution-other', 'Other Resolution University', array['other-resolution.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@resolution.example', now(), now(), now()),
    (other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@other-resolution.example', now(), now(), now());
  insert into public.institution_membership (id, tenant_id, auth_user_id, status, roles, source) values
    (membership, 'resolution-u', student, 'active', array['student'], 'institution_admin'),
    (other_membership, 'resolution-other', other, 'active', array['student'], 'institution_admin');
  insert into public.courses (user_id, id, data) values
    (student, 'course-resolution', '{}'::jsonb),
    (other, 'course-other-resolution', '{}'::jsonb);

  perform pg_temp.service_call(format($q$select public.persist_student_course_source(
    %L,%L,'resolution-u',%L,'course-resolution','ECON 1020','2026FA',
    't/resolution-u/student_private/%s/%s','current.pdf','application/pdf',100,
    'resolution-upload-current','corr-resolution-current')$q$,
    current_source, student, membership, month, current_source));
  perform pg_temp.service_call(format($q$select public.persist_student_course_source(
    %L,%L,'resolution-u',%L,'course-resolution','ECON 1020','2026FA',
    't/resolution-u/student_private/%s/%s','imported.pdf','application/pdf',100,
    'resolution-upload-import','corr-resolution-import')$q$,
    imported_source, student, membership, month, imported_source));
  perform pg_temp.service_call(format($q$select public.persist_student_course_source(
    %L,%L,'resolution-other',%L,'course-other-resolution','HIST 1010','2026FA',
    't/resolution-other/student_private/%s/%s','other.pdf','application/pdf',100,
    'resolution-upload-other1','corr-resolution-other1')$q$,
    other_source, other, other_membership, month, other_source));

  perform pg_temp.service_call(format($q$select public.record_student_course_source_storage(
    %L,'resolution-u',%L,'t/resolution-u/student_private/%s/%s',100,%L,'test-object-current',
    'resolution-store-current','corr-resolution-store1')$q$,
    current_source, other, month, current_source, repeat('a',64)));
  perform pg_temp.service_call(format($q$select public.record_student_course_source_storage(
    %L,'resolution-u',%L,'t/resolution-u/student_private/%s/%s',100,%L,'test-object-import',
    'resolution-store-import','corr-resolution-store2')$q$,
    imported_source, other, month, imported_source, repeat('b',64)));
  perform pg_temp.service_call(format($q$select public.record_student_course_source_storage(
    %L,'resolution-other',%L,'t/resolution-other/student_private/%s/%s',100,%L,'test-object-other',
    'resolution-store-other1','corr-resolution-store3')$q$,
    other_source, student, month, other_source, repeat('c',64)));
  perform pg_temp.service_call(format($q$select public.settle_student_course_source_scan(
    %L,'resolution-u',%L,'application/pdf',%L,'test-scanner-1','clean',
    'resolution-scan-current1','corr-resolution-scan01')$q$,
    current_source, other, repeat('a',64)));
  perform pg_temp.service_call(format($q$select public.settle_student_course_source_scan(
    %L,'resolution-u',%L,'application/pdf',%L,'test-scanner-1','clean',
    'resolution-scan-import01','corr-resolution-scan02')$q$,
    imported_source, other, repeat('b',64)));
  perform pg_temp.service_call(format($q$select public.settle_student_course_source_scan(
    %L,'resolution-other',%L,'application/pdf',%L,'test-scanner-1','clean',
    'resolution-scan-other001','corr-resolution-scan03')$q$,
    other_source, student, repeat('c',64)));

  perform pg_temp.counted('both resolution tables have RLS enabled',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in
        ('course_source_resolution_batches', 'course_source_resolution_choices') and c.relrowsecurity), 2);
  perform pg_temp.counted('no browser policy exists on private resolution evidence',
    (select count(*) from pg_policies where schemaname = 'public' and tablename in
      ('course_source_resolution_batches', 'course_source_resolution_choices')), 0);
  perform pg_temp.counted('client roles have no resolution-table privilege',
    (select count(*) from information_schema.role_table_grants where table_schema = 'public'
      and table_name in ('course_source_resolution_batches', 'course_source_resolution_choices')
      and grantee in ('anon', 'authenticated')), 0);

  perform pg_temp.refused('a signed-in student calling the service recorder', 'authenticated',
    jsonb_build_object('sub', student, 'role', 'authenticated'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key01','corr-resolution-record1')$q$,
      batch, student, current_source, imported_source, repeat('d',64), repeat('e',64), choices));
  perform pg_temp.refused('a service pairing sources from different tenants', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key02','corr-resolution-record2')$q$,
      gen_random_uuid(), student, current_source, other_source, repeat('d',64), repeat('e',64), choices));
  update public.course_sources set course_code = 'MATH 1010' where id = imported_source;
  perform pg_temp.refused('a service pairing differently bound course sources', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key07','corr-resolution-record7')$q$,
      gen_random_uuid(), student, current_source, imported_source, repeat('d',64), repeat('e',64), choices));
  update public.course_sources set course_code = 'ECON 1020' where id = imported_source;
  perform pg_temp.refused('a map with an unknown conflict key', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key03','corr-resolution-record3')$q$,
      gen_random_uuid(), student, current_source, imported_source, repeat('d',64), repeat('e',64),
      jsonb_build_object('silent:overwrite', 'use_imported')));
  perform pg_temp.refused('a conflict map over identical derived snapshots', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key08','corr-resolution-record8')$q$,
      gen_random_uuid(), student, current_source, imported_source, repeat('d',64), repeat('d',64), choices));
  perform pg_temp.refused('a map with a preselected-looking invalid choice', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key04','corr-resolution-record4')$q$,
      gen_random_uuid(), student, current_source, imported_source, repeat('d',64), repeat('e',64),
      jsonb_build_object('moved:item-one', 'accept_all')));

  create function pg_temp.fail_resolution_audit() returns trigger language plpgsql as $f$
  begin
    if new.action = 'course_source.conflicts_recorded' then raise exception 'audit unavailable'; end if;
    return new;
  end $f$;
  create trigger fail_resolution_audit before insert on public.audit_event
    for each row execute function pg_temp.fail_resolution_audit();
  perform pg_temp.refused('a recording whose audit append fails', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key06','corr-resolution-record6')$q$,
      '41000000-0000-0000-0000-000000000006', student, current_source, imported_source,
      repeat('d',64), repeat('e',64), choices));
  perform pg_temp.counted('audit failure rolls back the batch, choices and idempotency receipt',
    (select count(*) from public.course_source_resolution_batches
      where id = '41000000-0000-0000-0000-000000000006')
    + (select count(*) from public.course_source_resolution_choices
      where batch_id = '41000000-0000-0000-0000-000000000006')
    + (select count(*) from public.course_source_operations
      where idempotency_key = 'resolution-record-key06'), 0);
  drop trigger fail_resolution_audit on public.audit_event;

  recorded := pg_temp.service_call(format($q$select public.record_course_source_conflict_resolution(
    %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key01','corr-resolution-record1')$q$,
    batch, student, current_source, imported_source, repeat('d',64), repeat('e',64), choices));
  perform pg_temp.counted('one complete source-pair batch is recorded',
    (select count(*) from public.course_source_resolution_batches
      where id = batch and tenant_id = 'resolution-u' and owner_id = student
        and current_source_id = current_source and imported_source_id = imported_source
        and decision_count = 4 and state = 'recorded'), 1);
  perform pg_temp.counted('every bounded choice is stored exactly once',
    (select count(*) from public.course_source_resolution_choices where batch_id = batch), 4);
  perform pg_temp.counted('the first result is not an idempotent replay',
    ((recorded ->> 'idempotent')::boolean = false and (recorded ->> 'conflicts')::int = 4)::int, 1);
  perform pg_temp.counted('recording appends one operation and one bounded audit fact',
    (select count(*) from public.course_source_operations where resolution_batch_id = batch and action = 'conflicts_recorded')
    + (select count(*) from public.audit_event where action = 'course_source.conflicts_recorded'
        and object_sha256 = private.role_audit_sha256(imported_source::text)), 2);
  perform pg_temp.counted('audit detail contains no choice, source value, filename or extracted text',
    (select count(*) from public.audit_event where action = 'course_source.conflicts_recorded'
      and detail ?| array['choices','choice','filename','text','quote','sourceValue','currentValue','importedValue']), 0);

  recorded := pg_temp.service_call(format($q$select public.record_course_source_conflict_resolution(
    %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key01','corr-resolution-record1')$q$,
    batch, student, current_source, imported_source, repeat('d',64), repeat('e',64), choices));
  perform pg_temp.counted('the same request replays its first result without duplicate evidence',
    ((recorded ->> 'idempotent')::boolean)::int
    + (select count(*) from public.course_source_resolution_batches where id = batch)
    + (select count(*) from public.course_source_operations where resolution_batch_id = batch and action = 'conflicts_recorded'), 3);
  perform pg_temp.refused('the same idempotency key with changed choices', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key01','corr-resolution-record1')$q$,
      batch, student, current_source, imported_source, repeat('d',64), repeat('e',64),
      choices || jsonb_build_object('moved:item-one', 'use_imported')));
  perform pg_temp.refused('the service rewriting an append-only choice directly', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$update public.course_source_resolution_choices set choice = 'use_imported'
      where batch_id = %L and conflict_key = 'moved:item-one'$q$, batch));

  voided := pg_temp.service_call(format($q$select public.void_course_source_conflict_resolution(
    %L,%L,'resolution-void-key0001','corr-resolution-void01')$q$, batch, student));
  perform pg_temp.counted('withdrawal voids the batch but preserves all decision evidence',
    (select count(*) from public.course_source_resolution_batches
      where id = batch and state = 'voided' and voided_by = student and voided_at is not null)
    + (select count(*) from public.course_source_resolution_choices where batch_id = batch), 5);
  perform pg_temp.counted('withdrawal appends its own operation and audit fact',
    (select count(*) from public.course_source_operations where resolution_batch_id = batch and action = 'conflicts_voided')
    + (select count(*) from public.audit_event where action = 'course_source.conflicts_voided'
        and object_sha256 = private.role_audit_sha256(imported_source::text)), 2);
  voided := pg_temp.service_call(format($q$select public.void_course_source_conflict_resolution(
    %L,%L,'resolution-void-key0001','corr-resolution-void01')$q$, batch, student));
  perform pg_temp.counted('the same withdrawal replays without a second transition',
    ((voided ->> 'idempotent')::boolean and (voided ->> 'state') = 'voided')::int
    + (select count(*) from public.course_source_operations where resolution_batch_id = batch and action = 'conflicts_voided'), 2);
  recorded := pg_temp.service_call(format($q$select public.record_course_source_conflict_resolution(
    %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key01','corr-resolution-record1')$q$,
    batch, student, current_source, imported_source, repeat('d',64), repeat('e',64), choices));
  perform pg_temp.counted('a recording replay reports the later void without recreating evidence',
    ((recorded ->> 'idempotent')::boolean and (recorded ->> 'state') = 'voided')::int
    + (select count(*) from public.course_source_resolution_batches where id = batch), 2);

  update public.institution_membership set status = 'suspended' where id = membership;
  perform pg_temp.refused('relationship revocation blocking a new resolution', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.record_course_source_conflict_resolution(
      %L,%L,%L,%L,%L,%L,%L::jsonb,'resolution-record-key05','corr-resolution-record5')$q$,
      gen_random_uuid(), student, current_source, imported_source, repeat('d',64), repeat('e',64), choices));
end $$;

rollback;
