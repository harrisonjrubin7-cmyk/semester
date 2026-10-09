-- Bind each newly derived course snapshot to the confirmed-correction ledger
-- that existed while the source row was locked. Legacy receipts stay readable
-- evidence, but cannot authorize a new conflict batch because the database
-- cannot prove that their snapshot incorporated later student corrections.

alter table public.course_source_derived_snapshots
  add column if not exists correction_count integer check (correction_count >= 0),
  add column if not exists corrections_sha256 text check (
    corrections_sha256 is null or corrections_sha256 ~ '^[0-9a-f]{64}$');

alter table public.course_source_derived_snapshots
  drop constraint if exists course_source_derived_snapshot_correction_state;
alter table public.course_source_derived_snapshots
  add constraint course_source_derived_snapshot_correction_state check (
    (correction_count is null and corrections_sha256 is null)
    or (correction_count is not null and corrections_sha256 is not null));

create or replace function private.course_source_corrections_sha256(want_source uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.role_audit_sha256(coalesce((
    select jsonb_agg(jsonb_build_array(
      c.derived_record_id, c.field_name, c.revision, c.source_sha256,
      c.prior_value_sha256, c.corrected_value_sha256
    ) order by c.derived_record_id, c.field_name, c.revision)::text
      from public.course_source_corrections c
     where c.source_id = want_source
  ), '[]'));
$$;

revoke all on function private.course_source_corrections_sha256(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.record_course_source_derived_snapshot(
  want_snapshot uuid, want_source uuid, want_actor uuid,
  want_source_sha256 text, want_snapshot_sha256 text, want_extractor_version text,
  want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  src public.course_sources;
  prior public.course_source_operations;
  made public.course_source_derived_snapshots;
  request_hash text;
  next_revision integer;
  current_correction_count integer;
  current_corrections_sha256 text;
begin
  perform private.course_source_service();
  if want_snapshot is null or want_source is null or want_actor is null
     or want_source_sha256 !~ '^[0-9a-f]{64}$'
     or want_snapshot_sha256 !~ '^[0-9a-f]{64}$'
     or want_extractor_version is null or length(want_extractor_version) not between 1 and 120
     or want_extractor_version ~ '[[:cntrl:]]'
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The derived-snapshot receipt is incomplete.' using errcode = '22023';
  end if;

  select * into src from public.course_sources s where s.id = want_source for update;
  if not found or src.owner_id <> want_actor
     or src.lifecycle_state <> 'available' or src.sha256 is null
     or src.sha256 <> want_source_sha256 then
    raise exception 'The available course source could not be verified.' using errcode = '42501';
  end if;
  if not private.course_source_relationship(want_actor, src.tenant_id,
       src.membership_id, src.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;

  select count(*)::integer into current_correction_count
    from public.course_source_corrections c where c.source_id = src.id;
  current_corrections_sha256 := private.course_source_corrections_sha256(src.id);
  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_snapshot::text,
    want_source::text, want_actor::text, want_source_sha256, want_snapshot_sha256,
    want_extractor_version, current_correction_count::text, current_corrections_sha256));
  perform pg_advisory_xact_lock(hashtext(src.tenant_id || ':' || want_actor::text
    || ':snapshot_derived:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = src.tenant_id and o.actor_id = want_actor
     and o.action = 'snapshot_derived' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different derived snapshot.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;

  perform pg_advisory_xact_lock(hashtext(src.id::text || ':derived-revision'));
  select coalesce(max(d.revision), 0) + 1 into next_revision
    from public.course_source_derived_snapshots d where d.source_id = src.id;
  insert into public.course_source_derived_snapshots (
    id, source_id, tenant_id, owner_id, revision, source_sha256,
    snapshot_sha256, extractor_version, correction_count, corrections_sha256
  ) values (
    want_snapshot, src.id, src.tenant_id, want_actor, next_revision, src.sha256,
    want_snapshot_sha256, want_extractor_version, current_correction_count,
    current_corrections_sha256
  ) returning * into made;

  perform private.course_source_audit(want_actor, src.tenant_id, 'course_source.snapshot_derived',
    src.id, want_correlation, src.course_code, src.term, 'derived');
  insert into public.course_source_operations (
    tenant_id, actor_id, action, idempotency_key, request_sha256, source_id, result_json
  ) values (
    src.tenant_id, want_actor, 'snapshot_derived', want_idempotency, request_hash, src.id,
    jsonb_build_object('snapshotId', made.id, 'sourceId', src.id,
      'revision', made.revision, 'correctionCount', made.correction_count,
      'idempotent', false));
  return jsonb_build_object('snapshotId', made.id, 'sourceId', src.id,
    'revision', made.revision, 'correctionCount', made.correction_count,
    'idempotent', false);
end $$;

create or replace function public.record_course_source_conflict_resolution(
  want_batch uuid, want_actor uuid, want_current_source uuid, want_imported_source uuid,
  want_current_snapshot_sha256 text, want_imported_snapshot_sha256 text,
  want_choices jsonb, want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_source public.course_sources;
  imported_source public.course_sources;
  prior public.course_source_operations;
  request_hash text;
  choices_count integer;
  replay_state text;
  made public.course_source_resolution_batches;
begin
  perform private.course_source_service();
  if want_batch is null or want_actor is null or want_current_source is null or want_imported_source is null
     or want_current_source = want_imported_source
     or want_current_snapshot_sha256 !~ '^[0-9a-f]{64}$'
     or want_imported_snapshot_sha256 !~ '^[0-9a-f]{64}$'
     or want_current_snapshot_sha256 = want_imported_snapshot_sha256
     or jsonb_typeof(want_choices) <> 'object'
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The conflict-resolution request is incomplete.' using errcode = '22023';
  end if;

  select count(*) into choices_count from jsonb_each_text(want_choices);
  if choices_count not between 1 and 256
     or exists (select 1 from jsonb_each_text(want_choices) choice
       where choice.value not in ('keep_current', 'use_imported')
          or not (
            choice.key ~ '^(removed|moved|title|time|kind|weight|where|detail|provenance):[^[:cntrl:]]{1,200}$'
            or choice.key ~ '^field:(Code|Name|Professor|Their email|Meets|Room|Credits|Course site)$'
            or choice.key ~ '^grading:(reweighted|removed|added):[^[:cntrl:]]{1,160}$')) then
    raise exception 'The conflict-resolution choices are invalid.' using errcode = '22023';
  end if;

  perform 1 from public.course_sources s
   where s.id in (want_current_source, want_imported_source)
   order by s.id for update;
  select * into current_source from public.course_sources s where s.id = want_current_source;
  select * into imported_source from public.course_sources s where s.id = want_imported_source;
  if current_source.id is null or imported_source.id is null
     or current_source.owner_id <> want_actor or imported_source.owner_id <> want_actor
     or current_source.tenant_id <> imported_source.tenant_id
     or current_source.membership_id <> imported_source.membership_id
     or current_source.course_record_id <> imported_source.course_record_id
     or current_source.course_code <> imported_source.course_code
     or current_source.term <> imported_source.term
     or current_source.lifecycle_state <> 'available' or imported_source.lifecycle_state <> 'available'
     or current_source.sha256 is null or imported_source.sha256 is null then
    raise exception 'The current course-source pair could not be verified.' using errcode = '42501';
  end if;
  if not private.course_source_relationship(want_actor, current_source.tenant_id,
       current_source.membership_id, current_source.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.course_source_derived_snapshots d
     where d.source_id = imported_source.id and d.tenant_id = imported_source.tenant_id
       and d.owner_id = want_actor and d.source_sha256 = imported_source.sha256
       and d.snapshot_sha256 = want_imported_snapshot_sha256
       and d.correction_count = (
         select count(*) from public.course_source_corrections c
          where c.source_id = imported_source.id)
       and d.corrections_sha256 = private.course_source_corrections_sha256(imported_source.id)
  ) then
    raise exception 'The imported snapshot has no correction-current extraction receipt.' using errcode = '42501';
  end if;

  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_batch::text, want_actor::text,
    want_current_source::text, want_imported_source::text, want_current_snapshot_sha256,
    want_imported_snapshot_sha256, want_choices::text));
  perform pg_advisory_xact_lock(hashtext(current_source.tenant_id || ':' || want_actor::text
    || ':conflicts_recorded:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = current_source.tenant_id and o.actor_id = want_actor
     and o.action = 'conflicts_recorded' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for different conflict choices.' using errcode = '22023';
    end if;
    select b.state into replay_state from public.course_source_resolution_batches b
     where b.id = prior.resolution_batch_id;
    return prior.result_json || jsonb_build_object('state', replay_state, 'idempotent', true);
  end if;

  insert into public.course_source_resolution_batches (
    id, tenant_id, owner_id, membership_id, course_record_id,
    current_source_id, imported_source_id, current_snapshot_sha256,
    imported_snapshot_sha256, decision_count
  ) values (
    want_batch, current_source.tenant_id, want_actor, current_source.membership_id,
    current_source.course_record_id, want_current_source, want_imported_source,
    want_current_snapshot_sha256, want_imported_snapshot_sha256, choices_count
  ) returning * into made;
  insert into public.course_source_resolution_choices (batch_id, tenant_id, conflict_key, choice)
    select made.id, made.tenant_id, choice.key, choice.value
      from jsonb_each_text(want_choices) choice;

  perform private.course_source_audit(want_actor, made.tenant_id, 'course_source.conflicts_recorded',
    made.imported_source_id, want_correlation, imported_source.course_code, imported_source.term, 'recorded');
  insert into public.course_source_operations (
    tenant_id, actor_id, action, idempotency_key, request_sha256,
    source_id, resolution_batch_id, result_json
  ) values (
    made.tenant_id, want_actor, 'conflicts_recorded', want_idempotency, request_hash,
    made.imported_source_id, made.id,
    jsonb_build_object('resolutionId', made.id, 'state', made.state,
      'conflicts', choices_count, 'idempotent', false));
  return jsonb_build_object('resolutionId', made.id, 'state', made.state,
    'conflicts', choices_count, 'idempotent', false);
end $$;

comment on column public.course_source_derived_snapshots.correction_count is
  'Number of append-only confirmed corrections bound to this extractor result; null means a legacy receipt that cannot authorize a new conflict batch.';
comment on column public.course_source_derived_snapshots.corrections_sha256 is
  'Deterministic hash of the confirmed-correction chain while the source row was locked; no corrected value is stored here.';
comment on function private.course_source_corrections_sha256(uuid) is
  'Hashes one course source correction chain in stable derived-record, field and revision order.';
comment on function public.record_course_source_derived_snapshot(uuid, uuid, uuid, text, text, text, text, text) is
  'Service-only hash receipt for a named extractor result over one available source and its current confirmed-correction chain.';
