-- The parts of a Supabase project that are not in this repo.
--
-- `migrations/` is written against a database that already has Supabase's own
-- furniture in it: an `auth` schema with a `users` table, an `auth.uid()` that
-- reads the request's JWT claim, the three roles every policy names, and the
-- `supabase_realtime` publication. On a real project all of that is there
-- before any migration runs. On a bare Postgres none of it is, which is why
-- the `.check.sql` files could only ever be run by pasting them into a live
-- project's SQL Editor — and, in practice, were not run at all.
--
-- This is the smallest stand-in that makes them runnable locally. It is not a
-- reimplementation of Supabase and is not deployed anywhere: `check.sh` uses
-- it against a throwaway cluster and nothing else reads it.
--
-- Every statement is guarded, because roles in Postgres are cluster-wide and
-- outlive the database they were first created for.

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

create schema if not exists auth;
create schema if not exists private;

grant usage on schema public, auth, private to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;

create table if not exists auth.users (
  id                  uuid primary key,
  instance_id         uuid,
  aud                 text,
  role                text,
  email               text,
  email_confirmed_at  timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Supabase's own definition. The `nullif` before the cast is the part that
-- matters: `set_config(..., null, true)` stores an empty string, not a null,
-- and a check script that signs out does exactly that. Casting first turns
-- signing out into "invalid input syntax for type json".
create or replace function auth.uid() returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

do $$ begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
