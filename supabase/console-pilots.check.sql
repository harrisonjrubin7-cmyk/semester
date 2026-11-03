-- Console pilot portfolio: who may read it, and what it never returns. LOCAL/DISPOSABLE DATABASE ONLY.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
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
  seller uuid;
  console_only uuid;
  sales_only uuid;
  school_admin uuid;
  student uuid;
  north_account uuid;
  demo_account uuid;
  prospect_account uuid;
  ready_pilot uuid;
  thin_pilot uuid;
  demo_pilot uuid;
  n bigint;
  leaked text;
  problems text[];
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('pilot-north', 'Pilot North', array['pilot-north.example'], false),
    ('pilot-demo', 'Pilot Demo', array['pilot-demo.example'], true);

  seller := pg_temp.newuser('seller@pilot-north.example', 'pilot-north');
  console_only := pg_temp.newuser('console@pilot-north.example', 'pilot-north');
  sales_only := pg_temp.newuser('sales@pilot-north.example', 'pilot-north');
  school_admin := pg_temp.newuser('admin@pilot-north.example', 'pilot-north');
  student := pg_temp.newuser('student@pilot-north.example', 'pilot-north');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (seller, 'platform_admin', 'platform', '', 'platform'),
    (seller, 'account_executive', 'platform', '', 'platform'),
    (console_only, 'platform_admin', 'platform', '', 'platform'),
    (sales_only, 'account_executive', 'platform', '', 'platform'),
    (school_admin, 'platform_admin', 'platform', '', 'platform'),
    (school_admin, 'university_admin', 'school', 'pilot-north', 'platform');

  insert into public.gtm_accounts (name, segment, tenant_id, status)
    values ('Pilot North University', 'research', 'pilot-north', 'pilot') returning id into north_account;
  insert into public.gtm_accounts (name, segment, tenant_id, status)
    values ('Pilot Demo College', 'regional', 'pilot-demo', 'pilot') returning id into demo_account;
  insert into public.gtm_accounts (name, segment, status)
    values ('Prospect State', 'regional', 'engaged') returning id into prospect_account;

  insert into public.gtm_pilots
    (account_id, workflow, cohort, baseline, executive_sponsor, operational_champion,
     start_date, end_date, midpoint_review_date, conversion_date, annual_price_agreed,
     minimum_necessary_data, read_only_first, source_labelled)
  values
    (north_account, 'Advising holds', 'PLANTED_COHORT', 'PLANTED_BASELINE', 'PLANTED_SPONSOR', 'PLANTED_CHAMPION',
     date '2026-09-01', date '2026-09-01' + 182, date '2026-09-01' + 91, date '2026-09-01' + 182, true,
     true, true, true)
  returning id into ready_pilot;
  insert into public.gtm_pilot_metrics (pilot_id, name, target, baseline) values
    (ready_pilot, 'PLANTED_METRIC_A', '10%', '0'),
    (ready_pilot, 'PLANTED_METRIC_B', '10%', '0'),
    (ready_pilot, 'PLANTED_METRIC_C', '10%', '0');

  insert into public.gtm_pilots (account_id, workflow, start_date, end_date)
    values (prospect_account, 'Registration', date '2026-11-01', date '2026-12-01')
  returning id into thin_pilot;
  insert into public.gtm_pilots (account_id, workflow, start_date, end_date)
    values (demo_account, 'Demo workflow', date '2026-11-01', date '2026-11-01' + 182)
  returning id into demo_pilot;

  -- 1. Both duties together read the portfolio; demo schools stay out by default.
  perform pg_temp.become(seller);
  select count(*) into n from public.console_pilots();
  perform pg_temp.counted('seller reads non-demo pilots, prospect without a school included', n, 2);
  select count(*) into n from public.console_pilots(true);
  perform pg_temp.counted('seller sees the demo pilot only when asked', n, 3);

  -- 2. Readiness matches the database guard, row for row.
  select readiness_problems into problems from public.console_pilots() where pilot_id = ready_pilot;
  perform pg_temp.counted('a complete plan reports no readiness problems', cardinality(problems), 0);
  select readiness_problems into problems from public.console_pilots() where pilot_id = thin_pilot;
  if not (problems @> array['duration', 'no_sponsor', 'no_champion', 'metric_count', 'no_price']) then
    raise exception 'FAILED: thin pilot readiness, got %', problems;
  end if;
  raise notice 'ok  thin pilot reports its gaps (%)', array_to_string(problems, ', ');

  -- 3. No planted free text comes back in any column.
  select string_agg(r::text, ' ') into leaked from public.console_pilots(true) r;
  if leaked ~ 'PLANTED_' then
    raise exception 'FAILED: console_pilots returned planted free text: %', substring(leaked from 'PLANTED_[A-Z_]+');
  end if;
  raise notice 'ok  cohort, baseline, names and metric text never returned';
  select count(*) into n from public.console_pilots() where pilot_id = ready_pilot and has_sponsor and has_champion and metric_count = 3;
  perform pg_temp.counted('sponsor and champion arrive as yes/no, metrics as a count', n, 1);
  execute 'reset role';

  -- 4. Every partial holder is refused, not shown an empty list.
  perform pg_temp.counted('console shell without account:manage is refused',
    case when pg_temp.refused(console_only, 'select * from public.console_pilots()') then 1 else 0 end, 1);
  perform pg_temp.counted('account:manage without the console shell is refused',
    case when pg_temp.refused(sales_only, 'select * from public.console_pilots()') then 1 else 0 end, 1);
  perform pg_temp.counted('a school configurer with the console shell is refused',
    case when pg_temp.refused(school_admin, 'select * from public.console_pilots()') then 1 else 0 end, 1);
  perform pg_temp.counted('a student is refused',
    case when pg_temp.refused(student, 'select * from public.console_pilots()') then 1 else 0 end, 1);

  -- 5. Signed-out callers cannot execute it at all.
  select count(*) into n from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'console_pilots' and grantee in ('anon', 'PUBLIC');
  perform pg_temp.counted('anon and PUBLIC hold no execute grant', n, 0);
end $$;

rollback;
