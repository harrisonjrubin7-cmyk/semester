# edu.marketplace — Campus marketplace

Status: proposed completion specification. Production activation disabled.

## Outcome
Offer, reserve and arrange permitted campus pickup

## Authority boundary
Verification labels do not guarantee safety; moderation and disputes
Authority: student-private or approved academic authority per object
Proposed owner: Product + Academic Engineering

## Source registry contracts
Routes: /app/market, /app/market/:id
Actors: student
Permissions: listing.create, offer.make
Records: market.listings, market.offers, market.drops, market.bids
Commands: api.create_listing, api.make_offer
Events: offer.made

## Build dependencies
shared.identity.signin, shared.org.memberships, shared.authz.grants, shared.audit

## Runtime collaborators
Resolve collaborators through canonical registry

## Workflow
1. Enter verified tenant/account and purpose
2. Read permitted source-labelled objects
3. Offer, reserve and arrange permitted campus pickup
4. Validate object permission, version, policy and freshness
5. Review scope, consequences and recovery; obtain required independent approval
6. Commit through canonical command with idempotency and authority receipt
7. Project, reconcile, notify and verify permitted result

## Acceptance tests
- Authorized actor completes: Offer, reserve and arrange permitted campus pickup
- Boundary enforced: Verification labels do not guarantee safety; moderation and disputes
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