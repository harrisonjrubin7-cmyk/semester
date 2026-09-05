-- Semester — the published calendar feed.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded. Read
-- `supabase/CALENDAR-REVIEW.md` before you do — this table is different from
-- every other one in the schema and it is worth knowing why.
--
-- ## What is different about it
--
-- Everything else here is private to its owner and reachable only with that
-- owner's token. This row is deliberately readable by a stranger: Apple
-- Calendar and Google Calendar fetch a subscription URL with no credentials
-- and no way to supply any, so the random token in the URL is the whole of the
-- authentication. Anyone holding the link reads the deadlines.
--
-- That is the deal every calendar feed makes. What follows from it:
--
--   * The token is 24 random bytes. Guessing is not a strategy against 192
--     bits, and there is no rate limit that would help if it were 6.
--   * Nothing else is in the row. `body` is a rendered `.ics` — deadline
--     titles, dates and course codes — and nothing about the account, the
--     email address, the notes, the grades or the API key. A leaked link
--     leaks a timetable, not an identity.
--   * Replacing the token is one update and kills the old link immediately.
--   * The app renders `body`; the function only serves it. See
--     `app/src/lib/subscribe.ts` for why there is no deadline logic on the server.
--
-- The anon role is granted nothing here. The Edge Function reads this table
-- with the service key, which is the one place in this project that key is
-- used for a read on behalf of somebody who is not signed in — and it can only
-- ever return the single row whose token was presented.

create table if not exists public.calendar_feeds (
  user_id     uuid        primary key references auth.users on delete cascade,
  -- 48 hex characters. Generated on the device, not here, so it never has to
  -- travel back down to the app to be shown.
  token       text        not null unique,
  -- The rendered calendar, exactly as the app would have downloaded it.
  body        text        not null default '',
  -- What the subscription is called in the calendar app's sidebar.
  name        text        not null default 'Semester',
  -- How many entries went up, so the app can say what is in it without
  -- parsing the body back.
  events      int         not null default 0,
  updated_at  timestamptz not null default now()
);

-- Lookup is by token, and it is the only lookup the function makes.
create unique index if not exists calendar_feeds_token_idx on public.calendar_feeds (token);

alter table public.calendar_feeds enable row level security;

-- The owner may read, publish and replace their own row, exactly like every
-- other table. The unauthenticated read path does not go through RLS at all —
-- it goes through the Edge Function, which holds the service key.
drop policy if exists "feeds are managed by their owner" on public.calendar_feeds;
create policy "feeds are managed by their owner" on public.calendar_feeds
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Same trigger as the rest of the schema: the timestamp comes from the
-- database, because the app shows "published 3 hours ago" off it and a device
-- with a wrong clock should not be able to lie about that.
drop trigger if exists calendar_feeds_touch on public.calendar_feeds;
create trigger calendar_feeds_touch
  before update on public.calendar_feeds
  for each row execute function public.touch_updated_at();

-- ── Deleting an account ───────────────────────────────────────────────────
-- `on delete cascade` above covers the account being deleted in Supabase. The
-- app's own "delete everything" deletes by user_id like the other tables; add
-- 'calendar_feeds' to OWNED_TABLES in `app/src/lib/cloud.ts` when the client
-- half ships, or a deleted account leaves a live feed behind. That would be
-- the worst bug this feature could have.
