-- Per-record sync with soft deletes. See supabase/records.sql and
-- supabase/RECORDS-REVIEW.md. Additive: nothing in the deployed app reads
-- these tables yet.

-- `set search_path = ''` is NOT in records.sql and is kept here deliberately:
-- the live public.touch_updated_at already carries it, and three triggers
-- (courses_touch, profiles_touch, state_touch) depend on this function. A
-- create-or-replace without it would strip the hardening off all three.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.notes (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table if not exists public.tasks (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table if not exists public.appointments (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table if not exists public.sittings (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

alter table public.courses add column if not exists deleted_at timestamptz;

do $$
declare t text;
begin
  foreach t in array array['notes', 'tasks', 'appointments', 'sittings', 'courses']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before insert or update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

alter table public.notes        enable row level security;
alter table public.tasks        enable row level security;
alter table public.appointments enable row level security;
alter table public.sittings     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['notes', 'tasks', 'appointments', 'sittings']
  loop
    execute format('drop policy if exists "own rows" on public.%1$s', t);
    execute format(
      'create policy "own rows" on public.%1$s
       for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end;
$$;

create index if not exists notes_changed        on public.notes        (user_id, updated_at);
create index if not exists tasks_changed        on public.tasks        (user_id, updated_at);
create index if not exists appointments_changed on public.appointments (user_id, updated_at);
create index if not exists sittings_changed     on public.sittings     (user_id, updated_at);
create index if not exists courses_changed      on public.courses      (user_id, updated_at);

-- Also hardened beyond records.sql, and for a second reason: in `public` this
-- is a PostgREST endpoint. The file says "run it by hand", so it is not left
-- callable by anon or authenticated.
create or replace function public.sweep_tombstones(older_than interval default '90 days')
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t text;
  n integer := 0;
  hit integer;
begin
  foreach t in array array['notes', 'tasks', 'appointments', 'sittings', 'courses']
  loop
    execute format(
      'delete from public.%1$s where deleted_at is not null and deleted_at < now() - $1', t)
      using older_than;
    get diagnostics hit = row_count;
    n := n + hit;
  end loop;
  return n;
end;
$$;

revoke all on function public.sweep_tombstones(interval) from anon, authenticated;