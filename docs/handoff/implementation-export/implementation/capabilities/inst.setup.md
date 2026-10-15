# inst.setup — Institution setup

Source-declared design contract, not current implementation proof.

routes: /institution, /institution/structure
actors: institution_admin
permissions: org.edit
records: core.institutions, iam.organization_units, iam.campuses
commands: update_structure
events: org.updated
screen_types: overview, edit, settings

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
