-- Semester — the database behind accounts and cross-device sync.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- The security model is row-level, not secret-level. The key the app carries is
-- publishable by design and gives no access on its own: every policy below
-- demands that the row's user_id equals the id of whoever is signed in, so a
-- signed-out visitor sees nothing and a signed-in one sees only their own rows.
-- Never put the service key in the app; it bypasses all of this.

-- ── Courses ───────────────────────────────────────────────────────────────
-- One row per course, holding the whole module as JSON. A course is data the
-- app generated from a syllabus, so there is nothing to gain from splitting it
-- into columns the app would only reassemble.

create table if not exists public.courses (
  user_id     uuid        not null references auth.users on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.courses enable row level security;

drop policy if exists "courses are private" on public.courses;
create policy "courses are private" on public.courses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Everything else ───────────────────────────────────────────────────────
-- Ticked deadlines, your own tasks and notes, added course material, connected
-- calendars, settings. One row per account: it is small, it is written as a
-- whole, and splitting it would buy nothing but joins.

create table if not exists public.state (
  user_id     uuid        primary key references auth.users on delete cascade,
  data        jsonb       not null,
  updated_at  timestamptz not null default now()
);

alter table public.state enable row level security;

drop policy if exists "state is private" on public.state;
create policy "state is private" on public.state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Usage, for the shared Claude key ──────────────────────────────────────
-- The Edge Function meters generation per account so one person cannot spend
-- the whole budget. Rows are readable by their owner and written only by the
-- function, which runs with the service role.

create table if not exists public.usage (
  user_id     uuid        not null references auth.users on delete cascade,
  month       text        not null,            -- 'YYYY-MM'
  calls       int         not null default 0,
  input_tokens  bigint    not null default 0,
  output_tokens bigint    not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.usage enable row level security;

drop policy if exists "usage is readable by its owner" on public.usage;
create policy "usage is readable by its owner" on public.usage
  for select
  using (auth.uid() = user_id);

-- ── Keeping updated_at honest ─────────────────────────────────────────────
-- Sync compares timestamps to decide which side is newer, so the timestamp has
-- to come from the database rather than from a device whose clock may be wrong.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists courses_touch on public.courses;
create trigger courses_touch before insert or update on public.courses
  for each row execute function public.touch_updated_at();

drop trigger if exists state_touch on public.state;
create trigger state_touch before insert or update on public.state
  for each row execute function public.touch_updated_at();
