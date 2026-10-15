# ops.incidents — Incident management

Source-declared design contract, not current implementation proof.

routes: /console/incidents
actors: incident_commander
permissions: incident:communicate
records: opsx.incidents, opsx.incident_updates
commands: api.open_incident, api.publish_update
events: incident.updated
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
