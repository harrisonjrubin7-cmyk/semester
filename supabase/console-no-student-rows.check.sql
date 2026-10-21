-- No console function hands an operator a student's data.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- Stream 08 (docs/handoff/execute/08-ops-command-center.md) asks for "business
-- data only: a test proves every /ops query fails against student tables".
-- `company-roles-student-data.check.sql` answers that for *tables* read as a
-- company role, and says in its own header that it does not walk the
-- `security definer` functions a company role may call. The console is made of
-- exactly those functions, so this file asks the same question of them.
--
-- ## What it does
--
-- Seeds one student with marker strings in the places a student's own data
-- lives (their account id and email, a profile handle and about line, a note
-- and a task), becomes a platform operator holding a live platform grant, calls
-- every console read function, and fails if any marker appears anywhere in what
-- came back.
--
-- ## Controls
--
--   * The student's own data is real: the student reads their note back.
--   * The probe can see a leak. A marker is first planted in a column the
--     console does return (an integration connection's name); the probe must
--     find it. It is then removed before the real assertion.
--   * Every function in the list ran. A function that raised is a failure, never
--     a pass: an empty or refused answer says nothing about leaks.
--   * The operator is live: the command center returns rows.
--
-- ## What it does not do
--
--   * It reads what the functions return for this fixture only. A function that
--     would join a student table under a condition this fixture does not meet is
--     not exercised.
--   * It covers the functions listed in `fns` below. A new `console_*` read
--     function must be added to that list; the last block fails if the schema
--     has one the list does not name.
--
--   How to run it: supabase/check.sh console-no-student-rows

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create temp table ids (k text primary key, v uuid not null);
create temp table markers (m text primary key);

-- Everything a console function returns, as one string. `to_jsonb(t)` covers
-- a function that returns rows and one that returns a single jsonb.
create or replace function pg_temp.output_of(call text)
returns text language plpgsql as $$
declare blob text;
begin
  execute format('select coalesce(string_agg(to_jsonb(t)::text, '' ''), '''') from %s t', call)
    into blob;
  return blob;
end $$;

create or replace function pg_temp.leaked(blob text)
returns text language sql as $$
  select string_agg(m, ', ') from pg_temp.markers where position(lower(m) in lower(blob)) > 0
$$;

create temp table fns (call text primary key);
insert into fns values
  ('public.console_command_center(false)'),   ('public.console_command_center(true)'),
  ('public.console_figures(false)'),          ('public.console_figures(true)'),
  ('public.console_customers(false)'),        ('public.console_customers(true)'),
  ('public.console_approvals(false)'),        ('public.console_approvals(true)'),
  ('public.console_break_glass(false)'),      ('public.console_break_glass(true)'),
  ('public.console_integration_health(false)'), ('public.console_integration_health(true)'),
  ('public.console_privacy_requests(false)'), ('public.console_privacy_requests(true)'),
  ('public.console_release_incidents(false)'), ('public.console_release_incidents(true)'),
  ('public.console_tenant_operations(false)'), ('public.console_tenant_operations(true)'),
  ('public.console_tenant_access(''nostudent-live'')'),
  ('public.console_audit_status()'),
  ('public.console_audit_read(now() - interval ''1 day'', 100)');

do $$
declare operator uuid := gen_random_uuid(); student uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains, is_demo)
    values ('nostudent-live', 'No Student Live University', array['nostudent-live.example'], false);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (operator, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@nostudent-live.example', now(), now(), now()),
    (student,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zq-marker-student@nostudent-live.example', now(), now(), now());
  -- One operator holding every kind of grant a console function asks for, so
  -- none of them is refused for want of one and answers nothing.
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (operator, 'platform_admin', 'platform', '', 'platform'),
    (operator, 'incident_responder', 'platform', '', 'platform'),
    (operator, 'integration_admin', 'school', 'nostudent-live', 'platform'),
    (operator, 'implementation_manager', 'school', 'nostudent-live', 'platform'),
    (operator, 'data_steward', 'school', 'nostudent-live', 'platform');
  insert into ids values ('operator', operator), ('student', student);

  insert into public.profiles (user_id, handle, about)
    values (student, 'zq-marker-handle', 'zq-marker-about');
  insert into public.notes (user_id, id, data)
    values (student, 'n1', '{"title":"zq-marker-note","body":"zq-marker-note-body"}');
  insert into public.tasks (user_id, id, data)
    values (student, 't1', '{"title":"zq-marker-task"}');

  insert into markers values
    (student::text), ('zq-marker-student'), ('zq-marker-handle'), ('zq-marker-about'),
    ('zq-marker-note'), ('zq-marker-task');

  insert into public.integration_connections
    (tenant_id, provider_domain, provider_name, connection_name, status, authentication_type, sync_mode)
  values ('nostudent-live', 'lms', 'Live LMS', 'Live LMS', 'error', 'none', 'manual');
end $$;

-- Control: the student's data is real and is theirs to read.
do $$
declare n bigint;
begin
  perform pg_temp.become((select v from ids where k = 'student'));
  select count(*) into n from public.notes;
  perform pg_temp.nobody();
  if n <> 1 then raise exception 'FAILED: control — the student could not read their own note (got %)', n; end if;
  raise notice 'ok  the student reads their own seeded note';
end $$;

-- Control: the probe sees a leak where the console really does return text.
do $$
declare blob text := ''; call text; found text;
begin
  update public.integration_connections
     set connection_name = 'zq-marker-note-planted' where tenant_id = 'nostudent-live';
  for call in select f.call from fns f order by f.call loop
    perform pg_temp.become((select v from ids where k = 'operator'));
    blob := blob || ' ' || pg_temp.output_of(call);
    perform pg_temp.nobody();
  end loop;
  found := pg_temp.leaked(blob);
  if found is null then
    raise exception 'FAILED: control — a marker planted in a returned column was not found, so the probe cannot see a leak';
  end if;
  raise notice 'ok  the probe finds a planted marker (%)', found;
  update public.integration_connections
     set connection_name = 'Live LMS' where tenant_id = 'nostudent-live';
end $$;

-- The assertion: every function runs, none returns a marker.
do $$
declare call text; blob text; found text; ran int := 0; command_rows bigint;
begin
  for call in select f.call from fns f order by f.call loop
    perform pg_temp.become((select v from ids where k = 'operator'));
    begin
      blob := pg_temp.output_of(call);
    exception when others then
      perform pg_temp.nobody();
      raise exception 'FAILED: % raised (%), so it says nothing about leaks', call, sqlerrm;
    end;
    perform pg_temp.nobody();
    ran := ran + 1;
    found := pg_temp.leaked(blob);
    if found is not null then
      raise exception 'FAILED: % returned student data (markers: %)', call, found;
    end if;
  end loop;
  perform pg_temp.become((select v from ids where k = 'operator'));
  select count(*) into command_rows from public.console_command_center(false);
  perform pg_temp.nobody();
  if command_rows = 0 then
    raise exception 'FAILED: control — the command center returned no rows, so the operator is not live';
  end if;
  raise notice 'ok  % console functions ran for a live operator and none returned a student marker', ran;
end $$;

-- A new console read function must be listed above.
do $$
declare unlisted text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into unlisted
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'console\_%'
     and p.proname not in ('console_act')   -- a write: the approvals checks cover it
     and not exists (select 1 from fns where call like 'public.' || p.proname || '(%');
  if unlisted is not null then
    raise exception 'FAILED: console function(s) not covered by this check: %', unlisted;
  end if;
  raise notice 'ok  every console read function is covered';
end $$;

rollback;
