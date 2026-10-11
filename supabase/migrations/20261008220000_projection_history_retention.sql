-- Hold-aware retention for the projection event history (CQRS P1-04).
--
-- This is deliberately a manually invoked service-role operation. It does not
-- add a cron job or activate the dormant projector. Only successfully
-- published events age out; pending and dead-lettered events remain available
-- for delivery, diagnosis and approved replay. A live platform hold pauses the
-- whole operation, and a tenant hold preserves that tenant's rows.

create or replace function private.prune_projection_history()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  receipts_removed bigint := 0;
  events_removed bigint := 0;
  payloads_scrubbed bigint := 0;
  invalidations_removed bigint := 0;
begin
  if private.platform_is_held() then
    return jsonb_build_object('skipped', 'legal_hold');
  end if;

  -- Receipts have no tenant column, so their event is the authority for both
  -- the retention class and the legal-hold boundary. Remove them first: the
  -- event is the retained envelope and a receipt without it has no meaning.
  delete from private.domain_event_receipts r
   using private.domain_outbox_events e
   where r.event_id = e.id
     and e.published_at is not null
     and e.dead_lettered_at is null
     and not private.tenant_is_held(coalesce(e.tenant_id, ''))
     and e.occurred_at < now() - case e.retention_class
       when 'operational' then interval '90 days'
       when 'student_record' then interval '400 days'
       when 'commercial' then interval '400 days'
       when 'audit' then interval '3 years'
     end;
  get diagnostics receipts_removed = row_count;

  delete from private.domain_outbox_events e
   where e.published_at is not null
     and e.dead_lettered_at is null
     and not private.tenant_is_held(coalesce(e.tenant_id, ''))
     and e.occurred_at < now() - case e.retention_class
       when 'operational' then interval '90 days'
       when 'student_record' then interval '400 days'
       when 'commercial' then interval '400 days'
       when 'audit' then interval '3 years'
     end;
  get diagnostics events_removed = row_count;

  -- Published envelopes that still fall inside their class window no longer
  -- need a payload after thirty days. Identifiers, classification, correlation
  -- and delivery evidence remain available without retaining the payload.
  update private.domain_outbox_events e
     set payload = '{}'::jsonb
   where e.published_at is not null
     and e.dead_lettered_at is null
     and e.payload <> '{}'::jsonb
     and e.occurred_at < now() - interval '30 days'
     and not private.tenant_is_held(coalesce(e.tenant_id, ''));
  get diagnostics payloads_scrubbed = row_count;

  -- Invalidations are transient refetch signals. Ninety days covers the
  -- longest supported stale client window without making them permanent
  -- operational history. Tenant and platform holds preserve them.
  delete from private.projection_invalidation i
   where i.occurred_at < now() - interval '90 days'
     and not private.tenant_is_held(coalesce(i.tenant_id, ''));
  get diagnostics invalidations_removed = row_count;

  return jsonb_build_object(
    'receipts_removed', receipts_removed,
    'events_removed', events_removed,
    'payloads_scrubbed', payloads_scrubbed,
    'invalidations_removed', invalidations_removed
  );
end
$$;

revoke all on function private.prune_projection_history() from public, anon, authenticated;
grant execute on function private.prune_projection_history() to service_role;

comment on function private.prune_projection_history() is
  'Manually removes terminal projection history after its class window, scrubs published payloads after 30 days, and removes 90-day invalidations while honoring tenant and platform legal holds. No scheduler is enabled.';
