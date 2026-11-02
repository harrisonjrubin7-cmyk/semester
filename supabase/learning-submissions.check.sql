-- supabase/learning-submissions.check.sql — who hands in work, who reads it,
-- that a hand-in never changes, and that a grade names the copy it graded.
--
-- For 20261019120000_learning_submissions.sql. One course, HIST 2100 in 2026FA
-- at ls-u: an instructor, a teaching assistant, the registrar, two enrolled
-- students, a student enrolled in another course, a student enrolled in the
-- same course another term, and a student at another school. What it proves:
--
--   * an enrolled student hands in work and gets a receipt with a version and
--     the SHA-256 of the text; handing in again is version 2 and version 1 is
--     still exactly what it was;
--   * nobody inserts, updates or deletes a submission through the API, the
--     student included;
--   * the same key and text replays the receipt and writes nothing; the same
--     key with other text is refused;
--   * a student not on this course, on another term, or at another school
--     cannot hand in, and an item at another school is "no such item";
--   * a student reads only their own submissions; the instructor and the TA
--     read the course's; the registrar reads none;
--   * a score entered after a hand-in names that submission; moderation and
--     release carry it; a later hand-in does not move it; a re-entered score
--     names the newer one;
--   * the hand-in and its outbox event commit together, and the event carries
--     no student and no text.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh learning-submissions

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

create or replace function pg_temp.works(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  % works', what;
end $$;

-- Refused, and for the reason named — not for some other fault a broken
-- fixture could give.
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

do $$
declare
  prof uuid; ta uuid; registrar uuid;
  maya uuid; ben uuid; cal uuid; later uuid; away uuid; away_prof uuid;
  essay uuid; exam uuid; away_item uuid; first_sub uuid; second_sub uuid; r jsonb;
  hand_in constant text := $q$select public.learning_submit('%s'::uuid, %L, %L)::text$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('ls-u', 'Submission University', array['ls-u.example']),
    ('ls-other', 'Other University', array['ls-other.example']);

  prof      := pg_temp.newuser('prof@ls-u.example', 'ls-u');
  ta        := pg_temp.newuser('ta@ls-u.example', 'ls-u');
  registrar := pg_temp.newuser('registrar@ls-u.example', 'ls-u');
  maya      := pg_temp.newuser('maya@ls-u.example', 'ls-u');
  ben       := pg_temp.newuser('ben@ls-u.example', 'ls-u');
  cal       := pg_temp.newuser('cal@ls-u.example', 'ls-u');
  later     := pg_temp.newuser('later@ls-u.example', 'ls-u');
  away      := pg_temp.newuser('away@ls-other.example', 'ls-other');
  away_prof := pg_temp.newuser('prof@ls-other.example', 'ls-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,      'faculty',               'course', 'ls-u/HIST 2100/2026FA',     'institution'),
    (ta,        'teaching_assistant',    'course', 'ls-u/HIST 2100/2026FA',     'institution'),
    (registrar, 'registrar',             'school', 'ls-u',                      'institution'),
    (maya,      'undergraduate_student', 'course', 'ls-u/HIST 2100/2026FA',     'institution'),
    (ben,       'student',               'course', 'ls-u/HIST 2100/2026FA',     'institution'),
    (cal,       'undergraduate_student', 'course', 'ls-u/ECON 1020/2026FA',     'institution'),
    (later,     'undergraduate_student', 'course', 'ls-u/HIST 2100/2027SP',     'institution'),
    (away,      'undergraduate_student', 'course', 'ls-other/HIST 2100/2026FA', 'institution'),
    (away_prof, 'faculty',               'course', 'ls-other/HIST 2100/2026FA', 'institution');

  -- The assignment: a scheme and one item, by the instructor.
  perform pg_temp.works('the instructor sets the scheme', prof, $q$select public.gradebook_set_scheme('HIST 2100', '2026FA',
      '[{"key":"essays","name":"Essays","weight":100}]'::jsonb, '[{"letter":"A","min":90},{"letter":"F","min":0}]'::jsonb,
      false, 'ls-scheme-key')$q$);
  essay := pg_temp.ask(prof, $q$select public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Essay 2', 100, null, 'ls-item-essay2')::text$q$)::uuid;
  perform pg_temp.works('the other school sets its scheme', away_prof, $q$select public.gradebook_set_scheme('HIST 2100', '2026FA',
      '[{"key":"essays","name":"Essays","weight":100}]'::jsonb, '[{"letter":"A","min":90},{"letter":"F","min":0}]'::jsonb,
      false, 'ls-away-scheme')$q$);
  away_item := pg_temp.ask(away_prof, $q$select public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Essay 2', 100, null, 'ls-away-item')::text$q$)::uuid;

  -- ── Handing in ──────────────────────────────────────────────────────────
  perform pg_temp.said('before handing in, the account counts as untouched',
    public.lti_account_untouched(maya)::text, 'true');
  r := pg_temp.ask(maya, format(hand_in, essay, 'Draft one of my essay on Reconstruction.', 'ls-maya-v1'))::jsonb;
  perform pg_temp.said('an enrolled student hands in, and it is version 1', r->>'version', '1');
  perform pg_temp.said('the receipt carries the text''s SHA-256', r->>'content_hash',
    encode(sha256(convert_to('Draft one of my essay on Reconstruction.', 'UTF8')), 'hex'));
  first_sub := (r->>'submission')::uuid;
  perform pg_temp.said('after handing in, it holds the student''s work and is not untouched',
    public.lti_account_untouched(maya)::text, 'false');
  perform pg_temp.said('the same key and text replays the same receipt',
    (pg_temp.ask(maya, format(hand_in, essay, 'Draft one of my essay on Reconstruction.', 'ls-maya-v1'))::jsonb)->>'submission', first_sub::text);
  perform pg_temp.counted('and wrote one submission', (select count(*) from public.learning_submissions), 1);
  perform pg_temp.refused('the same key with other text', maya,
    format(hand_in, essay, 'Something else entirely.', 'ls-maya-v1'), 'already used for a different request');
  perform pg_temp.refused('handing in nothing', maya, format(hand_in, essay, '   ', 'ls-maya-blank'), 'nothing to hand in');

  perform pg_temp.counted('the event committed with the hand-in',
    (select count(*) from private.domain_outbox_events e
      where e.event_type = 'submission.finalized' and e.aggregate_id = first_sub::text), 1);
  perform pg_temp.counted('the event names neither the student nor the text',
    (select count(*) from private.domain_outbox_events e
      where e.aggregate_id = first_sub::text
        and (e.payload::text like '%' || maya::text || '%' or e.payload::text like '%Reconstruction%')), 0);

  -- ── Who may hand in ─────────────────────────────────────────────────────
  perform pg_temp.works('a second enrolled student hands in', ben, format(hand_in, essay, 'Ben''s essay.', 'ls-ben-v1'));
  perform pg_temp.refused('a student on another course', cal, format(hand_in, essay, 'Cal''s essay.', 'ls-cal-v1'), 'that needs submissions:create');
  perform pg_temp.refused('a student on this course another term', later, format(hand_in, essay, 'Later essay.', 'ls-later-v1'), 'that needs submissions:create');
  perform pg_temp.refused('the instructor', prof, format(hand_in, essay, 'Prof essay.', 'ls-prof-v1'), 'that needs submissions:create');
  perform pg_temp.refused('a student at another school, on this item', away, format(hand_in, essay, 'Away essay.', 'ls-away-v1'), 'no such item here');
  perform pg_temp.refused('a student here, on the other school''s item', maya, format(hand_in, away_item, 'Wrong school.', 'ls-maya-away'), 'no such item here');
  perform pg_temp.refused('nobody signed in', null, format(hand_in, essay, 'Anon.', 'ls-anon-key1'), 'not signed in');

  -- ── Never changed ───────────────────────────────────────────────────────
  perform pg_temp.refused('the student updating their submission', maya,
    format('update public.learning_submissions set body = %L where id = %L', 'changed', first_sub), 'permission denied');
  perform pg_temp.refused('the student deleting it', maya,
    format('delete from public.learning_submissions where id = %L', first_sub), 'permission denied');
  perform pg_temp.refused('the student inserting one directly', maya,
    format($q$insert into public.learning_submissions (tenant_id, course_code, term, item_id, student_id, version, body, content_hash, operation)
              values ('ls-u', 'HIST 2100', '2026FA', %L, %L, 9, 'x', repeat('0', 64), 'direct')$q$, essay, maya), 'permission denied');
  perform pg_temp.refused('the instructor updating it', prof,
    format('update public.learning_submissions set body = %L where id = %L', 'changed', first_sub), 'permission denied');

  -- ── Who reads ───────────────────────────────────────────────────────────
  perform pg_temp.counted('the student reads their own', pg_temp.seen(maya, 'select * from public.learning_submissions'), 1);
  perform pg_temp.counted('and not a classmate''s', pg_temp.seen(maya, format('select * from public.learning_submissions where student_id = %L', ben)), 0);
  perform pg_temp.counted('the instructor reads the course''s', pg_temp.seen(prof, 'select * from public.learning_submissions'), 2);
  perform pg_temp.counted('the TA reads the course''s', pg_temp.seen(ta, 'select * from public.learning_submissions'), 2);
  perform pg_temp.counted('the registrar reads none', pg_temp.seen(registrar, 'select * from public.learning_submissions'), 0);
  perform pg_temp.counted('a student on another course reads none', pg_temp.seen(cal, 'select * from public.learning_submissions'), 0);
  perform pg_temp.counted('faculty at another school read none', pg_temp.seen(away_prof, 'select * from public.learning_submissions'), 0);

  -- ── A grade names the copy it graded ────────────────────────────────────
  perform pg_temp.works('the TA enters a score after the hand-in', ta,
    format($q$select public.gradebook_enter(%L, %L, 88, null, 'Strong argument.', '', 'ls-enter-maya-1')$q$, essay, maya));
  perform pg_temp.said('the draft names submission 1',
    (select g.submission_id::text from public.grade_entries g where g.item_id = essay and g.student_id = maya and g.version = 1), first_sub::text);

  r := pg_temp.ask(maya, format(hand_in, essay, 'Draft two, revised after the score.', 'ls-maya-v2'))::jsonb;
  second_sub := (r->>'submission')::uuid;
  perform pg_temp.said('handing in again is version 2', r->>'version', '2');
  perform pg_temp.said('and version 1 is unchanged',
    (select s.body from public.learning_submissions s where s.id = first_sub), 'Draft one of my essay on Reconstruction.');

  perform pg_temp.works('the instructor releases', prof, format($q$select public.gradebook_release(%L, 'ls-release-1')$q$, essay));
  perform pg_temp.said('the released grade still names submission 1, not the later hand-in',
    (select g.submission_id::text from public.grade_entries g
      where g.item_id = essay and g.student_id = maya and g.status = 'released' order by g.version desc limit 1), first_sub::text);
  perform pg_temp.said('the student reads which submission was graded',
    pg_temp.ask(maya, format($q$select submission_id::text from public.grade_entries where item_id = %L and status = 'released'$q$, essay)), first_sub::text);

  perform pg_temp.works('a changed score after release', ta,
    format($q$select public.gradebook_enter(%L, %L, 92, null, 'Revision read.', 'Graded the revision.', 'ls-enter-maya-2')$q$, essay, maya));
  perform pg_temp.said('a re-entered score names the newer submission',
    (select g.submission_id::text from public.grade_entries g
      where g.item_id = essay and g.student_id = maya order by g.version desc limit 1), second_sub::text);

  -- An exam graded on paper: nothing handed in, so the grade names nothing.
  exam := pg_temp.ask(prof, $q$select public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Midterm', 100, null, 'ls-item-midterm')::text$q$)::uuid;
  perform pg_temp.works('a score on an item nobody handed in', ta,
    format($q$select public.gradebook_enter(%L, %L, 75, null, '', '', 'ls-enter-ben-mid')$q$, exam, ben));
  perform pg_temp.said('names no submission',
    (select coalesce(g.submission_id::text, 'none') from public.grade_entries g where g.item_id = exam and g.student_id = ben), 'none');
  perform pg_temp.said('and Ben''s essay hand-in is not borrowed by the midterm',
    (select count(*)::text from public.grade_entries g where g.item_id = exam and g.submission_id is not null), '0');
end $$;

rollback;
