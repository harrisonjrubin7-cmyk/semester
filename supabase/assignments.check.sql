-- supabase/assignments.check.sql — who writes an assignment, who submits to
-- it, what a receipt proves, and that nothing submitted is ever rewritten.
--
-- For 20260930240000_assignments.sql. One course, ECON 1020 in 2026FA at
-- as-u, which has switched `lms_assignments` to Core: an instructor, a
-- second instructor, a teaching assistant, two enrolled students, a student
-- enrolled in another course, faculty on another course, and faculty at
-- another school whose course has the same code. A second school, as-conn,
-- has not switched the module and stays in Connect. What it proves:
--
--   * a draft is seen by course staff and by no student; a published
--     assignment by the roster and by no one outside it;
--   * only the course's instructors create, revise, publish, close and extend;
--     a TA reviews and does not author; a student does neither;
--   * nothing is written through the API at all — no insert, update or delete
--     on any table here, the instructor included — and a published assignment
--     cannot be revised;
--   * a student's submission is seen by that student and by course staff and
--     by nobody else, classmates included;
--   * a receipt is written with its version: the hash of the text, the time,
--     the due time that applied and whether it was late, and it reads back;
--   * a second version keeps the first, a copy of the latest is refused, and
--     so are a version past the cap and a second version where resubmission
--     is off;
--   * every mutation is idempotent on its key, and a key reused for another
--     request is refused, including for a submission;
--   * late is marked and accepted until the closing time, then refused; an
--     extension moves one student's due time and no other's, cannot move it
--     earlier, and needs a reason;
--   * a closed assignment takes nothing, and an extension does not reopen it;
--   * a school in Connect can do none of it, and neither can one whose module
--     is frozen or whose Core modules are paused by the kill switch — though
--     what was written stays readable;
--   * grants are per term: an instructor holding only 2027SP authors nothing
--     in 2026FA, and a grant on the untermed course authorises nothing.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh assignments

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

-- Refused with a message that names `why`, so a refusal is the rule's and not
-- some other error a broken fixture could give.
create or replace function pg_temp.refused_for(what text, who uuid, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
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
  prof uuid; coprof uuid; ta uuid; other_prof uuid; elsewhere uuid; next_prof uuid; untermed uuid;
  ana uuid; ben uuid; cal uuid; conn_prof uuid; conn_stu uuid;
  hw uuid; once uuid; draft uuid; old uuid; conn_hw uuid;
  ans jsonb; ans2 jsonb; n bigint; e text; sha text;
  future constant timestamptz := now() + interval '7 days';
  later  constant timestamptz := now() + interval '14 days';
begin
  insert into public.schools (id, name, email_domains) values
    ('as-u',    'Assignments University', array['as-u.example']),
    ('as-conn', 'Connect College',        array['as-conn.example']),
    ('as-other','Other University',       array['as-other.example']);

  prof       := pg_temp.newuser('prof@as-u.example', 'as-u');
  coprof     := pg_temp.newuser('coprof@as-u.example', 'as-u');
  ta         := pg_temp.newuser('ta@as-u.example', 'as-u');
  other_prof := pg_temp.newuser('other@as-u.example', 'as-u');
  next_prof  := pg_temp.newuser('next@as-u.example', 'as-u');
  untermed   := pg_temp.newuser('untermed@as-u.example', 'as-u');
  elsewhere  := pg_temp.newuser('prof@as-other.example', 'as-other');
  ana        := pg_temp.newuser('ana@as-u.example', 'as-u');
  ben        := pg_temp.newuser('ben@as-u.example', 'as-u');
  cal        := pg_temp.newuser('cal@as-u.example', 'as-u');
  conn_prof  := pg_temp.newuser('prof@as-conn.example', 'as-conn');
  conn_stu   := pg_temp.newuser('stu@as-conn.example', 'as-conn');

  -- Every course grant names its term: `<school>/<CODE>/<TERM>`.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,       'faculty',               'course', 'as-u/ECON 1020/2026FA',      'institution'),
    (coprof,     'faculty',               'course', 'as-u/ECON 1020/2026FA',      'institution'),
    (ta,         'teaching_assistant',    'course', 'as-u/ECON 1020/2026FA',      'institution'),
    (other_prof, 'faculty',               'course', 'as-u/HIST 2100/2026FA',      'institution'),
    (next_prof,  'faculty',               'course', 'as-u/ECON 1020/2027SP',      'institution'),
    (untermed,   'faculty',               'course', 'as-u/ECON 1020',             'institution'),
    (elsewhere,  'faculty',               'course', 'as-other/ECON 1020/2026FA',  'institution'),
    (ana,        'undergraduate_student', 'course', 'as-u/ECON 1020/2026FA',      'institution'),
    (ben,        'student',               'course', 'as-u/ECON 1020/2026FA',      'institution'),
    (cal,        'undergraduate_student', 'course', 'as-u/HIST 2100/2026FA',      'institution'),
    (conn_prof,  'faculty',               'course', 'as-conn/ECON 1020/2026FA',   'institution'),
    (conn_stu,   'student',               'course', 'as-conn/ECON 1020/2026FA',   'institution');

  -- ── The mode: Core at as-u, Connect at as-conn ────────────────────────────
  -- A control first: until the module is Core, the instructor is refused for
  -- the mode and for nothing else.
  perform pg_temp.refused_for('an instructor in a school still in Connect', prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Early', 'x', %L, null, true, 5, 'early-key-01')$q$, future),
    'has not switched assignments to Semester Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, reason)
  values ('as-u', 'lms_assignments', 'core', 'the check suite');

  -- ── Authoring ──────────────────────────────────────────────────────────────
  hw := pg_temp.ask(prof, format($q$select public.assignments_create(' econ 1020', '2026FA', 'Problem set 1', 'Do the first five.', %L, %L, true, 3, 'create-hw-key1')$q$, future, later))::uuid;
  perform pg_temp.counted('the instructor creates an assignment, the code normalised', (select count(*) from public.assignments where course_code = 'ECON 1020'), 1);
  perform pg_temp.said('the same key again answers the same id',
    pg_temp.ask(prof, format($q$select public.assignments_create(' econ 1020', '2026FA', 'Problem set 1', 'Do the first five.', %L, %L, true, 3, 'create-hw-key1')$q$, future, later)), hw::text);
  perform pg_temp.counted('and wrote one assignment and one event', (select count(*) from public.assignments) + (select count(*) from public.assignment_events), 2);
  perform pg_temp.refused('the same key for a different assignment', prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Something else', 'y', %L, %L, true, 3, 'create-hw-key1')$q$, future, later));
  perform pg_temp.refused('the same key from somebody else', coprof,
    format($q$select public.assignments_create(' econ 1020', '2026FA', 'Problem set 1', 'Do the first five.', %L, %L, true, 3, 'create-hw-key1')$q$, future, later));

  perform pg_temp.refused_for('a TA authoring', ta,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'TA sheet', 'x', %L, null, true, 5, 'ta-create-key1')$q$, future), 'assignments:author');
  perform pg_temp.refused_for('a student authoring', ana,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Self-set', 'x', %L, null, true, 5, 'ana-create-key')$q$, future), 'assignments:author');
  perform pg_temp.refused_for('faculty on another course authoring here', other_prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Not mine', 'x', %L, null, true, 5, 'other-create-key')$q$, future), 'assignments:author');
  -- Faculty at another school hold the same capability over their own
  -- ECON 1020, and everything here acts on the caller's own school: so they
  -- are refused for their school's mode, and cannot reach this school's row.
  perform pg_temp.refused_for('faculty at another school, same code, in their own Connect school', elsewhere,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Not mine', 'x', %L, null, true, 5, 'else-create-key')$q$, future), 'has not switched');
  perform pg_temp.refused_for('faculty at another school reaching this school''s assignment', elsewhere,
    format($q$select public.assignments_publish(%L, 'else-publish-key')$q$, hw), 'no such assignment here');
  perform pg_temp.refused_for('an instructor holding only 2027SP authoring 2026FA', next_prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Wrong term', 'x', %L, null, true, 5, 'next-create-key')$q$, future), 'assignments:author');
  perform pg_temp.refused_for('a grant on the untermed course authorising nothing', untermed,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Untermed', 'x', %L, null, true, 5, 'unterm-create-key')$q$, future), 'assignments:author');
  perform pg_temp.works('the same instructor authoring in their own term, a control', next_prof,
    format($q$select public.assignments_create('ECON 1020', '2027SP', 'Next term', 'x', %L, null, true, 5, 'next-create-ok1')$q$, future));
  perform pg_temp.refused('a close before the due time', prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Backwards', 'x', %L, %L, true, 5, 'backwards-key-1')$q$, later, future));
  perform pg_temp.refused('a blank title', prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', '   ', 'x', %L, null, true, 5, 'blank-title-key')$q$, future));
  perform pg_temp.refused('a term that is not one', prof,
    format($q$select public.assignments_create('ECON 1020', 'Fall 2026', 'Bad term', 'x', %L, null, true, 5, 'bad-term-key1')$q$, future));

  -- ── Who reads a draft ──────────────────────────────────────────────────────
  perform pg_temp.counted('the instructor reads the draft', pg_temp.seen(prof, 'select * from public.assignments where id = ''' || hw || ''''), 1);
  perform pg_temp.counted('the TA reads it too', pg_temp.seen(ta, 'select * from public.assignments where id = ''' || hw || ''''), 1);
  perform pg_temp.counted('an enrolled student does not', pg_temp.seen(ana, 'select * from public.assignments where id = ''' || hw || ''''), 0);
  perform pg_temp.refused_for('a student cannot submit to a draft', ana,
    format($q$select public.submissions_submit(%L, 'early work', 'ana-draft-key1')$q$, hw), 'no such assignment');

  -- ── Revising a draft, then publishing ──────────────────────────────────────
  perform pg_temp.works('the instructor revises the draft', prof,
    format($q$select public.assignments_revise(%L, 'Problem set 1', 'Do the first six.', %L, %L, true, 3, 'revise-hw-key1')$q$, hw, future, later));
  perform pg_temp.said('the revision is kept', (select instructions from public.assignments where id = hw), 'Do the first six.');
  perform pg_temp.counted('and its before is an event', (select count(*) from public.assignment_events where assignment_id = hw and action = 'revised' and detail->'before'->>'instructions' = 'Do the first five.'), 1);
  perform pg_temp.refused('a TA revising', ta,
    format($q$select public.assignments_revise(%L, 'Hijack', 'x', %L, null, true, 3, 'ta-revise-key1')$q$, hw, future));
  draft := pg_temp.ask(prof, format($q$select public.assignments_create('ECON 1020', '2026FA', 'Overdue draft', 'x', %L, null, true, 5, 'overdue-draft-k1')$q$, now() + interval '1 hour'))::uuid;
  update public.assignments set due_at = now() - interval '1 hour' where id = draft;
  perform pg_temp.refused_for('publishing one whose due time has passed', prof,
    format($q$select public.assignments_publish(%L, 'publish-late-key')$q$, draft), 'the due time has passed');
  perform pg_temp.refused('a TA publishing', ta, format($q$select public.assignments_publish(%L, 'ta-publish-key1')$q$, hw));
  perform pg_temp.works('the instructor publishing', prof, format($q$select public.assignments_publish(%L, 'publish-hw-key1')$q$, hw));
  perform pg_temp.works('the same key again', prof, format($q$select public.assignments_publish(%L, 'publish-hw-key1')$q$, hw));
  perform pg_temp.said('it is published', (select status from public.assignments where id = hw), 'published');
  perform pg_temp.refused_for('publishing it twice under a new key', prof,
    format($q$select public.assignments_publish(%L, 'publish-hw-key2')$q$, hw), 'only a draft can be published');
  perform pg_temp.refused_for('revising it once published', prof,
    format($q$select public.assignments_revise(%L, 'Edited', 'x', %L, null, true, 3, 'revise-hw-key2')$q$, hw, future), 'only a draft can be revised');

  -- ── Who reads a published one ──────────────────────────────────────────────
  perform pg_temp.counted('an enrolled student reads it', pg_temp.seen(ana, 'select * from public.assignments where id = ''' || hw || ''''), 1);
  perform pg_temp.counted('the other student does too', pg_temp.seen(ben, 'select * from public.assignments where id = ''' || hw || ''''), 1);
  perform pg_temp.counted('a student in another course does not', pg_temp.seen(cal, 'select * from public.assignments where id = ''' || hw || ''''), 0);
  perform pg_temp.counted('faculty at another school does not', pg_temp.seen(elsewhere, 'select * from public.assignments where id = ''' || hw || ''''), 0);
  perform pg_temp.counted('a student does not see a draft of the same course', pg_temp.seen(ana, 'select * from public.assignments where status = ''draft'''), 0);
  perform pg_temp.counted('the events are staff reading', pg_temp.seen(ana, 'select * from public.assignment_events'), 0);
  perform pg_temp.counted('and the TA sees them', pg_temp.seen(ta, 'select * from public.assignment_events where assignment_id = ''' || hw || ''''), 3);

  -- ── Submitting ─────────────────────────────────────────────────────────────
  ans := pg_temp.ask(ana, format($q$select public.submissions_submit(%L, 'Answer one.', 'ana-sub-key-01')$q$, hw))::jsonb;
  perform pg_temp.said('the first version is 1', ans->>'version', '1');
  perform pg_temp.said('on time', ans->>'late', 'false');
  perform pg_temp.counted('one receipt, matching', (select count(*) from public.submission_receipts r where r.receipt_code = ans->>'receipt' and r.student_id = ana), 1);
  sha := encode(sha256(convert_to('Answer one.', 'UTF8')), 'hex');
  perform pg_temp.said('the receipt holds the hash of the text', (select content_sha256 from public.submission_receipts where receipt_code = ans->>'receipt'), sha);
  perform pg_temp.said('and the due time that applied', (select due_at_then::text from public.submission_receipts where receipt_code = ans->>'receipt'), future::text);
  ans2 := pg_temp.ask(ana, format($q$select public.submissions_submit(%L, 'Answer one.', 'ana-sub-key-01')$q$, hw))::jsonb;
  perform pg_temp.said('the same key again is the same receipt', ans2->>'receipt', ans->>'receipt');
  perform pg_temp.counted('and wrote one version', (select count(*) from public.submission_versions), 1);
  perform pg_temp.refused('the same key for other work', ana,
    format($q$select public.submissions_submit(%L, 'Different.', 'ana-sub-key-01')$q$, hw));
  perform pg_temp.refused_for('a copy of the latest under a new key', ana,
    format($q$select public.submissions_submit(%L, 'Answer one.', 'ana-sub-key-02')$q$, hw), 'what you already submitted');
  perform pg_temp.said('a second version is 2', pg_temp.ask(ana, format($q$select (public.submissions_submit(%L, 'Answer two.', 'ana-sub-key-03'))->>'version'$q$, hw)), '2');
  perform pg_temp.counted('and the first is still there', (select count(*) from public.submission_versions where student_id = ana and version = 1 and body = 'Answer one.'), 1);
  perform pg_temp.said('a third', pg_temp.ask(ana, format($q$select (public.submissions_submit(%L, 'Answer three.', 'ana-sub-key-04'))->>'version'$q$, hw)), '3');
  perform pg_temp.refused_for('a fourth, past the cap of three', ana,
    format($q$select public.submissions_submit(%L, 'Answer four.', 'ana-sub-key-05')$q$, hw), 'at most 3 submissions');
  perform pg_temp.refused('a blank submission', ben, format($q$select public.submissions_submit(%L, '   ', 'ben-blank-key-1')$q$, hw));
  perform pg_temp.refused_for('the instructor submitting', prof,
    format($q$select public.submissions_submit(%L, 'Sneaky.', 'prof-sub-key-01')$q$, hw), 'only a student of this course');
  perform pg_temp.refused_for('a student of another course', cal,
    format($q$select public.submissions_submit(%L, 'Wrong class.', 'cal-sub-key-01')$q$, hw), 'only a student of this course');
  perform pg_temp.works('the other student submitting, a control', ben,
    format($q$select public.submissions_submit(%L, 'Ben''s answer.', 'ben-sub-key-01')$q$, hw));

  -- ── Who reads a submission ─────────────────────────────────────────────────
  perform pg_temp.counted('Ana reads her three versions', pg_temp.seen(ana, 'select * from public.submission_versions'), 3);
  perform pg_temp.counted('and her three receipts', pg_temp.seen(ana, 'select * from public.submission_receipts'), 3);
  perform pg_temp.counted('Ben reads only his one', pg_temp.seen(ben, 'select * from public.submission_versions'), 1);
  perform pg_temp.counted('Cal reads none', pg_temp.seen(cal, 'select * from public.submission_versions'), 0);
  perform pg_temp.counted('the instructor reads all four', pg_temp.seen(prof, 'select * from public.submission_versions'), 4);
  perform pg_temp.counted('the TA reads all four', pg_temp.seen(ta, 'select * from public.submission_versions'), 4);
  perform pg_temp.counted('the second instructor reads all four', pg_temp.seen(coprof, 'select * from public.submission_versions'), 4);
  perform pg_temp.counted('faculty on another course reads none', pg_temp.seen(other_prof, 'select * from public.submission_versions'), 0);
  perform pg_temp.counted('faculty holding only 2027SP reads none', pg_temp.seen(next_prof, 'select * from public.submission_versions'), 0);
  perform pg_temp.counted('a grant on the untermed course reads none', pg_temp.seen(untermed, 'select * from public.submission_versions'), 0);
  perform pg_temp.counted('faculty at another school reads none', pg_temp.seen(elsewhere, 'select * from public.submissions'), 0);

  -- ── Nothing is written through the API ─────────────────────────────────────
  perform pg_temp.refused('an instructor inserting an assignment', prof,
    format($q$insert into public.assignments (tenant_id, course_code, term, title, due_at, operation) values ('as-u', 'ECON 1020', '2026FA', 'Direct', %L, 'x')$q$, future));
  perform pg_temp.refused('an instructor updating a due time', prof, format($q$update public.assignments set due_at = %L where id = %L$q$, later, hw));
  perform pg_temp.refused('an instructor deleting an assignment', prof, format($q$delete from public.assignments where id = %L$q$, hw));
  perform pg_temp.refused('a student rewriting her own version', ana, $q$update public.submission_versions set body = 'Rewritten'$q$);
  perform pg_temp.refused('a student deleting her own version', ana, $q$delete from public.submission_versions$q$);
  perform pg_temp.refused('a student inserting a version directly', ana,
    format($q$insert into public.submission_versions (tenant_id, submission_id, assignment_id, student_id, version, body, content_sha256, due_at_then, late, operation) select 'as-u', id, assignment_id, student_id, 9, 'x', repeat('0', 64), %L, false, 'x' from public.submissions limit 1$q$, future));
  perform pg_temp.refused('a student editing a receipt', ana, $q$update public.submission_receipts set late = false$q$);
  perform pg_temp.refused('an instructor editing an event', prof, $q$update public.assignment_events set action = 'created'$q$);
  perform pg_temp.refused('an instructor inserting an extension', prof,
    format($q$insert into public.assignment_extensions (tenant_id, assignment_id, student_id, due_at, reason, operation) values ('as-u', %L, %L, %L, 'direct', 'x')$q$, hw, ana, later));
  perform pg_temp.said('nothing changed', (select instructions from public.assignments where id = hw), 'Do the first six.');

  -- ── Late, extensions and the closing time ──────────────────────────────────
  -- A fixture move, as the owner: the due time passes an hour ago and the
  -- assignment stops accepting work in a day. Rolled back with everything.
  once := pg_temp.ask(prof, format($q$select public.assignments_create('ECON 1020', '2026FA', 'Quiz one', 'One go.', %L, %L, false, 5, 'create-once-key')$q$, future, later))::uuid;
  perform pg_temp.works('publishing it', prof, format($q$select public.assignments_publish(%L, 'publish-once-key')$q$, once));
  update public.assignments set due_at = now() - interval '1 hour', closes_at = now() + interval '1 day' where id = once;
  ans := pg_temp.ask(ana, format($q$select public.submissions_submit(%L, 'Late but in.', 'ana-once-key-1')$q$, once))::jsonb;
  perform pg_temp.said('a submission after the due time is accepted', ans->>'version', '1');
  perform pg_temp.said('and marked late', ans->>'late', 'true');
  perform pg_temp.refused_for('a second version where resubmission is off', ana,
    format($q$select public.submissions_submit(%L, 'Try again.', 'ana-once-key-2')$q$, once), 'takes one submission');

  perform pg_temp.refused_for('an extension that is not later than what applies', prof,
    format($q$select public.assignments_extend(%L, %L, %L, null, 'illness', 'extend-ben-k-01')$q$, once, ben, now() - interval '2 hours'), 'must be later');
  perform pg_temp.refused_for('an extension with no reason', prof,
    format($q$select public.assignments_extend(%L, %L, %L, null, '  ', 'extend-ben-k-02')$q$, once, ben, now() + interval '2 hours'), 'needs a reason');
  perform pg_temp.refused_for('an extension for a student not enrolled here', prof,
    format($q$select public.assignments_extend(%L, %L, %L, null, 'illness', 'extend-cal-k-01')$q$, once, cal, now() + interval '2 hours'), 'not enrolled');
  perform pg_temp.refused_for('a TA granting an extension', ta,
    format($q$select public.assignments_extend(%L, %L, %L, null, 'illness', 'extend-ta-k-001')$q$, once, ben, now() + interval '2 hours'), 'assignments:author');
  perform pg_temp.works('the instructor extending Ben, to two hours from now', prof,
    format($q$select public.assignments_extend(%L, %L, %L, null, 'Hospital, note on file', 'extend-ben-k-03')$q$, once, ben, now() + interval '2 hours'));
  perform pg_temp.counted('the extension and its event are written', (select count(*) from public.assignment_extensions where student_id = ben) + (select count(*) from public.assignment_events where action = 'extended'), 2);
  ans := pg_temp.ask(ben, format($q$select public.submissions_submit(%L, 'Ben, within his extension.', 'ben-once-key-1')$q$, once))::jsonb;
  perform pg_temp.said('Ben is on time under his extension', ans->>'late', 'false');
  perform pg_temp.said('and the receipt shows the due time that applied to him', (select (due_at_then > now())::text from public.submission_receipts where receipt_code = ans->>'receipt'), 'true');
  perform pg_temp.said('Ana''s stays late', (select late::text from public.submission_receipts where student_id = ana and assignment_id = once), 'true');
  perform pg_temp.counted('Ben reads his own extension', pg_temp.seen(ben, 'select * from public.assignment_extensions'), 1);
  perform pg_temp.counted('Ana does not read it', pg_temp.seen(ana, 'select * from public.assignment_extensions'), 0);
  perform pg_temp.counted('the TA does', pg_temp.seen(ta, 'select * from public.assignment_extensions'), 1);

  -- The closing time passes: nothing more is taken.
  update public.assignments set closes_at = now() - interval '1 minute' where id = once;
  update public.assignment_extensions set due_at = now() - interval '30 minutes', closes_at = null where student_id = ben;
  perform pg_temp.refused_for('work after the closing time', ben,
    format($q$select public.submissions_submit(%L, 'Too late.', 'ben-once-key-2')$q$, once), 'stopped accepting');

  -- Closing by hand, and an extension that does not reopen it.
  perform pg_temp.refused('a TA closing', ta, format($q$select public.assignments_close(%L, 'ta-close-key-01')$q$, hw));
  perform pg_temp.works('the instructor closing the first assignment', prof, format($q$select public.assignments_close(%L, 'close-hw-key-01')$q$, hw));
  perform pg_temp.said('it is closed', (select status from public.assignments where id = hw), 'closed');
  perform pg_temp.refused_for('a closed assignment takes nothing', ben,
    format($q$select public.submissions_submit(%L, 'After close.', 'ben-closed-key1')$q$, hw), 'is closed');
  perform pg_temp.refused_for('an extension does not reopen it', prof,
    format($q$select public.assignments_extend(%L, %L, %L, null, 'illness', 'extend-closed-k1')$q$, hw, ben, now() + interval '30 days'), 'published assignment');
  perform pg_temp.refused_for('closing it twice', prof,
    format($q$select public.assignments_close(%L, 'close-hw-key-02')$q$, hw), 'only a published');
  perform pg_temp.counted('but a student still reads what they submitted', pg_temp.seen(ana, 'select * from public.submission_versions where assignment_id = ''' || hw || ''''), 3);

  -- ── The mode, the kill switch and a frozen module ──────────────────────────
  insert into public.assignments (tenant_id, course_code, term, title, due_at, status, operation, published_at)
  values ('as-u', 'ECON 1020', '2026FA', 'Probe', future, 'published', 'fixture', now()) returning id into old;
  perform pg_temp.works('a student submits, before the kill switch, a control', ben,
    format($q$select public.submissions_submit(%L, 'Before.', 'ben-probe-key1')$q$, old));
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values ('as-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('a submission while Core modules are paused', ana,
    format($q$select public.submissions_submit(%L, 'During.', 'ana-probe-key1')$q$, old), 'paused');
  perform pg_temp.refused_for('an instructor creating while they are paused', prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'During', 'x', %L, null, true, 5, 'pause-create-k1')$q$, future), 'paused');
  perform pg_temp.counted('what was written is still readable', pg_temp.seen(ben, 'select * from public.submission_versions'), 3);
  update public.feature_kill_switch set engaged = false where switch_key = 'kill.core_modules';
  perform pg_temp.works('submitting again once it is lifted, a control', ana,
    format($q$select public.submissions_submit(%L, 'After.', 'ana-probe-key2')$q$, old));
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'as-u' and module = 'lms_assignments';
  perform pg_temp.refused_for('a submission to a frozen module', ben,
    format($q$select public.submissions_submit(%L, 'Frozen.', 'ben-probe-key2')$q$, old), 'has not switched');
  perform pg_temp.counted('and what was written is still readable', pg_temp.seen(ben, 'select * from public.submission_versions'), 3);
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'as-u' and module = 'lms_assignments';

  -- A school in Connect can do none of it.
  perform pg_temp.refused_for('an instructor at a Connect school creating', conn_prof,
    format($q$select public.assignments_create('ECON 1020', '2026FA', 'Connect', 'x', %L, null, true, 5, 'conn-create-key')$q$, future), 'has not switched');
  insert into public.assignments (tenant_id, course_code, term, title, due_at, status, operation, published_at)
  values ('as-conn', 'ECON 1020', '2026FA', 'In Connect', future, 'published', 'fixture', now()) returning id into conn_hw;
  perform pg_temp.refused_for('a student at a Connect school submitting', conn_stu,
    format($q$select public.submissions_submit(%L, 'Hello.', 'conn-sub-key-01')$q$, conn_hw), 'has not switched');

  -- ── The idempotency ledger ─────────────────────────────────────────────────
  perform pg_temp.counted('a caller reads their own operations only', pg_temp.seen(ana, 'select * from public.assignment_operations'), 5);
end $$;

rollback;
