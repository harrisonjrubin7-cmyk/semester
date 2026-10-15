# company.quotes — Commercial approvals

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Company console
Routes: /company/quotes
Actors declared: sales_rep, finance_approver
Permissions declared: quote.create, quote.approve
Design reference: company-workflows/index.html (linked target not verified)
Screen types: list, detail, edit, review

## Record authority reconciliation
- ctl.action_requests: reference migration 100_controlled_actions; RLS declared True; policies: req_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- commerce.price_versions: reference migration 170_ownership_learning_docs_workflow_commerce; RLS declared True; policies: cpv_read · select. Verify SQL expressions, grants, tenant keys and runtime.
- sales.quotes: reference migration 210_company_ops_domains; RLS declared True; policies: q_r · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.create_quote: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- approve_quote: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: quote.approved.

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
