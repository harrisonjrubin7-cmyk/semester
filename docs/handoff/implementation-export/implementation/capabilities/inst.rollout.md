# inst.rollout — Institutional change

Source-declared design contract, not current implementation proof.

routes: /institution/rollout
actors: institution_admin
permissions: rollout.approve
records: impl.projects, impl.milestones
commands: api.approve_rollout
events: rollout.approved
screen_types: overview, list, review

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
