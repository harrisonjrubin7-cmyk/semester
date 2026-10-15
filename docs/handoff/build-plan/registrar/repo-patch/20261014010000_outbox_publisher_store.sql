-- The outbox publisher's store (closes the outbox.publish gap: rows were written by
-- private.emit_domain_event and private.productivity_commit, but nothing could claim them safely).
--
-- `drainOutbox` (packages/institution/src/events.ts) reads `pending()` and then marks each row. Read
-- straight from the table, two publishers running at once would both read the same rows and both send
-- them. So pending rows are *claimed*: `for update skip locked` picks rows no other publisher holds, and
-- a lease (`claimed_until`) keeps them out of every other claim until the publisher marks them or the
-- lease runs out. A publisher that dies mid-batch loses nothing: its rows come back when the lease ends.
--
-- Each mark names the claim it belongs to. A publisher whose lease expired and whose rows another
-- publisher has since claimed can't mark them; that late write returns false and changes nothing.
--
-- Additive: two nullable columns, six functions, all service-role only. No producer,
-- consumer or event type changes, so ADR 0008's "a new type ships with its consumer" isn't triggered.

alter table private.domain_outbox_events
  add column if not exists claim_id uuid,
  add column if not exists claimed_until timestamptz;

-- The existing partial index domain_outbox_pending (occurred_at where pending) already serves the claim.

-- Up to `want_batch` rows, oldest first, that are pending and not under someone else's live lease.
create or replace function private.outbox_claim(want_batch integer default 100, want_lease interval default '2 minutes')
returns table (id uuid, claim_id uuid, publish_attempts integer, envelope jsonb)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claim uuid := gen_random_uuid();
begin
  if want_batch is null or want_batch < 1 or want_batch > 500 then
    raise exception 'batch must be between 1 and 500' using errcode = '22023';
  end if;
  if want_lease is null or want_lease < interval '10 seconds' or want_lease > interval '30 minutes' then
    raise exception 'lease must be between 10 seconds and 30 minutes' using errcode = '22023';
  end if;
  return query
  with picked as (
    select o.id
      from private.domain_outbox_events o
     where o.published_at is null and o.dead_lettered_at is null
       and (o.claimed_until is null or o.claimed_until < now())
     order by o.occurred_at, o.id
     limit want_batch
     for update skip locked
  )
  update private.domain_outbox_events o
     set claim_id = claim, claimed_until = now() + want_lease
    from picked
   where o.id = picked.id
  returning o.id, o.claim_id, o.publish_attempts,
    jsonb_build_object(
      'eventId', o.id, 'eventType', o.event_type, 'eventVersion', o.event_version,
      'occurredAt', to_char(o.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'producer', o.producer, 'environment', o.environment, 'tenantId', o.tenant_id,
      'subject', jsonb_build_object('type', o.aggregate_type, 'id', o.aggregate_id),
      'correlationId', o.correlation_id, 'causationId', o.causation_id, 'idempotencyKey', o.idempotency_key,
      'dataClassification', o.data_classification, 'retentionClass', o.retention_class,
      'payload', o.payload, 'payloadHash', o.payload_hash);
end $$;

create or replace function private.outbox_mark_published(want_id uuid, want_claim uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update private.domain_outbox_events
     set published_at = now(), claim_id = null, claimed_until = null, last_error = null
   where id = want_id and claim_id = want_claim and published_at is null and dead_lettered_at is null;
  return found;
end $$;

-- A failed send: count it, keep the message (bounded; never the payload), and release the lease so the
-- row is retried on a later pass rather than after the lease would have run out.
create or replace function private.outbox_mark_failed(want_id uuid, want_claim uuid, want_error text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update private.domain_outbox_events
     set publish_attempts = publish_attempts + 1, last_error = left(coalesce(want_error, 'unknown'), 500),
         claim_id = null, claimed_until = null
   where id = want_id and claim_id = want_claim and published_at is null and dead_lettered_at is null;
  return found;
end $$;

create or replace function private.outbox_mark_dead_lettered(want_id uuid, want_claim uuid, want_error text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  update private.domain_outbox_events
     set dead_lettered_at = now(), publish_attempts = publish_attempts + 1,
         last_error = left(coalesce(want_error, 'unknown'), 500), claim_id = null, claimed_until = null
   where id = want_id and claim_id = want_claim and published_at is null and dead_lettered_at is null;
  return found;
end $$;

-- Thin public wrappers so supabase-js can call them over PostgREST with the service role.
create or replace function public.outbox_claim(want_batch integer default 100, want_lease_seconds integer default 120)
returns table (id uuid, claim_id uuid, publish_attempts integer, envelope jsonb)
language sql volatile security invoker set search_path = ''
as $$ select * from private.outbox_claim(want_batch, make_interval(secs => want_lease_seconds)) $$;
create or replace function public.outbox_mark(want_id uuid, want_claim uuid, want_outcome text, want_error text default null)
returns boolean language plpgsql volatile security invoker set search_path = '' as $$
begin
  if want_outcome = 'published' then return private.outbox_mark_published(want_id, want_claim);
  elsif want_outcome = 'failed' then return private.outbox_mark_failed(want_id, want_claim, want_error);
  elsif want_outcome = 'dead_lettered' then return private.outbox_mark_dead_lettered(want_id, want_claim, want_error);
  end if;
  raise exception 'outcome must be published, failed or dead_lettered' using errcode = '22023';
end $$;

revoke all on function private.outbox_claim(integer, interval) from public, anon, authenticated;
revoke all on function private.outbox_mark_published(uuid, uuid) from public, anon, authenticated;
revoke all on function private.outbox_mark_failed(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.outbox_mark_dead_lettered(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.outbox_claim(integer, integer) from public, anon, authenticated;
revoke all on function public.outbox_mark(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function private.outbox_claim(integer, interval) to service_role;
grant execute on function private.outbox_mark_published(uuid, uuid) to service_role;
grant execute on function private.outbox_mark_failed(uuid, uuid, text) to service_role;
grant execute on function private.outbox_mark_dead_lettered(uuid, uuid, text) to service_role;
grant execute on function public.outbox_claim(integer, integer) to service_role;
grant execute on function public.outbox_mark(uuid, uuid, text, text) to service_role;

comment on function public.outbox_claim(integer, integer) is
  'Claims up to N pending outbox rows under a lease (skip locked). Service role only. See 20261014010000_outbox_publisher_store.sql.';

-- To roll back:
--   drop function public.outbox_mark(uuid, uuid, text, text); drop function public.outbox_claim(integer, integer);
--   drop function private.outbox_mark_dead_lettered(uuid, uuid, text); drop function private.outbox_mark_failed(uuid, uuid, text);
--   drop function private.outbox_mark_published(uuid, uuid); drop function private.outbox_claim(integer, interval);
--   alter table private.domain_outbox_events drop column claimed_until, drop column claim_id;
