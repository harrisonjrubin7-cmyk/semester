-- Durable evidence for student-approved course-source conflict decisions.
--
-- This records a complete decision map for two available, student-owned
-- course sources. It does not apply the imported course, expose source bytes,
-- or make the browser a database authority. A later server-side apply command
-- must bind to the recorded snapshot hashes and recheck the relationship.

create table if not exists public.course_source_resolution_batches (
  id                       uuid        primary key,
  tenant_id                text        not null references public.schools(id) on delete restrict,
  owner_id                 uuid        not null references auth.users(id) on delete cascade,
  membership_id            uuid        not null,
  course_record_id         text        not null,
  current_source_id        uuid        not null,
  imported_source_id       uuid        not null,
  current_snapshot_sha256  text        not null check (current_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  imported_snapshot_sha256 text        not null check (imported_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  decision_count           integer     not null check (decision_count between 1 and 256),
  state                    text        not null default 'recorded' check (state in ('recorded', 'voided')),
  recorded_at              timestamptz not null default now(),
  voided_at                timestamptz,
  voided_by                uuid,
  unique (id, tenant_id),
  constraint course_source_resolution_membership_fk foreign key (membership_id, tenant_id)
    references public.institution_membership (id, tenant_id) on delete restrict,
  constraint course_source_resolution_current_fk foreign key (current_source_id, tenant_id)
    references public.course_sources (id, tenant_id) on delete cascade,
  constraint course_source_resolution_imported_fk foreign key (imported_source_id, tenant_id)
    references public.course_sources (id, tenant_id) on delete cascade,
  constraint course_source_resolution_voider_fk foreign key (voided_by)
    references auth.users(id) on delete cascade,
  constraint course_source_resolution_distinct_sources check (current_source_id <> imported_source_id),
  constraint course_source_resolution_distinct_snapshots check (
    current_snapshot_sha256 <> imported_snapshot_sha256),
  constraint course_source_resolution_state check (
    (state = 'recorded' and voided_at is null and voided_by is null)
    or (state = 'voided' and voided_at is not null and voided_by is not null))
);

create table if not exists public.course_source_resolution_choices (
  batch_id     uuid        not null,
  tenant_id    text        not null references public.schools(id) on delete restrict,
  conflict_key text        not null check (
    conflict_key ~ '^(removed|moved|title|time|kind|weight|where|detail|provenance):[^[:cntrl:]]{1,200}$'
    or conflict_key ~ '^field:(Code|Name|Professor|Their email|Meets|Room|Credits|Course site)$'
    or conflict_key ~ '^grading:(reweighted|removed|added):[^[:cntrl:]]{1,160}$'),
  choice        text        not null check (choice in ('keep_current', 'use_imported')),
  recorded_at   timestamptz not null default now(),
  primary key (batch_id, conflict_key),
  constraint course_source_resolution_choice_batch_fk foreign key (batch_id, tenant_id)
    references public.course_source_resolution_batches (id, tenant_id) on delete cascade
);

create index if not exists course_source_resolution_batches_by_owner_course
  on public.course_source_resolution_batches (owner_id, course_record_id, recorded_at desc);
create index if not exists course_source_resolution_batches_by_source_pair
  on public.course_source_resolution_batches (current_source_id, imported_source_id, recorded_at desc);
create index if not exists course_source_resolution_batches_by_current_tenant
  on public.course_source_resolution_batches (current_source_id, tenant_id);
create index if not exists course_source_resolution_batches_by_imported_tenant
  on public.course_source_resolution_batches (imported_source_id, tenant_id);
create index if not exists course_source_resolution_batches_by_membership_tenant
  on public.course_source_resolution_batches (membership_id, tenant_id);
create index if not exists course_source_resolution_batches_by_voider
  on public.course_source_resolution_batches (voided_by) where voided_by is not null;
create index if not exists course_source_resolution_batches_by_tenant
  on public.course_source_resolution_batches (tenant_id, recorded_at desc);
create index if not exists course_source_resolution_choices_by_batch_tenant
  on public.course_source_resolution_choices (batch_id, tenant_id);
create index if not exists course_source_resolution_choices_by_tenant
  on public.course_source_resolution_choices (tenant_id);

alter table public.course_source_resolution_batches enable row level security;
alter table public.course_source_resolution_choices enable row level security;

-- No browser policy exists. The service can inspect the evidence but every
-- mutation must pass through the two controlled functions below.
revoke all on table public.course_source_resolution_batches from public, anon, authenticated, service_role;
revoke all on table public.course_source_resolution_choices from public, anon, authenticated, service_role;
grant select on table public.course_source_resolution_batches to service_role;
grant select on table public.course_source_resolution_choices to service_role;

create or replace function private.keep_course_source_resolution_choices()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Course-source conflict choices are append-only.' using errcode = '42501';
end $$;

revoke all on function private.keep_course_source_resolution_choices() from public, anon, authenticated, service_role;

drop trigger if exists keep_course_source_resolution_choices on public.course_source_resolution_choices;
create trigger keep_course_source_resolution_choices before update or delete on public.course_source_resolution_choices
  for each row execute function private.keep_course_source_resolution_choices();

alter table public.course_source_operations
  drop constraint if exists course_source_operations_action_check;
alter table public.course_source_operations
  add constraint course_source_operations_action_check check (action in (
    'upload_planned', 'storage_received', 'scan_settled',
    'correction_confirmed', 'deletion_requested', 'restored',
    'conflicts_recorded', 'conflicts_voided'));
alter table public.course_source_operations
  add column if not exists resolution_batch_id uuid references public.course_source_resolution_batches(id) on delete cascade;
alter table public.course_source_operations
  drop constraint if exists course_source_operations_check;
alter table public.course_source_operations
  drop constraint if exists course_source_operations_subject_check;
alter table public.course_source_operations
  add constraint course_source_operations_subject_check check (
    (action = 'correction_confirmed') = (correction_id is not null)
    and (action in ('conflicts_recorded', 'conflicts_voided')) = (resolution_batch_id is not null));
create index if not exists course_source_operations_by_resolution
  on public.course_source_operations (resolution_batch_id)
  where resolution_batch_id is not null;

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

  -- Lock in UUID order so concurrent resolutions over the same pair cannot
  -- deadlock or observe a lifecycle transition between relationship checks.
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

create or replace function public.void_course_source_conflict_resolution(
  want_batch uuid, want_actor uuid, want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  batch public.course_source_resolution_batches;
  source public.course_sources;
  prior public.course_source_operations;
  request_hash text;
begin
  perform private.course_source_service();
  if want_batch is null or want_actor is null
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The conflict-resolution withdrawal is incomplete.' using errcode = '22023';
  end if;
  select * into batch from public.course_source_resolution_batches b where b.id = want_batch for update;
  if not found or batch.owner_id <> want_actor then
    raise exception 'The conflict resolution was not found.' using errcode = '42501';
  end if;
  if not private.course_source_relationship(want_actor, batch.tenant_id,
       batch.membership_id, batch.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;
  select * into source from public.course_sources s where s.id = batch.imported_source_id;

  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_batch::text, want_actor::text, 'void'));
  perform pg_advisory_xact_lock(hashtext(batch.tenant_id || ':' || want_actor::text
    || ':conflicts_voided:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = batch.tenant_id and o.actor_id = want_actor
     and o.action = 'conflicts_voided' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different withdrawal.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;
  if batch.state <> 'recorded' then
    raise exception 'That conflict resolution is no longer active.' using errcode = '55000';
  end if;

  update public.course_source_resolution_batches set
    state = 'voided', voided_at = now(), voided_by = want_actor
  where id = batch.id returning * into batch;
  perform private.course_source_audit(want_actor, batch.tenant_id, 'course_source.conflicts_voided',
    batch.imported_source_id, want_correlation, source.course_code, source.term, 'voided');
  insert into public.course_source_operations (
    tenant_id, actor_id, action, idempotency_key, request_sha256,
    source_id, resolution_batch_id, result_json
  ) values (
    batch.tenant_id, want_actor, 'conflicts_voided', want_idempotency, request_hash,
    batch.imported_source_id, batch.id,
    jsonb_build_object('resolutionId', batch.id, 'state', batch.state, 'idempotent', false));
  return jsonb_build_object('resolutionId', batch.id, 'state', batch.state, 'idempotent', false);
end $$;

revoke all on function public.record_course_source_conflict_resolution(uuid, uuid, uuid, uuid, text, text, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.void_course_source_conflict_resolution(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_course_source_conflict_resolution(uuid, uuid, uuid, uuid, text, text, jsonb, text, text)
  to service_role;
grant execute on function public.void_course_source_conflict_resolution(uuid, uuid, text, text)
  to service_role;

comment on table public.course_source_resolution_batches is
  'Private, hash-bound evidence that a student selected every value in one course-source re-import comparison. Recording does not apply the course.';
comment on table public.course_source_resolution_choices is
  'Append-only conflict keys and keep-current/use-imported choices. Source values and extracted text are not stored.';
comment on function public.record_course_source_conflict_resolution(uuid, uuid, uuid, uuid, text, text, jsonb, text, text) is
  'Service-only, idempotent recording of a complete client-validated decision map after independently rechecking both source records and the current student relationship.';
comment on function public.void_course_source_conflict_resolution(uuid, uuid, text, text) is
  'Service-only, idempotent withdrawal of an unapplied conflict decision batch. Choice history remains append-only.';
