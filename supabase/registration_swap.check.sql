-- supabase/registration_swap.check.sql — the atomic swap (REG-6.3).
--
-- For 20261018120000_registration_swap.sql. One school, two students and a
-- registrar. The swap is held to what the spec says it does:
--
--   * a swap moves a student from one section to another in one step, and the
--     add is judged on the schedule the drop leaves: a clash with the section
--     being given up does not refuse it, while a plain enroll into the same
--     section is refused for that clash (the control);
--   * when the add is refused the drop is rolled back with it, so the student
--     keeps the enrollment they had, and the refused section takes no seat;
--   * a replayed key returns the stored answer, and a reused key with other
--     arguments is refused;
--   * a hold, a section the student does not hold, a second term, and a
--     kill switch each refuse, and none of them moves a seat.
--
--   How to run it: supabase/check.sh registration_swap

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

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- A function's jsonb answer, called as `who`.
create or replace function pg_temp.call(who uuid, statement text)
returns jsonb language plpgsql as $$
declare r jsonb;
begin
  perform pg_temp.become(who);
  execute statement into r;
  execute 'reset role';
  return r;
exception when others then
  execute 'reset role';
  return jsonb_build_object('raised', sqlerrm);
end $$;

-- The reason a registration call answered with.
create or replace function pg_temp.reason(who uuid, statement text)
returns text language plpgsql as $$
declare r jsonb := pg_temp.call(who, statement);
begin
  return coalesce(r->>'reason', 'raised: ' || (r->>'raised'));
end $$;

do $$
declare
  ana uuid; ben uuid; reg uuid;
  math uuid; hist uuid; chem uuid; eng uuid;
  r jsonb;
begin
  insert into public.schools (id, name, email_domains) values
    ('sw-u', 'Swap University', array['sw-u.example']);

  ana := pg_temp.newuser('ana@sw-u.example', 'sw-u');
  ben := pg_temp.newuser('ben@sw-u.example', 'sw-u');
  reg := pg_temp.newuser('registrar@sw-u.example', 'sw-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (reg, 'registrar', 'school', 'sw-u', 'institution');
  insert into public.tenant_feature_policy (tenant_id, capability, state)
  values ('sw-u', 'writeback.registration_submit', 'production');

  perform pg_temp.become(reg);
  perform public.registrar_put_term('2026FA', now() - interval '1 day', now() + interval '10 days', now() + interval '20 days', 12);
  -- MATH 101 and HIST 100 meet at the same hour, so they clash.
  math := public.registrar_put_section('2026FA', 'MATH 101', '01', 'Calculus I', 4, 1, 0,
            '[{"days":[1,3,5],"start":540,"end":590}]', '{}', false);
  hist := public.registrar_put_section('2026FA', 'HIST 100', '01', 'World History', 3, 1, 0,
            '[{"days":[1,3,5],"start":570,"end":620}]', '{}', false);
  chem := public.registrar_put_section('2026FA', 'CHEM 110', '01', 'Chemistry', 4, 1, 0,
            '[{"days":[5],"start":780,"end":960}]', '{}', false);
  perform public.registrar_put_term('2026SP', now() - interval '1 day', now() + interval '10 days', now() + interval '20 days', 12);
  eng  := public.registrar_put_section('2026SP', 'ENG 101', '01', 'Writing', 3, 1, 0,
            '[{"days":[2],"start":600,"end":650}]', '{}', false);
  reset role;

  -- Ana holds the only MATH seat. Ben holds the only CHEM seat.
  perform pg_temp.said('ana enrolls in MATH 101',
    pg_temp.call(ana, format($q$select public.registration_enroll(%L, 'ana-math-0001', 'seat')$q$, math))->>'outcome', 'enrolled');
  perform pg_temp.said('ben enrolls in CHEM 110',
    pg_temp.call(ben, format($q$select public.registration_enroll(%L, 'ben-chem-0001', 'seat')$q$, chem))->>'outcome', 'enrolled');

  -- Control: a plain enroll into HIST is refused for the clash with MATH.
  perform pg_temp.said('control: a plain enroll into HIST clashes with MATH',
    pg_temp.reason(ana, format($q$select public.registration_enroll(%L, 'ana-hist-0001')$q$, hist)), 'time_conflict');

  -- A refused add rolls the drop back: CHEM is full, so ana keeps MATH.
  perform pg_temp.said('a swap into a full section is refused',
    pg_temp.reason(ana, format($q$select public.registration_swap(%L, %L, 'ana-swap-0001')$q$, chem, math)), 'full');
  perform pg_temp.counted('and ana still holds MATH: the drop did not survive the refusal',
    (select count(*) from public.registration_enrollments where student = ana and section_id = math and state = 'enrolled'), 1);
  perform pg_temp.counted('the MATH count is unchanged',
    (select seats_taken from public.registration_sections where id = math), 1);
  perform pg_temp.counted('and CHEM still has one seat, ben''s',
    (select seats_taken from public.registration_sections where id = chem), 1);

  -- The swap that the clash control refused plainly: it succeeds, because the
  -- drop of MATH leaves the schedule HIST needs.
  r := pg_temp.call(ana, format($q$select public.registration_swap(%L, %L, 'ana-swap-0002')$q$, hist, math));
  perform pg_temp.said('a swap from MATH to HIST, across the clash, succeeds', coalesce(r->>'outcome', r::text), 'enrolled');
  perform pg_temp.said('and says what changed', r->>'message', 'Swapped MATH 101 01 for HIST 100 01.');
  perform pg_temp.counted('ana now holds HIST',
    (select count(*) from public.registration_enrollments where student = ana and section_id = hist and state = 'enrolled'), 1);
  perform pg_temp.counted('and MATH is dropped, not withdrawn',
    (select count(*) from public.registration_enrollments where student = ana and section_id = math and state = 'dropped'), 1);
  perform pg_temp.counted('MATH frees its seat',
    (select seats_taken from public.registration_sections where id = math), 0);
  perform pg_temp.counted('HIST takes its seat',
    (select seats_taken from public.registration_sections where id = hist), 1);

  -- The same key replays the stored answer and writes nothing.
  r := pg_temp.call(ana, format($q$select public.registration_swap(%L, %L, 'ana-swap-0002')$q$, hist, math));
  perform pg_temp.said('the same key replays the answer', r->>'replayed', 'true');
  perform pg_temp.counted('and writes no second HIST row',
    (select count(*) from public.registration_enrollments where student = ana and section_id = hist), 1);
  perform pg_temp.said('a reused key with other arguments is refused',
    pg_temp.reason(ana, format($q$select public.registration_swap(%L, %L, 'ana-swap-0002')$q$, chem, hist)), 'idempotency_conflict');

  -- Not held: ben cannot give up a section he is not in.
  perform pg_temp.said('a swap out of a section the student is not in is refused',
    pg_temp.reason(ben, format($q$select public.registration_swap(%L, %L, 'ben-swap-0001')$q$, hist, math)), 'not_enrolled');
  perform pg_temp.counted('and CHEM is still ben''s',
    (select count(*) from public.registration_enrollments where student = ben and section_id = chem and state = 'enrolled'), 1);

  -- Across terms: one calendar at a time.
  perform pg_temp.said('a swap between two terms is refused',
    pg_temp.reason(ben, format($q$select public.registration_swap(%L, %L, 'ben-swap-0002')$q$, eng, chem)), 'different_term');

  -- A hold stops the add before anything moves, and names the office.
  insert into public.registration_holds (tenant_id, student, office, link, reason)
  values ('sw-u', ben, 'Student Accounts', 'https://accounts.sw-u.example', 'Unpaid balance 4210 referred to collections');
  r := pg_temp.call(ben, format($q$select public.registration_swap(%L, %L, 'ben-swap-0003')$q$, math, chem));
  perform pg_temp.said('a hold refuses the swap', r->>'reason', 'hold');
  perform pg_temp.said('naming the office', r->'hold'->>'office', 'Student Accounts');
  perform pg_temp.counted('and the reason never reaches the student',
    (r::text like '%4210%' or r::text like '%collections%')::int, 0);
  perform pg_temp.counted('ben still holds CHEM: the hold stopped the drop too',
    (select count(*) from public.registration_enrollments where student = ben and section_id = chem and state = 'enrolled'), 1);

  -- The kill switch stops it, and the school flag's state is what decides.
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('sw-u', 'kill.writeback', true, 'swap check', now());
  perform pg_temp.said('kill.writeback stops a swap',
    pg_temp.reason(ana, format($q$select public.registration_swap(%L, %L, 'ana-swap-0003')$q$, math, hist)), 'kill_switch');
  perform pg_temp.counted('and HIST is still ana''s',
    (select count(*) from public.registration_enrollments where student = ana and section_id = hist and state = 'enrolled'), 1);
end $$;

rollback;
