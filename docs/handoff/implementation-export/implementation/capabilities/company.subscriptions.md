# company.subscriptions — Subscriptions

Source-declared design contract, not current implementation proof.

routes: /company/subscriptions
actors: billing_operator
permissions: subscription.edit
records: commerce.subscriptions, commerce.subscription_items, commerce.entitlements, commerce.account_organization_links
commands: update_subscription
events: subscription.changed
screen_types: list, detail, edit, history

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
