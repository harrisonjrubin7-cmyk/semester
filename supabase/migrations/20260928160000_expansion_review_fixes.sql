-- Review fixes to the feature expansion's server half (Phases G, J and K).
--
-- Codex's review of the merged stack found three things the SQL let through:
--
-- 1. **An office read other offices' actions directly.** The read policy on
--    `institution_actions` let anyone holding either publishing capability in a
--    scope select every row in it, whatever its `office`. `office_desk_actions`
--    and `move_office_action` already asked `private.may_publish`, so the desk
--    was right and PostgREST was not: a registrar could select Financial Aid
--    drafts, review notes and targeting. A row with an office is now readable
--    by staff only where `private.may_publish` says they could publish it.
--    Rows from before Phase J (no office) keep the rule they were written
--    under.
--
-- 2. **Delete my account left demand contributions behind.** `demand_consents`
--    allows no client write, and neither it nor `term_plan_courses` was in the
--    deletion list; `deleteEverything` signs out rather than deleting the auth
--    user, so the cascade never runs. A live consent kept the student's
--    courses in the next refresh. `forget_my_course_demand()` removes both.
--
-- 3. **Delete my account kept shares received as an advisor.** The deletion
--    filtered `advisor_shares` by `student_id` only, and the table has no
--    advisor delete policy. `forget_my_advisor_shares()` removes the rows that
--    name the caller at either end, as `forget_my_support_access` does.

-- ── 1. Staff read only their own office's actions ─────────────────────────

drop policy if exists "a student reads actions meant for them" on public.institution_actions;
create policy "a student reads actions meant for them" on public.institution_actions
  for select using (
    (status = 'published' and withdrawn_at is null
     and private.action_reaches_me(audience_kind, tenant_id, target_student, target_cohort,
                                   target_program, target_eligibility))
    or (office is not null
        and private.may_publish(office, publisher_scope_kind, publisher_scope_id, action_type))
    or (office is null
        and (private.has_capability('institution_action:publish', publisher_scope_kind, publisher_scope_id)
             or private.has_capability('resource:publish', publisher_scope_kind, publisher_scope_id)))
  );

-- ── 2. Forgetting a demand contribution with the account ──────────────────

create or replace function public.forget_my_course_demand()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  plans bigint;
  consents bigint;
begin
  if who is null then
    raise exception using errcode = '42501', message = 'Sign in first.';
  end if;
  delete from public.term_plan_courses where user_id = who;
  get diagnostics plans = row_count;
  delete from public.demand_consents where user_id = who;
  get diagnostics consents = row_count;
  return plans + consents;
end $$;
revoke all on function public.forget_my_course_demand() from public, anon, authenticated;
grant execute on function public.forget_my_course_demand() to authenticated;

-- ── 3. Forgetting advisor shares at either end ────────────────────────────

create or replace function public.forget_my_advisor_shares()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid := auth.uid();
  removed bigint;
begin
  if who is null then
    raise exception using errcode = '42501', message = 'Sign in first.';
  end if;
  delete from public.advisor_shares where student_id = who or advisor_id = who;
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function public.forget_my_advisor_shares() from public, anon, authenticated;
grant execute on function public.forget_my_advisor_shares() to authenticated;
