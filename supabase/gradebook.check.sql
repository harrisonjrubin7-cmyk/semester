-- supabase/gradebook.check.sql — who enters, moderates, releases and reads a
-- grade, and that no grade is ever rewritten.
--
-- For 20260929310000_gradebook.sql. One course, ECON 1020 in 2026FA at
-- gb-u: two instructors, a teaching assistant, a department chair and the
-- registrar (both school-wide), two enrolled students, a student enrolled in
-- another course, faculty on another course, and faculty at another school
-- whose course has the same code. What it proves:
--
--   * a draft is seen by course staff and by no student — not even the
--     student it is about;
--   * a student sees their own released grades and nobody else's;
--   * only this course's graders enter, only a second instructor moderates
--     (not the grader, not a TA, not a department chair, whose role sees
--     aggregates only), only an instructor releases, and nobody grades a
--     student not enrolled here;
--   * nobody inserts, updates or deletes a grade row through the API, the
--     instructor included, and a change after release is a new version that
--     leaves the released one where it was;
--   * every mutation is idempotent on its key, and a key reused for another
--     request is refused;
--   * a regrade is filed by the student, answered once by a grader, and its
--     change is a draft until released;
--   * the registrar's export holds released grades only;
--   * passback queues nothing while the flag is off or a kill switch is
--     engaged, never an unreleased grade, and each released version once;
--   * grading authority is per term: every course grant here is on
--     `gb-u/ECON 1020/2026FA`, an instructor holding only 2027SP reads,
--     enters, moderates, releases, resolves, exports and queues nothing of
--     2026FA (and 2026FA's instructor nothing of 2027SP), a grant on the
--     untermed `gb-u/ECON 1020` authorises nothing at all — staff or roster —
--     and the registrar's school-wide export still reads released rows of
--     every term, and still no draft.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh gradebook

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
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
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

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null');
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

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- Refused *for want of the capability on this course and term* — not for a
-- missing draft, a used key or any other reason a broken fixture could give.
create or replace function pg_temp.denied(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%that needs grades:%' then
    raise exception 'FAILED: % — refused, but not for want of the grant: %', what, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- A value a statement returns as `who`, as text.
create or replace function pg_temp.ask(who uuid, q text)
returns text language plpgsql as $$
declare v text;
begin
  perform pg_temp.become(who);
  execute q into v;
  execute 'reset role';
  return v;
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
  prof uuid; coprof uuid; ta uuid; chair uuid; registrar uuid; other_prof uuid; elsewhere uuid;
  ana uuid; ben uuid; cal uuid; dual uuid;
  next_prof uuid; untermed uuid; dan uuid; eve uuid;
  ps1 uuid; mid uuid; req uuid; req2 uuid; sp1 uuid; n bigint;
  scheme constant text := $q$select public.gradebook_set_scheme('econ 1020', '2026FA',
      '[{"key":"problem-sets","name":"Problem sets","weight":40,"drop_lowest":1},
        {"key":"exams","name":"Exams","weight":60}]'::jsonb,
      '[{"letter":"A","min":90},{"letter":"B","min":80},{"letter":"C","min":70},{"letter":"D","min":60},{"letter":"F","min":0}]'::jsonb,
      false, 'scheme-v1-key')$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('gb-u', 'Gradebook University', array['gb-u.example']),
    ('gb-other', 'Other University', array['gb-other.example']);

  prof       := pg_temp.newuser('prof@gb-u.example', 'gb-u');
  coprof     := pg_temp.newuser('coprof@gb-u.example', 'gb-u');
  ta         := pg_temp.newuser('ta@gb-u.example', 'gb-u');
  chair      := pg_temp.newuser('chair@gb-u.example', 'gb-u');
  registrar  := pg_temp.newuser('registrar@gb-u.example', 'gb-u');
  other_prof := pg_temp.newuser('other@gb-u.example', 'gb-u');
  elsewhere  := pg_temp.newuser('prof@gb-other.example', 'gb-other');
  ana        := pg_temp.newuser('ana@gb-u.example', 'gb-u');
  ben        := pg_temp.newuser('ben@gb-u.example', 'gb-u');
  cal        := pg_temp.newuser('cal@gb-u.example', 'gb-u');
  -- A TA who is also taking the course: a grader, and on the roster.
  dual       := pg_temp.newuser('dual@gb-u.example', 'gb-u');

  -- Every course grant names its term: `<school>/<CODE>/<TERM>`.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,       'faculty',               'course', 'gb-u/ECON 1020/2026FA',     'institution'),
    (coprof,     'faculty',               'course', 'gb-u/ECON 1020/2026FA',     'institution'),
    (ta,         'teaching_assistant',    'course', 'gb-u/ECON 1020/2026FA',     'institution'),
    (chair,      'department_chair',      'school', 'gb-u',                      'institution'),
    (registrar,  'registrar',             'school', 'gb-u',                      'institution'),
    (other_prof, 'faculty',               'course', 'gb-u/HIST 2100/2026FA',     'institution'),
    (elsewhere,  'faculty',               'course', 'gb-other/ECON 1020/2026FA', 'institution'),
    (ana,        'undergraduate_student', 'course', 'gb-u/ECON 1020/2026FA',     'institution'),
    (ben,        'student',               'course', 'gb-u/ECON 1020/2026FA',     'institution'),
    (cal,        'undergraduate_student', 'course', 'gb-u/HIST 2100/2026FA',     'institution'),
    (dual,       'teaching_assistant',    'course', 'gb-u/ECON 1020/2026FA',     'institution'),
    (dual,       'graduate_student',      'course', 'gb-u/ECON 1020/2026FA',     'institution');

  -- ── The scheme ──────────────────────────────────────────────────────────
  perform pg_temp.said('the instructor sets the scheme, the code normalised', pg_temp.ask(prof, scheme), '1');
  perform pg_temp.said('the same key again answers the same version', pg_temp.ask(prof, scheme), '1');
  perform pg_temp.counted('and wrote one scheme', (select count(*) from public.gradebook_schemes), 1);
  perform pg_temp.refused('the same key for a different scheme', prof, replace(scheme, 'false,', 'true,'));
  perform pg_temp.refused('weights that sum to 90', prof,
    replace(replace(scheme, '"weight":60', '"weight":50'), 'scheme-v1-key', 'scheme-bad-key'));
  perform pg_temp.refused('a letter scale that stops above 0', prof,
    replace(replace(scheme, '"min":0', '"min":50'), 'scheme-v1-key', 'scheme-bad-letters'));
  perform pg_temp.refused('a TA setting the scheme', ta, replace(scheme, 'scheme-v1-key', 'scheme-ta-key'));
  perform pg_temp.refused('faculty on another course setting it', other_prof, replace(scheme, 'scheme-v1-key', 'scheme-other-key'));

  perform pg_temp.become(prof);
  ps1 := public.gradebook_add_item('ECON 1020', '2026FA', 'problem-sets', 'Problem set 1', 10, 'lti:ps1', 'item-ps1-key');
  mid := public.gradebook_add_item('ECON 1020', '2026FA', 'exams', 'Midterm', 100, null, 'item-mid-key');
  execute 'reset role';
  perform pg_temp.counted('the instructor adds two items', (select count(*) from public.gradebook_items), 2);
  perform pg_temp.refused('an item in a category the scheme lacks', prof,
    $q$select public.gradebook_add_item('ECON 1020', '2026FA', 'quizzes', 'Quiz', 5, null, 'item-quiz-key')$q$);
  perform pg_temp.counted('enrolled students read the items', pg_temp.seen(ana, 'select * from public.gradebook_items'), 2);
  perform pg_temp.counted('a student in another course does not', pg_temp.seen(cal, 'select * from public.gradebook_items'), 0);

  -- ── Entering ────────────────────────────────────────────────────────────
  perform pg_temp.said('the TA enters Ana''s problem set',
    pg_temp.ask(ta, format($q$select public.gradebook_enter(%L, %L, 9, null, 'Good', '', 'ta-ana-ps1-key')$q$, ps1, ana)), '1');
  perform pg_temp.said('the same call again is the same answer',
    pg_temp.ask(ta, format($q$select public.gradebook_enter(%L, %L, 9, null, 'Good', '', 'ta-ana-ps1-key')$q$, ps1, ana)), '1');
  perform pg_temp.counted('and wrote one row', (select count(*) from public.grade_entries), 1);
  perform pg_temp.refused('the same key with another score', ta,
    format($q$select public.gradebook_enter(%L, %L, 3, null, 'Good', '', 'ta-ana-ps1-key')$q$, ps1, ana));
  perform pg_temp.refused('the same key from somebody else', prof,
    format($q$select public.gradebook_enter(%L, %L, 9, null, 'Good', '', 'ta-ana-ps1-key')$q$, ps1, ana));
  perform pg_temp.works('the TA enters Ben''s', ta,
    format($q$select public.gradebook_enter(%L, %L, 6, null, 'See me', '', 'ta-ben-ps1-key')$q$, ps1, ben));

  perform pg_temp.refused('faculty on another course entering a grade here', other_prof,
    format($q$select public.gradebook_enter(%L, %L, 1, null, '', '', 'other-ana-key')$q$, ps1, ana));
  perform pg_temp.refused('faculty at another school, same course code', elsewhere,
    format($q$select public.gradebook_enter(%L, %L, 1, null, '', '', 'elsewhere-ana-key')$q$, ps1, ana));
  perform pg_temp.refused('the registrar entering a grade', registrar,
    format($q$select public.gradebook_enter(%L, %L, 1, null, '', '', 'registrar-ana-key')$q$, ps1, ana));
  perform pg_temp.refused('a student entering their own grade', ana,
    format($q$select public.gradebook_enter(%L, %L, 10, null, '', '', 'ana-self-key')$q$, ps1, ana));
  perform pg_temp.refused('a student entering a classmate''s', ana,
    format($q$select public.gradebook_enter(%L, %L, 0, null, '', '', 'ana-ben-key')$q$, ps1, ben));
  perform pg_temp.refused('a TA who is also enrolled entering their own grade', dual,
    format($q$select public.gradebook_enter(%L, %L, 10, null, '', '', 'dual-self-key')$q$, ps1, dual));
  perform pg_temp.refused('grading a student enrolled in another course', ta,
    format($q$select public.gradebook_enter(%L, %L, 5, null, '', '', 'ta-cal-key')$q$, ps1, cal));
  perform pg_temp.refused('a score above twice the points', ta,
    format($q$select public.gradebook_enter(%L, %L, 21, null, '', '', 'ta-ana-21-key')$q$, ps1, ana));
  perform pg_temp.refused('a score on excused work', ta,
    format($q$select public.gradebook_enter(%L, %L, 5, 'excused', '', '', 'ta-ana-ex-key')$q$, ps1, ana));
  perform pg_temp.refused('a key that is not one', ta,
    format($q$select public.gradebook_enter(%L, %L, 8, null, '', '', 'short')$q$, ps1, ana));
  perform pg_temp.counted('and none of the refusals wrote a row', (select count(*) from public.grade_entries), 2);

  -- ── Drafts are invisible to students ────────────────────────────────────
  perform pg_temp.counted('Ana sees none of her draft', pg_temp.seen(ana, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('Ben sees none of his', pg_temp.seen(ben, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('the instructor sees both drafts', pg_temp.seen(prof, 'select * from public.grade_entries'), 2);
  perform pg_temp.counted('the second instructor sees them', pg_temp.seen(coprof, 'select * from public.grade_entries'), 2);
  perform pg_temp.counted('the registrar sees no draft: export is of released grades', pg_temp.seen(registrar, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('the department chair sees none: aggregates only', pg_temp.seen(chair, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('faculty on another course see none', pg_temp.seen(other_prof, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('faculty at another school see none', pg_temp.seen(elsewhere, 'select * from public.grade_entries'), 0);

  -- ── Nobody writes a row directly ────────────────────────────────────────
  perform pg_temp.refused('the instructor updating a grade row', prof, 'update public.grade_entries set score = 10');
  perform pg_temp.refused('the instructor deleting one', prof, 'delete from public.grade_entries');
  perform pg_temp.refused('a student inserting a released grade', ana,
    format($q$insert into public.grade_entries (tenant_id, course_code, term, item_id, student_id, version, score, status, action, operation)
              values ('gb-u', 'ECON 1020', '2026FA', %L, %L, 9, 10, 'released', 'released', 'forged-key')$q$, ps1, ana));
  perform pg_temp.refused('the instructor writing a passback row', prof,
    format($q$insert into public.grade_passbacks (tenant_id, course_code, term, entry_id, item_id, student_id, line_item, score, points, operation)
              select tenant_id, course_code, term, id, item_id, student_id, 'x', 1, 1, 'forged' from public.grade_entries limit 1$q$));

  -- ── Moderation ──────────────────────────────────────────────────────────
  perform pg_temp.works('the instructor turns moderation on (scheme v2)', prof,
    replace(replace(scheme, 'false,', 'true,'), 'scheme-v1-key', 'scheme-v2-key'));
  perform pg_temp.refused('the TA moderating', ta,
    format($q$select public.gradebook_moderate(%L, %L, 'ta-mod-key')$q$, ps1, ana));
  perform pg_temp.refused('the department chair moderating', chair,
    format($q$select public.gradebook_moderate(%L, %L, 'chair-mod-key')$q$, ps1, ana));
  perform pg_temp.said('the second instructor moderates the TA''s grade of Ana',
    pg_temp.ask(coprof, format($q$select public.gradebook_moderate(%L, %L, 'coprof-mod-ana-key')$q$, ps1, ana)), '2');
  perform pg_temp.works('the instructor enters a midterm grade', prof,
    format($q$select public.gradebook_enter(%L, %L, 70, null, '', '', 'prof-ben-mid-key')$q$, mid, ben));
  perform pg_temp.refused('the instructor moderating their own grade', prof,
    format($q$select public.gradebook_moderate(%L, %L, 'prof-mod-self-key')$q$, mid, ben));

  -- ── Release ─────────────────────────────────────────────────────────────
  perform pg_temp.refused('the TA releasing', ta, format($q$select public.gradebook_release(%L, 'ta-release-key')$q$, ps1));
  perform pg_temp.refused('the chair releasing', chair, format($q$select public.gradebook_release(%L, 'chair-release-key')$q$, ps1));
  perform pg_temp.said('the instructor releases: Ana''s moderated grade goes, Ben''s draft is held',
    pg_temp.ask(prof, format($q$select public.gradebook_release(%L, 'release-ps1-key')::text$q$, ps1)), '{"held": 1, "released": 1}');
  perform pg_temp.said('and again with the key is the same answer, writing nothing',
    pg_temp.ask(prof, format($q$select public.gradebook_release(%L, 'release-ps1-key')::text$q$, ps1)), '{"held": 1, "released": 1}');
  perform pg_temp.counted('Ana now sees exactly one row, released',
    pg_temp.seen(ana, $q$select * from public.grade_entries where status = 'released' and score = 9$q$), 1);
  perform pg_temp.counted('and nothing else, of hers or anybody''s', pg_temp.seen(ana, 'select * from public.grade_entries'), 1);
  perform pg_temp.counted('Ben still sees nothing', pg_temp.seen(ben, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('Cal, in another course, sees nothing', pg_temp.seen(cal, 'select * from public.grade_entries'), 0);

  -- ── A change after release ──────────────────────────────────────────────
  perform pg_temp.refused('changing a released grade without a reason', prof,
    format($q$select public.gradebook_enter(%L, %L, 10, null, 'Good', '', 'prof-change-1-key')$q$, ps1, ana));
  perform pg_temp.said('with a reason it is version 4, a draft',
    pg_temp.ask(prof, format($q$select public.gradebook_enter(%L, %L, 10, null, 'Good', 'Recounted Q3', 'prof-change-2-key')$q$, ps1, ana)), '4');
  perform pg_temp.said('Ana still sees the released 9',
    pg_temp.ask(ana, 'select string_agg(score::text, '','') from public.grade_entries'), '9.000');

  -- ── Regrade ─────────────────────────────────────────────────────────────
  perform pg_temp.refused('Ben asking about a grade he was never shown', ben,
    format($q$select public.gradebook_file_regrade(%L, 'Please', 'ben-regrade-key')$q$, ps1));
  perform pg_temp.become(ana);
  req := public.gradebook_file_regrade(ps1, 'Question 4 matches the key', 'ana-regrade-key');
  execute 'reset role';
  perform pg_temp.counted('Ana files a regrade', (req is not null)::int, 1);
  perform pg_temp.refused('a second open request on the same item', ana,
    format($q$select public.gradebook_file_regrade(%L, 'Again', 'ana-regrade-2-key')$q$, ps1));
  perform pg_temp.refused('Ana resolving her own request', ana,
    format($q$select public.gradebook_resolve_regrade(%L, 'changed', 10, null, 'Yes', 'ana-resolve-key')$q$, req));
  perform pg_temp.refused('faculty on another course resolving it', other_prof,
    format($q$select public.gradebook_resolve_regrade(%L, 'upheld', null, null, 'No', 'other-resolve-key')$q$, req));
  perform pg_temp.works('the TA resolves it with a change', ta,
    format($q$select public.gradebook_resolve_regrade(%L, 'changed', 10, null, 'Q4 was right', 'ta-resolve-key')$q$, req));
  perform pg_temp.refused('resolving it a second time', prof,
    format($q$select public.gradebook_resolve_regrade(%L, 'upheld', null, null, 'No', 'prof-resolve-key')$q$, req));
  perform pg_temp.counted('Ana reads the answer', pg_temp.seen(ana, 'select * from public.regrade_resolutions'), 1);
  perform pg_temp.counted('Ben reads neither her request nor its answer',
    pg_temp.seen(ben, 'select * from public.regrade_requests') + pg_temp.seen(ben, 'select * from public.regrade_resolutions'), 0);
  perform pg_temp.said('the change is a regraded draft, so Ana still sees the 9',
    pg_temp.ask(ana, 'select string_agg(score::text, '','') from public.grade_entries'), '9.000');

  -- ── History ─────────────────────────────────────────────────────────────
  perform pg_temp.said('Ana''s grade is five versions, in order',
    (select string_agg(version || ':' || action || ':' || status || ':' || coalesce(score::text, '-'), ' ' order by version)
       from public.grade_entries where item_id = ps1 and student_id = ana),
    '1:entered:draft:9.000 2:moderated:moderated:9.000 3:released:released:9.000 4:changed:draft:10.000 5:regraded:draft:10.000');
  perform pg_temp.counted('the regraded version names the request it answers',
    (select count(*) from public.grade_entries where regrade_id = req and version = 5), 1);
  perform pg_temp.counted('every mutation left its key, and only the successful ones',
    (select count(*) from public.gradebook_operations where tenant_id = 'gb-u'), 12);

  -- ── The registrar ───────────────────────────────────────────────────────
  perform pg_temp.counted('the registrar reads released rows, and only those',
    pg_temp.seen(registrar, $q$select * from public.grade_entries where status <> 'released'$q$), 0);
  if pg_temp.seen(registrar, $q$select * from public.grade_entries where status = 'released'$q$) = 0 then
    raise exception 'FAILED: the registrar reads no released row';
  end if;
  raise notice 'ok  the registrar reads the released rows';
  perform pg_temp.said('the registrar''s export holds Ana''s released 9 and nothing unreleased',
    pg_temp.ask(registrar, $q$select string_agg(title || '=' || score::text, ',') from public.gradebook_export('ECON 1020', '2026FA')$q$),
    'Problem set 1=9.000');
  perform pg_temp.refused('the TA exporting', ta, $q$select * from public.gradebook_export('ECON 1020', '2026FA')$q$);
  perform pg_temp.refused('faculty on another course exporting', other_prof, $q$select * from public.gradebook_export('ECON 1020', '2026FA')$q$);
  perform pg_temp.refused('a student exporting', ana, $q$select * from public.gradebook_export('ECON 1020', '2026FA')$q$);

  -- ── Passback ────────────────────────────────────────────────────────────
  perform pg_temp.said('with the flag off nothing is queued, and it says so',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-1-key')->>'reason'$q$, ps1)), 'module-off');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values
    ('gb-u', 'integration.lms_lti', 'production');
  perform pg_temp.said('the module alone is not the flag',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-1-key')->>'reason'$q$, ps1)), 'flag-off');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values
    ('gb-u', 'writeback.lms_grade_passback', 'production');
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values
    (null, 'kill.writeback', true, 'check');
  perform pg_temp.said('kill.writeback stops it with both on',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-1-key')->>'reason'$q$, ps1)), 'kill-switch');
  perform pg_temp.counted('and nothing was queued while it was closed', (select count(*) from public.grade_passbacks), 0);
  update public.feature_kill_switch set engaged = false where switch_key = 'kill.writeback';
  -- The school's limits on the passback flag (20260929370000's
  -- feature_admits_caller): outside them it is off for this instructor.
  update public.tenant_feature_policy set permitted_roles = array['department_chair']
   where tenant_id = 'gb-u' and capability = 'writeback.lms_grade_passback';
  perform pg_temp.said('an instructor outside a role-limited passback pilot queues nothing',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-1-key')->>'reason'$q$, ps1)), 'flag-off');
  update public.tenant_feature_policy set permitted_roles = '{}', permitted_cohorts = array['passback-pilot']
   where tenant_id = 'gb-u' and capability = 'writeback.lms_grade_passback';
  perform pg_temp.said('or outside a cohort-limited one',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-1-key')->>'reason'$q$, ps1)), 'flag-off');
  perform pg_temp.counted('and the limits queued nothing', (select count(*) from public.grade_passbacks), 0);
  -- The control below: with both lists empty again, the same call queues.
  update public.tenant_feature_policy set permitted_cohorts = '{}'
   where tenant_id = 'gb-u' and capability = 'writeback.lms_grade_passback';
  perform pg_temp.refused('the TA queueing passback', ta,
    format($q$select public.gradebook_queue_passback(%L, 'passback-ta-key')$q$, ps1));
  perform pg_temp.said('with every gate open one grade is queued — Ana''s released one',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-1-key')->>'queued'$q$, ps1)), '1');
  perform pg_temp.said('it is the released version 3, score 9, never the drafts',
    (select e.version || ':' || p.score::text from public.grade_passbacks p join public.grade_entries e on e.id = p.entry_id), '3:9.000');
  perform pg_temp.said('a new key queues nothing more: that version is already queued',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-2-key')->>'queued'$q$, ps1)), '0');
  perform pg_temp.said('an item with no LMS column is not queued',
    pg_temp.ask(prof, format($q$select public.gradebook_queue_passback(%L, 'passback-mid-key')->>'reason'$q$, mid)), 'no-line-item');
  perform pg_temp.counted('Ana cannot see the queue', pg_temp.seen(ana, 'select * from public.grade_passbacks'), 0);
  perform pg_temp.counted('the instructor can', pg_temp.seen(prof, 'select * from public.grade_passbacks'), 1);
  perform pg_temp.refused('a signed-in account recording a passback', prof,
    $q$select public.gradebook_record_passback((select id from public.grade_passbacks limit 1), 'sent', '')$q$);
  execute 'set local role service_role';
  perform pg_temp.said('the sender records it sent',
    public.gradebook_record_passback((select id from public.grade_passbacks limit 1), 'sent', 'ok'), 'sent');
  perform pg_temp.said('and a late failure report does not unsend it',
    public.gradebook_record_passback((select id from public.grade_passbacks limit 1), 'failed', 'timeout'), 'already-sent');
  execute 'reset role';
  perform pg_temp.said('it stays sent', (select status from public.grade_passbacks), 'sent');

  -- ── Grading authority is per term ───────────────────────────────────────
  -- The same course, the next term: an instructor who teaches 2027SP only, a
  -- student enrolled in 2027SP only, and a faculty grant and a roster grant
  -- on the course with no term at all.
  next_prof := pg_temp.newuser('next@gb-u.example', 'gb-u');
  untermed  := pg_temp.newuser('untermed@gb-u.example', 'gb-u');
  dan       := pg_temp.newuser('dan@gb-u.example', 'gb-u');
  eve       := pg_temp.newuser('eve@gb-u.example', 'gb-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (next_prof, 'faculty',               'course', 'gb-u/ECON 1020/2027SP', 'institution'),
    (dan,       'undergraduate_student', 'course', 'gb-u/ECON 1020/2027SP', 'institution'),
    (untermed,  'faculty',               'course', 'gb-u/ECON 1020',        'institution'),
    (eve,       'undergraduate_student', 'course', 'gb-u/ECON 1020',        'institution');
  -- Ana asks again, so there is an open 2026FA request to try to resolve.
  perform pg_temp.become(ana);
  req2 := public.gradebook_file_regrade(ps1, 'And question 5', 'ana-regrade-3-key');
  execute 'reset role';

  -- Reading 2026FA as 2027SP's instructor, and on an untermed grant: nothing.
  perform pg_temp.counted('2027SP''s instructor reads no 2026FA grade',
    pg_temp.seen(next_prof, $q$select * from public.grade_entries where term = '2026FA'$q$), 0);
  perform pg_temp.counted('nor its scheme, items, requests, answers or passbacks',
    pg_temp.seen(next_prof, $q$select * from public.gradebook_schemes where term = '2026FA'$q$)
    + pg_temp.seen(next_prof, $q$select * from public.gradebook_items where term = '2026FA'$q$)
    + pg_temp.seen(next_prof, $q$select * from public.regrade_requests where term = '2026FA'$q$)
    + pg_temp.seen(next_prof, 'select * from public.regrade_resolutions')
    + pg_temp.seen(next_prof, $q$select * from public.grade_passbacks where term = '2026FA'$q$), 0);
  perform pg_temp.counted('an untermed faculty grant reads no grade, draft or released',
    pg_temp.seen(untermed, 'select * from public.grade_entries'), 0);
  perform pg_temp.counted('nor any scheme, item, request, answer or passback',
    pg_temp.seen(untermed, 'select * from public.gradebook_schemes')
    + pg_temp.seen(untermed, 'select * from public.gradebook_items')
    + pg_temp.seen(untermed, 'select * from public.regrade_requests')
    + pg_temp.seen(untermed, 'select * from public.regrade_resolutions')
    + pg_temp.seen(untermed, 'select * from public.grade_passbacks'), 0);
  perform pg_temp.counted('an untermed roster grant reads no scheme or item',
    pg_temp.seen(eve, 'select * from public.gradebook_schemes') + pg_temp.seen(eve, 'select * from public.gradebook_items'), 0);
  perform pg_temp.counted('a 2027SP student reads none of 2026FA''s items',
    pg_temp.seen(dan, 'select * from public.gradebook_items'), 0);
  -- The control: 2026FA's own instructor reads every version of it.
  if pg_temp.seen(prof, $q$select * from public.grade_entries where term = '2026FA' and status = 'draft'$q$) = 0 then
    raise exception 'FAILED: the control — 2026FA''s instructor reads no 2026FA draft';
  end if;
  raise notice 'ok  2026FA''s instructor still reads its drafts (the control)';

  -- Writing 2026FA as either: refused for want of the grant.
  perform pg_temp.denied('2027SP''s instructor setting 2026FA''s scheme', next_prof,
    replace(scheme, 'scheme-v1-key', 'scheme-next-fa-key'));
  perform pg_temp.denied('2027SP''s instructor adding a 2026FA item', next_prof,
    $q$select public.gradebook_add_item('ECON 1020', '2026FA', 'exams', 'Final', 100, null, 'item-next-fa-key')$q$);
  perform pg_temp.denied('2027SP''s instructor entering a 2026FA grade', next_prof,
    format($q$select public.gradebook_enter(%L, %L, 7, null, '', 'Recount', 'next-enter-fa-key')$q$, ps1, ana));
  perform pg_temp.denied('2027SP''s instructor moderating a 2026FA draft', next_prof,
    format($q$select public.gradebook_moderate(%L, %L, 'next-mod-fa-key')$q$, ps1, ana));
  perform pg_temp.denied('2027SP''s instructor releasing 2026FA grades', next_prof,
    format($q$select public.gradebook_release(%L, 'next-release-fa-key')$q$, ps1));
  perform pg_temp.denied('2027SP''s instructor resolving a 2026FA regrade', next_prof,
    format($q$select public.gradebook_resolve_regrade(%L, 'upheld', null, null, 'No', 'next-resolve-fa-key')$q$, req2));
  perform pg_temp.denied('2027SP''s instructor exporting 2026FA', next_prof,
    $q$select * from public.gradebook_export('ECON 1020', '2026FA')$q$);
  perform pg_temp.denied('2027SP''s instructor queueing 2026FA passback', next_prof,
    format($q$select public.gradebook_queue_passback(%L, 'next-passback-fa-key')$q$, ps1));
  perform pg_temp.denied('an untermed grant setting 2026FA''s scheme', untermed,
    replace(scheme, 'scheme-v1-key', 'scheme-untermed-key'));
  perform pg_temp.denied('an untermed grant setting 2027SP''s', untermed,
    replace(replace(scheme, 'scheme-v1-key', 'scheme-untermed-sp-key'), '2026FA', '2027SP'));
  perform pg_temp.denied('an untermed grant adding an item', untermed,
    $q$select public.gradebook_add_item('ECON 1020', '2026FA', 'exams', 'Final', 100, null, 'item-untermed-key')$q$);
  perform pg_temp.denied('an untermed grant entering a grade', untermed,
    format($q$select public.gradebook_enter(%L, %L, 7, null, '', 'Recount', 'untermed-enter-key')$q$, ps1, ana));
  perform pg_temp.denied('an untermed grant moderating', untermed,
    format($q$select public.gradebook_moderate(%L, %L, 'untermed-mod-key')$q$, ps1, ana));
  perform pg_temp.denied('an untermed grant releasing', untermed,
    format($q$select public.gradebook_release(%L, 'untermed-release-key')$q$, ps1));
  perform pg_temp.denied('an untermed grant resolving a regrade', untermed,
    format($q$select public.gradebook_resolve_regrade(%L, 'upheld', null, null, 'No', 'untermed-resolve-key')$q$, req2));
  perform pg_temp.denied('an untermed grant exporting', untermed,
    $q$select * from public.gradebook_export('ECON 1020', '2026FA')$q$);
  perform pg_temp.denied('an untermed grant queueing passback', untermed,
    format($q$select public.gradebook_queue_passback(%L, 'untermed-passback-key')$q$, ps1));
  perform pg_temp.refused('grading a student on an untermed roster grant', ta,
    format($q$select public.gradebook_enter(%L, %L, 5, null, '', '', 'ta-eve-key')$q$, ps1, eve));
  perform pg_temp.refused('grading a 2027SP student in 2026FA', ta,
    format($q$select public.gradebook_enter(%L, %L, 5, null, '', '', 'ta-dan-fa-key')$q$, ps1, dan));
  -- The control for each refusal: the same calls work for 2026FA's own staff.
  perform pg_temp.works('2026FA''s second instructor moderates the draft the others could not', coprof,
    format($q$select public.gradebook_moderate(%L, %L, 'coprof-mod-ana-2-key')$q$, ps1, ana));
  perform pg_temp.works('2026FA''s TA resolves the request the others could not', ta,
    format($q$select public.gradebook_resolve_regrade(%L, 'upheld', null, null, 'Q5 stands', 'ta-resolve-2-key')$q$, req2));
  perform pg_temp.works('2026FA''s instructor releases what the others could not', prof,
    format($q$select public.gradebook_release(%L, 'release-ps1-2-key')$q$, ps1));
  perform pg_temp.counted('and none of the refusals wrote a key',
    (select count(*) from public.gradebook_operations where idempotency_key like 'next-%' or idempotency_key like 'untermed-%'
       or idempotency_key in ('scheme-next-fa-key', 'scheme-untermed-key', 'scheme-untermed-sp-key', 'item-next-fa-key', 'item-untermed-key', 'ta-eve-key', 'ta-dan-fa-key')), 0);

  -- 2027SP, run by its own instructor, is as closed to 2026FA's.
  perform pg_temp.works('2027SP''s instructor sets 2027SP''s scheme', next_prof,
    replace(replace(scheme, 'scheme-v1-key', 'scheme-sp-key'), '2026FA', '2027SP'));
  perform pg_temp.become(next_prof);
  sp1 := public.gradebook_add_item('ECON 1020', '2027SP', 'exams', 'Spring midterm', 100, null, 'item-sp1-key');
  execute 'reset role';
  perform pg_temp.works('and grades a 2027SP student', next_prof,
    format($q$select public.gradebook_enter(%L, %L, 81, null, '', '', 'next-dan-sp1-key')$q$, sp1, dan));
  perform pg_temp.refused('but not a 2026FA student in 2027SP', next_prof,
    format($q$select public.gradebook_enter(%L, %L, 81, null, '', '', 'next-ana-sp1-key')$q$, sp1, ana));
  perform pg_temp.counted('2026FA''s instructor reads none of 2027SP''s draft',
    pg_temp.seen(prof, $q$select * from public.grade_entries where term = '2027SP'$q$), 0);
  perform pg_temp.denied('2026FA''s instructor entering a 2027SP grade', prof,
    format($q$select public.gradebook_enter(%L, %L, 50, null, '', '', 'prof-dan-sp1-key')$q$, sp1, dan));
  perform pg_temp.counted('Dan reads 2027SP''s item', pg_temp.seen(dan, 'select * from public.gradebook_items'), 1);
  perform pg_temp.counted('Ana, enrolled in 2026FA, does not',
    pg_temp.seen(ana, $q$select * from public.gradebook_items where term = '2027SP'$q$), 0);
  perform pg_temp.counted('the registrar reads no 2027SP draft',
    pg_temp.seen(registrar, $q$select * from public.grade_entries where term = '2027SP'$q$), 0);
  perform pg_temp.works('2027SP''s instructor releases it', next_prof,
    format($q$select public.gradebook_release(%L, 'next-release-sp1-key')$q$, sp1));

  -- The registrar's grant is the school's, and spans terms: released rows of
  -- both, and still no draft of either.
  perform pg_temp.counted('the registrar reads released rows of both terms',
    pg_temp.seen(registrar, $q$select distinct term from public.grade_entries where status = 'released'$q$), 2);
  perform pg_temp.counted('and still no unreleased row of either',
    pg_temp.seen(registrar, $q$select * from public.grade_entries where status <> 'released'$q$), 0);
  perform pg_temp.said('the registrar exports 2027SP',
    pg_temp.ask(registrar, $q$select string_agg(title || '=' || score::text, ',') from public.gradebook_export('ECON 1020', '2027SP')$q$),
    'Spring midterm=81.000');
  perform pg_temp.said('and 2026FA, with the same grant',
    pg_temp.ask(registrar, $q$select string_agg(title || '=' || score::text, ',') from public.gradebook_export('ECON 1020', '2026FA')$q$),
    'Problem set 1=10.000');
  perform pg_temp.counted('Dan sees his released 81 and nothing of 2026FA',
    pg_temp.seen(dan, 'select * from public.grade_entries'), 1);
end $$;

rollback;
