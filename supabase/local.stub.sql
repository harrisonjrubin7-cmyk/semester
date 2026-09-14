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

-- `…0200_classmates.sql` adds `public.messages` to this publication and fails
-- outright without it. Supabase ships it on every project, branches included.
do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
