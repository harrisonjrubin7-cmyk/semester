-- What an imported fact may say, and who may take a student's away.
-- LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
--   supabase/check.sh canonical-display

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
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, replace(split_part(address, '@', 1), '.', '_'), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.affected(who uuid, statement text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  execute 'reset role';
  return n;
exception when others then
  execute 'reset role';
  return -1;
end $$;

create or replace function pg_temp.expect_rejected(what text, statement text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    raise notice 'ok  % is rejected (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % — was accepted', what;
end $$;

do $$
declare student uuid; mate uuid; integ uuid; uadmin uuid; n bigint;
begin
  insert into public.schools (id, name, email_domains) values ('cd-u', 'Display University', array['cd-u.example']);
  student := pg_temp.newuser('student@cd-u.example', 'cd-u');
  mate    := pg_temp.newuser('mate@cd-u.example', 'cd-u');
  integ   := pg_temp.newuser('integ@cd-u.example', 'cd-u');
  uadmin  := pg_temp.newuser('admin@cd-u.example', 'cd-u');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (integ, 'integration_admin', 'school', 'cd-u', 'institution'),
    (uadmin, 'university_admin', 'school', 'cd-u', 'institution');

  insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id, subject_user_id,
    source_system, source_record_id, source_of_truth, classification, freshness_status, display)
  values
    ('cd-u', 'registration_hold', 'h1', student, 'SIS', 'x1', 'Registrar / SIS', 'T3', 'recent',
     '{"office":"Student Accounts","blocks_registration":true,"action_url":"https://accounts.example.edu/holds"}'),
    ('cd-u', 'registration_window', 'w1', null, 'SIS', 'x2', 'Registrar / SIS', 'T0', 'live',
     '{"audience":"Juniors","opens_at":"2026-11-02T13:00:00Z"}');

  -- What display may hold ------------------------------------------------------

  perform pg_temp.expect_rejected('a hold carrying its reason',
    $q$update public.canonical_entity_references set display = display || '{"reason":"Balance past due"}' where canonical_entity_id = 'h1'$q$);
  perform pg_temp.expect_rejected('an amount',
    $q$update public.canonical_entity_references set display = '{"amount_due":1250}' where canonical_entity_id = 'h1'$q$);
  perform pg_temp.expect_rejected('an advisor''s notes',
    $q$update public.canonical_entity_references set display = '{"notes":"Worried about workload"}' where canonical_entity_id = 'h1'$q$);
  perform pg_temp.expect_rejected('a grade',
    $q$update public.canonical_entity_references set display = '{"final_grade":"A-"}' where canonical_entity_id = 'h1'$q$);
  perform pg_temp.expect_rejected('a nested object',
    $q$update public.canonical_entity_references set display = '{"meta":{"x":1}}' where canonical_entity_id = 'w1'$q$);
  perform pg_temp.expect_rejected('an array',
    $q$update public.canonical_entity_references set display = '{"students":["a","b"]}' where canonical_entity_id = 'w1'$q$);
  perform pg_temp.expect_rejected('more than 4 KB',
    format($q$update public.canonical_entity_references set display = jsonb_build_object('note', %L) where canonical_entity_id = 'w1'$q$, repeat('x', 5000)));
  -- The control: an ordinary key that merely contains a listed word is fine.
  update public.canonical_entity_references set display = display || '{"office_hours_note":"Mon 9-5"}' where canonical_entity_id = 'w1';
  raise notice 'ok  an ordinary key is accepted (the control)';

  -- Who reads and who deletes -----------------------------------------------

  perform pg_temp.become(student);
  select count(*) into n from public.canonical_entity_references where display ? 'office';
  reset role;
  perform pg_temp.counted('the student reads their hold summary', n, 1);
  perform pg_temp.become(mate);
  select count(*) into n from public.canonical_entity_references where display ? 'office';
  reset role;
  perform pg_temp.counted('a classmate reads it', n, 0);

  perform pg_temp.counted('a classmate deleting it',
    pg_temp.affected(mate, $q$delete from public.canonical_entity_references where canonical_entity_id = 'h1'$q$), 0);
  perform pg_temp.counted('the integration admin deleting it',
    pg_temp.affected(integ, $q$delete from public.canonical_entity_references where canonical_entity_id = 'h1'$q$), 0);
  perform pg_temp.counted('the university admin deleting it',
    pg_temp.affected(uadmin, $q$delete from public.canonical_entity_references where canonical_entity_id = 'h1'$q$), 0);
  perform pg_temp.counted('the student deleting the school''s window',
    pg_temp.affected(student, $q$delete from public.canonical_entity_references where canonical_entity_id = 'w1'$q$), 0);
  perform pg_temp.counted('the student deleting their own hold',
    pg_temp.affected(student, $q$delete from public.canonical_entity_references where canonical_entity_id = 'h1'$q$), 1);
  perform pg_temp.counted('and the student still cannot write one',
    pg_temp.affected(student, $q$insert into public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id,
      subject_user_id, source_system, source_record_id, source_of_truth, classification)
      values ('cd-u', 'enrollment', 'e9', auth.uid(), 'SIS', 'x9', 'Registrar', 'T3')$q$), -1);
end $$;

rollback;
