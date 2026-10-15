# dev.sandbox — Sandbox tenants

Status: proposed completion specification. Production activation disabled.

## Outcome
Create isolated synthetic development tenants

## Authority boundary
No production data, payment or academic authority
Authority: approved developer application authority
Proposed owner: Developer Platform + Security

## Source registry contracts
Routes: /developers/sandbox
Actors: approved_developer
Permissions: sandbox.create
Records: core.institutions
Commands: create_sandbox
Events: sandbox.created

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
Resolve collaborators through canonical registry

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Create isolated synthetic development tenants
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Create isolated synthetic development tenants
- Boundary enforced: No production data, payment or academic authority
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