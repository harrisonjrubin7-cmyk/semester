-- Student erasure now reads a legal hold first, and refuses before it touches
-- anything.
--
-- 20260930100000_legal_holds.sql put a trigger on `auth.users` and said that is
-- "where student erasure goes". It is not the first place. `public.erase_account`
-- clears the account's own rows itself, in one transaction, and only afterwards
-- does the `delete-account` edge function delete the auth user. So for a held
-- account the trigger would have fired last: the data already gone, the account
-- refused. That is the worst order for a hold, and it is fixed here at the top
-- of the path, not at the end.
--
-- How, without copying a long function: the original body is moved, unchanged,
-- to `private.erase_account_unheld`, and `public.erase_account` becomes a thin
-- wrapper that asks `private.account_is_held` first and only then calls it.
-- Copying the body instead would freeze today's version over any later edit to
-- it. The wrapper keeps the original's signature, its grant (service role only)
-- and its error codes, and adds one: 55006, "under a legal hold".
--
-- The catch is the mirror image: a later migration that does `create or replace
-- public.erase_account` with a full body would replace this wrapper and drop the
-- check without a sound. `legal-holds.check.sql` therefore calls erase_account
-- for a held account and fails if it runs.
--
-- Idempotent: the move happens once, and the wrapper is replaced every time.

do $$
begin
  if to_regprocedure('private.erase_account_unheld(uuid)') is null then
    alter function public.erase_account(uuid) rename to erase_account_unheld;
    alter function public.erase_account_unheld(uuid) set schema private;
  end if;
end $$;

-- The original is reachable only through the wrapper: not even the service role
-- may call it directly and walk around the hold.
revoke all on function private.erase_account_unheld(uuid) from public, anon, authenticated, service_role;

create or replace function public.erase_account(target uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target is not null and private.account_is_held(target) then
    raise exception 'This account is under a legal hold and cannot be erased until the hold is released.'
      using errcode = '55006';
  end if;
  return private.erase_account_unheld(target);
end $$;

revoke all on function public.erase_account(uuid) from public, anon, authenticated;
grant execute on function public.erase_account(uuid) to service_role;

comment on function public.erase_account(uuid) is
  'Erase an account''s own data, unless it is under a legal hold. Service role only. The body is private.erase_account_unheld; see 20260930140000_erase_respects_holds.sql.';
