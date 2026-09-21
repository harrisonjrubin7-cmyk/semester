-- Close the gap between `revoke ... from public` and what Supabase actually grants.
--
-- Every migration in this repository that means "no client may call this"
-- writes `revoke all on function ... from public`, and `invites.check.sql`
-- proves that is the right spelling — revoking from `anon` and `authenticated`
-- by name leaves the PUBLIC grant they inherit intact.
--
-- On a real Supabase project it is not sufficient. `pg_default_acl` for schema
-- `public`, objtype `f`, carries
-- `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`
-- so every new function is granted EXECUTE to those roles *explicitly*, and a
-- revoke aimed at PUBLIC does not touch an explicit grant. `check.sh` does not
-- model this — it grants tables, not functions — so the suite is green on a
-- hole that is open in production.
--
-- Measured after applying `invites`: `set_invite_only(boolean)` had
-- `anon=X` and `authenticated=X`, meaning anybody holding the publishable key
-- shipped in the browser could turn the pilot's invite gate on or off.

-- ── Callable by nobody through the API ────────────────────────────────────
revoke all on function public.set_invite_only(boolean) from anon, authenticated;
revoke all on function public.only_invited()           from anon, authenticated;
revoke all on function public.gen_referral_code()      from anon, authenticated;
revoke all on function public.referral_active_days()   from anon, authenticated;
revoke all on function public.referral_new_days()      from anon, authenticated;

-- ── Signed in only: anon keeps no reach, authenticated keeps its grant ─────
-- Each of the three guards `auth.uid() is null` internally as well; this is
-- the outer fence the migration always intended, not a replacement for it.
revoke all on function public.make_referral_code()  from anon;
revoke all on function public.claim_referral(text)  from anon;
revoke all on function public.referral_standing()   from anon;