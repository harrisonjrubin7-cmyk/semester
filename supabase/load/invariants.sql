-- supabase/load/invariants.sql — what must still be true after the load.
--
-- Latency is the number a load test prints; these are the reason it exists.
-- Each raises on failure so `load.sh` sees an ERROR and fails the run.

\set ON_ERROR_STOP on

do $$
declare n bigint;
begin
  -- One row per student, term and course that counts toward demand. Two
  -- saves racing from two devices must not leave a course twice.
  select count(*) into n from (
    select user_id, term_code, course_code
      from public.term_plan_courses
     where contributes_to_demand
     group by 1, 2, 3 having count(*) > 1) d;
  if n > 0 then
    raise exception 'INVARIANT: % student-course pairs are counted more than once toward demand', n;
  end if;
  raise notice 'invariant ok: no student-course pair is counted twice';

  -- The cohort never admitted anybody the seed did not put in it.
  select count(*) into n from public.feature_cohort_members m
    join public.load_users u on u.id = m.user_id
   where u.i % 2 <> 0;
  if n > 0 then
    raise exception 'INVARIANT: % odd-numbered students are in the pilot cohort', n;
  end if;
  raise notice 'invariant ok: cohort membership is what the seed wrote';
end $$;
