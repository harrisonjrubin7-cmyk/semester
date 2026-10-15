-- Save a contributed course plan with one set-based insert.
--
-- The original function deleted the old plan, then performed an existence
-- check and an insert (or update) for every requested course. During the
-- registration-week load scenario that multiplied lock, index and statement
-- work by the five courses in every request. Validation remains item-by-item
-- so callers receive the same precise errors, but the write is now one insert.
create or replace function public.contribute_course_plan(want_term text, want_courses jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me         uuid := (select auth.uid());
  school     text := (select private.school_of());
  item       jsonb;
  code       text;
  kind       text;
  rank_value integer;
  cleaned    jsonb := '[]'::jsonb;
  n          integer := 0;
begin
  if me is null then
    raise exception 'Sign in to contribute.' using errcode = '42501';
  end if;
  if school is null then
    raise exception 'Set your school on your profile to contribute.';
  end if;
  if want_term is null or length(trim(want_term)) not between 1 and 40 then
    raise exception 'Choose a term.';
  end if;
  if jsonb_typeof(want_courses) <> 'array' or jsonb_array_length(want_courses) not between 1 and 30 then
    raise exception 'Contribute between one and thirty courses.';
  end if;

  for item in select value from jsonb_array_elements(want_courses) loop
    code := regexp_replace(regexp_replace(upper(trim(item ->> 'course')), '\s+', ' ', 'g'), '^([A-Z&]+) ?([0-9])', '\1 \2');
    kind := item ->> 'role';
    if code is null or code !~ '^[A-Z&]{2,8} ?[0-9]{3,4}[A-Z]?$' then
      raise exception 'Not a course code: %', coalesce(item ->> 'course', '(blank)');
    end if;
    if kind not in ('primary', 'backup') then
      raise exception 'Each course is a primary or a backup.';
    end if;
    rank_value := case when kind = 'backup'
      then least(greatest(coalesce((item ->> 'rank')::integer, 1), 1), 20)
      else null
    end;
    cleaned := cleaned || jsonb_build_array(jsonb_build_object(
      'code', code, 'kind', kind, 'rank', rank_value
    ));
  end loop;

  -- Keep the existing two-device guarantee: replacing the plan is one
  -- student-and-term critical section. Without this lock, two transactions
  -- can both delete the old rows and then insert their new rows, leaving both
  -- plans counted toward demand.
  perform pg_advisory_xact_lock(hashtextextended(
    'term_plan:' || me::text || ':' || trim(want_term), 0
  ));

  delete from public.term_plan_courses
   where user_id = me
     and term_code = trim(want_term)
     and contributes_to_demand;

  -- A primary wins when the same course appears as both. Otherwise the first
  -- occurrence wins, matching the former loop's insert-then-continue behavior.
  with requested as (
    select value ->> 'code' as requested_code,
           value ->> 'kind' as requested_kind,
           (value ->> 'rank')::integer as requested_rank,
           ordinality as position
      from jsonb_array_elements(cleaned) with ordinality
  ), chosen as (
    select distinct on (r.requested_code)
           r.requested_code, r.requested_kind, r.requested_rank
      from requested r
     order by r.requested_code, (r.requested_kind = 'primary') desc, r.position
  )
  insert into public.term_plan_courses
    (user_id, tenant_id, term_code, course_code, status, backup_rank, contributes_to_demand)
  select me, school, trim(want_term), c.requested_code,
         case when c.requested_kind = 'primary' then 'planned' else 'backup' end,
         case when c.requested_kind = 'backup' then c.requested_rank end,
         true
    from chosen c;
  get diagnostics n = row_count;

  insert into public.demand_consents (user_id, tenant_id, term_code, consented_at, revoked_at)
  values (me, school, trim(want_term), now(), null)
  on conflict (user_id, term_code)
  do update set tenant_id = excluded.tenant_id, consented_at = now(), revoked_at = null;

  return n;
end;
$$;

revoke all on function public.contribute_course_plan(text, jsonb) from public, anon;
grant execute on function public.contribute_course_plan(text, jsonb) to authenticated;
