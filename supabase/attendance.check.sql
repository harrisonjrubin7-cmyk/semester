-- supabase/attendance.check.sql — who opens a session, who may check in, what
-- the server's clock says, and that no mark is ever rewritten.
--
-- For 20261001020000_attendance.sql. One course, ECON 1020 in 2026FA at at-u:
-- an instructor and a teaching assistant, three students on the roster, a
-- student of another course, a student whose grant names no term, faculty of
-- another course. What it proves:
--
--   * nothing is written unless the school runs `attendance` in Core — not in
--     Connect, not frozen, not under `kill.core_modules`;
--   * only `attendance:take` opens, closes and marks; a student does not;
--   * a code is six digits, the server's, unique among open sessions, and read
--     by takers and by no student;
--   * a check-in is present, late or refused by the server's clock; a wrong
--     code is answered and kept, and five in ten minutes stop the sixth, even
--     with the right code; a right code from someone not on the course is
--     answered as a wrong one;
--   * the same key twice is one mark; checking in twice is refused;
--   * a mark is a new version, never a rewrite, even by the owner; an excused
--     absence needs a note; only a roster member can be marked;
--   * closing marks the roster's unmarked students absent, once, and a closed
--     session takes no check-in;
--   * a student reads their own marks and nobody else's; nobody writes through
--     the API; deleting an account takes the student's marks.
--
--   How to run it: supabase/check.sh attendance

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
  if e not like '%that needs attendance:%' and e not like '%not on this course''s%' then
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
  prof uuid; ta uuid; other_prof uuid; ana uuid; ben uuid; zed uuid; dan uuid; untermed uuid; mal uuid;
  s1 jsonb; s2 jsonb; s_late jsonb; s_future jsonb; s_past jsonb; r jsonb; r2 jsonb; n bigint; k int;
  open_sql constant text := $q$select public.attendance_open_session('econ 1020', '2026FA', %L, current_date, %s, %s, %s, %L)$q$;
begin
  insert into public.schools (id, name, email_domains) values
    ('at-u', 'Attendance University', array['at-u.example']);

  prof       := pg_temp.newuser('prof@at-u.example', 'at-u');
  ta         := pg_temp.newuser('ta@at-u.example', 'at-u');
  other_prof := pg_temp.newuser('hist@at-u.example', 'at-u');
  ana        := pg_temp.newuser('ana@at-u.example', 'at-u');
  ben        := pg_temp.newuser('ben@at-u.example', 'at-u');
  zed        := pg_temp.newuser('zed@at-u.example', 'at-u');
  dan        := pg_temp.newuser('dan@at-u.example', 'at-u');
  untermed   := pg_temp.newuser('una@at-u.example', 'at-u');
  mal        := pg_temp.newuser('mal@at-u.example', 'at-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,       'faculty',               'course', 'at-u/ECON 1020/2026FA', 'institution'),
    (ta,         'teaching_assistant',    'course', 'at-u/ECON 1020/2026FA', 'institution'),
    (other_prof, 'faculty',               'course', 'at-u/HIST 2100/2026FA', 'institution'),
    (ana,        'undergraduate_student', 'course', 'at-u/ECON 1020/2026FA', 'institution'),
    (ben,        'student',               'course', 'at-u/ECON 1020/2026FA', 'institution'),
    (zed,        'graduate_student',      'course', 'at-u/ECON 1020/2026FA', 'institution'),
    (mal,        'student',               'course', 'at-u/ECON 1020/2026FA', 'institution'),
    (dan,        'undergraduate_student', 'course', 'at-u/HIST 2100/2026FA', 'institution'),
    (untermed,   'undergraduate_student', 'course', 'at-u/ECON 1020',         'institution');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('opening a session while the school is in Connect', prof,
    format(open_sql, 'Week 1', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '10', 'open-connect-key'),
    'does not run attendance in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('at-u', 'attendance', 'core', false, 'check');

  -- ── Opening ────────────────────────────────────────────────────
  perform pg_temp.denied('a student opening a session', ana,
    format(open_sql, 'Mine', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '10', 'open-ana-key'));
  perform pg_temp.denied('faculty of another course opening one', other_prof,
    format(open_sql, 'Wrong course', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '10', 'open-oth-key'));
  perform pg_temp.refused('a window longer than twelve hours', prof,
    format(open_sql, 'Too long', $t$now() - interval '1 minute'$t$, $t$now() + interval '13 hours'$t$, '10', 'open-long-key'));
  perform pg_temp.refused('a window that ends before it begins', prof,
    format(open_sql, 'Backwards', $t$now() + interval '1 hour'$t$, $t$now() - interval '1 hour'$t$, '10', 'open-back-key'));

  perform pg_temp.become(ta);
  s1 := public.attendance_open_session('econ 1020', '2026FA', 'Week 1', current_date, now() - interval '1 minute', now() + interval '1 hour', 10, 'open-s1-key');
  execute 'reset role';
  perform pg_temp.counted('the TA opened a session with a six-digit code', (s1->>'code' ~ '^[0-9]{6}$')::int, 1);
  perform pg_temp.become(ta);
  s2 := public.attendance_open_session('econ 1020', '2026FA', 'Week 1', current_date, now() - interval '1 minute', now() + interval '1 hour', 10, 'open-s1-key');
  execute 'reset role';
  perform pg_temp.said('the same key answers the same session', s2->>'id', s1->>'id');
  perform pg_temp.counted('and opened one', (select count(*) from public.attendance_sessions), 1);
  perform pg_temp.refused_for('the same key for a different session', prof,
    format(open_sql, 'Another', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '10', 'open-s1-key'), 'already used for a different request');

  perform pg_temp.counted('the instructor reads the session and its code', pg_temp.seen(prof, 'select 1 from public.attendance_sessions'), 1);
  perform pg_temp.counted('a student reads no session, so no code', pg_temp.seen(ana, 'select 1 from public.attendance_sessions'), 0);
  perform pg_temp.counted('nor does faculty of another course', pg_temp.seen(other_prof, 'select 1 from public.attendance_sessions'), 0);

  -- ── Checking in ────────────────────────────────────────────────
  perform pg_temp.become(ana);
  r := public.attendance_check_in(s1->>'code', 'checkin-ana-key');
  execute 'reset role';
  perform pg_temp.said('ana checks in on time', r->>'status', 'present');
  perform pg_temp.become(ana);
  r2 := public.attendance_check_in(s1->>'code', 'checkin-ana-key');
  execute 'reset role';
  perform pg_temp.said('the same key replays the same answer', r2->>'marked_at', r->>'marked_at');
  perform pg_temp.counted('and wrote one mark', (select count(*) from public.attendance_marks where student_id = ana), 1);
  perform pg_temp.said('checking in again under a new key is refused as already marked',
    pg_temp.ask(ana, format($q$select (public.attendance_check_in(%L, 'checkin-ana-2nd'))->>'reason'$q$, s1->>'code')), 'already_marked');

  perform pg_temp.said('a student on another course with the right code gets the answer a wrong code gets',
    pg_temp.ask(dan, format($q$select (public.attendance_check_in(%L, 'checkin-dan-key'))->>'reason'$q$, s1->>'code')), 'no_such_code');
  perform pg_temp.said('a grant with no term likewise',
    pg_temp.ask(untermed, format($q$select (public.attendance_check_in(%L, 'checkin-una-key'))->>'reason'$q$, s1->>'code')), 'no_such_code');
  perform pg_temp.counted('and neither was marked', (select count(*) from public.attendance_marks where student_id in (dan, untermed)), 0);

  -- Five wrong tries, then the right code is refused too.
  for k in 1..5 loop
    perform pg_temp.said('wrong code ' || k || ' is answered', pg_temp.ask(mal,
      format($q$select (public.attendance_check_in('000000', %L))->>'reason'$q$, 'checkin-mal-bad-' || k)), 'no_such_code');
  end loop;
  perform pg_temp.counted('the five tries were kept', (select count(*) from public.attendance_failures where user_id = mal), 5);
  perform pg_temp.said('the sixth, with the right code, is stopped',
    pg_temp.ask(mal, format($q$select (public.attendance_check_in(%L, 'checkin-mal-good'))->>'reason'$q$, s1->>'code')), 'too_many_tries');
  perform pg_temp.counted('and mal was not marked', (select count(*) from public.attendance_marks where student_id = mal), 0);
  perform pg_temp.said('ben, who tried nothing wrong, still checks in',
    pg_temp.ask(ben, format($q$select (public.attendance_check_in(%L, 'checkin-ben-key'))->>'status'$q$, s1->>'code')), 'present');

  -- The window and the late line, by the server's clock.
  perform pg_temp.become(prof);
  s_late := public.attendance_open_session('ECON 1020', '2026FA', 'Late line passed', current_date, now() - interval '30 minutes', now() + interval '1 hour', 10, 'open-late-key');
  s_future := public.attendance_open_session('ECON 1020', '2026FA', 'Not yet', current_date, now() + interval '1 hour', now() + interval '2 hours', 10, 'open-future-key');
  s_past := public.attendance_open_session('ECON 1020', '2026FA', 'Over', current_date, now() - interval '3 hours', now() - interval '1 hour', 10, 'open-past-key');
  execute 'reset role';
  perform pg_temp.said('after the late line, late',
    pg_temp.ask(zed, format($q$select (public.attendance_check_in(%L, 'checkin-zed-late'))->>'status'$q$, s_late->>'code')), 'late');
  perform pg_temp.said('before the window opens, refused',
    pg_temp.ask(ben, format($q$select (public.attendance_check_in(%L, 'checkin-ben-future'))->>'reason'$q$, s_future->>'code')), 'not_open');
  perform pg_temp.said('after the window closes, refused',
    pg_temp.ask(ben, format($q$select (public.attendance_check_in(%L, 'checkin-ben-past'))->>'reason'$q$, s_past->>'code')), 'not_open');
  perform pg_temp.counted('open sessions have different codes',
    (select count(distinct code) from public.attendance_sessions where status = 'open'), 4);

  -- ── Marking ────────────────────────────────────────────────────
  perform pg_temp.denied('a student marking someone', ana,
    format($q$select public.attendance_mark(%L, %L, 'present', '', 'mark-ana-key')$q$, s1->>'id', ben));
  perform pg_temp.refused('a mark that is not one', prof,
    format($q$select public.attendance_mark(%L, %L, 'tardy', '', 'mark-bad-key')$q$, s1->>'id', ben));
  perform pg_temp.refused_for('an excused absence with no note', prof,
    format($q$select public.attendance_mark(%L, %L, 'excused', '  ', 'mark-nonote-key')$q$, s1->>'id', zed), 'needs a note');
  perform pg_temp.refused_for('marking a student not on the roster', prof,
    format($q$select public.attendance_mark(%L, %L, 'present', '', 'mark-dan-key')$q$, s1->>'id', dan), 'not on this course');
  perform pg_temp.said('the instructor excuses zed, a new version', pg_temp.ask(prof,
    format($q$select public.attendance_mark(%L, %L, 'excused', 'Illness, documented', 'mark-zed-key')$q$, s1->>'id', zed)), '1');
  perform pg_temp.said('and changes ana to late, version 2', pg_temp.ask(ta,
    format($q$select public.attendance_mark(%L, %L, 'late', 'Arrived after the code closed', 'mark-ana-late')$q$, s1->>'id', ana)), '2');
  perform pg_temp.counted('ana has both versions', (select count(*) from public.attendance_marks where student_id = ana and session_id = (s1->>'id')::uuid), 2);

  -- ── Reading marks ──────────────────────────────────────────────
  perform pg_temp.counted('ana reads her own marks only', pg_temp.seen(ana, 'select 1 from public.attendance_marks'), 2);
  perform pg_temp.counted('ben reads his', pg_temp.seen(ben, 'select 1 from public.attendance_marks'), 1);
  perform pg_temp.counted('the instructor reads all of them', pg_temp.seen(prof, 'select 1 from public.attendance_marks'), 5);
  perform pg_temp.counted('faculty of another course read none', pg_temp.seen(other_prof, 'select 1 from public.attendance_marks'), 0);

  -- ── Closing ────────────────────────────────────────────────────
  perform pg_temp.denied('a student closing a session', ana, format($q$select public.attendance_close_session(%L, 'close-ana-key')$q$, s1->>'id'));
  perform pg_temp.said('closing marks the unmarked roster absent: mal only', pg_temp.ask(prof,
    format($q$select public.attendance_close_session(%L, 'close-s1-key')$q$, s1->>'id')), '1');
  perform pg_temp.counted('mal is absent, by the close', (select count(*) from public.attendance_marks
    where student_id = mal and status = 'absent' and method = 'close'), 1);
  perform pg_temp.said('the same key replays the count', pg_temp.ask(prof,
    format($q$select public.attendance_close_session(%L, 'close-s1-key')$q$, s1->>'id')), '1');
  perform pg_temp.refused_for('closing it again under a new key', prof,
    format($q$select public.attendance_close_session(%L, 'close-s1-again')$q$, s1->>'id'), 'already closed');
  perform pg_temp.said('a closed session takes no check-in',
    pg_temp.ask(ben, format($q$select (public.attendance_check_in(%L, 'checkin-ben-closed'))->>'reason'$q$, s1->>'code')), 'no_such_code');

  -- ── Nobody writes through the API, and nothing is rewritten ────
  perform pg_temp.refused('the instructor inserting a mark', prof,
    format($q$insert into public.attendance_marks (tenant_id, session_id, student_id, course_code, term, held_on, version, status, method, marked_at, operation) values ('at-u', %L, %L, 'ECON 1020', '2026FA', current_date, 9, 'present', 'instructor', now(), 'k')$q$, s1->>'id', ben));
  perform pg_temp.refused('a student updating a mark', ana, $q$update public.attendance_marks set status = 'present'$q$);
  perform pg_temp.refused('a student deleting a mark', ana, $q$delete from public.attendance_marks$q$);
  perform pg_temp.refused('anyone reading the failed tries', prof, $q$select * from public.attendance_failures$q$);
  begin
    update public.attendance_marks set status = 'present';
    raise exception 'FAILED: the owner rewrote a mark';
  exception when others then
    if sqlerrm not like '%never rewritten%' then raise; end if;
    raise notice 'ok  even the owner cannot rewrite a mark (%)', sqlerrm;
  end;

  -- ── Frozen and killed ──────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'at-u' and module = 'attendance';
  perform pg_temp.refused_for('opening once the module is frozen', prof,
    format(open_sql, 'Frozen', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '10', 'open-frozen-key'), 'does not run attendance in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'at-u' and module = 'attendance';
  perform pg_temp.works('and again once it is Core', prof,
    format(open_sql, 'Thawed', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '10', 'open-thawed-key'));
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('at-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('opening under the kill switch', prof,
    format(open_sql, 'Killed', $t$now() - interval '1 minute'$t$, $t$now() + interval '1 hour'$t$, '10', 'open-killed-key'), 'does not run attendance in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'at-u';

  -- ── Deleting an account ────────────────────────────────────────
  select count(*) into n from public.attendance_marks where student_id = ana;
  delete from auth.users where id = ana;
  perform pg_temp.counted('deleting ana took her marks', (select count(*) from public.attendance_marks where student_id = ana), 0);
  perform pg_temp.counted('the session stays', (select count(*) from public.attendance_sessions where id = (s1->>'id')::uuid), 1);
  delete from auth.users where id = ta;
  perform pg_temp.counted('deleting the TA clears their name, not the session',
    (select count(*) from public.attendance_sessions where id = (s1->>'id')::uuid and opened_by is null), 1);

  raise notice 'attendance: all checks passed';
end $$;

rollback;
