# shared.org.memberships — Memberships

Status: proposed completion specification. Production activation disabled.

## Outcome
Manage institution relationships

## Authority boundary
Institution membership is not a universal role grant
Authority: platform identity and policy authority
Proposed owner: Platform Engineering + Security/Privacy

## Source registry contracts
Routes: /institution/members, /invite/*
Actors: institution_admin
Permissions: membership.invite, membership.revoke
Records: core.profiles, iam.invitations, iam.memberships
Commands: api.issue_invitation, api.accept_invitation, api.revoke_invitation
Events: invitation.issued, invitation.accepted, invitation.revoked

## Build dependencies
shared.identity.signin

## Runtime collaborators
Resolve collaborators through canonical registry

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Manage institution relationships
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Manage institution relationships
- Boundary enforced: Institution membership is not a universal role grant
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