-- Synthetic offboarding purge execution rehearsal.
--
-- This migration does not add a tenant-data delete function. The only adapter
-- is a disabled-by-default synthetic adapter whose target is a private fixture
-- table. The worker deletes and restores those surrogate fixtures in one
-- transaction, then keeps an immutable receipt of the equality check.

insert into public.entitlement_definitions (key, kind, about) values
  ('offboarding.purge_rehearsal', 'feature',
   'Allows an explicitly approved synthetic purge-and-restore rehearsal. Never permits tenant-data deletion.')
on conflict (key) do update set kind = excluded.kind, about = excluded.about;

insert into public.app_capabilities (capability, about) values
  ('offboarding:purge-rehearse',
   'Queue a synthetic-only offboarding purge-and-restore rehearsal. This capability is intentionally assigned to no role by default.')
on conflict (capability) do update set about = excluded.about;

insert into public.console_duty (id, action, requester, approvers, two_person, evidence) values
  ('offboarding-purge-rehearsal',
   'Queue one synthetic offboarding purge-and-restore rehearsal',
   'role:data_steward', array['privacy', 'security'], true,
   'The exact tenant, archived offboarding case, unexpired preview receipt, verified export manifest, synthetic adapter, rollback expectation and ticket')
on conflict (id) do update set
  action = excluded.action,
  requester = excluded.requester,
  approvers = excluded.approvers,
  two_person = excluded.two_person,
  evidence = excluded.evidence;

create table if not exists private.offboarding_purge_rehearsal_adapter (
  adapter_key text primary key check (adapter_key = 'synthetic_discard_v1'),
  kind text not null check (kind = 'synthetic'),
  target_relation text not null check (target_relation = 'private.offboarding_purge_rehearsal_fixture'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into private.offboarding_purge_rehearsal_adapter
  (adapter_key, kind, target_relation, enabled)
values ('synthetic_discard_v1', 'synthetic', 'private.offboarding_purge_rehearsal_fixture', false)
on conflict (adapter_key) do nothing;

alter table private.offboarding_purge_rehearsal_adapter enable row level security;
revoke all on table private.offboarding_purge_rehearsal_adapter from public, anon, authenticated;
grant select, update on table private.offboarding_purge_rehearsal_adapter to service_role;

create table if not exists private.offboarding_purge_rehearsal_job (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.school_offboarding (id) on delete restrict,
  tenant_id text not null references public.schools (id) on delete restrict,
  approval_request_id uuid not null unique references public.approval_request (id) on delete restrict,
  preview_receipt_id uuid not null references private.offboarding_purge_preview_receipt (id) on delete restrict,
  export_generation_id uuid not null references private.offboarding_export_generation (id) on delete restrict,
  adapter_key text not null references private.offboarding_purge_rehearsal_adapter (adapter_key) on delete restrict,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$'),
  request_sha256 text not null check (request_sha256 ~ '^[0-9a-f]{64}$'),
  preview_snapshot_sha256 text not null check (preview_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  queued_by uuid not null,
  queued_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'stopped', 'completed')),
  stopped_reason text check (stopped_reason is null or length(stopped_reason) between 1 and 200),
  started_at timestamptz,
  finished_at timestamptz,
  unique (case_id, idempotency_key),
  constraint rehearsal_expiry_after_queue check (expires_at > queued_at),
  constraint rehearsal_terminal_has_finished check (
    (status in ('stopped', 'completed')) = (finished_at is not null)),
  constraint rehearsal_stop_reason_matches_status check (
    (status = 'stopped') = (stopped_reason is not null))
);

create index if not exists offboarding_purge_rehearsal_job_tenant_idx
  on private.offboarding_purge_rehearsal_job (tenant_id, queued_at desc);

alter table private.offboarding_purge_rehearsal_job enable row level security;
revoke all on table private.offboarding_purge_rehearsal_job from public, anon, authenticated;
grant select, insert, update on table private.offboarding_purge_rehearsal_job to service_role;

create table if not exists private.offboarding_purge_rehearsal_fixture (
  job_id uuid not null references private.offboarding_purge_rehearsal_job (id) on delete restrict,
  fixture_key text not null check (length(fixture_key) between 1 and 100),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  primary key (job_id, fixture_key)
);

alter table private.offboarding_purge_rehearsal_fixture enable row level security;
revoke all on table private.offboarding_purge_rehearsal_fixture from public, anon, authenticated;
grant select, insert, delete on table private.offboarding_purge_rehearsal_fixture to service_role;

create table if not exists private.offboarding_purge_rehearsal_receipt (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references private.offboarding_purge_rehearsal_job (id) on delete restrict,
  case_id uuid not null references public.school_offboarding (id) on delete restrict,
  tenant_id text not null references public.schools (id) on delete restrict,
  status text not null check (status in ('stopped', 'completed')),
  reason text,
  fixture_count integer not null default 0 check (fixture_count >= 0),
  affected_record_count bigint not null default 0 check (affected_record_count >= 0),
  before_sha256 text check (before_sha256 is null or before_sha256 ~ '^[0-9a-f]{64}$'),
  discard_sha256 text check (discard_sha256 is null or discard_sha256 ~ '^[0-9a-f]{64}$'),
  restored_sha256 text check (restored_sha256 is null or restored_sha256 ~ '^[0-9a-f]{64}$'),
  restore_verified boolean not null default false,
  adapter_key text not null check (adapter_key = 'synthetic_discard_v1'),
  created_at timestamptz not null,
  constraint rehearsal_completed_hashes check (
    status <> 'completed' or
    (before_sha256 is not null and discard_sha256 is not null and restored_sha256 is not null
      and restore_verified and before_sha256 = restored_sha256))
);

alter table private.offboarding_purge_rehearsal_receipt enable row level security;
revoke all on table private.offboarding_purge_rehearsal_receipt from public, anon, authenticated;
grant select, insert on table private.offboarding_purge_rehearsal_receipt to service_role;

create or replace function private.offboarding_purge_rehearsal_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Offboarding purge rehearsal evidence is immutable.' using errcode = '42501';
end $$;
revoke all on function private.offboarding_purge_rehearsal_immutable() from public, anon, authenticated;

create or replace function private.offboarding_purge_rehearsal_adapter_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.adapter_key <> old.adapter_key or new.kind <> old.kind
     or new.target_relation <> old.target_relation then
    raise exception 'The synthetic rehearsal adapter identity is immutable.' using errcode = '42501';
  end if;
  new.updated_at := statement_timestamp();
  return new;
end $$;
revoke all on function private.offboarding_purge_rehearsal_adapter_guard() from public, anon, authenticated;

drop trigger if exists offboarding_purge_rehearsal_adapter_identity_guard on private.offboarding_purge_rehearsal_adapter;
create trigger offboarding_purge_rehearsal_adapter_identity_guard
  before update or delete on private.offboarding_purge_rehearsal_adapter
  for each row execute function private.offboarding_purge_rehearsal_adapter_guard();

create or replace function private.offboarding_purge_rehearsal_job_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Offboarding purge rehearsal jobs are retained.' using errcode = '42501';
  end if;
  if row(new.case_id, new.tenant_id, new.approval_request_id, new.preview_receipt_id,
         new.export_generation_id, new.adapter_key, new.idempotency_key, new.request_sha256,
         new.preview_snapshot_sha256, new.manifest_sha256, new.queued_by, new.queued_at, new.expires_at)
     is distinct from
     row(old.case_id, old.tenant_id, old.approval_request_id, old.preview_receipt_id,
         old.export_generation_id, old.adapter_key, old.idempotency_key, old.request_sha256,
         old.preview_snapshot_sha256, old.manifest_sha256, old.queued_by, old.queued_at, old.expires_at) then
    raise exception 'Offboarding purge rehearsal bindings are immutable.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.offboarding_purge_rehearsal_job_guard() from public, anon, authenticated;

drop trigger if exists offboarding_purge_rehearsal_job_guard on private.offboarding_purge_rehearsal_job;
create trigger offboarding_purge_rehearsal_job_guard
  before update or delete on private.offboarding_purge_rehearsal_job
  for each row execute function private.offboarding_purge_rehearsal_job_guard();

drop trigger if exists offboarding_purge_rehearsal_receipt_guard on private.offboarding_purge_rehearsal_receipt;
create trigger offboarding_purge_rehearsal_receipt_guard
  before update or delete on private.offboarding_purge_rehearsal_receipt
  for each row execute function private.offboarding_purge_rehearsal_immutable();

create or replace function private.offboarding_purge_rehearsal_entitled(want_tenant text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.billing_account_tenants bt
      join public.subscriptions s on s.billing_account_id = bt.billing_account_id
      join public.subscription_entitlements e on e.subscription_id = s.id
     where bt.tenant_id = want_tenant
       and s.status in ('trialing', 'active')
       and s.current_period_end > statement_timestamp()
       and e.entitlement_key = 'offboarding.purge_rehearsal'
       and e.value = 'true'::jsonb
  );
$$;
revoke all on function private.offboarding_purge_rehearsal_entitled(text) from public, anon, authenticated;

create or replace function public.queue_school_purge_rehearsal(
  want_case uuid, want_preview_receipt uuid, want_approval_request uuid, want_idempotency_key text
)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  me uuid := private.offboarding_operator();
  c public.school_offboarding;
  p private.offboarding_purge_preview_receipt;
  g private.offboarding_export_generation;
  req public.approval_request;
  prior private.offboarding_purge_rehearsal_job;
  made private.offboarding_purge_rehearsal_job;
  tenant_is_demo boolean;
  request_hash text;
  approval_count integer;
  until timestamptz;
begin
  if not private.has_capability('console:operate', 'platform', '') then
    raise exception 'Platform console authority is required.' using errcode = '42501';
  end if;
  if not private.has_capability('offboarding:purge-rehearse', 'platform', '') then
    raise exception 'The synthetic purge-rehearsal capability is off.' using errcode = '42501';
  end if;
  if want_idempotency_key is null or want_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$' then
    raise exception 'Use an idempotency key of 8-120 letters, numbers, dots, colons, underscores, or hyphens.' using errcode = '22023';
  end if;

  select o, s.is_demo into c, tenant_is_demo
    from public.school_offboarding o join public.schools s on s.id = o.tenant_id
   where o.id = want_case;
  if not found then raise exception 'No such case.' using errcode = 'no_data_found'; end if;
  if tenant_is_demo is distinct from true then
    raise exception 'A purge rehearsal is available only for a synthetic demo tenant.' using errcode = '42501';
  end if;
  c := private.offboarding_case(want_case, array['archived']);

  select * into p from private.offboarding_purge_preview_receipt where id = want_preview_receipt;
  select * into g from private.offboarding_export_generation where id = c.export_generation_id;
  select * into req from public.approval_request where id = want_approval_request;
  select count(distinct d.approver) into approval_count from public.approval_decision d
   where d.request_id = want_approval_request and d.decision = 'approve';

  if p.id is null or p.case_id <> c.id or p.tenant_id <> c.tenant_id then
    raise exception 'The purge preview receipt does not belong to this exact case and tenant.' using errcode = '23514';
  end if;
  if p.generated_at + interval '30 minutes' <= statement_timestamp() then
    raise exception 'The purge preview receipt expired; generate and review a new one.' using errcode = '23514';
  end if;
  if coalesce((p.preview ->> 'conditions_satisfied_for_future_review')::boolean, false) is not true
     or coalesce(jsonb_array_length(p.preview -> 'blockers'), 0) <> 0 then
    raise exception 'The bound purge preview still has blockers.' using errcode = '23514';
  end if;
  if g.id is null or g.case_id <> c.id or g.tenant_id <> c.tenant_id
     or g.manifest_sha256 <> c.export_sha256 or g.package_sha256 <> c.export_package_sha256
     or g.counts <> c.export_counts
     or g.manifest_sha256 <> encode(pg_catalog.sha256(pg_catalog.convert_to(g.manifest::text, 'UTF8')), 'hex')
     or c.export_verified_at is null or g.generated_at + interval '24 hours' <= statement_timestamp() then
    raise exception 'The verified export manifest is missing, changed, or expired.' using errcode = '23514';
  end if;
  if c.purge_authorized_at is null then
    raise exception 'The archived case has no separate purge authorization.' using errcode = '23514';
  end if;
  if private.school_live_holds(c.tenant_id) > 0 then
    raise exception 'A legal hold blocks the purge rehearsal.' using errcode = '23514';
  end if;
  if c.retain_until is null or c.retain_until > statement_timestamp() then
    raise exception 'The retention window is still open.' using errcode = '23514';
  end if;
  if public.feature_state('offboarding.purge_rehearsal', c.tenant_id) <> 'sandbox' then
    raise exception 'The synthetic rehearsal rollout is off.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tenant_rollout r
                  where r.tenant_id = c.tenant_id and r.state in ('suspended', 'archived')) then
    raise exception 'The tenant rollout is not suspended or archived.' using errcode = '23514';
  end if;
  if not private.offboarding_purge_rehearsal_entitled(c.tenant_id) then
    raise exception 'The synthetic rehearsal entitlement is off.' using errcode = '42501';
  end if;
  if public.kill_switch_engaged('kill.writeback', c.tenant_id)
     or public.kill_switch_engaged('kill.integration_sync', c.tenant_id) then
    raise exception 'A kill switch has stopped the purge rehearsal.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from private.offboarding_purge_rehearsal_adapter a
     where a.adapter_key = 'synthetic_discard_v1' and a.kind = 'synthetic'
       and a.target_relation = 'private.offboarding_purge_rehearsal_fixture' and a.enabled
  ) then
    raise exception 'The synthetic rehearsal adapter is disabled.' using errcode = '42501';
  end if;
  if req.id is null or req.duty_id <> 'offboarding-purge-rehearsal' or req.status <> 'executed'
     or req.expires_at <= statement_timestamp() or req.tenant_id is not null
     or req.detail ->> 'tenant_id' <> c.tenant_id
     or req.target <> c.id::text or req.detail ->> 'preview_receipt_id' <> p.id::text
     or req.detail ->> 'adapter' <> 'synthetic_discard_v1' or approval_count < 2 then
    raise exception 'An unexpired, executed, two-person approval scoped to this case and preview is required.' using errcode = '42501';
  end if;
  if req.requester <> me and not exists (
    select 1 from public.approval_decision d where d.request_id = req.id and d.approver = me and d.decision = 'approve'
  ) then
    raise exception 'Only the approval requester or one of its approvers may queue the rehearsal.' using errcode = '42501';
  end if;

  request_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    c.id::text || chr(31) || c.tenant_id || chr(31) || p.id::text || chr(31) || p.snapshot_sha256 || chr(31) ||
    g.id::text || chr(31) || g.manifest_sha256 || chr(31) || req.id::text || chr(31) ||
    'synthetic_discard_v1' || chr(31) || want_idempotency_key, 'UTF8')), 'hex');

  select * into prior from private.offboarding_purge_rehearsal_job
   where case_id = c.id and idempotency_key = want_idempotency_key for update;
  if found then
    if prior.queued_by <> me then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'replay_operator_mismatch', 'message', 'Only the operator who queued this key may replay it.'));
    end if;
    if prior.request_sha256 <> request_hash then
      return jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'binding_changed', 'message', 'The approval, preview, manifest, adapter, or tenant binding changed. Use a new reviewed key.'));
    end if;
    return jsonb_build_object('ok', true, 'replayed', true, 'job_id', prior.id,
      'status', prior.status, 'expires_at', prior.expires_at, 'synthetic_only', true);
  end if;

  until := least(req.expires_at, p.generated_at + interval '30 minutes', g.generated_at + interval '24 hours');
  insert into private.offboarding_purge_rehearsal_job
    (case_id, tenant_id, approval_request_id, preview_receipt_id, export_generation_id, adapter_key,
     idempotency_key, request_sha256, preview_snapshot_sha256, manifest_sha256, queued_by, queued_at, expires_at)
  values
    (c.id, c.tenant_id, req.id, p.id, g.id, 'synthetic_discard_v1', want_idempotency_key,
     request_hash, p.snapshot_sha256, g.manifest_sha256, me, statement_timestamp(), until)
  returning * into made;

  perform private.record_audit(c.tenant_id, 'school.offboarding_purge_rehearsal_queued',
    'school_offboarding', c.id::text, 'allowed', null,
    jsonb_build_object('job', made.id, 'approval', req.id, 'preview_receipt', p.id,
      'manifest_sha256', g.manifest_sha256, 'adapter', made.adapter_key, 'synthetic_only', true));
  return jsonb_build_object('ok', true, 'replayed', false, 'job_id', made.id,
    'status', made.status, 'expires_at', made.expires_at, 'synthetic_only', true);
end $$;

revoke all on function public.queue_school_purge_rehearsal(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.queue_school_purge_rehearsal(uuid, uuid, uuid, text) to authenticated;

create or replace function private.stop_offboarding_purge_rehearsal(want_job uuid, why text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare j private.offboarding_purge_rehearsal_job; made private.offboarding_purge_rehearsal_receipt;
begin
  select * into j from private.offboarding_purge_rehearsal_job where id = want_job for update;
  if not found then raise exception 'No such rehearsal job.' using errcode = 'no_data_found'; end if;
  select * into made from private.offboarding_purge_rehearsal_receipt where job_id = j.id;
  if found then
    return jsonb_build_object('ok', true, 'job_id', j.id, 'status', made.status,
      'receipt_id', made.id, 'replayed', true, 'synthetic_only', true);
  end if;
  if j.status = 'completed' then raise exception 'The rehearsal already completed.' using errcode = '23514'; end if;
  update private.offboarding_purge_rehearsal_job
     set status = 'stopped', stopped_reason = left(why, 200), finished_at = statement_timestamp()
   where id = j.id;
  insert into private.offboarding_purge_rehearsal_receipt
    (job_id, case_id, tenant_id, status, reason, adapter_key, created_at)
  values (j.id, j.case_id, j.tenant_id, 'stopped', left(why, 200), j.adapter_key, statement_timestamp())
  returning * into made;
  perform private.record_audit(j.tenant_id, 'school.offboarding_purge_rehearsal_stopped',
    'school_offboarding', j.case_id::text, 'denied', null,
    jsonb_build_object('job', j.id, 'receipt', made.id, 'reason', left(why, 200), 'synthetic_only', true));
  return jsonb_build_object('ok', true, 'job_id', j.id, 'status', 'stopped',
    'receipt_id', made.id, 'replayed', false, 'synthetic_only', true);
end $$;
revoke all on function private.stop_offboarding_purge_rehearsal(uuid, text) from public, anon, authenticated;

create or replace function public.stop_school_purge_rehearsal(want_job uuid, why text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := private.offboarding_operator(); j private.offboarding_purge_rehearsal_job;
begin
  if not private.has_capability('console:operate', 'platform', '') then
    raise exception 'Platform console authority is required.' using errcode = '42501';
  end if;
  if why is null or length(btrim(why)) < 8 then
    raise exception 'A stop reason of at least 8 characters is required.' using errcode = '22023';
  end if;
  select * into j from private.offboarding_purge_rehearsal_job where id = want_job;
  if not found then raise exception 'No such rehearsal job.' using errcode = 'no_data_found'; end if;
  if j.queued_by <> me and not private.is_app_admin() then
    raise exception 'Only the queueing operator or a platform administrator may stop this rehearsal.' using errcode = '42501';
  end if;
  return private.stop_offboarding_purge_rehearsal(want_job, 'operator_stop: ' || btrim(why));
end $$;
revoke all on function public.stop_school_purge_rehearsal(uuid, text) from public, anon;
grant execute on function public.stop_school_purge_rehearsal(uuid, text) to authenticated;

create or replace function public.run_school_purge_rehearsal(want_job uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' set timezone = 'UTC' as $$
declare
  j private.offboarding_purge_rehearsal_job;
  c public.school_offboarding;
  p private.offboarding_purge_preview_receipt;
  g private.offboarding_export_generation;
  req public.approval_request;
  snapshot jsonb;
  before_hash text;
  discard_hash text;
  restored_hash text;
  fixtures integer;
  affected bigint;
  request_hash text;
  made private.offboarding_purge_rehearsal_receipt;
begin
  select * into j from private.offboarding_purge_rehearsal_job where id = want_job for update;
  if not found then raise exception 'No such rehearsal job.' using errcode = 'no_data_found'; end if;
  if j.status = 'completed' then
    select * into made from private.offboarding_purge_rehearsal_receipt where job_id = j.id;
    return jsonb_build_object('ok', true, 'replayed', true, 'job_id', j.id, 'status', 'completed',
      'receipt_id', made.id, 'restore_verified', made.restore_verified, 'synthetic_only', true);
  end if;
  if j.status = 'stopped' then
    return private.stop_offboarding_purge_rehearsal(j.id, coalesce(j.stopped_reason, 'already_stopped'));
  end if;
  if j.status <> 'queued' then raise exception 'The rehearsal job is already running.' using errcode = '55P03'; end if;

  select * into c from public.school_offboarding where id = j.case_id;
  select * into p from private.offboarding_purge_preview_receipt where id = j.preview_receipt_id;
  select * into g from private.offboarding_export_generation where id = j.export_generation_id;
  select * into req from public.approval_request where id = j.approval_request_id;

  if j.expires_at <= statement_timestamp() then
    return private.stop_offboarding_purge_rehearsal(j.id, 'expired_before_worker_claim');
  end if;
  if not exists (
    select 1 from public.role_grants rg
      join public.role_capabilities rc on rc.role = rg.role
     where rg.subject = j.queued_by
       and rg.scope_kind = 'platform' and rg.scope_id = ''
       and rg.revoked_at is null and (rg.expires_at is null or rg.expires_at > statement_timestamp())
       and rc.capability = 'offboarding:purge-rehearse'
  ) then
    return private.stop_offboarding_purge_rehearsal(j.id, 'queueing_operator_capability_revoked');
  end if;
  if public.kill_switch_engaged('kill.writeback', j.tenant_id)
     or public.kill_switch_engaged('kill.integration_sync', j.tenant_id) then
    return private.stop_offboarding_purge_rehearsal(j.id, 'kill_switch_engaged');
  end if;
  if not exists (select 1 from public.schools s where s.id = j.tenant_id and s.is_demo)
     or c.status <> 'archived' or c.tenant_id <> j.tenant_id then
    return private.stop_offboarding_purge_rehearsal(j.id, 'synthetic_or_case_boundary_changed');
  end if;
  if private.school_live_holds(j.tenant_id) > 0
     or c.retain_until is null or c.retain_until > statement_timestamp() then
    return private.stop_offboarding_purge_rehearsal(j.id, 'legal_hold_or_retention_changed');
  end if;
  if c.purge_authorized_at is null or c.export_verified_at is null
     or p.case_id <> j.case_id or p.tenant_id <> j.tenant_id
     or g.case_id <> j.case_id or g.tenant_id <> j.tenant_id
     or p.generated_at + interval '30 minutes' <= statement_timestamp()
     or g.generated_at + interval '24 hours' <= statement_timestamp()
     or coalesce((p.preview ->> 'conditions_satisfied_for_future_review')::boolean, false) is not true
     or coalesce(jsonb_array_length(p.preview -> 'blockers'), 0) <> 0 then
    return private.stop_offboarding_purge_rehearsal(j.id, 'authorization_or_bound_evidence_expired');
  end if;
  if public.feature_state('offboarding.purge_rehearsal', j.tenant_id) <> 'sandbox'
     or not private.offboarding_purge_rehearsal_entitled(j.tenant_id)
     or not exists (select 1 from public.tenant_rollout r
                     where r.tenant_id = j.tenant_id and r.state in ('suspended', 'archived'))
     or not exists (select 1 from private.offboarding_purge_rehearsal_adapter a
                      where a.adapter_key = j.adapter_key and a.enabled and a.kind = 'synthetic'
                        and a.target_relation = 'private.offboarding_purge_rehearsal_fixture') then
    return private.stop_offboarding_purge_rehearsal(j.id, 'rollout_entitlement_or_adapter_disabled');
  end if;

  request_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(
    c.id::text || chr(31) || c.tenant_id || chr(31) || p.id::text || chr(31) || p.snapshot_sha256 || chr(31) ||
    g.id::text || chr(31) || g.manifest_sha256 || chr(31) || req.id::text || chr(31) ||
    j.adapter_key || chr(31) || j.idempotency_key, 'UTF8')), 'hex');
  if request_hash <> j.request_sha256 or p.snapshot_sha256 <> j.preview_snapshot_sha256
     or g.manifest_sha256 <> j.manifest_sha256 or g.manifest_sha256 <> c.export_sha256
     or g.package_sha256 <> c.export_package_sha256 or g.counts <> c.export_counts
     or g.manifest_sha256 <> encode(pg_catalog.sha256(pg_catalog.convert_to(g.manifest::text, 'UTF8')), 'hex')
     or req.duty_id <> 'offboarding-purge-rehearsal' or req.status <> 'executed'
     or req.expires_at <= statement_timestamp() or req.tenant_id is not null
     or req.detail ->> 'tenant_id' <> j.tenant_id or req.target <> j.case_id::text
     or req.detail ->> 'preview_receipt_id' <> p.id::text or req.detail ->> 'adapter' <> j.adapter_key
     or (select count(distinct d.approver) from public.approval_decision d
          where d.request_id = req.id and d.decision = 'approve') < 2 then
    return private.stop_offboarding_purge_rehearsal(j.id, 'bound_evidence_changed_or_tampered');
  end if;

  update private.offboarding_purge_rehearsal_job set status = 'running', started_at = statement_timestamp() where id = j.id;
  insert into private.offboarding_purge_rehearsal_fixture (job_id, fixture_key, payload)
  select j.id, e.key, jsonb_build_object('source_table', e.key, 'surrogate_row_count', e.value::bigint)
    from jsonb_each_text(p.preview -> 'affected_records' -> 'tables') e
  on conflict (job_id, fixture_key) do nothing;

  select coalesce(jsonb_agg(jsonb_build_object('fixture_key', f.fixture_key, 'payload', f.payload)
           order by f.fixture_key), '[]'::jsonb), count(*)::integer
    into snapshot, fixtures from private.offboarding_purge_rehearsal_fixture f where f.job_id = j.id;
  affected := coalesce((p.preview -> 'affected_records' ->> 'total_records')::bigint, 0);
  before_hash := encode(pg_catalog.sha256(pg_catalog.convert_to(snapshot::text, 'UTF8')), 'hex');

  delete from private.offboarding_purge_rehearsal_fixture where job_id = j.id;
  discard_hash := encode(pg_catalog.sha256(pg_catalog.convert_to('[]', 'UTF8')), 'hex');

  insert into private.offboarding_purge_rehearsal_fixture (job_id, fixture_key, payload)
  select j.id, x.fixture_key, x.payload from jsonb_to_recordset(snapshot) as x(fixture_key text, payload jsonb);
  select encode(pg_catalog.sha256(pg_catalog.convert_to(coalesce(jsonb_agg(
           jsonb_build_object('fixture_key', f.fixture_key, 'payload', f.payload) order by f.fixture_key), '[]'::jsonb)::text, 'UTF8')), 'hex')
    into restored_hash from private.offboarding_purge_rehearsal_fixture f where f.job_id = j.id;
  if restored_hash <> before_hash then
    raise exception 'Synthetic restore verification failed; the transaction was rolled back.' using errcode = 'XX001';
  end if;

  update private.offboarding_purge_rehearsal_job set status = 'completed', finished_at = statement_timestamp() where id = j.id;
  insert into private.offboarding_purge_rehearsal_receipt
    (job_id, case_id, tenant_id, status, fixture_count, affected_record_count,
     before_sha256, discard_sha256, restored_sha256, restore_verified, adapter_key, created_at)
  values (j.id, j.case_id, j.tenant_id, 'completed', fixtures, affected,
          before_hash, discard_hash, restored_hash, true, j.adapter_key, statement_timestamp())
  returning * into made;
  perform private.record_audit(j.tenant_id, 'school.offboarding_purge_rehearsal_completed',
    'school_offboarding', j.case_id::text, 'allowed', null,
    jsonb_build_object('job', j.id, 'receipt', made.id, 'fixture_count', fixtures,
      'affected_record_count', affected, 'before_sha256', before_hash,
      'restored_sha256', restored_hash, 'restore_verified', true,
      'adapter', j.adapter_key, 'synthetic_only', true));
  return jsonb_build_object('ok', true, 'replayed', false, 'job_id', j.id, 'status', 'completed',
    'receipt_id', made.id, 'fixture_count', fixtures, 'affected_record_count', affected,
    'before_sha256', before_hash, 'discard_sha256', discard_hash,
    'restored_sha256', restored_hash, 'restore_verified', true, 'synthetic_only', true);
end $$;

revoke all on function public.run_school_purge_rehearsal(uuid) from public, anon, authenticated;
grant execute on function public.run_school_purge_rehearsal(uuid) to service_role;

comment on table private.offboarding_purge_rehearsal_job is
  'Queue bindings for synthetic-only purge rehearsals. No job can name a live adapter or tenant-data relation.';
comment on table private.offboarding_purge_rehearsal_receipt is
  'Immutable stop or restore-verification receipt for a synthetic-only purge rehearsal.';
comment on function public.queue_school_purge_rehearsal(uuid, uuid, uuid, text) is
  'Queues a gated synthetic fixture rehearsal; it cannot delete or alter tenant records.';
comment on function public.run_school_purge_rehearsal(uuid) is
  'Service-only worker that deletes and restores private surrogate fixtures. It has no tenant-record delete path.';
