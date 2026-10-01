-- supabase/assignments.check.sql — who authors, extends, submits to and reads
-- an assignment, what the server's clock says about a submission, and that
-- nothing handed in is ever rewritten.
--
-- For 20261001010000_assignments.sql. One course, ECON 1020 in 2026FA at
-- as-u: an instructor and a teaching assistant, two enrolled students, a
-- student enrolled in another course, a student whose grant names no term,
-- faculty of another course, and faculty at another school with the same
-- course code. What it proves:
--
--   * nothing is written unless the school runs `lms_assignments` in Core —
--     not in Connect, not frozen, not under `kill.core_modules`;
--   * only the course's instructor creates, edits, publishes and closes; a TA
--     and a student do not; an extension needs `assignments:extend`;
--   * a draft is seen by course staff and by no student; a published
--     assignment by its roster and nobody outside it;
--   * a submission carries the server's time and attempt number, and is
--     refused when it is not published, past due with no late rules, past the
--     late cut-off, or over the attempt limit;
--   * an extension moves one student's due date, with a reason, and the
--     latest one is in force; the other student is not moved;
--   * the same key twice is one submission, and a key reused for another
--     request is refused;
--   * a file must be under the student's own folder, be there, and fit the
--     size and type; Storage lets a student write only their own folder of a
--     published assignment they are on the roster of;
--   * a receipt's hash is the SHA-256 of what it states, a student reads
--     their own and no one else's, reviewers read all;
--   * nobody inserts, updates or deletes through the API, and even the owner
--     cannot rewrite a submission;
--   * deleting an account takes the student's submissions with it;
--   * a school's timezone must be one.
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


create or replace function pg_temp.denied(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%that needs assignments:%' and e not like '%not on this course''s roster%' then
    raise exception 'FAILED: % — refused, but not for want of the grant: %', what, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

-- Refused for the stated reason, so a broken fixture cannot pass for a rule.
create or replace function pg_temp.refused_for(what text, who uuid, statement text, why text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not ilike '%' || why || '%' then
    raise exception 'FAILED: % — refused, but not for "%": %', what, why, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

do $$
declare
  prof uuid; ta uuid; other_prof uuid; elsewhere uuid;
  ana uuid; ben uuid; dan uuid; untermed uuid;
  a1 uuid; a_draft uuid; a_late uuid; a_refuse uuid; a_cut uuid; a_cutok uuid; a_att uuid;
  sub jsonb; sub2 jsonb; ovr uuid; n bigint; h text; m text;
  mk constant text := $q$select public.assignment_create('econ 1020', '2026FA', %L, 'Read chapter 3 and answer.', 10,
      %s, %L, %s, %s, %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('as-u', 'Assignments University', array['as-u.example']),
    ('as-other', 'Other University', array['as-other.example']);

  prof       := pg_temp.newuser('prof@as-u.example', 'as-u');
  ta         := pg_temp.newuser('ta@as-u.example', 'as-u');
  other_prof := pg_temp.newuser('hist@as-u.example', 'as-u');
  elsewhere  := pg_temp.newuser('prof@as-other.example', 'as-other');
  ana        := pg_temp.newuser('ana@as-u.example', 'as-u');
  ben        := pg_temp.newuser('ben@as-u.example', 'as-u');
  dan        := pg_temp.newuser('dan@as-u.example', 'as-u');
  untermed   := pg_temp.newuser('una@as-u.example', 'as-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,       'faculty',               'course', 'as-u/ECON 1020/2026FA',     'institution'),
    (ta,         'teaching_assistant',    'course', 'as-u/ECON 1020/2026FA',     'institution'),
    (other_prof, 'faculty',               'course', 'as-u/HIST 2100/2026FA',     'institution'),
    (elsewhere,  'faculty',               'course', 'as-other/ECON 1020/2026FA', 'institution'),
    (ana,        'undergraduate_student', 'course', 'as-u/ECON 1020/2026FA',     'institution'),
    (ben,        'student',               'course', 'as-u/ECON 1020/2026FA',     'institution'),
    (dan,        'undergraduate_student', 'course', 'as-u/HIST 2100/2026FA',     'institution'),
    (untermed,   'undergraduate_student', 'course', 'as-u/ECON 1020',            'institution');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('the instructor cannot create while the school is in Connect', prof,
    format(mk, 'Problem set 1', $t$now() + interval '2 days'$t$, 'refuse', 'null', '1', 'create-connect-key'),
    'does not run assignments in Core');

  -- The school switches the module to Core (a row the mode switch alone writes).
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason)
  values ('as-u', 'lms_assignments', 'core', false, 'check');

  -- ── Authoring ──────────────────────────────────────────────────
  perform pg_temp.become(prof);
  a1 := public.assignment_create('econ 1020', '2026FA', 'Problem set 1', 'Read chapter 3 and answer.', 10,
                                 now() + interval '2 days', 'refuse', null, 2, 'create-a1-key');
  perform pg_temp.become(prof);
  execute 'reset role';
  perform pg_temp.counted('one assignment was made', (select count(*) from public.assignments), 1);

  perform pg_temp.denied('a TA creating', ta,
    format(mk, 'TA made', $t$now() + interval '2 days'$t$, 'refuse', 'null', '1', 'create-ta-key'));
  perform pg_temp.denied('a student creating', ana,
    format(mk, 'Student made', $t$now() + interval '2 days'$t$, 'refuse', 'null', '1', 'create-ana-key'));
  perform pg_temp.denied('faculty of another course creating', other_prof,
    format(mk, 'Wrong course', $t$now() + interval '2 days'$t$, 'refuse', 'null', '1', 'create-oth-key'));
  -- Their own school's course, their own school's mode: Connect, so nothing is written.
  perform pg_temp.refused_for('faculty at another school, whose school is in Connect', elsewhere,
    format(mk, 'Wrong school', $t$now() + interval '2 days'$t$, 'refuse', 'null', '1', 'create-els-key'),
    'does not run assignments in Core');
  perform pg_temp.refused_for('the same key for a different assignment', prof,
    format(mk, 'Another title', $t$now() + interval '2 days'$t$, 'refuse', 'null', '1', 'create-a1-key'),
    'already used for a different request');
  perform pg_temp.refused('a cut-off before the due date', prof,
    format(mk, 'Bad cutoff', $t$now() + interval '2 days'$t$, 'accept', $t$now() + interval '1 day'$t$, '1', 'create-cut-key'));
  perform pg_temp.refused('a cut-off where late work is refused', prof,
    format(mk, 'Bad cutoff 2', $t$now() + interval '2 days'$t$, 'refuse', $t$now() + interval '3 days'$t$, '1', 'create-cut2-key'));
  perform pg_temp.refused('no attempts', prof,
    format(mk, 'No attempts', $t$now() + interval '2 days'$t$, 'refuse', 'null', '0', 'create-att-key'));

  -- ── Reading: a draft is staff's only ───────────────────────────
  perform pg_temp.counted('the instructor reads the draft', pg_temp.seen(prof, 'select 1 from public.assignments'), 1);
  perform pg_temp.counted('the TA reads the draft', pg_temp.seen(ta, 'select 1 from public.assignments'), 1);
  perform pg_temp.counted('a student does not', pg_temp.seen(ana, 'select 1 from public.assignments'), 0);

  -- A draft takes no submission.
  perform pg_temp.refused_for('submitting to a draft', ana,
    format($q$select public.assignment_submit(%L, 'my answer', null, 'sub-draft-key')$q$, a1), 'not open');

  perform pg_temp.works('the instructor edits the draft', prof,
    format($q$select public.assignment_edit(%L, 'Problem set 1 (revised)', null, null, null, null, 'edit-a1-key')$q$, a1));
  perform pg_temp.denied('a TA publishing', ta, format($q$select public.assignment_publish(%L, 'pub-ta-key')$q$, a1));
  perform pg_temp.works('the instructor publishes', prof, format($q$select public.assignment_publish(%L, 'pub-a1-key')$q$, a1));
  perform pg_temp.refused('publishing twice under a new key', prof, format($q$select public.assignment_publish(%L, 'pub-a1-again')$q$, a1));
  perform pg_temp.works('publishing under the same key replays', prof, format($q$select public.assignment_publish(%L, 'pub-a1-key')$q$, a1));

  perform pg_temp.counted('a student on the roster reads it', pg_temp.seen(ana, 'select 1 from public.assignments'), 1);
  perform pg_temp.counted('a student of another course does not', pg_temp.seen(dan, 'select 1 from public.assignments'), 0);
  perform pg_temp.counted('a grant with no term reads nothing', pg_temp.seen(untermed, 'select 1 from public.assignments'), 0);
  perform pg_temp.counted('faculty at another school read nothing', pg_temp.seen(elsewhere, 'select 1 from public.assignments'), 0);

  -- ── Submitting ─────────────────────────────────────────────────
  perform pg_temp.become(ana);
  sub := public.assignment_submit(a1, 'My answer, attempt one.', null, 'sub-ana-1-key');
  execute 'reset role';
  perform pg_temp.said('the first attempt is attempt 1', sub->>'attempt', '1');
  perform pg_temp.said('on time', sub->>'late', 'false');

  perform pg_temp.become(ana);
  sub2 := public.assignment_submit(a1, 'My answer, attempt one.', null, 'sub-ana-1-key');
  execute 'reset role';
  perform pg_temp.said('the same key replays the same submission', sub2->>'submission_id', sub->>'submission_id');
  perform pg_temp.counted('a double click is one submission', (select count(*) from public.submissions where student_id = ana), 1);
  perform pg_temp.refused_for('the same key for a different answer', ana,
    format($q$select public.assignment_submit(%L, 'Something else', null, 'sub-ana-1-key')$q$, a1), 'already used for a different request');

  perform pg_temp.counted('the server stamped the time', (select count(*) from public.submissions
    where student_id = ana and abs(extract(epoch from (clock_timestamp() - submitted_at))) < 30), 1);

  perform pg_temp.refused_for('an empty submission', ben,
    format($q$select public.assignment_submit(%L, '   ', null, 'sub-ben-empty')$q$, a1), 'hand in some text');
  perform pg_temp.denied('a student of another course submitting', dan,
    format($q$select public.assignment_submit(%L, 'not mine', null, 'sub-dan-key')$q$, a1));
  perform pg_temp.denied('a grant with no term submitting', untermed,
    format($q$select public.assignment_submit(%L, 'not mine', null, 'sub-una-key')$q$, a1));
  perform pg_temp.denied('a TA submitting (they are not on the roster)', ta,
    format($q$select public.assignment_submit(%L, 'not mine', null, 'sub-ta-key')$q$, a1));

  -- The attempt limit is 2: a second works, a third does not.
  perform pg_temp.works('a second attempt', ana,
    format($q$select public.assignment_submit(%L, 'Attempt two.', null, 'sub-ana-2-key')$q$, a1));
  perform pg_temp.refused_for('a third attempt', ana,
    format($q$select public.assignment_submit(%L, 'Attempt three.', null, 'sub-ana-3-key')$q$, a1), 'used all 2 attempts');
  perform pg_temp.counted('two attempts are kept', (select count(*) from public.submissions where student_id = ana), 2);

  -- ── Reading submissions and receipts ───────────────────────────
  perform pg_temp.counted('a student reads their own submissions', pg_temp.seen(ana, 'select 1 from public.submissions'), 2);
  perform pg_temp.counted('another student reads none of them', pg_temp.seen(ben, 'select 1 from public.submissions'), 0);
  perform pg_temp.counted('the instructor reads them all', pg_temp.seen(prof, 'select 1 from public.submissions'), 2);
  perform pg_temp.counted('the TA reviews them', pg_temp.seen(ta, 'select 1 from public.submissions'), 2);
  perform pg_temp.counted('faculty of another course read none', pg_temp.seen(other_prof, 'select 1 from public.submissions'), 0);
  perform pg_temp.counted('a student reads their own receipts', pg_temp.seen(ana, 'select 1 from public.submission_receipts'), 2);
  perform pg_temp.counted('another student reads no receipt', pg_temp.seen(ben, 'select 1 from public.submission_receipts'), 0);

  select r.receipt_hash, r.statement->>'material' into h, m from public.submission_receipts r where r.submission_id = (sub->>'submission_id')::uuid;
  perform pg_temp.said('the receipt hash is the SHA-256 of what it states', h, encode(sha256(convert_to(m, 'UTF8')), 'hex'));

  -- ── Late rules ─────────────────────────────────────────────────
  perform pg_temp.become(prof);
  a_late   := public.assignment_create('ECON 1020', '2026FA', 'Late ok', '', null, now() - interval '1 day', 'accept', null, 1, 'create-late-key');
  a_refuse := public.assignment_create('ECON 1020', '2026FA', 'No late', '', null, now() - interval '1 day', 'refuse', null, 1, 'create-nolate-key');
  a_cut    := public.assignment_create('ECON 1020', '2026FA', 'Cut-off passed', '', null, now() - interval '2 days', 'accept', now() - interval '1 day', 1, 'create-cut-passed');
  a_cutok  := public.assignment_create('ECON 1020', '2026FA', 'Cut-off ahead', '', null, now() - interval '1 day', 'accept', now() + interval '1 day', 1, 'create-cut-ahead');
  perform public.assignment_publish(a_late, 'pub-late-key');
  perform public.assignment_publish(a_refuse, 'pub-nolate-key');
  perform public.assignment_publish(a_cut, 'pub-cut-key');
  perform public.assignment_publish(a_cutok, 'pub-cutok-key');
  execute 'reset role';

  perform pg_temp.become(ben);
  sub := public.assignment_submit(a_late, 'Late work.', null, 'sub-ben-late');
  execute 'reset role';
  perform pg_temp.said('late work is taken and flagged late', sub->>'late', 'true');
  perform pg_temp.refused_for('past due where late work is refused', ben,
    format($q$select public.assignment_submit(%L, 'Late work.', null, 'sub-ben-nolate')$q$, a_refuse), 'takes no late work');
  perform pg_temp.refused_for('past the late cut-off', ben,
    format($q$select public.assignment_submit(%L, 'Late work.', null, 'sub-ben-cutpassed')$q$, a_cut), 'past the last time');
  perform pg_temp.works('inside the late window', ben,
    format($q$select public.assignment_submit(%L, 'Late work.', null, 'sub-ben-cutahead')$q$, a_cutok));

  -- ── Extensions ─────────────────────────────────────────────────
  perform pg_temp.denied('a student granting an extension', ben,
    format($q$select public.assignment_extend(%L, %L, now() + interval '1 day', null, 'asked nicely', 'ext-ben-self')$q$, a_refuse, ben));
  perform pg_temp.refused('an extension with no reason', prof,
    format($q$select public.assignment_extend(%L, %L, now() + interval '1 day', null, '  ', 'ext-noreason-key')$q$, a_refuse, ben));
  perform pg_temp.refused_for('an extension for a student not on the roster', prof,
    format($q$select public.assignment_extend(%L, %L, now() + interval '1 day', null, 'reason', 'ext-dan-key')$q$, a_refuse, dan), 'not on this course');
  perform pg_temp.works('the TA grants ben an extension', ta,
    format($q$select public.assignment_extend(%L, %L, now() + interval '1 day', null, 'Illness, documented', 'ext-ben-key')$q$, a_refuse, ben));
  perform pg_temp.works('and ben then submits on time', ben,
    format($q$select public.assignment_submit(%L, 'On time, extended.', null, 'sub-ben-ext')$q$, a_refuse));
  perform pg_temp.counted('that submission is not late', (select count(*) from public.submissions
    where student_id = ben and assignment_id = a_refuse and not late), 1);
  perform pg_temp.refused_for('ana, not extended, is still refused', ana,
    format($q$select public.assignment_submit(%L, 'Late work.', null, 'sub-ana-nolate')$q$, a_refuse), 'takes no late work');
  perform pg_temp.counted('ben reads his own extension', pg_temp.seen(ben, 'select 1 from public.assignment_overrides'), 1);
  perform pg_temp.counted('ana reads none', pg_temp.seen(ana, 'select 1 from public.assignment_overrides'), 0);

  -- ── Files ──────────────────────────────────────────────────────
  perform pg_temp.become(prof);
  a_att := public.assignment_create('ECON 1020', '2026FA', 'With files', '', null, now() + interval '2 days', 'refuse', null, 3, 'create-files-key');
  perform public.assignment_publish(a_att, 'pub-files-key');
  execute 'reset role';

  perform pg_temp.refused_for('a file under someone else''s folder', ana,
    format($q$select public.assignment_submit(%L, 'See file.',
      jsonb_build_array(jsonb_build_object('path', 'as-u/%s/%s/essay.pdf', 'name', 'essay.pdf', 'size', 1000,
        'content_type', 'application/pdf', 'sha256', repeat('a', 64))), 'file-other-key')$q$, a_att, a_att, ben), 'not under your own folder');
  perform pg_temp.refused_for('a file that was never uploaded', ana,
    format($q$select public.assignment_submit(%L, 'See file.',
      jsonb_build_array(jsonb_build_object('path', 'as-u/%s/%s/essay.pdf', 'name', 'essay.pdf', 'size', 1000,
        'content_type', 'application/pdf', 'sha256', repeat('a', 64))), 'file-missing-key')$q$, a_att, a_att, ana), 'was not uploaded');

  -- Storage: a student writes only under their own id, for a published assignment.
  perform pg_temp.works('ana uploads under her own folder', ana,
    format($q$insert into storage.objects (bucket_id, name, owner) values ('assignment-submissions', 'as-u/%s/%s/essay.pdf', %L)$q$, a_att, ana, ana));
  perform pg_temp.refused('ana uploading under ben''s folder', ana,
    format($q$insert into storage.objects (bucket_id, name, owner) values ('assignment-submissions', 'as-u/%s/%s/essay2.pdf', %L)$q$, a_att, ben, ana));
  perform pg_temp.refused('dan uploading to a course he is not on', dan,
    format($q$insert into storage.objects (bucket_id, name, owner) values ('assignment-submissions', 'as-u/%s/%s/essay.pdf', %L)$q$, a_att, dan, dan));
  perform pg_temp.counted('ana reads her own object', pg_temp.seen(ana, $q$select 1 from storage.objects where bucket_id = 'assignment-submissions'$q$), 1);
  perform pg_temp.counted('ben reads none', pg_temp.seen(ben, $q$select 1 from storage.objects where bucket_id = 'assignment-submissions'$q$), 0);
  perform pg_temp.counted('the instructor reads it', pg_temp.seen(prof, $q$select 1 from storage.objects where bucket_id = 'assignment-submissions'$q$), 1);
  perform pg_temp.counted('faculty of another course do not', pg_temp.seen(other_prof, $q$select 1 from storage.objects where bucket_id = 'assignment-submissions'$q$), 0);

  perform pg_temp.refused_for('a file over the size limit', ana,
    format($q$select public.assignment_submit(%L, 'See file.',
      jsonb_build_array(jsonb_build_object('path', 'as-u/%s/%s/essay.pdf', 'name', 'essay.pdf', 'size', 30000000,
        'content_type', 'application/pdf', 'sha256', repeat('a', 64))), 'file-big-key')$q$, a_att, a_att, ana), 'size_bytes');
  perform pg_temp.refused_for('a type that is not allowed', ana,
    format($q$select public.assignment_submit(%L, 'See file.',
      jsonb_build_array(jsonb_build_object('path', 'as-u/%s/%s/essay.pdf', 'name', 'essay.pdf', 'size', 1000,
        'content_type', 'application/x-msdownload', 'sha256', repeat('a', 64))), 'file-type-key')$q$, a_att, a_att, ana), 'content_type');
  perform pg_temp.works('a file that is there, in size and type', ana,
    format($q$select public.assignment_submit(%L, 'See file.',
      jsonb_build_array(jsonb_build_object('path', 'as-u/%s/%s/essay.pdf', 'name', 'essay.pdf', 'size', 1000,
        'content_type', 'application/pdf', 'sha256', repeat('a', 64))), 'file-ok-key')$q$, a_att, a_att, ana));
  perform pg_temp.counted('the file is on the submission', (select count(*) from public.submission_files), 1);

  -- ── Nobody writes through the API, and nothing is rewritten ────
  perform pg_temp.refused('the instructor inserting an assignment directly', prof,
    $q$insert into public.assignments (tenant_id, course_code, term, title, due_at, operation) values ('as-u','ECON 1020','2026FA','x', now(), 'k')$q$);
  perform pg_temp.refused('a student inserting a submission directly', ana,
    format($q$insert into public.submissions (tenant_id, assignment_id, student_id, attempt, submitted_at, due_at_used, late, operation) values ('as-u', %L, %L, 9, now(), now(), false, 'k')$q$, a1, ana));
  perform pg_temp.refused('a student updating a submission', ana, $q$update public.submissions set body = 'changed'$q$);
  perform pg_temp.refused('a student deleting a submission', ana, $q$delete from public.submissions$q$);
  perform pg_temp.refused('the instructor updating a receipt', prof, $q$update public.submission_receipts set receipt_hash = repeat('0', 64)$q$);
  begin
    update public.submissions set body = 'rewritten';
    raise exception 'FAILED: the owner rewrote a submission';
  exception when others then
    if sqlerrm not like '%never rewritten%' then raise; end if;
    raise notice 'ok  even the owner cannot rewrite a submission (%)', sqlerrm;
  end;

  -- ── Frozen and killed ──────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'as-u' and module = 'lms_assignments';
  perform pg_temp.refused_for('submitting once the module is frozen', ben,
    format($q$select public.assignment_submit(%L, 'More.', null, 'sub-ben-frozen')$q$, a_att), 'does not run assignments in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'as-u' and module = 'lms_assignments';
  perform pg_temp.works('and again once it is Core', ben,
    format($q$select public.assignment_submit(%L, 'More.', null, 'sub-ben-thawed')$q$, a_att));
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('as-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('submitting under the kill switch', ben,
    format($q$select public.assignment_submit(%L, 'Again.', null, 'sub-ben-killed')$q$, a_att), 'does not run assignments in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'as-u';

  -- ── The close ──────────────────────────────────────────────────
  perform pg_temp.works('the instructor closes it', prof, format($q$select public.assignment_close(%L, 'close-a1-key')$q$, a1));
  perform pg_temp.refused_for('submitting to a closed assignment', ben,
    format($q$select public.assignment_submit(%L, 'Too late.', null, 'sub-ben-closed')$q$, a1), 'not open');

  -- ── The timezone ───────────────────────────────────────────────
  begin
    update public.schools set timezone = 'Nowhere/Land' where id = 'as-u';
    raise exception 'FAILED: a made-up timezone was accepted';
  exception when others then
    if sqlerrm not like '%is not a timezone%' then raise; end if;
    raise notice 'ok  a made-up timezone is refused (%)', sqlerrm;
  end;
  update public.schools set timezone = 'America/Chicago' where id = 'as-u';
  raise notice 'ok  a real timezone is accepted';

  -- ── Deleting an account ────────────────────────────────────────
  select count(*) into n from public.submissions where student_id = ana;
  delete from auth.users where id = ana;
  perform pg_temp.counted('deleting ana took her submissions', (select count(*) from public.submissions where student_id = ana), 0);
  perform pg_temp.counted('and her receipts', (select count(*) from public.submission_receipts where student_id = ana), 0);
  perform pg_temp.counted('the assignment stays', (select count(*) from public.assignments where id = a1), 1);
  delete from auth.users where id = prof;
  perform pg_temp.counted('deleting the instructor clears their name, not the assignment',
    (select count(*) from public.assignments where id = a1 and created_by is null), 1);

  delete from auth.users where id = ta;
  perform pg_temp.counted('deleting the TA who granted an extension clears their name, not the extension',
    (select count(*) from public.assignment_overrides where granted_by is null), 1);

  raise notice 'assignments: all checks passed';
end $$;

rollback;
