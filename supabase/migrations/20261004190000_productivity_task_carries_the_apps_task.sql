-- A productivity task carries what the app's task carries.
--
-- The tasks the app keeps have a day with no time zone, a line of free text for
-- "6:30 PM" or "before work", a repeat rule, a list of steps, and the id of the
-- deadline a plan was made from. `public.productivity_task` had none of them,
-- so a client moved onto the command API would have lost each on the first
-- write. This adds them, and teaches the commit function to write them
-- (`app/server/productivity/contract.ts`, D-1175 and its addendum).
--
-- Additive only. Every new column is nullable or has a default, so a row
-- written before this migration reads back as a task with no day, no repeat
-- rule and no steps. Nothing is dropped, renamed or retyped, and `public.tasks`
-- is untouched. `create or replace` keeps the function's grants.
--
-- Rolling back: the columns can be dropped (`alter table ... drop column`) and
-- the previous function restored from `20261004123000_productivity_commands.sql`;
-- until a client writes the new fields, nothing depends on them.

alter table public.productivity_task
  add column if not exists due_on      date,
  add column if not exists when_text   text  check (when_text is null or length(when_text) between 1 and 40),
  add column if not exists repeat_rule jsonb check (
    repeat_rule is null or coalesce(
      -- coalesce, because a check passes on null: a rule with no `every` or no `until` must fail, not slip through.
      jsonb_typeof(repeat_rule) = 'object'
      and repeat_rule->>'every' in ('daily', 'weekdays', 'weekly', 'fortnightly', 'monthly')
      and repeat_rule->>'until' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and pg_column_size(repeat_rule) <= 8192,
      false
    )
  ),
  add column if not exists steps       jsonb not null default '[]'::jsonb check (
    jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 50 and pg_column_size(steps) <= 24576
  ),
  add column if not exists planned_from text check (planned_from is null or length(planned_from) between 1 and 200);

-- ## What this redefines, and from what
--
-- Two functions, each taken from the definition that applies *now*, not from the
-- first migration: `private.productivity_commit` from `20261004180000_productivity_reads.sql`
-- (which added the held-prediction guard a database adapter relies on), and
-- `private.productivity_task_json` from the same file, which the reads return.
-- Copying the older commit function would have silently dropped that guard, so
-- `schema.test.ts` holds that the latest definition still carries it.

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
    'dueOn', to_char(t.due_on, 'YYYY-MM-DD'), 'whenText', t.when_text,
    'priority', t.priority, 'courseId', t.course_id,
    'repeat', t.repeat_rule, 'steps', t.steps, 'plannedFrom', t.planned_from)
$$;

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
        tenant_id, owner_id, id, title, notes, status, completed_at, due_at, due_on, when_text, priority, course_id,
        repeat_rule, steps, planned_from,
        source_kind, source_ref, field_clocks, version, seq, created_at, updated_at, deleted_at, delete_clock
      ) values (
        p_tenant, p_owner, (r->>'id')::uuid, r->>'title', r->>'notes', r->>'status',
        (r->>'completedAt')::timestamptz, (r->>'dueAt')::timestamptz, (r->>'dueOn')::date, r->>'whenText',
        r->>'priority', r->>'courseId',
        nullif(r->'repeat', 'null'::jsonb), coalesce(nullif(r->'steps', 'null'::jsonb), '[]'::jsonb), r->>'plannedFrom',
        r->'source'->>'kind', r->'source'->>'ref', r->'clocks', (r->>'version')::integer, next_seq,
        (r->>'createdAt')::timestamptz, (r->>'updatedAt')::timestamptz, (r->>'deletedAt')::timestamptz, r->>'deleteClock'
      )
      on conflict (tenant_id, owner_id, id) do update set
        title = excluded.title, notes = excluded.notes, status = excluded.status, completed_at = excluded.completed_at,
        due_at = excluded.due_at, due_on = excluded.due_on, when_text = excluded.when_text,
        priority = excluded.priority, course_id = excluded.course_id,
        repeat_rule = excluded.repeat_rule, steps = excluded.steps, planned_from = excluded.planned_from,
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
grant execute on function private.productivity_commit(text, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;
