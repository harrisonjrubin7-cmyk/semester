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

-- ── RLS on by default ─────────────────────────────────────────────────────
--
-- Production has an event trigger, `ensure_rls`, that turns on row-level
-- security for every table created in `public` afterwards. Nothing in this
-- directory created it until now, and a database rebuilt from here was
-- therefore quietly less safe than the one running — no count of tables,
-- policies or functions would have shown it, which is how it survived a
-- snapshot, a fingerprint and two people looking straight at it.
--
-- Where it came from, since two documents have now guessed wrong. It is not
-- Supabase's own platform object, and it is not installed by an
-- "automatically enable RLS" setting: there is no such setting. Supabase's
-- documentation has a section headed *Auto-enable RLS for new tables* which
-- says "if you want RLS enabled automatically for new tables, you can create
-- an event trigger", and prints this exact code. Somebody ran the documented
-- recipe against this project by hand — which is both why it reads in
-- Supabase's house style and why the one migration that mentions it does
-- nothing but revoke EXECUTE on something already there.
--
-- Copied from the live definition rather than rewritten, upper-cased body and
-- all, so that a diff of this against production reports a difference only
-- when there is one.
create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
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
$function$;

-- `create event trigger` has no `if not exists`, and creating one needs
-- superuser — which the `postgres` role running these migrations has, on the
-- live project and on a preview branch alike; production's own copy is owned
-- by it. Guarded rather than dropped and recreated, so that running this
-- against a database that already has the trigger leaves it exactly as it is.
--
-- The EXECUTE grant is closed by `20260901001500_function_grants.sql`, which
-- already lists this function. Until now it skipped it, because on a rebuild
-- there was nothing there to revoke.
do $$ begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end $$;
