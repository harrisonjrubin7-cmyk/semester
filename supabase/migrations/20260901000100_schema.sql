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
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
  using ((select auth.uid()) = user_id);

-- ── Keeping updated_at honest ─────────────────────────────────────────────
-- Sync compares timestamps to decide which side is newer, so the timestamp has
-- to come from the database rather than from a device whose clock may be wrong.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
-- A fixed search_path, because without one the function resolves names
-- against whatever the caller had set. Empty rather than `public`: the body
-- calls only `now()`, which lives in pg_catalog and is always reachable.
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Nothing calls this directly and nothing needs to: Postgres checks EXECUTE
-- when a trigger is created, not each time it fires. The default grants were
-- surface with no use behind them.
revoke all on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists courses_touch on public.courses;
create trigger courses_touch before insert or update on public.courses
  for each row execute function public.touch_updated_at();

drop trigger if exists state_touch on public.state;
create trigger state_touch before insert or update on public.state
  for each row execute function public.touch_updated_at();

-- ── RLS on by default, and where this came from ───────────────────────────
--
-- **Found in production on 21 September, not designed here.** `public.rls_auto_enable()`
-- and the `ensure_rls` event trigger exist on the live project and were
-- created by no migration in this directory — not these eight, not the ten
-- recovered from the history table, not the four still pending. The shape of
-- them is Supabase's dashboard toggle for RLS-on-by-default, so the likeliest
-- story is that somebody switched it on and the switch wrote them.
--
-- They are written down here because a rebuild without them is **quietly less
-- safe than the original**: a table added later would come up with row-level
-- security off and no policy, and nothing about the rebuild would look wrong.
-- `schema.snapshot.sql` makes the same argument about the same object — its
-- first draft omitted the event trigger, and only a control caught it, because
-- no count of tables or policies can see one.
--
-- How it was found: the step-4 fingerprint in `MIGRATION-HISTORY.md` compared
-- columns, constraints and policies, and all three matched. Functions were not
-- among the three, and when they were added the repaired file set had sixteen
-- where the snapshot and production have seventeen. This is the seventeenth.
-- A clean reading was a claim about the probe, and the probe was answering a
-- narrower question than the one being asked.
--
-- Transcribed from the live definition rather than written: `search_path` is
-- `pg_catalog` and not `''`, the body swallows its own errors into the log,
-- and the schema list is a one-element `in ('public')`. None of that is how
-- this repository writes a function, and all of it is what is actually
-- running, which is the thing a record is for.
create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

-- `20260907134823_harden_security_definer_helpers.sql` revokes EXECUTE on this
-- from public, anon and authenticated — and that statement is one of the ten
-- `replay.expected` records as refused, because until now the function it
-- names did not exist here at all. It applies from this commit onward.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Needs superuser, which is why it is last. Everything above this line applies
-- without it; `supabase/check.sh` runs as `postgres` and gets it, and a
-- developer applying these files by hand as a non-superuser will see this one
-- line fail by name rather than silently not happen.
drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();
