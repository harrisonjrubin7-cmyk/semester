-- A synthetic-only, read-only dry run for the purge that does not exist.
--
-- This migration deliberately does not add a purge function, delete grant, or
-- destructive control. It lets a platform operator inspect the exact rows a
-- future, separately reviewed implementation would have to consider, and
-- keeps an immutable receipt of that inspection. Real tenants are refused.

create table if not exists private.offboarding_purge_preview_receipt (
  id                uuid        primary key default gen_random_uuid(),
  case_id           uuid        not null references public.school_offboarding (id) on delete restrict,
  tenant_id         text        not null references public.schools (id) on delete restrict,
  idempotency_key   text        not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'),
  request_sha256    text        not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_sha256   text        not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  generated_by      uuid        not null,
  generated_at      timestamptz not null,
  preview           jsonb       not null check (jsonb_typeof(preview) = 'object'),
  unique (case_id, idempotency_key)
);

create index if not exists offboarding_purge_preview_receipt_tenant_idx
  on private.offboarding_purge_preview_receipt (tenant_id);

alter table private.offboarding_purge_preview_receipt enable row level security;
revoke all on table private.offboarding_purge_preview_receipt from public, anon, authenticated;
grant select, insert on table private.offboarding_purge_preview_receipt to service_role;

create or replace function private.offboarding_purge_preview_receipt_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'An offboarding purge preview receipt is immutable.' using errcode = '42501';
end $$;

revoke all on function private.offboarding_purge_preview_receipt_guard() from public, anon, authenticated;

drop trigger if exists offboarding_purge_preview_receipt_guard on private.offboarding_purge_preview_receipt;
create trigger offboarding_purge_preview_receipt_guard
  before update or delete on private.offboarding_purge_preview_receipt
  for each row execute function private.offboarding_purge_preview_receipt_guard();

-- Metadata only, and synthetic tenants only. The same platform-scoped
-- capability used by private.offboarding_operator is required in addition to
-- the console shell capability so navigation never becomes authorization.
create or replace function public.console_offboarding_cases()
returns table (
  case_id uuid,
  tenant_id text,
  tenant_name text,
  status text,
  retain_until timestamptz,
  live_legal_holds bigint,
  export_generation_id uuid,
  manifest_sha256 text,
  package_sha256 text,
  export_verified_at timestamptz,
  archived_at timestamptz,
  purge_authorized_at timestamptz,
  latest_preview_at timestamptz,
  access_basis text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not private.has_capability('console:operate', 'platform', '')
     or not private.is_app_admin() then
    raise exception 'Platform console and configuration authority are required.' using errcode = '42501';
  end if;

  return query
  select o.id,
         o.tenant_id,
         s.name,
         o.status,
         o.retain_until,
         private.school_live_holds(o.tenant_id),
         o.export_generation_id,
         o.export_sha256,
         o.export_package_sha256,
         o.export_verified_at,
         o.archived_at,
         o.purge_authorized_at,
         (select max(r.generated_at)
            from private.offboarding_purge_preview_receipt r
           where r.case_id = o.id),
         'platform console:operate + platform:configure; synthetic tenant only'::text
    from public.school_offboarding o
    join public.schools s on s.id = o.tenant_id
   where s.is_demo
     and o.status in ('access_disabled', 'export_verified', 'archived')
   order by o.proposed_at desc, o.id;
end $$;

revoke all on function public.console_offboarding_cases() from public, anon;
grant execute on function public.console_offboarding_cases() to authenticated;

create or replace function public.preview_school_purge(want uuid, want_idempotency_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  target_tenant text;
  tenant_is_demo boolean;
  prior private.offboarding_purge_preview_receipt;
  made private.offboarding_purge_preview_receipt;
  generation private.offboarding_export_generation;
  rec record;
  counts jsonb := '{}'::jsonb;
  total_rows bigint := 0;
  live_holds bigint;
  retention_complete boolean;
  manifest_integrity boolean := false;
  counts_match boolean := false;
  blockers text[] := '{}';
  preview jsonb;
  snapshot_hash text;
  request_hash text;
begin
  if not private.has_capability('console:operate', 'platform', '') then
    raise exception 'Platform console authority is required.' using errcode = '42501';
  end if;

  -- Establish the synthetic boundary before taking the case's FOR UPDATE lock.
  -- A request naming a real tenant therefore cannot even lock that record.
  select o.tenant_id, s.is_demo into target_tenant, tenant_is_demo
    from public.school_offboarding o
    join public.schools s on s.id = o.tenant_id
   where o.id = want;
  if not found then
    raise exception 'No such case.' using errcode = 'no_data_found';
  end if;
  if tenant_is_demo is distinct from true then
    perform private.record_audit(target_tenant, 'school.offboarding_purge_preview_rejected',
      'school_offboarding', want::text, 'denied', null,
      jsonb_build_object('reason', 'non_demo_tenant'));
    -- Return a structured refusal instead of raising: an exception would roll
    -- back the security audit row together with the rest of this statement.
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'non_demo_tenant',
      'message', 'Purge preview is available only for a synthetic demo tenant.',
      'fallback', 'No case snapshot was returned and no records changed.'));
  end if;
  c := private.offboarding_case(want, array['archived']);

  if want_idempotency_key is null
     or want_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$' then
    raise exception 'Use an idempotency key of 8-120 letters, numbers, dots, colons, underscores, or hyphens.'
      using errcode = '22023';
  end if;

  select * into prior
    from private.offboarding_purge_preview_receipt
   where case_id = want and idempotency_key = want_idempotency_key
   for update;
  if found and prior.generated_by <> me then
    perform private.record_audit(c.tenant_id, 'school.offboarding_purge_preview_rejected',
      'school_offboarding', want::text, 'denied', null,
      jsonb_build_object('reason', 'different_operator'));
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'replay_operator_mismatch',
      'message', 'Preview paused: only the operator who created this key can replay it. Use a new reviewed key.'));
  end if;

  -- Lock every tenant table in a deterministic order before counting so the
  -- summary is one exact snapshot. SHARE permits reads and blocks writes only
  -- for the duration of this statement.
  for rec in
    select t.table_name
      from information_schema.tables t
      join information_schema.columns col
        on col.table_schema = t.table_schema and col.table_name = t.table_name
     where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and col.column_name in ('tenant_id', 'school_id')
       and t.table_name not in ('school_offboarding', 'school_offboarding_undo', 'audit_event')
     group by t.table_name
     order by t.table_name
  loop
    execute format('lock table public.%I in share mode', rec.table_name);
  end loop;

  select coalesce(jsonb_object_agg(t.tbl, t.n order by t.tbl), '{}'::jsonb), coalesce(sum(t.n), 0)
    into counts, total_rows
    from private.school_tenant_tables(c.tenant_id) t;

  live_holds := private.school_live_holds(c.tenant_id);
  retention_complete := c.retain_until is not null and statement_timestamp() >= c.retain_until;

  if c.export_generation_id is not null then
    select * into generation
      from private.offboarding_export_generation g
     where g.id = c.export_generation_id and g.case_id = c.id and g.tenant_id = c.tenant_id;
  end if;

  manifest_integrity := generation.id is not null
    and generation.manifest_sha256 = c.export_sha256
    and generation.package_sha256 = c.export_package_sha256
    and generation.counts = c.export_counts
    and generation.manifest_sha256 = encode(pg_catalog.sha256(pg_catalog.convert_to(generation.manifest::text, 'UTF8')), 'hex')
    and c.export_verified_at is not null;
  counts_match := manifest_integrity and generation.counts = counts;

  if not retention_complete then blockers := array_append(blockers, 'retention_window_open'); end if;
  if live_holds > 0 then blockers := array_append(blockers, 'live_legal_hold'); end if;
  if not manifest_integrity then blockers := array_append(blockers, 'export_manifest_unverified'); end if;
  if manifest_integrity and not counts_match then blockers := array_append(blockers, 'affected_record_counts_changed'); end if;
  if c.purge_authorized_at is null then blockers := array_append(blockers, 'purge_authorization_missing'); end if;

  preview := jsonb_build_object(
    'case_id', c.id,
    'tenant_id', c.tenant_id,
    'synthetic_only', true,
    'status', c.status,
    'legal_hold', jsonb_build_object(
      'live_count', live_holds,
      'status', case when live_holds > 0 then 'blocked' else 'clear' end),
    'retention', jsonb_build_object(
      'retain_until', c.retain_until,
      'status', case when retention_complete then 'complete' else 'open' end),
    'export_manifest', jsonb_build_object(
      'generation_id', c.export_generation_id,
      'manifest_sha256', c.export_sha256,
      'package_sha256', c.export_package_sha256,
      'verified_at', c.export_verified_at,
      'integrity', case when manifest_integrity then 'verified' else 'unverified' end,
      'current_counts_match', counts_match),
    'affected_records', jsonb_build_object(
      'tables', counts,
      'table_count', (select count(*) from jsonb_object_keys(counts)),
      'total_records', total_rows),
    'approval', jsonb_build_object(
      'proposed_at', c.proposed_at,
      'approved_at', c.approved_at,
      'export_verified_at', c.export_verified_at,
      'archived_at', c.archived_at,
      'purge_authorized_at', c.purge_authorized_at,
      'separation_recorded', c.approved_by is distinct from c.proposed_by
        and (c.purge_authorized_by is null or (c.purge_authorized_by <> c.proposed_by and c.purge_authorized_by is distinct from c.approved_by))),
    'conditions_satisfied_for_future_review', cardinality(blockers) = 0,
    'blockers', to_jsonb(blockers),
    'destructive_action', jsonb_build_object(
      'available', false,
      'enabled', false,
      'executed', false,
      'reason', 'No purge or delete operation exists in this preview slice.'),
    'fallback', case when cardinality(blockers) = 0
      then 'Preview only. A separately authorized and implemented purge would still require its own review.'
      else 'No records changed. Resolve the listed evidence blockers, then create a new reviewed preview.' end
  );

  snapshot_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(preview::text, 'UTF8')), 'hex');
  request_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    want::text || chr(31) || c.tenant_id || chr(31) || want_idempotency_key || chr(31) || '1', 'UTF8')), 'hex');

  if prior.id is not null then
    if prior.snapshot_sha256 <> snapshot_hash then
      perform private.record_audit(c.tenant_id, 'school.offboarding_purge_preview_rejected',
        'school_offboarding', want::text, 'denied', null,
        jsonb_build_object('reason', 'snapshot_changed', 'original_snapshot_sha256', prior.snapshot_sha256,
          'current_snapshot_sha256', snapshot_hash));
      return jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'snapshot_changed',
        'message', 'Preview paused: the evidence or affected-record snapshot changed. Review it and use a new key.'),
        'original_snapshot_sha256', prior.snapshot_sha256,
        'current_snapshot_sha256', snapshot_hash);
    end if;
    perform private.record_audit(c.tenant_id, 'school.offboarding_purge_preview_replayed',
      'school_offboarding', want::text, 'allowed', null,
      jsonb_build_object('receipt', prior.id, 'snapshot_sha256', prior.snapshot_sha256));
    return jsonb_build_object('ok', true, 'replayed', true, 'receipt_id', prior.id,
      'generated_at', prior.generated_at, 'snapshot_sha256', prior.snapshot_sha256, 'preview', prior.preview);
  end if;

  insert into private.offboarding_purge_preview_receipt
    (case_id, tenant_id, idempotency_key, request_sha256, snapshot_sha256, generated_by, generated_at, preview)
  values
    (c.id, c.tenant_id, want_idempotency_key, request_hash, snapshot_hash, me, statement_timestamp(), preview)
  returning * into made;

  perform private.record_audit(c.tenant_id, 'school.offboarding_purge_preview_generated',
    'school_offboarding', want::text, 'allowed', null,
    jsonb_build_object('receipt', made.id, 'snapshot_sha256', snapshot_hash,
      'total_records', total_rows, 'blockers', to_jsonb(blockers), 'destructive_action_available', false));

  return jsonb_build_object('ok', true, 'replayed', false, 'receipt_id', made.id,
    'generated_at', made.generated_at, 'snapshot_sha256', snapshot_hash, 'preview', preview);
end $$;

revoke all on function public.preview_school_purge(uuid, text) from public, anon;
grant execute on function public.preview_school_purge(uuid, text) to authenticated;

comment on table private.offboarding_purge_preview_receipt is
  'Immutable, actor-bound receipts for synthetic-only purge previews. Contains summary metadata, never tenant row data.';

comment on function public.preview_school_purge(uuid, text) is
  'Produces and audits a synthetic-demo-only, exact-count purge dry run. It cannot authorize a purge and contains no delete or tenant-record mutation.';
