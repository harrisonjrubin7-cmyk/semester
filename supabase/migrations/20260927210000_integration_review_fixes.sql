-- Semester — two database fixes from the Codex review of #779.
--
-- Both were found after the merge and are reproduced by the suites before this
-- file makes them pass.
--
-- 1. The service role could not write the rows the sync worker writes.
--    `private.public_id` is the default for `integration_sync_runs.public_id`
--    and `source_records.public_id`, and was executable only by
--    `authenticated`. The worker is the service role, a separate role, so
--    every run failed as it opened (`permission denied for function
--    public_id`). integration-hardening.check.sql now inserts both as the
--    service role.
--
-- 2. A canonical reference's identity ignored its connection.
--    Unique on (tenant, source system, source record, type): two connections
--    to the same product at one school — a law school's Canvas beside the main
--    campus's — share a source system, so a record id they had in common made
--    the second import update the first connection's row, subject and values
--    included. Identity now includes the connection. `nulls not distinct`
--    keeps rows whose connection has been removed (connection_id set null)
--    from multiplying.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

grant execute on function private.public_id(text) to service_role;

do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.canonical_entity_references'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) = 'UNIQUE (tenant_id, source_system, source_record_id, canonical_entity_type)';
  if c is not null then
    execute format('alter table public.canonical_entity_references drop constraint %I', c);
  end if;
end $$;

create unique index if not exists canonical_entity_references_identity
  on public.canonical_entity_references (tenant_id, connection_id, source_system, source_record_id, canonical_entity_type)
  nulls not distinct;

-- The LTI launch recorder upserted on the old key; it now names the new one.
-- Otherwise unchanged from 20260927180000_lti_integration_binding.sql.
create or replace function public.lti_record_context(want_issuer text, want_client text, want_context text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.lti_platform;
  n integer;
  c public.integration_connections;
begin
  if want_context is null or length(trim(want_context)) = 0 then return 'no-context'; end if;
  select count(*) into n from public.lti_platform
   where issuer = want_issuer and client_id = want_client;
  if n <> 1 then return 'no-registration'; end if;
  select * into p from public.lti_platform
   where issuer = want_issuer and client_id = want_client;

  if p.tenant_id is null or p.connection_id is null then return 'unbound'; end if;
  if public.kill_switch_engaged('kill.integration_sync', p.tenant_id) then return 'kill-switch'; end if;
  if public.feature_state('integration.lms_lti', p.tenant_id) <> 'production' then return 'module-off'; end if;

  select * into c from public.integration_connections where id = p.connection_id;
  if c.approved_at is null then return 'connection-not-approved'; end if;
  if c.status in ('paused', 'disconnected') then return 'connection-' || c.status; end if;
  if public.kill_switch_engaged('kill.connection.' || c.public_id, p.tenant_id) then return 'kill-switch'; end if;

  insert into public.canonical_entity_references
    (tenant_id, canonical_entity_type, canonical_entity_id, subject_user_id, connection_id,
     source_system, source_record_id, source_timestamp, source_of_truth, classification,
     freshness_status, mapping_version, confidence)
  values
    (p.tenant_id, 'lms_context', 'lti:' || c.public_id || ':' || left(want_context, 150), null, c.id,
     'LTI 1.3 ' || left(want_issuer, 100), left(want_context, 200), now(), 'LMS', 'T0',
     'live', 1, 1)
  on conflict (tenant_id, connection_id, source_system, source_record_id, canonical_entity_type)
  do update set source_timestamp = excluded.source_timestamp,
                freshness_status = 'live',
                external_deleted_at = null,
                updated_at = now();

  update public.integration_connections
     set last_successful_sync_at = now(),
         last_attempt_at = now(),
         status = case when status in ('configuring', 'degraded', 'error') then 'healthy' else status end,
         updated_at = now()
   where id = c.id;

  return 'recorded';
end $$;
revoke all on function public.lti_record_context(text, text, text) from public;
revoke all on function public.lti_record_context(text, text, text) from anon, authenticated;
grant execute on function public.lti_record_context(text, text, text) to service_role;
