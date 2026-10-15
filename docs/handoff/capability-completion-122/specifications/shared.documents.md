# shared.documents — Documents

Status: proposed completion specification. Production activation disabled.

## Outcome
Control document drafting, review and publication

## Authority boundary
A draft is not approved policy or executed agreement
Authority: platform identity and policy authority
Proposed owner: Platform Engineering + Security/Privacy

## Source registry contracts
Routes: /company/documents, /institution/documents
Actors: document_owner, reviewer
Permissions: document.submit, document.execute, document.archive
Records: docs.documents, docs.document_versions, docs.version_states, docs.review_tasks, docs.transition_events, docs.contract_documents, docs.signature_requests, docs.acknowledgments
Commands: api.transition_document, acknowledge
Events: document.transitioned

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
Resolve collaborators through canonical registry

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Control document drafting, review and publication
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Control document drafting, review and publication
- Boundary enforced: A draft is not approved policy or executed agreement
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