# company.support — Support

Source-declared design contract, not current implementation proof.

routes: /company/support, /console/support
actors: support_agent, support_lead
permissions: support:ticket
records: opsx.support_cases, opsx.case_events, opsx.support_access_windows
commands: api.assign_case, api.reply_case
events: case.updated
screen_types: list, detail, history

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
