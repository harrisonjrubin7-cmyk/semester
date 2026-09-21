create table if not exists public.push_devices (
  endpoint    text        primary key,
  user_id     uuid        not null references auth.users on delete cascade,
  p256dh      text        not null,
  auth        text        not null,
  created_at  timestamptz not null default now(),
  gone_at     timestamptz
);

create index if not exists push_devices_user on public.push_devices (user_id);

alter table public.push_devices enable row level security;

drop policy if exists "own devices" on public.push_devices;
create policy "own devices" on public.push_devices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.push_queue (
  user_id   uuid        not null references auth.users on delete cascade,
  id        text        not null,
  send_at   timestamptz not null,
  title     text        not null,
  body      text        not null,
  screen    text        not null default '',
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

alter table public.push_queue add column if not exists item text not null default '';