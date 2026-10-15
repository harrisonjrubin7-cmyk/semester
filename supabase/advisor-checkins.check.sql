-- Advisor check-ins on a student's share (20261011170000, D-1448): only the
-- share's advisor writes one, only while the share and their role are live; a
-- retry writes nothing new; the student sees and may delete them; nobody else
-- sees them at all. Every refusal is attempted as the account that should be
-- refused.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
--   supabase/check.sh advisor-checkins

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

create or replace function pg_temp.check_in(who uuid, share uuid, note text, steps text[], k uuid)
returns text language plpgsql as $$
declare made uuid;
begin
  perform pg_temp.become(who);
  made := public.record_advisor_check_in(share, note, steps, k);
  execute 'reset role';
  return made::text;
exception when others then
  execute 'reset role';
  return 'ERROR: ' || sqlerrm;
end $$;

do $$
declare
  student uuid; classmate uuid; advisor uuid; other_advisor uuid;
  share uuid; theirs uuid; first text; again text; k uuid := gen_random_uuid();
  body jsonb := '{"sharedAs":"Sam","agenda":["Spring courses"]}'::jsonb;
begin
  insert into public.schools (id, name, email_domains) values
    ('ci-u', 'Check-in University', array['ci-u.example']);
  student       := pg_temp.newuser('student@ci-u.example', 'ci-u');
  classmate     := pg_temp.newuser('classmate@ci-u.example', 'ci-u');
  advisor       := pg_temp.newuser('advisor@ci-u.example', 'ci-u');
  other_advisor := pg_temp.newuser('other@ci-u.example', 'ci-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (advisor,       'academic_advisor', 'school', 'ci-u', 'institution'),
    (other_advisor, 'academic_advisor', 'school', 'ci-u', 'institution');
  insert into public.advisor_shares (student_id, advisor_id, tenant_id, title, payload, expires_at)
  values (student, advisor, 'ci-u', 'Spring planning', body, now() + interval '30 days')
  returning id into share;
  insert into public.advisor_shares (student_id, advisor_id, tenant_id, title, payload, expires_at)
  values (classmate, other_advisor, 'ci-u', 'Someone else''s', body, now() + interval '30 days')
  returning id into theirs;

  -- ── who may write one ────────────────────────────────────────────────────
  first := pg_temp.check_in(advisor, share, '  Talked through spring  ', array['Email the registrar', '  ', 'Draft a plan B'], k);
  perform pg_temp.counted('the share''s advisor records a check-in', (first not like 'ERROR%')::int, 1);
  perform pg_temp.counted('blank steps are dropped and the rest trimmed and kept in order',
    (select (next_steps = array['Email the registrar', 'Draft a plan B'] and note = 'Talked through spring')::int
       from public.advisor_check_ins where id = first::uuid), 1);
  again := pg_temp.check_in(advisor, share, 'Talked through spring', array[]::text[], k);
  perform pg_temp.counted('a retry with the same key returns the first check-in', (again = first)::int, 1);
  perform pg_temp.counted('and writes nothing new', (select count(*) from public.advisor_check_ins), 1);
  perform pg_temp.counted('another advisor is refused',
    (pg_temp.check_in(other_advisor, share, 'x', '{}', gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.counted('a classmate is refused',
    (pg_temp.check_in(classmate, share, 'x', '{}', gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.counted('the student cannot write as if the advisor',
    (pg_temp.check_in(student, share, 'x', '{}', gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.counted('another advisor, even with the right key, gets nothing back',
    (pg_temp.check_in(other_advisor, share, 'x', '{}', k) like 'ERROR%')::int, 1);
  perform pg_temp.counted('an empty note is refused',
    (pg_temp.check_in(advisor, share, '   ', '{}', gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.counted('six steps are refused',
    (pg_temp.check_in(advisor, share, 'x', array['1','2','3','4','5','6'], gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.counted('a step over 200 characters is refused',
    (pg_temp.check_in(advisor, share, 'x', array[repeat('s', 201)], gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.counted('a check-in with no key is refused',
    (pg_temp.check_in(advisor, share, 'x', '{}', null) like 'ERROR%')::int, 1);
  perform pg_temp.counted('the refusals wrote nothing', (select count(*) from public.advisor_check_ins), 1);
  perform pg_temp.expect_refused('the advisor inserts directly', advisor,
    format($q$insert into public.advisor_check_ins (share_id, advisor_id, note, client_key)
             values (%L, %L, 'x', gen_random_uuid())$q$, share, advisor));
  perform pg_temp.expect_refused('the student inserts directly', student,
    format($q$insert into public.advisor_check_ins (share_id, advisor_id, note, client_key)
             values (%L, %L, 'x', gen_random_uuid())$q$, share, advisor));
  perform pg_temp.counted('the check-in is on the audit record',
    (select count(*) from public.audit_event where action = 'check_in.recorded' and object_kind = 'advisor_check_in'), 1);

  -- ── who may read them ────────────────────────────────────────────────────
  perform pg_temp.counted('the student sees it', pg_temp.seen(student, 'select * from public.advisor_check_ins'), 1);
  perform pg_temp.counted('the advisor cannot read the table', pg_temp.seen(advisor, 'select * from public.advisor_check_ins'), 0);
  perform pg_temp.counted('a classmate cannot read the table', pg_temp.seen(classmate, 'select * from public.advisor_check_ins'), 0);
  perform pg_temp.counted('the advisor lists it on the share',
    pg_temp.seen(advisor, format('select * from public.list_share_check_ins(%L)', share)), 1);
  perform pg_temp.expect_refused('another advisor lists it', other_advisor, format('select * from public.list_share_check_ins(%L)', share));
  perform pg_temp.expect_refused('the student lists it as if the advisor', student, format('select * from public.list_share_check_ins(%L)', share));
  perform pg_temp.expect_refused('the student edits it', student,
    format($q$update public.advisor_check_ins set note = 'changed' where id = %L$q$, first));
  perform pg_temp.expect_refused('the advisor deletes it', advisor, format('delete from public.advisor_check_ins where id = %L', first));
  perform pg_temp.expect_refused('a classmate deletes it', classmate, format('delete from public.advisor_check_ins where id = %L', first));

  -- ── the advisor's role, and the share's life ─────────────────────────────
  update public.role_grants set revoked_at = now() where subject = advisor and role = 'academic_advisor';
  perform pg_temp.counted('an advisor whose role was revoked cannot write',
    (pg_temp.check_in(advisor, share, 'x', '{}', gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.expect_refused('nor list', advisor, format('select * from public.list_share_check_ins(%L)', share));
  update public.role_grants set revoked_at = null where subject = advisor and role = 'academic_advisor';
  perform pg_temp.counted('with the role restored, the advisor writes again (the control)',
    (pg_temp.check_in(advisor, share, 'Follow-up', '{}', gen_random_uuid()) not like 'ERROR%')::int, 1);
  update public.advisor_shares set created_at = now() - interval '2 days', expires_at = now() - interval '1 minute' where id = theirs;
  perform pg_temp.counted('an expired share takes no check-in',
    (pg_temp.check_in(other_advisor, theirs, 'x', '{}', gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.expect_allowed('the student revokes the share', student,
    format($q$update public.advisor_shares set revoked_at = now() where id = %L$q$, share));
  perform pg_temp.counted('a revoked share takes no check-in',
    (pg_temp.check_in(advisor, share, 'x', '{}', gen_random_uuid()) like 'ERROR%')::int, 1);
  perform pg_temp.counted('but the student still sees what was said', pg_temp.seen(student, 'select * from public.advisor_check_ins'), 2);

  -- ── the student's to delete ──────────────────────────────────────────────
  perform pg_temp.expect_allowed('the student deletes one check-in', student,
    format('delete from public.advisor_check_ins where id = %L', first));
  perform pg_temp.counted('one is left', (select count(*) from public.advisor_check_ins), 1);
  perform pg_temp.expect_allowed('the student deletes the share', student,
    format('delete from public.advisor_shares where id = %L', share));
  perform pg_temp.counted('its check-ins go with it', (select count(*) from public.advisor_check_ins), 0);
end $$;

set local role anon;
do $$
begin
  perform public.record_advisor_check_in(gen_random_uuid(), 'x', '{}', gen_random_uuid());
  raise exception 'FAILED: anon recorded a check-in';
exception when insufficient_privilege then
  raise notice 'ok  anon cannot record a check-in';
end $$;
reset role;

rollback;
