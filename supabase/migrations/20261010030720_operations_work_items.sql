-- The single durable operations inbox shared by company and institution views.
--
-- This is source only until an operator explicitly approves and applies it to
-- a Supabase project. It creates no grants, tenants, schedules or live worker.

create table if not exists private.work_item (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text not null references public.schools(id) on delete cascade,
  kind                text not null check (kind ~ '^[a-z][a-z0-9_.:-]{2,99}$'),
  subject_type        text not null check (subject_type ~ '^[a-z][a-z0-9_.:-]{2,99}$'),
  subject_id          text not null check (length(trim(subject_id)) between 1 and 200),
  source_ref          text not null check (length(trim(source_ref)) between 1 and 500),
  purpose             text not null check (length(trim(purpose)) between 1 and 500),
  priority            text not null check (priority in ('normal', 'high', 'urgent')),
  required_capability text not null references public.app_capabilities(capability) on delete restrict,
  state               text not null check (state in ('open', 'claimed', 'resolved')),
  assigned_to         uuid,
  resolution_code     text,
  resolution_summary  text,
  receipt_ref         text,
  version             bigint not null check (version >= 1),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint work_item_source_once unique (tenant_id, kind, source_ref),
  constraint work_item_state_shape check (
    (state = 'open' and assigned_to is null and resolution_code is null
      and resolution_summary is null and receipt_ref is null)
    or (state = 'claimed' and assigned_to is not null and resolution_code is null
      and resolution_summary is null and receipt_ref is null)
    or (state = 'resolved' and assigned_to is not null
      and length(trim(resolution_code)) between 1 and 80
      and length(trim(resolution_summary)) between 1 and 500
      and length(trim(receipt_ref)) between 1 and 300)
  ),
  constraint work_item_time_order check (updated_at >= created_at)
);

create index if not exists work_item_inbox
  on private.work_item (tenant_id, state, priority, updated_at desc, id);
create index if not exists work_item_assignee
  on private.work_item (assigned_to, state, updated_at desc)
  where assigned_to is not null;
create index if not exists work_item_capability
  on private.work_item (required_capability);

create table if not exists private.work_item_event (
  id                 bigint generated always as identity primary key,
  work_item_id       uuid not null references private.work_item(id) on delete cascade,
  tenant_id          text not null references public.schools(id) on delete cascade,
  version            bigint not null check (version >= 1),
  action             text not null check (action in ('opened', 'claimed', 'resolved', 'reopened')),
  actor_id            uuid,
  occurred_at         timestamptz not null default now(),
  reason              text,
  resolution_code     text,
  resolution_summary  text,
  receipt_ref         text,
  unique (work_item_id, version),
  constraint work_item_event_shape check (
    (action = 'opened' and version = 1 and reason is null and resolution_code is null
      and resolution_summary is null and receipt_ref is null)
    or (action = 'claimed' and actor_id is not null and reason is null
      and resolution_code is null and resolution_summary is null and receipt_ref is null)
    or (action = 'resolved' and actor_id is not null and reason is null
      and length(trim(resolution_code)) between 1 and 80
      and length(trim(resolution_summary)) between 1 and 500
      and length(trim(receipt_ref)) between 1 and 300)
    or (action = 'reopened' and actor_id is not null
      and length(trim(reason)) between 1 and 500
      and resolution_code is null and resolution_summary is null and receipt_ref is null)
  )
);

create index if not exists work_item_event_history
  on private.work_item_event (work_item_id, version);
create index if not exists work_item_event_tenant
  on private.work_item_event (tenant_id);

alter table private.work_item enable row level security;
alter table private.work_item_event enable row level security;
revoke all on table private.work_item from public, anon, authenticated;
revoke all on table private.work_item_event from public, anon, authenticated;
revoke all on sequence private.work_item_event_id_seq from public, anon, authenticated;
grant select on table private.work_item to service_role;
grant select on table private.work_item_event to service_role;

create or replace function private.refuse_work_item_event_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Work-item receipt history is immutable.' using errcode = '23000';
end $$;
revoke all on function private.refuse_work_item_event_change() from public, anon, authenticated;

drop trigger if exists work_item_event_immutable on private.work_item_event;
create trigger work_item_event_immutable
  before update on private.work_item_event
  for each row execute function private.refuse_work_item_event_change();

create or replace function private.work_item_allowed(want_tenant text, want_capability text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and private.has_capability('console:operate', 'platform', '')
     and private.has_capability(want_capability, 'school', want_tenant);
$$;
revoke all on function private.work_item_allowed(text, text) from public, anon, authenticated;

create or replace function private.work_item_json(want uuid, include_history boolean default false)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', w.id,
    'tenant_id', w.tenant_id,
    'kind', w.kind,
    'subject', jsonb_build_object('type', w.subject_type, 'id', w.subject_id),
    'source_ref', w.source_ref,
    'purpose', w.purpose,
    'priority', w.priority,
    'state', w.state,
    'version', w.version,
    'created_at', w.created_at,
    'updated_at', w.updated_at,
    'assigned_to_me', w.assigned_to is not null and w.assigned_to = auth.uid(),
    'resolution', case when w.state = 'resolved' then jsonb_build_object(
      'code', w.resolution_code,
      'summary', w.resolution_summary,
      'receipt_ref', w.receipt_ref
    ) end,
    'allowed_actions', to_jsonb(array_remove(array[
      case when w.state = 'open' then 'claim' end,
      case when w.state = 'claimed' and w.assigned_to = auth.uid() then 'resolve' end,
      case when w.state = 'resolved' then 'reopen' end
    ], null)),
    'history', case when include_history then coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'action', e.action,
        'version', e.version,
        'occurred_at', e.occurred_at,
        'by_me', e.actor_id is not null and e.actor_id = auth.uid(),
        'reason', e.reason,
        'resolution', case when e.action = 'resolved' then jsonb_build_object(
          'code', e.resolution_code,
          'summary', e.resolution_summary,
          'receipt_ref', e.receipt_ref
        ) end
      )) order by e.version)
      from private.work_item_event e where e.work_item_id = w.id
    ), '[]'::jsonb) end
  )) from private.work_item w where w.id = want;
$$;
revoke all on function private.work_item_json(uuid, boolean) from public, anon, authenticated;

create or replace function private.open_work_item(
  want_tenant text,
  want_kind text,
  want_subject_type text,
  want_subject_id text,
  want_source_ref text,
  want_purpose text,
  want_priority text default 'normal',
  want_required_capability text default 'tenant:implement',
  want_correlation text default null
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  made uuid;
  existing private.work_item;
  correlation text := coalesce(want_correlation, 'work-item:' || gen_random_uuid()::text);
begin
  if want_tenant is null or want_kind is null or want_subject_type is null
     or want_subject_id is null or want_source_ref is null or want_purpose is null
     or want_priority not in ('normal', 'high', 'urgent')
     or length(trim(want_subject_id)) not between 1 and 200
     or length(trim(want_source_ref)) not between 1 and 500
     or length(trim(want_purpose)) not between 1 and 500
     or correlation !~ '^[A-Za-z0-9._:-]{8,128}$' then
    raise exception 'The work-item producer envelope is malformed.' using errcode = '22023';
  end if;

  insert into private.work_item (
    tenant_id, kind, subject_type, subject_id, source_ref, purpose, priority,
    required_capability, state, version
  ) values (
    want_tenant, want_kind, want_subject_type, want_subject_id, want_source_ref,
    want_purpose, want_priority, want_required_capability, 'open', 1
  ) on conflict (tenant_id, kind, source_ref) do nothing
  returning id into made;

  if made is null then
    select * into strict existing from private.work_item w
     where w.tenant_id = want_tenant and w.kind = want_kind and w.source_ref = want_source_ref;
    if existing.subject_type is distinct from want_subject_type
       or existing.subject_id is distinct from want_subject_id
       or existing.purpose is distinct from want_purpose
       or existing.priority is distinct from want_priority
       or existing.required_capability is distinct from want_required_capability then
      raise exception 'The work-item source key already names a different envelope.'
        using errcode = '22023';
    end if;
    return existing.id;
  end if;

  insert into private.work_item_event (work_item_id, tenant_id, version, action, actor_id)
  values (made, want_tenant, 1, 'opened', auth.uid());

  perform private.emit_domain_event(
    'work_item', made::text, 'work_item.opened', 1, want_tenant,
    'operations-work-items', correlation, 'work-item:' || made::text || ':v1',
    jsonb_build_object('workItemId', made, 'kind', want_kind, 'state', 'open', 'version', 1),
    'internal', 'operational'
  );
  perform private.record_audit(
    want_tenant, 'work_item.opened', 'work_item', made::text, 'allowed', correlation,
    jsonb_build_object('kind', want_kind, 'required_capability', want_required_capability)
  );
  return made;
end $$;

revoke all on function private.open_work_item(text,text,text,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function private.open_work_item(text,text,text,text,text,text,text,text,text)
  to service_role;

create or replace function public.ops_operations_inbox(
  want_item uuid default null,
  want_mine boolean default false
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  hit private.work_item;
  data jsonb;
begin
  if me is null or not private.has_capability('console:operate', 'platform', '') then
    raise exception 'console:operate at platform scope is required.' using errcode = '42501';
  end if;

  if want_item is not null then
    select * into hit from private.work_item w where w.id = want_item;
    if not found then
      raise exception 'The work item is unavailable in this grant scope.' using errcode = '42501';
    end if;
    if not private.work_item_allowed(hit.tenant_id, hit.required_capability) then
      raise exception 'The work item is unavailable in this grant scope.' using errcode = '42501';
    end if;
    data := private.work_item_json(hit.id, true);
    perform private.record_audit(hit.tenant_id, 'work_item.read', 'work_item', hit.id::text, 'allowed');
  else
    select coalesce(jsonb_agg(private.work_item_json(w.id, false) order by
      case w.priority when 'urgent' then 1 when 'high' then 2 else 3 end,
      w.updated_at desc, w.id), '[]'::jsonb)
      into data
      from private.work_item w
     where private.work_item_allowed(w.tenant_id, w.required_capability)
       and (not want_mine or w.assigned_to = me);
    perform private.record_audit(null, 'work_item.inbox_read', 'work_item', null, 'allowed', null,
      jsonb_build_object('mine', want_mine));
  end if;

  return jsonb_build_object(
    'data', data,
    'freshness', jsonb_build_object('status', 'current', 'generated_at', now()),
    'authority', 'authoritative',
    'warnings', '[]'::jsonb,
    'request_id', gen_random_uuid()
  );
end $$;

create or replace function public.ops_transition_work_item(
  want_item uuid,
  want_action text,
  want_version bigint,
  want_reason text default null,
  want_resolution_code text default null,
  want_resolution_summary text default null,
  want_receipt_ref text default null
)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  current private.work_item;
  changed private.work_item;
  correlation text;
begin
  if want_item is null or want_version is null or want_version < 1
     or want_action is null or want_action not in ('claim', 'resolve', 'reopen') then
    raise exception 'The work-item transition envelope is malformed.' using errcode = '22023';
  end if;
  select * into current from private.work_item w where w.id = want_item;
  if not found then
    raise exception 'The work item is unavailable in this grant scope.' using errcode = '42501';
  end if;
  if not private.work_item_allowed(current.tenant_id, current.required_capability) then
    raise exception 'The work item is unavailable in this grant scope.' using errcode = '42501';
  end if;

  if want_action = 'claim' then
    update private.work_item w set state = 'claimed', assigned_to = me,
      version = w.version + 1, updated_at = now()
     where w.id = want_item and w.version = want_version and w.state = 'open'
     returning w.* into changed;
  elsif want_action = 'resolve' then
    if current.assigned_to is distinct from me then
      raise exception 'Only the assignee may resolve this work item.' using errcode = '42501';
    end if;
    if length(trim(coalesce(want_resolution_code, ''))) not between 1 and 80
       or length(trim(coalesce(want_resolution_summary, ''))) not between 1 and 500
       or length(trim(coalesce(want_receipt_ref, ''))) not between 1 and 300 then
      raise exception 'Resolution needs a bounded code, summary and receipt reference.' using errcode = '22023';
    end if;
    update private.work_item w set state = 'resolved',
      resolution_code = want_resolution_code,
      resolution_summary = want_resolution_summary,
      receipt_ref = want_receipt_ref,
      version = w.version + 1, updated_at = now()
     where w.id = want_item and w.version = want_version
       and w.state = 'claimed' and w.assigned_to = me
     returning w.* into changed;
  else
    if length(trim(coalesce(want_reason, ''))) not between 1 and 500 then
      raise exception 'Reopening needs a bounded reason.' using errcode = '22023';
    end if;
    update private.work_item w set state = 'open', assigned_to = null,
      resolution_code = null, resolution_summary = null, receipt_ref = null,
      version = w.version + 1, updated_at = now()
     where w.id = want_item and w.version = want_version and w.state = 'resolved'
     returning w.* into changed;
  end if;

  if changed.id is null then
    raise exception 'Work item changed; reload the authoritative version.' using errcode = '40001';
  end if;

  insert into private.work_item_event (
    work_item_id, tenant_id, version, action, actor_id, reason,
    resolution_code, resolution_summary, receipt_ref
  ) values (
    changed.id, changed.tenant_id, changed.version,
    case want_action when 'claim' then 'claimed' when 'resolve' then 'resolved' else 'reopened' end,
    me, case when want_action = 'reopen' then want_reason end,
    case when want_action = 'resolve' then want_resolution_code end,
    case when want_action = 'resolve' then want_resolution_summary end,
    case when want_action = 'resolve' then want_receipt_ref end
  );

  correlation := 'work-item:' || changed.id::text || ':v' || changed.version::text;
  perform private.emit_domain_event(
    'work_item', changed.id::text, 'work_item.' ||
      case want_action when 'claim' then 'claimed' when 'resolve' then 'resolved' else 'reopened' end,
    1, changed.tenant_id, 'operations-work-items', correlation, correlation,
    jsonb_build_object('workItemId', changed.id, 'state', changed.state, 'version', changed.version),
    'internal', 'operational'
  );
  perform private.record_audit(
    changed.tenant_id, 'work_item.' || want_action, 'work_item', changed.id::text,
    'allowed', correlation, jsonb_build_object('version', changed.version)
  );

  return jsonb_build_object(
    'data', private.work_item_json(changed.id, true),
    'freshness', jsonb_build_object('status', 'current', 'generated_at', now()),
    'authority', 'authoritative',
    'warnings', '[]'::jsonb,
    'request_id', gen_random_uuid()
  );
end $$;

revoke all on function public.ops_operations_inbox(uuid, boolean) from public, anon;
revoke all on function public.ops_transition_work_item(uuid,text,bigint,text,text,text,text)
  from public, anon;
grant execute on function public.ops_operations_inbox(uuid, boolean) to authenticated;
grant execute on function public.ops_transition_work_item(uuid,text,bigint,text,text,text,text)
  to authenticated;

create or replace function private.registration_readiness_work_item()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state <> 'open' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.state is not distinct from new.state then
    return new;
  end if;
  perform private.open_work_item(
      new.tenant_id,
      'registration_readiness.referral',
      'registration_readiness',
      new.evaluation_id,
      'registration-readiness-task:' || new.task_id,
      'Resolve the registration-readiness reconciliation referral against the authoritative source.',
      'high',
      'tenant:implement',
      'readiness-task:' || md5(new.tenant_id || ':' || new.task_id)
    );
  return new;
end $$;
revoke all on function private.registration_readiness_work_item() from public, anon, authenticated;

drop trigger if exists registration_readiness_opens_work_item
  on private.registration_readiness_tasks;
create trigger registration_readiness_opens_work_item
  after insert or update of state on private.registration_readiness_tasks
  for each row execute function private.registration_readiness_work_item();

do $$
declare task private.registration_readiness_tasks;
begin
  for task in select * from private.registration_readiness_tasks where state = 'open' loop
    perform private.open_work_item(
      task.tenant_id,
      'registration_readiness.referral',
      'registration_readiness',
      task.evaluation_id,
      'registration-readiness-task:' || task.task_id,
      'Resolve the registration-readiness reconciliation referral against the authoritative source.',
      'high',
      'tenant:implement',
      'readiness-task:' || md5(task.tenant_id || ':' || task.task_id)
    );
  end loop;
end $$;

comment on table private.work_item is
  'The single tenant-scoped operations inbox entity. Client access is only through guarded ops_* RPCs.';
comment on table private.work_item_event is
  'Append-only work-item state and resolution receipt history.';
