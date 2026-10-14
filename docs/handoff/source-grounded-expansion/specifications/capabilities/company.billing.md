# company.billing — Company billing

Status: source-grounded review specification; implementation unverified.

## Source contract
Workspace: Company console
Routes: /company/invoices
Actors declared: billing_operator
Permissions declared: invoice.issue, credit.issue
Design reference: native-finance/index.html (linked target not verified)
Screen types: list, detail, edit

## Record authority reconciliation
- cofin.invoices: reference migration 210_company_ops_domains; RLS declared True; policies: inv_r · select. Verify SQL expressions, grants, tenant keys and runtime.
- cofin.invoice_lines: reference migration 210_company_ops_domains; RLS declared True; policies: il_r · select. Verify SQL expressions, grants, tenant keys and runtime.
- cofin.credits: reference migration 210_company_ops_domains; RLS declared True; policies: cr_r · select. Verify SQL expressions, grants, tenant keys and runtime.

External/unmatched references: none in reference lookup.

## Commands and events
- api.issue_invoice: exact name found in reference catalog; body/runtime unverified. Bind tenant, actor, object, purpose, version and idempotency at execution.
- issue_credit: resolve actual implementation/adapter before building. Bind tenant, actor, object, purpose, version and idempotency at execution.
Events declared: invoice.issued.

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
