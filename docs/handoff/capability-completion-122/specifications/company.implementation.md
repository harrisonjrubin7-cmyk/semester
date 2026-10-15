# company.implementation — Implementation

Status: proposed completion specification. Production activation disabled.

## Outcome
Deliver dependency-ordered customer work

## Authority boundary
Exact-target test/evidence; no unsupported integration promise
Authority: named corporate/finance/legal decision authority
Proposed owner: Accountable company function + Operations

## Source registry contracts
Routes: /company/implementations/:id
Actors: implementation_specialist
Permissions: migration.run, acceptance.record
Records: impl.migration_batches, impl.acceptance_records, opsx.sync_runs
Commands: run_migration, record_acceptance
Events: acceptance.recorded

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
company.contracts, inst.setup, ops.releases

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Deliver dependency-ordered customer work
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Deliver dependency-ordered customer work
- Boundary enforced: Exact-target test/evidence; no unsupported integration promise
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