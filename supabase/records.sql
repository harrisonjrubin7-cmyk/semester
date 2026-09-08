-- Semester — per-record sync, with soft deletes.
--
-- REVIEW THIS BEFORE RUNNING IT. It is safe to run twice and it does not drop
-- anything, but it changes how your devices agree with each other, and that is
-- worth reading rather than pasting.
--
-- Run in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
--
-- ── The bug this fixes ────────────────────────────────────────────────────
--
-- Everything except courses syncs as one JSON blob in `state`. The app merges
-- that blob field by field rather than replacing it (see `app/src/lib/
-- merge.ts`), and for lists the strategy is `union` — both devices' notes
-- survive, which is right.
--
-- A union cannot express a deletion. There is nothing in the data that
-- distinguishes "the laptop never had this note" from "the phone deleted it",
-- so the merge keeps it. Delete a note on your phone, open your laptop, and it
-- comes back. `app/src/lib/resurrect.test.ts` demonstrates this against the
-- current code.
--
-- Courses already avoid it: `removedCourses` tells the account exactly what a
-- device removed. Notes, tasks, appointments and practice papers have no
-- equivalent. A `deleted_at` column per row is that mechanism, made durable.
--
--
-- ── Where this departs from the written spec, and why ─────────────────────
--
-- The spec's Phase 2 schema has tables for `terms`, `items` and `scores` —
-- coursework split into columns. This migration does not create them.
--
-- Course modules are stored as JSON on purpose: a module is data the app
-- generated from a syllabus, read and written whole, and splitting it into
-- columns would buy joins and cost the pipeline. The spec's own Phase 3 warns
-- against exactly this shape of change — "the failure mode is a refactor that
-- makes the app work everywhere by making it good nowhere".
--
-- So what moves out of the blob is the data that is genuinely a list of
-- independent records a person creates and deletes one at a time: notes,
-- tasks, appointments, practice papers. What stays in `state` is the data that
-- is not records at all — settings, the map of what is ticked, card review
-- history — where `merge.ts` already does the right thing with `ticks`,
-- `latest` and `mine`, and where a union was never wrong.
--
-- If you would rather have the spec's schema as written, say so; it is a
-- larger change and a different app, and it should be a decision rather than a
-- default.
--
--
-- ── What running this does and does not do ────────────────────────────────
--
-- Does:      creates four tables, adds `deleted_at` to `courses`, installs an
--            `updated_at` trigger on each, and enables row-level security.
-- Does not:  move any existing data, or change what the current app reads.
--
-- The tables are empty until a build that writes to them ships. Until then
-- this is inert: the app in production keeps using `state` exactly as it does
-- now. That is deliberate — the schema should be in place and reviewed before
-- any client depends on it.


-- ── The server's clock, not the device's ──────────────────────────────────
--
-- `updated_at` is set by the database on every write and cannot be set by a
-- client. This is the whole reason last-write-wins is trustworthy here: device
-- clocks drift, and a phone set five minutes fast would otherwise win every
-- conflict forever, silently, until somebody noticed their laptop's edits
-- never survived.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── One table shape, four times ───────────────────────────────────────────
--
-- Every row carries:
--   user_id     whose it is, and what row-level security keys on
--   id          the app's own id for the record, stable across devices
--   data        the record itself, as the app already shapes it
--   updated_at  set by the trigger above, never by a client
--   deleted_at  null for a live row; a time for one that was deleted
--
-- Soft deletes are not an optimisation. A hard delete is indistinguishable
-- from a row that never existed, which is precisely the ambiguity that makes
-- deletions resurrect. A row with `deleted_at` set is a fact the other device
-- can act on.

create table if not exists public.notes (
  user_id     uuid        not null references auth.users on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table if not exists public.tasks (
  user_id     uuid        not null references auth.users on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table if not exists public.appointments (
  user_id     uuid        not null references auth.users on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

create table if not exists public.sittings (
  user_id     uuid        not null references auth.users on delete cascade,
  id          text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, id)
);

-- Courses are already per-record. They gain the same tombstone so the
-- session-scoped `removedCourses` list can become durable — a deletion that
-- has not synced yet currently comes back on the next pull, which the code
-- comments call "visible and fixable" and which this makes unnecessary.
alter table public.courses add column if not exists deleted_at timestamptz;


-- ── The trigger, per table ────────────────────────────────────────────────

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


-- ── Row-level security ────────────────────────────────────────────────────
--
-- Do not skip this and do not defer it. The key the app carries is
-- publishable by design and gives no access on its own — these policies are
-- the entire access control. Without them, the anon key reads every user's
-- notes.
--
-- Enabled before a single row exists, so there is no window in which the
-- tables are readable.

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
       for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end;
$$;


-- ── Reading only what changed ─────────────────────────────────────────────
--
-- A pull asks for rows newer than the last one it saw, which is what makes
-- this cheaper than the blob it replaces rather than merely more correct.

create index if not exists notes_changed        on public.notes        (user_id, updated_at);
create index if not exists tasks_changed        on public.tasks        (user_id, updated_at);
create index if not exists appointments_changed on public.appointments (user_id, updated_at);
create index if not exists sittings_changed     on public.sittings     (user_id, updated_at);
create index if not exists courses_changed      on public.courses      (user_id, updated_at);


-- ── Clearing out old tombstones ───────────────────────────────────────────
--
-- A deleted row is kept so other devices learn about the deletion, not
-- forever. Ninety days is far longer than any device is plausibly offline and
-- short enough that the tables do not accumulate a term of deletions.
--
-- Not scheduled here. Run it by hand, or attach it to pg_cron if you have it —
-- an automatic job that deletes rows is not something this file should switch
-- on without you having read this paragraph.

create or replace function public.sweep_tombstones(older_than interval default '90 days')
returns integer
language plpgsql
security invoker
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


-- ── Undoing this ──────────────────────────────────────────────────────────
--
-- Everything above is additive, so backing it out is dropping what it made.
-- Nothing in the current app reads these tables, so this is safe at any point
-- before the client change ships.
--
--   drop table if exists public.notes, public.tasks,
--                        public.appointments, public.sittings;
--   alter table public.courses drop column if exists deleted_at;
--   drop trigger if exists touch_courses on public.courses;
--   drop function if exists public.touch_updated_at();
--   drop function if exists public.sweep_tombstones(interval);
