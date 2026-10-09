-- supabase/course-material-metadata.check.sql — shared course-material metadata,
-- exact policy/grant binding, lifecycle, idempotency and audit rollback proof.

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
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
  faculty constant uuid := '71000000-0000-0000-0000-000000000001';
  other constant uuid := '71000000-0000-0000-0000-000000000002';
  revoked constant uuid := '71000000-0000-0000-0000-000000000003';
  material constant uuid := '72000000-0000-0000-0000-000000000001';
  other_material constant uuid := '72000000-0000-0000-0000-000000000002';
  policy1 constant uuid := '73000000-0000-0000-0000-000000000001';
  policy2 constant uuid := '73000000-0000-0000-0000-000000000002';
  policy3 constant uuid := '73000000-0000-0000-0000-000000000003';
  month text := to_char(now() at time zone 'UTC', 'YYYY-MM');
  planned jsonb;
  changed jsonb;
begin
  insert into public.schools (id, name, email_domains) values
    ('material-u', 'Material University', array['material.example']),
    ('material-other', 'Other Material University', array['other-material.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (faculty, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'faculty@material.example', now(), now(), now()),
    (other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@other-material.example', now(), now(), now()),
    (revoked, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revoked@material.example', now(), now(), now());
  insert into public.profiles (user_id, handle, school_id) values
    (faculty, 'material_faculty', 'material-u'),
    (other, 'other_material_faculty', 'material-other'),
    (revoked, 'revoked_material_faculty', 'material-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (faculty, 'faculty', 'course', 'material-u/ECON 1020', 'institution'),
    (other, 'faculty', 'course', 'material-other/ECON 1020', 'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (revoked, 'faculty', 'course', 'material-u/ECON 1020', 'institution', now());
  insert into private.course_material_retention_policy
    (id, tenant_id, version, state, days_after_withdrawal, approval_request_id,
     evidence_ref, correlation_id, recorded_by, effective_at)
  values (policy1, 'material-u', 1, 'active', 90, gen_random_uuid(),
    'MAT-1001', 'corr-material-policy-1', faculty, now() - interval '1 minute');

  perform pg_temp.counted('both metadata tables have RLS enabled',
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname in ('course_materials','course_material_operations')
        and c.relrowsecurity), 2);
  perform pg_temp.counted('shared metadata has no client policy',
    (select count(*) from pg_policies where schemaname = 'public'
      and tablename in ('course_materials','course_material_operations')), 0);
  perform pg_temp.counted('client roles have no shared metadata privilege',
    (select count(*) from information_schema.role_table_grants where table_schema = 'public'
      and table_name in ('course_materials','course_material_operations')
      and grantee in ('anon','authenticated')), 0);
  perform pg_temp.refused('a signed-in publisher calling the service function', 'authenticated',
    jsonb_build_object('sub', faculty, 'role', 'authenticated'),
    format($q$select public.persist_course_material(%L,%L,'material-u','ECON 1020','2026FA',%L,1,
      't/material-u/internal/%s/%s','syllabus.pdf','application/pdf',100,
      'material-plan-idem-0001','corr-material-plan-1')$q$, material, faculty, policy1, month, material));
  perform pg_temp.refused('a publisher from another tenant', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.persist_course_material(%L,%L,'material-u','ECON 1020','2026FA',%L,1,
      't/material-u/internal/%s/%s','syllabus.pdf','application/pdf',100,
      'material-plan-idem-0002','corr-material-plan-2')$q$, other_material, other, policy1, month, other_material));
  perform pg_temp.refused('a revoked exact-course grant', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.persist_course_material(%L,%L,'material-u','ECON 1020','2026FA',%L,1,
      't/material-u/internal/%s/%s','syllabus.pdf','application/pdf',100,
      'material-plan-idem-0003','corr-material-plan-3')$q$, other_material, revoked, policy1, month, other_material));
  perform pg_temp.refused('a stale policy version supplied by the service', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.persist_course_material(%L,%L,'material-u','ECON 1020','2026FA',%L,2,
      't/material-u/internal/%s/%s','syllabus.pdf','application/pdf',100,
      'material-plan-idem-0004','corr-material-plan-4')$q$, other_material, faculty, policy1, month, other_material));

  planned := pg_temp.service_call(format($q$select public.persist_course_material(
    %L,%L,'material-u',' econ  1020 ','2026FA',%L,1,
    't/material-u/internal/%s/%s','syllabus.pdf','application/pdf',100,
    'material-plan-idem-0001','corr-material-plan-1')$q$,
    material, faculty, policy1, month, material));
  perform pg_temp.counted('a current exact grant and policy persist one bounded plan',
    (select count(*) from public.course_materials where id = material
      and tenant_id = 'material-u' and course_code = 'ECON 1020' and term = '2026FA'
      and lifecycle_state = 'pending_upload' and retention_policy_id = policy1
      and retention_policy_version = 1 and days_after_withdrawal = 90), 1);
  perform pg_temp.counted('the plan records one operation and content-free audit fact',
    (select count(*) from public.course_material_operations where material_id = material and action = 'upload_planned')
    + (select count(*) from public.audit_event where action = 'course_material.upload_planned'
        and object_sha256 = private.role_audit_sha256(material::text)), 2);
  perform pg_temp.counted('audit detail excludes filename, object key and retention identifiers',
    (select count(*) from public.audit_event where action = 'course_material.upload_planned'
      and detail ?| array['filename','objectKey','policyId','policyVersion','sha256','text','excerpt']), 0);
  perform pg_temp.counted('the result returns the exact bound policy',
    (((planned ->> 'policyId')::uuid = policy1 and (planned ->> 'policyVersion')::int = 1)::int), 1);

  planned := pg_temp.service_call(format($q$select public.persist_course_material(
    %L,%L,'material-u','ECON 1020','2026FA',%L,1,
    't/material-u/internal/%s/%s','syllabus.pdf','application/pdf',100,
    'material-plan-idem-0001','corr-material-plan-1')$q$,
    material, faculty, policy1, month, material));
  perform pg_temp.counted('the exact plan replay is idempotent', ((planned ->> 'idempotent')::boolean)::int, 1);
  perform pg_temp.refused('an idempotency key reused for changed size', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.persist_course_material(%L,%L,'material-u','ECON 1020','2026FA',%L,1,
      't/material-u/internal/%s/%s','syllabus.pdf','application/pdf',101,
      'material-plan-idem-0001','corr-material-plan-1')$q$, material, faculty, policy1, month, material));

  insert into private.course_material_retention_policy
    (id, tenant_id, version, state, days_after_withdrawal, approval_request_id,
     evidence_ref, correlation_id, recorded_by, effective_at)
  values (policy2, 'material-u', 2, 'withdrawn', null, gen_random_uuid(),
    'MAT-1002', 'corr-material-policy-2', faculty, now());
  perform pg_temp.refused('policy withdrawal closing new intake', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.persist_course_material(%L,%L,'material-u','ECON 1020','2026FA',%L,1,
      't/material-u/internal/%s/%s','reading.pdf','application/pdf',100,
      'material-plan-idem-0005','corr-material-plan-5')$q$, other_material, faculty, policy1, month, other_material));
  perform pg_temp.counted('withdrawal does not rewrite an already-bound material policy',
    (select count(*) from public.course_materials where id = material
      and retention_policy_id = policy1 and retention_policy_version = 1 and days_after_withdrawal = 90), 1);

  changed := pg_temp.service_call(format($q$select public.change_course_material_state(
    %L,%L,'withdraw','material-withdraw-idem-1','corr-material-withdraw')$q$, material, faculty));
  perform pg_temp.counted('a current publisher may withdraw metadata without deleting history',
    (select count(*) from public.course_materials where id = material
      and lifecycle_state = 'withdrawn' and withdrawn_at is not null)
    + (select count(*) from public.course_material_operations where material_id = material and action = 'withdrawn'), 2);
  perform pg_temp.refused('policy withdrawal blocking restore', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.change_course_material_state(%L,%L,'restore',
      'material-restore-key-01','corr-material-restore')$q$, material, faculty));

  insert into private.course_material_retention_policy
    (id, tenant_id, version, state, days_after_withdrawal, approval_request_id,
     evidence_ref, correlation_id, recorded_by, effective_at)
  values (policy3, 'material-u', 3, 'active', 180, gen_random_uuid(),
    'MAT-1003', 'corr-material-policy-3', faculty, now());
  changed := pg_temp.service_call(format($q$select public.change_course_material_state(
    %L,%L,'restore','material-restore-key-01','corr-material-restore')$q$, material, faculty));
  perform pg_temp.counted('restore under a newly active policy preserves the original binding',
    (select count(*) from public.course_materials where id = material
      and lifecycle_state = 'pending_upload' and retention_policy_id = policy1
      and retention_policy_version = 1 and days_after_withdrawal = 90), 1);
  perform pg_temp.counted('restore reports the recorded policy rather than the newer one',
    (((changed ->> 'policyId')::uuid = policy1 and (changed ->> 'policyVersion')::int = 1)::int), 1);

  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant', 'material-u', 'material-u', 'Preserve course material metadata', 'matter-material-1', other);
  begin
    delete from public.course_materials where id = material;
    raise exception 'FAILED: course-material metadata was physically deleted';
  exception when sqlstate '42501' then
    raise notice 'ok  metadata cannot be physically deleted while a future hold-aware purge is absent';
  end;
  perform pg_temp.counted('the held material and its policy binding remain',
    (select count(*) from public.course_materials where id = material and retention_policy_id = policy1), 1);

  create function pg_temp.fail_material_audit() returns trigger language plpgsql as $f$
  begin
    if new.action = 'course_material.withdrawn' then raise exception 'audit unavailable'; end if;
    return new;
  end $f$;
  create trigger fail_material_audit before insert on public.audit_event
    for each row execute function pg_temp.fail_material_audit();
  perform pg_temp.refused('a lifecycle transition whose audit append fails', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$select public.change_course_material_state(%L,%L,'withdraw',
      'material-withdraw-idem-2','corr-material-withdraw-2')$q$, material, faculty));
  perform pg_temp.counted('audit failure rolls state and operation back',
    (select count(*) from public.course_materials where id = material and lifecycle_state = 'pending_upload')
    + (select count(*) from public.course_material_operations where idempotency_key = 'material-withdraw-idem-2'), 1);
  drop trigger fail_material_audit on public.audit_event;

  perform pg_temp.refused('the service role bypassing controlled metadata insertion', 'service_role',
    jsonb_build_object('role', 'service_role'),
    format($q$insert into public.course_materials
      (id,tenant_id,course_code,term,publisher_sha256,object_key,filename,declared_content_type,size_bytes,
       retention_policy_id,retention_policy_version,days_after_withdrawal)
      values (%L,'material-u','ECON 1020','2026FA',%L,
      't/material-u/internal/%s/%s','x.pdf','application/pdf',1,%L,3,180)$q$,
      other_material, repeat('a',64), month, other_material, policy3));
end $$;

rollback;
