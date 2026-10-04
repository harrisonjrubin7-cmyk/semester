-- PROPOSAL 03 · event type registry, classification mapping, outbox sweep
--
-- Closes two items the repository already owns up to:
--   * RETENTION.md and ADR 0008: "A retention sweep for both [outbox] tables is owed
--     before any producer writes to them in production." Confirmed: no job, function
--     or test touches private.domain_outbox_events / domain_event_receipts.
--   * Three classification vocabularies are in use (T0-T6 in data_classification_rules,
--     public/internal/student_private/education_record on events, and the TypeScript
--     ResourceClassification). This file makes the mapping one function.
--
-- Design of the sweep: SCRUB, THEN EXPIRE. A published event's payload is the part
-- that holds personal data; its envelope (type, ids, tenant, correlation, time) is
-- what lineage and audit need. So the payload is emptied early and the envelope kept
-- for its retention class. Held tenants and a platform hold stop both steps.

create or replace function private.event_class_to_tier(_event_class text)
returns text language sql immutable strict as $$
  select case _event_class
    when 'public'           then 'T0'
    when 'internal'         then 'T1'
    when 'student_private'  then 'T2'
    when 'education_record' then 'T3'
  end;
$$;

create table if not exists private.event_type_registry (
  event_type       text not null check (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  event_version    integer not null check (event_version > 0),
  owner_domain     text not null check (owner_domain in (
    'identity','academic','learning','productivity','campus','family','finance',
    'career','alumni','marketplace','support','governance','integration','ai','commercial')),
  classification_floor text not null check (classification_floor in ('public','internal','student_private','education_record')),
  retention_class  text not null check (retention_class in ('operational','student_record','audit','commercial')),
  payload_schema   jsonb not null check (jsonb_typeof(payload_schema) = 'object'),  -- JSON Schema, draft 2020-12
  pii_paths        text[] not null default '{}',     -- payload paths the scrub and the analytics projection must treat as personal
  analytics_projection boolean not null default false,
  status           text not null default 'draft' check (status in ('draft','active','deprecated','retired')),
  deprecated_at    timestamptz,
  created_at       timestamptz not null default now(),
  primary key (event_type, event_version),
  check (status not in ('deprecated','retired') or deprecated_at is not null),
  -- A personal-data path on an event that can never be classified above T1 is a contradiction.
  check (cardinality(pii_paths) = 0 or classification_floor in ('student_private','education_record')),
  check (not (analytics_projection and classification_floor = 'education_record'))
);
alter table private.event_type_registry enable row level security;
revoke all on private.event_type_registry from public, anon, authenticated;
-- Applied once the registry is seeded from EVENT_TYPES by the parity test (events.test.ts):
--   alter table private.domain_outbox_events add constraint outbox_type_registered
--     foreign key (event_type, event_version) references private.event_type_registry (event_type, event_version) not valid;
--   alter table private.domain_outbox_events validate constraint outbox_type_registered;

create or replace function private.sweep_outbox(
  _scrub_published_after interval default interval '30 days',
  _scrub_dead_after      interval default interval '90 days')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare
  scrubbed int := 0; dead_scrubbed int := 0; expired int := 0; receipts int := 0; held boolean;
  keep constant jsonb := '{"operational":"90 days","commercial":"400 days","student_record":"400 days","audit":"3 years"}';
begin
  held := private.platform_is_held();
  if held then return jsonb_build_object('skipped', 'legal_hold'); end if;

  -- 1. Scrub the payload of published events past the window.
  update private.domain_outbox_events e set payload = '{}'::jsonb
   where e.published_at is not null and e.published_at < now() - _scrub_published_after
     and e.payload <> '{}'::jsonb
     and (e.tenant_id is null or not private.tenant_is_held(e.tenant_id));
  get diagnostics scrubbed = row_count;

  -- 2. Scrub the payload of parked (dead-lettered) events at the longer window.
  update private.domain_outbox_events e set payload = '{}'::jsonb
   where e.dead_lettered_at is not null and e.dead_lettered_at < now() - _scrub_dead_after
     and e.payload <> '{}'::jsonb
     and (e.tenant_id is null or not private.tenant_is_held(e.tenant_id));
  get diagnostics dead_scrubbed = row_count;

  -- 3. Receipts go with their event, or after the longest class window if the event is gone.
  -- 4. Expire published envelopes by class. Unpublished and parked rows are never expired here:
  --    they are an operator's, and expiring them would hide a delivery failure.
  with gone as (
    delete from private.domain_outbox_events e
     where e.published_at is not null
       and e.published_at < now() - ((keep ->> e.retention_class)::interval)
       and (e.tenant_id is null or not private.tenant_is_held(e.tenant_id))
    returning e.id)
  , r as (delete from private.domain_event_receipts x using gone g where x.event_id = g.id returning 1)
  select (select count(*) from gone), (select count(*) from r) into expired, receipts;

  return jsonb_build_object('scrubbed_published', scrubbed, 'scrubbed_parked', dead_scrubbed,
                            'expired_envelopes', expired, 'receipts_deleted', receipts);
end $$;
revoke all on function private.sweep_outbox(interval, interval) from public, anon, authenticated;
grant execute on function private.sweep_outbox(interval, interval) to service_role;
-- Schedule (not applied here; follows scheduler.sql's pattern, off-peak, after the audit sweep):
--   select cron.schedule('outbox-sweep', '17 3 * * *', $$select private.sweep_outbox()$$);
