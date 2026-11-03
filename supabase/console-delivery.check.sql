-- Console delivery portfolio: who may read it, and what it never returns. LOCAL/DISPOSABLE DATABASE ONLY.
--
-- Seeds an institution account with an implementation project and milestones,
-- a success plan with QBRs, a renewal and two health snapshots, each free-text
-- field the read must withhold carrying a PLANTED_ marker. Then checks that
-- the two duties together read it, that counts and the latest snapshot are
-- right, that no marker comes back, and that every partial holder is refused.
--
--   How to run it: supabase/check.sh console-delivery

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
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
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
  csm uuid;
  console_only uuid;
  success_only uuid;
  school_admin uuid;
  student uuid;
  north uuid;
  demo uuid;
  person uuid;
  project uuid;
  plan uuid;
  contract uuid;
  n bigint;
  leaked text;
  r record;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('delivery-north', 'Delivery North', array['delivery-north.example'], false),
    ('delivery-demo', 'Delivery Demo', array['delivery-demo.example'], true);

  csm := pg_temp.newuser('csm@delivery-north.example', 'delivery-north');
  console_only := pg_temp.newuser('console@delivery-north.example', 'delivery-north');
  success_only := pg_temp.newuser('success@delivery-north.example', 'delivery-north');
  school_admin := pg_temp.newuser('admin@delivery-north.example', 'delivery-north');
  student := pg_temp.newuser('student@delivery-north.example', 'delivery-north');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (csm, 'platform_admin', 'platform', '', 'platform'),
    (csm, 'customer_success', 'platform', '', 'platform'),
    (console_only, 'platform_admin', 'platform', '', 'platform'),
    (success_only, 'customer_success', 'platform', '', 'platform'),
    (school_admin, 'platform_admin', 'platform', '', 'platform'),
    (school_admin, 'university_admin', 'school', 'delivery-north', 'platform');

  insert into public.billing_accounts (kind, name) values ('institution', 'Delivery North University') returning id into north;
  insert into public.billing_accounts (kind, name) values ('institution', 'Delivery Demo College') returning id into demo;
  insert into public.billing_accounts (kind, user_id, name) values ('individual', student, 'PLANTED_PERSON_ACCOUNT') returning id into person;
  insert into public.billing_account_tenants (billing_account_id, tenant_id) values
    (north, 'delivery-north'), (demo, 'delivery-demo');

  insert into public.implementation_projects (billing_account_id, tenant_id, stage, status, owner_id)
    values (north, 'delivery-north', 'integrate', 'at_risk', csm) returning id into project;
  insert into public.implementation_milestones (project_id, name, owner_role, due_at, done_at) values
    (project, 'Kickoff held', 'csm', current_date - 30, now() - interval '29 days'),
    (project, 'SIS feed live', 'integration', current_date - 3, null),
    (project, 'Admin training', 'csm', current_date + 10, null);

  insert into public.success_plans (billing_account_id, goals, risks, next_qbr_at, owner_id)
    values (north, 'PLANTED_GOALS', 'PLANTED_RISKS', current_date + 45, csm) returning id into plan;
  insert into public.qbrs (success_plan_id, held_on, summary) values
    (plan, current_date - 100, 'PLANTED_QBR_ONE'),
    (plan, current_date - 10, 'PLANTED_QBR_TWO');

  insert into public.contracts (billing_account_id, kind, status) values (north, 'msa', 'draft') returning id into contract;
  insert into public.renewal_opportunities (contract_id, renewal_date, stage, outcome)
    values (contract, current_date + 90, 'exec_90', 'pending');

  insert into public.account_health_snapshots (billing_account_id, status, reason, next_action, action_owner, signals, taken_at) values
    (north, 'healthy', 'An older snapshot that must not be the one shown.', 'Nothing to do', null,
     '{"open_tickets": 4242}', now() - interval '20 days'),
    (north, 'implementation_blocked', 'SIS feed is three days late on the integrate stage.', 'Escalate the feed with the registrar', csm,
     '{"open_tickets": 4243}', now() - interval '1 day');

  -- 1. Both duties together read institution accounts; demo and individual accounts stay out.
  perform pg_temp.become(csm);
  select count(*) into n from public.console_delivery();
  perform pg_temp.counted('the success manager reads one non-demo institution account', n, 1);
  select count(*) into n from public.console_delivery(true);
  perform pg_temp.counted('the demo account appears only when asked', n, 2);
  select count(*) into n from public.console_delivery(true) where billing_account_id = person;
  perform pg_temp.counted('an individual''s billing account never appears', n, 0);

  -- 2. Counts, dates and the latest snapshot come from the records.
  select * into r from public.console_delivery() where billing_account_id = north;
  perform pg_temp.counted('milestones total', (r.projects -> 0 ->> 'milestones_total')::bigint, 3);
  perform pg_temp.counted('milestones done', (r.projects -> 0 ->> 'milestones_done')::bigint, 1);
  perform pg_temp.counted('milestones overdue', (r.projects -> 0 ->> 'milestones_overdue')::bigint, 1);
  if r.projects -> 0 -> 'next_milestone' ->> 'name' <> 'SIS feed live' then
    raise exception 'FAILED: next milestone, got %', r.projects -> 0 -> 'next_milestone';
  end if;
  raise notice 'ok  the next milestone is the earliest open one';
  perform pg_temp.counted('QBRs counted', r.qbr_count, 2);
  perform pg_temp.counted('last QBR is the most recent date', (current_date - r.last_qbr_on)::bigint, 10);
  perform pg_temp.counted('one renewal returned', jsonb_array_length(r.renewals)::bigint, 1);
  if r.health_status <> 'implementation_blocked' or not r.health_has_owner then
    raise exception 'FAILED: latest health snapshot, got % / %', r.health_status, r.health_has_owner;
  end if;
  raise notice 'ok  the latest health snapshot is the one shown';

  -- 3. Withheld text, signals and owner identities never come back.
  select string_agg(x::text, ' ') into leaked from public.console_delivery(true) x;
  if leaked ~ 'PLANTED_' then
    raise exception 'FAILED: console_delivery returned withheld text: %', substring(leaked from 'PLANTED_[A-Z_]+');
  end if;
  raise notice 'ok  plan goals, risks and QBR summaries never returned';
  if leaked ~ '424[23]' then
    raise exception 'FAILED: console_delivery returned health signals';
  end if;
  raise notice 'ok  health signals never returned';
  if position(csm::text in leaked) > 0 then
    raise exception 'FAILED: console_delivery returned an owner id';
  end if;
  raise notice 'ok  owners arrive as assigned or not, never as an id';
  execute 'reset role';

  -- 4. Every partial holder is refused, not shown an empty list.
  perform pg_temp.counted('console shell without success:manage is refused',
    case when pg_temp.refused(console_only, 'select * from public.console_delivery()') then 1 else 0 end, 1);
  perform pg_temp.counted('success:manage without the console shell is refused',
    case when pg_temp.refused(success_only, 'select * from public.console_delivery()') then 1 else 0 end, 1);
  perform pg_temp.counted('a school configurer with the console shell is refused',
    case when pg_temp.refused(school_admin, 'select * from public.console_delivery()') then 1 else 0 end, 1);
  perform pg_temp.counted('a student is refused',
    case when pg_temp.refused(student, 'select * from public.console_delivery()') then 1 else 0 end, 1);

  -- 5. Signed-out callers cannot execute it at all.
  select count(*) into n from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'console_delivery' and grantee in ('anon', 'PUBLIC');
  perform pg_temp.counted('anon and PUBLIC hold no execute grant', n, 0);
end $$;

rollback;
