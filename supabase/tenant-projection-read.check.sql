-- Permissioned freshness read over the tenant projections (P1-07).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run: supabase/check.sh tenant-projection-read

begin;

create or replace function pg_temp.become(who uuid, assurance text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated', 'aal', assurance)::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.nobody()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.newuser(address text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  return who;
end $$;

create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  perform pg_temp.nobody();
  return false;
exception when insufficient_privilege then
  perform pg_temp.nobody();
  return true;
end $$;

create temp table ids (k text primary key, v uuid not null);

do $$
declare
  tenant_admin uuid := pg_temp.newuser('tenant-admin@projection-read.example');
  other_admin uuid := pg_temp.newuser('other-admin@projection-read.example');
  platform_operator uuid := pg_temp.newuser('platform@projection-read.example');
  stranger uuid := pg_temp.newuser('stranger@projection-read.example');
begin
  insert into public.schools (id, name, email_domains) values
    ('projection-read-a', 'Projection read A', array['projection-read-a.example']),
    ('projection-read-b', 'Projection read B', array['projection-read-b.example']);

  insert into public.role_grants
    (subject, role, scope_kind, scope_id, provenance, granted_at)
  values
    (tenant_admin, 'university_admin', 'school', 'projection-read-a', 'institution', now()),
    (other_admin, 'university_admin', 'school', 'projection-read-b', 'institution', now()),
    (platform_operator, 'platform_admin', 'platform', '', 'platform', now());

  insert into ids values
    ('tenant_admin', tenant_admin), ('other_admin', other_admin),
    ('platform_operator', platform_operator), ('stranger', stranger);

  insert into private.ops_tenant_entitlement_projection
    (tenant_id, capability, policy_id, state, deleted, revision,
     source_event_id, source_occurred_at, projected_at)
  values
    ('projection-read-a', 'alpha:view', gen_random_uuid(), 'production', false, 1,
     gen_random_uuid(), now() - interval '1 minute', now() - interval '30 seconds'),
    ('projection-read-a', 'beta:view', gen_random_uuid(), 'off', false, 2,
     gen_random_uuid(), now() - interval '1 minute', now() - interval '30 seconds'),
    ('projection-read-b', 'secret:view', gen_random_uuid(), 'production', false, 1,
     gen_random_uuid(), now() - interval '1 minute', now() - interval '30 seconds');

  insert into private.ops_tenant_rollout_projection
    (tenant_id, state, resume_state, revision, source_event_id,
     source_occurred_at, projected_at)
  values
    ('projection-read-a', 'requested', null, 1, gen_random_uuid(),
     now() - interval '1 minute', now() - interval '30 seconds'),
    ('projection-read-b', 'production_active', null, 4, gen_random_uuid(),
     now() - interval '1 minute', now() - interval '30 seconds');

  insert into private.projection_watermark
    (projection, version, last_event_id, last_occurred_at, last_processed_at,
     source_updated_at, status, lag_seconds)
  values
    ('ops_tenant_entitlements', 1, gen_random_uuid(), now() - interval '1 minute', now(), now() - interval '1 minute', 'idle', 60),
    ('ops_tenant_rollout', 1, gen_random_uuid(), now() - interval '1 minute', now(), now() - interval '1 minute', 'idle', 60)
  on conflict (projection, version) do update
    set last_event_id = excluded.last_event_id,
        last_occurred_at = excluded.last_occurred_at,
        last_processed_at = excluded.last_processed_at,
        source_updated_at = excluded.source_updated_at,
        status = excluded.status,
        last_error = null,
        lag_seconds = excluded.lag_seconds;
end $$;

grant select on table ids to authenticated;

do $$
begin
  if not pg_temp.refused((select v from ids where k = 'stranger'),
      $q$select public.read_tenant_projection('projection-read-a')$q$) then
    raise exception 'FAILED: a caller with no capability read a projection';
  end if;
  if not pg_temp.refused((select v from ids where k = 'tenant_admin'),
      $q$select public.read_tenant_projection('projection-read-b')$q$) then
    raise exception 'FAILED: changing the tenant widened a school-scoped grant';
  end if;
  raise notice 'ok  absent and wrong-tenant authority are explicit refusals';
end $$;

do $$
declare
  result jsonb;
begin
  perform pg_temp.become((select v from ids where k = 'tenant_admin'));
  result := public.read_tenant_projection('projection-read-a', null, 1);
  perform pg_temp.nobody();

  if result #>> '{data,tenantId}' <> 'projection-read-a'
     or jsonb_array_length(result #> '{data,entitlements}') <> 1
     or result #>> '{data,entitlements,0,capability}' <> 'alpha:view'
     or result #>> '{data,rollout,state}' <> 'requested'
     or result #>> '{meta,freshness}' <> 'fresh'
     or result #>> '{meta,authority}' <> 'projection'
     or result #>> '{meta,coverage,entitlements,hasMore}' <> 'true'
     or result #>> '{meta,coverage,entitlements,nextCursor}' <> 'alpha:view'
     or result #>> '{permissions,canView}' <> 'true'
     or result #>> '{permissions,canExport}' <> 'false'
     or jsonb_array_length(result -> 'warnings') <> 0
     or result::text ~ 'secret:view|projection-read-b|policy_id|source_event_id' then
    raise exception 'FAILED: the bounded fresh envelope leaked, omitted, or mislabeled data (%)', result;
  end if;
  raise notice 'ok  exact-tenant data is bounded, freshness-labeled, and minimally shaped';
end $$;

do $$
declare
  result jsonb;
begin
  update private.projection_watermark
     set last_occurred_at = now() - interval '10 minutes', status = 'idle'
   where projection = 'ops_tenant_entitlements' and version = 1;
  update private.projection_watermark
     set status = 'failed', last_error = 'private diagnostic'
   where projection = 'ops_tenant_rollout' and version = 1;

  perform pg_temp.become((select v from ids where k = 'platform_operator'), 'aal2');
  result := public.read_tenant_projection('projection-read-a');
  perform pg_temp.nobody();

  if result #>> '{meta,freshness}' <> 'failed'
     or result #>> '{meta,coverage,entitlements,freshness}' <> 'stale'
     or result #>> '{meta,coverage,rollout,freshness}' <> 'failed'
     or jsonb_array_length(result -> 'warnings') <> 2
     or result::text ~ 'private diagnostic' then
    raise exception 'FAILED: degraded freshness was hidden or leaked a worker error (%)', result;
  end if;
  raise notice 'ok  stale and failed projections remain usable with explicit bounded warnings';
end $$;

do $$
declare
  result jsonb;
begin
  delete from private.projection_watermark;
  delete from private.ops_tenant_entitlement_projection where tenant_id = 'projection-read-a';
  delete from private.ops_tenant_rollout_projection where tenant_id = 'projection-read-a';

  perform pg_temp.become((select v from ids where k = 'tenant_admin'));
  result := public.read_tenant_projection('projection-read-a');
  perform pg_temp.nobody();

  if result #>> '{meta,freshness}' <> 'unknown'
     or result #>> '{meta,coverage,entitlements,workerStatus}' <> 'unknown'
     or result #>> '{meta,coverage,rollout,present}' <> 'false'
     or jsonb_array_length(result #> '{data,entitlements}') <> 0
     or jsonb_array_length(result -> 'warnings') <> 2 then
    raise exception 'FAILED: absent watermarks or rows read as successful or fresh (%)', result;
  end if;
  raise notice 'ok  absent watermarks and data are unknown, never silently fresh';
end $$;

do $$
declare n bigint;
begin
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'read_tenant_projection'
     and p.prosecdef and p.provolatile = 's'
     and p.proconfig is not null
     and 'search_path=' = any (select left(c, 12) from unnest(p.proconfig) c);
  if n <> 1 then
    raise exception 'FAILED: the read RPC is not stable, definer, and search-path pinned';
  end if;
  if has_function_privilege('anon',
      'public.read_tenant_projection(text,text,integer)', 'execute')
     or not has_function_privilege('authenticated',
      'public.read_tenant_projection(text,text,integer)', 'execute') then
    raise exception 'FAILED: RPC execute grants do not match the guarded client contract';
  end if;
  if has_table_privilege('anon', 'private.ops_tenant_entitlement_projection', 'select')
     or has_table_privilege('authenticated', 'private.ops_tenant_entitlement_projection', 'select')
     or has_table_privilege('anon', 'private.ops_tenant_rollout_projection', 'select')
     or has_table_privilege('authenticated', 'private.ops_tenant_rollout_projection', 'select') then
    raise exception 'FAILED: a client role can bypass the read contract and query a projection table';
  end if;
  raise notice 'ok  only authenticated callers reach the guarded RPC; projection tables remain private';
end $$;

rollback;
