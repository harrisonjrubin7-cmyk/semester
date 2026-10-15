-- The projection tables and the outbox's claim columns (backlog P1-01).
--
-- Four tables that nothing reads yet, so what is asserted is the shape a worker
-- will be able to trust: no client role reaches them, a half-finished state
-- cannot be written, and the outbox's old writers still work with the new
-- columns in place. Every probe has a control that passes a well-formed row,
-- because a probe that refuses everything looks identical to one that works.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run it: supabase/check.sh projection-foundation

begin;

create or replace function pg_temp.become(who uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.newuser(address text, school text)
returns uuid language plpgsql as $$
declare who uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email,
                          email_confirmed_at, created_at, updated_at)
  values (who, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', address, now(), now(), now());
  insert into public.profiles (user_id, handle, school_id)
  values (who, split_part(address, '@', 1), school);
  return who;
end $$;

/** Whether a statement, run as the signed-in account, is refused. */
create or replace function pg_temp.refused(who uuid, statement text)
returns boolean language plpgsql as $$
begin
  perform pg_temp.become(who);
  execute statement;
  execute 'reset role';
  return false;
exception when others then
  execute 'reset role';
  return true;
end $$;

/** Whether a statement, run as the owner, is refused by a constraint. */
create or replace function pg_temp.constrained(statement text)
returns boolean language plpgsql as $$
begin
  execute statement;
  return false;
exception when check_violation or unique_violation or not_null_violation or foreign_key_violation then
  return true;
end $$;

insert into public.schools (id, name, email_domains) values
  ('proj-a', 'Projection A', array['a.example']);

do $$
declare
  student uuid;
  t text;
  p text;
  n integer;
  tables text[] := array['read_model_registry', 'projection_watermark',
                         'projection_invalidation', 'projection_rebuild_run'];
begin
  student := pg_temp.newuser('student@a.example', 'proj-a');

  -- ── No client role reaches any of the four ──────────────────────────────
  foreach t in array tables loop
    if not (select relrowsecurity from pg_class where oid = ('private.' || t)::regclass) then
      raise exception 'FAILED: row-level security is off on private.%', t;
    end if;
    foreach p in array array['select', 'insert', 'update', 'delete'] loop
      if has_table_privilege('anon', 'private.' || t, p) or has_table_privilege('authenticated', 'private.' || t, p) then
        raise exception 'FAILED: a client role holds % on private.%', upper(p), t;
      end if;
      if not has_table_privilege('service_role', 'private.' || t, p) then
        raise exception 'FAILED: control — the service role lacks % on private.%', upper(p), t;
      end if;
    end loop;
    if not pg_temp.refused(student, format('select * from private.%I', t)) then
      raise exception 'FAILED: a signed-in account read private.%', t;
    end if;
  end loop;
  raise notice 'ok  four tables: RLS on, no client privilege, a signed-in account is refused, the service role holds all four';

  -- ── The outbox: old writers still work, the claim pair cannot be half-set ─
  insert into private.domain_outbox_events
    (aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
     correlation_id, idempotency_key, payload, data_classification, retention_class)
  values ('approval_request', 'ar-1', 'approval.requested', 1, 'production', 'proj-a', 'console',
          'req-0123456789abcdef', 'ar-1:v1', '{"id":"ar-1"}', 'internal', 'operational');
  select count(*) into n from private.domain_outbox_events
   where idempotency_key = 'ar-1:v1' and claim_id is null and claimed_at is null and next_attempt_at is null;
  if n <> 1 then raise exception 'FAILED: an event written without the new columns did not default them to null (%)', n; end if;
  raise notice 'ok  an event written the old way keeps the new columns null';

  if not pg_temp.constrained($u$update private.domain_outbox_events set claim_id = gen_random_uuid() where idempotency_key = 'ar-1:v1'$u$) then
    raise exception 'FAILED: a claim id with no claim time was stored';
  end if;
  if not pg_temp.constrained($u$update private.domain_outbox_events set claimed_at = now() where idempotency_key = 'ar-1:v1'$u$) then
    raise exception 'FAILED: a claim time with no claim id was stored';
  end if;
  update private.domain_outbox_events
     set claim_id = gen_random_uuid(), claimed_at = now(), next_attempt_at = now() + interval '30 seconds'
   where idempotency_key = 'ar-1:v1';
  if not exists (select 1 from pg_indexes where schemaname = 'private' and indexname = 'domain_outbox_claimable') then
    raise exception 'FAILED: the claim index is missing';
  end if;
  raise notice 'ok  a claim is both id and time or neither; the claim index exists';

  -- ── Watermark: a named event needs a time, lag is not negative ──────────
  insert into private.projection_watermark (projection, version) values ('ops_tenant_overview', 1);
  if (select status from private.projection_watermark where projection = 'ops_tenant_overview') <> 'idle' then
    raise exception 'FAILED: a new watermark did not start idle';
  end if;
  if not pg_temp.constrained($w$insert into private.projection_watermark (projection, version, last_event_id) values ('ops_inbox', 1, gen_random_uuid())$w$) then
    raise exception 'FAILED: a watermark named an event with no time, so its lag cannot be computed';
  end if;
  if not pg_temp.constrained($w$insert into private.projection_watermark (projection, version, status) values ('ops_inbox', 1, 'fresh')$w$) then
    raise exception 'FAILED: a watermark stored "fresh", which is computed and never asserted';
  end if;
  if not pg_temp.constrained($w$insert into private.projection_watermark (projection, version, lag_seconds) values ('ops_inbox', 1, -1)$w$) then
    raise exception 'FAILED: a negative lag was stored';
  end if;
  if not pg_temp.constrained($w$insert into private.projection_watermark (projection, version) values ('ops_tenant_overview', 1)$w$) then
    raise exception 'FAILED: one projection version had two watermarks';
  end if;
  insert into private.projection_watermark (projection, version, last_event_id, last_occurred_at)
    values ('ops_inbox', 1, gen_random_uuid(), now());
  raise notice 'ok  a watermark needs a time for any event it names, and "fresh" is not a stored status';

  -- ── Registry: a read model names a real capability, a scope and an SLO ──
  insert into private.read_model_registry (name, version, capability, scope_kind, freshness_slo_seconds, redaction_profile)
    values ('ops_tenant_overview', 1, 'console:operate', 'platform', 60, 'operator');
  if (select status from private.read_model_registry where name = 'ops_tenant_overview') <> 'proposed' then
    raise exception 'FAILED: a new read model did not start proposed';
  end if;
  if not pg_temp.constrained($r$insert into private.read_model_registry (name, version, capability, scope_kind, freshness_slo_seconds, redaction_profile) values ('ops_x_y', 1, 'console:operate', 'galaxy', 60, 'operator')$r$) then
    raise exception 'FAILED: an unknown scope kind was stored';
  end if;
  if not pg_temp.constrained($r$insert into private.read_model_registry (name, version, capability, scope_kind, freshness_slo_seconds, redaction_profile) values ('ops_x_y', 1, 'console:operate', 'platform', 0, 'operator')$r$) then
    raise exception 'FAILED: a freshness SLO of zero was stored';
  end if;
  if not pg_temp.constrained($r$insert into private.read_model_registry (name, version, capability, scope_kind, freshness_slo_seconds, redaction_profile) values ('Ops X', 1, 'console:operate', 'platform', 60, 'operator')$r$) then
    raise exception 'FAILED: a read model name that is not snake_case was stored';
  end if;
  if not pg_temp.constrained($r$insert into private.read_model_registry (name, version, capability, scope_kind, freshness_slo_seconds, redaction_profile) values ('ops_x_y', 1, 'everything', 'platform', 60, 'operator')$r$) then
    raise exception 'FAILED: a capability that is not area:action was stored';
  end if;
  if not pg_temp.constrained($r$insert into private.read_model_registry (name, version, capability, scope_kind, freshness_slo_seconds, redaction_profile) values ('ops_tenant_overview', 1, 'console:operate', 'platform', 60, 'operator')$r$) then
    raise exception 'FAILED: one read model version was registered twice';
  end if;
  raise notice 'ok  a read model has a scope, a positive SLO, a capability shaped area:action, and one row per version';

  -- ── Rebuild: a half-finished run cannot read as a pass ──────────────────
  insert into private.projection_rebuild_run (projection, from_version, to_version, mode)
    values ('ops_inbox', 1, 2, 'shadow');
  if not pg_temp.constrained($b$insert into private.projection_rebuild_run (projection, from_version, to_version, mode, status, finished_at) values ('ops_inbox', 1, 2, 'shadow', 'succeeded', now())$b$) then
    raise exception 'FAILED: a rebuild succeeded with no verdict on parity';
  end if;
  if not pg_temp.constrained($b$insert into private.projection_rebuild_run (projection, from_version, to_version, mode, status) values ('ops_inbox', 1, 2, 'shadow', 'failed')$b$) then
    raise exception 'FAILED: a rebuild ended with no end time';
  end if;
  if not pg_temp.constrained($b$insert into private.projection_rebuild_run (projection, from_version, to_version, mode) values ('ops_inbox', 1, 2, 'live')$b$) then
    raise exception 'FAILED: an unknown rebuild mode was stored';
  end if;
  insert into private.projection_rebuild_run (projection, from_version, to_version, mode, status, finished_at, parity_ok, events_replayed)
    values ('ops_inbox', 1, 2, 'shadow', 'succeeded', now(), true, 120);
  raise notice 'ok  a rebuild succeeds only with an end time and a parity verdict';

  -- ── Invalidation: a malformed correlation id is refused, a school's goes with it ─
  insert into private.projection_invalidation (namespace, tenant_id, version, reason, correlation_id)
    values ('ops.tenant', 'proj-a', 1, 'plan changed', 'req-0123456789abcdef');
  if not pg_temp.constrained($i$insert into private.projection_invalidation (namespace, version, reason, correlation_id) values ('ops.tenant', 1, 'x', 'short')$i$) then
    raise exception 'FAILED: a malformed correlation id was stored';
  end if;
  if not pg_temp.constrained($i$insert into private.projection_invalidation (namespace, tenant_id, version, reason, correlation_id) values ('ops.tenant', 'no-such-school', 1, 'x', 'req-0123456789abcdef')$i$) then
    raise exception 'FAILED: an invalidation for a school that does not exist was stored';
  end if;
  -- A school is never deleted (a trigger refuses it; schools are offboarded), so
  -- the cascade cannot be exercised here. What can be asserted is that the key
  -- exists and is the same one the outbox uses, so offboarding's purge reaches
  -- both tables the same way.
  select count(*) into n from pg_constraint c
   where c.conrelid = 'private.projection_invalidation'::regclass and c.contype = 'f'
     and c.confrelid = 'public.schools'::regclass and c.confdeltype = 'c';
  if n <> 1 then raise exception 'FAILED: projection_invalidation.tenant_id is not a cascading key to schools (% found)', n; end if;
  select count(*) into n from pg_constraint c
   where c.conrelid = 'private.domain_outbox_events'::regclass and c.contype = 'f'
     and c.confrelid = 'public.schools'::regclass and c.confdeltype = 'c';
  if n <> 1 then raise exception 'FAILED: control — the outbox no longer has the cascading school key this one is compared with (% found)', n; end if;
  raise notice 'ok  an invalidation is tied to its school the same way an outbox event is';

  -- The control for `constrained`: a statement that should pass does.
  if pg_temp.constrained($c$insert into private.projection_watermark (projection, version) values ('control_probe', 1)$c$) then
    raise exception 'FAILED: control — the constraint probe refused a valid row';
  end if;
  raise notice 'ok  control: the constraint probe passes a valid row';
end $$;

rollback;
