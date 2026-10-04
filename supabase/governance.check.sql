-- Governance registries: every rule 20260927235000_governance_registries.sql
-- claims, walked as the account it is about, and every refusal attempted as
-- the account that should be refused. Each refusal has an allowed neighbour,
-- so a check that passes because *everything* is refused cannot pass here.
-- LOCAL/DISPOSABLE DATABASES ONLY; always rolled back.
--
--   supabase/check.sh governance

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- The owner, with no signed-in caller: what a server-side job looks like.
create or replace function pg_temp.as_server()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
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

-- Runs the statement as `who`; true when it errored or touched no row.
create or replace function pg_temp.refused(who uuid, statement text, out refused boolean, out why text)
language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute statement;
  get diagnostics n = row_count;
  perform pg_temp.as_server();
  refused := n = 0; why := 'no row';
exception when others then
  perform pg_temp.as_server();
  refused := true; why := sqlerrm;
end $$;

create or replace function pg_temp.expect_refused(what text, who uuid, statement text)
returns void language plpgsql as $$
declare r record;
begin
  r := pg_temp.refused(who, statement);
  if not r.refused then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, r.why;
end $$;

create or replace function pg_temp.expect_allowed(what text, who uuid, statement text)
returns void language plpgsql as $$
declare r record;
begin
  r := pg_temp.refused(who, statement);
  if r.refused then raise exception 'FAILED: % — was refused (%)', what, r.why; end if;
  raise notice 'ok  % is allowed', what;
end $$;

-- A statement the database itself (not RLS) must reject, run server-side.
create or replace function pg_temp.expect_rejected(what text, statement text)
returns void language plpgsql as $$
begin
  perform pg_temp.as_server();
  begin
    execute statement;
  exception when others then
    raise notice 'ok  % is rejected (%)', what, sqlerrm;
    return;
  end;
  raise exception 'FAILED: % — was accepted', what;
end $$;

create or replace function pg_temp.expect_accepted(what text, statement text)
returns void language plpgsql as $$
begin
  perform pg_temp.as_server();
  execute statement;
  raise notice 'ok  % is accepted', what;
exception when others then
  raise exception 'FAILED: % — was rejected (%)', what, sqlerrm;
end $$;

create or replace function pg_temp.seen(who uuid, q text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform pg_temp.become(who);
  execute 'select count(*) from (' || q || ') t' into n;
  perform pg_temp.as_server();
  return n;
end $$;

-- The seven sections, filled, for the notices below.
create or replace function pg_temp.sections(extra jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'what_happened',          'Semester could not load Today between 09:10 and 09:40 CT.',
    'who_is_affected',        'Students at the pilot school using the web app.',
    'what_is_impacted',       'Today and Plan did not load. No data was lost or exposed.',
    'what_to_do_now',         'Check deadlines in Brightspace until the next update.',
    'what_semester_is_doing', 'We rolled back the 09:05 release and are watching error rates.',
    'next_update',            'By 10:30 CT.',
    'where_to_get_help',      'help@semester.example or the campus help desk.') || extra;
$$;

-- ── Every new table has RLS on, and no policy is simply true ──────────────

do $$
declare n bigint;
begin
  select count(*) into n
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
     and c.relname like 'governance\_%';
  perform pg_temp.counted('governance tables without row-level security', n, 0);
  select count(*) into n
    from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and c.relname like 'governance\_%';
  perform pg_temp.counted('and there are five of them', n, 5);
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename like 'governance\_%'
     and (qual = 'true' or with_check = 'true');
  perform pg_temp.counted('governance policies that are USING (true)', n, 0);
end $$;

-- ── The walk ──────────────────────────────────────────────────────────────

do $$
declare
  platform uuid; council uuid; responder uuid;
  admin_a uuid; admin_b uuid; impl_a uuid; student_a uuid; student_b uuid;
  sys uuid; campus_a uuid; campus_b uuid; school_a uuid; req uuid; dec uuid; steward uuid;
  n bigint; r text; t int;
begin
  insert into public.schools (id, name, email_domains) values
    ('gv-a', 'Governance University',    array['gv-a.example']),
    ('gv-b', 'Other Governance College', array['gv-b.example']);

  platform  := pg_temp.newuser('platform@semester.example', null);
  council   := pg_temp.newuser('council@semester.example',  null);
  responder := pg_temp.newuser('oncall@semester.example',   null);
  admin_a   := pg_temp.newuser('admin@gv-a.example',   'gv-a');
  admin_b   := pg_temp.newuser('admin@gv-b.example',   'gv-b');
  impl_a    := pg_temp.newuser('impl@gv-a.example',    'gv-a');
  student_a := pg_temp.newuser('student@gv-a.example', 'gv-a');
  student_b := pg_temp.newuser('student@gv-b.example', 'gv-b');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (platform,  'platform_admin',         'platform', '',     'platform'),
    (council,   'portfolio_council',      'platform', '',     'platform'),
    (responder, 'incident_responder',     'platform', '',     'platform'),
    (admin_a,   'university_admin',       'school',   'gv-a', 'institution'),
    (admin_b,   'university_admin',       'school',   'gv-b', 'institution'),
    (impl_a,    'implementation_manager', 'school',   'gv-a', 'institution');

  -- ── 1. Policy hierarchy ────────────────────────────────────────────────

  perform pg_temp.expect_refused('a university admin founding a system', admin_a,
    $q$insert into public.governance_policy_nodes (system_id, level, name) values ('state-sys', 'system', 'State System')$q$);
  perform pg_temp.expect_allowed('the platform founding a system', platform,
    $q$insert into public.governance_policy_nodes (system_id, level, name, features, retention_days, brand)
       values ('state-sys', 'system', 'State System',
               '{"module.integration_dashboard": "production", "ops.external_ai_generation": "preview"}', 365,
               '{"name": "State System", "accent": "#003366"}')$q$);
  select id into sys from public.governance_policy_nodes where system_id = 'state-sys' and level = 'system';

  perform pg_temp.expect_refused('a university admin attaching their own campus to a system', admin_a,
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name)
              values ('state-sys', 'campus', %L, 'gv-a', 'North Campus')$q$, sys));
  perform pg_temp.expect_allowed('the platform attaching the campus', platform,
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name, brand)
              values ('state-sys', 'campus', %L, 'gv-a', 'North Campus', '{"name": "North Campus"}')$q$, sys));
  select id into campus_a from public.governance_policy_nodes where tenant_id = 'gv-a' and level = 'campus';
  perform pg_temp.expect_accepted('a second campus, for a second school',
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name)
              values ('state-sys', 'campus', %L, 'gv-b', 'South Campus')$q$, sys));
  select id into campus_b from public.governance_policy_nodes where tenant_id = 'gv-b' and level = 'campus';

  perform pg_temp.expect_allowed('a university admin adding a school under their campus', admin_a,
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name, ai_allowed, retention_days)
              values ('state-sys', 'school', %L, 'gv-a', 'Law School', false, 180)$q$, campus_a));
  select id into school_a from public.governance_policy_nodes where tenant_id = 'gv-a' and level = 'school';
  perform pg_temp.expect_refused('a university admin adding a node for another school', admin_a,
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name)
              values ('state-sys', 'school', %L, 'gv-b', 'Their School')$q$, campus_b));
  perform pg_temp.expect_refused('a university admin changing another school''s campus', admin_a,
    format($q$update public.governance_policy_nodes set name = 'Mine now' where id = %L$q$, campus_b));

  perform pg_temp.expect_rejected('a campus under a school (levels only go down)',
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name)
              values ('state-sys', 'campus', %L, 'gv-a', 'Upside down')$q$, school_a));
  perform pg_temp.expect_accepted('a program under a school',
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name)
              values ('state-sys', 'program', %L, 'gv-a', 'JD')$q$, school_a));
  perform pg_temp.expect_rejected('a node naming a parent in another system',
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name)
              values ('other-sys', 'school', %L, 'gv-a', 'Stray')$q$, campus_a));
  perform pg_temp.expect_rejected('a node below a campus belonging to another school',
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name)
              values ('state-sys', 'school', %L, 'gv-b', 'Borrowed')$q$, campus_a));
  perform pg_temp.expect_rejected('a second root for the same system',
    $q$insert into public.governance_policy_nodes (system_id, level, name) values ('state-sys', 'system', 'Again')$q$);
  perform pg_temp.expect_rejected('a system node that belongs to a school',
    $q$insert into public.governance_policy_nodes (system_id, level, tenant_id, name) values ('x-sys', 'system', 'gv-a', 'X')$q$);

  perform pg_temp.expect_rejected('a class route opened past the platform floor (T3 → consumer AI)',
    format($q$update public.governance_policy_nodes set class_routes = '{"T3": {"consumer_ai": true}}' where id = %L$q$, school_a));
  perform pg_temp.expect_accepted('the same route closed',
    format($q$update public.governance_policy_nodes set class_routes = '{"T3": {"consumer_ai": false, "community": false}}' where id = %L$q$, school_a));
  perform pg_temp.expect_rejected('a feature state that is not a state',
    format($q$update public.governance_policy_nodes set features = '{"module.integration_dashboard": "on"}' where id = %L$q$, school_a));
  perform pg_temp.expect_rejected('a feature key that is not a flag key',
    format($q$update public.governance_policy_nodes set features = '{"nope": "off"}' where id = %L$q$, school_a));
  perform pg_temp.expect_accepted('a real flag narrowed',
    format($q$update public.governance_policy_nodes set features = '{"ops.external_ai_generation": "off"}' where id = %L$q$, school_a));
  perform pg_temp.expect_rejected('brand carrying CSS',
    format($q$update public.governance_policy_nodes set brand = '{"css": "body{}"}' where id = %L$q$, school_a));
  perform pg_temp.expect_rejected('a node changing level after the fact',
    format($q$update public.governance_policy_nodes set level = 'program' where id = %L$q$, school_a));

  -- Reads: a school's own nodes, and the system it belongs to — nobody else's.
  perform pg_temp.counted('a student reads their school''s nodes and its system',
    pg_temp.seen(student_a, 'select 1 from public.governance_policy_nodes'), 4);
  perform pg_temp.counted('and not the other school''s campus',
    pg_temp.seen(student_a, 'select 1 from public.governance_policy_nodes where tenant_id = ''gv-b'''), 0);
  perform pg_temp.counted('the other school reads its campus and the system',
    pg_temp.seen(student_b, 'select 1 from public.governance_policy_nodes'), 2);

  -- 20260927235500_governance_review_fixes.sql
  perform pg_temp.expect_refused('a school admin attributing a node to someone else', admin_a,
    format($q$insert into public.governance_policy_nodes (system_id, level, parent_id, tenant_id, name, created_by)
              values ('state-sys', 'program', %L, 'gv-a', 'Forged', %L)$q$, school_a, platform));
  perform pg_temp.expect_refused('a school admin rewriting who created a node', admin_a,
    format($q$update public.governance_policy_nodes set created_by = %L where id = %L$q$, platform, school_a));
  -- gv-b's campus has no children, so only the guard can stop this delete.
  -- (gv-a's campus would be refused by its own school's foreign key, and a
  -- check that passes on that is not a check of the guard.)
  perform pg_temp.expect_allowed('a school admin editing their own attached campus (Codex, #828)', admin_a,
    format($q$update public.governance_policy_nodes set brand = '{"name": "North Campus", "accent": "#224466"}' where id = %L$q$, campus_a));
  perform pg_temp.expect_refused('a school admin detaching their campus from the system', admin_b,
    format($q$delete from public.governance_policy_nodes where id = %L$q$, campus_b));
  perform pg_temp.expect_allowed('the platform detaching it', platform,
    format($q$delete from public.governance_policy_nodes where id = %L$q$, campus_b));
  perform pg_temp.expect_allowed('a school admin removing their own program', admin_a,
    $q$delete from public.governance_policy_nodes where tenant_id = 'gv-a' and level = 'program'$q$);

  -- ── 2. Steward assignments ─────────────────────────────────────────────

  perform pg_temp.expect_allowed('a university admin naming the data owner', admin_a,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.sis_read', 'data_owner', 'Dana Whitfield')$q$);
  select id into steward from public.governance_steward_assignments where tenant_id = 'gv-a';
  perform pg_temp.expect_refused('an inbox as the owner', admin_a,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.sis_read', 'data_steward', 'registrar@gv-a.example')$q$);
  perform pg_temp.expect_refused('a placeholder as the owner', admin_a,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.sis_read', 'data_steward', 'TBD')$q$);
  perform pg_temp.expect_refused('a second live holder of the same role', admin_a,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.sis_read', 'data_owner', 'Someone Else')$q$);
  perform pg_temp.expect_refused('a connector that is not registered', admin_a,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.anything', 'data_owner', 'Dana Whitfield')$q$);
  perform pg_temp.expect_refused('another school''s admin naming gv-a''s steward', admin_b,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.sis_read', 'data_steward', 'Pat Morgan')$q$);
  perform pg_temp.expect_refused('a student naming a steward', student_a,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.sis_read', 'data_steward', 'Pat Morgan')$q$);
  perform pg_temp.expect_refused('editing a steward into someone else', admin_a,
    format($q$update public.governance_steward_assignments set person_name = 'Other Person' where id = %L$q$, steward));
  perform pg_temp.expect_refused('revoking with a date in the future', admin_a,
    format($q$update public.governance_steward_assignments set revoked_at = now() + interval '30 days' where id = %L$q$, steward));

  perform pg_temp.counted('the school''s admin reads its stewards',
    pg_temp.seen(admin_a, 'select 1 from public.governance_steward_assignments'), 1);
  perform pg_temp.counted('another school''s admin reads none',
    pg_temp.seen(admin_b, 'select 1 from public.governance_steward_assignments'), 0);
  perform pg_temp.counted('a student reads none',
    pg_temp.seen(student_a, 'select 1 from public.governance_steward_assignments'), 0);

  perform pg_temp.expect_allowed('revoking the assignment', admin_a,
    format($q$update public.governance_steward_assignments set revoked_at = now() where id = %L$q$, steward));
  perform pg_temp.expect_allowed('and naming a successor', admin_a,
    $q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name)
       values ('gv-a', 'integration.sis_read', 'data_owner', 'Robin Castillo')$q$);
  perform pg_temp.expect_refused('deleting the history', admin_a,
    'delete from public.governance_steward_assignments');
  perform pg_temp.expect_refused('linking a steward to another school''s account', admin_a,
    format($q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name, person_account)
              values ('gv-a', 'integration.sis_read', 'data_steward', 'Pat Morgan', %L)$q$, student_b));
  perform pg_temp.expect_allowed('linking a steward to an account at the school', admin_a,
    format($q$insert into public.governance_steward_assignments (tenant_id, connector, steward_role, person_name, person_account)
              values ('gv-a', 'integration.sis_read', 'data_steward', 'Pat Morgan', %L)$q$, student_a));

  -- ── 3. Decisions ───────────────────────────────────────────────────────

  perform pg_temp.expect_allowed('the council recording a decision', council,
    $q$insert into public.governance_decisions (subject, summary, scores, decision, rationale, review_at)
       values ('module.integration_dashboard', 'Integration Dashboard',
               '{"reusability":3,"security":3,"privacy":3,"accessibility":3,"integration":3,"operations":3,
                 "cost":3,"configuration":3,"auditability":3,"rollback":3,"adoption":3}',
               'build', 'Reusable and reversible.', current_date + 80)$q$);
  select total, route into t, r from public.governance_decisions where subject = 'module.integration_dashboard';
  perform pg_temp.counted('its total is computed', t, 33);
  if r <> 'core' then raise exception 'FAILED: 33 routed %, not core', r; end if;
  raise notice 'ok  and it routes to core';

  perform pg_temp.expect_refused('build on a card with a zero, however high', council,
    $q$insert into public.governance_decisions (subject, summary, scores, decision, rationale, review_at)
       values ('fork', 'A fork', '{"reusability":3,"security":3,"privacy":3,"accessibility":3,"integration":3,
               "operations":3,"cost":3,"configuration":3,"auditability":3,"rollback":0,"adoption":3}',
               'build', 'Enthusiasm.', current_date + 80)$q$);
  perform pg_temp.expect_allowed('decline on the same card', council,
    $q$insert into public.governance_decisions (subject, summary, scores, decision, rationale, review_at)
       values ('fork', 'A fork', '{"reusability":3,"security":3,"privacy":3,"accessibility":3,"integration":3,
               "operations":3,"cost":3,"configuration":3,"auditability":3,"rollback":0,"adoption":3}',
               'decline', 'Irreversible.', current_date + 80)$q$);
  select route into r from public.governance_decisions where subject = 'fork';
  if r <> 'reject_or_redesign' then raise exception 'FAILED: a card with a zero routed %', r; end if;
  raise notice 'ok  and a zero routes to reject_or_redesign';

  perform pg_temp.expect_allowed('build on a pilot-route card (20)', council,
    $q$insert into public.governance_decisions (tenant_id, subject, summary, scores, decision, rationale, review_at)
       values ('gv-a', 'custom-report', 'A report gv-a asked for',
               '{"reusability":1,"security":2,"privacy":2,"accessibility":2,"integration":2,"operations":2,
                 "cost":1,"configuration":2,"auditability":2,"rollback":2,"adoption":2}',
               'build', 'Pilot behind a flag.', current_date + 80)$q$);
  select route into r from public.governance_decisions where subject = 'custom-report';
  if r <> 'pilot' then raise exception 'FAILED: 20 routed %', r; end if;
  raise notice 'ok  20 routes to pilot';
  perform pg_temp.expect_refused('build at 14', council,
    $q$insert into public.governance_decisions (subject, summary, scores, decision, rationale, review_at)
       values ('thin', 'Thin', '{"reusability":1,"security":1,"privacy":1,"accessibility":1,"integration":1,
               "operations":2,"cost":2,"configuration":1,"auditability":1,"rollback":2,"adoption":1}',
               'build', 'No.', current_date + 80)$q$);

  perform pg_temp.expect_refused('an incomplete card', council,
    $q$insert into public.governance_decisions (subject, summary, scores, decision, rationale, review_at)
       values ('blank', 'Blank', '{"reusability":3}', 'defer', 'Unscored.', current_date + 80)$q$);
  perform pg_temp.expect_refused('a score of 4', council,
    $q$insert into public.governance_decisions (subject, summary, scores, decision, rationale, review_at)
       values ('four', 'Four', '{"reusability":4,"security":3,"privacy":3,"accessibility":3,"integration":3,
               "operations":3,"cost":3,"configuration":3,"auditability":3,"rollback":3,"adoption":3}',
               'defer', 'x', current_date + 80)$q$);
  perform pg_temp.expect_refused('a review date already past', council,
    $q$insert into public.governance_decisions (subject, summary, scores, decision, rationale, review_at)
       values ('late', 'Late', '{"reusability":3,"security":3,"privacy":3,"accessibility":3,"integration":3,
               "operations":3,"cost":3,"configuration":3,"auditability":3,"rollback":3,"adoption":3}',
               'build', 'x', current_date - 1)$q$);
  perform pg_temp.expect_refused('a client supplying its own route', council,
    $q$insert into public.governance_decisions (subject, summary, scores, route, decision, rationale, review_at)
       values ('cheat', 'Cheat', '{"reusability":0,"security":0,"privacy":0,"accessibility":0,"integration":0,
               "operations":0,"cost":0,"configuration":0,"auditability":0,"rollback":0,"adoption":0}',
               'core', 'build', 'x', current_date + 80)$q$);
  perform pg_temp.expect_refused('a university admin recording a decision', admin_a,
    $q$insert into public.governance_decisions (tenant_id, subject, summary, scores, decision, rationale, review_at)
       values ('gv-a', 'mine', 'Mine', '{"reusability":3,"security":3,"privacy":3,"accessibility":3,"integration":3,
               "operations":3,"cost":3,"configuration":3,"auditability":3,"rollback":3,"adoption":3}',
               'build', 'x', current_date + 80)$q$);
  perform pg_temp.expect_refused('the council rewriting a decision', council,
    $q$update public.governance_decisions set decision = 'decline'$q$);
  perform pg_temp.expect_refused('the council deleting one', council,
    'delete from public.governance_decisions');

  perform pg_temp.counted('a school reads the decision on its own request',
    pg_temp.seen(admin_a, 'select 1 from public.governance_decisions'), 1);
  perform pg_temp.counted('another school reads none',
    pg_temp.seen(admin_b, 'select 1 from public.governance_decisions'), 0);
  perform pg_temp.counted('the council reads all three',
    pg_temp.seen(council, 'select 1 from public.governance_decisions'), 3);

  -- ── 4. Configuration requests ──────────────────────────────────────────

  perform pg_temp.expect_allowed('a university admin requesting a logo change', admin_a,
    $q$insert into public.governance_config_requests (tenant_id, setting_key, tier, requested_value, reason)
       values ('gv-a', 'brand.logo', 1, '{"url": "https://gv-a.example/logo.svg"}', 'New mark.')$q$);
  select id into req from public.governance_config_requests where tenant_id = 'gv-a';
  perform pg_temp.expect_refused('the same setting at the wrong tier', admin_a,
    $q$insert into public.governance_config_requests (tenant_id, setting_key, tier, requested_value, reason)
       values ('gv-a', 'brand.logo', 3, '{}', 'x')$q$);
  perform pg_temp.expect_refused('a never-permitted request (tenant script)', admin_a,
    $q$insert into public.governance_config_requests (tenant_id, setting_key, tier, requested_value, reason)
       values ('gv-a', 'tenant_script', 5, '{}', 'x')$q$);
  perform pg_temp.expect_refused('another school requesting for gv-a', admin_b,
    $q$insert into public.governance_config_requests (tenant_id, setting_key, tier, requested_value, reason)
       values ('gv-a', 'brand.logo', 1, '{}', 'x')$q$);
  perform pg_temp.expect_refused('the requesting admin approving their own request', admin_a,
    format($q$update public.governance_config_requests set status = 'approved' where id = %L$q$, req));
  perform pg_temp.expect_refused('an implementer launching with only the request recorded', impl_a,
    format($q$update public.governance_config_requests set status = 'launched' where id = %L$q$, req));
  perform pg_temp.expect_refused('recording the launch step before the reviews', impl_a,
    format($q$update public.governance_config_requests
                 set steps_done = array['request', 'launch_with_monitoring'] where id = %L$q$, req));
  perform pg_temp.expect_allowed('an implementer recording the review steps and approving', impl_a,
    format($q$update public.governance_config_requests
                 set steps_done = array['request', 'classify_tier', 'security_privacy_accessibility_review',
                                        'governance_score', 'approve_configure_flag'],
                     status = 'approved' where id = %L$q$, req));
  perform pg_temp.expect_refused('removing a recorded step', impl_a,
    format($q$update public.governance_config_requests set steps_done = array['request'] where id = %L$q$, req));
  perform pg_temp.expect_refused('changing what was requested', impl_a,
    format($q$update public.governance_config_requests set requested_value = '{"url": "evil"}' where id = %L$q$, req));
  perform pg_temp.expect_allowed('launching once sandbox and UAT are recorded', impl_a,
    format($q$update public.governance_config_requests
                 set steps_done = steps_done || array['tenant_sandbox_test', 'uat', 'launch_with_monitoring'],
                     status = 'launched' where id = %L$q$, req));
  perform pg_temp.expect_refused('moving a launched request back to requested', impl_a,
    format($q$update public.governance_config_requests set status = 'requested' where id = %L$q$, req));
  perform pg_temp.expect_refused('sunsetting without recording the review (Codex, #828)', impl_a,
    format($q$update public.governance_config_requests set status = 'sunset' where id = %L$q$, req));
  perform pg_temp.expect_allowed('sunsetting once the review is recorded', impl_a,
    format($q$update public.governance_config_requests
                 set steps_done = steps_done || array['review_sunset_or_scale'], status = 'sunset' where id = %L$q$, req));
  perform pg_temp.counted('the school reads its request',
    pg_temp.seen(admin_a, 'select 1 from public.governance_config_requests'), 1);
  perform pg_temp.counted('another school does not',
    pg_temp.seen(admin_b, 'select 1 from public.governance_config_requests'), 0);

  -- ── 5. Incident notices ────────────────────────────────────────────────

  perform pg_temp.expect_allowed('a responder recording a complete admin notice', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-1', 'admin_outage', %L, array['Incident commander'], now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a notice missing a section', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-1', 'admin_outage', %L, array['Incident commander'], now() + interval '45 minutes')$q$,
           pg_temp.sections() - 'next_update'));
  perform pg_temp.expect_refused('a notice with a lowercase placeholder', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-1', 'admin_outage', %L, array['Incident commander'], now() + interval '45 minutes')$q$,
           pg_temp.sections('{"who_is_affected": "Students at [school]."}')));
  perform pg_temp.expect_allowed('a notice with a markdown link', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-1', 'admin_outage', %L, array['Incident commander'], now() + interval '45 minutes')$q$,
           pg_temp.sections('{"where_to_get_help": "See [the status page](https://status.example)."}')));
  perform pg_temp.expect_refused('a notice that speculates', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-1', 'admin_outage', %L, array['Incident commander'], now() + interval '45 minutes')$q$,
           pg_temp.sections('{"what_happened": "We believe a cache failed."}')));
  perform pg_temp.expect_refused('a notice whose next update is past its cadence', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-1', 'admin_outage', %L, array['Incident commander'], now() + interval '3 hours')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a security notice without the exposure status', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-2', 'security', %L, array['Security owner', 'Legal'], now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a security notice with an exposure status not on the list', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-2', 'security', %L, '{"data_exposure": "fine"}', array['Security owner', 'Legal'],
                      now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a security notice approved by the wrong people (Codex, #828)', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-2', 'security', %L, '{"data_exposure": "Not indicated"}', array['anyone'],
                      now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a security notice missing Legal', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-2', 'security', %L, '{"data_exposure": "Not indicated"}', array['Security owner'],
                      now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a notice with a null approver', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-1', 'admin_outage', %L, array['Incident commander', null], now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_allowed('a security notice with one on the list', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-2', 'security', %L, '{"data_exposure": "Not indicated"}', array['Security owner', 'Legal'],
                      now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_allowed('a notice to every school', responder,
    format($q$insert into public.governance_incident_notices
                (incident_ref, audience, sections, approved_by, next_update_at)
              values ('MAINT-1', 'scheduled_maintenance', %L, array['Operations lead'], now() + interval '20 hours')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a university admin recording a notice', admin_a,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, approved_by, next_update_at)
              values ('gv-a', 'INC-3', 'admin_outage', %L, array['Incident commander'], now() + interval '45 minutes')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('rewriting a sent notice', responder,
    $q$update public.governance_incident_notices set incident_ref = 'INC-9'$q$);

  perform pg_temp.counted('the school''s auditor reads its own notices and the one sent to every school',
    pg_temp.seen(admin_a, 'select 1 from public.governance_incident_notices'), 4);
  perform pg_temp.counted('another school reads only the one sent to every school (Codex, #828)',
    pg_temp.seen(admin_b, 'select 1 from public.governance_incident_notices'), 1);

  -- launch_delay and change_notice (20261004120000)
  perform pg_temp.expect_allowed('a launch delay with its check and an unchanged-data answer', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'launch_delay', %L, '{"gate_pending": "Accessibility review", "data_changed": "No"}', array['Founder'], now() + interval '6 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a launch delay without the check not yet complete', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'launch_delay', %L, '{"data_changed": "No"}', array['Founder'], now() + interval '6 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a launch delay whose data answer is not on the list', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'launch_delay', %L, '{"gate_pending": "Accessibility review", "data_changed": "Maybe"}', array['Founder'], now() + interval '6 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a launch delay approved by someone else', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'launch_delay', %L, '{"gate_pending": "Accessibility review", "data_changed": "No"}', array['Incident commander'], now() + interval '6 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a launch delay whose next update is past a week', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'launch_delay', %L, '{"gate_pending": "Accessibility review", "data_changed": "No"}', array['Founder'], now() + interval '8 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_allowed('a change notice with every approver', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'change_notice', %L, '{"effective_date": "1 November", "work_affected": "No"}', array['Product owner', 'Privacy owner', 'Legal'], now() + interval '20 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a change notice without Legal', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'change_notice', %L, '{"effective_date": "1 November", "work_affected": "No"}', array['Product owner', 'Privacy owner'], now() + interval '20 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a change notice without when it takes effect', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'change_notice', %L, '{"work_affected": "No"}', array['Product owner', 'Privacy owner', 'Legal'], now() + interval '20 days')$q$,
           pg_temp.sections()));
  perform pg_temp.expect_refused('a change notice whose next update is past 30 days', responder,
    format($q$insert into public.governance_incident_notices
                (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
              values ('gv-a', 'INC-4', 'change_notice', %L, '{"effective_date": "1 November", "work_affected": "No"}', array['Product owner', 'Privacy owner', 'Legal'], now() + interval '31 days')$q$,
           pg_temp.sections()));
  perform pg_temp.counted('a student reads none',
    pg_temp.seen(student_a, 'select 1 from public.governance_incident_notices'), 0);

  -- ── 6. Audit ───────────────────────────────────────────────────────────

  select count(*) into n from public.tenant_policy_audit_event
   where tenant_id = 'gv-a' and entity_type = 'governance_policy_nodes';
  perform pg_temp.counted('gv-a''s policy node changes are audited', n, 7);
  select count(*) into n from public.tenant_policy_audit_event
   where tenant_id = 'gv-a' and entity_type = 'governance_steward_assignments' and actor_id = admin_a;
  perform pg_temp.counted('steward changes are audited against the admin who made them', n, 4);
  select count(*) into n from public.tenant_policy_audit_event
   where tenant_id = 'gv-a' and entity_type = 'governance_config_requests';
  perform pg_temp.counted('and each step of the request', n, 4);
end $$;

rollback;
