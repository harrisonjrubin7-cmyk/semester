# inst.sections — Term and section management

Source-declared design contract, not current implementation proof.

routes: /institution/terms, /institution/sections
actors: registrar
permissions: section.edit
records: acad.terms, acad.sections
commands: sync_sections
events: section.synced
screen_types: list, detail

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
