-- Tenant-scoped tasks and calendar events, written only by commands.
--
-- The storage half of the productivity service (`app/server/productivity/`,
-- `docs/API-PLATFORM.md`). It does not replace `public.tasks` and
-- `public.appointments`, which are per-record JSON copies the browser syncs and
-- which nothing here reads or writes. These are the typed, tenant-scoped,
-- versioned records the command API owns, and until a client is moved onto
-- that API they hold nothing.
--
-- ## Who may do what, and where each rule lives
--
-- *Read, by the owner, directly:* row-level security. A signed-in person sees
-- their own live rows, in a tenant where their membership is active, and
-- nothing else.
--
-- *Read, by anybody else:* not here. There is no policy that lets a second
-- person see a row, deliberately. A share is decided by the policy decision
-- point (`task.read`, a live consent grant, a purpose), the read is audited
-- before it is served, and it goes through the service, which holds the
-- service role. A direct PostgREST read cannot reach a shared row, so it
-- cannot skip the audit.
--
-- *Write:* nobody directly. `authenticated` has `select` and nothing else. All
-- writes are `private.productivity_commit`, called by the service role after
-- the service has asked the policy decision point and decided inside its own
-- transaction. Row-level security is therefore the wall behind the service,
-- not a substitute for it: the service layer enforces tenant, owner, role,
-- purpose, scope and classification; the database refuses anything that
-- bypasses it.
--
-- ## One commit function, because PostgREST cannot hold a transaction open
--
-- A request/response RPC cannot span "read the row, decide, write it". So the
-- service reads, decides, and then hands this function everything it wants
-- written — the entities with the sequence number each was read at, the
-- command's ledger row, the audit rows, the outbox events — and the function
-- applies them in one transaction or none. If another writer got in between
-- (the entity's `seq` is not the one the service read), it raises 40001 and
-- the service re-reads and re-decides. Idempotency is the ledger's primary
-- key: a concurrent duplicate of a command collides there, and the retry
-- finds it in the ledger and answers "duplicate".
--
-- ## Gapless per-owner sequence
--
-- `seq` is the position of a record's last change in its owner's history. It
-- is taken from `private.productivity_owner_seq` under a row lock inside the
-- commit transaction, so a transaction that rolls back spends none and two
-- that commit never share one. A sync client that sees a jump in `seq` knows
-- it missed a change; that is what makes a reconciliation job a comparison of
-- two integers rather than of two datasets.

-- ── Tasks ──────────────────────────────────────────────────────────────────

create table if not exists public.productivity_task (
  tenant_id    text        not null references public.schools(id) on delete restrict,
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  id           uuid        not null,
  title        text        not null check (length(title) between 1 and 200),
  notes        text        check (notes is null or length(notes) <= 4000),
  status       text        not null default 'open' check (status in ('open', 'done')),
  completed_at timestamptz,
  due_at       timestamptz,
  priority     text        not null default 'normal' check (priority in ('low', 'normal', 'high')),
  course_id    text        check (course_id is null or length(course_id) between 1 and 64),
  source_kind  text        not null default 'student_entered'
                           check (source_kind in ('student_entered', 'imported', 'institution_verified')),
  source_ref   text        check (source_ref is null or length(source_ref) between 1 and 200),
  -- The clock that last won each field: what makes a late replay lose honestly.
  field_clocks jsonb       not null default '{}'::jsonb
                           check (jsonb_typeof(field_clocks) = 'object' and pg_column_size(field_clocks) <= 2048),
  version      integer     not null default 1 check (version >= 1),
  seq          bigint      not null check (seq >= 1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  delete_clock text        check (delete_clock is null or delete_clock ~ '^[0-9]{13}\.[0-9]{4}\.[A-Za-z0-9_-]{1,64}$'),
  primary key (tenant_id, owner_id, id),
  constraint productivity_task_done_has_time check ((status = 'done') = (completed_at is not null)),
  constraint productivity_task_tombstone check ((deleted_at is null) = (delete_clock is null)),
  constraint productivity_task_source_ref check (source_kind <> 'student_entered' or source_ref is null)
);

-- ── Calendar events ────────────────────────────────────────────────────────

create table if not exists public.productivity_event (
  tenant_id    text        not null references public.schools(id) on delete restrict,
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  id           uuid        not null,
  title        text        not null check (length(title) between 1 and 200),
  notes        text        check (notes is null or length(notes) <= 4000),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  all_day      boolean     not null default false,
  -- A place's clock, not an instant: "9:00 every Tuesday" is said in a zone.
  timezone     text        not null check (length(timezone) between 1 and 64),
  location     text        check (location is null or length(location) <= 200),
  kind         text        not null default 'event' check (kind in ('event', 'focus_block')),
  source_kind  text        not null default 'student_entered'
                           check (source_kind in ('student_entered', 'imported', 'institution_verified')),
  source_ref   text        check (source_ref is null or length(source_ref) between 1 and 200),
  field_clocks jsonb       not null default '{}'::jsonb
                           check (jsonb_typeof(field_clocks) = 'object' and pg_column_size(field_clocks) <= 2048),
  version      integer     not null default 1 check (version >= 1),
  seq          bigint      not null check (seq >= 1),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  delete_clock text        check (delete_clock is null or delete_clock ~ '^[0-9]{13}\.[0-9]{4}\.[A-Za-z0-9_-]{1,64}$'),
  primary key (tenant_id, owner_id, id),
  constraint productivity_event_span check (ends_at >= starts_at and ends_at - starts_at <= interval '366 days'),
  constraint productivity_event_tombstone check ((deleted_at is null) = (delete_clock is null)),
  constraint productivity_event_source_ref check (source_kind <> 'student_entered' or source_ref is null)
);

-- Covering indexes: the primary keys lead with tenant_id; deleting an account
-- must not scan these tables, so owner_id has its own.
create index if not exists productivity_task_by_owner on public.productivity_task (owner_id);
create index if not exists productivity_event_by_owner on public.productivity_event (owner_id);
-- The sync feed: everything after a position, in order, tombstones included.
create unique index if not exists productivity_task_by_seq on public.productivity_task (tenant_id, owner_id, seq);
create unique index if not exists productivity_event_by_seq on public.productivity_event (tenant_id, owner_id, seq);
-- The two list screens.
create index if not exists productivity_task_by_due
  on public.productivity_task (tenant_id, owner_id, (coalesce(due_at, 'infinity'::timestamptz)), id)
  where deleted_at is null;
create index if not exists productivity_event_by_start
  on public.productivity_event (tenant_id, owner_id, starts_at, id)
  where deleted_at is null;

alter table public.productivity_task enable row level security;
alter table public.productivity_event enable row level security;
revoke all on table public.productivity_task from public, anon, authenticated;
revoke all on table public.productivity_event from public, anon, authenticated;
grant select on table public.productivity_task to authenticated;
grant select on table public.productivity_event to authenticated;
grant select, insert, update, delete on table public.productivity_task to service_role;
grant select, insert, update, delete on table public.productivity_event to service_role;

drop policy if exists "productivity task owner read" on public.productivity_task;
create policy "productivity task owner read" on public.productivity_task
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and deleted_at is null
    and exists (
      select 1 from public.institution_membership m
      where m.auth_user_id = (select auth.uid())
        and m.tenant_id = productivity_task.tenant_id
        and m.status = 'active'
    )
  );

drop policy if exists "productivity event owner read" on public.productivity_event;
create policy "productivity event owner read" on public.productivity_event
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    and deleted_at is null
    and exists (
      select 1 from public.institution_membership m
      where m.auth_user_id = (select auth.uid())
        and m.tenant_id = productivity_event.tenant_id
        and m.status = 'active'
    )
  );

-- ── The command ledger and the sequence ────────────────────────────────────

-- One row per applied command: the idempotency record. Operational, not
-- evidence — the evidence is the audit row and the outbox event, which this
-- table's sweep does not touch.
create table if not exists private.productivity_command (
  tenant_id      text        not null references public.schools(id) on delete cascade,
  owner_id       uuid        not null references auth.users(id) on delete cascade,
  command_id     uuid        not null,
  -- The same id with a different body is a bug or an attack, not a retry.
  request_sha256 text        not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  result         jsonb       not null check (jsonb_typeof(result) = 'object' and pg_column_size(result) <= 4096),
  stored_at      timestamptz not null default now(),
  primary key (tenant_id, owner_id, command_id)
);

create index if not exists productivity_command_by_owner on private.productivity_command (owner_id);
create index if not exists productivity_command_by_age on private.productivity_command (stored_at);

create table if not exists private.productivity_owner_seq (
  tenant_id text   not null references public.schools(id) on delete cascade,
  owner_id  uuid   not null references auth.users(id) on delete cascade,
  last_seq  bigint not null default 0 check (last_seq >= 0),
  primary key (tenant_id, owner_id)
);

create index if not exists productivity_owner_seq_by_owner on private.productivity_owner_seq (owner_id);

alter table private.productivity_command enable row level security;
alter table private.productivity_owner_seq enable row level security;
revoke all on table private.productivity_command from public, anon, authenticated;
revoke all on table private.productivity_owner_seq from public, anon, authenticated;
grant select, insert, update, delete on table private.productivity_command to service_role;
grant select, insert, update, delete on table private.productivity_owner_seq to service_role;

-- ── The commit ─────────────────────────────────────────────────────────────

/**
 * Applies one decided command, atomically.
 *
 * p_command   null, or {commandId, requestSha256, result}; the ledger row.
 * p_entities  [{type: 'task'|'calendar_event', expectedSeq, row}] — `row` is the
 *             entity as the service holds it, camelCase; `expectedSeq` is the
 *             `seq` it was read at (0 when it did not exist).
 * p_audit     [{...}] — what happened, never what was in it.
 * p_events    [SemesterEvent] — written to the outbox in this transaction.
 *
 * Returns {seqs: [...]}: the sequence number each entity was written at, in
 * order. Raises 40001 when an entity moved since it was read, and 23505 when
 * the command was applied by someone else a moment ago; both mean "read again".
 */
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

create or replace function public.productivity_commit(
  p_tenant text, p_owner uuid, p_command jsonb, p_entities jsonb, p_audit jsonb, p_events jsonb
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$ select private.productivity_commit(p_tenant, p_owner, p_command, p_entities, p_audit, p_events) $$;

revoke all on function private.productivity_commit(text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.productivity_commit(text, uuid, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.productivity_commit(text, uuid, jsonb, jsonb, jsonb, jsonb) to service_role;

-- ── Ledger retention ───────────────────────────────────────────────────────

-- A queued command is refused after 30 days (`LIMITS.commandMaxAgeMs`); the
-- ledger outlives that by five, so no command that could still arrive has had
-- its idempotency record removed. Scheduling it is `supabase/scheduler.sql`.
create or replace function private.productivity_sweep_commands()
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare removed bigint;
begin
  delete from private.productivity_command where stored_at < now() - interval '35 days';
  get diagnostics removed = row_count;
  return removed;
end $$;

revoke all on function private.productivity_sweep_commands() from public, anon, authenticated;
grant execute on function private.productivity_sweep_commands() to service_role;
