-- Platform primitives: the schema contract.
--
-- STATUS: PROPOSED CONTRACT. NOT A MIGRATION. NOT APPLIED. NOT RUN AGAINST POSTGRES.
--
-- This file lives under docs/ on purpose. A file under supabase/migrations/ is
-- applied by supabase/check.sh against a disposable PostgreSQL 17 and
-- fingerprinted; this one was parsed for syntax only (libpg_query, via the
-- pglast Python package) because no PostgreSQL server was available when it
-- was written, and it has never executed. Turning it into migrations is the first
-- step of docs/platform/MIGRATION.md, and each table there ships with a
-- .check.sql suite that walks a second tenant (CLAUDE.md, ADR 0002) — a
-- policy is only ever wrong when a second account is involved.
--
-- What it fixes, in one place:
--   1. One request-context contract:   app.tenant_id(), app.person_id(), …
--   2. Tenant-bearing composite keys:  a child cannot name a parent in another tenant.
--   3. Deny-by-default, FORCED RLS:    the table owner is not exempt.
--   4. The platform primitives' tables: idempotency, audit chain, org tree,
--      affiliations, relationships, consent, approvals, flags, files.
--
-- What it deliberately does not redefine:
--   - private.domain_outbox_events / private.domain_event_receipts
--     (20260928320000_audit_correlation_and_outbox.sql, ADR 0008) — reused as is.
--   - private.has_capability(), app_roles, role_capabilities, role_grants
--     (ADR 0002) — the capability resolver in TypeScript is checked against
--     them side by side before any caller switches (MIGRATION.md, phase 2).
--
-- The enumerations below are mirrored by packages/platform/src and compared by
-- packages/platform/src/schema.test.ts, so the SQL and the TypeScript cannot
-- drift apart silently.

create schema if not exists app;
create schema if not exists platform;

-- ── 1. The request context ────────────────────────────────────────────────
-- A privileged server transaction calls app.set_request_context() once, from
-- the tenant the *server* resolved (never a header the client sent), and every
-- policy below reads it. A missing value raises: fail closed, not "no rows".

create or replace function app.set_request_context(
  p_tenant_id text,
  p_person_id text,
  p_membership_id text,
  p_purpose text,
  p_request_id text
) returns void
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if p_tenant_id is null or p_person_id is null or p_request_id is null then
    raise exception 'request context requires tenant, person and request id' using errcode = '28000';
  end if;
  perform set_config('app.tenant_id', p_tenant_id, true);       -- true = local to the transaction
  perform set_config('app.person_id', p_person_id, true);
  perform set_config('app.membership_id', coalesce(p_membership_id, ''), true);
  perform set_config('app.request_purpose', coalesce(p_purpose, 'service_delivery'), true);
  perform set_config('app.request_id', p_request_id, true);
end;
$$;

create or replace function app.tenant_id() returns text
language plpgsql
stable
set search_path = pg_catalog
as $$
declare v text := nullif(current_setting('app.tenant_id', true), '');
begin
  if v is null then
    raise exception 'no tenant in request context' using errcode = '28000';
  end if;
  return v;
end;
$$;

create or replace function app.person_id() returns text
language plpgsql
stable
set search_path = pg_catalog
as $$
declare v text := nullif(current_setting('app.person_id', true), '');
begin
  if v is null then
    raise exception 'no person in request context' using errcode = '28000';
  end if;
  return v;
end;
$$;

create domain platform.id as text
  check (value ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$');

-- ── 2. Organization tree ──────────────────────────────────────────────────

create table platform.tenant (
  id                  platform.id primary key,
  customer_account_id platform.id not null,
  name                text not null check (length(name) between 1 and 200),
  environment         text not null check (environment in ('production', 'staging', 'demo')),
  status              text not null check (status in ('provisioning', 'active', 'suspended', 'closing', 'closed')),
  data_zone           text not null check (data_zone in ('us', 'eu', 'ca', 'uk')),
  created_at          timestamptz not null default now()
);

create table platform.org_node (
  tenant_id   platform.id not null references platform.tenant (id),
  id          platform.id not null,
  kind        text not null check (kind in ('campus', 'college', 'department', 'program', 'term', 'section', 'cohort', 'group')),
  parent_id   platform.id,
  name        text not null check (length(name) between 1 and 200),
  primary key (tenant_id, id),
  -- The composite key is the whole point: a parent in another tenant cannot be named.
  foreign key (tenant_id, parent_id) references platform.org_node (tenant_id, id)
);

-- ── 3. Identity: affiliations, relationships, consent ─────────────────────

create table platform.affiliation (
  tenant_id   platform.id not null references platform.tenant (id),
  id          platform.id not null,
  person_id   platform.id not null,
  kind        text not null check (kind in ('applicant', 'student', 'faculty', 'staff', 'teaching_assistant', 'alumnus', 'guardian_contact', 'partner', 'lifelong_learner')),
  status      text not null check (status in ('pending', 'active', 'on_leave', 'ended')),
  node_id     platform.id,
  source      text not null check (source in ('institution_record', 'idp_attribute', 'scim', 'self_declared')),
  valid_from  timestamptz not null,
  valid_to    timestamptz,
  primary key (tenant_id, id),
  foreign key (tenant_id, node_id) references platform.org_node (tenant_id, id),
  check (valid_to is null or valid_to > valid_from),
  -- A self-declaration cannot make anyone faculty or staff.
  check (source <> 'self_declared' or kind in ('applicant', 'lifelong_learner', 'student'))
);

create table platform.relationship (
  tenant_id         platform.id not null references platform.tenant (id),
  id                platform.id not null,
  from_person_id    platform.id not null,
  to_person_id      platform.id not null,
  kind              text not null check (kind in ('guardian_of', 'payer_for', 'advisor_of', 'instructor_of', 'mentor_of', 'emergency_contact_of')),
  verification      text not null check (verification in ('unverified', 'student_confirmed', 'institution_verified', 'document_verified')),
  valid_from        timestamptz not null,
  valid_to          timestamptz,
  ended_at          timestamptz,
  primary key (tenant_id, id),
  check (from_person_id <> to_person_id)
);

create table platform.consent (
  tenant_id            platform.id not null references platform.tenant (id),
  id                   platform.id not null,
  subject_person_id    platform.id not null,
  granted_by_person_id platform.id not null,
  on_behalf_of_person_id platform.id,
  grantee_person_id    platform.id not null,
  purpose              text not null check (purpose in ('support_access', 'guardian_sharing', 'advisor_sharing', 'agenda_sharing', 'ai_context', 'marketing', 'research', 'career_sharing')),
  scopes               text[] not null check (cardinality(scopes) > 0),
  resource_ids         text[] not null check (cardinality(resource_ids) > 0),
  evidence             text not null check (evidence in ('in_app_confirmation', 'signed_form', 'institution_attested', 'verbal_logged')),
  policy_version       text not null,
  ticket_id            text,
  granted_at           timestamptz not null,
  expires_at           timestamptz not null,
  withdrawn_at         timestamptz,
  primary key (tenant_id, id),
  check (expires_at > granted_at),
  check (grantee_person_id <> subject_person_id),
  -- A support-access consent is bound to one ticket.
  check (purpose <> 'support_access' or ticket_id is not null)
);

-- ── 4. Idempotency ────────────────────────────────────────────────────────

create table platform.idempotency_key (
  tenant_id     platform.id not null references platform.tenant (id),
  actor_id      platform.id not null,
  command       text not null,
  key           text not null check (key ~ '^[A-Za-z0-9._:-]{16,128}$'),
  request_hash  text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  state         text not null check (state in ('in_progress', 'completed')),
  response      jsonb,
  lease_until   timestamptz not null,
  expires_at    timestamptz not null,
  primary key (tenant_id, actor_id, command, key),
  check (state <> 'completed' or response is not null)
);

create index idempotency_key_expiry on platform.idempotency_key (expires_at);

-- ── 5. Audit: append-only, hash-chained per tenant ───────────────────────
-- The content hash is computed by the application over canonical JSON
-- (packages/platform/src/kernel/canonical.ts). Postgres' jsonb does not keep
-- JavaScript's key order, so the database does NOT recompute it; it enforces
-- what it can: sequence continuity, the link to the previous hash, and that
-- nothing is ever updated or deleted. verifyAuditChain() (or a scheduled job
-- calling it) checks the content hashes.

create table platform.audit_event (
  tenant_id       platform.id not null references platform.tenant (id),
  seq             bigint not null check (seq > 0),
  id              text not null,
  at              timestamptz not null,
  actor_id        platform.id not null,
  actor_type      text not null,
  session_id      text,
  purpose         text not null,
  correlation_id  text not null check (correlation_id ~ '^[A-Za-z0-9._:-]{8,128}$'),
  request_id      text not null,
  action          text not null,
  resource_type   text not null,
  resource_id     text,
  decision        text not null check (decision in ('allowed', 'denied', 'pending_approval', 'failed')),
  reason_code     text,
  detail          jsonb,
  causation_id    text,
  prev_hash       text not null check (prev_hash ~ '^[0-9a-f]{64}$'),
  hash            text not null check (hash ~ '^[0-9a-f]{64}$'),
  primary key (tenant_id, seq),
  unique (tenant_id, id)
);

create or replace function platform.audit_event_guard() returns trigger
language plpgsql
set search_path = pg_catalog, platform
as $$
declare prev platform.audit_event%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'audit_event is append-only' using errcode = '42501';
  end if;
  -- Serialise appends per tenant so (tenant_id, seq) has no gaps and no forks.
  perform pg_advisory_xact_lock(hashtextextended('audit:' || new.tenant_id, 0));
  select * into prev from platform.audit_event where tenant_id = new.tenant_id order by seq desc limit 1;
  if not found then
    if new.seq <> 1 or new.prev_hash <> repeat('0', 64) then
      raise exception 'first audit row for a tenant must be seq 1 on the genesis hash' using errcode = '23514';
    end if;
  elsif new.seq <> prev.seq + 1 or new.prev_hash <> prev.hash then
    raise exception 'audit chain broken for tenant %', new.tenant_id using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger audit_event_insert before insert on platform.audit_event
  for each row execute function platform.audit_event_guard();
create trigger audit_event_no_update before update or delete on platform.audit_event
  for each row execute function platform.audit_event_guard();
create trigger audit_event_no_truncate before truncate on platform.audit_event
  for each statement execute function platform.audit_event_guard();

-- ── 6. Approvals ──────────────────────────────────────────────────────────

create table platform.approval_request (
  tenant_id          platform.id not null references platform.tenant (id),
  id                 platform.id not null,
  action             text not null,
  subject_type       text not null,
  subject_id         text not null,
  change_hash        text not null check (change_hash ~ '^[0-9a-f]{64}$'),
  requested_by       platform.id not null,
  requested_at       timestamptz not null,
  expires_at         timestamptz not null,
  required_approvals integer not null check (required_approvals >= 1),
  state              text not null check (state in ('pending', 'approved', 'rejected', 'expired', 'cancelled', 'consumed')),
  decisions          jsonb not null default '[]'::jsonb,
  primary key (tenant_id, id),
  check (expires_at > requested_at)
);

-- ── 7. Files ──────────────────────────────────────────────────────────────

create table platform.file_object (
  tenant_id       platform.id not null references platform.tenant (id),
  id              platform.id not null,
  owner_id        platform.id not null,
  classification  text not null check (classification in ('public', 'internal', 'student_private', 'education_record')),
  state           text not null check (state in ('pending_upload', 'quarantined', 'available', 'rejected', 'deleted')),
  content_type    text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  sha256          text check (sha256 ~ '^[0-9a-f]{64}$'),
  object_key      text not null,
  legal_hold      boolean not null default false,
  created_at      timestamptz not null default now(),
  primary key (tenant_id, id),
  -- The key carries the tenant, and the database refuses a key that does not match the row.
  check (starts_with(object_key, 't/' || tenant_id || '/' || classification || '/'))
);

-- ── 8. Feature flags and integrations ────────────────────────────────────

create table platform.feature_flag (
  key            text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  kind           text not null check (kind in ('release', 'ops', 'experiment', 'tenant_gated')),
  owner          text not null check (length(trim(owner)) > 0),
  default_value  boolean not null,
  kill           boolean not null default false,
  expires_at     timestamptz not null,
  rules          jsonb not null default '[]'::jsonb,
  -- Sensitive institutional features default off.
  check (kind <> 'tenant_gated' or default_value = false)
);

create table platform.connection (
  tenant_id             platform.id not null references platform.tenant (id),
  id                    platform.id not null,
  provider              text not null,
  credential_ref        text not null check (credential_ref ~ '^secret://'),
  mapping_version       text not null,
  cursor                text,
  state                 text not null check (state in ('healthy', 'degraded', 'disabled')),
  consecutive_failures  integer not null default 0 check (consecutive_failures >= 0),
  last_success_at       timestamptz,
  last_failure_at       timestamptz,
  primary key (tenant_id, id)
);

create table platform.inbox_message (
  tenant_id      platform.id not null,
  connection_id  platform.id not null,
  external_id    text not null,
  payload_hash   text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  received_at    timestamptz not null default now(),
  -- External ids are unique within (tenant, connection), never globally.
  primary key (tenant_id, connection_id, external_id),
  foreign key (tenant_id, connection_id) references platform.connection (tenant_id, id)
);

-- ── 9. Row-level security: enabled, forced, keyed on the request context ──
-- Every tenant-owned table gets the same four policies. FORCE means the table
-- owner is subject to them too; a service role that must bypass them is a
-- separate, audited decision (docs/platform/ISOLATION.md), not a default.

do $$
declare t text;
begin
  foreach t in array array[
    'org_node', 'affiliation', 'relationship', 'consent', 'idempotency_key', 'audit_event',
    'approval_request', 'file_object', 'connection', 'inbox_message'
  ] loop
    execute format('alter table platform.%I enable row level security', t);
    execute format('alter table platform.%I force row level security', t);
    execute format('create policy %I on platform.%I for select using (tenant_id = app.tenant_id())', t || '_select', t);
    execute format('create policy %I on platform.%I for insert with check (tenant_id = app.tenant_id())', t || '_insert', t);
    execute format('create policy %I on platform.%I for update using (tenant_id = app.tenant_id()) with check (tenant_id = app.tenant_id())', t || '_update', t);
    execute format('create policy %I on platform.%I for delete using (tenant_id = app.tenant_id())', t || '_delete', t);
  end loop;
end;
$$;

-- The tenant table itself: a request may read its own tenant row and nothing else.
alter table platform.tenant enable row level security;
alter table platform.tenant force row level security;
create policy tenant_select on platform.tenant for select using (id = app.tenant_id());

-- Flags are platform-global definitions; evaluation is tenant-scoped in code.
alter table platform.feature_flag enable row level security;
alter table platform.feature_flag force row level security;
create policy feature_flag_select on platform.feature_flag for select using (true);

-- Clients get nothing by default; the API's server role is granted exactly what it needs.
revoke all on all tables in schema platform from public;
revoke all on schema platform from public;
revoke all on schema app from public;
