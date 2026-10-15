# edu.support_access — Support access approval

Source-declared design contract, not current implementation proof.

routes: /app/support/access
actors: student
permissions: support_access.approve
records: opsx.support_access_windows, opsx.support_cases
commands: api.approve_support_access, api.revoke_support_access
events: support.access_approved
screen_types: detail, history

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
