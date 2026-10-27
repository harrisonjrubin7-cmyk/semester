-- A narrow, human-owned route from a student to their school's access office.
--
-- This queue records a barrier or requested support, never a diagnosis or
-- medical document. The authenticated profile supplies both student and school.
-- It does not determine eligibility, approve or deny an accommodation, or
-- mutate a passport, course, assessment, grade, enrollment or conduct record.

create table if not exists public.accommodation_support_request (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.schools(id) on delete restrict,
  reporter uuid references auth.users(id) on delete set null,
  idempotency_key uuid not null,
  kind text not null check (kind in (
    'accommodation_support', 'accessibility_barrier', 'alternate_format', 'communication_access', 'other'
  )),
  summary text not null check (length(trim(summary)) between 1 and 1000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  evidence_reference text generated always as ('access-request:' || left(content_sha256, 16)) stored,
  privacy_notice text not null check (privacy_notice = '2026-10-27'),
  consented_at timestamptz not null,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'resolved', 'withdrawn')),
  owner_seat text not null default 'disability_services_officer' check (owner_seat = 'disability_services_officer'),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  resolution_code text check (resolution_code in ('routed_to_process', 'guidance_sent', 'barrier_referred', 'more_information_needed')),
  resolution_evidence text check (resolution_evidence is null or resolution_evidence ~ '^[A-Za-z0-9._:/-]{3,200}$'),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  withdrawn_at timestamptz,
  response_due_at timestamptz not null,
  escalation_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (reporter, idempotency_key),
  check (response_due_at > created_at and escalation_at >= response_due_at),
  check (assigned_to is null or assigned_at is not null),
  check (
    (status = 'submitted' and assigned_to is null and resolution_code is null and resolved_at is null and withdrawn_at is null)
    or (status = 'in_review' and assigned_at is not null and resolution_code is null and resolved_at is null and withdrawn_at is null)
    or (status = 'resolved' and assigned_at is not null and resolution_code is not null and resolved_at is not null and withdrawn_at is null)
    or (status = 'withdrawn' and resolution_code is null and resolved_at is null and withdrawn_at is not null)
  )
);

create index if not exists accommodation_support_request_by_reporter
  on public.accommodation_support_request (reporter, created_at desc);
create index if not exists accommodation_support_request_by_tenant_status
  on public.accommodation_support_request (tenant_id, status, escalation_at);
create index if not exists accommodation_support_request_by_assignee
  on public.accommodation_support_request (assigned_to) where assigned_to is not null;
create index if not exists accommodation_support_request_by_resolver
  on public.accommodation_support_request (resolved_by) where resolved_by is not null;

create table if not exists public.accommodation_support_request_revision (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.accommodation_support_request(id) on delete restrict,
  idempotency_key uuid not null,
  summary text not null check (length(trim(summary)) between 1 and 1000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (request_id, idempotency_key)
);
create index if not exists accommodation_support_revision_by_request
  on public.accommodation_support_request_revision (request_id, created_at desc);

alter table public.accommodation_support_request enable row level security;
alter table public.accommodation_support_request_revision enable row level security;
revoke all on table public.accommodation_support_request from public, anon, authenticated;
revoke all on table public.accommodation_support_request_revision from public, anon, authenticated;

create or replace function private.keep_accommodation_request_binding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or (new.reporter is distinct from old.reporter and not (old.reporter is not null and new.reporter is null))
     or new.idempotency_key is distinct from old.idempotency_key
     or new.kind is distinct from old.kind
     or new.summary is distinct from old.summary
     or new.content_sha256 is distinct from old.content_sha256
     or new.privacy_notice is distinct from old.privacy_notice
     or new.consented_at is distinct from old.consented_at
     or new.owner_seat is distinct from old.owner_seat
     or new.response_due_at is distinct from old.response_due_at
     or new.escalation_at is distinct from old.escalation_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Accommodation request evidence and scope are immutable.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.keep_accommodation_request_binding() from public, anon, authenticated;

drop trigger if exists accommodation_request_binding_immutable on public.accommodation_support_request;
create trigger accommodation_request_binding_immutable
  before update on public.accommodation_support_request
  for each row execute function private.keep_accommodation_request_binding();

create or replace function private.refuse_accommodation_revision_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Accommodation request corrections are immutable.' using errcode = '42501';
end $$;
revoke all on function private.refuse_accommodation_revision_change() from public, anon, authenticated;

drop trigger if exists accommodation_revision_immutable on public.accommodation_support_request_revision;
create trigger accommodation_revision_immutable
  before update or delete on public.accommodation_support_request_revision
  for each row execute function private.refuse_accommodation_revision_change();

create or replace function public.raise_accommodation_support_request(
  want_key uuid,
  want_kind text,
  want_summary text,
  want_privacy_notice text,
  want_consent boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  tenant text;
  existing public.accommodation_support_request%rowtype;
  made public.accommodation_support_request%rowtype;
  cleaned text := trim(coalesce(want_summary, ''));
  due_interval interval;
  escalate_interval interval;
begin
  if me is null then raise exception 'Sign in to contact your access office.' using errcode = '42501'; end if;
  select p.school_id into tenant from public.profiles p where p.user_id = me;
  if tenant is null then raise exception 'A verified school membership is required.' using errcode = '42501'; end if;

  select * into existing from public.accommodation_support_request r
   where r.reporter = me and r.idempotency_key = want_key;
  if found then
    if existing.kind is distinct from want_kind
       or existing.summary is distinct from cleaned
       or existing.privacy_notice is distinct from want_privacy_notice then
      raise exception 'That request key is already bound to different evidence.' using errcode = '23505';
    end if;
    return existing.id;
  end if;

  if want_kind not in ('accommodation_support', 'accessibility_barrier', 'alternate_format', 'communication_access', 'other')
     or length(cleaned) not between 1 and 1000
     or want_privacy_notice <> '2026-10-27'
     or want_consent is not true then
    raise exception 'The access-office request is invalid.' using errcode = '23514';
  end if;

  due_interval := case when want_kind = 'accessibility_barrier' then interval '4 hours' else interval '2 days' end;
  escalate_interval := case when want_kind = 'accessibility_barrier' then interval '8 hours' else interval '3 days' end;

  insert into public.accommodation_support_request (
    tenant_id, reporter, idempotency_key, kind, summary, content_sha256,
    privacy_notice, consented_at, response_due_at, escalation_at
  ) values (
    tenant, me, want_key, want_kind, cleaned, private.role_audit_sha256(cleaned),
    want_privacy_notice, now(), now() + due_interval, now() + escalate_interval
  ) returning * into made;

  perform private.record_audit(
    tenant, 'accommodation_request.submitted', 'accommodation_request', made.id::text, 'allowed', want_key::text,
    jsonb_build_object('kind', want_kind, 'evidence_reference', made.evidence_reference,
      'owner_seat', made.owner_seat, 'response_due_at', made.response_due_at, 'escalation_at', made.escalation_at,
      'privacy_notice', made.privacy_notice)
  );
  return made.id;
end $$;

create or replace function public.my_accommodation_support_requests()
returns table (
  id uuid, kind text, summary text, status text, owner_seat text,
  response_due_at timestamptz, escalation_at timestamptz, correction_count bigint,
  resolution_code text, created_at timestamptz, resolved_at timestamptz, withdrawn_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.kind,
         coalesce((select v.summary from public.accommodation_support_request_revision v
                   where v.request_id = r.id order by v.created_at desc, v.id desc limit 1), r.summary),
         r.status, r.owner_seat, r.response_due_at, r.escalation_at,
         (select count(*) from public.accommodation_support_request_revision v where v.request_id = r.id),
         r.resolution_code, r.created_at, r.resolved_at, r.withdrawn_at
    from public.accommodation_support_request r
   where r.reporter = (select auth.uid())
   order by r.created_at desc;
$$;

create or replace function public.correct_accommodation_support_request(want_id uuid, want_key uuid, want_summary text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.accommodation_support_request%rowtype;
  existing public.accommodation_support_request_revision%rowtype;
  made public.accommodation_support_request_revision%rowtype;
  cleaned text := trim(coalesce(want_summary, ''));
begin
  select * into item from public.accommodation_support_request r where r.id = want_id for update;
  if not found or me is null or item.reporter is distinct from me then
    raise exception 'No access-office request for this account.' using errcode = '42501';
  end if;
  if item.status in ('resolved', 'withdrawn') then raise exception 'This request is closed.' using errcode = '23514'; end if;
  if length(cleaned) not between 1 and 1000 then raise exception 'The corrected request is invalid.' using errcode = '23514'; end if;

  select * into existing from public.accommodation_support_request_revision v
   where v.request_id = item.id and v.idempotency_key = want_key;
  if found then
    if existing.summary is distinct from cleaned then
      raise exception 'That correction key is already bound to different evidence.' using errcode = '23505';
    end if;
    return existing.id;
  end if;

  insert into public.accommodation_support_request_revision (request_id, idempotency_key, summary, content_sha256)
  values (item.id, want_key, cleaned, private.role_audit_sha256(cleaned)) returning * into made;
  perform private.record_audit(item.tenant_id, 'accommodation_request.corrected', 'accommodation_request', item.id::text,
    'allowed', want_key::text, jsonb_build_object('revision_sha256', made.content_sha256));
  return made.id;
end $$;

create or replace function public.withdraw_accommodation_support_request(want_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.accommodation_support_request%rowtype;
begin
  select * into item from public.accommodation_support_request r where r.id = want_id for update;
  if not found or me is null or item.reporter is distinct from me then
    raise exception 'No access-office request for this account.' using errcode = '42501';
  end if;
  if item.status = 'withdrawn' then return 'withdrawn'; end if;
  if item.status = 'resolved' then raise exception 'A resolved request cannot be withdrawn.' using errcode = '23514'; end if;
  update public.accommodation_support_request set status = 'withdrawn', withdrawn_at = now() where id = item.id;
  perform private.record_audit(item.tenant_id, 'accommodation_request.withdrawn', 'accommodation_request', item.id::text,
    'allowed', null, jsonb_build_object('owner_seat', item.owner_seat));
  return 'withdrawn';
end $$;

create or replace function public.accommodation_support_request_queue(want_tenant text)
returns table (
  id uuid, kind text, summary text, evidence_reference text, status text,
  response_due_at timestamptz, escalation_at timestamptz, assigned_to uuid, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.has_capability('accommodation:verify', 'school', want_tenant) then
    raise exception 'No access-office queue in your grant scope.' using errcode = '42501';
  end if;
  return query
    select r.id, r.kind,
           coalesce((select v.summary from public.accommodation_support_request_revision v
                     where v.request_id = r.id order by v.created_at desc, v.id desc limit 1), r.summary),
           r.evidence_reference, r.status, r.response_due_at, r.escalation_at, r.assigned_to, r.created_at
      from public.accommodation_support_request r
     where r.tenant_id = want_tenant and r.status not in ('resolved', 'withdrawn')
     order by (r.escalation_at <= now()) desc, r.escalation_at, r.created_at;
end $$;

create or replace function public.claim_accommodation_support_request(want_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.accommodation_support_request%rowtype;
begin
  select * into item from public.accommodation_support_request r where r.id = want_id for update;
  if not found or me is null or not private.has_capability('accommodation:verify', 'school', item.tenant_id) then
    raise exception 'No access-office request in your grant scope.' using errcode = '42501';
  end if;
  if item.status in ('resolved', 'withdrawn') then raise exception 'This request is closed.' using errcode = '23514'; end if;
  if item.assigned_to is not null and item.assigned_to <> me then
    raise exception 'This request is assigned to another human reviewer.' using errcode = '42501';
  end if;
  if item.assigned_to = me then return item.status; end if;
  update public.accommodation_support_request set status = 'in_review', assigned_to = me, assigned_at = now() where id = item.id;
  perform private.record_audit(item.tenant_id, 'accommodation_request.claimed', 'accommodation_request', item.id::text,
    'allowed', null, jsonb_build_object('owner_seat', item.owner_seat));
  return 'in_review';
end $$;

create or replace function public.resolve_accommodation_support_request(want_id uuid, want_resolution text, want_evidence text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.accommodation_support_request%rowtype;
begin
  select * into item from public.accommodation_support_request r where r.id = want_id for update;
  if not found or me is null or not private.has_capability('accommodation:verify', 'school', item.tenant_id)
     or item.assigned_to is distinct from me then
    raise exception 'Claim this access-office request before resolving it.' using errcode = '42501';
  end if;
  if item.status <> 'in_review' then raise exception 'This request is not open.' using errcode = '23514'; end if;
  if want_resolution not in ('routed_to_process', 'guidance_sent', 'barrier_referred', 'more_information_needed')
     or coalesce(want_evidence, '') !~ '^[A-Za-z0-9._:/-]{3,200}$' then
    raise exception 'A permitted human routing outcome and evidence reference are required.' using errcode = '23514';
  end if;
  update public.accommodation_support_request
     set status = 'resolved', resolution_code = want_resolution, resolution_evidence = want_evidence,
         resolved_by = me, resolved_at = now()
   where id = item.id;
  perform private.record_audit(item.tenant_id, 'accommodation_request.resolved', 'accommodation_request', item.id::text,
    'allowed', null, jsonb_build_object('resolution_code', want_resolution,
      'evidence_reference', want_evidence, 'human_reviewed', true));
  return 'resolved';
end $$;

revoke all on function public.raise_accommodation_support_request(uuid, text, text, text, boolean) from public, anon;
revoke all on function public.my_accommodation_support_requests() from public, anon;
revoke all on function public.correct_accommodation_support_request(uuid, uuid, text) from public, anon;
revoke all on function public.withdraw_accommodation_support_request(uuid) from public, anon;
revoke all on function public.accommodation_support_request_queue(text) from public, anon;
revoke all on function public.claim_accommodation_support_request(uuid) from public, anon;
revoke all on function public.resolve_accommodation_support_request(uuid, text, text) from public, anon;
grant execute on function public.raise_accommodation_support_request(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.my_accommodation_support_requests() to authenticated;
grant execute on function public.correct_accommodation_support_request(uuid, uuid, text) to authenticated;
grant execute on function public.withdraw_accommodation_support_request(uuid) to authenticated;
grant execute on function public.accommodation_support_request_queue(text) to authenticated;
grant execute on function public.claim_accommodation_support_request(uuid) to authenticated;
grant execute on function public.resolve_accommodation_support_request(uuid, text, text) to authenticated;

comment on table public.accommodation_support_request is
  'Tenant-scoped student routing requests for a human access office. Never an eligibility, approval, denial or adverse-decision record.';
comment on table public.accommodation_support_request_revision is
  'Append-only student corrections to an access-office routing request; prior wording remains immutable.';
