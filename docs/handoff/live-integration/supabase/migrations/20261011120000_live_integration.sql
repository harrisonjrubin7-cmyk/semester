-- Semester live integration layer. Additive only. Review against the repo's 233 existing migrations before applying.
-- Everything is deny-by-default: RLS enabled AND forced; clients read only their own grants and their tenants' capability flags.
-- Every write goes through edge functions using the service role, after a grant + capability + approval check.

-- 1. Who can open which workspace, per institution (the platform shell reads this after real sign-in)
create table if not exists public.live_workspace_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid not null,
  workspace text not null check (workspace in ('public','student','faculty','advisor','registrar','finance','student_affairs','institution','company','operations','external','developer','community','library')),
  valid_until timestamptz,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, institution_id, workspace)
);

-- 2. Per-tenant capability switches. Default OFF. Enabling needs a named approver and an approval reference.
create table if not exists public.live_tenant_capabilities (
  institution_id uuid not null,
  capability text not null check (capability in ('auth.sso','sis.read','lms.lti','payments.checkout','messaging.send','writes.registration','writes.grades','writes.records')),
  enabled boolean not null default false,
  approval_ref text,
  enabled_by uuid references auth.users(id),
  enabled_at timestamptz,
  kill_switch boolean not null default false,
  primary key (institution_id, capability),
  constraint enabled_needs_approval check (not enabled or (approval_ref is not null and enabled_by is not null and enabled_at is not null))
);

-- 3. Integration connections. Non-secret config only; secret_ref names an Edge Function secret, never the secret itself.
create table if not exists public.live_integration_connections (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  kind text not null check (kind in ('oneroster','lti13','stripe','postmark')),
  config jsonb not null default '{}'::jsonb,
  secret_ref text,
  status text not null default 'disabled' check (status in ('disabled','sandbox','active','revoked')),
  created_at timestamptz not null default now(),
  unique (institution_id, kind)
);

-- 4. SIS staging: raw source records land here; they are NOT official Semester records until reconciled.
create table if not exists public.live_sis_staging (
  institution_id uuid not null,
  object_type text not null,
  source_key text not null,
  source_version text,
  payload jsonb not null,
  observed_at timestamptz not null default now(),
  batch_id uuid not null,
  primary key (institution_id, object_type, source_key)
);

-- 5. Command receipts: idempotent institutional writes. Same key returns the same receipt.
create table if not exists public.live_command_receipts (
  institution_id uuid not null,
  idempotency_key text not null,
  actor uuid not null references auth.users(id),
  command text not null,
  payload_hash text not null,
  status text not null check (status in ('accepted','rejected','unknown','reconciled')),
  source_ref text,
  created_at timestamptz not null default now(),
  primary key (institution_id, idempotency_key)
);

-- 6. Outbox: committed with the receipt; a worker delivers to the source system.
create table if not exists public.live_outbox (
  id bigserial primary key,
  institution_id uuid not null,
  aggregate text not null,
  event text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  attempts int not null default 0,
  last_error text
);

-- 7. Payments ledger (Stripe is the processor; Semester never stores card data)
create table if not exists public.live_payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  user_id uuid not null references auth.users(id),
  stripe_session text unique,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'usd',
  purpose text not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Messages (bodies are stored by reference; provider id kept for delivery tracking)
create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null,
  sender uuid not null references auth.users(id),
  recipient uuid not null references auth.users(id),
  channel text not null check (channel in ('email','in_app')),
  subject text not null,
  body text not null check (length(body) <= 20000),
  provider_id text,
  status text not null default 'queued' check (status in ('queued','sent','failed','bounced')),
  created_at timestamptz not null default now()
);

-- RLS: enable + force everywhere
do $$ declare t text; begin
  foreach t in array array['live_workspace_grants','live_tenant_capabilities','live_integration_connections','live_sis_staging','live_command_receipts','live_outbox','live_payments','live_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Client-readable rows only
create policy live_grants_read_own on public.live_workspace_grants for select to authenticated
  using (user_id = auth.uid() and (valid_until is null or valid_until > now()));
create policy live_caps_read_member on public.live_tenant_capabilities for select to authenticated
  using (exists (select 1 from public.live_workspace_grants g where g.user_id = auth.uid() and g.institution_id = live_tenant_capabilities.institution_id and (g.valid_until is null or g.valid_until > now())));
create policy live_payments_read_own on public.live_payments for select to authenticated using (user_id = auth.uid());
create policy live_messages_read_party on public.live_messages for select to authenticated using (auth.uid() in (sender, recipient));
grant select on public.live_workspace_grants, public.live_tenant_capabilities, public.live_payments, public.live_messages to authenticated;
-- No client insert/update/delete policies exist: writes are service-role only, through the edge functions.

-- Atomic receipt + outbox. Service role only.
create or replace function public.live_record_command(p_institution uuid, p_key text, p_actor uuid, p_command text, p_hash text, p_payload jsonb)
returns public.live_command_receipts language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.live_command_receipts;
begin
  select * into r from public.live_command_receipts where institution_id = p_institution and idempotency_key = p_key;
  if found then
    if r.payload_hash <> p_hash then raise exception 'idempotency key reused with a different payload' using errcode = '22023'; end if;
    return r;
  end if;
  insert into public.live_command_receipts(institution_id, idempotency_key, actor, command, payload_hash, status)
    values (p_institution, p_key, p_actor, p_command, p_hash, 'accepted') returning * into r;
  insert into public.live_outbox(institution_id, aggregate, event, payload) values (p_institution, p_command, 'command.accepted', jsonb_build_object('idempotency_key', p_key, 'payload', p_payload));
  return r;
end $$;
revoke execute on function public.live_record_command(uuid,text,uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.live_record_command(uuid,text,uuid,text,text,jsonb) to service_role;

-- Verification (run after applying; every row should be true/true)
-- select relname, relrowsecurity, relforcerowsecurity from pg_class where relname like 'live\_%' and relkind = 'r';
