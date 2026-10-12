-- The platform registry projection (20261011120000): a capability is live only
-- when its full chain resolves, and the database refuses anything less.
-- LOCAL/DISPOSABLE DATABASES ONLY; this transaction is always rolled back.
-- How to run it: supabase/check.sh platform-registry
--
-- Each gate is shown to be a gate: the status change is attempted before the
-- condition is met and must be refused for the stated reason, then attempted
-- after and must go through. A refusal for the wrong reason fails the suite.

begin;

create or replace function pg_temp.refuses(what text, stmt text, want text default null)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if want is not null and position(lower(want) in lower(sqlerrm || ' ' || sqlstate)) = 0 then
      raise exception 'FAILED: % — refused for the wrong reason: % (%)', what, sqlerrm, sqlstate;
    end if;
    raise notice 'ok  % (refused: %)', what, left(sqlerrm, 90);
    return;
  end;
  raise exception 'FAILED: % — was allowed', what;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null');
  end if;
  raise notice 'ok  % (%)', what, got;
end $$;

do $$
declare
  t   text;
  p   text;
  f   text;
  ws  uuid;
  dep uuid;
  cap uuid;
  upstream uuid;
begin
  -- ── Nothing here is reachable from a browser ────────────────────────────
  foreach t in array array[
    'registry_workspaces', 'registry_capabilities', 'registry_capability_dependencies', 'registry_capability_evidence'
  ] loop
    perform pg_temp.counted(t || ' has row level security', (
      select relrowsecurity::int from pg_class where oid = ('private.' || t)::regclass
    ), 1);
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      perform pg_temp.counted(t || ': anon holds no ' || p,
        (select has_table_privilege('anon', 'private.' || t, p)::int), 0);
      perform pg_temp.counted(t || ': authenticated holds no ' || p,
        (select has_table_privilege('authenticated', 'private.' || t, p)::int), 0);
    end loop;
    perform pg_temp.counted(t || ': service_role may read',
      (select has_table_privilege('service_role', 'private.' || t, 'select')::int), 1);
  end loop;
  foreach f in array array[
    'private.registry_status_rank(private.registry_status)',
    'private.registry_capability_gate()',
    'private.registry_workspace_gate()'
  ] loop
    perform pg_temp.counted(f || ': anon cannot execute', has_function_privilege('anon', f, 'execute')::int, 0);
    perform pg_temp.counted(f || ': authenticated cannot execute', has_function_privilege('authenticated', f, 'execute')::int, 0);
  end loop;

  perform pg_temp.counted('registry_status has the seven lifecycle values', (
    select count(*) from pg_enum e join pg_type ty on ty.oid = e.enumtypid
     where ty.typname = 'registry_status'
  ), 7);
  perform pg_temp.counted('blocked and retired rank below draft', (
    select count(*) from unnest(array['blocked', 'retired']::private.registry_status[]) s
     where private.registry_status_rank(s) < private.registry_status_rank('draft')
  ), 2);

  -- ── A workspace, a dependency workspace, and a capability between them ──
  insert into private.registry_workspaces (workspace_key, name, os_family, base_route, owner_team, data_classification)
    values ('check_student', 'Student OS', 'Student OS', '/app/today', 'check', 'student-records') returning id into ws;
  insert into private.registry_workspaces (workspace_key, name, os_family, base_route, owner_team, data_classification)
    values ('check_identity', 'Identity OS', 'Identity OS', '/sign-in', 'check', 'internal') returning id into dep;
  insert into private.registry_capabilities (capability_key, workspace_id, name, description, risk_tier, authority_model)
    values ('check.upstream', dep, 'Upstream', 'A capability others depend on', 1, 'authority') returning id into upstream;
  insert into private.registry_capabilities (capability_key, workspace_id, name, description, risk_tier, authority_model)
    values ('check.readiness', ws, 'Readiness', 'Derived readiness result', 2, 'derived') returning id into cap;
  insert into private.registry_capability_dependencies values (cap, 'workspace', 'check_identity', 'active');
  insert into private.registry_capability_dependencies values (cap, 'capability', 'check.upstream', 'tested');
  insert into private.registry_capability_dependencies values (cap, 'system', 'audit', 'active');

  perform pg_temp.refuses('a dependency type outside the five is refused',
    format('insert into private.registry_capability_dependencies values (%L, ''vibes'', ''x'', ''active'')', cap), 'check');
  perform pg_temp.refuses('a route that is not a path is refused',
    'insert into private.registry_workspaces (workspace_key, name, os_family, base_route, owner_team, data_classification) values (''check_bad'', ''Bad'', ''Bad OS'', ''app/today'', ''check'', ''internal'')', 'check');
  perform pg_temp.refuses('a capability cannot be inserted as active: a row is not a live capability',
    format('insert into private.registry_capabilities (capability_key, workspace_id, name, description, risk_tier, authority_model, status) values (''check.born_live'', %L, ''Born live'', ''x'', 0, ''authority'', ''active'')', ws), 'test evidence');

  -- ── tested needs test evidence ──────────────────────────────────────────
  perform pg_temp.refuses('tested is refused without test evidence',
    format('update private.registry_capabilities set status = ''tested'' where id = %L', cap), 'test evidence');
  insert into private.registry_capability_evidence (capability_id, evidence_type, evidence_url)
    values (cap, 'code', 'packages/institution/src/readiness.ts');
  perform pg_temp.refuses('code evidence is not test evidence',
    format('update private.registry_capabilities set status = ''tested'' where id = %L', cap), 'test evidence');
  insert into private.registry_capability_evidence (capability_id, evidence_type, evidence_url)
    values (cap, 'test', 'supabase/platform-registry.check.sql');
  update private.registry_capabilities set status = 'implemented' where id = cap;
  update private.registry_capabilities set status = 'tested' where id = cap;
  perform pg_temp.counted('tested once test evidence exists',
    (select count(*) from private.registry_capabilities where id = cap and status = 'tested'), 1);

  -- ── deployed needs the workspace and every dependency at the required rank ──
  perform pg_temp.refuses('deployed is refused while the capability''s own workspace is draft',
    format('update private.registry_capabilities set status = ''deployed'' where id = %L', cap), 'workspace check_student is draft');
  update private.registry_workspaces set status = 'active' where id = ws;
  perform pg_temp.refuses('deployed is refused while the dependency workspace is draft',
    format('update private.registry_capabilities set status = ''deployed'' where id = %L', cap), 'check.upstream is tested (it is draft)');
  -- The upstream capability is checked before the workspace because dependencies are ordered by type then key.
  insert into private.registry_capability_evidence (capability_id, evidence_type, evidence_url)
    values (upstream, 'test', 'supabase/platform-registry.check.sql');
  update private.registry_capabilities set status = 'tested' where id = upstream;
  perform pg_temp.refuses('deployed is refused while workspace check_identity is draft',
    format('update private.registry_capabilities set status = ''deployed'' where id = %L', cap), 'workspace check_identity is active (it is draft)');
  update private.registry_workspaces set status = 'blocked' where id = dep;
  perform pg_temp.refuses('a blocked dependency never satisfies a requirement',
    format('update private.registry_capabilities set status = ''deployed'' where id = %L', cap), 'check_identity is active (it is blocked)');
  update private.registry_workspaces set status = 'active' where id = dep;
  update private.registry_capabilities set status = 'deployed' where id = cap;
  perform pg_temp.counted('deployed once the whole chain is at rank',
    (select count(*) from private.registry_capabilities where id = cap and status = 'deployed'), 1);
  perform pg_temp.counted('system and integration dependencies are recorded but not status-gated here',
    (select count(*) from private.registry_capability_dependencies where capability_id = cap and dependency_type = 'system'), 1);

  -- ── active needs verified, unexpired evidence ───────────────────────────
  perform pg_temp.refuses('active is refused while no evidence is verified',
    format('update private.registry_capabilities set status = ''active'' where id = %L', cap), 'verified evidence');
  update private.registry_capability_evidence set verified_at = now(), status = 'tested'
    where capability_id = cap and evidence_type = 'test';
  update private.registry_capabilities set status = 'active' where id = cap;
  perform pg_temp.counted('active once evidence is verified',
    (select count(*) from private.registry_capabilities where id = cap and status = 'active'), 1);
  perform pg_temp.refuses('evidence cannot expire before it was verified',
    format('update private.registry_capability_evidence set expires_at = verified_at - interval ''1 day'' where capability_id = %L and evidence_type = ''test''', cap), 'check');
  update private.registry_capability_evidence set verified_at = now() - interval '2 days', expires_at = now() - interval '1 day'
    where capability_id = cap and evidence_type = 'test';
  perform pg_temp.refuses('expired evidence cannot keep a capability active on its next write',
    format('update private.registry_capabilities set name = ''Readiness v2'' where id = %L', cap), 'verified evidence');

  -- ── a workspace cannot fall out from under a live capability ────────────
  perform pg_temp.refuses('a workspace cannot be blocked under an active capability',
    format('update private.registry_workspaces set status = ''blocked'' where id = %L', ws), 'check.readiness is deployed or active');
  perform pg_temp.refuses('a workspace cannot be retired under an active capability',
    format('update private.registry_workspaces set status = ''retired'' where id = %L', ws), 'check.readiness is deployed or active');
  update private.registry_capabilities set status = 'retired' where id = cap;
  update private.registry_workspaces set status = 'retired' where id = ws;
  perform pg_temp.counted('a workspace retires once nothing in it is live',
    (select count(*) from private.registry_workspaces where id = ws and status = 'retired'), 1);

  -- ── keys are stable and unique ──────────────────────────────────────────
  perform pg_temp.refuses('a second capability with the same key is refused',
    format('insert into private.registry_capabilities (capability_key, workspace_id, name, description, risk_tier, authority_model) values (''check.upstream'', %L, ''Again'', ''x'', 0, ''authority'')', dep), 'unique');
  perform pg_temp.refuses('a capability key with capitals is refused',
    format('insert into private.registry_capabilities (capability_key, workspace_id, name, description, risk_tier, authority_model) values (''Check.Upper'', %L, ''Upper'', ''x'', 0, ''authority'')', dep), 'check');
  perform pg_temp.refuses('the same evidence cannot be recorded twice',
    format('insert into private.registry_capability_evidence (capability_id, evidence_type, evidence_url) values (%L, ''test'', ''supabase/platform-registry.check.sql'')', upstream), 'unique');
end $$;

rollback;
