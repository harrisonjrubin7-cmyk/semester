# company.crm — Sales CRM

Source-declared design contract, not current implementation proof.

routes: /company/pipeline, /company/accounts/:id
actors: sales_rep, sales_manager
permissions: opportunity.edit
records: biz.accounts, biz.contacts, biz.opportunities, growth.leads
commands: api.update_opportunity
events: opportunity.stage_changed
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
