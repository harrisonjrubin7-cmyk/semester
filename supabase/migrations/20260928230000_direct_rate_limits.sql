-- Rate limits on the paths the browser writes to directly.
--
-- `GO_LIVE_CHECKLIST.md` has carried "Rate limiting on the Supabase-direct
-- paths, not just the gateway" as a blocking line. The institutional gateway
-- (`app/server/institution/`) limits every call through
-- `private.gateway_take_rate_limit`. Everything else the app does goes
-- straight to PostgREST with the publishable key and a user's JWT, and until
-- now nothing counted it: a signed-in script could put ten thousand messages in
-- a class room, ten thousand reports in the moderation queue or ten thousand
-- help requests in an office's inbox, at the speed of the network.
--
-- A few RPCs already had their own counts — `create_community_post` allows 2
-- to 10 posts an hour *per community*, `begin_community_image` 10 images an
-- hour — and they stay. What was missing is a limit on the tables themselves,
-- whichever route reaches them, and a total across communities.
--
-- ## The shape
--
-- One private table of hits and one function that checks and records a hit
-- for (who, bucket), attached as a BEFORE INSERT trigger to each table below.
-- A trigger rather than a check in each client call because the tables are
-- what the publishable key can reach, and a trigger fires for a direct
-- `insert`, an `upsert`, and an insert made inside a `security definer` RPC
-- alike — `auth.uid()` there is still the caller.
--
-- **Sliding window, counted from the log.** Each hit is a row; an insert is
-- refused when the subject already has `max` hits in the bucket within the
-- window. That is exact where a fixed window lets twice the limit through
-- across a boundary, and at these sizes (at most a few hundred rows per
-- person per bucket) the count is an index range scan.
--
-- **Only writes that land are counted.** The hit is recorded in the same
-- transaction as the insert it guards, so an insert refused by a policy, a
-- check constraint or this limit rolls its hit back with it. A script that
-- keeps hammering after the refusal does not push its own window further out,
-- and a student whose form failed validation has not spent anything.
--
-- **Serialised per (subject, bucket)** with a transaction-scoped advisory
-- lock, so fifty parallel requests cannot all read "49" and all pass.
--
-- **Who is limited.** Only requests running as `anon` or `authenticated` —
-- read from the `role` setting, which PostgREST sets per request and which a
-- `security definer` function does not change. `service_role`, `postgres`, the
-- cron jobs and every migration are not, because none of them is a browser.
-- A signed-in request is limited per account (`auth.uid()`). A signed-out one
-- can only insert into `form_responses` (the one anonymous write in the
-- schema), and is limited per form, since there is no account to count
-- against.
--
-- **The refusal** is SQLSTATE 54000 (`program_limit_exceeded`) — the code
-- `create_community_post` and `begin_community_image` already use for their
-- own limits — with a message written to be shown as it stands. Most of the
-- app's write paths show `error.message` verbatim (`lib/feedback.ts`,
-- `lib/mentors.ts`, `lib/help-routes.ts`, `community/client.ts`) or pass an
-- unrecognised one through (`explain` in `lib/classmates.ts`, `formshare.ts`),
-- so the sentence the database says is the sentence the student reads. It must
-- not contain "policy" or "row-level security": `formshare.ts` and
-- `classmates.ts` rewrite those into different advice.
-- `app/src/lib/ratelimit.test.ts` holds this file to that.
--
-- **Retention.** A hit is only ever read inside its window, and the longest
-- window here is a day. Each call deletes the subject's own expired hits for
-- that bucket, and up to 200 hits older than a day from anybody — bounded, so
-- no request pays for a backlog, and enough that the table drains faster than
-- it can fill. A hit belongs to an account by foreign key and goes when the
-- account does.
--
-- ## The limits, and why each is where it is
--
-- The test for every number: a real student, on their busiest day, never
-- sees it; a script is stopped within minutes rather than within a quota
-- nobody set. Where a number is a guess it is a generous one — raising a
-- limit is a one-line migration, and a limit that fires on a real person is a
-- support ticket.
--
--   table                      max  per       reasoning
--   messages                    60  5 min     class chat; one every five seconds
--                                             for five minutes straight is past
--                                             the liveliest room, and a script
--                                             gets 720 an hour, not 50,000
--   message_reactions          120  5 min     taps, so twice the messages;
--                                             an upsert counts as an insert
--   reports                     20  1 hour    a staff queue; twenty reports in an
--                                             hour is a raid, and the one after
--                                             it is not more information
--   community_reports           20  1 hour    the same queue, for communities
--   feedback                    20  1 hour    read by a person; a student with a
--                                             lot to say sends five
--   help_requests               10  1 hour    lands in an office's inbox; a
--                                             student writes to one or two offices
--   mentor_requests             20  1 day     each one asks a named person for
--                                             something; twenty a day is a lot of
--                                             asking already
--   community_posts             30  1 hour    across every community; the per-
--                                             community limits (2–10 an hour)
--                                             stay, this stops one account
--                                             working through forty communities
--   communities                 10  1 day     a new community is a moderation
--                                             surface for somebody
--   community_sessions          30  1 day     study sessions others can join
--   groups                      20  1 hour    visible to the whole class
--   group_tasks                100  1 hour    a planning session adds twenty or
--                                             thirty parts; a hundred is headroom
--   opportunities               30  1 hour    listings go to a review queue
--   form_responses (signed in)  60  1 hour    across every form
--   form_responses (signed out) 1000 1 hour   per form, since there is no account:
--                                             a lecture hall of several hundred
--                                             answering one poll fits; a form's
--                                             own `response_limit` is the finer
--                                             control and its owner sets it
--
-- `supabase/rate-limits.check.sql` walks the machinery: the limit, the next
-- insert refused, a second account unaffected, the window expiring, the table
-- closed to clients, the service role and a definer RPC. The existing suites
-- for each table above still pass with these limits in place.
--
-- ## Not covered here
--
-- The auth endpoints (sign-in, sign-up, OTP, password reset, token refresh)
-- are limited by Supabase Auth, not by the database, and `config.toml`
-- deliberately does not write an `[auth.rate_limit]` block (its header says
-- why: a setting there silently overrides the dashboard). Those limits are
-- confirmed in the dashboard — see `supabase/DEPLOY.md`.

create table if not exists private.direct_rate_limit (
  id       bigint generated always as identity primary key,
  -- Exactly one of these: the account a signed-in hit belongs to, or the form
  -- a signed-out answer was for.
  user_id  uuid references auth.users on delete cascade,
  form_id  uuid references public.forms on delete cascade,
  bucket   text not null check (bucket ~ '^[a-z_:]{1,64}$'),
  at       timestamptz not null default now(),
  constraint direct_rate_limit_one_subject check (num_nonnulls(user_id, form_id) = 1)
);

create index if not exists direct_rate_limit_by_user
  on private.direct_rate_limit (user_id, bucket, at) where user_id is not null;
create index if not exists direct_rate_limit_by_form
  on private.direct_rate_limit (form_id, bucket, at) where form_id is not null;
create index if not exists direct_rate_limit_by_age
  on private.direct_rate_limit (at);

alter table private.direct_rate_limit enable row level security;
-- No policies: nobody reads or writes this through the API. The definer
-- function below is the only writer; an operator clearing a mistaken lock-out
-- does it with the service role.
revoke all on table private.direct_rate_limit from public, anon, authenticated;
grant select, delete on table private.direct_rate_limit to service_role;

/**
 * Check and record one hit for (subject, bucket), or refuse.
 *
 * Exactly one of `want_user` / `want_form` is given. Raises 54000 when the
 * subject already has `want_max` hits in the bucket inside the window.
 */
create or replace function private.take_direct_rate_limit(
  want_user uuid,
  want_form uuid,
  want_bucket text,
  want_max integer,
  want_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  since timestamptz;
  recent integer;
begin
  if num_nonnulls(want_user, want_form) <> 1
     or want_max not between 1 and 100000
     or want_window_seconds not between 1 and 86400 then
    raise exception 'take_direct_rate_limit: bad arguments' using errcode = '22023';
  end if;
  since := now() - pg_catalog.make_interval(secs => want_window_seconds);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(coalesce(want_user, want_form)::text || '/' || want_bucket, 0));

  if want_user is not null then
    delete from private.direct_rate_limit
     where user_id = want_user and bucket = want_bucket and at <= since;
    select count(*) into recent from private.direct_rate_limit
     where user_id = want_user and bucket = want_bucket and at > since;
  else
    delete from private.direct_rate_limit
     where form_id = want_form and bucket = want_bucket and at <= since;
    select count(*) into recent from private.direct_rate_limit
     where form_id = want_form and bucket = want_bucket and at > since;
  end if;

  if recent >= want_max then
    raise exception 'You''ve sent a lot in a short time — try again in a few minutes.'
      using errcode = '54000',
            detail = pg_catalog.format('rate limit: %s, %s per %s seconds', want_bucket, want_max, want_window_seconds);
  end if;

  insert into private.direct_rate_limit (user_id, form_id, bucket)
  values (want_user, want_form, want_bucket);

  -- Everybody else's leftovers, a bounded handful at a time.
  delete from private.direct_rate_limit
   where id in (select id from private.direct_rate_limit
                 where at < now() - interval '1 day'
                 order by at limit 200);
end $$;

/**
 * The trigger. Arguments: bucket, max, window seconds, and — only on
 * `form_responses` — the max per form per window for signed-out answers.
 */
create or replace function private.direct_rate_limit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text := coalesce(nullif(pg_catalog.current_setting('role', true), ''), 'none');
  me uuid := auth.uid();
begin
  -- Not a browser: the service role, postgres, cron, a migration.
  if who not in ('anon', 'authenticated') then
    return new;
  end if;
  if me is not null then
    perform private.take_direct_rate_limit(
      me, null, tg_argv[0], tg_argv[1]::integer, tg_argv[2]::integer);
  elsif tg_nargs >= 4 and tg_table_name = 'form_responses' then
    perform private.take_direct_rate_limit(
      null, new.form_id, tg_argv[0] || ':anon', tg_argv[3]::integer, tg_argv[2]::integer);
  end if;
  -- Any other signed-out insert is the table's own policy's to refuse.
  return new;
end $$;

revoke all on function private.take_direct_rate_limit(uuid, uuid, text, integer, integer)
  from public, anon, authenticated;
revoke all on function private.direct_rate_limit_insert() from public, anon, authenticated;

-- ── The triggers ──────────────────────────────────────────────────────────
-- Named `zz_…` so they run after any other BEFORE INSERT trigger on the same
-- table (triggers fire in name order): a row another trigger rejects never
-- reaches the count, and one it would rewrite is counted once.

drop trigger if exists zz_rate_limit on public.messages;
create trigger zz_rate_limit before insert on public.messages
  for each row execute function private.direct_rate_limit_insert('messages', '60', '300');

drop trigger if exists zz_rate_limit on public.message_reactions;
create trigger zz_rate_limit before insert on public.message_reactions
  for each row execute function private.direct_rate_limit_insert('message_reactions', '120', '300');

drop trigger if exists zz_rate_limit on public.reports;
create trigger zz_rate_limit before insert on public.reports
  for each row execute function private.direct_rate_limit_insert('reports', '20', '3600');

drop trigger if exists zz_rate_limit on public.community_reports;
create trigger zz_rate_limit before insert on public.community_reports
  for each row execute function private.direct_rate_limit_insert('community_reports', '20', '3600');

drop trigger if exists zz_rate_limit on public.feedback;
create trigger zz_rate_limit before insert on public.feedback
  for each row execute function private.direct_rate_limit_insert('feedback', '20', '3600');

drop trigger if exists zz_rate_limit on public.help_requests;
create trigger zz_rate_limit before insert on public.help_requests
  for each row execute function private.direct_rate_limit_insert('help_requests', '10', '3600');

drop trigger if exists zz_rate_limit on public.mentor_requests;
create trigger zz_rate_limit before insert on public.mentor_requests
  for each row execute function private.direct_rate_limit_insert('mentor_requests', '20', '86400');

drop trigger if exists zz_rate_limit on public.community_posts;
create trigger zz_rate_limit before insert on public.community_posts
  for each row execute function private.direct_rate_limit_insert('community_posts', '30', '3600');

drop trigger if exists zz_rate_limit on public.communities;
create trigger zz_rate_limit before insert on public.communities
  for each row execute function private.direct_rate_limit_insert('communities', '10', '86400');

drop trigger if exists zz_rate_limit on public.community_sessions;
create trigger zz_rate_limit before insert on public.community_sessions
  for each row execute function private.direct_rate_limit_insert('community_sessions', '30', '86400');

drop trigger if exists zz_rate_limit on public.groups;
create trigger zz_rate_limit before insert on public.groups
  for each row execute function private.direct_rate_limit_insert('groups', '20', '3600');

drop trigger if exists zz_rate_limit on public.group_tasks;
create trigger zz_rate_limit before insert on public.group_tasks
  for each row execute function private.direct_rate_limit_insert('group_tasks', '100', '3600');

drop trigger if exists zz_rate_limit on public.opportunities;
create trigger zz_rate_limit before insert on public.opportunities
  for each row execute function private.direct_rate_limit_insert('opportunities', '30', '3600');

drop trigger if exists zz_rate_limit on public.form_responses;
create trigger zz_rate_limit before insert on public.form_responses
  for each row execute function private.direct_rate_limit_insert('form_responses', '60', '3600', '1000');

comment on table private.direct_rate_limit is
  'One row per counted insert from a browser (anon/authenticated) into a rate-limited table. '
  'Written only by private.take_direct_rate_limit; see 20260928230000_direct_rate_limits.sql.';
