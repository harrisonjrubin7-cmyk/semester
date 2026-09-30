-- Semester — a student's term-plan saves, one at a time.
--
-- Found by `supabase/load.sh` (scenario `plans-same-student`): with sixteen
-- sessions saving plans for eight students, `contribute_course_plan`
-- deadlocked 13 times in eight seconds, and the waits it survived cost up to
-- two seconds each. A student with Semester open on a phone and a laptop who
-- saves on both hits it. The function deletes the student's contributing rows
-- for the term and re-inserts them; two concurrent saves take those rows'
-- locks in opposite orders.
--
-- The fix is a transaction-scoped advisory lock on (student, term) at the top
-- of both functions that write those rows, after the caller is known. Two
-- saves by one student now queue; saves by different students never touch the
-- same key, so nothing else waits. The bodies are otherwise exactly
-- 20260928305000_course_demand_forecasting.sql's, and the grants are restated.
--
-- Additive. NOT APPLIED to production; applying it needs owner approval.

create or replace function public.contribute_course_plan(want_term text, want_courses jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := (select private.school_of());
  item   jsonb;
  code   text;
  kind   text;
  n      integer := 0;
begin
  if me is null then
    raise exception 'Sign in to contribute.' using errcode = '42501';
  end if;
  -- One save at a time for this student and term. Two devices saving at
  -- once used to take the same rows' locks in opposite orders and deadlock.
  perform pg_advisory_xact_lock(hashtextextended('term_plan:' || me::text || ':' || trim(want_term), 0));
  if school is null then
    raise exception 'Set your school on your profile to contribute.';
  end if;
  if want_term is null or length(trim(want_term)) not between 1 and 40 then
    raise exception 'Choose a term.';
  end if;
  if jsonb_typeof(want_courses) <> 'array' or jsonb_array_length(want_courses) not between 1 and 30 then
    raise exception 'Contribute between one and thirty courses.';
  end if;

  delete from public.term_plan_courses
   where user_id = me and term_code = trim(want_term) and contributes_to_demand;

  for item in select * from jsonb_array_elements(want_courses) loop
    -- "econ1010" is stored as "ECON 1010": the department scope splits on the space.
    code := regexp_replace(regexp_replace(upper(trim(item ->> 'course')), '\s+', ' ', 'g'), '^([A-Z&]+) ?([0-9])', '\1 \2');
    kind := item ->> 'role';
    if code is null or code !~ '^[A-Z&]{2,8} ?[0-9]{3,4}[A-Z]?$' then
      raise exception 'Not a course code: %', coalesce(item ->> 'course', '(blank)');
    end if;
    if kind not in ('primary', 'backup') then
      raise exception 'Each course is a primary or a backup.';
    end if;
    -- One row per course: a course that is both is counted as planned.
    if exists (select 1 from public.term_plan_courses
                where user_id = me and term_code = trim(want_term) and contributes_to_demand
                  and course_code = code) then
      if kind = 'primary' then
        update public.term_plan_courses
           set status = 'planned', backup_rank = null, updated_at = now()
         where user_id = me and term_code = trim(want_term) and contributes_to_demand and course_code = code;
      end if;
      continue;
    end if;
    insert into public.term_plan_courses (user_id, tenant_id, term_code, course_code, status, backup_rank, contributes_to_demand)
    values (me, school, trim(want_term), code,
            case when kind = 'primary' then 'planned' else 'backup' end,
            case when kind = 'backup' then least(greatest(coalesce((item ->> 'rank')::integer, 1), 1), 20) end,
            true);
    n := n + 1;
  end loop;

  insert into public.demand_consents (user_id, tenant_id, term_code, consented_at, revoked_at)
  values (me, school, trim(want_term), now(), null)
  on conflict (user_id, term_code)
  do update set tenant_id = excluded.tenant_id, consented_at = now(), revoked_at = null;
  return n;
end;
$$;
revoke all on function public.contribute_course_plan(text, jsonb) from public, anon;
grant execute on function public.contribute_course_plan(text, jsonb) to authenticated;

create or replace function public.stop_contributing(want_term text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  -- One save at a time for this student and term. Two devices saving at
  -- once used to take the same rows' locks in opposite orders and deadlock.
  perform pg_advisory_xact_lock(hashtextextended('term_plan:' || me::text || ':' || trim(want_term), 0));
  delete from public.term_plan_courses
   where user_id = me and term_code = trim(want_term) and contributes_to_demand;
  update public.demand_consents set revoked_at = now()
   where user_id = me and term_code = trim(want_term) and revoked_at is null;
end;
$$;
revoke all on function public.stop_contributing(text) from public, anon;
grant execute on function public.stop_contributing(text) to authenticated;
