-- supabase/course-source-persistence.check.sql — Private, tenant-bound
-- course-source metadata, correction and recovery proof.

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
  student constant uuid := '10000000-0000-0000-0000-000000000001';
  other constant uuid := '10000000-0000-0000-0000-000000000002';
  membership constant uuid := '20000000-0000-0000-0000-000000000001';
  other_membership constant uuid := '20000000-0000-0000-0000-000000000002';
  source constant uuid := '30000000-0000-0000-0000-000000000001';
  other_source constant uuid := '30000000-0000-0000-0000-000000000002';
  correction1 constant uuid := '40000000-0000-0000-0000-000000000001';
  correction2 constant uuid := '40000000-0000-0000-0000-000000000002';
  month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  planned jsonb;
  corrected jsonb;
  deleted jsonb;
  restored jsonb;
  before_state text;
begin
  insert into public.schools (id, name, email_domains) values
    ('source-u', 'Source University', array['source.example']),
    ('source-other', 'Other Source University', array['other-source.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@source.example', now(), now(), now()),
    (other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@other-source.example', now(), now(), now());
  insert into public.institution_membership (id, tenant_id, auth_user_id, status, roles, source) values
    (membership, 'source-u', student, 'active', array['student'], 'institution_admin'),
    (other_membership, 'source-other', other, 'active', array['student'], 'institution_admin');
  insert into public.courses (user_id, id, data) values
    (student, 'course-one', '{}'::jsonb),
    (other, 'course-other', '{}'::jsonb);

  perform pg_temp.counted('all three persistence tables have RLS enabled',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in
        ('course_sources', 'course_source_corrections', 'course_source_operations') and c.relrowsecurity), 3);
  perform pg_temp.counted('no client policy exists on private course-source metadata',
    (select count(*) from pg_policies where schemaname = 'public' and tablename in
      ('course_sources', 'course_source_corrections', 'course_source_operations')), 0);
  perform pg_temp.counted('client roles have no course-source table privilege',
    (select count(*) from information_schema.role_table_grants where table_schema = 'public'
      and table_name in ('course_sources', 'course_source_corrections', 'course_source_operations')
      and grantee in ('anon', 'authenticated')), 0);

  perform pg_temp.refused('a signed-in student calling the service persistence function', 'authenticated',
    jsonb_build_object('sub', student, 'role', 'authenticated'),
    format($q$select public.persist_student_course_source(%L,%L,'source-u',%L,'course-one','ECON 1020','2026FA',
      't/source-u/student_private/%s/%s','syllabus.pdf','application/pdf',100,'student-source-key-0001','corr-source-0001')$q$,
      source, student, membership, month, source));
  perform pg_temp.refused('a service binding the student to another tenant membership', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.persist_student_course_source(%L,%L,'source-u',%L,'course-one','ECON 1020','2026FA',
      't/source-u/student_private/%s/%s','syllabus.pdf','application/pdf',100,'student-source-key-0002','corr-source-0002')$q$,
      other_source, student, other_membership, month, other_source));

  planned := pg_temp.service_call(format($q$select public.persist_student_course_source(%L,%L,'source-u',%L,'course-one',
    ' econ  1020 ','2026FA','t/source-u/student_private/%s/%s','syllabus.pdf','application/pdf',100,
    'student-source-key-0001','corr-source-0001')$q$, source, student, membership, month, source));
  perform pg_temp.counted('a current course row plus exact active membership persists one source',
    (select count(*) from public.course_sources where id = source and tenant_id = 'source-u'
      and owner_id = student and membership_id = membership and course_record_id = 'course-one'
      and course_code = 'ECON 1020' and lifecycle_state = 'pending_upload'), 1);
  perform pg_temp.counted('the first persistence result is not an idempotent replay',
    ((planned ->> 'idempotent')::boolean = false)::int, 1);
  perform pg_temp.counted('planning appends one bounded operation and one audit fact',
    (select count(*) from public.course_source_operations where source_id = source and action = 'upload_planned')
    + (select count(*) from public.audit_event where action = 'course_source.upload_planned'
        and object_sha256 = private.role_audit_sha256(source::text)), 2);
  perform pg_temp.counted('audit detail has no filename, object key, hash or extracted content',
    (select count(*) from public.audit_event where action = 'course_source.upload_planned'
      and detail ?| array['filename','objectKey','sha256','excerpt','text','priorValue','correctedValue']), 0);

  planned := pg_temp.service_call(format($q$select public.persist_student_course_source(%L,%L,'source-u',%L,'course-one',
    'ECON 1020','2026FA','t/source-u/student_private/%s/%s','syllabus.pdf','application/pdf',100,
    'student-source-key-0001','corr-source-0001')$q$, source, student, membership, month, source));
  perform pg_temp.counted('the same persistence request replays its first result',
    ((planned ->> 'idempotent')::boolean = true)::int, 1);
  perform pg_temp.counted('the replay writes no duplicate source, operation or audit',
    (select count(*) from public.course_sources where id = source)
    + (select count(*) from public.course_source_operations where source_id = source)
    + (select count(*) from public.audit_event where action = 'course_source.upload_planned'
        and object_sha256 = private.role_audit_sha256(source::text)), 3);
  perform pg_temp.refused('the same idempotency key with a changed size', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.persist_student_course_source(%L,%L,'source-u',%L,'course-one','ECON 1020','2026FA',
      't/source-u/student_private/%s/%s','syllabus.pdf','application/pdf',101,
      'student-source-key-0001','corr-source-0001')$q$, source, student, membership, month, source));

  -- Scan settlement belongs to the next storage/scanner slice. Seed the exact
  -- state it will atomically produce so correction persistence can be proved.
  update public.course_sources set lifecycle_state = 'available',
    sha256 = repeat('a', 64), detected_content_type = declared_content_type, scanner_version = 'test-scanner-1'
   where id = source;
  corrected := pg_temp.service_call(format($q$select public.confirm_course_source_correction(
    %L,%L,%L,'assignment-1','dueDate',%L,%L,'student-correct-key-01','corr-correct-0001')$q$,
    correction1, source, student, repeat('b',64), repeat('c',64)));
  perform pg_temp.counted('the first correction is revision one over the immutable source hash',
    (select count(*) from public.course_source_corrections where id = correction1 and source_id = source
      and source_sha256 = repeat('a',64) and revision = 1 and previous_correction_id is null), 1);
  perform pg_temp.counted('the correction result names revision one', ((corrected ->> 'revision')::int = 1)::int, 1);

  corrected := pg_temp.service_call(format($q$select public.confirm_course_source_correction(
    %L,%L,%L,'assignment-1','dueDate',%L,%L,'student-correct-key-02','corr-correct-0002')$q$,
    correction2, source, student, repeat('c',64), repeat('d',64)));
  perform pg_temp.counted('the next correction hash-links to the prior revision',
    (select count(*) from public.course_source_corrections where id = correction2 and revision = 2
      and previous_correction_id = correction1 and prior_value_sha256 = repeat('c',64)), 1);
  perform pg_temp.refused('a correction based on an older derived revision', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.confirm_course_source_correction(
      %L,%L,%L,'assignment-1','dueDate',%L,%L,'student-correct-key-03','corr-correct-0003')$q$,
      gen_random_uuid(), source, student, repeat('b',64), repeat('e',64)));
  perform pg_temp.refused('another tenant account correcting the source', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.confirm_course_source_correction(
      %L,%L,%L,'assignment-1','dueDate',%L,%L,'other-correct-key-01','corr-correct-0004')$q$,
      gen_random_uuid(), source, other, repeat('d',64), repeat('e',64)));

  deleted := pg_temp.service_call(format($q$select public.change_course_source_recovery_state(
    %L,%L,'delete','student-delete-key-001','corr-delete-0001')$q$, source, student));
  perform pg_temp.counted('deletion keeps metadata in an exact 30-day recovery window',
    (select count(*) from public.course_sources where id = source and lifecycle_state = 'deleted'
      and pre_delete_state = 'available' and recovery_until = deleted_at + interval '30 days'), 1);
  restored := pg_temp.service_call(format($q$select public.change_course_source_recovery_state(
    %L,%L,'restore','student-restore-key-01','corr-restore-0001')$q$, source, student));
  perform pg_temp.counted('recovery restores the prior state and clears deletion markers',
    (select count(*) from public.course_sources where id = source and lifecycle_state = 'available'
      and deleted_at is null and recovery_until is null and pre_delete_state is null), 1);
  perform pg_temp.counted('the restore result reports available', ((restored ->> 'state') = 'available')::int, 1);
  deleted := pg_temp.service_call(format($q$select public.change_course_source_recovery_state(
    %L,%L,'delete','student-delete-key-001','corr-delete-0001')$q$, source, student));
  perform pg_temp.counted('a deletion replay returns its original deleted result after a later restore',
    ((deleted ->> 'state') = 'deleted' and (deleted ->> 'idempotent')::boolean)::int, 1);
  perform pg_temp.counted('that historical replay does not delete the restored source again',
    (select count(*) from public.course_sources where id = source and lifecycle_state = 'available'), 1);

  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant', 'source-u', 'source-u', 'Preserve course-source evidence', 'matter-source-1', other);
  perform pg_temp.refused('a legal hold blocking source deletion', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.change_course_source_recovery_state(
      %L,%L,'delete','student-delete-key-002','corr-delete-0002')$q$, source, student));
  perform pg_temp.counted('the held refusal leaves the source available and writes no operation',
    (select count(*) from public.course_sources where id = source and lifecycle_state = 'available')
    + (select count(*) from public.course_source_operations where idempotency_key = 'student-delete-key-002'), 1);
  update public.legal_holds set released_by = student, release_reason = 'Matter closed'
   where subject_kind = 'tenant' and subject_id = 'source-u';

  -- Audit append is after the state change inside one transaction. A failed
  -- append must therefore roll the state change back.
  create function pg_temp.fail_source_audit() returns trigger language plpgsql as $f$
  begin
    if new.action = 'course_source.deletion_requested' then raise exception 'audit unavailable'; end if;
    return new;
  end $f$;
  create trigger fail_source_audit before insert on public.audit_event
    for each row execute function pg_temp.fail_source_audit();
  select lifecycle_state into before_state from public.course_sources where id = source;
  perform pg_temp.refused('a deletion whose audit append fails', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.change_course_source_recovery_state(
      %L,%L,'delete','student-delete-key-003','corr-delete-0003')$q$, source, student));
  perform pg_temp.counted('audit failure rolls back source state and idempotency',
    (select count(*) from public.course_sources where id = source and lifecycle_state = before_state)
    + (select count(*) from public.course_source_operations where idempotency_key = 'student-delete-key-003'), 1);
  drop trigger fail_source_audit on public.audit_event;

  update public.institution_membership set status = 'suspended' where id = membership;
  perform pg_temp.refused('relationship revocation blocking a later correction', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.confirm_course_source_correction(
      %L,%L,%L,'assignment-2','title',%L,%L,'student-correct-key-04','corr-correct-0005')$q$,
      gen_random_uuid(), source, student, repeat('1',64), repeat('2',64)));
  perform pg_temp.refused('relationship revocation blocking deletion', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.change_course_source_recovery_state(
      %L,%L,'delete','student-delete-key-004','corr-delete-0004')$q$, source, student));

  perform pg_temp.refused('a client directly inserting metadata', 'authenticated',
    jsonb_build_object('sub', student, 'role', 'authenticated'),
    format($q$insert into public.course_sources
      (id,tenant_id,owner_id,membership_id,course_record_id,course_code,term,object_key,filename,declared_content_type,size_bytes)
      values (%L,'source-u',%L,%L,'course-one','ECON 1020','2026FA',
      't/source-u/student_private/%s/%s','x.pdf','application/pdf',1)$q$,
      other_source, student, membership, month, other_source));
  perform pg_temp.refused('the service role bypassing the controlled write with a direct insert', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$insert into public.course_sources
      (id,tenant_id,owner_id,membership_id,course_record_id,course_code,term,object_key,filename,declared_content_type,size_bytes)
      values (%L,'source-u',%L,%L,'course-one','ECON 1020','2026FA',
      't/source-u/student_private/%s/%s','x.pdf','application/pdf',1)$q$,
      other_source, student, membership, month, other_source));
end $$;

rollback;
