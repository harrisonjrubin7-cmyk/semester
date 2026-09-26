-- Expansion roles and features: every new permission walked as the account it
-- is about, and every refusal attempted as the account that should be refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh expansion

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

do $$
declare
  student   uuid; classmate uuid; stranger uuid; other_school uuid;
  registrar uuid; dso uuid; prof uuid; mentor uuid; employer uuid;
  partner   uuid; moderator uuid; steward uuid; ir uuid; alum uuid;
  passport  uuid; share uuid; rid uuid; n bigint; i int;
begin
  insert into public.schools (id, name, email_domains) values
    ('exp-u', 'Expansion University', array['exp-u.example']),
    ('exp-other', 'Other University', array['exp-other.example']);

  student      := pg_temp.newuser('student@exp-u.example', 'exp-u');
  classmate    := pg_temp.newuser('classmate@exp-u.example', 'exp-u');
  stranger     := pg_temp.newuser('stranger@exp-u.example', 'exp-u');
  other_school := pg_temp.newuser('other@exp-other.example', 'exp-other');
  registrar    := pg_temp.newuser('registrar@exp-u.example', 'exp-u');
  dso          := pg_temp.newuser('dso@exp-u.example', 'exp-u');
  prof         := pg_temp.newuser('prof@exp-u.example', 'exp-u');
  mentor       := pg_temp.newuser('mentor@exp-u.example', 'exp-u');
  employer     := pg_temp.newuser('recruiter@acme.example', null);
  partner      := pg_temp.newuser('partner@cc.example', null);
  moderator    := pg_temp.newuser('mod@semester.example', null);
  steward      := pg_temp.newuser('steward@semester.example', null);
  ir           := pg_temp.newuser('ir@exp-u.example', 'exp-u');
  alum         := pg_temp.newuser('alum@exp-u.example', 'exp-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (registrar, 'registrar',                   'school',   'exp-u',              'institution'),
    (dso,       'disability_services_officer', 'school',   'exp-u',              'institution'),
    (prof,      'faculty',                     'course',   'exp-u/CS 101',       'institution'),
    (mentor,    'peer_mentor',                 'cohort',   'exp-u/first-year',   'institution'),
    (student,   'student',                     'cohort',   'exp-u/first-year',   'institution'),
    (employer,  'employer',                    'employer', 'acme',               'platform'),
    (partner,   'transfer_partner_admin',      'partner',  'exp-u/nashville-cc', 'institution'),
    (moderator, 'moderator',                   'platform', '',                   'platform'),
    (steward,   'data_steward',                'platform', '',                   'platform'),
    (ir,        'institutional_researcher',    'school',   'exp-u',              'institution'),
    (alum,      'alumni',                      'school',   'exp-u',              'institution');

  -- ── student_context: private segments ──────────────────────────────────
  perform pg_temp.expect_allowed('a student records their own segments', student,
    $q$insert into public.student_context (user_id, tenant_id, self_segments)
       select (select auth.uid()), 'exp-u', array['first_generation','working']$q$);
  perform pg_temp.counted('the registrar cannot read a student''s segments',
    pg_temp.seen(registrar, 'select * from public.student_context'), 0);
  perform pg_temp.expect_refused('a student sets their own verified_segments', student,
    $q$update public.student_context set verified_segments = array['veteran']$q$);

  -- ── term plans and demand ──────────────────────────────────────────────
  perform pg_temp.expect_allowed('a student plans a course', student,
    $q$insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, contributes_to_demand)
       select (select auth.uid()), 'exp-u', '2027SP', 'CS 101', true$q$);
  perform pg_temp.counted('a classmate cannot see that plan',
    pg_temp.seen(classmate, 'select * from public.term_plan_courses'), 0);
  perform pg_temp.counted('the registrar cannot see that plan either',
    pg_temp.seen(registrar, 'select * from public.term_plan_courses'), 0);

  -- Nine more students plan CS 101 and opt in; one more opts out.
  for i in 1..9 loop
    insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, contributes_to_demand)
    values (pg_temp.newuser('p' || i || '@exp-u.example', 'exp-u'), 'exp-u', '2027SP', 'CS 101', true);
  end loop;
  insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, contributes_to_demand)
  values (pg_temp.newuser('optout@exp-u.example', 'exp-u'), 'exp-u', '2027SP', 'CS 101', false);
  -- Only three plan MATH 200: below the floor.
  for i in 1..3 loop
    insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, contributes_to_demand)
    values (pg_temp.newuser('m' || i || '@exp-u.example', 'exp-u'), 'exp-u', '2027SP', 'MATH 200', true);
  end loop;

  perform private.refresh_course_demand('exp-u', '2027SP');
  perform pg_temp.counted('the registrar sees demand only for courses with ten or more',
    pg_temp.seen(registrar, 'select * from public.course_demand_snapshots'), 1);
  perform pg_temp.counted('and it counts only opted-in students',
    pg_temp.seen(registrar, $q$select * from public.course_demand_snapshots where planned_students = 10$q$), 1);
  perform pg_temp.counted('a student cannot read demand',
    pg_temp.seen(student, 'select * from public.course_demand_snapshots'), 0);
  begin
    insert into public.course_demand_snapshots (tenant_id, term_code, course_code, planned_students)
    values ('exp-u', '2027SP', 'TINY 1', 3);
    raise exception 'FAILED: a snapshot below ten students was stored';
  exception when check_violation then
    raise notice 'ok  a snapshot below ten students cannot exist';
  end;

  -- ── registration windows ───────────────────────────────────────────────
  perform pg_temp.expect_allowed('the registrar publishes a window', registrar,
    $q$insert into public.registration_windows (tenant_id, term_code, audience, opens_at, closes_at, published_by)
       select 'exp-u', '2027SP', 'First-year', now() + interval '7 days', now() + interval '14 days', (select auth.uid())$q$);
  perform pg_temp.expect_refused('a student publishes a window', student,
    $q$insert into public.registration_windows (tenant_id, term_code, audience, opens_at, closes_at, published_by)
       select 'exp-u', '2027SP', 'Everyone', now(), now() + interval '1 day', (select auth.uid())$q$);
  perform pg_temp.counted('a student at the school sees the window',
    pg_temp.seen(student, 'select * from public.registration_windows'), 1);
  perform pg_temp.counted('a student at another school does not',
    pg_temp.seen(other_school, 'select * from public.registration_windows'), 0);

  -- ── accommodations passport ────────────────────────────────────────────
  perform pg_temp.expect_refused('a student issues their own passport', student,
    $q$insert into public.accommodation_passports (user_id, tenant_id, summary, verified_by, expires_at)
       select (select auth.uid()), 'exp-u', 'Extended time', (select auth.uid()), now() + interval '300 days'$q$);
  perform pg_temp.become(dso);
  insert into public.accommodation_passports (user_id, tenant_id, summary, verified_by, expires_at)
  values (student, 'exp-u', 'Extended time 1.5x on timed assessments', dso, now() + interval '300 days')
  returning id into passport;
  reset role;
  raise notice 'ok  disability services issues a passport';

  perform pg_temp.counted('an instructor cannot select the passport table',
    pg_temp.seen(prof, 'select * from public.accommodation_passports'), 0);

  perform pg_temp.become(student);
  insert into public.accommodation_shares (passport_id, student_id, faculty_id, course_code, expires_at)
  values (passport, student, prof, 'CS 101', now() + interval '120 days') returning id into share;
  reset role;
  raise notice 'ok  a student shares their passport with one instructor';

  perform pg_temp.become(prof);
  select count(*) into n from public.read_shared_accommodation(share);
  reset role;
  perform pg_temp.counted('the instructor reads it through the audited function', n, 1);
  perform pg_temp.counted('and the student sees that read',
    pg_temp.seen(student, 'select * from public.accommodation_access_events'), 1);
  perform pg_temp.expect_refused('a stranger reads the share', stranger,
    format('select * from public.read_shared_accommodation(%L)', share));
  perform pg_temp.expect_allowed('the student revokes the share', student,
    format($q$update public.accommodation_shares set revoked_at = now() where id = %L$q$, share));
  perform pg_temp.expect_refused('the instructor reads after revocation', prof,
    format('select * from public.read_shared_accommodation(%L)', share));

  -- ── course reviews: anonymous by construction ──────────────────────────
  perform pg_temp.become(student);
  rid := public.submit_course_review('CS 101', '2026FA', 8, 3, 4, 'Heavy weekly problem sets.');
  reset role;
  perform pg_temp.counted('a pending review is not visible to classmates',
    pg_temp.seen(classmate, 'select * from public.course_reviews'), 0);
  perform pg_temp.counted('the author sees their own pending review',
    pg_temp.seen(student, 'select * from public.course_reviews'), 1);
  perform pg_temp.expect_refused('the author publishes their own review', student,
    format($q$update public.course_reviews set status = 'published' where id = %L$q$, rid));
  perform pg_temp.expect_allowed('a moderator publishes it', moderator,
    format($q$update public.course_reviews set status = 'published' where id = %L$q$, rid));
  perform pg_temp.counted('now a classmate sees it',
    pg_temp.seen(classmate, 'select * from public.course_reviews'), 1);
  perform pg_temp.counted('but not who wrote it',
    pg_temp.seen(classmate, 'select * from public.course_review_authors'), 0);
  perform pg_temp.counted('another school does not see it',
    pg_temp.seen(other_school, 'select * from public.course_reviews'), 0);

  -- ── peer mentors ───────────────────────────────────────────────────────
  insert into public.onboarding_progress (user_id, step_key, completed_at) values (student, 'build_plan', now());
  perform pg_temp.counted('a mentor sees nothing before the student accepts',
    pg_temp.seen(mentor, 'select * from public.onboarding_progress'), 0);
  perform pg_temp.expect_refused('a student outside the cohort accepts a mentor', classmate,
    format($q$insert into public.peer_mentor_assignments (tenant_id, cohort_scope, mentor_id, student_id, expires_at)
              select 'exp-u', 'exp-u/first-year', %L, (select auth.uid()), now() + interval '90 days'$q$, mentor));
  perform pg_temp.expect_allowed('a cohort student accepts the mentor', student,
    format($q$insert into public.peer_mentor_assignments (tenant_id, cohort_scope, mentor_id, student_id, expires_at)
              select 'exp-u', 'exp-u/first-year', %L, (select auth.uid()), now() + interval '90 days'$q$, mentor));
  perform pg_temp.counted('the mentor sees checklist progress',
    pg_temp.seen(mentor, 'select * from public.onboarding_progress'), 1);
  perform pg_temp.counted('and nothing else the student owns',
    pg_temp.seen(mentor, 'select * from public.term_plan_courses'), 0);
  perform pg_temp.expect_allowed('the student ends the mentorship', student,
    $q$update public.peer_mentor_assignments set revoked_at = now()$q$);
  perform pg_temp.expect_refused('the mentor reopens it', mentor,
    $q$update public.peer_mentor_assignments set revoked_at = null$q$);
  perform pg_temp.counted('and the mentor sees nothing after it ends',
    pg_temp.seen(mentor, 'select * from public.onboarding_progress'), 0);

  -- ── institution actions ────────────────────────────────────────────────
  perform pg_temp.expect_allowed('the registrar sends a cohort action', registrar,
    $q$insert into public.institution_actions (tenant_id, publisher_id, publisher_scope_kind, publisher_scope_id,
         action_type, target_cohort, title)
       select 'exp-u', (select auth.uid()), 'school', 'exp-u', 'registration', 'exp-u/first-year', 'Meet your advisor'$q$);
  perform pg_temp.counted('the cohort student sees it',
    pg_temp.seen(student, 'select * from public.institution_actions'), 1);
  perform pg_temp.counted('a student outside the cohort does not',
    pg_temp.seen(classmate, 'select * from public.institution_actions'), 0);
  perform pg_temp.expect_refused('an instructor publishes an institution action', prof,
    $q$insert into public.institution_actions (tenant_id, publisher_id, publisher_scope_kind, publisher_scope_id,
         action_type, target_cohort, title)
       select 'exp-u', (select auth.uid()), 'school', 'exp-u', 'hold', 'exp-u/first-year', 'Fake hold'$q$);

  -- ── transfer credit ────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('a partner proposes an equivalency', partner,
    $q$insert into public.articulation_rules (tenant_id, partner_scope, from_course, to_course, status, proposed_by)
       select 'exp-u', 'exp-u/nashville-cc', 'CSC 1010', 'CS 101', 'proposed', (select auth.uid())$q$);
  perform pg_temp.expect_refused('a partner approves its own proposal', partner,
    $q$update public.articulation_rules set status = 'approved', approved_by = (select auth.uid()), approved_at = now()$q$);
  perform pg_temp.counted('students do not see unapproved rules',
    pg_temp.seen(student, 'select * from public.articulation_rules'), 0);
  perform pg_temp.expect_allowed('the registrar approves it', registrar,
    $q$update public.articulation_rules set status = 'approved', approved_by = (select auth.uid()), approved_at = now()$q$);
  perform pg_temp.counted('students now see the approved rule',
    pg_temp.seen(student, 'select * from public.articulation_rules'), 1);
  perform pg_temp.expect_refused('a student marks their own transfer credit verified', student,
    $q$insert into public.transfer_evaluations (user_id, tenant_id, from_institution, from_course, status)
       select (select auth.uid()), 'exp-u', 'Nashville CC', 'CSC 1010', 'institution_verified'$q$);

  -- ── talent pool ────────────────────────────────────────────────────────
  insert into public.talent_profiles (user_id, opted_in, headline) values (student, true, 'CS sophomore');
  insert into public.talent_profiles (user_id, opted_in, headline) values (classmate, false, 'Not looking');
  perform pg_temp.counted('an employer sees only opted-in profiles',
    pg_temp.seen(employer, 'select * from public.talent_profiles'), 1);
  perform pg_temp.counted('a student cannot browse the talent pool',
    pg_temp.seen(stranger, 'select * from public.talent_profiles'), 0);
  perform pg_temp.expect_allowed('an employer records a view', employer,
    format($q$insert into public.talent_profile_views (profile_id, viewer_id, employer_scope)
              select %L, (select auth.uid()), 'acme'$q$, student));
  perform pg_temp.counted('the student sees they were viewed',
    pg_temp.seen(student, 'select * from public.talent_profile_views'), 1);

  -- ── skills verification ────────────────────────────────────────────────
  insert into public.skill_records (user_id, skill, evidence_kind, status, verifier_scope_kind, verifier_scope_id)
  values (student, 'Python', 'course', 'verification_requested', 'course', 'exp-u/CS 101');
  perform pg_temp.expect_refused('a student verifies their own skill', student,
    $q$update public.skill_records set status = 'verified', verified_by = (select auth.uid()), verified_at = now()$q$);
  perform pg_temp.expect_allowed('the course''s instructor verifies it', prof,
    $q$update public.skill_records set status = 'verified', verified_by = (select auth.uid()), verified_at = now()$q$);

  -- ── AI memory is nobody else's ─────────────────────────────────────────
  insert into public.ai_memories (user_id, kind, content) values (student, 'goal', 'Graduate in 4 years');
  perform pg_temp.counted('a moderator cannot read AI memory',
    pg_temp.seen(moderator, 'select * from public.ai_memories'), 0);
  perform pg_temp.counted('a data steward cannot read AI memory',
    pg_temp.seen(steward, 'select * from public.ai_memories'), 0);

  -- ── data requests ──────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('a student files an export request', student,
    $q$insert into public.data_requests (user_id, kind) select (select auth.uid()), 'export'$q$);
  perform pg_temp.counted('the data steward sees it',
    pg_temp.seen(steward, 'select * from public.data_requests'), 1);
  perform pg_temp.counted('a classmate does not',
    pg_temp.seen(classmate, 'select * from public.data_requests'), 0);

  -- ── alumni offers ──────────────────────────────────────────────────────
  perform pg_temp.expect_refused('a current student poses as alumni', student,
    $q$insert into public.alumni_mentor_offers (user_id, tenant_id, topics) select (select auth.uid()), 'exp-u', array['cs']$q$);
  perform pg_temp.expect_allowed('verified alumni offer to mentor', alum,
    $q$insert into public.alumni_mentor_offers (user_id, tenant_id, topics) select (select auth.uid()), 'exp-u', array['cs']$q$);

  -- ── study matching ─────────────────────────────────────────────────────
  insert into public.study_match_optins (user_id, tenant_id, course_code) values (student, 'exp-u', 'CS 101');
  perform pg_temp.counted('a classmate who has not opted in sees nobody',
    pg_temp.seen(classmate, 'select * from public.study_match_optins'), 0);
  insert into public.study_match_optins (user_id, tenant_id, course_code) values (classmate, 'exp-u', 'CS 101');
  perform pg_temp.counted('once opted in, they see each other',
    pg_temp.seen(classmate, 'select * from public.study_match_optins'), 2);

  -- ── deletion: every student-owned table empties under RLS ──────────────
  perform pg_temp.become(student);
  delete from public.term_plan_courses where user_id = student;
  delete from public.student_context where user_id = student;
  delete from public.ai_memories where user_id = student;
  delete from public.talent_profiles where user_id = student;
  delete from public.skill_records where user_id = student;
  delete from public.onboarding_progress where user_id = student;
  delete from public.study_match_optins where user_id = student;
  delete from public.course_review_authors where author_id = student;
  delete from public.peer_mentor_assignments where student_id = student;
  delete from public.accommodation_shares where student_id = student;
  reset role;
  select (select count(*) from public.term_plan_courses where user_id = student)
       + (select count(*) from public.student_context where user_id = student)
       + (select count(*) from public.ai_memories where user_id = student)
       + (select count(*) from public.talent_profiles where user_id = student)
       + (select count(*) from public.skill_records where user_id = student)
       + (select count(*) from public.onboarding_progress where user_id = student)
       + (select count(*) from public.study_match_optins where user_id = student)
       + (select count(*) from public.course_review_authors where author_id = student)
       + (select count(*) from public.peer_mentor_assignments where student_id = student)
       + (select count(*) from public.accommodation_shares where student_id = student)
    into n;
  perform pg_temp.counted('a student can empty every table they own', n, 0);
end $$;

rollback;
