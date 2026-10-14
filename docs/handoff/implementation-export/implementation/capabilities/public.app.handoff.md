# public.app.handoff — Application handoff

Source-declared design contract, not current implementation proof.

routes: /open, /download
actors: visitor, student
permissions: handoff.consume
records: onboard.handoff_transactions, onboard.preview_drafts
commands: api.create_handoff, api.consume_handoff, api.claim_preview
events: handoff.consumed
screen_types: detail

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
