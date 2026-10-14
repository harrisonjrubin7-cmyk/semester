create schema if not exists platform;
create table if not exists platform.outbox_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, event_type text not null, event_version int not null default 1,
  aggregate_type text not null, aggregate_id uuid not null, aggregate_version integer not null, payload jsonb not null, correlation_id uuid not null,
  occurred_at timestamptz not null default now(), available_at timestamptz not null default now(), delivered_at timestamptz,
  delivery_attempts integer not null default 0, last_error text, quarantined_at timestamptz, lease_until timestamptz,
  unique (tenant_id, aggregate_type, aggregate_id, aggregate_version, event_type)  -- replay of the same fact is a no-op
);
create index if not exists outbox_ready_events on platform.outbox_events (available_at) where delivered_at is null and quarantined_at is null;
alter table platform.outbox_events enable row level security; alter table platform.outbox_events force row level security;
revoke all on platform.outbox_events from anon, authenticated;

-- Claim up to n events with a lease; SKIP LOCKED means two workers never take the same row.
create or replace function platform.claim_outbox(n int default 25, lease interval default '2 minutes') returns setof platform.outbox_events
language sql security definer set search_path = platform, pg_temp as $$
  with next_events as (
    select id from platform.outbox_events
    where delivered_at is null and quarantined_at is null and available_at <= now() and (lease_until is null or lease_until < now())
    order by occurred_at for update skip locked limit n)
  update platform.outbox_events o set delivery_attempts = o.delivery_attempts + 1, lease_until = now() + lease
  from next_events where o.id = next_events.id returning o.*;
$$;
-- Ack, or back off exponentially and quarantine after 8 attempts (visible in Operations, never silent).
create or replace function platform.settle_outbox(p_id uuid, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = platform, pg_temp as $$
begin
  if p_ok then update outbox_events set delivered_at = now(), lease_until = null where id = p_id;
  else update outbox_events set last_error = left(p_error, 500), lease_until = null,
         available_at = now() + make_interval(secs => least(3600, 15 * power(2, delivery_attempts))),
         quarantined_at = case when delivery_attempts >= 8 then now() end where id = p_id;
  end if;
end $$;
revoke execute on function platform.claim_outbox, platform.settle_outbox from public, anon, authenticated;
