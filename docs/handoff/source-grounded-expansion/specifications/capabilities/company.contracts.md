# company.contracts — Contract lifecycle

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Company console
Routes: /company/contracts
Actors declared: legal_operator
Permissions declared: contract.edit, contracts:sign
Design reference: company-workflows/index.html (linked target not verified)
Screen types: list, detail, edit, review, history

## Record authority reconciliation
- biz.contracts: reference migration 160_company; RLS declared True; policies: ctr_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- docs.document_versions: reference migration 170_ownership_learning_docs_workflow_commerce; RLS declared True; policies: dv_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- docs.signature_requests: reference migration 170_ownership_learning_docs_workflow_commerce; RLS declared True; policies: none listed. Verify SQL expressions, grants, tenant keys and runtime.
- docs.signature_evidence: reference migration 170_ownership_learning_docs_workflow_commerce; RLS declared True; policies: none listed. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- record_signature: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: contract.signed.

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
