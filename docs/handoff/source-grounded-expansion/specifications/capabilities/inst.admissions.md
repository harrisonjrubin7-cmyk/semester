# inst.admissions — Admissions

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Institution console
Routes: /institution/admissions
Actors declared: admissions_reviewer
Permissions declared: application.review, application.decide
Design reference: registrar-console/index.html (linked target not verified)
Screen types: list, detail, review

## Record authority reconciliation
- adm.applications: reference migration 200_institution_domains; RLS declared True; policies: app_review · select, app_review · select. Verify SQL expressions, grants, tenant keys and runtime.
- adm.decisions: reference migration 200_institution_domains; RLS declared True; policies: dec_review · select, dec_review · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.review_application: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- record_decision: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: decision.recorded.

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
