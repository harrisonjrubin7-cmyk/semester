-- Synthetic purge-and-restore rehearsal. LOCAL/DISPOSABLE DATABASES ONLY.
-- Every row created here is synthetic and the transaction is rolled back.

begin;

create or replace function pg_temp.become(who uuid, fresh boolean default true)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when fresh then json_build_object(
      'sub', who::text, 'role', 'authenticated', 'aal', 'aal2',
      'amr', json_build_array(json_build_object('method', 'totp',
        'timestamp', floor(extract(epoch from now()))::bigint)))
    else json_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2') end::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          address, now(), now(), now());
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

create or replace function pg_temp.attempt(who uuid, statement text)
returns text language plpgsql as $$
begin
  perform pg_temp.become(who, true);
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
  if got is null then raise exception 'FAILED: % was allowed', what; end if;
  if got not ilike '%' || expected || '%' then
    raise exception 'FAILED: % — refused for another reason: %', what, got;
  end if;
  raise notice 'ok  % is refused (%)', what, got;
end $$;

create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin execute statement; return false; exception when others then return true; end $$;

create or replace function pg_temp.must_refuse(what text, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(statement) then raise exception 'FAILED: % was allowed', what; end if;
  raise notice 'ok  % is refused', what;
end $$;

create or replace function pg_temp.approve_rehearsal(
  requester uuid, privacy_approver uuid, security_approver uuid,
  scoped_tenant text, scoped_case uuid, preview_receipt uuid, ticket text
)
returns uuid language plpgsql as $$
declare req uuid; became text; acted jsonb;
begin
  perform pg_temp.become(requester, true);
  req := public.request_approval(
    'offboarding-purge-rehearsal', null, scoped_case::text,
    jsonb_build_object('tenant_id', scoped_tenant, 'preview_receipt_id', preview_receipt,
      'adapter', 'synthetic_discard_v1', 'rollback', 'restore surrogate fixtures and compare hashes'),
    'Synthetic adapter only; exact preview and manifest bound; deterministic restore required.',
    ticket, 'purge-rehearsal-' || ticket);
  perform pg_temp.nobody();
  perform pg_temp.become(privacy_approver, true);
  became := public.decide_approval(req, 'approve');
  if became <> 'pending' then raise exception 'FAILED: first approval became %', became; end if;
  perform pg_temp.nobody();
  perform pg_temp.become(security_approver, true);
  became := public.decide_approval(req, 'approve');
  if became <> 'approved' then raise exception 'FAILED: second approval became %', became; end if;
  perform pg_temp.nobody();
  perform pg_temp.become(requester, true);
  acted := public.console_act(req, 'purge-rehearsal-act-' || ticket);
  perform pg_temp.nobody();
  if acted ->> 'status' <> 'executed' then raise exception 'FAILED: approval was not executed'; end if;
  return req;
end $$;

do $$
declare
  school_admin uuid;
  operator_one uuid;
  operator_two uuid;
  operator_three uuid;
  privacy_approver uuid;
  security_approver uuid;
  stranger uuid;
  offboarding_case_id uuid;
  billing_account uuid := gen_random_uuid();
  subscription uuid := gen_random_uuid();
  generated jsonb;
  preview jsonb;
  preview_receipt uuid;
  approval_one uuid;
  approval_two uuid;
  approval_three uuid;
  cross_approval uuid;
  queued jsonb;
  replay jsonb;
  result jsonb;
  stopped jsonb;
  job_one uuid;
  job_two uuid;
  job_three uuid;
  before_profiles bigint;
  before_school bigint;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('rehearsal-demo', 'Synthetic Rehearsal University', array['rehearsal-demo.example'], true),
    ('rehearsal-other', 'Other Synthetic University', array['rehearsal-other.example'], true);

  school_admin := pg_temp.newuser('admin@rehearsal-demo.example', 'rehearsal-demo');
  operator_one := pg_temp.newuser('rehearsal-op1@ops.example', null);
  operator_two := pg_temp.newuser('rehearsal-op2@ops.example', null);
  operator_three := pg_temp.newuser('rehearsal-op3@ops.example', null);
  privacy_approver := pg_temp.newuser('rehearsal-privacy@ops.example', null);
  security_approver := pg_temp.newuser('rehearsal-security@ops.example', null);
  stranger := pg_temp.newuser('rehearsal-stranger@example.test', null);

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (school_admin, 'university_admin', 'school', 'rehearsal-demo', 'institution'),
    (operator_one, 'platform_admin', 'platform', '', 'platform'),
    (operator_two, 'platform_admin', 'platform', '', 'platform'),
    (operator_three, 'platform_admin', 'platform', '', 'platform'),
    (operator_three, 'data_steward', 'platform', '', 'platform'),
    (privacy_approver, 'platform_admin', 'platform', '', 'platform'),
    (security_approver, 'platform_admin', 'platform', '', 'platform');
  insert into public.council_seat_holder (seat, subject) values
    ('privacy', privacy_approver), ('security', security_approver);

  -- Rows with a tenant id exist before export generation. Later gate changes
  -- update these rows or touch private/platform-scoped rows only, so the
  -- verified export counts remain exact.
  insert into public.tenant_rollout (tenant_id, state, reason, updated_by)
  values ('rehearsal-demo', 'requested', 'Synthetic offboarding rehearsal fixture.', operator_one);
  insert into public.tenant_feature_policy (tenant_id, capability, state, reason, updated_by)
  values ('rehearsal-demo', 'offboarding.purge_rehearsal', 'off', 'Off by default.', operator_one);
  insert into public.billing_accounts (id, kind, name) values
    (billing_account, 'institution', 'Synthetic Rehearsal Billing');
  insert into public.billing_account_tenants (billing_account_id, tenant_id)
  values (billing_account, 'rehearsal-demo');
  insert into public.subscriptions
    (id, billing_account_id, plan_code, status, current_period_start, current_period_end)
  values (subscription, billing_account, 'free', 'active', now(), now() + interval '7 days');

  perform pg_temp.become(school_admin, true);
  offboarding_case_id := public.propose_offboarding('rehearsal-demo', 'Synthetic purge rehearsal regression.', 'school');
  perform public.offboarding_preflight(offboarding_case_id);
  perform pg_temp.nobody();

  perform pg_temp.become(operator_one, true);
  perform public.approve_offboarding(offboarding_case_id);
  perform public.record_offboarding_notice(offboarding_case_id, current_date - 30);
  perform public.disable_school_access(offboarding_case_id);
  generated := public.generate_offboarding_export(offboarding_case_id, 'rehearsal-export-0001');
  perform public.record_generated_offboarding_export(
    offboarding_case_id, (generated ->> 'generation_id')::uuid, 'synthetic rehearsal recipient');
  perform pg_temp.nobody();

  perform pg_temp.become(operator_two, true);
  perform public.verify_offboarding_export(offboarding_case_id);
  perform public.archive_school(offboarding_case_id, 30);
  perform pg_temp.nobody();

  set local role postgres;
  update public.school_offboarding set retain_until = now() - interval '1 day' where id = offboarding_case_id;
  reset role;
  perform pg_temp.become(operator_two, true);
  perform public.authorize_school_purge(offboarding_case_id, 'Synthetic rehearsal authorization only.');
  perform pg_temp.nobody();

  perform pg_temp.become(operator_three, true);
  preview := public.preview_school_purge(offboarding_case_id, 'rehearsal-preview-0001');
  perform pg_temp.nobody();
  preview_receipt := (preview ->> 'receipt_id')::uuid;
  perform pg_temp.counted('the bound preview has no blockers',
    jsonb_array_length(preview -> 'preview' -> 'blockers'), 0);

  approval_one := pg_temp.approve_rehearsal(operator_three, privacy_approver, security_approver,
    'rehearsal-demo', offboarding_case_id, preview_receipt, 'REHEARSAL-001');

  perform pg_temp.refused_with('the dedicated capability is assigned to no role by default',
    pg_temp.attempt(operator_three, format(
      'select public.queue_school_purge_rehearsal(%L,%L,%L,%L)',
      offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001')),
    'capability is off');
  set local role postgres;
  insert into public.role_capabilities (role, capability)
  values ('data_steward', 'offboarding:purge-rehearse');
  reset role;

  perform pg_temp.refused_with('an account without platform authority cannot queue',
    pg_temp.attempt(stranger, format(
      'select public.queue_school_purge_rehearsal(%L,%L,%L,%L)',
      offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001')),
    'configuration authority');
  perform pg_temp.refused_with('the rollout feature is off by default',
    pg_temp.attempt(operator_three, format(
      'select public.queue_school_purge_rehearsal(%L,%L,%L,%L)',
      offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001')),
    'rollout is off');

  set local role postgres;
  update public.tenant_feature_policy set state = 'sandbox', reason = 'Synthetic rehearsal test only.'
   where tenant_id = 'rehearsal-demo' and capability = 'offboarding.purge_rehearsal';
  reset role;
  perform pg_temp.refused_with('the commercial entitlement is independently off',
    pg_temp.attempt(operator_three, format(
      'select public.queue_school_purge_rehearsal(%L,%L,%L,%L)',
      offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001')),
    'entitlement is off');

  set local role postgres;
  insert into public.subscription_entitlements (subscription_id, entitlement_key, value, source)
  values (subscription, 'offboarding.purge_rehearsal', 'true', 'grant');
  reset role;
  perform pg_temp.refused_with('the synthetic adapter is independently disabled',
    pg_temp.attempt(operator_three, format(
      'select public.queue_school_purge_rehearsal(%L,%L,%L,%L)',
      offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001')),
    'adapter is disabled');

  set local role postgres;
  update private.offboarding_purge_rehearsal_adapter set enabled = true
   where adapter_key = 'synthetic_discard_v1';
  reset role;
  perform pg_temp.become(operator_three, true);
  queued := public.queue_school_purge_rehearsal(
    offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001');
  replay := public.queue_school_purge_rehearsal(
    offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001');
  perform pg_temp.nobody();
  job_one := (queued ->> 'job_id')::uuid;
  perform pg_temp.counted('the same operator and key replay one queue job',
    ((replay ->> 'replayed')::boolean and replay ->> 'job_id' = job_one::text)::int, 1);

  perform pg_temp.become(privacy_approver, true);
  replay := public.queue_school_purge_rehearsal(
    offboarding_case_id, preview_receipt, approval_one, 'rehearsal-job-0001');
  perform pg_temp.nobody();
  perform pg_temp.counted('cross-operator replay is refused',
    ((not (replay ->> 'ok')::boolean) and replay -> 'error' ->> 'code' = 'replay_operator_mismatch')::int, 1);

  cross_approval := pg_temp.approve_rehearsal(operator_three, privacy_approver, security_approver,
    'rehearsal-other', offboarding_case_id, preview_receipt, 'REHEARSAL-XTENANT');
  perform pg_temp.refused_with('an approval scoped to another tenant is refused',
    pg_temp.attempt(operator_three, format(
      'select public.queue_school_purge_rehearsal(%L,%L,%L,%L)',
      offboarding_case_id, preview_receipt, cross_approval, 'rehearsal-job-cross')),
    'scoped to this case and preview');

  set local role postgres;
  perform pg_temp.must_refuse('tampering with an immutable queue binding', format(
    $q$update private.offboarding_purge_rehearsal_job set manifest_sha256 = %L where id = %L$q$,
    repeat('0', 64), job_one));
  reset role;
  perform pg_temp.refused_with('the browser cannot invoke the service-only worker',
    pg_temp.attempt(operator_three, format('select public.run_school_purge_rehearsal(%L)', job_one)),
    'permission denied');

  -- A kill switch engaged after queueing is rechecked by the worker and leaves
  -- an immutable stopped receipt without creating a fixture.
  set local role postgres;
  insert into public.feature_kill_switch (tenant_id, switch_key, engaged, reason, engaged_by, engaged_at)
  values ('rehearsal-demo', 'kill.writeback', true, 'Synthetic stop drill.', security_approver, now());
  reset role;
  set local role service_role;
  stopped := public.run_school_purge_rehearsal(job_one);
  reset role;
  perform pg_temp.counted('the kill switch stops the queued rehearsal',
    ((stopped ->> 'status') = 'stopped')::int, 1);
  perform pg_temp.counted('the killed job creates no synthetic fixture',
    (select count(*) from private.offboarding_purge_rehearsal_fixture where job_id = job_one), 0);

  set local role postgres;
  update public.feature_kill_switch set engaged = false, reason = ''
   where tenant_id = 'rehearsal-demo' and switch_key = 'kill.writeback';
  reset role;

  -- A second independently approved job runs the only adapter. It deletes and
  -- restores private surrogate fixtures and proves their ordered hash equal.
  approval_two := pg_temp.approve_rehearsal(operator_three, privacy_approver, security_approver,
    'rehearsal-demo', offboarding_case_id, preview_receipt, 'REHEARSAL-002');
  perform pg_temp.become(operator_three, true);
  queued := public.queue_school_purge_rehearsal(
    offboarding_case_id, preview_receipt, approval_two, 'rehearsal-job-0002');
  perform pg_temp.nobody();
  job_two := (queued ->> 'job_id')::uuid;
  select count(*) into before_profiles from public.profiles where school_id = 'rehearsal-demo';
  select count(*) into before_school from public.schools where id = 'rehearsal-demo';
  set local role service_role;
  result := public.run_school_purge_rehearsal(job_two);
  replay := public.run_school_purge_rehearsal(job_two);
  reset role;
  perform pg_temp.counted('the deterministic restore is verified',
    ((result ->> 'status') = 'completed' and (result ->> 'restore_verified')::boolean
      and result ->> 'before_sha256' = result ->> 'restored_sha256')::int, 1);
  perform pg_temp.counted('the worker replay returns the same receipt',
    ((replay ->> 'replayed')::boolean and replay ->> 'receipt_id' = result ->> 'receipt_id')::int, 1);
  perform pg_temp.counted('the rehearsal changes no tenant profile',
    (select count(*) from public.profiles where school_id = 'rehearsal-demo'), before_profiles);
  perform pg_temp.counted('the rehearsal leaves the tenant present',
    (select count(*) from public.schools where id = 'rehearsal-demo'), before_school);
  perform pg_temp.counted('only private surrogate fixtures were restored',
    (select count(*) from private.offboarding_purge_rehearsal_fixture where job_id = job_two),
    (result ->> 'fixture_count')::bigint);

  approval_three := pg_temp.approve_rehearsal(operator_three, privacy_approver, security_approver,
    'rehearsal-demo', offboarding_case_id, preview_receipt, 'REHEARSAL-003');
  perform pg_temp.become(operator_three, true);
  queued := public.queue_school_purge_rehearsal(
    offboarding_case_id, preview_receipt, approval_three, 'rehearsal-job-0003');
  job_three := (queued ->> 'job_id')::uuid;
  stopped := public.stop_school_purge_rehearsal(job_three, 'Operator requested stop before worker claim.');
  perform pg_temp.nobody();
  set local role service_role;
  replay := public.run_school_purge_rehearsal(job_three);
  reset role;
  perform pg_temp.counted('manual stop is terminal and idempotent for the worker',
    ((stopped ->> 'status') = 'stopped' and (replay ->> 'status') = 'stopped'
      and replay ->> 'receipt_id' = stopped ->> 'receipt_id')::int, 1);

  set local role postgres;
  perform pg_temp.must_refuse('editing an immutable completed receipt', format(
    $q$update private.offboarding_purge_rehearsal_receipt set restore_verified = false where id = %L$q$,
    (result ->> 'receipt_id')::uuid));
  perform pg_temp.must_refuse('deleting an immutable completed receipt', format(
    $q$delete from private.offboarding_purge_rehearsal_receipt where id = %L$q$,
    (result ->> 'receipt_id')::uuid));
  reset role;

  perform pg_temp.counted('the three outcomes have immutable receipts',
    (select count(*) from private.offboarding_purge_rehearsal_receipt
      where job_id in (job_one, job_two, job_three)), 3);
  perform pg_temp.counted('the queue, kill, completion and manual stop are audited',
    (select count(*) from public.audit_event where tenant_id = 'rehearsal-demo'
      and action like 'school.offboarding_purge_rehearsal_%'), 6);
end $$;

rollback;
