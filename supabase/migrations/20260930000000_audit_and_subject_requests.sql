-- One audit envelope, and a queue for the rights a person asks to use.
--
-- Full-beta G-04 and G-05. Twelve audit tables exist, each with its own shape,
-- and no common trail: a sign-in, a share, an export and a grant cannot be read
-- as one story. `audit_event` is that envelope. It is deliberately narrow — a
-- verb, the kind of object, an outcome and pseudonyms — so that writing to it
-- from any producer cannot smuggle a name, an address or content into a log.
--
-- `data_subject_request` is the queue `data_requests` never was: that table
-- records an erasure that already happened; this one records that somebody
-- asked, who is answering, and when it is due.
--
-- Additive only. Nothing here changes an existing table's behaviour.

-- ── 1. audit_event ──────────────────────────────────────────────────────────

create table if not exists public.audit_event (
  id uuid primary key default gen_random_uuid(),
  -- Null for a platform-level or pre-school event; those are service-readable
  -- only and never exposed through tenant RLS. No foreign key: removing a
  -- school must not remove the evidence of what happened in it.
  tenant_id text,
  correlation_id text check (correlation_id is null or correlation_id ~ '^[A-Za-z0-9._:-]{8,100}$'),
  -- `noun.verb`, e.g. `auth.sign_in`, `share.create`, `export.request`.
  action text not null check (action ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(action) <= 80),
  object_kind text not null check (object_kind ~ '^[a-z][a-z0-9_]{0,59}$'),
  -- A pseudonym of the object id, never the id itself.
  object_sha256 text check (object_sha256 is null or object_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text not null check (outcome in ('allowed', 'denied', 'failed')),
  actor_sha256 text check (actor_sha256 is null or actor_sha256 ~ '^[0-9a-f]{64}$'),
  actor_kind text not null check (actor_kind in ('authenticated', 'service', 'anonymous')),
  -- Small and structured. The size cap is what keeps free text out in practice.
  detail jsonb not null default '{}'::jsonb
    check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 2048),
  occurred_at timestamptz not null default now()
);

create index if not exists audit_event_by_tenant_time
  on public.audit_event (tenant_id, occurred_at desc);
create index if not exists audit_event_by_action_time
  on public.audit_event (action, occurred_at desc);
create index if not exists audit_event_by_correlation
  on public.audit_event (correlation_id) where correlation_id is not null;

alter table public.audit_event enable row level security;
revoke all on table public.audit_event from anon, authenticated;
grant select on table public.audit_event to authenticated;

drop policy if exists "tenant auditors read audit events" on public.audit_event;
create policy "tenant auditors read audit events" on public.audit_event
  for select to authenticated
  using (
    tenant_id is not null
    and private.has_capability('audit:read', 'school', tenant_id)
  );

-- The only writer. Callers are other definer code and the service role; no
-- client role can reach it, so a browser cannot write its own history.
create or replace function private.record_audit(
  p_tenant text,
  p_action text,
  p_object_kind text,
  p_object_id text,
  p_outcome text,
  p_correlation text default null,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  made uuid;
begin
  insert into public.audit_event (
    tenant_id, correlation_id, action, object_kind, object_sha256,
    outcome, actor_sha256, actor_kind, detail
  ) values (
    p_tenant,
    p_correlation,
    p_action,
    p_object_kind,
    case when p_object_id is null then null else private.role_audit_sha256(p_object_id) end,
    p_outcome,
    case when caller is null then null else private.role_audit_sha256(caller::text) end,
    case when caller is not null then 'authenticated'
         when coalesce(auth.role(), '') = 'service_role' then 'service'
         else 'anonymous' end,
    coalesce(p_detail, '{}'::jsonb)
  ) returning id into made;
  return made;
end $$;

revoke all on function private.record_audit(text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function private.record_audit(text, text, text, text, text, text, jsonb) to service_role;

create or replace function private.refuse_audit_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.audit_purge_allowed(old.occurred_at) then
    return old;
  end if;
  raise exception 'Audit events are immutable.';
end $$;

revoke all on function private.refuse_audit_event_change() from public, anon, authenticated;

create or replace trigger keep_audit_event_immutable
  before update or delete on public.audit_event
  for each row execute function private.refuse_audit_event_change();

-- Same three-year clock as the other audit tables (RETENTION.md).
create or replace function private.sweep_audit_retention()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n_role integer;
  n_moderation integer;
  n_provisioning integer;
  n_audit integer;
begin
  perform set_config('semester.audit_retention', 'sweep', true);

  delete from public.role_grant_audit_event
   where occurred_at < now() - interval '3 years';
  get diagnostics n_role = row_count;

  delete from public.moderation_audit_event
   where occurred_at < now() - interval '3 years';
  get diagnostics n_moderation = row_count;

  delete from public.provisioning_audit_event
   where occurred_at < now() - interval '3 years';
  get diagnostics n_provisioning = row_count;

  delete from public.audit_event
   where occurred_at < now() - interval '3 years';
  get diagnostics n_audit = row_count;

  perform set_config('semester.audit_retention', '', true);

  return jsonb_build_object(
    'role_grant_audit_event', n_role,
    'moderation_audit_event', n_moderation,
    'provisioning_audit_event', n_provisioning,
    'audit_event', n_audit
  );
end $$;

revoke all on function private.sweep_audit_retention() from public;
revoke all on function private.sweep_audit_retention() from anon, authenticated;
grant execute on function private.sweep_audit_retention() to service_role;

comment on table public.audit_event is
  'Append-only common audit envelope: a verb, an object kind, an outcome and SHA-256 pseudonyms. No names, addresses or content. Tenant auditors see only their school.';

-- ── 2. data_subject_request ────────────────────────────────────────────────

create table if not exists public.data_subject_request (
  id uuid primary key default gen_random_uuid(),
  -- The person the request is about. Erased with the account (the completed
  -- fact is kept, without an identity, in `data_requests`).
  subject uuid not null references auth.users(id) on delete cascade,
  tenant_id text,
  kind text not null check (kind in ('export', 'erasure', 'correction', 'restriction')),
  -- Who is asking. A guardian or institution request is never acted on
  -- until `verified_at` is set by a person on the answering side.
  requested_by text not null default 'self' check (requested_by in ('self', 'guardian', 'institution')),
  status text not null default 'received'
    check (status in ('received', 'verifying', 'in_progress', 'completed', 'refused')),
  detail text not null default '' check (length(detail) <= 1000),
  received_at timestamptz not null default now(),
  -- Thirty days is the shortest clock in the regimes that apply; a stricter
  -- tenant clause shortens it, and nothing here lengthens it.
  due_at timestamptz not null default (now() + interval '30 days'),
  verified_at timestamptz,
  resolved_at timestamptz,
  resolution text not null default '' check (length(resolution) <= 1000),
  check (resolved_at is null or status in ('completed', 'refused')),
  check (status not in ('completed', 'refused') or resolved_at is not null)
);

create index if not exists data_subject_request_by_subject
  on public.data_subject_request (subject, received_at desc);
create index if not exists data_subject_request_open_by_due
  on public.data_subject_request (due_at) where resolved_at is null;

alter table public.data_subject_request enable row level security;
revoke all on table public.data_subject_request from anon, authenticated;
grant select, insert on table public.data_subject_request to authenticated;

drop policy if exists "read your own requests" on public.data_subject_request;
create policy "read your own requests" on public.data_subject_request
  for select to authenticated
  using (subject = (select auth.uid()));

drop policy if exists "tenant auditors read requests" on public.data_subject_request;
create policy "tenant auditors read requests" on public.data_subject_request
  for select to authenticated
  using (tenant_id is not null and private.has_capability('audit:read', 'school', tenant_id));

-- A person may raise a request about themselves, as themselves, and only in
-- its starting state: they cannot open one already "completed", set their own
-- clock, or claim it was verified.
drop policy if exists "raise a request about yourself" on public.data_subject_request;
create policy "raise a request about yourself" on public.data_subject_request
  for insert to authenticated
  with check (
    subject = (select auth.uid())
    and requested_by = 'self'
    and status = 'received'
    and verified_at is null
    and resolved_at is null
    and resolution = ''
    and due_at <= now() + interval '30 days' + interval '1 minute'
    and tenant_id is not distinct from (
      select p.school_id from public.profiles p where p.user_id = (select auth.uid())
    )
  );

comment on table public.data_subject_request is
  'A rights request (export, erasure, correction, restriction) with a status and a due date. A person raises their own; answering is done by trusted services.';

-- ── 3. First producers ────────────────────────────────────────────────────
--
-- A table nothing writes to is a claim, not a trail. Two producers ship with
-- it: raising a rights request, and the export the Privacy page already offers.
-- Both record who-did-what-to-what as pseudonyms, and neither records content.

create or replace function private.audit_subject_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_audit(
    new.tenant_id,
    'privacy.request_raised',
    'data_subject_request',
    new.id::text,
    'allowed',
    null,
    jsonb_build_object('kind', new.kind, 'requested_by', new.requested_by)
  );
  return new;
end $$;

revoke all on function private.audit_subject_request() from public, anon, authenticated;

create or replace trigger audit_subject_request
  after insert on public.data_subject_request
  for each row execute function private.audit_subject_request();

create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  -- Recorded first, so the file includes the record of its own making.
  insert into public.data_requests (user_id, kind, details, status, completed_at)
  values (me, 'export', 'Downloaded by the account holder from the Privacy page.', 'completed', now());
  perform private.record_audit(
    (select p.school_id from public.profiles p where p.user_id = me),
    'privacy.export_completed',
    'account',
    me::text,
    'allowed'
  );
  return private.account_export(me);
end $$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
