-- Guardian projection foundation: relationship + consent + projection.
-- LOCAL/DISPOSABLE DATABASES ONLY. Run with:
--   supabase/check.sh guardian-projection

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  insert into public.profiles (user_id, handle) values (who, split_part(address, '@', 1));
  update public.profiles set school_id = school where user_id = who;
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
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
  staff uuid;
  student uuid;
  other_student uuid;
  guardian uuid;
  other_guardian uuid;
  stranger uuid;
  link uuid;
  grant_id uuid;
  unaccepted_grant uuid;
  projection uuid;
  n bigint;
  got text;
begin
  insert into public.schools (id, name, email_domains, edition) values
    ('projection-k12-check', 'Projection Check School', array['projection-check.example'], 'k12'),
    ('other-projection-k12-check', 'Other Projection Check School', array['other-projection-check.example'], 'k12');

  staff          := pg_temp.newuser('office@projection-check.example', 'projection-k12-check');
  student        := pg_temp.newuser('student@projection-check.example', 'projection-k12-check');
  other_student  := pg_temp.newuser('student@other-projection-check.example', 'other-projection-k12-check');
  guardian       := pg_temp.newuser('guardian@home.example', null);
  other_guardian := pg_temp.newuser('other-guardian@home.example', null);
  stranger       := pg_temp.newuser('stranger@home.example', null);

  update private.account_ages
     set minor_until = current_date + 400
   where user_id in (student, other_student);
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
  values (staff, 'university_staff', 'school', 'projection-k12-check', 'institution');

  perform pg_temp.become(staff);
  insert into public.guardian_links
    (school_id, student_id, guardian_id, relationship, rights)
  values ('projection-k12-check', student, guardian, 'parent', 'view_only')
  returning id into link;
  reset role;

  -- An unaccepted grant is consent-shaped data, not active consent.
  insert into public.family_grants
    (institution_id, student_id, recipient_id, category, access,
     resource_ids, accepted_at, expires_at)
  values
    ('projection-k12-check', student, guardian, 'calendar', 'selected',
     array['exam-1'], null, now() + interval '30 days')
  returning id into unaccepted_grant;

  begin
    execute 'set local role service_role';
    perform public.publish_guardian_calendar_projection(
      link, unaccepted_grant, 'exam-1', 'Final exam', now() + interval '7 days',
      'scheduled', 'calendar-v1', now());
    execute 'reset role';
    raise exception 'FAILED: an unaccepted consent produced a projection';
  exception when insufficient_privilege then
    execute 'reset role';
    raise notice 'ok  an unaccepted consent cannot produce a projection';
  end;

  insert into public.family_grants
    (institution_id, student_id, recipient_id, category, access,
     resource_ids, accepted_at, expires_at)
  values
    ('projection-k12-check', student, guardian, 'calendar', 'selected',
     array['exam-1'], now(), now() + interval '30 days')
  returning id into grant_id;

  -- The publisher is service-only and its input shape is closed.
  if not pg_temp.refused(guardian, format(
    'select public.publish_guardian_calendar_projection(%L, %L, %L, %L, now(), %L, %L, now())',
    link, grant_id, 'exam-1', 'Final exam', 'scheduled', 'calendar-v1')) then
    raise exception 'FAILED: an authenticated guardian called the publisher';
  end if;
  raise notice 'ok  an authenticated guardian cannot call the publisher';

  begin
    execute 'set local role service_role';
    perform public.publish_guardian_calendar_projection(
      link, grant_id, 'secret-1', 'Not consented', now() + interval '8 days',
      'scheduled', 'calendar-v1', now());
    execute 'reset role';
    raise exception 'FAILED: a resource outside consent was projected';
  exception when insufficient_privilege then
    execute 'reset role';
    raise notice 'ok  a resource outside the exact consent scope is refused';
  end;

  execute 'set local role service_role';
  select public.publish_guardian_calendar_projection(
    link, grant_id, 'exam-1', 'Final exam', now() + interval '7 days',
    'scheduled', 'calendar-v1', now()) into projection;
  execute 'reset role';
  perform pg_temp.counted('a verified relationship plus active exact consent publishes one projection',
    (select count(*) from private.guardian_calendar_projections where id = projection), 1);
  perform pg_temp.counted('the projection expires no later than twenty-four hours',
    (select count(*) from private.guardian_calendar_projections
      where id = projection and expires_at <= projected_at + interval '24 hours'), 1);

  -- Nobody receives raw-table access, including the publishing role.
  perform pg_temp.counted('authenticated has no raw projection SELECT grant',
    has_table_privilege('authenticated', 'private.guardian_calendar_projections', 'select')::int, 0);
  perform pg_temp.counted('service_role has no raw projection SELECT grant',
    has_table_privilege('service_role', 'private.guardian_calendar_projections', 'select')::int, 0);
  perform pg_temp.counted('authenticated has no raw audit SELECT grant',
    has_table_privilege('authenticated', 'private.guardian_projection_access_events', 'select')::int, 0);
  if not pg_temp.refused(guardian, 'select * from private.guardian_calendar_projections') then
    raise exception 'FAILED: guardian selected the backing projection table';
  end if;
  raise notice 'ok  the guardian cannot select the backing projection table';

  -- The authorized read returns the allowlisted shape and writes its audit.
  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_calendar_projection(student);
  select r.title into got from public.read_guardian_calendar_projection(student) r;
  reset role;
  perform pg_temp.counted('the verified, consented guardian reads one minimized notice', n, 1);
  if got is distinct from 'Final exam' then
    raise exception 'FAILED: wrong minimized title — %', got;
  end if;
  raise notice 'ok  the minimized title is the published allowlisted value';
  perform pg_temp.counted('each allowed call records exact returned fields',
    (select count(*) from private.guardian_projection_access_events
      where guardian_id = guardian and decision = 'allow'
        and fields_returned = array['student_id', 'item_id', 'title', 'starts_at', 'status', 'source_observed_at', 'expires_at']), 2);

  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_calendar_projection(student, 'marketing');
  reset role;
  perform pg_temp.counted('a wrong purpose returns nothing', n, 0);
  perform pg_temp.counted('and records a non-leaking purpose denial',
    (select count(*) from private.guardian_projection_access_events
      where guardian_id = guardian and reason = 'purpose_denied'
        and cardinality(fields_returned) = 0), 1);

  perform pg_temp.become(stranger);
  select count(*) into n from public.read_guardian_calendar_projection(student);
  reset role;
  perform pg_temp.counted('a stranger reads nothing', n, 0);

  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_calendar_projection(other_student);
  reset role;
  perform pg_temp.counted('a guardian cannot cross tenant or student scope', n, 0);

  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_calendar_projection(gen_random_uuid());
  reset role;
  perform pg_temp.counted('a made-up student identifier is the same empty result', n, 0);

  -- Students can inspect the decision history about themselves; nobody else can.
  perform pg_temp.become(student);
  select count(*) into n from public.read_guardian_projection_access_history();
  reset role;
  perform pg_temp.counted('the student sees all reads and denials about them', n, 4);
  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_projection_access_history();
  reset role;
  perform pg_temp.counted('the guardian cannot read the student audit history', n, 0);

  -- Expiry is checked at the next request, without a sweep.
  update private.guardian_calendar_projections
     set projected_at = now() - interval '2 days',
         expires_at = now() - interval '1 day'
   where id = projection;
  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_calendar_projection(student);
  reset role;
  perform pg_temp.counted('an expired projection stops at the next read', n, 0);

  -- Republish, then revoke consent. The trigger marks the backing row before
  -- the next request; the reader independently rechecks the grant as well.
  execute 'set local role service_role';
  perform public.publish_guardian_calendar_projection(
    link, grant_id, 'exam-1', 'Final exam', now() + interval '7 days',
    'scheduled', 'calendar-v2', now());
  execute 'reset role';
  update public.family_grants set revoked_at = now() where id = grant_id;
  perform pg_temp.counted('consent revocation immediately invalidates the projection',
    (select count(*) from private.guardian_calendar_projections
      where id = projection and invalidated_reason = 'consent_changed'), 1);
  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_calendar_projection(student);
  reset role;
  perform pg_temp.counted('a revoked consent reads nothing', n, 0);

  -- Restore only inside this rolled-back fixture, republish, then end the
  -- verified relationship. Relationship invalidation is equally immediate.
  update public.family_grants set revoked_at = null, accepted_at = now(), expires_at = now() + interval '30 days'
   where id = grant_id;
  execute 'set local role service_role';
  perform public.publish_guardian_calendar_projection(
    link, grant_id, 'exam-1', 'Final exam', now() + interval '7 days',
    'scheduled', 'calendar-v3', now());
  execute 'reset role';
  perform pg_temp.become(staff);
  update public.guardian_links set ended_at = now(), ended_reason = 'school' where id = link;
  reset role;
  perform pg_temp.counted('ending the verified relationship immediately invalidates the projection',
    (select count(*) from private.guardian_calendar_projections
      where id = projection and invalidated_reason = 'relationship_changed'), 1);
  perform pg_temp.become(guardian);
  select count(*) into n from public.read_guardian_calendar_projection(student);
  reset role;
  perform pg_temp.counted('an ended relationship reads nothing', n, 0);

  -- A valid-looking consent without a verified relationship cannot publish.
  insert into public.family_grants
    (institution_id, student_id, recipient_id, category, access,
     resource_ids, accepted_at, expires_at)
  values
    ('projection-k12-check', student, other_guardian, 'calendar', 'selected',
     array['exam-2'], now(), now() + interval '30 days')
  returning id into unaccepted_grant;
  begin
    execute 'set local role service_role';
    perform public.publish_guardian_calendar_projection(
      gen_random_uuid(), unaccepted_grant, 'exam-2', 'Other exam', now() + interval '8 days',
      'scheduled', 'calendar-v1', now());
    execute 'reset role';
    raise exception 'FAILED: consent without a verified relationship published';
  exception when insufficient_privilege then
    execute 'reset role';
    raise notice 'ok  consent without a verified relationship cannot publish';
  end;
end $$;

rollback;
