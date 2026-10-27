-- Keep access-office follow-up open and give an authorized same-school human
-- the minimum canonical identity needed to contact the requesting student.

alter table public.accommodation_support_request
  add column if not exists follow_up_requested_at timestamptz,
  add column if not exists follow_up_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists follow_up_evidence text
    check (follow_up_evidence is null or follow_up_evidence ~ '^[A-Za-z0-9._:/-]{3,200}$');

create index if not exists accommodation_support_request_by_follow_up_requester
  on public.accommodation_support_request (follow_up_requested_by)
  where follow_up_requested_by is not null;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.accommodation_support_request'::regclass
       and c.contype = 'c'
       and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.accommodation_support_request drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.accommodation_support_request
  add constraint accommodation_support_request_status_check check (
    (status = 'submitted' and assigned_to is null and resolution_code is null and resolved_at is null and withdrawn_at is null)
    or (status = 'in_review' and assigned_at is not null and resolution_code is null and resolved_at is null and withdrawn_at is null)
    or (status = 'needs_student' and assigned_at is not null and resolution_code is null and resolved_at is null
        and withdrawn_at is null and follow_up_requested_at is not null)
    or (status = 'resolved' and assigned_at is not null and resolution_code is not null and resolved_at is not null and withdrawn_at is null)
    or (status = 'withdrawn' and resolution_code is null and resolved_at is null and withdrawn_at is not null)
  );
alter table public.accommodation_support_request
  add constraint accommodation_support_request_status_values check (
    status in ('submitted', 'in_review', 'needs_student', 'resolved', 'withdrawn')
  );

drop function if exists public.my_accommodation_support_requests();
create function public.my_accommodation_support_requests()
returns table (
  id uuid, kind text, summary text, status text, owner_seat text,
  response_due_at timestamptz, escalation_at timestamptz, correction_count bigint,
  resolution_code text, follow_up_requested_at timestamptz,
  created_at timestamptz, resolved_at timestamptz, withdrawn_at timestamptz
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
         r.resolution_code, r.follow_up_requested_at, r.created_at, r.resolved_at, r.withdrawn_at
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
  if item.status = 'needs_student' then
    update public.accommodation_support_request
       set status = 'in_review', follow_up_requested_at = null,
           follow_up_requested_by = null, follow_up_evidence = null
     where id = item.id;
  end if;
  perform private.record_audit(item.tenant_id, 'accommodation_request.corrected', 'accommodation_request', item.id::text,
    'allowed', want_key::text, jsonb_build_object('revision_sha256', made.content_sha256));
  return made.id;
end $$;

drop function if exists public.accommodation_support_request_queue(text);
create function public.accommodation_support_request_queue(want_tenant text)
returns table (
  id uuid, reporter uuid, kind text, summary text, evidence_reference text, status text,
  response_due_at timestamptz, escalation_at timestamptz, assigned_to uuid,
  follow_up_requested_at timestamptz, created_at timestamptz
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
    select r.id, r.reporter, r.kind,
           coalesce((select v.summary from public.accommodation_support_request_revision v
                     where v.request_id = r.id order by v.created_at desc, v.id desc limit 1), r.summary),
           r.evidence_reference, r.status, r.response_due_at, r.escalation_at,
           r.assigned_to, r.follow_up_requested_at, r.created_at
      from public.accommodation_support_request r
     where r.tenant_id = want_tenant and r.status not in ('resolved', 'withdrawn')
     order by (r.escalation_at <= now()) desc, r.escalation_at, r.created_at;
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

  if want_resolution = 'more_information_needed' then
    update public.accommodation_support_request
       set status = 'needs_student', follow_up_requested_at = now(),
           follow_up_requested_by = me, follow_up_evidence = want_evidence
     where id = item.id;
    perform private.record_audit(item.tenant_id, 'accommodation_request.more_information_requested',
      'accommodation_request', item.id::text, 'allowed', null,
      jsonb_build_object('evidence_reference', want_evidence, 'human_reviewed', true));
    return 'needs_student';
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

revoke all on function public.my_accommodation_support_requests() from public, anon;
revoke all on function public.correct_accommodation_support_request(uuid, uuid, text) from public, anon;
revoke all on function public.accommodation_support_request_queue(text) from public, anon;
revoke all on function public.resolve_accommodation_support_request(uuid, text, text) from public, anon;
grant execute on function public.my_accommodation_support_requests() to authenticated;
grant execute on function public.correct_accommodation_support_request(uuid, uuid, text) to authenticated;
grant execute on function public.accommodation_support_request_queue(text) to authenticated;
grant execute on function public.resolve_accommodation_support_request(uuid, text, text) to authenticated;

comment on function public.accommodation_support_request_queue(text) is
  'Exact-school access-office queue; returns the canonical requester id needed for human follow-up and no unrelated profile fields.';
comment on function public.resolve_accommodation_support_request(uuid, text, text) is
  'Human routing only. A request for more information remains open for the student to correct; no eligibility or adverse decision is recorded.';
