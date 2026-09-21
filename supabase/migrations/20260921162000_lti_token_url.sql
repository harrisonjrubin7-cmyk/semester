-- Semester — where a platform hands out access tokens, which a launch never
-- needed and everything after one does.
--
-- Run this once, in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is safe to run again; every statement is guarded.
--
-- `20260921160000_lti.sql` recorded two URLs per registration and said why
-- there were only two: a launch is the *platform* proving who it is to us, so
-- what this tool needs is somewhere to send the student (`auth_login_url`) and
-- somewhere to find the keys the token is signed with (`jwks_url`). Neither
-- direction requires anything of ours.
--
-- Grade passback and deep linking run the other way — this tool calling back
-- into Brightspace — and there is no session to do it with. The standard's
-- answer is OAuth2 client credentials, where the secret is a JWT this tool
-- signs and the platform verifies against a JWKS we publish. That exchange
-- happens at a **third** URL, per platform, and it is the one column this
-- migration adds.
--
-- ## Nullable, and deliberately so
--
-- A registration installed before this existed has no token endpoint, and
-- there is nothing to derive one from: it is per-platform, and Brightspace's
-- is on a different host from its issuer entirely
-- (`auth.brightspace.com`, not the school's own Brightspace). A default would
-- be a guess, and the thing being guessed at is **where this tool sends a
-- signed assertion** — get it wrong and the assertion goes to somebody else's
-- server.
--
-- So it is null until an administrator fills it in, and
-- `_shared/ltikey.ts` refuses by name rather than guessing:
--
--     no-token-url — Registration for https://… has no token endpoint recorded.
--
-- A launch keeps working throughout. Nothing that exists today needs this
-- column, which is why adding it can be separated from using it.

alter table public.lti_platform
  add column if not exists token_url text;

-- https by the same check the other two URLs carry, and for the sharper
-- reason: this is the address a *signed assertion* is posted to. The other two
-- are places we send a student or fetch a public document.
--
-- Guarded, because `add column if not exists` is a no-op on a re-run and the
-- constraint would then be added twice.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.lti_platform'::regclass
       and conname = 'lti_platform_token_url_https'
  ) then
    alter table public.lti_platform
      add constraint lti_platform_token_url_https
      check (token_url is null or token_url ~ '^https://');
  end if;
end $$;

comment on column public.lti_platform.token_url is
  'The platform OAuth2 token endpoint, for client-credentials. Null until an administrator records it; a launch does not need it.';
