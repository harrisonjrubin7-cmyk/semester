-- Semester — integration quality: reconciliation, schema drift, duplicates,
-- source owners, mapping versions, the provider registry and the simulation
-- sandbox's run log.
--
-- The rules live in app/src/lib/integration/{reconcile,drift,duplicates,
-- lineage,mapping-versions,providers,simulate}.ts and are tested there; this
-- is where their results are kept and who may act on them. See
-- docs/INTEGRATION-QUALITY-AND-RECONCILIATION.md.
--
-- Additive, and beside #779's control plane rather than a copy of it:
--
--   * a reconciliation run hangs off an `integration_sync_runs` row, whose
--     `reconciliation_state` column already exists;
--   * a mapping version is a header over the field rows `integration_mappings`
--     already keeps per `mapping_version`;
--   * nothing here stores a provider id, a value or a student. Discrepancies
--     carry the redacted `sha256:` reference `redact.ts` makes, and a check
--     constraint refuses anything else; drift events carry field names and,
--     for enums only, codes; duplicate candidates carry a hash of the key.
--
-- Writers: the sync worker (service role) writes runs, discrepancies,
-- fingerprints, drift events and candidates. People act on them through
-- column grants and capability checks; a trigger stamps who did, so nobody
-- can record a decision in somebody else's name.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. The capability to work the queue ──────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('integration:reconcile', 'Work one university''s reconciliation discrepancies, acknowledge schema drift and resolve duplicate candidates. Counts, redacted references and field names only — never a student''s record.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('integration_admin', 'integration:reconcile')
on conflict (role, capability) do nothing;

-- ── 2. Reconciliation runs and their discrepancies ───────────────────────

create table if not exists public.integration_reconciliation_runs (
  id                  uuid        primary key default gen_random_uuid(),
  tenant_id           text        not null,
  connection_id       uuid        not null,
  sync_run_id         uuid,
  matched             integer     not null default 0 check (matched >= 0),
  pending             integer     not null default 0 check (pending >= 0),
  mismatch            integer     not null default 0 check (mismatch >= 0),
  missing_in_semester integer     not null default 0 check (missing_in_semester >= 0),
  missing_at_source   integer     not null default 0 check (missing_at_source >= 0),
  duplicate           integer     not null default 0 check (duplicate >= 0),
  stale               integer     not null default 0 check (stale >= 0),
  rejected            integer     not null default 0 check (rejected >= 0),
  clean               boolean     not null default false,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  foreign key (sync_run_id, tenant_id)
    references public.integration_sync_runs (id, tenant_id) on delete set null (sync_run_id),
  unique (id, tenant_id),
  -- `clean` means nothing but newer-at-source; the counts have to agree.
  constraint reconciliation_clean_means_clean check (
    not clean or (mismatch + missing_in_semester + missing_at_source + duplicate + stale + rejected) = 0)
);
create index if not exists integration_reconciliation_runs_by_connection
  on public.integration_reconciliation_runs (connection_id, tenant_id);
create index if not exists integration_reconciliation_runs_by_sync_run
  on public.integration_reconciliation_runs (sync_run_id, tenant_id);
create index if not exists integration_reconciliation_runs_by_tenant_time
  on public.integration_reconciliation_runs (tenant_id, started_at desc);

create table if not exists public.integration_reconciliation_discrepancies (
  id                 uuid        primary key default gen_random_uuid(),
  tenant_id          text        not null,
  run_id             uuid        not null,
  status             text        not null check (status in (
                       'pending', 'mismatch', 'missing_in_semester', 'missing_at_source',
                       'duplicate', 'stale', 'rejected')),
  entity_type        text        not null check (length(trim(entity_type)) between 1 and 120),
  -- Only ever the redacted reference; a provider id cannot be stored here.
  reference          text        not null check (reference ~ '^sha256:[0-9a-f]{32}$'),
  detail             text        not null default '' check (length(detail) <= 300),
  workflow_state     text        not null default 'open' check (workflow_state in (
                       'open', 'assigned', 'investigating', 'resolved', 'suppressed')),
  assigned_to        uuid        references auth.users(id) on delete set null,
  suppression_reason text        check (suppression_reason is null or length(suppression_reason) <= 1000),
  resolved_by        uuid        references auth.users(id) on delete set null,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (run_id, tenant_id)
    references public.integration_reconciliation_runs (id, tenant_id) on delete cascade,
  constraint suppression_says_why check (
    workflow_state <> 'suppressed' or length(trim(coalesce(suppression_reason, ''))) >= 10),
  constraint closed_has_a_date check (
    (workflow_state in ('resolved', 'suppressed')) = (resolved_at is not null))
);
create index if not exists integration_discrepancies_by_run
  on public.integration_reconciliation_discrepancies (run_id, tenant_id);
create index if not exists integration_discrepancies_by_tenant_state
  on public.integration_reconciliation_discrepancies (tenant_id, workflow_state);
create index if not exists integration_discrepancies_by_assignee
  on public.integration_reconciliation_discrepancies (assigned_to);
create index if not exists integration_discrepancies_by_resolver
  on public.integration_reconciliation_discrepancies (resolved_by);

-- Who closed it is whoever closed it: stamped here, never taken from the row.
create or replace function private.stamp_discrepancy_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.workflow_state in ('resolved', 'suppressed') then
    if old.workflow_state not in ('resolved', 'suppressed') then
      new.resolved_by := auth.uid();
      new.resolved_at := now();
    else
      new.resolved_by := old.resolved_by;
      new.resolved_at := old.resolved_at;
    end if;
  else
    -- Reopened: nobody has resolved it any more.
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  if new.workflow_state <> 'suppressed' then
    new.suppression_reason := null;
  end if;
  return new;
end $$;
revoke all on function private.stamp_discrepancy_change() from public, anon, authenticated;

drop trigger if exists stamp_discrepancy_change on public.integration_reconciliation_discrepancies;
create trigger stamp_discrepancy_change
  before update on public.integration_reconciliation_discrepancies
  for each row execute function private.stamp_discrepancy_change();

-- Closing needs the date before the check runs; an insert that arrives
-- already closed is the worker's, and is stamped the same way.
create or replace function private.stamp_discrepancy_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.workflow_state in ('resolved', 'suppressed') and new.resolved_at is null then
    new.resolved_at := now();
  end if;
  return new;
end $$;
revoke all on function private.stamp_discrepancy_insert() from public, anon, authenticated;

drop trigger if exists stamp_discrepancy_insert on public.integration_reconciliation_discrepancies;
create trigger stamp_discrepancy_insert
  before insert on public.integration_reconciliation_discrepancies
  for each row execute function private.stamp_discrepancy_insert();

-- ── 3. Schema fingerprints and drift events ──────────────────────────────

create table if not exists public.integration_schema_fingerprints (
  id             uuid        primary key default gen_random_uuid(),
  tenant_id      text        not null,
  connection_id  uuid        not null,
  -- `fingerprintBatch`: field names and types, never values.
  fingerprint    text        not null check (fingerprint ~ '^[0-9a-f]{8}$'),
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  seen_count     integer     not null default 1 check (seen_count >= 1),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  unique (connection_id, fingerprint),
  constraint fingerprint_seen_in_order check (last_seen_at >= first_seen_at)
);
create index if not exists integration_schema_fingerprints_by_connection
  on public.integration_schema_fingerprints (connection_id, tenant_id);

create table if not exists public.integration_schema_drift_events (
  id               uuid        primary key default gen_random_uuid(),
  tenant_id        text        not null,
  connection_id    uuid        not null,
  sync_run_id      uuid,
  kind             text        not null check (kind in (
                     'added', 'removed', 'possible_rename', 'type_changed', 'enum_changed', 'unmapped_entity')),
  entity           text        not null check (length(trim(entity)) between 1 and 120),
  field            text        check (field is null or length(trim(field)) between 1 and 200),
  detail           text        not null default '' check (length(detail) <= 300),
  breaking         boolean     not null default false,
  detected_at      timestamptz not null default now(),
  acknowledged_by  uuid        references auth.users(id) on delete set null,
  acknowledged_at  timestamptz,
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  foreign key (sync_run_id, tenant_id)
    references public.integration_sync_runs (id, tenant_id) on delete set null (sync_run_id),
  -- A breaking change is always about a field; an unmapped entity never is.
  constraint drift_field_matches_kind check ((kind = 'unmapped_entity') = (field is null)),
  constraint drift_unmapped_never_breaks check (kind <> 'unmapped_entity' or not breaking)
);
create index if not exists integration_drift_by_connection
  on public.integration_schema_drift_events (connection_id, tenant_id);
create index if not exists integration_drift_by_sync_run
  on public.integration_schema_drift_events (sync_run_id, tenant_id);
create index if not exists integration_drift_by_tenant_open
  on public.integration_schema_drift_events (tenant_id, breaking, acknowledged_at);
create index if not exists integration_drift_by_acknowledger
  on public.integration_schema_drift_events (acknowledged_by);

-- Acknowledging is once, by whoever does it. An acknowledgement cannot be
-- taken back or reassigned: a breaking change somebody saw stays seen.
create or replace function private.stamp_drift_acknowledgement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.acknowledged_at is not null then
    raise exception 'This drift event was already acknowledged.' using errcode = '42501';
  end if;
  if new.acknowledged_at is not null or new.acknowledged_by is not null then
    new.acknowledged_by := auth.uid();
    new.acknowledged_at := now();
  end if;
  return new;
end $$;
revoke all on function private.stamp_drift_acknowledgement() from public, anon, authenticated;

drop trigger if exists stamp_drift_acknowledgement on public.integration_schema_drift_events;
create trigger stamp_drift_acknowledgement
  before update on public.integration_schema_drift_events
  for each row execute function private.stamp_drift_acknowledgement();

-- ── 4. Duplicate candidates and their resolutions ────────────────────────

create table if not exists public.integration_duplicate_candidates (
  id                uuid        primary key default gen_random_uuid(),
  tenant_id         text        not null references public.schools(id) on delete cascade,
  canonical_entity  text        not null check (canonical_entity in (
                      'term', 'program', 'course_catalog_entry', 'course_section', 'registration_window', 'enrollment')),
  -- A hash of the natural key: it identifies the group and reveals nothing.
  key_hash          text        not null check (key_hash ~ '^[0-9a-f]{8}$'),
  members           text[]      not null check (cardinality(members) between 2 and 50),
  suggested_keep    text        not null,
  why               text        not null default '' check (length(why) <= 200),
  state             text        not null default 'open' check (state in ('open', 'resolved', 'dismissed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, canonical_entity, key_hash),
  unique (id, tenant_id),
  constraint suggestion_is_a_member check (suggested_keep = any (members))
);

create table if not exists public.integration_duplicate_resolutions (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     text        not null,
  candidate_id  uuid        not null,
  kept          text        not null,
  superseded    text[]      not null check (cardinality(superseded) >= 1),
  -- Exactly what each member deferred to before, so a reversal is exact.
  before        jsonb       not null check (jsonb_typeof(before) = 'object'),
  decided_by    uuid        references auth.users(id) on delete set null,
  decided_at    timestamptz not null default now(),
  reversed_by   uuid        references auth.users(id) on delete set null,
  reversed_at   timestamptz,
  foreign key (candidate_id, tenant_id)
    references public.integration_duplicate_candidates (id, tenant_id) on delete cascade,
  constraint kept_is_not_superseded check (not (kept = any (superseded)))
);
create index if not exists integration_duplicate_resolutions_by_candidate
  on public.integration_duplicate_resolutions (candidate_id, tenant_id);
create index if not exists integration_duplicate_resolutions_by_decider
  on public.integration_duplicate_resolutions (decided_by);
create index if not exists integration_duplicate_resolutions_by_reverser
  on public.integration_duplicate_resolutions (reversed_by);

-- A resolution is written by the person deciding, keeps one member of its
-- candidate and supersedes all the others, and can be reversed once — by whoever reverses it. Nothing else
-- about it can change.
create or replace function private.guard_duplicate_resolution()
returns trigger
language plpgsql
set search_path = ''
as $$
declare group_members text[];
begin
  if tg_op = 'INSERT' then
    select members into group_members from public.integration_duplicate_candidates
     where id = new.candidate_id and tenant_id = new.tenant_id;
    -- Keeps one member and supersedes every other member exactly once, so the
    -- group is resolved whole and its reversal restores the whole group.
    if group_members is null or not (new.kept = any (group_members))
       or new.kept = any (new.superseded)
       or cardinality(new.superseded) <> (select count(distinct m) from unnest(new.superseded) m)
       or not (new.superseded <@ group_members)
       or not (group_members <@ (new.superseded || new.kept)) then
      raise exception 'A resolution keeps one member of its candidate and supersedes all the others.' using errcode = '23514';
    end if;
    new.decided_by := auth.uid();
    new.decided_at := now();
    new.reversed_by := null;
    new.reversed_at := null;
    return new;
  end if;
  if old.reversed_at is not null then
    raise exception 'This resolution was already reversed.' using errcode = '42501';
  end if;
  if new.kept is distinct from old.kept or new.superseded is distinct from old.superseded
     or new.before is distinct from old.before or new.candidate_id is distinct from old.candidate_id
     or new.decided_by is distinct from old.decided_by or new.decided_at is distinct from old.decided_at then
    raise exception 'A resolution cannot be rewritten; reverse it instead.' using errcode = '42501';
  end if;
  if new.reversed_at is not null or new.reversed_by is not null then
    new.reversed_by := auth.uid();
    new.reversed_at := now();
  end if;
  return new;
end $$;
revoke all on function private.guard_duplicate_resolution() from public, anon, authenticated;

drop trigger if exists guard_duplicate_resolution on public.integration_duplicate_resolutions;
create trigger guard_duplicate_resolution
  before insert or update on public.integration_duplicate_resolutions
  for each row execute function private.guard_duplicate_resolution();

-- ── 5. Source owners ─────────────────────────────────────────────────────

create table if not exists public.integration_source_owners (
  id                        uuid        primary key default gen_random_uuid(),
  tenant_id                 text        not null,
  connection_id             uuid        not null,
  owner_name                text        not null check (length(trim(owner_name)) between 1 and 200),
  backup_owner_name         text        not null check (length(trim(backup_owner_name)) between 1 and 200),
  freshness_target_minutes  integer     not null check (freshness_target_minutes > 0),
  stale_threshold_minutes   integer     not null,
  review_cadence_days       integer     not null default 90 check (review_cadence_days between 1 and 400),
  escalation                text        not null check (length(trim(escalation)) between 1 and 500),
  correction_route          text        not null check (length(trim(correction_route)) between 1 and 500),
  updated_by                uuid        references auth.users(id) on delete set null,
  updated_at                timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  unique (connection_id),
  constraint backup_is_somebody_else check (lower(trim(backup_owner_name)) <> lower(trim(owner_name))),
  constraint threshold_not_before_target check (stale_threshold_minutes >= freshness_target_minutes)
);
create index if not exists integration_source_owners_by_connection
  on public.integration_source_owners (connection_id, tenant_id);
create index if not exists integration_source_owners_by_updater
  on public.integration_source_owners (updated_by);

create or replace function private.stamp_source_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.stamp_source_owner() from public, anon, authenticated;

drop trigger if exists stamp_source_owner on public.integration_source_owners;
create trigger stamp_source_owner
  before insert or update on public.integration_source_owners
  for each row execute function private.stamp_source_owner();

-- ── 6. Mapping versions ──────────────────────────────────────────────────
--
-- A header over the field rows `integration_mappings` keeps per version:
-- who proposed it, the simulation it passed, who approved it, when it went
-- live. The transitions are `mapping-versions.ts`'s, enforced here.

create table if not exists public.integration_mapping_versions (
  id                    uuid        primary key default gen_random_uuid(),
  tenant_id             text        not null,
  connection_id         uuid        not null,
  external_entity_type  text        not null check (length(trim(external_entity_type)) between 1 and 120),
  mapping_version       integer     not null check (mapping_version >= 1),
  status                text        not null default 'proposed' check (status in (
                          'proposed', 'approved', 'live', 'retired', 'rolled_back')),
  proposed_by           uuid        references auth.users(id) on delete set null,
  proposed_at           timestamptz not null default now(),
  simulation_run        text        check (simulation_run is null or length(simulation_run) between 1 and 100),
  simulation_verdict    text        check (simulation_verdict is null or simulation_verdict in ('ready', 'review', 'blocked')),
  approved_by           uuid        references auth.users(id) on delete set null,
  approved_at           timestamptz,
  live_at               timestamptz,
  updated_at            timestamptz not null default now(),
  foreign key (connection_id, tenant_id)
    references public.integration_connections (id, tenant_id) on delete cascade,
  unique (connection_id, external_entity_type, mapping_version),
  -- `is not null` is not decoration: `null in (...)` is null, and a check
  -- constraint lets null through, so without it a version approved with no
  -- simulation at all passed. The check suite caught exactly that.
  constraint approved_after_a_passing_simulation check (
    status = 'proposed' or (simulation_verdict is not null and simulation_verdict in ('ready', 'review'))),
  constraint approved_by_somebody_else check (approved_by is null or approved_by <> proposed_by)
);
create index if not exists integration_mapping_versions_by_connection
  on public.integration_mapping_versions (connection_id, tenant_id);
create index if not exists integration_mapping_versions_by_proposer
  on public.integration_mapping_versions (proposed_by);
create index if not exists integration_mapping_versions_by_approver
  on public.integration_mapping_versions (approved_by);
-- One live version per entity per connection.
create unique index if not exists integration_mapping_versions_one_live
  on public.integration_mapping_versions (connection_id, external_entity_type) where status = 'live';

create or replace function private.guard_mapping_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'proposed' then
      raise exception 'A mapping version starts as proposed.' using errcode = '23514';
    end if;
    new.proposed_by := auth.uid();
    new.proposed_at := now();
    new.approved_by := null;
    new.approved_at := null;
    new.live_at := null;
    new.updated_at := now();
    return new;
  end if;

  if new.connection_id is distinct from old.connection_id or new.tenant_id is distinct from old.tenant_id
     or new.external_entity_type is distinct from old.external_entity_type
     or new.mapping_version is distinct from old.mapping_version
     or new.proposed_by is distinct from old.proposed_by or new.proposed_at is distinct from old.proposed_at then
    raise exception 'Which mapping a version is, and who proposed it, cannot change.' using errcode = '42501';
  end if;

  if new.status = old.status then
    -- Only a proposed version's simulation may be recorded, by a configurer.
    if (new.simulation_run is distinct from old.simulation_run
        or new.simulation_verdict is distinct from old.simulation_verdict)
       and (old.status <> 'proposed'
            or not private.has_capability('integration:configure', 'school', old.tenant_id)) then
      raise exception 'A simulation is recorded on a proposed version, by its configurers.' using errcode = '42501';
    end if;
    if new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at
       or new.live_at is distinct from old.live_at then
      raise exception 'Approval and go-live are recorded by changing the status.' using errcode = '42501';
    end if;
  else
    -- A status change carries no simulation: otherwise an approver could write
    -- a passing verdict and approve in one statement, and the check below would
    -- see a simulation nobody ran.
    if new.simulation_run is distinct from old.simulation_run
       or new.simulation_verdict is distinct from old.simulation_verdict then
      raise exception 'A simulation is recorded on its own, before the status changes.' using errcode = '42501';
    end if;
    if not private.has_capability('integration:approve', 'school', old.tenant_id)
       and auth.uid() is not null then
      raise exception 'Changing a version''s status needs integration:approve.' using errcode = '42501';
    end if;
    if not (   (old.status = 'proposed'   and new.status = 'approved')
            or (old.status = 'approved'   and new.status = 'live')
            or (old.status = 'live'       and new.status in ('retired', 'rolled_back'))
            or (old.status = 'retired'    and new.status = 'live')) then
      raise exception 'A version cannot go from % to %.', old.status, new.status using errcode = '23514';
    end if;
    if new.status = 'approved' then
      new.approved_by := auth.uid();
      new.approved_at := now();
      if new.approved_by is not distinct from old.proposed_by then
        raise exception 'Somebody other than the proposer must approve it.' using errcode = '42501';
      end if;
    else
      new.approved_by := old.approved_by;
      new.approved_at := old.approved_at;
    end if;
    new.live_at := case when new.status = 'live' then now() else old.live_at end;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.guard_mapping_version() from public, anon, authenticated;

drop trigger if exists guard_mapping_version on public.integration_mapping_versions;
create trigger guard_mapping_version
  before insert or update on public.integration_mapping_versions
  for each row execute function private.guard_mapping_version();

-- ── 7. The provider registry ─────────────────────────────────────────────
--
-- Semester's own claims about vendors — platform rows, not a school's. Read
-- by every signed-in account because the in-app provider list reads it;
-- written only with `platform:configure`.

create table if not exists public.provider_registry (
  id                     text        primary key check (id ~ '^[a-z][a-z0-9_]{1,40}$'),
  name                   text        not null check (length(trim(name)) between 1 and 120),
  maturity               text        not null default 'planned' check (maturity in (
                           'planned', 'manual', 'read_only', 'incremental', 'event_driven', 'authorized_writeback')),
  connector_owner        text        not null default '' check (length(connector_owner) <= 200),
  support_owner          text        not null default '' check (length(support_owner) <= 200),
  compatibility_version  text        check (compatibility_version is null or length(compatibility_version) <= 100),
  last_validated_at      timestamptz,
  updated_at             timestamptz not null default now(),
  constraint built_connector_has_owners check (
    maturity = 'planned' or (length(trim(connector_owner)) > 0 and length(trim(support_owner)) > 0)),
  constraint syncing_connector_was_tested check (
    maturity not in ('incremental', 'event_driven', 'authorized_writeback') or last_validated_at is not null)
);

create table if not exists public.provider_evidence (
  id                uuid        primary key default gen_random_uuid(),
  provider_id       text        not null references public.provider_registry(id) on delete cascade,
  kind              text        not null check (kind in ('certification', 'partnership')),
  what              text        not null check (length(trim(what)) between 1 and 200),
  -- A person's name. `providerClaim` refuses a system as a verifier; so does this.
  verified_by_name  text        not null check (
                      length(trim(verified_by_name)) between 2 and 200
                      and trim(verified_by_name) !~* '^(system|script|auto|bot)\M'),
  verified_at       timestamptz not null,
  expires_at        timestamptz,
  document          text        not null check (length(trim(document)) between 1 and 500),
  recorded_by       uuid        references auth.users(id) on delete set null,
  recorded_at       timestamptz not null default now(),
  constraint evidence_expires_after_it_was_verified check (expires_at is null or expires_at > verified_at)
);
create index if not exists provider_evidence_by_provider on public.provider_evidence (provider_id);
create index if not exists provider_evidence_by_recorder on public.provider_evidence (recorded_by);

create or replace function private.stamp_provider_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.recorded_by := auth.uid();
  new.recorded_at := now();
  return new;
end $$;
revoke all on function private.stamp_provider_evidence() from public, anon, authenticated;

drop trigger if exists stamp_provider_evidence on public.provider_evidence;
create trigger stamp_provider_evidence
  before insert or update on public.provider_evidence
  for each row execute function private.stamp_provider_evidence();

-- ── 8. Simulation runs, out of every API's reach ─────────────────────────
--
-- In `private`, which PostgREST does not expose, so no production query, no
-- dashboard read and no signed-in account can see a simulated run by
-- accident. The worker writes it with the service role; a later RPC can show
-- a summary to `integration:view`.

create table if not exists private.integration_simulation_runs (
  id          uuid        primary key default gen_random_uuid(),
  tenant_id   text        not null references public.schools(id) on delete cascade,
  adapter_id  text        not null check (adapter_id ~ '^[a-z][a-z0-9_]{2,40}$'),
  verdict     text        not null check (verdict in ('ready', 'review', 'blocked')),
  -- Counts, drift kinds and field names, as `SimulationReport` has them.
  report      jsonb       not null default '{}'::jsonb check (jsonb_typeof(report) = 'object'),
  created_by  uuid        references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists integration_simulation_runs_by_tenant on private.integration_simulation_runs (tenant_id, created_at desc);
create index if not exists integration_simulation_runs_by_creator on private.integration_simulation_runs (created_by);
alter table private.integration_simulation_runs enable row level security;
revoke all on table private.integration_simulation_runs from public, anon, authenticated;
-- The worker records runs as the service role; private tables do not inherit
-- public's default grants, so it is granted here, as gateway_rate_limit is.
grant select, insert on table private.integration_simulation_runs to service_role;

-- ── 9. Row-level security and grants ─────────────────────────────────────

alter table public.integration_reconciliation_runs          enable row level security;
alter table public.integration_reconciliation_discrepancies enable row level security;
alter table public.integration_schema_fingerprints          enable row level security;
alter table public.integration_schema_drift_events          enable row level security;
alter table public.integration_duplicate_candidates         enable row level security;
alter table public.integration_duplicate_resolutions        enable row level security;
alter table public.integration_source_owners                enable row level security;
alter table public.integration_mapping_versions             enable row level security;
alter table public.provider_registry                        enable row level security;
alter table public.provider_evidence                        enable row level security;

revoke all on table public.integration_reconciliation_runs          from anon, authenticated;
revoke all on table public.integration_reconciliation_discrepancies from anon, authenticated;
revoke all on table public.integration_schema_fingerprints          from anon, authenticated;
revoke all on table public.integration_schema_drift_events          from anon, authenticated;
revoke all on table public.integration_duplicate_candidates         from anon, authenticated;
revoke all on table public.integration_duplicate_resolutions        from anon, authenticated;
revoke all on table public.integration_source_owners                from anon, authenticated;
revoke all on table public.integration_mapping_versions             from anon, authenticated;
revoke all on table public.provider_registry                        from anon, authenticated;
revoke all on table public.provider_evidence                        from anon, authenticated;

-- Read by the school's integration viewers. Written by the worker.
grant select on table public.integration_reconciliation_runs to authenticated;
drop policy if exists "integration viewers read reconciliation runs" on public.integration_reconciliation_runs;
create policy "integration viewers read reconciliation runs" on public.integration_reconciliation_runs
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));

grant select on table public.integration_schema_fingerprints to authenticated;
drop policy if exists "integration viewers read fingerprints" on public.integration_schema_fingerprints;
create policy "integration viewers read fingerprints" on public.integration_schema_fingerprints
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));

grant select on table public.integration_duplicate_candidates to authenticated;
grant update (state) on table public.integration_duplicate_candidates to authenticated;
drop policy if exists "integration viewers read duplicate candidates" on public.integration_duplicate_candidates;
create policy "integration viewers read duplicate candidates" on public.integration_duplicate_candidates
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "reconcilers settle duplicate candidates" on public.integration_duplicate_candidates;
create policy "reconcilers settle duplicate candidates" on public.integration_duplicate_candidates
  for update to authenticated
  using (private.has_capability('integration:reconcile', 'school', tenant_id))
  with check (private.has_capability('integration:reconcile', 'school', tenant_id));

-- Discrepancies: read by viewers, worked by reconcilers — the workflow
-- columns only.
grant select on table public.integration_reconciliation_discrepancies to authenticated;
grant update (workflow_state, assigned_to, suppression_reason)
  on table public.integration_reconciliation_discrepancies to authenticated;
drop policy if exists "integration viewers read discrepancies" on public.integration_reconciliation_discrepancies;
create policy "integration viewers read discrepancies" on public.integration_reconciliation_discrepancies
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "reconcilers work discrepancies" on public.integration_reconciliation_discrepancies;
create policy "reconcilers work discrepancies" on public.integration_reconciliation_discrepancies
  for update to authenticated
  using (private.has_capability('integration:reconcile', 'school', tenant_id))
  with check (private.has_capability('integration:reconcile', 'school', tenant_id)
              and (assigned_to is null or private.subject_has_capability(
                     assigned_to, 'integration:reconcile', 'school', tenant_id)));

-- Drift: read by viewers, acknowledged once by a reconciler.
grant select on table public.integration_schema_drift_events to authenticated;
grant update (acknowledged_by, acknowledged_at) on table public.integration_schema_drift_events to authenticated;
drop policy if exists "integration viewers read drift" on public.integration_schema_drift_events;
create policy "integration viewers read drift" on public.integration_schema_drift_events
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "reconcilers acknowledge drift" on public.integration_schema_drift_events;
create policy "reconcilers acknowledge drift" on public.integration_schema_drift_events
  for update to authenticated
  using (acknowledged_at is null and private.has_capability('integration:reconcile', 'school', tenant_id))
  with check (private.has_capability('integration:reconcile', 'school', tenant_id));

-- Resolutions: made and reversed by reconcilers; never deleted by anybody signed in.
grant select on table public.integration_duplicate_resolutions to authenticated;
grant insert (tenant_id, candidate_id, kept, superseded, before) on table public.integration_duplicate_resolutions to authenticated;
grant update (reversed_by, reversed_at) on table public.integration_duplicate_resolutions to authenticated;
drop policy if exists "integration viewers read resolutions" on public.integration_duplicate_resolutions;
create policy "integration viewers read resolutions" on public.integration_duplicate_resolutions
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "reconcilers resolve duplicates" on public.integration_duplicate_resolutions;
create policy "reconcilers resolve duplicates" on public.integration_duplicate_resolutions
  for insert to authenticated with check (private.has_capability('integration:reconcile', 'school', tenant_id));
drop policy if exists "reconcilers reverse resolutions" on public.integration_duplicate_resolutions;
create policy "reconcilers reverse resolutions" on public.integration_duplicate_resolutions
  for update to authenticated
  using (reversed_at is null and private.has_capability('integration:reconcile', 'school', tenant_id))
  with check (private.has_capability('integration:reconcile', 'school', tenant_id));

-- Source owners: read by viewers, set by whoever approves sources.
grant select on table public.integration_source_owners to authenticated;
grant insert (tenant_id, connection_id, owner_name, backup_owner_name, freshness_target_minutes,
              stale_threshold_minutes, review_cadence_days, escalation, correction_route)
  on table public.integration_source_owners to authenticated;
grant update (owner_name, backup_owner_name, freshness_target_minutes, stale_threshold_minutes,
              review_cadence_days, escalation, correction_route)
  on table public.integration_source_owners to authenticated;
drop policy if exists "integration viewers read source owners" on public.integration_source_owners;
create policy "integration viewers read source owners" on public.integration_source_owners
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "source approvers name owners" on public.integration_source_owners;
create policy "source approvers name owners" on public.integration_source_owners
  for insert to authenticated with check (private.has_capability('source:approve', 'school', tenant_id));
drop policy if exists "source approvers change owners" on public.integration_source_owners;
create policy "source approvers change owners" on public.integration_source_owners
  for update to authenticated
  using (private.has_capability('source:approve', 'school', tenant_id))
  with check (private.has_capability('source:approve', 'school', tenant_id));

-- Mapping versions: proposed by configurers, moved on by approvers (the
-- trigger decides which change needs which).
grant select on table public.integration_mapping_versions to authenticated;
grant insert (tenant_id, connection_id, external_entity_type, mapping_version)
  on table public.integration_mapping_versions to authenticated;
grant update (status, simulation_run, simulation_verdict) on table public.integration_mapping_versions to authenticated;
drop policy if exists "integration viewers read mapping versions" on public.integration_mapping_versions;
create policy "integration viewers read mapping versions" on public.integration_mapping_versions
  for select to authenticated using (private.has_capability('integration:view', 'school', tenant_id));
drop policy if exists "integration configurers propose mapping versions" on public.integration_mapping_versions;
create policy "integration configurers propose mapping versions" on public.integration_mapping_versions
  for insert to authenticated with check (private.has_capability('integration:configure', 'school', tenant_id));
drop policy if exists "configurers and approvers move mapping versions" on public.integration_mapping_versions;
create policy "configurers and approvers move mapping versions" on public.integration_mapping_versions
  for update to authenticated
  using (private.has_capability('integration:configure', 'school', tenant_id)
         or private.has_capability('integration:approve', 'school', tenant_id))
  with check (private.has_capability('integration:configure', 'school', tenant_id)
              or private.has_capability('integration:approve', 'school', tenant_id));

-- Provider registry: read by anybody signed in, written by the platform.
grant select on table public.provider_registry to authenticated;
grant insert, update on table public.provider_registry to authenticated;
drop policy if exists "signed-in accounts read the provider registry" on public.provider_registry;
create policy "signed-in accounts read the provider registry" on public.provider_registry
  for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists "platform configurers add providers" on public.provider_registry;
create policy "platform configurers add providers" on public.provider_registry
  for insert to authenticated with check (private.has_capability('platform:configure', 'platform', ''));
drop policy if exists "platform configurers change providers" on public.provider_registry;
create policy "platform configurers change providers" on public.provider_registry
  for update to authenticated
  using (private.has_capability('platform:configure', 'platform', ''))
  with check (private.has_capability('platform:configure', 'platform', ''));

grant select on table public.provider_evidence to authenticated;
grant insert (provider_id, kind, what, verified_by_name, verified_at, expires_at, document)
  on table public.provider_evidence to authenticated;
drop policy if exists "signed-in accounts read provider evidence" on public.provider_evidence;
create policy "signed-in accounts read provider evidence" on public.provider_evidence
  for select to authenticated using ((select auth.uid()) is not null);
drop policy if exists "platform configurers record evidence" on public.provider_evidence;
create policy "platform configurers record evidence" on public.provider_evidence
  for insert to authenticated with check (private.has_capability('platform:configure', 'platform', ''));

-- Rolling back: drop the ten tables above and private.integration_simulation_runs,
-- the six private.* trigger functions, and the integration:reconcile
-- capability and its role row. Nothing else reads them yet.
