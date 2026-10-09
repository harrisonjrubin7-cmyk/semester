-- Atomic application and recovery for a recorded course-source resolution.
--
-- The browser never calls these functions. The service supplies the exact
-- normalized imported CourseModule whose canonical jsonb hash was recorded in
-- the active resolution batch. The database reloads and hashes the current
-- course, derives the resolved document from the append-only choices, and
-- updates the existing public.courses row in the same transaction as audit and
-- idempotency evidence. Completion ticks live in public.state and are never
-- touched; stable course/item ids keep those relationships intact.

alter table public.course_source_resolution_batches
  drop constraint if exists course_source_resolution_batches_state_check,
  drop constraint if exists course_source_resolution_state;
alter table public.course_source_resolution_batches
  add constraint course_source_resolution_batches_state_check check (
    (state = 'recorded' and voided_at is null and voided_by is null)
    or (state in ('applied', 'rolled_back') and voided_at is null and voided_by is null)
    or (state = 'voided' and voided_at is not null and voided_by is not null));

create table if not exists public.course_source_resolution_applications (
  id                     uuid        primary key,
  batch_id               uuid        not null unique references public.course_source_resolution_batches(id) on delete cascade,
  tenant_id              text        not null references public.schools(id) on delete restrict,
  owner_id               uuid        not null references auth.users(id) on delete cascade,
  course_record_id       text        not null,
  previous_data          jsonb,
  previous_sha256        text        not null check (previous_sha256 ~ '^[0-9a-f]{64}$'),
  applied_sha256         text        not null check (applied_sha256 ~ '^[0-9a-f]{64}$'),
  state                  text        not null default 'applied' check (state in ('applied', 'rolled_back')),
  applied_at             timestamptz not null default now(),
  recovery_until         timestamptz not null default (now() + interval '30 days'),
  rolled_back_at         timestamptz,
  rolled_back_by         uuid references auth.users(id) on delete cascade,
  constraint course_source_resolution_application_state check (
    (state = 'applied' and previous_data is not null and rolled_back_at is null and rolled_back_by is null)
    or (state = 'rolled_back' and previous_data is null and rolled_back_at is not null and rolled_back_by is not null)),
  constraint course_source_resolution_application_recovery check (
    recovery_until = applied_at + interval '30 days')
);

create index if not exists course_source_resolution_applications_by_owner_course
  on public.course_source_resolution_applications (owner_id, course_record_id, applied_at desc);
create index if not exists course_source_resolution_applications_by_tenant
  on public.course_source_resolution_applications (tenant_id, applied_at desc);
create index if not exists course_source_resolution_applications_recovery_due
  on public.course_source_resolution_applications (recovery_until) where state = 'applied';
create index if not exists course_source_resolution_applications_by_rollback_actor
  on public.course_source_resolution_applications (rolled_back_by) where rolled_back_by is not null;

alter table public.course_source_resolution_applications enable row level security;
revoke all on table public.course_source_resolution_applications from public, anon, authenticated, service_role;
grant select on table public.course_source_resolution_applications to service_role;

alter table public.course_source_operations
  drop constraint if exists course_source_operations_action_check;
alter table public.course_source_operations
  add constraint course_source_operations_action_check check (action in (
    'upload_planned', 'storage_received', 'scan_settled',
    'correction_confirmed', 'deletion_requested', 'restored',
    'conflicts_recorded', 'conflicts_voided', 'conflicts_applied', 'conflicts_rolled_back'));
alter table public.course_source_operations
  add column if not exists resolution_application_id uuid
    references public.course_source_resolution_applications(id) on delete cascade;
alter table public.course_source_operations
  drop constraint if exists course_source_operations_subject_check;
alter table public.course_source_operations
  add constraint course_source_operations_subject_check check (
    (action = 'correction_confirmed') = (correction_id is not null)
    and (action in ('conflicts_recorded', 'conflicts_voided', 'conflicts_applied', 'conflicts_rolled_back'))
      = (resolution_batch_id is not null)
    and (action in ('conflicts_applied', 'conflicts_rolled_back'))
      = (resolution_application_id is not null));
create index if not exists course_source_operations_by_resolution_application
  on public.course_source_operations (resolution_application_id)
  where resolution_application_id is not null;

create or replace function private.course_source_resolution_item(
  items jsonb, want_id text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select value from jsonb_array_elements(items) where value->>'id' = want_id limit 1
$$;

create or replace function private.course_source_resolution_copy_key(
  target jsonb, source jsonb, key_name text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when source ? key_name
    then (target - key_name) || jsonb_build_object(key_name, source->key_name)
    else target - key_name end
$$;

create or replace function private.derive_course_source_resolution(
  want_batch uuid, current_data jsonb, imported_data jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  decision record;
  current_item jsonb;
  imported_item jsonb;
  resolved_item jsonb;
  resolved_items jsonb := imported_data->'items';
  resolved_course jsonb := imported_data->'course';
  current_course jsonb := current_data->'course';
  grading jsonb := imported_data->'course'->'grading';
  item_id text;
  field_name text;
  grading_name text;
begin
  if jsonb_typeof(current_data) <> 'object' or jsonb_typeof(imported_data) <> 'object'
     or jsonb_typeof(current_data->'course') <> 'object'
     or jsonb_typeof(imported_data->'course') <> 'object'
     or jsonb_typeof(current_data->'items') <> 'array'
     or jsonb_typeof(imported_data->'items') <> 'array'
     or jsonb_typeof(current_data->'course'->'grading') <> 'array'
     or jsonb_typeof(imported_data->'course'->'grading') <> 'array' then
    raise exception 'The course snapshots are not valid course modules.' using errcode = '22023';
  end if;
  if coalesce(current_course->>'id', '') = ''
     or imported_data->'course'->>'id' <> current_course->>'id'
     or imported_data->'course'->'term' is distinct from current_course->'term'
     or imported_data->'course'->'ai' is distinct from current_course->'ai'
     or exists (select 1 from jsonb_array_elements(current_data->'items') i
       where coalesce(i->>'id', '') = '' or i->>'c' <> current_course->>'id')
     or exists (select 1 from jsonb_array_elements(imported_data->'items') i
       where coalesce(i->>'id', '') = '' or i->>'c' <> current_course->>'id')
     or (select count(*) from jsonb_array_elements(current_data->'items')) <>
        (select count(distinct i->>'id') from jsonb_array_elements(current_data->'items') i)
     or (select count(*) from jsonb_array_elements(imported_data->'items')) <>
        (select count(distinct i->>'id') from jsonb_array_elements(imported_data->'items') i) then
    raise exception 'The imported course is not normalized to the current stable identities.' using errcode = '22023';
  end if;

  for decision in
    select conflict_key, choice from public.course_source_resolution_choices
      where batch_id = want_batch order by conflict_key
  loop
    if decision.conflict_key like 'field:%' then
      field_name := case substr(decision.conflict_key, 7)
        when 'Code' then 'code' when 'Name' then 'name' when 'Professor' then 'prof'
        when 'Their email' then 'email' when 'Meets' then 'meets' when 'Room' then 'room'
        when 'Credits' then 'credits' when 'Course site' then 'lms' end;
      if field_name is null
         or current_course->field_name is not distinct from imported_data->'course'->field_name then
        raise exception 'A recorded course-field conflict no longer matches the snapshots.' using errcode = '55000';
      end if;
      if decision.choice = 'keep_current' then
        resolved_course := private.course_source_resolution_copy_key(resolved_course, current_course, field_name);
      end if;
      continue;
    end if;

    if decision.conflict_key like 'grading:%' then
      grading_name := substr(decision.conflict_key, length(split_part(decision.conflict_key, ':', 1))
        + length(split_part(decision.conflict_key, ':', 2)) + 3);
      if decision.conflict_key like 'grading:reweighted:%' then
        if (select count(*) from jsonb_array_elements(current_course->'grading') r where r->>'what' = grading_name) <> 1
           or (select count(*) from jsonb_array_elements(imported_data->'course'->'grading') r where r->>'what' = grading_name) <> 1
           or (select r->>'pct' from jsonb_array_elements(current_course->'grading') r where r->>'what' = grading_name)
              is not distinct from
              (select r->>'pct' from jsonb_array_elements(imported_data->'course'->'grading') r where r->>'what' = grading_name) then
          raise exception 'A recorded grading conflict no longer matches the snapshots.' using errcode = '55000';
        end if;
        if decision.choice = 'keep_current' then
          grading := (select jsonb_agg(case when r->>'what' = grading_name then
            jsonb_set(r, '{pct}', to_jsonb((select c->>'pct' from jsonb_array_elements(current_course->'grading') c
              where c->>'what' = grading_name))) else r end order by ord)
            from jsonb_array_elements(grading) with ordinality as rows(r, ord));
        end if;
      elsif decision.conflict_key like 'grading:added:%' then
        if exists (select 1 from jsonb_array_elements(current_course->'grading') r where r->>'what' = grading_name)
           or not exists (select 1 from jsonb_array_elements(imported_data->'course'->'grading') r where r->>'what' = grading_name) then
          raise exception 'A recorded added grading row no longer matches the snapshots.' using errcode = '55000';
        end if;
        if decision.choice = 'keep_current' then
          grading := coalesce((select jsonb_agg(r order by ord) from jsonb_array_elements(grading)
            with ordinality as rows(r, ord) where r->>'what' <> grading_name), '[]'::jsonb);
        end if;
      elsif decision.conflict_key like 'grading:removed:%' then
        if not exists (select 1 from jsonb_array_elements(current_course->'grading') r where r->>'what' = grading_name)
           or exists (select 1 from jsonb_array_elements(imported_data->'course'->'grading') r where r->>'what' = grading_name) then
          raise exception 'A recorded removed grading row no longer matches the snapshots.' using errcode = '55000';
        end if;
        if decision.choice = 'keep_current' then
          grading := grading || jsonb_build_array((select r from jsonb_array_elements(current_course->'grading') r
            where r->>'what' = grading_name));
        end if;
      end if;
      continue;
    end if;

    item_id := substr(decision.conflict_key, strpos(decision.conflict_key, ':') + 1);
    current_item := private.course_source_resolution_item(current_data->'items', item_id);
    imported_item := private.course_source_resolution_item(imported_data->'items', item_id);
    if current_item is null then
      raise exception 'A recorded item conflict no longer matches the current course.' using errcode = '55000';
    end if;
    if decision.conflict_key like 'removed:%' then
      if imported_item is not null then
        raise exception 'A recorded removed item still exists in the imported snapshot.' using errcode = '55000';
      end if;
      if decision.choice = 'keep_current' then resolved_items := resolved_items || jsonb_build_array(current_item); end if;
      continue;
    end if;
    if imported_item is null then
      raise exception 'A paired imported item is missing its stable current id.' using errcode = '55000';
    end if;
    -- Choices for one item are independent and ordered by conflict key. Start
    -- from the value already derived so a title choice cannot erase an earlier
    -- date/provenance choice (or vice versa).
    resolved_item := private.course_source_resolution_item(resolved_items, item_id);
    if decision.conflict_key like 'moved:%' then
      if jsonb_build_array(current_item->'year', current_item->'month', current_item->'day')
         is not distinct from jsonb_build_array(imported_item->'year', imported_item->'month', imported_item->'day') then
        raise exception 'A recorded moved-date conflict no longer differs.' using errcode = '55000';
      end if;
      if decision.choice = 'keep_current' then
        resolved_item := private.course_source_resolution_copy_key(resolved_item, current_item, 'year');
        resolved_item := private.course_source_resolution_copy_key(resolved_item, current_item, 'month');
        resolved_item := private.course_source_resolution_copy_key(resolved_item, current_item, 'day');
      end if;
    elsif decision.conflict_key like 'provenance:%' then
      if jsonb_build_array(current_item->'quote', current_item->'source', current_item->'checked')
         is not distinct from jsonb_build_array(imported_item->'quote', imported_item->'source', imported_item->'checked') then
        raise exception 'A recorded provenance conflict no longer differs.' using errcode = '55000';
      end if;
      if decision.choice = 'keep_current' then
        resolved_item := private.course_source_resolution_copy_key(resolved_item, current_item, 'quote');
        resolved_item := private.course_source_resolution_copy_key(resolved_item, current_item, 'source');
        resolved_item := private.course_source_resolution_copy_key(resolved_item, current_item, 'checked');
      end if;
    else
      field_name := case split_part(decision.conflict_key, ':', 1)
        when 'title' then 'title' when 'time' then 'dueTime' when 'kind' then 'kind'
        when 'weight' then 'weight' when 'where' then 'where' when 'detail' then 'detail' end;
      if field_name is null or current_item->field_name is not distinct from imported_item->field_name then
        raise exception 'A recorded item-field conflict no longer differs.' using errcode = '55000';
      end if;
      if decision.choice = 'keep_current' then
        resolved_item := private.course_source_resolution_copy_key(resolved_item, current_item, field_name);
      end if;
    end if;
    resolved_items := (select jsonb_agg(case when r->>'id' = item_id then resolved_item else r end order by ord)
      from jsonb_array_elements(resolved_items) with ordinality as rows(r, ord));
  end loop;

  if exists (
    select 1 from jsonb_array_elements(current_data->'items') current_row
     where private.course_source_resolution_item(resolved_items, current_row->>'id') is null
       and not exists (
         select 1 from public.course_source_resolution_choices choice
          where choice.batch_id = want_batch
            and choice.conflict_key = 'removed:' || (current_row->>'id')
            and choice.choice = 'use_imported')) then
    raise exception 'The resolved course would discard a stable current item without approval.' using errcode = '55000';
  end if;

  resolved_course := jsonb_set(resolved_course, '{grading}', grading);
  return jsonb_set(jsonb_set(imported_data, '{course}', resolved_course), '{items}', resolved_items);
end $$;

revoke all on function private.course_source_resolution_item(jsonb, text) from public, anon, authenticated, service_role;
revoke all on function private.course_source_resolution_copy_key(jsonb, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function private.derive_course_source_resolution(uuid, jsonb, jsonb) from public, anon, authenticated, service_role;

create or replace function public.apply_course_source_conflict_resolution(
  want_application uuid, want_batch uuid, want_actor uuid, want_imported_snapshot jsonb,
  want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  batch public.course_source_resolution_batches;
  current_source public.course_sources;
  imported_source public.course_sources;
  current_course public.courses;
  prior public.course_source_operations;
  made public.course_source_resolution_applications;
  request_hash text;
  current_hash text;
  imported_hash text;
  applied_data jsonb;
  applied_hash text;
begin
  perform private.course_source_service();
  if want_application is null or want_batch is null or want_actor is null
     or jsonb_typeof(want_imported_snapshot) <> 'object'
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The conflict-resolution apply request is incomplete.' using errcode = '22023';
  end if;
  select * into batch from public.course_source_resolution_batches b where b.id = want_batch for update;
  if not found or batch.owner_id <> want_actor then
    raise exception 'The conflict resolution was not found.' using errcode = '42501';
  end if;
  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_application::text,
    want_batch::text, want_actor::text, want_imported_snapshot::text));
  perform pg_advisory_xact_lock(hashtext(batch.tenant_id || ':' || want_actor::text
    || ':conflicts_applied:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = batch.tenant_id and o.actor_id = want_actor
     and o.action = 'conflicts_applied' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different apply request.' using errcode = '22023';
    end if;
    select * into made from public.course_source_resolution_applications a
      where a.id = prior.resolution_application_id;
    return prior.result_json || jsonb_build_object('state', made.state, 'idempotent', true);
  end if;
  if batch.state <> 'recorded' then
    raise exception 'That conflict resolution is no longer active.' using errcode = '55000';
  end if;
  if not private.course_source_relationship(want_actor, batch.tenant_id,
       batch.membership_id, batch.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;
  perform 1 from public.course_sources s where s.id in (batch.current_source_id, batch.imported_source_id)
    order by s.id for update;
  select * into current_source from public.course_sources where id = batch.current_source_id;
  select * into imported_source from public.course_sources where id = batch.imported_source_id;
  if current_source.lifecycle_state <> 'available' or imported_source.lifecycle_state <> 'available'
     or current_source.owner_id <> batch.owner_id or imported_source.owner_id <> batch.owner_id
     or current_source.tenant_id <> batch.tenant_id or imported_source.tenant_id <> batch.tenant_id
     or current_source.membership_id <> batch.membership_id or imported_source.membership_id <> batch.membership_id
     or current_source.course_record_id <> batch.course_record_id or imported_source.course_record_id <> batch.course_record_id
     or current_source.course_code <> imported_source.course_code or current_source.term <> imported_source.term then
    raise exception 'The source pair is no longer valid for this course.' using errcode = '42501';
  end if;
  select * into current_course from public.courses c
    where c.user_id = want_actor and c.id = batch.course_record_id and c.deleted_at is null for update;
  if not found then raise exception 'The current course was not found.' using errcode = '42501'; end if;
  current_hash := private.role_audit_sha256(current_course.data::text);
  imported_hash := private.role_audit_sha256(want_imported_snapshot::text);
  if current_hash <> batch.current_snapshot_sha256 or imported_hash <> batch.imported_snapshot_sha256 then
    raise exception 'The course snapshots changed after the choices were recorded.' using errcode = '40001';
  end if;
  applied_data := private.derive_course_source_resolution(batch.id, current_course.data, want_imported_snapshot);
  if applied_data->'course'->>'id' <> batch.course_record_id
     or exists (select 1 from jsonb_array_elements(applied_data->'items') i
       where i->>'c' <> batch.course_record_id) then
    raise exception 'The resolved course does not preserve its stable identity.' using errcode = '22023';
  end if;
  applied_hash := private.role_audit_sha256(applied_data::text);
  insert into public.course_source_resolution_applications (
    id, batch_id, tenant_id, owner_id, course_record_id, previous_data,
    previous_sha256, applied_sha256
  ) values (
    want_application, batch.id, batch.tenant_id, want_actor, batch.course_record_id,
    current_course.data, current_hash, applied_hash
  ) returning * into made;
  update public.courses set data = applied_data where user_id = want_actor and id = batch.course_record_id;
  update public.course_source_resolution_batches set state = 'applied' where id = batch.id;
  perform private.course_source_audit(want_actor, batch.tenant_id, 'course_source.conflicts_applied',
    batch.imported_source_id, want_correlation, imported_source.course_code, imported_source.term, 'applied');
  insert into public.course_source_operations (
    tenant_id, actor_id, action, idempotency_key, request_sha256, source_id,
    resolution_batch_id, resolution_application_id, result_json
  ) values (
    batch.tenant_id, want_actor, 'conflicts_applied', want_idempotency, request_hash,
    batch.imported_source_id, batch.id, made.id,
    jsonb_build_object('applicationId', made.id, 'resolutionId', batch.id,
      'state', made.state, 'recoveryUntil', made.recovery_until, 'idempotent', false));
  return jsonb_build_object('applicationId', made.id, 'resolutionId', batch.id,
    'state', made.state, 'recoveryUntil', made.recovery_until, 'idempotent', false);
end $$;

create or replace function public.rollback_course_source_conflict_resolution(
  want_application uuid, want_actor uuid, want_idempotency text, want_correlation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  application public.course_source_resolution_applications;
  batch public.course_source_resolution_batches;
  current_course public.courses;
  source public.course_sources;
  prior public.course_source_operations;
  request_hash text;
begin
  perform private.course_source_service();
  if want_application is null or want_actor is null
     or want_idempotency !~ '^[A-Za-z0-9_.:-]{16,128}$'
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,100}$' then
    raise exception 'The conflict-resolution rollback is incomplete.' using errcode = '22023';
  end if;
  select * into application from public.course_source_resolution_applications a
    where a.id = want_application for update;
  if not found or application.owner_id <> want_actor then
    raise exception 'The applied conflict resolution was not found.' using errcode = '42501';
  end if;
  select * into batch from public.course_source_resolution_batches b where b.id = application.batch_id for update;
  request_hash := private.role_audit_sha256(concat_ws(chr(31), want_application::text, want_actor::text, 'rollback'));
  perform pg_advisory_xact_lock(hashtext(application.tenant_id || ':' || want_actor::text
    || ':conflicts_rolled_back:' || want_idempotency));
  select * into prior from public.course_source_operations o
   where o.tenant_id = application.tenant_id and o.actor_id = want_actor
     and o.action = 'conflicts_rolled_back' and o.idempotency_key = want_idempotency;
  if found then
    if prior.request_sha256 <> request_hash then
      raise exception 'That idempotency key was already used for a different rollback.' using errcode = '22023';
    end if;
    return prior.result_json || jsonb_build_object('idempotent', true);
  end if;
  if application.state <> 'applied' or batch.state <> 'applied' or now() > application.recovery_until then
    raise exception 'That applied resolution is not recoverable.' using errcode = '55000';
  end if;
  if not private.course_source_relationship(want_actor, application.tenant_id,
       batch.membership_id, application.course_record_id) then
    raise exception 'The current course relationship could not be verified.' using errcode = '42501';
  end if;
  select * into current_course from public.courses c
    where c.user_id = want_actor and c.id = application.course_record_id and c.deleted_at is null for update;
  if not found or private.role_audit_sha256(current_course.data::text) <> application.applied_sha256 then
    raise exception 'The course changed after this resolution was applied.' using errcode = '40001';
  end if;
  select * into source from public.course_sources s where s.id = batch.imported_source_id;
  update public.courses set data = application.previous_data
    where user_id = want_actor and id = application.course_record_id;
  update public.course_source_resolution_applications set
    state = 'rolled_back', previous_data = null, rolled_back_at = now(), rolled_back_by = want_actor
    where id = application.id returning * into application;
  update public.course_source_resolution_batches set state = 'rolled_back' where id = batch.id;
  perform private.course_source_audit(want_actor, application.tenant_id, 'course_source.conflicts_rolled_back',
    batch.imported_source_id, want_correlation, source.course_code, source.term, 'rolled_back');
  insert into public.course_source_operations (
    tenant_id, actor_id, action, idempotency_key, request_sha256, source_id,
    resolution_batch_id, resolution_application_id, result_json
  ) values (
    application.tenant_id, want_actor, 'conflicts_rolled_back', want_idempotency, request_hash,
    batch.imported_source_id, batch.id, application.id,
    jsonb_build_object('applicationId', application.id, 'resolutionId', batch.id,
      'state', application.state, 'idempotent', false));
  return jsonb_build_object('applicationId', application.id, 'resolutionId', batch.id,
    'state', application.state, 'idempotent', false);
end $$;

revoke all on function public.apply_course_source_conflict_resolution(uuid, uuid, uuid, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.rollback_course_source_conflict_resolution(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.apply_course_source_conflict_resolution(uuid, uuid, uuid, jsonb, text, text)
  to service_role;
grant execute on function public.rollback_course_source_conflict_resolution(uuid, uuid, text, text)
  to service_role;

comment on table public.course_source_resolution_applications is
  'Private 30-day recovery evidence for one atomic application of a student-approved re-import resolution. The prior course document is cleared on rollback.';
comment on function public.apply_course_source_conflict_resolution(uuid, uuid, uuid, jsonb, text, text) is
  'Service-only atomic course replacement derived from an active, hash-bound resolution batch after current relationship and source revalidation.';
comment on function public.rollback_course_source_conflict_resolution(uuid, uuid, text, text) is
  'Service-only idempotent recovery of an applied resolution, only while the 30-day copy is live and the course has not changed again.';
