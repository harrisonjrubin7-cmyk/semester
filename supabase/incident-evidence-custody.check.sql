-- Protected incident-evidence custody. LOCAL/DISPOSABLE DATABASE ONLY.

begin;

create or replace function pg_temp.become(who uuid, with_mfa boolean default false)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', who::text, 'role', 'authenticated',
    'aal', case when with_mfa then 'aal2' else 'aal1' end,
    'amr', case when with_mfa then jsonb_build_array(jsonb_build_object(
      'method', 'totp', 'timestamp', extract(epoch from now())
    )) else '[]'::jsonb end
  )::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.refused(who uuid, statement text, with_mfa boolean default false)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who, with_mfa);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create temp table ids (k text primary key, v uuid not null);

do $$
declare
  operator uuid := gen_random_uuid();
  no_mfa uuid := gen_random_uuid();
  school_only uuid := gen_random_uuid();
  incident_id uuid;
  evidence_ref text;
  first_hash text;
  second_previous text;
  n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('evidence-school', 'Evidence University', array['evidence.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (operator, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@evidence.example', now(), now(), now()),
    (no_mfa, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'no-mfa@evidence.example', now(), now(), now()),
    (school_only, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'school@evidence.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (operator, 'incident_responder', 'platform', '', 'platform'),
    (no_mfa, 'incident_responder', 'platform', '', 'platform'),
    (school_only, 'incident_responder', 'school', 'evidence-school', 'platform');
  insert into public.platform_incident
    (public_id, tenant_id, title, severity, status, owner, affected_workflows, customer_impact, started_at)
  values
    ('incident-evidence-test', 'evidence-school', 'Evidence custody test', 'high',
     'investigating', 'incident commander', array['support'],
     'Synthetic test incident only.', now() - interval '1 hour')
  returning id into incident_id;

  perform pg_temp.must('authenticated cannot select the protected artifact table',
    pg_temp.refused(operator, 'select count(*) from private.incident_evidence_artifact', true));
  perform pg_temp.must('authenticated cannot select the protected custody table',
    pg_temp.refused(operator, 'select count(*) from private.incident_evidence_custody_event', true));
  perform pg_temp.must('fresh MFA is required to record evidence', pg_temp.refused(no_mfa, format(
    'select public.record_incident_evidence(%L,%L,%L,%L,%L,%s,now(),now()+interval ''90 days'',%L)',
    'incident-evidence-test', 'provider-log', 'synthetic provider',
    'evidence://incident/test-log', repeat('a', 64), 42, 'restricted')));
  perform pg_temp.must('school-scoped authority cannot use the platform custody path', pg_temp.refused(school_only, format(
    'select public.record_incident_evidence(%L,%L,%L,%L,%L,%s,now(),now()+interval ''90 days'',%L)',
    'incident-evidence-test', 'provider-log', 'synthetic provider',
    'evidence://incident/school-only', repeat('a', 64), 42, 'restricted'), true));
  perform pg_temp.must('signed or query-bearing locators are refused', pg_temp.refused(operator, format(
    'select public.record_incident_evidence(%L,%L,%L,%L,%L,%s,now(),now()+interval ''90 days'',%L)',
    'incident-evidence-test', 'provider-log', 'synthetic provider',
    'https://provider.example/object?token=secret', repeat('a', 64), 42, 'restricted'), true));
  perform pg_temp.must('non-finite capture times are refused', pg_temp.refused(operator, format(
    'select public.record_incident_evidence(%L,%L,%L,%L,%L,%s,''-infinity''::timestamptz,now()+interval ''90 days'',%L)',
    'incident-evidence-test', 'provider-log', 'synthetic provider',
    'evidence://incident/infinite-capture', repeat('a', 64), 42, 'restricted'), true));
  perform pg_temp.must('non-finite retention times are refused', pg_temp.refused(operator, format(
    'select public.record_incident_evidence(%L,%L,%L,%L,%L,%s,now(),''infinity''::timestamptz,%L)',
    'incident-evidence-test', 'provider-log', 'synthetic provider',
    'evidence://incident/infinite-retention', repeat('a', 64), 42, 'restricted'), true));

  set local time zone 'Pacific/Honolulu';
  perform pg_temp.become(operator, true);
  evidence_ref := public.record_incident_evidence(
    'incident-evidence-test', 'provider-log', 'synthetic provider',
    'evidence://incident/test-log', repeat('a', 64), 42,
    now() - interval '10 minutes', now() + interval '90 days', 'confidential');
  reset role;
  perform pg_temp.must('recording creates one artifact and one initial custody event',
    (select count(*) = 1 from private.incident_evidence_artifact where public_id = evidence_ref)
    and (select count(*) = 1 from private.incident_evidence_custody_event c
         join private.incident_evidence_artifact a on a.id = c.artifact_id
         where a.public_id = evidence_ref and c.action = 'captured'));
  perform pg_temp.must('the artifact is tenant-bound to its incident',
    (select a.tenant_id = i.tenant_id
       from private.incident_evidence_artifact a
       join public.platform_incident i on i.id = a.incident_id
      where a.public_id = evidence_ref));
  perform pg_temp.must('the selected evidence classification is preserved',
    (select a.classification = 'confidential'
       from private.incident_evidence_artifact a
      where a.public_id = evidence_ref));

  select c.event_hash into first_hash
    from private.incident_evidence_custody_event c
    join private.incident_evidence_artifact a on a.id = c.artifact_id
   where a.public_id = evidence_ref order by c.seq limit 1;
  set local time zone 'UTC';
  perform pg_temp.become(operator, true);
  perform public.record_incident_evidence_custody(
    evidence_ref, 'verified', 'incident-commander', 'digest-recheck', repeat('a', 64));
  reset role;
  select c.previous_hash into second_previous
    from private.incident_evidence_custody_event c
    join private.incident_evidence_artifact a on a.id = c.artifact_id
   where a.public_id = evidence_ref order by c.seq desc limit 1;
  perform pg_temp.must('custody events are hash-linked', first_hash ~ '^[0-9a-f]{64}$' and second_previous = first_hash);
  perform pg_temp.must('a successful verification cannot bless a mismatched digest', pg_temp.refused(operator, format(
    'select public.record_incident_evidence_custody(%L,%L,%L,%L,%L)',
    evidence_ref, 'verified', 'incident-commander', 'digest-recheck', repeat('b', 64)), true));
  perform pg_temp.become(operator, true);
  perform public.record_incident_evidence_custody(
    evidence_ref, 'verification_failed', 'incident-commander', 'digest-mismatch', repeat('b', 64));
  reset role;
  perform pg_temp.must('every event hash is reproducible from the supported ledger fields',
    not exists (
      select 1
        from private.incident_evidence_custody_event c
        join private.incident_evidence_artifact a on a.id = c.artifact_id
       where a.public_id = evidence_ref
         and c.event_hash <> private.console_audit_sha256(
           private.incident_evidence_custody_canonical(
             a.public_id, c.seq, c.action, c.custodian, c.reason_code,
             c.observed_sha256, c.actor_sha256, c.occurred_at, c.previous_hash))));

  perform pg_temp.must('artifact rows cannot be rewritten',
    pg_temp.refused(operator, format(
      'update private.incident_evidence_artifact set sha256=%L where public_id=%L',
      repeat('b', 64), evidence_ref), true));
  perform pg_temp.must('custody rows cannot be deleted',
    pg_temp.refused(operator, format(
      'delete from private.incident_evidence_custody_event where artifact_id=(select id from private.incident_evidence_artifact where public_id=%L)',
      evidence_ref), true));

  perform pg_temp.become(operator, true);
  select count(*) into n from public.incident_evidence_custody('incident-evidence-test');
  reset role;
  perform pg_temp.must('the audited reader returns capture, verification and mismatch events', n = 3);
  perform pg_temp.must('writes and reads reach the immutable console audit chain',
    (select count(*) = 4 from private.console_audit_event
      where action like 'incident.evidence_%' and target in (evidence_ref, 'incident-evidence-test')));

  -- A failed audit write must leave no artifact behind.
  revoke insert on table private.console_audit_event from semester_audit_writer;
  perform pg_temp.must('audit failure refuses evidence capture', pg_temp.refused(operator, format(
    'select public.record_incident_evidence(%L,%L,%L,%L,%L,%s,now(),now()+interval ''90 days'',%L)',
    'incident-evidence-test', 'provider-log', 'synthetic provider',
    'evidence://incident/audit-failure', repeat('c', 64), 43, 'restricted'), true));
  perform pg_temp.must('audit failure leaves no partial artifact',
    (select count(*) = 0 from private.incident_evidence_artifact
      where evidence_locator = 'evidence://incident/audit-failure'));
  grant insert on table private.console_audit_event to semester_audit_writer;
end $$;

rollback;
