-- Consumer receipts over RPC, and the first consumer's projection — so a scheduled publisher can deliver
-- outbox events to in-process consumers through processOnce (packages/institution/src/events.ts).
--
-- ADR 0008: a consumer records an outcome per (consumer, event) before a second delivery can repeat its side
-- effects. domain_event_receipts already has that primary key; this adds the two calls PostgresReceiptLedger
-- needs, plus one deliberately low-risk first consumer ("event-volume") that counts events per type, tenant and
-- day. It reads nothing from payloads, so it can't leak anything, and it proves the publisher → consumer → receipt
-- path end to end before a consumer with real side effects (notifications, passback) is wired on.
--
-- Additive. Service role only. Depends on 20261014010000_outbox_publisher_store.sql only for ordering.

create or replace function public.event_receipt_seen(want_consumer text, want_event uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select r.outcome from private.domain_event_receipts r where r.consumer = want_consumer and r.event_id = want_event
$$;

-- processed and skipped are final; failed can be overwritten by a later attempt's outcome.
create or replace function public.event_receipt_record(want_consumer text, want_event uuid, want_outcome text, want_error text default null)
returns text language plpgsql volatile security invoker set search_path = '' as $$
declare
  now_outcome text;
begin
  if want_outcome not in ('processed', 'skipped', 'failed') then
    raise exception 'outcome must be processed, skipped or failed' using errcode = '22023';
  end if;
  insert into private.domain_event_receipts (consumer, event_id, outcome, last_error, processed_at)
  values (want_consumer, want_event, want_outcome, left(want_error, 500), now())
  on conflict (consumer, event_id) do update
    set outcome = excluded.outcome, last_error = excluded.last_error, processed_at = excluded.processed_at
    where private.domain_event_receipts.outcome = 'failed'
  returning outcome into now_outcome;
  if now_outcome is null then
    select r.outcome into now_outcome from private.domain_event_receipts r where r.consumer = want_consumer and r.event_id = want_event;
  end if;
  return now_outcome;  -- what the ledger holds now; a caller that sees 'processed' after recording 'failed' lost a race and must not redo side effects
end $$;

-- The first consumer's projection: how many events of each type each tenant produced each day.
create table if not exists private.event_volume_daily (
  day date not null,
  tenant_id text not null default '',
  event_type text not null check (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  events integer not null default 0 check (events >= 0),
  primary key (day, tenant_id, event_type)
);
alter table private.event_volume_daily enable row level security;
alter table private.event_volume_daily force row level security;
revoke all on table private.event_volume_daily from public, anon, authenticated;
grant select, insert, update on table private.event_volume_daily to service_role;

create or replace function public.event_volume_count(want_day date, want_tenant text, want_type text)
returns void language sql volatile security invoker set search_path = '' as $$
  insert into private.event_volume_daily (day, tenant_id, event_type, events)
  values (want_day, coalesce(want_tenant, ''), want_type, 1)
  on conflict (day, tenant_id, event_type) do update set events = private.event_volume_daily.events + 1
$$;

revoke all on function public.event_receipt_seen(text, uuid) from public, anon, authenticated;
revoke all on function public.event_receipt_record(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.event_volume_count(date, text, text) from public, anon, authenticated;
grant execute on function public.event_receipt_seen(text, uuid) to service_role;
grant execute on function public.event_receipt_record(text, uuid, text, text) to service_role;
grant execute on function public.event_volume_count(date, text, text) to service_role;

-- To roll back: drop the three functions, then drop table private.event_volume_daily.
