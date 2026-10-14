# inst.security — Institution security

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Institution console
Routes: /institution/identity, /institution/access-reviews
Actors declared: identity_admin
Permissions declared: sso.configure, access_review.run
Design reference: governance-backbone/index.html (linked target not verified)
Screen types: settings, review

## Record authority reconciliation
- ctl.grants: reference migration 100_controlled_actions; RLS declared True; policies: grant_self · select. Verify SQL expressions, grants, tenant keys and runtime.
- opsx.integrations: reference migration 150_operations; RLS declared True; policies: int_view · select. Verify SQL expressions, grants, tenant keys and runtime.
- iam.access_reviews: reference migration 200_institution_domains; RLS declared True; policies: ar_reviewer · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- configure_sso: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
- api.run_access_review: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: access_review.completed.

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
