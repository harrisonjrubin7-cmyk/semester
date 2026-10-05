-- Help requests: a student asks a person for help, and nothing else happens.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh help-requests
--
-- What this covers, each as the account it is about:
--
--   * A student sends a request to a destination at their own school, and
--     only to one that accepts requests; never at another school.
--   * The context is a closed vocabulary: a key outside it (a grade, a
--     diagnosis) is refused by the database, not by the screen.
--   * Staff cannot select the table, and the inbox shows no words.
--   * Opening a request writes an event the student can read. Someone without
--     the capability for that destination cannot open it, nor can the
--     capability at another destination.
--   * Staff can only move a request forward; a student cannot answer their own.
--   * Withdrawing empties the words, and the inbox no longer shows it.
--   * Wellbeing is not a destination kind; sensitive offices cannot accept
--     requests.
--   * Deleting an account empties every request and its events.

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
  student uuid; classmate uuid; other_school uuid; advisor uuid; tutor uuid;
  implementer uuid; stranger_staff uuid;
  advising uuid; tutoring uuid; aid uuid; elsewhere uuid;
  req uuid; req2 uuid; req3 uuid; n bigint; q text; ctx jsonb; who_name text; who_email text;
begin
  insert into public.schools (id, name, email_domains) values
    ('help-u', 'Help University', array['help-u.example']),
    ('help-other', 'Other University', array['help-other.example']);

  student        := pg_temp.newuser('student@help-u.example', 'help-u');
  classmate      := pg_temp.newuser('classmate@help-u.example', 'help-u');
  other_school   := pg_temp.newuser('other@help-other.example', 'help-other');
  advisor        := pg_temp.newuser('advisor@help-u.example', 'help-u');
  tutor          := pg_temp.newuser('tutor@help-u.example', 'help-u');
  implementer    := pg_temp.newuser('impl@semester.example', null);
  stranger_staff := pg_temp.newuser('staff@help-other.example', 'help-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (advisor,        'academic_advisor',       'office', 'help-u/advising',   'institution'),
    (tutor,          'tutor',                  'office', 'help-u/tutoring',   'institution'),
    (implementer,    'implementation_manager', 'school', 'help-u',            'institution'),
    (stranger_staff, 'academic_advisor',       'office', 'help-other/advising', 'institution');

  -- ── destinations ───────────────────────────────────────────────────────
  perform pg_temp.expect_refused('a student configures a destination', student,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name, accepts_requests)
       values ('help-u', 'advisor', 'office', 'help-u/advising', 'Fake advising', true)$q$);
  perform pg_temp.expect_allowed('implementation configures advising', implementer,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name, accepts_requests)
       values ('help-u', 'advisor', 'office', 'help-u/advising', 'Advising', true)$q$);
  perform pg_temp.expect_allowed('and tutoring', implementer,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name, accepts_requests)
       values ('help-u', 'tutoring', 'office', 'help-u/tutoring', 'Tutoring center', true)$q$);
  perform pg_temp.expect_allowed('and financial aid as a directory entry', implementer,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name, official_url)
       values ('help-u', 'financial_aid', 'office', 'help-u/aid', 'Financial aid', 'https://aid.help-u.example')$q$);
  perform pg_temp.expect_refused('financial aid accepting stored requests', implementer,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name, accepts_requests)
       values ('help-u', 'financial_aid', 'office', 'help-u/aid2', 'Aid inbox', true)$q$);
  perform pg_temp.expect_refused('a wellbeing destination of any kind', implementer,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name)
       values ('help-u', 'counseling', 'office', 'help-u/counseling', 'Counseling')$q$);
  perform pg_temp.expect_refused('implementation configures another school', implementer,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name)
       values ('help-other', 'advisor', 'office', 'help-other/advising', 'Theirs')$q$);
  perform pg_temp.expect_refused('a destination scoped outside its tenant', implementer,
    $q$insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name)
       values ('help-u', 'advisor', 'office', 'help-other/advising', 'Crossed')$q$);

  select id into advising from public.help_destinations where scope_id = 'help-u/advising';
  select id into tutoring from public.help_destinations where scope_id = 'help-u/tutoring';
  select id into aid      from public.help_destinations where scope_id = 'help-u/aid';
  insert into public.help_destinations (tenant_id, kind, scope_kind, scope_id, name, accepts_requests)
  values ('help-other', 'advisor', 'office', 'help-other/advising', 'Other advising', true)
  returning id into elsewhere;

  perform pg_temp.counted('a student sees their school''s three destinations',
    pg_temp.seen(student, 'select * from public.help_destinations'), 3);
  perform pg_temp.counted('and none of another school''s',
    pg_temp.seen(other_school, 'select * from public.help_destinations where tenant_id = ''help-u'''), 0);

  -- ── sending ────────────────────────────────────────────────────────────
  perform pg_temp.become(student);
  select public.send_help_request(advising, 'Which statistics course fits my plan?',
    '{"course": "PSY 340", "requirement": "Statistics before PSY 340"}'::jsonb) into req;
  reset role;
  perform pg_temp.counted('a student sends a request with two named fields',
    (select count(*) from public.help_requests where id = req and student_id = student), 1);

  perform pg_temp.expect_refused('a context key outside the vocabulary', student,
    format($q$select public.send_help_request(%L, 'Help', '{"gpa": "2.1"}'::jsonb)$q$, advising));
  perform pg_temp.expect_refused('a context value that is not text', student,
    format($q$select public.send_help_request(%L, 'Help', '{"course": {"grade": "F"}}'::jsonb)$q$, advising));
  perform pg_temp.expect_refused('an empty question', student,
    format($q$select public.send_help_request(%L, '   ', '{}'::jsonb)$q$, advising));
  perform pg_temp.expect_refused('a request to a directory-only office', student,
    format($q$select public.send_help_request(%L, 'Help', '{}'::jsonb)$q$, aid));
  perform pg_temp.expect_refused('a request to another school''s office', student,
    format($q$select public.send_help_request(%L, 'Help', '{}'::jsonb)$q$, elsewhere));
  perform pg_temp.expect_refused('a direct insert bypassing the function', student,
    format($q$insert into public.help_requests (student_id, destination_id, question)
              values ((select auth.uid()), %L, 'Direct')$q$, advising));
  perform pg_temp.expect_refused('a student editing their sent request', student,
    format($q$update public.help_requests set question = 'Changed' where id = %L$q$, req));

  perform pg_temp.counted('a classmate cannot see the request',
    pg_temp.seen(classmate, 'select * from public.help_requests'), 0);
  perform pg_temp.counted('nor can the advisor select it directly',
    pg_temp.seen(advisor, 'select * from public.help_requests'), 0);

  -- ── which inboxes are whose ────────────────────────────────────────────
  perform pg_temp.counted('the advisor answers for advising only',
    pg_temp.seen(advisor, $q$select * from public.my_help_destinations() where scope_id = 'help-u/advising'$q$)
    + pg_temp.seen(advisor, 'select * from public.my_help_destinations()'), 2);
  perform pg_temp.counted('the tutor answers for tutoring only',
    pg_temp.seen(tutor, $q$select * from public.my_help_destinations() where scope_id = 'help-u/tutoring'$q$)
    + pg_temp.seen(tutor, 'select * from public.my_help_destinations()'), 2);
  perform pg_temp.counted('a student answers for nothing',
    pg_temp.seen(student, 'select * from public.my_help_destinations()'), 0);
  perform pg_temp.counted('an advisor elsewhere sees only their own school''s inbox',
    pg_temp.seen(stranger_staff, $q$select * from public.my_help_destinations() where scope_id like 'help-u/%'$q$), 0);
  perform pg_temp.counted('and implementation, who configures them, answers for none',
    pg_temp.seen(implementer, 'select * from public.my_help_destinations()'), 0);

  -- ── the inbox and opening ──────────────────────────────────────────────
  perform pg_temp.counted('the advisor''s inbox lists it',
    pg_temp.seen(advisor, format('select * from public.help_inbox(%L)', advising)), 1);
  perform pg_temp.expect_refused('the tutor reads advising''s inbox', tutor,
    format('select * from public.help_inbox(%L)', advising));
  perform pg_temp.expect_refused('an advisor at another school reads it', stranger_staff,
    format('select * from public.help_inbox(%L)', advising));
  perform pg_temp.expect_refused('a student reads the inbox', student,
    format('select * from public.help_inbox(%L)', advising));

  perform pg_temp.counted('before anyone opens it, the student sees one event',
    pg_temp.seen(student, 'select * from public.help_request_events'), 1);
  perform pg_temp.become(advisor);
  select o.question, o.shared_context, o.student_name, o.student_email
    into q, ctx, who_name, who_email from public.open_help_request(req) o;
  reset role;
  if q <> 'Which statistics course fits my plan?' or ctx ->> 'course' <> 'PSY 340' then
    raise exception 'FAILED: the advisor did not receive what the student wrote';
  end if;
  raise notice 'ok  the advisor opens exactly what the student sent';
  if who_email is distinct from 'student@help-u.example' or who_name is distinct from 'student' then
    raise exception 'FAILED: the open did not carry the confirmed identity (got %, %)', who_name, who_email;
  end if;
  raise notice 'ok  and who sent it: display name and the confirmed email';
  perform pg_temp.counted('the inbox list still carries no identity',
    (select count(*) from pg_proc p, unnest(p.proargnames) a(name)
      where p.proname = 'help_inbox' and p.pronamespace = 'public'::regnamespace
        and a.name like 'student%'), 0);
  -- The probe, pointed at what it should see: open_help_request does carry it.
  perform pg_temp.counted('while open_help_request does, so the probe can see it',
    (select count(*) from pg_proc p, unnest(p.proargnames) a(name)
      where p.proname = 'open_help_request' and p.pronamespace = 'public'::regnamespace
        and a.name like 'student%'), 2);
  perform pg_temp.counted('and the student sees that open',
    pg_temp.seen(student, $q$select * from public.help_request_events where kind = 'opened'$q$), 1);
  perform pg_temp.expect_refused('the tutor opens an advising request', tutor,
    format('select * from public.open_help_request(%L)', req));
  perform pg_temp.expect_refused('a classmate opens it', classmate,
    format('select * from public.open_help_request(%L)', req));

  -- ── answering ──────────────────────────────────────────────────────────
  perform pg_temp.expect_refused('the student answers their own request', student,
    format($q$select public.answer_help_request(%L, 'closed', '')$q$, req));
  perform pg_temp.expect_allowed('the advisor schedules it', advisor,
    format($q$select public.answer_help_request(%L, 'scheduled', 'Tuesday 2pm, bring your plan')$q$, req));
  perform pg_temp.become(advisor);
  select o.reply into q from public.open_help_request(req) o;
  reset role;
  if q is distinct from 'Tuesday 2pm, bring your plan' then
    raise exception 'FAILED: reopening does not show the office its own reply (got %)', q;
  end if;
  raise notice 'ok  reopening shows the office the reply it sent';
  perform pg_temp.counted('the student reads the reply',
    pg_temp.seen(student, $q$select * from public.help_requests where reply = 'Tuesday 2pm, bring your plan' and status = 'scheduled'$q$), 1);
  perform pg_temp.expect_refused('moving a scheduled request back to acknowledged', advisor,
    format($q$select public.answer_help_request(%L, 'acknowledged', '')$q$, req));
  perform pg_temp.expect_refused('moving it to withdrawn on the student''s behalf', advisor,
    format($q$select public.answer_help_request(%L, 'withdrawn', '')$q$, req));

  -- ── withdrawing ────────────────────────────────────────────────────────
  perform pg_temp.become(student);
  select public.send_help_request(tutoring, 'Stuck on problem set 3', '{"assignment": "PS3"}'::jsonb) into req2;
  reset role;
  perform pg_temp.expect_refused('a classmate withdraws it', classmate,
    format('select public.withdraw_help_request(%L)', req2));
  perform pg_temp.expect_allowed('the student withdraws it', student,
    format('select public.withdraw_help_request(%L)', req2));
  perform pg_temp.counted('its words are gone',
    (select count(*) from public.help_requests
      where id = req2 and question = '' and shared_context = '{}'::jsonb and status = 'withdrawn'), 1);
  perform pg_temp.counted('and the tutor''s inbox no longer lists it',
    pg_temp.seen(tutor, format('select * from public.help_inbox(%L)', tutoring)), 0);
  perform pg_temp.expect_refused('the tutor opens a withdrawn request', tutor,
    format('select * from public.open_help_request(%L)', req2));
  perform pg_temp.expect_refused('withdrawing twice', student,
    format('select public.withdraw_help_request(%L)', req2));

  -- ── review fix 3: the office sees the identity as it was sent ──────────
  update public.profiles set handle = 'renamed_later' where user_id = student;
  update auth.users set email = 'changed-later@help-u.example' where id = student;
  perform pg_temp.become(advisor);
  select o.student_name, o.student_email into who_name, who_email from public.open_help_request(req) o;
  reset role;
  if who_name is distinct from 'student' or who_email is distinct from 'student@help-u.example' then
    raise exception 'FAILED: a later rename reached the office (got %, %)', who_name, who_email;
  end if;
  raise notice 'ok  a name or email changed after sending does not reach the office';
  update public.profiles set handle = 'student' where user_id = student;
  update auth.users set email = 'student@help-u.example' where id = student;

  -- ── a request from before the identity snapshot still names its sender ──
  update public.help_requests set student_name = '', student_email = '' where id = req;
  perform pg_temp.counted('the backfill fills the one live request left without a snapshot',
    private.backfill_help_request_identity(), 1);
  perform pg_temp.become(advisor);
  select o.student_name, o.student_email into who_name, who_email from public.open_help_request(req) o;
  reset role;
  if who_name is distinct from 'student' or who_email is distinct from 'student@help-u.example' then
    raise exception 'FAILED: a pre-snapshot request opens without its sender (got %, %)', who_name, who_email;
  end if;
  raise notice 'ok  and staff opening it see who sent it';
  perform pg_temp.counted('a withdrawn request is never refilled',
    (select count(*) from public.help_requests where id = req2 and student_email <> ''), 0);
  perform pg_temp.counted('and running it again changes nothing',
    private.backfill_help_request_identity(), 0);

  -- ── review fix 1: a closed request can still be erased ─────────────────
  perform pg_temp.expect_allowed('the advisor closes the scheduled request', advisor,
    format($q$select public.answer_help_request(%L, 'closed', 'See you Tuesday')$q$, req));
  perform pg_temp.expect_allowed('the student withdraws it after it was closed', student,
    format('select public.withdraw_help_request(%L)', req));
  perform pg_temp.counted('and every word of it, identity included, is gone',
    (select count(*) from public.help_requests
      where id = req and status = 'withdrawn' and question = '' and reply = ''
        and shared_context = '{}'::jsonb and student_name = '' and student_email = ''), 1);

  -- ── review fix 2: closing intake does not strand open requests ─────────
  perform pg_temp.become(student);
  select public.send_help_request(tutoring, 'Still stuck on PS3', '{}'::jsonb) into req3;
  reset role;
  perform pg_temp.expect_allowed('implementation retires tutoring', implementer,
    format($q$update public.help_destinations set retired_at = now() where id = %L$q$, tutoring));
  perform pg_temp.counted('the tutor still finds the retired inbox while a request waits in it',
    pg_temp.seen(tutor, 'select * from public.my_help_destinations()'), 1);
  perform pg_temp.counted('and the waiting request in it',
    pg_temp.seen(tutor, format('select * from public.help_inbox(%L)', tutoring)), 1);
  perform pg_temp.expect_refused('but no new request can be sent there', student,
    format($q$select public.send_help_request(%L, 'Another', '{}'::jsonb)$q$, tutoring));
  perform pg_temp.expect_allowed('the tutor closes the last one', tutor,
    format($q$select public.answer_help_request(%L, 'closed', '')$q$, req3));
  perform pg_temp.counted('the retired inbox stays in their list while it holds a closed request',
    pg_temp.seen(tutor, 'select * from public.my_help_destinations()'), 1);
  perform pg_temp.counted('and the closed request is still in it',
    pg_temp.seen(tutor, format($q$select * from public.help_inbox(%L) where status = 'closed'$q$, tutoring)), 1);
  perform pg_temp.expect_allowed('the student withdraws the closed request', student,
    format('select public.withdraw_help_request(%L)', req3));
  perform pg_temp.counted('and then the retired inbox, holding nothing staff can see, is gone',
    pg_temp.seen(tutor, 'select * from public.my_help_destinations()'), 0);

  -- ── an account that asked for help is not a fresh one ──────────────────
  if public.lti_account_untouched(student) then
    raise exception 'FAILED: an account holding help requests reads as untouched';
  end if;
  raise notice 'ok  an account holding help requests is not untouched';
  if not public.lti_account_untouched(classmate) then
    raise exception 'FAILED: control — an account with nothing reads as touched';
  end if;
  raise notice 'ok  and the control, an account with nothing, still is';

  -- ── leaving ────────────────────────────────────────────────────────────
  perform pg_temp.expect_refused('a signed-in account deletes a request directly', student,
    'delete from public.help_requests');
  perform pg_temp.become(classmate);
  perform public.forget_my_help_requests();
  reset role;
  perform pg_temp.counted('a classmate''s forget takes nothing of the student''s',
    (select count(*) from public.help_requests where student_id = student), 3);
  perform pg_temp.become(student);
  perform public.forget_my_help_requests();
  reset role;
  perform pg_temp.counted('the student''s forget empties their requests',
    (select count(*) from public.help_requests where student_id = student), 0);
  perform pg_temp.counted('and every event with them',
    (select count(*) from public.help_request_events where request_id in (req, req2, req3)), 0);
end $$;

rollback;
