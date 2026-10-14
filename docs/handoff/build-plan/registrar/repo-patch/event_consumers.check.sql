-- supabase/event_consumers.check.sql — for 20261014020000_event_consumers.sql. Everything rolls back.
--   How to run it: supabase/check.sh event_consumers
begin;

create or replace function pg_temp.said(what text, got text, want text)
returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAILED: % — expected %, got %', what, want, got; end if;
  raise notice 'ok  % (%)', what, got;
end $$;

create or replace function pg_temp.refused_as(what text, who text, statement text)
returns void language plpgsql as $$
begin
  execute format('set local role %I', who);
  begin
    execute statement; execute 'reset role';
    raise exception 'FAILED: % — was allowed', what;
  exception when insufficient_privilege then
    execute 'reset role'; raise notice 'ok  % is refused for %', what, who;
  end;
end $$;

do $$
declare e uuid := gen_random_uuid();
begin
  perform pg_temp.said('nothing seen before a delivery', coalesce(public.event_receipt_seen('event-volume', e), 'none'), 'none');
  perform pg_temp.said('a failure is recorded', public.event_receipt_record('event-volume', e, 'failed', repeat('x', 900)), 'failed');
  perform pg_temp.said('its error is bounded', (select length(last_error)::text from private.domain_event_receipts where consumer = 'event-volume' and event_id = e), '500');
  perform pg_temp.said('a later success overwrites the failure', public.event_receipt_record('event-volume', e, 'processed'), 'processed');
  perform pg_temp.said('a late failure can''t downgrade a success', public.event_receipt_record('event-volume', e, 'failed', 'late'), 'processed');
  perform pg_temp.said('and the ledger still says processed', public.event_receipt_seen('event-volume', e), 'processed');
  perform pg_temp.said('another consumer has its own receipt', coalesce(public.event_receipt_seen('notifications', e), 'none'), 'none');
  begin perform public.event_receipt_record('event-volume', e, 'done'); raise exception 'FAILED: unknown outcome accepted';
  exception when invalid_parameter_value then raise notice 'ok  an unknown outcome is refused'; end;

  perform public.event_volume_count('2026-10-14', 'ob-u', 'task.created');
  perform public.event_volume_count('2026-10-14', 'ob-u', 'task.created');
  perform public.event_volume_count('2026-10-14', null, 'task.created');
  perform pg_temp.said('counts add up per tenant and type', (select events::text from private.event_volume_daily where day = '2026-10-14' and tenant_id = 'ob-u' and event_type = 'task.created'), '2');
  perform pg_temp.said('a platform event (no tenant) counts separately', (select events::text from private.event_volume_daily where day = '2026-10-14' and tenant_id = '' and event_type = 'task.created'), '1');
end $$;

select pg_temp.refused_as('reading receipts', 'authenticated', 'select public.event_receipt_seen(''x'', gen_random_uuid())');
select pg_temp.refused_as('recording a receipt', 'anon', 'select public.event_receipt_record(''x'', gen_random_uuid(), ''processed'')');
select pg_temp.refused_as('reading the volume table', 'authenticated', 'select * from private.event_volume_daily');

rollback;
