-- Guardian projection foundation.
--
-- This is deliberately one narrow projection (calendar notices), not a
-- general guardian portal. A row is usable only while all of these remain
-- true at read time:
--   * school staff verified a live K-12 guardian link;
--   * the link has read rights and no court-order restriction;
--   * the student made an accepted, unexpired family grant for this exact
--     calendar resource and recipient; and
--   * the service-produced projection is fresh and has not been invalidated.
--
-- Neither authenticated users nor the service role can select the backing
-- tables. The service role can only publish the closed, minimized shape
-- through the definer function; guardians can only read through the decision
-- function, which rechecks authority and writes an audit fact first.

-- ── Private storage ───────────────────────────────────────────────────────

create table if not exists private.guardian_calendar_projections (
  id                 uuid        primary key default gen_random_uuid(),
  school_id          text        not null references public.schools on delete cascade,
  link_id            uuid        not null references public.guardian_links on delete cascade,
  consent_grant_id   uuid        not null references public.family_grants on delete cascade,
  student_id         uuid        not null references auth.users on delete cascade,
  guardian_id        uuid        not null references auth.users on delete cascade,
  resource_id        text        not null check (length(btrim(resource_id)) between 1 and 160),
  title              text        not null check (length(btrim(title)) between 1 and 160),
  starts_at          timestamptz not null,
  status             text        not null check (status in ('scheduled', 'cancelled', 'complete')),
  source_version     text        not null check (length(btrim(source_version)) between 1 and 120),
  source_observed_at timestamptz not null,
  consent_version    timestamptz not null,
  projected_at       timestamptz not null default now(),
  expires_at         timestamptz not null,
  invalidated_at     timestamptz,
  invalidated_reason text check (invalidated_reason in (
                         'consent_changed', 'relationship_changed', 'restriction_changed'
                       )),
  constraint guardian_calendar_projection_people_differ check (student_id <> guardian_id),
  constraint guardian_calendar_projection_expiry check (expires_at > projected_at),
  constraint guardian_calendar_projection_invalidation_whole
    check ((invalidated_at is null) = (invalidated_reason is null)),
  unique (consent_grant_id, resource_id)
);
alter table private.guardian_calendar_projections enable row level security;

create index if not exists guardian_calendar_projection_reader_idx
  on private.guardian_calendar_projections (guardian_id, student_id, expires_at)
  where invalidated_at is null;
create index if not exists guardian_calendar_projection_link_idx
  on private.guardian_calendar_projections (link_id)
  where invalidated_at is null;

create table if not exists private.guardian_projection_access_events (
  id               bigint      generated always as identity primary key,
  request_id       uuid        not null default gen_random_uuid(),
  school_id        text        references public.schools on delete cascade,
  student_id       uuid        not null references auth.users on delete cascade,
  guardian_id      uuid        not null references auth.users on delete cascade,
  purpose          text        not null,
  decision         text        not null check (decision in ('allow', 'deny')),
  reason           text        not null check (reason in (
                       'allowed', 'purpose_denied', 'authority_missing_or_stale'
                     )),
  fields_returned  text[]      not null default '{}',
  projection_count integer     not null default 0 check (projection_count >= 0),
  read_at          timestamptz not null default now(),
  constraint guardian_projection_access_people_differ check (student_id <> guardian_id),
  constraint guardian_projection_access_decision_whole check (
    (decision = 'allow' and reason = 'allowed' and projection_count > 0)
    or
    (decision = 'deny' and reason <> 'allowed' and projection_count = 0
      and cardinality(fields_returned) = 0)
  )
);
alter table private.guardian_projection_access_events enable row level security;

create index if not exists guardian_projection_access_student_idx
  on private.guardian_projection_access_events (student_id, read_at desc);
create index if not exists guardian_projection_access_guardian_idx
  on private.guardian_projection_access_events (guardian_id, read_at desc);

revoke all on table private.guardian_calendar_projections,
                    private.guardian_projection_access_events
  from public, anon, authenticated, service_role;
revoke all on sequence private.guardian_projection_access_events_id_seq
  from public, anon, authenticated, service_role;

comment on table private.guardian_calendar_projections is
  'Minimized, online-only calendar notices. Never select directly; every read rechecks relationship and consent.';
comment on table private.guardian_projection_access_events is
  'Allow and deny decisions for guardian projection reads. Students inspect these only through the bounded history function.';

-- ── Service-only publication ──────────────────────────────────────────────

create or replace function public.publish_guardian_calendar_projection(
  wanted_link uuid,
  wanted_grant uuid,
  wanted_resource text,
  wanted_title text,
  wanted_starts_at timestamptz,
  wanted_status text,
  wanted_source_version text,
  wanted_source_observed_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  authority record;
  made uuid;
  projection_expiry timestamptz;
  published_at timestamptz := now();
begin
  if wanted_resource is null or length(btrim(wanted_resource)) not between 1 and 160
     or wanted_title is null or length(btrim(wanted_title)) not between 1 and 160
     or wanted_starts_at is null
     or wanted_status is null or wanted_status not in ('scheduled', 'cancelled', 'complete')
     or wanted_source_version is null or length(btrim(wanted_source_version)) not between 1 and 120
     or wanted_source_observed_at is null or wanted_source_observed_at > published_at + interval '5 minutes' then
    raise exception 'semester: invalid guardian calendar projection'
      using errcode = 'check_violation';
  end if;

  select l.school_id, l.student_id, l.guardian_id,
         g.id as grant_id, g.updated_at as grant_version, g.expires_at as grant_expiry
    into authority
    from public.guardian_links l
    join public.schools s
      on s.id = l.school_id and s.edition = 'k12'
    join public.family_grants g
      on g.id = wanted_grant
     and g.institution_id = l.school_id
     and g.student_id = l.student_id
     and g.recipient_id = l.guardian_id
     and g.category = 'calendar'
     and g.access in ('selected', 'view')
     and wanted_resource = any(g.resource_ids)
     and g.accepted_at is not null
     and g.accepted_at <= published_at
     and g.revoked_at is null
     and g.expires_at > published_at
   where l.id = wanted_link
     and l.ended_at is null
     and l.rights in ('full', 'view_only')
     and private.is_minor(l.student_id)
     and not exists (
       select 1 from public.guardian_link_restrictions r
        where r.link_id = l.id and r.court_order
     )
   for key share of l, g;

  if authority is null then
    raise exception 'semester: guardian projection authority is not active'
      using errcode = 'insufficient_privilege';
  end if;

  -- A projection is short-lived even when consent lasts longer. Consent and
  -- relationship are still rechecked on every read.
  projection_expiry := least(authority.grant_expiry, published_at + interval '24 hours');

  insert into private.guardian_calendar_projections (
    school_id, link_id, consent_grant_id, student_id, guardian_id,
    resource_id, title, starts_at, status, source_version,
    source_observed_at, consent_version, projected_at, expires_at,
    invalidated_at, invalidated_reason
  ) values (
    authority.school_id, wanted_link, authority.grant_id,
    authority.student_id, authority.guardian_id,
    btrim(wanted_resource), btrim(wanted_title), wanted_starts_at,
    wanted_status, btrim(wanted_source_version), wanted_source_observed_at,
    authority.grant_version, published_at, projection_expiry, null, null
  )
  on conflict (consent_grant_id, resource_id) do update set
    school_id = excluded.school_id,
    link_id = excluded.link_id,
    student_id = excluded.student_id,
    guardian_id = excluded.guardian_id,
    title = excluded.title,
    starts_at = excluded.starts_at,
    status = excluded.status,
    source_version = excluded.source_version,
    source_observed_at = excluded.source_observed_at,
    consent_version = excluded.consent_version,
    projected_at = excluded.projected_at,
    expires_at = excluded.expires_at,
    invalidated_at = null,
    invalidated_reason = null
  returning id into made;

  return made;
end $$;

revoke all on function public.publish_guardian_calendar_projection(
  uuid, uuid, text, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.publish_guardian_calendar_projection(
  uuid, uuid, text, text, timestamptz, text, text, timestamptz
) to service_role;

-- ── Immediate invalidation ────────────────────────────────────────────────

create or replace function private.invalidate_guardian_projection_for_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(old.institution_id, old.student_id, old.recipient_id, old.category,
         old.access, old.resource_ids, old.accepted_at, old.expires_at, old.revoked_at,
         old.updated_at)
     is distinct from
     row(new.institution_id, new.student_id, new.recipient_id, new.category,
         new.access, new.resource_ids, new.accepted_at, new.expires_at, new.revoked_at,
         new.updated_at) then
    update private.guardian_calendar_projections
       set invalidated_at = coalesce(invalidated_at, now()),
           invalidated_reason = coalesce(invalidated_reason, 'consent_changed')
     where consent_grant_id = new.id and invalidated_at is null;
  end if;
  return null;
end $$;
revoke all on function private.invalidate_guardian_projection_for_consent()
  from public, anon, authenticated, service_role;

drop trigger if exists guardian_projection_consent_invalidation on public.family_grants;
create trigger guardian_projection_consent_invalidation
  after update on public.family_grants
  for each row execute function private.invalidate_guardian_projection_for_consent();

create or replace function private.invalidate_guardian_projection_for_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if row(old.rights, old.relationship, old.ended_at, old.ended_reason)
     is distinct from
     row(new.rights, new.relationship, new.ended_at, new.ended_reason) then
    update private.guardian_calendar_projections
       set invalidated_at = coalesce(invalidated_at, now()),
           invalidated_reason = coalesce(invalidated_reason, 'relationship_changed')
     where link_id = new.id and invalidated_at is null;
  end if;
  return null;
end $$;
revoke all on function private.invalidate_guardian_projection_for_relationship()
  from public, anon, authenticated, service_role;

drop trigger if exists guardian_projection_relationship_invalidation on public.guardian_links;
create trigger guardian_projection_relationship_invalidation
  after update on public.guardian_links
  for each row execute function private.invalidate_guardian_projection_for_relationship();

create or replace function private.invalidate_guardian_projection_for_restriction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.guardian_calendar_projections
     set invalidated_at = coalesce(invalidated_at, now()),
         invalidated_reason = coalesce(invalidated_reason, 'restriction_changed')
   where link_id = new.link_id and invalidated_at is null;
  return null;
end $$;
revoke all on function private.invalidate_guardian_projection_for_restriction()
  from public, anon, authenticated, service_role;

drop trigger if exists guardian_projection_restriction_invalidation
  on public.guardian_link_restrictions;
create trigger guardian_projection_restriction_invalidation
  after insert or update on public.guardian_link_restrictions
  for each row execute function private.invalidate_guardian_projection_for_restriction();

-- ── Guardian read and student audit view ──────────────────────────────────

create or replace function public.read_guardian_calendar_projection(
  wanted_student uuid,
  wanted_purpose text default 'guardian_portal'
)
returns table (
  student_id uuid,
  item_id text,
  title text,
  starts_at timestamptz,
  status text,
  source_observed_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  allowed_count integer := 0;
  allowed_ids uuid[] := '{}';
  event_school text;
  event_reason text;
begin
  if me is null then
    raise exception 'semester: not signed in' using errcode = 'insufficient_privilege';
  end if;
  if wanted_student is null or wanted_student = me then
    raise exception 'semester: invalid guardian projection request'
      using errcode = 'check_violation';
  end if;
  -- A made-up identifier and an existing student with no authority both look
  -- like an empty result. There is no subject against which to keep an audit
  -- event when the account does not exist.
  if not exists (select 1 from auth.users u where u.id = wanted_student) then
    return;
  end if;

  select p.school_id
    into event_school
    from private.guardian_calendar_projections p
   where p.student_id = wanted_student
   order by p.projected_at desc
   limit 1;

  if wanted_purpose = 'guardian_portal' then
    -- Lock the exact projection/relationship/consent rows selected by this
    -- decision. The audit count and returned rows then describe one atomic
    -- authorization decision even if revocation is attempted concurrently.
    select coalesce(array_agg(authorized.id), '{}')
      into allowed_ids
      from (
        select p.id
          from private.guardian_calendar_projections p
          join public.guardian_links l
            on l.id = p.link_id
           and l.school_id = p.school_id
           and l.student_id = p.student_id
           and l.guardian_id = p.guardian_id
           and l.ended_at is null
           and l.rights in ('full', 'view_only')
          join public.schools s
            on s.id = p.school_id and s.edition = 'k12'
          join public.family_grants g
            on g.id = p.consent_grant_id
           and g.institution_id = p.school_id
           and g.student_id = p.student_id
           and g.recipient_id = p.guardian_id
           and g.category = 'calendar'
           and g.access in ('selected', 'view')
           and p.resource_id = any(g.resource_ids)
           and g.accepted_at is not null
           and g.accepted_at <= now()
           and g.revoked_at is null
           and g.expires_at > now()
           and g.updated_at = p.consent_version
         where p.guardian_id = me
           and p.student_id = wanted_student
           and p.invalidated_at is null
           and p.expires_at > now()
           and private.is_minor(p.student_id)
           and not exists (
             select 1 from public.guardian_link_restrictions r
              where r.link_id = p.link_id and r.court_order
           )
         order by p.starts_at, p.resource_id
         for key share of p, l, g
      ) authorized;
    allowed_count := cardinality(allowed_ids);
  end if;

  event_reason := case
    when wanted_purpose is distinct from 'guardian_portal' then 'purpose_denied'
    when allowed_count = 0 then 'authority_missing_or_stale'
    else 'allowed'
  end;

  insert into private.guardian_projection_access_events (
    school_id, student_id, guardian_id, purpose, decision, reason,
    fields_returned, projection_count
  ) values (
    event_school, wanted_student, me, coalesce(wanted_purpose, ''),
    case when allowed_count > 0 then 'allow' else 'deny' end,
    event_reason,
    case when allowed_count > 0
      then array['student_id', 'item_id', 'title', 'starts_at', 'status', 'source_observed_at', 'expires_at']
      else '{}'::text[] end,
    allowed_count
  );

  if allowed_count = 0 then
    return;
  end if;

  return query
    select p.student_id, p.resource_id, p.title, p.starts_at, p.status,
           p.source_observed_at, p.expires_at
      from private.guardian_calendar_projections p
     where p.id = any(allowed_ids)
     order by p.starts_at, p.resource_id;
end $$;

revoke all on function public.read_guardian_calendar_projection(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.read_guardian_calendar_projection(uuid, text)
  to authenticated;

create or replace function public.read_guardian_projection_access_history()
returns table (
  guardian_id uuid,
  purpose text,
  decision text,
  reason text,
  fields_returned text[],
  projection_count integer,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.guardian_id, e.purpose, e.decision, e.reason,
         e.fields_returned, e.projection_count, e.read_at
    from private.guardian_projection_access_events e
   where e.student_id = (select auth.uid())
   order by e.read_at desc, e.id desc
   limit 200;
$$;

revoke all on function public.read_guardian_projection_access_history()
  from public, anon, authenticated, service_role;
grant execute on function public.read_guardian_projection_access_history()
  to authenticated;

comment on function public.publish_guardian_calendar_projection(
  uuid, uuid, text, text, timestamptz, text, text, timestamptz
) is 'Service-only publication of one allowlisted calendar notice after verified-link and exact-consent checks.';
comment on function public.read_guardian_calendar_projection(uuid, text) is
  'Online-only guardian read. Rechecks relationship, restriction, exact consent, version and expiry; records allow or deny.';
comment on function public.read_guardian_projection_access_history() is
  'Student-only bounded history of guardian projection read decisions; never exposes projection content.';
