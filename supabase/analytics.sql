-- The pilot's three figures, read out of `public.activity`.
--
-- Paste one block at a time into the dashboard's SQL Editor. Every query here
-- reads that one table and nothing else: no `auth.users`, no `courses`, no
-- `state`. That is deliberate and it is the property worth keeping — a report
-- that needs to read a student's work to count how many students there are is
-- a report that gets run less carefully each month, by more people, until one
-- day it is a spreadsheet of somebody's syllabus in an email.
--
-- `ANALYTICS.md` is what the numbers mean and what each of them is worth.
-- `20260921151000_activity.sql` is where the rows come from.
--
-- Dates are UTC throughout, because `activity.day` is, and mixing the two
-- would move every cohort boundary by five hours in the direction nobody
-- notices.

-- ── 0 · The control, which is run first and every time ────────────────────
--
-- Not optional and not a formality. Every query below returns zero rows in
-- two completely different situations: nobody used the app, and nothing is
-- writing to this table — a deploy that did not go out, a client version that
-- lost the call site, a migration that was never applied. Those look
-- identical in the answer and are opposite in what they mean.
--
-- So before reading any figure: how much is here, since when, and was
-- anything written today.

select
  count(*)                                       as rows,
  count(distinct user_id)                        as accounts,
  min(day)                                       as first_day,
  max(day)                                       as last_day,
  count(*) filter (where day = (now() at time zone 'utc')::date)
                                                 as written_today,
  count(distinct mark)                           as distinct_marks
from public.activity;

-- Expect `distinct_marks` to be 3 once the pilot has anybody who has studied.
-- 1 means every account is stalled at 'opened', which is a product finding.
-- 0 rows at all, on a day the app was definitely used, is an outage in the
-- instrument rather than a number about students.

-- ── 1 · Weekly active use ─────────────────────────────────────────────────
--
-- Distinct accounts that had the app open, by the week their days fall in.
-- Weeks start Monday, which is what `date_trunc` does and what a term does.
--
-- The current week is always low, because it is not over. It is left in
-- rather than filtered out — hiding it would mean the most recent row of a
-- report is always a week stale — and `is_partial` is what stops somebody
-- reading it as a fall.

select
  date_trunc('week', day)::date                       as week,
  count(distinct user_id)                             as accounts,
  date_trunc('week', day)::date
    = date_trunc('week', (now() at time zone 'utc')::date)::date
                                                      as is_partial
from public.activity
where mark = 'opened'
group by 1
order by 1;

-- ── 2 · Activation ────────────────────────────────────────────────────────
--
-- Of the accounts first seen in a week, how many got a course of their own in
-- and answered a card — **within seven days of arriving**. The window is the
-- whole of the measurement and it is what makes cohorts comparable: without
-- it, an account from August has had six weeks to activate and one from last
-- Tuesday has had three days, and a rising number would mean nothing but the
-- passage of time.
--
-- Cohorts younger than the window are excluded for the same reason. A week
-- that is still inside its own seven days would report an activation rate
-- that is guaranteed to rise, and somebody would screenshot it.

with first_seen as (
  select user_id, min(day) as day0
    from public.activity
   where mark = 'opened'
   group by user_id
),
reached as (
  select user_id, mark, min(day) as at
    from public.activity
   group by user_id, mark
)
select
  date_trunc('week', f.day0)::date                            as cohort,
  count(*)                                                    as arrived,
  count(*) filter (where c.at <= f.day0 + 7)                  as added_a_course,
  count(*) filter (where s.at <= f.day0 + 7)                  as studied,
  count(*) filter (where c.at <= f.day0 + 7 and s.at <= f.day0 + 7)
                                                              as activated,
  round(100.0 * count(*) filter (where c.at <= f.day0 + 7 and s.at <= f.day0 + 7)
        / nullif(count(*), 0), 1)                             as pct
from first_seen f
left join reached c on c.user_id = f.user_id and c.mark = 'course'
left join reached s on s.user_id = f.user_id and s.mark = 'studied'
where f.day0 <= (now() at time zone 'utc')::date - 7
group by 1
order by 1;

-- The two middle columns are the ones to read when `pct` disappoints. A
-- cohort that adds courses and does not study is a different product problem
-- from one that never gets a course in, and the single activation figure
-- cannot tell them apart. This is the whole reason the funnel is three marks
-- and not one.

-- ── 3 · 30-day retention ──────────────────────────────────────────────────
--
-- Of the accounts first seen in a week, how many opened the app again around
-- a month later — days 28 to 34 after their first, which is one whole week of
-- chances rather than one day.
--
-- The band matters. "Opened it on day 30 exactly" is a question about a
-- Tuesday, not about a student, and with a pilot of ten people it would
-- produce zeroes that mean nothing. A week-wide band asks what is actually
-- being asked: a month in, are they still here.
--
-- Cohorts less than 34 days old are excluded, because their band has not
-- finished. Including them would report 0% for the newest weeks for ever,
-- which is the shape of mistake that gets a product killed on a slide.

with first_seen as (
  select user_id, min(day) as day0
    from public.activity
   where mark = 'opened'
   group by user_id
)
select
  date_trunc('week', f.day0)::date                            as cohort,
  count(*)                                                    as arrived,
  count(*) filter (where back.user_id is not null)            as still_here,
  round(100.0 * count(*) filter (where back.user_id is not null)
        / nullif(count(*), 0), 1)                             as pct
from first_seen f
left join lateral (
  select 1 as user_id
   where exists (
     select 1 from public.activity a
      where a.user_id = f.user_id
        and a.mark = 'opened'
        and a.day between f.day0 + 28 and f.day0 + 34
   )
) back on true
where f.day0 <= (now() at time zone 'utc')::date - 34
group by 1
order by 1;

-- ── 4 · The funnel as one line, for a week ────────────────────────────────
--
-- The three figures above are the ones that belong in a decision. This is the
-- one that belongs in a sentence, when somebody asks how the pilot is going
-- and the honest answer is four numbers rather than a chart.

with first_seen as (
  select user_id, min(day) as day0
    from public.activity
   where mark = 'opened'
   group by user_id
)
select
  count(*)                                                     as accounts_ever,
  count(*) filter (where f.day0 >= (now() at time zone 'utc')::date - 7)
                                                               as new_this_week,
  (select count(distinct user_id) from public.activity
    where mark = 'opened' and day >= (now() at time zone 'utc')::date - 7)
                                                               as active_this_week,
  (select count(distinct user_id) from public.activity where mark = 'course')
                                                               as ever_added_a_course,
  (select count(distinct user_id) from public.activity where mark = 'studied')
                                                               as ever_studied
from first_seen f;
