-- supabase/course-material-retention-policy.check.sql — approved, immutable,
-- tenant-bound retention authority for shared course material.

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, got;
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.claims(who uuid, fresh boolean)
returns jsonb language sql as $$
  select jsonb_build_object(
    'sub', who,
    'role', 'authenticated',
    'aal', case when fresh then 'aal2' else 'aal1' end,
    'amr', case when fresh then jsonb_build_array(jsonb_build_object(
      'method', 'totp', 'timestamp', extract(epoch from now())
    )) else '[]'::jsonb end
  );
$$;

create or replace function pg_temp.err_as(who uuid, fresh boolean, statement text)
returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', pg_temp.claims(who, fresh)::text, true);
  execute 'set local role authenticated';
  execute statement;
  execute 'reset role';
  return null;
exception when others then
  execute 'reset role';
  return sqlerrm;
end $$;

create or replace function pg_temp.refused(what text, who uuid, fresh boolean, statement text)
returns void language plpgsql as $$
declare e text := pg_temp.err_as(who, fresh, statement);
begin
  if e is null then raise exception 'FAILED: % — was allowed', what; end if;
  raise notice 'ok  % is refused (%)', what, e;
end $$;

do $$
declare
  operator constant uuid := '61000000-0000-0000-0000-000000000001';
  outsider constant uuid := '61000000-0000-0000-0000-000000000002';
  activate constant uuid := '62000000-0000-0000-0000-000000000001';
  withdraw constant uuid := '62000000-0000-0000-0000-000000000002';
  rollback_req constant uuid := '62000000-0000-0000-0000-000000000003';
  wrong_duty constant uuid := '62000000-0000-0000-0000-000000000004';
  got jsonb;
begin
  insert into public.schools (id, name, email_domains) values
    ('retention-u', 'Retention University', array['retention.example']),
    ('retention-other', 'Other Retention University', array['other-retention.example']);
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at) values
    (operator, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@retention.example', now(), now(), now()),
    (outsider, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@retention.example', now(), now(), now());
  insert into public.role_grants (subject, role, scope_kind, scope_id, provenance, granted_by)
  values (operator, 'platform_admin', 'platform', '', 'platform', operator);

  insert into public.approval_request
    (id, duty_id, requester, tenant_id, target, detail, evidence, ticket, status, correlation_id, decided_at)
  values
    (activate, 'tenant-policy', operator, 'retention-u', 'course-materials',
     '{"policy_kind":"course-material-retention","action":"activate","days_after_withdrawal":90,"rollback":"Withdraw the policy and close new intake."}',
     'Institution request and retention review RET-1001', 'RET-1001', 'approved', 'corr-retention-activate', now()),
    (withdraw, 'tenant-policy', operator, 'retention-u', 'course-materials',
     '{"policy_kind":"course-material-retention","action":"withdraw","rollback":"Publish a newly approved active version."}',
     'Institution withdrawal RET-1002', 'RET-1002', 'approved', 'corr-retention-withdraw', now()),
    (rollback_req, 'tenant-policy', operator, 'retention-other', 'course-materials',
     '{"policy_kind":"course-material-retention","action":"activate","days_after_withdrawal":30,"rollback":"Withdraw the policy and close new intake."}',
     'Institution request and retention review RET-1003', 'RET-1003', 'approved', 'corr-retention-rollback', now()),
    (wrong_duty, 'release', operator, 'retention-other', 'course-materials',
     '{"policy_kind":"course-material-retention","action":"activate","days_after_withdrawal":30,"rollback":"Withdraw the policy and close new intake."}',
     'Not a tenant policy request', 'RET-1004', 'approved', 'corr-retention-wrong', now());

  perform pg_temp.counted('the private authority table exposes no client or service table privilege',
    (select count(*) from information_schema.role_table_grants
      where table_schema = 'private' and table_name = 'course_material_retention_policy'
        and grantee in ('anon','authenticated','service_role')), 0);
  perform pg_temp.refused('an account without console authority', outsider, true,
    format('select public.publish_course_material_retention_policy(%L,%L)', activate, 'corr-run-outsider'));
  perform pg_temp.refused('an operator without fresh MFA', operator, false,
    format('select public.publish_course_material_retention_policy(%L,%L)', activate, 'corr-run-stale'));
  perform pg_temp.refused('a different console duty', operator, true,
    format('select public.publish_course_material_retention_policy(%L,%L)', wrong_duty, 'corr-run-wrong'));
  perform pg_temp.refused('a correlation id different from the approved request', operator, true,
    format('select public.publish_course_material_retention_policy(%L,%L)', activate, 'corr-run-mismatch'));

  perform set_config('request.jwt.claims', pg_temp.claims(operator, true)::text, true);
  set local role authenticated;
  select public.publish_course_material_retention_policy(activate, 'corr-retention-activate') into got;
  reset role;
  perform pg_temp.counted('an approved activation appends version one',
    (select count(*) from private.course_material_retention_policy p
      where p.tenant_id = 'retention-u' and p.version = 1 and p.state = 'active'
        and p.days_after_withdrawal = 90 and p.approval_request_id = activate), 1);
  perform pg_temp.counted('activation reports the bounded effect',
    ((got ->> 'policyVersion')::int = 1 and (got ->> 'state') = 'active'
      and (got ->> 'daysAfterWithdrawal')::int = 90)::int, 1);
  perform pg_temp.counted('the request and audit settle in the same transaction',
    (select count(*) from public.approval_request where id = activate and status = 'executed')
    + (select count(*) from private.console_audit_event where action = 'course_material_retention.changed'
        and tenant_id = 'retention-u' and detail ->> 'request' = activate::text), 2);
  perform pg_temp.counted('the server resolver returns the exact active version',
    (select count(*) from private.current_course_material_retention_policy('retention-u', now()) p
      where p.policy_version = 1 and p.days_after_withdrawal = 90), 1);
  perform pg_temp.refused('an executed approval replay', operator, true,
    format('select public.publish_course_material_retention_policy(%L,%L)', activate, 'corr-retention-activate'));

  perform set_config('request.jwt.claims', pg_temp.claims(operator, true)::text, true);
  set local role authenticated;
  perform public.publish_course_material_retention_policy(withdraw, 'corr-retention-withdraw');
  reset role;
  perform pg_temp.counted('withdrawal appends version two instead of rewriting history',
    (select count(*) from private.course_material_retention_policy p
      where p.tenant_id = 'retention-u' and p.version = 2 and p.state = 'withdrawn'
        and p.days_after_withdrawal is null), 1);
  perform pg_temp.counted('a withdrawn latest version closes shared intake',
    (select count(*) from private.current_course_material_retention_policy('retention-u', now())), 0);

  begin
    update private.course_material_retention_policy set days_after_withdrawal = 1
      where tenant_id = 'retention-u' and version = 1;
    raise exception 'FAILED: policy history was mutable';
  exception when sqlstate '23001' then
    raise notice 'ok  policy history updates are refused';
  end;
  begin
    delete from private.course_material_retention_policy
      where tenant_id = 'retention-u' and version = 1;
    raise exception 'FAILED: policy history was deletable';
  exception when sqlstate '23001' then
    raise notice 'ok  policy history deletes are refused';
  end;

  create function pg_temp.fail_retention_audit() returns trigger language plpgsql as $f$
  begin
    if new.action = 'course_material_retention.changed' then raise exception 'audit unavailable'; end if;
    return new;
  end $f$;
  create trigger fail_retention_audit before insert on private.console_audit_event
    for each row execute function pg_temp.fail_retention_audit();
  perform pg_temp.refused('a policy change whose audit append fails', operator, true,
    format('select public.publish_course_material_retention_policy(%L,%L)', rollback_req, 'corr-retention-rollback'));
  perform pg_temp.counted('audit failure rolls policy and approval execution back',
    (select count(*) from private.course_material_retention_policy where tenant_id = 'retention-other')
    + (select count(*) from public.approval_request where id = rollback_req and status = 'approved'), 1);
  drop trigger fail_retention_audit on private.console_audit_event;
end $$;

rollback;
