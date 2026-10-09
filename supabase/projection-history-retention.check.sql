-- Hold-aware projection history retention.
-- LOCAL/DISPOSABLE DATABASES ONLY; the transaction is always rolled back.
-- How to run: supabase/check.sh projection-history-retention

begin;

create or replace function pg_temp.must(what text, ok boolean)
returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAILED: %', what; end if;
  raise notice 'ok  %', what;
end $$;

create or replace function pg_temp.event_row(
  school text,
  class text,
  age interval,
  state text default 'published'
)
returns uuid language plpgsql as $$
declare event_id uuid;
begin
  insert into private.domain_outbox_events (
    aggregate_type, aggregate_id, event_type, event_version, environment,
    tenant_id, producer, correlation_id, payload, data_classification,
    retention_class, occurred_at, published_at, dead_lettered_at
  ) values (
    'retention_fixture', gen_random_uuid()::text, 'test.changed', 1, 'staging',
    school, 'projection-retention-check', 'retention-' || replace(gen_random_uuid()::text, '-', ''),
    jsonb_build_object('fixture', true), 'internal', class, now() - age,
    case when state = 'published' then now() - age + interval '1 minute' else null end,
    case when state = 'dead' then now() - interval '1 day' else null end
  ) returning id into event_id;

  insert into private.domain_event_receipts (consumer, event_id, outcome, processed_at)
  values ('retention.check', event_id,
          case when state = 'dead' then 'failed' else 'processed' end,
          now() - age);
  return event_id;
end $$;

insert into public.schools (id, name) values
  ('projection-retention-open', 'Projection retention open'),
  ('projection-retention-held', 'Projection retention held');

do $$
declare
  old_operational uuid := pg_temp.event_row('projection-retention-open', 'operational', interval '91 days');
  young_operational uuid := pg_temp.event_row('projection-retention-open', 'operational', interval '89 days');
  old_student uuid := pg_temp.event_row('projection-retention-open', 'student_record', interval '401 days');
  young_student uuid := pg_temp.event_row('projection-retention-open', 'student_record', interval '399 days');
  old_commercial uuid := pg_temp.event_row('projection-retention-open', 'commercial', interval '401 days');
  old_audit uuid := pg_temp.event_row('projection-retention-open', 'audit', interval '3 years 1 day');
  young_audit uuid := pg_temp.event_row('projection-retention-open', 'audit', interval '2 years 364 days');
  pending uuid := pg_temp.event_row('projection-retention-open', 'operational', interval '500 days', 'pending');
  dead uuid := pg_temp.event_row('projection-retention-open', 'operational', interval '500 days', 'dead');
  held uuid := pg_temp.event_row('projection-retention-held', 'operational', interval '500 days');
  said jsonb;
begin
  insert into public.legal_holds
    (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values
    ('tenant', 'projection-retention-held', 'projection-retention-held',
     'Preserve the tenant projection history.', 'PROJECTION-RETENTION-HOLD', gen_random_uuid());

  insert into private.projection_invalidation
    (namespace, tenant_id, resource_id, version, reason, occurred_at, correlation_id)
  values
    ('retention.check', 'projection-retention-open', 'old', 1, 'test', now() - interval '91 days', 'retention-old-invalidation'),
    ('retention.check', 'projection-retention-open', 'young', 1, 'test', now() - interval '89 days', 'retention-young-invalidation'),
    ('retention.check', 'projection-retention-held', 'held', 1, 'test', now() - interval '500 days', 'retention-held-invalidation');

  said := private.prune_projection_history();

  perform pg_temp.must('the operation reports each bounded mutation',
    said = jsonb_build_object(
      'receipts_removed', 4,
      'events_removed', 4,
      'payloads_scrubbed', 3,
      'invalidations_removed', 1));
  perform pg_temp.must('each class expires only after its own window',
    not exists (select 1 from private.domain_outbox_events where id in (old_operational, old_student, old_commercial, old_audit))
    and (select count(*) from private.domain_outbox_events where id in (young_operational, young_student, young_audit)) = 3);
  perform pg_temp.must('receipts leave atomically with expired events',
    not exists (select 1 from private.domain_event_receipts where event_id in (old_operational, old_student, old_commercial, old_audit)));
  perform pg_temp.must('published envelopes older than thirty days are scrubbed inside their window',
    not exists (select 1 from private.domain_outbox_events where id in (young_operational, young_student, young_audit) and payload <> '{}'::jsonb));
  perform pg_temp.must('pending and dead-lettered work is never scrubbed or expired',
    exists (select 1 from private.domain_outbox_events where id = pending and payload <> '{}'::jsonb and published_at is null and dead_lettered_at is null)
    and exists (select 1 from private.domain_outbox_events where id = dead and payload <> '{}'::jsonb and dead_lettered_at is not null)
    and exists (select 1 from private.domain_event_receipts where event_id = dead and outcome = 'failed'));
  perform pg_temp.must('a tenant hold preserves its event, receipt, payload and invalidation',
    exists (select 1 from private.domain_outbox_events where id = held and payload <> '{}'::jsonb)
    and exists (select 1 from private.domain_event_receipts where event_id = held)
    and exists (select 1 from private.projection_invalidation where tenant_id = 'projection-retention-held'));
  perform pg_temp.must('only invalidations past ninety days are removed',
    not exists (select 1 from private.projection_invalidation where resource_id = 'old')
    and exists (select 1 from private.projection_invalidation where resource_id = 'young'));
end $$;

do $$
declare
  held_event_id uuid := pg_temp.event_row('projection-retention-open', 'operational', interval '500 days');
  said jsonb;
begin
  insert into public.legal_holds
    (subject_kind, subject_id, tenant_id, reason, matter_ref, placed_by)
  values ('platform', '', null, 'Preserve all projection history.', 'PLATFORM-PROJECTION-HOLD', gen_random_uuid());

  said := private.prune_projection_history();
  perform pg_temp.must('a platform hold visibly skips the whole operation',
    said = jsonb_build_object('skipped', 'legal_hold')
    and exists (select 1 from private.domain_outbox_events e where e.id = held_event_id and e.payload <> '{}'::jsonb)
    and exists (select 1 from private.domain_event_receipts r where r.event_id = held_event_id));
end $$;

do $$
begin
  perform pg_temp.must('client roles cannot run retention',
    not has_function_privilege('anon', 'private.prune_projection_history()', 'execute')
    and not has_function_privilege('authenticated', 'private.prune_projection_history()', 'execute'));
  perform pg_temp.must('the service role can run retention manually',
    has_function_privilege('service_role', 'private.prune_projection_history()', 'execute'));
end $$;

rollback;
