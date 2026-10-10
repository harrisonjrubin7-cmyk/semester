-- Receipt-safe commands for existing student-account requests and one payment-
-- plan request path. This is an additive command seam over the D-146 tables:
-- their triggers remain the accounting authority. It does not reconcile,
-- charge, refund, contact a provider, store card material or move money.
--
-- Historical direct table writers remain available during rollout and produce
-- the same audit/ledger effects as before, but do not receive a command receipt.
-- The application command path is therefore retry-safe; universal command
-- enforcement is deliberately not claimed by this migration.
--
-- Idempotent. No begin/commit: the migration runner owns the transaction.

create table if not exists private.finance_command_receipts (
  id             uuid        primary key default gen_random_uuid(),
  command_key    text        not null unique check (command_key ~ '^[A-Za-z0-9_.:-]{16,128}$'),
  tenant_id      text        not null references public.schools(id) on delete cascade,
  student_ref    text        not null check (student_ref ~ '^[A-Za-z0-9._-]{1,64}$'),
  actor_id       uuid        references auth.users(id) on delete set null,
  action         text        not null check (action in (
                   'request.create', 'request.approve', 'request.reject', 'request.withdraw', 'plan.request')),
  payload_sha256 text        not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  resource_id    uuid        not null,
  state          text        not null check (state in ('proposed', 'approved', 'rejected', 'withdrawn')),
  version        bigint      not null check (version > 0),
  recorded_at    timestamptz not null default clock_timestamp()
);
create index if not exists finance_command_receipts_actor on private.finance_command_receipts (actor_id, recorded_at desc);
create index if not exists finance_command_receipts_account on private.finance_command_receipts (tenant_id, student_ref, recorded_at desc);

alter table private.finance_command_receipts enable row level security;
revoke all on table private.finance_command_receipts from public, anon, authenticated;
grant select, insert, update, delete on table private.finance_command_receipts to service_role;

create or replace function private.finance_receipt_json(r private.finance_command_receipts)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id,
    'commandKey', r.command_key,
    'action', r.action,
    'status', 'accepted',
    'resourceId', r.resource_id,
    'state', r.state,
    'version', r.version,
    'recordedAt', r.recorded_at
  )
$$;

create or replace function private.finance_receipt_authorized(r private.finance_command_receipts, caller uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when r.actor_id is distinct from caller then false
    when r.action = 'plan.request' then
      private.has_capability('finance:request', 'school', r.tenant_id)
      or exists (
        select 1 from public.academic_record_subjects s
         where s.tenant_id = r.tenant_id and s.student_ref = r.student_ref and s.user_id = caller
      )
    when r.action = 'request.create' then private.has_capability('finance:request', 'school', r.tenant_id)
    when r.action in ('request.approve', 'request.reject') then private.has_capability('finance:approve', 'school', r.tenant_id)
    when r.action = 'request.withdraw' then private.has_capability('finance:request', 'school', r.tenant_id)
    else false
  end
$$;

revoke all on function private.finance_receipt_json(private.finance_command_receipts) from public, anon, authenticated;
revoke all on function private.finance_receipt_authorized(private.finance_command_receipts, uuid) from public, anon, authenticated;

create or replace function public.finance_command(
  want_tenant text,
  want_student text,
  want_action text,
  want_key text,
  want_expected_version bigint,
  want_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  fingerprint text;
  earlier private.finance_command_receipts;
  made private.finance_command_receipts;
  target public.student_account_requests;
  resource uuid;
  result_state text;
  result_version bigint;
  note text;
begin
  if caller is null then
    raise exception 'A signed-in account is required for a finance command.' using errcode = '42501';
  end if;
  if want_key is null or want_key !~ '^[A-Za-z0-9_.:-]{16,128}$' then
    raise exception 'A finance command key is 16 to 128 letters, digits or . _ : -.' using errcode = '22023';
  end if;
  if want_action not in ('request.create', 'request.approve', 'request.reject', 'request.withdraw', 'plan.request')
     or jsonb_typeof(want_payload) is distinct from 'object' then
    raise exception 'That finance command is malformed.' using errcode = '22023';
  end if;
  if want_tenant is null or want_student is null or want_student !~ '^[A-Za-z0-9._-]{1,64}$' then
    raise exception 'That finance command is malformed.' using errcode = '22023';
  end if;

  fingerprint := encode(pg_catalog.sha256(pg_catalog.convert_to(want_payload::text, 'UTF8')), 'hex');

  -- The key is global, not merely tenant-local. A guessed retry under another
  -- actor, tenant, student or action can never become a second command.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-command:' || want_key, 0));
  select * into earlier from private.finance_command_receipts r where r.command_key = want_key;
  if earlier.id is not null then
    if earlier.actor_id is distinct from caller
       or earlier.tenant_id is distinct from want_tenant
       or earlier.student_ref is distinct from want_student
       or earlier.action is distinct from want_action
       or earlier.payload_sha256 is distinct from fingerprint then
      raise exception 'That key was already used for a different finance command.' using errcode = 'SC409';
    end if;
    if not private.finance_receipt_authorized(earlier, caller) then
      raise exception 'Your account cannot read that finance receipt.' using errcode = '42501';
    end if;
    return private.finance_receipt_json(earlier);
  end if;

  if want_action = 'request.create' and not private.has_capability('finance:request', 'school', want_tenant) then
    raise exception 'Your account cannot make requests on this school''s student accounts.' using errcode = '42501';
  elsif want_action in ('request.approve', 'request.reject')
        and not private.has_capability('finance:approve', 'school', want_tenant) then
    raise exception 'Your account cannot decide requests on this school''s student accounts.' using errcode = '42501';
  elsif want_action = 'request.withdraw' and not private.has_capability('finance:request', 'school', want_tenant) then
    raise exception 'Your account cannot withdraw requests at this school.' using errcode = '42501';
  elsif want_action = 'plan.request'
        and not private.has_capability('finance:request', 'school', want_tenant)
        and not exists (
          select 1 from public.academic_record_subjects s
           where s.tenant_id = want_tenant and s.student_ref = want_student and s.user_id = caller
        ) then
    raise exception 'Only the student, or Student Accounts, asks for a plan on this account.' using errcode = '42501';
  end if;

  if want_action = 'request.create' then
    if want_expected_version is not null
       or (want_payload - array['kind','category','amount_cents','description','reference_entry_id','provider_ref','effective_on']) <> '{}'::jsonb then
      raise exception 'That finance request command is malformed.' using errcode = '22023';
    end if;
    insert into public.student_account_requests
      (tenant_id, student_ref, kind, category, amount_cents, description, reference_entry_id, provider_ref, effective_on)
    values
      (want_tenant, want_student, want_payload->>'kind', want_payload->>'category',
       (want_payload->>'amount_cents')::bigint, trim(want_payload->>'description'),
       nullif(want_payload->>'reference_entry_id', '')::uuid, trim(coalesce(want_payload->>'provider_ref', '')),
       (want_payload->>'effective_on')::date)
    returning id, status into resource, result_state;
    result_version := 1;
  elsif want_action = 'plan.request' then
    if want_expected_version is not null
       or (want_payload - array['installments','first_due']) <> '{}'::jsonb then
      raise exception 'That payment-plan command is malformed.' using errcode = '22023';
    end if;
    insert into public.student_payment_plans (tenant_id, student_ref, installments, first_due)
    values (want_tenant, want_student, (want_payload->>'installments')::smallint, (want_payload->>'first_due')::date)
    returning id, status into resource, result_state;
    result_version := 1;
  else
    if (want_payload - array['request_id','note']) <> '{}'::jsonb or not (want_payload ? 'request_id') then
      raise exception 'That finance decision command is malformed.' using errcode = '22023';
    end if;
    resource := (want_payload->>'request_id')::uuid;
    note := trim(coalesce(want_payload->>'note', ''));
    select * into target
      from public.student_account_requests q
     where q.id = resource and q.tenant_id = want_tenant and q.student_ref = want_student
     for update;
    if target.id is null then
      raise exception 'Your account cannot reach that finance request.' using errcode = '42501';
    end if;
    result_version := case when target.status = 'proposed' then 1 else 2 end;
    if want_expected_version is null or want_expected_version <> result_version then
      raise exception 'Finance command version conflict: expected %, current %.', want_expected_version, result_version using errcode = 'SC409';
    end if;
    result_state := case want_action
      when 'request.approve' then 'approved'
      when 'request.reject' then 'rejected'
      when 'request.withdraw' then 'withdrawn'
    end;
    update public.student_account_requests
       set status = result_state, decision_note = case when want_action = 'request.withdraw' then decision_note else note end
     where id = resource
    returning status into result_state;
    result_version := 2;
  end if;

  insert into private.finance_command_receipts
    (command_key, tenant_id, student_ref, actor_id, action, payload_sha256, resource_id, state, version)
  values
    (want_key, want_tenant, want_student, caller, want_action, fingerprint, resource, result_state, result_version)
  returning * into made;

  perform private.emit_domain_event(
    'finance_command', made.id::text, 'finance.commanded', 1, want_tenant, 'finance-command',
    'fin.' || made.id::text, want_key,
    jsonb_build_object('receiptId', made.id, 'resourceId', resource, 'action', want_action,
                       'state', result_state, 'version', result_version),
    'student_private', 'student_record'
  );

  return private.finance_receipt_json(made);
end $$;

create or replace function public.finance_command_receipt(
  want_tenant text,
  want_student text,
  want_action text,
  want_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  found private.finance_command_receipts;
begin
  if caller is null then
    raise exception 'A signed-in account is required for a finance receipt.' using errcode = '42501';
  end if;
  if want_key is null or want_key !~ '^[A-Za-z0-9_.:-]{16,128}$' then
    raise exception 'A finance command key is 16 to 128 letters, digits or . _ : -.' using errcode = '22023';
  end if;
  -- Recovery participates in the same claim protocol as submission. If a
  -- command is still committing, wait before deciding if its receipt exists.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('finance-command:' || want_key, 0));
  select * into found
    from private.finance_command_receipts r
   where r.command_key = want_key
     and r.tenant_id = want_tenant
     and r.student_ref = want_student
     and r.action = want_action;
  if found.id is null or not private.finance_receipt_authorized(found, caller) then
    raise exception 'Your account cannot read that finance receipt.' using errcode = '42501';
  end if;
  return private.finance_receipt_json(found);
end $$;

revoke all on function public.finance_command(text, text, text, text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.finance_command_receipt(text, text, text, text) from public, anon, authenticated;
grant execute on function public.finance_command(text, text, text, text, bigint, jsonb) to authenticated;
grant execute on function public.finance_command_receipt(text, text, text, text) to authenticated;

comment on table private.finance_command_receipts is
  'Durable, payload-bound receipts for retry-safe student-account commands. Private; recovered only through the actor- and current-authority-checked RPC.';
comment on function public.finance_command(text, text, text, text, bigint, jsonb) is
  'Applies a bounded student-account or payment-plan command and commits its stable receipt, existing audit effects and minimized outbox event atomically. No provider execution or money movement.';
comment on function public.finance_command_receipt(text, text, text, text) is
  'Recovers one accepted finance-command receipt for its original actor while that actor still has the required current authority.';
