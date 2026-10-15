# company.success — Customer success

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Company console
Routes: /company/customers, /company/renewals
Actors declared: csm
Permissions declared: health.edit, renewal.plan
Design reference: business/index.html (linked target not verified)
Screen types: overview, list, detail

## Record authority reconciliation
- biz.accounts: reference migration 160_company; RLS declared True; policies: acc_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- biz.contracts: reference migration 160_company; RLS declared True; policies: ctr_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- biz.pilots: reference migration 160_company; RLS declared True; policies: pil_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- biz.pilot_measures: reference migration 160_company; RLS declared True; policies: pm_read · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.record_measure: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: renewal.due.

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
