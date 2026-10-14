# company.partners — Partnerships

Source-declared design contract, not current implementation proof.

routes: /company/partners
actors: partnerships
permissions: partner.edit, app.review
records: biz.accounts, biz.partner_apps, biz.app_installs
commands: review_app
events: app.approved
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
