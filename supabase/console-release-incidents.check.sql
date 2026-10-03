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
    (tenant_id, incident_ref, audience, sections, details, approved_by, next_update_at)
  values
    (null, 'incident-recovered', 'admin_outage', jsonb_build_object(
      'what_happened', 'NOTICE-BODY-CANARY service interruption.',
      'who_is_affected', 'Institution administrators.',
      'what_is_impacted', 'Sign in.',
      'what_to_do_now', 'Retry sign in.',
      'what_semester_is_doing', 'Monitoring recovery.',
      'next_update', 'This is the resolution update.',
      'where_to_get_help', 'Use the support route.'),
      '{}'::jsonb, array['Incident commander'], now() + interval '30 minutes');

  insert into public.approval_request
    (duty_id, requester, tenant_id, target, detail, evidence, ticket, status)
  values
    ('release', operator, null, 'platform', '{"action":"release"}', 'CI, golden path and rollback rehearsal references.', 'REL-100', 'pending'),
    ('release', operator, null, 'incident-rollback', '{"action":"rollback"}', 'Incident and rollback evidence references.', 'INC-100', 'approved');
end $$;

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text; n bigint;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('missing release evidence is blocked', state, 'blocked');

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

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('current prerequisites plus an exact approval produce a release candidate', state, 'release_candidate');
end $$;

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, deployment_id, rollback_ref, observed_at)
values
  ('production_deployment', 'pass', 'Engineering owner', 'DEPLOY-1', 'Vercel production deployment', repeat('a', 40), 'deployment-1', 'RUNBOOK-ROLLBACK-1', now());

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('a deployment without current post-deploy evidence is unverified', state, 'deployed_unverified');
end $$;

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, observed_at)
values
  ('production_verification', 'pass', 'Operations owner', 'VERIFY-WRONG', 'production browser verification', repeat('b', 40), now());

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  perform pg_temp.nobody();
  perform pg_temp.said('verification for a different commit cannot clear the release', state, 'deployed_unverified');
end $$;

insert into public.platform_release_evidence
  (gate, status, approved_by, evidence, source, commit_sha, observed_at)
values
  ('production_verification', 'pass', 'Operations owner', 'VERIFY-EXACT', 'production browser verification', repeat('a', 40), now() + interval '1 second');

do $$
declare operator uuid := (select v from ids where k = 'operator'); state text; n bigint; leaked text;
begin
  perform pg_temp.become(operator);
  select r.state into state from public.console_release_incidents(false) r where item_kind = 'release';
  select count(*) into n from public.console_release_incidents(false) r
    where r.state in ('incident', 'rollback', 'recovered');
  select string_agg(row_to_json(r)::text, '') into leaked from public.console_release_incidents(false) r;
  perform pg_temp.nobody();
  perform pg_temp.said('exact current post-deploy evidence verifies the release summary', state, 'verified');
  perform pg_temp.counted('incident, rollback and recovered states are explicit', n, 3);
  if leaked like '%NOTICE-BODY-CANARY%' then raise exception 'FAILED: notice body leaked'; end if;
  raise notice 'ok  incident notice bodies are not returned';
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
