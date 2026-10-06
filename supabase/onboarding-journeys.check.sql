-- Onboarding journeys and the one-use hand-off (20261006000000_onboarding_journeys_and_handoff).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * a signed-in account reads its own assignments, progress and events and no one
--     else's, and reads published journeys but not drafts;
--   * no client can write any of it directly: progress is only ever made by the
--     functions, and those check who is asking;
--   * what a link said is kept only as the short allowlist, and never names a tenant,
--     a capability, a URL or a screen outside the list;
--   * a step is completed against the version of the journey the assignment was made
--     under; an unknown step or version is refused; a required step cannot be skipped;
--     doing a step twice writes nothing the second time;
--   * publishing a newer version of a journey changes nobody's existing assignment;
--   * a hand-off works once, only with its nonce, only before it expires, answers the
--     same null for every way of failing, and a wrong nonce does not use it up;
--   * the hand-off table is out of reach of every client, and who may call each
--     function is exactly what the migration says.

begin;

create or replace function pg_temp.ok(what text, cond boolean)
returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.visitor()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end $$;

-- A runs a statement that must be refused; a different outcome is a failure.
create or replace function pg_temp.refused(what text, stmt text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception
    when insufficient_privilege or check_violation or no_data_found or raise_exception
         or invalid_parameter_value or invalid_authorization_specification or undefined_object then
      raise notice 'ok  %', what;
      return;
  end;
  raise exception 'FAILED: % — it was not refused', what;
end $$;

-- ── Fixtures ──────────────────────────────────────────────────────────────

create temp table fx (k text primary key, v text);
grant all on fx to public;

do $$
declare
  a uuid := pg_temp.newuser('a-onboard@example.edu');
  b uuid := pg_temp.newuser('b-onboard@example.edu');
  j1 uuid;
  j2 uuid;
begin
  insert into fx values ('a', a::text), ('b', b::text);

  insert into public.onboarding_journeys (key, version, audience, status, definition, published_at)
  values ('student_first_plan', 1, 'student', 'published',
          '{"steps":[
              {"key":"goal","version":1,"required":true},
              {"key":"term","version":1,"required":false},
              {"key":"first_action","version":1,"required":true,"activation":true}]}'::jsonb,
          now())
  returning id into j1;
  insert into public.onboarding_journeys (key, version, audience, status, definition)
  values ('faculty_course_setup', 1, 'faculty', 'draft',
          '{"steps":[{"key":"course","version":1,"required":true}]}'::jsonb);
  insert into fx values ('j1', j1::text);
end $$;

-- ── Reading ───────────────────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become((select v from fx where k = 'a')::uuid);
  select count(*) into n from public.onboarding_journeys;
  perform pg_temp.ok('a signed-in account reads the published journey and not the draft (1 row)', n = 1);
  select count(*) into n from public.onboarding_journeys where status = 'draft';
  perform pg_temp.ok('no draft is visible', n = 0);
  reset role;
end $$;

-- ── Starting, and what a link may say ─────────────────────────────────────

do $$
declare
  asg uuid; again uuid; ctx jsonb; ten text;
begin
  perform pg_temp.become((select v from fx where k = 'a')::uuid);
  asg := public.start_onboarding('student_first_plan',
    '{"source":"email","roleHint":"institution_admin","campaignId":"fall-26",
      "tenant":"vanderbilt","tenantId":"vanderbilt","capability":"admin","isAdmin":"true",
      "continueTo":"https://evil.example/","referralCode":"a.b.c"}'::jsonb);
  insert into fx values ('asg', asg::text);
  select entry_context, tenant_id into ctx, ten from public.onboarding_assignments where id = asg;
  perform pg_temp.ok('what the link said is kept only as the allowlist',
    ctx = '{"source":"email","roleHint":"institution_admin","campaignId":"fall-26"}'::jsonb);
  perform pg_temp.ok('a role hint is only a hint: no tenant was attached', ten is null);
  perform pg_temp.ok('a URL as a destination and a dotted code were dropped',
    not (ctx ? 'continueTo') and not (ctx ? 'referralCode'));

  again := public.start_onboarding('student_first_plan', '{}');
  perform pg_temp.ok('starting again returns the same assignment', again = asg);
  begin
    perform public.start_onboarding('faculty_course_setup');
    raise exception 'FAILED: a draft journey was started';
  exception when no_data_found then
    raise notice 'ok  a draft journey cannot be started';
  end;
  reset role;
end $$;

-- ── Seeing, and not seeing ────────────────────────────────────────────────

do $$
declare n bigint;
begin
  perform pg_temp.become((select v from fx where k = 'a')::uuid);
  select count(*) into n from public.onboarding_assignments;
  perform pg_temp.ok('A reads their own assignment', n = 1);
  select count(*) into n from public.onboarding_events;
  perform pg_temp.ok('A reads their own event (journey_assigned)', n = 1);
  reset role;

  perform pg_temp.become((select v from fx where k = 'b')::uuid);
  select count(*) into n from public.onboarding_assignments;
  perform pg_temp.ok('B sees none of A''s assignments', n = 0);
  select count(*) into n from public.onboarding_step_progress;
  perform pg_temp.ok('B sees none of A''s progress', n = 0);
  select count(*) into n from public.onboarding_events;
  perform pg_temp.ok('B sees none of A''s events', n = 0);
  reset role;
end $$;

-- ── No client writes anything directly ────────────────────────────────────

do $$
declare asg text := (select v from fx where k = 'asg');
begin
  perform pg_temp.become((select v from fx where k = 'a')::uuid);
  perform pg_temp.refused('A cannot insert an assignment',
    format('insert into public.onboarding_assignments (user_id, journey_id) values (%L, %L)',
           (select v from fx where k = 'a'), (select v from fx where k = 'j1')));
  perform pg_temp.refused('A cannot mark their own assignment completed',
    format('update public.onboarding_assignments set status = ''completed'', completed_at = now() where id = %L', asg));
  perform pg_temp.refused('A cannot choose their own tenant',
    format('update public.onboarding_assignments set tenant_id = ''x'' where id = %L', asg));
  perform pg_temp.refused('A cannot write step progress',
    format('insert into public.onboarding_step_progress (assignment_id, step_key, step_version, status, completed_at) values (%L, ''goal'', 1, ''completed'', now())', asg));
  perform pg_temp.refused('A cannot write an event',
    format('insert into public.onboarding_events (account_id, event_key) values (%L, ''activation_achieved'')',
           (select v from fx where k = 'a')));
  perform pg_temp.refused('A cannot publish a journey',
    'update public.onboarding_journeys set status = ''retired''');
  perform pg_temp.refused('A cannot delete an assignment',
    format('delete from public.onboarding_assignments where id = %L', asg));
  reset role;
end $$;

-- ── Completing, skipping, and what the functions refuse ───────────────────

do $$
declare
  asg uuid := (select v from fx where k = 'asg')::uuid;
  st text; n bigint; act timestamptz;
begin
  -- B cannot touch A's assignment.
  perform pg_temp.become((select v from fx where k = 'b')::uuid);
  begin
    perform public.complete_onboarding_step(asg, 'goal', 1);
    raise exception 'FAILED: B completed a step on A''s assignment';
  exception when no_data_found then
    raise notice 'ok  B cannot complete a step on A''s assignment';
  end;
  reset role;

  perform pg_temp.become((select v from fx where k = 'a')::uuid);
  begin
    perform public.complete_onboarding_step(asg, 'invented', 1);
    raise exception 'FAILED: an unknown step was accepted';
  exception when no_data_found then
    raise notice 'ok  a step that is not in the journey is refused';
  end;
  begin
    perform public.complete_onboarding_step(asg, 'goal', 2);
    raise exception 'FAILED: a wrong step version was accepted';
  exception when no_data_found then
    raise notice 'ok  a step at a version the journey does not have is refused';
  end;
  begin
    perform public.skip_onboarding_step(asg, 'goal', 1, 'not_now');
    raise exception 'FAILED: a required step was skipped';
  exception when insufficient_privilege then
    raise notice 'ok  a required step cannot be skipped';
  end;
  begin
    perform public.skip_onboarding_step(asg, 'term', 1, 'because');
    raise exception 'FAILED: an unlisted skip reason was accepted';
  exception when invalid_parameter_value then
    raise notice 'ok  an unlisted skip reason is refused';
  end;

  st := public.skip_onboarding_step(asg, 'term', 1, 'not_relevant');
  perform pg_temp.ok('an optional step can be skipped and the journey stays open', st = 'in_progress');

  st := public.complete_onboarding_step(asg, 'goal', 1);
  perform pg_temp.ok('completing one of two required steps leaves it open', st = 'in_progress');
  perform public.complete_onboarding_step(asg, 'goal', 1);
  select count(*) into n from public.onboarding_events where event_key = 'step_completed';
  perform pg_temp.ok('doing a step twice wrote one event, not two', n = 1);

  select activated_at into act from public.onboarding_assignments where id = asg;
  perform pg_temp.ok('not activated before the activation step', act is null);

  st := public.complete_onboarding_step(asg, 'first_action', 1);
  perform pg_temp.ok('completing the last required step completes the journey', st = 'completed');
  select activated_at into act from public.onboarding_assignments where id = asg;
  perform pg_temp.ok('and the activation step stamped activation', act is not null);
  select count(*) into n from public.onboarding_events where event_key in ('activation_achieved', 'journey_completed');
  perform pg_temp.ok('with exactly one activation and one completion event', n = 2);
  perform public.complete_onboarding_step(asg, 'first_action', 1);
  select count(*) into n from public.onboarding_events where event_key in ('activation_achieved', 'journey_completed');
  perform pg_temp.ok('a retry after completion adds nothing', n = 2);
  reset role;
end $$;

-- ── A newer version changes nobody's existing assignment ──────────────────

do $$
declare
  asg uuid := (select v from fx where k = 'asg')::uuid;
  j1 uuid := (select v from fx where k = 'j1')::uuid;
  j2 uuid; c uuid; casg uuid; used uuid;
begin
  insert into public.onboarding_journeys (key, version, audience, status, definition, published_at)
  values ('student_first_plan', 2, 'student', 'published',
          '{"steps":[{"key":"goal","version":2,"required":true}]}'::jsonb, now())
  returning id into j2;

  perform pg_temp.become((select v from fx where k = 'a')::uuid);
  perform pg_temp.ok('A starting again still gets the assignment made under version 1',
                     public.start_onboarding('student_first_plan') = asg);
  select journey_id into used from public.onboarding_assignments where id = asg;
  perform pg_temp.ok('and it still points at version 1', used = j1);
  reset role;

  c := pg_temp.newuser('c-onboard@example.edu');
  perform pg_temp.become(c);
  casg := public.start_onboarding('student_first_plan');
  select journey_id into used from public.onboarding_assignments where id = casg;
  perform pg_temp.ok('a new account is given version 2', used = j2);
  reset role;
end $$;

-- ── The hand-off ─────────────────────────────────────────────────────────

do $$
declare
  nonce constant text := 'n-0123456789abcdef0123456789abcdef';
  hash  text := encode(sha256(convert_to('n-0123456789abcdef0123456789abcdef', 'utf8')), 'hex');
  hid uuid; got jsonb; n bigint; span interval;
begin
  -- The service role creates it.
  set local role service_role;
  hid := public.create_handoff('calendar', hash,
    '{"source":"email","contentId":"reg-guide","tenant":"x","continueTo":"not-a-screen"}'::jsonb, 99999);
  reset role;
  select expires_at - created_at into span from public.handoff_transactions where id = hid;
  perform pg_temp.ok('a very long lifetime was cut to fifteen minutes', span <= interval '15 minutes');
  perform pg_temp.ok('and only the hash of the nonce is stored',
    (select nonce_hash from public.handoff_transactions where id = hid) = hash
    and (select nonce_hash from public.handoff_transactions where id = hid) <> nonce);
  perform pg_temp.ok('what the link said was cut to the allowlist',
    (select entry_context from public.handoff_transactions where id = hid)
      = '{"source":"email","contentId":"reg-guide"}'::jsonb);

  begin
    insert into public.handoff_transactions (nonce_hash, route, expires_at)
    values (hash, 'console', now() + interval '1 minute');
    raise exception 'FAILED: a screen outside the list was accepted';
  exception when check_violation then
    raise notice 'ok  a screen outside the fixed list cannot be a destination';
  end;
  begin
    insert into public.handoff_transactions (nonce_hash, route, expires_at)
    values (hash, 'home', now() + interval '2 hours');
    raise exception 'FAILED: a two-hour hand-off was accepted';
  exception when check_violation then
    raise notice 'ok  the table itself refuses a long-lived hand-off';
  end;

  perform pg_temp.become((select v from fx where k = 'b')::uuid);
  perform pg_temp.ok('a wrong nonce answers null', public.consume_handoff(hid, 'n-ffffffffffffffffffffffffffffffff') is null);
  perform pg_temp.ok('a made-up id answers null', public.consume_handoff(gen_random_uuid(), nonce) is null);
  perform pg_temp.ok('a nonce too short to be real answers null', public.consume_handoff(hid, 'x') is null);
  got := public.consume_handoff(hid, nonce);
  perform pg_temp.ok('the right nonce still works (the wrong ones did not use it up)', got ->> 'route' = 'calendar');
  perform pg_temp.ok('and returns only the sanitised context', got -> 'entry' = '{"source":"email","contentId":"reg-guide"}'::jsonb);
  perform pg_temp.ok('a second use answers null', public.consume_handoff(hid, nonce) is null);
  reset role;
  select count(*) into n from public.onboarding_events where event_key = 'handoff_consumed';
  perform pg_temp.ok('using it wrote one event', n = 1);

  -- Expired.
  insert into public.handoff_transactions (nonce_hash, route, created_at, expires_at)
  values (hash, 'home', now() - interval '1 hour', now() - interval '55 minutes')
  returning id into hid;
  perform pg_temp.become((select v from fx where k = 'b')::uuid);
  perform pg_temp.ok('an expired hand-off answers null', public.consume_handoff(hid, nonce) is null);
  reset role;

  -- A visitor cannot use one.
  set local role service_role;
  hid := public.create_handoff('home', hash);
  reset role;
  perform pg_temp.visitor();
  begin
    perform public.consume_handoff(hid, nonce);
    raise exception 'FAILED: a visitor consumed a hand-off';
  exception when insufficient_privilege then
    raise notice 'ok  a signed-out visitor cannot consume a hand-off';
  end;
  reset role;

  -- The sweep.
  set local role service_role;
  perform public.sweep_handoffs();
  reset role;
  perform pg_temp.ok('the sweep marks a stale one expired',
    (select status from public.handoff_transactions where id = hid) = 'created'
    and not exists (select 1 from public.handoff_transactions where status = 'created' and expires_at <= now()));
end $$;

-- ── The hand-off table is out of every client's reach ─────────────────────

do $$
begin
  perform pg_temp.become((select v from fx where k = 'a')::uuid);
  perform pg_temp.refused('a signed-in account cannot read hand-offs', 'select count(*) from public.handoff_transactions');
  perform pg_temp.refused('a signed-in account cannot write a hand-off',
    'insert into public.handoff_transactions (nonce_hash, route, expires_at) values (repeat(''a'', 64), ''home'', now() + interval ''1 minute'')');
  reset role;
  perform pg_temp.visitor();
  perform pg_temp.refused('a visitor cannot read hand-offs', 'select count(*) from public.handoff_transactions');
  perform pg_temp.refused('a visitor cannot read journeys', 'select count(*) from public.onboarding_journeys');
  perform pg_temp.refused('a visitor cannot read assignments', 'select count(*) from public.onboarding_assignments');
  reset role;
end $$;

-- ── Who may call what ─────────────────────────────────────────────────────
-- Asks the catalogue, because a REVOKE naming a role leaves the grant it holds
-- through PUBLIC untouched (access.check.sql explains the one this would have missed).

do $$
declare
  f text;
  client_fns constant text[] := array[
    'public.start_onboarding(text, jsonb, text)',
    'public.complete_onboarding_step(uuid, text, integer, text)',
    'public.skip_onboarding_step(uuid, text, integer, text, text)',
    'public.consume_handoff(uuid, text)'];
  server_fns constant text[] := array[
    'public.create_handoff(text, text, jsonb, integer)',
    'public.sweep_handoffs()'];
begin
  foreach f in array client_fns loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'FAILED: a visitor can call %', f; end if;
    if not has_function_privilege('authenticated', f, 'execute') then raise exception 'FAILED: a signed-in account cannot call %', f; end if;
  end loop;
  foreach f in array server_fns loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'FAILED: a visitor can call %', f; end if;
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'FAILED: a signed-in account can call %', f; end if;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'FAILED: the service role cannot call %', f; end if;
  end loop;
  if has_function_privilege('anon', 'private.entry_context(jsonb)', 'execute')
     or has_function_privilege('authenticated', 'private.entry_context(jsonb)', 'execute') then
    raise exception 'FAILED: a client can call private.entry_context';
  end if;
  raise notice 'ok  the four client functions are for signed-in accounts, the two server ones for the service role only';
end $$;

-- ── Leaving takes the rows with it ───────────────────────────────────────

do $$
declare n bigint;
begin
  delete from auth.users where id = (select v from fx where k = 'a')::uuid;
  select count(*) into n from public.onboarding_assignments where user_id = (select v from fx where k = 'a')::uuid;
  perform pg_temp.ok('deleting an account deletes its assignments', n = 0);
  select count(*) into n from public.onboarding_events where account_id = (select v from fx where k = 'a')::uuid;
  perform pg_temp.ok('and its events', n = 0);
end $$;

rollback;
