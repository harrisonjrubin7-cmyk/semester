-- Scoped, identity-minimized privacy queue. LOCAL/DISPOSABLE DATABASE ONLY.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  north_student uuid;
  south_student uuid;
  demo_student uuid;
  steward uuid;
  platform_steward uuid;
  console_only uuid;
  data_only uuid;
  expired uuid;
  departing uuid;
  departing_request uuid;
  held_request uuid;
  platform_request uuid;
  n bigint;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('privacy-north', 'Privacy North', array['privacy-north.example'], false),
    ('privacy-south', 'Privacy South', array['privacy-south.example'], false),
    ('privacy-demo', 'Privacy Demo', array['privacy-demo.example'], true);

  north_student := pg_temp.newuser('student@privacy-north.example', 'privacy-north');
  south_student := pg_temp.newuser('student@privacy-south.example', 'privacy-south');
  demo_student := pg_temp.newuser('student@privacy-demo.example', 'privacy-demo');
  steward := pg_temp.newuser('steward@privacy-north.example', 'privacy-north');
  platform_steward := pg_temp.newuser('platform-steward@privacy-north.example', 'privacy-north');
  console_only := pg_temp.newuser('console@privacy-north.example', 'privacy-north');
  data_only := pg_temp.newuser('data@privacy-north.example', 'privacy-north');
  expired := pg_temp.newuser('expired@privacy-north.example', 'privacy-north');
  departing := pg_temp.newuser('departing@privacy-north.example', 'privacy-north');

  insert into public.data_subject_request (
    subject, tenant_id, kind, detail, assigned_to, assigned_at,
    verified_at, verified_by, verification_basis, verification_evidence
  ) values (
    north_student, 'privacy-north', 'correction', 'Historical assigned request.', departing, now(),
    now(), departing, 'signed-in account holder', 'case://departing-1'
  ) returning id into departing_request;
  delete from auth.users where id = departing;
  select count(*) into n from public.data_subject_request
   where id = departing_request and assigned_to is null and assigned_at is null
     and verified_by is null and verified_at is not null
     and verification_basis = 'signed-in account holder'
     and verification_evidence = 'case://departing-1';
  perform pg_temp.counted('deleting a steward clears identity links but preserves verification evidence', n, 1);
  delete from public.data_subject_request where id = departing_request;

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at) values
    (steward, 'data_steward', 'platform', '', 'platform', null),
    (steward, 'data_steward', 'school', 'privacy-north', 'platform', null),
    (steward, 'data_steward', 'school', 'privacy-demo', 'platform', null),
    (platform_steward, 'data_steward', 'platform', '', 'platform', null),
    (console_only, 'platform_admin', 'platform', '', 'platform', null),
    (data_only, 'data_steward', 'school', 'privacy-north', 'platform', null),
    (expired, 'data_steward', 'platform', '', 'platform', now() - interval '1 minute'),
    (expired, 'data_steward', 'school', 'privacy-north', 'platform', now() - interval '1 minute');

  insert into public.data_subject_request (subject, tenant_id, kind, detail)
  values (north_student, 'privacy-north', 'erasure', 'Private deletion details.')
  returning id into held_request;
  insert into public.data_subject_request (subject, tenant_id, kind, detail)
  values (south_student, 'privacy-south', 'correction', 'Private correction details.');
  insert into public.data_subject_request (subject, tenant_id, kind, detail)
  values (demo_student, 'privacy-demo', 'export', 'Private demo details.');
  insert into public.data_subject_request (subject, tenant_id, kind, detail)
  values (north_student, null, 'restriction', 'Platform-scoped request details.')
  returning id into platform_request;
  insert into public.legal_holds
    (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('account', north_student::text, 'privacy-north', 'Preserve for review', 'MAT-100', steward);

  perform pg_temp.become(steward);
  select count(*) into n from public.console_privacy_requests(false);
  reset role;
  perform pg_temp.counted('the queue combines exact-school and platform-scoped requests from live grants', n, 2);

  perform pg_temp.become(platform_steward);
  select count(*) into n from public.console_privacy_requests(false) q
   where q.request_id = platform_request
     and q.tenant_id is null
     and q.tenant_name = 'Platform / unassigned';
  reset role;
  perform pg_temp.counted('a platform-only handler can process the tenantless queue without gaining school requests', n, 1);

  perform pg_temp.become(steward);
  select count(*) into n
    from public.console_privacy_requests(false) q
   where q.request_id = held_request
     and q.request_ref like 'DSR-%'
     and q.identity_state = 'unverified'
     and q.hold_state = 'live_hold'
     and not q.assigned_to_me
     and q.classification = 'restricted'
     and cardinality(q.affected_stores) = 3;
  reset role;
  perform pg_temp.counted('metadata names lifecycle, hold, scope and stores without identity', n, 1);

  if not pg_temp.refused(steward, 'select count(*) from public.console_privacy_requests(true)') then
    raise exception 'FAILED: demo requests were included without tenant:implement';
  end if;
  raise notice 'ok  demo inclusion needs the separate implementation grant';

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (steward, 'implementation_manager', 'school', 'privacy-demo', 'platform');
  perform pg_temp.become(steward);
  select count(*) into n from public.console_privacy_requests(true);
  reset role;
  perform pg_temp.counted('explicit authorized demo inclusion adds only the allowed demo request', n, 3);

  if not pg_temp.refused(console_only, 'select count(*) from public.console_privacy_requests(false)') then
    raise exception 'FAILED: console shell alone opened privacy requests';
  end if;
  if not pg_temp.refused(data_only, 'select count(*) from public.console_privacy_requests(false)') then
    raise exception 'FAILED: data handling alone opened the console queue';
  end if;
  if not pg_temp.refused(expired, 'select count(*) from public.console_privacy_requests(false)') then
    raise exception 'FAILED: expired grants opened the privacy queue';
  end if;
  raise notice 'ok  shell-only, domain-only and expired grants fail closed';

  select count(*) into n
    from unnest(regexp_split_to_array(
      pg_get_function_result('public.console_privacy_requests(boolean)'::regprocedure), ',\\s*'
    )) as col
   where col ~* '(subject|email|handle|detail|resolution|verification_evidence)';
  perform pg_temp.counted('the queue result has no subject identity or request-content column', n, 0);

  raise notice 'privacy case workspace metadata: every check passed';
end $$;

rollback;
