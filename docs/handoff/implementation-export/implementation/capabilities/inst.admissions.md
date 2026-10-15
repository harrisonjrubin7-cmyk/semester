# inst.admissions — Admissions

Source-declared design contract, not current implementation proof.

routes: /institution/admissions
actors: admissions_reviewer
permissions: application.review, application.decide
records: adm.applications, adm.decisions
commands: api.review_application, record_decision
events: decision.recorded
screen_types: list, detail, review

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
