-- Verified listings: who drafts, who publishes, who reads, and https only.
--
-- `public.opportunities` had no check suite. This walks the lifecycle the
-- Opportunities screen relies on when it calls a listing "verified":
--
--   * A publisher (employer, holding opportunity:publish over their employer
--     scope) drafts and submits; may not publish their own listing.
--   * A student sees nothing until a moderator publishes — then sees it at
--     their school, and a student at another school does not.
--   * THE CONTROL: after the moderator publishes, the student reads exactly
--     one listing. A policy that hid everything would pass every "cannot".
--   * A new listing's link must be https (20260928031700).
--
--   How to run it: supabase/check.sh listings

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

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  -- A statement that ran but touched no row was refused by RLS.
  return n = 0;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.expect_refused(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was allowed', what;
  end if;
  raise notice 'ok  % is refused', what;
end $$;

create or replace function pg_temp.expect_allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — was refused', what;
  end if;
  raise notice 'ok  % is allowed', what;
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

do $$
declare
  employer uuid; moderator uuid; student uuid; far uuid; oid uuid;
begin
  insert into public.schools (id, name, email_domains) values
    ('ls-u', 'Listing University', array['ls-u.example']),
    ('ls-other', 'Other University', array['ls-other.example']);
  employer  := pg_temp.newuser('recruiter@acme.example', null);
  moderator := pg_temp.newuser('mod@semester.example', null);
  student   := pg_temp.newuser('student@ls-u.example', 'ls-u');
  far       := pg_temp.newuser('far@ls-other.example', 'ls-other');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (employer,  'employer',  'employer', 'acme', 'platform'),
    (moderator, 'moderator', 'platform', '',     'platform');

  -- ── Drafting ────────────────────────────────────────────────────────────
  perform pg_temp.expect_allowed('a publisher submitting a listing for review', employer,
    $q$insert into public.opportunities (kind, publisher_id, publisher_scope_kind, publisher_scope_id, tenant_id, title, url, status)
       select 'internship', (select auth.uid()), 'employer', 'acme', 'ls-u', 'Data intern', 'https://acme.example/jobs/1', 'pending_review'$q$);
  select id into oid from public.opportunities where title = 'Data intern';

  perform pg_temp.expect_refused('a publisher publishing their own listing', employer,
    format($q$update public.opportunities set status = 'published' where id = %L$q$, oid));
  perform pg_temp.expect_refused('a publisher submitting a listing with an http link', employer,
    $q$insert into public.opportunities (kind, publisher_id, publisher_scope_kind, publisher_scope_id, tenant_id, title, url, status)
       select 'job', (select auth.uid()), 'employer', 'acme', 'ls-u', 'Plain link', 'http://acme.example/2', 'pending_review'$q$);
  perform pg_temp.expect_refused('a student drafting a listing', student,
    $q$insert into public.opportunities (kind, publisher_id, publisher_scope_kind, publisher_scope_id, tenant_id, title, status)
       select 'job', (select auth.uid()), 'employer', 'acme', 'ls-u', 'Not mine', 'pending_review'$q$);

  -- ── Before and after publishing ─────────────────────────────────────────
  perform pg_temp.counted('a student sees nothing before a moderator publishes',
    pg_temp.seen(student, 'select 1 from public.opportunities'), 0);
  -- Moderation is status only, through moderate_opportunity (20260928110700).
  perform pg_temp.expect_refused('a moderator rewriting a listing''s title', moderator,
    format($q$update public.opportunities set title = 'Something else' where id = %L$q$, oid));
  perform pg_temp.expect_refused('a moderator rewriting a listing''s body and link', moderator,
    format($q$update public.opportunities set body = 'Unsaid', url = 'https://elsewhere.example' where id = %L$q$, oid));
  perform pg_temp.expect_refused('a moderator setting status by a direct update', moderator,
    format($q$update public.opportunities set status = 'published' where id = %L$q$, oid));
  perform pg_temp.expect_refused('a publisher calling the moderation function', employer,
    format($q$select public.moderate_opportunity(%L, 'published')$q$, oid));
  perform pg_temp.expect_refused('a moderator moving a listing to anything but published or removed', moderator,
    format($q$select public.moderate_opportunity(%L, 'draft')$q$, oid));
  perform pg_temp.expect_allowed('the publisher still editing their own listing under review', employer,
    format($q$update public.opportunities set body = 'Paid, 10 hours a week' where id = %L$q$, oid));
  perform pg_temp.expect_allowed('a moderator publishing the listing', moderator,
    format($q$select public.moderate_opportunity(%L, 'published')$q$, oid));
  perform pg_temp.counted('and the title and body are the publisher''s, as written',
    (select count(*) from public.opportunities where id = oid and title = 'Data intern' and body = 'Paid, 10 hours a week' and status = 'published'), 1);
  perform pg_temp.counted('a student at the school reads the published listing — THE CONTROL',
    pg_temp.seen(student, 'select 1 from public.opportunities'), 1);
  perform pg_temp.counted('a student at another school does not',
    pg_temp.seen(far, 'select 1 from public.opportunities'), 0);
end $$;

rollback;
