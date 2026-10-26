-- Protected incident-evidence metadata and an append-only custody chain.
--
-- Evidence bytes remain in an approved immutable evidence repository. This
-- database stores only an opaque `evidence://` locator, a digest, size,
-- classification and custody events. It never stores log bodies, screenshots,
-- tokens, signed object URLs or student data. Nothing here deploys or selects
-- an evidence provider; it gives an authorized incident responder a fail-closed
-- record once that provider exists.

create table if not exists private.incident_evidence_artifact (
  id                uuid        primary key default gen_random_uuid(),
  public_id         text        not null unique default private.public_id('evidence'),
  incident_id       uuid        not null references public.platform_incident(id) on delete restrict,
  tenant_id         text        references public.schools(id) on delete restrict,
  kind              text        not null check (kind in (
                      'audit-log', 'provider-log', 'configuration', 'screenshot',
                      'export', 'communication', 'timeline', 'other')),
  source_system     text        not null check (
                      source_system ~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{1,119}$'),
  evidence_locator  text        not null unique check (
                      evidence_locator ~ '^evidence://[A-Za-z0-9][A-Za-z0-9._/-]{2,250}$'),
  sha256            text        not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size         bigint      not null check (byte_size between 1 and 1099511627776),
  classification    text        not null
                    check (classification in ('restricted', 'confidential')),
  captured_at       timestamptz not null,
  retention_until   timestamptz not null,
  recorded_by_sha256 text       not null check (recorded_by_sha256 ~ '^[0-9a-f]{64}$'),
  recorded_at       timestamptz not null default now(),
  constraint incident_evidence_time_bounds check (
    isfinite(captured_at)
    and isfinite(retention_until)
    and captured_at <= recorded_at + interval '5 minutes'
    and retention_until > captured_at
    and retention_until >= recorded_at + interval '30 days')
);

create index if not exists incident_evidence_artifact_by_incident_time
  on private.incident_evidence_artifact (incident_id, captured_at desc, id);
create index if not exists incident_evidence_artifact_by_tenant
  on private.incident_evidence_artifact (tenant_id, id);
create index if not exists incident_evidence_artifact_by_retention
  on private.incident_evidence_artifact (retention_until, id);

create table if not exists private.incident_evidence_custody_event (
  seq             bigint generated always as identity primary key,
  artifact_id     uuid        not null references private.incident_evidence_artifact(id) on delete restrict,
  action          text        not null check (action in (
                    'captured', 'transferred', 'verified', 'verification_failed')),
  custodian       text        not null check (custodian ~ '^[a-z][a-z0-9._-]{1,63}$'),
  reason_code     text        not null check (reason_code ~ '^[a-z][a-z0-9._-]{2,63}$'),
  observed_sha256 text        not null check (observed_sha256 ~ '^[0-9a-f]{64}$'),
  actor_sha256    text        not null check (actor_sha256 ~ '^[0-9a-f]{64}$'),
  occurred_at     timestamptz not null default now() check (isfinite(occurred_at)),
  previous_hash   text        not null check (previous_hash ~ '^[0-9a-f]{64}$'),
  event_hash      text        not null check (event_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists incident_evidence_custody_by_artifact
  on private.incident_evidence_custody_event (artifact_id, seq);

alter table private.incident_evidence_artifact enable row level security;
alter table private.incident_evidence_custody_event enable row level security;
revoke all on table private.incident_evidence_artifact from public, anon, authenticated, service_role;
revoke all on table private.incident_evidence_custody_event from public, anon, authenticated, service_role;

create or replace function private.refuse_incident_evidence_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Incident evidence and custody records are append-only.' using errcode = '42501';
end $$;

revoke all on function private.refuse_incident_evidence_change() from public, anon, authenticated;

create or replace function private.incident_evidence_custody_canonical(
  want_evidence_ref text,
  want_seq bigint,
  want_action text,
  want_custodian text,
  want_reason_code text,
  want_observed_sha256 text,
  want_actor_sha256 text,
  want_occurred_at timestamptz,
  want_previous_hash text
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'evidence_ref', want_evidence_ref,
    'seq', want_seq,
    'action', want_action,
    'custodian', want_custodian,
    'reason_code', want_reason_code,
    'observed_sha256', want_observed_sha256,
    'actor_sha256', want_actor_sha256,
    'occurred_at', to_char(want_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'previous_hash', want_previous_hash
  )::text;
$$;

revoke all on function private.incident_evidence_custody_canonical(text, bigint, text, text, text, text, text, timestamptz, text)
  from public, anon, authenticated;

drop trigger if exists keep_incident_evidence_artifact_immutable on private.incident_evidence_artifact;
create trigger keep_incident_evidence_artifact_immutable
  before update or delete on private.incident_evidence_artifact
  for each row execute function private.refuse_incident_evidence_change();

drop trigger if exists keep_incident_evidence_custody_immutable on private.incident_evidence_custody_event;
create trigger keep_incident_evidence_custody_immutable
  before update or delete on private.incident_evidence_custody_event
  for each row execute function private.refuse_incident_evidence_change();

create or replace function private.chain_incident_evidence_custody()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  prior text;
  artifact_ref text;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.artifact_id::text, 0));
  select e.event_hash into prior
    from private.incident_evidence_custody_event e
   where e.artifact_id = new.artifact_id
   order by e.seq desc
   limit 1;
  new.previous_hash := coalesce(prior, repeat('0', 64));
  select a.public_id into artifact_ref
    from private.incident_evidence_artifact a
   where a.id = new.artifact_id;
  if artifact_ref is null then
    raise exception 'The evidence artifact does not exist.' using errcode = '23503';
  end if;
  new.event_hash := private.console_audit_sha256(
    private.incident_evidence_custody_canonical(
      artifact_ref, new.seq, new.action, new.custodian, new.reason_code,
      new.observed_sha256, new.actor_sha256, new.occurred_at,
      new.previous_hash));
  return new;
end $$;

revoke all on function private.chain_incident_evidence_custody() from public, anon, authenticated;

drop trigger if exists chain_incident_evidence_custody on private.incident_evidence_custody_event;
create trigger chain_incident_evidence_custody
  before insert on private.incident_evidence_custody_event
  for each row execute function private.chain_incident_evidence_custody();

create or replace function public.record_incident_evidence(
  want_incident text,
  want_kind text,
  want_source_system text,
  want_evidence_locator text,
  want_sha256 text,
  want_byte_size bigint,
  want_captured_at timestamptz,
  want_retention_until timestamptz,
  want_classification text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  incident public.platform_incident;
  artifact_id uuid := gen_random_uuid();
  evidence_ref text := private.public_id('evidence');
begin
  if me is null
     or not private.has_capability('console:operate', 'platform', '')
     or not private.has_capability('incident:communicate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'Platform incident response capability is required.';
  end if;
  perform private.assert_fresh_mfa();

  select i.* into incident from public.platform_incident i where i.public_id = want_incident;
  if not found then
    raise exception 'The incident reference does not exist.' using errcode = '22023';
  end if;

  -- The table constraints validate every bounded field. Write the console
  -- audit event first so a broken audit path rolls the whole operation back.
  perform private.console_audit_write(
    me, 'authenticated', incident.tenant_id, 'incident.evidence_recorded', evidence_ref,
    jsonb_build_object('incident_ref', incident.public_id, 'kind', want_kind,
      'classification', want_classification,
      'sha256', want_sha256, 'byte_size', want_byte_size),
    'incident-evidence:' || evidence_ref);

  insert into private.incident_evidence_artifact (
    id, public_id, incident_id, tenant_id, kind, source_system,
    evidence_locator, sha256, byte_size, classification, captured_at,
    retention_until, recorded_by_sha256
  ) values (
    artifact_id, evidence_ref, incident.id, incident.tenant_id, want_kind,
    want_source_system, want_evidence_locator, want_sha256, want_byte_size,
    want_classification, want_captured_at, want_retention_until,
    private.role_audit_sha256(me::text)
  );

  insert into private.incident_evidence_custody_event (
    artifact_id, action, custodian, reason_code, observed_sha256, actor_sha256,
    previous_hash, event_hash
  ) values (
    artifact_id, 'captured', 'incident-response', 'initial-capture',
    want_sha256, private.role_audit_sha256(me::text), repeat('0', 64), repeat('0', 64)
  );

  return evidence_ref;
end $$;

create or replace function public.record_incident_evidence_custody(
  want_evidence text,
  want_action text,
  want_custodian text,
  want_reason_code text,
  want_observed_sha256 text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  artifact private.incident_evidence_artifact;
  new_seq bigint;
begin
  if me is null
     or not private.has_capability('console:operate', 'platform', '')
     or not private.has_capability('incident:communicate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'Platform incident response capability is required.';
  end if;
  perform private.assert_fresh_mfa();
  if want_action not in ('transferred', 'verified', 'verification_failed') then
    raise exception 'Custody action must be transferred, verified or verification_failed.' using errcode = '22023';
  end if;

  select a.* into artifact
    from private.incident_evidence_artifact a
   where a.public_id = want_evidence
   for update;
  if not found then
    raise exception 'The evidence reference does not exist.' using errcode = '22023';
  end if;
  if want_action in ('transferred', 'verified') and want_observed_sha256 is distinct from artifact.sha256 then
    raise exception 'A successful custody event must match the captured digest.' using errcode = '23514';
  end if;
  if want_action = 'verification_failed' and want_observed_sha256 is not distinct from artifact.sha256 then
    raise exception 'verification_failed requires a mismatched observed digest.' using errcode = '23514';
  end if;

  perform private.console_audit_write(
    me, 'authenticated', artifact.tenant_id, 'incident.evidence_' || want_action,
    artifact.public_id,
    jsonb_build_object('action', want_action, 'observed_sha256', want_observed_sha256),
    'incident-evidence:' || artifact.public_id);

  insert into private.incident_evidence_custody_event (
    artifact_id, action, custodian, reason_code, observed_sha256, actor_sha256,
    previous_hash, event_hash
  ) values (
    artifact.id, want_action, want_custodian, want_reason_code,
    want_observed_sha256, private.role_audit_sha256(me::text), repeat('0', 64), repeat('0', 64)
  ) returning seq into new_seq;
  return new_seq;
end $$;

create or replace function public.incident_evidence_custody(want_incident text)
returns table (
  evidence_ref text,
  kind text,
  source_system text,
  evidence_locator text,
  sha256 text,
  byte_size bigint,
  classification text,
  captured_at timestamptz,
  retention_until timestamptz,
  custody_seq bigint,
  custody_action text,
  custodian text,
  custody_reason_code text,
  observed_sha256 text,
  custody_actor_sha256 text,
  custody_at timestamptz,
  previous_hash text,
  event_hash text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  incident public.platform_incident;
begin
  if me is null
     or not private.has_capability('console:operate', 'platform', '')
     or not private.has_capability('incident:communicate', 'platform', '') then
    raise exception using errcode = '42501',
      message = 'Platform incident response capability is required.';
  end if;
  perform private.assert_fresh_mfa();
  select i.* into incident from public.platform_incident i where i.public_id = want_incident;
  if not found then
    raise exception 'The incident reference does not exist.' using errcode = '22023';
  end if;

  perform private.console_audit_write(
    me, 'authenticated', incident.tenant_id, 'incident.evidence_read', incident.public_id,
    jsonb_build_object('incident_ref', incident.public_id),
    'incident-evidence-read:' || incident.public_id);

  return query
  select a.public_id, a.kind, a.source_system, a.evidence_locator, a.sha256,
         a.byte_size, a.classification, a.captured_at, a.retention_until,
         c.seq, c.action, c.custodian, c.reason_code, c.observed_sha256,
         c.actor_sha256, c.occurred_at, c.previous_hash, c.event_hash
    from private.incident_evidence_artifact a
    join private.incident_evidence_custody_event c on c.artifact_id = a.id
   where a.incident_id = incident.id
   order by a.captured_at, a.id, c.seq;
end $$;

revoke all on function public.record_incident_evidence(text, text, text, text, text, bigint, timestamptz, timestamptz, text)
  from public, anon;
revoke all on function public.record_incident_evidence_custody(text, text, text, text, text)
  from public, anon;
revoke all on function public.incident_evidence_custody(text) from public, anon;
grant execute on function public.record_incident_evidence(text, text, text, text, text, bigint, timestamptz, timestamptz, text)
  to authenticated;
grant execute on function public.record_incident_evidence_custody(text, text, text, text, text)
  to authenticated;
grant execute on function public.incident_evidence_custody(text) to authenticated;

comment on table private.incident_evidence_artifact is
  'Immutable incident-evidence metadata. Evidence bytes stay in an approved repository behind an opaque evidence:// reference.';
comment on table private.incident_evidence_custody_event is
  'Append-only, hash-linked custody events for incident evidence.';
comment on function public.record_incident_evidence(text, text, text, text, text, bigint, timestamptz, timestamptz, text) is
  'Records bounded evidence metadata and the initial custody event. Requires platform incident response capability and fresh MFA.';
comment on function public.record_incident_evidence_custody(text, text, text, text, text) is
  'Appends a transfer or verification to the evidence custody chain. Requires platform incident response capability and fresh MFA.';
comment on function public.incident_evidence_custody(text) is
  'Reads one incident custody ledger through an audited, fresh-MFA path. Returns metadata only, never evidence bytes.';
