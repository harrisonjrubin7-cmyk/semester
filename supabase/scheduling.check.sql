-- supabase/scheduling.check.sql — who manages a space, who books one, that two
-- confirmed bookings never overlap, and that a timetable is verified by the
-- database and published by a second person.
--
-- For 20261001080000_scheduling.sql. One school, sc-u: two scheduling officers, a
-- registrar, three members, a member with no role and an officer of another
-- school. What it proves:
--
--   * nothing is written unless the school runs `scheduling` in Core;
--   * only `space:manage` saves and retires a space, each change leaving an event;
--   * a member requests a meeting, an event or study in the future for at most
--     twelve hours; a class or an exam is booked only by the office; a booking
--     is decided by someone other than the requester;
--   * no two confirmed bookings of a space overlap, even written directly; a
--     booking's time is never edited;
--   * a saved run is checked by the database for a room or instructor in two
--     places, a room too small or missing a feature, an unbookable space, an
--     unknown section and a bad pattern; a run with a conflict is never published,
--     and a run is published by someone other than who saved it;
--   * a booking goes with its requester's account; staff names are cleared.
--
--   How to run it: supabase/check.sh scheduling

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

-- A ledger entry, written directly (the ledger's own path has its own suite).
create or replace function pg_temp.entry(school text, who text, kind text, subject text, val text, ago integer default 30)
returns void language plpgsql as $$
declare ch uuid := gen_random_uuid();
begin
  set local session_replication_role = replica;
  insert into public.academic_record_entries
    (tenant_id, student_ref, kind, subject_key, action, value, effective_on, reason, source, change_id, override)
  values (school, who, kind, subject, 'set', val, current_date - ago, 'seed for the check', 'registrar', ch, false);
  set local session_replication_role = origin;
end $$;

do $$
declare
  officer uuid; officer2 uuid; registrar uuid; ana uuid; ben uuid; eve uuid; outsider uuid;
  r jsonb; r2 jsonb; b1 jsonb; b2 jsonb; run1 jsonb; run2 jsonb; run3 jsonb; sid uuid;
  save_sql constant text := $q$select public.space_save(%L, %L, 'Hall', %s, %L::text[], true, %L)$q$;
  req_sql constant text := $q$select public.space_booking_request(%L, %L, %L, %s, %s, %L)$q$;
  t0 constant text := $t$date_trunc('hour', now()) + interval '2 days'$t$;
  input constant text := $i${"sections":[
    {"course":"ECON 1010","section":"01","enrolment":30,"instructor":"Dr Rao","needs":[]},
    {"course":"ECON 1020","section":"01","enrolment":28,"instructor":"Dr Rao","needs":["projector"]},
    {"course":"HIST 2100","section":"01","enrolment":90,"instructor":"Dr Kim","needs":[]}]}$i$;
begin
  insert into public.schools (id, name, email_domains) values ('sc-u', 'Scheduling University', array['sc-u.example']), ('sc-other', 'Other University', array['sc-other.example']);
  officer   := pg_temp.newuser('officer@sc-u.example', 'sc-u');
  officer2  := pg_temp.newuser('officer2@sc-u.example', 'sc-u');
  registrar := pg_temp.newuser('registrar@sc-u.example', 'sc-u');
  ana       := pg_temp.newuser('ana@sc-u.example', 'sc-u');
  ben       := pg_temp.newuser('ben@sc-u.example', 'sc-u');
  eve       := pg_temp.newuser('eve@sc-u.example', 'sc-u');
  outsider  := pg_temp.newuser('outsider@sc-other.example', 'sc-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (officer,   'scheduling_officer', 'school', 'sc-u', 'institution'),
    (officer2,  'scheduling_officer', 'school', 'sc-u', 'institution'),
    (registrar, 'registrar',          'school', 'sc-u', 'institution'),
    (outsider,  'scheduling_officer', 'school', 'sc-other', 'institution');

  -- ── Connect: nothing is written ────────────────────────────────
  perform pg_temp.refused_for('saving a space while the school is in Connect', officer, format(save_sql, 'HALL-101', 'Hall 101', 40, '{}', 'space-connect-key'), 'does not run scheduling in Core');
  insert into public.tenant_module_mode (tenant_id, module, mode, frozen, reason) values ('sc-u', 'scheduling', 'core', false, 'check');

  -- ── Spaces ─────────────────────────────────────────────────────
  perform pg_temp.refused_for('a student saving a space', ana, format(save_sql, 'HALL-101', 'Hall 101', 40, '{}', 'space-ana-key001'), 'that needs space:manage');
  perform pg_temp.refused_for('a registrar saving a space', registrar, format(save_sql, 'HALL-101', 'Hall 101', 40, '{}', 'space-reg-key001'), 'that needs space:manage');
  perform pg_temp.refused_for('a capacity of zero', officer, format(save_sql, 'HALL-101', 'Hall 101', 0, '{}', 'space-zero-key01'), 'check');
  r := pg_temp.ask(officer, format(save_sql, 'hall-101', 'Hall 101', 40, '{projector,whiteboard}', 'space-hall101-k1'))::jsonb;
  r2 := pg_temp.ask(officer, format(save_sql, 'hall-101', 'Hall 101', 40, '{projector,whiteboard}', 'space-hall101-k1'))::jsonb;
  perform pg_temp.said('the same key answers the same space', r2->>'id', r->>'id');
  perform pg_temp.works('a small room', officer, format(save_sql, 'LAB-1', 'Lab 1', 24, '{}', 'space-lab1-key01'));
  perform pg_temp.works('a big hall', officer, format(save_sql, 'GREAT-HALL', 'Great Hall', 200, '{projector}', 'space-great-key01'));
  perform pg_temp.counted('three spaces, each with a created event', (select count(*) from public.campus_spaces) * 10 + (select count(*) from public.space_events where kind = 'created'), 33);
  perform pg_temp.works('changing the capacity', officer, format(save_sql, 'HALL-101', 'Hall 101', 45, '{projector,whiteboard}', 'space-hall101-k2'));
  perform pg_temp.said('the change kept the old and the new', (select (before->>'capacity') || '->' || (after->>'capacity') from public.space_events where kind = 'changed'), '40->45');
  perform pg_temp.counted('a member reads the spaces', pg_temp.seen(ana, 'select 1 from public.campus_spaces'), 3);
  perform pg_temp.counted('a member does not read their history', pg_temp.seen(ana, 'select 1 from public.space_events'), 0);
  perform pg_temp.counted('an officer of another school reads none', pg_temp.seen(outsider, 'select 1 from public.campus_spaces'), 0);
  perform pg_temp.refused_for('a client writing a space directly', officer, $q$insert into public.campus_spaces (tenant_id, code, name, capacity) values ('sc-u', 'X-1', 'X', 5)$q$, 'permission denied');
  begin
    update public.campus_spaces set code = 'CHANGED' where code = 'LAB-1';
    raise exception 'FAILED: a space''s code was changed';
  exception when insufficient_privilege then
    raise notice 'ok  a space''s code is never changed (%)', sqlerrm;
  end;

  -- ── Requesting ─────────────────────────────────────────────────
  perform pg_temp.refused_for('requesting a class as a member', ana, format(req_sql, 'HALL-101', 'class', 'Econ', t0 || ' + interval ''9 hours''', t0 || ' + interval ''10 hours''', 'req-class-key001'), 'booked by the scheduling office');
  perform pg_temp.refused_for('requesting a space that does not exist', ana, format(req_sql, 'NOPE-1', 'meeting', 'Club', t0 || ' + interval ''9 hours''', t0 || ' + interval ''10 hours''', 'req-nope-key0001'), 'cannot be booked');
  perform pg_temp.refused_for('requesting the past', ana, format(req_sql, 'HALL-101', 'meeting', 'Club', 'now() - interval ''2 days''', 'now() - interval ''2 days'' + interval ''1 hour''', 'req-past-key0001'), 'for the future');
  perform pg_temp.refused_for('a window over twelve hours', ana, format(req_sql, 'HALL-101', 'meeting', 'Club', t0 || ' + interval ''1 hour''', t0 || ' + interval ''14 hours''', 'req-long-key0001'), 'space_booking_window');
  perform pg_temp.refused_for('a window that ends before it begins', ana, format(req_sql, 'HALL-101', 'meeting', 'Club', t0 || ' + interval ''5 hours''', t0 || ' + interval ''4 hours''', 'req-back-key0001'), 'space_booking_window');
  b1 := pg_temp.ask(ana, format(req_sql, 'HALL-101', 'meeting', 'Economics club', t0 || ' + interval ''9 hours''', t0 || ' + interval ''11 hours''', 'req-ana-key00001'))::jsonb;
  r2 := pg_temp.ask(ana, format(req_sql, 'HALL-101', 'meeting', 'Economics club', t0 || ' + interval ''9 hours''', t0 || ' + interval ''11 hours''', 'req-ana-key00001'))::jsonb;
  perform pg_temp.said('the same key answers the same booking', r2->>'id', b1->>'id');
  perform pg_temp.said('a request starts requested', b1->>'status', 'requested');
  perform pg_temp.counted('Ana reads her request', pg_temp.seen(ana, 'select 1 from public.space_bookings'), 1);
  perform pg_temp.counted('Ben does not read it while it is only a request', pg_temp.seen(ben, 'select 1 from public.space_bookings'), 0);
  perform pg_temp.counted('the officer reads it', pg_temp.seen(officer, 'select 1 from public.space_bookings'), 1);

  -- ── Deciding, and no double booking ────────────────────────────
  perform pg_temp.refused_for('a student deciding', ben, format($q$select public.space_booking_decide(%L, true, '', 'dec-ben-key0001')$q$, b1->>'id'), 'that needs space:approve');
  perform pg_temp.works('an officer requesting a meeting for themselves', officer, format(req_sql, 'LAB-1', 'meeting', 'Staff meeting', t0 || ' + interval ''9 hours''', t0 || ' + interval ''10 hours''', 'req-off-key00001'));
  b2 := pg_temp.ask(officer, format(req_sql, 'LAB-1', 'event', 'Open lab', t0 || ' + interval ''13 hours''', t0 || ' + interval ''14 hours''', 'req-off-key00002'))::jsonb;
  perform pg_temp.refused_for('the requester deciding their own booking', officer, format($q$select public.space_booking_decide(%L, true, '', 'dec-self-key001')$q$, b2->>'id'), 'someone other than who requested');
  perform pg_temp.works('another officer confirming Ana''s', officer, format($q$select public.space_booking_decide(%L, true, 'Fine.', 'dec-off-key0001')$q$, b1->>'id'));
  perform pg_temp.refused_for('deciding it twice', officer2, format($q$select public.space_booking_decide(%L, false, '', 'dec-off-key0002')$q$, b1->>'id'), 'already decided');
  perform pg_temp.counted('Ben now sees the confirmed booking', pg_temp.seen(ben, 'select 1 from public.space_bookings'), 1);
  r := pg_temp.ask(ben, format(req_sql, 'HALL-101', 'study', 'Study group', t0 || ' + interval ''10 hours''', t0 || ' + interval ''12 hours''', 'req-ben-key00001'))::jsonb;
  perform pg_temp.refused_for('confirming an overlapping booking', officer, format($q$select public.space_booking_decide(%L, true, '', 'dec-off-key0003')$q$, r->>'id'), 'already booked');
  perform pg_temp.works('declining it instead', officer, format($q$select public.space_booking_decide(%L, false, 'Taken.', 'dec-off-key0004')$q$, r->>'id'));
  perform pg_temp.works('a booking that merely touches the end of the other', ben, format(req_sql, 'HALL-101', 'study', 'Later', t0 || ' + interval ''11 hours''', t0 || ' + interval ''12 hours''', 'req-ben-key00002'));
  begin
    insert into public.space_bookings (tenant_id, space_id, requester, purpose, title, starts_at, ends_at, status, operation)
    select 'sc-u', s.id, ana, 'meeting', 'Sneaky', date_trunc('hour', now()) + interval '2 days 10 hours', date_trunc('hour', now()) + interval '2 days 10 hours 30 minutes', 'confirmed', 'x' from public.campus_spaces s where s.code = 'HALL-101';
    raise exception 'FAILED: an overlapping booking was written directly';
  exception when exclusion_violation then
    raise notice 'ok  an overlapping confirmed booking cannot be written, whoever writes it (%)', sqlerrm;
  end;
  begin
    update public.space_bookings set starts_at = starts_at + interval '1 hour' where id = (b1->>'id')::uuid;
    raise exception 'FAILED: a booking''s time was edited';
  exception when insufficient_privilege then
    raise notice 'ok  a booking''s time is never edited (%)', sqlerrm;
  end;

  -- ── Classes and exams, and cancelling ──────────────────────────
  perform pg_temp.refused_for('a student booking a class directly', ana, format($q$select public.space_booking_make('GREAT-HALL', 'class', 'Econ', %s, %s, 'make-ana-key0001')$q$, t0 || ' + interval ''9 hours''', t0 || ' + interval ''10 hours'''), 'that needs space:approve');
  perform pg_temp.works('an officer booking an exam directly', officer, format($q$select public.space_booking_make('GREAT-HALL', 'exam', 'ECON 1010 final', %s, %s, 'make-off-key0001')$q$, t0 || ' + interval ''9 hours''', t0 || ' + interval ''12 hours'''));
  perform pg_temp.refused_for('a second exam in the same hall at the same time', officer2, format($q$select public.space_booking_make('GREAT-HALL', 'exam', 'HIST 2100 final', %s, %s, 'make-off-key0002')$q$, t0 || ' + interval ''11 hours''', t0 || ' + interval ''13 hours'''), 'already booked');
  perform pg_temp.refused_for('Ben cancelling Ana''s booking', ben, format($q$select public.space_booking_cancel(%L, 'cancel-ben-key01')$q$, b1->>'id'), 'only who requested');
  perform pg_temp.works('Ana cancelling her own', ana, format($q$select public.space_booking_cancel(%L, 'cancel-ana-key01')$q$, b1->>'id'));
  perform pg_temp.refused_for('cancelling it twice', ana, format($q$select public.space_booking_cancel(%L, 'cancel-ana-key02')$q$, b1->>'id'), 'already closed');
  perform pg_temp.works('the freed time can be booked again', officer, format($q$select public.space_booking_make('HALL-101', 'class', 'Econ 1010', %s, %s, 'make-off-key0003')$q$, t0 || ' + interval ''9 hours''', t0 || ' + interval ''11 hours'''));
  perform pg_temp.counted('Ana reads her booking history', pg_temp.seen(ana, 'select 1 from public.space_booking_events'), 3);
  perform pg_temp.counted('Ben reads only his own', pg_temp.seen(ben, 'select 1 from public.space_booking_events'), 3);

  perform pg_temp.works('retiring a space', officer, $q$select public.space_retire('LAB-1', 'retire-lab-key01')$q$);
  perform pg_temp.refused_for('requesting a retired space', ana, format(req_sql, 'LAB-1', 'meeting', 'Club', t0 || ' + interval ''20 hours''', t0 || ' + interval ''21 hours''', 'req-retired-key1'), 'cannot be booked');
  perform pg_temp.refused_for('changing a retired space', officer, format(save_sql, 'LAB-1', 'Lab 1', 30, '{}', 'space-lab1-key02'), 'retired');
  perform pg_temp.works('an unbookable space still exists', officer, format($q$select public.space_save('STORE-1', 'Store room', 'Hall', 5, '{}'::text[], false, 'space-store-key01')$q$));
  perform pg_temp.refused_for('requesting an unbookable space', ana, format(req_sql, 'STORE-1', 'meeting', 'Club', t0 || ' + interval ''20 hours''', t0 || ' + interval ''21 hours''', 'req-store-key001'), 'cannot be booked');

  -- ── Timetable runs ─────────────────────────────────────────────
  insert into public.registration_terms (tenant_id, term, opens_at, add_drop_ends_at, withdraw_ends_at, max_credits)
  values ('sc-u', '2027SP', now() - interval '1 day', now() + interval '20 days', now() + interval '60 days', 18);
  insert into public.registration_sections (tenant_id, term, course_code, section, title, credits, capacity, meetings) values
    ('sc-u', '2027SP', 'ECON 1010', '01', 'Principles', 3, 30, '[]'), ('sc-u', '2027SP', 'ECON 1020', '01', 'Micro', 3, 28, '[]'), ('sc-u', '2027SP', 'HIST 2100', '01', 'Modern', 3, 90, '[]');
  perform pg_temp.refused_for('a student saving a run', ana, format($q$select public.timetable_run_save('2027SP', %L::jsonb, '{"assignments":[]}'::jsonb, 'run-ana-key0001')$q$, input), 'that needs timetable:run');
  perform pg_temp.refused_for('a registrar (who publishes, not runs) saving a run', registrar, format($q$select public.timetable_run_save('2027SP', %L::jsonb, '{"assignments":[]}'::jsonb, 'run-reg-key0001')$q$, input), 'that needs timetable:run');
  perform pg_temp.refused_for('a run with no sections', officer, $q$select public.timetable_run_save('2027SP', '{}'::jsonb, '{"assignments":[]}'::jsonb, 'run-empty-key01')$q$, 'a list');
  -- A clean proposal.
  run1 := pg_temp.ask(officer, format($q$select public.timetable_run_save('2027SP', %L::jsonb, %L::jsonb, 'run-clean-key01')$q$, input,
    '{"assignments":[
       {"course":"ECON 1010","section":"01","room":"HALL-101","meeting":{"days":[1,3,5],"start":540,"end":590}},
       {"course":"ECON 1020","section":"01","room":"HALL-101","meeting":{"days":[1,3,5],"start":600,"end":650}},
       {"course":"HIST 2100","section":"01","room":"GREAT-HALL","meeting":{"days":[1,3,5],"start":540,"end":590}}]}'))::jsonb;
  perform pg_temp.said('a clean proposal has no conflicts', (run1->'conflicts')::text, '[]');
  -- Each kind of fault.
  run2 := pg_temp.ask(officer, format($q$select public.timetable_run_save('2027SP', %L::jsonb, %L::jsonb, 'run-bad-key0001')$q$, input,
    '{"assignments":[
       {"course":"ECON 1010","section":"01","room":"HALL-101","meeting":{"days":[1,3],"start":540,"end":600}},
       {"course":"ECON 1020","section":"01","room":"HALL-101","meeting":{"days":[3],"start":570,"end":630}},
       {"course":"HIST 2100","section":"01","room":"LAB-1","meeting":{"days":[2],"start":540,"end":590}}]}'))::jsonb;
  perform pg_temp.said('a room in two places and an instructor in two places are both found',
    (select string_agg(distinct x->>'kind', ',' order by x->>'kind') from jsonb_array_elements(run2->'conflicts') x), 'instructor_twice,room_twice,room_unavailable');
  run3 := pg_temp.ask(officer, format($q$select public.timetable_run_save('2027SP', %L::jsonb, %L::jsonb, 'run-bad-key0002')$q$,
    '{"sections":[{"course":"ECON 1010","section":"01","enrolment":50,"instructor":"A","needs":["lab"]}]}',
    '{"assignments":[{"course":"ECON 1010","section":"01","room":"HALL-101","meeting":{"days":[1],"start":540,"end":590}},{"course":"ZZZ 9999","section":"01","room":"HALL-101","meeting":{"days":[2],"start":540,"end":590}},{"course":"ECON 1010","section":"01","room":"HALL-101","meeting":{"days":[9],"start":540,"end":590}}]}'))::jsonb;
  perform pg_temp.said('too small, missing feature, unknown section and a bad pattern are found',
    (select string_agg(distinct x->>'kind', ',' order by x->>'kind') from jsonb_array_elements(run3->'conflicts') x), 'missing_feature,pattern,too_small,unknown_section');
  perform pg_temp.counted('three runs were kept', (select count(*) from public.timetable_runs), 3);
  perform pg_temp.counted('an officer reads them', pg_temp.seen(officer, 'select 1 from public.timetable_runs'), 3);
  perform pg_temp.counted('a student does not', pg_temp.seen(ana, 'select 1 from public.timetable_runs'), 0);
  begin
    update public.timetable_runs set conflicts = '[]'::jsonb;
    raise exception 'FAILED: a run was rewritten';
  exception when insufficient_privilege then
    raise notice 'ok  a saved run is never rewritten (%)', sqlerrm;
  end;

  -- ── Publishing: a second person, and only a clean run ──────────
  perform pg_temp.refused_for('an officer publishing their own run', officer, format($q$select public.timetable_publish(%L, 'pub-off-key0001')$q$, run1->>'id'), 'someone other than who saved');
  perform pg_temp.refused_for('a student publishing', ana, format($q$select public.timetable_publish(%L, 'pub-ana-key0001')$q$, run1->>'id'), 'that needs timetable:publish');
  perform pg_temp.refused_for('publishing a run with conflicts', registrar, format($q$select public.timetable_publish(%L, 'pub-reg-key0001')$q$, run2->>'id'), 'conflict');
  r := pg_temp.ask(registrar, format($q$select public.timetable_publish(%L, 'pub-reg-key0002')$q$, run1->>'id'))::jsonb;
  r2 := pg_temp.ask(registrar, format($q$select public.timetable_publish(%L, 'pub-reg-key0002')$q$, run1->>'id'))::jsonb;
  perform pg_temp.said('publishing sets three sections, and the same key answers the same', (r->>'sections') || (r2->>'sections'), '33');
  perform pg_temp.said('the catalog now holds ECON 1010''s meeting', (select meetings::text from public.registration_sections where course_code = 'ECON 1010'), '[{"end": 590, "days": [1, 3, 5], "start": 540}]');
  perform pg_temp.said('and the section''s version moved', (select version::text from public.registration_sections where course_code = 'ECON 1010'), '2');
  perform pg_temp.refused_for('publishing it again', registrar, format($q$select public.timetable_publish(%L, 'pub-reg-key0003')$q$, run1->>'id'), 'already published');
  perform pg_temp.counted('the publication is on record', (select count(*) from public.timetable_publications), 1);

  -- A room retired after a clean run is a conflict at publication.
  run1 := pg_temp.ask(officer, format($q$select public.timetable_run_save('2027SP', %L::jsonb, %L::jsonb, 'run-clean-key02')$q$, input,
    '{"assignments":[{"course":"HIST 2100","section":"01","room":"STORE-1","meeting":{"days":[2],"start":540,"end":590}}]}'))::jsonb;
  perform pg_temp.said('a store room that cannot be booked is a conflict when saved', (run1->'conflicts'->0->>'kind'), 'room_unavailable');

  -- ── The switches ───────────────────────────────────────────────
  update public.tenant_module_mode set mode = 'connect', frozen = true where tenant_id = 'sc-u' and module = 'scheduling';
  perform pg_temp.refused_for('requesting while the module is frozen', ana, format(req_sql, 'HALL-101', 'meeting', 'Club', t0 || ' + interval ''20 hours''', t0 || ' + interval ''21 hours''', 'req-frozen-key01'), 'does not run scheduling in Core');
  update public.tenant_module_mode set mode = 'core', frozen = false where tenant_id = 'sc-u' and module = 'scheduling';
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason) values ('sc-u', 'kill.core_modules', true, 'drill');
  perform pg_temp.refused_for('cancelling under the kill switch', ben, format($q$select public.space_booking_cancel(%L, 'cancel-kill-key01')$q$, (r->>'run')), 'does not run scheduling in Core');
  update public.feature_kill_switch set engaged = false where tenant_id = 'sc-u';

  -- ── Deleting accounts ──────────────────────────────────────────
  perform pg_temp.said('an account that booked is not untouched', public.lti_account_untouched(ben)::text, 'false');
  perform pg_temp.said('one that did not is', public.lti_account_untouched(eve)::text, 'true');
  delete from auth.users where id = ben;
  perform pg_temp.counted('deleting Ben took his bookings', (select count(*) from public.space_bookings where requester = ben), 0);
  delete from auth.users where id = officer;
  perform pg_temp.counted('deleting the officer keeps the spaces, events and runs they made',
    (select count(*) from public.campus_spaces where created_by is null) + (select count(*) from public.space_events where actor is null) + (select count(*) from public.timetable_runs where saved_by is null), 4 + 6 + 4);
  raise notice 'scheduling checks passed';
end $$;

rollback;
