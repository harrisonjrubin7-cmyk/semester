-- Hold-release notices (20261012100000, D-1448): when the SIS sync clears a
-- registration hold, its student gets one notice (office, link, when; never
-- the reason), one audit event and, with a live device, one push. Nothing a
-- client can do writes a notice or touches a hold; nobody else sees one.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh hold-release-notices

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
  pupil uuid; peer uuid; hold uuid; other uuid; quiet uuid; seen_once uuid;
begin
  insert into public.schools (id, name, email_domains) values
    ('hr-u', 'Hold Release University', array['hr-u.example']);
  pupil   := pg_temp.newuser('student@hr-u.example', 'hr-u');
  peer := pg_temp.newuser('classmate@hr-u.example', 'hr-u');
  insert into public.push_devices (endpoint, user_id, p256dh, auth)
  values ('https://push.example/student', pupil, 'k', 'a');
  insert into public.registration_holds (tenant_id, student, office, link, reason)
  values ('hr-u', pupil, 'Student Accounts', 'https://pay.hr-u.example', 'Unpaid balance of $412')
  returning id into hold;
  insert into public.registration_holds (tenant_id, student, office, reason)
  values ('hr-u', pupil, 'Advising', 'Meet your advisor first')
  returning id into other;
  insert into public.registration_holds (tenant_id, student, office, reason)
  values ('hr-u', peer, 'Library', 'Overdue') returning id into quiet;

  -- ── nothing is said before a release ─────────────────────────────────────
  perform pg_temp.counted('no notice while every hold is on', (select count(*) from public.hold_release_notices), 0);
  insert into public.registration_holds (tenant_id, student, office, released_at)
  values ('hr-u', pupil, 'Registrar', now() - interval '1 day') returning id into seen_once;
  perform pg_temp.counted('a hold that arrives already released says nothing',
    (select count(*) from public.hold_release_notices where hold_id = seen_once), 0);

  -- ── the sync clears one ──────────────────────────────────────────────────
  update public.registration_holds set released_at = now() where id = hold;
  perform pg_temp.counted('one notice for the cleared hold', (select count(*) from public.hold_release_notices where hold_id = hold), 1);
  perform pg_temp.counted('the notice names the office', (select count(*) from public.hold_release_notices
    where hold_id = hold and office = 'Student Accounts' and link = 'https://pay.hr-u.example' and read_at is null), 1);
  perform pg_temp.counted('a notice has no column a reason could be in', (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'hold_release_notices' and column_name not in
      ('id', 'hold_id', 'student', 'office', 'link', 'released_at', 'read_at')), 0);
  perform pg_temp.counted('the release is on the audit record', (select count(*) from public.audit_event
    where action = 'financial_account.notify_student_of_hold_release' and tenant_id = 'hr-u'
      and object_kind = 'registration_hold' and detail = '{}'::jsonb), 1);
  perform pg_temp.counted('one push, to the student, saying no reason', (select count(*) from public.push_queue
    where user_id = pupil and id = 'hold:' || hold::text and screen = 'yes'
      and body = 'Student Accounts cleared a hold on your account.' and body !~* 'unpaid|412'), 1);

  -- ── a sync that writes the release again changes nothing ─────────────────
  update public.registration_holds set released_at = now() + interval '1 minute' where id = hold;
  update public.registration_holds set office = 'Student Accounts Office' where id = hold;
  perform pg_temp.counted('a repeat release adds no notice', (select count(*) from public.hold_release_notices), 1);
  perform pg_temp.counted('a repeat release adds no audit event', (select count(*) from public.audit_event
    where action = 'financial_account.notify_student_of_hold_release'), 1);
  perform pg_temp.counted('a repeat release adds no push', (select count(*) from public.push_queue where user_id = pupil), 1);

  -- ── who sees it, and what they may do ───────────────────────────────────
  perform pg_temp.counted('the student sees their notice',
    pg_temp.seen(pupil, 'select * from public.hold_release_notices'), 1);
  perform pg_temp.counted('a classmate sees none',
    pg_temp.seen(peer, 'select * from public.hold_release_notices'), 0);
  perform pg_temp.expect_refused('a classmate marking it read', peer,
    format('update public.hold_release_notices set read_at = now() where hold_id = %L', hold));
  perform pg_temp.expect_allowed('the student marking it read', pupil,
    format('update public.hold_release_notices set read_at = now() where hold_id = %L', hold));
  perform pg_temp.counted('it is read', (select count(*) from public.hold_release_notices where hold_id = hold and read_at is not null), 1);
  perform pg_temp.expect_refused('the student rewriting the office', pupil,
    format('update public.hold_release_notices set office = %L where hold_id = %L', 'Nobody', hold));
  perform pg_temp.expect_refused('the student writing a notice', pupil,
    format('insert into public.hold_release_notices (hold_id, student, office, released_at) values (%L, %L, %L, now())', other, pupil, 'Advising'));
  perform pg_temp.expect_refused('the student deleting a notice', pupil,
    format('delete from public.hold_release_notices where hold_id = %L', hold));
  perform pg_temp.expect_refused('the student clearing their own hold', pupil,
    format('update public.registration_holds set released_at = now() where id = %L', other));
  perform pg_temp.counted('the other hold is still on', (select count(*) from public.registration_holds where id = other and released_at is null), 1);

  -- ── placed again and cleared again re-arms the same notice ──────────────
  update public.registration_holds set released_at = null where id = hold;
  update public.registration_holds set released_at = now() + interval '2 minutes' where id = hold;
  perform pg_temp.counted('still one notice for that hold', (select count(*) from public.hold_release_notices where hold_id = hold), 1);
  perform pg_temp.counted('and it is unread again', (select count(*) from public.hold_release_notices where hold_id = hold and read_at is null), 1);
  perform pg_temp.counted('a second release is a second audit event', (select count(*) from public.audit_event
    where action = 'financial_account.notify_student_of_hold_release'), 2);

  -- ── no device, no push; the notice still lands ──────────────────────────
  update public.registration_holds set released_at = now() where id = quiet;
  perform pg_temp.counted('the classmate has a notice', (select count(*) from public.hold_release_notices where student = peer), 1);
  perform pg_temp.counted('a student with reminders off gets no push', (select count(*) from public.push_queue where user_id = peer), 0);

  -- ── erasure ─────────────────────────────────────────────────────────────
  delete from public.registration_holds where id = quiet;
  perform pg_temp.counted('a deleted hold takes its notice', (select count(*) from public.hold_release_notices where student = peer), 0);
  delete from auth.users where id = pupil;
  perform pg_temp.counted('a deleted account takes its notices', (select count(*) from public.hold_release_notices), 0);
end $$;

set local role anon;
do $$
declare n bigint;
begin
  select count(*) into n from public.hold_release_notices;
  raise exception 'FAILED: anon read hold notices';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot read hold notices';
end $$;
reset role;

rollback;
