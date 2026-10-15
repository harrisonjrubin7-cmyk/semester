# company.quotes — Commercial approvals

Status: proposed completion specification. Production activation disabled.

## Outcome
Approve scoped commercial proposals

## Authority boundary
Approved pricing, signing authority and no self-approval
Authority: named corporate/finance/legal decision authority
Proposed owner: Accountable company function + Operations

## Source registry contracts
Routes: /company/quotes
Actors: sales_rep, finance_approver
Permissions: quote.create, quote.approve
Records: sales.quotes, commerce.price_versions, ctl.action_requests
Commands: api.create_quote, approve_quote
Events: quote.approved

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
public.pricing.quote, company.crm, shared.authz.approvals

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Approve scoped commercial proposals
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Approve scoped commercial proposals
- Boundary enforced: Approved pricing, signing authority and no self-approval
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