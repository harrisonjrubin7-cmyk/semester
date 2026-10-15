-- Semester — Community: an appeal has a filing window.
--
-- `appeal_community_decision` took any decided case, however old. Whether a
-- person could still appeal then depended on whether the retention sweep had
-- yet deleted the case (a decided case goes a year after its decision), which
-- is an accident of scheduling rather than a rule anybody could be told.
--
-- The window is thirty days from the decision. It is measured from the
-- decision, not the report: nobody can appeal what they have not been told,
-- and a report can wait in a queue for longer than the window.
--
-- Two functions change, and nothing else:
--
--   * `public.appeal_community_decision` refuses a decision older than the
--     window, with its own message so a screen can say why, not only that.
--   * `public.my_community_notices` stops saying `appealable` for one, so the
--     author is never offered a button the function would refuse.
--
-- Each is the original of 20260928032000_community.sql with one condition
-- added and nothing else touched. A Postgres function is replaced whole, so
-- both are restated in full; `appealwindow.test.ts` reads the *last*
-- definition of each — the one that runs — and holds the number to
-- `APPEAL_RULES.filingWindowDays` in `app/src/community/moderation.ts`, so a
-- later edit that drops the clause fails there instead of quietly dropping it.
--
-- Not changed here, and said out loud: the deadline for *deciding* an appeal.
-- There is still none. A reviewer's queue has no overdue state for one.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

create or replace function public.appeal_community_decision(want_post uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.community_cases;
  decided timestamptz;
begin
  select c.* into k from public.community_cases c
    join public.community_posts p on p.id = c.post_id
   where c.post_id = want_post and p.author_id = (select auth.uid()) and c.status = 'decided';
  if k.id is null then raise exception 'there is no decision to appeal' using errcode = '22023'; end if;
  -- The window runs from the decision the person was told about.
  select max(d.decided_at) into decided
    from public.community_decisions d
   where d.case_id = k.id and d.stage = 'decision';
  if decided is null or decided < now() - interval '30 days' then
    raise exception 'the appeal window has closed' using errcode = '22023';
  end if;
  update public.community_cases set status = 'appealed', updated_at = now() where id = k.id;
  perform private.community_case_event(k.id, 'student', 'appeal_filed', 'appeal', 'decided', 'appealed');
end $$;
revoke all on function public.appeal_community_decision(uuid) from public, anon, authenticated;
grant execute on function public.appeal_community_decision(uuid) to authenticated;

-- What the author of a post is told: the action and reason, and whether they
-- can appeal. Never a severity, a report count or a reporter.
create or replace function public.my_community_notices()
returns table (post_id uuid, action text, reason_code text, decided_at timestamptz, appealable boolean, appeal_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.post_id, d.action, d.reason_code, d.decided_at,
         (c.status = 'decided' and d.decided_at >= now() - interval '30 days'),
         case when c.status = 'appealed' then 'pending'
              when a.action = 'allow' then 'granted'
              when a.action is not null then 'upheld'
              else 'none' end
    from public.community_cases c
    join public.community_posts p on p.id = c.post_id
    join lateral (select * from public.community_decisions x where x.case_id = c.id and x.stage = 'decision'
                   order by x.decided_at desc limit 1) d on true
    left join lateral (select * from public.community_decisions y where y.case_id = c.id and y.stage = 'appeal'
                   order by y.decided_at desc limit 1) a on true
   where p.author_id = (select auth.uid())
     and d.action not in ('allow', 'close_no_action', 'preserve_evidence');
$$;
revoke all on function public.my_community_notices() from public, anon, authenticated;
grant execute on function public.my_community_notices() to authenticated;
