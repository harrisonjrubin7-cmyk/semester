-- `private.is_app_admin()` stops reading `public.app_admins` and asks the
-- capability model the one question it was always standing in for.
--
-- F-5 in docs/ops/SECURITY_EXPOSURE_CLASSIFICATION.md: a membership list that
-- nothing in the repository writes still gated `schools_write`, the report
-- policies, the membership-enforcement switch and school offboarding (thirteen
-- sites in four migrations). It could not be audited like a grant: no
-- provenance, no expiry, no approval, no scope. Every site that reads it means
-- "a platform operator", which is `platform:configure` at platform scope and
-- is held by `platform_admin` alone.
--
-- Redefining the function, not its callers, moves all thirteen sites at once
-- and copies no function body. The name is now a misnomer and is kept on
-- purpose: renaming it is a second, mechanical migration that this one does
-- not need to carry.
--
-- Before applying anywhere, the prerequisite is that every row in
-- `public.app_admins` also holds a platform-scope `platform_admin` grant, or
-- that person loses the operator gates. Checked read-only on the production
-- project on 2026-10-06: 2 rows in app_admins, both with the grant.
--
-- `public.app_admins` is left in place and untouched; dropping it follows once
-- this has run for a release without anyone missing it.

create or replace function private.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_capability('platform:configure', 'platform', '');
$$;

comment on function private.is_app_admin() is
  'Whether the caller is a platform operator: platform:configure at platform scope. Legacy name; no longer reads public.app_admins.';
