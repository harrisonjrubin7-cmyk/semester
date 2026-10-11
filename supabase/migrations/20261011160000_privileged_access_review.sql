-- Repository authority for a minimized, three-operator review of privileged Semester role grants.
-- This does not inventory provider consoles or prove that a human review ran.

insert into public.app_capabilities (capability, about) values
  ('access_review:manage', 'Open, decide and sign a privileged role-grant access review with fresh MFA and separation of duties.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('platform_admin', 'access_review:manage'),
  ('trust_officer', 'access_review:manage')
on conflict (role, capability) do nothing;

create table if not exists private.privileged_access_review (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default private.public_id('access-review'),
  request_key text not null unique check (request_key ~ '^[a-z0-9][a-z0-9._:-]{7,127}$'),
  period_start date not null,
  period_end date not null,
  next_due date not null,
  snapshot_at timestamptz not null default now(),
  started_by_sha256 text not null check (started_by_sha256 ~ '^[0-9a-f]{64}$'),
  item_count integer not null check (item_count >= 0),
  constraint privileged_access_review_dates check (
    period_start <= period_end and period_end <= snapshot_at::date
    and next_due > period_end and next_due <= snapshot_at::date + 93)
);

create table if not exists private.privileged_access_review_item (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default private.public_id('access-review-item'),
  review_id uuid not null references private.privileged_access_review(id) on delete restrict,
  grant_id uuid not null,
  subject_sha256 text not null check (subject_sha256 ~ '^[0-9a-f]{64}$'),
  role text not null,
  scope_kind text not null,
  scope_id text not null,
  provenance text not null,
  granted_by_sha256 text check (granted_by_sha256 is null or granted_by_sha256 ~ '^[0-9a-f]{64}$'),
  granted_at timestamptz not null,
  expires_at timestamptz,
  unique (review_id, grant_id)
);

create index if not exists privileged_access_review_item_by_review
  on private.privileged_access_review_item (review_id, role, scope_kind, scope_id);

create table if not exists private.privileged_access_review_decision (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references private.privileged_access_review_item(id) on delete restrict,
  decision text not null check (decision in ('retain', 'revoke', 'investigate')),
  reason_code text not null check (reason_code in (
    'still-required', 'least-privilege-confirmed', 'access-ended', 'unauthorized',
    'inactive', 'scope-changed', 'mfa-not-current', 'ownership-unknown',
    'conflict-review', 'activity-review')),
  decided_by_sha256 text not null check (decided_by_sha256 ~ '^[0-9a-f]{64}$'),
  decided_at timestamptz not null default now(),
  remediation_applied boolean not null
);

create table if not exists private.privileged_access_review_investigation_resolution (
  decision_id uuid primary key references private.privileged_access_review_decision(id) on delete restrict,
  resolution_code text not null check (resolution_code in ('remediated', 'risk-accepted', 'false-positive')),
  resolved_by_sha256 text not null check (resolved_by_sha256 ~ '^[0-9a-f]{64}$'),
  resolved_at timestamptz not null default now()
);

create table if not exists private.privileged_access_review_signoff (
  review_id uuid primary key references private.privileged_access_review(id) on delete restrict,
  signed_by_sha256 text not null check (signed_by_sha256 ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz not null default now(),
  retained integer not null check (retained >= 0),
  revoked integer not null check (revoked >= 0),
  investigating integer not null check (investigating >= 0),
  constraint privileged_access_review_signoff_total check (retained + revoked + investigating >= 0)
);

alter table private.privileged_access_review enable row level security;
alter table private.privileged_access_review_item enable row level security;
alter table private.privileged_access_review_decision enable row level security;
alter table private.privileged_access_review_investigation_resolution enable row level security;
alter table private.privileged_access_review_signoff enable row level security;
revoke all on table private.privileged_access_review from public, anon, authenticated, service_role;
revoke all on table private.privileged_access_review_item from public, anon, authenticated, service_role;
revoke all on table private.privileged_access_review_decision from public, anon, authenticated, service_role;
revoke all on table private.privileged_access_review_investigation_resolution from public, anon, authenticated, service_role;
revoke all on table private.privileged_access_review_signoff from public, anon, authenticated, service_role;

create or replace function private.refuse_privileged_access_review_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Access review evidence is append-only.' using errcode = '42501';
end $$;
revoke all on function private.refuse_privileged_access_review_change() from public, anon, authenticated;

drop trigger if exists keep_privileged_access_review_immutable on private.privileged_access_review;
create trigger keep_privileged_access_review_immutable before update or delete on private.privileged_access_review
  for each row execute function private.refuse_privileged_access_review_change();
drop trigger if exists keep_privileged_access_review_item_immutable on private.privileged_access_review_item;
create trigger keep_privileged_access_review_item_immutable before update or delete on private.privileged_access_review_item
  for each row execute function private.refuse_privileged_access_review_change();
drop trigger if exists keep_privileged_access_review_decision_immutable on private.privileged_access_review_decision;
create trigger keep_privileged_access_review_decision_immutable before update or delete on private.privileged_access_review_decision
  for each row execute function private.refuse_privileged_access_review_change();
drop trigger if exists keep_privileged_access_review_resolution_immutable on private.privileged_access_review_investigation_resolution;
create trigger keep_privileged_access_review_resolution_immutable before update or delete on private.privileged_access_review_investigation_resolution
  for each row execute function private.refuse_privileged_access_review_change();
drop trigger if exists keep_privileged_access_review_signoff_immutable on private.privileged_access_review_signoff;
create trigger keep_privileged_access_review_signoff_immutable before update or delete on private.privileged_access_review_signoff
  for each row execute function private.refuse_privileged_access_review_change();

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
  if (select count(distinct g.subject) from public.role_grants g
      join public.role_capabilities rc on rc.role = g.role and rc.capability = 'access_review:manage'
      where g.scope_kind = 'platform' and g.scope_id = '' and g.revoked_at is null
        and (g.expires_at is null or g.expires_at > now())) < 3 then
    raise exception 'Three independently staffed access-review operators are required.' using errcode = '55000';
  end if;
  lock table public.role_grants in share mode;
  snapshot_time := clock_timestamp();
  select count(*) into expected from public.role_grants g
   where g.role in ('platform_admin', 'support_agent', 'incident_responder', 'moderator',
     'trust_safety_reviewer', 'trust_safety_senior', 'community_manager',
     'implementation_manager', 'integration_admin', 'university_admin', 'trust_officer')
     and g.revoked_at is null and (g.expires_at is null or g.expires_at > snapshot_time);
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.started', ref,
    jsonb_build_object('period_start', want_period_start, 'period_end', want_period_end,
      'next_due', want_next_due, 'item_count', expected), 'access-review:' || ref);
  insert into private.privileged_access_review
    (id, public_id, request_key, period_start, period_end, next_due, snapshot_at, started_by_sha256, item_count)
  values (made, ref, want_request_key, want_period_start, want_period_end, want_next_due,
    snapshot_time, private.role_audit_sha256(me::text), expected);
  insert into private.privileged_access_review_item
    (review_id, grant_id, subject_sha256, role, scope_kind, scope_id, provenance, granted_by_sha256, granted_at, expires_at)
  select made, g.id, private.role_audit_sha256(g.subject::text), g.role, g.scope_kind,
         g.scope_id, g.provenance,
         case when g.granted_by is null then null else private.role_audit_sha256(g.granted_by::text) end,
         g.granted_at, g.expires_at
    from public.role_grants g
   where g.role in ('platform_admin', 'support_agent', 'incident_responder', 'moderator',
     'trust_safety_reviewer', 'trust_safety_senior', 'community_manager',
     'implementation_manager', 'integration_admin', 'university_admin', 'trust_officer')
     and g.revoked_at is null and (g.expires_at is null or g.expires_at > snapshot_time);
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
  review private.privileged_access_review; applied boolean := false;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa(); actor_hash := private.role_audit_sha256(me::text);
  if want_decision not in ('retain', 'revoke', 'investigate') then raise exception 'Invalid review decision.' using errcode = '22023'; end if;
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
  if not exists (select 1 from public.role_grants g where g.id = item.grant_id
      and g.role = item.role and g.scope_kind = item.scope_kind and g.scope_id = item.scope_id
      and g.provenance = item.provenance and g.granted_at = item.granted_at
      and g.expires_at is not distinct from item.expires_at and g.revoked_at is null) then
    raise exception 'The grant changed after snapshot; investigate it in a new review.' using errcode = '40001';
  end if;
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.item_' || want_decision,
    item.public_id, jsonb_build_object('review', review.public_id, 'reason_code', want_reason_code),
    'access-review:' || review.public_id);
  -- A revoke decision records required remediation. The sole role-grant writer
  -- remains console_act(); signoff verifies that workflow closed the grant.
  insert into private.privileged_access_review_decision
    (item_id, decision, reason_code, decided_by_sha256, remediation_applied)
  values (item.id, want_decision, want_reason_code, actor_hash, applied);
end $$;

create or replace function public.resolve_privileged_access_review_investigation(
  want_item text, want_resolution_code text
) returns void language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); actor_hash text; item private.privileged_access_review_item;
  decision private.privileged_access_review_decision; review private.privileged_access_review;
begin
  if me is null or not private.has_capability('access_review:manage', 'platform', '') then
    raise exception 'access_review:manage at platform scope is required.' using errcode = '42501';
  end if;
  perform private.assert_fresh_mfa(); actor_hash := private.role_audit_sha256(me::text);
  if want_resolution_code not in ('remediated', 'risk-accepted', 'false-positive') then
    raise exception 'Invalid investigation resolution.' using errcode = '22023';
  end if;
  select i.* into item from private.privileged_access_review_item i where i.public_id = want_item;
  select d.* into decision from private.privileged_access_review_decision d where d.item_id = item.id;
  if not found or decision.decision <> 'investigate' then
    raise exception 'The item has no investigation to resolve.' using errcode = '22023';
  end if;
  select r.* into review from private.privileged_access_review r where r.id = item.review_id;
  if actor_hash in (item.subject_sha256, decision.decided_by_sha256) then
    raise exception 'A distinct operator must resolve the investigation.' using errcode = '42501';
  end if;
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.investigation_resolved',
    item.public_id, jsonb_build_object('review', review.public_id, 'resolution_code', want_resolution_code),
    'access-review:' || review.public_id);
  insert into private.privileged_access_review_investigation_resolution
    (decision_id, resolution_code, resolved_by_sha256)
  values (decision.id, want_resolution_code, actor_hash);
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
  select r.* into review from private.privileged_access_review r where r.public_id = want_review;
  if not found then raise exception 'No such access review.' using errcode = '22023'; end if;
  if actor_hash = review.started_by_sha256
     or exists (select 1 from private.privileged_access_review_decision d
       join private.privileged_access_review_item i on i.id = d.item_id
       where i.review_id = review.id and d.decided_by_sha256 = actor_hash)
     or exists (select 1 from private.privileged_access_review_investigation_resolution x
       join private.privileged_access_review_decision d on d.id = x.decision_id
       join private.privileged_access_review_item i on i.id = d.item_id
       where i.review_id = review.id and x.resolved_by_sha256 = actor_hash) then
    raise exception 'An independent operator who neither started nor worked the review must sign it.' using errcode = '42501';
  end if;
  select count(*), count(*) filter (where d.decision = 'retain'),
         count(*) filter (where d.decision = 'revoke'), count(*) filter (where d.decision = 'investigate')
    into decided_n, keep_n, revoke_n, investigate_n
    from private.privileged_access_review_item i
    left join private.privileged_access_review_decision d on d.item_id = i.id
   where i.review_id = review.id and d.id is not null;
  if decided_n <> review.item_count then raise exception 'Every snapshot item needs a decision.' using errcode = '23514'; end if;
  if exists (select 1 from private.privileged_access_review_decision d
      join private.privileged_access_review_item i on i.id = d.item_id
      left join private.privileged_access_review_investigation_resolution x on x.decision_id = d.id
      where i.review_id = review.id and d.decision = 'investigate' and x.decision_id is null) then
    raise exception 'Every investigation needs an independent resolution before signoff.' using errcode = '23514';
  end if;
  if exists (select 1 from private.privileged_access_review_decision d
      join private.privileged_access_review_item i on i.id = d.item_id
      join public.role_grants g on g.id = i.grant_id
      where i.review_id = review.id and d.decision = 'revoke'
        and (g.role <> i.role or g.scope_kind <> i.scope_kind or g.scope_id <> i.scope_id
          or g.provenance <> i.provenance or g.granted_at <> i.granted_at
          or g.expires_at is distinct from i.expires_at or g.revoked_at is null)) then
    raise exception 'Every revoke decision must be remediated through the approved grant workflow before signoff.' using errcode = '23514';
  end if;
  perform private.console_audit_write(me, 'authenticated', null, 'access_review.signed', review.public_id,
    jsonb_build_object('retained', keep_n, 'revoked', revoke_n, 'investigating', investigate_n,
      'next_due', review.next_due), 'access-review:' || review.public_id);
  insert into private.privileged_access_review_signoff
    (review_id, signed_by_sha256, retained, revoked, investigating)
  values (review.id, actor_hash, keep_n, revoke_n, investigate_n);
end $$;

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
  left join private.privileged_access_review_investigation_resolution x on x.decision_id = d.id
  left join private.privileged_access_review_signoff s on s.review_id = i.review_id
  where i.review_id = review.id order by i.role, i.scope_kind, i.scope_id, i.public_id;
end $$;

revoke all on function public.begin_privileged_access_review(text, date, date, date) from public, anon;
revoke all on function public.decide_privileged_access_review_item(text, text, text) from public, anon;
revoke all on function public.complete_privileged_access_review(text) from public, anon;
revoke all on function public.privileged_access_review(text) from public, anon;
grant execute on function public.begin_privileged_access_review(text, date, date, date) to authenticated;
grant execute on function public.decide_privileged_access_review_item(text, text, text) to authenticated;
grant execute on function public.complete_privileged_access_review(text) to authenticated;
grant execute on function public.privileged_access_review(text) to authenticated;
revoke all on function public.resolve_privileged_access_review_investigation(text, text) from public, anon;
grant execute on function public.resolve_privileged_access_review_investigation(text, text) to authenticated;
