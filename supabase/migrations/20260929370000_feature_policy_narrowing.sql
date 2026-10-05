-- Semester — a flag's narrowing holds at the database, not only on the screen.
--
-- `tenant_feature_policy` carries three things about a flag at a school: its
-- `state`, and two narrowings — `permitted_roles` (since 20260923210000) and
-- `permitted_cohorts` (since 20260929340000). `evaluateFlag` in
-- `app/src/lib/flags.ts` walks all three. The server gates of the new modules
-- walked one: `private.dining_charge_gate` and `private.registration_gate`
-- asked only whether `feature_state(...)` was `production`. So a school that
-- put dining in a staff-only preview, or registration in a fifty-student
-- pilot, had limited the screen and nothing else: any member at the school
-- could call `dining_place_order`, `dining_donate_swipes` or
-- `registration_enroll` directly and be charged, give swipes or take a seat.
--
-- One reading of the narrowing, two ways in:
--
--   * `public.feature_narrowing(capability, tenant)` returns the two lists
--     and, of each, what the caller holds: their live roles *at this school*
--     that the role list names (a `role_grants` row, scope `school`, this
--     tenant, not revoked, not expired), and their live cohorts
--     (`feature_cohort_members`, `removed_at is null`) that the cohort list
--     names. It is `security invoker` and takes no user parameter, so a
--     client calling it sees only what its own row-level security already
--     shows it — its school's policy row, its own grants, its own
--     memberships — and can ask about nobody else. No policy row, no row
--     back. `app/src/lib/featurepolicy.ts` reads it and hands the result to
--     `evaluateFlag`, whose steps 7 and 7b decide.
--   * `private.feature_admits_caller(capability, tenant)` is that decision for
--     the server gates, read off the same function so the two cannot drift:
--     an empty list admits everybody the earlier steps admitted; a non-empty
--     one admits only a caller holding one of its names. No policy row is
--     false, as `feature_state` answers `off`. Called from a definer gate,
--     the invoker function runs as the gate's owner and reads past row-level
--     security, but it still filters on `auth.uid()`, so it still answers only
--     about the caller. The helper is not granted to any client role.
--
create or replace function public.feature_narrowing(want_capability text, want_tenant text)
returns table (permitted_roles text[], permitted_cohorts text[], roles text[], cohorts text[])
language sql
stable
security invoker
set search_path = ''
as $$
  select p.permitted_roles,
         p.permitted_cohorts,
         array(select distinct g.role from public.role_grants g
                where g.subject = (select auth.uid())
                  and g.scope_kind = 'school'
                  and g.scope_id = p.tenant_id
                  and g.role = any (p.permitted_roles)
                  and g.revoked_at is null
                  and (g.expires_at is null or g.expires_at > now())
                order by 1),
         array(select distinct m.cohort from public.feature_cohort_members m
                where m.tenant_id = p.tenant_id
                  and m.user_id = (select auth.uid())
                  and m.removed_at is null
                  and m.cohort = any (p.permitted_cohorts)
                order by 1)
    from public.tenant_feature_policy p
   where p.tenant_id = want_tenant and p.capability = want_capability;
$$;

revoke all on function public.feature_narrowing(text, text) from public, anon, authenticated;
grant execute on function public.feature_narrowing(text, text) to authenticated;

create or replace function private.feature_admits_caller(want_capability text, want_tenant text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select (cardinality(n.permitted_roles) = 0 or cardinality(n.roles) > 0)
       and (cardinality(n.permitted_cohorts) = 0 or cardinality(n.cohorts) > 0)
      from public.feature_narrowing(want_capability, want_tenant) n
  ), false);
$$;

revoke all on function private.feature_admits_caller(text, text) from public, anon, authenticated;

-- ── Cohort memberships survive their configurer's account ────────────────
--
-- `feature_cohort_members.added_by` and `removed_by` are `on delete set
-- null`, and 20260929340000's trigger refused every update that touched
-- `added_by` — including the one the foreign key makes when that account is
-- deleted. So deleting the account of anybody who had ever added somebody to
-- a pilot failed ("A cohort membership is ended, never rewritten"). A
-- suite found it when an office holder, who had been the session adding a
-- member, was deleted; `feature_cohorts.check.sql` now deletes the
-- configurer and holds it. As 20260929340000 wrote it, with one case
-- first: an update that only clears `added_by` and/or `removed_by` to null,
-- changing nothing else, and only for an account that no longer exists, is
-- that cascade, and passes untouched. A configurer cannot use it to erase who
-- added somebody while that account is still there. `security definer` only
-- so the trigger can see `auth.users`; it reads nothing else.
create or replace function private.stamp_cohort_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.tenant_id is not distinct from old.tenant_id and new.cohort is not distinct from old.cohort
     and new.user_id is not distinct from old.user_id and new.added_at is not distinct from old.added_at
     and new.removed_at is not distinct from old.removed_at
     and (new.added_by is not distinct from old.added_by
          or (new.added_by is null and not exists (select 1 from auth.users u where u.id = old.added_by)))
     and (new.removed_by is not distinct from old.removed_by
          or (new.removed_by is null and not exists (select 1 from auth.users u where u.id = old.removed_by)))
     and (new.added_by is distinct from old.added_by or new.removed_by is distinct from old.removed_by) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.added_by := (select auth.uid());
    new.added_at := now();
    new.removed_by := null;
    new.removed_at := null;
  else
    if new.tenant_id is distinct from old.tenant_id or new.cohort is distinct from old.cohort
       or new.user_id is distinct from old.user_id or new.added_by is distinct from old.added_by
       or new.added_at is distinct from old.added_at then
      raise exception 'A cohort membership is ended, never rewritten.';
    end if;
    if old.removed_at is not null then
      raise exception 'This membership has already ended.';
    end if;
    if new.removed_at is null then
      raise exception 'An update may only end the membership.';
    end if;
    new.removed_by := (select auth.uid());
    new.removed_at := now();
  end if;
  return new;
end $$;

revoke all on function private.stamp_cohort_membership() from public, anon, authenticated;

-- ── Dining: the charge gate, with the narrowing ───────────────────────────
--
-- As 20260929330000 wrote it, with step 2 added. A caller outside the
-- narrowing is `flag_off`: to them, dining is not on.
create or replace function private.dining_charge_gate(school text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.feature_state('module.dining', school) <> 'production' then
    raise exception 'dining: flag_off: dining is not turned on at this school' using errcode = 'insufficient_privilege';
  end if;
  if not private.feature_admits_caller('module.dining', school) then
    raise exception 'dining: flag_off: this school has limited dining to other roles or a release cohort'
      using errcode = 'insufficient_privilege';
  end if;
  if public.kill_switch_engaged('kill.writeback', school) or public.kill_switch_engaged('kill.integration_sync', school) then
    raise exception 'dining: kill_switch: new orders and gifts are stopped at this school' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.dining_partner_connections c where c.tenant_id = school and c.status = 'live') then
    raise exception 'dining: partner_unavailable: the card office is not connected, so nothing can be charged'
      using errcode = 'insufficient_privilege';
  end if;
end $$;
revoke all on function private.dining_charge_gate(text) from public, anon, authenticated;

-- ── Registration: the gate, with the narrowing ────────────────────────────
--
-- As 20260929300000 wrote it, with the last step added. Stopped still
-- outranks off, and off still outranks narrowed.
create or replace function private.registration_gate(want_school text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.kill_switch_engaged('kill.writeback', want_school)
      or public.kill_switch_engaged('kill.integration_sync', want_school) then 'kill_switch'
    when public.feature_state('writeback.registration_submit', want_school) <> 'production' then 'flag_off'
    when not private.feature_admits_caller('writeback.registration_submit', want_school)
     and not private.has_capability('registration:administer', 'school', want_school) then 'flag_off'
  end;
$$;
revoke all on function private.registration_gate(text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- Rolling back
--
--   Re-run the two `create or replace` statements for
--   private.dining_charge_gate and private.registration_gate from
--   20260929330000_dining.sql and 20260929300000_registration_transaction.sql,
--   then:
--
--   drop function if exists private.feature_admits_caller(text, text);
--   drop function if exists public.feature_narrowing(text, text);
