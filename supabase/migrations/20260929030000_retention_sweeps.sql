-- Three retention answers RETENTION.md listed as missing, and the functions
-- that carry them out.
--
-- RETENTION.md's "What has no answer" named two rows — `invites` has no
-- expiry, and an abandoned account is kept forever — and the audit tables
-- beside them said "no time-based purge exists today". This migration decides
-- all three, in SQL, and `supabase/scheduler.sql` runs them. The periods are
-- argued in RETENTION.md; the numbers below are the same numbers, and
-- `app/src/lib/retention.test.ts` reads both ends.
--
-- What this file does NOT do is schedule anything. `check.sh` builds from a
-- plain Postgres with no pg_cron, and a schedule is a one-time operational
-- decision rather than schema — so the jobs are in `scheduler.sql`, the same
-- place every other job this project runs is, and `scheduler.test.ts` holds
-- the two files together.
--
-- ## Who may run these
--
-- Nobody through the API. Each function is in `private`, `security definer`,
-- revoked from PUBLIC (which is what actually removes the default EXECUTE —
-- see `20260921002428_invites.sql` for the bug that taught this repository
-- that) and from `anon` and `authenticated` by name as well, and granted to
-- `service_role` only so an operator can run one by hand. pg_cron runs them as
-- the owner. `retention-sweeps.check.sql` asserts that a signed-in account is
-- refused every one of them.

-- ── 1 · Invitations nobody took up ────────────────────────────────────────
--
-- **Decided: an invitation whose address never became an account is removed
-- 90 days after it was sent.** Ninety because that is the life this project
-- already gave `access_log` for the same argument: a record kept past the
-- point it serves anybody is a record kept for no one's benefit. A pilot
-- invitation that has sat unused for a term is not going to be used.
--
-- An invitation whose address *does* have an account is kept for as long as
-- that account is — it is the record of how the account was let in while the
-- gate was on. When the account is deleted the same rule then applies, so the
-- address goes at the next sweep (the invitation is already older than 90
-- days by then in every realistic case).
--
-- `beta_invitations` gets the same period, read off its own columns: an
-- invitation never accepted is removed 90 days after it was sent, and a
-- revoked one 90 days after the revocation. An accepted invitation is kept;
-- the membership points at it, and `forget_my_beta()` removes it with the
-- account.
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
     );
  get diagnostics n_invites = row_count;

  delete from public.beta_invitations b
   where (b.accepted_at is null and b.revoked_at is null
          and b.invited_at < now() - interval '90 days')
      or (b.accepted_at is null and b.revoked_at < now() - interval '90 days');
  get diagnostics n_beta = row_count;

  return jsonb_build_object('invites', n_invites, 'beta_invitations', n_beta);
end $$;

revoke all on function private.sweep_stale_invites() from public;
revoke all on function private.sweep_stale_invites() from anon, authenticated;
grant execute on function private.sweep_stale_invites() to service_role;

comment on function private.sweep_stale_invites() is
  'Remove invitations never taken up: invites 90 days after sending when no account has the address; beta invitations 90 days after sending (never accepted) or 90 days after revocation. See RETENTION.md.';

-- ── 2 · Accounts that were never finished ─────────────────────────────────
--
-- **Decided, in two halves, and the halves differ on purpose.**
--
-- *A sign-up that was never completed* — no confirmed email, no sign-in ever,
-- and more than 30 days old — is deleted. Such an account holds an address and
-- nothing else: without a sign-in there has never been a session, so row-level
-- security has never let it write a row. Deleting it removes no work, and so
-- does not break the promise on the privacy screen. Thirty days is long enough
-- for a confirmation email to be found in a spam folder and short enough that
-- a mistyped address somebody else owns does not sit in `auth.users` for a
-- term. Accounts made by an LTI launch are created confirmed
-- (`email_confirm: true` in `functions/lti`), so they are never in this set.
--
-- *An account that was used and then left* is **kept**. That is the promise
-- `lib/privacy.ts` makes — "until you delete it" — and a student who comes
-- back in January should find their semester. Retiring dormant accounts is a
-- decision for the institution that owns the relationship (SCIM
-- deprovisioning, or a school's own schedule under its DPA), not a clock this
-- project runs over students' work. `supabase/health.sql` counts dormant
-- accounts so the number is visible without anything acting on it.
--
-- One delete per account, each in its own sub-transaction, so an account some
-- foreign key refuses to let go of is counted and skipped rather than failing
-- the whole sweep.
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

revoke all on function private.sweep_abandoned_signups() from public;
revoke all on function private.sweep_abandoned_signups() from anon, authenticated;
grant execute on function private.sweep_abandoned_signups() to service_role;

comment on function private.sweep_abandoned_signups() is
  'Delete accounts never confirmed and never signed in, 30 days after creation. Accounts that were ever used are kept. See RETENTION.md.';

-- ── 3 · Security audit events ─────────────────────────────────────────────
--
-- **Decided: `role_grant_audit_event`, `moderation_audit_event` and
-- `provisioning_audit_event` are kept for 3 years, then removed.** Long enough
-- to cover a SOC 2 look-back (twelve months) three times over and the
-- multi-year cycle a university's own access reviews run on; short enough that
-- the tables are not a permanent history of every role anybody ever held. The
-- rows are pseudonymous metadata — hashes, roles, statuses — and never content.
--
-- **Not** `support_access_event`. That table is the record of each time a
-- supporter read a student's learning signals, which is a record of disclosure
-- in FERPA's sense (34 CFR 99.32), and FERPA requires it to be kept for as long
-- as the education records it is about. Those are kept until the student
-- deletes them, so this record is too. Nor `tenant_policy_audit_event`, which
-- is an institution's own configuration history and goes with the school.
--
-- ## How an immutable table is purged without becoming mutable
--
-- Each of the three has a trigger that refuses every update and delete. The
-- trigger functions are replaced here with ones that still refuse every update
-- and every delete, **except** a delete of a row older than 3 years while the
-- transaction has said, with a transaction-local setting, that it is the
-- retention sweep. Both conditions are checked in the trigger, so:
--
--   * a caller who sets the flag still cannot remove a recent event;
--   * a caller who can delete rows but does not set the flag cannot remove an
--     old one by accident;
--   * a signed-in account can do neither, because it has no DELETE privilege
--     and no delete policy on any of the three — the flag is not a privilege,
--     only a statement of intent by somebody who already had one.
--
-- `set_config(..., true)` is local to the transaction, so the flag cannot
-- outlive the sweep that set it.
create or replace function private.audit_purge_allowed(occurred timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('semester.audit_retention', true), '') = 'sweep'
     and occurred < now() - interval '3 years';
$$;

revoke all on function private.audit_purge_allowed(timestamptz) from public;
revoke all on function private.audit_purge_allowed(timestamptz) from anon, authenticated;

create or replace function private.refuse_role_grant_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.audit_purge_allowed(old.occurred_at) then
    return old;
  end if;
  raise exception 'Role grant audit events are immutable.';
end $$;

create or replace function private.refuse_moderation_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.audit_purge_allowed(old.occurred_at) then
    return old;
  end if;
  raise exception 'Moderation audit events are immutable.';
end $$;

create or replace function private.refuse_provisioning_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and private.audit_purge_allowed(old.occurred_at) then
    return old;
  end if;
  raise exception 'Provisioning audit events are immutable.';
end $$;

revoke all on function private.refuse_role_grant_audit_change() from public, anon, authenticated;
revoke all on function private.refuse_moderation_audit_change() from public, anon, authenticated;
revoke all on function private.refuse_provisioning_audit_change() from public, anon, authenticated;

create or replace function private.sweep_audit_retention()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n_role integer;
  n_moderation integer;
  n_provisioning integer;
begin
  perform set_config('semester.audit_retention', 'sweep', true);

  delete from public.role_grant_audit_event
   where occurred_at < now() - interval '3 years';
  get diagnostics n_role = row_count;

  delete from public.moderation_audit_event
   where occurred_at < now() - interval '3 years';
  get diagnostics n_moderation = row_count;

  delete from public.provisioning_audit_event
   where occurred_at < now() - interval '3 years';
  get diagnostics n_provisioning = row_count;

  perform set_config('semester.audit_retention', '', true);

  return jsonb_build_object(
    'role_grant_audit_event', n_role,
    'moderation_audit_event', n_moderation,
    'provisioning_audit_event', n_provisioning
  );
end $$;

revoke all on function private.sweep_audit_retention() from public;
revoke all on function private.sweep_audit_retention() from anon, authenticated;
grant execute on function private.sweep_audit_retention() to service_role;

comment on function private.sweep_audit_retention() is
  'Remove role-grant, moderation and provisioning audit events older than 3 years. support_access_event is kept (FERPA 99.32). See RETENTION.md.';
