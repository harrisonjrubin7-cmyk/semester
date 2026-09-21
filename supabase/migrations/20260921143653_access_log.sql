-- Semester — who has read your rows.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- ## The question this answers, which nothing else could
--
-- Row-level security means an account reads its own rows and no others, and
-- `classmates.check.sql` and the rest of this directory exist to keep that
-- true. Two paths go around it, both on purpose, and both hold the service
-- key:
--
--   * `functions/calendar` serves a student's timetable to whoever presents
--     the token, because Apple Calendar and Google Calendar arrive with no
--     credentials and cannot be given any. `CALENDAR-REVIEW.md` is the whole
--     argument for that and it is a good one.
--   * `functions/push` reads every account's queued reminders, because the
--     scheduler calls it rather than a person.
--
-- The calendar one is the reason this table exists. A published feed is a
-- bearer credential living in a URL, in somebody's phone, for months. The app
-- already lets a student replace that link the moment they want to — what it
-- could not do is give them any reason to. A link that leaked last term and a
-- link that never left the device look exactly alike from inside the app, and
-- the only difference visible anywhere is that one of them is being fetched by
-- something that is not the student's calendar.
--
-- So: every read that goes around row-level security is written down here, and
-- **the person whose rows were read is the one who can see it**. That is the
-- difference between an audit log and an operator's private diary, and it is
-- the whole point. The owner of this project can already read anything; the
-- student could read nothing.
--
-- ## What is deliberately not in it
--
-- No IP address, no user-agent string, no token, no URL, no request body.
-- Those would make this table a better forensic record and a worse privacy
-- one: a log of addresses is a log of where a student was, kept by the app
-- that promised on its own privacy page that it holds nothing of the sort.
--
-- What is kept instead is a **family** — which kind of client fetched, out of
-- a fixed list — and the check constraint below is what makes that a property
-- of the database rather than a promise about a function. A future function
-- that tried to write a user-agent string in here would be refused by
-- Postgres.
--
-- And it is bucketed by day rather than kept per request. Per-request rows
-- would be a minute-by-minute record of when a student's devices are awake,
-- which is more than the question needs: "something fetched your calendar from
-- a browser on Tuesday" is the signal, and the time of day is not part of it.
-- Bucketing also bounds the table — a calendar app polling every fifteen
-- minutes writes one row a day, not ninety-six.

create table if not exists public.access_log (
  user_id  uuid        not null references auth.users on delete cascade,
  -- The day, in UTC. See the header: a timestamp per fetch answers a question
  -- nobody asked and records one nobody should.
  day      date        not null default (now() at time zone 'utc')::date,
  -- Which of the two service-key paths did the reading.
  what     text        not null check (what in ('calendar_feed', 'push_send')),
  -- The kind of client, out of a fixed list and never a string from the wire.
  -- 'browser' is the interesting one: a calendar subscription is fetched by a
  -- calendar, and a person opening the link is what a leak looks like.
  client   text        not null default 'unknown'
                       check (client in ('apple', 'google', 'outlook', 'browser',
                                         'other', 'unknown', 'device')),
  hits     integer     not null default 0 check (hits >= 0),
  last_at  timestamptz not null default now(),
  primary key (user_id, day, what, client)
);

-- The one lookup the app makes: this account, most recent first.
create index if not exists access_log_recent_idx
  on public.access_log (user_id, day desc);

alter table public.access_log enable row level security;

-- ── Who may do what ───────────────────────────────────────────────────────
--
-- Reading and deleting, by the account the rows are about, and nothing else.
-- There is deliberately **no insert or update policy at all**: writes come
-- from the service key, which does not consult RLS, so a policy permitting one
-- would only ever be a way in for somebody else. A table with no write policy
-- cannot be written through the API even if a later `grant all on all tables`
-- hands the grant back — which `check.sh` performs on purpose, imitating
-- Supabase's own defaults, precisely so that this kind of mistake shows up
-- here rather than in production.
revoke all on public.access_log from anon, authenticated;
grant select, delete on public.access_log to authenticated;

-- Said here rather than inherited. Supabase's default privileges already hand
-- `service_role` everything on a new table in `public`, so on the live project
-- this line changes nothing — but a grant that exists only as a platform
-- default is a grant no check suite can see, and the write path of an audit
-- log is the last thing that should work by accident. `check.sh` builds a
-- plain Postgres with none of those defaults, which is how the absence showed
-- up: `permission denied for table access_log`, from the role that is supposed
-- to be the only one that can write to it.
grant select, insert, update, delete on public.access_log to service_role;

drop policy if exists "you can read your own access log" on public.access_log;
create policy "you can read your own access log" on public.access_log
  for select
  using ((select auth.uid()) = user_id);

-- Deleting matters for one reason: "Delete my account" in this app deletes
-- rows by user_id from the client, because a browser holding the publishable
-- key cannot delete an auth user and should not be able to. Without this
-- policy a deleted account would leave its access log behind, which is the
-- same shape of bug `calendar_feeds` warned about — a table that outlives the
-- person it is about.
drop policy if exists "you can clear your own access log" on public.access_log;
create policy "you can clear your own access log" on public.access_log
  for delete
  using ((select auth.uid()) = user_id);

comment on table public.access_log is
  'One row per account, day, path and client family: the reads that go around row-level security. Readable by the account they are about.';

-- ── The write path ────────────────────────────────────────────────────────

/*
 * The parameters are `kind` and `family` rather than `what` and `client`,
 * which is not a stylistic preference: plpgsql resolves an unqualified name to
 * the parameter *and* to the column, and `column reference "what" is
 * ambiguous` is what the first version of this raised on its first call.
 * `access.check.sql` found it before anything was deployed, which is the whole
 * reason that file runs against a real Postgres rather than being read.
 */
create or replace function public.note_access(
  who    uuid,
  kind   text,
  family text default 'unknown'
)
returns void
language plpgsql
-- Pinned, for the reason this file argues above `access_log` and then did not
-- apply to its own two functions: a body that resolves `access_log` against
-- whatever the caller had set is a body the caller chooses the meaning of.
-- Everything below is schema-qualified already, so an empty path costs
-- nothing; `pg_catalog` stays implicitly searched, which is what `now()`,
-- `coalesce()` and the type names rely on.
set search_path = ''
as $$
begin
  insert into public.access_log as a (user_id, day, what, client, hits, last_at)
  values (who, (now() at time zone 'utc')::date, kind, coalesce(family, 'unknown'), 1, now())
  on conflict (user_id, day, what, client) do update
    set hits = a.hits + 1, last_at = now();

  /*
   * Pruning here rather than in a scheduled job, and ninety days rather than
   * forever.
   *
   * A record of who read your work is not your work, and the privacy page's
   * "there is no retention schedule" is a promise about the second thing. A
   * log kept indefinitely is a second copy of your habits accumulating for no
   * one's benefit, so it ages out — and the page says ninety days in those
   * words rather than leaving somebody to find it here.
   *
   * On write, because a `pg_cron` entry is a third thing to deploy and a
   * fourth thing to notice has stopped. This runs on the account being
   * written to and touches nothing else; the index above is what makes it a
   * lookup rather than a scan.
   */
  delete from public.access_log
   where user_id = who
     and day < ((now() at time zone 'utc')::date - 90);
end $$;

/*
 * From PUBLIC, and this is the line `invites.sql` learned the hard way.
 *
 * Postgres grants EXECUTE on a new function to PUBLIC by default, and `anon`
 * and `authenticated` are both members of PUBLIC — so revoking from those two
 * by name leaves the grant they actually inherit completely intact. A caller
 * who reached this could forge entries in somebody else's access log, which
 * would make the one table in this schema whose job is to be trustworthy the
 * one that could be lied to.
 *
 * Note that this function is deliberately **not** `security definer`. It does
 * not need to be — the only caller is the service key, which is not stopped by
 * row-level security anyway — and a definer function is a hole that has to be
 * argued for every time somebody reads it.
 */
revoke all on function public.note_access(uuid, text, text) from public;
grant execute on function public.note_access(uuid, text, text) to service_role;

comment on function public.note_access(uuid, text, text) is
  'Record one service-key read against an account. Service role only.';

-- ── Serving a feed and noting it, in one statement ────────────────────────
--
-- This exists because of a sentence in `functions/calendar/index.ts` that was
-- right when it was written and is the reason this was hard:
--
--   > It will not write. Not a read receipt, not a hit counter — a feed polled
--   > by four devices every four hours is a write every twenty minutes for the
--   > life of the account, and it would buy nothing.
--
-- **That decision is reversed here, and only half of it was wrong.** A hit
-- counter does buy nothing; nobody needs to know their calendar was fetched
-- four hundred times. What the same review argues two paragraphs earlier is
-- that a leaked link is readable "indefinitely, until it is replaced", and
-- that replacing it is one button the student already has. The missing piece
-- was never a count — it was the one observable difference between a link
-- that leaked and a link that did not, which is *what kind of thing is asking
-- for it*. A calendar subscription is fetched by a calendar. A person is a
-- browser.
--
-- The cost stands as stated: this is a write on a read, about one upsert per
-- fetch per account. It is bounded — a row per day per client family, not per
-- request — and for a pilot it is nothing. At a scale where it is not, the
-- honest fix is to widen the bucket here rather than to pretend the write is
-- free.
--
-- ## Why it is one function rather than a select and a call
--
-- The function's other stated property is one worth keeping exactly as it is:
--
--   > Only these three columns, ever. Not `user_id`: nothing downstream needs
--   > to know whose calendar this is, and a select that does not fetch it
--   > cannot leak it through a mistake later.
--
-- Writing an access log needs a `user_id`, and the obvious implementation —
-- select it alongside the body — would undo that. So the lookup and the note
-- happen here, where the account is already known and never leaves. The Edge
-- Function gets back the same three columns it got before and still has no
-- idea whose calendar it just served.

create or replace function public.read_feed(feed_token text, family text default 'unknown')
returns table (body text, name text, updated_at timestamptz)
language plpgsql
-- As above. Supabase's own linter flags both of these as
-- `function_search_path_mutable`, and it was right.
set search_path = ''
as $$
declare owner uuid;
begin
  select f.user_id, f.body, f.name, f.updated_at
    into owner, body, name, updated_at
    from public.calendar_feeds f
   where f.token = feed_token;

  -- No row is not an error and must not look like one: the function above
  -- answers a bad token and an unknown token identically, and a raise here
  -- would make the difference visible in the timing.
  if owner is null then
    return;
  end if;

  perform public.note_access(owner, 'calendar_feed', family);
  return next;
end $$;

-- `read_feed` is `security invoker` like `note_access`, so its select runs as
-- the service key rather than as the function's owner — no definer hole to
-- argue about. That needs the grant to be real rather than inherited, for the
-- reason given above `access_log`'s own: Supabase's default privileges already
-- provide it on the live project, and a plain Postgres has never heard of
-- them, so the harness is where an unstated grant turns into `permission
-- denied for table calendar_feeds`. Select only — the function reads.
grant select on public.calendar_feeds to service_role;

revoke all on function public.read_feed(text, text) from public;
grant execute on function public.read_feed(text, text) to service_role;

comment on function public.read_feed(text, text) is
  'Serve one calendar feed by token and record the fetch. Returns no user_id. Service role only.';
