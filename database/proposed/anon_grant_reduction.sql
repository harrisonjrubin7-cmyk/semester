-- SUPERSEDED by supabase/migrations/20261005200000_anon_keeps_only_its_public_catalog.sql (D-1306).
-- Do not copy this file into supabase/migrations. The landed migration revokes every public
-- table from anon and grants back only the public catalog, open forms, the school list, and
-- form_responses INSERT. This draft is the narrower list the 5 October reading started from.
-- PROPOSED, NOT APPLIED as its own migration.
-- 2026-10-05 reading (docs/native-platform/FOUNDATION_EXPOSURE_READING.md): anon TRUNCATE
-- was already absent on the owner-scoped tables. INSERT, UPDATE and DELETE were still granted
-- when this draft was written; D-1306 is the revoke that followed.
-- Why: 24 owner-scoped tables carry the Supabase default full grant to anon (incl. TRUNCATE, TRIGGER).
-- Row policies key on auth.uid(), which is null for anon, so row reads/writes are already denied.
-- TRUNCATE is not subject to RLS; PostgREST does not expose it, but the grant is a standing
-- defence-in-depth gap. Removing it does not change any behaviour the app relies on, to be proven by
-- the suites before this moves into supabase/migrations.
-- Rollback: re-grant the same privileges (listed in database/GRANT_ALLOWLIST.md).
revoke all on public.appointments, public.blocks, public.calendar_feeds, public.courses,
  public.enrollments, public.family_grants, public.group_members, public.group_tasks, public.groups,
  public.message_reactions, public.messages, public.notes, public.organization_members,
  public.organizations, public.profiles, public.push_devices, public.push_queue,
  public.referral_codes, public.referrals, public.reports, public.schools, public.sittings,
  public.state, public.tasks, public.usage
  from anon;
-- Deliberately kept: commercial_plans/prices/products, entitlement_definitions, plan_entitlements
-- (SELECT), form_publications (SELECT), form_responses (INSERT), and schools SELECT -- re-grant:
grant select on public.schools to anon;  -- schools_read policy is `true`; see GRANT_ALLOWLIST.md Q1
-- Note: anon policies on private.* helpers (classmate, in_class, ...) must stay executable only while
-- any anon-granted table's policy calls them; after this revoke, review whether anon EXECUTE on those
-- 22 private functions can also be removed.
