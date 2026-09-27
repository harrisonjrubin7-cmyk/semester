-- Semester — LTI registrations bound to a school and a connection, and grade
-- passback behind the flags.
--
-- Phase 4 of the University OS work. LTI 1.3 launch, deep linking and
-- Assignment and Grade Services already exist (`functions/lti`,
-- `_shared/lti*.ts`, `lti_*` tables). What was missing is the join to
-- everything else: an `lti_platform` row named no school, so a launch could not
-- be tied to a tenant, a tenant flag, an integration connection, a kill switch
-- or the dashboard.
--
-- ## Existing behaviour is kept, deliberately
--
-- Score passback has worked since 22 September for any link an instructor
-- placed as graded. Putting it behind `writeback.lms_grade_passback`
-- unconditionally would switch it off for every school that has not set the
-- flag. So the gate applies from the moment a registration is *bound* to a
-- school, which is an explicit operator act:
--
--   * unbound registration — passback as before, except that a **global**
--     `kill.writeback` or `kill.integration_sync` stops it too
--   * bound registration — the full gate: both tenant flags in production, an
--     approved write-direction connection that is healthy or degraded, the
--     `scope.lms.score_publish` scope approved and unexpired, and no kill
--     switch for the platform, the school or the connection
--
-- Binding a registration whose school relies on passback should therefore set
-- the two flags and approve the scope in the same change.
-- `docs/ADDITIVE-UNIVERSITY-OS-MIGRATION-PLAN.md` (D-1) records the decision.
--
-- ## What a launch records
--
-- For a bound, approved, unpaused connection with `integration.lms_lti` on, a
-- student launch records one tenant-wide canonical reference for the course
-- context: the LMS context id and nothing else — no title, no user, no role.
-- Who launched is `lti_identity`'s business and stays there. The connection's
-- last successful sync becomes the launch time, so the dashboard's freshness
-- is real.
--
-- Both functions are for the Edge Function's service role only.
--
-- Idempotent. No begin/commit — the runner opens the transaction.

-- ── 1. The binding ────────────────────────────────────────────────────────

alter table public.lti_platform
  add column if not exists tenant_id text references public.schools(id) on delete set null;
alter table public.lti_platform
  add column if not exists connection_id uuid;

alter table public.lti_platform
  drop constraint if exists lti_platform_connection_in_tenant;
alter table public.lti_platform
  add constraint lti_platform_connection_in_tenant
  foreign key (connection_id, tenant_id)
  references public.integration_connections (id, tenant_id)
  on delete set null (connection_id);

-- A composite key with a null half is not checked at all (MATCH SIMPLE), so a
-- connection without a school would slip through the key above.
alter table public.lti_platform
  drop constraint if exists lti_platform_connection_needs_tenant;
alter table public.lti_platform
  add constraint lti_platform_connection_needs_tenant
  check (connection_id is null or tenant_id is not null);

create index if not exists lti_platform_by_tenant on public.lti_platform (tenant_id);
create index if not exists lti_platform_by_connection on public.lti_platform (connection_id, tenant_id);

-- ── 2. The passback gate ──────────────────────────────────────────────────
--
-- Returns a word: `allowed`, `allowed-unbound`, or the first gate that
-- refused. The Edge Function reports anything else as `reported: false`.

create or replace function public.lti_passback_decision(want_issuer text, want_client text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.lti_platform;
  n integer;
  c public.integration_connections;
begin
  select count(*) into n from public.lti_platform
   where issuer = want_issuer and client_id = want_client;
  if n = 0 then return 'no-registration'; end if;
  if n > 1 then return 'registration-ambiguous'; end if;
  select * into p from public.lti_platform
   where issuer = want_issuer and client_id = want_client;

  -- Global stops apply to every registration, bound or not; a school's own
  -- switch applies once the registration names the school.
  if public.kill_switch_engaged('kill.writeback', p.tenant_id)
     or public.kill_switch_engaged('kill.integration_sync', p.tenant_id) then
    return 'kill-switch';
  end if;

  if p.tenant_id is null then return 'allowed-unbound'; end if;

  if public.feature_state('integration.lms_lti', p.tenant_id) <> 'production' then
    return 'module-off';
  end if;
  if public.feature_state('writeback.lms_grade_passback', p.tenant_id) <> 'production' then
    return 'flag-off';
  end if;

  if p.connection_id is null then return 'no-connection'; end if;
  select * into c from public.integration_connections where id = p.connection_id;
  if c.approved_at is null then return 'connection-not-approved'; end if;
  if c.status not in ('healthy', 'degraded') then return 'connection-' || c.status; end if;
  -- A score is a write. A connection approved read-only was not approved for it.
  if c.sync_direction = 'read' then return 'connection-read-only'; end if;
  if public.kill_switch_engaged('kill.connection.' || c.public_id, p.tenant_id) then
    return 'kill-switch';
  end if;

  if not exists (
    select 1 from public.integration_scopes s
     where s.connection_id = c.id
       and s.scope_key = 'scope.lms.score_publish'
       and s.approved
       and (s.expires_at is null or s.expires_at > now())
  ) then
    return 'scope-not-approved';
  end if;

  return 'allowed';
end $$;
revoke all on function public.lti_passback_decision(text, text) from public;
revoke all on function public.lti_passback_decision(text, text) from anon, authenticated;
grant execute on function public.lti_passback_decision(text, text) to service_role;

-- ── 3. Recording a launch's course context ────────────────────────────────

create or replace function public.lti_record_context(want_issuer text, want_client text, want_context text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.lti_platform;
  n integer;
  c public.integration_connections;
begin
  if want_context is null or length(trim(want_context)) = 0 then return 'no-context'; end if;
  select count(*) into n from public.lti_platform
   where issuer = want_issuer and client_id = want_client;
  if n <> 1 then return 'no-registration'; end if;
  select * into p from public.lti_platform
   where issuer = want_issuer and client_id = want_client;

  if p.tenant_id is null or p.connection_id is null then return 'unbound'; end if;
  if public.kill_switch_engaged('kill.integration_sync', p.tenant_id) then return 'kill-switch'; end if;
  if public.feature_state('integration.lms_lti', p.tenant_id) <> 'production' then return 'module-off'; end if;

  select * into c from public.integration_connections where id = p.connection_id;
  if c.approved_at is null then return 'connection-not-approved'; end if;
  if c.status in ('paused', 'disconnected') then return 'connection-' || c.status; end if;
  if public.kill_switch_engaged('kill.connection.' || c.public_id, p.tenant_id) then return 'kill-switch'; end if;

  insert into public.canonical_entity_references
    (tenant_id, canonical_entity_type, canonical_entity_id, subject_user_id, connection_id,
     source_system, source_record_id, source_timestamp, source_of_truth, classification,
     freshness_status, mapping_version, confidence)
  values
    (p.tenant_id, 'lms_context', 'lti:' || c.public_id || ':' || left(want_context, 150), null, c.id,
     'LTI 1.3 ' || left(want_issuer, 100), left(want_context, 200), now(), 'LMS', 'T0',
     'live', 1, 1)
  on conflict (tenant_id, source_system, source_record_id, canonical_entity_type)
  do update set source_timestamp = excluded.source_timestamp,
                freshness_status = 'live',
                connection_id = excluded.connection_id,
                external_deleted_at = null,
                updated_at = now();

  -- A launch is the LMS telling us, just now, that this course exists: that
  -- is a successful read, and it is what earns `healthy` back.
  update public.integration_connections
     set last_successful_sync_at = now(),
         last_attempt_at = now(),
         status = case when status in ('configuring', 'degraded', 'error') then 'healthy' else status end,
         updated_at = now()
   where id = c.id;

  return 'recorded';
end $$;
revoke all on function public.lti_record_context(text, text, text) from public;
revoke all on function public.lti_record_context(text, text, text) from anon, authenticated;
grant execute on function public.lti_record_context(text, text, text) to service_role;

comment on column public.lti_platform.tenant_id is
  'The school this registration belongs to. Null keeps the pre-binding behaviour (passback gated only by global kill switches).';
comment on column public.lti_platform.connection_id is
  'The integration connection this registration is. Passback and context recording need it approved.';
