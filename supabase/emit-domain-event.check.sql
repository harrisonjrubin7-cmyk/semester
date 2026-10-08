-- The outbox's one SQL writer (backlog P1-02): what it refuses, what it makes
-- idempotent, who may call it, and that an event leaves with the transaction
-- that wrote it.
--
-- Every refusal has a control that a well-formed call passes, because a probe
-- that refuses everything looks the same as one that works.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run it: supabase/check.sh emit-domain-event

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

/** The SQLSTATE a statement raises as the owner, or null if it ran. */
create or replace function pg_temp.state_of(statement text)
returns text language plpgsql as $$
begin
  execute statement;
  return null;
exception when others then
  return sqlstate;
end $$;

/** A call to the helper with one argument replaced; the rest are well-formed. */
create or replace function pg_temp.emit_sql(
  payload text default $p${"id":"ar-1"}$p$,
  idem text default 'ar-1:v1',
  etype text default 'approval.requested',
  agg_id text default 'ar-1',
  tenant text default 'emit-a'
) returns text language sql as $$
  select format(
    $f$select private.emit_domain_event('approval_request', %L, %L, 1, %L, 'console', 'req-0123456789abcdef', %L, %L::jsonb, 'internal', 'operational')$f$,
    agg_id, etype, tenant, idem, payload)
$$;

insert into public.schools (id, name, email_domains) values
  ('emit-a', 'Emit A', array['a.example']);

do $$
declare
  student uuid;
  first_id uuid;
  again_id uuid;
  n integer;
  stored record;
  wanted_hash text;
  key text;
begin
  student := pg_temp.newuser('student@a.example', 'emit-a');

  -- ── The control: a well-formed call stores one event, with its hash ─────
  execute pg_temp.emit_sql() into first_id;
  if first_id is null then raise exception 'FAILED: control — a well-formed call returned no id'; end if;
  select * into stored from private.domain_outbox_events where id = first_id;
  if stored.aggregate_type <> 'approval_request' or stored.event_type <> 'approval.requested'
     or stored.environment <> 'production' or stored.tenant_id <> 'emit-a'
     or stored.published_at is not null or stored.dead_lettered_at is not null then
    raise exception 'FAILED: control — the stored event is not what was asked for (%)', stored;
  end if;
  wanted_hash := 'sha256:' || encode(sha256(convert_to('{"id": "ar-1"}', 'UTF8')), 'hex');
  if stored.payload_hash is distinct from wanted_hash then
    raise exception 'FAILED: the payload hash is % and not the sha256 of the payload text %', stored.payload_hash, wanted_hash;
  end if;
  raise notice 'ok  a well-formed call stores one pending event with the sha256 of its payload';

  -- ── The same event twice is one event, and the first one wins ───────────
  execute pg_temp.emit_sql(payload => '{"id":"ar-1","changed":["status"]}') into again_id;
  select count(*) into n from private.domain_outbox_events where aggregate_type = 'approval_request' and aggregate_id = 'ar-1';
  if again_id is distinct from first_id or n <> 1 then
    raise exception 'FAILED: a second call with the same idempotency key wrote % row(s) and returned % (first was %)', n, again_id, first_id;
  end if;
  if (select payload from private.domain_outbox_events where id = first_id) <> '{"id":"ar-1"}'::jsonb then
    raise exception 'FAILED: a second call overwrote the first event''s payload';
  end if;
  execute pg_temp.emit_sql(idem => 'ar-1:v2') into again_id;
  if again_id = first_id then raise exception 'FAILED: control — a new idempotency key returned the old event'; end if;
  raise notice 'ok  one idempotency key is one event: the second call returns the first and writes nothing';

  -- ── A retry with no key would write twice, so no key is refused ────────
  if pg_temp.state_of(replace(pg_temp.emit_sql(), '''ar-1:v1''', 'null')) is distinct from '22023' then
    raise exception 'FAILED: a call with no idempotency key was accepted';
  end if;
  raise notice 'ok  an event with no idempotency key is refused';

  -- ── Keys that must not travel: top level, nested, in an array, any case ─
  foreach key in array array['email', 'name', 'body', 'token', 'secret', 'raw'] loop
    if pg_temp.state_of(pg_temp.emit_sql(payload => format('{"%s":"x"}', key), idem => 'd-top-' || key)) is distinct from '22023' then
      raise exception 'FAILED: a top-level "%" key was accepted', key;
    end if;
    if pg_temp.state_of(pg_temp.emit_sql(payload => format('{"a":{"b":{"%s":"x"}}}', key), idem => 'd-deep-' || key)) is distinct from '22023' then
      raise exception 'FAILED: a nested "%" key was accepted', key;
    end if;
    if pg_temp.state_of(pg_temp.emit_sql(payload => format('{"list":[{"ok":1},{"%s":"x"}]}', key), idem => 'd-arr-' || key)) is distinct from '22023' then
      raise exception 'FAILED: a "%" key inside an array was accepted', key;
    end if;
  end loop;
  if pg_temp.state_of(pg_temp.emit_sql(payload => '{"Email":"x"}', idem => 'd-case')) is distinct from '22023' then
    raise exception 'FAILED: an "Email" key was accepted, so the list is case-sensitive';
  end if;
  select count(*) into n from private.domain_outbox_events where idempotency_key like 'd-%';
  if n <> 0 then raise exception 'FAILED: % refused event(s) were stored anyway', n; end if;
  raise notice 'ok  six denied keys refused at the top, nested, in an array, and in any case; none stored';

  -- ── The list is of whole keys, not of substrings ───────────────────────
  foreach key in array array['renamed', 'nameChanged', 'emailVerified', 'fields', 'tokenCount'] loop
    execute pg_temp.emit_sql(payload => format('{"%s":1}', key), idem => 'ok-' || key) into again_id;
  end loop;
  raise notice 'ok  a key that merely contains a denied word passes (control for the list)';

  -- ── The table's own constraints still apply through the helper ─────────
  if pg_temp.state_of(pg_temp.emit_sql(etype => 'ApprovalRequested', idem => 'c-1')) is distinct from '23514' then
    raise exception 'FAILED: an event type that is not domain.name was accepted';
  end if;
  if pg_temp.state_of(pg_temp.emit_sql(tenant => 'no-such-school', idem => 'c-2')) is distinct from '23503' then
    raise exception 'FAILED: an event for a school that does not exist was accepted';
  end if;
  if pg_temp.state_of(replace(pg_temp.emit_sql(idem => 'c-3'), '''operational''', '''forever''')) is distinct from '23514' then
    raise exception 'FAILED: an unknown retention class was accepted';
  end if;
  if pg_temp.state_of(replace(pg_temp.emit_sql(idem => 'c-4'), '''req-0123456789abcdef''', '''short''')) is distinct from '23514' then
    raise exception 'FAILED: a malformed correlation id was accepted';
  end if;
  raise notice 'ok  type, school, retention and correlation constraints are not bypassed';

  -- ── A payload that is not an object is refused, not hashed ─────────────
  if pg_temp.state_of(pg_temp.emit_sql(payload => '[1,2]', idem => 'c-5')) is distinct from '23514' then
    raise exception 'FAILED: a payload that is not an object was accepted';
  end if;

  -- ── Nobody signed in can call it, or its key check ─────────────────────
  if has_function_privilege('anon', 'private.emit_domain_event(text,text,text,integer,text,text,text,text,jsonb,text,text,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'private.emit_domain_event(text,text,text,integer,text,text,text,text,jsonb,text,text,uuid,text)', 'execute')
     or has_function_privilege('anon', 'private.payload_denied_key(jsonb,integer)', 'execute')
     or has_function_privilege('authenticated', 'private.payload_denied_key(jsonb,integer)', 'execute') then
    raise exception 'FAILED: a client role can execute the emit helper or its key check';
  end if;
  if not has_function_privilege('service_role', 'private.emit_domain_event(text,text,text,integer,text,text,text,text,jsonb,text,text,uuid,text)', 'execute') then
    raise exception 'FAILED: control — the service role cannot execute the emit helper';
  end if;
  if not pg_temp.refused(student, pg_temp.emit_sql(idem => 'client-1')) then
    raise exception 'FAILED: a signed-in account emitted an event directly';
  end if;
  raise notice 'ok  a signed-in account cannot call the helper or its key check; the service role can';

  -- ── It is not a definer: a client gets nothing through it ──────────────
  if (select p.prosecdef from pg_proc p where p.oid = 'private.emit_domain_event(text,text,text,integer,text,text,text,text,jsonb,text,text,uuid,text)'::regprocedure)
     or (select p.prosecdef from pg_proc p where p.oid = 'private.payload_denied_key(jsonb,integer)'::regprocedure) then
    raise exception 'FAILED: the emit helper or its key check is a security definer';
  end if;
  raise notice 'ok  neither function is a security definer';

  -- ── A definer RPC can still use it, which is how a producer will ───────
  -- The owner of this function can write the outbox; a client calling it
  -- cannot. That is the whole arrangement, so it is exercised rather than
  -- assumed.
  create function public.emit_probe_rpc() returns uuid
    language plpgsql security definer set search_path = '' as $f$
  begin
    return private.emit_domain_event('approval_request', 'ar-9', 'approval.requested', 1, 'emit-a',
      'console', 'req-0123456789abcdef', 'ar-9:v1', '{"id":"ar-9"}', 'internal', 'operational');
  end $f$;
  grant execute on function public.emit_probe_rpc() to authenticated;
  perform pg_temp.become(student);
  again_id := public.emit_probe_rpc();
  execute 'reset role';
  if not exists (select 1 from private.domain_outbox_events where id = again_id and aggregate_id = 'ar-9') then
    raise exception 'FAILED: an event emitted through a definer RPC was not stored';
  end if;
  raise notice 'ok  a definer RPC called by a signed-in account emits through the helper';

  -- ── An event leaves with the transaction that wrote it ─────────────────
  begin
    perform private.emit_domain_event('approval_request', 'ar-rb', 'approval.requested', 1, 'emit-a',
      'console', 'req-0123456789abcdef', 'ar-rb:v1', '{"id":"ar-rb"}', 'internal', 'operational');
    raise exception using errcode = 'P0001', message = 'the command failed after emitting';
  exception when sqlstate 'P0001' then
    null;
  end;
  if exists (select 1 from private.domain_outbox_events where aggregate_id = 'ar-rb') then
    raise exception 'FAILED: an event survived the rollback of the command that emitted it';
  end if;
  perform private.emit_domain_event('approval_request', 'ar-ok', 'approval.requested', 1, 'emit-a',
    'console', 'req-0123456789abcdef', 'ar-ok:v1', '{"id":"ar-ok"}', 'internal', 'operational');
  if not exists (select 1 from private.domain_outbox_events where aggregate_id = 'ar-ok') then
    raise exception 'FAILED: control — an event emitted in a transaction that did not roll back was lost';
  end if;
  raise notice 'ok  an event rolls back with the command that emitted it';
end $$;

rollback;
