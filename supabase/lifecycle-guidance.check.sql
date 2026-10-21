-- supabase/lifecycle-guidance.check.sql — the guidance publisher wrapper and the
-- descriptive lifecycle contract registry.
--
-- For 20261024090100_course_guidance_once.sql and
-- 20261024090000_lifecycle_contract_catalog.sql. Builds on the Course Studio
-- fixtures in coursestudio.check.sql. What it proves:
--
--   * a faculty member with a live grant on exactly this course publishes once,
--     and a replay of the same command returns the same version without a second
--     row;
--   * the same command key with changed content is refused, not republished;
--   * a stale expected version is refused and nothing is written;
--   * a wrong school, another course, another school's course, a revoked or
--     expired grant, a student and an anonymous caller are all refused, and a
--     revoked caller cannot replay an earlier receipt;
--   * the receipt table cannot be read or written directly;
--   * the contract registry holds all 26 contracts, readable when signed in and
--     not writable by anybody through the API.
--
-- Not covered here: two concurrent publishers racing on one version. The lock
-- order is asserted by reading the function, not by a race in SQL.
--
--   How to run it: supabase/check.sh lifecycle-guidance

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

-- The SQLSTATE a statement raises as `who`, or null when it ran.
create or replace function pg_temp.state(who uuid, statement text)
returns text language plpgsql as $$
begin
  if who is null then
    execute 'set local role anon';
  else
    perform pg_temp.become(who);
  end if;
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return SQLSTATE;
end $$;

-- The version a publish returns, run as `who`.
create or replace function pg_temp.publish(who uuid, statement text)
returns integer language plpgsql as $$
declare v integer;
begin
  perform pg_temp.become(who);
  execute statement into v;
  execute 'reset role';
  return v;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(what text, who uuid, want text, statement text)
returns void language plpgsql as $$
declare got text := pg_temp.state(who, statement);
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected SQLSTATE %, got %', what, want, coalesce(got, 'allowed');
  end if;
  raise notice 'ok  % is refused (%)', what, got;
end $$;

-- A publish statement with its literals quoted, so a test reads like the call.
create or replace function pg_temp.call(cmd uuid, school text, course text, term text, body text, expected integer)
returns text language sql as $$
  select format('select public.publish_course_guidance_once(%L::uuid, %L, %L, %L, %L, %s)',
                cmd, school, course, term, body, expected);
$$;

do $$
declare
  prof uuid; other_course uuid; elsewhere uuid; lapsed uuid; expired uuid; student uuid;
  first_cmd uuid := gen_random_uuid();
  second_cmd uuid := gen_random_uuid();
  v integer;
  n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('lc-u', 'Lifecycle University', array['lc-u.example']),
    ('lc-other', 'Other University', array['lc-other.example']);

  prof         := pg_temp.newuser('prof@lc-u.example', 'lc-u');
  other_course := pg_temp.newuser('other@lc-u.example', 'lc-u');
  elsewhere    := pg_temp.newuser('prof@lc-other.example', 'lc-other');
  lapsed       := pg_temp.newuser('lapsed@lc-u.example', 'lc-u');
  expired      := pg_temp.newuser('expired@lc-u.example', 'lc-u');
  student      := pg_temp.newuser('student@lc-u.example', 'lc-u');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (prof,         'faculty', 'course', 'lc-u/ECON 1020',     'institution'),
    (other_course, 'faculty', 'course', 'lc-u/HIST 2100',     'institution'),
    (elsewhere,    'faculty', 'course', 'lc-other/ECON 1020', 'institution');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, revoked_at) values
    (lapsed,       'faculty', 'course', 'lc-u/ECON 1020',     'institution', now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, expires_at) values
    (expired,      'faculty', 'course', 'lc-u/ECON 1020',     'institution', now() - interval '1 second');

  -- ── The publish that works, and its replay ──────────────────────────────
  v := pg_temp.publish(prof, pg_temp.call(first_cmd, 'lc-u', 'ECON 1020', '2026FA', 'Do the problem sets first.', 0));
  perform pg_temp.counted('faculty publishes version 1 once', v, 1);

  v := pg_temp.publish(prof, pg_temp.call(first_cmd, 'lc-u', 'ECON 1020', '2026FA', 'Do the problem sets first.', 0));
  perform pg_temp.counted('same command, same payload replays version 1', v, 1);

  select count(*) into n from public.course_guidance
   where tenant_id = 'lc-u' and course_code = 'ECON 1020' and term = '2026FA';
  perform pg_temp.counted('replay wrote no second version', n, 1);

  -- ── Reuse of a key for different content ────────────────────────────────
  perform pg_temp.refused('same command key, changed body', prof, '23514',
    pg_temp.call(first_cmd, 'lc-u', 'ECON 1020', '2026FA', 'A different instruction.', 0));

  -- ── Expected-version conflict writes nothing ────────────────────────────
  perform pg_temp.refused('stale expected version', prof, '40001',
    pg_temp.call(second_cmd, 'lc-u', 'ECON 1020', '2026FA', 'Stale client view.', 0));

  v := pg_temp.publish(prof, pg_temp.call(second_cmd, 'lc-u', 'ECON 1020', '2026FA', 'Second version.', 1));
  perform pg_temp.counted('current expected version publishes version 2', v, 2);

  -- ── Scope: wrong school, other course, other school, lapsed, expired, student, anonymous ──
  perform pg_temp.refused('wrong school in the command', prof, '42501',
    pg_temp.call(gen_random_uuid(), 'lc-other', 'ECON 1020', '2026FA', 'x', 2));
  perform pg_temp.refused('faculty for another course', other_course, '42501',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026FA', 'x', 2));
  perform pg_temp.refused('faculty at another school', elsewhere, '42501',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026FA', 'x', 2));
  perform pg_temp.refused('revoked grant', lapsed, '42501',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026FA', 'x', 2));
  perform pg_temp.refused('expired grant', expired, '42501',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026FA', 'x', 2));
  perform pg_temp.refused('student with no grant', student, '42501',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026FA', 'x', 2));
  perform pg_temp.refused('anonymous caller', null, '42501',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026FA', 'x', 2));

  select count(*) into n from public.course_guidance
   where tenant_id = 'lc-u' and course_code = 'ECON 1020' and term = '2026FA';
  perform pg_temp.counted('refusals wrote nothing (two versions)', n, 2);

  -- ── Malformed commands ──────────────────────────────────────────────────
  perform pg_temp.refused('term outside the pattern', prof, '23514',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026XX', 'x', 2));
  perform pg_temp.refused('body over 4000 characters', prof, '23514',
    pg_temp.call(gen_random_uuid(), 'lc-u', 'ECON 1020', '2026FA', repeat('a', 4001), 2));

  -- ── The receipt table is not readable or writable through the API ───────
  perform pg_temp.refused('direct receipt read', prof, '42501',
    'select 1 from private.course_guidance_command_receipt');
  perform pg_temp.refused('direct receipt write', prof, '42501',
    format('insert into private.course_guidance_command_receipt
              (actor_id, command_id, school_id, request_digest, published_version)
            values (%L, gen_random_uuid(), %L, %L, 9)',
           prof, 'lc-u', repeat('0', 64)));

  -- ── A revoked caller cannot replay an earlier receipt ───────────────────
  update public.role_grants set revoked_at = now()
   where subject = prof and scope_id = 'lc-u/ECON 1020';
  perform pg_temp.refused('revoked caller replays a receipt', prof, '42501',
    pg_temp.call(first_cmd, 'lc-u', 'ECON 1020', '2026FA', 'Do the problem sets first.', 0));

  -- ── Contract registry: complete, readable when signed in, not writable ──
  select count(*) into n from public.lifecycle_permission_contract;
  perform pg_temp.counted('all 26 contracts are registered', n, 26);

  perform pg_temp.become(prof);
  select count(*) into n from public.lifecycle_permission_contract;
  execute 'reset role';
  perform pg_temp.counted('signed-in caller reads the registry', n, 26);
  perform pg_temp.refused('anonymous read of the registry', null, '42501',
    'select 1 from public.lifecycle_permission_contract');
  perform pg_temp.refused('registry write by a signed-in caller', prof, '42501',
    $q$insert into public.lifecycle_permission_contract
         (id, phase, view_name, function_name, actor_labels, resource_scope, gate_kind,
          authority_boundary, enforcement_reference, database_duty)
       values ('LM-999', 'x', 'x', 'x', 'x', 'x', 'owner', 'x', 'x', 'x')$q$);
end $$;

rollback;
