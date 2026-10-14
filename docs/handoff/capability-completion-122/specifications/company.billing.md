# company.billing — Company billing

Status: proposed completion specification. Production activation disabled.

## Outcome
Invoice and reconcile company revenue

## Authority boundary
Regulated rails are adapters; no PAN/CVV storage
Authority: named corporate/finance/legal decision authority
Proposed owner: Accountable company function + Operations

## Source registry contracts
Routes: /company/invoices
Actors: billing_operator
Permissions: invoice.issue, credit.issue
Records: cofin.invoices, cofin.invoice_lines, cofin.credits
Commands: api.issue_invoice, issue_credit
Events: invoice.issued

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
company.subscriptions, company.accounting, shared.events.outbox

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Invoice and reconcile company revenue
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Invoice and reconcile company revenue
- Boundary enforced: Regulated rails are adapters; no PAN/CVV storage
- Wrong tenant and ungranted object are denied
- Revoked/expired grant rejected at execution
- Duplicate idempotency key returns original result; changed payload rejected
- Concurrent version change invalidates action preview/approval
- Event replay, ordering gap and dependency outage produce safe states
- Every region has ready/loading/empty/error/forbidden/offline/unavailable states
- Source authority and freshness remain independent
- Accessible keyboard, AT, zoom, responsive and dark review retained
- Exact SHA/target tests and applicable professional/customer acceptance retained

## Remaining integration
Map listed design tables/functions to live repository definitions before implementation. Reuse existing schemas, role grants and release evaluator. Do not apply duplicate reference migrations. Retain code, test, deployment and authority evidence independently.