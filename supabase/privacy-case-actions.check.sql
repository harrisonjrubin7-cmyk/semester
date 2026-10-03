-- Privacy case lifecycle, holds, approvals and certificates.
-- LOCAL/DISPOSABLE DATABASE ONLY; always rolled back.

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

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
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

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  student uuid;
  held_student uuid;
  other_student uuid;
  steward uuid;
  other_steward uuid;
  outsider uuid;
  certificate_user uuid;
  export_request uuid;
  audit_failure_request uuid;
  erase_request uuid;
  held_request uuid;
  approval uuid := gen_random_uuid();
  action_id uuid := gen_random_uuid();
  certificate uuid;
  result jsonb;
  n bigint;
begin
  insert into public.schools (id, name, email_domains) values
    ('privacy-action', 'Privacy Action University', array['privacy-action.example']),
    ('privacy-action-other', 'Other Privacy University', array['privacy-action-other.example']);
  student := pg_temp.newuser('student@privacy-action.example', 'privacy-action');
  held_student := pg_temp.newuser('held@privacy-action.example', 'privacy-action');
  other_student := pg_temp.newuser('other@privacy-action-other.example', 'privacy-action-other');
  steward := pg_temp.newuser('steward@privacy-action.example', 'privacy-action');
  other_steward := pg_temp.newuser('second@privacy-action.example', 'privacy-action');
  outsider := pg_temp.newuser('outsider@privacy-action-other.example', 'privacy-action-other');
  certificate_user := pg_temp.newuser('certificate-user@privacy-action.example', 'privacy-action');

  insert into public.privacy_completion_certificate (
    request_id, request_ref, subject, subject_sha256, tenant_id, kind,
    evidence_reference, issued_by
  ) values (
    gen_random_uuid(), 'DSR-ABCDEF1234', certificate_user,
    private.role_audit_sha256(certificate_user::text),
    'privacy-action', 'export', 'case://identity-clear', certificate_user
  ) returning id into certificate;
  delete from auth.users where id = certificate_user;
  select count(*) into n from public.privacy_completion_certificate
   where id = certificate and subject is null and issued_by is null;
  perform pg_temp.counted('account deletion preserves the certificate while clearing direct identity links', n, 1);

  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance) values
    (steward, 'data_steward', 'platform', '', 'platform'),
    (steward, 'data_steward', 'school', 'privacy-action', 'platform'),
    (other_steward, 'data_steward', 'platform', '', 'platform'),
    (other_steward, 'data_steward', 'school', 'privacy-action', 'platform'),
    (outsider, 'data_steward', 'platform', '', 'platform'),
    (outsider, 'data_steward', 'school', 'privacy-action-other', 'platform');

  insert into public.data_subject_request (subject, tenant_id, kind, detail) values
    (student, 'privacy-action', 'export', 'Please provide the account export.') returning id into export_request;
  insert into public.data_subject_request (subject, tenant_id, kind, detail) values
    (student, 'privacy-action', 'correction', 'Correct the account name.') returning id into audit_failure_request;
  insert into public.data_subject_request (subject, tenant_id, kind, detail) values
    (student, 'privacy-action', 'erasure', 'Delete eligible account data.') returning id into erase_request;
  insert into public.data_subject_request (subject, tenant_id, kind, detail) values
    (held_student, 'privacy-action', 'erasure', 'Delete held account data.') returning id into held_request;
  insert into public.data_subject_request (subject, tenant_id, kind, detail) values
    (other_student, 'privacy-action-other', 'correction', 'Private other-tenant detail.');

  if not pg_temp.refused(steward, format('select public.claim_privacy_request(%L)', export_request)) then
    raise exception 'FAILED: claim did not require fresh MFA';
  end if;
  if not pg_temp.refused(outsider, format('select public.claim_privacy_request(%L)', export_request), true) then
    raise exception 'FAILED: wrong-tenant steward claimed the request';
  end if;

  begin
    revoke insert on table private.console_audit_event from semester_audit_writer;
    if has_table_privilege('semester_audit_writer', 'private.console_audit_event', 'insert') then
      raise exception 'FAILED: the audit writer still held INSERT during the failure probe';
    end if;
    if not pg_temp.refused(steward, format(
      'select public.claim_privacy_request(%L)', audit_failure_request
    ), true) then raise exception 'FAILED: a claim survived a failed audit write'; end if;
    select count(*) into n from public.data_subject_request
     where id = audit_failure_request and assigned_to is null and assigned_at is null and status = 'received';
    perform pg_temp.counted('failed audit writes leave the privacy request unchanged', n, 1);
    select count(*) into n from private.console_audit_event where target = audit_failure_request::text;
    perform pg_temp.counted('failed audit writes leave no partial privacy audit event', n, 0);
    raise exception using errcode = 'P0001', message = 'control:restore-audit-writer';
  exception when raise_exception then
    if sqlerrm <> 'control:restore-audit-writer' then raise; end if;
  end;
  if not has_table_privilege('semester_audit_writer', 'private.console_audit_event', 'insert') then
    raise exception 'FAILED: the audit writer privilege was not restored after the failure probe';
  end if;

  perform pg_temp.become(steward, true);
  perform public.claim_privacy_request(export_request);
  reset role;
  select count(*) into n from public.data_subject_request
   where id = export_request and assigned_to = steward and status = 'verifying';
  perform pg_temp.counted('fresh MFA claims an exact-school request into verification', n, 1);

  if not pg_temp.refused(other_steward, format('select public.read_privacy_request_detail(%L)', export_request), true) then
    raise exception 'FAILED: another steward read a claimed request';
  end if;
  if not pg_temp.refused(steward, format('select public.read_privacy_request_detail(%L)', export_request)) then
    raise exception 'FAILED: request detail read did not require fresh MFA';
  end if;
  perform pg_temp.become(steward, true);
  select count(*) into n from public.read_privacy_request_detail(export_request) d
   where d.detail = 'Please provide the account export.'
     and d.subject_reference ~ '^[0-9a-f]{64}$';
  reset role;
  perform pg_temp.counted('the assigned steward reads detail with a pseudonymous subject reference', n, 1);

  if not pg_temp.refused(steward, format(
    'select public.verify_privacy_request(%L, %L, %L)',
    export_request, 'x', 'case://export-1'
  ), true) then raise exception 'FAILED: short verification basis was accepted'; end if;
  if not pg_temp.refused(steward, format(
    'select public.verify_privacy_request(%L, %L, %L)',
    export_request, 'signed-in account holder', 'case://contains private prose'
  ), true) then raise exception 'FAILED: free-text verification evidence was accepted'; end if;
  raise notice 'ok  verification evidence is an opaque reference, not free text';
  perform pg_temp.become(steward, true);
  perform public.verify_privacy_request(export_request, 'signed-in account holder', 'case://export-1');
  reset role;
  select count(*) into n from public.data_subject_request
   where id = export_request and verified_by = steward and verified_at is not null
     and status = 'in_progress';
  perform pg_temp.counted('identity verification records owner, basis, evidence and starts work', n, 1);

  if not pg_temp.refused(other_steward, format(
    'select public.resolve_privacy_request(%L, %L, %L, %L, null)',
    export_request, 'completed', 'Export delivered.', 'case://export-1'
  ), true) then raise exception 'FAILED: another steward resolved the request'; end if;
  perform pg_temp.become(steward, true);
  result := public.resolve_privacy_request(
    export_request, 'completed', 'Export delivered through the verified channel.',
    'case://export-1', null
  );
  reset role;
  certificate := (result ->> 'certificate_id')::uuid;
  select count(*) into n from public.privacy_completion_certificate c
   where c.id = certificate and c.request_id = export_request
     and c.subject_sha256 ~ '^[0-9a-f]{64}$' and c.approval_request is null;
  perform pg_temp.counted('completion creates one pseudonymous immutable certificate', n, 1);

  perform pg_temp.become(student);
  select count(*) into n from public.my_privacy_completion_certificates() c
   where c.certificate_id = certificate and c.request_ref like 'DSR-%';
  reset role;
  perform pg_temp.counted('the subject can retrieve their completion certificate', n, 1);
  if not pg_temp.refused(student, format(
    'update public.privacy_completion_certificate set evidence_reference = %L where id = %L',
    'case://changed', certificate
  )) then raise exception 'FAILED: a subject edited a certificate'; end if;
  raise notice 'ok  certificate storage is not directly writable by its subject';
  begin
    update public.privacy_completion_certificate
       set evidence_reference = 'case://owner-change'
     where id = certificate;
    raise exception 'FAILED: the certificate immutability trigger allowed an owner update';
  exception when insufficient_privilege then
    raise notice 'ok  certificate immutability trigger refuses its owner too';
  end;

  insert into public.legal_holds
    (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('account', held_student::text, 'privacy-action', 'Preserve records', 'MAT-200', steward);
  perform pg_temp.become(steward, true);
  perform public.claim_privacy_request(held_request);
  perform public.verify_privacy_request(held_request, 'signed-in account holder', 'case://held-1');
  reset role;
  if not pg_temp.refused(steward, format(
    'select public.resolve_privacy_request(%L, %L, %L, %L, null)',
    held_request, 'completed', 'Erasure finished.', 'case://held-1'
  ), true) then raise exception 'FAILED: held erasure was completed'; end if;
  raise notice 'ok  a live legal hold blocks destructive completion';

  perform pg_temp.become(steward, true);
  perform public.claim_privacy_request(erase_request);
  perform public.verify_privacy_request(erase_request, 'signed-in account holder', 'case://erase-1');
  reset role;
  if not pg_temp.refused(steward, format(
    'select public.resolve_privacy_request(%L, %L, %L, %L, null)',
    erase_request, 'completed', 'Erasure finished.', 'case://erase-1'
  ), true) then raise exception 'FAILED: erasure completed without approval'; end if;

  insert into public.approval_request (
    id, duty_id, requester, tenant_id, target, evidence, ticket, status,
    decided_at, executed_at
  ) values (
    approval, 'data-deletion', steward, 'privacy-action', erase_request::text,
    'Verified request and deletion evidence.', 'PRIV-100', 'executed', now(), now()
  );
  insert into public.console_action_record
    (id, request_id, duty_id, actor, tenant_id, target, detail)
  values (action_id, approval, 'data-deletion', steward, 'privacy-action', erase_request::text, '{}');

  perform pg_temp.become(steward, true);
  result := public.resolve_privacy_request(
    erase_request, 'completed', 'Eligible records erased and propagation recorded.',
    'case://erase-1', approval
  );
  reset role;
  select count(*) into n from public.privacy_completion_certificate c
   where c.id = (result ->> 'certificate_id')::uuid and c.approval_request = approval;
  perform pg_temp.counted('exact executed deletion approval permits certified erasure completion', n, 1);

  delete from public.approval_request where id = approval;
  select count(*) into n from public.privacy_completion_certificate c
   where c.id = (result ->> 'certificate_id')::uuid and c.approval_request is null;
  perform pg_temp.counted('approval retention cleanup preserves the immutable certificate and clears only its foreign key', n, 1);

  select count(*) into n from private.console_audit_event e
   where e.target in (export_request::text, erase_request::text, held_request::text)
     and e.action in ('privacy.case_claimed', 'privacy.case_read',
                      'privacy.identity_verified', 'privacy.request_resolved');
  perform pg_temp.counted('sensitive reads and lifecycle writes are audit-first', n, 9);

  raise notice 'privacy case actions: every check passed';
end $$;

rollback;
