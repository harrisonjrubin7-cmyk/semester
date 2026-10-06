-- What to look at when you want to know whether anything is wrong.
--
-- Paste a block at a time into the dashboard's SQL Editor. `MONITORING.md` is
-- what each number means, what it should be, and what to do when it is not.
--
-- These are the questions that can be answered *in the database*. Three of the
-- four things worth watching cannot be: Edge Function errors and auth failures
-- are in the platform's logs, and the AI provider's own spend is on their
-- dashboard. `MONITORING.md` says where each of those lives. Nothing here
-- should be read as a complete picture of the system.
--
-- Everything is UTC, and nothing reads a student's work: the AI figures are
-- counts and token totals, never prompts.

-- ── 1 · The AI budget, which is the one with a bill attached ──────────────
--
-- The shared key is metered per account per month in `public.usage`, counted
-- in one atomic statement by `count_call` — `20260921142822_usage_atomic.sql`
-- is why that matters. The cap is `MONTHLY_CALL_LIMIT` on the Edge Function
-- and defaults to 60 calls per account per month.
--
-- This is the app's own count. It is not the provider's, and the two will not
-- agree exactly: a call that fails after being charged is counted by one and
-- not the other. Treat this as the early-warning number and the provider's
-- dashboard as the bill.

select
  month,
  count(*)                                        as accounts,
  sum(calls)                                      as calls,
  sum(input_tokens)                               as input_tokens,
  sum(output_tokens)                              as output_tokens,
  max(calls)                                      as most_by_one_account,
  count(*) filter (where calls >= 60)             as at_the_cap,
  max(updated_at)                                 as last_call
from public.usage
group by month
order by month desc
limit 6;

-- `at_the_cap` is the product signal in here rather than the operational one.
-- An account that hits 60 generations in a month is someone using this app
-- properly and being stopped; that is a pricing conversation, not an incident.

-- ── 2 · Is anything being written at all ──────────────────────────────────
--
-- The failure this catches is the one this project has already had twice: a
-- thing that stopped working and said nothing. Seven migrations sat unapplied
-- for three days with no failure and no notice; two check suites failed on
-- their first block for weeks while everything downstream was skipped.
--
-- A table whose newest row is older than you expect is that failure. Read
-- this against what you know about the pilot: with five people in it, a
-- `state` row from four days ago is a quiet week, and one from three weeks
-- ago is a broken sync.

select 'state'       as what, count(*) as rows, max(updated_at) as newest from public.state
union all
select 'courses',    count(*), max(updated_at) from public.courses
union all
select 'usage',      count(*), max(updated_at) from public.usage
union all
select 'activity',   count(*), max(day)::timestamptz from public.activity
union all
select 'push_queue', count(*), max(send_at)   from public.push_queue
union all
select 'access_log', count(*), max(last_at)   from public.access_log
order by what;

-- ── 3 · Accounts, and how many got anywhere ───────────────────────────────
--
-- The one-line funnel. `ANALYTICS.md` is the real version with cohorts and
-- windows; this is the sanity check that the pilot has the number of people
-- in it you think it has.

select
  (select count(*) from auth.users)                                   as accounts,
  (select count(*) from auth.users where created_at > now() - interval '7 days')
                                                                      as new_this_week,
  (select count(distinct user_id) from public.activity
    where mark = 'opened' and day >= (now() at time zone 'utc')::date - 7)
                                                                      as active_this_week,
  (select count(distinct user_id) from public.activity where mark = 'studied')
                                                                      as ever_studied,
  (select count(*) from public.invites)                               as invited,
  (select invite_only from public.access_gate limit 1)                as invite_only;

-- `invite_only` false during the pilot means the front door is open to the
-- internet. That is a one-line answer to the question nobody remembers to
-- ask, which is why it is on this page and not only in `invites.sql`.

-- ── 4 · Row-level security, asserted rather than assumed ──────────────────
--
-- Not a monitor so much as a tripwire. `check.sh` proves the policies against
-- a throwaway Postgres on every run; nothing checks the live project, and the
-- live project is the one where somebody applies SQL from a dashboard at one
-- in the morning.
--
-- Both queries should return no rows. A table in the first is open to anybody
-- holding the publishable key. A table in the second has policies that are
-- not being enforced, which looks identical to safety from every angle except
-- this one.

select relname as table_without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
 order by 1;

select c.relname as table_with_rls_but_no_policy
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
   and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
 order by 1;

-- The second is not always a fault, and the known answers were measured
-- rather than guessed — the first draft of this comment named the wrong two.
-- Run against a database built from `migrations/`, it returns exactly
-- `access_gate` and `invites`: both deliberately have no policy at all, so
-- `anon` and `authenticated` match no row in either, and both are read by
-- `security definer` functions that row-level security does not consult.
-- `access_log` and `activity` are *not* in this list — they have read and
-- delete policies and only their write path is absent. A third name here is a
-- question.

-- ── 5 · The event trigger that makes the default true ─────────────────────
--
-- One row, and it is the reason a new table is safe before anybody remembers
-- to write `enable row level security`. It has been lost once already, in a
-- schema rebuilt from a snapshot that did not know about it.

select count(*) as ensure_rls_present from pg_event_trigger where evtname = 'ensure_rls';

-- ── 6 · Is every scheduled job actually scheduled ─────────────────────────
--
-- `scheduler.sql` is the record of what should run, and it is only a record:
-- a job exists once somebody has applied the statement, and on 28 September
-- three jobs in that file (`community-retention`, `escalation-delivery`,
-- `media-scan`) had never reached `cron.job`, and three sweeps the migrations
-- expect had no job at all. Nothing said so.
--
-- `expected` is every job `scheduler.sql` creates, and whether that file
-- leaves it parked. `app/src/lib/scheduler.test.ts` fails if this list and
-- that file ever disagree, so the list here cannot drift from the file.
--
-- Every row should read `ok`. `MISSING` is a job the code expects that the
-- database does not have — re-run the one `cron.schedule` from scheduler.sql.
-- `NOT IN scheduler.sql` is a job somebody made by hand; put it in the file or
-- remove it. `parked` is expected for a parked job until its runbook says to
-- unpark it; `inactive` on a job the file leaves active is a job that has been
-- switched off and should not have been.

with expected(jobname, parked) as (values
  ('abandoned-signups',             false),
  ('account-health',                false),
  ('ai-runtime-metadata',           false),
  ('audit-retention',               false),
  ('capture-expiry',                false),
  ('commercial-dunning',            false),
  ('commercial-financial-retention', false),
  ('community-retention',           false),
  ('console-audit-integrity',       false),
  ('escalation-delivery',           true),
  ('handoffs',                      false),
  ('institution-gateway-retention', false),
  ('integration-retention',         false),
  ('integration-sync',              false),
  ('invite-retention',              false),
  ('ledger-chain-integrity',        false),
  ('lti-link-ticket',               false),
  ('lti-nonce',                     false),
  ('media-scan',                    true),
  ('push',                          true),
  ('support-reply-notify',          true),
  ('tombstones',                    false)
)
select coalesce(e.jobname, j.jobname) as jobname,
       j.schedule,
       j.active,
       case
         when j.jobid is null            then 'MISSING'
         when e.jobname is null          then 'NOT IN scheduler.sql'
         when e.parked and not j.active  then 'parked'
         when not e.parked and not j.active then 'inactive'
         else 'ok'
       end as verdict
  from expected e
  full join cron.job j on j.jobname = e.jobname
 order by (case when j.jobid is null or e.jobname is null then 0 else 1 end), 1;

-- And whether the active ones are succeeding. A job that is there and fails
-- every run is the same outage as a job that is missing, with more rows.

select j.jobname,
       count(*) filter (where d.status = 'succeeded') as succeeded,
       count(*) filter (where d.status = 'failed')    as failed,
       max(d.start_time)                              as last_run,
       (array_agg(d.return_message order by d.start_time desc)
          filter (where d.status = 'failed'))[1]      as last_failure
  from cron.job j
  left join cron.job_run_details d
    on d.jobid = j.jobid and d.start_time > now() - interval '7 days'
 where j.active
 group by j.jobname
 order by failed desc, j.jobname;

-- Support email can fail even while pg_cron itself succeeds: pg_net accepts
-- the HTTP request before the Edge Function knows whether Resend accepted the
-- message. Any dead letter is an incident; pending rows are the retry backlog.
select
  count(*) filter (where accepted_at is null and dead_lettered_at is null) as pending,
  count(*) filter (where dead_lettered_at is not null)                     as dead_lettered,
  min(queued_at) filter (where accepted_at is null and dead_lettered_at is null) as oldest_pending,
  max(dead_lettered_at)                                                   as latest_dead_letter,
  (array_agg(last_error order by dead_lettered_at desc)
    filter (where dead_lettered_at is not null))[1]                       as latest_error
from public.support_notification_outbox;

-- ── 7 · Accounts nobody has used in a long time ───────────────────────────
--
-- Counted, not acted on. RETENTION.md decides that an account which was ever
-- used is kept until its owner deletes it — the privacy screen promises that —
-- and that only a sign-up never confirmed and never signed in is removed
-- (`abandoned-signups`). This is the number a data-protection reviewer will ask
-- for, so it is here rather than worked out on the day.

select
  count(*) filter (where last_sign_in_at < now() - interval '1 year')  as idle_over_a_year,
  count(*) filter (where last_sign_in_at < now() - interval '2 years') as idle_over_two_years,
  count(*) filter (where email_confirmed_at is null and last_sign_in_at is null
                     and created_at < now() - interval '30 days')      as abandoned_signups_awaiting_sweep
from auth.users;
