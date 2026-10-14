# acct.support — Support

Source-declared design contract, not current implementation proof.

routes: /account/support
actors: account_owner
permissions: case.create
records: opsx.support_cases, opsx.case_events
commands: api.open_case
events: case.opened
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
