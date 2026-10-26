-- Generate the institution export that the school-offboarding workflow used to
-- record but could not produce. The package is returned to the signed-in
-- platform operator; only integrity metadata is retained in the database.
-- Delivery and purge remain separate, deliberately unimplemented actions.

create table if not exists private.offboarding_export_generation (
  id                uuid        primary key default gen_random_uuid(),
  case_id           uuid        not null references public.school_offboarding (id) on delete restrict,
  tenant_id         text        not null references public.schools (id) on delete restrict,
  idempotency_key   text        not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'),
  request_sha256    text        not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  generated_by      uuid        not null,
  generated_at      timestamptz not null,
  format_version    text        not null,
  manifest          jsonb       not null,
  manifest_sha256   text        not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  package_sha256    text        not null check (package_sha256 ~ '^[0-9a-f]{64}$'),
  counts            jsonb       not null check (jsonb_typeof(counts) = 'object'),
  unique (case_id, idempotency_key)
);

alter table private.offboarding_export_generation enable row level security;

revoke all on table private.offboarding_export_generation from public, anon, authenticated;
grant select, insert on table private.offboarding_export_generation to service_role;

create or replace function private.offboarding_export_generation_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'An offboarding export generation receipt is immutable.' using errcode = '42501';
end $$;

revoke all on function private.offboarding_export_generation_guard() from public, anon, authenticated;

drop trigger if exists offboarding_export_generation_guard on private.offboarding_export_generation;
create trigger offboarding_export_generation_guard
  before update or delete on private.offboarding_export_generation
  for each row execute function private.offboarding_export_generation_guard();

alter table public.school_offboarding
  add column if not exists export_generation_id uuid references private.offboarding_export_generation (id) on delete restrict,
  add column if not exists export_package_sha256 text
    check (export_package_sha256 is null or export_package_sha256 ~ '^[0-9a-f]{64}$');

create or replace function private.school_offboarding_export_binding_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.export_generation_id is not null
     and (new.export_generation_id, new.export_package_sha256)
         is distinct from (old.export_generation_id, old.export_package_sha256) then
    raise exception 'A recorded offboarding export generation is not overwritten.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function private.school_offboarding_export_binding_guard() from public, anon, authenticated;

drop trigger if exists school_offboarding_export_binding_guard on public.school_offboarding;
create trigger school_offboarding_export_binding_guard
  before update on public.school_offboarding
  for each row execute function private.school_offboarding_export_binding_guard();

-- Build one canonical JSON package. Every tenant table is locked before any
-- row is read so a table cannot gain its first row half-way through capture.
-- JSONB's canonical key ordering plus explicit row/table ordering makes the
-- hashes stable. Credential-like columns are omitted and named in the manifest
-- instead of being silently copied into a customer artifact.
create or replace function private.build_offboarding_export_package(
  want_case uuid,
  want_tenant text,
  want_generated_at timestamptz,
  want_generator uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
set timezone = 'UTC'
as $$
declare
  rec record;
  rows jsonb;
  files jsonb := '{}'::jsonb;
  table_manifest jsonb := '[]'::jsonb;
  omitted text[];
  file_sha text;
  manifest jsonb;
  total_rows bigint;
begin
  -- Lock in one order to avoid two generators deadlocking each other. SHARE
  -- permits reads and blocks tenant writes until this statement completes.
  for rec in
    select t.table_name
      from information_schema.tables t
      join information_schema.columns c
        on c.table_schema = t.table_schema and c.table_name = t.table_name
     where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and c.column_name in ('tenant_id', 'school_id')
       and t.table_name not in ('school_offboarding', 'school_offboarding_undo', 'audit_event')
     group by t.table_name
     order by t.table_name
  loop
    execute format('lock table public.%I in share mode', rec.table_name);
  end loop;

  select coalesce(sum(t.n), 0)
    into total_rows
    from private.school_tenant_tables(want_tenant) t;
  if total_rows > 100000 then
    return jsonb_build_object('_error', jsonb_build_object(
      'code', 'synchronous_export_limit_exceeded',
      'message', 'Export paused: this tenant exceeds the 100,000-row synchronous preview limit. Use an approved, reviewed chunked generator.',
      'observed_rows', total_rows,
      'maximum_rows', 100000));
  end if;

  for rec in select * from private.school_tenant_tables(want_tenant) order by tbl loop
    select coalesce(array_agg(c.column_name order by c.ordinal_position), array[]::text[])
      into omitted
      from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = rec.tbl
       and (
         c.column_name ~* '(password|secret|token|credential|api_?key|private_?key|cipher|encrypted|access_?key|refresh_?key)'
         or (rec.tbl = 'legal_holds' and c.column_name in ('reason', 'matter_ref', 'release_reason'))
       );

    execute format(
      'select coalesce(jsonb_agg(q.row_data order by q.row_data::text), ''[]''::jsonb)
         from (
           select (select coalesce(jsonb_object_agg(e.key, e.value order by e.key), ''{}''::jsonb)
                     from jsonb_each(to_jsonb(t)) e
                    where not (e.key = any($2))) as row_data
             from public.%I t
            where t.%I::text = $1
         ) q',
      rec.tbl, rec.col)
      into rows using want_tenant, omitted;

    file_sha := encode(pg_catalog.sha256(pg_catalog.convert_to(rows::text, 'UTF8')), 'hex');
    files := files || jsonb_build_object(rec.tbl || '.json', rows);
    table_manifest := table_manifest || jsonb_build_array(jsonb_build_object(
      'file', rec.tbl || '.json',
      'table', rec.tbl,
      'tenant_column', rec.col,
      'rows', rec.n,
      'sha256', file_sha,
      'excluded_columns', to_jsonb(omitted),
      'exclusion_reason', case when cardinality(omitted) = 0 then null else 'credential_secret_or_privileged' end
    ));
  end loop;

  manifest := jsonb_build_object(
    'format', 'semester.institution-offboarding-export',
    'format_version', '1',
    'case_id', want_case,
    'tenant_id', want_tenant,
    'generated_at', to_char(want_generated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'generated_by_sha256', private.role_audit_sha256(want_generator::text),
    'tables', table_manifest,
    'legal_holds_observed', private.school_live_holds(want_tenant),
    'legal_hold_effect', 'preserve_data; export_does_not_authorize_deletion',
    'retention_effect', 'none; archive_and_purge_are_separate_steps',
    'destructive_actions', '[]'::jsonb,
    'withheld', jsonb_build_array(
      jsonb_build_object('table', 'audit_event', 'reason', 'platform_audit_evidence'),
      jsonb_build_object('table', 'school_offboarding', 'reason', 'platform_control_record'),
      jsonb_build_object('table', 'school_offboarding_undo', 'reason', 'platform_security_control')
    ),
    'temporary_artifact', 'not stored by Semester; caller must use the approved encrypted channel and remove its temporary copy after receipt'
  );

  return jsonb_build_object('manifest', manifest, 'files', files);
end $$;

revoke all on function private.build_offboarding_export_package(uuid, text, timestamptz, uuid)
  from public, anon, authenticated;

create or replace function public.generate_offboarding_export(want uuid, want_idempotency_key text)
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
  prior private.offboarding_export_generation;
  made private.offboarding_export_generation;
  generated_at timestamptz;
  package jsonb;
  manifest jsonb;
  counts jsonb;
  manifest_hash text;
  package_hash text;
  request_hash text;
begin
  c := private.offboarding_case(want, array['access_disabled']);
  if want_idempotency_key is null
     or want_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$' then
    raise exception 'Use an idempotency key of 8-120 letters, numbers, dots, colons, underscores, or hyphens.'
      using errcode = '22023';
  end if;

  select * into prior
    from private.offboarding_export_generation
   where case_id = want and idempotency_key = want_idempotency_key
   for update;

  if found and prior.generated_by <> me then
    perform private.record_audit(c.tenant_id, 'school.offboarding_export_replay_rejected',
      'school_offboarding', want::text, 'denied', null,
      jsonb_build_object('reason', 'different_operator'));
    return jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'replay_operator_mismatch',
      'message', 'Export paused: only the operator who generated this key can replay it. Use a new key for a new generation.'));
  end if;

  generated_at := coalesce(prior.generated_at, statement_timestamp());
  package := private.build_offboarding_export_package(want, c.tenant_id, generated_at, coalesce(prior.generated_by, me));
  if package ? '_error' then
    perform private.record_audit(c.tenant_id, 'school.offboarding_export_generation_rejected',
      'school_offboarding', want::text, 'denied', null, package -> '_error');
    return jsonb_build_object('ok', false, 'error', package -> '_error');
  end if;
  manifest := package -> 'manifest';
  manifest_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(manifest::text, 'UTF8')), 'hex');
  package_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(package::text, 'UTF8')), 'hex');
  select coalesce(jsonb_object_agg(t ->> 'table', (t ->> 'rows')::bigint), '{}'::jsonb)
    into counts from jsonb_array_elements(manifest -> 'tables') t;
  request_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    want::text || chr(31) || c.tenant_id || chr(31) || want_idempotency_key || chr(31) || '1', 'UTF8')), 'hex');

  if prior.id is not null then
    if (prior.manifest_sha256, prior.package_sha256, prior.counts)
       is distinct from (manifest_hash, package_hash, counts) then
      perform private.record_audit(c.tenant_id, 'school.offboarding_export_replay_rejected',
        'school_offboarding', want::text, 'denied', null,
        jsonb_build_object('reason', 'snapshot_changed'));
      return jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'snapshot_changed',
        'message', 'Export paused: tenant data changed after this key was generated. Review the change and generate with a new key.'),
        'original_manifest_sha256', prior.manifest_sha256,
        'current_manifest_sha256', manifest_hash);
    end if;
    perform private.record_audit(c.tenant_id, 'school.offboarding_export_replayed',
      'school_offboarding', want::text, 'allowed', null,
      jsonb_build_object('generation', prior.id, 'tables',
        (select count(*) from jsonb_object_keys(prior.counts))));
    return jsonb_build_object('ok', true, 'replayed', true, 'generation_id', prior.id,
      'manifest_sha256', manifest_hash, 'package_sha256', package_hash, 'counts', counts, 'package', package);
  end if;

  insert into private.offboarding_export_generation
    (case_id, tenant_id, idempotency_key, request_sha256, generated_by, generated_at,
     format_version, manifest, manifest_sha256, package_sha256, counts)
  values
    (want, c.tenant_id, want_idempotency_key, request_hash, me, generated_at,
     '1', manifest, manifest_hash, package_hash, counts)
  returning * into made;

  perform private.record_audit(c.tenant_id, 'school.offboarding_export_generated',
    'school_offboarding', want::text, 'allowed', null,
    jsonb_build_object('generation', made.id, 'tables',
      (select count(*) from jsonb_object_keys(counts)),
      'manifest_sha256', manifest_hash, 'package_sha256', package_hash,
      'legal_holds_observed', manifest -> 'legal_holds_observed'));

  return jsonb_build_object('ok', true, 'replayed', false, 'generation_id', made.id,
    'manifest_sha256', manifest_hash, 'package_sha256', package_hash, 'counts', counts, 'package', package);
end $$;

revoke all on function public.generate_offboarding_export(uuid, text) from public, anon;
grant execute on function public.generate_offboarding_export(uuid, text) to authenticated;

-- The generated-package path binds delivery to the exact immutable receipt.
-- The existing record_offboarding_export function remains available for the
-- documented interim path where counsel approves an external export tool.
create or replace function public.record_generated_offboarding_export(want uuid, want_generation uuid, delivered_to text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  g private.offboarding_export_generation;
begin
  c := private.offboarding_case(want, array['access_disabled']);
  select * into g
    from private.offboarding_export_generation
   where id = want_generation and case_id = want and generated_by = me;
  if not found then
    raise exception 'Generate this case export before recording delivery; the generation receipt must belong to this case and operator.'
      using errcode = '23514';
  end if;
  update public.school_offboarding
     set export_sha256 = g.manifest_sha256,
         export_package_sha256 = g.package_sha256,
         export_generation_id = g.id,
         export_counts = g.counts,
         export_delivered_to = delivered_to,
         export_recorded_by = me,
         export_recorded_at = now()
   where id = want;
  perform private.record_audit(c.tenant_id, 'school.offboarding_export_recorded',
    'school_offboarding', want::text, 'allowed', null,
    jsonb_build_object('generation', g.id, 'manifest_sha256', g.manifest_sha256,
      'package_sha256', g.package_sha256, 'tables',
      (select count(*) from jsonb_object_keys(g.counts))));
end $$;

revoke all on function public.record_generated_offboarding_export(uuid, uuid, text) from public, anon;
grant execute on function public.record_generated_offboarding_export(uuid, uuid, text) to authenticated;

comment on table private.offboarding_export_generation is
  'Immutable integrity metadata for synthetic or real institution-offboarding export generation. Package data is returned to the authorized caller and is never stored here.';

comment on function public.generate_offboarding_export(uuid, text) is
  'Produces a deterministic tenant-scoped JSON export package for an access-disabled offboarding case; replays are actor-bound and fail visibly if the snapshot changed. It neither delivers nor deletes data.';
