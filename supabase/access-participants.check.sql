-- The access saga's policy administrator and enforcement point
-- (20261012050000_access_participants).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold, the barrier first:
--   * an installation whose generation is at or below the revoked one is
--     refused however late it arrives: after `revoke_pa` at generation 0, the
--     install of generation 0's grant raises SC423 and the point holds nothing,
--     and a `prepare` at generation 0 raises SC423 too; a revocation never
--     lowers the barrier;
--   * `prepare` needs a decision (SC422), supersedes an earlier generation's
--     grant, and answers a repeated key with the first grant, not a second;
--   * `install` refuses an unknown (SC404), superseded (SC409), expired (SC410)
--     and revoked (SC423) grant, holds one enforcement per grant however often
--     it is repeated, and does not reinstate a removed one (SC423);
--   * `inspect` is `installed` for the held grant, `conflict` for another grant
--     of the same saga, `absent` otherwise, and `absent` once removed;
--   * `revoke_pa` revokes by saga and generation with no grant id, so a grant
--     prepared before a crash is revoked, and `remove_pep` removes every
--     enforcement; both are `confirmed` and repeat under their key;
--   * `verify_cleanup` confirms each side on its own;
--   * all four tables are service-only, the six functions run for service_role
--     alone, nothing is deleted, receipts are append-only;
--   * the probe is not broken: a statement that is allowed makes the "must be
--     refused" helper fail.

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
    raise notice 'ok  % (refused: %)', what, left(sqlerrm, 60);
    return;
  end;
  raise exception 'FAILED: % — was allowed', what;
end $$;

create or replace function pg_temp.allows(what text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise notice 'ok  % (allowed)', what;
exception when others then
  raise exception 'FAILED: % — was refused: %', what, sqlerrm;
end $$;

create or replace function pg_temp.counted(what text, got bigint, want bigint)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got::text, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.equals(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, coalesce(got, 'null'); end if;
  raise notice 'ok  % (%)', what, got;
end $$;

-- A saga at `st`, generation `gen`, with a decision unless `decided` is false.
create or replace function pg_temp.saga(sid text, st text default 'PREPARING', gen integer default 0, decided boolean default true)
returns void language sql as $$
  insert into public.access_sagas (id, tenant_id, subject_id, intent_resource_id, intent_action, request_digest, definition_version,
                                   state, generation, deadline_at, next_attempt_at, decision_id)
  values (sid, 't1', 'u1', 'r1', 'registration.readiness.view', repeat('a', 64), '1', st, gen, 9999999999999, 0,
          case when decided then 'dec-' || sid else null end);
$$;

do $$
declare
  t text;
  p text;
  f text;
  g jsonb;
  g2 jsonb;
  v jsonb;
begin
  -- ── The control: the probe itself ─────────────────────────────────────
  begin
    perform pg_temp.refuses('control: an allowed statement', 'select 1');
    raise exception 'probe broken: an allowed statement passed as refused';
  exception when others then
    if sqlerrm not like 'FAILED: control: an allowed statement%' then raise; end if;
    raise notice 'ok  control: the refusal probe fails on an allowed statement';
  end;

  -- ── Service-only ──────────────────────────────────────────────────────
  foreach t in array array['access_grants', 'access_revocations', 'access_enforcements', 'access_operation_receipts'] loop
    perform pg_temp.counted(t || ' has row level security on',
      (select relrowsecurity::int from pg_class where oid = ('public.' || t)::regclass), 1);
    perform pg_temp.counted(t || ' has no policy',
      (select count(*) from pg_policies where schemaname = 'public' and tablename = t), 0);
    foreach p in array array['select', 'insert', 'update', 'delete', 'references', 'trigger', 'truncate'] loop
      perform pg_temp.counted(t || ': anon holds no ' || p, (select has_table_privilege('anon', 'public.' || t, p)::int), 0);
      perform pg_temp.counted(t || ': authenticated holds no ' || p, (select has_table_privilege('authenticated', 'public.' || t, p)::int), 0);
    end loop;
  end loop;
  foreach f in array array['access_pa_prepare(text, text, bigint)', 'access_pep_install(text, text, text)', 'access_pep_inspect(text, text)',
                           'access_pa_revoke(text, text, integer)', 'access_pep_remove(text, text)', 'access_cleanup_verify(text, integer)'] loop
    perform pg_temp.counted(f || ': anon cannot execute', (select has_function_privilege('anon', 'public.' || f, 'execute')::int), 0);
    perform pg_temp.counted(f || ': authenticated cannot execute', (select has_function_privilege('authenticated', 'public.' || f, 'execute')::int), 0);
    perform pg_temp.counted(f || ': service_role executes', (select has_function_privilege('service_role', 'public.' || f, 'execute')::int), 1);
  end loop;

  -- ── The barrier ───────────────────────────────────────────────────────
  perform pg_temp.saga('b1');
  g := public.access_pa_prepare('["b1","1",0,"prepare"]', 'b1', 3600000);
  perform pg_temp.equals('a grant is prepared for generation 0', g->>'id', 'grant:b1:0');
  -- The revocation lands first; the install's message is late.
  perform pg_temp.equals('revoke_pa at generation 0 is confirmed', public.access_pa_revoke('["b1","1",0,"revoke_pa"]', 'b1', 0), 'confirmed');
  perform pg_temp.refuses('BARRIER: a late install of generation 0 is refused',
    $s$select public.access_pep_install('["b1","1",0,"install"]', 'b1', 'grant:b1:0')$s$, 'SC423');
  perform pg_temp.counted('BARRIER: the point holds nothing', (select count(*) from public.access_enforcements where saga_id = 'b1'), 0);
  perform pg_temp.equals('BARRIER: inspect says absent', public.access_pep_inspect('b1', 'grant:b1:0'), 'absent');
  perform pg_temp.refuses('BARRIER: a late prepare at generation 0 is refused',
    $s$select public.access_pa_prepare('["b1","1",0,"prepare-again"]', 'b1', 3600000)$s$, 'SC423');
  perform pg_temp.equals('the grant is marked revoked', (select status from public.access_grants where id = 'grant:b1:0'), 'revoked');
  perform pg_temp.equals('revoke_pa at a lower generation is confirmed', public.access_pa_revoke('["b1","1",0,"revoke_pa-lower"]', 'b1', 0), 'confirmed');
  perform pg_temp.counted('and the barrier did not fall', (select through_generation from public.access_revocations where saga_id = 'b1'), 0);
  perform pg_temp.refuses('the barrier cannot be removed', $s$delete from public.access_revocations where saga_id = 'b1'$s$, 'not removed');
  v := public.access_cleanup_verify('b1', 0);
  perform pg_temp.equals('verify: the administrator side is clean', v->>'paRevoked', 'true');
  perform pg_temp.equals('verify: the enforcement side is clean', v->>'pepAbsent', 'true');
  perform pg_temp.allows('the barrier may rise by hand', $s$update public.access_revocations set through_generation = 2 where saga_id = 'b1'$s$);
  perform pg_temp.refuses('the barrier cannot be lowered by hand', $s$update public.access_revocations set through_generation = 1 where saga_id = 'b1'$s$, 'only rises');

  -- The barrier at generation 1 covers generation 0's prepared grant that no saga row names.
  perform pg_temp.saga('b2', 'PREPARING', 0);
  perform public.access_pa_prepare('["b2","1",0,"prepare"]', 'b2', 3600000);
  perform pg_temp.equals('revoke_pa at generation 1 with no grant id is confirmed', public.access_pa_revoke('["b2","1",1,"revoke_pa"]', 'b2', 1), 'confirmed');
  perform pg_temp.equals('the unrecorded grant of generation 0 is revoked', (select status from public.access_grants where id = 'grant:b2:0'), 'revoked');
  perform pg_temp.refuses('and cannot be installed', $s$select public.access_pep_install('["b2","1",0,"install"]', 'b2', 'grant:b2:0')$s$, 'SC423');

  -- ── prepare ───────────────────────────────────────────────────────────
  perform pg_temp.saga('p1', 'PREPARING', 0, false);
  perform pg_temp.refuses('prepare needs a decision', $s$select public.access_pa_prepare('["p1","1",0,"prepare"]', 'p1', 3600000)$s$, 'SC422');
  perform pg_temp.refuses('prepare needs a saga', $s$select public.access_pa_prepare('["nope","1",0,"prepare"]', 'nope', 3600000)$s$, 'SC404');
  perform pg_temp.refuses('prepare bounds the ttl', $s$select public.access_pa_prepare('["p1","1",0,"prepare"]', 'p1', 0)$s$, 'between');
  perform pg_temp.saga('p2');
  g := public.access_pa_prepare('["p2","1",0,"prepare"]', 'p2', 3600000);
  g2 := public.access_pa_prepare('["p2","1",0,"prepare"]', 'p2', 60000);
  perform pg_temp.equals('a repeated key returns the first grant', g2::text, g::text);
  perform pg_temp.counted('and prepares no second', (select count(*) from public.access_grants where saga_id = 'p2'), 1);
  perform pg_temp.counted('the grant expires when the ttl says', (select (g->>'expiresAt')::bigint - private.access_now_ms() between 3500000 and 3600000)::int, 1);
  -- The saga walks PREPARING → INSTALLING → RECONCILING → EVALUATING, the way an install found absent does, and is at generation 1.
  update public.access_sagas set revision = revision + 1, state = 'INSTALLING', grant_id = 'grant:p2:0', grant_expires_at = (g->>'expiresAt')::bigint where id = 'p2';
  update public.access_sagas set revision = revision + 1, state = 'RECONCILING' where id = 'p2';
  update public.access_sagas set revision = revision + 1, state = 'EVALUATING', generation = 1, grant_id = null, grant_expires_at = null, stale_grant_possible = true where id = 'p2';
  g2 := public.access_pa_prepare('["p2","1",1,"prepare"]', 'p2', 3600000);
  perform pg_temp.equals('a later generation prepares its own grant', g2->>'id', 'grant:p2:1');
  perform pg_temp.equals('and supersedes the earlier one', (select status from public.access_grants where id = 'grant:p2:0'), 'superseded');
  perform pg_temp.refuses('a superseded grant is not installed', $s$select public.access_pep_install('["p2","1",0,"install"]', 'p2', 'grant:p2:0')$s$, 'SC409');

  -- ── install and inspect ───────────────────────────────────────────────
  perform pg_temp.saga('i1');
  g := public.access_pa_prepare('["i1","1",0,"prepare"]', 'i1', 3600000);
  perform pg_temp.equals('inspect before install: absent', public.access_pep_inspect('i1', g->>'id'), 'absent');
  perform pg_temp.refuses('install refuses an unknown grant', $s$select public.access_pep_install('["i1","1",0,"install-x"]', 'i1', 'grant:nope')$s$, 'SC404');
  perform pg_temp.refuses('install refuses another saga''s grant', $s$select public.access_pep_install('["i1","1",0,"install-y"]', 'i1', 'grant:p2:1')$s$, 'SC404');
  perform public.access_pep_install('["i1","1",0,"install"]', 'i1', g->>'id');
  perform public.access_pep_install('["i1","1",0,"install"]', 'i1', g->>'id');
  perform pg_temp.counted('one enforcement however often the key repeats', (select count(*) from public.access_enforcements where saga_id = 'i1'), 1);
  perform pg_temp.equals('inspect after install: installed', public.access_pep_inspect('i1', g->>'id'), 'installed');
  perform pg_temp.equals('inspect for another grant id of the saga: conflict', public.access_pep_inspect('i1', 'grant:i1:9'), 'conflict');
  perform pg_temp.equals('inspect with no grant id while one is held: conflict', public.access_pep_inspect('i1', null), 'conflict');
  v := public.access_cleanup_verify('i1', 0);
  perform pg_temp.equals('verify while installed: pa not revoked', v->>'paRevoked', 'false');
  perform pg_temp.equals('verify while installed: pep not absent', v->>'pepAbsent', 'false');
  perform pg_temp.refuses('an enforcement is not deleted', $s$delete from public.access_enforcements where saga_id = 'i1'$s$, 'removed_at');

  perform pg_temp.equals('remove_pep is confirmed', public.access_pep_remove('["i1","1",0,"remove_pep"]', 'i1'), 'confirmed');
  perform pg_temp.equals('remove_pep repeats under its key', public.access_pep_remove('["i1","1",0,"remove_pep"]', 'i1'), 'confirmed');
  perform pg_temp.equals('inspect after removal: absent', public.access_pep_inspect('i1', g->>'id'), 'absent');
  perform pg_temp.refuses('a removed enforcement is not reinstated', $s$select public.access_pep_install('["i1","1",0,"install-late"]', 'i1', 'grant:i1:0')$s$, 'SC423');
  perform pg_temp.refuses('nor by hand', $s$update public.access_enforcements set removed_at = null where saga_id = 'i1'$s$, 'reinstated');
  v := public.access_cleanup_verify('i1', 0);
  perform pg_temp.equals('verify after remove_pep alone: pa still not revoked', v->>'paRevoked', 'false');
  perform pg_temp.equals('verify after remove_pep alone: pep absent', v->>'pepAbsent', 'true');
  perform public.access_pa_revoke('["i1","1",0,"revoke_pa"]', 'i1', 0);
  v := public.access_cleanup_verify('i1', 0);
  perform pg_temp.equals('verify after both: pa revoked', v->>'paRevoked', 'true');

  -- An expired grant is not installed.
  perform pg_temp.saga('x1');
  g := public.access_pa_prepare('["x1","1",0,"prepare"]', 'x1', 1);
  perform pg_sleep(0.01);
  perform pg_temp.refuses('install refuses an expired grant', $s$select public.access_pep_install('["x1","1",0,"install"]', 'x1', 'grant:x1:0')$s$, 'SC410');

  -- ── Receipts and grants keep their history ────────────────────────────
  perform pg_temp.refuses('a receipt is not rewritten', $s$update public.access_operation_receipts set result = '{}' where saga_id = 'i1'$s$, 'append-only');
  perform pg_temp.refuses('a receipt is not deleted', $s$delete from public.access_operation_receipts where saga_id = 'i1'$s$, 'append-only');
  perform pg_temp.refuses('a grant is not deleted', $s$delete from public.access_grants where saga_id = 'i1'$s$, 'not deleted');
  perform pg_temp.refuses('a revoked grant stays revoked', $s$update public.access_grants set status = 'prepared', revoked_at = null where id = 'grant:i1:0'$s$, 'stays revoked');
  perform pg_temp.refuses('a grant keeps its expiry', $s$update public.access_grants set expires_at = 0 where id = 'grant:p2:1'$s$, 'identity');

  raise notice 'access-participants: every check passed';
end $$;

rollback;
