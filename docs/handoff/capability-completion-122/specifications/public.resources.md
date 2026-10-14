# public.resources — Content marketing

Status: proposed completion specification. Production activation disabled.

## Outcome
Publish reviewed educational and product resources

## Authority boundary
Track author, source, accessible format and revision
Authority: approved publication/consent authority
Proposed owner: Marketing + Product + claim reviewer

## Source registry contracts
Routes: /resources, /resources/*
Actors: visitor
Permissions: content.read
Records: cms.pages, growth.consent_records
Commands: none listed; read/publish adapter must be reconciled
Events: none listed

## Build dependencies
No declared build predecessor; reconcile bootstrap

## Runtime collaborators
Resolve collaborators through canonical registry

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Publish reviewed educational and product resources
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Publish reviewed educational and product resources
- Boundary enforced: Track author, source, accessible format and revision
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