-- The read side of the productivity storage adapter, and a held prediction.
--
-- `20261004123000_productivity_commands.sql` is the write half: one atomic commit.
-- A repository that talks to Postgres through PostgREST also has to *read* — the
-- command ledger and the sequence counter live in `private`, which PostgREST does
-- not expose, and the rest is cleaner to read as finished JSON than as rows a
-- client maps back into entities and gets subtly wrong. So every read the adapter
-- makes is a function here that returns the entity in exactly the shape the service
-- holds it (camelCase, instants as UTC milliseconds), and the adapter does no
-- mapping at all. `schema.test.ts` holds the keys equal to the TypeScript entity,
-- and the Postgres integration suite holds the whole round trip equal to the
-- in-memory repository's.
--
-- ## Why the commit is redefined
--
-- The service is handed a sequence number when it saves an entity — before the
-- commit that allocates it. In memory that is trivial. Over a request/response RPC
-- the adapter can only *predict* it (the owner's counter as it read it, plus one for
-- each entity saved), so the commit must refuse a prediction that no longer holds.
-- That is one added check, under the lock the function already takes; the signature
-- is unchanged so this replaces the earlier definition rather than overloading it.
-- A caller that sends no `seq` (the earlier SQL checks) behaves exactly as before.
--
-- Every function here is `security definer`, `set search_path = ''`, takes tenant
-- *and* owner, and is callable by `service_role` alone.

create or replace function private.productivity_iso(t timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when t is null then null
              else to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
$$;

revoke all on function private.productivity_iso(timestamptz) from public, anon, authenticated;
grant execute on function private.productivity_iso(timestamptz) to service_role;


create or replace function private.productivity_task_json(t public.productivity_task)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id, 'tenantId', t.tenant_id, 'ownerId', t.owner_id,
    'version', t.version, 'seq', t.seq,
    'source', jsonb_strip_nulls(jsonb_build_object('kind', t.source_kind, 'ref', t.source_ref)),
    'clocks', t.field_clocks,
    'createdAt', private.productivity_iso(t.created_at), 'updatedAt', private.productivity_iso(t.updated_at),
    'deletedAt', private.productivity_iso(t.deleted_at), 'deleteClock', t.delete_clock,
    'title', t.title, 'notes', t.notes, 'status', t.status,
    'completedAt', private.productivity_iso(t.completed_at), 'dueAt', private.productivity_iso(t.due_at),
    'priority', t.priority, 'courseId', t.course_id)
$$;

create or replace function private.productivity_event_json(e public.productivity_event)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'tenantId', e.tenant_id, 'ownerId', e.owner_id,
    'version', e.version, 'seq', e.seq,
    'source', jsonb_strip_nulls(jsonb_build_object('kind', e.source_kind, 'ref', e.source_ref)),
    'clocks', e.field_clocks,
    'createdAt', private.productivity_iso(e.created_at), 'updatedAt', private.productivity_iso(e.updated_at),
    'deletedAt', private.productivity_iso(e.deleted_at), 'deleteClock', e.delete_clock,
    'title', e.title, 'notes', e.notes,
    'startsAt', private.productivity_iso(e.starts_at), 'endsAt', private.productivity_iso(e.ends_at),
    'allDay', e.all_day, 'timezone', e.timezone, 'location', e.location, 'kind', e.kind)
$$;

revoke all on function private.productivity_task_json(public.productivity_task) from public, anon, authenticated;
revoke all on function private.productivity_event_json(public.productivity_event) from public, anon, authenticated;
grant execute on function private.productivity_task_json(public.productivity_task) to service_role;
grant execute on function private.productivity_event_json(public.productivity_event) to service_role;

-- ── Reads ──────────────────────────────────────────────────────────────────

-- The owner's sequence counter and, if asked about one, a command's ledger row, in
-- one round trip: what a transaction needs before it can decide anything.
create or replace function public.productivity_tx_state(p_tenant text, p_owner uuid, p_command uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lastSeq', coalesce((select last_seq from private.productivity_owner_seq
                          where tenant_id = p_tenant and owner_id = p_owner), 0),
    'command', (select jsonb_build_object('requestSha256', c.request_sha256, 'result', c.result,
                                          'storedAt', private.productivity_iso(c.stored_at))
                  from private.productivity_command c
                 where c.tenant_id = p_tenant and c.owner_id = p_owner and c.command_id = p_command))
$$;

-- One entity, tombstone or not as asked; null when there is none.
create or replace function public.productivity_get(p_tenant text, p_owner uuid, p_type text, p_id uuid, p_include_deleted boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_type = 'task' then
    return (select private.productivity_task_json(t) from public.productivity_task t
             where t.tenant_id = p_tenant and t.owner_id = p_owner and t.id = p_id
               and (p_include_deleted or t.deleted_at is null));
  elsif p_type = 'calendar_event' then
    return (select private.productivity_event_json(e) from public.productivity_event e
             where e.tenant_id = p_tenant and e.owner_id = p_owner and e.id = p_id
               and (e.deleted_at is null or p_include_deleted));
  end if;
  raise exception 'unknown entity type' using errcode = '22023';
end $$;

-- Live tasks in due-date order, undated last. The cursor is the last row's sort key
-- (its due date, or the far-future stand-in the service uses for undated) and id.
create or replace function public.productivity_list_tasks(
  p_tenant text, p_owner uuid, p_status text default null,
  p_due_before timestamptz default null, p_due_after timestamptz default null,
  p_after_key text default null, p_after_id uuid default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  after_key timestamptz;
begin
  if p_after_key is not null then
    after_key := case when p_after_key >= '9999' then 'infinity'::timestamptz else p_after_key::timestamptz end;
  end if;
  return coalesce((
    select jsonb_agg(private.productivity_task_json(r.x) order by coalesce((r.x).due_at, 'infinity'), (r.x).id)
      from (
        select x from public.productivity_task x
         where x.tenant_id = p_tenant and x.owner_id = p_owner and x.deleted_at is null
           and (p_status is null or x.status = p_status)
           and (p_due_before is null or (x.due_at is not null and x.due_at < p_due_before))
           and (p_due_after is null or (x.due_at is not null and x.due_at > p_due_after))
           and (p_after_id is null or (coalesce(x.due_at, 'infinity'), x.id) > (after_key, p_after_id))
         order by coalesce(x.due_at, 'infinity'), x.id
         limit greatest(1, least(coalesce(p_limit, 50), 201))
      ) r), '[]'::jsonb);
end $$;

-- Live events overlapping [from, to), by start.
create or replace function public.productivity_list_events(
  p_tenant text, p_owner uuid, p_from timestamptz, p_to timestamptz,
  p_after_key text default null, p_after_id uuid default null, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  after_key timestamptz;
begin
  if p_after_key is not null then after_key := p_after_key::timestamptz; end if;
  return coalesce((
    select jsonb_agg(private.productivity_event_json(r.x) order by (r.x).starts_at, (r.x).id)
      from (
        select x from public.productivity_event x
         where x.tenant_id = p_tenant and x.owner_id = p_owner and x.deleted_at is null
           and x.starts_at < p_to and x.ends_at > p_from
           and (p_after_id is null or (x.starts_at, x.id) > (after_key, p_after_id))
         order by x.starts_at, x.id
         limit greatest(1, least(coalesce(p_limit, 50), 201))
      ) r), '[]'::jsonb);
end $$;

-- The sync feed: both kinds, tombstones included, in the owner's sequence order.
create or replace function public.productivity_changes(p_tenant text, p_owner uuid, p_after bigint default 0, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(j order by s), '[]'::jsonb)
    from (
      select s, j from (
        select t.seq as s, private.productivity_task_json(t) as j from public.productivity_task t
         where t.tenant_id = p_tenant and t.owner_id = p_owner and t.seq > coalesce(p_after, 0)
        union all
        select e.seq, private.productivity_event_json(e) from public.productivity_event e
         where e.tenant_id = p_tenant and e.owner_id = p_owner and e.seq > coalesce(p_after, 0)
      ) u
      order by s
      limit greatest(1, least(coalesce(p_limit, 50), 201))
    ) q
$$;

-- What the publisher still owes, for this producer only: the outbox is shared.
create or replace function public.productivity_outbox_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pending', count(*) filter (where published_at is null and dead_lettered_at is null),
    'oldestPendingAgeSeconds', coalesce(round(extract(epoch from (now() - min(occurred_at)
        filter (where published_at is null and dead_lettered_at is null))))::bigint, 0),
    'deadLettered', count(*) filter (where dead_lettered_at is not null))
  from private.domain_outbox_events
  where producer = 'productivity-api'
$$;

revoke all on function public.productivity_tx_state(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.productivity_get(text, uuid, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.productivity_list_tasks(text, uuid, text, timestamptz, timestamptz, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.productivity_list_events(text, uuid, timestamptz, timestamptz, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.productivity_changes(text, uuid, bigint, integer) from public, anon, authenticated;
revoke all on function public.productivity_outbox_stats() from public, anon, authenticated;
grant execute on function public.productivity_tx_state(text, uuid, uuid) to service_role;
grant execute on function public.productivity_get(text, uuid, text, uuid, boolean) to service_role;
grant execute on function public.productivity_list_tasks(text, uuid, text, timestamptz, timestamptz, text, uuid, integer) to service_role;
grant execute on function public.productivity_list_events(text, uuid, timestamptz, timestamptz, text, uuid, integer) to service_role;
grant execute on function public.productivity_changes(text, uuid, bigint, integer) to service_role;
grant execute on function public.productivity_outbox_stats() to service_role;

-- ── The commit, with its prediction held ───────────────────────────────────

create or replace function private.productivity_commit(
  p_tenant text,
  p_owner uuid,
  p_command jsonb,
  p_entities jsonb,
  p_audit jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e jsonb;
  r jsonb;
  a jsonb;
  ev jsonb;
  current_seq bigint;
  next_seq bigint;
  seqs bigint[] := '{}';
  kind text;
begin
  if jsonb_typeof(coalesce(p_entities, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_audit, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array' then
    raise exception 'entities, audit and events must be arrays' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(p_entities, '[]'::jsonb)) > 8 then
    raise exception 'too many entities in one commit' using errcode = '22023';
  end if;

  -- The serialization point for this owner. Everything after this line sees
  -- one writer at a time for this (tenant, owner), and the row's counter is
  -- rolled back with the transaction, which is what keeps `seq` gapless.
  -- An audit-only commit (a refused write, a read of somebody's shared list)
  -- writes no record and so takes no position in the history — and must not
  -- need the owner to exist, since a refused probe may name one that does not.
  if p_command is not null or jsonb_array_length(coalesce(p_entities, '[]'::jsonb)) > 0 then
    insert into private.productivity_owner_seq (tenant_id, owner_id) values (p_tenant, p_owner)
      on conflict (tenant_id, owner_id) do nothing;
    select last_seq into next_seq from private.productivity_owner_seq
      where tenant_id = p_tenant and owner_id = p_owner for update;
  end if;

  if p_command is not null then
    insert into private.productivity_command (tenant_id, owner_id, command_id, request_sha256, result)
    values (p_tenant, p_owner, (p_command->>'commandId')::uuid, p_command->>'requestSha256', p_command->'result');
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_entities, '[]'::jsonb)) loop
    kind := e->>'type';
    r := e->'row';
    if kind = 'task' then
      select seq into current_seq from public.productivity_task
        where tenant_id = p_tenant and owner_id = p_owner and id = (r->>'id')::uuid for update;
    elsif kind = 'calendar_event' then
      select seq into current_seq from public.productivity_event
        where tenant_id = p_tenant and owner_id = p_owner and id = (r->>'id')::uuid for update;
    else
      raise exception 'unknown entity type' using errcode = '22023';
    end if;
    if coalesce(current_seq, 0) <> (e->>'expectedSeq')::bigint then
      raise exception 'entity changed since it was read' using errcode = '40001';
    end if;
    next_seq := next_seq + 1;
    -- A caller that predicted this position (a database adapter does, because it has to
    -- hand a sequence number back before the commit) is held to it: if the counter has
    -- moved since it read it, the number it promised is not the one that is free.
    if e ? 'seq' and (e->>'seq')::bigint <> next_seq then
      raise exception 'sequence moved since it was predicted' using errcode = '40001';
    end if;
    seqs := seqs || next_seq;

    if kind = 'task' then
      insert into public.productivity_task (
        tenant_id, owner_id, id, title, notes, status, completed_at, due_at, priority, course_id,
        source_kind, source_ref, field_clocks, version, seq, created_at, updated_at, deleted_at, delete_clock
      ) values (
        p_tenant, p_owner, (r->>'id')::uuid, r->>'title', r->>'notes', r->>'status',
        (r->>'completedAt')::timestamptz, (r->>'dueAt')::timestamptz, r->>'priority', r->>'courseId',
        r->'source'->>'kind', r->'source'->>'ref', r->'clocks', (r->>'version')::integer, next_seq,
        (r->>'createdAt')::timestamptz, (r->>'updatedAt')::timestamptz, (r->>'deletedAt')::timestamptz, r->>'deleteClock'
      )
      on conflict (tenant_id, owner_id, id) do update set
        title = excluded.title, notes = excluded.notes, status = excluded.status, completed_at = excluded.completed_at,
        due_at = excluded.due_at, priority = excluded.priority, course_id = excluded.course_id,
        field_clocks = excluded.field_clocks, version = excluded.version, seq = excluded.seq,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, delete_clock = excluded.delete_clock;
    else
      insert into public.productivity_event (
        tenant_id, owner_id, id, title, notes, starts_at, ends_at, all_day, timezone, location, kind,
        source_kind, source_ref, field_clocks, version, seq, created_at, updated_at, deleted_at, delete_clock
      ) values (
        p_tenant, p_owner, (r->>'id')::uuid, r->>'title', r->>'notes', (r->>'startsAt')::timestamptz,
        (r->>'endsAt')::timestamptz, (r->>'allDay')::boolean, r->>'timezone', r->>'location', r->>'kind',
        r->'source'->>'kind', r->'source'->>'ref', r->'clocks', (r->>'version')::integer, next_seq,
        (r->>'createdAt')::timestamptz, (r->>'updatedAt')::timestamptz, (r->>'deletedAt')::timestamptz, r->>'deleteClock'
      )
      on conflict (tenant_id, owner_id, id) do update set
        title = excluded.title, notes = excluded.notes, starts_at = excluded.starts_at, ends_at = excluded.ends_at,
        all_day = excluded.all_day, timezone = excluded.timezone, location = excluded.location, kind = excluded.kind,
        field_clocks = excluded.field_clocks, version = excluded.version, seq = excluded.seq,
        updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, delete_clock = excluded.delete_clock;
    end if;
  end loop;

  if next_seq is not null then
    update private.productivity_owner_seq set last_seq = next_seq
      where tenant_id = p_tenant and owner_id = p_owner;
  end if;

  -- The audit envelope every producer shares (20260930000000). The actor and
  -- the owner are pseudonyms; the detail names fields, never their values.
  for a in select * from jsonb_array_elements(coalesce(p_audit, '[]'::jsonb)) loop
    insert into public.audit_event (
      tenant_id, correlation_id, action, object_kind, object_sha256, outcome, actor_sha256, actor_kind, detail
    ) values (
      p_tenant,
      a->>'correlationId',
      a->>'action',
      a->>'objectKind',
      private.role_audit_sha256(a->>'objectId'),
      a->>'outcome',
      private.role_audit_sha256(a->>'actorId'),
      case a->>'actorType' when 'user' then 'authenticated' else 'service' end,
      jsonb_strip_nulls(jsonb_build_object(
        'owner', private.role_audit_sha256(p_owner::text),
        'actor_type', a->>'actorType',
        'device', a->>'deviceId',
        'reason', a->>'reasonCode',
        'fields', a->'fields',
        'command', a->>'commandId'
      ))
    );
  end loop;

  for ev in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    insert into private.domain_outbox_events (
      id, aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
      correlation_id, causation_id, idempotency_key, payload, data_classification, retention_class, occurred_at
    ) values (
      (ev->>'eventId')::uuid, ev->'subject'->>'type', ev->'subject'->>'id', ev->>'eventType',
      (ev->>'eventVersion')::integer, ev->>'environment', p_tenant, ev->>'producer',
      ev->>'correlationId', (ev->>'causationId')::uuid, ev->>'idempotencyKey', ev->'payload',
      ev->>'dataClassification', ev->>'retentionClass', (ev->>'occurredAt')::timestamptz
    );
  end loop;

  return jsonb_build_object('seqs', to_jsonb(seqs));
end $$;

revoke all on function private.productivity_commit(text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
