-- The per-school, per-module Connect / Core switch (20260930010000).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- D-151. What this walks: a module with no row reads Connect; Core needs two
-- approvers other than the requester; nobody writes the table directly; the
-- way back is immediate and freezes rather than deletes; the kill switch
-- overrides a school's Core; another school's people see and do nothing;
-- history cannot be edited.
--
--   How to run it: supabase/check.sh module_mode

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- The same session with a second factor completed just now: what
-- `private.assert_fresh_mfa()` reads off the JWT.
create or replace function pg_temp.become_mfa(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2',
      'amr', json_build_array(json_build_object('method', 'totp',
               'timestamp', floor(extract(epoch from now()))::bigint)))::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
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
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- Runs one statement as `who`, with or without fresh MFA, and returns the
-- error message it drew — or null when it went through. A refusal is
-- asserted on its message, not on the fact of an exception, because "it
-- raised" is also what a typo in the statement looks like.
create or replace function pg_temp.attempt(who uuid, mfa boolean, statement text)
returns text language plpgsql as $$
begin
  if mfa then perform pg_temp.become_mfa(who); else perform pg_temp.become(who); end if;
  execute statement;
  perform pg_temp.nobody();
  return null;
exception when others then
  perform pg_temp.nobody();
  return sqlerrm;
end $$;

create or replace function pg_temp.refused_with(what text, got text, expected text)
returns void language plpgsql as $$
begin
  if got is null then
    raise exception 'FAILED: % — it went through', what;
  end if;
  if got not ilike '%' || expected || '%' then
    raise exception 'FAILED: % — refused, but for another reason: %', what, got;
  end if;
  raise notice 'ok  % ("%")', what, got;
end $$;

create or replace function pg_temp.went_through(what text, got text)
returns void language plpgsql as $$
begin
  if got is not null then
    raise exception 'FAILED: % — refused: %', what, got;
  end if;
  raise notice 'ok  %', what;
end $$;

create temp table ids (k text primary key, v text not null);
create or replace function pg_temp.remember(k text, v text) returns void language sql as
  $$ insert into ids values (k, v) on conflict (k) do update set v = excluded.v $$;
create or replace function pg_temp.who(k text) returns uuid language sql stable as
  $$ select v::uuid from ids where ids.k = who.k $$;
create or replace function pg_temp.what(k text) returns text language sql stable as
  $$ select v from ids where ids.k = what.k $$;


-- ── The people ────────────────────────────────────────────────────────────

do $$
declare a uuid; b uuid; c uuid; member uuid; other uuid;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('mm-check',  'Module Mode Check University', array['mm-check.example'],  false),
    ('mm-other',  'Other Module Mode University', array['mm-other.example'],  false);

  a      := pg_temp.newuser('adm.alpha@mm-check.example', 'mm-check');
  b      := pg_temp.newuser('adm.bravo@mm-check.example', 'mm-check');
  c      := pg_temp.newuser('adm.charlie@mm-check.example', 'mm-check');
  member := pg_temp.newuser('member@mm-check.example', 'mm-check');
  other  := pg_temp.newuser('adm.outsider@mm-other.example', 'mm-other');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (a, 'university_admin', 'school', 'mm-check', 'institution'),
    (b, 'university_admin', 'school', 'mm-check', 'institution'),
    (c, 'university_admin', 'school', 'mm-check', 'institution'),
    (other, 'university_admin', 'school', 'mm-other', 'institution');

  perform pg_temp.remember('a', a::text);
  perform pg_temp.remember('b', b::text);
  perform pg_temp.remember('c', c::text);
  perform pg_temp.remember('member', member::text);
  perform pg_temp.remember('other', other::text);
  raise notice 'ok  two schools, three administrators, one member, one outsider';
end $$;

-- ── The default, and the list ─────────────────────────────────────────────

do $$
begin
  perform pg_temp.become(pg_temp.who('member'));
  perform pg_temp.counted('a member reads fourteen modules', (select count(*) from public.effective_module_modes('mm-check')), 14);
  perform pg_temp.counted('every one of them is Connect', (select count(*) from public.effective_module_modes('mm-check') where mode = 'connect' and not frozen and not killed), 14);
  perform pg_temp.nobody();

  -- The control: the count above is not just "the function returns something".
  perform pg_temp.become(pg_temp.who('other'));
  perform pg_temp.counted('another school sees fourteen Connect rows for a school it is not in', (select count(*) from public.effective_module_modes('mm-check') where mode = 'connect'), 14);
  perform pg_temp.nobody();
end $$;

-- ── Asking ────────────────────────────────────────────────────────────────

do $$
begin
  -- The school's own entitlement: module.core_mode is off until a policy row
  -- says otherwise, and only sandbox or production opens it.
  perform pg_temp.refused_with('with no policy row, module.core_mode is off and Core cannot be asked for',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','why',%L)$q$, pg_temp.who('a'))),
    'module.core_mode');
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('mm-check', 'module.core_mode', 'preview');
  perform pg_temp.refused_with('preview is not enough either',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','why',%L)$q$, pg_temp.who('a'))),
    'module.core_mode');
  update public.tenant_feature_policy set state = 'production' where tenant_id = 'mm-check' and capability = 'module.core_mode';
  insert into public.tenant_feature_policy (tenant_id, capability, state) values ('mm-other', 'module.core_mode', 'sandbox');

  perform pg_temp.refused_with('a member who holds no capability cannot ask',
    pg_temp.attempt(pg_temp.who('member'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','why',%L)$q$, pg_temp.who('member'))),
    'row-level security');

  perform pg_temp.refused_with('an administrator elsewhere cannot ask for this school',
    pg_temp.attempt(pg_temp.who('other'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','why',%L)$q$, pg_temp.who('other'))),
    'row-level security');

  perform pg_temp.refused_with('nobody may ask in someone else''s name',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','why',%L)$q$, pg_temp.who('b'))),
    'row-level security');

  perform pg_temp.refused_with('a module that does not exist is refused',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','not_a_module','core','why',%L)$q$, pg_temp.who('a'))),
    'violates check constraint');

  perform pg_temp.refused_with('going to the mode it is already in is refused',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','connect','why',%L)$q$, pg_temp.who('a'))),
    'already in connect mode');

  perform pg_temp.went_through('an administrator asks for Core',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','Pilot cohort, autumn term',%L)$q$, pg_temp.who('a'))));

  perform pg_temp.refused_with('a second pending request for the same module is refused',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','again',%L)$q$, pg_temp.who('b'))),
    'duplicate key');

  perform pg_temp.counted('asking changed nothing: the module still reads Connect',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and mode = 'connect'), 1);
end $$;

-- ── Approving ─────────────────────────────────────────────────────────────

do $$
declare req uuid;
begin
  select id into req from public.module_mode_request where module = 'lms_assignments';
  perform pg_temp.remember('req', req::text);

  perform pg_temp.refused_with('the requester cannot approve their own request',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('a'))),
    'cannot approve their own');

  perform pg_temp.refused_with('an outsider cannot approve',
    pg_temp.attempt(pg_temp.who('other'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('other'))),
    'row-level security');

  perform pg_temp.refused_with('nobody approves in someone else''s name',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('c'))),
    'row-level security');

  perform pg_temp.went_through('one administrator approves',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('b'))));

  perform pg_temp.counted('one approval is not enough: still Connect',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and mode = 'connect'), 1);

  perform pg_temp.refused_with('the same person cannot approve twice to make two',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('b'))),
    'duplicate key');

  perform pg_temp.counted('twice did not count: still Connect',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and mode = 'connect'), 1);

  perform pg_temp.went_through('a second, different administrator approves',
    pg_temp.attempt(pg_temp.who('c'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('c'))));

  perform pg_temp.counted('two approvals apply it: the module reads Core',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and mode = 'core' and not frozen), 1);
  perform pg_temp.counted('the other thirteen are untouched',
    (select count(*) from public.effective_module_modes('mm-check') where mode = 'connect'), 13);
  perform pg_temp.counted('the history says who asked and who approved',
    (select count(*) from public.tenant_module_mode_history
      where module = 'lms_assignments' and to_mode = 'core' and requested_by = pg_temp.who('a')
        and approvers @> array[pg_temp.who('b'), pg_temp.who('c')]), 1);

  perform pg_temp.refused_with('an applied request takes no more approvals',
    pg_temp.attempt(pg_temp.who('c'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('a'))),
    'already applied');
end $$;

-- ── Nobody writes the table ───────────────────────────────────────────────

do $$
begin
  perform pg_temp.refused_with('an administrator cannot write the mode directly',
    pg_temp.attempt(pg_temp.who('a'), false,
      $q$insert into public.tenant_module_mode (tenant_id, module, mode, reason) values ('mm-check','lms_gradebook','core','sidestep')$q$),
    'permission denied');
  perform pg_temp.refused_with('nor change it',
    pg_temp.attempt(pg_temp.who('a'), false,
      $q$update public.tenant_module_mode set mode = 'connect' where module = 'lms_assignments'$q$),
    'permission denied');
  perform pg_temp.refused_with('nor delete it',
    pg_temp.attempt(pg_temp.who('a'), false,
      $q$delete from public.tenant_module_mode$q$),
    'permission denied');
end $$;

-- ── The way back ──────────────────────────────────────────────────────────

do $$
begin
  perform pg_temp.went_through('one administrator rolls a module back to Connect, at once',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','connect','Back to Canvas for this term',%L)$q$, pg_temp.who('b'))));

  perform pg_temp.counted('it reads Connect and frozen: the Core data is kept, read-only',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and mode = 'connect' and frozen), 1);
  perform pg_temp.counted('nothing was deleted: the row is still there',
    (select count(*) from public.tenant_module_mode where tenant_id = 'mm-check' and module = 'lms_assignments' and frozen and mode = 'connect'), 1);
  perform pg_temp.counted('the history has both moves',
    (select count(*) from public.tenant_module_mode_history where tenant_id = 'mm-check' and module = 'lms_assignments'), 2);

  -- Back to Core again needs the two approvals again, and lifts the freeze.
  perform pg_temp.went_through('Core is asked for again',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','core','Second pass',%L)$q$, pg_temp.who('a'))));
  perform pg_temp.counted('a rollback does not make the next Core free: still Connect',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and mode = 'connect'), 1);
end $$;

-- ── Expiry ────────────────────────────────────────────────────────────────

do $$
declare req uuid;
begin
  select id into req from public.module_mode_request where module = 'lms_assignments' and status = 'pending';
  update public.module_mode_request set expires_at = now() - interval '1 minute' where id = req;
  perform pg_temp.refused_with('an expired request cannot be approved',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('b'))),
    'expired');
  update public.module_mode_request set expires_at = now() + interval '7 days' where id = req;
  perform pg_temp.remember('req2', req::text);
end $$;

-- A request that ran out its seven days must not block its replacement.
do $$
declare stale uuid;
begin
  perform pg_temp.went_through('an administrator asks for lms_gradebook in Core',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_gradebook','core','first',%L)$q$, pg_temp.who('a'))));
  select id into stale from public.module_mode_request where module = 'lms_gradebook' and tenant_id = 'mm-check';
  update public.module_mode_request set expires_at = now() - interval '1 minute' where id = stale;
  perform pg_temp.went_through('after seven days a replacement request is accepted, not blocked',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_gradebook','core','second',%L)$q$, pg_temp.who('b'))));
  perform pg_temp.counted('the stale one is closed as expired',
    (select count(*) from public.module_mode_request where id = stale and status = 'expired'), 1);
  perform pg_temp.counted('and exactly one request is pending for the module',
    (select count(*) from public.module_mode_request where tenant_id = 'mm-check' and module = 'lms_gradebook' and status = 'pending'), 1);
  -- The control: an unexpired pending request still blocks a duplicate.
  perform pg_temp.refused_with('a live pending request still blocks another',
    pg_temp.attempt(pg_temp.who('c'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_gradebook','core','third',%L)$q$, pg_temp.who('c'))),
    'duplicate key');
end $$;

-- Two approvals arriving together are serialised on the request row. A
-- two-session race is not reproducible inside one rolled-back transaction, so
-- this holds the guard to the lock the race depends on, and only that.
do $$
begin
  perform pg_temp.counted('the approval guard locks the request row before it counts',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and p.proname = 'guard_module_mode_approval'
        and pg_get_functiondef(p.oid) ilike '%public.module_mode_request where id = new.request_id for update%'), 1);
end $$;

-- ── The kill switch ───────────────────────────────────────────────────────

do $$
declare req uuid := pg_temp.what('req2')::uuid;
begin
  perform pg_temp.went_through('one approval goes in before the switch',
    pg_temp.attempt(pg_temp.who('b'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('b'))));
  perform pg_temp.went_through('and the second, so lms_assignments is Core again',
    pg_temp.attempt(pg_temp.who('c'), false,
      format($q$insert into public.module_mode_approval (request_id, approver) values (%L,%L)$q$, req, pg_temp.who('c'))));
  perform pg_temp.counted('Core again, not frozen',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and mode = 'core' and not frozen), 1);

  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason)
  values ('mm-check', 'kill.core_modules', true, 'drill');

  perform pg_temp.counted('under the switch every module reads Connect',
    (select count(*) from public.effective_module_modes('mm-check') where mode = 'connect' and killed), 14);
  perform pg_temp.counted('and the one that was Core reads frozen, not deleted',
    (select count(*) from public.effective_module_modes('mm-check') where module = 'lms_assignments' and frozen), 1);
  perform pg_temp.counted('the row itself still says core',
    (select count(*) from public.tenant_module_mode where tenant_id = 'mm-check' and module = 'lms_assignments' and mode = 'core'), 1);

  perform pg_temp.refused_with('Core cannot be asked for under the switch',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_gradebook','core','x',%L)$q$, pg_temp.who('a'))),
    'kill.core_modules');

  -- The control for the refusal above: a school the switch does not name is not blocked.
  perform pg_temp.went_through('another school''s administrator can still ask for their own',
    pg_temp.attempt(pg_temp.who('other'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-other','lms_gradebook','core','x',%L)$q$, pg_temp.who('other'))));

  perform pg_temp.went_through('going back to Connect is still allowed under the switch',
    pg_temp.attempt(pg_temp.who('a'), false,
      format($q$insert into public.module_mode_request (tenant_id, module, to_mode, reason, requested_by) values ('mm-check','lms_assignments','connect','wind down',%L)$q$, pg_temp.who('a'))));

  update public.feature_kill_switch set engaged = false where switch_key = 'kill.core_modules';
  perform pg_temp.counted('released: nothing has come back on by itself',
    (select count(*) from public.effective_module_modes('mm-check') where mode = 'connect' and frozen), 1);
end $$;

-- ── History ───────────────────────────────────────────────────────────────

do $$
begin
  perform pg_temp.refused_with('an administrator cannot edit history',
    pg_temp.attempt(pg_temp.who('a'), false, $q$update public.tenant_module_mode_history set reason = 'edited'$q$),
    'permission denied');
  begin
    update public.tenant_module_mode_history set reason = 'edited';
    raise exception 'FAILED: history was edited';
  exception when others then
    if sqlerrm not ilike '%immutable%' then raise; end if;
    raise notice 'ok  history is immutable even to the table owner ("%")', sqlerrm;
  end;
  begin
    delete from public.tenant_module_mode_history;
    raise exception 'FAILED: history was deleted';
  exception when others then
    if sqlerrm not ilike '%immutable%' then raise; end if;
    raise notice 'ok  nor can it be deleted ("%")', sqlerrm;
  end;
  perform pg_temp.become(pg_temp.who('other'));
  perform pg_temp.counted('the outsider reads none of it',
    (select count(*) from public.tenant_module_mode_history where tenant_id = 'mm-check'), 0);
  perform pg_temp.nobody();
  perform pg_temp.become(pg_temp.who('a'));
  perform pg_temp.counted('an administrator reads all of it',
    (select count(*) from public.tenant_module_mode_history where tenant_id = 'mm-check'), 4);
  perform pg_temp.nobody();
end $$;

rollback;
