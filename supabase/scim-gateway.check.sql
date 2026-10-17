-- The SCIM gateway wrappers (20260928200000_scim_gateway.sql).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- Two questions. Can anybody but the service role reach them — a signed-in
-- account, a signed-out visitor, anybody granted through PUBLIC? And do they
-- do exactly what the private functions they wrap do, plus the refusal record
-- and nothing more?

begin;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got <> want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused_as(who text, statement text)
returns boolean language plpgsql as $$
begin
  execute format('set local role %I', who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

do $$
declare
  cred uuid := gen_random_uuid();
  other_cred uuid := gen_random_uuid();
  revoked_cred uuid := gen_random_uuid();
  expired_cred uuid := gen_random_uuid();
  live boolean;
  member uuid;
  again uuid;
  n bigint;
  wrote boolean;
  fn text;
  who text;
begin
  insert into public.schools (id, name, email_domains) values
    ('scim-gw', 'SCIM Gateway University', array['scim-gw.example']),
    ('scim-gw-other', 'Other SCIM University', array['scim-gw-other.example']);
  insert into public.scim_credential (id, tenant_id, label, secret_salt, secret_hash, status) values
    (cred, 'scim-gw', 'Primary', decode('00112233445566778899aabbccddeeff', 'hex'),
     digest(decode('00112233445566778899aabbccddeeff', 'hex') || convert_to('secret', 'utf8'), 'sha256'), 'active'),
    (other_cred, 'scim-gw-other', 'Other', decode('ffeeddccbbaa99887766554433221100', 'hex'),
     digest(decode('ffeeddccbbaa99887766554433221100', 'hex') || convert_to('other', 'utf8'), 'sha256'), 'active');
  insert into public.scim_credential (id, tenant_id, label, secret_salt, secret_hash, status, revoked_at, expires_at) values
    (revoked_cred, 'scim-gw', 'Revoked', decode('00112233445566778899aabbccddeeff', 'hex'),
     digest(decode('00112233445566778899aabbccddeeff', 'hex') || convert_to('old', 'utf8'), 'sha256'), 'revoked', now(), null),
    (expired_cred, 'scim-gw', 'Expired', decode('00112233445566778899aabbccddeeff', 'hex'),
     digest(decode('00112233445566778899aabbccddeeff', 'hex') || convert_to('late', 'utf8'), 'sha256'), 'active', null, now() - interval '1 day');

  -- ── Nobody but the service role ────────────────────────────────────────

  foreach fn in array array[
    format('select * from public.scim_gateway_credential(%L)', cred),
    format('select public.scim_gateway_provision_user(%L, %L, %L, %L, %L, null, true)', 'scim-gw', cred, 'probe-1', 'ext-probe', 'probe@scim-gw.example'),
    format('select public.scim_gateway_replace_group(%L, %L, %L, %L, %L, %L)', 'scim-gw', cred, 'probe-2', 'grp', 'Group', '{}'),
    format('select public.scim_gateway_record_refusal(%L, %L, %L, %L, 400, %L)', 'scim-gw', cred, 'probe-3', 'User', 'x')
  ] loop
    foreach who in array array['anon', 'authenticated'] loop
      if not pg_temp.refused_as(who, fn) then
        raise exception 'FAILED: % could run %', who, fn;
      end if;
    end loop;
  end loop;
  raise notice 'ok  neither anon nor authenticated can call any of the four';

  select count(*) into n
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname like 'scim_gateway_%'
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
          or not has_function_privilege('service_role', p.oid, 'execute'));
  perform pg_temp.counted('every scim_gateway_ function is service-role only, by catalogue', n, 0);
  select count(*) into n
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname like 'scim_gateway_%';
  perform pg_temp.counted('and the catalogue sweep found all four, so it is about something', n, 4);

  -- ── The wrappers do what the private functions do ──────────────────────

  set local role service_role;

  select count(*) into n from public.scim_gateway_credential(cred);
  perform pg_temp.counted('an active credential''s material is returned', n, 1);
  select c.active into live from public.scim_gateway_credential(cred) c;
  if live is not true then raise exception 'FAILED: a live credential came back inactive'; end if;
  raise notice 'ok  a live credential is marked active';

  -- A known but dead credential still names its tenant, so its refusal can
  -- be recorded; it is never marked active.
  select count(*) into n from public.scim_gateway_credential(revoked_cred) c where c.tenant_id = 'scim-gw' and not c.active;
  perform pg_temp.counted('a revoked credential is returned, inactive, with its tenant', n, 1);
  select count(*) into n from public.scim_gateway_credential(expired_cred) c where c.tenant_id = 'scim-gw' and not c.active;
  perform pg_temp.counted('an expired credential is returned, inactive, with its tenant', n, 1);
  select count(*) into n from public.scim_gateway_credential(gen_random_uuid());
  perform pg_temp.counted('an unknown id returns nothing', n, 0);
  wrote := public.scim_gateway_record_refusal('scim-gw', revoked_cred, 'req-revoked', 'User', 401, 'revoked');
  -- The gateway calls service-only RPCs. Inspect their effects as the test
  -- owner; that does not require exposing internal audit tables to the key.
  reset role;
  select count(*) into n from public.provisioning_audit_event where credential_id = revoked_cred and request_id = 'req-revoked';
  perform pg_temp.counted('a refusal from a revoked credential is recorded', n, 1);
  set local role service_role;

  member := public.scim_gateway_provision_user('scim-gw', cred, 'req-1', 'ext-1', 'Ada@Scim-GW.example', 'Ada', true);
  again := public.scim_gateway_provision_user('scim-gw', cred, 'req-1', 'ext-1', 'Ada@Scim-GW.example', 'Ada', true);
  if member is distinct from again then raise exception 'FAILED: a replayed request id made a second membership'; end if;
  raise notice 'ok  a replayed request id returns the same membership';

  reset role;
  select count(*) into n from public.scim_external_identity where tenant_id = 'scim-gw' and user_name = 'ada@scim-gw.example';
  perform pg_temp.counted('the user name is stored lower-cased, as the private function does', n, 1);
  set local role service_role;

  if not pg_temp.refused_as('service_role',
       format('select public.scim_gateway_provision_user(%L, %L, %L, %L, %L, null, true)', 'scim-gw', other_cred, 'req-x', 'ext-x', 'x@scim-gw.example')) then
    raise exception 'FAILED: another tenant''s credential provisioned into this tenant';
  end if;
  raise notice 'ok  a credential cannot provision into a tenant it does not belong to';

  set local role service_role;
  perform public.scim_gateway_replace_group('scim-gw', cred, 'req-2', 'unmapped-group', 'Unmapped', array['ext-1']);
  reset role;
  select count(*) into n from public.provisioning_audit_event where tenant_id = 'scim-gw' and request_id = 'req-2' and outcome = 'unknown_group';
  perform pg_temp.counted('an unmapped group is recorded as unknown and grants nothing', n, 1);
  select count(*) into n from public.institution_membership where id = member and roles <> '{}';
  perform pg_temp.counted('and the member''s roles are unchanged', n, 0);
  set local role service_role;

  -- ── Refusals: recorded once, never over an accepted event ──────────────

  wrote := public.scim_gateway_record_refusal('scim-gw', cred, 'req-3', 'User', 400, 'externalId cannot change');
  if not wrote then raise exception 'FAILED: a new refusal was not recorded'; end if;
  wrote := public.scim_gateway_record_refusal('scim-gw', cred, 'req-3', 'User', 400, 'again');
  if wrote then raise exception 'FAILED: a second refusal for one request id was written'; end if;
  wrote := public.scim_gateway_record_refusal('scim-gw', cred, 'req-1', 'User', 503, 'late failure');
  if wrote then raise exception 'FAILED: a refusal overwrote an accepted event'; end if;
  reset role;
  select count(*) into n from public.provisioning_audit_event where tenant_id = 'scim-gw' and request_id in ('req-1', 'req-3');
  perform pg_temp.counted('one event per request id, the first one', n, 2);
  select count(*) into n from public.provisioning_audit_event where request_id = 'req-1' and outcome = 'accepted';
  perform pg_temp.counted('and req-1 is still the accepted one', n, 1);
  set local role service_role;

  if not pg_temp.refused_as('service_role',
       format('select public.scim_gateway_record_refusal(%L, %L, %L, %L, 400, %L)', 'scim-gw', other_cred, 'req-4', 'User', 'x')) then
    raise exception 'FAILED: a refusal was recorded against a tenant the credential is not in';
  end if;
  raise notice 'ok  a refusal must name a credential of the same tenant';
  if not pg_temp.refused_as('service_role',
       format('select public.scim_gateway_record_refusal(%L, %L, %L, %L, 400, %L)', 'scim-gw', cred, 'req-5', 'Credential', 'x')) then
    raise exception 'FAILED: a refusal of a non-SCIM resource type was recorded';
  end if;
  raise notice 'ok  only User and Group refusals are recorded';

  reset role;
  raise notice 'scim gateway: every check passed';
end $$;

rollback;
