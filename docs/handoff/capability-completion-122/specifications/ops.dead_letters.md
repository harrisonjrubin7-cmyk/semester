# ops.dead_letters — Webhook dead letters

Status: proposed completion specification. Production activation disabled.

## Outcome
Inspect failed webhooks and permitted replay

## Authority boundary
Verify signature/source/version; no duplicate authority action
Authority: exact-target operator and release authority
Proposed owner: Platform Operations + Security

## Source registry contracts
Routes: /console/integrations/dead-letters
Actors: reliability_engineer
Permissions: job.replay
Records: opsx.webhook_endpoints, opsx.webhook_deliveries
Commands: api.replay_webhook
Events: webhook.replayed

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
shared.events.outbox, ops.integrations, ops.audit

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Inspect failed webhooks and permitted replay
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Inspect failed webhooks and permitted replay
- Boundary enforced: Verify signature/source/version; no duplicate authority action
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