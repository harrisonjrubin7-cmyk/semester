-- Audited privacy-case lifecycle actions.
--
-- Every browser-callable action independently requires the platform console
-- shell, an exact-school data_request:handle grant and fresh MFA. Request
-- detail is a separate audited read after assignment. Assisted erasure cannot
-- be completed while a legal hold is live or without an executed
-- data-deletion approval for this exact request and tenant.

alter table public.data_subject_request
  add column if not exists resolution_evidence text
    check (resolution_evidence is null or resolution_evidence ~ '^[A-Za-z0-9._:/-]{3,200}$'),
  add column if not exists completion_certificate_id uuid;

create table if not exists public.privacy_completion_certificate (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  request_ref text not null check (request_ref ~ '^DSR-[A-F0-9]{10}$'),
  subject uuid references auth.users(id) on delete set null,
  subject_sha256 text not null check (subject_sha256 ~ '^[0-9a-f]{64}$'),
  tenant_id text references public.schools(id) on delete restrict,
  kind text not null check (kind in ('export', 'erasure', 'correction', 'restriction')),
  outcome text not null default 'completed' check (outcome = 'completed'),
  evidence_reference text not null check (evidence_reference ~ '^[A-Za-z0-9._:/-]{3,200}$'),
  approval_request uuid references public.approval_request(id) on delete set null,
  issued_by uuid references auth.users(id) on delete set null,
  issued_at timestamptz not null default now()
);

create index if not exists privacy_completion_certificate_by_subject
  on public.privacy_completion_certificate (subject, issued_at desc);
create index if not exists privacy_completion_certificate_by_tenant
  on public.privacy_completion_certificate (tenant_id, issued_at desc);
create index if not exists privacy_completion_certificate_by_approval
  on public.privacy_completion_certificate (approval_request);
create index if not exists privacy_completion_certificate_by_issuer
  on public.privacy_completion_certificate (issued_by);

create or replace function private.refuse_privacy_certificate_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.id is not distinct from old.id
     and new.request_id is not distinct from old.request_id
     and new.request_ref is not distinct from old.request_ref
     and (new.subject is not distinct from old.subject or (old.subject is not null and new.subject is null))
     and new.subject_sha256 is not distinct from old.subject_sha256
     and new.tenant_id is not distinct from old.tenant_id
     and new.kind is not distinct from old.kind
     and new.outcome is not distinct from old.outcome
     and new.evidence_reference is not distinct from old.evidence_reference
     and (new.approval_request is not distinct from old.approval_request
          or (old.approval_request is not null and new.approval_request is null))
     and (new.issued_by is not distinct from old.issued_by or (old.issued_by is not null and new.issued_by is null))
     and new.issued_at is not distinct from old.issued_at then
    return new;
  end if;
  raise exception 'Privacy completion certificates are immutable.' using errcode = '42501';
end $$;

revoke all on function private.refuse_privacy_certificate_change() from public, anon, authenticated;
drop trigger if exists privacy_completion_certificate_immutable on public.privacy_completion_certificate;
create trigger privacy_completion_certificate_immutable
  before update or delete on public.privacy_completion_certificate
  for each row execute function private.refuse_privacy_certificate_change();

alter table public.privacy_completion_certificate enable row level security;
revoke all on table public.privacy_completion_certificate from public, anon, authenticated;

create or replace function private.privacy_case_allowed(want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and private.has_capability('console:operate', 'platform', '')
     and case when want_tenant is null
          then private.has_capability('data_request:handle', 'platform', '')
          else private.has_capability('data_request:handle', 'school', want_tenant)
         end;
$$;

revoke all on function private.privacy_case_allowed(text) from public, anon, authenticated;

create or replace function public.claim_privacy_request(want_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.data_subject_request%rowtype;
begin
  perform private.assert_fresh_mfa();
  select * into item from public.data_subject_request r where r.id = want_request for update;
  if not found or not private.privacy_case_allowed(item.tenant_id) then
    raise exception 'No privacy request in your grant scope.' using errcode = '42501';
  end if;
  if item.resolved_at is not null then
    raise exception 'This privacy request is already resolved.' using errcode = '23514';
  end if;
  if item.assigned_to is not null and item.assigned_to <> me then
    raise exception 'This privacy request is assigned to another data steward.' using errcode = '42501';
  end if;
  if item.assigned_to = me then return item.status; end if;

  perform private.console_audit_write(
    me, 'authenticated', item.tenant_id, 'privacy.case_claimed', item.id::text,
    jsonb_build_object('kind', item.kind), null
  );
  update public.data_subject_request
     set assigned_to = me, assigned_at = now(),
         status = case when status = 'received' then 'verifying' else status end
   where id = item.id;
  return case when item.status = 'received' then 'verifying' else item.status end;
end $$;

create or replace function public.read_privacy_request_detail(want_request uuid)
returns table (
  request_ref text,
  subject_reference text,
  kind text,
  requested_by text,
  detail text,
  tenant_id text,
  verified_at timestamptz,
  resolution text,
  resolution_evidence text,
  completion_certificate_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.data_subject_request%rowtype;
begin
  perform private.assert_fresh_mfa();
  select * into item from public.data_subject_request r where r.id = want_request;
  if not found or not private.privacy_case_allowed(item.tenant_id)
     or item.assigned_to is distinct from me then
    raise exception 'Claim this privacy request before reading its detail.' using errcode = '42501';
  end if;

  perform private.console_audit_write(
    me, 'authenticated', item.tenant_id, 'privacy.case_read', item.id::text,
    jsonb_build_object('kind', item.kind), null
  );
  return query select
    'DSR-' || upper(left(replace(item.id::text, '-', ''), 10)),
    private.role_audit_sha256(item.subject::text),
    item.kind,
    item.requested_by,
    item.detail,
    item.tenant_id,
    item.verified_at,
    item.resolution,
    item.resolution_evidence,
    item.completion_certificate_id;
end $$;

create or replace function public.verify_privacy_request(
  want_request uuid,
  want_basis text,
  want_evidence text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.data_subject_request%rowtype;
begin
  perform private.assert_fresh_mfa();
  if length(trim(coalesce(want_basis, ''))) not between 3 and 200
     or coalesce(want_evidence, '') !~ '^[A-Za-z0-9._:/-]{3,200}$' then
    raise exception 'Verification basis and an opaque evidence reference are required.' using errcode = '22023';
  end if;
  select * into item from public.data_subject_request r where r.id = want_request for update;
  if not found or not private.privacy_case_allowed(item.tenant_id)
     or item.assigned_to is distinct from me then
    raise exception 'Claim this privacy request before verifying it.' using errcode = '42501';
  end if;
  if item.resolved_at is not null then
    raise exception 'This privacy request is already resolved.' using errcode = '23514';
  end if;
  if item.verified_at is not null then
    raise exception 'Identity or authority was already verified.' using errcode = '23514';
  end if;

  perform private.console_audit_write(
    me, 'authenticated', item.tenant_id, 'privacy.identity_verified', item.id::text,
    jsonb_build_object('kind', item.kind, 'basis', trim(want_basis)), null
  );
  update public.data_subject_request
     set verified_by = me,
         verified_at = now(),
         verification_basis = trim(want_basis),
         verification_evidence = trim(want_evidence),
         status = 'in_progress'
   where id = item.id;
  return 'in_progress';
end $$;

create or replace function public.resolve_privacy_request(
  want_request uuid,
  want_outcome text,
  want_resolution text,
  want_evidence text,
  want_approval uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  item public.data_subject_request%rowtype;
  certificate uuid;
begin
  perform private.assert_fresh_mfa();
  if want_outcome not in ('completed', 'refused') then
    raise exception 'Outcome must be completed or refused.' using errcode = '22023';
  end if;
  if length(trim(coalesce(want_resolution, ''))) not between 3 and 1000 then
    raise exception 'A resolution of 3 to 1,000 characters is required.' using errcode = '22023';
  end if;
  if coalesce(want_evidence, '') !~ '^[A-Za-z0-9._:/-]{3,200}$' then
    raise exception 'Evidence must be an opaque reference of 3 to 200 safe characters.' using errcode = '22023';
  end if;

  select * into item from public.data_subject_request r where r.id = want_request for update;
  if not found or not private.privacy_case_allowed(item.tenant_id)
     or item.assigned_to is distinct from me then
    raise exception 'Only the assigned data steward may resolve this request.' using errcode = '42501';
  end if;
  if item.status <> 'in_progress' or item.verified_at is null then
    raise exception 'Verify identity or authority before resolving this request.' using errcode = '42501';
  end if;

  if item.kind = 'erasure' and want_outcome = 'completed' then
    if private.account_is_held(item.subject) then
      raise exception 'This account is under a legal hold; erasure cannot be completed.' using errcode = '55006';
    end if;
    if want_approval is null or not exists (
      select 1
        from public.approval_request ar
       where ar.id = want_approval
         and ar.duty_id = 'data-deletion'
         and ar.tenant_id is not distinct from item.tenant_id
         and ar.target = item.id::text
         and ar.status = 'executed'
         and exists (
           select 1 from public.console_action_record action
            where action.request_id = ar.id and action.duty_id = 'data-deletion'
         )
    ) then
      raise exception 'Completed erasure requires an executed data-deletion approval for this request.' using errcode = '42501';
    end if;
  elsif want_approval is not null then
    raise exception 'Only completed erasure accepts a data-deletion approval.' using errcode = '22023';
  end if;

  perform private.console_audit_write(
    me, 'authenticated', item.tenant_id, 'privacy.request_resolved', item.id::text,
    jsonb_build_object('kind', item.kind, 'outcome', want_outcome,
                       'evidence', want_evidence, 'approval', want_approval), null
  );

  if want_outcome = 'completed' then
    certificate := gen_random_uuid();
    insert into public.privacy_completion_certificate (
      id, request_id, request_ref, subject, subject_sha256, tenant_id, kind,
      evidence_reference, approval_request, issued_by
    ) values (
      certificate, item.id,
      'DSR-' || upper(left(replace(item.id::text, '-', ''), 10)),
      item.subject, private.role_audit_sha256(item.subject::text),
      item.tenant_id, item.kind, want_evidence, want_approval, me
    );
  end if;

  update public.data_subject_request
     set status = want_outcome,
         resolved_at = now(),
         resolution = trim(want_resolution),
         resolution_evidence = want_evidence,
         completion_certificate_id = certificate
   where id = item.id;

  return jsonb_build_object('status', want_outcome, 'certificate_id', certificate);
end $$;

create or replace function public.my_privacy_completion_certificates()
returns table (
  certificate_id uuid,
  request_ref text,
  kind text,
  evidence_reference text,
  issued_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.request_ref, c.kind, c.evidence_reference, c.issued_at
    from public.privacy_completion_certificate c
   where c.subject = (select auth.uid())
   order by c.issued_at desc, c.id desc;
$$;

revoke all on function public.claim_privacy_request(uuid) from public, anon;
revoke all on function public.read_privacy_request_detail(uuid) from public, anon;
revoke all on function public.verify_privacy_request(uuid, text, text) from public, anon;
revoke all on function public.resolve_privacy_request(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.my_privacy_completion_certificates() from public, anon;
grant execute on function public.claim_privacy_request(uuid) to authenticated;
grant execute on function public.read_privacy_request_detail(uuid) to authenticated;
grant execute on function public.verify_privacy_request(uuid, text, text) to authenticated;
grant execute on function public.resolve_privacy_request(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.my_privacy_completion_certificates() to authenticated;

comment on table public.privacy_completion_certificate is
  'Immutable evidence that a verified data-rights request was completed. It stores references and pseudonyms, never request content.';
