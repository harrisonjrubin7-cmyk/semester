-- supabase/course-source-resolution-apply.check.sql — Atomic, hash-bound
-- course replacement and bounded recovery for an active re-import resolution.

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
  service_actor constant uuid := '12000000-0000-0000-0000-000000000002';
  membership constant uuid := '22000000-0000-0000-0000-000000000001';
  current_source constant uuid := '32000000-0000-0000-0000-000000000001';
  imported_source constant uuid := '32000000-0000-0000-0000-000000000002';
  batch constant uuid := '42000000-0000-0000-0000-000000000001';
  application constant uuid := '52000000-0000-0000-0000-000000000001';
  month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  current_data jsonb := '{
    "course":{"id":"course-apply","code":"ECON 1020","name":"Economics","prof":"Current professor","email":"old@example.edu","meets":"MWF","room":"A1","credits":"3","term":"2026FA","source":"current.pdf","ai":{"stance":"limited","note":"cite it"},"grading":[{"what":"Exams","pct":"60"},{"what":"Participation","pct":"40"}]},
    "items":[
      {"id":"i1","c":"course-apply","title":"Current exam","kind":"Exam","month":9,"day":10,"year":2026,"dueTime":"5 PM","weight":"60%","where":"A1","detail":"Current detail","quote":"Current quote","checked":{"confirmed":true,"page":2,"doc":"current.pdf"},"source":"current.pdf"},
      {"id":"i2","c":"course-apply","title":"Keep removed","kind":"Essay","month":10,"day":1,"year":2026,"dueTime":"Noon","weight":"40%","where":"Online","detail":"Keep me","quote":"Old","source":"current.pdf"}
    ]}'::jsonb;
  imported_data jsonb := '{
    "course":{"id":"course-apply","code":"ECON 1020","name":"Economics","prof":"Imported professor","email":"old@example.edu","meets":"MWF","room":"A1","credits":"3","term":"2026FA","source":"imported.pdf","ai":{"stance":"limited","note":"cite it"},"grading":[{"what":"Exams","pct":"70"},{"what":"Project","pct":"30"}]},
    "items":[
      {"id":"i1","c":"course-apply","title":"Imported exam","kind":"Exam","month":9,"day":12,"year":2026,"dueTime":"5 PM","weight":"60%","where":"A1","detail":"Current detail","quote":"Imported quote","checked":{"confirmed":true,"page":4,"doc":"imported.pdf"},"source":"imported.pdf"},
      {"id":"i3","c":"course-apply","title":"New quiz","kind":"Quiz","month":10,"day":8,"year":2026,"dueTime":"Noon","weight":"0%","where":"Online","detail":"New","quote":"New quote","source":"imported.pdf"}
    ]}'::jsonb;
  applied_data jsonb;
  result jsonb;
begin
  insert into public.schools (id, name, email_domains)
    values ('apply-u', 'Apply University', array['apply.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'student@apply.example', now(), now(), now()),
    (service_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'service@apply.example', now(), now(), now());
  insert into public.institution_membership (id, tenant_id, auth_user_id, status, roles, source)
    values (membership, 'apply-u', student, 'active', array['student'], 'institution_admin');
  insert into public.courses (user_id, id, data) values (student, 'course-apply', current_data);
  insert into public.state (user_id, data) values
    (student, jsonb_build_object('done', jsonb_build_object('i1', true, 'i2', true)));
  insert into public.course_sources (
    id, tenant_id, owner_id, membership_id, course_record_id, course_code, term,
    object_key, filename, declared_content_type, size_bytes, lifecycle_state,
    sha256, detected_content_type, scanner_version, storage_sha256, stored_size_bytes,
    storage_version, stored_at, scan_verdict, scan_settled_at
  ) values
    (current_source, 'apply-u', student, membership, 'course-apply', 'ECON 1020', '2026FA',
      format('t/apply-u/student_private/%s/%s', month, current_source), 'current.pdf',
      'application/pdf', 100, 'available', repeat('a',64), 'application/pdf', 'test-scanner-1',
      repeat('a',64), 100, 'test-object-current', now(), 'clean', now()),
    (imported_source, 'apply-u', student, membership, 'course-apply', 'ECON 1020', '2026FA',
      format('t/apply-u/student_private/%s/%s', month, imported_source), 'imported.pdf',
      'application/pdf', 100, 'available', repeat('b',64), 'application/pdf', 'test-scanner-1',
      repeat('b',64), 100, 'test-object-imported', now(), 'clean', now());
  insert into public.course_source_resolution_batches (
    id, tenant_id, owner_id, membership_id, course_record_id, current_source_id,
    imported_source_id, current_snapshot_sha256, imported_snapshot_sha256, decision_count
  ) values (
    batch, 'apply-u', student, membership, 'course-apply', current_source, imported_source,
    private.role_audit_sha256(current_data::text), private.role_audit_sha256(imported_data::text), 8);
  insert into public.course_source_resolution_choices (batch_id, tenant_id, conflict_key, choice) values
    (batch, 'apply-u', 'moved:i1', 'keep_current'),
    (batch, 'apply-u', 'title:i1', 'use_imported'),
    (batch, 'apply-u', 'provenance:i1', 'keep_current'),
    (batch, 'apply-u', 'removed:i2', 'keep_current'),
    (batch, 'apply-u', 'field:Professor', 'keep_current'),
    (batch, 'apply-u', 'grading:reweighted:Exams', 'use_imported'),
    (batch, 'apply-u', 'grading:removed:Participation', 'keep_current'),
    (batch, 'apply-u', 'grading:added:Project', 'keep_current');

  perform pg_temp.counted('application recovery table has RLS and no browser policy',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'course_source_resolution_applications' and c.relrowsecurity)
    + (select count(*) from pg_policies where schemaname = 'public'
      and tablename = 'course_source_resolution_applications'), 1);
  perform pg_temp.counted('client roles have no application-table privilege',
    (select count(*) from information_schema.role_table_grants where table_schema = 'public'
      and table_name = 'course_source_resolution_applications'
      and grantee in ('anon', 'authenticated')), 0);
  perform pg_temp.refused('a signed-in student calling the service apply command', 'authenticated',
    jsonb_build_object('sub', student, 'role', 'authenticated'),
    format($q$select public.apply_course_source_conflict_resolution(
      %L,%L,%L,%L::jsonb,'resolution-apply-key01','corr-resolution-apply01')$q$,
      application, batch, student, imported_data));

  create function pg_temp.fail_apply_audit() returns trigger language plpgsql as $f$
  begin
    if new.action = 'course_source.conflicts_applied' then raise exception 'audit unavailable'; end if;
    return new;
  end $f$;
  create trigger fail_apply_audit before insert on public.audit_event
    for each row execute function pg_temp.fail_apply_audit();
  perform pg_temp.refused('an apply whose audit append fails', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.apply_course_source_conflict_resolution(
      %L,%L,%L,%L::jsonb,'resolution-apply-key01','corr-resolution-apply01')$q$,
      application, batch, student, imported_data));
  perform pg_temp.counted('audit failure rolls back course, application, batch state and receipt',
    (select count(*) from public.courses where user_id = student and id = 'course-apply' and data = current_data)
    + (select count(*) from public.course_source_resolution_applications where id = application)
    + (select count(*) from public.course_source_resolution_batches where id = batch and state = 'recorded')
    + (select count(*) from public.course_source_operations where idempotency_key = 'resolution-apply-key01'), 2);
  drop trigger fail_apply_audit on public.audit_event;

  perform pg_temp.refused('a hash-stale imported snapshot', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.apply_course_source_conflict_resolution(
      %L,%L,%L,%L::jsonb,'resolution-apply-key02','corr-resolution-apply02')$q$,
      gen_random_uuid(), batch, student, jsonb_set(imported_data, '{course,name}', '"Tampered"'::jsonb)));
  result := pg_temp.service_call(format($q$select public.apply_course_source_conflict_resolution(
    %L,%L,%L,%L::jsonb,'resolution-apply-key01','corr-resolution-apply01')$q$,
    application, batch, student, imported_data));
  select data into applied_data from public.courses where user_id = student and id = 'course-apply';
  if (private.course_source_resolution_item(applied_data->'items','i1')->>'day' <> '10')
     or (private.course_source_resolution_item(applied_data->'items','i1')->>'quote' <> 'Current quote') then
    raise exception 'unexpected resolved i1: %', private.course_source_resolution_item(applied_data->'items','i1');
  end if;

  perform pg_temp.counted('apply consumes the batch and writes one recoverable application',
    (select count(*) from public.course_source_resolution_batches where id = batch and state = 'applied')
    + (select count(*) from public.course_source_resolution_applications where id = application
        and state = 'applied' and previous_data = current_data
        and recovery_until = applied_at + interval '30 days'), 2);
  perform pg_temp.counted('course and item choices are derived without changing stable ids',
    ((applied_data->'course'->>'prof' = 'Current professor')::int)
    + ((private.course_source_resolution_item(applied_data->'items','i1')->>'title' = 'Imported exam')::int)
    + ((private.course_source_resolution_item(applied_data->'items','i1')->>'day' = '10')::int)
    + ((private.course_source_resolution_item(applied_data->'items','i1')->>'quote' = 'Current quote')::int)
    + ((private.course_source_resolution_item(applied_data->'items','i2')->>'title' = 'Keep removed')::int)
    + ((private.course_source_resolution_item(applied_data->'items','i3')->>'title' = 'New quiz')::int), 6);
  perform pg_temp.counted('grading choices keep only the approved rows and values',
    (select count(*) from jsonb_array_elements(applied_data->'course'->'grading') r
      where (r->>'what' = 'Exams' and r->>'pct' = '70')
         or (r->>'what' = 'Participation' and r->>'pct' = '40'))
    + (select count(*) from jsonb_array_elements(applied_data->'course'->'grading') r
      where r->>'what' = 'Project'), 2);
  perform pg_temp.counted('completion ticks remain outside and untouched by course replacement',
    (select count(*) from public.state where user_id = student
      and data->'done' = '{"i1":true,"i2":true}'::jsonb), 1);
  perform pg_temp.counted('apply appends one operation and one content-free audit fact',
    (select count(*) from public.course_source_operations where resolution_application_id = application
      and action = 'conflicts_applied')
    + (select count(*) from public.audit_event where action = 'course_source.conflicts_applied'
      and object_sha256 = private.role_audit_sha256(imported_source::text)), 2);
  result := pg_temp.service_call(format($q$select public.apply_course_source_conflict_resolution(
    %L,%L,%L,%L::jsonb,'resolution-apply-key01','corr-resolution-apply01')$q$,
    application, batch, student, imported_data));
  perform pg_temp.counted('the same apply request replays without another write',
    ((result->>'idempotent')::boolean)::int
    + (select count(*) from public.course_source_resolution_applications where id = application)
    + (select count(*) from public.course_source_operations where resolution_application_id = application
      and action = 'conflicts_applied'), 3);

  update public.courses set data = jsonb_set(applied_data, '{course,name}', '"Later edit"'::jsonb)
    where user_id = student and id = 'course-apply';
  perform pg_temp.refused('rollback after a later course edit', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.rollback_course_source_conflict_resolution(
      %L,%L,'resolution-rollback01','corr-resolution-back001')$q$, application, student));
  update public.courses set data = applied_data where user_id = student and id = 'course-apply';
  result := pg_temp.service_call(format($q$select public.rollback_course_source_conflict_resolution(
    %L,%L,'resolution-rollback01','corr-resolution-back001')$q$, application, student));
  perform pg_temp.counted('rollback restores the exact course and clears the recovery copy',
    (select count(*) from public.courses where user_id = student and id = 'course-apply' and data = current_data)
    + (select count(*) from public.course_source_resolution_applications where id = application
      and state = 'rolled_back' and previous_data is null and rolled_back_by = student)
    + (select count(*) from public.course_source_resolution_batches where id = batch and state = 'rolled_back'), 3);
  perform pg_temp.counted('rollback preserves completion ticks and appends bounded evidence',
    (select count(*) from public.state where user_id = student
      and data->'done' = '{"i1":true,"i2":true}'::jsonb)
    + (select count(*) from public.course_source_operations where resolution_application_id = application
      and action = 'conflicts_rolled_back')
    + (select count(*) from public.audit_event where action = 'course_source.conflicts_rolled_back'
      and object_sha256 = private.role_audit_sha256(imported_source::text)), 3);
  result := pg_temp.service_call(format($q$select public.rollback_course_source_conflict_resolution(
    %L,%L,'resolution-rollback01','corr-resolution-back001')$q$, application, student));
  perform pg_temp.counted('the same rollback replays without another transition',
    ((result->>'idempotent')::boolean)::int
    + (select count(*) from public.course_source_operations where resolution_application_id = application
      and action = 'conflicts_rolled_back'), 2);
  result := pg_temp.service_call(format($q$select public.apply_course_source_conflict_resolution(
    %L,%L,%L,%L::jsonb,'resolution-apply-key01','corr-resolution-apply01')$q$,
    application, batch, student, imported_data));
  perform pg_temp.counted('an apply replay reports the later rolled-back state honestly',
    ((result->>'idempotent')::boolean and result->>'state' = 'rolled_back')::int
    + (select count(*) from public.course_source_resolution_applications where id = application), 2);
end $$;

rollback;
