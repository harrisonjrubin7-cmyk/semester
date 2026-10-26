-- The invite-only private beta (20260928220000_private_beta.sql).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- Each rule is walked by the account it is about and by one it should stop:
-- a manager and a student, a triager and a member, a confirmed address and an
-- unconfirmed one carrying the same text. Counts are read as the account in
-- question, never as the superuser this script otherwise runs as.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text, confirmed boolean default true)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, case when confirmed then now() end, now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1) || substr(md5(address), 1, 4), school);
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

create or replace function pg_temp.must_refuse(what text, who uuid, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(who, statement) then
    raise exception 'FAILED: % — it was allowed', what;
  end if;
  raise notice 'ok  %', what;
end $$;

do $$
declare
  manager uuid;
  triager uuid;
  alice uuid;
  bob_unconfirmed uuid;
  stranger uuid;
  students uuid;
  students_two uuid;
  inv_alice uuid;
  inv_bob uuid;
  issue uuid;
  n bigint;
  live_now boolean;
begin
  insert into public.schools (id, name, email_domains) values
    ('beta-check', 'Beta Check University', array['beta-check.example']);

  manager := pg_temp.newuser('manager@beta-check.example', 'beta-check');
  triager := pg_temp.newuser('triager@beta-check.example', 'beta-check');
  alice := pg_temp.newuser('alice@beta-check.example', 'beta-check');
  bob_unconfirmed := pg_temp.newuser('bob@beta-check.example', 'beta-check', false);
  stranger := pg_temp.newuser('stranger@beta-check.example', 'beta-check');

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (manager, 'platform_admin', 'platform', '', 'platform'),
    (triager, 'support_agent',  'platform', '', 'platform');

  -- ── Running a program is a capability, not a signed-in account ────────

  perform pg_temp.must_refuse('a student cannot create a beta program', alice,
    $q$select public.beta_create_program('sneaky', 'Sneaky', 'beta-check', 'help@x.example')$q$);
  perform pg_temp.must_refuse('a support agent cannot create one either (triage is not manage)', triager,
    $q$select public.beta_create_program('sneaky', 'Sneaky', 'beta-check', 'help@x.example')$q$);

  perform pg_temp.become(manager);
  perform public.beta_create_program('fall-pilot', 'Fall pilot', 'beta-check', 'beta-help@beta-check.example');
  students := public.beta_add_cohort('fall-pilot', 'students', 2);
  reset role;

  perform pg_temp.must_refuse('a student cohort cannot exceed the command''s fifty', manager,
    $q$select public.beta_add_cohort('fall-pilot', 'transfer_students', 26)$q$);
  perform pg_temp.must_refuse('a tenant-admin cohort cannot exceed five', manager,
    $q$select public.beta_add_cohort('fall-pilot', 'tenant_admins', 6)$q$);

  -- ── Invitations hold seats, and admit through the existing sign-up gate ─

  perform pg_temp.become(manager);
  inv_alice := public.beta_invite(students, 'Alice@Beta-Check.example ');
  inv_bob := public.beta_invite(students, 'bob@beta-check.example');
  reset role;

  select count(*) into n from public.invites where email = 'alice@beta-check.example' and note = 'beta:fall-pilot';
  perform pg_temp.counted('an invitation puts the lower-cased address on the sign-up gate''s list', n, 1);

  perform pg_temp.must_refuse('a third invitation to a two-seat cohort is refused, before anyone joins', manager,
    format('select public.beta_invite(%L, %L)', students, 'carol@beta-check.example'));

  -- ── A beta cannot be active while writeback is possible ────────────────

  perform pg_temp.must_refuse('activation is refused while kill.writeback is released', manager,
    $q$select public.beta_set_status('fall-pilot', 'active')$q$);

  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_at)
  values ('beta-check', 'kill.writeback', true, 'Private beta: no writeback.', now());

  perform pg_temp.become(manager);
  perform public.beta_set_status('fall-pilot', 'active');
  reset role;
  select count(*) into n from public.beta_programs where id = 'fall-pilot' and status = 'active';
  perform pg_temp.counted('with the school''s writeback switch engaged, activation goes through', n, 1);

  perform pg_temp.must_refuse('a beta cannot declare a writeback flag', manager,
    $q$select public.beta_declare_flag('fall-pilot', 'writeback.lms_grade_passback', 'no')$q$);
  perform pg_temp.must_refuse('nor a kill switch', manager,
    $q$select public.beta_declare_flag('fall-pilot', 'kill.writeback', 'no')$q$);
  perform pg_temp.become(manager);
  perform public.beta_declare_flag('fall-pilot', 'module.source_freshness_cards', 'From your school on Today');
  reset role;

  -- ── Only a confirmed address sees or takes its invitation ──────────────

  perform pg_temp.become(alice);
  select count(*) into n from public.beta_invitation_for_me();
  reset role;
  perform pg_temp.counted('the invited, confirmed address sees its invitation', n, 1);

  perform pg_temp.become(bob_unconfirmed);
  select count(*) into n from public.beta_invitation_for_me();
  reset role;
  perform pg_temp.counted('the same address, unconfirmed, sees nothing', n, 0);
  perform pg_temp.must_refuse('and cannot take the invitation by its id', bob_unconfirmed,
    format('select public.join_beta(%L)', inv_bob));

  perform pg_temp.become(stranger);
  select count(*) into n from public.beta_invitation_for_me();
  reset role;
  perform pg_temp.counted('an uninvited account sees nothing', n, 0);
  perform pg_temp.must_refuse('an uninvited account cannot take someone else''s invitation', stranger,
    format('select public.join_beta(%L)', inv_alice));

  perform pg_temp.become(alice);
  perform public.join_beta(inv_alice);
  select count(*), bool_and(live) into n, live_now from public.my_beta();
  reset role;
  perform pg_temp.counted('joining makes one live membership', n, 1);

  -- Two joins racing for invitations in different cohorts each lock their
  -- own rows, so the rule that holds is the database's: a second live
  -- membership for the same account is refused whoever writes it.
  begin
    insert into public.beta_cohorts (program_id, kind, capacity) values ('fall-pilot', 'transfer_students', 2)
      returning id into students_two;
    insert into public.beta_memberships (cohort_id, user_id) values (students_two, alice);
    raise exception 'FAILED: an account held two live memberships';
  exception when unique_violation then
    raise notice 'ok  a second live membership for one account is refused by the database';
  end;
  select count(*) into n from pg_catalog.pg_proc p
   where p.oid = 'public.join_beta(uuid)'::regprocedure
     and position('pg_advisory_xact_lock' in p.prosrc) between 1 and position('beta_my_membership' in p.prosrc);
  perform pg_temp.counted('joins by one account are serialized before the membership check', n, 1);
  if not live_now then raise exception 'FAILED: an active program with writeback stopped reads as not live'; end if;
  perform pg_temp.must_refuse('an accepted invitation cannot be taken twice', alice,
    format('select public.join_beta(%L)', inv_alice));

  -- ── Releasing the switch pauses the beta for its members ───────────────

  update public.feature_kill_switch set engaged = false
   where tenant_id = 'beta-check' and switch_key = 'kill.writeback';
  perform pg_temp.become(alice);
  select bool_and(live) into live_now from public.my_beta();
  reset role;
  if live_now then raise exception 'FAILED: the beta reads as live while writeback is possible'; end if;
  raise notice 'ok  releasing kill.writeback makes an active beta read as paused';
  update public.feature_kill_switch set engaged = true
   where tenant_id = 'beta-check' and switch_key = 'kill.writeback';

  -- ── The tables themselves are closed ──────────────────────────────────

  perform pg_temp.must_refuse('a member cannot read the membership table directly', alice,
    'select count(*) from public.beta_memberships');
  perform pg_temp.must_refuse('nor the feedback table', alice,
    'select count(*) from public.beta_feedback');
  perform pg_temp.must_refuse('nor write an invitation for themselves', stranger,
    format('insert into public.beta_invitations (cohort_id, email) values (%L, %L)', students, 'stranger@beta-check.example'));

  -- ── Known issues: published ones, to members of that program ──────────

  perform pg_temp.must_refuse('a member cannot post a known issue', alice,
    $q$select public.beta_post_issue(null, 'fall-pilot', 'x', '', '', 'open', true)$q$);

  perform pg_temp.become(triager);
  issue := public.beta_post_issue(null, 'fall-pilot', 'Sync can lag on hotel wifi', 'Seen twice.', 'Reload.', 'open', false);
  reset role;
  perform pg_temp.become(alice);
  select count(*) into n from public.beta_known_issues_for_me();
  reset role;
  perform pg_temp.counted('an unpublished issue is not shown to members', n, 0);

  perform pg_temp.become(triager);
  perform public.beta_post_issue(issue, 'fall-pilot', 'Sync can lag on hotel wifi', 'Seen twice.', 'Reload.', 'open', true);
  reset role;
  perform pg_temp.become(alice);
  select count(*) into n from public.beta_known_issues_for_me();
  reset role;
  perform pg_temp.counted('a published issue is', n, 1);
  perform pg_temp.become(stranger);
  select count(*) into n from public.beta_known_issues_for_me();
  reset role;
  perform pg_temp.counted('and not to an account outside the beta', n, 0);

  -- ── Feedback reaches triage without its sender ────────────────────────

  perform pg_temp.become(alice);
  perform public.beta_send_feedback('accessibility', 'The drill buttons are hard to reach with a switch.', '#/drill');
  reset role;
  perform pg_temp.must_refuse('an account outside the beta cannot send beta feedback', stranger,
    $q$select public.beta_send_feedback('bug', 'hello', null)$q$);
  perform pg_temp.must_refuse('a route with a query string is refused', alice,
    $q$select public.beta_send_feedback('bug', 'x', '#/work?id=123')$q$);

  perform pg_temp.become(triager);
  select count(*) into n from public.beta_feedback_queue('fall-pilot') where kind = 'accessibility' and cohort_kind = 'students';
  reset role;
  perform pg_temp.counted('the triager reads the feedback, labelled by cohort kind', n, 1);
  perform pg_temp.must_refuse('a member cannot read the queue', alice,
    $q$select count(*) from public.beta_feedback_queue('fall-pilot')$q$);

  select count(*) into n from unnest(regexp_split_to_array(
    pg_get_function_result('public.beta_feedback_queue(text)'::regprocedure), ',\s*')) as col
   where col ~* '(user|email|membership|account|invit)';
  perform pg_temp.counted('the queue has no column that could name the sender', n, 0);

  -- ── Seats come back when an invitation is withdrawn ───────────────────

  perform pg_temp.become(manager);
  perform public.beta_revoke_invitation(inv_bob);
  perform public.beta_invite(students, 'carol@beta-check.example');
  reset role;
  raise notice 'ok  a revoked invitation frees its seat';

  -- ── Leaving is immediate and recorded ─────────────────────────────────

  perform pg_temp.become(alice);
  perform public.leave_beta('Too busy this term.', true);
  select count(*) into n from public.my_beta();
  reset role;
  perform pg_temp.counted('after leaving there is no live membership', n, 0);
  select count(*) into n from public.beta_exit_requests where keeps_account and reason = 'Too busy this term.';
  perform pg_temp.counted('and the exit is recorded with its reason', n, 1);
  perform pg_temp.must_refuse('a member who left cannot send feedback', alice,
    $q$select public.beta_send_feedback('bug', 'still here?', null)$q$);

  -- Leaving a cohort is final for it: the address already has that cohort's
  -- one invitation, so it cannot be sent a second.
  perform pg_temp.must_refuse('a member who left cannot be re-invited to the same cohort', manager,
    format('select public.beta_invite(%L, %L)', students, 'alice@beta-check.example'));

  -- ── Deleting an account takes the beta rows with it ───────────────────

  perform pg_temp.become(alice);
  perform public.forget_my_beta();
  reset role;
  select count(*) into n from public.beta_memberships where user_id = alice;
  perform pg_temp.counted('forget_my_beta removes the memberships', n, 0);
  select count(*) into n from public.beta_feedback;
  perform pg_temp.counted('its feedback goes with them', n, 0);
  select count(*) into n from public.beta_exit_requests;
  perform pg_temp.counted('and its exit record', n, 0);
  select count(*) into n from public.beta_invitations where email = 'alice@beta-check.example';
  perform pg_temp.counted('and invitations to its confirmed address', n, 0);

  perform pg_temp.become(stranger);
  perform public.forget_my_beta();
  reset role;
  select count(*) into n from public.beta_invitations where email = 'carol@beta-check.example';
  perform pg_temp.counted('another account''s forget touches nobody else''s invitation', n, 1);

  -- ── A closed program stays closed ─────────────────────────────────────

  perform pg_temp.become(manager);
  perform public.beta_set_status('fall-pilot', 'closed');
  reset role;
  perform pg_temp.must_refuse('a closed program cannot be reopened', manager,
    $q$select public.beta_set_status('fall-pilot', 'active')$q$);
  perform pg_temp.must_refuse('nor invite anyone', manager,
    format('select public.beta_invite(%L, %L)', students, 'dave@beta-check.example'));

  raise notice 'private beta: every check passed';
end $$;

rollback;
