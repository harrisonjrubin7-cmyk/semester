-- supabase/gradebook-due-dates.check.sql — who sets a gradebook item's due
-- date, and which date each student's work is due once an extension is
-- approved.
--
-- For 20261021130000_gradebook_due_dates.sql, on top of
-- 20261021120000_course_requests.sql. One course, HIST 2100 in 2026FA at dd-u:
-- an instructor, a teaching assistant, the registrar, three enrolled students,
-- a student and an instructor on another course, an instructor on this course
-- another term, and an instructor at another school. What it proves:
--
--   * the instructor sets, changes and clears a due date, naming the version
--     read; a stale version is refused and writes nothing; the same key and
--     request replays the answer; the same key for anything else is refused;
--   * the TA, a student, the registrar, another course's or term's instructor
--     and another school cannot set one, and nobody updates an item through
--     the API;
--   * with no extension a student's date is the item's; an open, asked-about,
--     denied or withdrawn extension changes nothing; approving one changes it
--     at once, through the end of the granted day at UTC−12; the latest
--     approval is in force; an extension never makes a date earlier; an item
--     with no date takes the granted one; an extension naming no item and an
--     approved excused absence move nothing;
--   * a student reads the course's dates and only their own extension; the
--     instructor and the TA read every student's; the registrar reads the
--     dates and no student's extension; another course's, term's or school's
--     instructor and another course's student read nothing.
--
-- The control: each refusal comes after the same call working for the right
-- person, and each "reads nothing" sits beside a reader who reads something
-- through the same query, so an empty answer is the rule's doing and not a
-- broken fixture.
--
--   How to run it: supabase/check.sh gradebook-due-dates

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

-- The SQLSTATE a statement fails with, or null when it works.
create or replace function pg_temp.state(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlstate;
end $$;

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text, because text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  if e not like '%' || because || '%' then
    raise exception 'FAILED: % — refused, but not because %: %', what, because, e;
  end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

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

-- What one caller is told is due for one item and student (null student: the
-- item's own row), in UTC, with the word "extended" when it is.
create or replace function pg_temp.due(who uuid, item uuid, student uuid)
returns text language plpgsql as $$
begin
  return pg_temp.ask(who, format(
    $q$select coalesce(to_char(d.effective_due at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS'), 'none')
              || case when d.extended then ' extended' else '' end
         from public.gradebook_due_dates('HIST 2100', '2026FA') d
        where d.item_id = %L and d.student_id is not distinct from %L::uuid$q$, item, student));
end $$;

do $$
declare
  prof uuid; ta uuid; registrar uuid; maya uuid; ben uuid; dana uuid;
  cal uuid; econ_prof uuid; later_prof uuid; away_prof uuid;
  essay uuid; quiz uuid; log_item uuid; r jsonb; req uuid;
  setdue constant text := $q$select public.gradebook_set_due(%L::uuid, %L::timestamptz, %s, %L)::text$q$;
  file   constant text := $q$select public.course_request_file('HIST 2100', '2026FA', %L, %L::uuid, %L::date, 'Reason.', %L)::text$q$;
  decide constant text := $q$select public.course_request_decide(%L::uuid, %L, %L::date, %L, %s, %L)::text$q$;
  wdraw  constant text := $q$select public.course_request_withdraw(%L::uuid, %s, %L)::text$q$;
  dates  constant text := $q$select * from public.gradebook_due_dates('HIST 2100', '2026FA')$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('dd-u', 'Due Date University', array['dd-u.example']),
    ('dd-other', 'Other University', array['dd-other.example']);

  prof       := pg_temp.newuser('prof@dd-u.example', 'dd-u');
  ta         := pg_temp.newuser('ta@dd-u.example', 'dd-u');
  registrar  := pg_temp.newuser('registrar@dd-u.example', 'dd-u');
  maya       := pg_temp.newuser('maya@dd-u.example', 'dd-u');
  ben        := pg_temp.newuser('ben@dd-u.example', 'dd-u');
  dana       := pg_temp.newuser('dana@dd-u.example', 'dd-u');
  cal        := pg_temp.newuser('cal@dd-u.example', 'dd-u');
  econ_prof  := pg_temp.newuser('econ@dd-u.example', 'dd-u');
  later_prof := pg_temp.newuser('laterprof@dd-u.example', 'dd-u');
  away_prof  := pg_temp.newuser('prof@dd-other.example', 'dd-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,       'faculty',               'course', 'dd-u/HIST 2100/2026FA',     'institution'),
    (ta,         'teaching_assistant',    'course', 'dd-u/HIST 2100/2026FA',     'institution'),
    (registrar,  'registrar',             'school', 'dd-u',                      'institution'),
    (maya,       'undergraduate_student', 'course', 'dd-u/HIST 2100/2026FA',     'institution'),
    (ben,        'student',               'course', 'dd-u/HIST 2100/2026FA',     'institution'),
    (dana,       'graduate_student',      'course', 'dd-u/HIST 2100/2026FA',     'institution'),
    (cal,        'undergraduate_student', 'course', 'dd-u/ECON 1020/2026FA',     'institution'),
    (econ_prof,  'faculty',               'course', 'dd-u/ECON 1020/2026FA',     'institution'),
    (later_prof, 'faculty',               'course', 'dd-u/HIST 2100/2027SP',     'institution'),
    (away_prof,  'faculty',               'course', 'dd-other/HIST 2100/2026FA', 'institution');

  perform pg_temp.works('the instructor sets the scheme', prof, $q$select public.gradebook_set_scheme('HIST 2100', '2026FA',
      '[{"key":"essays","name":"Essays","weight":100}]'::jsonb, '[{"letter":"A","min":90},{"letter":"F","min":0}]'::jsonb,
      false, 'dd-scheme-key')$q$);
  essay    := pg_temp.ask(prof, $q$select public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Essay 2', 100, null, 'dd-item-essay')::text$q$)::uuid;
  quiz     := pg_temp.ask(prof, $q$select public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Quiz 1', 10, null, 'dd-item-quiz')::text$q$)::uuid;
  log_item := pg_temp.ask(prof, $q$select public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Reading log', 10, null, 'dd-item-log')::text$q$)::uuid;

  -- ── Before any date ─────────────────────────────────────────────────────
  perform pg_temp.counted('a new item starts at due version 0 with no date',
    (select count(*) from public.gradebook_items i where i.id = essay and i.due_version = 0 and i.due_at is null), 1);
  perform pg_temp.said('a student reads the item with no date', pg_temp.due(maya, essay, null), 'none');

  -- ── Setting a due date ──────────────────────────────────────────────────
  r := pg_temp.ask(prof, format(setdue, essay, '2026-11-06T23:59:00-06:00', 0, 'dd-due-essay-1'))::jsonb;
  perform pg_temp.said('the instructor sets a due date, at version 1', r->>'version', '1');
  perform pg_temp.said('the same key and request replays the answer',
    (pg_temp.ask(prof, format(setdue, essay, '2026-11-06T23:59:00-06:00', 0, 'dd-due-essay-1'))::jsonb)->>'version', '1');
  perform pg_temp.counted('and spent one key on the ledger, as an item edit',
    (select count(*) from public.gradebook_operations o where o.idempotency_key = 'dd-due-essay-1' and o.kind = 'item' and o.actor = prof), 1);
  perform pg_temp.refused('the same key for another date', prof,
    format(setdue, essay, '2026-11-07T23:59:00-06:00', 1, 'dd-due-essay-1'), 'already used for a different request');
  perform pg_temp.refused('a stale version', prof,
    format(setdue, essay, '2026-11-07T23:59:00-06:00', 0, 'dd-due-essay-stale'), 'changed since you read it');
  perform pg_temp.said('a stale version is SQLSTATE 40001',
    pg_temp.state(prof, format(setdue, essay, '2026-11-07T23:59:00-06:00', 0, 'dd-due-essay-stale2')), '40001');
  perform pg_temp.refused('no version at all', prof,
    format(setdue, essay, '2026-11-07T23:59:00-06:00', 'null', 'dd-due-essay-noexp'), 'changed since you read it');
  perform pg_temp.refused('the date it already has', prof,
    format(setdue, essay, '2026-11-06T23:59:00-06:00', 1, 'dd-due-essay-same'), 'already the due date');
  perform pg_temp.refused('a date out of range', prof,
    format(setdue, essay, '1999-01-01T00:00:00Z', 1, 'dd-due-essay-1999'), 'out of range');
  perform pg_temp.said('none of the refusals moved it',
    (select i.due_version || ' ' || to_char(i.due_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from public.gradebook_items i where i.id = essay),
    '1 2026-11-07 05:59');

  -- ── Who may not set one ─────────────────────────────────────────────────
  perform pg_temp.refused('the teaching assistant', ta,
    format(setdue, essay, '2026-11-08T23:59:00Z', 1, 'dd-due-ta'), 'needs grades:release');
  perform pg_temp.refused('an enrolled student', maya,
    format(setdue, essay, '2026-11-30T23:59:00Z', 1, 'dd-due-maya'), 'needs grades:release');
  perform pg_temp.refused('the registrar', registrar,
    format(setdue, essay, '2026-11-08T23:59:00Z', 1, 'dd-due-reg'), 'needs grades:release');
  perform pg_temp.refused('another course''s instructor', econ_prof,
    format(setdue, essay, '2026-11-08T23:59:00Z', 1, 'dd-due-econ'), 'needs grades:release');
  perform pg_temp.refused('this course''s instructor in another term', later_prof,
    format(setdue, essay, '2026-11-08T23:59:00Z', 1, 'dd-due-later'), 'needs grades:release');
  perform pg_temp.refused('an instructor at another school', away_prof,
    format(setdue, essay, '2026-11-08T23:59:00Z', 1, 'dd-due-away'), 'no such item here');
  perform pg_temp.refused('the instructor updating the item through the API', prof,
    format($q$update public.gradebook_items set due_at = now() where id = %L$q$, essay), 'permission denied');
  perform pg_temp.refused('a student updating the item through the API', maya,
    format($q$update public.gradebook_items set due_at = '2027-01-01' where id = %L$q$, essay), 'permission denied');

  -- A second item: set, cleared, set again — each a version.
  perform pg_temp.works('the instructor sets the quiz''s date', prof, format(setdue, quiz, '2026-11-20T17:00:00Z', 0, 'dd-due-quiz-1'));
  perform pg_temp.works('and clears it', prof, format(setdue, quiz, null, 1, 'dd-due-quiz-2'));
  perform pg_temp.said('a cleared date reads as none', pg_temp.due(maya, quiz, null), 'none');
  perform pg_temp.works('and sets it again', prof, format(setdue, quiz, '2026-11-20T17:00:00Z', 2, 'dd-due-quiz-3'));
  perform pg_temp.counted('three changes, three versions',
    (select count(*) from public.gradebook_items i where i.id = quiz and i.due_version = 3), 1);

  -- ── With no extension, a student's date is the item's ───────────────────
  perform pg_temp.said('a student reads the item''s date', pg_temp.due(maya, essay, null), '2026-11-07 05:59:00');
  perform pg_temp.counted('and no row of their own', pg_temp.seen(maya, dates || ' where student_id is not null'), 0);
  perform pg_temp.counted('a student reads one row per item', pg_temp.seen(maya, dates), 3);
  perform pg_temp.said('in the order they were added (by title, within one moment), each named',
    pg_temp.ask(maya, $q$select string_agg(d.title, ', ' order by d.ordinality) from public.gradebook_due_dates('HIST 2100', '2026FA') with ordinality d$q$),
    'Essay 2, Quiz 1, Reading log');

  -- ── Requests that are not approved extensions move nothing ──────────────
  r := pg_temp.ask(maya, format(file, 'extension', essay, '2026-11-10', 'dd-maya-ext-1'))::jsonb;
  req := (r->>'request')::uuid;
  perform pg_temp.counted('an open extension moves nothing', pg_temp.seen(prof, dates || ' where student_id is not null'), 0);
  perform pg_temp.works('the instructor asks a question', prof, format(decide, req, 'ask', null, 'Which week?', 1, 'dd-ask-1'));
  perform pg_temp.counted('an extension being asked about moves nothing', pg_temp.seen(prof, dates || ' where student_id is not null'), 0);

  r := pg_temp.ask(ben, format(file, 'extension', essay, '2026-11-12', 'dd-ben-ext-1'))::jsonb;
  perform pg_temp.works('the instructor denies another student''s extension', prof,
    format(decide, (r->>'request')::uuid, 'deny', null, 'Not this time.', 1, 'dd-deny-ben'));
  perform pg_temp.counted('a denied extension moves nothing', pg_temp.seen(prof, dates || ' where student_id is not null'), 0);

  r := pg_temp.ask(dana, format(file, 'extension', essay, '2026-11-14', 'dd-dana-ext-1'))::jsonb;
  perform pg_temp.works('a student withdraws her extension', dana, format(wdraw, (r->>'request')::uuid, 1, 'dd-dana-wd'));
  perform pg_temp.counted('a withdrawn extension moves nothing', pg_temp.seen(prof, dates || ' where student_id is not null'), 0);

  r := pg_temp.ask(dana, format(file, 'excused_absence', essay, null, 'dd-dana-abs'))::jsonb;
  perform pg_temp.works('the instructor approves an excused absence on the item', prof,
    format(decide, (r->>'request')::uuid, 'approve', null, '', 1, 'dd-approve-abs'));
  perform pg_temp.counted('an approved excused absence moves no date', pg_temp.seen(prof, dates || ' where student_id is not null'), 0);

  r := pg_temp.ask(dana, format(file, 'extension', null, '2026-12-01', 'dd-dana-ext-course'))::jsonb;
  perform pg_temp.works('the instructor approves an extension that names no item', prof,
    format(decide, (r->>'request')::uuid, 'approve', '2026-12-01', '', 1, 'dd-approve-course'));
  perform pg_temp.counted('an extension naming no item moves no item''s date', pg_temp.seen(prof, dates || ' where student_id is not null'), 0);

  -- ── Approving moves it, with no other step ──────────────────────────────
  perform pg_temp.works('the student answers', maya,
    format($q$select public.course_request_respond(%L::uuid, 'The week of the 6th.', 2, 'dd-maya-answer')$q$, req));
  perform pg_temp.works('the instructor approves, granting the 12th', prof,
    format(decide, req, 'approve', '2026-11-12', '', 3, 'dd-approve-maya'));
  perform pg_temp.said('the student''s date is the end of the 12th at UTC−12, and says extended',
    pg_temp.due(maya, essay, maya), '2026-11-13 11:59:59 extended');
  perform pg_temp.said('the item''s own date has not moved', pg_temp.due(maya, essay, null), '2026-11-07 05:59:00');
  perform pg_temp.said('the instructor reads the same date for her', pg_temp.due(prof, essay, maya), '2026-11-13 11:59:59 extended');
  perform pg_temp.counted('the row names the approved request',
    pg_temp.seen(prof, format(dates || $q$ where item_id = %L and student_id = %L and request_id = %L and granted_due = '2026-11-12'$q$, essay, maya, req)), 1);

  -- Another student's approved extension, on the same item.
  r := pg_temp.ask(ben, format(file, 'extension', essay, '2026-11-09', 'dd-ben-ext-2'))::jsonb;
  perform pg_temp.works('the instructor approves his second ask', prof,
    format(decide, (r->>'request')::uuid, 'approve', '2026-11-09', '', 1, 'dd-approve-ben'));
  perform pg_temp.said('his date is his', pg_temp.due(ben, essay, ben), '2026-11-10 11:59:59 extended');

  -- ── Who reads whose ─────────────────────────────────────────────────────
  perform pg_temp.counted('a student reads only her own extension', pg_temp.seen(maya, dates || ' where student_id is not null'), 1);
  perform pg_temp.counted('and never another student''s',
    pg_temp.seen(maya, format(dates || ' where student_id = %L', ben)), 0);
  perform pg_temp.counted('he reads only his', pg_temp.seen(ben, format(dates || ' where student_id = %L', maya)), 0);
  perform pg_temp.counted('a student with no extension reads none', pg_temp.seen(dana, dates || ' where student_id is not null'), 0);
  perform pg_temp.counted('but reads the course''s dates', pg_temp.seen(dana, dates || ' where student_id is null'), 3);
  perform pg_temp.counted('the instructor reads every student''s extension', pg_temp.seen(prof, dates || ' where student_id is not null'), 2);
  perform pg_temp.counted('the teaching assistant reads them too', pg_temp.seen(ta, dates || ' where student_id is not null'), 2);
  perform pg_temp.counted('the registrar reads the course''s dates', pg_temp.seen(registrar, dates || ' where student_id is null'), 3);
  perform pg_temp.counted('and no student''s extension', pg_temp.seen(registrar, dates || ' where student_id is not null'), 0);
  perform pg_temp.counted('another course''s instructor reads nothing', pg_temp.seen(econ_prof, dates), 0);
  perform pg_temp.counted('another course''s student reads nothing', pg_temp.seen(cal, dates), 0);
  perform pg_temp.counted('this course''s instructor in another term reads nothing', pg_temp.seen(later_prof, dates), 0);
  perform pg_temp.counted('an instructor at another school reads nothing', pg_temp.seen(away_prof, dates), 0);

  -- ── Which grant is in force, and what it never does ─────────────────────
  -- One transaction has one now(): the first approval is put an hour back,
  -- as it would be had the second come in a later request.
  update public.course_requests set decided_at = decided_at - interval '1 hour' where id = req;
  r := pg_temp.ask(maya, format(file, 'extension', essay, '2026-11-11', 'dd-maya-ext-2'))::jsonb;
  perform pg_temp.works('a second extension, granting the 11th, is approved later', prof,
    format(decide, (r->>'request')::uuid, 'approve', '2026-11-11', '', 1, 'dd-approve-maya-2'));
  perform pg_temp.said('the latest approval is in force, even when it is earlier', pg_temp.due(maya, essay, maya), '2026-11-12 11:59:59 extended');
  perform pg_temp.counted('one row per student and item, not one per approval', pg_temp.seen(maya, dates || ' where student_id is not null'), 1);

  r := pg_temp.ask(ben, format(file, 'extension', quiz, '2026-11-15', 'dd-ben-quiz'))::jsonb;
  perform pg_temp.works('an extension to before the quiz''s own date is approved', prof,
    format(decide, (r->>'request')::uuid, 'approve', '2026-11-15', '', 1, 'dd-approve-ben-quiz'));
  perform pg_temp.said('it never makes the date earlier, and does not read as extended', pg_temp.due(ben, quiz, ben), '2026-11-20 17:00:00');

  perform pg_temp.works('the instructor moves the essay past every extension', prof,
    format(setdue, essay, '2026-11-20T23:59:00Z', 1, 'dd-due-essay-2'));
  perform pg_temp.said('her date follows the item, and is no longer extended', pg_temp.due(maya, essay, maya), '2026-11-20 23:59:00');

  r := pg_temp.ask(maya, format(file, 'extension', log_item, '2026-12-01', 'dd-maya-log'))::jsonb;
  perform pg_temp.works('an extension on an item with no date is approved', prof,
    format(decide, (r->>'request')::uuid, 'approve', '2026-12-01', '', 1, 'dd-approve-log'));
  perform pg_temp.said('it takes the granted date', pg_temp.due(maya, log_item, maya), '2026-12-02 11:59:59 extended');
  perform pg_temp.said('and the item still has none', pg_temp.due(maya, log_item, null), 'none');

  perform pg_temp.counted('no grade mark was written by any of it', (select count(*) from public.grade_entries), 0);
end $$;

rollback;
