-- Semester — the scheduler's token check for the `access-saga-tick` Edge Function.
--
-- The `access-saga-worker` pg_cron job (supabase/scheduler.sql) calls the
-- function with `Authorization: Bearer <access_saga_cron_secret>`, the secret
-- scheduler.sql generated into Vault. The function asks this whether the token
-- it was sent is that secret, so the secret has exactly one home: nothing is
-- copied onto the function, and rotating it is one Vault update. The same
-- arrangement as `integration_tick_authorized` (20260928101000), with a secret
-- of its own so rotating one scheduler's token does not touch the other's.
--
-- Service role only; the function calls it with the platform-injected service
-- key. `false` for anything short of a match — no secret in Vault, a null or
-- short token — and the comparison is of SHA-256 digests, so its cost does not
-- depend on how much of the token was right.
--
-- access-saga-tick-auth.check.sql exercises it. Idempotent; no begin/commit —
-- the runner opens the transaction.

create or replace function public.access_saga_tick_authorized(presented text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  want text;
begin
  if presented is null or length(presented) < 32 then
    return false;
  end if;
  select decrypted_secret into want
    from vault.decrypted_secrets
   where name = 'access_saga_cron_secret';
  if want is null or length(want) < 32 then
    return false;
  end if;
  return sha256(convert_to(presented, 'UTF8')) = sha256(convert_to(want, 'UTF8'));
end $$;
revoke all on function public.access_saga_tick_authorized(text) from public;
revoke all on function public.access_saga_tick_authorized(text) from anon, authenticated;
grant execute on function public.access_saga_tick_authorized(text) to service_role;
