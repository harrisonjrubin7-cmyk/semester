-- ── Push reminders ────────────────────────────────────────────────────────
--
-- Two tables and no cleverness. The client decides what should be said and
-- when; these hold it until the sender picks it up.
--
-- The reason it is arranged this way is in `app/src/lib/push.ts`: a server
-- that worked out for itself what was due would need its own copy of the date
-- rules, the term rules and the tick state, and that copy would drift from the
-- app's within a term. The drift shows up as a notification about a deadline
-- that has moved, which is worse than no notification because it teaches
-- people to ignore them.
--
-- Apply with:
--     psql "$DATABASE_URL" -f supabase/push.sql

-- Where to send. One row per device, not per account: a phone and a laptop are
-- two subscriptions, and a student who signs out on one should not lose the
-- other.
create table if not exists public.push_devices (
  endpoint    text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  p256dh      text        not null,
  auth        text        not null,
  created_at  timestamptz not null default now(),
  -- Set when a push gateway tells us the subscription is dead. Kept rather
  -- than deleted for one pass so a transient 404 does not silently unsubscribe
  -- somebody; the sender clears rows that stay gone.
  gone_at     timestamptz
);

create index if not exists push_devices_user on public.push_devices (user_id);

alter table public.push_devices enable row level security;

drop policy if exists "own devices" on public.push_devices;
create policy "own devices" on public.push_devices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- What to say, and when. Written by the app whenever it syncs, deleted once
-- sent. `id` is the reminder id from `lib/notify.ts`, which is unique per
-- reminder per day — so re-queueing the same week twice replaces rather than
-- duplicates, and a phone that was off does not wake to nine copies.
create table if not exists public.push_queue (
  user_id   uuid        not null references auth.users on delete cascade,
  id        text        not null,
  send_at   timestamptz not null,
  title     text        not null,
  body      text        not null,
  screen    text        not null default '',
  -- The deadline a reminder is about, where it is about one. Sent through to
  -- the notification so a tap opens that deadline rather than the app. See
  -- `app/src/lib/land.ts`.
  item      text        not null default '',
  primary key (user_id, id)
);

create index if not exists push_queue_due on public.push_queue (send_at)
  where send_at is not null;

alter table public.push_queue enable row level security;

drop policy if exists "own queue" on public.push_queue;
create policy "own queue" on public.push_queue
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The sender runs with the service role, which bypasses the policies above.
-- Nothing else needs to read another account's rows, and nothing else can.


-- Added after the table shipped. Safe to run on an existing project.
alter table public.push_queue add column if not exists item text not null default '';
