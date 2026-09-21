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
-- The schema and `auth.users` grants come after the migrations. The table
-- privileges no longer do: they are set as default privileges below, before
-- any migration runs, which is how Supabase applies them and the only way a
-- revoke inside a migration can survive to be checked. See the note above
-- `alter default privileges … on tables`.

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

-- And the same for tables, which is the other half and was missing for the
-- same reason the function half was.
--
-- `check.sh` used to model this as `grant all on all tables in schema public`
-- run *after* the migrations, and the header of this file used to say it could
-- not be done here because "there are no tables until the migrations have
-- run". That is true of `grant on all tables` and irrelevant to
-- `alter default privileges`, whose entire purpose is to apply to objects that
-- do not exist yet — which is exactly the argument that moved the function
-- grant into this file.
--
-- The difference is not cosmetic. A blanket grant after the migrations hands
-- back every table privilege a migration deliberately revoked, so the harness
-- could not see a relation-level revoke succeed or fail: it erased the
-- evidence either way. `20260921143455_forms.sql` was applied to the live
-- project with `public.published_forms` — an auto-updatable view with the
-- definer's rights — writable by `anon`, and no suite here could have caught
-- it, because in this harness `anon` was handed ALL on that view after the
-- migration that was supposed to have taken it away.
--
-- Placed before the migrations, a revoke in a migration now sticks, exactly as
-- it does on the live project. `grants.check.sql` is what reads the result.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;

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

-- ── RLS on by default is NOT here, and that is the correction ────────────
--
-- `public.rls_auto_enable()` and the `ensure_rls` event trigger were put in
-- this file on 21 September as "what Supabase's automatically-enable-RLS
-- setting installs". There is no such setting. Supabase's own documentation,
-- under the heading *Auto-enable RLS for new tables*, says "if you want RLS
-- enabled automatically for new tables, **you can create** an event trigger",
-- and gives this exact code — which is why production's copy is in Supabase's
-- house style rather than this repository's, and why the only migration that
-- names it merely revokes EXECUTE. Somebody pasted the documented recipe into
-- the SQL editor, which is the habit this whole repair is a record of.
--
-- It matters because this file is not deployed anywhere (see `README.md`). An
-- object that lives only here exists in no rebuilt database and on no preview
-- branch, so a recovery from `migrations/` had no RLS-on-by-default and
-- nothing said so: `function_grants.sql` skips a function that is absent
-- rather than failing on it, so the revoke passed over it in silence.
--
-- It is created by `migrations/20260901000100_schema.sql` instead. That is
-- right under either account of where production's copy came from: if the
-- platform does install it, `create or replace` and a guarded
-- `create event trigger` match what is already there and change nothing; if it
-- does not, a rebuild is safe rather than quietly unsafe. There is no reading
-- of the evidence under which keeping it out of the migrations is the safer
-- choice.
