-- Institutional foundation: two synthetic campuses, one exact-scope grant,
-- and no client-selected shortcut around either boundary.
--
-- LOCAL/DISPOSABLE DATABASES ONLY. This file inserts auth users and fixtures,
-- then rolls the entire transaction back. Run through `supabase/check.sh
-- institutional-foundation`; never point psql at a live project.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text,
                     true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
  insert into public.profiles (user_id, handle) values (who, split_part(address, '@', 1));
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.answered(what text, got boolean, want boolean)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  northstar_user uuid;
  cedar_user     uuid;
  northstar_org  uuid;
  n              bigint;
  answer         boolean;
begin
  insert into public.schools (id, name, email_domains) values
    ('northstar-check', 'Northstar Check University', array['northstar-check.example']),
    ('cedar-check', 'Cedar Check College', array['cedar-check.example']);

  northstar_user := pg_temp.newuser('student@northstar-check.example');
  cedar_user := pg_temp.newuser('student@cedar-check.example');

  update public.profiles set school_id = 'northstar-check' where user_id = northstar_user;
  update public.profiles set school_id = 'cedar-check' where user_id = cedar_user;

  insert into public.organizations (school_id, slug, name, listed, created_by)
  values ('northstar-check', 'northstar-lab', 'Northstar Lab', true, northstar_user)
  returning id into northstar_org;

  perform pg_temp.become(cedar_user);
  select count(*) into n from public.organizations where id = northstar_org;
  reset role;
  perform pg_temp.counted('another campus cannot read a private tenant row', n, 0);

  if not pg_temp.refused(
    northstar_user,
    format('update public.profiles set school_id = %L where user_id = %L',
           'cedar-check', northstar_user)
  ) then
    raise exception 'FAILED: a client directly changed profiles.school_id';
  end if;
  select count(*) into n from public.profiles
   where user_id = northstar_user and school_id = 'northstar-check';
  perform pg_temp.counted('the direct school change is refused', n, 1);

  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance)
  values
    (northstar_user, 'organization_admin', 'organization',
     'northstar-check/northstar-lab', 'institution');
  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, expires_at)
  values
    (northstar_user, 'organization_admin', 'organization',
     'northstar-check/expired-lab', 'institution', now() - interval '1 day');
  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, revoked_at)
  values
    (northstar_user, 'organization_admin', 'organization',
     'northstar-check/revoked-lab', 'institution', now());

  perform pg_temp.become(northstar_user);
  select private.has_capability(
    'organization:read', 'organization', 'northstar-check/northstar-lab'
  ) into answer;
  perform pg_temp.answered('a live exact-scope grant works — THE CONTROL', answer, true);

  select private.has_capability(
    'organization:read', 'organization', 'cedar-check/northstar-lab'
  ) into answer;
  perform pg_temp.answered('a grant in one institution does not authorize another scope', answer, false);

  select private.has_capability(
    'organization:read', 'organization', 'northstar-check/expired-lab'
  ) into answer;
  perform pg_temp.answered('an expired grant authorizes nothing', answer, false);

  select private.has_capability(
    'organization:read', 'organization', 'northstar-check/revoked-lab'
  ) into answer;
  perform pg_temp.answered('a revoked grant authorizes nothing', answer, false);

  select private.has_capability('platform:configure') into answer;
  perform pg_temp.answered('a tenant role implies no platform capability', answer, false);

  reset role;
  raise notice 'institutional foundation: every check passed';
end $$;

rollback;
