-- Where a school stands in the pilot-to-production lifecycle (tenant_rollout),
-- the evidence behind each move, and the history.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold: only the service role writes, so a school's administrator
-- cannot move their own school to production; each forward move is one step
-- and needs the leaving state's exit-gate evidence, recorded since the school
-- entered that state; stepping down needs none; a hold resumes only to where
-- it was held; archiving only from offboarding with a certificate; evidence and
-- history cannot be rewritten; and reads stay inside the school.

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

-- Evidence for every exit gate of a state, as the service role.
create or replace function pg_temp.evidence(school text, gates text[])
returns void language plpgsql as $$
declare g text;
begin
  foreach g in array gates loop
    insert into public.tenant_rollout_evidence (tenant_id, gate, evidence, approved_by)
    values (school, g, 'check: ' || g, 'Check Approver, Registrar');
  end loop;
end $$;

create or replace function pg_temp.move(school text, target text, why text)
returns void language plpgsql as $$
begin
  update public.tenant_rollout set state = target, reason = why where tenant_id = school;
end $$;

do $$
declare
  north_admin uuid;
  south_admin uuid;
  n bigint;
  s text;
begin
  insert into public.schools (id, name, email_domains) values
    ('north-roll', 'North Rollout University', array['north-roll.example']),
    ('south-roll', 'South Rollout College', array['south-roll.example']);
  north_admin := pg_temp.newuser('admin@north-roll.example', 'north-roll');
  south_admin := pg_temp.newuser('admin@south-roll.example', 'south-roll');
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (north_admin, 'university_admin', 'school', 'north-roll', 'institution'),
    (south_admin, 'university_admin', 'school', 'south-roll', 'institution');

  set local role service_role;

  -- Entry.
  if not pg_temp.refused($q$insert into public.tenant_rollout (tenant_id, state, reason) values ('north-roll', 'production_active', 'skip')$q$) then
    raise exception 'FAILED: a school entered the rollout already in production';
  end if;
  raise notice 'ok  a school cannot enter the rollout in production';
  insert into public.tenant_rollout (tenant_id, state, reason) values ('north-roll', 'directory', 'listed');

  -- The control: with the evidence on file, one step forward is accepted.
  perform pg_temp.evidence('north-roll', array['institution_request']);
  perform pg_temp.move('north-roll', 'requested', 'provost asked');
  select state into s from public.tenant_rollout where tenant_id = 'north-roll';
  perform pg_temp.answered('with its gate evidenced, a school moves one step', s, 'requested');

  -- Without evidence, the next step is refused.
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'claimed', 'no evidence')$q$) then
    raise exception 'FAILED: a school moved forward with no gate evidence';
  end if;
  raise notice 'ok  a forward move with no evidence is refused';

  -- Skipping steps is refused even with every gate on file.
  perform pg_temp.evidence('north-roll', array['sponsor_qualified', 'security_kickoff',
    'security_privacy_approval', 'dpa_executed', 'uat_signoff', 'rls_isolation_passed', 'sso_login_verified']);
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'sandbox_uat', 'jump')$q$) then
    raise exception 'FAILED: a school skipped from requested to sandbox';
  end if;
  raise notice 'ok  a school cannot skip a step';

  -- A transition needs its own reason.
  if not pg_temp.refused($q$update public.tenant_rollout set state = 'claimed' where tenant_id = 'north-roll'$q$) then
    raise exception 'FAILED: a transition reused the previous reason';
  end if;
  raise notice 'ok  a transition needs its own reason';

  -- Evidence recorded before entering a state does not count for leaving it:
  -- security_kickoff above was recorded while requested, so leaving claimed needs it again.
  perform pg_temp.move('north-roll', 'claimed', 'sponsor named');
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'security_review', 'stale evidence')$q$) then
    raise exception 'FAILED: evidence from before the state was entered was accepted';
  end if;
  raise notice 'ok  evidence recorded before entering a state does not carry';

  -- Nor can a caller date evidence back to before the state began, or ahead of
  -- it: recorded_at is always the clock at insert. That row, stamped now, is
  -- after entry, so it is what lets the school leave claimed.
  insert into public.tenant_rollout_evidence (tenant_id, gate, evidence, approved_by, recorded_at)
  values ('north-roll', 'security_kickoff', 'dated by the caller', 'Someone', now() - interval '1 day');
  select count(*) into n from public.tenant_rollout_evidence
   where tenant_id = 'north-roll' and evidence = 'dated by the caller' and recorded_at < now();
  perform pg_temp.counted('a supplied recorded_at is replaced by the clock', n, 0);

  -- Walk to pilot write-enabled, gate by gate.
  perform pg_temp.move('north-roll', 'security_review', 'kickoff held');
  perform pg_temp.evidence('north-roll', array['security_privacy_approval', 'dpa_executed']);
  perform pg_temp.move('north-roll', 'sandbox_uat', 'DPA signed');
  perform pg_temp.evidence('north-roll', array['uat_signoff', 'rls_isolation_passed', 'sso_login_verified']);
  perform pg_temp.move('north-roll', 'pilot_read_only', 'UAT signed off');
  perform pg_temp.evidence('north-roll', array['source_reconciliation_passed', 'accessibility_review_passed', 'data_quality_adoption']);
  perform pg_temp.move('north-roll', 'pilot_write_enabled', 'reads reconciled');
  select count(*) into n from public.tenant_rollout_history where tenant_id = 'north-roll';
  perform pg_temp.counted('each transition is kept', n, 7);

  -- Rolling back is always allowed, and the gate must then be earned again.
  perform pg_temp.move('north-roll', 'pilot_read_only', 'passback discrepancy');
  select state into s from public.tenant_rollout where tenant_id = 'north-roll';
  perform pg_temp.answered('stepping down needs no evidence', s, 'pilot_read_only');
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'pilot_write_enabled', 'retry')$q$) then
    raise exception 'FAILED: a rolled-back school reused its earlier gate evidence';
  end if;
  raise notice 'ok  after a rollback the gate is earned again';

  -- Holds resume only to where they were held, with remediation.
  perform pg_temp.move('north-roll', 'paused', 'term break');
  select resume_state into s from public.tenant_rollout where tenant_id = 'north-roll';
  perform pg_temp.answered('a pause remembers where it was held', s, 'pilot_read_only');
  perform pg_temp.move('north-roll', 'suspended', 'incident');
  select resume_state into s from public.tenant_rollout where tenant_id = 'north-roll';
  perform pg_temp.answered('escalating to suspended keeps it', s, 'pilot_read_only');
  perform pg_temp.evidence('north-roll', array['remediation']);
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'production_active', 'resume higher')$q$) then
    raise exception 'FAILED: a suspended school resumed above where it was held';
  end if;
  raise notice 'ok  a hold cannot resume anywhere but where it was held';
  perform pg_temp.move('north-roll', 'pilot_read_only', 'remediated');
  select coalesce(resume_state, 'null') into s from public.tenant_rollout where tenant_id = 'north-roll';
  perform pg_temp.answered('resuming clears the hold', s, 'null');

  -- Archive only from offboarding, with a certificate.
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'archived', 'straight to archive')$q$) then
    raise exception 'FAILED: a live school was archived without offboarding';
  end if;
  perform pg_temp.move('north-roll', 'offboarding', 'contract ended');
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'archived', 'no certificate')$q$) then
    raise exception 'FAILED: a school was archived without a completion certificate';
  end if;
  perform pg_temp.evidence('north-roll', array['completion_certificate']);
  perform pg_temp.move('north-roll', 'archived', 'export delivered');
  if not pg_temp.refused($q$select pg_temp.move('north-roll', 'offboarding', 'reopen')$q$) then
    raise exception 'FAILED: an archived school moved';
  end if;
  raise notice 'ok  archive only from offboarding with a certificate, and it is final';

  insert into public.tenant_rollout (tenant_id, state, reason) values ('south-roll', 'requested', 'asked');
  reset role;

  -- A school administrator cannot write their own lifecycle or evidence.
  perform pg_temp.become(south_admin);
  if not pg_temp.refused($q$update public.tenant_rollout set state = 'claimed', reason = 'self' where tenant_id = 'south-roll'$q$) then
    raise exception 'FAILED: a school administrator moved their own school';
  end if;
  select count(*) into n from public.tenant_rollout where tenant_id = 'south-roll' and state = 'requested';
  if n <> 1 then raise exception 'FAILED: a school administrator''s update changed the state'; end if;
  if not pg_temp.refused($q$insert into public.tenant_rollout_evidence (tenant_id, gate, evidence, approved_by) values ('south-roll', 'sponsor_qualified', 'self', 'me')$q$) then
    raise exception 'FAILED: a school administrator recorded their own gate evidence';
  end if;
  reset role;
  raise notice 'ok  a school administrator cannot write a lifecycle or its evidence';

  -- Reads stay inside the school.
  perform pg_temp.become(south_admin);
  select count(*) into n from public.tenant_rollout where tenant_id = 'south-roll';
  perform pg_temp.counted('an administrator reads their own school''s rollout', n, 1);
  select count(*) into n from public.tenant_rollout where tenant_id = 'north-roll';
  perform pg_temp.counted('and none of another school''s', n, 0);
  select count(*) into n from public.tenant_rollout_evidence where tenant_id = 'north-roll';
  perform pg_temp.counted('nor its evidence', n, 0);
  reset role;

  -- Evidence and history are immutable, even to the table owner.
  if not pg_temp.refused($q$update public.tenant_rollout_evidence set evidence = 'rewritten' where tenant_id = 'north-roll'$q$) then
    raise exception 'FAILED: rollout evidence was rewritten';
  end if;
  if not pg_temp.refused($q$delete from public.tenant_rollout_history where tenant_id = 'north-roll'$q$) then
    raise exception 'FAILED: rollout history was deleted';
  end if;
  raise notice 'ok  evidence and history cannot be rewritten';

  raise notice 'tenant rollout: every check passed';
end $$;

rollback;
