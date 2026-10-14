# inst.rollout — Institutional change

Status: proposed completion specification. Production activation disabled.

## Outcome
Plan training, UAT and scoped adoption

## Authority boundary
No activation without exact-target accepted evidence
Authority: named institutional office authority
Proposed owner: Institution Implementation + authorized office

## Source registry contracts
Routes: /institution/rollout
Actors: institution_admin
Permissions: rollout.approve
Records: impl.projects, impl.milestones
Commands: api.approve_rollout
Events: rollout.approved

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
ops.releases, inst.setup, inst.integrations, company.implementation

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Plan training, UAT and scoped adoption
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Plan training, UAT and scoped adoption
- Boundary enforced: No activation without exact-target accepted evidence
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