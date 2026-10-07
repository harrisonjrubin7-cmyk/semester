-- The one way a SQL-native producer writes to the outbox (backlog P1-02).
--
-- Design: docs/ops/CQRS_READ_MODEL_ARCHITECTURE.md §2. This is the helper and
-- nothing else: no producer calls it yet, no event type is added, and the
-- TypeScript producer (`private.productivity_commit`, which inserts a prebuilt
-- envelope) is untouched. ADR 0008 says a producer adds its event type in the
-- same change as its first consumer, so this change adds none.
--
-- It is `security invoker` on purpose. A definer RPC that calls it runs as that
-- function's owner, which can write the outbox; a client role cannot call it
-- directly, because execute is revoked from every one of them. Making it a
-- definer would have added one more function to the definer register for no
-- caller that needs it.
--
-- Two departures from the paper design, both because of what the table has:
--   - the design's signature leaves out `producer`, `retention_class` and
--     `environment`, which are NOT NULL on `domain_outbox_events`, so they are
--     arguments here;
--   - it names `customer_id`, `actor_type` and `actor_id`, which the table does
--     not have. They are not added: nothing writes or reads them yet, and a
--     column with no producer is a column nobody has checked.

-- A hash of what was written, so a consumer can tell a replayed event from an
-- altered one. `sha256:` and 64 hex digits, the form the integration pipeline
-- already uses for its own payload hashes. Nullable: the productivity producer
-- does not set it, and a column added in place cannot be required of old rows.
alter table private.domain_outbox_events
  add column if not exists payload_hash text;

alter table private.domain_outbox_events
  drop constraint if exists domain_outbox_payload_hash_shape;
alter table private.domain_outbox_events
  add constraint domain_outbox_payload_hash_shape
  check (payload_hash is null or payload_hash ~ '^sha256:[0-9a-f]{64}$');

-- The first key in a payload that must never travel in an event, at any depth
-- and inside arrays, compared whole and without regard to case; null if none.
-- The list is the design's (email, name, body, token, secret, raw). It is a
-- list of *keys*, not of values: an event says which record changed and which
-- fields, never what a person wrote or what a credential is. A key such as
-- `renamed` or `nameChanged` is not `name` and passes. Changing the list is a
-- migration, so it is reviewed.
create or replace function private.payload_denied_key(j jsonb, depth integer default 0)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  found text;
begin
  if depth > 20 then
    raise exception 'event payload is nested too deeply' using errcode = '22023';
  end if;
  if jsonb_typeof(j) = 'object' then
    for k, v in select e.key, e.value from jsonb_each(j) as e loop
      if lower(k) = any (array['email', 'name', 'body', 'token', 'secret', 'raw']) then
        return k;
      end if;
      found := private.payload_denied_key(v, depth + 1);
      if found is not null then return found; end if;
    end loop;
  elsif jsonb_typeof(j) = 'array' then
    for v in select e.value from jsonb_array_elements(j) as e loop
      found := private.payload_denied_key(v, depth + 1);
      if found is not null then return found; end if;
    end loop;
  end if;
  return null;
end $$;

-- Writes one event and returns its id. Called inside the transaction that made
-- the record true, so the event commits or rolls back with it; a failed insert
-- aborts the command rather than being swallowed, which is the whole point of an
-- outbox. The same (aggregate type, aggregate id, idempotency key) is the same
-- event: a second call returns the first one's id and writes nothing, and does
-- not overwrite its payload. An idempotency key is therefore required; without
-- one a retry would write the event twice.
--
-- Every table constraint still applies (the type pattern, the classification
-- and retention sets, the correlation shape, an existing tenant), so a
-- mislabelled event is refused here exactly as it would be by a direct insert.
create or replace function private.emit_domain_event(
  want_aggregate_type text,
  want_aggregate_id text,
  want_event_type text,
  want_event_version integer,
  want_tenant text,
  want_producer text,
  want_correlation text,
  want_idempotency text,
  want_payload jsonb,
  want_classification text,
  want_retention text,
  want_causation uuid default null,
  want_environment text default 'production'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  denied text;
  made uuid;
begin
  if want_idempotency is null then
    raise exception 'an event needs an idempotency key, or a retry would write it twice'
      using errcode = '22023';
  end if;

  denied := private.payload_denied_key(want_payload);
  if denied is not null then
    raise exception 'event payload carries a key that must not travel in an event: %', denied
      using errcode = '22023';
  end if;

  insert into private.domain_outbox_events (
    aggregate_type, aggregate_id, event_type, event_version, environment, tenant_id, producer,
    correlation_id, causation_id, idempotency_key, payload, payload_hash,
    data_classification, retention_class
  ) values (
    want_aggregate_type, want_aggregate_id, want_event_type, want_event_version, want_environment,
    want_tenant, want_producer, want_correlation, want_causation, want_idempotency, want_payload,
    'sha256:' || encode(pg_catalog.sha256(pg_catalog.convert_to(want_payload::text, 'UTF8')), 'hex'),
    want_classification, want_retention
  )
  on conflict (aggregate_type, aggregate_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning id into made;

  if made is null then
    select o.id into made
      from private.domain_outbox_events o
     where o.aggregate_type = want_aggregate_type
       and o.aggregate_id = want_aggregate_id
       and o.idempotency_key = want_idempotency;
  end if;

  return made;
end $$;

revoke all on function private.payload_denied_key(jsonb, integer) from public, anon, authenticated;
revoke all on function private.emit_domain_event(text, text, text, integer, text, text, text, text, jsonb, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function private.payload_denied_key(jsonb, integer) to service_role;
grant execute on function private.emit_domain_event(text, text, text, integer, text, text, text, text, jsonb, text, text, uuid, text)
  to service_role;
