# inst.account — Institution account

Source-declared design contract, not current implementation proof.

routes: /institution/account
actors: account_owner
permissions: account.read
records: biz.contracts, commerce.subscriptions
commands: 
events: 
screen_types: overview

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
