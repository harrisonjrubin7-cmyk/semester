# public.signup — Signup

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Public site
Routes: /auth/signup, /join
Actors declared: visitor
Permissions declared: account.create
Design reference: journey/index.html (linked target not verified)
Screen types: edit

## Record authority reconciliation
- core.profiles: reference migration 010_platform_core; RLS declared True; policies: profiles_same_campus · select, profiles_self_update · update, profiles_self_read · select, profiles_staff_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- growth.consent_records: reference migration 110_onboarding_growth; RLS declared True; policies: consent_self_read · select, consent_self_write · insert. Verify SQL expressions, grants, tenant keys and runtime.
- onboard.assignments: reference migration 110_onboarding_growth; RLS declared True; policies: as_self · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.assign_journey: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: user.registered.

## Connected operating loop to complete
Identify first meaningful action and owning source; authorize scoped record access; render current provenance; preview consequence/recovery where applicable; issue canonical command; persist receipt/event; refetch projection; reconcile discrepancies; provide support/revoke/rollback path. Do not invent a write for a read-only capability.

## Acceptance
- Confirm actual repo key, routes, record owners and command handlers.
- Deny cross-tenant and unauthorized-object reads/search/cache access.
- Recheck expired/revoked grants and current versions at execution.
- For mutations: prove duplicate handling, durable transaction/receipt and event replay.
- For UI: ready/loading/empty/error/forbidden/offline/unavailable; freshness stays independent.
- For consequential actions: distinct approver where required; bind exact target/payload/version; reject changed or expired approval.
- Test relevant outage, reconciliation, accessibility and recovery paths.
- Collect exact-SHA code/test/deployment and applicable professional/customer evidence before activation.

## Evidence to retain
Owner [assign]; canonical key [resolve]; repo path [verify]; test command/run [retain]; environment/config/cohort [scope]; approval [authority + expiry]; outstanding risks [record]. No maturity promotion from this brief.
