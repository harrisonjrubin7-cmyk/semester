-- supabase/course-requests.check.sql — who asks an instructor for an
-- extension, an excused absence or an incomplete, who reads it, who decides
-- it, and that a decision cannot be made twice or on a closed request.
--
-- For 20261021120000_course_requests.sql. One course, HIST 2100 in 2026FA at
-- cr-u: two instructors, a teaching assistant, the registrar, two enrolled
-- students, an instructor who is also enrolled, a student and an instructor on
-- another course, a student and an instructor on this course another term,
-- and a student and an instructor at another school. What it proves:
--
--   * an enrolled student files each kind and gets a receipt; the same key and
--     request replays it and writes nothing; the same key for anything else
--     is refused; a second request of the same kind on the same item while
--     one is waiting is refused;
--   * a student on another course, another term or at another school cannot
--     file here, an item from another course is refused, and an instructor
--     cannot file at all;
--   * a student reads only their own requests and their history; the
--     instructors and the TA read the course's; the registrar, another
--     course's or term's instructor and another school read none;
--   * nobody inserts, updates or deletes a request or its history through the
--     API;
--   * only `:decide` decides — not the TA, not another course's or term's
--     instructor, not another school, not the student who filed it;
--   * a decision names the version it read: a stale one is refused and writes
--     nothing; a replayed one answers as it first did, even after the request
--     closed;
--   * a closed request (approved, denied, withdrawn) cannot be withdrawn,
--     answered or decided again;
--   * every act leaves an action row with its version, and filing and
--     deciding each leave one outbox event naming neither the student nor
--     what anybody wrote.
--
-- The control: each refusal comes after the same call working for the right
-- person, so a refusal is the rule's doing and not a broken fixture.
--
--   How to run it: supabase/check.sh course-requests

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
  prof uuid; prof2 uuid; ta uuid; registrar uuid; both_roles uuid;
  maya uuid; ben uuid; cal uuid; econ_prof uuid; later uuid; later_prof uuid; away uuid; away_prof uuid;
  essay uuid; econ_item uuid; mine uuid; bens uuid; own uuid; r jsonb;
  file   constant text := $q$select public.course_request_file(%L, %L, %L, %L::uuid, %L::date, %L, %L)::text$q$;
  decide constant text := $q$select public.course_request_decide(%L::uuid, %L, %L::date, %L, %s, %L)::text$q$;
  wdraw  constant text := $q$select public.course_request_withdraw(%L::uuid, %s, %L)::text$q$;
  answer constant text := $q$select public.course_request_respond(%L::uuid, %L, %s, %L)::text$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('cr-u', 'Request University', array['cr-u.example']),
    ('cr-other', 'Other University', array['cr-other.example']);

  prof       := pg_temp.newuser('prof@cr-u.example', 'cr-u');
  prof2      := pg_temp.newuser('prof2@cr-u.example', 'cr-u');
  ta         := pg_temp.newuser('ta@cr-u.example', 'cr-u');
  registrar  := pg_temp.newuser('registrar@cr-u.example', 'cr-u');
  both_roles := pg_temp.newuser('both@cr-u.example', 'cr-u');
  maya       := pg_temp.newuser('maya@cr-u.example', 'cr-u');
  ben        := pg_temp.newuser('ben@cr-u.example', 'cr-u');
  cal        := pg_temp.newuser('cal@cr-u.example', 'cr-u');
  econ_prof  := pg_temp.newuser('econ@cr-u.example', 'cr-u');
  later      := pg_temp.newuser('later@cr-u.example', 'cr-u');
  later_prof := pg_temp.newuser('laterprof@cr-u.example', 'cr-u');
  away       := pg_temp.newuser('away@cr-other.example', 'cr-other');
  away_prof  := pg_temp.newuser('prof@cr-other.example', 'cr-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,       'faculty',               'course', 'cr-u/HIST 2100/2026FA',     'institution'),
    (prof2,      'faculty',               'course', 'cr-u/HIST 2100/2026FA',     'institution'),
    (ta,         'teaching_assistant',    'course', 'cr-u/HIST 2100/2026FA',     'institution'),
    (registrar,  'registrar',             'school', 'cr-u',                      'institution'),
    (both_roles, 'faculty',               'course', 'cr-u/HIST 2100/2026FA',     'institution'),
    (both_roles, 'graduate_student',      'course', 'cr-u/HIST 2100/2026FA',     'institution'),
    (maya,       'undergraduate_student', 'course', 'cr-u/HIST 2100/2026FA',     'institution'),
    (ben,        'student',               'course', 'cr-u/HIST 2100/2026FA',     'institution'),
    (cal,        'undergraduate_student', 'course', 'cr-u/ECON 1020/2026FA',     'institution'),
    (econ_prof,  'faculty',               'course', 'cr-u/ECON 1020/2026FA',     'institution'),
    (later,      'undergraduate_student', 'course', 'cr-u/HIST 2100/2027SP',     'institution'),
    (later_prof, 'faculty',               'course', 'cr-u/HIST 2100/2027SP',     'institution'),
    (away,       'undergraduate_student', 'course', 'cr-other/HIST 2100/2026FA', 'institution'),
    (away_prof,  'faculty',               'course', 'cr-other/HIST 2100/2026FA', 'institution');

  perform pg_temp.works('the instructor sets the scheme', prof, $q$select public.gradebook_set_scheme('HIST 2100', '2026FA',
      '[{"key":"essays","name":"Essays","weight":100}]'::jsonb, '[{"letter":"A","min":90},{"letter":"F","min":0}]'::jsonb,
      false, 'cr-scheme-key')$q$);
  essay := pg_temp.ask(prof, $q$select public.gradebook_add_item('HIST 2100', '2026FA', 'essays', 'Essay 2', 100, null, 'cr-item-essay2')::text$q$)::uuid;
  perform pg_temp.works('another course sets its scheme', econ_prof, $q$select public.gradebook_set_scheme('ECON 1020', '2026FA',
      '[{"key":"sets","name":"Sets","weight":100}]'::jsonb, '[{"letter":"A","min":90},{"letter":"F","min":0}]'::jsonb,
      false, 'cr-econ-scheme')$q$);
  econ_item := pg_temp.ask(econ_prof, $q$select public.gradebook_add_item('ECON 1020', '2026FA', 'sets', 'Set 1', 10, null, 'cr-econ-item')::text$q$)::uuid;

  -- ── Filing ──────────────────────────────────────────────────────────────
  perform pg_temp.said('before asking, the account counts as untouched', public.lti_account_untouched(maya)::text, 'true');
  r := pg_temp.ask(maya, format(file, 'HIST 2100', '2026FA', 'extension', essay, '2026-11-10', 'My grandmother''s funeral is that week.', 'cr-maya-ext-1'))::jsonb;
  mine := (r->>'request')::uuid;
  perform pg_temp.said('an enrolled student files an extension, open at version 1', (r->>'status') || ' v' || (r->>'version'), 'open v1');
  perform pg_temp.said('after asking, the account is not untouched', public.lti_account_untouched(maya)::text, 'false');
  perform pg_temp.said('the same key and request replays the receipt',
    (pg_temp.ask(maya, format(file, 'HIST 2100', '2026FA', 'extension', essay, '2026-11-10', 'My grandmother''s funeral is that week.', 'cr-maya-ext-1'))::jsonb)->>'request', mine::text);
  perform pg_temp.counted('and wrote one request', (select count(*) from public.course_requests), 1);
  perform pg_temp.refused('the same key with another reason', maya,
    format(file, 'HIST 2100', '2026FA', 'extension', essay, '2026-11-10', 'Something else.', 'cr-maya-ext-1'), 'already used for a different request');
  perform pg_temp.refused('a second extension on the same item while one waits', maya,
    format(file, 'HIST 2100', '2026FA', 'extension', essay, '2026-11-12', 'Again.', 'cr-maya-ext-2'), 'already have this request waiting');
  perform pg_temp.refused('an extension with no date', maya,
    format(file, 'HIST 2100', '2026FA', 'extension', null, null, 'No date.', 'cr-maya-nodate'), 'asks for a new date');
  perform pg_temp.refused('an excused absence with a date', maya,
    format(file, 'HIST 2100', '2026FA', 'excused_absence', null, '2026-11-10', 'Dated.', 'cr-maya-dated'), 'only an extension');
  perform pg_temp.refused('a request with no reason', maya,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, '   ', 'cr-maya-blank'), 'say why');
  perform pg_temp.refused('a reason over 2,000 characters', maya,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, repeat('x', 2001), 'cr-maya-long'), 'say why');
  perform pg_temp.refused('a kind that is not one', maya,
    format(file, 'HIST 2100', '2026FA', 'regrade', null, null, 'Why not.', 'cr-maya-kind'), 'extension, an excused absence or an incomplete');
  perform pg_temp.refused('naming another course''s item', maya,
    format(file, 'HIST 2100', '2026FA', 'extension', econ_item, '2026-11-10', 'Wrong item.', 'cr-maya-econ'), 'no such item on this course');

  perform pg_temp.counted('filing left one action row, at version 1',
    (select count(*) from public.course_request_actions a where a.request_id = mine and a.action = 'filed' and a.version = 1 and a.actor = maya), 1);
  perform pg_temp.counted('filing committed one event',
    (select count(*) from private.domain_outbox_events e where e.event_type = 'course_request.filed' and e.aggregate_id = mine::text), 1);
  perform pg_temp.counted('the event names neither the student nor the reason',
    (select count(*) from private.domain_outbox_events e
      where e.aggregate_id = mine::text and (e.payload::text like '%' || maya::text || '%' or e.payload::text like '%funeral%')), 0);

  -- ── Who may file ────────────────────────────────────────────────────────
  perform pg_temp.works('a second enrolled student files an excused absence', ben,
    format(file, 'HIST 2100', '2026FA', 'excused_absence', null, null, 'I was in hospital on the 3rd.', 'cr-ben-abs-1'));
  bens := (select id from public.course_requests where student_id = ben);
  perform pg_temp.refused('a student on another course', cal,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'Cal.', 'cr-cal-1'), 'that needs course_requests:create');
  perform pg_temp.refused('a student on this course another term', later,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'Later.', 'cr-later-1'), 'that needs course_requests:create');
  perform pg_temp.refused('the instructor', prof,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'Prof.', 'cr-prof-1'), 'that needs course_requests:create');
  perform pg_temp.refused('the teaching assistant', ta,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'TA.', 'cr-ta-1'), 'that needs course_requests:create');
  perform pg_temp.refused('a student at another school, naming this school''s item', away,
    format(file, 'HIST 2100', '2026FA', 'extension', essay, '2026-11-10', 'Away.', 'cr-away-1'), 'no such item on this course');
  perform pg_temp.refused('nobody signed in', null,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'Anon.', 'cr-anon-1'), 'not signed in');

  -- ── Who reads ───────────────────────────────────────────────────────────
  perform pg_temp.counted('the student reads their own', pg_temp.seen(maya, 'select * from public.course_requests'), 1);
  perform pg_temp.counted('and not a classmate''s', pg_temp.seen(maya, format('select * from public.course_requests where id = %L', bens)), 0);
  perform pg_temp.counted('nor a classmate''s history', pg_temp.seen(maya, format('select * from public.course_request_actions where request_id = %L', bens)), 0);
  perform pg_temp.counted('the instructor reads the course''s', pg_temp.seen(prof, 'select * from public.course_requests'), 2);
  perform pg_temp.counted('and its history', pg_temp.seen(prof, 'select * from public.course_request_actions'), 2);
  perform pg_temp.counted('the TA reads the course''s', pg_temp.seen(ta, 'select * from public.course_requests'), 2);
  perform pg_temp.counted('the registrar reads none', pg_temp.seen(registrar, 'select * from public.course_requests'), 0);
  perform pg_temp.counted('another course''s instructor reads none', pg_temp.seen(econ_prof, 'select * from public.course_requests'), 0);
  perform pg_temp.counted('this course''s instructor another term reads none', pg_temp.seen(later_prof, 'select * from public.course_requests'), 0);
  perform pg_temp.counted('another school''s instructor reads none', pg_temp.seen(away_prof, 'select * from public.course_requests'), 0);
  perform pg_temp.counted('and none of the history', pg_temp.seen(away_prof, 'select * from public.course_request_actions'), 0);

  -- ── Nothing is written directly ─────────────────────────────────────────
  perform pg_temp.refused('the student approving their own request', maya,
    format($q$update public.course_requests set status = 'approved' where id = %L$q$, mine), 'permission denied');
  perform pg_temp.refused('the student deleting it', maya,
    format('delete from public.course_requests where id = %L', mine), 'permission denied');
  perform pg_temp.refused('the student inserting one', maya,
    format($q$insert into public.course_requests (tenant_id, course_code, term, student_id, kind, reason, operation)
              values ('cr-u', 'HIST 2100', '2026FA', %L, 'incomplete', 'x', 'direct')$q$, maya), 'permission denied');
  perform pg_temp.refused('the instructor updating it', prof,
    format($q$update public.course_requests set status = 'denied' where id = %L$q$, mine), 'permission denied');
  perform pg_temp.refused('the instructor writing history', prof,
    format($q$insert into public.course_request_actions (request_id, tenant_id, action, version, operation)
              values (%L, 'cr-u', 'approved', 9, 'direct')$q$, mine), 'permission denied');

  -- ── Who decides ─────────────────────────────────────────────────────────
  perform pg_temp.refused('the TA', ta, format(decide, mine, 'approve', '2026-11-10', '', 1, 'cr-ta-dec'), 'that needs course_requests:decide');
  perform pg_temp.refused('another course''s instructor', econ_prof, format(decide, mine, 'approve', '2026-11-10', '', 1, 'cr-econ-dec'), 'that needs course_requests:decide');
  perform pg_temp.refused('this course''s instructor another term', later_prof, format(decide, mine, 'approve', '2026-11-10', '', 1, 'cr-later-dec'), 'that needs course_requests:decide');
  perform pg_temp.refused('another school''s instructor', away_prof, format(decide, mine, 'approve', '2026-11-10', '', 1, 'cr-away-dec'), 'no such request here');
  perform pg_temp.refused('the student', maya, format(decide, mine, 'approve', '2026-11-10', '', 1, 'cr-maya-dec'), 'that needs course_requests:decide');

  own := (pg_temp.ask(both_roles, format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'My own.', 'cr-both-1'))::jsonb->>'request')::uuid;
  perform pg_temp.refused('an instructor deciding a request they filed', both_roles,
    format(decide, own, 'approve', null, '', 1, 'cr-both-dec'), 'nobody decides a request they filed');
  perform pg_temp.works('and a colleague can', prof, format(decide, own, 'deny', null, 'Talk to the chair.', 1, 'cr-prof-own'));

  -- ── Asking, answering, and a stale decision ─────────────────────────────
  perform pg_temp.refused('asking with nothing to ask', prof, format(decide, mine, 'ask', null, '', 1, 'cr-prof-ask0'), 'say why');
  r := pg_temp.ask(prof, format(decide, mine, 'ask', null, 'Which assignment does the funeral overlap?', 1, 'cr-prof-ask'))::jsonb;
  perform pg_temp.said('the instructor asks a question, version 2', (r->>'status') || ' v' || (r->>'version'), 'info_requested v2');
  perform pg_temp.said('a replayed question answers as it first did',
    (pg_temp.ask(prof, format(decide, mine, 'ask', null, 'Which assignment does the funeral overlap?', 1, 'cr-prof-ask'))::jsonb)->>'version', '2');
  perform pg_temp.counted('and wrote no second action', (select count(*) from public.course_request_actions where request_id = mine and action = 'info_requested'), 1);
  perform pg_temp.refused('a colleague approving from the version they read before', prof2,
    format(decide, mine, 'approve', '2026-11-10', '', 1, 'cr-prof2-stale'), 'changed since you read it');
  perform pg_temp.said('and the stale decision wrote nothing',
    (select status || ' v' || version from public.course_requests where id = mine), 'info_requested v2');
  perform pg_temp.refused('asking again before the student answers', prof,
    format(decide, mine, 'ask', null, 'And?', 2, 'cr-prof-ask2'), 'has not answered your last question');
  perform pg_temp.refused('a classmate answering for her', ben, format(answer, mine, 'Not mine.', 2, 'cr-ben-ans'), 'only the student who asked');
  perform pg_temp.refused('answering from a stale version', maya, format(answer, mine, 'Essay 2.', 1, 'cr-maya-ans-old'), 'changed since you read it');
  r := pg_temp.ask(maya, format(answer, mine, 'Essay 2, due the 6th.', 2, 'cr-maya-ans'))::jsonb;
  perform pg_temp.said('the student answers and it is open again, version 3', (r->>'status') || ' v' || (r->>'version'), 'open v3');
  perform pg_temp.refused('answering when nothing was asked', maya, format(answer, mine, 'More.', 3, 'cr-maya-ans2'), 'has not asked anything');

  -- ── Approving ───────────────────────────────────────────────────────────
  perform pg_temp.refused('approving an extension without a date', prof, format(decide, mine, 'approve', null, '', 3, 'cr-prof-nodate'), 'sets the new date');
  perform pg_temp.refused('granting a date on an excused absence', prof, format(decide, bens, 'approve', '2026-11-10', '', 1, 'cr-prof-absdate'), 'only by approving an extension');
  r := pg_temp.ask(prof, format(decide, mine, 'approve', '2026-11-09', 'Take until the 9th.', 3, 'cr-prof-approve'))::jsonb;
  perform pg_temp.said('the instructor approves with a different date, version 4',
    (r->>'status') || ' v' || (r->>'version') || ' ' || (r->>'granted_due'), 'approved v4 2026-11-09');
  perform pg_temp.said('the student reads the decision',
    pg_temp.ask(maya, format('select status || '' '' || granted_due || '' '' || decision_note from public.course_requests where id = %L', mine)),
    'approved 2026-11-09 Take until the 9th.');
  perform pg_temp.said('the decision names who made it',
    (select (decided_by = prof and decided_at is not null)::text from public.course_requests where id = mine), 'true');
  perform pg_temp.said('a replayed approval answers as it first did, though the request is closed',
    (pg_temp.ask(prof, format(decide, mine, 'approve', '2026-11-09', 'Take until the 9th.', 3, 'cr-prof-approve'))::jsonb)->>'version', '4');

  -- ── Closed is closed ────────────────────────────────────────────────────
  perform pg_temp.refused('a colleague denying an approved request', prof2, format(decide, mine, 'deny', null, 'No.', 4, 'cr-prof2-deny'), 'already approved');
  perform pg_temp.refused('the student withdrawing it after approval', maya, format(wdraw, mine, 4, 'cr-maya-wd'), 'already approved');
  perform pg_temp.refused('the student answering it after approval', maya, format(answer, mine, 'Thanks.', 4, 'cr-maya-ans3'), 'already approved');

  perform pg_temp.refused('denying with no note', prof, format(decide, bens, 'deny', null, '  ', 1, 'cr-prof-deny0'), 'say why');
  r := pg_temp.ask(prof, format(decide, bens, 'deny', null, 'Bring the hospital letter to office hours.', 1, 'cr-prof-deny'))::jsonb;
  perform pg_temp.said('the instructor denies, version 2', (r->>'status') || ' v' || (r->>'version'), 'denied v2');
  perform pg_temp.refused('approving a denied request', prof, format(decide, bens, 'approve', null, '', 2, 'cr-prof-reapprove'), 'already denied');

  r := pg_temp.ask(ben, format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'Out for the rest of term.', 'cr-ben-inc-1'))::jsonb;
  perform pg_temp.refused('a classmate withdrawing it', maya, format(wdraw, r->>'request', 1, 'cr-maya-wd-ben'), 'only the student who asked');
  perform pg_temp.said('the student withdraws an open request',
    (pg_temp.ask(ben, format(wdraw, r->>'request', 1, 'cr-ben-wd'))::jsonb)->>'status', 'withdrawn');
  perform pg_temp.refused('deciding a withdrawn request', prof, format(decide, r->>'request', 'approve', null, '', 2, 'cr-prof-wd'), 'already withdrawn');
  perform pg_temp.works('and after withdrawing, the student may ask again', ben,
    format(file, 'HIST 2100', '2026FA', 'incomplete', null, null, 'Out for the rest of term, again.', 'cr-ben-inc-2'));

  -- ── The record ──────────────────────────────────────────────────────────
  perform pg_temp.said('every act on the request is in its history, in version order',
    (select string_agg(action || ':' || version, ',' order by version) from public.course_request_actions where request_id = mine),
    'filed:1,info_requested:2,responded:3,approved:4');
  perform pg_temp.said('the student reads the instructor''s question and her answer',
    pg_temp.ask(maya, format($q$select string_agg(note, ' | ' order by version) from public.course_request_actions
                                where request_id = %L and action in ('info_requested', 'responded')$q$, mine)),
    'Which assignment does the funeral overlap? | Essay 2, due the 6th.');
  perform pg_temp.counted('deciding committed one event per decision on her request',
    (select count(*) from private.domain_outbox_events e where e.event_type = 'course_request.decided' and e.aggregate_id = mine::text), 2);
  perform pg_temp.counted('no decision event names the student or a note',
    (select count(*) from private.domain_outbox_events e
      where e.event_type = 'course_request.decided'
        and (e.payload::text like '%' || maya::text || '%' or e.payload::text like '%' || ben::text || '%'
             or e.payload::text like '%9th%' or e.payload::text like '%hospital%')), 0);
  perform pg_temp.counted('withdrawing and answering emit nothing',
    (select count(*) from private.domain_outbox_events e where e.aggregate_type = 'course_request'
       and e.event_type not in ('course_request.filed', 'course_request.decided')), 0);
end $$;

rollback;
