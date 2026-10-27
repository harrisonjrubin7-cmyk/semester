-- Synthetic-only purge preview. LOCAL/DISPOSABLE DATABASES ONLY; rolled back.
-- This proves the preview boundary and deliberately never implements a purge.

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', who::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);
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

create or replace function pg_temp.refused(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

create or replace function pg_temp.must_refuse(what text, statement text)
returns void language plpgsql as $$
begin
  if not pg_temp.refused(statement) then raise exception 'FAILED: % was allowed', what; end if;
  raise notice 'ok  % is refused', what;
end $$;

do $$
declare
  school_admin uuid;
  operator_one uuid;
  operator_two uuid;
  operator_three uuid;
  stranger uuid;
  offboarding_case_id uuid;
  generated jsonb;
  preview jsonb;
  replay jsonb;
  before_profiles bigint;
  before_authorizations bigint;
  expected_counts jsonb;
  receipt_id uuid;
begin
  insert into public.schools (id, name, email_domains, is_demo) values
    ('preview-demo', 'Synthetic Preview University', array['preview-demo.example'], true);

  school_admin := pg_temp.newuser('admin@preview-demo.example', 'preview-demo');
  operator_one := pg_temp.newuser('preview-op1@ops.example', null);
  operator_two := pg_temp.newuser('preview-op2@ops.example', null);
  operator_three := pg_temp.newuser('preview-op3@ops.example', null);
  stranger := pg_temp.newuser('preview-stranger@example.test', null);

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (school_admin, 'university_admin', 'school', 'preview-demo', 'institution'),
    (operator_one, 'platform_admin', 'platform', '', 'platform'),
    (operator_two, 'platform_admin', 'platform', '', 'platform'),
    (operator_three, 'platform_admin', 'platform', '', 'platform');

  -- Build the real non-destructive offboarding evidence chain on synthetic rows.
  perform pg_temp.become(school_admin);
  offboarding_case_id := public.propose_offboarding('preview-demo', 'Synthetic purge preview regression.', 'school');
  perform public.offboarding_preflight(offboarding_case_id);
  reset role;

  perform pg_temp.become(operator_one);
  perform public.approve_offboarding(offboarding_case_id);
  perform public.record_offboarding_notice(offboarding_case_id, current_date - 30);
  perform public.disable_school_access(offboarding_case_id);
  generated := public.generate_offboarding_export(offboarding_case_id, 'preview-export-0001');
  perform public.record_generated_offboarding_export(
    offboarding_case_id,
    (generated ->> 'generation_id')::uuid,
    'synthetic regression recipient'
  );
  reset role;

  perform pg_temp.become(operator_two);
  perform public.verify_offboarding_export(offboarding_case_id);
  perform public.archive_school(offboarding_case_id, 30);
  reset role;

  -- Time is advanced only on the synthetic fixture, to expose both explicit
  -- retention states without waiting. No tenant row is deleted or purged.
  set local role postgres;
  update public.school_offboarding set retain_until = now() - interval '1 day' where id = offboarding_case_id;
  reset role;

  select count(*) into before_profiles from public.profiles where school_id = 'preview-demo';
  select count(*) into before_authorizations from public.school_offboarding
   where id = offboarding_case_id and purge_authorized_at is not null;
  select coalesce(jsonb_object_agg(t.tbl, t.n order by t.tbl), '{}'::jsonb)
    into expected_counts from private.school_tenant_tables('preview-demo') t;

  -- Neither a stranger nor the school's former tenant administrator gets a
  -- platform preview, and the synthetic case list is equally protected.
  perform pg_temp.become(stranger);
  perform pg_temp.must_refuse('a stranger listing offboarding cases',
    $q$select * from public.console_offboarding_cases()$q$);
  perform pg_temp.must_refuse('a stranger creating a purge preview',
    format($q$select public.preview_school_purge(%L, 'preview-key-0001')$q$, offboarding_case_id));
  reset role;

  perform pg_temp.become(school_admin);
  perform pg_temp.must_refuse('tenant authority without platform authority creating a purge preview',
    format($q$select public.preview_school_purge(%L, 'preview-key-0001')$q$, offboarding_case_id));
  reset role;

  perform pg_temp.become(operator_three);
  perform pg_temp.counted('the operator lists exactly the synthetic archived case',
    (select count(*) from public.console_offboarding_cases() listed where listed.case_id = offboarding_case_id), 1);
  perform pg_temp.must_refuse('a malformed idempotency key',
    format($q$select public.preview_school_purge(%L, 'short')$q$, offboarding_case_id));
  preview := public.preview_school_purge(offboarding_case_id, 'preview-key-0001');
  reset role;

  perform pg_temp.counted('the preview succeeds', ((preview ->> 'ok')::boolean)::int, 1);
  perform pg_temp.counted('the preview is explicitly synthetic-only',
    ((preview -> 'preview' ->> 'synthetic_only')::boolean)::int, 1);
  perform pg_temp.counted('the preview reports retention complete',
    ((preview -> 'preview' -> 'retention' ->> 'status') = 'complete')::int, 1);
  perform pg_temp.counted('the preview reports no live hold',
    ((preview -> 'preview' -> 'legal_hold' ->> 'live_count')::int = 0)::int, 1);
  perform pg_temp.counted('the manifest receipt and current counts verify',
    ((preview -> 'preview' -> 'export_manifest' ->> 'integrity') = 'verified'
      and (preview -> 'preview' -> 'export_manifest' ->> 'current_counts_match')::boolean)::int, 1);
  perform pg_temp.counted('the exact affected-record object matches the current tenant snapshot',
    ((preview -> 'preview' -> 'affected_records' -> 'tables') = expected_counts)::int, 1);
  perform pg_temp.counted('missing purge authorization is an explicit blocker',
    (select count(*) from jsonb_array_elements_text(preview -> 'preview' -> 'blockers') b
      where b = 'purge_authorization_missing'), 1);
  perform pg_temp.counted('destructive action is unavailable, disabled, and unexecuted',
    ((not (preview -> 'preview' -> 'destructive_action' ->> 'available')::boolean)
      and (not (preview -> 'preview' -> 'destructive_action' ->> 'enabled')::boolean)
      and (not (preview -> 'preview' -> 'destructive_action' ->> 'executed')::boolean))::int, 1);
  receipt_id := (preview ->> 'receipt_id')::uuid;

  perform pg_temp.counted('the preview changes no tenant profile',
    (select count(*) from public.profiles where school_id = 'preview-demo'), before_profiles);
  perform pg_temp.counted('the preview does not authorize purge',
    (select count(*) from public.school_offboarding where id = offboarding_case_id and purge_authorized_at is not null),
    before_authorizations);
  perform pg_temp.counted('the preview leaves the school row present',
    (select count(*) from public.schools where id = 'preview-demo'), 1);

  -- Exact replay belongs to the creating operator. Another platform operator
  -- gets a structured refusal and no preview body.
  perform pg_temp.become(operator_three);
  replay := public.preview_school_purge(offboarding_case_id, 'preview-key-0001');
  reset role;
  perform pg_temp.counted('same actor and key replay the immutable receipt',
    (((replay ->> 'replayed')::boolean) and replay ->> 'receipt_id' = receipt_id::text)::int, 1);

  perform pg_temp.become(operator_two);
  replay := public.preview_school_purge(offboarding_case_id, 'preview-key-0001');
  reset role;
  perform pg_temp.counted('cross-operator replay is refused',
    ((not (replay ->> 'ok')::boolean) and replay -> 'error' ->> 'code' = 'replay_operator_mismatch')::int, 1);

  -- A live hold changes both the exact record counts and the legal status. The
  -- old key fails closed; a new reviewed key shows both changes.
  set local role postgres;
  perform set_config('request.jwt.claims', '', true);
  insert into public.legal_holds (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('tenant', 'preview-demo', 'preview-demo', 'Synthetic legal hold', 'PREVIEW-MATTER', operator_one);
  reset role;

  perform pg_temp.become(operator_three);
  replay := public.preview_school_purge(offboarding_case_id, 'preview-key-0001');
  preview := public.preview_school_purge(offboarding_case_id, 'preview-key-0002');
  reset role;
  perform pg_temp.counted('changed evidence refuses reuse of the old key',
    ((not (replay ->> 'ok')::boolean) and replay -> 'error' ->> 'code' = 'snapshot_changed'
      and not (replay ? 'preview'))::int, 1);
  perform pg_temp.counted('a new reviewed key reports the live hold',
    ((preview -> 'preview' -> 'legal_hold' ->> 'status') = 'blocked')::int, 1);
  perform pg_temp.counted('the live hold is an explicit blocker',
    (select count(*) from jsonb_array_elements_text(preview -> 'preview' -> 'blockers') b
      where b = 'live_legal_hold'), 1);

  -- Even direct table operations cannot rewrite or remove a receipt.
  set local role postgres;
  perform pg_temp.must_refuse('editing an immutable preview receipt',
    format($q$update private.offboarding_purge_preview_receipt set generated_at = now() where id = %L$q$, receipt_id));
  perform pg_temp.must_refuse('deleting an immutable preview receipt',
    format($q$delete from private.offboarding_purge_preview_receipt where id = %L$q$, receipt_id));

  -- Toggle only the synthetic marker to prove that the API rejects a real
  -- tenant before returning a snapshot. Restore it for the remaining checks.
  update public.schools set is_demo = false where id = 'preview-demo';
  reset role;
  perform pg_temp.become(operator_three);
  preview := public.preview_school_purge(offboarding_case_id, 'preview-key-real');
  reset role;
  perform pg_temp.counted('a non-demo tenant gets an audited structured refusal',
    ((not (preview ->> 'ok')::boolean)
      and preview -> 'error' ->> 'code' = 'non_demo_tenant'
      and not (preview ? 'preview'))::int, 1);
  set local role postgres;
  update public.schools set is_demo = true where id = 'preview-demo';
  reset role;

  perform pg_temp.counted('generated, replayed, refused, changed-snapshot and real-tenant attempts are audited',
    (select count(*) from public.audit_event
      where tenant_id = 'preview-demo' and action like 'school.offboarding_purge_preview_%'), 6);
  perform pg_temp.counted('audit metadata contains no email address',
    (select count(*) from public.audit_event
      where tenant_id = 'preview-demo' and action like 'school.offboarding_purge_preview_%'
        and detail::text ~ '@'), 0);
end $$;

rollback;
