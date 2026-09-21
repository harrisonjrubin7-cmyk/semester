-- The parts Supabase provides, for a plain Postgres.
--
-- The six `*.check.sql` suites need an empty database — their counts are
-- wrong anywhere real rows exist, which their own headers explain. This builds
-- one out of a bare Postgres, so the checks can be run without a preview
-- branch and without touching anything live.
--
-- Run it BEFORE the migrations. Nothing here is a migration itself: it stands
-- in for what the platform supplies, and on a real project every object below
-- already exists.
--
--     createdb semester_check
--     psql -1 -v ON_ERROR_STOP=1 -d semester_check -f supabase/local.stub.sql
--     for f in supabase/migrations/*.sql; do
--       psql -1 -v ON_ERROR_STOP=1 -d semester_check -f "$f" || break
--     done
--     psql -d semester_check <<'SQL'
--       grant usage on schema auth, public to anon, authenticated;
--       grant select, insert on auth.users to anon, authenticated;
--       grant all on all tables in schema public to anon, authenticated;
--     SQL
--     psql -v ON_ERROR_STOP=1 -d semester_check -f supabase/classmates.check.sql
--
-- The grants come after the migrations because they are `on all tables`, and
-- there are no tables until the migrations have run. Supabase applies the
-- equivalent as default privileges on `public`, which is why nothing in
-- `migrations/` grants them itself.

create extension if not exists pgcrypto with schema public;
create schema if not exists extensions;
create schema if not exists auth;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

-- ── The grant this directory could not see ────────────────────────────────
--
-- Supabase does not only grant tables. `pg_default_acl` on a real project
-- carries an entry for schema `public`, objtype `f`:
--
--     {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- so **every function created in `public` is granted EXECUTE to those roles
-- explicitly, as it is created**. That is a different thing from the table
-- grants below, and the difference is the whole reason this block exists:
-- `revoke all on function … from public` removes the PUBLIC grant and does not
-- touch an explicit per-role one. A migration that revokes only from PUBLIC
-- therefore leaves the function reachable by anybody holding the publishable
-- key, on a real project, while this harness — which never granted functions
-- at all — reported it closed.
--
-- That was not hypothetical. `20260921002428_invites.sql` was applied to the
-- live project on 21 September and `set_invite_only(boolean)` landed with
-- `anon=X` and `authenticated=X`: a signed-out visitor could have turned the
-- pilot's invite gate on or off. `invites.check.sql` had a check for exactly
-- that and it had been passing, because the thing it was testing against did
-- not exist here.
--
-- Unlike the table grants, this one belongs in the stub rather than after the
-- migrations, and can only work here: default privileges apply to objects
-- created *afterwards*, so they must be in place before a migration creates
-- its first function. `20260921144011_function_grants.sql` is what closes the
-- hole this now makes visible.
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

-- Only the columns the check suites actually write. A real `auth.users` has
-- many more, and none of them are reachable from a policy in this schema.
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  instance_id        uuid,
  aud                text,
  role               text,
  email              text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb       default '{}'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- `nullif(…, '')` before the cast, and it is not decoration. `set_config` of
-- null reads back as the empty string, which is how the calendar suite signs
-- out to test what `anon` may see — and `''::jsonb` raises `invalid input
-- syntax for type json`. Supabase's own `auth.uid()` tolerates it; a stub that
-- does not turns a passing suite into a failure that looks like the schema's.
create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;

create or replace function auth.jwt() returns jsonb language sql stable as
$$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;

create or replace function auth.email() returns text language sql stable as
$$ select auth.jwt() ->> 'email' $$;

create or replace function auth.role() returns text language sql stable as
$$ select auth.jwt() ->> 'role' $$;

-- The Realtime server's own table, and the function a policy on it reads.
--
-- `…0400_rooms.sql` guards its whole presence block on `realtime.messages`
-- existing, because a bare Postgres has no `realtime` schema — which meant the
-- two policies the green dots depend on were created nowhere a suite could
-- reach and asserted by nothing. This is the smallest thing that makes them
-- reachable: `topic()` is copied from the definition a real project carries,
-- and `messages` has only the columns the policies and the suite touch.
--
-- On a real project Realtime sets `realtime.topic` per connection from the
-- channel name the client joined, with its `realtime:` prefix already off;
-- `rooms.check.sql` sets it with `set_config` the same way `become` sets the
-- JWT claims. Nothing here is a migration, and on a real project every object
-- below already exists — including the grants, which mirror what a project
-- gives `authenticated` on this table.
create schema if not exists realtime;

create or replace function realtime.topic() returns text language sql stable as
$$ select nullif(current_setting('realtime.topic', true), '')::text $$;

create table if not exists realtime.messages (
  id          uuid        not null default gen_random_uuid(),
  topic       text        not null,
  extension   text        not null,
  payload     jsonb,
  event       text,
  private     boolean     default false,
  inserted_at timestamp   not null default now(),
  updated_at  timestamp   not null default now()
);

grant usage on schema realtime to anon, authenticated;
grant select, insert, update on realtime.messages to anon, authenticated;

-- `…0200_classmates.sql` adds `public.messages` to this publication and fails
-- outright without it. Supabase ships it on every project, branches included.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
