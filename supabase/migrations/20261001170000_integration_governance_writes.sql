-- Governance has its own budget, outside the existing 4 KB provider allowance.
-- The display remains flat and the never-ingest trigger remains in force.
alter table public.canonical_entity_references
  drop constraint if exists canonical_display_is_small_flat_object;
alter table public.canonical_entity_references
  add constraint canonical_display_is_small_flat_object check (
    jsonb_typeof(display) = 'object'
    and pg_column_size(display - '_governance') <= 4096
    and pg_column_size(display) <= 8192
    and not jsonb_path_exists(display, 'strict $.* ? (@.type() == "object" || @.type() == "array")')
  );

-- Reconfirmed source revisions refresh only server metadata, never values.
-- A deleted/replaced revision is not revived by a racing metadata refresh.
create or replace function public.integration_refresh_governance(
  want_tenant text, want_connection uuid, want_source text, want_records jsonb, want_at timestamptz
)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.canonical_entity_references r
     set display = r.display || jsonb_build_object('_governance',
           case when r.display ? '_governance' then
             -- Keep the provenance/policy of the values actually stored. A new
             -- adapter declaration cannot relabel an unchanged source revision.
             -- Retention deadlines also stay fixed; only freshness is renewed.
             ((r.display ->> '_governance')::jsonb || jsonb_build_object(
               'retrievedAt', want_at,
               'expiresAt', want_at + (
                 ((r.display ->> '_governance')::jsonb ->> 'expiresAt')::timestamptz
                 - ((r.display ->> '_governance')::jsonb ->> 'retrievedAt')::timestamptz
               )))::text
           else x.governance end),
         freshness_status = 'live', updated_at = want_at
    from jsonb_to_recordset(want_records) as x(entity text, id text, timestamp timestamptz, governance text)
   where r.tenant_id = want_tenant and r.connection_id = want_connection
     and r.source_system = want_source and r.canonical_entity_type = x.entity
     and r.source_record_id = x.id and r.source_timestamp = x.timestamp
     and r.external_deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.integration_refresh_governance(text, uuid, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.integration_refresh_governance(text, uuid, text, jsonb, timestamptz) to service_role;

-- One database operation for all removals, retaining each row's own envelope.
create or replace function public.integration_tombstone_references(
  want_tenant text, want_connection uuid, want_source text, want_entity text, want_ids text[], want_at timestamptz
)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.canonical_entity_references
     set external_deleted_at = want_at, freshness_status = 'unavailable', updated_at = want_at,
         display = case when jsonb_typeof(display -> '_governance') = 'string'
                   then jsonb_build_object('_governance', display -> '_governance') else '{}'::jsonb end
   where tenant_id = want_tenant and connection_id = want_connection
     and source_system = want_source and canonical_entity_type = want_entity
     and source_record_id = any(want_ids) and external_deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.integration_tombstone_references(text, uuid, text, text, text[], timestamptz) from public, anon, authenticated;
grant execute on function public.integration_tombstone_references(text, uuid, text, text, text[], timestamptz) to service_role;

-- Direct LTI launches use the same deny-by-default metadata contract.
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
  envelope jsonb;
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

  -- Tenant-wide context provenance follows the existing tenant-lifetime policy
  -- (RETENTION.md), not an invented time-based retention promise.
  envelope := jsonb_build_object(
    'sourceStandard', 'LTI 1.3', 'sourceOwner', 'LMS',
    'permittedPurposes', jsonb_build_array('integration.lms_lti'),
    'aiEligibility', 'denied_by_default', 'retrievedAt', now(),
    'expiresAt', now() + greatest(coalesce(c.freshness_target, interval '1 day'), interval '1 minute'),
    'retentionPolicyId', 'canonical:tenant-lifetime', 'retentionExpiresAt', null,
    'consentPurpose', null, 'writeAuthority', 'source-system-only');

  insert into public.canonical_entity_references
    (tenant_id, canonical_entity_type, canonical_entity_id, subject_user_id, connection_id,
     source_system, source_record_id, source_timestamp, source_of_truth, classification,
     freshness_status, mapping_version, confidence, display)
  values
    (p.tenant_id, 'lms_context', 'lti:' || c.public_id || ':' || left(want_context, 150), null, c.id,
     'LTI 1.3 ' || left(want_issuer, 100), left(want_context, 200), now(), 'LMS', 'T0',
     'live', 1, 1, jsonb_build_object('_governance', envelope::text))
  on conflict (tenant_id, connection_id, source_system, source_record_id, canonical_entity_type)
  do update set source_timestamp = excluded.source_timestamp,
                display = public.canonical_entity_references.display || excluded.display,
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
