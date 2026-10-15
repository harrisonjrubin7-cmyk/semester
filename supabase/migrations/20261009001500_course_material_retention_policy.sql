-- Versioned institutional authority for shared course-material retention.
--
-- This does not create a bucket, store a byte, or make faculty material
-- readable. It closes the policy dependency named by the course-source
-- contract: a tenant-policy request must be independently approved before an
-- operator can append an effective version. Withdrawal is another version;
-- history is never rewritten. Existing material will retain the exact policy
-- id/version attached at creation, and every future deletion path must still
-- let legal hold win.

create table if not exists private.course_material_retention_policy (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools(id) on delete cascade,
  version               integer     not null check (version >= 1),
  state                 text        not null check (state in ('active', 'withdrawn')),
  days_after_withdrawal integer     check (
    (state = 'active' and days_after_withdrawal between 0 and 3650)
    or (state = 'withdrawn' and days_after_withdrawal is null)
  ),
  approval_request_id   uuid        not null unique,
  evidence_ref          text        not null check (length(btrim(evidence_ref)) between 3 and 80),
  correlation_id        text        not null check (correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  recorded_by           uuid        not null,
  effective_at          timestamptz not null default now(),
  recorded_at           timestamptz not null default now(),
  unique (tenant_id, version)
);

create index if not exists course_material_retention_by_tenant
  on private.course_material_retention_policy (tenant_id, effective_at desc, version desc);

alter table private.course_material_retention_policy enable row level security;
revoke all on table private.course_material_retention_policy
  from public, anon, authenticated, service_role;

create or replace function private.refuse_course_material_retention_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Course-material retention policy history is immutable.'
    using errcode = '23001';
end;
$$;

revoke all on function private.refuse_course_material_retention_change()
  from public, anon, authenticated;

drop trigger if exists course_material_retention_immutable
  on private.course_material_retention_policy;
create trigger course_material_retention_immutable
  before update or delete on private.course_material_retention_policy
  for each row execute function private.refuse_course_material_retention_change();

-- The server-side course-source intake resolves this at request time. No row
-- means shared course-material intake is closed. A withdrawn latest version
-- deliberately returns no authority while preserving every earlier version.
create or replace function private.current_course_material_retention_policy(
  want_tenant text,
  want_at timestamptz default now()
)
returns table (
  policy_id uuid,
  policy_version integer,
  days_after_withdrawal integer,
  effective_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select p.id, p.version, p.state, p.days_after_withdrawal, p.effective_at
      from private.course_material_retention_policy p
     where p.tenant_id = want_tenant
       and p.effective_at <= want_at
     order by p.effective_at desc, p.version desc
     limit 1
  )
  select l.id, l.version, l.days_after_withdrawal, l.effective_at
    from latest l
   where l.state = 'active';
$$;

revoke all on function private.current_course_material_retention_policy(text, timestamptz)
  from public, anon, authenticated;
grant execute on function private.current_course_material_retention_policy(text, timestamptz)
  to service_role;

-- Execute one approved `tenant-policy` request. This is intentionally a
-- dedicated effect instead of the console's generic action record: the exact
-- approved detail becomes enforceable database authority, not prose that a
-- later upload route could reinterpret.
create or replace function public.publish_course_material_retention_policy(
  want_request uuid,
  want_correlation text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me       uuid := auth.uid();
  req      public.approval_request%rowtype;
  action   text;
  days     integer;
  next_ver integer;
  made     uuid := gen_random_uuid();
  audit_seq bigint;
begin
  if me is null or not private.has_capability('console:operate') then
    raise exception 'The operations console is not open to you.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  if want_correlation is null
     or want_correlation !~ '^[A-Za-z0-9._:-]{8,128}$' then
    raise exception 'A bounded correlation id is required.' using errcode = '22023';
  end if;

  select * into req
    from public.approval_request r
   where r.id = want_request
   for update;
  if not found then
    raise exception 'No such request.' using errcode = '42501';
  end if;
  if req.duty_id <> 'tenant-policy'
     or req.target is distinct from 'course-materials'
     or req.tenant_id is null then
    raise exception 'This approval is not for course-material retention.' using errcode = '42501';
  end if;
  if req.correlation_id is null or req.correlation_id is distinct from want_correlation then
    raise exception 'The correlation id must match the approved request.' using errcode = '22023';
  end if;
  if req.status <> 'approved' then
    raise exception 'This request is %, not approved.', req.status;
  end if;
  if req.expires_at <= now() then
    raise exception 'This approval expired on %.', req.expires_at;
  end if;
  if req.requester <> me and not exists (
    select 1 from public.approval_decision d
     where d.request_id = req.id
       and d.approver = me
       and d.decision = 'approve'
  ) then
    raise exception 'Only the requester or an approver may act on this request.' using errcode = '42501';
  end if;
  if req.detail - array['policy_kind', 'action', 'days_after_withdrawal', 'rollback']::text[]
       <> '{}'::jsonb
     or req.detail ->> 'policy_kind' is distinct from 'course-material-retention'
     or coalesce(length(btrim(req.detail ->> 'rollback')), 0) < 3 then
    raise exception 'The approved policy detail is incomplete or contains unsupported fields.' using errcode = '22023';
  end if;

  action := req.detail ->> 'action';
  if action not in ('activate', 'withdraw') then
    raise exception 'The policy action must be activate or withdraw.' using errcode = '22023';
  end if;
  if action = 'activate' then
    begin
      days := (req.detail ->> 'days_after_withdrawal')::integer;
    exception when others then
      raise exception 'Activation requires whole retention days.' using errcode = '22023';
    end;
    if days not between 0 and 3650 then
      raise exception 'Retention days must be between 0 and 3650.' using errcode = '22023';
    end if;
  elsif req.detail ? 'days_after_withdrawal' then
    raise exception 'Withdrawal does not accept retention days.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('course-material-retention:' || req.tenant_id));
  select coalesce(max(p.version), 0) + 1 into next_ver
    from private.course_material_retention_policy p
   where p.tenant_id = req.tenant_id;

  -- Fail closed: the audit append is first and is not caught. The policy row
  -- and request transition share this transaction, so none can succeed alone.
  audit_seq := private.console_audit_write(
    me, 'authenticated', req.tenant_id, 'course_material_retention.changed', made::text,
    jsonb_build_object(
      'request', req.id,
      'ticket', req.ticket,
      'policy_version', next_ver,
      'state', case when action = 'activate' then 'active' else 'withdrawn' end,
      'days_after_withdrawal', days
    ),
    req.correlation_id
  );

  insert into private.course_material_retention_policy
    (id, tenant_id, version, state, days_after_withdrawal,
     approval_request_id, evidence_ref, correlation_id, recorded_by)
  values
    (made, req.tenant_id, next_ver,
     case when action = 'activate' then 'active' else 'withdrawn' end,
     days, req.id, req.ticket, req.correlation_id, me);

  update public.approval_request
     set status = 'executed', executed_at = now()
   where id = req.id;

  return jsonb_build_object(
    'policyId', made,
    'policyVersion', next_ver,
    'state', case when action = 'activate' then 'active' else 'withdrawn' end,
    'daysAfterWithdrawal', days,
    'auditSeq', audit_seq
  );
end;
$$;

revoke all on function public.publish_course_material_retention_policy(uuid, text)
  from public, anon;
grant execute on function public.publish_course_material_retention_policy(uuid, text)
  to authenticated;

comment on table private.course_material_retention_policy is
  'Append-only tenant authority for shared course-material retention. Every version consumes one independently approved tenant-policy request; withdrawal appends a version and legal hold still wins.';
comment on function private.current_course_material_retention_policy(text, timestamptz) is
  'Resolves the active institutional course-material retention version at an exact time; no row means shared intake is closed.';
comment on function public.publish_course_material_retention_policy(uuid, text) is
  'Consumes one approved course-material tenant-policy request with fresh MFA and fail-closed audit, then appends an active or withdrawn version.';

-- Rollback (only before any material references a policy version):
-- drop function public.publish_course_material_retention_policy(uuid, text);
-- drop function private.current_course_material_retention_policy(text, timestamptz);
-- drop table private.course_material_retention_policy;
-- drop function private.refuse_course_material_retention_change();
