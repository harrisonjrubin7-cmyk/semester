-- Forward-only hardening for the privileged access review merged in
-- 20261011160000_privileged_access_review.sql. Existing review rows cannot
-- acquire a historical capability snapshot after the fact, so they are marked
-- backfilled and may close only through the investigation path.

alter table private.privileged_access_review_item
  add column if not exists capabilities text[];
alter table private.privileged_access_review_item
  add column if not exists capabilities_backfilled boolean not null default true;

alter table private.privileged_access_review_item
  disable trigger keep_privileged_access_review_item_immutable;
update private.privileged_access_review_item i
   set capabilities = array(
     select distinct rc.capability
       from public.role_capabilities rc
      where rc.role = i.role
      order by rc.capability
   )
 where i.capabilities is null;
alter table private.privileged_access_review_item
  enable trigger keep_privileged_access_review_item_immutable;

do $$
begin
  if exists (
    select 1 from private.privileged_access_review_item
     where capabilities is null
  ) then
    raise exception 'Every existing access-review item must have a capability snapshot, even when the historical role now maps to an empty set.';
  end if;
end $$;

alter table private.privileged_access_review_item
  alter column capabilities set not null;
alter table private.privileged_access_review_item
  alter column capabilities_backfilled set default false;
alter table private.privileged_access_review_item
  drop constraint if exists privileged_access_review_item_capabilities_check;
alter table private.privileged_access_review_item
  add constraint privileged_access_review_item_capabilities_check
  check (capabilities_backfilled or cardinality(capabilities) > 0);

alter table private.privileged_access_review_decision
  add column if not exists remediation_applied boolean not null default false;
alter table private.privileged_access_review_decision
  alter column remediation_applied set default false;
alter table private.privileged_access_review_decision
  drop constraint if exists privileged_access_review_decision_reason;
alter table private.privileged_access_review_decision
  add constraint privileged_access_review_decision_reason check (
    (decision = 'retain' and reason_code in ('still-required', 'least-privilege-confirmed'))
    or (decision = 'revoke' and reason_code in (
      'access-ended', 'unauthorized', 'inactive', 'scope-changed', 'mfa-not-current'))
    or (decision = 'investigate' and reason_code in (
      'mfa-not-current', 'ownership-unknown', 'conflict-review', 'activity-review'))
  ) not valid;

do $$
begin
  if not exists (
    select 1 from private.privileged_access_review_decision
     where not (
       (decision = 'retain' and reason_code in ('still-required', 'least-privilege-confirmed'))
       or (decision = 'revoke' and reason_code in (
         'access-ended', 'unauthorized', 'inactive', 'scope-changed', 'mfa-not-current'))
       or (decision = 'investigate' and reason_code in (
         'mfa-not-current', 'ownership-unknown', 'conflict-review', 'activity-review'))
     )
  ) then
    alter table private.privileged_access_review_decision
      validate constraint privileged_access_review_decision_reason;
  end if;
end $$;

create table if not exists private.privileged_access_review_remediation (
  decision_id uuid primary key references private.privileged_access_review_decision(id) on delete restrict,
  grant_id uuid not null,
  outcome text not null check (outcome = 'revoked-by-review'),
  applied_by_sha256 text not null check (applied_by_sha256 ~ '^[0-9a-f]{64}$'),
  applied_at timestamptz not null default now()
);

create table if not exists private.privileged_access_review_post_decision_resolution (
  id uuid primary key default gen_random_uuid(),
  resolution_sequence bigint generated always as identity,
  decision_id uuid not null references private.privileged_access_review_decision(id) on delete restrict,
  resolution_code text not null check (resolution_code = 'superseded-by-approved-change'),
  observed_state_sha256 text not null check (observed_state_sha256 ~ '^[0-9a-f]{64}$'),
  resolved_by_sha256 text not null check (resolved_by_sha256 ~ '^[0-9a-f]{64}$'),
  resolved_at timestamptz not null default now(),
  unique (decision_id, observed_state_sha256)
);

create table if not exists private.privileged_access_review_investigation_state_resolution (
  id uuid primary key default gen_random_uuid(),
  resolution_sequence bigint generated always as identity,
  decision_id uuid not null references private.privileged_access_review_decision(id) on delete restrict,
  resolution_code text not null check (resolution_code in ('remediated', 'risk-accepted', 'false-positive')),
  observed_state_sha256 text not null check (observed_state_sha256 ~ '^[0-9a-f]{64}$'),
  resolved_by_sha256 text not null check (resolved_by_sha256 ~ '^[0-9a-f]{64}$'),
  resolved_at timestamptz not null default now(),
  unique (decision_id, observed_state_sha256)
);

alter table private.privileged_access_review_post_decision_resolution
  add column if not exists resolution_sequence bigint generated always as identity;
alter table private.privileged_access_review_investigation_state_resolution
  add column if not exists resolution_sequence bigint generated always as identity;

create index if not exists privileged_access_review_post_resolution_by_decision
  on private.privileged_access_review_post_decision_resolution (decision_id, resolved_at desc);
create index if not exists privileged_access_review_investigation_state_by_decision
  on private.privileged_access_review_investigation_state_resolution (decision_id, resolved_at desc);
create unique index if not exists privileged_access_review_post_resolution_sequence
  on private.privileged_access_review_post_decision_resolution (resolution_sequence);
create unique index if not exists privileged_access_review_investigation_state_sequence
  on private.privileged_access_review_investigation_state_resolution (resolution_sequence);
create index if not exists privileged_access_review_post_resolution_by_decision_sequence
  on private.privileged_access_review_post_decision_resolution (decision_id, resolution_sequence desc);
create index if not exists privileged_access_review_investigation_state_by_decision_sequence
  on private.privileged_access_review_investigation_state_resolution (decision_id, resolution_sequence desc);

alter table private.privileged_access_review_remediation enable row level security;
alter table private.privileged_access_review_post_decision_resolution enable row level security;
alter table private.privileged_access_review_investigation_state_resolution enable row level security;
revoke all on table private.privileged_access_review_remediation from public, anon, authenticated, service_role;
revoke all on table private.privileged_access_review_post_decision_resolution from public, anon, authenticated, service_role;
revoke all on table private.privileged_access_review_investigation_state_resolution from public, anon, authenticated, service_role;

drop trigger if exists keep_privileged_access_review_remediation_immutable on private.privileged_access_review_remediation;
create trigger keep_privileged_access_review_remediation_immutable
  before update or delete on private.privileged_access_review_remediation
  for each row execute function private.refuse_privileged_access_review_change();
drop trigger if exists keep_privileged_access_review_post_decision_resolution_immutable on private.privileged_access_review_post_decision_resolution;
create trigger keep_privileged_access_review_post_decision_resolution_immutable
  before update or delete on private.privileged_access_review_post_decision_resolution
  for each row execute function private.refuse_privileged_access_review_change();
drop trigger if exists keep_privileged_access_review_investigation_state_immutable on private.privileged_access_review_investigation_state_resolution;
create trigger keep_privileged_access_review_investigation_state_immutable
  before update or delete on private.privileged_access_review_investigation_state_resolution
  for each row execute function private.refuse_privileged_access_review_change();

create or replace function private.privileged_access_review_grant_state_sha256(
  want_subject uuid, want_role text, want_scope_kind text, want_scope_id text,
  want_provenance text, want_granted_at timestamptz, want_expires_at timestamptz,
  want_revoked_at timestamptz, want_capabilities text[], want_live boolean
) returns text language sql immutable set search_path = '' as $$
  select private.role_audit_sha256(
    case when want_subject is null then 'missing'
      else concat_ws('|', want_subject::text, want_role, want_scope_kind, want_scope_id,
        want_provenance, extract(epoch from want_granted_at)::text,
        coalesce(extract(epoch from want_expires_at)::text, ''),
        coalesce(extract(epoch from want_revoked_at)::text, ''),
        array_to_string(want_capabilities, ','), want_live::text) end);
$$;
revoke all on function private.privileged_access_review_grant_state_sha256(
  uuid, text, text, text, text, timestamptz, timestamptz, timestamptz, text[], boolean
) from public, anon, authenticated, service_role;

-- Preserve the original privileged_access_review(text) return contract. The
-- enriched evidence shape is published under a new name so a full migration
-- replay can safely CREATE OR REPLACE the original function on every pass.

create or replace function public.begin_privileged_access_review(
  want_request_key text, want_period_start date, want_period_end date, want_next_due date
) returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); made uuid := gen_random_uuid(); ref text := private.public_id('access-review');
  snapshot_time timestamptz; expected integer; actual integer; existing private.privileged_access_review;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  perform pg_advisory_xact_lock(hashtext('private.privileged_access_review'));
  select r.* into existing from private.privileged_access_review r where r.request_key = want_request_key;
  if found then
    if existing.period_start <> want_period_start or existing.period_end <> want_period_end
       or existing.next_due <> want_next_due then
      raise exception 'The request key is already bound to another review.' using errcode = '22023';
    end if;
    return existing.public_id;
  end if;
  if exists (select 1 from private.privileged_access_review r
    where not exists (select 1 from private.privileged_access_review_signoff s where s.review_id = r.id)) then
    raise exception 'Finish the existing open access review before starting another.' using errcode = '55000';
  end if;
  -- Keep the same lock order as console_act(): append the audit event before
  -- taking a table lock that can wait on a grant writer.
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.started', ref,
    jsonb_build_object('period_start', want_period_start, 'period_end', want_period_end,
      'next_due', want_next_due), 'access-review:' || ref);
  lock table public.role_grants in share mode;
  lock table public.role_capabilities in share mode;
  if not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope must remain current through review start.' using errcode = '42501';
  end if;
  if (select count(distinct g.subject) from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role and rc.capability = 'access_review:manage'
      where g.scope_kind = 'platform' and g.scope_id = '' and g.revoked_at is null
        and (g.expires_at is null or g.expires_at > clock_timestamp())) < 3 then
    raise exception 'Three independently staffed access-review operators are required.' using errcode = '55000';
  end if;
  snapshot_time := clock_timestamp();
  select count(*) into expected from public.role_grants g
   where g.revoked_at is null and (g.expires_at is null or g.expires_at > snapshot_time)
     and exists (select 1 from public.role_capabilities rc where rc.role = g.role);
  insert into private.privileged_access_review
    (id, public_id, request_key, period_start, period_end, next_due, snapshot_at, started_by_sha256, item_count)
  values (made, ref, want_request_key, want_period_start, want_period_end, want_next_due,
    snapshot_time, private.role_audit_sha256(me::text), expected);
  insert into private.privileged_access_review_item
    (review_id, grant_id, subject_sha256, role, capabilities, scope_kind, scope_id,
      provenance, granted_by_sha256, granted_at, expires_at)
  select made, g.id, private.role_audit_sha256(g.subject::text), g.role,
         array(select distinct rc.capability from public.role_capabilities rc
           where rc.role = g.role order by rc.capability), g.scope_kind,
         g.scope_id, g.provenance,
         case when g.granted_by is null then null else private.role_audit_sha256(g.granted_by::text) end,
         g.granted_at, g.expires_at
    from public.role_grants g
   where g.revoked_at is null and (g.expires_at is null or g.expires_at > snapshot_time)
     and exists (select 1 from public.role_capabilities rc where rc.role = g.role);
  get diagnostics actual = row_count;
  if actual <> expected then
    raise exception 'Role grants changed during the snapshot; retry the review.' using errcode = '40001';
  end if;
  return ref;
end $$;

create or replace function public.decide_privileged_access_review_item(
  want_item text, want_decision text, want_reason_code text
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); actor_hash text; item private.privileged_access_review_item;
  review private.privileged_access_review; grant_row public.role_grants;
  grant_current boolean; grant_found boolean; decision_id uuid; current_capabilities text[];
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa(); actor_hash := private.role_audit_sha256(me::text);
  perform pg_advisory_xact_lock(hashtext('private.privileged_access_review'));
  if want_decision not in ('retain', 'revoke', 'investigate') then raise exception 'Invalid review decision.' using errcode = '22023'; end if;
  if not (
    (want_decision = 'retain' and want_reason_code in ('still-required', 'least-privilege-confirmed'))
    or (want_decision = 'revoke' and want_reason_code in (
      'access-ended', 'unauthorized', 'inactive', 'scope-changed', 'mfa-not-current'))
    or (want_decision = 'investigate' and want_reason_code in (
      'mfa-not-current', 'ownership-unknown', 'conflict-review', 'activity-review'))
  ) then
    raise exception 'The reason code is not valid for that decision.' using errcode = '22023';
  end if;
  select i.* into item from private.privileged_access_review_item i where i.public_id = want_item;
  if not found then raise exception 'No such review item.' using errcode = '22023'; end if;
  select r.* into review from private.privileged_access_review r where r.id = item.review_id;
  if actor_hash = item.subject_sha256 then
    raise exception 'A grant subject cannot decide their own item.' using errcode = '42501';
  end if;
  if exists (select 1 from private.privileged_access_review_signoff s where s.review_id = review.id)
     or exists (select 1 from private.privileged_access_review_decision d where d.item_id = item.id) then
    raise exception 'This review item is already closed.' using errcode = '23505';
  end if;
  -- Match console_act(): audit before locking the grant row. The decision and
  -- any revoke remediation then commit atomically with that row lock held.
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.item_' || want_decision,
    item.public_id, jsonb_build_object('review', review.public_id, 'reason_code', want_reason_code),
    'access-review:' || review.public_id);
  select g.* into grant_row from public.role_grants g where g.id = item.grant_id for update;
  grant_found := found;
  lock table public.role_capabilities in share mode;
  if not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope must remain current through the decision.' using errcode = '42501';
  end if;
  select array(select distinct rc.capability from public.role_capabilities rc
    where rc.role = item.role order by rc.capability) into current_capabilities;
  grant_current := grant_found and grant_row.role = item.role
    and private.role_audit_sha256(grant_row.subject::text) = item.subject_sha256
    and grant_row.scope_kind = item.scope_kind and grant_row.scope_id = item.scope_id
    and grant_row.provenance = item.provenance and grant_row.granted_at = item.granted_at
    and grant_row.expires_at is not distinct from item.expires_at and grant_row.revoked_at is null
    and (grant_row.expires_at is null or grant_row.expires_at > clock_timestamp())
    and not item.capabilities_backfilled and current_capabilities = item.capabilities;
  if not grant_current and want_decision <> 'investigate' then
    raise exception 'A changed grant can only be closed as investigate.' using errcode = '40001';
  end if;
  insert into private.privileged_access_review_decision
    (item_id, decision, reason_code, decided_by_sha256, remediation_applied, decided_at)
  values (item.id, want_decision, want_reason_code, actor_hash, want_decision = 'revoke', clock_timestamp())
  returning id into decision_id;
  if want_decision = 'revoke' then
    update public.role_grants set revoked_at = clock_timestamp() where id = item.grant_id;
    insert into private.privileged_access_review_remediation
      (decision_id, grant_id, outcome, applied_by_sha256, applied_at)
    values (decision_id, item.grant_id, 'revoked-by-review', actor_hash, clock_timestamp());
  end if;
end $$;

create or replace function public.resolve_privileged_access_review_investigation(
  want_item text, want_resolution_code text
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); actor_hash text; item private.privileged_access_review_item;
  decision private.privileged_access_review_decision; review private.privileged_access_review;
  grant_row public.role_grants; grant_found boolean; current_capabilities text[]; observed_state text;
  existing_resolution private.privileged_access_review_investigation_state_resolution;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa(); actor_hash := private.role_audit_sha256(me::text);
  perform pg_advisory_xact_lock(hashtext('private.privileged_access_review'));
  if want_resolution_code not in ('remediated', 'risk-accepted', 'false-positive') then
    raise exception 'Invalid investigation resolution.' using errcode = '22023';
  end if;
  select i.* into item from private.privileged_access_review_item i where i.public_id = want_item;
  select d.* into decision from private.privileged_access_review_decision d where d.item_id = item.id;
  if not found or decision.decision <> 'investigate' then
    raise exception 'The item has no investigation to resolve.' using errcode = '22023';
  end if;
  select r.* into review from private.privileged_access_review r where r.id = item.review_id;
  if exists (select 1 from private.privileged_access_review_signoff s where s.review_id = review.id) then
    raise exception 'The review is already signed.' using errcode = '23505';
  end if;
  if actor_hash in (item.subject_sha256, decision.decided_by_sha256) then
    raise exception 'A distinct operator must resolve the investigation.' using errcode = '42501';
  end if;
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.investigation_resolved',
    item.public_id, jsonb_build_object('review', review.public_id, 'resolution_code', want_resolution_code),
    'access-review:' || review.public_id);
  select g.* into grant_row from public.role_grants g where g.id = item.grant_id for update;
  grant_found := found;
  if grant_found and actor_hash = private.role_audit_sha256(grant_row.subject::text) then
    raise exception 'A grant subject cannot resolve their own investigation.' using errcode = '42501';
  end if;
  lock table public.role_capabilities in share mode;
  if not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope must remain current through investigation resolution.' using errcode = '42501';
  end if;
  select array(select distinct rc.capability from public.role_capabilities rc
    where rc.role = case when grant_found then grant_row.role else item.role end
    order by rc.capability) into current_capabilities;
  observed_state := private.privileged_access_review_grant_state_sha256(
    case when grant_found then grant_row.subject else null end,
    case when grant_found then grant_row.role else null end,
    case when grant_found then grant_row.scope_kind else null end,
    case when grant_found then grant_row.scope_id else null end,
    case when grant_found then grant_row.provenance else null end,
    case when grant_found then grant_row.granted_at else null end,
    case when grant_found then grant_row.expires_at else null end,
    case when grant_found then grant_row.revoked_at else null end,
    current_capabilities,
    grant_found and grant_row.revoked_at is null
      and (grant_row.expires_at is null or grant_row.expires_at > clock_timestamp()));
  select x.* into existing_resolution
    from private.privileged_access_review_investigation_state_resolution x
   where x.decision_id = decision.id and x.observed_state_sha256 = observed_state;
  if found then
    if existing_resolution.resolution_code <> want_resolution_code then
      raise exception 'That observed state already has a different investigation resolution.' using errcode = '23505';
    end if;
    if existing_resolution.resolved_by_sha256 <> actor_hash then
      raise exception 'That observed state was resolved by another operator.' using errcode = '42501';
    end if;
    return;
  end if;
  insert into private.privileged_access_review_investigation_resolution
    (decision_id, resolution_code, resolved_by_sha256, resolved_at)
  values (decision.id, want_resolution_code, actor_hash, clock_timestamp())
  on conflict (decision_id) do nothing;
  insert into private.privileged_access_review_investigation_state_resolution
    (decision_id, resolution_code, observed_state_sha256, resolved_by_sha256, resolved_at)
  values (decision.id, want_resolution_code, observed_state, actor_hash, clock_timestamp())
  on conflict (decision_id, observed_state_sha256) do nothing;
end $$;

create or replace function public.resolve_privileged_access_review_post_decision_change(want_item text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); actor_hash text; item private.privileged_access_review_item;
  decision private.privileged_access_review_decision; review private.privileged_access_review;
  grant_row public.role_grants; grant_found boolean; grant_current boolean; current_capabilities text[];
  observed_state text;
  existing_resolution private.privileged_access_review_post_decision_resolution;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa(); actor_hash := private.role_audit_sha256(me::text);
  perform pg_advisory_xact_lock(hashtext('private.privileged_access_review'));
  select i.* into item from private.privileged_access_review_item i where i.public_id = want_item;
  select d.* into decision from private.privileged_access_review_decision d where d.item_id = item.id;
  if not found or decision.decision not in ('retain', 'revoke') then
    raise exception 'Only a changed retain or legacy revoke decision can be resolved here.' using errcode = '22023';
  end if;
  select r.* into review from private.privileged_access_review r where r.id = item.review_id;
  if exists (select 1 from private.privileged_access_review_signoff s where s.review_id = review.id) then
    raise exception 'The review is already signed.' using errcode = '23505';
  end if;
  if actor_hash in (item.subject_sha256, decision.decided_by_sha256) then
    raise exception 'A distinct operator must resolve the post-decision change.' using errcode = '42501';
  end if;
  perform private.console_audit_write(me, 'authenticated', null,
    'access_review.post_decision_change_resolved', item.public_id,
    jsonb_build_object('review', review.public_id, 'resolution_code', 'superseded-by-approved-change'),
    'access-review:' || review.public_id);
  select g.* into grant_row from public.role_grants g where g.id = item.grant_id for update;
  grant_found := found;
  if grant_found and actor_hash = private.role_audit_sha256(grant_row.subject::text) then
    raise exception 'A grant subject cannot resolve their own post-decision change.' using errcode = '42501';
  end if;
  lock table public.role_capabilities in share mode;
  if not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope must remain current through post-decision resolution.' using errcode = '42501';
  end if;
  select array(select distinct rc.capability from public.role_capabilities rc
    where rc.role = case when grant_found then grant_row.role else item.role end
    order by rc.capability) into current_capabilities;
  grant_current := grant_found and grant_row.role = item.role
    and private.role_audit_sha256(grant_row.subject::text) = item.subject_sha256
    and grant_row.scope_kind = item.scope_kind and grant_row.scope_id = item.scope_id
    and grant_row.provenance = item.provenance and grant_row.granted_at = item.granted_at
    and grant_row.expires_at is not distinct from item.expires_at and grant_row.revoked_at is null
    and (grant_row.expires_at is null or grant_row.expires_at > clock_timestamp())
    and not item.capabilities_backfilled and current_capabilities = item.capabilities;
  if (decision.decision = 'retain' and grant_current)
     or (decision.decision = 'revoke' and exists (
       select 1 from private.privileged_access_review_remediation x where x.decision_id = decision.id
     ) and (not grant_found or (
       grant_row.role = item.role
       and private.role_audit_sha256(grant_row.subject::text) = item.subject_sha256
       and grant_row.scope_kind = item.scope_kind and grant_row.scope_id = item.scope_id
       and grant_row.provenance = item.provenance and grant_row.granted_at = item.granted_at
       and grant_row.expires_at is not distinct from item.expires_at
       and grant_row.revoked_at is not null))) then
    raise exception 'The decided grant has not changed since the snapshot.' using errcode = '22023';
  end if;
  observed_state := private.privileged_access_review_grant_state_sha256(
    case when grant_found then grant_row.subject else null end,
    case when grant_found then grant_row.role else null end,
    case when grant_found then grant_row.scope_kind else null end,
    case when grant_found then grant_row.scope_id else null end,
    case when grant_found then grant_row.provenance else null end,
    case when grant_found then grant_row.granted_at else null end,
    case when grant_found then grant_row.expires_at else null end,
    case when grant_found then grant_row.revoked_at else null end,
    current_capabilities,
    grant_found and grant_row.revoked_at is null
      and (grant_row.expires_at is null or grant_row.expires_at > clock_timestamp()));
  select x.* into existing_resolution
    from private.privileged_access_review_post_decision_resolution x
   where x.decision_id = decision.id and x.observed_state_sha256 = observed_state;
  if found then
    if existing_resolution.resolved_by_sha256 <> actor_hash then
      raise exception 'That observed state was resolved by another operator.' using errcode = '42501';
    end if;
    return;
  end if;
  insert into private.privileged_access_review_post_decision_resolution
    (decision_id, resolution_code, observed_state_sha256, resolved_by_sha256, resolved_at)
  values (decision.id, 'superseded-by-approved-change', observed_state, actor_hash, clock_timestamp())
  on conflict (decision_id, observed_state_sha256) do nothing;
end $$;

create or replace function public.complete_privileged_access_review(want_review text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); actor_hash text; review private.privileged_access_review;
  keep_n integer; revoke_n integer; investigate_n integer; decided_n integer;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa(); actor_hash := private.role_audit_sha256(me::text);
  perform pg_advisory_xact_lock(hashtext('private.privileged_access_review'));
  select r.* into review from private.privileged_access_review r where r.public_id = want_review;
  if not found then raise exception 'No such access review.' using errcode = '22023'; end if;
  if actor_hash = review.started_by_sha256
     or exists (select 1 from private.privileged_access_review_decision d
       join private.privileged_access_review_item i on i.id = d.item_id
       where i.review_id = review.id and d.decided_by_sha256 = actor_hash)
     or exists (select 1 from private.privileged_access_review_investigation_resolution x
       join private.privileged_access_review_decision d on d.id = x.decision_id
       join private.privileged_access_review_item i on i.id = d.item_id
       where i.review_id = review.id and x.resolved_by_sha256 = actor_hash)
     or exists (select 1 from private.privileged_access_review_investigation_state_resolution x
       join private.privileged_access_review_decision d on d.id = x.decision_id
       join private.privileged_access_review_item i on i.id = d.item_id
       where i.review_id = review.id and x.resolved_by_sha256 = actor_hash)
     or exists (select 1 from private.privileged_access_review_remediation x
       join private.privileged_access_review_decision d on d.id = x.decision_id
       join private.privileged_access_review_item i on i.id = d.item_id
       where i.review_id = review.id and x.applied_by_sha256 = actor_hash)
     or exists (select 1 from private.privileged_access_review_post_decision_resolution x
       join private.privileged_access_review_decision d on d.id = x.decision_id
       join private.privileged_access_review_item i on i.id = d.item_id
       where i.review_id = review.id and x.resolved_by_sha256 = actor_hash) then
    raise exception 'An independent operator who neither started nor worked the review must sign it.' using errcode = '42501';
  end if;
  -- Audit first, then prevent a console regrant from racing the validation and
  -- signoff. A failed signoff rolls this audit insert back with the transaction.
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.signed', review.public_id,
    jsonb_build_object('next_due', review.next_due), 'access-review:' || review.public_id);
  lock table public.role_grants in share mode;
  lock table public.role_capabilities in share mode;
  if not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope must remain current through signoff.' using errcode = '42501';
  end if;
  select count(*), count(*) filter (where d.decision = 'retain'),
         count(*) filter (where d.decision = 'revoke'), count(*) filter (where d.decision = 'investigate')
    into decided_n, keep_n, revoke_n, investigate_n
    from private.privileged_access_review_item i
    left join private.privileged_access_review_decision d on d.item_id = i.id
   where i.review_id = review.id and d.id is not null;
  if decided_n <> review.item_count then raise exception 'Every snapshot item needs a decision.' using errcode = '23514'; end if;
  if exists (
    select 1 from private.privileged_access_review_decision d
    join private.privileged_access_review_item i on i.id = d.item_id
    where i.review_id = review.id and not (
      (d.decision = 'retain' and d.reason_code in ('still-required', 'least-privilege-confirmed'))
      or (d.decision = 'revoke' and d.reason_code in (
        'access-ended', 'unauthorized', 'inactive', 'scope-changed', 'mfa-not-current'))
      or (d.decision = 'investigate' and d.reason_code in (
        'mfa-not-current', 'ownership-unknown', 'conflict-review', 'activity-review'))
    )
  ) then
    raise exception 'A legacy decision has an incompatible reason and cannot be signed.' using errcode = '23514';
  end if;
  if exists (select 1 from private.privileged_access_review_decision d
      join private.privileged_access_review_item i on i.id = d.item_id
      left join public.role_grants g on g.id = i.grant_id
      where i.review_id = review.id and d.decision = 'investigate'
        and not exists (
          select 1 from private.privileged_access_review_investigation_state_resolution x
           where x.decision_id = d.id and x.observed_state_sha256 =
             private.privileged_access_review_grant_state_sha256(
               g.subject, g.role, g.scope_kind, g.scope_id, g.provenance,
               g.granted_at, g.expires_at, g.revoked_at,
               array(select distinct rc.capability from public.role_capabilities rc
                 where rc.role = g.role order by rc.capability),
               g.id is not null and g.revoked_at is null
                 and (g.expires_at is null or g.expires_at > clock_timestamp())))) then
    raise exception 'Every investigation needs an independent resolution of its current state before signoff.' using errcode = '23514';
  end if;
  if exists (select 1 from private.privileged_access_review_decision d
      join private.privileged_access_review_item i on i.id = d.item_id
      left join public.role_grants g on g.id = i.grant_id
      where i.review_id = review.id and d.decision = 'retain'
        and (g.id is null or private.role_audit_sha256(g.subject::text) <> i.subject_sha256
          or g.role <> i.role or g.scope_kind <> i.scope_kind
          or g.scope_id <> i.scope_id or g.provenance <> i.provenance
          or g.granted_at <> i.granted_at or g.expires_at is distinct from i.expires_at
          or g.revoked_at is not null
          or (g.expires_at is not null and g.expires_at <= clock_timestamp())
          or i.capabilities_backfilled
          or array(select distinct rc.capability from public.role_capabilities rc
               where rc.role = i.role order by rc.capability) <> i.capabilities)
        and not exists (select 1 from private.privileged_access_review_post_decision_resolution x
          where x.decision_id = d.id and x.observed_state_sha256 =
            private.privileged_access_review_grant_state_sha256(
            g.subject, g.role, g.scope_kind, g.scope_id, g.provenance,
            g.granted_at, g.expires_at, g.revoked_at,
            array(select distinct rc.capability from public.role_capabilities rc
              where rc.role = g.role order by rc.capability),
            g.id is not null and g.revoked_at is null
              and (g.expires_at is null or g.expires_at > clock_timestamp())))) then
    raise exception 'Every changed retain decision needs an independent post-decision resolution before signoff.' using errcode = '23514';
  end if;
  if exists (select 1 from private.privileged_access_review_decision d
      join private.privileged_access_review_item i on i.id = d.item_id
      left join private.privileged_access_review_remediation x on x.decision_id = d.id
      left join public.role_grants g on g.id = i.grant_id
      where i.review_id = review.id and d.decision = 'revoke'
        and not (
          (x.decision_id is not null and (g.id is null or (
            g.role = i.role and private.role_audit_sha256(g.subject::text) = i.subject_sha256
            and g.scope_kind = i.scope_kind and g.scope_id = i.scope_id
            and g.provenance = i.provenance and g.granted_at = i.granted_at
            and g.expires_at is not distinct from i.expires_at and g.revoked_at is not null)))
          or exists (
            select 1 from private.privileged_access_review_post_decision_resolution z
             where z.decision_id = d.id and z.observed_state_sha256 =
               private.privileged_access_review_grant_state_sha256(
                 g.subject, g.role, g.scope_kind, g.scope_id, g.provenance,
                 g.granted_at, g.expires_at, g.revoked_at,
                 array(select distinct rc.capability from public.role_capabilities rc
                   where rc.role = g.role order by rc.capability),
                 g.id is not null and g.revoked_at is null
                   and (g.expires_at is null or g.expires_at > clock_timestamp()))))) then
    raise exception 'Every revoke decision must have an applied remediation and remain revoked at signoff.' using errcode = '23514';
  end if;
  insert into private.privileged_access_review_signoff
    (review_id, signed_by_sha256, signed_at, retained, revoked, investigating)
  values (review.id, actor_hash, clock_timestamp(), keep_n, revoke_n, investigate_n);
end $$;

-- Keep the original RPC's return shape for existing clients, but align its
-- resolution fields with the latest immutable state-bound investigation row.
create or replace function public.privileged_access_review(want_review text)
returns table (review_ref text, period_start date, period_end date, next_due date,
  snapshot_at timestamptz, started_by_sha256 text, item_ref text, subject_sha256 text, role text, scope_kind text,
  scope_id text, provenance text, granted_by_sha256 text, granted_at timestamptz, expires_at timestamptz,
  decision text, reason_code text, decided_by_sha256 text, remediation_applied boolean, decided_at timestamptz,
  investigation_resolution text, resolved_by_sha256 text, resolved_at timestamptz,
  signed_by_sha256 text, signed_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); review private.privileged_access_review;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  select r.* into review from private.privileged_access_review r where r.public_id = want_review;
  if not found then raise exception 'No such access review.' using errcode = '22023'; end if;
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.read', review.public_id,
    jsonb_build_object('item_count', review.item_count), 'access-review-read:' || review.public_id);
  return query select review.public_id, review.period_start, review.period_end, review.next_due,
    review.snapshot_at, review.started_by_sha256, i.public_id, i.subject_sha256, i.role, i.scope_kind, i.scope_id,
    i.provenance, i.granted_by_sha256, i.granted_at, i.expires_at, d.decision, d.reason_code,
    d.decided_by_sha256, d.remediation_applied, d.decided_at, x.resolution_code,
    x.resolved_by_sha256, x.resolved_at, s.signed_by_sha256, s.signed_at
  from private.privileged_access_review_item i
  left join private.privileged_access_review_decision d on d.item_id = i.id
  left join lateral (
    select x.* from private.privileged_access_review_investigation_state_resolution x
     where x.decision_id = d.id order by x.resolution_sequence desc limit 1
  ) x on true
  left join private.privileged_access_review_signoff s on s.review_id = i.review_id
  where i.review_id = review.id order by i.role, i.scope_kind, i.scope_id, i.public_id;
end $$;

create or replace function public.privileged_access_review_evidence(want_review text)
returns table (review_ref text, period_start date, period_end date, next_due date,
  snapshot_at timestamptz, started_by_sha256 text, item_ref text, subject_sha256 text, role text,
  capabilities text[], capabilities_backfilled boolean, scope_kind text,
  scope_id text, provenance text, granted_by_sha256 text, granted_at timestamptz, expires_at timestamptz,
  decision text, reason_code text, decided_by_sha256 text, remediation_applied boolean, decided_at timestamptz,
  remediation_outcome text, remediated_by_sha256 text, remediated_at timestamptz,
  post_decision_resolution text, post_decision_resolved_by_sha256 text,
  post_decision_resolved_at timestamptz,
  investigation_resolution text, resolved_by_sha256 text, resolved_at timestamptz,
  signed_by_sha256 text, signed_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); review private.privileged_access_review;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa();
  select r.* into review from private.privileged_access_review r where r.public_id = want_review;
  if not found then raise exception 'No such access review.' using errcode = '22023'; end if;
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.read', review.public_id,
    jsonb_build_object('item_count', review.item_count), 'access-review-read:' || review.public_id);
  return query select review.public_id, review.period_start, review.period_end, review.next_due,
    review.snapshot_at, review.started_by_sha256, i.public_id, i.subject_sha256, i.role, i.capabilities,
    i.capabilities_backfilled, i.scope_kind, i.scope_id,
    i.provenance, i.granted_by_sha256, i.granted_at, i.expires_at, d.decision, d.reason_code,
    d.decided_by_sha256, (m.decision_id is not null), d.decided_at, m.outcome,
    m.applied_by_sha256, m.applied_at, z.resolution_code, z.resolved_by_sha256,
    z.resolved_at, x.resolution_code,
    x.resolved_by_sha256, x.resolved_at, s.signed_by_sha256, s.signed_at
  from private.privileged_access_review_item i
  left join private.privileged_access_review_decision d on d.item_id = i.id
  left join private.privileged_access_review_remediation m on m.decision_id = d.id
  left join lateral (
    select z.* from private.privileged_access_review_post_decision_resolution z
     where z.decision_id = d.id order by z.resolution_sequence desc limit 1
  ) z on true
  left join lateral (
    select x.* from private.privileged_access_review_investigation_state_resolution x
     where x.decision_id = d.id order by x.resolution_sequence desc limit 1
  ) x on true
  left join private.privileged_access_review_signoff s on s.review_id = i.review_id
  where i.review_id = review.id order by i.role, i.scope_kind, i.scope_id, i.public_id;
end $$;

revoke all on function public.begin_privileged_access_review(text, date, date, date) from public, anon;
revoke all on function public.decide_privileged_access_review_item(text, text, text) from public, anon;
revoke all on function public.complete_privileged_access_review(text) from public, anon;
revoke all on function public.privileged_access_review(text) from public, anon;
revoke all on function public.privileged_access_review_evidence(text) from public, anon;
grant execute on function public.begin_privileged_access_review(text, date, date, date) to authenticated;
grant execute on function public.decide_privileged_access_review_item(text, text, text) to authenticated;
grant execute on function public.complete_privileged_access_review(text) to authenticated;
grant execute on function public.privileged_access_review(text) to authenticated;
grant execute on function public.privileged_access_review_evidence(text) to authenticated;
revoke all on function public.resolve_privileged_access_review_investigation(text, text) from public, anon;
grant execute on function public.resolve_privileged_access_review_investigation(text, text) to authenticated;
revoke all on function public.resolve_privileged_access_review_post_decision_change(text) from public, anon;
grant execute on function public.resolve_privileged_access_review_post_decision_change(text) to authenticated;
