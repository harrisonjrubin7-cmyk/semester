-- supabase/feature_cohorts.check.sql — who is in a release cohort, and what it admits.
--
-- For 20260929340000_feature_cohorts.sql. What it proves:
--
--   * a school's configurer adds and ends memberships at their own school;
--     a student, a configurer at another school and a visitor cannot;
--   * `added_by`/`removed_by` come from the session, not the request, and a
--     membership is ended once and never rewritten or deleted;
--   * a student reads only their own memberships;
--   * `feature_cohort_allows` is true with no cohort named, true for a live
--     member, false for a non-member, false once the membership ends, false
--     for another school's cohort of the same name, and false with no row.
--
-- The control: the configurer's add comes first, and each refusal changes one
-- thing about the same people.
--
--   How to run it: supabase/check.sh feature_cohorts

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.err(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

create or replace function pg_temp.allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err(who, statement);
begin
  if e is not null then raise exception 'FAILED: % — refused: %', what, e; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  execute 'reset role';
  return n;
end $$;

create or replace function pg_temp.admits(who uuid, cap text, school text)
returns boolean language plpgsql as $$
declare b boolean;
begin
  perform pg_temp.become(who);
  select public.feature_cohort_allows(cap, school) into b;
  execute 'reset role';
  return b;
end $$;

do $$
declare
  admin uuid; other_admin uuid; pilot uuid; bystander uuid; outsider uuid;
  cap constant text := 'module.source_freshness_cards';
begin
  insert into public.schools (id, name, email_domains) values
    ('fc-u', 'Cohort University', array['fc-u.example']),
    ('fc-other', 'Other University', array['fc-other.example']);

  admin       := pg_temp.newuser('admin@fc-u.example', 'fc-u');
  other_admin := pg_temp.newuser('admin@fc-other.example', 'fc-other');
  pilot       := pg_temp.newuser('pilot@fc-u.example', 'fc-u');
  bystander   := pg_temp.newuser('bystander@fc-u.example', 'fc-u');
  outsider    := pg_temp.newuser('pilot@fc-other.example', 'fc-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (admin,       'university_admin', 'school', 'fc-u',     'institution'),
    (other_admin, 'university_admin', 'school', 'fc-other', 'institution');

  -- ── Before any row: a flag with no policy is off, so no cohort admits ───
  if pg_temp.admits(pilot, cap, 'fc-u') is distinct from false then
    raise exception 'FAILED: no policy row reads as admitted';
  end if;
  raise notice 'ok  no policy row admits nobody';

  -- ── A row naming no cohort: the step does not apply ────────────────────
  perform pg_temp.allowed('a configurer writes the policy row', admin,
    format($q$insert into public.tenant_feature_policy (tenant_id, capability, state)
              values ('fc-u', %L, 'preview')$q$, cap));
  if pg_temp.admits(bystander, cap, 'fc-u') is distinct from true then
    raise exception 'FAILED: an empty cohort list did not admit';
  end if;
  raise notice 'ok  an empty cohort list admits';

  -- ── Name a cohort: only its members are admitted ────────────────────────
  perform pg_temp.allowed('a configurer limits the row to a cohort', admin,
    format($q$update public.tenant_feature_policy set permitted_cohorts = array['first-year-2027']
              where tenant_id = 'fc-u' and capability = %L$q$, cap));
  perform pg_temp.allowed('a configurer adds a member at their school', admin,
    format($q$insert into public.feature_cohort_members (tenant_id, cohort, user_id, added_by)
              values ('fc-u', 'first-year-2027', %L, %L)$q$, pilot, bystander));

  perform pg_temp.counted('added_by is the session, not the request',
    (select count(*) from public.feature_cohort_members
      where user_id = pilot and added_by = admin), 1);

  if pg_temp.admits(pilot, cap, 'fc-u') is distinct from true then
    raise exception 'FAILED: a live member was not admitted';
  end if;
  raise notice 'ok  a live member is admitted';
  if pg_temp.admits(bystander, cap, 'fc-u') is distinct from false then
    raise exception 'FAILED: a non-member was admitted';
  end if;
  raise notice 'ok  a non-member is not admitted';

  -- ── Who may write ───────────────────────────────────────────────────────
  perform pg_temp.refused('a student adds themself', bystander,
    format($q$insert into public.feature_cohort_members (tenant_id, cohort, user_id)
              values ('fc-u', 'first-year-2027', %L)$q$, bystander));
  perform pg_temp.refused('another school''s configurer adds here', other_admin,
    format($q$insert into public.feature_cohort_members (tenant_id, cohort, user_id)
              values ('fc-u', 'first-year-2027', %L)$q$, bystander));
  -- RLS hides the row from a member's update, so it matches nothing rather
  -- than raising; the count below is the assertion.
  perform pg_temp.err(pilot,
    format($q$update public.feature_cohort_members set removed_at = now()
              where tenant_id = 'fc-u' and user_id = %L$q$, pilot));
  perform pg_temp.refused('a configurer rewrites who was added', admin,
    format($q$update public.feature_cohort_members set user_id = %L
              where tenant_id = 'fc-u' and user_id = %L$q$, bystander, pilot));
  perform pg_temp.refused('a configurer deletes a membership', admin,
    format($q$delete from public.feature_cohort_members where user_id = %L$q$, pilot));

  perform pg_temp.counted('the member''s own update ended nothing',
    (select count(*) from public.feature_cohort_members where user_id = pilot and removed_at is not null), 0);

  -- ── Who may read ────────────────────────────────────────────────────────
  perform pg_temp.counted('a member reads their own membership',
    pg_temp.seen(pilot, 'select 1 from public.feature_cohort_members'), 1);
  perform pg_temp.counted('a non-member reads none',
    pg_temp.seen(bystander, 'select 1 from public.feature_cohort_members'), 0);
  perform pg_temp.counted('another school''s configurer reads none here',
    pg_temp.seen(other_admin, 'select 1 from public.feature_cohort_members'), 0);
  perform pg_temp.counted('the configurer reads the school''s',
    pg_temp.seen(admin, 'select 1 from public.feature_cohort_members'), 1);

  -- ── Another school's cohort of the same name admits nobody here ────────
  perform pg_temp.allowed('the other configurer adds their own student', other_admin,
    format($q$insert into public.feature_cohort_members (tenant_id, cohort, user_id)
              values ('fc-other', 'first-year-2027', %L)$q$, outsider));
  if pg_temp.admits(outsider, cap, 'fc-u') is distinct from false then
    raise exception 'FAILED: a same-named cohort at another school admitted';
  end if;
  raise notice 'ok  a same-named cohort elsewhere admits nobody here';

  -- ── Ending a membership, once ───────────────────────────────────────────
  perform pg_temp.allowed('the configurer ends the membership', admin,
    format($q$update public.feature_cohort_members set removed_at = now()
              where tenant_id = 'fc-u' and user_id = %L$q$, pilot));
  perform pg_temp.counted('removed_by is the session',
    (select count(*) from public.feature_cohort_members where user_id = pilot and removed_by = admin), 1);
  if pg_temp.admits(pilot, cap, 'fc-u') is distinct from false then
    raise exception 'FAILED: an ended membership still admitted';
  end if;
  raise notice 'ok  an ended membership no longer admits';
  perform pg_temp.refused('a membership is ended twice', admin,
    format($q$update public.feature_cohort_members set removed_at = now()
              where tenant_id = 'fc-u' and user_id = %L$q$, pilot));
  perform pg_temp.counted('the membership row survives its ending',
    (select count(*) from public.feature_cohort_members where user_id = pilot), 1);

  -- ── The configurer's account goes; the record of the pilot stays ───────
  -- `added_by` and `removed_by` are `on delete set null`, and that update
  -- must get past the trigger that refuses rewrites — or deleting the account
  -- of anybody who ever ran a pilot fails (20260929370000).
  delete from auth.users where id = admin;
  perform pg_temp.counted('deleting the configurer keeps the membership, with who added and ended it cleared',
    (select count(*) from public.feature_cohort_members
      where user_id = pilot and added_by is null and removed_by is null and removed_at is not null), 1);
end $$;

-- ── A visitor cannot ask at all ───────────────────────────────────────────
set local role anon;
do $$
begin
  perform public.feature_cohort_allows('module.source_freshness_cards', 'fc-u');
  raise exception 'FAILED: a visitor called feature_cohort_allows';
exception when insufficient_privilege then
  raise notice 'ok  a visitor cannot call feature_cohort_allows';
end $$;
reset role;

rollback;
