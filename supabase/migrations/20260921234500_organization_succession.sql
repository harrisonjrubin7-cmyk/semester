-- ═══════════════════════════════════════════════════════════════════════════
-- What happens to an organization when somebody stops existing
--
-- Run once, after `20260921230000_organizations.sql`. Idempotent.
--
-- ── The question that migration left open ────────────────────────────────
--
-- It refuses to let the only administrator of an organization leave, and gives
-- the reason: an organization with members and no administrator cannot be
-- edited, cannot admit anybody and cannot appoint a replacement, because all
-- three ask ADMIN. Locked, permanently, with no route back.
--
-- That refusal is right for somebody pressing "leave", who is present and can
-- appoint a successor first. It is not available for an account that is being
-- deleted. `organization_members.user_id` references `auth.users on delete
-- cascade`, and a cascade cannot be refused, argued with, or asked to appoint
-- anybody. `RETENTION.md` recorded this as having no answer and named the
-- three it could have. This is the answer.
--
-- ── What is *not* the answer, and why ────────────────────────────────────
--
-- **Delete the organization with its last administrator.** A founder who
-- deletes their account would take a club of forty people's roster, and
-- eventually its events, files and finances, with them. `KEPT_TABLES` in
-- `lib/cloud.ts` already settled the general form of this: "there is no
-- version of 'delete everything' that includes them and is not also 'delete
-- somebody else's data'."
--
-- **Promote somebody automatically.** The obvious rule is the longest-standing
-- remaining member, and it is obvious until you say it out loud: a person who
-- joined a club finds themselves responsible for its money and its admissions
-- because somebody else closed their account overnight. Nobody agreed to that.
--
-- ── What it is: adminless is a state, and members can leave it ───────────
--
-- The organization is left with no administrator, which is honest — that is
-- exactly what has happened — and `claim_abandoned_organization()` below lets
-- any member take it on. So the state is recoverable by the people it belongs
-- to, rather than fixed by a rule written in advance by somebody who does not
-- know them.
--
-- The one case with nobody to recover it is the one where nobody is left: an
-- organization whose last member is gone is deleted, because an organization
-- with no members is not anything and leaving it would put an unenterable
-- shell in every campus directory forever.

-- ── The succession, as a trigger rather than a function ──────────────────
--
-- A trigger because there are two ways a membership row disappears and only
-- one of them runs any code of ours. `leave_organization()` and
-- `forget_my_organizations()` are calls; the cascade from `auth.users` is not,
-- and that is the path this exists for. `AFTER DELETE` sees the row that went.
--
-- `security definer` is not needed and is not used: a trigger function already
-- runs with the privileges of the statement that fired it, and row-level
-- security does not apply to a referential cascade at all. What it does need
-- is an empty `search_path`, same as everything else here.

create or replace function private.after_member_left()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  remaining integer;
begin
  select count(*) into remaining
    from public.organization_members m
   where m.org_id = old.org_id;

  if remaining = 0 then
    delete from public.organizations o where o.id = old.org_id;
  end if;

  return null;
end;
$$;

revoke all on function private.after_member_left() from public, anon, authenticated;

drop trigger if exists organization_members_left on public.organization_members;
create trigger organization_members_left
  after delete on public.organization_members
  for each row
  execute function private.after_member_left();

-- ── Taking on an organization nobody is running ──────────────────────────

/**
 * Become the administrator of an organization that has none.
 *
 * Callable by any member, and only while there is genuinely nobody: the check
 * is `no row of this organization holds ADMIN`, not "the administrator has
 * been quiet". An organization cannot be engineered into this state by anybody
 * but its own administrators, because `ADMIN` is the only capability that can
 * remove `ADMIN`.
 *
 * It grants `ADMIN` alone rather than a set. Whoever takes it on can appoint
 * themselves anything else in the next call, and starting them with a set
 * somebody else chose would be this file making exactly the decision it says
 * above it will not make.
 */
create or replace function public.claim_abandoned_organization(org uuid)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me     uuid := (select auth.uid());
  mine   text;
  admins integer;
begin
  select m.standing into mine
    from public.organization_members m
   where m.org_id = org and m.user_id = me;

  if mine is distinct from 'MEMBER' then
    raise exception 'only a member of an organization can take it on'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into admins
    from public.organization_members m
   where m.org_id = org and m.standing = 'MEMBER' and 'ADMIN' = any(m.capabilities);

  if admins > 0 then
    raise exception 'this organization has an administrator — ask them'
      using errcode = 'restrict_violation';
  end if;

  update public.organization_members m
     set capabilities = array['ADMIN'], updated_at = now()
   where m.org_id = org and m.user_id = me;

  return array['ADMIN'];
end;
$$;

-- ── Leaving every one of them at once ────────────────────────────────────

/**
 * Remove this account from every organization it appears in, whatever it
 * appears as.
 *
 * `lib/cloud.ts` deletes an account's rows by sending one filtered DELETE per
 * table, and that cannot work here: both API roles are off DELETE on
 * `organization_members` entirely, deliberately, because the table holds one
 * person's rank as decided by another. So this is the one entry point, and it
 * is the reason `deleteEverything()` can list the table at all.
 *
 * It takes `DECLINED` and `REMOVED` too, which `leave_organization()` refuses
 * to touch, and the difference is the whole point of there being two
 * functions. Refusing there protects an organization's record of a decision
 * from the person it was about, who is still here and might reapply. Refusing
 * *here* would mean an account that asked to be forgotten leaving behind a row
 * on somebody's list that says it was turned down — and `profiles` goes in the
 * same pass, so it would be a decision about a person nobody can identify or
 * ask about.
 *
 * The last-administrator refusal does not apply either, for the same reason it
 * does not apply to a cascade: there is nobody left to appoint a successor.
 * The organization is left adminless and its members can take it on.
 */
create or replace function public.forget_my_organizations()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  gone integer;
begin
  if (select auth.uid()) is null then
    raise exception 'there is no account to forget' using errcode = 'insufficient_privilege';
  end if;

  delete from public.organization_members m where m.user_id = (select auth.uid());
  get diagnostics gone = row_count;
  return gone;
end;
$$;

revoke all on function public.claim_abandoned_organization(uuid) from public, anon;
revoke all on function public.forget_my_organizations() from public, anon;
grant execute on function public.claim_abandoned_organization(uuid) to authenticated;
grant execute on function public.forget_my_organizations() to authenticated;

comment on function public.forget_my_organizations() is
  'Removes this account from every organization it appears in, including the rows '
  'leave_organization() refuses to touch. The only delete path into '
  'organization_members from a client, because both API roles are off DELETE on that '
  'table. See 20260921234500_organization_succession.sql.';
