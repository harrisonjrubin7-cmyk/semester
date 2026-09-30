-- The three retention sweeps from 20260929030000_retention_sweeps.sql.
--
-- Each sweep is checked on both sides of its line — what it must remove and
-- what it must leave — because a sweep that deletes nothing passes every
-- "removes the old one" check that forgets to look, and a sweep that deletes
-- everything passes every "removes the old one" check that does not look at
-- the new one. Then the immutability the audit tables had before this
-- migration is checked to be intact everywhere except the one door the sweep
-- uses, and every sweep is checked to be out of reach of the API's roles.
--
--   How to run it: supabase/check.sh retention-sweeps

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', who::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', who, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.become_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.make_user(address text, confirmed boolean, signed_in boolean, age interval)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, last_sign_in_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', address,
          case when confirmed then now() - age else null end,
          case when signed_in then now() - age else null end,
          now() - age, now() - age);
  return who;
end $$;

create or replace function pg_temp.refused(sql text)
returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when insufficient_privilege or undefined_function or invalid_schema_name then
  return true;
end $$;

create or replace function pg_temp.raises(sql text)
returns boolean language plpgsql as $$
begin
  execute sql;
  return false;
exception when others then
  return true;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

-- ── 1 · Invitations ───────────────────────────────────────────────────────

do $$
declare
  said jsonb;
  cohort uuid;
begin
  perform pg_temp.make_user('taken.up@sweep.example', true, true, interval '200 days');

  insert into public.invites (email, invited_at) values
    ('never.used@sweep.example',  now() - interval '91 days'),
    ('recent.unused@sweep.example', now() - interval '10 days'),
    ('TAKEN.UP@sweep.example',    now() - interval '400 days');

  insert into public.beta_programs (id, name, support_contact)
    values ('sweep-beta', 'Sweep beta', 'help@sweep.example');
  insert into public.beta_cohorts (program_id, kind, capacity)
    values ('sweep-beta', 'students', 10) returning id into cohort;
  insert into public.beta_invitations (cohort_id, email, invited_at, accepted_at, revoked_at) values
    (cohort, 'old.pending@sweep.example',   now() - interval '91 days', null, null),
    (cohort, 'new.pending@sweep.example',   now() - interval '5 days',  null, null),
    (cohort, 'old.accepted@sweep.example',  now() - interval '400 days', now() - interval '399 days', null),
    (cohort, 'old.revoked@sweep.example',   now() - interval '200 days', null, now() - interval '91 days'),
    (cohort, 'fresh.revoked@sweep.example', now() - interval '200 days', null, now() - interval '5 days');

  said := private.sweep_stale_invites();
  perform pg_temp.must('the invite sweep reports what it removed',
    said = jsonb_build_object('invites', 1, 'beta_invitations', 2));

  perform pg_temp.must('an invitation unused for 90 days is removed',
    not exists (select 1 from public.invites where email = 'never.used@sweep.example'));
  perform pg_temp.must('a recent unused invitation is kept',
    exists (select 1 from public.invites where email = 'recent.unused@sweep.example'));
  perform pg_temp.must('an invitation whose address has an account is kept, whatever its age and case',
    exists (select 1 from public.invites where email = 'TAKEN.UP@sweep.example'));

  perform pg_temp.must('a beta invitation never accepted for 90 days is removed',
    not exists (select 1 from public.beta_invitations where email = 'old.pending@sweep.example'));
  perform pg_temp.must('a recent pending beta invitation is kept',
    exists (select 1 from public.beta_invitations where email = 'new.pending@sweep.example'));
  perform pg_temp.must('an accepted beta invitation is kept',
    exists (select 1 from public.beta_invitations where email = 'old.accepted@sweep.example'));
  perform pg_temp.must('a beta invitation revoked 90 days ago is removed',
    not exists (select 1 from public.beta_invitations where email = 'old.revoked@sweep.example'));
  perform pg_temp.must('a beta invitation revoked last week is kept',
    exists (select 1 from public.beta_invitations where email = 'fresh.revoked@sweep.example'));
end $$;

-- ── 2 · Abandoned sign-ups ────────────────────────────────────────────────

do $$
declare
  said jsonb;
  abandoned uuid; recent uuid; confirmed_idle uuid; signed_in_unconfirmed uuid; dormant uuid;
begin
  abandoned             := pg_temp.make_user('abandoned@sweep.example', false, false, interval '31 days');
  recent                := pg_temp.make_user('recent@sweep.example',    false, false, interval '5 days');
  confirmed_idle        := pg_temp.make_user('confirmed@sweep.example', true,  false, interval '400 days');
  signed_in_unconfirmed := pg_temp.make_user('phone@sweep.example',     false, true,  interval '400 days');
  dormant               := pg_temp.make_user('dormant@sweep.example',   true,  true,  interval '1000 days');

  said := private.sweep_abandoned_signups();
  perform pg_temp.must('the account sweep removes exactly the one abandoned sign-up',
    said = jsonb_build_object('removed', 1, 'refused', 0));
  perform pg_temp.must('an unconfirmed, never-used account 31 days old is removed',
    not exists (select 1 from auth.users where id = abandoned));
  perform pg_temp.must('an unconfirmed account inside its 30 days is kept',
    exists (select 1 from auth.users where id = recent));
  perform pg_temp.must('a confirmed account is never swept, even unused',
    exists (select 1 from auth.users where id = confirmed_idle));
  perform pg_temp.must('an account that ever signed in is never swept',
    exists (select 1 from auth.users where id = signed_in_unconfirmed));
  perform pg_temp.must('a dormant account that was used is kept (the privacy promise)',
    exists (select 1 from auth.users where id = dormant));
end $$;

-- ── 3 · Audit events ──────────────────────────────────────────────────────

do $$
declare
  said jsonb;
  h text := repeat('a', 64);
begin
  insert into public.schools (id, name) values ('sweep-u', 'Sweep University');

  insert into public.role_grant_audit_event
    (grant_id, action, role, scope_kind, scope_id, provenance, subject_sha256, actor_kind, occurred_at) values
    (gen_random_uuid(), 'insert', 'student', 'school', 'sweep-u', 'manual', h, 'service', now() - interval '3 years 1 day'),
    (gen_random_uuid(), 'insert', 'student', 'school', 'sweep-u', 'manual', h, 'service', now() - interval '2 years');
  insert into public.moderation_audit_event
    (report_id, from_status, to_status, reporter_sha256, actor_kind, occurred_at) values
    (gen_random_uuid(), 'open', 'closed', h, 'service', now() - interval '3 years 1 day'),
    (gen_random_uuid(), 'open', 'closed', h, 'service', now() - interval '2 years');
  insert into public.provisioning_audit_event
    (tenant_id, request_id, resource_type, action, outcome, occurred_at) values
    ('sweep-u', 'req-old', 'User', 'create', 'accepted', now() - interval '3 years 1 day'),
    ('sweep-u', 'req-new', 'User', 'create', 'accepted', now() - interval '2 years');

  insert into public.support_access_event
    (tenant_id, grant_id, action, student_sha256, supporter_sha256, occurred_at) values
    ('sweep-u', gen_random_uuid(), 'signals_viewed', h, h, now() - interval '5 years');

  -- The immutability that was there before, still there without the flag.
  perform pg_temp.must('an old role-grant event cannot be deleted outside the sweep',
    pg_temp.raises($q$delete from public.role_grant_audit_event where occurred_at < now() - interval '3 years'$q$));
  perform pg_temp.must('an old moderation event cannot be deleted outside the sweep',
    pg_temp.raises($q$delete from public.moderation_audit_event where occurred_at < now() - interval '3 years'$q$));
  perform pg_temp.must('an old provisioning event cannot be deleted outside the sweep',
    pg_temp.raises($q$delete from public.provisioning_audit_event where occurred_at < now() - interval '3 years'$q$));
  perform pg_temp.must('and none can be edited',
    pg_temp.raises($q$update public.role_grant_audit_event set role = 'x'$q$));
end $$;

-- The flag alone does not open a recent row. Its own block, because a failed
-- delete aborts the statement and the flag is transaction-local.
do $$
begin
  perform set_config('semester.audit_retention', 'sweep', true);
  perform pg_temp.must('with the flag set, a recent role-grant event still cannot be deleted',
    pg_temp.raises($q$delete from public.role_grant_audit_event where occurred_at > now() - interval '3 years'$q$));
  perform pg_temp.must('with the flag set, a recent moderation event still cannot be deleted',
    pg_temp.raises($q$delete from public.moderation_audit_event where occurred_at > now() - interval '3 years'$q$));
  perform pg_temp.must('with the flag set, a recent provisioning event still cannot be deleted',
    pg_temp.raises($q$delete from public.provisioning_audit_event where occurred_at > now() - interval '3 years'$q$));
  perform pg_temp.must('with the flag set, an old event still cannot be edited',
    pg_temp.raises($q$update public.moderation_audit_event set to_status = 'x' where occurred_at < now() - interval '3 years'$q$));
  perform set_config('semester.audit_retention', '', true);
end $$;

do $$
declare said jsonb;
begin
  said := private.sweep_audit_retention();
  perform pg_temp.must('the audit sweep removes one row from each of the three tables',
    said = jsonb_build_object('role_grant_audit_event', 1, 'moderation_audit_event', 1, 'provisioning_audit_event', 1, 'audit_event', 0));
  perform pg_temp.must('and keeps the event two years old in each',
    (select count(*) from public.role_grant_audit_event where scope_id = 'sweep-u') = 1
    and (select count(*) from public.moderation_audit_event where occurred_at > now() - interval '3 years') >= 1
    and exists (select 1 from public.provisioning_audit_event where request_id = 'req-new'));
  perform pg_temp.must('and leaves the flag cleared behind it',
    coalesce(current_setting('semester.audit_retention', true), '') = '');
  perform pg_temp.must('and the disclosure record FERPA needs kept is not touched, however old',
    exists (select 1 from public.support_access_event where tenant_id = 'sweep-u'));
end $$;

-- ── 4 · None of it is reachable from the API ──────────────────────────────

do $$
declare someone uuid := '00000000-0000-4000-8000-0000000005e1';
begin
  perform pg_temp.become(someone);
  perform pg_temp.must('a signed-in account cannot run the invite sweep',
    pg_temp.refused('select private.sweep_stale_invites()'));
  perform pg_temp.must('a signed-in account cannot run the account sweep',
    pg_temp.refused('select private.sweep_abandoned_signups()'));
  perform pg_temp.must('a signed-in account cannot run the audit sweep',
    pg_temp.refused('select private.sweep_audit_retention()'));
end $$;

reset role;

do $$
begin
  perform pg_temp.become_anon();
  perform pg_temp.must('anon cannot run the invite sweep',
    pg_temp.refused('select private.sweep_stale_invites()'));
  perform pg_temp.must('anon cannot run the account sweep',
    pg_temp.refused('select private.sweep_abandoned_signups()'));
  perform pg_temp.must('anon cannot run the audit sweep',
    pg_temp.refused('select private.sweep_audit_retention()'));
end $$;

reset role;

-- And by grant, not only by schema usage: were `private` ever opened to the
-- API roles, the function grants are what would still stand.
do $$
begin
  perform pg_temp.must('no API role holds EXECUTE on any sweep',
    not exists (
      select 1 from unnest(array['private.sweep_stale_invites()', 'private.sweep_abandoned_signups()',
                                 'private.sweep_audit_retention()']) f,
                    unnest(array['anon', 'authenticated', 'public']) r
       where has_function_privilege(case when r = 'public' then 'anon' else r end, f, 'execute')));
  perform pg_temp.must('the service role can run them by hand',
    has_function_privilege('service_role', 'private.sweep_audit_retention()', 'execute')
    and has_function_privilege('service_role', 'private.sweep_stale_invites()', 'execute')
    and has_function_privilege('service_role', 'private.sweep_abandoned_signups()', 'execute'));
end $$;

rollback;
