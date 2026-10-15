-- Erasure also clears a person's id from the policy audit's JSON snapshots.
--
-- `audit_tenant_policy_change` copies every change to `consent_record` (and three
-- other policy tables) into `tenant_policy_audit_event.old_data` / `new_data` as
-- `to_jsonb(old)` / `to_jsonb(new)`. For a consent row that is `subject_user_id`
-- and `recorded_by`: the account's id, in JSON. `erase_account` finds what to
-- remove from `private.account_data_map()`, which sees foreign-key columns only,
-- so those copies outlived the account: the check
-- `erasure-clears-consent-snapshots.check.sql` failed with "expected 0, got 4".
--
-- The scrub runs AFTER the erasure, not before it. Deleting the account cascades
-- to its consent rows, and the audit trigger writes a fresh `delete` snapshot for
-- each of them; a scrub that ran first would miss exactly those.
--
-- It replaces the id with the nil UUID rather than removing the key, so every
-- snapshot keeps its shape (who-did-what-when, capability, status, policy
-- version) and only the link back to the person is cut. Other people's ids in the
-- same row are untouched.
--
-- This edits a log that is otherwise append-only. That is a decision, recorded in
-- D-1198, and it is counsel's to confirm or reverse (privacy queue P-08); undoing
-- it is deleting the call below. The audit pseudonyms in the role-grant history
-- (08-C8) are a separate finding and are not touched here.
--
-- `public.erase_account` is the wrapper `20260930140000_erase_respects_holds.sql`
-- put in front of `private.erase_account_unheld`. It is replaced here with the
-- same hold check and the same call, plus the scrub. Do not replace it with a
-- full body: that would drop the hold check without a sound.

create or replace function private.scrub_audit_snapshots(target uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  nil constant text := '00000000-0000-0000-0000-000000000000';
  scrubbed integer;
begin
  update public.tenant_policy_audit_event e
     set old_data = case when e.old_data is null then null
                         else replace(e.old_data::text, target::text, nil)::jsonb end,
         new_data = case when e.new_data is null then null
                         else replace(e.new_data::text, target::text, nil)::jsonb end
   where coalesce(e.old_data::text, '') like '%' || target::text || '%'
      or coalesce(e.new_data::text, '') like '%' || target::text || '%';
  get diagnostics scrubbed = row_count;
  return scrubbed;
end $$;

revoke all on function private.scrub_audit_snapshots(uuid) from public, anon, authenticated, service_role;

create or replace function public.erase_account(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt jsonb;
begin
  if target is not null and private.account_is_held(target) then
    raise exception 'This account is under a legal hold and cannot be erased until the hold is released.'
      using errcode = '55006';
  end if;
  receipt := private.erase_account_unheld(target);
  return receipt || jsonb_build_object('audit_snapshots_scrubbed', private.scrub_audit_snapshots(target));
end $$;

revoke all on function public.erase_account(uuid) from public, anon, authenticated;
grant execute on function public.erase_account(uuid) to service_role;

comment on function public.erase_account(uuid) is
  'Erase an account''s own data, unless it is under a legal hold, then clear its id from the policy audit''s JSON snapshots. Service role only. The body is private.erase_account_unheld; see 20260930140000_erase_respects_holds.sql and 20261004190000_erasure_scrubs_audit_copies.sql.';
