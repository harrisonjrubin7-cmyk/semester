-- Legal holds (maturity RM-02 and RM-05): a hold that exists in the schema, is
-- placed and released by named authority, and is read by every sweep that
-- would otherwise delete what it protects.
--
-- Until this file, `OPERATIONAL-MATURITY.md` said "no hold object exists in
-- the schema", and the retention sweeps of 20260929030000 deleted on a clock
-- with no way to be told to stop. A hold is the one instruction a clock has to
-- obey.
--
--   1. A hold is a row in `legal_holds`, about one thing: an `account`
--      (`subject_id` is its user id), a `tenant` (a school) or the whole
--      `platform`. It carries a reason and a matter reference, both required,
--      because a hold nobody can explain is a hold nobody can release.
--   2. It is placed by someone holding `hold:place` over the school, and an
--      account hold may only be placed over an account whose profile belongs
--      to that school — a school's administrator cannot freeze somebody else's
--      student. A platform hold is not self-serve: `platform_admin` is held to
--      an exact, reviewed set of capabilities (`capabilities.check.sql`), so it
--      is placed and released by an operator as `service_role`, the way the
--      sweeps are run by hand, and the same two-person rule applies.
--   3. It is released by someone holding `hold:release`, **who is not the person
--      who placed it**, with a reason. The two-person rule is a CHECK on the
--      row, not a promise in a runbook. A school with a single administrator
--      cannot release its own hold; that is the intended cost, and the way out
--      is the break-glass path (20260929110000), which is itself audited.
--   4. The row is never deleted and never edited except to record its release,
--      once. The placement and the release are the audit trail.
--   5. Sweeps skip what a live hold covers, and an account under a live hold
--      cannot be deleted from `auth.users` at all — which is the door student
--      erasure goes through — until it is released. The refusal says why.
--
-- What this is not: a case-management system, a discovery tool, or advice on
-- when to place a hold. Counsel decides that; this makes the decision bite.

-- ── 1. Who may do what ────────────────────────────────────────────────────

insert into public.app_capabilities (capability, about) values
  ('hold:read',    'See the legal holds over one school.'),
  ('hold:place',   'Place a legal hold over one school or one of its accounts. Never releases one.'),
  ('hold:release', 'Release a legal hold, with a reason, when they are not the person who placed it.')
on conflict (capability) do nothing;

insert into public.role_capabilities (role, capability) values
  ('university_admin', 'hold:read'),
  ('university_admin', 'hold:place'),
  ('university_admin', 'hold:release')
on conflict (role, capability) do nothing;

-- ── 2. The table ──────────────────────────────────────────────────────────

create table if not exists public.legal_holds (
  id             uuid        primary key default gen_random_uuid(),
  subject_kind   text        not null check (subject_kind in ('account', 'tenant', 'platform')),
  -- A school id, an account's user id, or empty for the platform.
  subject_id     text        not null default '',
  -- The school that placed it; null only for a platform hold.
  tenant_id      text        references public.schools(id) on delete restrict,
  reason         text        not null check (length(trim(reason)) between 1 and 1000),
  matter_ref     text        not null check (length(trim(matter_ref)) between 1 and 200),
  placed_by      uuid        not null,
  placed_at      timestamptz not null default now(),
  released_by    uuid,
  released_at    timestamptz,
  release_reason text        check (release_reason is null or length(trim(release_reason)) between 1 and 1000),
  check (
    (subject_kind = 'platform' and subject_id = '' and tenant_id is null)
    or (subject_kind = 'tenant'  and tenant_id is not null and subject_id = tenant_id)
    or (subject_kind = 'account' and tenant_id is not null and subject_id ~ '^[0-9a-f-]{36}$')
  ),
  -- Released means all three, or none of them.
  check ((released_at is null) = (released_by is null) and (released_at is null) = (release_reason is null)),
  -- The two-person rule, on the row itself.
  check (released_by is null or released_by <> placed_by)
);

create index if not exists legal_holds_by_tenant on public.legal_holds (tenant_id);

create index if not exists legal_holds_live_by_subject
  on public.legal_holds (subject_kind, subject_id) where released_at is null;

-- ── 3. Immutable except for one release ───────────────────────────────────

create or replace function private.legal_hold_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'A legal hold is a record and is never deleted; release it instead.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    -- Who placed it is who is signed in, whatever the client sent.
    new.placed_by := coalesce((select auth.uid()), new.placed_by);
    new.placed_at := now();
    new.released_by := null;
    new.released_at := null;
    new.release_reason := null;
    return new;
  end if;
  -- UPDATE: only a release, only once, and only the release columns move.
  if old.released_at is not null then
    raise exception 'This hold was already released.' using errcode = '23514';
  end if;
  if (new.id, new.subject_kind, new.subject_id, new.tenant_id, new.reason, new.matter_ref, new.placed_by, new.placed_at)
     is distinct from
     (old.id, old.subject_kind, old.subject_id, old.tenant_id, old.reason, old.matter_ref, old.placed_by, old.placed_at) then
    raise exception 'A legal hold can only be released, not edited.' using errcode = '42501';
  end if;
  -- A signed-in releaser is who the token says; only service_role, which has
  -- no token, names the person, and the two-person CHECK still applies.
  new.released_by := coalesce((select auth.uid()), new.released_by);
  new.released_at := now();
  return new;
end $$;

revoke all on function private.legal_hold_guard() from public, anon, authenticated;

drop trigger if exists legal_hold_guard on public.legal_holds;
create trigger legal_hold_guard
  before insert or update or delete on public.legal_holds
  for each row execute function private.legal_hold_guard();

-- Whether an account's profile belongs to a school. A policy cannot ask this
-- itself: an administrator is not entitled to read another account's profile,
-- so the subquery would find nothing and every placement would be refused.
-- It answers yes or no and returns nothing else about the profile.
create or replace function private.account_is_in_school(who text, school text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.user_id::text = who and p.school_id = school
  );
$$;

revoke all on function private.account_is_in_school(text, text) from public;
grant execute on function private.account_is_in_school(text, text) to authenticated;

-- ── 4. Row-level security ─────────────────────────────────────────────────

alter table public.legal_holds enable row level security;

drop policy if exists legal_holds_read on public.legal_holds;
create policy legal_holds_read on public.legal_holds for select to authenticated
  using (tenant_id is not null and (select private.has_capability('hold:read', 'school', tenant_id)));

drop policy if exists legal_holds_place on public.legal_holds;
create policy legal_holds_place on public.legal_holds for insert to authenticated
  with check (
    placed_by = (select auth.uid())
    and (
      (subject_kind = 'tenant' and (select private.has_capability('hold:place', 'school', tenant_id)))
      or (subject_kind = 'account'
          and (select private.has_capability('hold:place', 'school', tenant_id))
          and (select private.account_is_in_school(subject_id, tenant_id)))
    )
  );

drop policy if exists legal_holds_release on public.legal_holds;
create policy legal_holds_release on public.legal_holds for update to authenticated
  using (
    released_at is null
    and tenant_id is not null
    and (select private.has_capability('hold:release', 'school', tenant_id))
  )
  with check (released_by = (select auth.uid()));

revoke all on table public.legal_holds from public, anon, authenticated;
grant select, insert on table public.legal_holds to authenticated;
-- A release writes these three, and the guard sets who and when.
grant update (released_by, released_at, release_reason) on table public.legal_holds to authenticated;
grant select, insert, update on table public.legal_holds to service_role;

-- ── 5. What a live hold covers ────────────────────────────────────────────

create or replace function private.account_is_held(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.legal_holds h
     where h.released_at is null
       and (
         h.subject_kind = 'platform'
         or (h.subject_kind = 'account' and h.subject_id = who::text)
         or (h.subject_kind = 'tenant' and exists (
               select 1 from public.profiles p where p.user_id = who and p.school_id = h.tenant_id))
       )
  );
$$;

create or replace function private.tenant_is_held(school text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.legal_holds h
     where h.released_at is null
       and (h.subject_kind = 'platform' or (h.subject_kind = 'tenant' and h.tenant_id = school))
  );
$$;

create or replace function private.platform_is_held()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.legal_holds h where h.released_at is null and h.subject_kind = 'platform');
$$;

revoke all on function private.account_is_held(uuid) from public, anon, authenticated;
revoke all on function private.tenant_is_held(text) from public, anon, authenticated;
revoke all on function private.platform_is_held() from public, anon, authenticated;
grant execute on function private.account_is_held(uuid) to service_role;
grant execute on function private.tenant_is_held(text) to service_role;
grant execute on function private.platform_is_held() to service_role;

-- An account under a live hold cannot be deleted, by erasure or by anything
-- else that reaches `auth.users`. The trigger is the one place every path
-- passes through.
create or replace function private.refuse_delete_while_held()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.account_is_held(old.id) then
    raise exception 'This account is under a legal hold and cannot be deleted until the hold is released.' using errcode = '55006';
  end if;
  return old;
end $$;

revoke all on function private.refuse_delete_while_held() from public, anon, authenticated;

drop trigger if exists refuse_delete_while_held on auth.users;
create trigger refuse_delete_while_held
  before delete on auth.users
  for each row execute function private.refuse_delete_while_held();

-- ── 6. The sweeps stop for a hold ─────────────────────────────────────────
--
-- Each is `create or replace` of the function in 20260929030000, unchanged
-- except for the clause that skips what a live hold covers. The periods are
-- the same numbers.

create or replace function private.sweep_stale_invites()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n_invites integer;
  n_beta integer;
begin
  delete from public.invites i
   where i.invited_at < now() - interval '90 days'
     and not exists (
       select 1 from auth.users u where lower(u.email) = lower(i.email)
     )
     and not private.platform_is_held();
  get diagnostics n_invites = row_count;

  delete from public.beta_invitations b
   where ((b.accepted_at is null and b.revoked_at is null
           and b.invited_at < now() - interval '90 days')
      or (b.accepted_at is null and b.revoked_at < now() - interval '90 days'))
     and not private.platform_is_held();
  get diagnostics n_beta = row_count;

  return jsonb_build_object('invites', n_invites, 'beta_invitations', n_beta);
end $$;

create or replace function private.sweep_abandoned_signups()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  who uuid;
  removed integer := 0;
  refused integer := 0;
begin
  for who in
    select u.id from auth.users u
     where u.email_confirmed_at is null
       and u.last_sign_in_at is null
       and u.created_at < now() - interval '30 days'
       and not private.account_is_held(u.id)
  loop
    begin
      delete from auth.users u where u.id = who;
      removed := removed + 1;
    exception when others then
      refused := refused + 1;
    end;
  end loop;
  return jsonb_build_object('removed', removed, 'refused', refused);
end $$;

create or replace function private.sweep_audit_retention()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n_role integer := 0;
  n_moderation integer := 0;
  n_provisioning integer := 0;
  n_audit integer := 0;
begin
  perform set_config('semester.audit_retention', 'sweep', true);

  -- A tenant hold keeps that school's events; a platform hold keeps all of
  -- them, including moderation events, which carry no school.
  delete from public.role_grant_audit_event e
   where e.occurred_at < now() - interval '3 years'
     and not private.tenant_is_held(coalesce(e.tenant_id, ''))
     and not private.platform_is_held();
  get diagnostics n_role = row_count;

  delete from public.moderation_audit_event
   where occurred_at < now() - interval '3 years'
     and not private.platform_is_held();
  get diagnostics n_moderation = row_count;

  delete from public.provisioning_audit_event e
   where e.occurred_at < now() - interval '3 years'
     and not private.tenant_is_held(e.tenant_id)
     and not private.platform_is_held();
  get diagnostics n_provisioning = row_count;

  -- The common audit envelope (20260930000000_audit_and_subject_requests.sql),
  -- which redefined this function while this migration was open: its purge is
  -- kept, and it obeys a hold like the others. tenant_id is null for a
  -- platform-level event, which only a platform hold keeps.
  delete from public.audit_event e
   where e.occurred_at < now() - interval '3 years'
     and not private.tenant_is_held(coalesce(e.tenant_id, ''))
     and not private.platform_is_held();
  get diagnostics n_audit = row_count;

  perform set_config('semester.audit_retention', '', true);

  return jsonb_build_object(
    'role_grant_audit_event', n_role,
    'moderation_audit_event', n_moderation,
    'provisioning_audit_event', n_provisioning,
    'audit_event', n_audit
  );
end $$;

comment on table public.legal_holds is
  'Legal holds: placed by hold:place, released by a different person with hold:release, never deleted. Live holds are read by the retention sweeps and by the delete trigger on auth.users. See RETENTION.md.';

-- ── Rollback ──────────────────────────────────────────────────────────────
--
-- Additive. To undo: drop trigger refuse_delete_while_held on auth.users;
-- restore the three sweep bodies from 20260929030000; drop table
-- public.legal_holds; delete the three capabilities. Dropping the table
-- discards every hold, so do it only if none is live.
