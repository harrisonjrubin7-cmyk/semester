-- 20261018120000_registration_swap.sql — the atomic swap (REG-6.3).
--
-- A student gives up a seat (or a place on a waitlist) in one section and takes
-- a seat in another section of the same term, in one transaction. The drop and
-- the add commit together or not at all.
--
-- The drop is written first, so the add is judged on the schedule it leaves:
-- a clash or a credit ceiling caused by the section being given up does not
-- refuse the swap. A refusal rolls the drop back inside the nested block, so
-- the student keeps the enrollment they had.
--
-- A swap lands in a seat only. A waitlist place would leave the student with
-- neither the section they hold nor a seat in the one they asked for, and a
-- section that needs approval is not a seat, so both refuse. The decision is
-- recorded in docs/decisions/D-1549.md.

-- The idempotency record names the action it answered. A swap is a fourth
-- student writer, so the list of names widens to take it.
alter table public.registration_requests drop constraint registration_requests_action_check;
alter table public.registration_requests add constraint registration_requests_action_check
  check (action in ('enroll', 'drop', 'withdraw', 'override', 'decide', 'swap'));

create or replace function public.registration_swap(want_add uuid, want_drop uuid, want_key text, want_expect text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  school text := private.registration_school();
  k      text := private.registration_key(want_key);
  print  text := md5(jsonb_build_array('swap', want_add, want_drop, want_expect)::text);
  prior  jsonb;
  shut   text;
  add_s  public.registration_sections;
  drop_s public.registration_sections;
  t      public.registration_terms;
  e      public.registration_enrollments;
  h      public.registration_holds;
  row_id uuid;
  moved  integer := 0;
  next_  text;
  why    text;
  result jsonb;
begin
  if want_expect is not null and want_expect <> 'seat' then
    raise exception 'semester: a swap lands in a seat, so expect a seat or say nothing' using errcode = 'check_violation';
  end if;
  if want_add is not distinct from want_drop then
    raise exception 'semester: a swap needs two different sections' using errcode = 'check_violation';
  end if;
  prior := private.registration_replay(me, k, 'swap', print);
  if prior is not null then return prior; end if;

  shut := private.registration_gate(school);
  if shut is not null then
    return private.registration_refusal(shut, case shut when 'kill_switch'
      then 'Registration changes are stopped by a kill switch right now. Nothing was changed.'
      else 'Registration through Semester is not turned on for this school. Nothing was changed.' end);
  end if;

  select * into add_s from public.registration_sections s where s.id = want_add and s.tenant_id = school;
  select * into drop_s from public.registration_sections s where s.id = want_drop and s.tenant_id = school;
  if add_s.id is null or drop_s.id is null then
    return private.registration_refusal('unknown_section', 'No such section this term.');
  end if;
  if add_s.term <> drop_s.term then
    return private.registration_refusal('different_term', 'A swap is between two sections of the same term.');
  end if;

  perform private.registration_lock_term(school, add_s.term);
  select * into add_s from public.registration_sections s where s.id = want_add for update;
  select * into drop_s from public.registration_sections s where s.id = want_drop for update;
  select * into t from public.registration_terms where tenant_id = school and term = add_s.term;
  select * into e from public.registration_enrollments x
   where x.section_id = drop_s.id and x.student = me and x.state in ('enrolled', 'waitlisted', 'pending_approval');
  if e.id is null then
    return private.registration_refusal('not_enrolled', 'You are not enrolled or waiting in ' || drop_s.course_code || ' ' || drop_s.section || '.');
  end if;
  if e.state = 'enrolled' and now() > t.add_drop_ends_at then
    return private.registration_refusal('drop_deadline_passed',
      'The add/drop deadline for ' || drop_s.course_code || ' ' || drop_s.section || ' has passed. You can withdraw instead, which records a W.');
  end if;

  -- A hold stops the add, so it stops the swap before anything moves. Which
  -- office, and its link. Never why.
  select * into h from public.registration_holds x
   where x.tenant_id = school and x.student = me and x.released_at is null
   order by x.placed_at limit 1;
  if h.id is not null then
    return private.registration_refusal('hold',
      'A hold on your account blocks registration. The office that placed it can clear it.',
      jsonb_build_object('hold', jsonb_build_object('office', h.office, 'link', h.link)));
  end if;

  begin
    next_ := case e.state when 'waitlisted' then 'left_waitlist' else 'dropped' end;
    update public.registration_enrollments
       set state = next_, wait_seq = null, version = version + 1, updated_at = now()
     where id = e.id;
    perform private.registration_audit(school, me, me, drop_s.id, e.id, next_, 'swap');
    if e.state = 'enrolled' then
      moved := private.registration_promote(drop_s.id, me);
    end if;

    why := private.registration_blocker(me, add_s, t, true, null);
    if why is null and add_s.requires_approval and not private.registration_waived(me, add_s.id, 'approval') then
      why := 'approval_required';
    end if;
    if why is null and not (add_s.seats_taken < add_s.capacity or private.registration_waived(me, add_s.id, 'capacity')) then
      why := case when want_expect is null then 'full' else 'stale_seat_count' end;
    end if;
    if why is not null then
      raise exception using errcode = 'SWP01', message = why;
    end if;

    insert into public.registration_enrollments (tenant_id, section_id, student, state)
    values (school, add_s.id, me, 'enrolled') returning id into row_id;
    perform private.registration_audit(school, me, me, add_s.id, row_id, 'enrolled', 'swap');
    perform private.registration_recount(drop_s.id);
    perform private.registration_recount(add_s.id);
    result := private.registration_commit(school, me, k, 'swap', print,
      private.registration_answer('enrolled',
        'Swapped ' || drop_s.course_code || ' ' || drop_s.section || ' for ' || add_s.course_code || ' ' || add_s.section || '.',
        row_id, add_s.id, moved));
  exception when sqlstate 'SWP01' then
    -- The savepoint has rolled the drop back with the rest of the block.
    why := sqlerrm;
    return private.registration_refusal(why,
      add_s.course_code || ' ' || add_s.section || ': ' || replace(why, '_', ' ') || '. Nothing was changed; your current enrollment stands.');
  end;

  return result;
end $$;

revoke all on function public.registration_swap(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.registration_swap(uuid, uuid, text, text) to authenticated;
