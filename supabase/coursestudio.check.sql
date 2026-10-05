-- supabase/coursestudio.check.sql — who may publish for a course, and who reads it.
--
-- For 20260928309000_course_studio.sql (D-100, F1–F7; D-101). What it proves,
-- from the design's §8:
--
--   * only a live `faculty` grant on exactly this course, at the caller's own
--     school, publishes — not a student, not faculty for another course, not
--     faculty whose grant is for another school, not a revoked or expired
--     grant, not a school-wide staff role;
--   * published versions are immutable: no update, no delete, no direct
--     insert, by anybody through the API — the author included;
--   * the school's members read; another school's do not; a visitor cannot ask;
--   * a pack's new version stays in its own course.
--
-- The control: the publish that works comes first, and each refusal changes
-- one thing about the same people.
--
--   How to run it: supabase/check.sh coursestudio

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

-- The error a statement raises as `who`, or null when it ran.
create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
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

do $$
declare
  prof uuid; other_course uuid; elsewhere uuid; misfiled uuid; lapsed uuid; expired uuid;
  staff uuid; student uuid; outsider uuid; pack uuid; n bigint;
  rules constant text :=
    $q$select public.publish_course_rules(' econ  1020 ', '2026FA', 'allowed',
         '{"final-answers":"prohibited","practice":"allowed"}'::jsonb,
         'Use AI to practise; never for graded answers.', 'https://example.edu/econ1020/syllabus', date '2026-08-24')$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('cs-u', 'Course Studio University', array['cs-u.example']),
    ('cs-other', 'Other University', array['cs-other.example']);

  prof         := pg_temp.newuser('prof@cs-u.example', 'cs-u');
  other_course := pg_temp.newuser('other@cs-u.example', 'cs-u');
  elsewhere    := pg_temp.newuser('prof@cs-other.example', 'cs-other');
  misfiled     := pg_temp.newuser('misfiled@cs-u.example', 'cs-u');
  lapsed       := pg_temp.newuser('lapsed@cs-u.example', 'cs-u');
  expired      := pg_temp.newuser('expired@cs-u.example', 'cs-u');
  staff        := pg_temp.newuser('staff@cs-u.example', 'cs-u');
  student      := pg_temp.newuser('student@cs-u.example', 'cs-u');
  outsider     := pg_temp.newuser('student@cs-other.example', 'cs-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,         'faculty',               'course', 'cs-u/ECON 1020',     'institution'),
    (prof,         'faculty',               'course', 'cs-u/ECON 1030',     'institution'),
    (other_course, 'faculty',               'course', 'cs-u/HIST 2100',     'institution'),
    (elsewhere,    'faculty',               'course', 'cs-other/ECON 1020', 'institution'),
    -- A grant for another school's course, held by somebody at this one.
    (misfiled,     'faculty',               'course', 'cs-other/ECON 1020', 'institution'),
    (staff,        'learning_center_staff', 'school', 'cs-u',               'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (lapsed,       'faculty',               'course', 'cs-u/ECON 1020',     'institution', now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at) values
    (expired,      'faculty',               'course', 'cs-u/ECON 1020',     'institution', now() - interval '1 second');

  -- ── The publish that works ──────────────────────────────────────────────
  perform pg_temp.counted('faculty publish rules for their course, the code normalised',
    (pg_temp.err(prof, rules) is null)::int, 1);
  perform pg_temp.counted('as version 1 of cs-u / ECON 1020 / 2026FA',
    (select count(*) from public.course_ai_rules
      where tenant_id = 'cs-u' and course_code = 'ECON 1020' and term = '2026FA' and version = 1 and published_by = prof), 1);
  -- Two statements, not `a and b`: Postgres does not promise to evaluate the
  -- publish before the count.
  perform pg_temp.counted('publishing again works', (pg_temp.err(prof, rules) is null)::int, 1);
  perform pg_temp.counted('as version 2, and version 1 is kept',
    (select count(*) from public.course_ai_rules where tenant_id = 'cs-u' and version in (1, 2)), 2);

  -- ── Who may not (F1) ────────────────────────────────────────────────────
  perform pg_temp.refused('a student publishing rules', student, rules);
  perform pg_temp.refused('faculty for another course', other_course, rules);
  perform pg_temp.refused('faculty whose grant is for another school''s course', misfiled, rules);
  perform pg_temp.refused('faculty whose grant was revoked', lapsed, rules);
  perform pg_temp.refused('faculty whose grant expired', expired, rules);
  perform pg_temp.refused('school-wide staff without course:publish', staff, rules);
  perform pg_temp.counted('and the refusals wrote nothing', (select count(*) from public.course_ai_rules), 2);
  -- The same code at the other school is that school's course, not this one's.
  perform pg_temp.counted('faculty at the other school publish for their own ECON 1020',
    (pg_temp.err(elsewhere, rules) is null)::int, 1);
  perform pg_temp.counted('filed under their school, not this one',
    (select count(*) from public.course_ai_rules where tenant_id = 'cs-other'), 1);

  -- ── What rules may say ──────────────────────────────────────────────────
  perform pg_temp.refused('a use the toolkit does not have', prof,
    $q$select public.publish_course_rules('ECON 1020', '2026FA', null, '{"homework":"allowed"}', '', '', null)$q$);
  perform pg_temp.refused('a state the toolkit does not have', prof,
    $q$select public.publish_course_rules('ECON 1020', '2026FA', null, '{"practice":"sometimes"}', '', '', null)$q$);
  perform pg_temp.refused('"unavailable", which means nobody said', prof,
    $q$select public.publish_course_rules('ECON 1020', '2026FA', 'unavailable', '{}', '', '', null)$q$);
  perform pg_temp.refused('a link that is not http', prof,
    $q$select public.publish_course_rules('ECON 1020', '2026FA', null, '{}', '', 'javascript:alert(1)', null)$q$);
  perform pg_temp.refused('a term that is not one', prof,
    $q$select public.publish_course_rules('ECON 1020', 'Fall', null, '{}', '', '', null)$q$);
  perform pg_temp.refused('something that is not a course code', prof,
    $q$select public.publish_course_rules('Economics', '2026FA', null, '{}', '', '', null)$q$);

  -- ── Immutable ───────────────────────────────────────────────────────────
  perform pg_temp.refused('the author editing a published version', prof,
    $q$update public.course_ai_rules set words = 'changed'$q$);
  perform pg_temp.refused('the author deleting one', prof,
    $q$delete from public.course_ai_rules$q$);
  perform pg_temp.refused('anybody inserting one directly', prof,
    format($q$insert into public.course_ai_rules (tenant_id, course_code, term, version) values ('cs-u', 'ECON 1020', '2026FA', 9)$q$));
  perform pg_temp.counted('and the published words are as published',
    (select count(*) from public.course_ai_rules where words = 'changed'), 0);

  -- ── Guidance ────────────────────────────────────────────────────────────
  perform pg_temp.counted('faculty publish guidance',
    (pg_temp.err(prof, $q$select public.publish_course_guidance('ECON 1020', '2026FA', 'Do the problem sets before office hours.')$q$) is null)::int, 1);
  perform pg_temp.refused('a student publishing guidance', student,
    $q$select public.publish_course_guidance('ECON 1020', '2026FA', 'x')$q$);

  -- ── Packs ───────────────────────────────────────────────────────────────
  perform pg_temp.become(prof);
  pack := public.publish_study_pack('ECON 1020', '2026FA', null, 'Midterm 1',
    'Start with the slides.',
    '[{"title":"Week 4 slides","citation":"Slides, week 4","link":"https://lms.example/w4","authority":"authoritative"},
      {"title":"Last year''s answer key","citation":"","link":"","authority":"prohibited"}]'::jsonb, false);
  execute 'reset role';
  perform pg_temp.counted('faculty publish a pack', (pack is not null)::int, 1);
  perform pg_temp.counted('a new version of the pack, retiring it',
    (pg_temp.err(prof, format($q$select public.publish_study_pack('ECON 1020', '2026FA', %L, 'Midterm 1', '', '[]', true)$q$, pack)) is null)::int, 1);
  perform pg_temp.counted('is version 2 of the same pack',
    (select max(version) from public.study_packs where pack_id = pack), 2);
  perform pg_temp.refused('moving a pack into another course they also teach', prof,
    format($q$select public.publish_study_pack('ECON 1030', '2026FA', %L, 'Moved', '', '[]', false)$q$, pack));
  perform pg_temp.refused('a reference with no authority', prof,
    $q$select public.publish_study_pack('ECON 1020', '2026FA', null, 'P', '', '[{"title":"x","link":""}]', false)$q$);
  perform pg_temp.refused('a reference with a field nobody previews', prof,
    $q$select public.publish_study_pack('ECON 1020', '2026FA', null, 'P', '', '[{"title":"x","authority":"supplemental","file":"blob"}]', false)$q$);
  perform pg_temp.refused('a reference linking somewhere that is not http', prof,
    $q$select public.publish_study_pack('ECON 1020', '2026FA', null, 'P', '', '[{"title":"x","link":"file:///etc/passwd","authority":"supplemental"}]', false)$q$);
  perform pg_temp.refused('a student publishing a pack', student,
    $q$select public.publish_study_pack('ECON 1020', '2026FA', null, 'P', '', '[]', false)$q$);

  -- ── Who reads (F4) ──────────────────────────────────────────────────────
  perform pg_temp.counted('a student at the school reads the rules, every version',
    pg_temp.seen(student, $q$select * from public.course_ai_rules where tenant_id = 'cs-u'$q$), 2);
  perform pg_temp.counted('and the guidance', pg_temp.seen(student, 'select * from public.course_guidance'), 1);
  perform pg_temp.counted('and the packs', pg_temp.seen(student, 'select * from public.study_packs'), 2);
  perform pg_temp.counted('a student at the other school reads only theirs',
    pg_temp.seen(outsider, $q$select * from public.course_ai_rules where tenant_id = 'cs-u'$q$), 0);
  perform pg_temp.counted('and none of this school''s packs',
    pg_temp.seen(outsider, 'select * from public.study_packs'), 0);

  -- ── What Course Studio is offered for ───────────────────────────────────
  perform pg_temp.counted('faculty see the courses they may publish for, at their school',
    pg_temp.seen(prof, 'select * from public.my_course_studio_courses()'), 2);
  perform pg_temp.counted('a grant for another school''s course is not offered',
    pg_temp.seen(misfiled, 'select * from public.my_course_studio_courses()'), 0);
  perform pg_temp.counted('nor a revoked one', pg_temp.seen(lapsed, 'select * from public.my_course_studio_courses()'), 0);
  perform pg_temp.counted('a student is offered nothing', pg_temp.seen(student, 'select * from public.my_course_studio_courses()'), 0);

  -- ── Nothing about students (F5) ─────────────────────────────────────────
  perform pg_temp.counted('no Course Studio table has a column naming a student',
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name in ('course_ai_rules', 'course_guidance', 'study_packs')
        and column_name ~ 'student|reader|viewer|user_id'), 0);
end $$;

set local role anon;
do $$
begin
  perform count(*) from public.course_ai_rules;
  raise exception 'FAILED: a signed-out visitor read course rules';
exception when insufficient_privilege then
  raise notice 'ok  a signed-out visitor cannot read course rules';
end $$;
do $$
begin
  perform public.publish_course_rules('ECON 1020', '2026FA', null, '{}', '', '', null);
  raise exception 'FAILED: a signed-out visitor published';
exception when insufficient_privilege then
  raise notice 'ok  or publish';
end $$;
reset role;

rollback;
