-- A school that deprovisions a person ends that person's authority at the
-- school (D-160).
--
-- `private.has_capability` reads `role_grants`. SCIM deprovisioning
-- (`20260924150142`) sets `institution_membership.status = 'deprovisioned'`
-- and empties its `roles`, and nothing connected the two: a staff member
-- removed by the school's identity provider kept every school-scoped
-- capability until a grant happened to expire. `offboarding-grants.check.sql`
-- shows it on the schema before this file and shows it closed after.
--
-- The rule, and its edges:
--
--   * When a membership becomes `deprovisioned`, that person's live
--     school-scoped grants for that school are revoked (`revoked_at = now()`).
--     The grant stays as a row, so the existing audit trigger records the
--     change and the history survives.
--   * Only `school` scope and only that school. The same person's grants at
--     another school, and other people's grants at this one, are untouched.
--   * `suspended` revokes nothing: leave is not termination, and the
--     membership state already withholds what it should for the duration.
--   * Reactivation restores the membership, not the authority. A grant that
--     was revoked stays revoked until somebody grants it again, which is a
--     decision a person makes rather than a side effect of a status flip.
--   * Not covered, deliberately: grants scoped to an organization, course,
--     department or office, whose `scope_id` is not keyed by school. Those
--     need a mapping from scope to school that does not exist in the schema;
--     see docs/SECURITY-GAP-AUDIT-2026-09-30.md.
--
-- The one-time backfill at the bottom applies the same rule to memberships
-- that were deprovisioned before this trigger existed. It is idempotent: on a
-- second run there is nothing left to revoke.
--
-- Idempotent. No begin/commit: the runner opens the transaction.

create or replace function private.revoke_grants_on_deprovision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deprovisioned'
     and old.status is distinct from 'deprovisioned'
     and new.auth_user_id is not null then
    update public.role_grants
       set revoked_at = now()
     where subject = new.auth_user_id
       and scope_kind = 'school'
       and scope_id = new.tenant_id
       and revoked_at is null;
  end if;
  return new;
end;
$$;

revoke all on function private.revoke_grants_on_deprovision() from public, anon, authenticated, service_role;

drop trigger if exists revoke_grants_on_deprovision on public.institution_membership;
create trigger revoke_grants_on_deprovision
  after update of status on public.institution_membership
  for each row execute function private.revoke_grants_on_deprovision();

-- Backfill: memberships already deprovisioned whose person still holds a live
-- school grant for that school.
update public.role_grants g
   set revoked_at = now()
  from public.institution_membership m
 where m.status = 'deprovisioned'
   and m.auth_user_id is not null
   and g.subject = m.auth_user_id
   and g.scope_kind = 'school'
   and g.scope_id = m.tenant_id
   and g.revoked_at is null;
