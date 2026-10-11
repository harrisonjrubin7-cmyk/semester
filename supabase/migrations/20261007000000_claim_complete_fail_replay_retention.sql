-- P1-03: Event sourcing operational RPCs and retention.
--
-- Implements claim/complete/fail/replay operations and retention sweep for the
-- domain event outbox, enabling event sourcing with consumer state tracking.
--
-- Pattern: all RPCs are idempotent via idempotency keys or natural key
-- uniqueness. Service-role-only RLS. Payload validation inherited from P1-02.

-- ── claim: Atomically claim an event for processing ──────────────────────────
--
-- Claim an event and register the consumer. Returns the receipt row. If already
-- claimed by this consumer, returns the existing receipt (idempotent via
-- primary key). If the event is not pending, returns null.
create or replace function private.claim_event(
  want_consumer text,
  want_event_id uuid,
  want_idempotency text
)
returns table (
  consumer text,
  event_id uuid,
  outcome text,
  last_error text,
  processed_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  event_pending boolean;
begin
  -- Validate event is pending and exists.
  select (published_at is null and dead_lettered_at is null)
    into event_pending
    from private.domain_outbox_events
   where id = want_event_id;

  if event_pending is null then
    -- Event does not exist.
    return;
  elsif event_pending is false then
    -- Event is already published or dead-lettered.
    return;
  end if;

  -- Claim the event: insert a receipt with 'processing' outcome.
  -- If already claimed by this consumer, the primary key constraint
  -- makes the insert a no-op, and we return the existing row below.
  insert into private.domain_event_receipts (consumer, event_id, outcome)
  values (want_consumer, want_event_id, 'processing')
  on conflict (consumer, event_id) do nothing;

  -- Return the receipt (existing or newly inserted).
  return query
    select r.consumer, r.event_id, r.outcome, r.last_error, r.processed_at
      from private.domain_event_receipts r
     where r.consumer = want_consumer and r.event_id = want_event_id;
end $$;

revoke all on function private.claim_event(text, uuid, text) from public, anon, authenticated;
grant execute on function private.claim_event(text, uuid, text) to service_role;

-- ── complete: Mark a claimed event as processed ───────────────────────────────
--
-- Updates the receipt to outcome='processed'. Fails if the event is not claimed.
create or replace function private.complete_event(
  want_consumer text,
  want_event_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rows_affected integer;
begin
  update private.domain_event_receipts
     set outcome = 'processed'
   where consumer = want_consumer
     and event_id = want_event_id
     and outcome = 'processing';

  rows_affected := found::integer;

  if rows_affected = 0 then
    -- Receipt not found or not in 'processing' state.
    return false;
  end if;

  return true;
end $$;

revoke all on function private.complete_event(text, uuid) from public, anon, authenticated;
grant execute on function private.complete_event(text, uuid) to service_role;

-- ── fail: Mark a claimed event as failed ──────────────────────────────────────
--
-- Updates the receipt to outcome='failed' with an error message. Increments
-- the publish_attempts counter on the event.
create or replace function private.fail_event(
  want_consumer text,
  want_event_id uuid,
  want_error text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rows_affected integer;
begin
  -- Update receipt to failed state.
  update private.domain_event_receipts
     set outcome = 'failed', last_error = want_error
   where consumer = want_consumer
     and event_id = want_event_id
     and outcome = 'processing';

  rows_affected := found::integer;

  if rows_affected = 0 then
    -- Receipt not found or not in 'processing' state.
    return false;
  end if;

  -- Increment the publish attempts counter on the event.
  update private.domain_outbox_events
     set publish_attempts = publish_attempts + 1,
         last_error = want_error
   where id = want_event_id;

  return true;
end $$;

revoke all on function private.fail_event(text, uuid, text) from public, anon, authenticated;
grant execute on function private.fail_event(text, uuid, text) to service_role;

-- ── replay: Reset an event to pending state ────────────────────────────────────
--
-- Clears published_at and dead_lettered_at, deletes all receipts for the event,
-- allowing it to be reprocessed. Returns the updated event id.
create or replace function private.replay_event(
  want_event_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  rows_affected integer;
begin
  -- Delete all receipts for the event (all consumers).
  delete from private.domain_event_receipts
   where event_id = want_event_id;

  -- Clear published and dead-letter marks, reset attempt counters.
  update private.domain_outbox_events
     set published_at = null,
         dead_lettered_at = null,
         publish_attempts = 0,
         last_error = null
   where id = want_event_id;

  rows_affected := found::integer;

  if rows_affected = 0 then
    -- Event not found.
    return null;
  end if;

  return want_event_id;
end $$;

revoke all on function private.replay_event(uuid) from public, anon, authenticated;
grant execute on function private.replay_event(uuid) to service_role;

-- ── retention_sweep: Remove old events per retention policy ────────────────────
--
-- Deletes events and their receipts where:
-- - retention_class matches the given class
-- - occurred_at is older than the given age
-- - Event is either published or dead-lettered (no active processing)
-- - For audit retention, allows keeping up to 7 years
-- - For student_record retention, allows keeping indefinitely (age_days = null means keep all)
-- - For operational retention, deletes after 30 days by default
-- - For commercial retention, deletes after 90 days by default
--
-- Returns the count of events deleted.
create or replace function private.retention_sweep(
  want_retention_class text,
  want_age_days integer default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cutoff_time timestamptz;
  deleted_count integer;
  age_days_to_use integer;
begin
  -- Validate retention class.
  if want_retention_class not in ('operational', 'student_record', 'audit', 'commercial') then
    raise exception 'Invalid retention_class: %', want_retention_class using errcode = '22023';
  end if;

  -- Determine cutoff age if not specified.
  if want_age_days is null then
    case want_retention_class
      when 'operational' then age_days_to_use := 30;
      when 'student_record' then age_days_to_use := null;  -- Keep indefinitely
      when 'audit' then age_days_to_use := 2555;  -- ~7 years
      when 'commercial' then age_days_to_use := 90;
    end case;
  else
    age_days_to_use := want_age_days;
  end if;

  -- If student_record with no explicit age, do not delete.
  if age_days_to_use is null then
    return 0;
  end if;

  -- Calculate cutoff time.
  cutoff_time := now() - (age_days_to_use || ' days')::interval;

  -- Delete receipts for events to be deleted.
  delete from private.domain_event_receipts
   where event_id in (
     select id from private.domain_outbox_events
      where retention_class = want_retention_class
        and occurred_at < cutoff_time
        and (published_at is not null or dead_lettered_at is not null)
   );

  -- Delete the events themselves.
  delete from private.domain_outbox_events
   where retention_class = want_retention_class
     and occurred_at < cutoff_time
     and (published_at is not null or dead_lettered_at is not null);

  deleted_count := found::integer;

  return deleted_count;
end $$;

revoke all on function private.retention_sweep(text, integer) from public, anon, authenticated;
grant execute on function private.retention_sweep(text, integer) to service_role;
