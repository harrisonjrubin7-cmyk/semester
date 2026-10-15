# edu.family — Family and guardian access

Status: proposed completion specification. Production activation disabled.

## Outcome
Share selected released information with a guardian

## Authority boundary
Student-controlled scope/expiry; no guardian default access
Authority: student-private or approved academic authority per object
Proposed owner: Product + Academic Engineering

## Source registry contracts
Routes: /family, /app/settings/sharing
Actors: student, guardian
Permissions: delegation.grant
Records: core.delegations, core.delegation_scopes
Commands: api.grant_delegation, api.revoke_delegation
Events: delegation.granted

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
shared.delegation, edu.privacy, edu.grading

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Share selected released information with a guardian
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Share selected released information with a guardian
- Boundary enforced: Student-controlled scope/expiry; no guardian default access
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