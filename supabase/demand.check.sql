-- Course demand forecasting (Phase K, D-051): a student contributes only by
-- consenting, only at their own school, and can stop; a count is published
-- only at ten or more and only from live consent; staff read counts for
-- their own scope and never a row, a plan, or a person. Every refusal is
-- attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh demand

begin;

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  -- A statement that ran but touched no row was refused by RLS.
  return n = 0;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.expect_refused(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was allowed', what;
  end if;
  raise notice 'ok  % is refused', what;
end $$;

create or replace function pg_temp.expect_allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was refused', what;
  end if;
  raise notice 'ok  % is allowed', what;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.value_as(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
end $$;

create or replace function pg_temp.error_as(who uuid, q text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute q;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.error_raw(q text)
returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then
  return sqlerrm;
end $$;

create or replace function pg_temp.says(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is null or position(want in got) = 0 then
    raise exception 'FAILED: % — expected "%", got "%"', what, want, got;
  end if;
  raise notice 'ok  % ("%")', what, want;
end $$;

create or replace function pg_temp.contribute(who uuid, courses text)
returns void language plpgsql as $$
begin
  perform pg_temp.value_as(who, format('select public.contribute_course_plan(''2027SP'', %L::jsonb)', courses));
end $$;

do $$
declare
  registrar uuid; chair uuid; prof uuid; far_registrar uuid;
  nobody uuid; far uuid; sneaky uuid; direct uuid;
  crowd uuid[] := '{}';
  i int; n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('dm-u', 'Demand University', array['dm-u.example']),
    ('dm-other', 'Other University', array['dm-other.example']);

  registrar     := pg_temp.newuser('registrar@dm-u.example', 'dm-u');
  chair         := pg_temp.newuser('chair@dm-u.example', 'dm-u');
  prof          := pg_temp.newuser('prof@dm-u.example', 'dm-u');
  far_registrar := pg_temp.newuser('registrar@dm-other.example', 'dm-other');
  nobody        := pg_temp.newuser('nobody@nowhere.example', null);
  far           := pg_temp.newuser('far@dm-other.example', 'dm-other');
  sneaky        := pg_temp.newuser('sneaky@dm-other.example', 'dm-other');
  direct        := pg_temp.newuser('direct@dm-u.example', 'dm-u');
  for i in 1..11 loop
    crowd := crowd || pg_temp.newuser(format('s%s@dm-u.example', i), 'dm-u');
  end loop;

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (registrar,     'registrar',        'school',     'dm-u',      'institution'),
    (chair,         'department_chair', 'department', 'dm-u/ECON', 'institution'),
    (prof,          'faculty',          'course',     'dm-u/ECON 1010', 'institution'),
    (far_registrar, 'registrar',        'school',     'dm-other',  'institution');

  -- ── contributing ───────────────────────────────────────────────────────
  perform pg_temp.says('a student with no school cannot contribute',
    pg_temp.error_as(nobody, $q$select public.contribute_course_plan('2027SP', '[{"course":"ECON 1010","role":"primary"}]')$q$),
    'Set your school');
  perform pg_temp.says('a course code is checked',
    pg_temp.error_as(crowd[1], $q$select public.contribute_course_plan('2027SP', '[{"course":"drop table","role":"primary"}]')$q$),
    'Not a course code');
  perform pg_temp.says('a role is primary or backup',
    pg_temp.error_as(crowd[1], $q$select public.contribute_course_plan('2027SP', '[{"course":"ECON 1010","role":"maybe"}]')$q$),
    'primary or a backup');
  perform pg_temp.says('nothing is not a contribution',
    pg_temp.error_as(crowd[1], $q$select public.contribute_course_plan('2027SP', '[]')$q$),
    'between one and thirty');
  perform pg_temp.says('nor are thirty-one courses',
    pg_temp.error_as(crowd[1], format('select public.contribute_course_plan(''2027SP'', %L::jsonb)',
      (select jsonb_agg(jsonb_build_object('course', 'ECON ' || (1000 + g), 'role', 'primary')) from generate_series(1, 31) g))),
    'between one and thirty');
  perform pg_temp.counted('concurrent saves are serialized before replacing contributed rows',
    (select count(*)
       from pg_proc p
      where p.oid = 'public.contribute_course_plan(text,jsonb)'::regprocedure
        and position('pg_advisory_xact_lock' in p.prosrc) > 0
        and position('pg_advisory_xact_lock' in p.prosrc) < position('delete from public.term_plan_courses' in p.prosrc)), 1);

  perform pg_temp.contribute(crowd[1], '[{"course":"MATH 1300","role":"primary"}]');
  perform pg_temp.contribute(crowd[1], '[{"course":"econ 1010","role":"primary"},{"course":"ECON 1020","role":"backup","rank":1},{"course":"ECON 1010","role":"backup"}]');
  perform pg_temp.counted('contributing again replaces the plan, and a course is counted once',
    pg_temp.seen(crowd[1], 'select * from public.my_demand_contribution(''2027SP'')'), 2);
  perform pg_temp.contribute(crowd[1], '[{"course":"econ1010","role":"primary"},{"course":"ECON 1020","role":"backup","rank":1}]');
  perform pg_temp.counted('a code without its space is stored with one, so the department scope finds it',
    (select count(*) from public.term_plan_courses where user_id = crowd[1] and course_code = 'ECON 1010'), 1);
  perform pg_temp.counted('as planned when it is both',
    pg_temp.seen(crowd[1], $q$select * from public.my_demand_contribution('2027SP') where course_code = 'ECON 1010' and role = 'primary'$q$), 1);
  perform pg_temp.contribute(crowd[1], '[{"course":"ECON 1020","role":"backup","rank":4},{"course":"ECON 1020","role":"backup","rank":1},{"course":"ECON 1020","role":"primary"},{"course":"MATH 1300","role":"backup","rank":7},{"course":"MATH 1300","role":"backup","rank":2}]');
  perform pg_temp.counted('a later primary still wins a duplicate course in the set-based write',
    pg_temp.seen(crowd[1], $q$select * from public.my_demand_contribution('2027SP') where course_code = 'ECON 1020' and role = 'primary'$q$), 1);
  perform pg_temp.counted('the first backup rank still wins when every duplicate is a backup',
    pg_temp.seen(crowd[1], $q$select * from public.term_plan_courses where user_id = (select auth.uid()) and course_code = 'MATH 1300' and backup_rank = 7$q$), 1);
  perform pg_temp.contribute(crowd[1], '[{"course":"econ1010","role":"primary"},{"course":"ECON 1020","role":"backup","rank":1}]');
  perform pg_temp.counted('at the school on the student''s profile',
    (select count(*) from public.term_plan_courses where user_id = crowd[1] and tenant_id = 'dm-u' and contributes_to_demand), 2);
  perform pg_temp.counted('with a live consent',
    (select count(*) from public.demand_consents where user_id = crowd[1] and revoked_at is null), 1);
  perform pg_temp.counted('a student sees only their own contribution',
    pg_temp.seen(crowd[2], 'select * from public.my_demand_contribution(''2027SP'')'), 0);

  perform pg_temp.expect_refused('a direct row cannot contribute at another school', sneaky,
    $q$insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, contributes_to_demand)
       select (select auth.uid()), 'dm-u', '2027SP', 'ECON 1010', true$q$);
  perform pg_temp.expect_allowed('a direct row at the student''s own school is still allowed', direct,
    $q$insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, contributes_to_demand)
       select (select auth.uid()), 'dm-u', '2027SP', 'ECON 1010', true$q$);
  perform pg_temp.expect_refused('a student cannot write a consent directly', direct,
    $q$insert into public.demand_consents (user_id, tenant_id, term_code) select (select auth.uid()), 'dm-u', '2027SP'$q$);

  -- ── the threshold, and only live consent ───────────────────────────────
  for i in 2..9 loop
    perform pg_temp.contribute(crowd[i], '[{"course":"ECON 1010","role":"primary"},{"course":"ECON 1020","role":"backup","rank":1},{"course":"MATH 1300","role":"primary"}]');
  end loop;
  perform pg_temp.says('a student cannot run the refresh',
    pg_temp.error_as(crowd[1], $q$select public.refresh_course_demand_snapshots('dm-u', '2027SP')$q$), 'permission denied');
  perform pg_temp.says('nor can the registrar',
    pg_temp.error_as(registrar, $q$select public.refresh_course_demand_snapshots('dm-u', '2027SP')$q$), 'permission denied');

  -- Nine consenting, plus one direct row with no consent: not ten.
  perform private.refresh_course_demand('dm-u', '2027SP');
  perform pg_temp.counted('nine consenting and one row without consent publish nothing',
    (select count(*) from public.course_demand_snapshots where tenant_id = 'dm-u' and course_code = 'ECON 1010'), 0);

  perform pg_temp.contribute(crowd[10], '[{"course":"ECON 1010","role":"primary"},{"course":"ECON 1020","role":"backup","rank":2}]');
  -- One student holds ECON 1010 only as a backup: a backup count of one.
  perform pg_temp.contribute(crowd[11], '[{"course":"ECON 1010","role":"backup","rank":1}]');
  perform private.refresh_course_demand('dm-u', '2027SP');
  perform pg_temp.counted('ten consenting publish a count of ten',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1010' and planned_students = 10), 1);
  perform pg_temp.counted('a course nine students planned is not published at all',
    (select count(*) from public.course_demand_snapshots where course_code = 'MATH 1300'), 0);
  perform pg_temp.counted('one student''s backup is withheld, because fewer than ten hold it',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1010' and backup_students is null), 1);
  perform pg_temp.counted('and a course that is only a backup has no row of its own',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1020'), 0);
  perform pg_temp.says('the table itself refuses a count below ten',
    pg_temp.error_raw($q$insert into public.course_demand_snapshots (tenant_id, term_code, course_code, planned_students)
      values ('dm-u', '2027SP', 'HIST 1000', 9)$q$), 'check constraint');

  -- ── who reads what ─────────────────────────────────────────────────────
  perform pg_temp.counted('the registrar reads the count',
    pg_temp.seen(registrar, $q$select * from public.course_demand('2027SP') where course_code = 'ECON 1010' and planned_students = 10$q$), 1);
  perform pg_temp.counted('the economics chair reads it',
    pg_temp.seen(chair, 'select * from public.course_demand(''2027SP'')'), 1);
  perform pg_temp.counted('an instructor reads nothing',
    pg_temp.seen(prof, 'select * from public.course_demand(''2027SP'')'), 0);
  perform pg_temp.counted('a student reads nothing',
    pg_temp.seen(crowd[1], 'select * from public.course_demand(''2027SP'')'), 0);
  perform pg_temp.counted('another school''s registrar reads nothing',
    pg_temp.seen(far_registrar, 'select * from public.course_demand(''2027SP'')'), 0);
  perform pg_temp.counted('the registrar has a school scope',
    pg_temp.seen(registrar, $q$select * from public.my_demand_scopes() where scope_kind = 'school' and scope_id = 'dm-u'$q$), 1);
  perform pg_temp.counted('a student has none',
    pg_temp.seen(crowd[1], 'select * from public.my_demand_scopes()'), 0);

  -- A department chair reads only their own department.
  for i in 1..10 loop
    perform pg_temp.contribute(crowd[i], '[{"course":"ECON 1010","role":"primary"},{"course":"MATH 1300","role":"primary"}]');
  end loop;
  perform private.refresh_course_demand('dm-u', '2027SP');
  perform pg_temp.counted('the registrar reads both departments',
    pg_temp.seen(registrar, 'select * from public.course_demand(''2027SP'')'), 2);
  perform pg_temp.counted('the economics chair reads economics only',
    pg_temp.seen(chair, $q$select * from public.course_demand('2027SP') where course_code like 'MATH%'$q$), 0);

  -- No office, chair or instructor reads a plan, a consent or a person.
  perform pg_temp.counted('the registrar reads no plan rows',
    pg_temp.seen(registrar, 'select * from public.term_plan_courses'), 0);
  perform pg_temp.counted('the chair reads no plan rows',
    pg_temp.seen(chair, 'select * from public.term_plan_courses'), 0);
  perform pg_temp.counted('the registrar reads no consents',
    pg_temp.seen(registrar, 'select * from public.demand_consents'), 0);
  -- Read off the catalogue: a result column that could name a person is an
  -- id, a user or student column, a subject or an email.
  perform pg_temp.counted('nothing staff call returns a person',
    (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname in ('course_demand', 'my_demand_scopes')
        and pg_get_function_result(p.oid) ~* '(\muser_id\M|\mstudent_id\M|\msubject\M|\memail\M|\muuid\M)'), 0);
  -- The control: the same probe does see one that returns ids.
  perform pg_temp.counted('and the probe does find a function that returns an id',
    (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname = 'my_office_actions'
        and pg_get_function_result(p.oid) ~* '(\muser_id\M|\mstudent_id\M|\msubject\M|\memail\M|\muuid\M)'), 1);

  -- Capacity and waitlist, where the registrar has synced sections.
  perform pg_temp.expect_allowed('the registrar syncs sections', registrar,
    $q$insert into public.catalog_sections (tenant_id, term_code, course_code, section, capacity, seats_open, waitlist_count, source_system)
       values ('dm-u', '2027SP', 'ECON 1010', '01', 30, 0, 4, 'banner'),
              ('dm-u', '2027SP', 'ECON 1010', '02', 25, 3, 0, 'banner')$q$);
  perform pg_temp.counted('and the count carries capacity, waitlist and their source',
    pg_temp.seen(registrar, $q$select * from public.course_demand('2027SP')
      where course_code = 'ECON 1010' and capacity = 55 and waitlist = 4 and sections = 2 and capacity_source = 'banner'$q$), 1);
  perform pg_temp.counted('a course with no synced sections says so with nulls',
    pg_temp.seen(registrar, $q$select * from public.course_demand('2027SP')
      where course_code = 'MATH 1300' and capacity is null and sections = 0$q$), 1);

  -- ── stopping is prospective ────────────────────────────────────────────
  perform pg_temp.value_as(crowd[10], $q$select public.stop_contributing('2027SP')::text$q$);
  perform pg_temp.counted('stopping removes the student''s rows',
    (select count(*) from public.term_plan_courses where user_id = crowd[10] and contributes_to_demand), 0);
  perform pg_temp.counted('and stamps the consent',
    (select count(*) from public.demand_consents where user_id = crowd[10] and revoked_at is not null), 1);
  perform pg_temp.counted('the published count stands until the next refresh',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1010' and planned_students = 10), 1);
  perform private.refresh_course_demand('dm-u', '2027SP');
  perform pg_temp.counted('and the next refresh drops below ten, so nothing is published',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1010'), 0);
  perform pg_temp.counted('the student still sees that they stopped',
    pg_temp.seen(crowd[10], 'select * from public.my_demand_contribution(''2027SP'') where revoked_at is not null'), 1);

  -- A row whose consent was revoked does not count even if the flag is set again directly.
  perform pg_temp.expect_allowed('a stopped student sets the flag directly', crowd[10],
    $q$insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, contributes_to_demand)
       select (select auth.uid()), 'dm-u', '2027SP', 'ECON 1010', true$q$);
  perform private.refresh_course_demand('dm-u', '2027SP');
  perform pg_temp.counted('and is still not counted, because the consent is revoked',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1010'), 0);

  -- Contributing again is a fresh consent.
  perform pg_temp.contribute(crowd[11], '[{"course":"ECON 1010","role":"primary"}]');
  perform private.refresh_course_demand('dm-u', '2027SP');
  perform pg_temp.counted('a new contributor brings it back to ten',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1010' and planned_students = 10), 1);

  -- Delete my account takes the contribution with it (review fix
  -- 20260928310000). The consent allows no client write, and the auth user is
  -- not deleted, so only the RPC reaches it.
  perform pg_temp.value_as(crowd[11], $q$select public.forget_my_course_demand()::text$q$);
  perform pg_temp.counted('deleting the account removes the student''s plan rows',
    (select count(*) from public.term_plan_courses where user_id = crowd[11]), 0);
  perform pg_temp.counted('and their consent, revocation history included',
    (select count(*) from public.demand_consents where user_id = crowd[11]), 0);
  perform pg_temp.counted('another contributor keeps theirs (the control)',
    (select count(*) from public.demand_consents where user_id = crowd[1] and revoked_at is null), 1);
  perform private.refresh_course_demand('dm-u', '2027SP');
  perform pg_temp.counted('and the next refresh no longer counts the deleted student',
    (select count(*) from public.course_demand_snapshots where course_code = 'ECON 1010'), 0);
end $$;

-- Anonymous callers reach none of it.
set local role anon;
do $$
begin
  perform public.course_demand('2027SP');
  raise exception 'FAILED: anon read course demand';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read course demand';
end $$;
do $$
begin
  perform public.contribute_course_plan('2027SP', '[]'::jsonb);
  raise exception 'FAILED: anon contributed';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot contribute';
end $$;
reset role;

rollback;
