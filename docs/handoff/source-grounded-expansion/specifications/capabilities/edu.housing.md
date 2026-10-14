# edu.housing — Campus housing

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Education app
Routes: /app/campus, /app/campus/maintenance
Actors declared: student
Permissions declared: housing.apply
Design reference: student/index.html (linked target not verified)
Screen types: overview, detail, edit

## Record authority reconciliation
- housing.rooms: reference migration 240_housing_family; RLS declared True; policies: hr_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- housing.applications: reference migration 240_housing_family; RLS declared True; policies: ha_self · select, ha_staff · select. Verify SQL expressions, grants, tenant keys and runtime.
- housing.assignments: reference migration 240_housing_family; RLS declared True; policies: has_self · select. Verify SQL expressions, grants, tenant keys and runtime.
- housing.maintenance_requests: reference migration 240_housing_family; RLS declared True; policies: hm_self · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.apply_housing: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- api.request_maintenance: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: maintenance.requested.

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
