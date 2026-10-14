# edu.marketplace — Campus marketplace

Source-declared design contract, not current implementation proof.

routes: /app/market, /app/market/:id
actors: student
permissions: listing.create, offer.make
records: market.listings, market.offers, market.drops, market.bids
commands: api.create_listing, api.make_offer
events: offer.made
screen_types: list, detail, edit

## Acceptance
- authorized complete job loop
- tenant/object negative access
- expiry/revocation enforcement
- source authority and freshness
- approval target/payload/version binding
- idempotent durable command
- outbox replay/reconciliation
- seven data-region states
- manual accessibility review
- exact-target deployment and applicable authority acceptance

Reconcile existing code and authority before adding or applying schemas. Production activation disabled.
