-- A published calendar feed. See supabase/calendar.sql and
-- supabase/CALENDAR-REVIEW.md. Additive: nothing is wired into a screen, and
-- the Edge Function that serves the feed is not deployed.

create table if not exists public.calendar_feeds (
  user_id     uuid        primary key references auth.users on delete cascade,
  -- 48 hex characters, generated on the device so it never travels back down.
  token       text        not null unique,
  body        text        not null default '',
  name        text        not null default 'Semester',
  events      int         not null default 0,
  updated_at  timestamptz not null default now()
);

create unique index if not exists calendar_feeds_token_idx on public.calendar_feeds (token);

alter table public.calendar_feeds enable row level security;

-- The owner may read, publish and replace their own row. The unauthenticated
-- read path does not go through RLS at all: it goes through the Edge Function,
-- which holds the service key and can only ever return the row whose token was
-- presented. `select auth.uid()` is hoisted so the planner evaluates it once,
-- matching the hardening the rest of the schema already carries.
drop policy if exists "feeds are managed by their owner" on public.calendar_feeds;
create policy "feeds are managed by their owner" on public.calendar_feeds
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop trigger if exists calendar_feeds_touch on public.calendar_feeds;
create trigger calendar_feeds_touch
  before update on public.calendar_feeds
  for each row execute function public.touch_updated_at();