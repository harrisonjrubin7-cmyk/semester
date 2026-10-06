-- The access saga's durable store (20261006170000_access_saga_store).
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
--
-- What must hold:
--   * all three tables are service-only, and the five functions run for
--     service_role alone;
--   * `claim` is exclusive until the lease expires, then another owner may take it;
--   * `save` is one transaction: with a stale lease token, an expired lease or a
--     moved revision it raises SC409 and writes neither the saga nor its event, and
--     an event that cannot be written takes the saga's update with it;
--   * a saga row moves only along ACCESS_SAGA's edges, one revision at a time, with
--     its identity fixed, a generation that changes only when a new evaluation
--     starts, no way out of a finished state, and REVOKED only once both sides of
--     the cleanup are confirmed;
--   * `wake` applies a signal once: a repeated event id changes nothing, a signal
--     that does not apply is recorded and changes nothing, and a resumed validation
--     is a new generation;
--   * events are append-only and nothing is deleted;
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

-- A saga at `st`, for tests that need one in a given state.
create or replace function pg_temp.saga(sid text, st text default 'RECEIVED', paid boolean default false, pepd boolean default false)
returns void language sql as $$
  insert into public.access_sagas (id, tenant_id, subject_id, intent_resource_id, intent_action, request_digest, definition_version,
                                   state, deadline_at, next_attempt_at, pa_revoked, pep_removed)
  values (sid, 't1', 'u1', 'r1', 'registration.readiness.view', repeat('a', 64), '1', st, 9999999999999, 0, paid, pepd);
$$;

do $$
declare
  t text;
  p text;
  f text;
  n bigint;
  tok text;
  tok2 text;
  nx jsonb;
  ev jsonb;
  r record;
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
  foreach t in array array['access_sagas', 'access_saga_events', 'access_saga_signals'] loop
    perform pg_temp.counted(t || ' has row level security on',
      (select relrowsecurity::int from pg_class where oid = ('public.' || t)::regclass), 1);
    perform pg_temp.counted(t || ' has no policy',
      (select count(*) from pg_policies where schemaname = 'public' and tablename = t), 0);
    foreach p in array array['select', 'insert', 'update', 'delete', 'references', 'trigger', 'truncate'] loop
      perform pg_temp.counted(t || ': anon holds no ' || p,
        (select has_table_privilege('anon', 'public.' || t, p)::int), 0);
      perform pg_temp.counted(t || ': authenticated holds no ' || p,
        (select has_table_privilege('authenticated', 'public.' || t, p)::int), 0);
    end loop;
  end loop;

  foreach f in array array['access_saga_claim(text,integer)', 'access_saga_save(text,text,integer,jsonb,jsonb)',
                           'access_saga_flag_recovery(text,text,text)', 'access_saga_release(text,text)', 'access_saga_wake(text,text,text)'] loop
    perform pg_temp.counted(f || ': anon cannot run it', (select has_function_privilege('anon', 'public.' || f, 'execute')::int), 0);
    perform pg_temp.counted(f || ': authenticated cannot run it', (select has_function_privilege('authenticated', 'public.' || f, 'execute')::int), 0);
    perform pg_temp.counted(f || ': service_role can run it', (select has_function_privilege('service_role', 'public.' || f, 'execute')::int), 1);
  end loop;

  -- ── Shape ─────────────────────────────────────────────────────────────
  perform pg_temp.refuses('a state outside the fifteen', $s$insert into public.access_sagas
    (id, tenant_id, subject_id, intent_resource_id, intent_action, request_digest, definition_version, state, deadline_at, next_attempt_at)
    values ('bad1', 't', 'u', 'r', 'registration.readiness.view', repeat('a', 64), '1', 'DONE', 1, 1)$s$, 'check');
  perform pg_temp.refuses('an action nobody decides', $s$insert into public.access_sagas
    (id, tenant_id, subject_id, intent_resource_id, intent_action, request_digest, definition_version, deadline_at, next_attempt_at)
    values ('bad2', 't', 'u', 'r', 'registration.root', repeat('a', 64), '1', 1, 1)$s$, 'check');
  perform pg_temp.refuses('a digest that is not sha-256 hex', $s$insert into public.access_sagas
    (id, tenant_id, subject_id, intent_resource_id, intent_action, request_digest, definition_version, deadline_at, next_attempt_at)
    values ('bad3', 't', 'u', 'r', 'registration.readiness.view', 'nope', '1', 1, 1)$s$, 'check');
  perform pg_temp.refuses('an error message with a sentence of free text', $s$insert into public.access_sagas
    (id, tenant_id, subject_id, intent_resource_id, intent_action, request_digest, definition_version, deadline_at, next_attempt_at, last_error)
    values ('bad4', 't', 'u', 'r', 'registration.readiness.view', repeat('a', 64), '1', 1, 1, repeat('x', 300))$s$, 'check');

  -- ── claim ─────────────────────────────────────────────────────────────
  perform pg_temp.saga('s1');
  select lease_token into tok from public.access_saga_claim('s1', 60000);
  perform pg_temp.counted('claim returns a token', (tok is not null)::int, 1);
  select count(*) into n from public.access_saga_claim('s1', 60000);
  perform pg_temp.counted('a held lease cannot be claimed again', n, 0);
  select count(*) into n from public.access_saga_claim('nope', 60000);
  perform pg_temp.counted('claiming a saga that does not exist returns nothing', n, 0);
  perform pg_temp.refuses('a lease of an hour', $s$select * from public.access_saga_claim('s1', 3600000)$s$, 'lease');
  update public.access_sagas set lease_expires_at = clock_timestamp() - interval '1 second' where id = 's1';
  select lease_token into tok2 from public.access_saga_claim('s1', 60000);
  perform pg_temp.counted('an expired lease can be taken by another owner', (tok2 is not null and tok2 <> tok)::int, 1);

  -- ── save: the stale owner, and the lease it no longer holds ──────────
  nx := jsonb_build_object('state', 'VALIDATING', 'generation', 0, 'attempts', 0, 'deadlineAt', 9999999999999, 'nextAttemptAt', 0,
                           'staleGrantPossible', false, 'compensation', jsonb_build_object('paRevoked', false, 'pepRemoved', false));
  ev := jsonb_build_object('eventId', 'e-s1-1', 'type', 'access.state.changed', 'occurredAt', '2026-10-06T12:00:00Z');
  perform pg_temp.refuses('save with the old owner''s token', format($s$select public.access_saga_save('s1', %L, 0, %L::jsonb, %L::jsonb)$s$, tok, nx, ev), 'SC409');
  perform pg_temp.refuses('save with a made-up token', format($s$select public.access_saga_save('s1', 'forged', 0, %L::jsonb, %L::jsonb)$s$, nx, ev), 'SC409');
  perform pg_temp.refuses('save at a revision that is not current', format($s$select public.access_saga_save('s1', %L, 3, %L::jsonb, %L::jsonb)$s$, tok2, nx, ev), 'SC409');
  select count(*) into n from public.access_saga_events where saga_id = 's1';
  perform pg_temp.counted('the refused saves wrote no event', n, 0);
  perform pg_temp.counted('and did not move the saga', (select revision from public.access_sagas where id = 's1')::bigint, 0);

  perform pg_temp.allows('save by the owner at the current revision', format($s$select public.access_saga_save('s1', %L, 0, %L::jsonb, %L::jsonb)$s$, tok2, nx, ev));
  select * into r from public.access_sagas where id = 's1';
  perform pg_temp.counted('the saga moved one revision', r.revision::bigint, 1);
  perform pg_temp.counted('into the next state', (r.state = 'VALIDATING')::int, 1);
  select count(*) into n from public.access_saga_events where saga_id = 's1' and revision = 1;
  perform pg_temp.counted('and its event was appended in the same step', n, 1);

  -- The expiry is checked at save, not only at claim.
  update public.access_sagas set lease_expires_at = clock_timestamp() - interval '1 second' where id = 's1';
  perform pg_temp.refuses('save after the lease ran out', format($s$select public.access_saga_save('s1', %L, 1, %L::jsonb, %L::jsonb)$s$, tok2, nx, ev), 'SC409');

  -- Atomicity: an event that cannot be written takes the saga's update with it.
  perform pg_temp.saga('s2');
  select lease_token into tok from public.access_saga_claim('s2', 60000);
  ev := jsonb_build_object('eventId', 'e-s1-1', 'type', 'access.state.changed', 'occurredAt', '2026-10-06T12:00:00Z');
  perform pg_temp.refuses('save whose event id is already taken', format($s$select public.access_saga_save('s2', %L, 0, %L::jsonb, %L::jsonb)$s$, tok, nx, ev), 'duplicate');
  perform pg_temp.counted('the saga did not move when its event failed', (select revision from public.access_sagas where id = 's2')::bigint, 0);
  perform pg_temp.counted('and is still in its old state', (select (state = 'RECEIVED')::int from public.access_sagas where id = 's2')::bigint, 1);

  -- ── release and flagRecovery ──────────────────────────────────────────
  perform pg_temp.refuses('flagging recovery without the lease', $s$select public.access_saga_flag_recovery('s2', 'forged', 'stuck')$s$, 'SC409');
  perform pg_temp.allows('flagging recovery with it', format($s$select public.access_saga_flag_recovery('s2', %L, 'cleanup_stuck')$s$, tok));
  perform pg_temp.counted('flagging recovery did not complete anything', (select (pa_revoked or pep_removed)::int from public.access_sagas where id = 's2')::bigint, 0);
  perform pg_temp.allows('release with a wrong token is a no-op', $s$select public.access_saga_release('s2', 'forged')$s$);
  perform pg_temp.counted('the lease is still held after it', (select (lease_token is not null)::int from public.access_sagas where id = 's2')::bigint, 1);
  perform pg_temp.allows('release with the token', format($s$select public.access_saga_release('s2', %L)$s$, tok));
  perform pg_temp.counted('the lease is gone', (select (lease_token is null and lease_expires_at is null)::int from public.access_sagas where id = 's2')::bigint, 1);

  -- ── What a saga row may become ───────────────────────────────────────
  perform pg_temp.refuses('RECEIVED straight to ACTIVE', $s$update public.access_sagas set state = 'ACTIVE', revision = revision + 1 where id = 's2'$s$, 'cannot move');
  perform pg_temp.refuses('two revisions at once', $s$update public.access_sagas set state = 'VALIDATING', revision = revision + 2 where id = 's2'$s$, 'one revision');
  perform pg_temp.refuses('a state change without a revision', $s$update public.access_sagas set state = 'VALIDATING' where id = 's2'$s$, 'saved revision');
  perform pg_temp.refuses('a tenant rewritten', $s$update public.access_sagas set tenant_id = 'other' where id = 's2'$s$, 'identity');
  perform pg_temp.refuses('a request digest rewritten', $s$update public.access_sagas set request_digest = repeat('b', 64), revision = revision + 1 where id = 's2'$s$, 'identity');
  perform pg_temp.refuses('a generation moved by a plain step', $s$update public.access_sagas set state = 'VALIDATING', revision = revision + 1, generation = 1 where id = 's2'$s$, 'generation');

  perform pg_temp.saga('s3', 'REVOKING');
  perform pg_temp.refuses('REVOKED with nothing confirmed', $s$update public.access_sagas set state = 'REVOKED', revision = revision + 1 where id = 's3'$s$, 'cleanup');
  perform pg_temp.refuses('REVOKED with only the PA side confirmed', $s$update public.access_sagas set state = 'REVOKED', revision = revision + 1, pa_revoked = true where id = 's3'$s$, 'cleanup');
  perform pg_temp.allows('REVOKED with both sides confirmed', $s$update public.access_sagas set state = 'REVOKED', revision = revision + 1, pa_revoked = true, pep_removed = true where id = 's3'$s$);
  perform pg_temp.refuses('a finished saga moving again', $s$update public.access_sagas set state = 'REVOKING', revision = revision + 1 where id = 's3'$s$, 'final');

  perform pg_temp.saga('s4', 'RECONCILING');
  perform pg_temp.refuses('a new evaluation on the same generation', $s$update public.access_sagas set state = 'EVALUATING', revision = revision + 1 where id = 's4'$s$, 'generation');
  perform pg_temp.allows('a new evaluation on the next generation', $s$update public.access_sagas set state = 'EVALUATING', revision = revision + 1, generation = generation + 1 where id = 's4'$s$);

  perform pg_temp.refuses('deleting a saga', $s$delete from public.access_sagas where id = 's4'$s$, 'retention');

  -- ── wake ──────────────────────────────────────────────────────────────
  perform pg_temp.saga('w1', 'WAITING_STEP_UP');
  perform pg_temp.allows('a requirements change wakes a waiting saga', $s$select public.access_saga_wake('w1', 'sig-1', 'requirements_changed')$s$);
  select * into r from public.access_sagas where id = 'w1';
  perform pg_temp.counted('into validation', (r.state = 'VALIDATING')::int, 1);
  perform pg_temp.counted('as a new generation', r.generation::bigint, 1);
  perform pg_temp.counted('and a new revision', r.revision::bigint, 1);
  perform pg_temp.allows('the same signal again', $s$select public.access_saga_wake('w1', 'sig-1', 'requirements_changed')$s$);
  perform pg_temp.counted('changes nothing', (select revision from public.access_sagas where id = 'w1')::bigint, 1);
  perform pg_temp.counted('and wrote no second event', (select count(*) from public.access_saga_events where saga_id = 'w1'), 1);
  -- A replay is the dangerous case when the saga has since gone back to waiting: the old signal must not wake it again.
  update public.access_sagas set state = 'EVALUATING', revision = revision + 1 where id = 'w1';
  update public.access_sagas set state = 'WAITING_STEP_UP', revision = revision + 1 where id = 'w1';
  perform pg_temp.allows('the same signal replayed after it is waiting again', $s$select public.access_saga_wake('w1', 'sig-1', 'requirements_changed')$s$);
  perform pg_temp.counted('does not wake it a second time', (select (state = 'WAITING_STEP_UP')::int from public.access_sagas where id = 'w1')::bigint, 1);
  perform pg_temp.allows('a fresh signal does', $s$select public.access_saga_wake('w1', 'sig-1b', 'requirements_changed')$s$);
  perform pg_temp.counted('wake it', (select (state = 'VALIDATING')::int from public.access_sagas where id = 'w1')::bigint, 1);
  perform pg_temp.allows('a requirements change when nothing is waiting', $s$select public.access_saga_wake('w1', 'sig-2', 'requirements_changed')$s$);
  perform pg_temp.counted('changes nothing either', (select (state = 'VALIDATING')::int from public.access_sagas where id = 'w1')::bigint, 1);
  perform pg_temp.counted('but is recorded as seen', (select count(*) from public.access_saga_signals where saga_id = 'w1'), 3);

  perform pg_temp.saga('w2', 'ACTIVE');
  perform pg_temp.allows('a revoke signal on an active saga', $s$select public.access_saga_wake('w2', 'sig-r', 'revoke')$s$);
  perform pg_temp.counted('starts the revocation', (select (state = 'REVOKING')::int from public.access_sagas where id = 'w2')::bigint, 1);
  perform pg_temp.counted('without a new generation', (select generation from public.access_sagas where id = 'w2')::bigint, 0);
  perform pg_temp.saga('w3', 'RECEIVED');
  perform pg_temp.allows('a revoke signal before anything exists', $s$select public.access_saga_wake('w3', 'sig-r', 'revoke')$s$);
  perform pg_temp.counted('has nothing to revoke', (select (state = 'RECEIVED')::int from public.access_sagas where id = 'w3')::bigint, 1);
  perform pg_temp.saga('w4', 'RECOVERY_REQUIRED');
  perform pg_temp.allows('a recover signal on a stuck revocation', $s$select public.access_saga_wake('w4', 'sig-c', 'recover')$s$);
  perform pg_temp.counted('retries the revocation', (select (state = 'REVOKING')::int from public.access_sagas where id = 'w4')::bigint, 1);
  perform pg_temp.refuses('a signal for a kind nobody sends', $s$select public.access_saga_wake('w4', 'sig-x', 'approve')$s$, 'check');
  perform pg_temp.refuses('a signal for a saga that does not exist', $s$select public.access_saga_wake('ghost', 'sig-x', 'revoke')$s$, 'SC404');

  -- A runner holding a lease on the old revision stands down.
  perform pg_temp.saga('w5', 'WAITING_APPROVAL');
  select lease_token into tok from public.access_saga_claim('w5', 60000);
  perform pg_temp.allows('a wake while a runner holds the lease', $s$select public.access_saga_wake('w5', 'sig-w', 'requirements_changed')$s$);
  perform pg_temp.refuses('the runner''s save at the revision it read',
    format($s$select public.access_saga_save('w5', %L, 0, %L::jsonb, %L::jsonb)$s$, tok, nx, jsonb_build_object('eventId', 'e-w5', 'type', 'access.state.changed', 'occurredAt', '2026-10-06T12:00:00Z')), 'SC409');

  -- ── Events are append-only ────────────────────────────────────────────
  perform pg_temp.refuses('rewriting an event', $s$update public.access_saga_events set reason_code = 'other' where event_id = 'e-s1-1'$s$, 'append-only');
  perform pg_temp.allows('recording that an event was published', $s$update public.access_saga_events set published_at = now() where event_id = 'e-s1-1'$s$);
  perform pg_temp.refuses('un-publishing it', $s$update public.access_saga_events set published_at = null where event_id = 'e-s1-1'$s$, 'append-only');
  perform pg_temp.refuses('deleting an event', $s$delete from public.access_saga_events where event_id = 'e-s1-1'$s$, 'append-only');
  perform pg_temp.refuses('two events for one revision', $s$insert into public.access_saga_events (event_id, saga_id, tenant_id, revision, type, occurred_at)
    values ('dup', 's1', 't1', 1, 'access.state.changed', now())$s$, 'duplicate');

  raise notice 'access-saga-store: every check passed';
end $$;

rollback;
