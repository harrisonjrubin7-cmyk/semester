-- Hash-only authority for a course document's derived course snapshot.
--
-- This does not extract a document and stores no extracted text. A future
-- private extractor may append a receipt only after the source is available,
-- its stored/scanned hash still matches, and the student's exact relationship
-- is current. Conflict recording then refuses an imported snapshot hash that
-- has no such receipt; browser data alone is never source evidence.

create table if not exists public.course_source_derived_snapshots (
  id                uuid        primary key,
  source_id         uuid        not null,
  tenant_id         text        not null references public.schools(id) on delete restrict,
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  revision          integer     not null check (revision > 0),
  source_sha256     text        not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  snapshot_sha256   text        not null check (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  extractor_version text        not null check (
                                  length(extractor_version) between 1 and 120
                                  and extractor_version !~ '[[:cntrl:]]'),
  derived_at        timestamptz not null default now(),
  constraint course_source_derived_snapshot_source_fk foreign key (source_id, tenant_id)
    references public.course_sources(id, tenant_id) on delete cascade,
  unique (source_id, revision),
  unique (source_id, snapshot_sha256)
);

create index if not exists course_source_derived_snapshots_by_tenant
  on public.course_source_derived_snapshots (tenant_id, derived_at desc);
create index if not exists course_source_derived_snapshots_by_owner
  on public.course_source_derived_snapshots (owner_id, derived_at desc);
create index if not exists course_source_derived_snapshots_by_source_tenant
  on public.course_source_derived_snapshots (source_id, tenant_id);

alter table public.course_source_derived_snapshots enable row level security;
revoke all on table public.course_source_derived_snapshots from public, anon, authenticated, service_role;
grant select on table public.course_source_derived_snapshots to service_role;

drop trigger if exists keep_course_source_derived_snapshots on public.course_source_derived_snapshots;
create trigger keep_course_source_derived_snapshots before update or delete
  on public.course_source_derived_snapshots
  for each row execute function private.keep_course_source_history();

alter table public.course_source_operations
  drop constraint if exists course_source_operations_action_check;
alter table public.course_source_operations
  add constraint course_source_operations_action_check check (action in (
    'upload_planned', 'storage_received', 'scan_settled', 'snapshot_derived',
    'correction_confirmed', 'deletion_requested', 'restored',
    'conflicts_recorded', 'conflicts_voided', 'conflicts_applied', 'conflicts_rolled_back'));

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

  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_snapshot::text,
    want_source::text, want_actor::text, want_source_sha256, want_snapshot_sha256,
    want_extractor_version));
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

  -- Different idempotency keys may arrive concurrently for the same source.
  -- Serialize revision assignment so one cannot turn an otherwise valid
  -- receipt into a unique-constraint race.
  perform pg_advisory_xact_lock(hashtext(src.id::text || ':derived-revision'));
  select coalesce(max(d.revision), 0) + 1 into next_revision
    from public.course_source_derived_snapshots d where d.source_id = src.id;
  insert into public.course_source_derived_snapshots (
    id, source_id, tenant_id, owner_id, revision, source_sha256,
    snapshot_sha256, extractor_version
  ) values (
    want_snapshot, src.id, src.tenant_id, want_actor, next_revision, src.sha256,
    want_snapshot_sha256, want_extractor_version
  ) returning * into made;

  perform private.course_source_audit(want_actor, src.tenant_id, 'course_source.snapshot_derived',
    src.id, want_correlation, src.course_code, src.term, 'derived');
  insert into public.course_source_operations (
    tenant_id, actor_id, action, idempotency_key, request_sha256, source_id, result_json
  ) values (
    src.tenant_id, want_actor, 'snapshot_derived', want_idempotency, request_hash, src.id,
    jsonb_build_object('snapshotId', made.id, 'sourceId', src.id,
      'revision', made.revision, 'idempotent', false));
  return jsonb_build_object('snapshotId', made.id, 'sourceId', src.id,
    'revision', made.revision, 'idempotent', false);
end $$;

revoke all on function public.record_course_source_derived_snapshot(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.record_course_source_derived_snapshot(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;

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
  ) then
    raise exception 'The imported snapshot has no verified extraction receipt.' using errcode = '42501';
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

comment on table public.course_source_derived_snapshots is
  'Append-only hash-only receipts for private extractor output. No extracted course text is stored here.';
comment on function public.record_course_source_derived_snapshot(uuid, uuid, uuid, text, text, text, text, text) is
  'Service-only receipt for a named extractor result over one available, hash-settled student source. This function does not run or attest a deployed extractor.';
