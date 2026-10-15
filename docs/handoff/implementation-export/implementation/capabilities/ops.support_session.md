# ops.support_session — Support tooling

Source-declared design contract, not current implementation proof.

routes: /console/support/:case/session
actors: support_agent
permissions: support_session.open
records: opsx.support_access_windows
commands: open_support_session
events: support.session_opened
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
