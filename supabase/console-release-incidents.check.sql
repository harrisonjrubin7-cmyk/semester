-- Release and incident console read model. LOCAL/DISPOSABLE DATABASES ONLY.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  begin execute statement; exception when insufficient_privilege then perform pg_temp.nobody(); return true; end;
  perform pg_temp.nobody();
  return false;
end $$;

create temp table ids (k text primary key, v uuid not null);

do $$
declare
  operator uuid := gen_random_uuid();
  shell_only uuid := gen_random_uuid();
  domain_only uuid := gen_random_uuid();
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('release-live', 'Release Live University', array['release-live.example'], false),
    ('release-demo', 'Release Demo University', array['release-demo.example'], true);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (operator, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@release-live.example', now(), now(), now()),
    (shell_only, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'shell@release-live.example', now(), now(), now()),
    (domain_only, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'domain@release-live.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (operator, 'incident_responder', 'platform', '', 'platform'),
    (shell_only, 'platform_admin', 'platform', '', 'platform'),
    (domain_only, 'incident_responder', 'school', 'release-live', 'platform');
  insert into public.council_seat_holder (seat, subject) values ('engineering', operator);
  insert into ids values ('operator', operator), ('shell', shell_only), ('domain', domain_only);

  insert into public.platform_incident
    (public_id, tenant_id, title, severity, status, owner, affected_workflows, customer_impact, started_at)
  values
    ('incident-live', 'release-live', 'Live workflow interruption', 'high', 'investigating', 'incident commander', array['Today', 'Plan'], 'Students may not see current deadlines.', now() - interval '20 minutes'),
    ('incident-demo', 'release-demo', 'Demo workflow interruption', 'medium', 'mitigating', 'incident commander', array['Demo Today'], 'Synthetic demo workflow delayed.', now() - interval '10 minutes');

  insert into public.platform_incident
    (public_id, tenant_id, title, severity, status, owner, affected_workflows, customer_impact, started_at, release_commit, rollback_ref)
  values
    ('incident-rollback', null, 'Release rollback in progress', 'critical', 'rollback', 'engineering', array['application'], 'Some requests may fail during rollback.', now() - interval '15 minutes', repeat('a', 40), 'RUNBOOK-ROLLBACK-1');

  insert into public.platform_incident
    (public_id, tenant_id, title, severity, status, owner, affected_workflows, customer_impact, started_at, recovered_at)
  values
    ('incident-recovered', null, 'Recovered service interruption', 'high', 'recovered', 'incident commander', array['sign in'], 'Sign in was unavailable and is now recovered.', now() - interval '2 hours', now() - interval '1 hour');

  insert into public.governance_incident_notices
    (tenant_id, incident_ref, audience, sections, details, approved_by, sent_at, next_update_at)
  values
    (null, 'incident-recovered', 'admin_outage', jsonb_build_object(
      'what_happened', 'NOTICE-BODY-CANARY service interruption.',
      'who_is_affected', 'Institution administrators.',
      'what_is_impacted', 'Sign in.',
      'what_to_do_now', 'Retry sign in.',
      'what_semester_is_doing', 'Monitoring recovery.',
      'next_update', 'Another update will follow.',
      'where_to_get_help', 'Use the support route.'),
      -- Before recovered_at (now() - 1 hour), so this is not a post-recovery
      -- notice. next_update_at stays inside the 60-minute admin_outage cadence.
      '{}'::jsonb, array['Incident commander'], now() - interval '90 minutes', now() - interval '40 minutes');

  insert into public.governance_incident_notices
    (tenant_id, incident_ref, audience, sections, details, approved_by, sent_at, next_update_at)
  values
    (null, 'incident-live', 'admin_outage', jsonb_build_object(
      'what_happened', 'A service interruption is under investigation.',
      'who_is_affected', 'Institution administrators.',
      'what_is_impacted', 'Today and Plan.',
      'what_to_do_now', 'Use the documented fallback.',
      'what_semester_is_doing', 'Investigating the interruption.',
      'next_update', 'Another update will follow.',
      'where_to_get_help', 'Use the support route.'),
      '{}'::jsonb, array['Incident commander'], now() - interval '20 minutes', now() + interval '30 minutes');

  insert into public.approval_request
    (duty_id, requester, tenant_id, target, detail, evidence, ticket, status)
  values
    ('release', operator, null, 'platform', jsonb_build_object('action', 'release', 'release_commit', repeat('a', 40)), 'CI, golden path and rollback rehearsal references.', 'REL-100', 'pending'),
    ('release', operator, null, 'incident-rollback', '{"action":"rollback"}', 'Incident and rollback evidence references.', 'INC-100', 'approved');
end $$;

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text; n bigint; blocked boolean := false;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('missing release evidence is blocked', state, 'blocked');

  perform pg_temp.become(operator);
  begin
    perform public.request_approval(
      'release', null, 'platform',
      jsonb_build_object('action', 'release', 'release_commit', repeat('a', 40)),
      'CI, golden path and rollback rehearsal references.', 'REL-BLOCKED', null
    );
  exception when check_violation then blocked := true;
  end;
  perform pg_temp.nobody();
  if not blocked then raise exception 'FAILED: blocked release prerequisites allowed an approval request'; end if;
  raise notice 'ok  release prerequisites are enforced at the approval write boundary';

  perform pg_temp.become(operator);
  select count(*) into n from public.console_release_incidents(false) r where item_kind = 'incident' and r.is_demo;
  perform pg_temp.nobody();
  perform pg_temp.counted('demo incidents are excluded by default', n, 0);

  perform pg_temp.become(operator);
  select count(*) into n from public.console_release_incidents(true) r where item_id = 'incident-demo';
  perform pg_temp.nobody();
  perform pg_temp.counted('explicit demo inclusion still needs exact implementation scope', n, 0);
end $$;

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, observed_at)
values
  ('production_restore', 'pass', 'Engineering owner', 'RESTORE-1', 'paid restore drill', null, now()),
  ('legal_approval', 'pass', 'Legal owner', 'LEGAL-1', 'signed legal record', null, now()),
  ('paid_infrastructure', 'pass', 'Engineering owner', 'INFRA-1', 'infrastructure provider', null, now()),
  ('domain_tls', 'pass', 'Engineering owner', 'TLS-1', 'public DNS and TLS probe', null, now()),
  ('production_migrations', 'pass', 'Data owner', 'MIGRATION-1', 'Supabase migration result', repeat('a', 40), now());

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, rollback_ref, observed_at, expires_at)
values
  ('production_deployment', 'pass', 'Engineering owner', 'DEPLOY-STALE', 'expired production deployment', repeat('b', 40), 'deployment-stale', 'RUNBOOK-STALE', now() - interval '30 days', now() - interval '1 day');

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text; commit text; duplicate_blocked boolean := false;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('current prerequisites plus an exact approval produce a release candidate', state, 'release_candidate');

  perform pg_temp.become(operator);
  select r.release_commit into commit from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('an expired deployment cannot replace the current migration commit', commit, repeat('a', 40));

  perform pg_temp.become(operator);
  begin
    perform public.request_approval(
      'release', null, 'platform',
      jsonb_build_object('action', 'release', 'release_commit', repeat('a', 40)),
      'CI, golden path and rollback rehearsal references.', 'REL-DUPLICATE', null
    );
  exception when unique_violation then duplicate_blocked := true;
  end;
  perform pg_temp.nobody();
  if not duplicate_blocked then raise exception 'FAILED: duplicate current exact-commit release request was created'; end if;
  raise notice 'ok  a current exact-commit release request cannot be duplicated';
end $$;

delete from public.approval_request
 where duty_id = 'release'
   and tenant_id is null
   and target = 'platform'
   and detail ->> 'action' = 'release';

do $$
declare operator uuid := (select v from ids where k = 'operator'); made uuid;
begin
  perform pg_temp.become(operator);
  made := public.request_approval(
    'release', null, 'platform',
    jsonb_build_object('action', 'release', 'release_commit', repeat('a', 40)),
    'CI, golden path and rollback rehearsal references.', 'REL-BOUND', null
  );
  perform pg_temp.nobody();
  if made is null then raise exception 'FAILED: current exact-commit release request was not created'; end if;
  raise notice 'ok  current prerequisites permit one exact-commit approval request';
end $$;

delete from public.approval_request where ticket = 'REL-BOUND';

insert into public.approval_request
  (duty_id, requester, tenant_id, target, detail, evidence, ticket, status, expires_at)
select 'release', v, null, 'platform', jsonb_build_object('action', 'release', 'release_commit', repeat('a', 40)), 'Expired evidence.', 'REL-EXPIRED', 'pending', now() - interval '1 second'
from ids where k = 'operator';

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('an expired approval cannot create a release candidate', state, 'blocked');
end $$;

delete from public.approval_request where ticket = 'REL-EXPIRED';

-- now() does not advance inside this transaction, and recorded_at defaults to
-- that same instant. latest evidence is ordered by observed_at, then
-- recorded_at, then a random uuid, so rows stamped together have no insertion
-- order. The deployment is early enough that each later observation can be
-- strictly newer and still not future-dated.
insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, rollback_ref, observed_at)
values
  ('production_deployment', 'pass', 'Engineering owner', 'DEPLOY-1', 'Vercel production deployment', repeat('a', 40), 'deployment-1', 'RUNBOOK-ROLLBACK-1', now() - interval '3 minutes');

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, observed_at)
values
  ('production_verification', 'pass', 'Operations owner', 'VERIFY-BEFORE-DEPLOY', 'earlier production browser verification', repeat('a', 40), 'deployment-1', now() - interval '1 hour');

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('a deployment without current post-deploy evidence is unverified', state, 'deployed_unverified');
end $$;

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, observed_at)
values
  ('production_verification', 'pass', 'Operations owner', 'VERIFY-WRONG', 'production browser verification', repeat('b', 40), 'deployment-1', now() - interval '2 minutes');

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, observed_at)
values
  ('production_verification', 'pass', 'Operations owner', 'VERIFY-FUTURE', 'future clock probe', repeat('a', 40), 'deployment-1', now() + interval '1 hour');

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('future-dated verification cannot clear the release', state, 'deployed_unverified');
end $$;

delete from public.platform_release_evidence where evidence in ('VERIFY-FUTURE', 'VERIFY-BEFORE-DEPLOY');

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('verification for a different commit cannot clear the release', state, 'deployed_unverified');
end $$;

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, observed_at)
values
  ('production_verification', 'pass', 'Operations owner', 'VERIFY-WRONG-DEPLOYMENT', 'production browser verification', repeat('a', 40), 'deployment-0', now() - interval '1 minute');

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text; action text; n bigint;
begin
  perform pg_temp.become(operator);
  select r.state, r.next_safe_action into state, action
    from public.console_release_incidents(false) r where item_kind = 'release';
  select count(*) into n from public.console_command_center(false) c
    where c.id = 'gate:production_verification' and c.status = 'mismatched_deployment';
  perform pg_temp.nobody();
  perform pg_temp.said('verification for a different deployment cannot clear the release', state, 'deployed_unverified');
  perform pg_temp.counted('the command center reports the same deployment mismatch', n, 1);
  if action not ilike 'Run the production smoke%' then
    raise exception 'FAILED: mismatched verification did not direct a new production check: %', action;
  end if;
  raise notice 'ok  unbound verification guidance matches the deployed_unverified state';
end $$;

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, observed_at)
values
  ('production_verification', 'pass', 'Operations owner', 'VERIFY-EXACT', 'production browser verification', repeat('a', 40), 'deployment-1', now());

do $$
declare operator uuid := (select v from ids where k = 'operator'); request_id uuid; blocked boolean := false;
begin
  insert into public.approval_request
    (duty_id, requester, tenant_id, target, detail, evidence, ticket, status)
  values
    ('release', operator, null, 'platform',
     jsonb_build_object('action', 'release', 'release_commit', repeat('a', 40)),
     'Approval that will outlive one prerequisite.', 'REL-REVALIDATE', 'approved')
  returning id into request_id;

  insert into public.platform_release_evidence
    (gate, status, approved_by, evidence, source, observed_at)
  values
    ('legal_approval', 'fail', 'Legal owner', 'LEGAL-REVOKED', 'superseding legal record', now() + interval '1 second');

  begin
    update public.approval_request set status = 'executed', executed_at = now() where id = request_id;
  exception when check_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'FAILED: release execution survived a superseded prerequisite';
  end if;
  delete from public.platform_release_evidence where evidence = 'LEGAL-REVOKED';
  delete from public.approval_request where id = request_id;
  raise notice 'ok  release prerequisites are revalidated at execution';
end $$;

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text; n bigint;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  select count(*) into n from public.console_command_center(false) c
    where c.id = 'gate:release_approval' and c.status = 'missing_exact_approval';
  perform pg_temp.nobody();
  perform pg_temp.said('matching deployment evidence without an executed approval stays unverified', state, 'deployed_unverified');
  perform pg_temp.counted('the command center reports the exact-approval gap', n, 1);
end $$;

insert into public.approval_request
  (duty_id, requester, tenant_id, target, detail, evidence, ticket, status, executed_at)
select 'release', v, null, 'platform',
       jsonb_build_object('action', 'release', 'release_commit', repeat('a', 40)),
       'Executed exact-commit release authorization.', 'REL-EXECUTED', 'executed', now()
from ids where k = 'operator';

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text; n bigint; incident_count bigint; global_notice_count bigint; leaked text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  select count(*) into incident_count from public.console_release_incidents(false) r
    where r.state in ('incident', 'rollback', 'recovered');
  select string_agg(row_to_json(r)::text, '') into leaked from public.console_release_incidents(false) r;
  select count(*) into n from public.console_release_incidents(false) r
   where r.item_id = 'incident-recovered' and r.communication_status = 'missing';
  select count(*) into global_notice_count from public.console_release_incidents(false) r
   where r.item_id = 'incident-live' and r.communication_status = 'current';
  perform pg_temp.nobody();
  perform pg_temp.said('exact current post-deploy evidence verifies the release summary', state, 'verified');
  perform pg_temp.counted('incident, rollback and recovered states are explicit', incident_count, 3);
  perform pg_temp.counted('recovery is not communication-complete without a post-recovery notice', n, 1);
  perform pg_temp.counted('a platform-wide notice covers a tenant incident', global_notice_count, 1);
  if leaked like '%NOTICE-BODY-CANARY%' then raise exception 'FAILED: notice body leaked'; end if;
  raise notice 'ok  incident notice bodies are not returned';
end $$;

do $$
declare operator uuid := (select v from ids where k = 'operator'); action text; status text;
begin
  perform pg_temp.become(operator);
  select r.next_safe_action, r.rollback_status into action, status
    from public.console_release_incidents(false) r where r.item_id = 'incident-rollback';
  perform pg_temp.nobody();
  perform pg_temp.said('a rollback approval without the incident commit is ignored', status, 'documented');
  if action not ilike 'Request%rollback approval%' then
    raise exception 'FAILED: an unapproved rollback was directed to execution: %', action;
  end if;
  raise notice 'ok  rollback execution waits for an executed approval';
end $$;

insert into public.approval_request
  (duty_id, requester, tenant_id, target, detail, evidence, ticket, status, executed_at)
select 'release', v, null, 'incident-rollback',
       jsonb_build_object('action', 'rollback', 'incident_ref', 'incident-rollback', 'release_commit', repeat('a', 40)),
       'Executed exact-commit rollback authorization.', 'INC-EXACT', 'executed', now()
from ids where k = 'operator';

do $$
declare operator uuid := (select v from ids where k = 'operator'); action text; status text;
begin
  perform pg_temp.become(operator);
  select r.next_safe_action, r.rollback_status into action, status
    from public.console_release_incidents(false) r where r.item_id = 'incident-rollback';
  perform pg_temp.nobody();
  perform pg_temp.said('an exact rollback approval is surfaced', status, 'executed');
  if action not ilike 'Use the executed exact-commit rollback authorization%' then
    raise exception 'FAILED: exact rollback authorization was not selected: %', action;
  end if;
  raise notice 'ok  rollback authorization is bound to the incident commit';
end $$;

do $$
declare operator uuid := (select v from ids where k = 'operator'); n bigint;
begin
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance)
    values (operator, 'implementation_manager', 'school', 'release-demo', 'platform');
  perform pg_temp.become(operator);
  select count(*) into n from public.console_release_incidents(true) r where item_id = 'incident-demo';
  perform pg_temp.nobody();
  perform pg_temp.counted('an exact demo implementation grant permits explicit inclusion', n, 1);
end $$;

do $$
begin
  if not pg_temp.refused((select v from ids where k = 'shell'), 'select count(*) from public.console_release_incidents(false)') then
    raise exception 'FAILED: console shell alone read release incidents';
  end if;
  raise notice 'ok  console shell alone is refused';
  if not pg_temp.refused((select v from ids where k = 'domain'), 'select count(*) from public.console_release_incidents(false)') then
    raise exception 'FAILED: school-scoped incident capability read platform release incidents';
  end if;
  raise notice 'ok  platform-scoped incident authority is required';
end $$;

do $$
declare result text;
begin
  perform pg_temp.become((select v from ids where k = 'operator'));
  select pg_get_function_result('public.console_release_incidents(boolean)'::regprocedure) into result;
  perform pg_temp.nobody();
  if result ~* '(sections|details|recorded_by|sent_by)' then
    raise exception 'FAILED: sensitive or internal columns are in the response contract: %', result;
  end if;
  raise notice 'ok  response contract excludes notice bodies and recorder identities';
end $$;

rollback;
