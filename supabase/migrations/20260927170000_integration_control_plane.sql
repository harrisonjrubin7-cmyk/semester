-- Semester — the integration control plane.
--
-- The shared integration gateway's metadata: which external systems a
-- university has connected, what each connection may read, how external
-- fields map onto Semester's canonical entities, what every sync run did, and
-- where each imported fact came from and how fresh it is. It also adds the
-- kill switches and the data-classification ceiling every connector answers
-- to.
--
-- It is additive and it is not a second copy of anything that exists:
--
--   * tenant feature flags and module entitlements are rows in the existing
--     `public.tenant_feature_policy` (keys such as `module.integration_dashboard`
--     or `integration.lms_lti`), read through `public.feature_state`. The
--     metadata a flag needs — owner, review date, expiry, rollback — lives in
--     `app/src/lib/flags.ts`, where a test holds every key to it.
--   * consent is the existing `public.consent_record`, with a capability of
--     `integration:<connection public id>`.
--   * audit is the existing `public.tenant_policy_audit_event`; its entity list
--     is widened below and the same trigger writes it.
--   * permissions are `private.has_capability`, never a role name.
--
-- Three things are enforced here rather than promised by a screen:
--
--   1. Nothing is on by default. A connection is born `disconnected`, it
--      cannot report `healthy` or `degraded` without an approval, and it
--      cannot be anything but read-only without one either.
--   2. No credential is stored. `credentials_reference` is a pointer into a
--      secret manager, shaped so a pasted token cannot pass, and no signed-in
--      account can select the column at all.
--   3. Holding an integration capability is not a licence to browse students.
--      A canonical reference that belongs to one student is readable by that
--      student and by nobody else through RLS — not the integration
--      administrator, not the tenant administrator.
--
-- Workers that run syncs use the service role, which bypasses RLS; they must
-- enforce tenant and connection scope in code (see
-- `docs/INTEGRATION-THREAT-MODEL.md`). Nothing in a user-facing request path
-- uses the service role.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 0. Vocabularies ───────────────────────────────────────────────────────

do $$ begin
  create type public.source_freshness as enum (
    'live', 'recent', 'stale', 'unavailable', 'manual', 'estimated', 'needs_confirmation'
  );
exception when duplicate_object then null;
end $$;

-- T0 public · T1 course-authorized · T2 student-owned work · T3 education
-- record · T4 regulated/sensitive · T5 restricted research/IP · T6 highly
-- restricted. Written as a domain so every column that carries one checks it.
do $$ begin
  create domain public.data_classification as text
    check (value in ('T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'));
exception when duplicate_object then null;
end $$;

-- A short opaque id for anything a URL or a support ticket will quote.
create or replace function private.public_id(prefix text)
returns text
language sql
volatile
set search_path = ''
as $$
  select prefix || '_' || left(replace(gen_random_uuid()::text, '-', ''), 20);
$$;
revoke all on function private.public_id(text) from public;
grant execute on function private.public_id(text) to authenticated;

-- ── 1. Roles and capabilities ─────────────────────────────────────────────

-- `incident_responder` is global and carries one capability. The platform-wide
-- kill switch is not given to `platform_admin`, which holds exactly three and
-- is checked for holding exactly three (capabilities.check.sql).
insert into public.app_roles (role, global) values
  ('integration_admin',  false),
  ('incident_responder', true)
on conflict (role) do nothing;

insert into public.app_capabilities (capability, about) values
  ('integration:view',      'See one university''s integration connections, scopes, mappings, sync runs and errors. Never credentials, never a student''s imported records.'),
  ('integration:configure', 'Create and change one university''s integration connections, scopes and field mappings. Approval of a connection is a separate step.'),
  ('integration:approve',   'Approve a connection, a scope or a write direction for one university.'),
  ('integration:sync',      'Pause and resume one university''s sync.'),
  ('integration:replay',    'Request a replay of a dead-lettered event. The request is reviewed and run by a worker, never executed from the browser.'),
  ('killswitch:engage',     'Engage or release a kill switch. Over the platform scope it stops every university; over a school it stops one.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('integration_admin', 'integration:view'),
  ('integration_admin', 'integration:configure'),
  ('integration_admin', 'integration:sync'),
  ('integration_admin', 'integration:replay'),
  ('university_admin',  'integration:view'),
  ('university_admin',  'integration:approve'),
  ('university_admin',  'killswitch:engage'),
  ('incident_responder','killswitch:engage')
on conflict (role, capability) do nothing;

-- ── 2. Kill switches ──────────────────────────────────────────────────────
--
-- A row with a null tenant is global. The flag evaluator reads these first
-- and nothing a tenant sets can outrank one.

create table if not exists public.feature_kill_switch (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        references public.schools(id) on delete cascade,
  switch_key  text        not null check (switch_key in (
                'kill.integration_sync', 'kill.ai_generation', 'kill.data_upload',
                'kill.code_execution', 'kill.sharing', 'kill.writeback'
              ) or switch_key ~ '^kill\.connection\.[a-z]+_[0-9a-f]{20}$'),
  engaged     boolean     not null default false,
  reason      text        not null default '' check (length(reason) <= 1000),
  engaged_by  uuid        references auth.users(id) on delete set null,
  engaged_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint kill_switch_reason_when_engaged check (not engaged or length(trim(reason)) > 0)
);
create unique index if not exists feature_kill_switch_one_per_scope
  on public.feature_kill_switch (coalesce(tenant_id, ''), switch_key);
create index if not exists feature_kill_switch_by_engager on public.feature_kill_switch (engaged_by);
create index if not exists feature_kill_switch_by_tenant on public.feature_kill_switch (tenant_id);

alter table public.feature_kill_switch enable row level security;
revoke all on table public.feature_kill_switch from anon, authenticated;
grant select, insert, update on table public.feature_kill_switch to authenticated;

drop policy if exists "everyone signed in reads the switches that apply to them" on public.feature_kill_switch;
create policy "everyone signed in reads the switches that apply to them" on public.feature_kill_switch
  for select to authenticated
  using (tenant_id is null
         or tenant_id = (select private.school_of())
         or private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "switch holders engage switches" on public.feature_kill_switch;
create policy "switch holders engage switches" on public.feature_kill_switch
  for insert to authenticated
  with check (case when tenant_id is null
                   then private.has_capability('killswitch:engage', 'platform', '')
                   else private.has_capability('killswitch:engage', 'school', tenant_id) end);
drop policy if exists "switch holders change switches" on public.feature_kill_switch;
create policy "switch holders change switches" on public.feature_kill_switch
  for update to authenticated
  using (case when tenant_id is null
              then private.has_capability('killswitch:engage', 'platform', '')
              else private.has_capability('killswitch:engage', 'school', tenant_id) end)
  with check (case when tenant_id is null
                   then private.has_capability('killswitch:engage', 'platform', '')
                   else private.has_capability('killswitch:engage', 'school', tenant_id) end);

-- Whether a switch is engaged for a tenant: its own row or the global one.
create or replace function public.kill_switch_engaged(want_switch text, want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.feature_kill_switch k
     where k.switch_key = want_switch
       and k.engaged
       and (k.tenant_id is null or k.tenant_id = want_tenant)
  );
$$;
revoke all on function public.kill_switch_engaged(text, text) from public, anon;
grant execute on function public.kill_switch_engaged(text, text) to authenticated;

-- ── 3. Data classification ceiling ────────────────────────────────────────
--
-- The platform rows (null tenant) are the floor. T0–T2 may reach Community at
-- the platform level because the command leaves them to tenant, course and
-- consent policy (a student sharing their own draft, course material shared
-- within the course); T3 and above never do. A tenant may add a row for a
-- class to be *stricter*; the check below refuses one that is looser, so no
-- tenant setting can route an education record to a consumer model.

create table if not exists public.data_classification_rules (
  id                             uuid        primary key default gen_random_uuid(),
  tenant_id                      text        references public.schools(id) on delete cascade,
  classification                 public.data_classification not null,
  allowed_in_semester            boolean     not null,
  allowed_in_approved_ai         boolean     not null,
  allowed_in_consumer_ai         boolean     not null,
  allowed_in_external_connector  boolean     not null,
  allowed_in_community           boolean     not null,
  retention_policy               text        not null check (length(trim(retention_policy)) between 1 and 200),
  required_approvals             jsonb       not null default '[]'::jsonb check (jsonb_typeof(required_approvals) = 'array'),
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),
  -- The hard blocks, stated once, for every row a tenant can write.
  constraint classification_t3_never_consumer_ai check (
    classification not in ('T3', 'T4', 'T5', 'T6') or not allowed_in_consumer_ai),
  constraint classification_t4_plus_blocked check (
    classification not in ('T4', 'T5', 'T6')
    or not (allowed_in_approved_ai or allowed_in_external_connector or allowed_in_community))
);
create unique index if not exists data_classification_rules_one_per_scope
  on public.data_classification_rules (coalesce(tenant_id, ''), classification);
create index if not exists data_classification_rules_by_tenant on public.data_classification_rules (tenant_id);

insert into public.data_classification_rules
  (tenant_id, classification, allowed_in_semester, allowed_in_approved_ai, allowed_in_consumer_ai,
   allowed_in_external_connector, allowed_in_community, retention_policy, required_approvals)
values
  (null, 'T0', true,  true,  true,  true,  true,  'tenant default',                      '[]'),
  (null, 'T1', true,  true,  false, true,  true,  'course term plus one year',           '["course"]'),
  (null, 'T2', true,  true,  false, false, true,  'student-controlled',                  '["student"]'),
  (null, 'T3', true,  true,  false, false, false, 'minimum necessary; institution policy','["institution","purpose"]'),
  (null, 'T4', false, false, false, false, false, 'not ingested',                        '["institution","security"]'),
  (null, 'T5', false, false, false, false, false, 'not ingested',                        '["institution","research"]'),
  (null, 'T6', false, false, false, false, false, 'not ingested',                        '["institution","security","legal"]')
on conflict do nothing;

create or replace function private.refuse_looser_classification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare floor_row public.data_classification_rules;
begin
  if new.tenant_id is null then return new; end if;
  select * into floor_row from public.data_classification_rules r
   where r.tenant_id is null and r.classification = new.classification;
  if (new.allowed_in_semester and not floor_row.allowed_in_semester)
     or (new.allowed_in_approved_ai and not floor_row.allowed_in_approved_ai)
     or (new.allowed_in_consumer_ai and not floor_row.allowed_in_consumer_ai)
     or (new.allowed_in_external_connector and not floor_row.allowed_in_external_connector)
     or (new.allowed_in_community and not floor_row.allowed_in_community) then
    raise exception 'A tenant classification rule may only be stricter than the platform rule for %.', new.classification;
  end if;
  return new;
end $$;
revoke all on function private.refuse_looser_classification() from public, anon, authenticated;
drop trigger if exists refuse_looser_classification on public.data_classification_rules;
create trigger refuse_looser_classification
  before insert or update on public.data_classification_rules
  for each row execute function private.refuse_looser_classification();

alter table public.data_classification_rules enable row level security;
revoke all on table public.data_classification_rules from anon, authenticated;
grant select, insert, update, delete on table public.data_classification_rules to authenticated;
drop policy if exists "signed-in accounts read the rules that apply to them" on public.data_classification_rules;
create policy "signed-in accounts read the rules that apply to them" on public.data_classification_rules
  for select to authenticated
  using (tenant_id is null or tenant_id = (select private.school_of())
         or private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "tenant configurers tighten rules" on public.data_classification_rules;
create policy "tenant configurers tighten rules" on public.data_classification_rules
  for insert to authenticated
  with check (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id));
drop policy if exists "tenant configurers change their rules" on public.data_classification_rules;
create policy "tenant configurers change their rules" on public.data_classification_rules
  for update to authenticated
  using (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id))
  with check (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id));
drop policy if exists "tenant configurers remove their rules" on public.data_classification_rules;
create policy "tenant configurers remove their rules" on public.data_classification_rules
  for delete to authenticated
  using (tenant_id is not null and private.has_capability('tenant:configure', 'school', tenant_id));

-- ── 4. Connections ────────────────────────────────────────────────────────

create table if not exists public.integration_connections (
  id                        uuid        primary key default gen_random_uuid(),
  public_id                 text        not null unique default private.public_id('conn'),
  tenant_id                 text        not null references public.schools(id) on delete cascade,
  provider_domain           text        not null check (provider_domain in (
                              'identity', 'sis', 'degree_audit', 'catalog', 'lms', 'advising',
                              'admissions_crm', 'career', 'erp', 'bursar', 'financial_aid',
                              'library', 'tutoring', 'events', 'organizations', 'calendar',
                              'research', 'study_abroad', 'alumni', 'alerts', 'transit')),
  provider_name             text        not null check (length(trim(provider_name)) between 1 and 120),
  provider_product          text        check (provider_product is null or length(provider_product) <= 120),
  connection_name           text        not null check (length(trim(connection_name)) between 1 and 160),
  status                    text        not null default 'disconnected' check (status in (
                              'disconnected', 'configuring', 'healthy', 'degraded', 'paused', 'error')),
  authentication_type       text        not null default 'none' check (authentication_type in (
                              'none', 'oauth2', 'lti_1_3', 'saml', 'oidc', 'scim', 'api_key', 'sftp', 'mtls')),
  -- A pointer into a secret manager, never a secret. `vault:`, `env:` or
  -- `secret-manager:` followed by a path; a pasted token has none of those.
  credentials_reference     text        check (credentials_reference is null
                              or credentials_reference ~ '^(vault|env|secret-manager):[A-Za-z0-9_./-]{1,200}$'),
  data_classification_ceiling public.data_classification not null default 'T0',
  sync_mode                 text        not null default 'manual' check (sync_mode in (
                              'webhook', 'incremental_api', 'batch', 'manual', 'lti_launch')),
  sync_direction            text        not null default 'read' check (sync_direction in (
                              'read', 'approved_write', 'bidirectional')),
  freshness_target          interval,
  cursor_state              jsonb       not null default '{}'::jsonb check (jsonb_typeof(cursor_state) = 'object'),
  last_successful_sync_at   timestamptz,
  last_attempt_at           timestamptz,
  last_error_at             timestamptz,
  feature_flag_key          text        check (feature_flag_key is null or feature_flag_key ~ '^integration\.[a-z0-9_]+$'),
  source_of_truth_domains   jsonb       not null default '[]'::jsonb check (jsonb_typeof(source_of_truth_domains) = 'array'),
  owner_account_id          uuid        references auth.users(id) on delete set null,
  approved_by               uuid        references auth.users(id) on delete set null,
  approved_at               timestamptz,
  paused_reason             text        check (paused_reason is null or length(paused_reason) <= 1000),
  disconnected_at           timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (id, tenant_id),
  constraint connection_live_needs_approval check (
    status not in ('healthy', 'degraded') or approved_at is not null),
  constraint connection_write_needs_approval check (
    sync_direction = 'read' or approved_at is not null),
  -- T4 and above are never ingested by a connector.
  constraint connection_ceiling_below_t4 check (
    data_classification_ceiling in ('T0', 'T1', 'T2', 'T3'))
);
create index if not exists integration_connections_by_tenant_status
  on public.integration_connections (tenant_id, status);
create index if not exists integration_connections_by_tenant_domain
  on public.integration_connections (tenant_id, provider_domain);
create index if not exists integration_connections_by_owner on public.integration_connections (owner_account_id);
create index if not exists integration_connections_by_approver on public.integration_connections (approved_by);

alter table public.integration_connections enable row level security;
revoke all on table public.integration_connections from anon, authenticated;
-- Every column but the credential pointer. RLS chooses rows; only a column
-- grant can keep a column out of a `select *`.
grant select (id, public_id, tenant_id, provider_domain, provider_name, provider_product,
              connection_name, status, authentication_type, data_classification_ceiling,
              sync_mode, sync_direction, freshness_target, cursor_state,
              last_successful_sync_at, last_attempt_at, last_error_at, feature_flag_key,
              source_of_truth_domains, owner_account_id, approved_by, approved_at,
              paused_reason, disconnected_at, created_at, updated_at)
  on public.integration_connections to authenticated;
-- Configuration columns only: status, approval and sync bookkeeping move
-- through the functions below or the worker, never a direct update.
grant insert (tenant_id, provider_domain, provider_name, provider_product, connection_name,
              authentication_type, credentials_reference, data_classification_ceiling,
              sync_mode, freshness_target, feature_flag_key, source_of_truth_domains,
              owner_account_id)
  on public.integration_connections to authenticated;
grant update (provider_name, provider_product, connection_name, authentication_type,
              credentials_reference, data_classification_ceiling, sync_mode,
              freshness_target, feature_flag_key, source_of_truth_domains, owner_account_id,
              updated_at)
  on public.integration_connections to authenticated;

drop policy if exists "integration viewers read connections" on public.integration_connections;
create policy "integration viewers read connections" on public.integration_connections
  for select to authenticated
  using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration configurers add connections" on public.integration_connections;
create policy "integration configurers add connections" on public.integration_connections
  for insert to authenticated
  with check (private.has_capability('integration:configure', 'school', tenant_id));
drop policy if exists "integration configurers change connections" on public.integration_connections;
create policy "integration configurers change connections" on public.integration_connections
  for update to authenticated
  using (private.has_capability('integration:configure', 'school', tenant_id))
  with check (private.has_capability('integration:configure', 'school', tenant_id));

-- ── 5. Scopes and mappings ────────────────────────────────────────────────

create table if not exists public.integration_scopes (
  id                          uuid        primary key default gen_random_uuid(),
  tenant_id                   text        not null,
  connection_id               uuid        not null,
  scope_key                   text        not null check (scope_key ~ '^scope\.[a-z_]+\.[a-z0-9_]+$'),
  scope_type                  text        not null check (scope_type in ('read', 'write', 'launch', 'event')),
  approved                    boolean     not null default false,
  approved_by                 uuid        references auth.users(id) on delete set null,
  approved_at                 timestamptz,
  expires_at                  timestamptz,
  data_classification_ceiling public.data_classification not null default 'T0',
  purpose                     text        not null check (length(trim(purpose)) between 1 and 500),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  unique (connection_id, scope_key),
  constraint scope_approval_recorded check (not approved or (approved_by is not null and approved_at is not null)),
  constraint scope_ceiling_below_t4 check (data_classification_ceiling in ('T0', 'T1', 'T2', 'T3')),
  -- The default-never list, by name: grades, rosters, submissions,
  -- accommodations, health, conduct, private notes and aid never become a
  -- scope a connection can hold.
  constraint scope_not_on_the_never_list check (scope_key !~ '\.(grades?|gpa|gradebook|roster|submissions?|accommodations?|health|counseling|conduct|instructor_notes|financial_aid|aid_award)(_|$)')
);
create index if not exists integration_scopes_by_tenant on public.integration_scopes (tenant_id, approved);
create index if not exists integration_scopes_by_approver on public.integration_scopes (approved_by);

create table if not exists public.integration_mappings (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null,
  connection_id         uuid        not null,
  external_entity_type  text        not null check (length(trim(external_entity_type)) between 1 and 120),
  canonical_entity_type text        not null check (canonical_entity_type in (
                          'institution', 'campus', 'college', 'school', 'program', 'term', 'course',
                          'course_section', 'academic_requirement', 'student_program', 'enrollment',
                          'registration_window', 'registration_hold', 'course_catalog_entry',
                          'course_policy', 'assignment', 'appointment', 'referral', 'opportunity',
                          'job', 'internship', 'research_opportunity', 'organization', 'event',
                          'service', 'resource', 'study_space', 'library_source', 'calendar_event',
                          'notification', 'person_reference', 'lms_context')),
  external_field        text        not null check (length(trim(external_field)) between 1 and 200),
  canonical_field       text        not null check (canonical_field ~ '^[a-z][a-z0-9_]{0,62}$'),
  transform_config      jsonb       not null default '{}'::jsonb check (jsonb_typeof(transform_config) = 'object'),
  required              boolean     not null default false,
  mapping_version       integer     not null default 1 check (mapping_version >= 1),
  active                boolean     not null default false,
  validation_state      text        not null default 'unvalidated' check (validation_state in (
                          'unvalidated', 'valid', 'conflict', 'invalid')),
  conflict_kind         text        check (conflict_kind is null or conflict_kind in (
                          'type_mismatch', 'enum_mismatch', 'missing_required', 'duplicate_external_id',
                          'timestamp_regression', 'transform_error', 'scope_failure',
                          'classification_block', 'consent_block', 'rate_limit', 'deletion_mismatch')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  unique (connection_id, external_entity_type, external_field, mapping_version),
  constraint mapping_conflict_named check ((validation_state = 'conflict') = (conflict_kind is not null))
);
create index if not exists integration_mappings_by_tenant on public.integration_mappings (tenant_id, validation_state);

-- ── 6. Sync runs, errors, webhook events, dead letters ────────────────────
--
-- Written by the worker (service role). People with `integration:view` read
-- them; nobody signed in writes them.

create table if not exists public.integration_sync_runs (
  id                   uuid        primary key default gen_random_uuid(),
  public_id            text        not null unique default private.public_id('run'),
  tenant_id            text        not null,
  connection_id        uuid        not null,
  trigger_type         text        not null check (trigger_type in ('webhook', 'scheduled', 'manual', 'replay')),
  sync_mode            text        not null check (sync_mode in ('webhook', 'incremental_api', 'batch', 'manual', 'lti_launch')),
  status               text        not null default 'running' check (status in (
                         'queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled')),
  cursor_before        jsonb,
  cursor_after         jsonb,
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  records_received     integer     not null default 0 check (records_received >= 0),
  records_created      integer     not null default 0 check (records_created >= 0),
  records_updated      integer     not null default 0 check (records_updated >= 0),
  records_unchanged    integer     not null default 0 check (records_unchanged >= 0),
  records_rejected     integer     not null default 0 check (records_rejected >= 0),
  errors_count         integer     not null default 0 check (errors_count >= 0),
  retry_count          integer     not null default 0 check (retry_count >= 0),
  reconciliation_state text        not null default 'not_run' check (reconciliation_state in (
                         'not_run', 'matched', 'mismatched', 'pending')),
  initiated_by         uuid        references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  unique (id, tenant_id),
  constraint sync_run_counts_add_up check (
    records_created + records_updated + records_unchanged + records_rejected <= records_received)
);
create index if not exists integration_sync_runs_by_connection_time
  on public.integration_sync_runs (connection_id, started_at desc);
create index if not exists integration_sync_runs_by_tenant_status
  on public.integration_sync_runs (tenant_id, status);
create index if not exists integration_sync_runs_by_initiator on public.integration_sync_runs (initiated_by);

create table if not exists public.integration_sync_errors (
  id                                 uuid        primary key default gen_random_uuid(),
  tenant_id                          text        not null,
  sync_run_id                        uuid,
  connection_id                      uuid        not null,
  external_entity_type               text        check (external_entity_type is null or length(external_entity_type) <= 120),
  -- A hash or a truncated reference, never an external id in the clear.
  external_record_reference_redacted text        check (external_record_reference_redacted is null
                                       or external_record_reference_redacted ~ '^(sha256:[0-9a-f]{16,64}|redacted)$'),
  error_category                     text        not null check (error_category in (
                                       'type_mismatch', 'enum_mismatch', 'missing_required', 'duplicate_external_id',
                                       'timestamp_regression', 'transform_error', 'scope_failure',
                                       'classification_block', 'consent_block', 'rate_limit', 'deletion_mismatch',
                                       'authentication', 'provider_unavailable', 'schema_validation', 'unknown')),
  error_code                         text        check (error_code is null or error_code ~ '^[A-Za-z0-9_.:-]{1,80}$'),
  sanitized_message                  text        not null check (length(sanitized_message) between 1 and 500),
  severity                           text        not null default 'error' check (severity in ('info', 'warning', 'error', 'critical')),
  retryable                          boolean     not null default false,
  retry_count                        integer     not null default 0 check (retry_count >= 0),
  resolved_at                        timestamptz,
  resolved_by                        uuid        references auth.users(id) on delete set null,
  created_at                         timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  foreign key (sync_run_id, tenant_id)
    references public.integration_sync_runs (id, tenant_id) on delete cascade
);
create index if not exists integration_sync_errors_by_connection_time
  on public.integration_sync_errors (connection_id, created_at desc);
create index if not exists integration_sync_errors_open
  on public.integration_sync_errors (tenant_id, error_category) where resolved_at is null;
create index if not exists integration_sync_errors_by_resolver on public.integration_sync_errors (resolved_by);

create table if not exists public.integration_webhook_events (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         text        not null,
  connection_id     uuid        not null,
  provider_event_id text        check (provider_event_id is null or length(provider_event_id) <= 200),
  event_type        text        not null check (length(trim(event_type)) between 1 and 120),
  event_version     text        not null default '1' check (length(event_version) between 1 and 40),
  idempotency_key   text        not null check (length(idempotency_key) between 8 and 200),
  -- A pointer to where the worker keeps the payload, and its hash; the
  -- payload itself is never a column here.
  payload_reference text        check (payload_reference is null or payload_reference ~ '^(storage|queue):[A-Za-z0-9_./-]{1,300}$'),
  payload_hash      text        not null check (payload_hash ~ '^sha256:[0-9a-f]{64}$'),
  received_at       timestamptz not null default now(),
  processed_at      timestamptz,
  processing_status text        not null default 'received' check (processing_status in (
                      'received', 'processing', 'processed', 'duplicate', 'rejected', 'dead_lettered')),
  created_at        timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  unique (id, tenant_id),
  -- Idempotency is a constraint, not a lookup the worker might skip.
  unique (connection_id, idempotency_key)
);
create index if not exists integration_webhook_events_by_status
  on public.integration_webhook_events (tenant_id, processing_status, received_at);

create table if not exists public.integration_dead_letter_events (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null,
  connection_id       uuid        not null,
  webhook_event_id    uuid,
  sync_run_id         uuid,
  reason              text        not null check (length(reason) between 1 and 500),
  payload_reference   text        check (payload_reference is null or payload_reference ~ '^(storage|queue):[A-Za-z0-9_./-]{1,300}$'),
  attempts            integer     not null default 0 check (attempts >= 0),
  retry_after         timestamptz,
  replay_requested_at timestamptz,
  replay_requested_by uuid        references auth.users(id) on delete set null,
  replay_reason       text        check (replay_reason is null or length(replay_reason) <= 1000),
  resolved_at         timestamptz,
  created_at          timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  foreign key (webhook_event_id, tenant_id)
    references public.integration_webhook_events (id, tenant_id) on delete set null (webhook_event_id),
  foreign key (sync_run_id, tenant_id)
    references public.integration_sync_runs (id, tenant_id) on delete set null (sync_run_id)
);
create index if not exists integration_dead_letters_open
  on public.integration_dead_letter_events (tenant_id, connection_id) where resolved_at is null;
create index if not exists integration_dead_letters_by_requester on public.integration_dead_letter_events (replay_requested_by);

-- ── 7. Sources, snapshots, freshness, canonical references ────────────────

create table if not exists public.source_records (
  id               uuid        primary key default gen_random_uuid(),
  public_id        text        not null unique default private.public_id('src'),
  tenant_id        text        not null references public.schools(id) on delete cascade,
  connection_id    uuid,
  source_type      text        not null check (source_type in (
                     'connected_institutional', 'public_university', 'manual_admin', 'user_entered', 'external_link')),
  source_name      text        not null check (length(trim(source_name)) between 1 and 200),
  source_url       text        check (source_url is null or length(source_url) <= 2000),
  source_of_truth  text        not null check (length(trim(source_of_truth)) between 1 and 120),
  classification   public.data_classification not null default 'T0',
  freshness_status public.source_freshness not null default 'unavailable',
  source_timestamp timestamptz,
  captured_at      timestamptz not null default now(),
  license_state    text        not null default 'unknown' check (license_state in ('open', 'licensed', 'restricted', 'unknown')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete set null (connection_id),
  unique (id, tenant_id),
  constraint source_record_below_t4 check (classification in ('T0', 'T1', 'T2', 'T3'))
);
create index if not exists source_records_by_tenant_freshness on public.source_records (tenant_id, freshness_status);

create table if not exists public.source_snapshots (
  id                   uuid        primary key default gen_random_uuid(),
  tenant_id            text        not null,
  source_record_id     uuid        not null,
  snapshot_hash        text        not null check (snapshot_hash ~ '^sha256:[0-9a-f]{64}$'),
  captured_at          timestamptz not null default now(),
  mapping_version      integer     not null default 1 check (mapping_version >= 1),
  content_reference    text        check (content_reference is null or content_reference ~ '^(storage|queue):[A-Za-z0-9_./-]{1,300}$'),
  classification       public.data_classification not null default 'T0',
  retention_expires_at timestamptz,
  created_at           timestamptz not null default now(),
  foreign key (source_record_id, tenant_id)
    references public.source_records (id, tenant_id) on delete cascade,
  unique (source_record_id, snapshot_hash)
);
create index if not exists source_snapshots_by_tenant_time on public.source_snapshots (tenant_id, captured_at desc);
create index if not exists source_snapshots_by_retention on public.source_snapshots (retention_expires_at)
  where retention_expires_at is not null;

create table if not exists public.source_freshness_events (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null,
  source_record_id uuid        not null,
  freshness_status public.source_freshness not null,
  observed_at      timestamptz not null default now(),
  reason           text        not null default '' check (length(reason) <= 500),
  connection_id    uuid,
  created_at       timestamptz not null default now(),
  foreign key (source_record_id, tenant_id)
    references public.source_records (id, tenant_id) on delete cascade,
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete set null (connection_id)
);
create index if not exists source_freshness_events_by_source_time
  on public.source_freshness_events (source_record_id, observed_at desc);
create index if not exists source_freshness_events_by_tenant on public.source_freshness_events (tenant_id, freshness_status);

create table if not exists public.canonical_entity_references (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null references public.schools(id) on delete cascade,
  canonical_entity_type text        not null check (length(trim(canonical_entity_type)) between 1 and 60),
  canonical_entity_id   text        not null check (length(trim(canonical_entity_id)) between 1 and 200),
  -- Set when the fact is about one student (their enrollment, their hold).
  -- Such a row is that student's and nobody else's to read through RLS.
  subject_user_id       uuid        references auth.users(id) on delete cascade,
  connection_id         uuid,
  source_system         text        not null check (length(trim(source_system)) between 1 and 120),
  source_record_id      text        not null check (length(trim(source_record_id)) between 1 and 200),
  source_url            text        check (source_url is null or length(source_url) <= 2000),
  source_timestamp      timestamptz,
  source_of_truth       text        not null check (length(trim(source_of_truth)) between 1 and 120),
  classification        public.data_classification not null default 'T0',
  freshness_status      public.source_freshness not null default 'needs_confirmation',
  mapping_version       integer     not null default 1 check (mapping_version >= 1),
  confidence            numeric(4,3) not null default 1 check (confidence between 0 and 1),
  external_deleted_at   timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete set null (connection_id),
  unique (tenant_id, source_system, source_record_id, canonical_entity_type),
  constraint canonical_reference_below_t4 check (classification in ('T0', 'T1', 'T2', 'T3')),
  -- An education record always has an owner; it cannot sit tenant-wide.
  constraint canonical_t3_has_subject check (classification <> 'T3' or subject_user_id is not null)
);
create index if not exists canonical_entity_references_by_entity
  on public.canonical_entity_references (tenant_id, canonical_entity_type, canonical_entity_id);
create index if not exists canonical_entity_references_by_subject
  on public.canonical_entity_references (subject_user_id);
create index if not exists canonical_entity_references_by_freshness
  on public.canonical_entity_references (tenant_id, freshness_status);

-- ── Covering indexes for the tenant-pinned foreign keys ───────────────────
--
-- Every child row points at its parent by (id, tenant_id) so a row cannot
-- name another school's connection. indexes.check.sql asks that each such key
-- have an index leading with the same columns, so a parent delete does not
-- scan the child.
create index if not exists integration_scopes_by_connection         on public.integration_scopes (connection_id, tenant_id);
create index if not exists integration_mappings_by_connection       on public.integration_mappings (connection_id, tenant_id);
create index if not exists integration_sync_runs_by_connection      on public.integration_sync_runs (connection_id, tenant_id);
create index if not exists integration_sync_errors_by_connection    on public.integration_sync_errors (connection_id, tenant_id);
create index if not exists integration_sync_errors_by_run_tenant    on public.integration_sync_errors (sync_run_id, tenant_id);
create index if not exists integration_webhook_events_by_connection on public.integration_webhook_events (connection_id, tenant_id);
create index if not exists integration_dead_letters_by_connection   on public.integration_dead_letter_events (connection_id, tenant_id);
create index if not exists integration_dead_letters_by_event_tenant on public.integration_dead_letter_events (webhook_event_id, tenant_id);
create index if not exists integration_dead_letters_by_run_tenant   on public.integration_dead_letter_events (sync_run_id, tenant_id);
create index if not exists source_records_by_connection_tenant      on public.source_records (connection_id, tenant_id);
create index if not exists source_snapshots_by_source               on public.source_snapshots (source_record_id, tenant_id);
create index if not exists source_freshness_events_by_source_tenant on public.source_freshness_events (source_record_id, tenant_id);
create index if not exists source_freshness_events_by_conn_tenant   on public.source_freshness_events (connection_id, tenant_id);
create index if not exists canonical_entity_references_by_conn_tenant on public.canonical_entity_references (connection_id, tenant_id);

-- ── 8. Row-level security for sections 5–7 ────────────────────────────────

alter table public.integration_scopes              enable row level security;
alter table public.integration_mappings            enable row level security;
alter table public.integration_sync_runs           enable row level security;
alter table public.integration_sync_errors         enable row level security;
alter table public.integration_webhook_events      enable row level security;
alter table public.integration_dead_letter_events  enable row level security;
alter table public.source_records                  enable row level security;
alter table public.source_snapshots                enable row level security;
alter table public.source_freshness_events         enable row level security;
alter table public.canonical_entity_references     enable row level security;

revoke all on table public.integration_scopes              from anon, authenticated;
revoke all on table public.integration_mappings            from anon, authenticated;
revoke all on table public.integration_sync_runs           from anon, authenticated;
revoke all on table public.integration_sync_errors         from anon, authenticated;
revoke all on table public.integration_webhook_events      from anon, authenticated;
revoke all on table public.integration_dead_letter_events  from anon, authenticated;
revoke all on table public.source_records                  from anon, authenticated;
revoke all on table public.source_snapshots                from anon, authenticated;
revoke all on table public.source_freshness_events         from anon, authenticated;
revoke all on table public.canonical_entity_references     from anon, authenticated;

-- Scopes: configurers propose them; approval columns move only through
-- `integration_approve_scope`.
grant select on table public.integration_scopes to authenticated;
grant insert (tenant_id, connection_id, scope_key, scope_type, expires_at,
              data_classification_ceiling, purpose)
  on public.integration_scopes to authenticated;
grant update (scope_type, expires_at, data_classification_ceiling, purpose, updated_at)
  on public.integration_scopes to authenticated;
grant delete on table public.integration_scopes to authenticated;

drop policy if exists "integration viewers read scopes" on public.integration_scopes;
create policy "integration viewers read scopes" on public.integration_scopes
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration configurers propose scopes" on public.integration_scopes;
create policy "integration configurers propose scopes" on public.integration_scopes
  for insert to authenticated with check (private.has_capability('integration:configure', 'school', tenant_id));
drop policy if exists "integration configurers change unapproved scopes" on public.integration_scopes;
create policy "integration configurers change unapproved scopes" on public.integration_scopes
  for update to authenticated
  using (private.has_capability('integration:configure', 'school', tenant_id) and not approved)
  with check (private.has_capability('integration:configure', 'school', tenant_id) and not approved);
drop policy if exists "integration configurers withdraw scopes" on public.integration_scopes;
create policy "integration configurers withdraw scopes" on public.integration_scopes
  for delete to authenticated using (private.has_capability('integration:configure', 'school', tenant_id));

grant select, insert, update, delete on table public.integration_mappings to authenticated;
drop policy if exists "integration viewers read mappings" on public.integration_mappings;
create policy "integration viewers read mappings" on public.integration_mappings
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration configurers add mappings" on public.integration_mappings;
create policy "integration configurers add mappings" on public.integration_mappings
  for insert to authenticated with check (private.has_capability('integration:configure', 'school', tenant_id));
drop policy if exists "integration configurers change mappings" on public.integration_mappings;
create policy "integration configurers change mappings" on public.integration_mappings
  for update to authenticated
  using (private.has_capability('integration:configure', 'school', tenant_id))
  with check (private.has_capability('integration:configure', 'school', tenant_id));
drop policy if exists "integration configurers remove mappings" on public.integration_mappings;
create policy "integration configurers remove mappings" on public.integration_mappings
  for delete to authenticated using (private.has_capability('integration:configure', 'school', tenant_id));

-- Worker-written logs: read-only to the people allowed to see them.
grant select on table public.integration_sync_runs          to authenticated;
grant select on table public.integration_sync_errors        to authenticated;
grant select on table public.integration_webhook_events     to authenticated;
grant select on table public.integration_dead_letter_events to authenticated;
drop policy if exists "integration viewers read runs" on public.integration_sync_runs;
create policy "integration viewers read runs" on public.integration_sync_runs
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration viewers read errors" on public.integration_sync_errors;
create policy "integration viewers read errors" on public.integration_sync_errors
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration viewers read webhook events" on public.integration_webhook_events;
create policy "integration viewers read webhook events" on public.integration_webhook_events
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration viewers read dead letters" on public.integration_dead_letter_events;
create policy "integration viewers read dead letters" on public.integration_dead_letter_events
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));

-- Source records are institution-level provenance (a feed, a published page):
-- the school's members may see what their information comes from.
grant select on table public.source_records          to authenticated;
grant select on table public.source_snapshots        to authenticated;
grant select on table public.source_freshness_events to authenticated;
drop policy if exists "members and integration viewers read sources" on public.source_records;
create policy "members and integration viewers read sources" on public.source_records
  for select to authenticated
  using ((tenant_id = (select private.school_of()) and classification in ('T0', 'T1'))
         or private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration viewers read snapshots" on public.source_snapshots;
create policy "integration viewers read snapshots" on public.source_snapshots
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "members and integration viewers read freshness" on public.source_freshness_events;
create policy "members and integration viewers read freshness" on public.source_freshness_events
  for select to authenticated
  using (tenant_id = (select private.school_of())
         or private.has_capability('integration:view', 'school', tenant_id));

-- Canonical references. A student reads their own. Members read tenant-wide
-- public facts (a term, a catalog entry). An integration viewer reads the
-- tenant-wide ones and *not* a student's — that is the line the dashboard is
-- not allowed to cross.
grant select on table public.canonical_entity_references to authenticated;
drop policy if exists "students read their own references" on public.canonical_entity_references;
create policy "students read their own references" on public.canonical_entity_references
  for select to authenticated using (subject_user_id = (select auth.uid()));
drop policy if exists "tenant-wide references are readable in the tenant" on public.canonical_entity_references;
create policy "tenant-wide references are readable in the tenant" on public.canonical_entity_references
  for select to authenticated
  using (subject_user_id is null
         and classification in ('T0', 'T1')
         and (tenant_id = (select private.school_of())
              or private.has_capability('integration:view', 'school', tenant_id)));

-- ── 9. The safe actions, as functions ─────────────────────────────────────
--
-- Each checks its capability, refuses what would be unsafe, and leaves an
-- audit row through the trigger below.

create or replace function public.integration_set_paused(want_connection text, want_paused boolean, want_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare c public.integration_connections;
begin
  select * into c from public.integration_connections where public_id = want_connection;
  if c.id is null or not private.has_capability('integration:sync', 'school', c.tenant_id) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if length(trim(coalesce(want_reason, ''))) = 0 then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;
  if want_paused then
    if c.status = 'disconnected' then
      raise exception 'A disconnected connection has nothing to pause.' using errcode = '22023';
    end if;
    update public.integration_connections
       set status = 'paused', paused_reason = left(want_reason, 1000), updated_at = now()
     where id = c.id;
    return 'paused';
  end if;
  if c.status <> 'paused' then return c.status; end if;
  -- Resume to configuring, never straight to healthy: the next successful run
  -- is what earns healthy back.
  update public.integration_connections
     set status = 'configuring', paused_reason = null, updated_at = now()
   where id = c.id;
  return 'configuring';
end $$;
revoke all on function public.integration_set_paused(text, boolean, text) from public, anon;
grant execute on function public.integration_set_paused(text, boolean, text) to authenticated;

create or replace function public.integration_approve_connection(want_connection text, want_direction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare c public.integration_connections;
begin
  select * into c from public.integration_connections where public_id = want_connection;
  if c.id is null or not private.has_capability('integration:approve', 'school', c.tenant_id) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if want_direction not in ('read', 'approved_write', 'bidirectional') then
    raise exception 'Unknown direction.' using errcode = '22023';
  end if;
  -- Nobody approves their own connection.
  if c.owner_account_id = (select auth.uid()) then
    raise exception 'The owner of a connection cannot approve it.' using errcode = '42501';
  end if;
  update public.integration_connections
     set approved_by = (select auth.uid()), approved_at = now(), sync_direction = want_direction,
         status = case when status = 'disconnected' then 'configuring' else status end,
         updated_at = now()
   where id = c.id;
end $$;
revoke all on function public.integration_approve_connection(text, text) from public, anon;
grant execute on function public.integration_approve_connection(text, text) to authenticated;

create or replace function public.integration_approve_scope(want_scope uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare s public.integration_scopes;
begin
  select * into s from public.integration_scopes where id = want_scope;
  if s.id is null or not private.has_capability('integration:approve', 'school', s.tenant_id) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  update public.integration_scopes
     set approved = true, approved_by = (select auth.uid()), approved_at = now(), updated_at = now()
   where id = s.id;
end $$;
revoke all on function public.integration_approve_scope(uuid) from public, anon;
grant execute on function public.integration_approve_scope(uuid) to authenticated;

create or replace function public.integration_request_replay(want_dead_letter uuid, want_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d public.integration_dead_letter_events;
begin
  select * into d from public.integration_dead_letter_events where id = want_dead_letter;
  if d.id is null or not private.has_capability('integration:replay', 'school', d.tenant_id) then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;
  if length(trim(coalesce(want_reason, ''))) = 0 then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;
  if d.resolved_at is not null then
    raise exception 'This event is already resolved.' using errcode = '22023';
  end if;
  if public.kill_switch_engaged('kill.integration_sync', d.tenant_id) then
    raise exception 'Integration sync is stopped by a kill switch.' using errcode = '55000';
  end if;
  update public.integration_dead_letter_events
     set replay_requested_at = now(), replay_requested_by = (select auth.uid()),
         replay_reason = left(want_reason, 1000)
   where id = d.id;
end $$;
revoke all on function public.integration_request_replay(uuid, text) from public, anon;
grant execute on function public.integration_request_replay(uuid, text) to authenticated;

-- ── 10. Audit, through the table that already exists ──────────────────────

alter table public.tenant_policy_audit_event
  drop constraint if exists tenant_policy_audit_event_entity_type_check;
alter table public.tenant_policy_audit_event
  add constraint tenant_policy_audit_event_entity_type_check check (entity_type in (
    'tenant_feature_policy', 'ai_policy', 'approved_source', 'consent_record',
    'feature_kill_switch', 'data_classification_rules', 'integration_connections',
    'integration_scopes', 'integration_mappings', 'integration_dead_letter_events'
  ));

-- The existing trigger writes `to_jsonb(old/new)`. For a connection that
-- would copy the credential pointer and the cursor into an audit row, so the
-- connection gets its own thin trigger that drops both before delegating the
-- same shape of event. Global kill switches have no tenant, and the audit
-- table requires one, so those are recorded against every school they stop
-- only through the switch's own `engaged_by`/`engaged_at` columns.
create or replace function private.audit_integration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then null
                           else to_jsonb(old) - 'credentials_reference' - 'cursor_state' end;
  after_row  jsonb := case when tg_op = 'DELETE' then null
                           else to_jsonb(new) - 'credentials_reference' - 'cursor_state' end;
  row_data   jsonb := coalesce(after_row, before_row);
  event_tenant text := row_data ->> 'tenant_id';
  caller uuid := auth.uid();
  grant_id uuid;
begin
  if event_tenant is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  -- A credential pointer that changed is recorded as having changed, and
  -- nothing more.
  if tg_op = 'UPDATE' and tg_table_name = 'integration_connections'
     and (to_jsonb(old) ->> 'credentials_reference') is distinct from (to_jsonb(new) ->> 'credentials_reference') then
    after_row := after_row || '{"credentials_reference_changed": true}'::jsonb;
  end if;

  select g.id into grant_id
    from public.role_grants g
    join public.role_capabilities rc on rc.role = g.role
   where g.subject = caller
     and g.scope_kind = 'school'
     and g.scope_id = event_tenant
     and rc.capability in ('integration:configure', 'integration:approve', 'integration:sync',
                           'integration:replay', 'killswitch:engage', 'tenant:configure')
     and g.revoked_at is null
     and (g.expires_at is null or g.expires_at > now())
   order by g.granted_at desc
   limit 1;

  insert into public.tenant_policy_audit_event
    (tenant_id, entity_type, entity_id, action, old_data, new_data, actor_id, actor_grant_id)
  values
    (event_tenant, tg_table_name, row_data ->> 'id', lower(tg_op), before_row, after_row, caller, grant_id);

  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.audit_integration_change() from public, anon, authenticated;

drop trigger if exists audit_integration_connections on public.integration_connections;
create trigger audit_integration_connections
  after insert or update or delete on public.integration_connections
  for each row execute function private.audit_integration_change();
drop trigger if exists audit_integration_scopes on public.integration_scopes;
create trigger audit_integration_scopes
  after insert or update or delete on public.integration_scopes
  for each row execute function private.audit_integration_change();
drop trigger if exists audit_integration_mappings on public.integration_mappings;
create trigger audit_integration_mappings
  after insert or update or delete on public.integration_mappings
  for each row execute function private.audit_integration_change();
drop trigger if exists audit_integration_dead_letters on public.integration_dead_letter_events;
create trigger audit_integration_dead_letters
  after update on public.integration_dead_letter_events
  for each row execute function private.audit_integration_change();
drop trigger if exists audit_feature_kill_switch on public.feature_kill_switch;
create trigger audit_feature_kill_switch
  after insert or update or delete on public.feature_kill_switch
  for each row execute function private.audit_integration_change();
drop trigger if exists audit_data_classification_rules on public.data_classification_rules;
create trigger audit_data_classification_rules
  after insert or update or delete on public.data_classification_rules
  for each row execute function private.audit_integration_change();

-- ── 11. Descriptions ──────────────────────────────────────────────────────

comment on table public.feature_kill_switch is
  'Kill switches. A null tenant is global and outranks every tenant setting. Read first by the flag evaluator.';
comment on table public.data_classification_rules is
  'T0–T6 routing. Platform rows are the floor; a tenant row may only be stricter. T3+ never reaches consumer AI; T4+ is never ingested.';
comment on table public.integration_connections is
  'One external system a university has connected. Born disconnected; healthy and write directions require approval. No credential is stored.';
comment on table public.integration_scopes is
  'What a connection may read or do, one purpose each. Grades, rosters, submissions, accommodations, health, conduct and aid are refused by name.';
comment on table public.integration_mappings is
  'External field to canonical field, versioned, with its validation and conflict state.';
comment on table public.integration_sync_runs is
  'One sync attempt: trigger, cursor, counts and reconciliation. Worker-written.';
comment on table public.integration_sync_errors is
  'Sanitized per-record sync errors. No external id in the clear, no payload.';
comment on table public.integration_webhook_events is
  'Inbound provider events. Idempotency is a unique constraint; payloads are stored elsewhere and only referenced here.';
comment on table public.integration_dead_letter_events is
  'Events that exhausted their retries. Replay is requested here and performed by a worker.';
comment on table public.source_records is
  'Where an institutional fact comes from, and how fresh it is.';
comment on table public.canonical_entity_references is
  'Provenance for one canonical record. A student-owned row is readable by that student only.';
