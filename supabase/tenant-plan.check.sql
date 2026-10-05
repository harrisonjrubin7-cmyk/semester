-- The plan a school is on (tenant_plan) and its history.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold: only the service role writes a plan, so a school's own
-- administrator cannot grant or extend one; an administrator reads their own
-- school's plan and nobody else's; every change is kept and the record cannot
-- be rewritten; and the launch's facts function reports the plan, or null
-- when none is recorded.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.answered(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

do $$
declare
  north_admin uuid;
  south_admin uuid;
  n bigint;
  r record;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-plan', 'North Plan University', array['north-plan.example']),
    ('south-plan', 'South Plan College', array['south-plan.example']);
  north_admin := pg_temp.newuser('admin@north-plan.example', 'north-plan');
  south_admin := pg_temp.newuser('admin@south-plan.example', 'south-plan');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (north_admin, 'university_admin', 'school', 'north-plan', 'institution'),
    (south_admin, 'university_admin', 'school', 'south-plan', 'institution');

  -- The control: the service role records a plan, and it is kept.
  set local role service_role;
  insert into public.tenant_plan (tenant_id, tier, status, ends_at, reason)
  values ('north-plan', 'campus', 'active', now() + interval '1 year', 'signed');
  reset role;
  select count(*) into n from public.tenant_plan_history where tenant_id = 'north-plan';
  perform pg_temp.counted('the service role records a plan, and the change is kept', n, 1);

  -- A school administrator cannot grant or extend their own plan.
  perform pg_temp.become(north_admin);
  if not pg_temp.refused($q$update public.tenant_plan set ends_at = now() + interval '10 years' where tenant_id = 'north-plan'$q$) then
    raise exception 'FAILED: a school administrator extended their own plan';
  end if;
  if not pg_temp.refused($q$insert into public.tenant_plan (tenant_id, tier, status) values ('south-plan', 'system', 'active')$q$) then
    raise exception 'FAILED: a school administrator wrote a plan';
  end if;
  reset role;
  raise notice 'ok  a school administrator cannot write a plan';

  -- Reads stay inside the administrator's own school.
  perform pg_temp.become(north_admin);
  select count(*) into n from public.tenant_plan where tenant_id = 'north-plan';
  reset role;
  perform pg_temp.counted('an administrator reads their own school''s plan', n, 1);

  perform pg_temp.become(south_admin);
  select count(*) into n from public.tenant_plan where tenant_id = 'north-plan';
  reset role;
  perform pg_temp.counted('another school''s administrator reads none of it', n, 0);

  -- History is immutable, even to the owner of the table.
  if not pg_temp.refused($q$update public.tenant_plan_history set status = 'ended' where tenant_id = 'north-plan'$q$) then
    raise exception 'FAILED: plan history was rewritten';
  end if;
  raise notice 'ok  plan history cannot be rewritten';

  -- A pilot must end; a plan cannot end before it starts.
  set local role service_role;
  if not pg_temp.refused($q$insert into public.tenant_plan (tenant_id, tier, status) values ('south-plan', 'pilot', 'trial')$q$) then
    raise exception 'FAILED: an open-ended pilot was accepted';
  end if;
  if not pg_temp.refused($q$insert into public.tenant_plan (tenant_id, tier, status, starts_at, ends_at) values ('south-plan', 'campus', 'active', now(), now() - interval '1 day')$q$) then
    raise exception 'FAILED: a plan ending before it starts was accepted';
  end if;
  reset role;
  raise notice 'ok  a pilot must end, and a plan cannot end before it starts';

  -- The launch's facts report the plan, and null when none is recorded.
  select * into r from public.lti_launch_entitlement_facts('north-plan', 'https://lms.test.edu', 'sub-none');
  perform pg_temp.answered('the facts report the recorded plan status', r.plan_status, 'active');
  perform pg_temp.answered('and its end date', (r.plan_ends_at is not null)::text, 'true');
  select * into r from public.lti_launch_entitlement_facts('south-plan', 'https://lms.test.edu', 'sub-none');
  perform pg_temp.answered('no plan recorded reads as null, not as ended', coalesce(r.plan_status, 'null'), 'null');

  set local role service_role;
  update public.tenant_plan set status = 'suspended', reason = 'unpaid' where tenant_id = 'north-plan';
  reset role;
  select * into r from public.lti_launch_entitlement_facts('north-plan', 'https://lms.test.edu', 'sub-none');
  perform pg_temp.answered('a suspension is read at once', r.plan_status, 'suspended');
  select count(*) into n from public.tenant_plan_history where tenant_id = 'north-plan';
  perform pg_temp.counted('and kept as a second history row', n, 2);

  if has_function_privilege('anon', 'public.lti_launch_entitlement_facts(text, text, text)', 'execute')
     or has_function_privilege('authenticated', 'public.lti_launch_entitlement_facts(text, text, text)', 'execute') then
    raise exception 'FAILED: the entitlement facts are callable from the API';
  end if;
  raise notice 'ok  the entitlement facts are callable by the service role only';

  raise notice 'tenant plan: every check passed';
end $$;

rollback;
