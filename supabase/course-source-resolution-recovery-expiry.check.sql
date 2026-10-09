-- Hold-aware expiry for unused course re-import recovery copies.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.

begin;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
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

create or replace function pg_temp.service_error(statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.service_call(statement);
  return null;
exception when others then
  return sqlerrm;
end $$;

do $$
declare
  student constant uuid := '13000000-0000-0000-0000-000000000001';
  releaser constant uuid := '13000000-0000-0000-0000-000000000002';
  membership constant uuid := '23000000-0000-0000-0000-000000000001';
  current_source constant uuid := '33000000-0000-0000-0000-000000000001';
  imported_source constant uuid := '33000000-0000-0000-0000-000000000002';
  old_batch constant uuid := '43000000-0000-0000-0000-000000000001';
  young_batch constant uuid := '43000000-0000-0000-0000-000000000002';
  held_batch constant uuid := '43000000-0000-0000-0000-000000000003';
  old_application constant uuid := '53000000-0000-0000-0000-000000000001';
  young_application constant uuid := '53000000-0000-0000-0000-000000000002';
  held_application constant uuid := '53000000-0000-0000-0000-000000000003';
  old_applied timestamptz := now() - interval '31 days';
  young_applied timestamptz := now() - interval '29 days';
  month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  said jsonb;
begin
  insert into public.schools (id, name, email_domains)
  values ('expiry-u', 'Expiry University', array['expiry.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'student@expiry.example', now(), now(), now()),
    (releaser, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'releaser@expiry.example', now(), now(), now());
  insert into public.institution_membership (id, tenant_id, auth_user_id, status, roles, source)
  values (membership, 'expiry-u', student, 'active', array['student'], 'institution_admin');
  insert into public.course_sources (
    id, tenant_id, owner_id, membership_id, course_record_id, course_code, term,
    object_key, filename, declared_content_type, size_bytes, lifecycle_state,
    sha256, detected_content_type, scanner_version, storage_sha256,
    stored_size_bytes, storage_version, stored_at, scan_verdict, scan_settled_at
  ) values
    (current_source, 'expiry-u', student, membership, 'course-expiry', 'ECON 1030', '2026FA',
      format('t/expiry-u/student_private/%s/%s', month, current_source), 'current.pdf',
      'application/pdf', 100, 'available', repeat('a', 64), 'application/pdf', 'test-scanner-1',
      repeat('a', 64), 100, 'test-current', now(), 'clean', now()),
    (imported_source, 'expiry-u', student, membership, 'course-expiry', 'ECON 1030', '2026FA',
      format('t/expiry-u/student_private/%s/%s', month, imported_source), 'imported.pdf',
      'application/pdf', 100, 'available', repeat('b', 64), 'application/pdf', 'test-scanner-1',
      repeat('b', 64), 100, 'test-imported', now(), 'clean', now());
  insert into public.course_source_resolution_batches (
    id, tenant_id, owner_id, membership_id, course_record_id, current_source_id,
    imported_source_id, current_snapshot_sha256, imported_snapshot_sha256,
    decision_count, state
  ) values
    (old_batch, 'expiry-u', student, membership, 'course-expiry', current_source,
      imported_source, repeat('c', 64), repeat('d', 64), 1, 'applied'),
    (young_batch, 'expiry-u', student, membership, 'course-expiry', current_source,
      imported_source, repeat('e', 64), repeat('f', 64), 1, 'applied'),
    (held_batch, 'expiry-u', student, membership, 'course-expiry', current_source,
      imported_source, repeat('1', 64), repeat('2', 64), 1, 'applied');
  insert into public.course_source_resolution_applications (
    id, batch_id, tenant_id, owner_id, course_record_id, previous_data,
    previous_sha256, applied_sha256, applied_at, recovery_until
  ) values
    (old_application, old_batch, 'expiry-u', student, 'course-expiry', '{"old":1}',
      repeat('3', 64), repeat('4', 64), old_applied, old_applied + interval '30 days'),
    (young_application, young_batch, 'expiry-u', student, 'course-expiry', '{"young":1}',
      repeat('5', 64), repeat('6', 64), young_applied, young_applied + interval '30 days'),
    (held_application, held_batch, 'expiry-u', student, 'course-expiry', '{"held":1}',
      repeat('7', 64), repeat('8', 64), old_applied, old_applied + interval '30 days');

  -- Keep the third row temporarily young so the first pass proves both an
  -- elapsed clear copy and the exact 30-day boundary without a hold.
  update public.course_source_resolution_applications
     set applied_at = young_applied, recovery_until = young_applied + interval '30 days'
   where id = held_application;
  said := pg_temp.service_call('select private.prune_course_source_resolution_recovery()');
  perform pg_temp.must('only an elapsed recovery copy is scrubbed',
    said = jsonb_build_object('recovery_copies_expired', 1)
    and exists (select 1 from public.course_source_resolution_applications
      where id = old_application and state = 'expired' and previous_data is null and expired_at is not null)
    and exists (select 1 from public.course_source_resolution_applications
      where id = young_application and state = 'applied' and previous_data is not null)
    and exists (select 1 from public.course_source_resolution_applications
      where id = held_application and state = 'applied' and previous_data is not null));
  perform pg_temp.must('an expired copy cannot be rolled back',
    pg_temp.service_error(format($q$select public.rollback_course_source_conflict_resolution(
      %L,%L,'expiry-rollback-key01','corr-expiry-rollback1')$q$,
      old_application, student)) like '%not recoverable%');

  update public.course_source_resolution_applications
     set applied_at = old_applied, recovery_until = old_applied + interval '30 days'
   where id = held_application;
  insert into public.legal_holds
    (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('account', student::text, 'expiry-u', 'Preserve recovery evidence.',
    'COURSE-RECOVERY-ACCOUNT', student);
  said := pg_temp.service_call('select private.prune_course_source_resolution_recovery()');
  perform pg_temp.must('an account hold preserves the elapsed copy',
    said = jsonb_build_object('recovery_copies_expired', 0)
    and exists (select 1 from public.course_source_resolution_applications
      where id = held_application and state = 'applied' and previous_data is not null));

  update public.legal_holds set released_by = releaser, release_reason = 'Account matter closed'
   where matter_ref = 'COURSE-RECOVERY-ACCOUNT';
  insert into public.legal_holds
    (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant', 'expiry-u', 'expiry-u', 'Preserve tenant recovery evidence.',
    'COURSE-RECOVERY-TENANT', student);
  said := pg_temp.service_call('select private.prune_course_source_resolution_recovery()');
  perform pg_temp.must('a tenant hold preserves the elapsed copy',
    said = jsonb_build_object('recovery_copies_expired', 0)
    and exists (select 1 from public.course_source_resolution_applications
      where id = held_application and state = 'applied' and previous_data is not null));

  update public.legal_holds set released_by = releaser, release_reason = 'Tenant matter closed'
   where matter_ref = 'COURSE-RECOVERY-TENANT';
  insert into public.legal_holds
    (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('platform', '', null, 'Preserve all recovery evidence.',
    'COURSE-RECOVERY-PLATFORM', student);
  said := pg_temp.service_call('select private.prune_course_source_resolution_recovery()');
  perform pg_temp.must('a platform hold visibly skips the whole operation',
    said = jsonb_build_object('skipped', 'legal_hold')
    and exists (select 1 from public.course_source_resolution_applications
      where id = held_application and state = 'applied' and previous_data is not null));

  update public.legal_holds set released_by = releaser, release_reason = 'Platform matter closed'
   where matter_ref = 'COURSE-RECOVERY-PLATFORM';
  said := pg_temp.service_call('select private.prune_course_source_resolution_recovery()');
  perform pg_temp.must('released holds allow expiry and preserve the evidence row',
    said = jsonb_build_object('recovery_copies_expired', 1)
    and exists (select 1 from public.course_source_resolution_applications
      where id = held_application and state = 'expired' and previous_data is null and expired_at is not null)
    and exists (select 1 from public.course_source_resolution_batches
      where id = held_batch and state = 'applied'));
  said := pg_temp.service_call('select private.prune_course_source_resolution_recovery()');
  perform pg_temp.must('expiry is idempotent',
    said = jsonb_build_object('recovery_copies_expired', 0));

  perform pg_temp.must('client roles cannot run recovery expiry',
    not has_function_privilege('anon', 'private.prune_course_source_resolution_recovery()', 'execute')
    and not has_function_privilege('authenticated', 'private.prune_course_source_resolution_recovery()', 'execute'));
  perform pg_temp.must('the service role can run recovery expiry manually',
    has_function_privilege('service_role', 'private.prune_course_source_resolution_recovery()', 'execute'));
end $$;

rollback;
