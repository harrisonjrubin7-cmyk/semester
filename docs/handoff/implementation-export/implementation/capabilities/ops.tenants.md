# ops.tenants — Tenant lifecycle

Source-declared design contract, not current implementation proof.

routes: /console/tenants
actors: operator
permissions: tenant:implement, tenant.suspend
records: core.institutions, ops.tenant_lifecycle_requests
commands: api.request_tenant_action
events: tenant.provisioned
screen_types: list, detail, review, history

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
