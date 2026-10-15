# ops.dead_letters — Webhook dead letters

Source-declared design contract, not current implementation proof.

routes: /console/integrations/dead-letters
actors: reliability_engineer
permissions: job.replay
records: opsx.webhook_endpoints, opsx.webhook_deliveries
commands: api.replay_webhook
events: webhook.replayed
screen_types: list, detail, review

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
