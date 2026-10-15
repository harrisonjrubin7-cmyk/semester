# ops.security — Security

Source-declared design contract, not current implementation proof.

routes: /console/security
actors: security_analyst
permissions: finding.edit
records: sec.findings, sec.investigations
commands: api.open_finding
events: finding.opened
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
